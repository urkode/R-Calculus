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

/* A single capture handler keeps catalogue cards tappable through route animations. */
document.addEventListener('click', event => {
  const subcategoryCard = event.target.closest('[data-subcategory]');
  if (!subcategoryCard) return;

  const category = Catalog.categories().find(item =>
    item.subcategories.some(subcategory => subcategory.id === subcategoryCard.dataset.subcategory)
  );
  if (!category) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  Catalog.go('products', {
    categoryId: category.id,
    subcategoryId: subcategoryCard.dataset.subcategory
  });
}, true);
