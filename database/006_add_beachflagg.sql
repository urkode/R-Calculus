INSERT OR IGNORE INTO suppliers (id, name)
VALUES ('rumag', 'RUMAG SKILT OG REKLAME AS');

INSERT OR IGNORE INTO suppliers (id, name)
VALUES ('crossmark', 'Crossmark');

INSERT INTO products (
  id, name, type, supplier_id, unit, purchase_price_ex_vat, dg_percent, active
)
VALUES
  ('beachflagg-s-70x250', 'Beachflagg S 70*250', 'Display', 'crossmark', 'stk', 670, 42, 1),
  ('beachflagg-m-90x320', 'Beachflagg M 90*320', 'Display', 'crossmark', 'stk', 838, 42, 1),
  ('beachflagg-l-90x360', 'Beachflagg L 90*360', 'Display', 'crossmark', 'stk', 1029, 42, 1),
  ('beachflagg-xl-100x440', 'Beachflagg XL 100*440', 'Display', 'crossmark', 'stk', 1148, 42, 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  type = excluded.type,
  supplier_id = excluded.supplier_id,
  unit = excluded.unit,
  purchase_price_ex_vat = excluded.purchase_price_ex_vat,
  dg_percent = excluded.dg_percent,
  active = excluded.active,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO product_options (
  id, product_id, label, purchase_price_ex_vat, unit, sort_order
)
VALUES
  ('beachflagg-s-70x250--kryssfot', 'beachflagg-s-70x250', 'Kryssfot', 296, 'stk', 1),
  ('beachflagg-s-70x250--vannpose', 'beachflagg-s-70x250', 'Vannpose', 92, 'stk', 2),
  ('beachflagg-s-70x250--jordspyd', 'beachflagg-s-70x250', 'Jordspyd', 175, 'stk', 3),
  ('beachflagg-s-70x250--stalplate-7kg', 'beachflagg-s-70x250', 'Stålplate 7kg', 395, 'stk', 4),
  ('beachflagg-m-90x320--kryssfot', 'beachflagg-m-90x320', 'Kryssfot', 296, 'stk', 1),
  ('beachflagg-m-90x320--vannpose', 'beachflagg-m-90x320', 'Vannpose', 92, 'stk', 2),
  ('beachflagg-m-90x320--jordspyd', 'beachflagg-m-90x320', 'Jordspyd', 175, 'stk', 3),
  ('beachflagg-m-90x320--stalplate-7kg', 'beachflagg-m-90x320', 'Stålplate 7kg', 395, 'stk', 4),
  ('beachflagg-l-90x360--kryssfot', 'beachflagg-l-90x360', 'Kryssfot', 296, 'stk', 1),
  ('beachflagg-l-90x360--vannpose', 'beachflagg-l-90x360', 'Vannpose', 92, 'stk', 2),
  ('beachflagg-l-90x360--jordspyd', 'beachflagg-l-90x360', 'Jordspyd', 175, 'stk', 3),
  ('beachflagg-l-90x360--stalplate-7kg', 'beachflagg-l-90x360', 'Stålplate 7kg', 395, 'stk', 4),
  ('beachflagg-xl-100x440--kryssfot', 'beachflagg-xl-100x440', 'Kryssfot', 296, 'stk', 1),
  ('beachflagg-xl-100x440--vannpose', 'beachflagg-xl-100x440', 'Vannpose', 92, 'stk', 2),
  ('beachflagg-xl-100x440--jordspyd', 'beachflagg-xl-100x440', 'Jordspyd', 175, 'stk', 3),
  ('beachflagg-xl-100x440--stalplate-7kg', 'beachflagg-xl-100x440', 'Stålplate 7kg', 395, 'stk', 4)
ON CONFLICT(id) DO UPDATE SET
  label = excluded.label,
  purchase_price_ex_vat = excluded.purchase_price_ex_vat,
  unit = excluded.unit,
  sort_order = excluded.sort_order;
