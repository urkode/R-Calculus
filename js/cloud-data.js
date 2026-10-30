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
      // Inline values make the debugging status independent of any cached or
      // overridden stylesheet in Safari/PWA mode.
      Object.assign(element.style, {
        position: 'fixed', zIndex: '2147483647', top: '50%', left: '50%',
        right: 'auto', bottom: 'auto', display: 'block', visibility: 'visible',
        opacity: '1', padding: '11px 16px', borderRadius: '999px',
        border: nextFailed ? '1px solid #ff9aa0a6' : '1px solid #86ffc099',
        background: nextFailed ? '#5a121de8' : '#10291fe8',
        color: nextFailed ? '#ffb7bd' : '#91ffc2',
        transform: 'translate(-50%, -50%) scale(1)', pointerEvents: 'none'
      });
      requestAnimationFrame(() => element.classList.add('is-visible'));
      setTimeout(() => {
        element.classList.remove('is-visible');
        element.style.opacity = '0';
        setTimeout(showNext, 160);
      }, nextFailed ? 3500 : 1800);
    };
    showNext();
  };
  const resultMessage = (path, method) => {
    if (path === '/api/products' && method === 'POST') return 'Produkt opprettet';
    if (path.startsWith('/api/products/') && method === 'PUT') return 'Produkt oppdatert';
    if (path.startsWith('/api/products/') && method === 'DELETE') return 'Produkt slettet';
    return 'Lagret i DB';
  };
  const request = async (path, options) => {
    const method = options?.method || 'GET';
    const isWrite = method !== 'GET';
    try {
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Kunne ikke oppdatere databasen.');
      if (isWrite) toast(resultMessage(path, method));
      return payload;
    } catch (reason) {
      if (isWrite) toast('Feil i DB!', true);
      throw reason;
    }
  };
  const asCatalog = ({ products = [], options = [] }) => {
    const optionsByProduct = new Map();
    options.forEach(option => {
      const group = optionsByProduct.get(option.productId) || [];
      group.push({
        id: option.id,
        label: option.label,
        price: Number(option.purchasePrice) || 0,
        unit: option.unit || 'stk'
      });
      optionsByProduct.set(option.productId, group);
    });
    const categories = new Map();
    products.forEach(row => {
      // The restructured database is intentionally flat. Legacy rows still
      // carry category fields, but both versions render in one catalogue.
      const categoryName = row.category || 'Produktkatalog';
      const subcategoryName = row.subcategory || 'Alle produkter';
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
        markup: dg / (100 - dg), dg,
        supplier: row.supplier || 'Udefinert',
        type: row.type || 'Udefinert',
        defaultQuantity: Number(row.defaultQuantity) || 1,
        defaultLength: Number(row.defaultLength) || 100,
        defaultWidth: Number(row.defaultWidth) || 100,
        rollWidthCm: Number(row.rollWidthCm) || 0,
        edgeTrimCm: Number(row.edgeTrimCm) || 0,
        seamOverlapCm: Number(row.seamOverlapCm) || 0,
        defaultOrientation: row.defaultOrientation || 'vertical',
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
    globalThis.KalkyleProductTypes = Object.freeze([...new Set(
      catalogue.products.map(product => String(product.type || '').trim()).filter(type => type && type !== 'Udefinert')
    )].sort((a, b) => a.localeCompare(b, 'nb-NO')));
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
        defaultDgPercent: product.defaultDgPercent ?? 42
      })
    });
    await this.reloadCloudData();
  };

  App.deleteCloudProduct = async function(productId) {
    await request(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    await this.reloadCloudData();
  };

  let activeProductSave = 0;
  App.queueCloudProductUpdate = async function(calculation) {
    const saveId = ++activeProductSave;
    let requestStarted = false;
    try {
      const match = (this.catalog?.categories || []).flatMap(category =>
        (category.subcategories || []).map(subcategory => ({ category, subcategory }))
      ).find(item => (item.subcategory.products || []).some(product => product.id === calculation.productId));
      const product = match?.subcategory.products.find(item => item.id === calculation.productId);
      if (!match || !product) throw new Error('Produktet ble ikke funnet.');
      requestStarted = true;
      await request(`/api/products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: calculation.productName || product.name,
          type: calculation.type,
          supplier: calculation.supplier,
          unit: calculation.unit,
          purchasePrice: calculation.purchasePrice,
          defaultDgPercent: calculation.dg,
          quantity: calculation.quantity,
          length: calculation.length,
          width: calculation.width
        })
      });
      // Only the latest save reloads the in-memory catalogue. Earlier replies
      // must not overwrite a newer edit.
      if (saveId === activeProductSave) await this.reloadCloudData();
    } catch (_) {
      if (!requestStarted) toast('Feil i DB!', true);
    }
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
