/* Older installed PWAs may not expose the lexical Store binding to route callbacks. */
if (!globalThis.Store) {
  globalThis.Store = {
    catalogKey: 'r-calculus-custom-products',
    customProducts() {
      try { return JSON.parse(localStorage.getItem(this.catalogKey) || '[]'); }
      catch (_) { return []; }
    },
    saveCustomProduct(product) {
      const products = this.customProducts();
      const index = products.findIndex(item => item.id === product.id);
      if (index < 0) products.push(product); else products[index] = product;
      localStorage.setItem(this.catalogKey, JSON.stringify(products));
    }
  };
}

/* One route owner: every forward tap remembers its parent, and every back tap returns there. */
globalThis.CatalogNavigation = {
  route: { view: 'home' },
  show(view, data = {}) {
    this.route = { view, ...data };
    Catalog.go(view, data);
    if (view === 'categories') {
      const root = document.getElementById('app');
      const title = root.querySelector('.view-title');
      const path = root.querySelector('.path');
      if (title) title.textContent = 'Kategorier';
      if (path) path.textContent = 'R Calculus / Kategorier';
      const view = root.querySelector('.app-view');
      if (view && !root.querySelector('#openRates')) {
        const rates = document.createElement('button');
        rates.id = 'openRates';
        rates.className = 'rates-fab';
        rates.type = 'button';
        rates.setAttribute('aria-label', 'Satser');
        rates.title = 'Satser';
        rates.innerHTML = '<span aria-hidden="true">⚙</span><span>Satser</span>';
        rates.textContent = '⚙';
        rates.onclick = () => globalThis.Rates?.open();
        rates.innerHTML = '<span aria-hidden="true">⚙</span><span>Satser</span>';
        view.append(rates);
      }
    }
  },
  openCalculation(productId) {
    const { categoryId, subcategoryId } = this.route;
    const category = Catalog.category(categoryId);
    const subcategory = category && Catalog.sub(category, subcategoryId);
    const product = subcategory && [...subcategory.products, ...Store.customProducts()]
      .find(item => item.id === productId);
    if (!category || !product) return;
    Catalog.active = 'calc';
    this.route = { view: 'calc', categoryId, subcategoryId };
    App.openCalc(Calculator.blank(product, category), product.name);
  },
  back() {
    const { view, categoryId, subcategoryId } = this.route;
    if (view === 'calc' || view === 'newProduct') return this.show('products', { categoryId, subcategoryId });
    if (view === 'products') return this.show('subcategories', { categoryId });
    if (view === 'subcategories') return this.show('categories');
    if (view === 'categories') return this.show('home');
  }
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-category],[data-subcategory],[data-product],[data-add],[data-back]');
  if (!target) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (target.matches('[data-category]')) {
    globalThis.CatalogNavigation.show('subcategories', { categoryId: target.dataset.category });
    return;
  }
  if (target.matches('[data-subcategory]')) {
    const category = Catalog.categories().find(item =>
      item.subcategories.some(subcategory => subcategory.id === target.dataset.subcategory)
    );
    if (category) globalThis.CatalogNavigation.show('products', { categoryId: category.id, subcategoryId: target.dataset.subcategory });
    return;
  }
  if (target.matches('[data-product]')) {
    globalThis.CatalogNavigation.openCalculation(target.dataset.product);
    return;
  }
  if (target.matches('[data-add]')) {
    globalThis.CatalogNavigation.show('newProduct', globalThis.CatalogNavigation.route);
    return;
  }
  globalThis.CatalogNavigation.back();
}, true);
