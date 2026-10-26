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
          <div class="catalog-filter-grid">
            <label>Leverandør<select id="catalogSupplier">${options(items.map(item => item.supplier), 'leverandører', state.supplier)}</select></label>
            <label>Type<select id="catalogType">${options(items.map(item => item.type), 'typer', state.type)}</select></label>
            <label>Avdeling<select id="catalogDepartment">${options(items.map(item => item.department), 'avdelinger', state.department)}</select></label>
            <label>Sorter<select id="catalogSort">
              <option value="name-asc">Navn A–Å</option>
              <option value="name-desc">Navn Å–A</option>
              <option value="cost-asc">Lavest innkjøpspris</option>
              <option value="cost-desc">Høyest innkjøpspris</option>
              <option value="department">Avdeling</option>
              <option value="type">Type</option>
            </select></label>
          </div>
          <button class="catalog-reset" id="catalogReset" type="button">Nullstill filter</button>
        </div>
        <div class="catalog-result-bar"><strong id="catalogCount"></strong><span>Trykk på et produkt for kalkyle</span></div>
        <div class="product-list catalog-product-list" id="catalogList"></div>
      </section>
    `, { back:true });
  }

  function filteredEntries() {
    const query = state.query.trim().toLocaleLowerCase('nb-NO');
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
    if (!list || !count) return;
    const items = filteredEntries();
    count.textContent = items.length === 1 ? '1 produkt' : `${items.length} produkter`;
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
    const supplier = document.getElementById('catalogSupplier');
    const type = document.getElementById('catalogType');
    const department = document.getElementById('catalogDepartment');
    const sort = document.getElementById('catalogSort');
    query.value = state.query;
    sort.value = state.sort;
    query.addEventListener('input', () => { state.query = query.value; renderList(); });
    supplier.addEventListener('change', () => { state.supplier = supplier.value; renderList(); });
    type.addEventListener('change', () => { state.type = type.value; renderList(); });
    department.addEventListener('change', () => { state.department = department.value; renderList(); });
    sort.addEventListener('change', () => { state.sort = sort.value; renderList(); });
    document.getElementById('catalogReset').addEventListener('click', () => {
      Object.assign(state, { query:'', supplier:'', type:'', department:'', sort:'name-asc' });
      Catalog.go('catalog');
    });
    renderList();
  }

  const originalTemplate = Catalog.template.bind(Catalog);
  const originalBind = Catalog.bind.bind(Catalog);
  Catalog.depth.catalog = 1;
  Catalog.template = function(view, data) {
    return view === 'catalog' ? template() : originalTemplate(view, data);
  };
  Catalog.bind = function(view, data) {
    if (view === 'catalog') return bind();
    return originalBind(view, data);
  };

  const originalShow = globalThis.CatalogNavigation.show.bind(globalThis.CatalogNavigation);
  globalThis.CatalogNavigation.show = function(view, data = {}) {
    const nextView = view === 'categories' ? 'catalog' : view;
    originalShow(nextView, data);
    if (nextView !== 'catalog') return;
    const root = document.getElementById('app');
    const appView = root.querySelector('.app-view');
    if (!appView || root.querySelector('#openRates')) return;
    const rates = document.createElement('button');
    rates.id = 'openRates';
    rates.className = 'rates-fab';
    rates.type = 'button';
    rates.setAttribute('aria-label', 'Satser');
    rates.innerHTML = '<span aria-hidden="true">⚙</span><span>Satser</span>';
    rates.addEventListener('click', () => globalThis.Rates?.open());
    appView.append(rates);
  };

  globalThis.CatalogNavigation.openCalculation = function(productId) {
    const entry = entries().find(item => item.product.id === productId);
    if (!entry) return;
    this.route = { view:'calc', categoryId:entry.category.id, subcategoryId:entry.subcategory.id };
    Catalog.active = 'calc';
    App.openCalc(Calculator.blank(entry.product, entry.category), entry.product.name);
    const back = document.querySelector('[data-back]');
    if (back) back.onclick = event => {
      event.preventDefault();
      this.show('catalog');
    };
  };

  globalThis.CatalogNavigation.back = function() {
    if (this.route.view === 'catalog') return this.show('home');
    if (this.route.view === 'calc') return this.show('catalog');
    return this.show('catalog');
  };
})();
