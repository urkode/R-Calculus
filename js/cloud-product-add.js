/* Product creation and product options live in D1, never in localStorage. */
(() => {
  const units = ['m²', 'stk', 'lm', 'm', 'cm'];
  let pendingOptions = [];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const options = (items, selected) => items.map(item => {
    const value = typeof item === 'string' ? item : item.value;
    const label = typeof item === 'string' ? item : item.label;
    return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
  const catalogProducts = () => (App.catalog?.categories || []).flatMap(category =>
    (category.subcategories || []).flatMap(subcategory => subcategory.products || [])
  );
  const valueOptions = (key, fallback) => [...new Set(catalogProducts().map(product => product[key]).filter(Boolean).concat(fallback))]
    .sort((a, b) => a.localeCompare(b, 'nb-NO'));

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
    element.innerHTML = `
      <section class="cloud-add-product-card">
        <header><div><small>Produktkatalog</small><h2>Legg til produkt</h2></div><button type="button" data-cloud-close aria-label="Lukk">×</button></header>
        <label>Produktnavn<input data-cloud-name autocomplete="off" placeholder="For eksempel: Ny folie"></label>
        <label>Enhet<select data-cloud-unit>${options(units, 'm²')}</select></label>
        <label>Innkjøpspris eks. mva<input data-cloud-price type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>
        <label>DG (%)<input data-cloud-dg type="number" inputmode="decimal" min="0" max="99" step="0.1" value="42"></label>
        <label>Type<select data-cloud-type></select></label>
        <label>Leverandør<select data-cloud-supplier></select></label>
        <details class="cloud-roll-settings">
          <summary>Rullmateriale <span>valgfritt</span></summary>
          <p>Bruk for folie og andre materialer som kjøpes i løpemeter.</p>
          <div class="cloud-roll-grid">
            <label>Rullbredde (cm)<input data-cloud-roll-width type="number" inputmode="decimal" min="0" step="0.1" placeholder="137"></label>
            <label>Kapp per ytterkant (cm)<input data-cloud-edge-trim type="number" inputmode="decimal" min="0" step="0.1" placeholder="15"></label>
            <label>Overlapp per skjøt (cm)<input data-cloud-seam-overlap type="number" inputmode="decimal" min="0" step="0.1" placeholder="1"></label>
          </div>
        </details>
        <button type="button" class="cloud-option-open" data-cloud-options>Tilleggsvalg <span data-option-count>0</span></button>
        <div class="cloud-option-list" data-option-list></div>
        <button type="button" data-cloud-save class="cloud-add-save">Lagre produkt</button>
      </section>`;
    return element;
  };

  const optionDialog = () => {
    const element = document.createElement('div');
    element.id = 'cloudOptionDialog';
    element.className = 'cloud-option-dialog';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.innerHTML = `
      <section class="cloud-option-card">
        <header><div><small>Tilleggsvalg</small><h2>Legg til valg</h2></div><button type="button" data-option-close aria-label="Lukk">×</button></header>
        <label>Navn<input data-option-name autocomplete="off" placeholder="For eksempel: Jordspyd"></label>
        <label>Pris eks. mva<input data-option-price type="number" inputmode="decimal" min="0" step="0.01" value="0"></label>
        <label>Enhet<select data-option-unit>${options(units, 'stk')}</select></label>
        <button type="button" data-option-save class="cloud-add-save">Legg til valg</button>
      </section>`;
    return element;
  };

  const renderOptions = () => {
    const form = document.getElementById('cloudAddProductDialog');
    if (!form) return;
    form.querySelector('[data-option-count]').textContent = pendingOptions.length ? `(${pendingOptions.length})` : '0';
    form.querySelector('[data-option-list]').innerHTML = pendingOptions.map((option, index) => `
      <div class="cloud-option-row"><span><b>${escapeHtml(option.label)}</b><small>${Number(option.purchasePrice || 0).toLocaleString('nb-NO')} kr / ${escapeHtml(option.unit)}</small></span><button type="button" data-option-remove="${index}" aria-label="Fjern ${escapeHtml(option.label)}">×</button></div>`).join('');
    form.querySelectorAll('[data-option-remove]').forEach(button => button.onclick = () => {
      pendingOptions.splice(Number(button.dataset.optionRemove), 1);
      renderOptions();
    });
  };

  const resetForm = () => {
    pendingOptions = [];
    const form = document.getElementById('cloudAddProductDialog');
    if (!form) return;
    form.querySelector('[data-cloud-name]').value = '';
    form.querySelector('[data-cloud-unit]').value = 'm²';
    form.querySelector('[data-cloud-price]').value = '0';
    form.querySelector('[data-cloud-dg]').value = '42';
    form.querySelector('[data-cloud-roll-width]').value = '';
    form.querySelector('[data-cloud-edge-trim]').value = '';
    form.querySelector('[data-cloud-seam-overlap]').value = '';
    form.querySelector('.cloud-roll-settings').open = false;
    renderOptions();
  };
  const open = () => {
    const element = document.getElementById('cloudAddProductDialog');
    const type = element.querySelector('[data-cloud-type]');
    const supplier = element.querySelector('[data-cloud-supplier]');
    type.innerHTML = options(valueOptions('type', ['Udefinert', 'Folie', 'Plate', 'Print', 'Display', 'Skilt', 'Annet']), 'Udefinert');
    supplier.innerHTML = options(valueOptions('supplier', ['Udefinert', 'RUMAG SKILT OG REKLAME AS', 'Flour Lux AS', 'Vink Norway AS', 'Goleks Ttd. SIA', 'Saferoad Traffic AS', 'Crossmark', 'Alvøen AS']), 'Udefinert');
    resetForm();
    element.classList.remove('is-closing');
    element.classList.add('is-open');
  };
  const closePopup = element => {
    if (!element?.classList.contains('is-open') || element.classList.contains('is-closing')) return;
    element.classList.add('is-closing');
    setTimeout(() => element.classList.remove('is-open', 'is-closing'), 280);
  };
  const close = () => closePopup(document.getElementById('cloudAddProductDialog'));
  const openOptions = () => {
    const element = document.getElementById('cloudOptionDialog');
    element?.classList.remove('is-closing');
    element?.classList.add('is-open');
  };
  const closeOptions = () => closePopup(document.getElementById('cloudOptionDialog'));

  const install = () => {
    const root = document.getElementById('app');
    const browser = root?.querySelector('.catalog-browser');
    if (!browser || browser.querySelector('#cloudAddProduct')) return;
    browser.closest('.scroll-content')?.classList.add('catalog-scroll-root');
    const button = addButton();
    browser.querySelector('.catalog-rates-slot')?.before(button);
    // Dialogs live under <body>, while the catalogue itself is re-rendered.
    // Remove an older pair before installing a fresh pair; otherwise each visit
    // leaves hidden duplicate dialogs and their listeners behind.
    document.getElementById('cloudAddProductDialog')?.remove();
    document.getElementById('cloudOptionDialog')?.remove();
    document.body.append(dialog(), optionDialog());
    button.onclick = open;
    const form = document.getElementById('cloudAddProductDialog');
    const optionForm = document.getElementById('cloudOptionDialog');
    form.addEventListener('click', event => { if (event.target === form || event.target.closest('[data-cloud-close]')) close(); });
    optionForm.addEventListener('click', event => { if (event.target === optionForm || event.target.closest('[data-option-close]')) closeOptions(); });
    form.querySelector('[data-cloud-options]').onclick = openOptions;
    optionForm.querySelector('[data-option-save]').onclick = () => {
      const name = optionForm.querySelector('[data-option-name]').value.trim();
      if (!name) return globalThis.CloudData.toast('Skriv inn navnet på tilleggsvalget.', true);
      pendingOptions.push({
        label: name,
        purchasePrice: optionForm.querySelector('[data-option-price]').value,
        unit: optionForm.querySelector('[data-option-unit]').value
      });
      optionForm.querySelector('[data-option-name]').value = '';
      optionForm.querySelector('[data-option-price]').value = '0';
      optionForm.querySelector('[data-option-unit]').value = 'stk';
      closeOptions();
      renderOptions();
    };
    form.querySelector('[data-cloud-save]').onclick = async () => {
      const value = selector => form.querySelector(selector).value;
      const name = value('[data-cloud-name]').trim();
      if (!name) return globalThis.CloudData.toast('Skriv inn et produktnavn.', true);
      const product = {
        id: 'custom-' + crypto.randomUUID(), name,
        unit: value('[data-cloud-unit]'), purchasePrice: value('[data-cloud-price]'),
        defaultDgPercent: value('[data-cloud-dg]'), type: value('[data-cloud-type]'),
        supplier: value('[data-cloud-supplier]'), options: [...pendingOptions],
        rollWidthCm: value('[data-cloud-roll-width]'),
        edgeTrimCm: value('[data-cloud-edge-trim]'),
        seamOverlapCm: value('[data-cloud-seam-overlap]'),
        defaultOrientation: 'vertical'
      };
      close();
      try {
        await App.saveCloudProduct(product);
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
    const result = routedRender(view, data);
    if (view === 'home') {
      const catalogueButton = document.getElementById('openCatalog');
      if (catalogueButton) catalogueButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        globalThis.CatalogNavigation.show('catalog');
      };
    }
    return result;
  };
  const style = document.createElement('style');
  style.textContent = `
    .catalog-scroll-root{display:flex;flex:1;min-height:0;overflow:hidden!important}.catalog-scroll-root .catalog-browser{display:flex;flex:1;min-height:0;flex-direction:column}.catalog-scroll-root .catalog-list-shell{height:auto;min-height:0;flex:1}.catalog-scroll-root .catalog-rates-slot{flex:none;padding:10px 0 calc(8px + env(safe-area-inset-bottom))}
    .cloud-add-product{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:12px 0 0;border:1px solid #ffffff4a;border-radius:14px;background:#ffffff12;color:#fff;font:800 .86rem/1 inherit}.cloud-add-product span{font-size:1.25rem;font-weight:400}
    .cloud-add-product-dialog,.cloud-option-dialog{position:fixed;z-index:9998;inset:0;display:grid;place-items:center;padding:calc(18px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) calc(18px + env(safe-area-inset-left));background:rgb(0 0 0 / .001);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);opacity:0;pointer-events:none;transition:opacity .18s ease}.cloud-option-dialog{z-index:9999}.cloud-add-product-dialog.is-open,.cloud-option-dialog.is-open{opacity:1;pointer-events:auto}.cloud-add-product-dialog.is-closing,.cloud-option-dialog.is-closing{animation:source-dialog-out .28s ease-in both}
    .cloud-add-product-card,.cloud-option-card{width:min(100%,300px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 36px);overflow:auto;padding:18px;border:1px solid #ffffff52;border-radius:24px;background:linear-gradient(145deg,#ffffff24,#ffffff0d);box-shadow:inset 0 1px 0 #ffffff38,0 18px 45px #0005;will-change:transform,opacity;transform:translateZ(0)}.cloud-option-card{width:min(100%,300px)}.is-open .cloud-add-product-card,.is-open .cloud-option-card{animation:source-card-in .34s ease-out both}.is-closing .cloud-add-product-card,.is-closing .cloud-option-card{animation:source-card-out .28s cubic-bezier(.5,0,.8,.2) both}
    .cloud-add-product-card header,.cloud-option-card header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.cloud-add-product-card header small,.cloud-option-card header small{display:block;color:#ffffff9e;font-size:.66rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.cloud-add-product-card h2,.cloud-option-card h2{margin:2px 0 0;color:#fff;font-size:1.1rem}.cloud-add-product-card header button,.cloud-option-card header button,.cloud-option-row button{width:31px;height:31px;border:1px solid #ffffff42;border-radius:50%;background:#ffffff12;color:#fff;font-size:22px}
    .cloud-add-product-card label,.cloud-option-card label{display:grid;gap:5px;margin:9px 0;color:#ffffffc4;font-size:.75rem;font-weight:700}.cloud-add-product-card input,.cloud-add-product-card select,.cloud-option-card input,.cloud-option-card select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ffffff32;border-radius:10px;background:#ffffff10;color:#fff;font:400 16px system-ui}.cloud-add-product-card option,.cloud-option-card option{color:#111}
    .cloud-option-open{display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:14px;padding:11px 12px;border:1px solid #ffffff42;border-radius:11px;background:#ffffff10;color:#fff;font:750 .82rem/1 system-ui;cursor:pointer}.cloud-option-open span{color:#ffffffa8}.cloud-option-list{display:grid;gap:6px;margin-top:8px}.cloud-option-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 9px;border:1px solid #ffffff24;border-radius:10px;background:#12050a55;color:#fff}.cloud-option-row span{display:grid;gap:2px;min-width:0}.cloud-option-row b{font-size:.78rem}.cloud-option-row small{color:#ffffffa5;font-size:.68rem}.cloud-option-row button{width:24px;height:24px;font-size:17px;flex:none}
    .cloud-roll-settings{margin-top:12px;padding:9px 10px;border:1px solid #ffffff30;border-radius:11px;background:#ffffff08}.cloud-roll-settings summary{display:flex;align-items:center;justify-content:space-between;color:#fff;font-size:.8rem;font-weight:750;cursor:pointer}.cloud-roll-settings summary span{color:#ffffff9d;font-size:.68rem;font-weight:600}.cloud-roll-settings p{margin:8px 0 7px;color:#ffffff9d;font-size:.68rem;line-height:1.35}.cloud-roll-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}.cloud-roll-grid label{margin:6px 0!important;font-size:.68rem!important}.cloud-roll-grid input,.cloud-roll-grid select{padding:8px!important}
    .cloud-add-save{width:100%;margin-top:12px;padding:12px;border:0;border-radius:11px;background:#fff;color:#321021;font:800 .86rem system-ui;cursor:pointer;transition:transform .12s ease,filter .12s ease,background .12s ease}.cloud-add-save:active{transform:scale(.97);filter:brightness(.86);background:#e7dfe4}`;
  document.head.append(style);
})();
