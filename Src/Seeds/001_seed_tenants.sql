-- ============================================================
-- Seed: Tenants
-- 3 vendors with different plans and statuses
-- ============================================================

INSERT INTO tenants_management.tenants (id, name, slug, logo_url, contact_email, contact_phone, business_address, status, plan) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'TechGadgets Pro',
  'techgadgets-pro',
  'http://0.0.0.0:4000/assets/business/techgadgets.png',
  'hello@techgadgetspro.com',
  '+1-415-555-0101',
  '200 Market St, San Francisco, CA 94105',
  'active',
  'pro'
),
(
  'a1b2c3d4-0001-0001-0001-000000000002',
  'Urban Threads',
  'urban-threads',
  'http://0.0.0.0:4000/assets/business/urbanthreads.png',
  'support@urbanthreads.io',
  '+44-20-7946-0202',
  '14 Carnaby Street, London, W1F 9PW',
  'active',
  'enterprise'
),
(
  'a1b2c3d4-0001-0001-0001-000000000003',
  'Artisan Bakes',
  'artisan-bakes',
  NULL,
  'orders@artisanbakes.co',
  '+61-2-9374-0303',
  '88 Glebe Point Rd, Sydney NSW 2037',
  'pending_review',
  'free'
);
