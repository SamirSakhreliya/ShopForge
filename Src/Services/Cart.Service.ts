import { pool } from '../Configs/db_config';

interface AddCartItemInput {
  product_id: string;
  quantity: number;
}

class CartService {
  // ─── Internal helpers ───────────────────────────────────────────────────

  private async getOrCreateCartId(customerId: string): Promise<string> {
    const existing = await pool.query(
      'SELECT id FROM cart_management.carts WHERE customer_id = $1',
      [customerId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return existing.rows[0].id;
    }

    const created = await pool.query(
      `INSERT INTO cart_management.carts (customer_id) VALUES ($1)
       RETURNING id`,
      [customerId],
    );
    return created.rows[0].id;
  }

  // ─── Read ────────────────────────────────────────────────────────────────

  /**
   * Cart contents grouped by vendor — mirrors how Order.Service.checkout()
   * splits the same cart into one order per tenant. Joins LIVE product data
   * (price / stock / is_active / storefront status) rather than any
   * snapshotted value, so the customer always sees up-to-date availability
   * before checking out.
   */
  async getCart(customerId: string) {
    const cartResult = await pool.query(
      'SELECT id FROM cart_management.carts WHERE customer_id = $1',
      [customerId],
    );
    if (cartResult.rowCount === 0) {
      return { cart_id: null, items: [], vendors: [], subtotal: 0 };
    }
    const cartId = cartResult.rows[0].id;

    const itemsResult = await pool.query(
      `SELECT
         ci.id, ci.product_id, ci.tenant_id, ci.quantity, ci.added_at,
         p.name AS product_name, p.slug AS product_slug, p.price, p.sku,
         p.stock_quantity, p.is_active,
         t.name AS store_name, t.slug AS store_slug, t.status AS store_status
       FROM cart_management.cart_items ci
       INNER JOIN product_management.products p ON p.id = ci.product_id
       INNER JOIN tenants_management.tenants t ON t.id = ci.tenant_id
       WHERE ci.cart_id = $1
       ORDER BY t.name ASC, ci.added_at ASC`,
      [cartId],
    );

    const items = itemsResult.rows;
    let subtotal = 0;

    const vendorMap = new Map<
      string,
      {
        tenant_id: string;
        store_name: string;
        store_slug: string;
        store_status: string;
        items: unknown[];
        subtotal: number;
      }
    >();

    for (const item of items) {
      const lineTotal = Number(item.price) * item.quantity;
      subtotal += lineTotal;

      if (!vendorMap.has(item.tenant_id)) {
        vendorMap.set(item.tenant_id, {
          tenant_id: item.tenant_id,
          store_name: item.store_name,
          store_slug: item.store_slug,
          store_status: item.store_status,
          items: [],
          subtotal: 0,
        });
      }
      const group = vendorMap.get(item.tenant_id)!;
      group.items.push(item);
      group.subtotal += lineTotal;
    }

    return {
      cart_id: cartId,
      items,
      vendors: Array.from(vendorMap.values()),
      subtotal,
    };
  }

  // ─── Write ───────────────────────────────────────────────────────────────

  /**
   * Adds a product to the cart, merging with any existing quantity for that
   * product (see uq_cart_items_cart_product in 009_cart.sql). Validated
   * against LIVE stock as a soft/early check — the authoritative,
   * race-free check happens again with a row lock at checkout time, since
   * stock can change between "add to cart" and "checkout."
   */
  async addItem(customerId: string, input: AddCartItemInput) {
    const { product_id, quantity } = input;

    const productResult = await pool.query(
      `SELECT p.id, p.tenant_id, p.stock_quantity, p.is_active, t.status AS tenant_status
       FROM product_management.products p
       INNER JOIN tenants_management.tenants t ON t.id = p.tenant_id
       WHERE p.id = $1`,
      [product_id],
    );
    if (productResult.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }
    const product = productResult.rows[0];
    if (!product.is_active || product.tenant_status !== 'active') {
      throw { statusCode: 404, message: 'Product not found' };
    }

    const cartId = await this.getOrCreateCartId(customerId);

    const existing = await pool.query(
      'SELECT quantity FROM cart_management.cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, product_id],
    );
    const newQuantity = (existing.rows[0]?.quantity ?? 0) + quantity;

    if (newQuantity > product.stock_quantity) {
      throw {
        statusCode: 409,
        message: `Only ${product.stock_quantity} unit(s) of this product are in stock`,
      };
    }

    const result = await pool.query(
      `INSERT INTO cart_management.cart_items (cart_id, product_id, tenant_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = $4, updated_at = NOW()
       RETURNING id, cart_id, product_id, tenant_id, quantity, added_at`,
      [cartId, product_id, product.tenant_id, newQuantity],
    );

    return result.rows[0];
  }

  async updateItemQuantity(
    customerId: string,
    productId: string,
    quantity: number,
  ) {
    const cartResult = await pool.query(
      'SELECT id FROM cart_management.carts WHERE customer_id = $1',
      [customerId],
    );
    if (cartResult.rowCount === 0) {
      throw { statusCode: 404, message: 'Item not found in cart' };
    }
    const cartId = cartResult.rows[0].id;

    const productResult = await pool.query(
      `SELECT p.stock_quantity FROM cart_management.cart_items ci
       INNER JOIN product_management.products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1 AND ci.product_id = $2`,
      [cartId, productId],
    );
    if (productResult.rowCount === 0) {
      throw { statusCode: 404, message: 'Item not found in cart' };
    }
    if (quantity > productResult.rows[0].stock_quantity) {
      throw {
        statusCode: 409,
        message: `Only ${productResult.rows[0].stock_quantity} unit(s) of this product are in stock`,
      };
    }

    const result = await pool.query(
      `UPDATE cart_management.cart_items
       SET quantity = $1, updated_at = NOW()
       WHERE cart_id = $2 AND product_id = $3
       RETURNING id, cart_id, product_id, tenant_id, quantity, added_at`,
      [quantity, cartId, productId],
    );

    return result.rows[0];
  }

  async removeItem(customerId: string, productId: string) {
    const result = await pool.query(
      `DELETE FROM cart_management.cart_items ci
       USING cart_management.carts c
       WHERE ci.cart_id = c.id AND c.customer_id = $1 AND ci.product_id = $2
       RETURNING ci.id`,
      [customerId, productId],
    );
    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Item not found in cart' };
    }
    return { id: result.rows[0].id };
  }

  async clearCart(customerId: string) {
    await pool.query(
      `DELETE FROM cart_management.cart_items ci
       USING cart_management.carts c
       WHERE ci.cart_id = c.id AND c.customer_id = $1`,
      [customerId],
    );
    return { cleared: true };
  }
}

export const cartService = new CartService();
