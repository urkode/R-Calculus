const Store = {
  draftKey: 'r-kalkyle-drafts',
  catalogKey: 'r-kalkyle-custom-products',
  overrideKey: 'r-kalkyle-product-overrides',
  ratesKey: 'r-kalkyle-rates',
  usageKey: 'r-kalkyle-product-usage',

  read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  },
  drafts() { return this.read(this.draftKey, []); },
  saveDraft(draft) {
    const all = this.drafts();
    const index = all.findIndex((item) => item.id === draft.id);
    if (index < 0) all.unshift(draft); else all[index] = draft;
    localStorage.setItem(this.draftKey, JSON.stringify(all));
  },
  customProducts() { return this.read(this.catalogKey, []); },
  saveCustomProduct(product) {
    const all = this.customProducts();
    const index = all.findIndex((item) => item.id === product.id);
    if (index < 0) all.push(product); else all[index] = product;
    localStorage.setItem(this.catalogKey, JSON.stringify(all));
  },
  overrides() { return this.read(this.overrideKey, {}); },
  saveOverride(id, values) {
    const all = this.overrides();
    all[id] = { ...(all[id] || {}), ...values };
    localStorage.setItem(this.overrideKey, JSON.stringify(all));
  },
  rates() { return this.read(this.ratesKey, {}); },
  saveRates(rates) { localStorage.setItem(this.ratesKey, JSON.stringify(rates)); },
  usageDefaults() {
    return { folie_standard: 37, folie_stopt: 18, one_way_vision: 12, frostet_folie: 9, dekal_standard: 28, dibond_3mm: 16, pvc_3mm: 11, akryl_10mm: 22, skiltfolie: 14, banner: 19, rollup_film: 8, plakatpapir: 6, fotopapir: 5, rollup_85: 10, refleksfolie: 31, etset_glassfolie: 13, contour_dekal: 26, refleks_dekal: 17, dibond_4mm: 21, pvc_bokstaver: 7, lysboks: 10, laminert_skiltfolie: 16, refleks_skiltfolie: 12, mesh_banner: 18, klistremerke_ark: 24, rollup_100: 11, beachflagg_m: 15 };
  },
  productUsage() {
    const defaults = this.usageDefaults();
    const saved = this.read(this.usageKey, {});
    Object.entries(saved).forEach(([id, value]) => {
      if (Number(value) > 0) defaults[id] = Number(value);
    });
    return defaults;
  },
  recordProductUse(id) {
    const usage = this.productUsage();
    usage[id] = (Number(usage[id]) || 0) + 1;
    localStorage.setItem(this.usageKey, JSON.stringify(usage));
    return usage[id];
  }
};

globalThis.Store = Store;
