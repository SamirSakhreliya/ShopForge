-- ============================================================
-- Seed: Orders, Order Items, Order Status History, Notifications
-- 3 orders across both tenants covering different statuses
-- ============================================================

-- ---- Order 1: TechGadgets Pro — Alice — delivered ----
INSERT INTO order_management.orders (id, tenant_id, customer_id, status, payment_method, payment_status, subtotal, discount_amount, shipping_fee, tax_amount, total_amount, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_country, shipping_zip, tracking_number, confirmed_at, shipped_at, delivered_at, created_at) VALUES
(
  'f1f2f3f4-0006-0006-0006-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'b1b2c3d4-0002-0002-0002-000000000004',
  'delivered',
  'card',
  'paid',
  924.98,
  0.00,
  9.99,
  83.25,
  1018.22,
  'Alice Chen',
  '+1-415-555-2001',
  '301 Green St, Apt 4B',
  'San Francisco',
  'US',
  '94133',
  'UPS-1Z999AA10123456784',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '11 days'
);

INSERT INTO order_management.order_items (id, order_id, tenant_id, product_id, product_name, product_sku, quantity, unit_price) VALUES
(
  'f2f2f3f4-0006-0006-0006-000000000001',
  'f1f2f3f4-0006-0006-0006-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'd1d2d3d4-0004-0004-0004-000000000001',
  'ProPhone X12',
  'TG-PPX12-BLK',
  1,
  899.99
),
(
  'f2f2f3f4-0006-0006-0006-000000000002',
  'f1f2f3f4-0006-0006-0006-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'd1d2d3d4-0004-0004-0004-000000000004',
  'ArmourCase ProPhone X12',
  'TG-CASE-X12',
  1,
  24.99
);

INSERT INTO order_management.order_status_history (order_id, tenant_id, from_status, to_status, changed_by, note) VALUES
('f1f2f3f4-0006-0006-0006-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', NULL,          'pending',    NULL,                                        'Order placed'),
('f1f2f3f4-0006-0006-0006-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'pending',     'confirmed',  'b1b2c3d4-0002-0002-0002-000000000002',      'Payment verified'),
('f1f2f3f4-0006-0006-0006-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'confirmed',   'processing', 'b1b2c3d4-0002-0002-0002-000000000002',      'Packing order'),
('f1f2f3f4-0006-0006-0006-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'processing',  'shipped',    'b1b2c3d4-0002-0002-0002-000000000002',      'Handed to UPS'),
('f1f2f3f4-0006-0006-0006-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'shipped',     'delivered',  NULL,                                        'Customer confirmed delivery');

-- ---- Order 2: TechGadgets Pro — Bob — confirmed (in progress) ----
INSERT INTO order_management.orders (id, tenant_id, customer_id, status, payment_method, payment_status, subtotal, discount_amount, shipping_fee, tax_amount, total_amount, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_country, shipping_zip, confirmed_at, created_at) VALUES
(
  'f1f2f3f4-0006-0006-0006-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'b1b2c3d4-0002-0002-0002-000000000005',
  'confirmed',
  'cash_on_delivery',
  'unpaid',
  1249.00,
  50.00,
  0.00,
  107.91,
  1306.91,
  'Bob Martinez',
  '+1-415-555-2002',
  '77 Folsom St',
  'San Francisco',
  'US',
  '94105',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '2 days'
);

INSERT INTO order_management.order_items (id, order_id, tenant_id, product_id, product_name, product_sku, quantity, unit_price) VALUES
(
  'f2f2f3f4-0006-0006-0006-000000000003',
  'f1f2f3f4-0006-0006-0006-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'd1d2d3d4-0004-0004-0004-000000000002',
  'UltraBook 15 Pro',
  'TG-UB15P-SLV',
  1,
  1249.00
);

INSERT INTO order_management.order_status_history (order_id, tenant_id, from_status, to_status, changed_by, note) VALUES
('f1f2f3f4-0006-0006-0006-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', NULL,      'pending',   NULL,                                   'Order placed'),
('f1f2f3f4-0006-0006-0006-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', 'pending', 'confirmed', 'b1b2c3d4-0002-0002-0002-000000000002', 'COD confirmed');

-- ---- Order 3: Urban Threads — Chloe — pending ----
INSERT INTO order_management.orders (id, tenant_id, customer_id, status, payment_method, payment_status, subtotal, discount_amount, shipping_fee, tax_amount, total_amount, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_country, shipping_zip, created_at) VALUES
(
  'f1f2f3f4-0006-0006-0006-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'b1b2c3d4-0002-0002-0002-000000000006',
  'pending',
  'card',
  'paid',
  198.00,
  0.00,
  5.99,
  20.40,
  224.39,
  'Chloe Dubois',
  '+44-7700-900003',
  '22 Baker Street',
  'London',
  'GB',
  'NW1 6XE',
  NOW() - INTERVAL '3 hours'
);

INSERT INTO order_management.order_items (id, order_id, tenant_id, product_id, product_name, product_sku, quantity, unit_price) VALUES
(
  'f2f2f3f4-0006-0006-0006-000000000004',
  'f1f2f3f4-0006-0006-0006-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'd1d2d3d4-0004-0004-0004-000000000006',
  'Floral Wrap Dress',
  'UT-WRP-FLR',
  1,
  119.00
),
(
  'f2f2f3f4-0006-0006-0006-000000000005',
  'f1f2f3f4-0006-0006-0006-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'd1d2d3d4-0004-0004-0004-000000000008',
  'Canvas Tote Bag',
  'UT-TOTE-NAT',
  1,
  45.00
),
(
  'f2f2f3f4-0006-0006-0006-000000000006',
  'f1f2f3f4-0006-0006-0006-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'd1d2d3d4-0004-0004-0004-000000000007',
  'Slim Chino Trousers',
  'UT-CHN-NVY',
  1,
  34.00
);

INSERT INTO order_management.order_status_history (order_id, tenant_id, from_status, to_status, changed_by, note) VALUES
('f1f2f3f4-0006-0006-0006-000000000003', 'a1b2c3d4-0001-0001-0001-000000000002', NULL, 'pending', NULL, 'Order placed — awaiting vendor confirmation');

-- ---- App Settings ----
INSERT INTO app_management.app_settings (tenant_id, key, value, description, is_public) VALUES
('a1b2c3d4-0001-0001-0001-000000000001', 'currency',          'USD',     'Storefront currency code',             TRUE),
('a1b2c3d4-0001-0001-0001-000000000001', 'theme_color',       '#1a56db', 'Primary brand colour (hex)',           TRUE),
('a1b2c3d4-0001-0001-0001-000000000001', 'slack_orders_hook', 'https://hooks.slack.com/services/TGADGETS/BXXX/yyy', 'Slack webhook for #orders alerts', FALSE),
('a1b2c3d4-0001-0001-0001-000000000001', 'low_stock_threshold','10',     'Alert when stock falls below this qty', FALSE),
('a1b2c3d4-0001-0001-0001-000000000002', 'currency',          'GBP',     'Storefront currency code',             TRUE),
('a1b2c3d4-0001-0001-0001-000000000002', 'theme_color',       '#111827', 'Primary brand colour (hex)',           TRUE),
('a1b2c3d4-0001-0001-0001-000000000002', 'slack_orders_hook', 'https://hooks.slack.com/services/TURBAN/BXXX/zzz', 'Slack webhook for #orders alerts', FALSE),
(NULL,                                   'platform_version',  '1.0.0',   'Current API version',                  TRUE),
(NULL,                                   'maintenance_mode',  'false',   'Disables all non-admin endpoints',     FALSE);

-- ---- Notifications Log (sample entries) ----
INSERT INTO app_management.notifications_log (tenant_id, user_id, order_id, channel, status, subject, sent_at) VALUES
('a1b2c3d4-0001-0001-0001-000000000001', 'b1b2c3d4-0002-0002-0002-000000000004', 'f1f2f3f4-0006-0006-0006-000000000001', 'slack', 'sent', 'New order #ORD-001 placed', NOW() - INTERVAL '11 days'),
('a1b2c3d4-0001-0001-0001-000000000001', 'b1b2c3d4-0002-0002-0002-000000000004', 'f1f2f3f4-0006-0006-0006-000000000001', 'email', 'sent', 'Your order has shipped',     NOW() - INTERVAL '7 days'),
('a1b2c3d4-0001-0001-0001-000000000001', 'b1b2c3d4-0002-0002-0002-000000000005', 'f1f2f3f4-0006-0006-0006-000000000002', 'slack', 'sent', 'New order #ORD-002 placed', NOW() - INTERVAL '2 days'),
('a1b2c3d4-0001-0001-0001-000000000002', 'b1b2c3d4-0002-0002-0002-000000000006', 'f1f2f3f4-0006-0006-0006-000000000003', 'slack', 'sent', 'New order #ORD-003 placed', NOW() - INTERVAL '3 hours');
