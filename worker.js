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
  type: 'Udefinert',
  supplier: 'Udefinert',
  unit: 'stk',
  dg: 42,
  quantity: 1,
  length: 100,
  width: 100
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

async function recordAudit(db, entityType, entityId, action, value) {
  // Auditing must never turn a successful product save into a failed save.
  try { await audit(db, entityType, entityId, action, value); }
  catch (_) {}
}

async function supplierId(db, supplier) {
  const name = text(supplier) || 'Udefinert';
  // The seeded catalogue has human-readable names with stable, shorter IDs
  // (for example "rumag"). Always reuse that row before making a new one.
  const existing = await db.prepare('SELECT id FROM suppliers WHERE name = ?')
    .bind(name).first();
  if (existing?.id) return existing.id;
  const id = idFrom(name) || 'udefinert';
  await db.prepare('INSERT OR IGNORE INTO suppliers (id, name) VALUES (?, ?)')
    .bind(id, name).run();
  const saved = await db.prepare('SELECT id FROM suppliers WHERE name = ?')
    .bind(name).first();
  return saved?.id || id;
}

function productValues(data = {}) {
  data ||= {};
  return {
    name: text(data.name),
    type: text(data.type) || productDefaults.type,
    supplier: text(data.supplier) || productDefaults.supplier,
    unit: text(data.unit) || productDefaults.unit,
    purchasePrice: number(data.purchasePrice),
    defaultDgPercent: number(data.defaultDgPercent, productDefaults.dg),
    quantity: number(data.quantity, productDefaults.quantity),
    length: number(data.length, productDefaults.length),
    width: number(data.width, productDefaults.width)
  };
}

async function isV2(db) {
  const columns = await db.prepare('PRAGMA table_info(products)').all();
  return columns.results.some(column => column.name === 'dg_percent');
}

async function saveDefaults(db, productId, product) {
  await ensureDefaultsTable(db);
  await db.prepare(`
    INSERT INTO product_defaults (product_id, quantity, length_cm, width_cm, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      quantity = excluded.quantity,
      length_cm = excluded.length_cm,
      width_cm = excluded.width_cm,
      updated_at = CURRENT_TIMESTAMP
  `).bind(productId, product.quantity, product.length, product.width).run();
}

async function ensureDefaultsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS product_defaults (
      product_id TEXT PRIMARY KEY,
      quantity REAL NOT NULL DEFAULT 1,
      length_cm REAL NOT NULL DEFAULT 100,
      width_cm REAL NOT NULL DEFAULT 100,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function hasOptionUnit(db) {
  const columns = await db.prepare('PRAGMA table_info(product_options)').all();
  return columns.results.some(column => column.name === 'unit');
}

function optionValues(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions.map((option, index) => ({
    label: text(option?.label),
    purchasePrice: number(option?.purchasePrice),
    unit: text(option?.unit) || 'stk',
    sortOrder: index + 1
  })).filter(option => option.label);
}

async function saveProductOptions(db, productId, rawOptions) {
  const options = optionValues(rawOptions);
  if (!options.length) return;
  const unitSupported = await hasOptionUnit(db);
  const statements = options.map(option => {
    // The technical ID is generated from the option name and product ID. This
    // avoids a collision when two different products both have e.g. "Fot".
    const id = `${productId}--${idFrom(option.label)}`;
    if (unitSupported) {
      return db.prepare(`
        INSERT INTO product_options
          (id, product_id, label, purchase_price_ex_vat, unit, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, productId, option.label, option.purchasePrice, option.unit, option.sortOrder);
    }
    return db.prepare(`
      INSERT INTO product_options
        (id, product_id, label, purchase_price_ex_vat, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, productId, option.label, option.purchasePrice, option.sortOrder);
  });
  await db.batch(statements);
}

async function catalogue(db) {
  await ensureDefaultsTable(db);
  const optionUnit = await hasOptionUnit(db);
  if (await isV2(db)) {
    const products = await db.prepare(`
      SELECT products.id, products.name, products.type, products.unit,
        products.purchase_price_ex_vat AS purchasePrice,
        products.dg_percent AS defaultDgPercent,
        products.active, suppliers.name AS supplier,
        COALESCE(product_defaults.quantity, 1) AS defaultQuantity,
        COALESCE(product_defaults.length_cm, 100) AS defaultLength,
        COALESCE(product_defaults.width_cm, 100) AS defaultWidth
      FROM products
      LEFT JOIN suppliers ON suppliers.id = products.supplier_id
      LEFT JOIN product_defaults ON product_defaults.product_id = products.id
      WHERE products.active = 1
      ORDER BY products.name
    `).all();
    const options = await db.prepare(`
      SELECT id, product_id AS productId, label,
        purchase_price_ex_vat AS purchasePrice, ${optionUnit ? 'unit' : "'stk'"} AS unit,
        sort_order AS sortOrder
      FROM product_options WHERE active = 1
      ORDER BY product_id, sort_order, label
    `).all();
    return { products: products.results, options: options.results };
  }
  const products = await db.prepare(`
    SELECT products.id, products.name, products.category, products.subcategory,
      products.product_type AS type, products.unit,
      products.purchase_price_ex_vat AS purchasePrice,
      products.default_dg_percent AS defaultDgPercent,
      products.waste_factor AS wasteFactor, products.sort_order AS sortOrder,
      suppliers.name AS supplier,
      COALESCE(product_defaults.quantity, 1) AS defaultQuantity,
      COALESCE(product_defaults.length_cm, 100) AS defaultLength,
      COALESCE(product_defaults.width_cm, 100) AS defaultWidth
    FROM products
    LEFT JOIN suppliers ON suppliers.id = products.supplier_id
    LEFT JOIN product_defaults ON product_defaults.product_id = products.id
    WHERE products.active = 1
    ORDER BY products.category, products.subcategory, products.sort_order, products.name
  `).all();
  const options = await db.prepare(`
    SELECT id, product_id AS productId, label,
      purchase_price_ex_vat AS purchasePrice, ${optionUnit ? 'unit' : "'stk'"} AS unit,
      sort_order AS sortOrder
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
        if (await isV2(env.DB)) {
          await env.DB.prepare(`
            INSERT INTO products (id, name, type, supplier_id, unit, purchase_price_ex_vat, dg_percent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(id, product.name, product.type, supplier, product.unit,
            product.purchasePrice, product.defaultDgPercent).run();
          await saveDefaults(env.DB, id, product);
        } else {
          await env.DB.prepare(`
            INSERT INTO products
              (id, name, category, subcategory, product_type, supplier_id, unit,
               purchase_price_ex_vat, default_dg_percent, waste_factor, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, product.name, 'Egne produkter', 'Manuelt opprettet',
            product.type, supplier, product.unit, product.purchasePrice,
            product.defaultDgPercent, 1, 0).run();
          await saveDefaults(env.DB, id, product);
        }
        await saveProductOptions(env.DB, id, data.options);
        await recordAudit(env.DB, 'product', id, 'created', data);
        return json({ ok: true, id }, 201);
      } catch {
        return error('Produktet finnes allerede eller kunne ikke lagres.', 409);
      }
    }

    // Existing catalogue IDs use both hyphens and underscores (e.g.
    // "akryl_10mm"), so both must be accepted for update and delete routes.
    const productMatch = pathname.match(/^\/api\/products\/([a-z0-9_-]+)$/);
    if (productMatch && request.method === 'PUT') {
      const data = await body(request);
      if (!data) return error('Ugyldig produktdata.');
      const id = productMatch[1];
      const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
      if (!existing) return error('Produktet finnes ikke.', 404);
      const product = productValues(data);
      try {
        const supplier = await supplierId(env.DB, product.supplier);
        if (await isV2(env.DB)) {
          await env.DB.prepare(`
            UPDATE products SET
              name = ?, type = ?, supplier_id = ?, unit = ?,
              purchase_price_ex_vat = ?, dg_percent = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(product.name, product.type, supplier, product.unit,
            product.purchasePrice, product.defaultDgPercent, id).run();
          await saveDefaults(env.DB, id, product);
        } else {
          await env.DB.prepare(`
            UPDATE products SET
              name = ?, category = ?, subcategory = ?, product_type = ?, supplier_id = ?,
              unit = ?, purchase_price_ex_vat = ?, default_dg_percent = ?,
              waste_factor = ?, sort_order = ?
            WHERE id = ?
          `).bind(product.name, 'Egne produkter', 'Manuelt opprettet', product.type,
            supplier, product.unit, product.purchasePrice,
            product.defaultDgPercent, 1, 0, id).run();
          await saveDefaults(env.DB, id, product);
        }
        await recordAudit(env.DB, 'product', id, 'updated', data);
        return json({ ok: true, id });
      } catch {
        return error('Produktet kunne ikke oppdateres i databasen.', 500);
      }
    }

    if (productMatch && request.method === 'DELETE') {
      const id = productMatch[1];
      const existing = await env.DB.prepare('SELECT id, name FROM products WHERE id = ?').bind(id).first();
      if (!existing) return error('Produktet finnes ikke.', 404);
      try {
        // Delete children explicitly so this works whether or not the original
        // D1 schema was created with ON DELETE CASCADE.
        await env.DB.batch([
          env.DB.prepare('DELETE FROM product_options WHERE product_id = ?').bind(id),
          env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id)
        ]);
        await recordAudit(env.DB, 'product', id, 'deleted', { name: existing.name });
        return json({ ok: true, id });
      } catch {
        return error('Produktet kunne ikke slettes fra databasen.', 500);
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
