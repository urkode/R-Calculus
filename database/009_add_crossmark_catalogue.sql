INSERT OR IGNORE INTO suppliers (id, name)
VALUES ('crossmark', 'Crossmark');

INSERT INTO products (
  id, name, type, supplier_id, unit, purchase_price_ex_vat, dg_percent, active
)
VALUES
  ('mesh-270g', 'Mesh 270 g', 'Print', 'crossmark', 'm²', 94, 42, 1),
  ('mesh-330g', 'Mesh 330 g', 'Print', 'crossmark', 'm²', 94, 42, 1),
  ('pvc-tett-450g', 'PVC tett duk 450 g', 'Print', 'crossmark', 'm²', 94, 42, 1),
  ('mesh-airflow-220g', 'Mesh Airflow 220 g', 'Print', 'crossmark', 'm²', 99, 42, 1),
  ('mesh-pvc-fri-180g', 'Mesh PVC-fri 180 g', 'Print', 'crossmark', 'm²', 119, 42, 1),
  ('mesh-pvc-fri-270g', 'Mesh PVC-fri 270 g', 'Print', 'crossmark', 'm²', 119, 42, 1),
  ('polyester-110g', 'Polyester 110 g', 'Print', 'crossmark', 'm²', 119, 42, 1),
  ('polyester-175g', 'Polyester 175 g', 'Print', 'crossmark', 'm²', 119, 42, 1),
  ('polyester-210g', 'Polyester 210 g', 'Print', 'crossmark', 'm²', 170, 42, 1),
  ('lightbox-tekstil-360g', 'Lightbox-tekstil 360 g', 'Print', 'crossmark', 'm²', 260, 42, 1),
  ('gront-nett-med-trykk', 'Grønt nett med trykk', 'Print', 'crossmark', 'm²', 99, 42, 1),
  ('palletrekk-pvc-450g', 'Palletrekk PVC 450 g', 'Print', 'crossmark', 'm²', 113, 42, 1),
  ('flaggsom-windtracker', 'Flaggsøm / windtracker', 'Display', 'crossmark', 'stk', 79, 42, 1),
  ('bannerholder-lyktestolpe', 'Bannerholder til lyktestolpe', 'Display', 'crossmark', 'sett', 1350, 42, 1),
  ('stolpebanner-polyester-50x200', 'Stolpebanner polyester 50*200', 'Display', 'crossmark', 'stk', 119, 42, 1),
  ('stolpebanner-blockout-50x200', 'Stolpebanner blockout 50*200', 'Display', 'crossmark', 'stk', 495, 42, 1),
  ('tekstilramme-450x250', 'Tekstilramme aluminium 450*250', 'Display', 'crossmark', 'stk', 2590, 42, 1),
  ('tekstilduk-450x250', 'Tekstilduk med gummilist 450*250', 'Display', 'crossmark', 'stk', 1913, 42, 1),
  ('lyskasse-300x240', 'Lyskasse 300*240', 'Display', 'crossmark', 'stk', 19000, 42, 1),
  ('lyskasse-dobbel-100x200', 'Lyskasse dobbeltsidig 100*200', 'Display', 'crossmark', 'stk', 4000, 42, 1),
  ('lyskasse-dobbel-100x250', 'Lyskasse dobbeltsidig 100*250', 'Display', 'crossmark', 'stk', 5250, 42, 1),
  ('lyskasse-enkel-85x200', 'Lyskasse enkeltsidig 85*200', 'Display', 'crossmark', 'stk', 3500, 42, 1),
  ('lyskasse-enkel-100x200', 'Lyskasse enkeltsidig 100*200', 'Display', 'crossmark', 'stk', 3750, 42, 1),
  ('lyskasse-enkel-100x250', 'Lyskasse enkeltsidig 100*250', 'Display', 'crossmark', 'stk', 4500, 42, 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  type = excluded.type,
  supplier_id = excluded.supplier_id,
  unit = excluded.unit,
  purchase_price_ex_vat = excluded.purchase_price_ex_vat,
  dg_percent = excluded.dg_percent,
  active = excluded.active,
  updated_at = CURRENT_TIMESTAMP;
