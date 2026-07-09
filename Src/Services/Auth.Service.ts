import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../Configs/db_config';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET as string;

// Access tokens are short-lived; refresh tokens are long-lived and rotated on
// every use (old one revoked, new one issued) — see refreshAccessToken().
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;

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
  // ─── Token helpers ───────────────────────────────────────────────────────

  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  /**
   * Refresh tokens are opaque, high-entropy random strings — NOT JWTs, and
   * NOT bcrypt-hashed. bcrypt is for low-entropy secrets (passwords) where
   * slow, salted hashing defeats brute force; a 48-byte random token already
   * has enough entropy that we just need a fast, deterministic hash (SHA-256)
   * so we can look it up by exact match. Only the hash is ever persisted.
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Issues a new refresh token for a user, persists its hash, and returns the
   * raw token (only returned once — never stored or logged in raw form).
   */
  private async issueRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
    );

    await pool.query(
      `INSERT INTO user_management.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );

    return rawToken;
  }

  private async issueTokenPair(payload: TokenPayload) {
    const token = this.generateAccessToken(payload);
    const refresh_token = await this.issueRefreshToken(payload.id);
    return { token, refresh_token };
  }

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

    const { token, refresh_token } = await this.issueTokenPair(payload);

    return {
      token,
      refresh_token,
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

    const { token, refresh_token } = await this.issueTokenPair(payload);

    return {
      token,
      refresh_token,
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

    const { token, refresh_token } = await this.issueTokenPair(payload);

    return {
      token,
      refresh_token,
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

  // ─── Refresh / Logout ────────────────────────────────────────────────────
  // Shared across all three roles — a refresh token's validity doesn't
  // depend on which login endpoint issued it, just on the DB row.

  /**
   * Exchanges a valid, unexpired, unrevoked refresh token for a new access
   * token. Rotates the refresh token on every use (old row revoked, new row
   * issued) so a stolen-but-unused-yet refresh token becomes worthless the
   * moment the legitimate owner refreshes again.
   */
  async refreshAccessToken(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);

    const tokenResult = await pool.query(
      `SELECT id, user_id FROM user_management.refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );

    if (tokenResult.rowCount === 0) {
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    const { id: tokenId, user_id: userId } = tokenResult.rows[0];

    const userResult = await pool.query(
      `SELECT id, tenant_id, email, role, first_name, last_name, phone,
              preferred_language, is_email_verified, is_active
       FROM user_management.users
       WHERE id = $1`,
      [userId],
    );

    if (userResult.rowCount === 0) {
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      throw { statusCode: 403, message: 'Account is deactivated' };
    }

    // Rotate: revoke the token that was just used, then issue a fresh pair
    await pool.query(
      'UPDATE user_management.refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [tokenId],
    );

    const payload: TokenPayload = {
      id: user.id,
      role: user.role,
      tenant_id: user.tenant_id,
    };

    const { token, refresh_token } = await this.issueTokenPair(payload);

    return {
      token,
      refresh_token,
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
   * Revokes a single refresh token (logout on one device). Always resolves
   * successfully even if the token was already revoked/unknown, so this
   * endpoint can't be used to probe for valid tokens.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await pool.query(
      `UPDATE user_management.refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  // ─── Email verification (manual review — no email sending yet) ─────────
  // Customer/Vendor request verification; SuperAdmin reviews and approves or
  // rejects. See Src/Migrations/008_email_verification_requests.sql.

  /**
   * Customer or Vendor requests email verification. Fails if already
   * verified, or if a pending request already exists (partial unique index
   * on user_management.email_verification_requests enforces the latter).
   */
  async requestEmailVerification(userId: string) {
    const userResult = await pool.query(
      'SELECT is_email_verified FROM user_management.users WHERE id = $1',
      [userId],
    );
    if (userResult.rowCount === 0) {
      throw { statusCode: 404, message: 'User not found' };
    }
    if (userResult.rows[0].is_email_verified) {
      throw { statusCode: 400, message: 'Email is already verified' };
    }

    try {
      const result = await pool.query(
        `INSERT INTO user_management.email_verification_requests (user_id)
         VALUES ($1)
         RETURNING id, user_id, status, requested_at`,
        [userId],
      );
      return result.rows[0];
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === '23505') {
        throw {
          statusCode: 409,
          message:
            'Verification already requested — awaiting SuperAdmin review',
        };
      }
      throw err;
    }
  }

  /**
   * SuperAdmin: list verification requests, optionally filtered by status
   * (pending / approved / rejected). Defaults to all statuses, newest first.
   */
  async listVerificationRequests(status?: string) {
    const params: unknown[] = [];
    let whereClause = '';
    if (status) {
      params.push(status);
      whereClause = 'WHERE r.status = $1';
    }

    const result = await pool.query(
      `SELECT
         r.id, r.user_id, r.status, r.requested_at, r.reviewed_at, r.review_note,
         u.email, u.role, u.first_name, u.last_name
       FROM user_management.email_verification_requests r
       INNER JOIN user_management.users u ON u.id = r.user_id
       ${whereClause}
       ORDER BY r.requested_at DESC`,
      params,
    );

    return result.rows;
  }

  /** SuperAdmin: approve a pending request — sets users.is_email_verified = TRUE. */
  async approveVerification(requestId: string, reviewerId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE user_management.email_verification_requests
         SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING user_id`,
        [requestId, reviewerId],
      );

      if (result.rowCount === 0) {
        throw {
          statusCode: 404,
          message: 'Pending verification request not found',
        };
      }

      const { user_id } = result.rows[0];
      await client.query(
        'UPDATE user_management.users SET is_email_verified = TRUE WHERE id = $1',
        [user_id],
      );

      await client.query('COMMIT');
      return { request_id: requestId, user_id, status: 'approved' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** SuperAdmin: reject a pending request (leaves is_email_verified = FALSE). */
  async rejectVerification(
    requestId: string,
    reviewerId: string,
    note?: string,
  ) {
    const result = await pool.query(
      `UPDATE user_management.email_verification_requests
       SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), review_note = $3
       WHERE id = $1 AND status = 'pending'
       RETURNING user_id`,
      [requestId, reviewerId, note ?? null],
    );

    if (result.rowCount === 0) {
      throw {
        statusCode: 404,
        message: 'Pending verification request not found',
      };
    }

    return {
      request_id: requestId,
      user_id: result.rows[0].user_id,
      status: 'rejected',
    };
  }
}

export const authService = new AuthService();
