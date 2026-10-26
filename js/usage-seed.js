/* Seed the visible "mest brukt" examples for the new-calculation product picker.
   A real recorded count can only increase the shown number. */
(() => {
  const examples={folie_standard:37,folie_stopt:18,one_way_vision:12,frostet_folie:9,dekal_standard:28,dibond_3mm:16,pvc_3mm:11,akryl_10mm:22,skiltfolie:14,banner:19,rollup_film:8,plakatpapir:6,fotopapir:5,rollup_85:10,refleksfolie:31,etset_glassfolie:13,contour_dekal:26,refleks_dekal:17,dibond_4mm:21,pvc_bokstaver:7,lysboks:10,laminert_skiltfolie:16,refleks_skiltfolie:12,mesh_banner:18,klistremerke_ark:24,rollup_100:11,beachflagg_m:15};
  const usage=Store.productUsage.bind(Store);
  Store.productUsage=()=>{
    const values=usage();
    return Object.fromEntries(Object.keys({...examples,...values}).map(id=>[id,Math.max(Number(examples[id])||0,Number(values[id])||0)]));
  };
  const saveCustomProduct=Store.saveCustomProduct.bind(Store);
  Store.saveCustomProduct=product=>{
    saveCustomProduct(product);
    try{
      const saved=JSON.parse(localStorage.getItem(Store.usageKey)||'{}');
      if(!(product.id in saved)){
        saved[product.id]=0;
        localStorage.setItem(Store.usageKey,JSON.stringify(saved));
      }
    }catch(_){}
  };
  const money=value=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',maximumFractionDigits:0}).format(value||0);
  const updateRenderedValues=()=>{
    const usageValues=Store.productUsage();
    document.querySelectorAll('.multi-result[data-product-id]').forEach(product=>{
      const count=Math.max(Number(examples[product.dataset.productId])||0,Number(usageValues[product.dataset.productId])||0);
      const label=product.querySelector('em'),text=`Brukt ${count} ganger`;
      if(label&&label.textContent!==text)label.textContent=text;
    });
    const total=document.getElementById('multiTotal'),meta=document.getElementById('multiTotalMeta');
    if(total&&meta){
      const numeric=Number(total.textContent.replace(/[^0-9,.-]/g,'').replace(',','.'))||0;
      const text=`${money(numeric*1.25)} INKL. 25% MVA`;
      if(meta.textContent!==text)meta.textContent=text;
    }
  };
  const app=document.getElementById('app');
  if(app)new MutationObserver(updateRenderedValues).observe(app,{childList:true,subtree:true});
})();
