-- Run once in Cloudflare D1 Console before creating options with their own unit.
ALTER TABLE product_options ADD COLUMN unit TEXT NOT NULL DEFAULT 'stk';

-- Explicitly normalize all existing rows as requested.
UPDATE product_options SET unit = 'stk' WHERE unit IS NULL OR TRIM(unit) = '';
