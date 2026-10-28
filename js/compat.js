/* Compatibility is intentionally data-only. Navigation is owned exclusively by
   CatalogNavigation/Catalog so one tap cannot trigger competing slide handlers. */
App.categories = function() {
  return (this.catalog?.categories || []).map(category => ({
    ...category,
    subcategories: (category.subcategories || []).map(subcategory => ({
      ...subcategory,
      products: [...(subcategory.products || [])]
    }))
  }));
};
