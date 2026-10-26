-- R Kalkyle: current demo catalogue.
-- Safe to run once in the D1 Console. It only inserts rows that do not exist.
-- These are still example values and must be replaced before production use.

BEGIN TRANSACTION;

INSERT OR IGNORE INTO suppliers (id, name) VALUES
  ('udefinert', 'Udefinert'),
  ('rumag', 'RUMAG SKILT OG REKLAME AS'),
  ('flour-lux', 'Flour Lux AS'),
  ('vink-norway', 'Vink Norway AS'),
  ('goleks', 'Goleks Ttd. SIA'),
  ('saferoad', 'Saferoad Traffic AS'),
  ('crossmark', 'Crossmark'),
  ('alvoen', 'Alvøen AS');

INSERT OR IGNORE INTO products
  (id, name, category, subcategory, product_type, supplier_id, unit,
   purchase_price_ex_vat, default_dg_percent, waste_factor, sort_order)
VALUES
  ('folie_standard', 'Standard folie', 'Bildekor', 'Bilfolie', 'Folie', 'udefinert', 'm²', 250, 42, 1.10, 10),
  ('folie_stopt', 'Støpt folie', 'Bildekor', 'Bilfolie', 'Folie', 'udefinert', 'm²', 480, 42, 1.10, 20),
  ('refleksfolie', 'Refleksfolie', 'Bildekor', 'Bilfolie', 'Folie', 'udefinert', 'm²', 530, 42, 1.10, 30),
  ('one_way_vision', 'One way vision', 'Bildekor', 'Vindusdekor', 'Folie', 'udefinert', 'm²', 310, 42, 1.08, 10),
  ('frostet_folie', 'Frostet folie', 'Bildekor', 'Vindusdekor', 'Folie', 'udefinert', 'm²', 280, 42, 1.08, 20),
  ('etset_glassfolie', 'Etset glassfolie', 'Bildekor', 'Vindusdekor', 'Folie', 'udefinert', 'm²', 330, 42, 1.08, 30),
  ('dekal_standard', 'Standard dekal', 'Bildekor', 'Dekaler & merking', 'Folie', 'udefinert', 'm²', 190, 42, 1.12, 10),
  ('contour_dekal', 'Contourkuttet dekal', 'Bildekor', 'Dekaler & merking', 'Folie', 'udefinert', 'm²', 220, 42, 1.12, 20),
  ('refleks_dekal', 'Refleksdekal', 'Bildekor', 'Dekaler & merking', 'Folie', 'udefinert', 'm²', 410, 42, 1.12, 30),
  ('dibond_3mm', 'Dibond 3 mm', 'Skilt & plater', 'Platematerialer', 'Plate', 'udefinert', 'm²', 390, 42, 1.05, 10),
  ('dibond_4mm', 'Dibond 4 mm', 'Skilt & plater', 'Platematerialer', 'Plate', 'udefinert', 'm²', 460, 42, 1.05, 20),
  ('pvc_3mm', 'PVC 3 mm', 'Skilt & plater', 'Platematerialer', 'Plate', 'udefinert', 'm²', 210, 42, 1.05, 30),
  ('akryl_10mm', 'Akryl 10 mm', 'Skilt & plater', 'Fasadeskilt', 'Plate', 'udefinert', 'm²', 620, 42, 1.08, 10),
  ('pvc_bokstaver', 'PVC-bokstaver', 'Skilt & plater', 'Fasadeskilt', 'Skilt', 'udefinert', 'm²', 510, 42, 1.08, 20),
  ('lysboks', 'Lysboks', 'Skilt & plater', 'Fasadeskilt', 'Skilt', 'udefinert', 'm²', 1450, 42, 1.10, 30),
  ('skiltfolie', 'Skiltfolie', 'Skilt & plater', 'Foliering av skilt', 'Folie', 'udefinert', 'm²', 240, 42, 1.10, 10),
  ('laminert_skiltfolie', 'Laminert skiltfolie', 'Skilt & plater', 'Foliering av skilt', 'Folie', 'udefinert', 'm²', 285, 42, 1.10, 20),
  ('refleks_skiltfolie', 'Refleksfolie til skilt', 'Skilt & plater', 'Foliering av skilt', 'Folie', 'udefinert', 'm²', 495, 42, 1.10, 30),
  ('banner', 'Banner', 'Print', 'Storformat', 'Print', 'udefinert', 'm²', 120, 42, 1.05, 10),
  ('mesh_banner', 'Mesh-banner', 'Print', 'Storformat', 'Print', 'udefinert', 'm²', 145, 42, 1.05, 20),
  ('rollup_film', 'Rollup-film', 'Print', 'Storformat', 'Print', 'udefinert', 'm²', 165, 42, 1.08, 30),
  ('plakatpapir', 'Plakatpapir', 'Print', 'Papirprint', 'Print', 'udefinert', 'm²', 80, 42, 1.05, 10),
  ('fotopapir', 'Fotopapir', 'Print', 'Papirprint', 'Print', 'udefinert', 'm²', 135, 42, 1.05, 20),
  ('klistremerke_ark', 'Klistremerke-ark', 'Print', 'Papirprint', 'Print', 'udefinert', 'm²', 115, 42, 1.08, 30),
  ('rollup_85', 'Rollup 85 cm', 'Print', 'Display', 'Display', 'udefinert', 'stk', 720, 42, 1.00, 10),
  ('rollup_100', 'Rollup 100 cm', 'Print', 'Display', 'Display', 'udefinert', 'stk', 860, 42, 1.00, 20),
  ('beachflagg_m', 'Beachflagg M', 'Print', 'Display', 'Display', 'udefinert', 'stk', 980, 42, 1.00, 30);

INSERT OR IGNORE INTO product_options
  (id, product_id, label, purchase_price_ex_vat, sort_order)
VALUES
  ('jordspyd', 'beachflagg_m', 'Jordspyd', 295, 10),
  ('kryssfot', 'beachflagg_m', 'Kryssfot', 395, 20),
  ('vannvekt', 'beachflagg_m', 'Vannvekt', 195, 30),
  ('baerebag', 'beachflagg_m', 'Bærebag', 240, 40);

INSERT OR IGNORE INTO rates (id, label, amount_ex_vat, unit) VALUES
  ('design', 'Design', 950, 'kr/time'),
  ('installation', 'Montering', 850, 'kr/time'),
  ('detail-1', 'Detaljnivå 1', 0, 'kr/enhet'),
  ('detail-2', 'Detaljnivå 2', 120, 'kr/enhet'),
  ('detail-3', 'Detaljnivå 3', 240, 'kr/enhet'),
  ('detail-4', 'Detaljnivå 4', 360, 'kr/enhet');

INSERT OR IGNORE INTO schema_migrations (version)
VALUES ('002_seed_example_catalog');

COMMIT;
