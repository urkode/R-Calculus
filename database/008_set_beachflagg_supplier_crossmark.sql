INSERT OR IGNORE INTO suppliers (id, name)
VALUES ('crossmark', 'Crossmark');

UPDATE products
SET supplier_id = 'crossmark', updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  'beachflagg-s-70x250',
  'beachflagg-m-90x320',
  'beachflagg-l-90x360',
  'beachflagg-xl-100x440'
);
