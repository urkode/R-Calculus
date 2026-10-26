/* Cloudflare D1 is the only source of product and rate data. */
(() => {
  const descriptions = {
    'Bildekor': 'Folie og dekor til kjøretøy',
    'Skilt & plater': 'Plater, fasadeskilt og foliering',
    Print: 'Print, banner og papir'
  };
  const slug = value => String(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  let toastTimer;
  const toast = (message, failed = false) => {
    let element = document.getElementById('cloudToast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'cloudToast';
      element.setAttribute('role', 'status');
      document.body.append(element);
    }
    clearTimeout(toastTimer);
    element.textContent = message;
    element.className = failed ? 'cloud-toast is-error' : 'cloud-toast';
    requestAnimationFrame(() => element.classList.add('is-visible'));
    toastTimer = setTimeout(() => element.classList.remove('is-visible'), failed ? 4000 : 2000);
  };
  const request = async (path, options) => {
    const isWrite = Boolean(options?.method && options.method !== 'GET');
    try {
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Kunne ikke oppdatere databasen.');
      if (isWrite) toast('Oppdatert');
      return payload;
    } catch (reason) {
      if (isWrite) toast(reason.message || 'Kunne ikke oppdatere.', true);
      throw reason;
    }
  };
  const asCatalog = ({ products = [], options = [] }) => {
    const optionsByProduct = new Map();
    options.forEach(option => {
      const group = optionsByProduct.get(option.productId) || [];
      group.push({ id: option.id, label: option.label, price: Number(option.purchasePrice) || 0 });
      optionsByProduct.set(option.productId, group);
    });
    const categories = new Map();
    products.forEach(row => {
      const categoryName = row.category || 'Udefinert';
      const subcategoryName = row.subcategory || 'Udefinert';
      const categoryId = slug(categoryName);
      if (!categories.has(categoryId)) {
        categories.set(categoryId, {
          id: categoryId, label: categoryName,
          description: descriptions[categoryName] || 'Produktkatalog',
          subcategories: []
        });
      }
      const category = categories.get(categoryId);
      let subcategory = category.subcategories.find(item => item.label === subcategoryName);
      if (!subcategory) {
        subcategory = {
          id: slug(subcategoryName), label: subcategoryName,
          description: 'Produkter og priser', products: []
        };
        category.subcategories.push(subcategory);
      }
      const dg = Number(row.defaultDgPercent) || 42;
      subcategory.products.push({
        id: row.id, name: row.name, unit: row.unit,
        purchasePrice: Number(row.purchasePrice) || 0,
        wasteFactor: Number(row.wasteFactor) || 1,
        markup: dg / (100 - dg), dg,
        supplier: row.supplier || 'Udefinert',
        type: row.type || 'Udefinert',
        extras: optionsByProduct.get(row.id) || []
      });
    });
    return { isExampleData: false, categories: [...categories.values()] };
  };

  App.reloadCloudData = async function() {
    const [catalogue, rateData] = await Promise.all([
      request('/api/catalog'),
      request('/api/rates')
    ]);
    this.catalog = asCatalog(catalogue);
    const rateMap = Object.fromEntries(rateData.rates.map(rate => [rate.id, Number(rate.amount) || 0]));
    this.pricing = {
      isExampleData: false, currency: 'NOK', vatRate: 0.25,
      hourlyRate: rateMap.design || 0, defaultMarkup: 42 / 58
    };
  };

  App.saveCloudProduct = async function(product) {
    const category = this.catalog.categories.find(item => item.id === product.categoryId);
    const subcategory = category?.subcategories.find(item => item.id === product.subcategoryId);
    if (!category || !subcategory) throw new Error('Velg en gyldig kategori og underkategori.');
    await request('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        ...product,
        category: category.label,
        subcategory: subcategory.label,
        type: product.type || 'Udefinert',
        supplier: product.supplier || 'Udefinert',
        defaultDgPercent: 42
      })
    });
    await this.reloadCloudData();
  };

  let productUpdateTimer;
  App.queueCloudProductUpdate = function(calculation) {
    clearTimeout(productUpdateTimer);
    productUpdateTimer = setTimeout(async () => {
      const match = (this.catalog?.categories || []).flatMap(category =>
        (category.subcategories || []).map(subcategory => ({ category, subcategory }))
      ).find(item => item.subcategory.products.some(product => product.id === calculation.productId));
      const product = match?.subcategory.products.find(item => item.id === calculation.productId);
      if (!match || !product) return;
      try {
        await request(`/api/products/${encodeURIComponent(product.id)}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: product.name,
            category: match.category.label,
            subcategory: match.subcategory.label,
            type: calculation.type,
            supplier: calculation.supplier,
            unit: calculation.unit,
            purchasePrice: calculation.purchasePrice,
            defaultDgPercent: calculation.dg,
            wasteFactor: calculation.wasteFactor,
            sortOrder: 0
          })
        });
        await this.reloadCloudData();
      } catch (_) {}
    }, 650);
  };

  const staticInit = App.init.bind(App);
  App.init = async function() {
    try {
      await this.reloadCloudData();
      this.meta = await request('/data/app.json');
      this.render('home');
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch (reason) {
      document.getElementById('app').innerHTML =
        '<p style="padding:24px;color:white">Kunne ikke hente produktkatalogen. Last siden på nytt.</p>';
      console.error(reason);
    }
  };
  // Product, pricing and rate data may never be saved in localStorage again.
  Store.customProducts = () => [];
  Store.overrides = () => ({});
  Store.saveCustomProduct = () => {};
  Store.saveOverride = () => {};
  Store.rates = () => ({});
  Store.saveRates = () => {};
  const style = document.createElement('style');
  style.textContent = '.cloud-toast{position:fixed;z-index:9999;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));max-width:calc(100vw - 32px);padding:11px 15px;border:1px solid #ffffff50;border-radius:13px;background:#1d0b19eF;color:#fff;font:700 .82rem/1.2 system-ui,sans-serif;box-shadow:0 12px 32px #12030a80;opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;transition:opacity .18s ease,transform .22s cubic-bezier(.2,.8,.2,1)}.cloud-toast.is-visible{opacity:1;transform:translateY(0) scale(1)}.cloud-toast.is-error{border-color:#ff9aa0;background:#5a121deF}';
  document.head.append(style);
  globalThis.CloudData = { request, toast };
})();
