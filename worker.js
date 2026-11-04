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
  dg: 0,
  quantity: 1,
  length: 100,
  width: 100
};
const encoder = new TextEncoder();

const base64Url = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const base64UrlBytes = value => {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
}

function equalBytes(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

async function sameSecret(first, second) {
  return equalBytes(await digest(first), await digest(second));
}

async function adminSignature(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function adminSessionToken(secret) {
  const payload = base64Url(encoder.encode(JSON.stringify({
    exp: Date.now() + (30 * 60 * 1000), nonce: crypto.randomUUID()
  })));
  return `${payload}.${base64Url(await adminSignature(payload, secret))}`;
}

async function validAdminSession(request, secret) {
  if (!secret) return false;
  const cookie = request.headers.get('Cookie') || '';
  const token = cookie.split(';').map(value => value.trim())
    .find(value => value.startsWith('r_kalkyle_admin='))?.slice('r_kalkyle_admin='.length);
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.', 2);
  try {
    const expected = await adminSignature(payload, secret);
    if (!equalBytes(expected, base64UrlBytes(signature))) return false;
    const data = JSON.parse(new TextDecoder().decode(base64UrlBytes(payload)));
    return Number(data.exp) > Date.now();
  } catch (_) { return false; }
}

async function accessUser(request, ctx) {
  try {
    const identity = ctx?.access ? await ctx.access.getIdentity() : null;
    if (identity?.name) return identity.name;
    if (identity?.email) return identity.email;
  } catch (_) {}
  return request.headers.get('cf-access-authenticated-user-email') || 'Innlogget bruker';
}

async function accessEmail(request, ctx) {
  try {
    const identity = ctx?.access ? await ctx.access.getIdentity() : null;
    if (identity?.email) return text(identity.email).toLowerCase();
  } catch (_) {}
  return text(request.headers.get('cf-access-authenticated-user-email')).toLowerCase();
}

const pushRecipient = 'ulrik@rumag.com';

async function ensurePushSubscriptionsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function ensurePushDeliveryLogTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS push_delivery_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status INTEGER,
      outcome TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function recordPushDelivery(db, status, outcome, detail = '') {
  try {
    await ensurePushDeliveryLogTable(db);
    await db.prepare(`
      INSERT INTO push_delivery_log (status, outcome, detail)
      VALUES (?, ?, ?)
    `).bind(status, outcome, text(detail).slice(0, 500)).run();
    await db.prepare(`
      DELETE FROM push_delivery_log
      WHERE id NOT IN (SELECT id FROM push_delivery_log ORDER BY id DESC LIMIT 100)
    `).run();
  } catch (_) {}
}

function vapidPublicBytes(value) {
  const bytes = base64UrlBytes(value);
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Ugyldig VAPID-nøkkel.');
  return bytes;
}

async function hkdf(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(info)
  }, key, length * 8));
}

async function encryptedPushPayload(subscription, payload) {
  const userPublic = base64UrlBytes(subscription.p256dh);
  const auth = base64UrlBytes(subscription.auth);
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  if (userPublic.length !== 65 || userPublic[0] !== 4 || auth.length !== 16) throw new Error('Ugyldig push-abonnement.');
  const serverPublicJwk = await crypto.subtle.exportKey('jwk', serverKeys.publicKey);
  const serverPublic = new Uint8Array([
    4,
    ...base64UrlBytes(serverPublicJwk.x),
    ...base64UrlBytes(serverPublicJwk.y)
  ]);
  const userKey = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256',
    x: base64Url(userPublic.slice(1, 33)),
    y: base64Url(userPublic.slice(33, 65)),
    ext: true
  }, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, serverKeys.privateKey, 256));
  const keyInfo = new Uint8Array([
    ...encoder.encode('WebPush: info\0'), ...userPublic, ...serverPublic
  ]);
  const inputKeyingMaterial = await hkdf(sharedSecret, auth, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentEncryptionKey = await hkdf(inputKeyingMaterial, salt, 'Content-Encoding: aes128gcm\0', 16);
  const nonce = await hkdf(inputKeyingMaterial, salt, 'Content-Encoding: nonce\0', 12);
  const plaintext = new Uint8Array([...encoder.encode(JSON.stringify(payload)), 2]);
  const encryptionKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, encryptionKey, plaintext));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return new Uint8Array([...salt, ...recordSize, serverPublic.length, ...serverPublic, ...ciphertext]);
}

async function vapidAuthorization(endpoint, env) {
  const publicKey = vapidPublicBytes(env.VAPID_PUBLIC_KEY);
  const privateKey = base64UrlBytes(env.VAPID_PRIVATE_KEY);
  if (privateKey.length !== 32) throw new Error('Ugyldig privat VAPID-nøkkel.');
  const url = new URL(endpoint);
  const header = base64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64Url(encoder.encode(JSON.stringify({
    aud: url.origin,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    sub: 'mailto:ulrik@rumag.com'
  })));
  const signingKey = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: base64Url(privateKey),
    x: base64Url(publicKey.slice(1, 33)), y: base64Url(publicKey.slice(33))
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(`${header}.${claims}`)
  ));
  return `vapid t=${header}.${claims}.${base64Url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function sendPushSubscription(subscription, payload, env) {
  const body = await encryptedPushPayload(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, env),
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      TTL: '600', Urgency: 'normal'
    },
    body
  });
  return { status: response.status, detail: response.statusText };
}

async function sendEmptyPushSubscription(subscription, env) {
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, env),
      TTL: '600', Urgency: 'high'
    }
  });
  return { status: response.status, detail: response.statusText };
}

function notificationText(entityType, action, value, changedBy) {
  const name = text(value?.name) || 'et produkt';
  if (action === 'created') return `${changedBy} opprettet ${name}.`;
  if (action === 'deleted') return `${changedBy} slettet ${name}.`;
  const labels = Object.values(value?.changes || {}).map(change => change?.label).filter(Boolean);
  return `${changedBy} oppdaterte ${name}${labels.length ? `: ${labels.join(', ')}.` : '.'}`;
}

async function notifyUlrik(db, entityType, entityId, action, value, changedBy, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  try {
    await ensurePushSubscriptionsTable(db);
    const subscriptions = await db.prepare(`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_email = ?
    `).bind(pushRecipient).all();
    const expired = [];
    for (const subscription of subscriptions.results) {
      try {
        const result = await sendEmptyPushSubscription(subscription, env);
        await recordPushDelivery(db, result.status,
          result.status >= 200 && result.status < 300 ? 'accepted' : 'rejected', result.detail);
        if (result.status === 404 || result.status === 410) expired.push(subscription.endpoint);
      } catch (reason) {
        await recordPushDelivery(db, null, 'failed', reason?.message || 'Ukjent feil');
      }
    }
    if (expired.length) await db.batch(expired.map(endpoint => db.prepare(
      'DELETE FROM push_subscriptions WHERE endpoint = ?'
    ).bind(endpoint)));
  } catch (_) {}
}

const adminCookie = token => `r_kalkyle_admin=${token}; Path=/api/admin; Max-Age=1800; HttpOnly; Secure; SameSite=Strict`;
const expiredAdminCookie = 'r_kalkyle_admin=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict';

async function body(request) {
  try { return await request.json(); }
  catch { return null; }
}

async function audit(db, entityType, entityId, action, value, changedBy = 'Innlogget bruker') {
  const auditValue = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value, _audit: { at: new Date().toISOString(), user: changedBy } }
    : { value, _audit: { at: new Date().toISOString(), user: changedBy } };
  await db.prepare(`
    INSERT INTO audit_log (entity_type, entity_id, action, new_value, changed_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(entityType, entityId, action, JSON.stringify(auditValue), changedBy).run();
}

async function recordAudit(db, entityType, entityId, action, value, changedBy, env, ctx) {
  // Auditing must never turn a successful product save into a failed save.
  try {
    await audit(db, entityType, entityId, action, value, changedBy);
    await notifyUlrik(db, entityType, entityId, action, value, changedBy, env);
  }
  catch (_) {}
}

const auditFields = [
  ['name', 'Navn'],
  ['type', 'Type'],
  ['supplier', 'Leverandør'],
  ['unit', 'Enhet'],
  ['purchasePrice', 'Innkjøpspris eks. mva'],
  ['defaultDgPercent', 'DG'],
  ['quantity', 'Antall'],
  ['length', 'Lengde (cm)'],
  ['width', 'Bredde (cm)']
];

const sameValue = (first, second) => {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) return firstNumber === secondNumber;
  return text(first) === text(second);
};

function productChanges(before, after) {
  return Object.fromEntries(auditFields.flatMap(([key, label]) => (
    sameValue(before[key], after[key]) ? [] : [[key, { label, from: before[key], to: after[key] }]]
  )));
}

async function productSnapshot(db, id) {
  const data = await catalogue(db);
  const product = data.products.find(item => item.id === id);
  if (!product) return null;
  return {
    name: product.name,
    type: product.type || productDefaults.type,
    supplier: product.supplier || productDefaults.supplier,
    unit: product.unit || productDefaults.unit,
    purchasePrice: number(product.purchasePrice),
    defaultDgPercent: number(product.defaultDgPercent, productDefaults.dg),
    quantity: number(product.defaultQuantity, productDefaults.quantity),
    length: number(product.defaultLength, productDefaults.length),
    width: number(product.defaultWidth, productDefaults.width)
  };
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
  const type = text(data.type) || productDefaults.type;
  return {
    name: text(data.name),
    type,
    supplier: text(data.supplier) || productDefaults.supplier,
    unit: text(data.unit) || productDefaults.unit,
    purchasePrice: number(data.purchasePrice),
    defaultDgPercent: type === 'Sats' ? 0 : number(data.defaultDgPercent, productDefaults.dg),
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

async function ensureRollSettingsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS product_roll_settings (
      product_id TEXT PRIMARY KEY,
      roll_width_cm REAL NOT NULL,
      edge_trim_cm REAL NOT NULL DEFAULT 0,
      seam_overlap_cm REAL NOT NULL DEFAULT 0,
      layout_mode TEXT NOT NULL DEFAULT 'panels',
      item_gap_cm REAL NOT NULL DEFAULT 0,
      default_orientation TEXT NOT NULL DEFAULT 'vertical',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const columns = await db.prepare('PRAGMA table_info(product_roll_settings)').all();
  const names = new Set(columns.results.map(column => column.name));
  if (!names.has('layout_mode')) await db.prepare("ALTER TABLE product_roll_settings ADD COLUMN layout_mode TEXT NOT NULL DEFAULT 'panels'").run();
  if (!names.has('item_gap_cm')) await db.prepare('ALTER TABLE product_roll_settings ADD COLUMN item_gap_cm REAL NOT NULL DEFAULT 0').run();
}

async function saveRollSettings(db, productId, product) {
  const rollWidth = number(product.rollWidthCm);
  if (!(rollWidth > 0)) return;
  await ensureRollSettingsTable(db);
  await db.prepare(`
    INSERT INTO product_roll_settings
      (product_id, roll_width_cm, edge_trim_cm, seam_overlap_cm, layout_mode, item_gap_cm, default_orientation, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      roll_width_cm = excluded.roll_width_cm,
      edge_trim_cm = excluded.edge_trim_cm,
      seam_overlap_cm = excluded.seam_overlap_cm,
      layout_mode = excluded.layout_mode,
      item_gap_cm = excluded.item_gap_cm,
      default_orientation = excluded.default_orientation,
      updated_at = CURRENT_TIMESTAMP
  `).bind(productId, rollWidth, number(product.edgeTrimCm), number(product.seamOverlapCm),
    text(product.rollLayout) || 'panels', number(product.itemGapCm),
    text(product.defaultOrientation) || 'vertical').run();
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
  await ensureRollSettingsTable(db);
  const optionUnit = await hasOptionUnit(db);
  if (await isV2(db)) {
    const products = await db.prepare(`
      SELECT products.id, products.name, products.type, products.unit,
        products.purchase_price_ex_vat AS purchasePrice,
        products.dg_percent AS defaultDgPercent,
        products.active, suppliers.name AS supplier,
        COALESCE(product_defaults.quantity, 1) AS defaultQuantity,
        COALESCE(product_defaults.length_cm, 100) AS defaultLength,
        CASE
          WHEN products.unit = 'lm' AND product_roll_settings.roll_width_cm > 0
          THEN product_roll_settings.roll_width_cm
          ELSE COALESCE(product_defaults.width_cm, 100)
        END AS defaultWidth,
        product_roll_settings.roll_width_cm AS rollWidthCm,
        product_roll_settings.edge_trim_cm AS edgeTrimCm,
        product_roll_settings.seam_overlap_cm AS seamOverlapCm,
        product_roll_settings.layout_mode AS rollLayout,
        product_roll_settings.item_gap_cm AS itemGapCm,
        product_roll_settings.default_orientation AS defaultOrientation
      FROM products
      LEFT JOIN suppliers ON suppliers.id = products.supplier_id
      LEFT JOIN product_defaults ON product_defaults.product_id = products.id
      LEFT JOIN product_roll_settings ON product_roll_settings.product_id = products.id
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
      CASE
        WHEN products.unit = 'lm' AND product_roll_settings.roll_width_cm > 0
        THEN product_roll_settings.roll_width_cm
        ELSE COALESCE(product_defaults.width_cm, 100)
      END AS defaultWidth,
      product_roll_settings.roll_width_cm AS rollWidthCm,
      product_roll_settings.edge_trim_cm AS edgeTrimCm,
      product_roll_settings.seam_overlap_cm AS seamOverlapCm,
      product_roll_settings.layout_mode AS rollLayout,
      product_roll_settings.item_gap_cm AS itemGapCm,
      product_roll_settings.default_orientation AS defaultOrientation
    FROM products
    LEFT JOIN suppliers ON suppliers.id = products.supplier_id
    LEFT JOIN product_defaults ON product_defaults.product_id = products.id
    LEFT JOIN product_roll_settings ON product_roll_settings.product_id = products.id
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/admin/session' && request.method === 'GET') {
      return json({ admin: await validAdminSession(request, env.ADMIN_LOG_PASSWORD) });
    }

    if (pathname === '/api/admin/session' && request.method === 'POST') {
      const data = await body(request);
      const secret = env.ADMIN_LOG_PASSWORD;
      if (!secret) return error('Adminloggen er ikke konfigurert ennå.', 503);
      if (!data?.password || !(await sameSecret(data.password, secret))) {
        return error('Feil kode.', 401);
      }
      const token = await adminSessionToken(secret);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': adminCookie(token) }
      });
    }

    if (pathname === '/api/admin/session' && request.method === 'DELETE') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': expiredAdminCookie }
      });
    }

    if (pathname === '/api/admin/audit' && request.method === 'GET') {
      if (!(await validAdminSession(request, env.ADMIN_LOG_PASSWORD))) return error('Admin tilgang kreves.', 403);
      const limit = Math.max(1, Math.min(250, Number(url.searchParams.get('limit')) || 100));
      const columns = await env.DB.prepare('PRAGMA table_info(audit_log)').all();
      const names = new Set(columns.results.map(column => column.name));
      const createdColumn = names.has('created_at') ? 'created_at' : names.has('createdAt') ? 'createdAt' : null;
      const createdAt = createdColumn ? `${createdColumn} AS createdAt` : "'' AS createdAt";
      const orderBy = createdColumn || 'rowid';
      const entries = await env.DB.prepare(`
        SELECT entity_type AS entityType, entity_id AS entityId, action,
          new_value AS newValue, changed_by AS changedBy, ${createdAt}
        FROM audit_log
        ORDER BY ${orderBy} DESC
        LIMIT ?
      `).bind(limit).all();
      return json({ entries: entries.results });
    }

    if (pathname === '/api/push/status' && request.method === 'GET') {
      const email = await accessEmail(request, ctx);
      const allowed = email === pushRecipient;
      if (!allowed) return json({ allowed: false, configured: false, subscribed: false });
      const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
      let subscribed = false;
      if (configured) {
        try {
          await ensurePushSubscriptionsTable(env.DB);
          subscribed = Boolean(await env.DB.prepare(
            'SELECT 1 FROM push_subscriptions WHERE user_email = ? LIMIT 1'
          ).bind(pushRecipient).first());
        } catch (_) {}
      }
      return json({ allowed: true, configured, subscribed, publicKey: configured ? env.VAPID_PUBLIC_KEY : null });
    }

    if (pathname === '/api/push/subscribe' && request.method === 'POST') {
      if ((await accessEmail(request, ctx)) !== pushRecipient) return error('Kun Ulrik kan motta varsler.', 403);
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return error('Varsler er ikke konfigurert ennå.', 503);
      const subscription = await body(request);
      const endpoint = text(subscription?.endpoint);
      const p256dh = text(subscription?.keys?.p256dh);
      const auth = text(subscription?.keys?.auth);
      if (!endpoint.startsWith('https://') || !p256dh || !auth) return error('Ugyldig push-abonnement.');
      try {
        await ensurePushSubscriptionsTable(env.DB);
        await env.DB.prepare(`
          INSERT INTO push_subscriptions (endpoint, user_email, p256dh, auth, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(endpoint) DO UPDATE SET
            user_email = excluded.user_email, p256dh = excluded.p256dh,
            auth = excluded.auth, updated_at = CURRENT_TIMESTAMP
        `).bind(endpoint, pushRecipient, p256dh, auth).run();
        return json({ ok: true });
      } catch (_) { return error('Kunne ikke lagre varslingen.', 500); }
    }

    if (pathname === '/api/push/subscribe' && request.method === 'DELETE') {
      if ((await accessEmail(request, ctx)) !== pushRecipient) return error('Kun Ulrik kan endre varsler.', 403);
      const subscription = await body(request);
      const endpoint = text(subscription?.endpoint);
      if (!endpoint) return error('Mangler push-abonnement.');
      try {
        await ensurePushSubscriptionsTable(env.DB);
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_email = ?')
          .bind(endpoint, pushRecipient).run();
        return json({ ok: true });
      } catch (_) { return error('Kunne ikke fjerne varslingen.', 500); }
    }

    if (pathname === '/api/push/test' && request.method === 'POST') {
      if ((await accessEmail(request, ctx)) !== pushRecipient) return error('Kun Ulrik kan teste varsler.', 403);
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return error('Varsler er ikke konfigurert.', 503);
      try {
        await ensurePushSubscriptionsTable(env.DB);
        const subscriptions = await env.DB.prepare(`
          SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_email = ?
        `).bind(pushRecipient).all();
        if (!subscriptions.results.length) return error('Ingen enhet er registrert for varsler.', 404);
        let accepted = 0;
        for (const subscription of subscriptions.results) {
          try {
            const result = await sendEmptyPushSubscription(subscription, env);
            const outcome = result.status >= 200 && result.status < 300 ? 'test-accepted' : 'test-rejected';
            await recordPushDelivery(env.DB, result.status, outcome, result.detail);
            if (outcome === 'test-accepted') accepted += 1;
          } catch (reason) {
            await recordPushDelivery(env.DB, null, 'test-failed', reason?.message || 'Ukjent feil');
          }
        }
        if (!accepted) return error('Testvarselet ble ikke godtatt av push-tjenesten.', 502);
        return json({ ok: true });
      } catch (_) { return error('Kunne ikke sende testvarsel.', 500); }
    }

    if (pathname === '/api/push/latest' && request.method === 'GET') {
      if ((await accessEmail(request, ctx)) !== pushRecipient) return error('Kun Ulrik kan lese siste varsel.', 403);
      try {
        const entry = await env.DB.prepare(`
          SELECT new_value AS newValue, changed_by AS changedBy, action
          FROM audit_log
          ORDER BY rowid DESC
          LIMIT 1
        `).first();
        if (!entry) return json({ title: 'R Kalkyle', body: 'Det er gjort en endring i R Kalkyle.' });
        let value = {};
        try { value = JSON.parse(entry.newValue || '{}'); } catch (_) {}
        const name = text(value.name) || 'et produkt';
        const user = text(entry.changedBy) || 'En bruker';
        const verb = entry.action === 'created' ? 'opprettet'
          : entry.action === 'deleted' ? 'slettet'
            : 'gjort en endring i';
        return json({ title: 'R Kalkyle', body: `${user} har ${verb} ${name}.` });
      } catch (_) { return error('Kunne ikke hente siste varsel.', 500); }
    }

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
          await saveRollSettings(env.DB, id, data);
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
          await saveRollSettings(env.DB, id, data);
        }
        await saveProductOptions(env.DB, id, data.options);
        await recordAudit(env.DB, 'product', id, 'created', data, await accessUser(request, ctx), env, ctx);
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
      const existing = await productSnapshot(env.DB, id);
      if (!existing) return error('Produktet finnes ikke.', 404);
      const product = productValues(data);
      try {
        const changes = productChanges(existing, product);
        if (!Object.keys(changes).length) return json({ ok: true, id, changed: false });
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
          await saveRollSettings(env.DB, id, data);
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
          await saveRollSettings(env.DB, id, data);
        }
        await recordAudit(env.DB, 'product', id, 'updated', {
          name: product.name,
          changes
        }, await accessUser(request, ctx), env, ctx);
        return json({ ok: true, id, changed: true });
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
        await recordAudit(env.DB, 'product', id, 'deleted', { name: existing.name }, await accessUser(request, ctx), env, ctx);
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
      await recordAudit(env.DB, 'rates', 'shared', 'updated', data, await accessUser(request, ctx), env, ctx);
      return json({ ok: true });
    }

    if (pathname.startsWith('/api/')) return error('API-ruten finnes ikke.', 404);
    return env.ASSETS.fetch(request);
  }
};
