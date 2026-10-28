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
  const toastQueue = [];
  let toastShowing = false;
  const toast = (message, failed = false) => {
    toastQueue.push({ message, failed });
    if (toastShowing) return;
    const showNext = () => {
      const next = toastQueue.shift();
      if (!next) { toastShowing = false; return; }
      toastShowing = true;
      const { message: nextMessage, failed: nextFailed } = next;
    let element = document.getElementById('cloudToast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'cloudToast';
      element.setAttribute('role', 'status');
      document.body.append(element);
    }
      element.textContent = nextMessage;
      element.className = nextFailed ? 'cloud-toast is-error' : 'cloud-toast';
    requestAnimationFrame(() => element.classList.add('is-visible'));
      setTimeout(() => {
        element.classList.remove('is-visible');
        setTimeout(showNext, 160);
      }, nextFailed ? 3500 : 1800);
    };
    showNext();
  };
  const labelFor = path => ({
    '/api/catalog': 'Produktkatalog',
    '/api/rates': 'Satser'
  }[path] || 'Produktdata');
  const request = async (path, options) => {
    const isWrite = Boolean(options?.method && options.method !== 'GET');
    const isDatabaseCall = path.startsWith('/api/');
    if (isDatabaseCall) toast(`D1 · ${labelFor(path)} sjekkes …`);
    try {
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Kunne ikke oppdatere databasen.');
      if (isDatabaseCall) toast(`D1 · ${labelFor(path)} ${isWrite ? 'oppdatert' : 'hentet'} ✓`);
      return payload;
    } catch (reason) {
      if (isDatabaseCall) toast(`D1 · ${labelFor(path)}: ${reason.message || 'feil'}`, true);
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
    await request('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        ...product,
        type: product.type || 'Udefinert',
        supplier: product.supplier || 'Udefinert',
        defaultDgPercent: product.defaultDgPercent ?? 42,
        wasteFactor: product.wasteFactor ?? 1
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
        '<p style="padding:24px;color:white">Kunne ikke hente produktkatalogen fra databasen. Kontroller at du er innlogget, og last siden på nytt.</p>';
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
  style.textContent = '.cloud-toast{position:fixed;z-index:2147483647;top:50%;left:50%;bottom:auto;max-width:calc(100vw - 32px);padding:11px 16px;border:1px solid #ffffff44;border-radius:999px;background:#1a0a18d9;color:#fff;font:750 .82rem/1.2 system-ui,sans-serif;letter-spacing:.01em;box-shadow:0 10px 28px #12030a70;opacity:0;transform:translate(-50%,-44%) scale(.97);pointer-events:none;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:opacity .16s ease,transform .2s cubic-bezier(.2,.8,.2,1)}.cloud-toast.is-visible{opacity:1;transform:translate(-50%,-50%) scale(1)}.cloud-toast.is-error{border-color:#ff9aa0a6;background:#5a121de8;color:#fff}';
  document.head.append(style);
  globalThis.CloudData = { request, toast };
})();
