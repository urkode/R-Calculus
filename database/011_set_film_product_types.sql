UPDATE products
SET type = 'Print Folie', updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  '3961-murfolie-137cm',
  '3951-bilfolie-137cm',
  '3951-bilfolie-152cm',
  '3551-skiltfolie-137cm',
  '3551-skiltfolie-152cm',
  '3106-veggfolie-137cm',
  'nechen-kampanje-137cm',
  '5650-refleksfolie-137cm',
  '5650-refleksfolie-152cm',
  '3850-lysskiltfolie-137cm',
  '3676-perforertfolie-137cm',
  'clearview-122cm',
  'clearview-156cm',
  'dusted-folie-ip7803pa-137cm'
);

UPDATE products
SET type = 'Folie utskåret', updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  'frost-oracal-126cm',
  'frost-oracal-152cm',
  'dusted-oracal-126cm',
  'oracal-skjaerefolie-126cm',
  'oracal-refleksfolie-122cm',
  'oracal-lysskiltfolie-126cm'
);
