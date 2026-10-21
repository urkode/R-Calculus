/* First shared-calculation draft: combine multiple catalogue products in one customer total. */
(() => {
  let lines = [];

  const money = value => new Intl.NumberFormat('nb-NO', {
    style: 'currency', currency: 'NOK', maximumFractionDigits: 0
  }).format(value || 0);

  const catalogueProducts = () => {
    const standard = (App.catalog?.categories || []).flatMap(category =>
      (category.subcategories || []).flatMap(subcategory =>
        (subcategory.products || []).map(product => ({ ...product, category: category.label, subcategory: subcategory.label }))
      )
    );
    const custom = (Store.customProducts?.() || []).map(product => ({ ...product, category: 'Eget produkt', subcategory: '' }));
    return [...standard, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  };

  const productTotal = line => {
    const product = line.product;
    const quantity = Math.max(0, Number(line.quantity) || 0);
    const material = quantity * (Number(product.purchasePrice) || 0) * (Number(product.wasteFactor) || 1);
    const minutes = (Number(product.productionMinutesPerUnit) || 0) + (Number(product.installationMinutesPerUnit) || 0);
    const work = quantity * minutes / 60 * (Number(App.pricing.hourlyRate) || 0);
    const beforeMarkup = material + work;
    const customerBeforeVat = beforeMarkup * (1 + (Number(product.markup) || 0));
    return customerBeforeVat * (1 + (Number(App.pricing.vatRate) || 0));
  };

  function shell() {
    return `<section class="app-view multi-calc-view">
      <div class="living-field" aria-hidden="true"><div class="ambient-stars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="edge-tint" aria-hidden="true"></div>
      <header class="view-top"><div class="path">R Calculus / Ny kalkulasjon</div><div class="view-title-row"><button class="back-button" id="multiCalcBack" aria-label="Tilbake">‹</button><h1 class="view-title">Ny kalkulasjon</h1></div></header>
      <div class="scroll-content multi-calc-content">
        <section class="multi-total"><span>Totalkost kunde</span><strong id="multiTotal">${money(0)}</strong><small>Inkl. mva</small></section>
        <section class="multi-lines" aria-label="Valgte produkter"><div class="multi-section-heading"><h2>Produkter</h2><span id="multiCount">0 produkter</span></div><div id="multiLines" class="multi-line-list"></div></section>
        <section class="sheet multi-picker"><div class="multi-section-heading"><h2>Legg til produkt</h2></div><input id="multiSearch" class="product-search" type="search" autocomplete="off" placeholder="Søk i produktlisten" aria-label="Søk i produktlisten"><div id="multiResults" class="multi-result-list"></div></section>
      </div>
    </section>`;
  }

  function renderLines() {
    const container = document.getElementById('multiLines');
    const total = lines.reduce((sum, line) => sum + productTotal(line), 0);
    document.getElementById('multiTotal').textContent = money(total);
    document.getElementById('multiCount').textContent = lines.length === 1 ? '1 produkt' : `${lines.length} produkter`;
    container.innerHTML = lines.length ? lines.map((line, index) => `<article class="multi-line" data-line="${index}">
      <div class="multi-line-main"><strong>${line.product.name}</strong><small>${line.product.category}${line.product.subcategory ? ` · ${line.product.subcategory}` : ''}</small></div>
      <button class="multi-remove" type="button" data-remove="${index}" aria-label="Fjern ${line.product.name}">×</button>
      <label class="multi-quantity">Mengde <span><input data-quantity="${index}" type="number" inputmode="decimal" min="0" step="0.1" value="${line.quantity}"><b>${line.product.unit}</b></span></label>
      <b class="multi-line-total">${money(productTotal(line))}</b>
    </article>`).join('') : '<p class="multi-empty">Ingen produkter er lagt til ennå.</p>';
    container.querySelectorAll('[data-quantity]').forEach(input => input.addEventListener('input', event => {
      lines[Number(event.currentTarget.dataset.quantity)].quantity = event.currentTarget.value;
      renderLines();
    }));
    container.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => {
      lines.splice(Number(event.currentTarget.dataset.remove), 1);
      renderLines();
    }));
  }

  function renderResults(query = '') {
    const normalized = query.trim().toLocaleLowerCase('nb-NO');
    const products = catalogueProducts().filter(product => !normalized || `${product.name} ${product.category} ${product.subcategory}`.toLocaleLowerCase('nb-NO').includes(normalized));
    const results = document.getElementById('multiResults');
    results.innerHTML = products.slice(0, 30).map(product => `<button type="button" class="multi-result" data-product-id="${product.id}"><span><strong>${product.name}</strong><small>${product.category}${product.subcategory ? ` · ${product.subcategory}` : ''} · ${money(product.purchasePrice)} / ${product.unit}</small></span><b>Legg til</b></button>`).join('') || '<p class="multi-empty">Ingen produkter matcher søket.</p>';
    results.querySelectorAll('[data-product-id]').forEach(button => button.addEventListener('click', event => {
      const product = catalogueProducts().find(item => item.id === event.currentTarget.dataset.productId);
      if (!product) return;
      const existing = lines.find(line => line.product.id === product.id);
      if (existing) existing.quantity = Number(existing.quantity || 0) + 1;
      else lines.push({ product, quantity: 1 });
      renderLines();
    }));
  }

  function open() {
    lines = [];
    document.getElementById('app').innerHTML = shell();
    document.getElementById('multiCalcBack').onclick = () => App.render('home');
    const search = document.getElementById('multiSearch');
    search.addEventListener('input', () => renderResults(search.value));
    renderLines();
    renderResults();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#newCalculation');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }, true);
})();
