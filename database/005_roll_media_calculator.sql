-- Run once in the Cloudflare D1 Console after 004_add_3961_murfolie.sql.
-- Roll settings are separated from the basic product price because these values
-- describe how a material is physically consumed, not its catalogue identity.
CREATE TABLE IF NOT EXISTS product_roll_settings (
  product_id TEXT PRIMARY KEY,
  roll_width_cm REAL NOT NULL,
  edge_trim_cm REAL NOT NULL DEFAULT 0,
  seam_overlap_cm REAL NOT NULL DEFAULT 0,
  default_orientation TEXT NOT NULL DEFAULT 'vertical',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3961 Murfolie:
--   137 cm usable roll width
--   15 cm finish/cut allowance on every outer edge for print film
--   1 cm overlap for each panel seam
--   vertical panels are the normal wall-installation direction
INSERT INTO product_roll_settings (
  product_id, roll_width_cm, edge_trim_cm, seam_overlap_cm, default_orientation, updated_at
)
SELECT id, 137, 15, 1, 'vertical', CURRENT_TIMESTAMP
FROM products
WHERE id = '3961-murfolie-137cm'
ON CONFLICT(product_id) DO UPDATE SET
  roll_width_cm = excluded.roll_width_cm,
  edge_trim_cm = excluded.edge_trim_cm,
  seam_overlap_cm = excluded.seam_overlap_cm,
  default_orientation = excluded.default_orientation,
  updated_at = CURRENT_TIMESTAMP;
