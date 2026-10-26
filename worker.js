const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

const databaseUnavailable = error => json({
  error: 'Databasen er midlertidig utilgjengelig.'
}, 503);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const tables = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).all();
      return json({ ok: true, tables: tables.results.map(row => row.name) });
    }

    if (url.pathname === '/api/catalog' && request.method === 'GET') {
      try {
        const products = await env.DB.prepare(`
          SELECT
            products.id,
            products.name,
            products.category,
            products.subcategory,
            products.product_type AS type,
            products.unit,
            products.purchase_price_ex_vat AS purchasePrice,
            products.default_dg_percent AS defaultDgPercent,
            products.waste_factor AS wasteFactor,
            products.sort_order AS sortOrder,
            suppliers.name AS supplier
          FROM products
          LEFT JOIN suppliers ON suppliers.id = products.supplier_id
          WHERE products.active = 1
          ORDER BY products.category, products.subcategory, products.sort_order, products.name
        `).all();

        const options = await env.DB.prepare(`
          SELECT id, product_id AS productId, label,
                 purchase_price_ex_vat AS purchasePrice, sort_order AS sortOrder
          FROM product_options
          WHERE active = 1
          ORDER BY product_id, sort_order, label
        `).all();

        return json({
          products: products.results,
          options: options.results
        });
      } catch (error) {
        return databaseUnavailable(error);
      }
    }

    if (url.pathname === '/api/rates' && request.method === 'GET') {
      try {
        const rates = await env.DB.prepare(`
          SELECT id, label, amount_ex_vat AS amount, unit
          FROM rates
          WHERE active = 1
          ORDER BY label
        `).all();
        return json({ rates: rates.results });
      } catch (error) {
        return databaseUnavailable(error);
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'API-ruten finnes ikke.' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
