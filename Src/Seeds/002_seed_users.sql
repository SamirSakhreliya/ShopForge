-- ============================================================
-- Seed: Users
-- 1 SuperAdmin (no tenant), 2 Vendors (one per active tenant),
-- 4 Customers across the two active tenants.
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

-- Customers for TechGadgets Pro
INSERT INTO user_management.users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, is_email_verified) VALUES
(
  'b1b2c3d4-0002-0002-0002-000000000004',
  'a1b2c3d4-0001-0001-0001-000000000001',
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
  'a1b2c3d4-0001-0001-0001-000000000001',
  'bob.martinez@example.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Customer',
  'Bob',
  'Martinez',
  '+1-415-555-2002',
  TRUE,
  FALSE
);

-- Customers for Urban Threads
INSERT INTO user_management.users (id, tenant_id, email, password_hash, role, first_name, last_name, phone, is_active, is_email_verified) VALUES
(
  'b1b2c3d4-0002-0002-0002-000000000006',
  'a1b2c3d4-0001-0001-0001-000000000002',
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
  'a1b2c3d4-0001-0001-0001-000000000002',
  'dan.okafor@example.com',
  '$2b$10$X9vQz1LmNpKqRtUoWyXeAeHjJkLmNpQrStUvWxYzAbCdEfGhIjKl',
  'Customer',
  'Daniel',
  'Okafor',
  '+44-7700-900004',
  TRUE,
  TRUE
);
