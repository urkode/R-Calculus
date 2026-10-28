const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

const error = (message, status = 400) => json({ error: message }, status);
const text = value => String(value ?? '').trim();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const idFrom = value => text(value).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
const productDefaults = {
  category: 'Egne produkter',
  subcategory: 'Manuelt opprettet',
  type: 'Udefinert',
  supplier: 'Udefinert',
  unit: 'stk',
  dg: 42,
  wasteFactor: 1
};

async function body(request) {
  try { return await request.json(); }
  catch { return null; }
}

async function audit(db, entityType, entityId, action, value) {
  await db.prepare(`
    INSERT INTO audit_log (entity_type, entity_id, action, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(entityType, entityId, action, JSON.stringify(value), 'Cloudflare Access').run();
}

async function supplierId(db, supplier) {
  const name = text(supplier) || 'Udefinert';
  const id = idFrom(name) || 'udefinert';
  await db.prepare('INSERT OR IGNORE INTO suppliers (id, name) VALUES (?, ?)')
    .bind(id, name).run();
  return id;
}

function productValues(data = {}) {
  data ||= {};
  return {
    name: text(data.name),
    // Category is only a database grouping. The app no longer asks users to
    // maintain it when they create a product.
    category: text(data.category) || productDefaults.category,
    subcategory: text(data.subcategory) || productDefaults.subcategory,
    type: text(data.type) || productDefaults.type,
    supplier: text(data.supplier) || productDefaults.supplier,
    unit: text(data.unit) || productDefaults.unit,
    purchasePrice: number(data.purchasePrice),
    defaultDgPercent: number(data.defaultDgPercent, productDefaults.dg),
    wasteFactor: number(data.wasteFactor, productDefaults.wasteFactor),
    sortOrder: number(data.sortOrder)
  };
}

async function catalogue(db) {
  const products = await db.prepare(`
    SELECT products.id, products.name, products.category, products.subcategory,
      products.product_type AS type, products.unit,
      products.purchase_price_ex_vat AS purchasePrice,
      products.default_dg_percent AS defaultDgPercent,
      products.waste_factor AS wasteFactor, products.sort_order AS sortOrder,
      suppliers.name AS supplier
    FROM products
    LEFT JOIN suppliers ON suppliers.id = products.supplier_id
    WHERE products.active = 1
    ORDER BY products.category, products.subcategory, products.sort_order, products.name
  `).all();
  const options = await db.prepare(`
    SELECT id, product_id AS productId, label,
      purchase_price_ex_vat AS purchasePrice, sort_order AS sortOrder
    FROM product_options WHERE active = 1
    ORDER BY product_id, sort_order, label
  `).all();
  return { products: products.results, options: options.results };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/health') {
      const tables = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).all();
      return json({ ok: true, tables: tables.results.map(row => row.name) });
    }

    if (pathname === '/api/catalog' && request.method === 'GET') {
      try { return json(await catalogue(env.DB)); }
      catch { return error('Databasen er midlertidig utilgjengelig.', 503); }
    }

    if (pathname === '/api/products' && request.method === 'POST') {
      const data = await body(request);
      const product = productValues(data);
      if (!data || !product.name) return error('Produktet må ha et navn.');
      const id = idFrom(data.id || product.name);
      if (!id) return error('Produktet mangler gyldig ID.');
      try {
        const supplier = await supplierId(env.DB, product.supplier);
        await env.DB.prepare(`
          INSERT INTO products
            (id, name, category, subcategory, product_type, supplier_id, unit,
             purchase_price_ex_vat, default_dg_percent, waste_factor, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, product.name, product.category, product.subcategory,
          product.type, supplier, product.unit, product.purchasePrice,
          product.defaultDgPercent, product.wasteFactor, product.sortOrder
        ).run();
        await audit(env.DB, 'product', id, 'created', data);
        return json({ ok: true, id }, 201);
      } catch {
        return error('Produktet finnes allerede eller kunne ikke lagres.', 409);
      }
    }

    const productMatch = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
    if (productMatch && request.method === 'PUT') {
      const data = await body(request);
      if (!data) return error('Ugyldig produktdata.');
      const id = productMatch[1];
      const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
      if (!existing) return error('Produktet finnes ikke.', 404);
      const product = productValues(data);
      try {
        const supplier = await supplierId(env.DB, product.supplier);
        await env.DB.prepare(`
        UPDATE products SET
          name = ?, category = ?, subcategory = ?, product_type = ?, supplier_id = ?,
          unit = ?, purchase_price_ex_vat = ?, default_dg_percent = ?,
          waste_factor = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
          product.name, product.category, product.subcategory, product.type,
          supplier, product.unit, product.purchasePrice,
          product.defaultDgPercent, product.wasteFactor, product.sortOrder, id
      ).run();
        await audit(env.DB, 'product', id, 'updated', data);
        return json({ ok: true, id });
      } catch {
        return error('Produktet kunne ikke oppdateres i databasen.', 500);
      }
    }

    if (pathname === '/api/rates' && request.method === 'GET') {
      const rates = await env.DB.prepare(`
        SELECT id, label, amount_ex_vat AS amount, unit
        FROM rates WHERE active = 1 ORDER BY label
      `).all();
      return json({ rates: rates.results });
    }

    if (pathname === '/api/rates' && request.method === 'PUT') {
      const data = await body(request);
      if (!data || typeof data !== 'object') return error('Ugyldige satser.');
      const rateRows = [
        ['design', 'Design', data.design, 'kr/time'],
        ['installation', 'Montering', data.installation, 'kr/time'],
        ['detail-1', 'Detaljnivå 1', data.detail1, 'kr/enhet'],
        ['detail-2', 'Detaljnivå 2', data.detail2, 'kr/enhet'],
        ['detail-3', 'Detaljnivå 3', data.detail3, 'kr/enhet'],
        ['detail-4', 'Detaljnivå 4', data.detail4, 'kr/enhet']
      ];
      await env.DB.batch(rateRows.map(([id, label, amount, unit]) => env.DB.prepare(`
        INSERT INTO rates (id, label, amount_ex_vat, unit, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET amount_ex_vat = excluded.amount_ex_vat,
          unit = excluded.unit, updated_at = CURRENT_TIMESTAMP
      `).bind(id, label, number(amount), unit)));
      await audit(env.DB, 'rates', 'shared', 'updated', data);
      return json({ ok: true });
    }

    if (pathname.startsWith('/api/')) return error('API-ruten finnes ikke.', 404);
    return env.ASSETS.fetch(request);
  }
};
