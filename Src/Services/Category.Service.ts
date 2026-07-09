import { pool } from '../Configs/db_config';
import { productService } from './Product.Service';

interface PublicCategoryFilters {
  tenant_id?: string;
  parent_id?: string;
  page: number;
  limit: number;
}

interface VendorCategoryFilters {
  parent_id?: string;
  is_active?: boolean;
  page: number;
  limit: number;
}

interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  sort_order?: number;
  is_active?: boolean;
}

type UpdateCategoryInput = Partial<CreateCategoryInput>;

interface BulkProductInput {
  name: string;
  slug?: string;
  description?: string;
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

const CATEGORY_UPDATABLE_COLUMNS = [
  'name',
  'slug',
  'description',
  'image_url',
  'parent_id',
  'sort_order',
  'is_active',
] as const;

class CategoryService {
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ─── Public / Customer view ────────────────────────────────────────────
  // Only active categories belonging to active storefronts — mirrors the
  // Products module's public-visibility rules.

  async listPublicCategories(filters: PublicCategoryFilters) {
    const { tenant_id, parent_id, page, limit } = filters;

    const conditions: string[] = ['c.is_active = TRUE', "t.status = 'active'"];
    const params: unknown[] = [];
    let i = 1;

    if (tenant_id) {
      conditions.push(`c.tenant_id = $${i++}`);
      params.push(tenant_id);
    }
    if (parent_id) {
      conditions.push(`c.parent_id = $${i++}`);
      params.push(parent_id);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const query = `
      SELECT
        c.id, c.tenant_id, c.parent_id, c.name, c.slug, c.description,
        c.image_url, c.sort_order, c.created_at,
        t.name AS store_name, t.slug AS store_slug,
        COUNT(*) OVER() AS total_count
      FROM category_management.categories c
      INNER JOIN tenants_management.tenants t ON c.tenant_id = t.id
      WHERE ${whereClause}
      ORDER BY c.sort_order ASC, c.name ASC
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

  async getPublicCategoryById(id: string) {
    const result = await pool.query(
      `SELECT
         c.id, c.tenant_id, c.parent_id, c.name, c.slug, c.description,
         c.image_url, c.sort_order, c.created_at,
         t.name AS store_name, t.slug AS store_slug
       FROM category_management.categories c
       INNER JOIN tenants_management.tenants t ON c.tenant_id = t.id
       WHERE c.id = $1 AND c.is_active = TRUE AND t.status = 'active'`,
      [id],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }

    return result.rows[0];
  }

  // ─── Vendor view ───────────────────────────────────────────────────────

  async listVendorCategories(tenantId: string, filters: VendorCategoryFilters) {
    const { parent_id, is_active, page, limit } = filters;

    const conditions: string[] = ['c.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (parent_id) {
      conditions.push(`c.parent_id = $${i++}`);
      params.push(parent_id);
    }
    if (is_active !== undefined) {
      conditions.push(`c.is_active = $${i++}`);
      params.push(is_active);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const query = `
      SELECT
        c.id, c.tenant_id, c.parent_id, c.name, c.slug, c.description,
        c.image_url, c.sort_order, c.is_active, c.created_at, c.updated_at,
        COUNT(*) OVER() AS total_count
      FROM category_management.categories c
      WHERE ${whereClause}
      ORDER BY c.sort_order ASC, c.name ASC
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

  async getVendorCategoryById(id: string, tenantId: string) {
    const result = await pool.query(
      `SELECT id, tenant_id, parent_id, name, slug, description, image_url,
              sort_order, is_active, created_at, updated_at
       FROM category_management.categories
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }

    return result.rows[0];
  }

  async createCategory(tenantId: string, input: CreateCategoryInput) {
    const slug = input.slug
      ? this.slugify(input.slug)
      : this.slugify(input.name);

    const result = await pool.query(
      `INSERT INTO category_management.categories
         (tenant_id, parent_id, name, slug, description, image_url, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, tenant_id, parent_id, name, slug, description, image_url,
                 sort_order, is_active, created_at`,
      [
        tenantId,
        input.parent_id ?? null,
        input.name,
        slug,
        input.description ?? null,
        input.image_url ?? null,
        input.sort_order ?? 0,
        input.is_active ?? true,
      ],
    );

    return result.rows[0];
  }

  async updateCategory(
    id: string,
    tenantId: string,
    input: UpdateCategoryInput,
  ) {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    for (const column of CATEGORY_UPDATABLE_COLUMNS) {
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
      UPDATE category_management.categories
      SET ${setClauses.join(', ')}
      WHERE id = $${i++} AND tenant_id = $${i++}
      RETURNING id, tenant_id, parent_id, name, slug, description, image_url,
                sort_order, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }

    return result.rows[0];
  }

  async deleteCategory(id: string, tenantId: string) {
    // Safe hard delete: products.category_id and categories.parent_id are
    // both ON DELETE SET NULL (see 003/004_*.sql) — child categories become
    // root categories and their products become uncategorized, nothing breaks.
    const result = await pool.query(
      'DELETE FROM category_management.categories WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }

    return { id };
  }

  /**
   * "Add an entire category with multiple products in one click" — creates
   * the category and every product in a single DB transaction: either all
   * of it lands, or none of it does (e.g. a duplicate slug on product #3
   * rolls back the category and the first two products too).
   */
  async createCategoryWithProducts(
    tenantId: string,
    input: { category: CreateCategoryInput; products: BulkProductInput[] },
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const categorySlug = input.category.slug
        ? this.slugify(input.category.slug)
        : this.slugify(input.category.name);

      const categoryResult = await client.query(
        `INSERT INTO category_management.categories
           (tenant_id, parent_id, name, slug, description, image_url, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, tenant_id, parent_id, name, slug, description, image_url,
                   sort_order, is_active, created_at`,
        [
          tenantId,
          input.category.parent_id ?? null,
          input.category.name,
          categorySlug,
          input.category.description ?? null,
          input.category.image_url ?? null,
          input.category.sort_order ?? 0,
          input.category.is_active ?? true,
        ],
      );
      const category = categoryResult.rows[0];

      const createdProducts: Record<string, unknown>[] = [];
      for (const p of input.products) {
        const productSlug = p.slug
          ? this.slugify(p.slug)
          : this.slugify(p.name);
        const productResult = await client.query(
          `INSERT INTO product_management.products
             (tenant_id, category_id, name, slug, description, price, compare_price,
              cost_price, stock_quantity, sku, barcode, weight_grams, is_active, is_featured)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id, tenant_id, category_id, name, slug, description, price,
                     compare_price, cost_price, stock_quantity, sku, barcode,
                     weight_grams, is_active, is_featured, created_at`,
          [
            tenantId,
            category.id,
            p.name,
            productSlug,
            p.description ?? null,
            p.price,
            p.compare_price ?? null,
            p.cost_price ?? null,
            p.stock_quantity ?? 0,
            p.sku ?? null,
            p.barcode ?? null,
            p.weight_grams ?? null,
            p.is_active ?? true,
            p.is_featured ?? false,
          ],
        );
        createdProducts.push(productResult.rows[0]);
      }

      await client.query('COMMIT');

      // New products may now be publicly visible — the 5-min cache would
      // otherwise hide them until it expires naturally.
      await productService.invalidateCache();

      return { category, products: createdProducts };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const categoryService = new CategoryService();
