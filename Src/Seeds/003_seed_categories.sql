-- ============================================================
-- Seed: Categories
-- TechGadgets Pro: Electronics > Phones, Laptops, Accessories
-- Urban Threads:   Clothing > Men, Women, Accessories
-- ============================================================

-- ---- TechGadgets Pro root ----
INSERT INTO category_management.categories (id, tenant_id, parent_id, name, slug, description, sort_order, is_active) VALUES
(
  'c1c2c3c4-0003-0003-0003-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  NULL,
  'Electronics',
  'electronics',
  'All consumer electronics and gadgets',
  1,
  TRUE
);

-- TechGadgets Pro sub-categories
INSERT INTO category_management.categories (id, tenant_id, parent_id, name, slug, description, sort_order, is_active) VALUES
(
  'c1c2c3c4-0003-0003-0003-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000001',
  'Phones',
  'phones',
  'Smartphones and accessories',
  1,
  TRUE
),
(
  'c1c2c3c4-0003-0003-0003-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000001',
  'Laptops',
  'laptops',
  'Laptops, ultrabooks and chromebooks',
  2,
  TRUE
),
(
  'c1c2c3c4-0003-0003-0003-000000000004',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'c1c2c3c4-0003-0003-0003-000000000001',
  'Accessories',
  'accessories',
  'Cables, cases, chargers and more',
  3,
  TRUE
);

-- ---- Urban Threads root ----
INSERT INTO category_management.categories (id, tenant_id, parent_id, name, slug, description, sort_order, is_active) VALUES
(
  'c1c2c3c4-0003-0003-0003-000000000005',
  'a1b2c3d4-0001-0001-0001-000000000002',
  NULL,
  'Clothing',
  'clothing',
  'Fashion and apparel',
  1,
  TRUE
);

-- Urban Threads sub-categories
INSERT INTO category_management.categories (id, tenant_id, parent_id, name, slug, description, sort_order, is_active) VALUES
(
  'c1c2c3c4-0003-0003-0003-000000000006',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000005',
  'Men',
  'men',
  'Menswear',
  1,
  TRUE
),
(
  'c1c2c3c4-0003-0003-0003-000000000007',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000005',
  'Women',
  'women',
  'Womenswear',
  2,
  TRUE
),
(
  'c1c2c3c4-0003-0003-0003-000000000008',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'c1c2c3c4-0003-0003-0003-000000000005',
  'Accessories',
  'accessories',
  'Bags, belts, jewellery',
  3,
  TRUE
);
