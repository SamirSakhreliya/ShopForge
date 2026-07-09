import { pool } from '../Configs/db_config';
import { redis } from '../Configs/redis_config';

const CACHE_TTL_SECONDS = 300; // 5 minutes — see CLAUDE.md "Redis product listing cache"
const CACHE_VERSION_KEY = 'products:cache:version';

interface PublicProductFilters {
  tenant_id?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  sort: 'price_asc' | 'price_desc' | 'newest' | 'featured';
  page: number;
  limit: number;
}

interface VendorProductFilters {
  category_id?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  is_active?: boolean;
  is_featured?: boolean;
  sort:
    | 'price_asc'
    | 'price_desc'
    | 'newest'
    | 'featured'
    | 'stock_low'
    | 'stock_high';
  page: number;
  limit: number;
}

interface CreateProductInput {
  name: string;
  slug?: string;
  description?: string;
  category_id?: string;
  price: number;
  compare_price?: number;
  cost_price?: number;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  weight_grams?: number;
  is_active?: boolean;
  is_featured?: boolean;
}

type UpdateProductInput = Partial<CreateProductInput>;

const PRODUCT_UPDATABLE_COLUMNS = [
  'name',
  'slug',
  'description',
  'category_id',
  'price',
  'compare_price',
  'cost_price',
  'stock_quantity',
  'sku',
  'barcode',
  'weight_grams',
  'is_active',
  'is_featured',
] as const;

class ProductService {
  // ─── Cache helpers ─────────────────────────────────────────────────────
  // Versioned cache keys: any product mutation bumps CACHE_VERSION_KEY, so
  // stale entries are simply never read again and expire naturally via TTL
  // (no active SCAN/DEL needed). Redis errors degrade to a direct DB read —
  // catalogue browsing must never hard-fail because the cache is down.

  private async getCacheVersion(): Promise<string> {
    try {
      const version = await redis.get(CACHE_VERSION_KEY);
      return version ?? '1';
    } catch (err) {
      console.error('[ProductService] cache version read failed:', err);
      return '0'; // '0' never matches a real cached key, forcing a DB read
    }
  }

  private async bumpCacheVersion(): Promise<void> {
    try {
      await redis.incr(CACHE_VERSION_KEY);
    } catch (err) {
      console.error('[ProductService] cache version bump failed:', err);
    }
  }

  /**
   * Public wrapper so other services (e.g. CategoryService's bulk
   * category-with-products creation) can invalidate the public listing
   * cache after inserting products directly, without duplicating the
   * version-key logic above.
   */
  async invalidateCache(): Promise<void> {
    return this.bumpCacheVersion();
  }

  private async buildPublicCacheKey(
    filters: PublicProductFilters,
  ): Promise<string> {
    const version = await this.getCacheVersion();
    const parts = Object.entries(filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v ?? ''}`)
      .join('&');
    return `products:public:v${version}:${parts}`;
  }

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      console.error('[ProductService] cache read failed:', err);
      return null;
    }
  }

  private async setCached(key: string, value: unknown): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      console.error('[ProductService] cache write failed:', err);
    }
  }

  // ─── Sort helpers ──────────────────────────────────────────────────────

  private buildOrderClause(sort: string): string {
    switch (sort) {
      case 'price_asc':
        return 'ORDER BY p.price ASC';
      case 'price_desc':
        return 'ORDER BY p.price DESC';
      case 'featured':
        return 'ORDER BY p.is_featured DESC, p.created_at DESC';
      case 'stock_low':
        return 'ORDER BY p.stock_quantity ASC';
      case 'stock_high':
        return 'ORDER BY p.stock_quantity DESC';
      case 'newest':
      default:
        return 'ORDER BY p.created_at DESC';
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ─── Public / Customer view ────────────────────────────────────────────
  // Only active products belonging to active storefronts. Excludes
  // cost_price and any vendor-only fields.

  async listPublicProducts(filters: PublicProductFilters) {
    const cacheKey = await this.buildPublicCacheKey(filters);
    const cached = await this.getCached<unknown>(cacheKey);
    if (cached) return cached;

    const {
      tenant_id,
      category_id,
      min_price,
      max_price,
      search,
      sort,
      page,
      limit,
    } = filters;

    const conditions: string[] = ['p.is_active = TRUE', "t.status = 'active'"];
    const params: unknown[] = [];
    let i = 1;

    if (tenant_id) {
      conditions.push(`p.tenant_id = $${i++}`);
      params.push(tenant_id);
    }
    if (category_id) {
      conditions.push(`p.category_id = $${i++}`);
      params.push(category_id);
    }
    if (min_price !== undefined) {
      conditions.push(`p.price >= $${i++}`);
      params.push(min_price);
    }
    if (max_price !== undefined) {
      conditions.push(`p.price <= $${i++}`);
      params.push(max_price);
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = this.buildOrderClause(sort);
    const offset = (page - 1) * limit;

    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const query = `
      SELECT
        p.id, p.tenant_id, p.category_id, p.name, p.slug, p.description,
        p.price, p.compare_price, p.stock_quantity, p.is_featured, p.created_at,
        c.name AS category_name,
        t.name AS store_name, t.slug AS store_slug,
        (SELECT pi.url FROM product_management.product_images pi
          WHERE pi.product_id = p.id AND pi.is_primary = TRUE
          LIMIT 1) AS primary_image_url,
        COUNT(*) OVER() AS total_count
      FROM product_management.products p
      INNER JOIN tenants_management.tenants t ON p.tenant_id = t.id
      LEFT JOIN category_management.categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(query, params);
    const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
    const items = result.rows.map(
      ({ total_count: _total_count, ...row }) => row,
    );

    const payload = {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await this.setCached(cacheKey, payload);
    return payload;
  }

  /**
   * Public product detail. Must be active + belong to an active storefront,
   * otherwise treated as not found (a disabled product should 404 for
   * customers, not leak its existence).
   */
  async getPublicProductById(id: string) {
    const result = await pool.query(
      `SELECT
         p.id, p.tenant_id, p.category_id, p.name, p.slug, p.description,
         p.price, p.compare_price, p.stock_quantity, p.sku, p.weight_grams,
         p.is_featured, p.created_at,
         c.name AS category_name,
         t.name AS store_name, t.slug AS store_slug
       FROM product_management.products p
       INNER JOIN tenants_management.tenants t ON p.tenant_id = t.id
       LEFT JOIN category_management.categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.is_active = TRUE AND t.status = 'active'`,
      [id],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    const product = result.rows[0];
    const images = await pool.query(
      `SELECT id, url, alt_text, sort_order, is_primary
       FROM product_management.product_images
       WHERE product_id = $1
       ORDER BY is_primary DESC, sort_order ASC`,
      [id],
    );

    return { ...product, images: images.rows };
  }

  // ─── Vendor view ───────────────────────────────────────────────────────
  // Scoped strictly to the vendor's own tenant. Includes cost_price, sku,
  // barcode, stock, and every status (active + inactive). Never cached —
  // vendors need a live view of their own inventory.

  async listVendorProducts(tenantId: string, filters: VendorProductFilters) {
    const {
      category_id,
      min_price,
      max_price,
      search,
      is_active,
      is_featured,
      sort,
      page,
      limit,
    } = filters;

    const conditions: string[] = ['p.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (category_id) {
      conditions.push(`p.category_id = $${i++}`);
      params.push(category_id);
    }
    if (min_price !== undefined) {
      conditions.push(`p.price >= $${i++}`);
      params.push(min_price);
    }
    if (max_price !== undefined) {
      conditions.push(`p.price <= $${i++}`);
      params.push(max_price);
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (is_active !== undefined) {
      conditions.push(`p.is_active = $${i++}`);
      params.push(is_active);
    }
    if (is_featured !== undefined) {
      conditions.push(`p.is_featured = $${i++}`);
      params.push(is_featured);
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = this.buildOrderClause(sort);
    const offset = (page - 1) * limit;

    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const query = `
      SELECT
        p.id, p.tenant_id, p.category_id, p.name, p.slug, p.description,
        p.price, p.compare_price, p.cost_price, p.stock_quantity, p.sku,
        p.barcode, p.weight_grams, p.is_active, p.is_featured,
        p.created_at, p.updated_at,
        c.name AS category_name,
        (SELECT pi.url FROM product_management.product_images pi
          WHERE pi.product_id = p.id AND pi.is_primary = TRUE
          LIMIT 1) AS primary_image_url,
        COUNT(*) OVER() AS total_count
      FROM product_management.products p
      LEFT JOIN category_management.categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(query, params);
    const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
    const items = result.rows.map(
      ({ total_count: _total_count, ...row }) => row,
    );

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getVendorProductById(id: string, tenantId: string) {
    const result = await pool.query(
      `SELECT
         p.id, p.tenant_id, p.category_id, p.name, p.slug, p.description,
         p.price, p.compare_price, p.cost_price, p.stock_quantity, p.sku,
         p.barcode, p.weight_grams, p.is_active, p.is_featured,
         p.created_at, p.updated_at,
         c.name AS category_name
       FROM product_management.products p
       LEFT JOIN category_management.categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    const images = await pool.query(
      `SELECT id, url, alt_text, sort_order, is_primary
       FROM product_management.product_images
       WHERE product_id = $1
       ORDER BY is_primary DESC, sort_order ASC`,
      [id],
    );

    return { ...result.rows[0], images: images.rows };
  }

  async createProduct(tenantId: string, input: CreateProductInput) {
    const slug = input.slug
      ? this.slugify(input.slug)
      : this.slugify(input.name);

    const result = await pool.query(
      `INSERT INTO product_management.products
         (tenant_id, category_id, name, slug, description, price, compare_price,
          cost_price, stock_quantity, sku, barcode, weight_grams, is_active, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, tenant_id, category_id, name, slug, description, price,
                 compare_price, cost_price, stock_quantity, sku, barcode,
                 weight_grams, is_active, is_featured, created_at`,
      [
        tenantId,
        input.category_id ?? null,
        input.name,
        slug,
        input.description ?? null,
        input.price,
        input.compare_price ?? null,
        input.cost_price ?? null,
        input.stock_quantity ?? 0,
        input.sku ?? null,
        input.barcode ?? null,
        input.weight_grams ?? null,
        input.is_active ?? true,
        input.is_featured ?? false,
      ],
    );

    await this.bumpCacheVersion();
    return result.rows[0];
  }

  async updateProduct(id: string, tenantId: string, input: UpdateProductInput) {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const column of PRODUCT_UPDATABLE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(input, column)) {
        const rawValue = input[column];
        const value =
          column === 'slug' && typeof rawValue === 'string'
            ? this.slugify(rawValue)
            : rawValue;
        setClauses.push(`${column} = $${i++}`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      throw { statusCode: 400, message: 'No updatable fields provided' };
    }

    setClauses.push('updated_at = NOW()');
    params.push(id, tenantId);

    const query = `
      UPDATE product_management.products
      SET ${setClauses.join(', ')}
      WHERE id = $${i++} AND tenant_id = $${i++}
      RETURNING id, tenant_id, category_id, name, slug, description, price,
                compare_price, cost_price, stock_quantity, sku, barcode,
                weight_grams, is_active, is_featured, created_at, updated_at
    `;

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    await this.bumpCacheVersion();
    return result.rows[0];
  }

  async deleteProduct(id: string, tenantId: string) {
    // order_items.product_id is a nullable soft reference (ON DELETE SET NULL),
    // so hard-deleting a product never breaks historical order records.
    const result = await pool.query(
      'DELETE FROM product_management.products WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    await this.bumpCacheVersion();
    return { id };
  }

  // ─── Product images (vendor only) ──────────────────────────────────────

  async addProductImage(
    productId: string,
    tenantId: string,
    url: string,
    altText?: string,
  ) {
    const productCheck = await pool.query(
      'SELECT id FROM product_management.products WHERE id = $1 AND tenant_id = $2',
      [productId, tenantId],
    );
    if (productCheck.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    const existingCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM product_management.product_images WHERE product_id = $1',
      [productId],
    );
    const isFirstImage = existingCount.rows[0].count === 0;

    const result = await pool.query(
      `INSERT INTO product_management.product_images
         (product_id, tenant_id, url, alt_text, is_primary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id, url, alt_text, sort_order, is_primary, created_at`,
      [productId, tenantId, url, altText ?? null, isFirstImage],
    );

    await this.bumpCacheVersion();
    return result.rows[0];
  }

  async deleteProductImage(
    productId: string,
    imageId: string,
    tenantId: string,
  ) {
    const result = await pool.query(
      `DELETE FROM product_management.product_images
       WHERE id = $1 AND product_id = $2 AND tenant_id = $3
       RETURNING id, is_primary`,
      [imageId, productId, tenantId],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Image not found' };
    }

    // If the deleted image was primary, promote the next one (if any)
    if (result.rows[0].is_primary) {
      await pool.query(
        `UPDATE product_management.product_images
         SET is_primary = TRUE
         WHERE id = (
           SELECT id FROM product_management.product_images
           WHERE product_id = $1
           ORDER BY sort_order ASC, created_at ASC
           LIMIT 1
         )`,
        [productId],
      );
    }

    await this.bumpCacheVersion();
    return { id: imageId };
  }

  async setPrimaryImage(productId: string, imageId: string, tenantId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const target = await client.query(
        `SELECT id FROM product_management.product_images
         WHERE id = $1 AND product_id = $2 AND tenant_id = $3`,
        [imageId, productId, tenantId],
      );
      if (target.rowCount === 0) {
        throw { statusCode: 404, message: 'Image not found' };
      }

      await client.query(
        'UPDATE product_management.product_images SET is_primary = FALSE WHERE product_id = $1',
        [productId],
      );
      await client.query(
        'UPDATE product_management.product_images SET is_primary = TRUE WHERE id = $1',
        [imageId],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.bumpCacheVersion();
    return { id: imageId };
  }
}

export const productService = new ProductService();
