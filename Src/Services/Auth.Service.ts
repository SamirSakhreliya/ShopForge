import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../Configs/db_config';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = '7d';

interface TokenPayload {
  id: string;
  role: string;
  tenant_id: string | null;
}

interface RegisterCustomerInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  tenant_id?: string; // optional: auto-links to this vendor storefront on signup
  phone?: string;
}

interface RegisterVendorInput {
  // User fields
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
  // Tenant / storefront fields
  store_name: string;
  store_slug: string;
  contact_email: string;
  contact_phone?: string;
  business_address?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

class AuthService {
  /**
   * Register a new Customer.
   * Customer identity is global — one account works across every vendor
   * storefront on the platform, so tenant_id is NOT stored on the user row
   * (uniqueness is enforced globally by the partial index idx_users_customer_email).
   *
   * If tenant_id is supplied (customer signed up while browsing a specific
   * storefront), a customer_vendor_links row is created in the same
   * transaction so that vendor immediately sees them as a known customer.
   */
  async registerCustomer(input: RegisterCustomerInput) {
    const { first_name, last_name, email, password, tenant_id, phone } = input;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (tenant_id) {
        // Verify the tenant (storefront) exists and is active before linking
        const tenantCheck = await client.query(
          "SELECT id FROM tenants_management.tenants WHERE id = $1 AND status = 'active'",
          [tenant_id],
        );
        if (tenantCheck.rowCount === 0) {
          throw {
            statusCode: 404,
            message: 'Storefront not found or not active',
          };
        }
      }

      const userResult = await client.query(
        `INSERT INTO user_management.users
           (first_name, last_name, email, password_hash, role, phone)
         VALUES ($1, $2, $3, $4, 'Customer', $5)
         RETURNING id, tenant_id, email, role, first_name, last_name, phone, created_at`,
        [first_name, last_name, email, password_hash, phone ?? null],
      );
      const user = userResult.rows[0];

      if (tenant_id) {
        await client.query(
          `INSERT INTO user_management.customer_vendor_links (customer_id, tenant_id)
           VALUES ($1, $2)
           ON CONFLICT (customer_id, tenant_id) DO NOTHING`,
          [user.id, tenant_id],
        );
      }

      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Link an existing Customer to a Vendor's storefront — e.g. on their
   * first order or first visit. Idempotent (safe to call repeatedly).
   */
  async linkCustomerToVendor(customerId: string, tenantId: string) {
    await pool.query(
      `INSERT INTO user_management.customer_vendor_links (customer_id, tenant_id)
       VALUES ($1, $2)
       ON CONFLICT (customer_id, tenant_id) DO NOTHING`,
      [customerId, tenantId],
    );
  }

  /**
   * Register a new Vendor.
   * Creates a tenant record in tenants_management.tenants first,
   * then creates the vendor user whose tenant_id points to that tenant.
   */
  async registerVendor(input: RegisterVendorInput) {
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      store_name,
      store_slug,
      contact_email,
      contact_phone,
      business_address,
    } = input;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Create the tenant (storefront)
      const tenantResult = await client.query(
        `INSERT INTO tenants_management.tenants
           (name, slug, contact_email, contact_phone, business_address, status, plan)
         VALUES ($1, $2, $3, $4, $5, 'pending_review', 'free')
         RETURNING id, name, slug, contact_email, status, plan`,
        [
          store_name,
          store_slug,
          contact_email,
          contact_phone ?? null,
          business_address ?? null,
        ],
      );
      const tenant = tenantResult.rows[0];

      // 2. Create the vendor user linked to that tenant
      const userResult = await client.query(
        `INSERT INTO user_management.users
           (first_name, last_name, email, password_hash, role, tenant_id, phone)
         VALUES ($1, $2, $3, $4, 'Vendor', $5, $6)
         RETURNING id, tenant_id, email, role, first_name, last_name, phone, created_at`,
        [first_name, last_name, email, password_hash, tenant.id, phone ?? null],
      );

      await client.query('COMMIT');
      return { user: userResult.rows[0], tenant };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Login for Customers.
   * Global identity — one account across every vendor storefront, so this
   * looks up by email + role only (no tenant_id scoping).
   */
  async loginCustomer(input: LoginInput) {
    const { email, password } = input;

    const result = await pool.query(
      `SELECT id, tenant_id, email, password_hash, role, first_name, last_name,
              phone, is_active, is_email_verified, preferred_language
       FROM user_management.users
       WHERE email = $1 AND role = 'Customer'`,
      [email],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw { statusCode: 403, message: 'Account is deactivated' };
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Update last_login_at
    await pool.query(
      'UPDATE user_management.users SET last_login_at = NOW() WHERE id = $1',
      [user.id],
    );

    const payload: TokenPayload = {
      id: user.id,
      role: user.role,
      tenant_id: user.tenant_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        tenant_id: user.tenant_id,
        phone: user.phone,
        preferred_language: user.preferred_language,
        is_email_verified: user.is_email_verified,
      },
    };
  }

  /**
   * Login for Vendors.
   * Vendors manage a single storefront; email is effectively unique per Vendor role.
   */
  async loginVendor(input: LoginInput) {
    const { email, password } = input;

    const result = await pool.query(
      `SELECT id, tenant_id, email, password_hash, role, first_name, last_name,
              phone, is_active, is_email_verified, preferred_language
       FROM user_management.users
       WHERE email = $1 AND role = 'Vendor'`,
      [email],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw { statusCode: 403, message: 'Account is deactivated' };
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    await pool.query(
      'UPDATE user_management.users SET last_login_at = NOW() WHERE id = $1',
      [user.id],
    );

    const payload: TokenPayload = {
      id: user.id,
      role: user.role,
      tenant_id: user.tenant_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        tenant_id: user.tenant_id,
        phone: user.phone,
        preferred_language: user.preferred_language,
        is_email_verified: user.is_email_verified,
      },
    };
  }

  /**
   * Login for SuperAdmin.
   * SuperAdmin has tenant_id = NULL and a globally unique email
   * (enforced by partial index WHERE role = 'SuperAdmin').
   */
  async loginSuperAdmin(input: LoginInput) {
    const { email, password } = input;

    const result = await pool.query(
      `SELECT id, email, password_hash, role, first_name, last_name, is_active
       FROM user_management.users
       WHERE email = $1 AND role = 'SuperAdmin'`,
      [email],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw { statusCode: 403, message: 'Account is deactivated' };
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    await pool.query(
      'UPDATE user_management.users SET last_login_at = NOW() WHERE id = $1',
      [user.id],
    );

    const payload: TokenPayload = {
      id: user.id,
      role: user.role,
      tenant_id: null,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        tenant_id: null,
      },
    };
  }
}

export const authService = new AuthService();
