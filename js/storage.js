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
  productUsage() {
    return this.read(this.usageKey, {});
  },
  recordProductUse(id) {
    const usage = this.productUsage();
    usage[id] = (Number(usage[id]) || 0) + 1;
    localStorage.setItem(this.usageKey, JSON.stringify(usage));
    return usage[id];
  }
};

globalThis.Store = Store;
