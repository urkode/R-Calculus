const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const tables = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).all();
      return json({ ok: true, tables: tables.results.map(row => row.name) });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'API-ruten finnes ikke.' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
