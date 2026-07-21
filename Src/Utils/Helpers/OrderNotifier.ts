import axios from 'axios';
import * as dotenv from 'dotenv';
import moment from 'moment';
import { pool } from '../../Configs/db_config';

dotenv.config();

const DEFAULT_ORDER_WEBHOOK_URL = process.env.ORDER_SLACK_URL || '';

interface OrderNotificationItem {
  product_name: string;
  quantity: number;
  unit_price: number | string;
}

export interface OrderNotificationPayload {
  id: string;
  tenant_id: string;
  store_name?: string;
  total_amount: number | string;
  payment_method: string;
  shipping_name?: string;
  shipping_city?: string;
  shipping_country?: string;
  items?: OrderNotificationItem[];
}

/**
 * Sends "new order placed" alerts to Slack. Deliberately a SEPARATE class
 * from ErrorNotifier (SlackMessageBuilder.ts) — order alerts post to
 * ORDER_SLACK_URL, a different webhook/channel than the error-alert one, so
 * a busy order queue never drowns out genuine error alerts (or vice versa).
 *
 * Forward-compatible with per-vendor Slack channels: `app_settings` already
 * carries a per-tenant `slack_orders_hook` key (see 006_app_settings.sql —
 * every seeded tenant already has one). `resolveWebhookUrl()` checks that
 * first and only falls back to the shared `ORDER_SLACK_URL` env var if the
 * vendor hasn't configured their own channel yet. This means "let vendors
 * pick their own Slack channel" (a planned feature) is just a settings-UI
 * task later — no notifier code changes needed when that ships.
 */
class OrderNotifier {
  private async resolveWebhookUrl(tenantId: string): Promise<string> {
    try {
      const result = await pool.query(
        `SELECT value FROM app_management.app_settings
         WHERE tenant_id = $1 AND key = 'slack_orders_hook'`,
        [tenantId],
      );
      return result.rows[0]?.value || DEFAULT_ORDER_WEBHOOK_URL;
    } catch (err) {
      console.error('[OrderNotifier] webhook lookup failed:', err);
      return DEFAULT_ORDER_WEBHOOK_URL;
    }
  }

  private buildMessageBody(order: OrderNotificationPayload) {
    const itemLines =
      (order.items ?? [])
        .map((i) => `• ${i.quantity} × ${i.product_name} (@ ${i.unit_price})`)
        .join('\n') || 'No item detail available';

    return {
      username: 'ShopForge Orders',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:shopping_bags: *New Order Placed* — ${moment().format('DD-MMM-YYYY HH:mm:ss')}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Store:* ${order.store_name ?? order.tenant_id}\n*Order ID:* \`${order.id}\``,
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: itemLines },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Total:* ${order.total_amount}   *Payment:* ${order.payment_method}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Ship to: ${order.shipping_name ?? '—'}, ${order.shipping_city ?? ''} ${order.shipping_country ?? ''}`,
            },
          ],
        },
      ],
    };
  }

  /**
   * Fire-and-forget — callers must NOT await this on the checkout response
   * path in a way that blocks the customer (see Order.Service.ts checkout(),
   * which calls this only after the DB transaction has already committed).
   * A Slack outage must never fail or delay order placement.
   */
  async notifyNewOrder(order: OrderNotificationPayload): Promise<void> {
    const webhookUrl = await this.resolveWebhookUrl(order.tenant_id);
    const subject = `New order placed at ${order.store_name ?? order.tenant_id}`;

    if (!webhookUrl) {
      console.warn(
        `[OrderNotifier] no Slack webhook configured for tenant ${order.tenant_id} — skipping`,
      );
      await this.logNotification(order, subject, 'suppressed');
      return;
    }

    try {
      await axios.post(webhookUrl, this.buildMessageBody(order), {
        headers: { 'Content-Type': 'application/json' },
      });
      await this.logNotification(order, subject, 'sent');
    } catch (err) {
      console.error('[OrderNotifier] failed to send Slack notification:', err);
      await this.logNotification(order, subject, 'failed');
    }
  }

  private async logNotification(
    order: OrderNotificationPayload,
    subject: string,
    status: 'sent' | 'failed' | 'suppressed',
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO app_management.notifications_log
           (tenant_id, order_id, channel, status, subject, sent_at)
         VALUES ($1, $2, 'slack', $3, $4, $5)`,
        [
          order.tenant_id,
          order.id,
          status,
          subject,
          status === 'sent' ? new Date() : null,
        ],
      );
    } catch (err) {
      console.error('[OrderNotifier] failed to write notifications_log:', err);
    }
  }
}

export const orderNotifier = new OrderNotifier();
