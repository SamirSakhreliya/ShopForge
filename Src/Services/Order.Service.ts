import { pool } from '../Configs/db_config';
import { authService } from './Auth.Service';
import {
  orderNotifier,
  OrderNotificationPayload,
} from '../Utils/Helpers/OrderNotifier';

interface CheckoutInput {
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  shipping_zip: string;
  payment_method: 'card' | 'cash_on_delivery' | 'wallet' | 'bank_transfer';
  notes?: string;
}

interface OrderListFilters {
  status?: string;
  page: number;
  limit: number;
}

interface UpdateOrderStatusInput {
  status: string;
  note?: string;
  tracking_number?: string;
}

// State machine — mirrors the diagram in DATABASE.md:
//   pending -> confirmed -> processing -> shipped -> delivered
//      \-> cancelled (from pending/confirmed/processing only)
//                                  delivered -> refunded
const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

// Columns safe to expose to the customer — excludes internal_notes, which is
// vendor-only (see 005_orders.sql comment: "Vendor-only notes").
const CUSTOMER_ORDER_COLUMNS = `
  o.id, o.tenant_id, o.customer_id, o.status, o.payment_method, o.payment_status,
  o.subtotal, o.discount_amount, o.shipping_fee, o.tax_amount, o.total_amount,
  o.shipping_name, o.shipping_phone, o.shipping_address, o.shipping_city,
  o.shipping_country, o.shipping_zip, o.tracking_number, o.notes,
  o.cancelled_reason, o.confirmed_at, o.shipped_at, o.delivered_at,
  o.cancelled_at, o.created_at, o.updated_at
`;

const VENDOR_ORDER_COLUMNS = `${CUSTOMER_ORDER_COLUMNS}, o.internal_notes`;

class OrderService {
  // ─── Checkout ────────────────────────────────────────────────────────────

  /**
   * Checks out the customer's entire cart. A cart can hold items from
   * multiple vendors — this splits it into one order PER TENANT, all
   * created atomically in a single DB transaction (either every vendor's
   * order is created, or none is — same all-or-nothing pattern as
   * Category.Service.createCategoryWithProducts). Mirrors how a real
   * multi-vendor marketplace ships each seller's items as its own
   * order/shipment under one checkout action.
   */
  async checkout(customerId: string, input: CheckoutInput) {
    const client = await pool.connect();
    let createdOrders: Record<string, unknown>[] = [];

    try {
      await client.query('BEGIN');

      const cartResult = await client.query(
        'SELECT id FROM cart_management.carts WHERE customer_id = $1',
        [customerId],
      );
      if (cartResult.rowCount === 0) {
        throw { statusCode: 400, message: 'Cart is empty' };
      }
      const cartId = cartResult.rows[0].id;

      // Lock every referenced product row up front (ordered by product_id to
      // avoid deadlocking against a concurrent checkout touching overlapping
      // products) so the stock checks below are race-free.
      const itemsResult = await client.query(
        `SELECT ci.product_id, ci.tenant_id, ci.quantity,
                p.name AS product_name, p.sku, p.price, p.stock_quantity,
                p.is_active, t.status AS tenant_status, t.name AS store_name
         FROM cart_management.cart_items ci
         INNER JOIN product_management.products p ON p.id = ci.product_id
         INNER JOIN tenants_management.tenants t ON t.id = ci.tenant_id
         WHERE ci.cart_id = $1
         ORDER BY ci.product_id ASC
         FOR UPDATE OF p`,
        [cartId],
      );

      if (itemsResult.rowCount === 0) {
        throw { statusCode: 400, message: 'Cart is empty' };
      }

      for (const item of itemsResult.rows) {
        if (!item.is_active || item.tenant_status !== 'active') {
          throw {
            statusCode: 409,
            message: `"${item.product_name}" is no longer available`,
          };
        }
        if (item.quantity > item.stock_quantity) {
          throw {
            statusCode: 409,
            message: `Only ${item.stock_quantity} unit(s) of "${item.product_name}" are in stock`,
          };
        }
      }

      // Group cart lines by vendor — one order per tenant.
      const byTenant = new Map<string, typeof itemsResult.rows>();
      for (const item of itemsResult.rows) {
        if (!byTenant.has(item.tenant_id)) byTenant.set(item.tenant_id, []);
        byTenant.get(item.tenant_id)!.push(item);
      }

      createdOrders = [];

      for (const [tenantId, items] of byTenant) {
        const subtotal = items.reduce(
          (sum, i) => sum + Number(i.price) * i.quantity,
          0,
        );
        // discount/shipping/tax are not modeled yet (flat 0) — MVP scope,
        // see CLAUDE.md "Order module" follow-up notes.
        const totalAmount = subtotal;

        const orderResult = await client.query(
          `INSERT INTO order_management.orders AS o
             (tenant_id, customer_id, status, payment_method, payment_status,
              subtotal, discount_amount, shipping_fee, tax_amount, total_amount,
              shipping_name, shipping_phone, shipping_address, shipping_city,
              shipping_country, shipping_zip, notes)
           VALUES ($1, $2, 'pending', $3, 'unpaid', $4, 0, 0, 0, $5,
                   $6, $7, $8, $9, $10, $11, $12)
           RETURNING ${CUSTOMER_ORDER_COLUMNS}`,
          [
            tenantId,
            customerId,
            input.payment_method,
            subtotal,
            totalAmount,
            input.shipping_name,
            input.shipping_phone,
            input.shipping_address,
            input.shipping_city,
            input.shipping_country,
            input.shipping_zip,
            input.notes ?? null,
          ],
        );
        const order = orderResult.rows[0];

        const orderItems: Record<string, unknown>[] = [];
        for (const item of items) {
          const itemResult = await client.query(
            `INSERT INTO order_management.order_items
               (order_id, tenant_id, product_id, product_name, product_sku, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, product_id, product_name, product_sku, quantity, unit_price, subtotal`,
            [
              order.id,
              tenantId,
              item.product_id,
              item.product_name,
              item.sku,
              item.quantity,
              item.price,
            ],
          );
          orderItems.push(itemResult.rows[0]);

          // Guarded decrement — the WHERE clause means this can never drive
          // stock negative even in isolation, but the FOR UPDATE lock above
          // is what makes the pre-flight availability check above trustworthy
          // (no other transaction can shrink stock between check and write).
          await client.query(
            `UPDATE product_management.products
             SET stock_quantity = stock_quantity - $1, updated_at = NOW()
             WHERE id = $2 AND stock_quantity >= $1`,
            [item.quantity, item.product_id],
          );
        }

        await client.query(
          `INSERT INTO order_management.order_status_history
             (order_id, tenant_id, from_status, to_status, changed_by, note)
           VALUES ($1, $2, NULL, 'pending', $3, 'Order placed')`,
          [order.id, tenantId, customerId],
        );

        createdOrders.push({
          ...order,
          store_name: items[0].store_name,
          items: orderItems,
        });
      }

      // Only the lines that were just checked out are removed — a targeted
      // delete by cart_id (not e.g. a blind clearCart()) so this stays
      // correct even if the cart model grows a "save for later" concept.
      await client.query(
        'DELETE FROM cart_management.cart_items WHERE cart_id = $1',
        [cartId],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Everything below runs only after a successful commit, and never blocks
    // or fails the checkout response — a slow/down Slack webhook or a
    // customer_vendor_links hiccup must not undo a placed order.

    for (const order of createdOrders) {
      const o = order as { tenant_id: string };
      authService
        .linkCustomerToVendor(customerId, o.tenant_id)
        .catch((err) =>
          console.error('[OrderService] linkCustomerToVendor failed:', err),
        );
    }

    for (const order of createdOrders) {
      orderNotifier
        .notifyNewOrder(order as unknown as OrderNotificationPayload)
        .catch((err) =>
          console.error('[OrderService] order notification failed:', err),
        );
    }

    return createdOrders;
  }

  // ─── Vendor view ─────────────────────────────────────────────────────────

  /** FIFO queue — oldest pending orders first, per CLAUDE.md/DATABASE.md. */
  async listVendorOrders(tenantId: string, filters: OrderListFilters) {
    const { status, page, limit } = filters;

    const conditions: string[] = ['o.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (status) {
      conditions.push(`o.status = $${i++}`);
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const query = `
      SELECT
        o.id, o.tenant_id, o.customer_id, o.status, o.payment_method,
        o.payment_status, o.subtotal, o.total_amount, o.shipping_name,
        o.shipping_city, o.shipping_country, o.tracking_number, o.created_at,
        u.first_name AS customer_first_name, u.last_name AS customer_last_name,
        COUNT(*) OVER() AS total_count
      FROM order_management.orders o
      INNER JOIN user_management.users u ON u.id = o.customer_id
      WHERE ${whereClause}
      ORDER BY o.created_at ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(query, params);
    const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
    const items = result.rows.map(
      ({ total_count: _total_count, ...row }) => row,
    );

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getVendorOrderById(id: string, tenantId: string) {
    const orderResult = await pool.query(
      `SELECT ${VENDOR_ORDER_COLUMNS},
              u.first_name AS customer_first_name, u.last_name AS customer_last_name,
              u.email AS customer_email, u.phone AS customer_phone
       FROM order_management.orders o
       INNER JOIN user_management.users u ON u.id = o.customer_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [id, tenantId],
    );
    if (orderResult.rowCount === 0) {
      throw { statusCode: 404, message: 'Order not found' };
    }

    const [items, history] = await Promise.all([
      pool.query(
        `SELECT id, product_id, product_name, product_sku, quantity, unit_price, subtotal
         FROM order_management.order_items WHERE order_id = $1`,
        [id],
      ),
      pool.query(
        `SELECT from_status, to_status, note, created_at
         FROM order_management.order_status_history
         WHERE order_id = $1 ORDER BY created_at ASC`,
        [id],
      ),
    ]);

    return { ...orderResult.rows[0], items: items.rows, history: history.rows };
  }

  /**
   * Vendor transitions an order to a new status. Enforces the state machine
   * (ORDER_TRANSITIONS) so e.g. `pending` can never jump straight to
   * `delivered`. Cancelling before shipment restocks every line item —
   * see FEATURE_IMPACT.md "Order cancellation flow."
   */
  async updateOrderStatus(
    id: string,
    tenantId: string,
    changedBy: string,
    input: UpdateOrderStatusInput,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        'SELECT status FROM order_management.orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [id, tenantId],
      );
      if (current.rowCount === 0) {
        throw { statusCode: 404, message: 'Order not found' };
      }

      const fromStatus: string = current.rows[0].status;
      const allowed = ORDER_TRANSITIONS[fromStatus] ?? [];
      if (!allowed.includes(input.status)) {
        throw {
          statusCode: 400,
          message: `Cannot transition order from "${fromStatus}" to "${input.status}"`,
        };
      }

      const timestampColumn: Record<string, string> = {
        confirmed: 'confirmed_at',
        shipped: 'shipped_at',
        delivered: 'delivered_at',
        cancelled: 'cancelled_at',
      };

      const extraSet: string[] = [];
      const params: unknown[] = [input.status];
      let i = 2;

      if (timestampColumn[input.status]) {
        extraSet.push(`${timestampColumn[input.status]} = NOW()`);
      }
      if (input.status === 'cancelled') {
        extraSet.push(`cancelled_reason = $${i++}`);
        params.push(input.note ?? null);
      }
      if (input.status === 'shipped' && input.tracking_number) {
        extraSet.push(`tracking_number = $${i++}`);
        params.push(input.tracking_number);
      }

      params.push(id, tenantId);
      const idIdx = i++;
      const tenantIdx = i++;

      const result = await client.query(
        `UPDATE order_management.orders AS o
         SET status = $1, updated_at = NOW()${extraSet.length ? ', ' + extraSet.join(', ') : ''}
         WHERE o.id = $${idIdx} AND o.tenant_id = $${tenantIdx}
         RETURNING ${VENDOR_ORDER_COLUMNS}`,
        params,
      );

      await client.query(
        `INSERT INTO order_management.order_status_history
           (order_id, tenant_id, from_status, to_status, changed_by, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, tenantId, fromStatus, input.status, changedBy, input.note ?? null],
      );

      // Cancelling before shipment returns stock to inventory.
      if (input.status === 'cancelled') {
        const items = await client.query(
          `SELECT product_id, quantity FROM order_management.order_items
           WHERE order_id = $1 AND product_id IS NOT NULL`,
          [id],
        );
        for (const item of items.rows) {
          await client.query(
            `UPDATE product_management.products
             SET stock_quantity = stock_quantity + $1, updated_at = NOW()
             WHERE id = $2`,
            [item.quantity, item.product_id],
          );
        }
      }

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ─── Customer view ───────────────────────────────────────────────────────

  async listCustomerOrders(customerId: string, filters: OrderListFilters) {
    const { status, page, limit } = filters;

    const conditions: string[] = ['o.customer_id = $1'];
    const params: unknown[] = [customerId];
    let i = 2;

    if (status) {
      conditions.push(`o.status = $${i++}`);
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const query = `
      SELECT
        o.id, o.tenant_id, o.status, o.payment_method, o.payment_status,
        o.subtotal, o.total_amount, o.tracking_number, o.created_at,
        t.name AS store_name, t.slug AS store_slug,
        COUNT(*) OVER() AS total_count
      FROM order_management.orders o
      INNER JOIN tenants_management.tenants t ON t.id = o.tenant_id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(query, params);
    const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
    const items = result.rows.map(
      ({ total_count: _total_count, ...row }) => row,
    );

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCustomerOrderById(id: string, customerId: string) {
    const orderResult = await pool.query(
      `SELECT ${CUSTOMER_ORDER_COLUMNS}, t.name AS store_name, t.slug AS store_slug
       FROM order_management.orders o
       INNER JOIN tenants_management.tenants t ON t.id = o.tenant_id
       WHERE o.id = $1 AND o.customer_id = $2`,
      [id, customerId],
    );
    if (orderResult.rowCount === 0) {
      throw { statusCode: 404, message: 'Order not found' };
    }

    const [items, history] = await Promise.all([
      pool.query(
        `SELECT id, product_id, product_name, product_sku, quantity, unit_price, subtotal
         FROM order_management.order_items WHERE order_id = $1`,
        [id],
      ),
      pool.query(
        `SELECT from_status, to_status, note, created_at
         FROM order_management.order_status_history
         WHERE order_id = $1 ORDER BY created_at ASC`,
        [id],
      ),
    ]);

    return { ...orderResult.rows[0], items: items.rows, history: history.rows };
  }
}

export const orderService = new OrderService();
