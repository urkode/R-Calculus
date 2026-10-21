/* Accept the former one-level catalogue too, so a stale PWA cache cannot block navigation. */
const rawCatalogCategories=Catalog.categories.bind(Catalog);
Catalog.categories=function(){return rawCatalogCategories().map(category=>category.subcategories?category:{...category,subcategories:[{id:'standard',label:'Produkter',description:'Produkter i denne kategorien',products:category.products||[]}]})};
