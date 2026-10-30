-- Run in the Cloudflare D1 Console for r-kalkyle-production.
-- 3961 Murfolie is sold per linear metre from a 137 cm roll.

INSERT OR IGNORE INTO suppliers (id, name)
VALUES ('rumag', 'RUMAG SKILT OG REKLAME AS');

INSERT INTO products (
  id,
  name,
  type,
  supplier_id,
  unit,
  purchase_price_ex_vat,
  dg_percent,
  active
) VALUES (
  '3961-murfolie-137cm',
  '3961 Murfolie 137 cm',
  'Print Folie',
  (SELECT id FROM suppliers WHERE name = 'RUMAG SKILT OG REKLAME AS' LIMIT 1),
  'lm',
  316,
  42,
  1
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  type = excluded.type,
  supplier_id = excluded.supplier_id,
  unit = excluded.unit,
  purchase_price_ex_vat = excluded.purchase_price_ex_vat,
  dg_percent = excluded.dg_percent,
  active = excluded.active,
  updated_at = CURRENT_TIMESTAMP;

-- The current product form uses these as initial values.
-- Width is the fixed usable roll width; 100 cm is one linear metre.
INSERT INTO product_defaults (product_id, quantity, length_cm, width_cm, updated_at)
VALUES ('3961-murfolie-137cm', 1, 100, 137, CURRENT_TIMESTAMP)
ON CONFLICT(product_id) DO UPDATE SET
  quantity = excluded.quantity,
  length_cm = excluded.length_cm,
  width_cm = excluded.width_cm,
  updated_at = CURRENT_TIMESTAMP;
