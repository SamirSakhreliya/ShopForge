-- ============================================================
-- Seed: Customer-Vendor Links
-- Records which storefront each seeded customer originally
-- registered/shopped on, now that Customer accounts are global
-- (see migration 007_customer_vendor_links.sql).
-- ============================================================

INSERT INTO user_management.customer_vendor_links (customer_id, tenant_id) VALUES
(
  'b1b2c3d4-0002-0002-0002-000000000004', -- Alice Chen
  'a1b2c3d4-0001-0001-0001-000000000001'  -- TechGadgets Pro
),
(
  'b1b2c3d4-0002-0002-0002-000000000005', -- Bob Martinez
  'a1b2c3d4-0001-0001-0001-000000000001'  -- TechGadgets Pro
),
(
  'b1b2c3d4-0002-0002-0002-000000000006', -- Chloe Dubois
  'a1b2c3d4-0001-0001-0001-000000000002'  -- Urban Threads
),
(
  'b1b2c3d4-0002-0002-0002-000000000007', -- Daniel Okafor
  'a1b2c3d4-0001-0001-0001-000000000002'  -- Urban Threads
)
ON CONFLICT (customer_id, tenant_id) DO NOTHING;
