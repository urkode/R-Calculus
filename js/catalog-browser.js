/* One searchable product catalogue. Product metadata can be extended in products.json
   with supplier, type and department without changing the UI. */
(() => {
  const state = { query:'', supplier:'', type:'', department:'', sort:'name-asc' };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[character]));
  const money = value => new Intl.NumberFormat('nb-NO', {
    style:'currency', currency:'NOK', maximumFractionDigits:0
  }).format(value || 0);

  function inferredType(product, category, subcategory) {
    const words = `${product.name} ${subcategory.label} ${category.label}`.toLocaleLowerCase('nb-NO');
    if (words.includes('folie') || words.includes('dekal') || words.includes('vision')) return 'Folie';
    if (words.includes('dibond') || words.includes('pvc') || words.includes('akryl') || words.includes('plate')) return 'Plate';
    if (words.includes('banner') || words.includes('papir') || words.includes('plakat') || words.includes('print')) return 'Print';
    if (words.includes('rollup') || words.includes('beachflagg') || words.includes('display')) return 'Display';
    if (words.includes('skilt') || words.includes('lysboks') || words.includes('bokstav')) return 'Skilt';
    return 'Annet';
  }

  function inferredDepartment(category) {
    if (category.id === 'bildekor') return 'Bil';
    if (category.id === 'skilt') return 'Skilt';
    if (category.id === 'print') return 'Print';
    return category.label;
  }

  function entries() {
    const standard = (App.catalog?.categories || []).flatMap(category =>
      (category.subcategories || []).flatMap(subcategory =>
        (subcategory.products || []).map(product => ({
          product, category, subcategory,
          supplier: product.supplier || 'Ikke angitt',
          type: product.type || inferredType(product, category, subcategory),
          department: product.department || inferredDepartment(category)
        }))
      )
    );
    const custom = (Store.customProducts?.() || []).map(product => {
      const category = (App.catalog?.categories || []).find(item => item.id === product.categoryId)
        || { id:'egne-produkter', label:'Egne produkter' };
      const subcategory = (category.subcategories || []).find(item => item.id === product.subcategoryId)
        || { label:'Egne produkter' };
      return {
        product, category, subcategory,
        supplier: product.supplier || 'Ikke angitt',
        type: product.type || inferredType(product, category, subcategory),
        department: product.department || inferredDepartment(category)
      };
    });
    return [...standard, ...custom];
  }

  function options(values, label, selected) {
    return `<option value="">Alle ${label.toLocaleLowerCase('nb-NO')}</option>${[...new Set(values)].sort((a,b) => a.localeCompare(b, 'nb')).map(value =>
      `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`
    ).join('')}`;
  }

  function template() {
    const items = entries();
    return Catalog.shell('Produktkatalog', 'R Kalkyle / Produktkatalog', `
      <section class="catalog-browser">
        <div class="catalog-filter-panel">
          <input id="catalogQuery" class="product-search" type="search" autocomplete="off" placeholder="Søk etter produkt" aria-label="Søk etter produkt">
          <div class="catalog-toolbar">
            <button id="catalogFilter" class="catalog-control" type="button">Filter<span id="catalogFilterCount"></span></button>
            <label class="catalog-sort-label">Sorter<select id="catalogSort">
              <option value="name-asc">Navn A–Å</option>
              <option value="name-desc">Navn Å–A</option>
              <option value="most-used">Mest brukt</option>
              <option value="cost-asc">Lavest innkjøpspris</option>
              <option value="cost-desc">Høyest innkjøpspris</option>
              <option value="department">Avdeling</option>
              <option value="type">Type</option>
            </select></label>
          </div>
        </div>
        <div class="catalog-result-bar"><strong id="catalogCount"></strong><span>Trykk på et produkt for kalkyle</span></div>
        <div class="catalog-list-shell"><div class="product-list catalog-product-list" id="catalogList"></div></div>
        <div class="catalog-rates-slot"><button id="openRates" class="rates-fab catalog-rates-button" type="button" aria-label="Satser"><span aria-hidden="true">⚙</span><span>Satser</span></button></div>
        <div class="catalog-filter-dialog multi-filter-dialog hidden" id="catalogFilterDialog" role="dialog" aria-modal="true" aria-label="Filtrer produkter">
          <div class="catalog-filter-card multi-filter-card">
            <div class="catalog-filter-heading"><h2>Filtrer produkter</h2><button id="catalogFilterClose" type="button" aria-label="Lukk filter">×</button></div>
            <label>Leverandør<select id="catalogSupplier">${options(items.map(item => item.supplier), 'leverandører', state.supplier)}</select></label>
            <label>Type<select id="catalogType">${options(items.map(item => item.type), 'typer', state.type)}</select></label>
            <label>Avdeling<select id="catalogDepartment">${options(items.map(item => item.department), 'avdelinger', state.department)}</select></label>
            <div class="catalog-filter-actions"><button id="catalogFilterReset" class="catalog-reset" type="button">Nullstill</button><button id="catalogFilterApply" class="catalog-apply" type="button">Bruk filter</button></div>
          </div>
        </div>
      </section>
    `, { back:true });
  }

  function activeFilterCount() {
    return [state.supplier, state.type, state.department].filter(Boolean).length;
  }

  function filteredEntries() {
    const query = state.query.trim().toLocaleLowerCase('nb-NO');
    const usage = Store.productUsage?.() || {};
    const items = entries().filter(item => {
      const searchable = [item.product.name, item.category.label, item.subcategory.label, item.supplier, item.type, item.department]
        .join(' ').toLocaleLowerCase('nb-NO');
      return (!query || searchable.includes(query))
        && (!state.supplier || item.supplier === state.supplier)
        && (!state.type || item.type === state.type)
        && (!state.department || item.department === state.department);
    });
    const compareText = (first, second) => first.localeCompare(second, 'nb', { sensitivity:'base' });
    return items.sort((left, right) => {
      if (state.sort === 'name-desc') return compareText(right.product.name, left.product.name);
      if (state.sort === 'most-used') return Number(usage[right.product.id] || 0) - Number(usage[left.product.id] || 0) || compareText(left.product.name, right.product.name);
      if (state.sort === 'cost-asc') return Number(left.product.purchasePrice || 0) - Number(right.product.purchasePrice || 0);
      if (state.sort === 'cost-desc') return Number(right.product.purchasePrice || 0) - Number(left.product.purchasePrice || 0);
      if (state.sort === 'department') return compareText(left.department, right.department) || compareText(left.product.name, right.product.name);
      if (state.sort === 'type') return compareText(left.type, right.type) || compareText(left.product.name, right.product.name);
      return compareText(left.product.name, right.product.name);
    });
  }

  function renderList() {
    const list = document.getElementById('catalogList');
    const count = document.getElementById('catalogCount');
    const filterCount = document.getElementById('catalogFilterCount');
    if (!list || !count) return;
    const items = filteredEntries();
    count.textContent = items.length === 1 ? '1 produkt' : `${items.length} produkter`;
    if (filterCount) filterCount.textContent = activeFilterCount() ? ` (${activeFilterCount()})` : '';
    list.innerHTML = items.length ? items.map(item => {
      const price = Number(item.product.purchasePrice || 0);
      return `<button class="list-card catalog-product-card" type="button" data-catalog-product="${escapeHtml(item.product.id)}">
        <span class="catalog-card-copy"><strong>${escapeHtml(item.product.name)}</strong><small>${escapeHtml(item.department)} · ${escapeHtml(item.type)} · ${escapeHtml(item.supplier)}</small></span>
        <span class="catalog-card-price"><small>Innkjøp eks. mva</small><b>${money(price)}<em>/ ${escapeHtml(item.product.unit)}</em></b></span>
      </button>`;
    }).join('') : '<p class="multi-empty">Ingen produkter passer med filtrene.</p>';
    list.querySelectorAll('[data-catalog-product]').forEach(button => {
      button.addEventListener('click', () => globalThis.CatalogNavigation.openCalculation(button.dataset.catalogProduct));
    });
  }

  function bind() {
    const query = document.getElementById('catalogQuery');
    const sort = document.getElementById('catalogSort');
    const dialog = document.getElementById('catalogFilterDialog');
    const supplier = document.getElementById('catalogSupplier');
    const type = document.getElementById('catalogType');
    const department = document.getElementById('catalogDepartment');
    const appView = dialog.closest('.app-view');
    /* A fixed dialog nested in Safari's scrolling catalogue can still be clipped.
       Move it beside the scroll region, matching the new-calculation picker exactly. */
    if (appView && dialog.parentElement !== appView) appView.append(dialog);
    query.value = state.query;
    sort.value = state.sort;
    query.addEventListener('input', () => { state.query = query.value; renderList(); });
    sort.addEventListener('change', () => { state.sort = sort.value; renderList(); });
    const setSafeColor = color => [document.documentElement, document.body].forEach(node => {
      node.style.setProperty('background', color, 'important');
      node.style.setProperty('background-color', color, 'important');
      node.style.setProperty('background-image', 'none', 'important');
    });
    const openFilter = () => {
      setSafeColor('#1d0813');
      dialog.classList.remove('is-closing', 'hidden');
    };
    const closeFilter = () => {
      if (dialog.classList.contains('hidden') || dialog.classList.contains('is-closing')) return;
      setSafeColor('#3a1118');
      dialog.classList.add('is-closing');
      setTimeout(() => { dialog.classList.remove('is-closing'); dialog.classList.add('hidden'); }, 280);
    };
    document.getElementById('catalogFilter').onclick = openFilter;
    document.getElementById('catalogFilterClose').onclick = closeFilter;
    dialog.addEventListener('click', event => { if (event.target === dialog) closeFilter(); });
    document.getElementById('catalogFilterReset').onclick = () => {
      supplier.value = ''; type.value = ''; department.value = '';
    };
    document.getElementById('catalogFilterApply').onclick = () => {
      state.supplier = supplier.value;
      state.type = type.value;
      state.department = department.value;
      closeFilter();
      renderList();
    };
    document.getElementById('openRates').onclick = () => globalThis.Rates?.open();
    renderList();
  }

  const originalTemplate = Catalog.template.bind(Catalog);
  const originalBind = Catalog.bind.bind(Catalog);
  Catalog.depth.catalog = 1;
  Catalog.template = function(view, data) { return view === 'catalog' ? template() : originalTemplate(view, data); };
  Catalog.bind = function(view, data) { if (view === 'catalog') return bind(); return originalBind(view, data); };

  const originalShow = globalThis.CatalogNavigation.show.bind(globalThis.CatalogNavigation);
  globalThis.CatalogNavigation.show = function(view, data = {}) {
    originalShow(view === 'categories' ? 'catalog' : view, data);
  };

  globalThis.CatalogNavigation.openCalculation = function(productId) {
    const entry = entries().find(item => item.product.id === productId);
    if (!entry) return;
    Store.recordProductUse?.(productId);
    this.route = { view:'calc', categoryId:entry.category.id, subcategoryId:entry.subcategory.id };
    Catalog.active = 'calc';
    App.openCalc(Calculator.blank(entry.product, entry.category), entry.product.name);
    const back = document.querySelector('[data-back]');
    if (back) back.onclick = event => { event.preventDefault(); this.show('catalog'); };
  };

  globalThis.CatalogNavigation.back = function() {
    if (this.route.view === 'catalog') return this.show('home');
    if (this.route.view === 'calc') return this.show('catalog');
    return this.show('catalog');
  };
})();
