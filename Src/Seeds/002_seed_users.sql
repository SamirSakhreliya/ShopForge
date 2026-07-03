-- ============================================================
-- Seed: Users
-- 1 SuperAdmin (no tenant), 2 Vendors (one per active tenant),
-- 4 Customers with global accounts (tenant_id = NULL — see
-- 007_seed_customer_vendor_links.sql for their storefront links).
--
-- Passwords are bcrypt hashes of 'Password@123' (cost 10).
-- ============================================================

-- SuperAdmin (tenant_id = NULL)
INSERT INTO user_management.users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, is_email_verified) VALUES
(
  'b1b2c3d4-0002-0002-0002-000000000001',
  NULL,
  'superadmin@shopforge.io',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'SuperAdmin',
  'Alex',
  'Forge',
  '+1-800-555-0000',
  TRUE,
  TRUE
);

-- Vendor users (one per active tenant)
INSERT INTO user_management.users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, is_email_verified) VALUES
(
  'b1b2c3d4-0002-0002-0002-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'vendor@techgadgetspro.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Vendor',
  'Jordan',
  'Kim',
  '+1-415-555-1001',
  TRUE,
  TRUE
),
(
  'b1b2c3d4-0002-0002-0002-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000002',
  'vendor@urbanthreads.io',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Vendor',
  'Priya',
  'Sharma',
  '+44-20-7946-1002',
  TRUE,
  TRUE
);

-- Customers — global accounts, tenant_id = NULL.
-- Alice & Bob shopped at TechGadgets Pro; Chloe & Daniel at Urban Threads
-- (see 007_seed_customer_vendor_links.sql for the actual relationships).
INSERT INTO user_management.users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, is_email_verified) VALUES
(
  'b1b2c3d4-0002-0002-0002-000000000004',
  NULL,
  'alice.chen@example.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Customer',
  'Alice',
  'Chen',
  '+1-415-555-2001',
  TRUE,
  TRUE
),
(
  'b1b2c3d4-0002-0002-0002-000000000005',
  NULL,
  'bob.martinez@example.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Customer',
  'Bob',
  'Martinez',
  '+1-415-555-2002',
  TRUE,
  FALSE
),
(
  'b1b2c3d4-0002-0002-0002-000000000006',
  NULL,
  'chloe.d@example.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Customer',
  'Chloe',
  'Dubois',
  '+44-7700-900003',
  TRUE,
  TRUE
),
(
  'b1b2c3d4-0002-0002-0002-000000000007',
  NULL,
  'dan.okafor@example.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Customer',
  'Daniel',
  'Okafor',
  '+44-7700-900004',
  TRUE,
  TRUE
);
