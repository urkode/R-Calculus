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
    const rates = globalThis.Rates?.values?.() || {};
    const detail = quantity * (Number(rates[`detail${line.detailLevel || 1}`]) || 0);
    const exVat = (material + detail) * (1 + (Number(product.markup) || 0));
    const vat = exVat * (Number(App.pricing.vatRate) || 0.25);
    return { exVat, vat, total: exVat + vat };
  };

  function animateForward(root, outgoing, incoming) {
    if (!outgoing) return;
    incoming.classList.add('slide-enter-right');
    outgoing.classList.add('slide-exit-left');
    root.append(outgoing);
    outgoing.addEventListener('animationend', () => outgoing.remove(), { once:true });
  }

  function returnHome() {
    const root = document.getElementById('app');
    const outgoing = root.firstElementChild?.cloneNode(true);
    App.render('home');
    globalThis.normalizeHomeGeometry?.();
    const incoming = root.firstElementChild;
    if (!outgoing || !incoming) return;
    [incoming, outgoing].forEach((node, index) => {
      node.style.position = 'absolute';
      node.style.inset = '0';
      node.style.zIndex = String(21 - index);
      node.style.willChange = 'transform,opacity';
    });
    root.append(outgoing);
    if (typeof incoming.animate === 'function') {
      const options = { duration:520, easing:'cubic-bezier(.22,.78,0,1)', fill:'both' };
      const enter = incoming.animate([{ transform:'translate3d(-26%,0,0)', opacity:.68 }, { transform:'translate3d(0,0,0)', opacity:1 }], options);
      const exit = outgoing.animate([{ transform:'translate3d(0,0,0)', opacity:1 }, { transform:'translate3d(100%,0,0)', opacity:.68 }], options);
      Promise.allSettled([enter.finished, exit.finished]).then(() => { outgoing.remove(); incoming.style.willChange = ''; });
    } else {
      incoming.classList.add('slide-enter-left');
      outgoing.classList.add('slide-exit-right');
      outgoing.addEventListener('animationend', () => outgoing.remove(), { once:true });
    }
  }

  function shell() {
    return `<section class="app-view multi-calc-view">
      <div class="living-field" aria-hidden="true"><div class="ambient-stars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="edge-tint" aria-hidden="true"></div>
      <header class="view-top"><div class="path">R Calculus / Ny kalkulasjon</div><div class="view-title-row"><button class="back-button" id="multiCalcBack" aria-label="Tilbake">‹</button><h1 class="view-title">Ny kalkulasjon</h1></div></header>
      <div class="scroll-content multi-calc-content">
        <section class="multi-total"><span>Totalkost kunde</span><strong id="multiTotal">${money(0)}</strong><small id="multiTotalMeta">Eks. mva ${money(0)} · Mva (25 %) ${money(0)}</small></section>
        <section class="multi-lines" aria-label="Valgte produkter"><div class="multi-section-heading"><h2>Produkter</h2><span id="multiCount">0 produkter</span></div><div id="multiLines" class="multi-line-list"></div></section>
        <section class="sheet multi-picker"><div class="multi-section-heading"><h2>Legg til produkt</h2></div><input id="multiSearch" class="product-search" type="search" autocomplete="off" placeholder="Søk i produktlisten" aria-label="Søk i produktlisten"><div id="multiResults" class="multi-result-list"></div></section>
      </div>
    </section>`;
  }

  function renderLines() {
    const container = document.getElementById('multiLines');
    const totals = lines.reduce((sum, line) => {
      const result = productTotal(line);
      return { exVat:sum.exVat + result.exVat, vat:sum.vat + result.vat, total:sum.total + result.total };
    }, { exVat:0, vat:0, total:0 });
    document.getElementById('multiTotal').textContent = money(totals.total);
    document.getElementById('multiTotalMeta').textContent = `Eks. mva ${money(totals.exVat)} · Mva (25 %) ${money(totals.vat)}`;
    document.getElementById('multiCount').textContent = lines.length === 1 ? '1 produkt' : `${lines.length} produkter`;
    container.innerHTML = lines.length ? lines.map((line, index) => `<article class="multi-line" data-line="${index}">
      <div class="multi-line-main"><strong>${line.product.name}</strong><small>${line.product.category}${line.product.subcategory ? ` · ${line.product.subcategory}` : ''}</small></div>
      <button class="multi-remove" type="button" data-remove="${index}" aria-label="Fjern ${line.product.name}">×</button>
      <label class="multi-quantity">Mengde <span><input data-quantity="${index}" type="number" inputmode="decimal" min="0" step="0.1" value="${line.quantity}"><b>${line.product.unit}</b></span></label>
      <label class="multi-detail">Detaljnivå <select data-detail="${index}"><option value="1" ${line.detailLevel === 1 ? 'selected' : ''}>1</option><option value="2" ${line.detailLevel === 2 ? 'selected' : ''}>2</option><option value="3" ${line.detailLevel === 3 ? 'selected' : ''}>3</option><option value="4" ${line.detailLevel === 4 ? 'selected' : ''}>4</option></select></label>
      <b class="multi-line-total"><small>Inkl. mva</small>${money(productTotal(line).total)}</b>
    </article>`).join('') : '<p class="multi-empty">Ingen produkter er lagt til ennå.</p>';
    container.querySelectorAll('[data-quantity]').forEach(input => input.addEventListener('input', event => {
      lines[Number(event.currentTarget.dataset.quantity)].quantity = event.currentTarget.value;
      renderLines();
    }));
    container.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => {
      lines.splice(Number(event.currentTarget.dataset.remove), 1);
      renderLines();
    }));
    container.querySelectorAll('[data-detail]').forEach(select => select.addEventListener('change', event => {
      lines[Number(event.currentTarget.dataset.detail)].detailLevel = Number(event.currentTarget.value);
      renderLines();
    }));
  }

  function renderResults(query = '') {
    const normalized = query.trim().toLocaleLowerCase('nb-NO');
    const products = catalogueProducts().filter(product => !normalized || `${product.name} ${product.category} ${product.subcategory}`.toLocaleLowerCase('nb-NO').includes(normalized));
    const results = document.getElementById('multiResults');
    results.innerHTML = products.slice(0, 30).map(product => `<button type="button" class="multi-result" data-product-id="${product.id}"><span><strong>${product.name}</strong><small>${product.category}${product.subcategory ? ` · ${product.subcategory}` : ''} · Innkjøp eks. mva ${money(product.purchasePrice)} / ${product.unit}</small></span><b>Legg til</b></button>`).join('') || '<p class="multi-empty">Ingen produkter matcher søket.</p>';
    results.querySelectorAll('[data-product-id]').forEach(button => button.addEventListener('click', event => {
      const product = catalogueProducts().find(item => item.id === event.currentTarget.dataset.productId);
      if (!product) return;
      const existing = lines.find(line => line.product.id === product.id);
      if (existing) existing.quantity = Number(existing.quantity || 0) + 1;
      else lines.push({ product, quantity: 1, detailLevel: 1 });
      renderLines();
    }));
  }

  function open() {
    lines = [];
    const root = document.getElementById('app');
    const outgoing = root.firstElementChild?.cloneNode(true);
    root.innerHTML = shell();
    animateForward(root, outgoing, root.firstElementChild);
    document.getElementById('multiCalcBack').onclick = returnHome;
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
