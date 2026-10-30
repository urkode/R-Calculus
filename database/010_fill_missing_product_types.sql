UPDATE products
SET type = 'Udefinert', updated_at = CURRENT_TIMESTAMP
WHERE type IS NULL OR TRIM(type) = '';
