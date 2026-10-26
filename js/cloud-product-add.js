/* Product creation lives in D1, never in localStorage. */
(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[character]));
  const options = (items, selected) => items.map(item =>
    '<option value="' + escapeHtml(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' +
      escapeHtml(item.label) + '</option>'
  ).join('');
  const categories = () => App.catalog?.categories || [];

  const addButton = () => {
    const button = document.createElement('button');
    button.id = 'cloudAddProduct';
    button.type = 'button';
    button.className = 'cloud-add-product';
    button.innerHTML = '<span>＋</span>Legg til produkt';
    return button;
  };

  const dialog = () => {
    const element = document.createElement('div');
    element.id = 'cloudAddProductDialog';
    element.className = 'cloud-add-product-dialog';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.innerHTML =
      '<section class="cloud-add-product-card">' +
        '<header><div><small>Produktkatalog</small><h2>Legg til produkt</h2></div><button type="button" data-cloud-close aria-label="Lukk">×</button></header>' +
        '<label>Produktnavn<input data-cloud-name autocomplete="off" placeholder="For eksempel: Ny folie"></label>' +
        '<label>Kategori<select data-cloud-category></select></label>' +
        '<label>Underkategori<select data-cloud-subcategory></select></label>' +
        '<label>Enhet<select data-cloud-unit><option>m²</option><option>stk</option><option>lm</option><option>m</option><option>cm</option></select></label>' +
        '<label>Innkjøpspris eks. mva<input data-cloud-price type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>' +
        '<label>Svinnfaktor<input data-cloud-waste type="number" inputmode="decimal" min="0" step="0.01" value="1"></label>' +
        '<label>Type<select data-cloud-type><option>Udefinert</option><option>Folie</option><option>Plate</option><option>Print</option><option>Display</option><option>Skilt</option><option>Annet</option></select></label>' +
        '<label>Leverandør<select data-cloud-supplier><option>Udefinert</option><option>RUMAG SKILT OG REKLAME AS</option><option>Flour Lux AS</option><option>Vink Norway AS</option><option>Goleks Ttd. SIA</option><option>Saferoad Traffic AS</option><option>Crossmark</option><option>Alvøen AS</option></select></label>' +
        '<button type="button" data-cloud-save class="cloud-add-save">Lagre produkt</button>' +
      '</section>';
    return element;
  };

  const open = () => {
    const element = document.getElementById('cloudAddProductDialog');
    const categorySelect = element.querySelector('[data-cloud-category]');
    const subcategorySelect = element.querySelector('[data-cloud-subcategory]');
    const populateSubcategories = () => {
      const category = categories().find(item => item.id === categorySelect.value);
      subcategorySelect.innerHTML = options((category?.subcategories || []).map(item => ({
        value: item.id, label: item.label
      })));
    };
    categorySelect.innerHTML = options(categories().map(item => ({ value: item.id, label: item.label })));
    populateSubcategories();
    categorySelect.onchange = populateSubcategories;
    element.classList.add('is-open');
    element.querySelector('[data-cloud-name]').focus();
  };

  const close = () => document.getElementById('cloudAddProductDialog')?.classList.remove('is-open');

  const install = () => {
    const root = document.getElementById('app');
    const browser = root?.querySelector('.catalog-browser');
    if (!browser || browser.querySelector('#cloudAddProduct')) return;
    browser.closest('.scroll-content')?.classList.add('catalog-scroll-root');
    const button = addButton();
    const rateSlot = browser.querySelector('.catalog-rates-slot');
    rateSlot?.before(button);
    document.body.append(dialog());
    button.onclick = open;
    const form = document.getElementById('cloudAddProductDialog');
    form.addEventListener('click', event => { if (event.target === form || event.target.closest('[data-cloud-close]')) close(); });
    form.querySelector('[data-cloud-save]').onclick = async () => {
      const value = selector => form.querySelector(selector).value;
      const name = value('[data-cloud-name]').trim();
      if (!name) return globalThis.CloudData.toast('Skriv inn et produktnavn.', true);
      try {
        await App.saveCloudProduct({
          id: 'custom-' + crypto.randomUUID(),
          name,
          categoryId: value('[data-cloud-category]'),
          subcategoryId: value('[data-cloud-subcategory]'),
          unit: value('[data-cloud-unit]'),
          purchasePrice: value('[data-cloud-price]'),
          wasteFactor: value('[data-cloud-waste]'),
          type: value('[data-cloud-type]'),
          supplier: value('[data-cloud-supplier]')
        });
        close();
        globalThis.CatalogNavigation.show('catalog');
      } catch (_) {}
    };
  };

  const originalBind = Catalog.bind.bind(Catalog);
  Catalog.bind = function(view, data) {
    const result = originalBind(view, data);
    if (view === 'catalog') install();
    return result;
  };
  const routedRender = App.render.bind(App);
  App.render = function(view, data) {
    if (view === 'categories') return globalThis.CatalogNavigation.show('catalog');
    return routedRender(view, data);
  };
  const style = document.createElement('style');
  style.textContent = '.catalog-scroll-root{display:flex;flex:1;min-height:0;overflow:hidden!important}.catalog-scroll-root .catalog-browser{display:flex;flex:1;min-height:0;flex-direction:column}.catalog-scroll-root .catalog-list-shell{height:auto;min-height:0;flex:1}.catalog-scroll-root .catalog-rates-slot{flex:none;padding:10px 0 calc(8px + env(safe-area-inset-bottom))}.cloud-add-product{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:12px 0 0;border:1px solid #ffffff4a;border-radius:14px;background:#ffffff12;color:#fff;font:800 .86rem/1 inherit}.cloud-add-product span{font-size:1.25rem;font-weight:400}.cloud-add-product-dialog{position:fixed;z-index:9998;inset:0;display:grid;place-items:center;padding:calc(18px + env(safe-area-inset-top)) 18px calc(18px + env(safe-area-inset-bottom));background:#1204118f;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .16s ease}.cloud-add-product-dialog.is-open{opacity:1;pointer-events:auto}.cloud-add-product-card{width:min(100%,400px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 36px);overflow:auto;padding:18px;border:1px solid #ffffff4c;border-radius:20px;background:linear-gradient(145deg,#3a1029f5,#180819f5);box-shadow:0 24px 56px #100108c0;transform:scale(.92) translateY(12px);transition:transform .26s cubic-bezier(.2,.9,.25,1)}.is-open .cloud-add-product-card{transform:scale(1) translateY(0)}.cloud-add-product-card header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.cloud-add-product-card header small{display:block;color:#ffffff9e;font-size:.66rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.cloud-add-product-card h2{margin:2px 0 0;color:#fff;font-size:1.1rem}.cloud-add-product-card header button{width:31px;height:31px;border:1px solid #ffffff42;border-radius:50%;background:#ffffff12;color:#fff;font-size:22px}.cloud-add-product-card label{display:grid;gap:5px;margin:9px 0;color:#ffffffc4;font-size:.75rem;font-weight:700}.cloud-add-product-card input,.cloud-add-product-card select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ffffff32;border-radius:10px;background:#ffffff10;color:#fff;font:400 16px system-ui}.cloud-add-product-card option{color:#111}.cloud-add-save{width:100%;margin-top:12px;padding:12px;border:0;border-radius:11px;background:#fff;color:#321021;font:800 .86rem system-ui}';
  document.head.append(style);
})();
