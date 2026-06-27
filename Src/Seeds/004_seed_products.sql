-- ============================================================
-- Seed: Products + Product Images
-- 4 products for TechGadgets Pro, 4 for Urban Threads
-- ============================================================

-- ---- TechGadgets Pro products ----
INSERT INTO product_management.products (id, tenant_id, category_id, name, slug, description, price, compare_price, cost_price, stock_quantity, sku, is_active, is_featured) VALUES
(
  'd1d2d3d4-0004-0004-0004-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000002',
  'ProPhone X12',
  'prophone-x12',
  'Flagship smartphone with 6.7" AMOLED display, 50MP triple camera, 5000mAh battery.',
  899.99,
  1099.99,
  540.00,
  120,
  'TG-PPX12-BLK',
  TRUE,
  TRUE
),
(
  'd1d2d3d4-0004-0004-0004-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000003',
  'UltraBook 15 Pro',
  'ultrabook-15-pro',
  'Thin & light 15.6" laptop, Intel Core i7, 16GB RAM, 512GB NVMe SSD.',
  1249.00,
  1499.00,
  780.00,
  45,
  'TG-UB15P-SLV',
  TRUE,
  TRUE
),
(
  'd1d2d3d4-0004-0004-0004-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000004',
  'MagCharge Wireless Pad',
  'magcharge-wireless-pad',
  '15W fast wireless charging pad, compatible with all Qi-enabled devices.',
  34.99,
  49.99,
  12.00,
  300,
  'TG-MCWP-WHT',
  TRUE,
  FALSE
),
(
  'd1d2d3d4-0004-0004-0004-000000000004',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000004',
  'ArmourCase ProPhone X12',
  'armourcase-prophone-x12',
  'Military-grade drop protection case for ProPhone X12. Slim profile, raised bezels.',
  24.99,
  NULL,
  8.00,
  200,
  'TG-CASE-X12',
  TRUE,
  FALSE
);

-- ---- Urban Threads products ----
INSERT INTO product_management.products (id, tenant_id, category_id, name, slug, description, price, compare_price, cost_price, stock_quantity, sku, is_active, is_featured) VALUES
(
  'd1d2d3d4-0004-0004-0004-000000000005',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000006',
  'Classic Oxford Shirt',
  'classic-oxford-shirt',
  '100% cotton Oxford weave shirt. Slim fit, button-down collar. Available in 5 colours.',
  79.00,
  95.00,
  28.00,
  180,
  'UT-OXF-MBL',
  TRUE,
  TRUE
),
(
  'd1d2d3d4-0004-0004-0004-000000000006',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000007',
  'Floral Wrap Dress',
  'floral-wrap-dress',
  'Lightweight viscose wrap dress with floral print. Midi length, adjustable tie waist.',
  119.00,
  149.00,
  42.00,
  95,
  'UT-WRP-FLR',
  TRUE,
  TRUE
),
(
  'd1d2d3d4-0004-0004-0004-000000000007',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000006',
  'Slim Chino Trousers',
  'slim-chino-trousers',
  'Stretch cotton chino trousers, tapered leg, 5-pocket design. Machine washable.',
  89.00,
  NULL,
  30.00,
  140,
  'UT-CHN-NVY',
  TRUE,
  FALSE
),
(
  'd1d2d3d4-0004-0004-0004-000000000008',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000008',
  'Canvas Tote Bag',
  'canvas-tote-bag',
  'Durable 100% cotton canvas tote. Internal zip pocket, reinforced handles. 20L capacity.',
  45.00,
  55.00,
  14.00,
  220,
  'UT-TOTE-NAT',
  TRUE,
  FALSE
);

-- ---- Product images ----
INSERT INTO product_management.product_images (id, product_id, tenant_id, url, alt_text, sort_order, is_primary) VALUES
('e1e2e3e4-0005-0005-0005-000000000001', 'd1d2d3d4-0004-0004-0004-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'http://0.0.0.0:4000/assets/item/prophone-x12-1.jpg', 'ProPhone X12 front view',   0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000002', 'd1d2d3d4-0004-0004-0004-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'http://0.0.0.0:4000/assets/item/prophone-x12-2.jpg', 'ProPhone X12 back view',    1, FALSE),
('e1e2e3e4-0005-0005-0005-000000000003', 'd1d2d3d4-0004-0004-0004-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', 'http://0.0.0.0:4000/assets/item/ultrabook-15-1.jpg', 'UltraBook 15 Pro open',     0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000004', 'd1d2d3d4-0004-0004-0004-000000000003', 'a1b2c3d4-0001-0001-0001-000000000001', 'http://0.0.0.0:4000/assets/item/magcharge-1.jpg',    'MagCharge pad top view',    0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000005', 'd1d2d3d4-0004-0004-0004-000000000004', 'a1b2c3d4-0001-0001-0001-000000000001', 'http://0.0.0.0:4000/assets/item/armourcase-1.jpg',  'ArmourCase front',          0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000006', 'd1d2d3d4-0004-0004-0004-000000000005', 'a1b2c3d4-0001-0001-0001-000000000002', 'http://0.0.0.0:4000/assets/item/oxford-shirt-1.jpg','Oxford Shirt blue',         0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000007', 'd1d2d3d4-0004-0004-0004-000000000005', 'a1b2c3d4-0001-0001-0001-000000000002', 'http://0.0.0.0:4000/assets/item/oxford-shirt-2.jpg','Oxford Shirt white',        1, FALSE),
('e1e2e3e4-0005-0005-0005-000000000008', 'd1d2d3d4-0004-0004-0004-000000000006', 'a1b2c3d4-0001-0001-0001-000000000002', 'http://0.0.0.0:4000/assets/item/floral-dress-1.jpg','Floral Wrap Dress front',   0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000009', 'd1d2d3d4-0004-0004-0004-000000000007', 'a1b2c3d4-0001-0001-0001-000000000002', 'http://0.0.0.0:4000/assets/item/chino-1.jpg',       'Slim Chino navy front',     0, TRUE),
('e1e2e3e4-0005-0005-0005-000000000010', 'd1d2d3d4-0004-0004-0004-000000000008', 'a1b2c3d4-0001-0001-0001-000000000002', 'http://0.0.0.0:4000/assets/item/tote-1.jpg',        'Canvas Tote natural',       0, TRUE);
