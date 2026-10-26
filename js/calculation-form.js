/* Compact single-product calculation form. Product metadata is persisted locally
   so supplier and type can be used by the product catalogue filter. */
(() => {
  const suppliers = ['Udefinert','RUMAG SKILT OG REKLAME AS','Flour Lux AS','Vink Norway AS','Goleks Ttd. SIA','Saferoad Traffic AS','Crossmark','Alvøen AS'];
  const productTypes = ['Udefinert','Folie','Plate','Print','Display','Skilt','Annet'];
  const units = ['m²','stk','lm','m','cm'];
  const defaultType = product => {
    const text = `${product.name||''} ${product.category||''} ${product.subcategory||''}`.toLocaleLowerCase('nb-NO');
    if (/folie|dekal|vision/.test(text)) return 'Folie';
    if (/dibond|pvc|akryl|plate/.test(text)) return 'Plate';
    if (/banner|papir|plakat|print/.test(text)) return 'Print';
    if (/rollup|beachflagg|display/.test(text)) return 'Display';
    if (/skilt|lysboks|bokstav/.test(text)) return 'Skilt';
    return 'Udefinert';
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const dgToMarkup = value => { const dg=Math.min(99,Math.max(0,Number(value)||0)); return dg/(100-dg); };
  const markupToDg = value => { const markup=Math.max(0,Number(value)||0); return markup/(1+markup)*100; };
  const options = (values,current) => values.map(value=>`<option value="${escapeHtml(value)}" ${value===current?'selected':''}>${escapeHtml(value)}</option>`).join('');
  const numberField = (id,label,value,attributes='') => `<label for="${id}">${label}<input id="${id}" type="number" inputmode="decimal" value="${escapeHtml(value)}" ${attributes}></label>`;

  App.calcView = function(data,productName) {
    if (!Number.isFinite(Number(data.dg))) data.dg=markupToDg(data.markup||42/58);
    if (!data.supplier) data.supplier='Udefinert';
    if (!data.type) data.type='Udefinert';
    data.markup=dgToMarkup(data.dg);
    const calculation=Calculator.calculate(data,this.pricing);
    const unitPrice=calculation.units?calculation.sales/calculation.units:0;
    const db=calculation.sales-calculation.base;
    return this.viewShell('Kalkyle',`R Kalkyle / Produktkatalog / ${escapeHtml(productName)}`,true,`<section class="sheet calculator"><div class="calc-header"><input id="name" value="${escapeHtml(data.name)}" aria-label="Kalkylenavn"></div><section class="calc-unit-price"><span>Pris per enhet eks. mva</span><strong id="unitPrice">${Calculator.format(unitPrice)}</strong></section><div class="form-grid calc-form-grid"><div class="section-label">Produkt</div>${numberField('quantity','Antall',data.quantity,'min="0" step="0.1"')}<label for="unit">Enhet<select id="unit">${options(units,data.unit||'m²')}</select></label>${numberField('width','Bredde (cm)',data.width,'min="0" step="0.1"')}${numberField('height','Høyde (cm)',data.height,'min="0" step="0.1"')}<label class="wide" for="type">Type<select id="type">${options(productTypes,data.type)}</select></label><div class="section-label">Pris</div>${numberField('purchasePrice','Innkjøpspris per enhet',data.purchasePrice,'min="0" step="0.01"')}${numberField('dg','DG (%)',Number(data.dg).toFixed(1),'min="0" max="99" step="0.1"')}${numberField('contributionMargin','DB (kr)',Math.round(db),'min="0" step="1"')}<label class="wide" for="supplier">Leverandør<select id="supplier">${options(suppliers,data.supplier)}</select></label></div></section>`);
  };
  App.bindCalc = function() {
    const back=document.querySelector('[data-back]');
    if(back) back.onclick=()=>this.render('categories');
    document.querySelectorAll('.calculator input,.calculator select').forEach(field=>['input','change'].forEach(type=>field.addEventListener(type,()=>this.refreshCalc(field.id))));
  };
  App.refreshCalc = function(changedField) {
    ['name','unit','supplier','type'].forEach(id=>{const field=document.getElementById(id);if(field)this.current[id]=field.value;});
    ['quantity','width','height','purchasePrice','dg'].forEach(id=>{const field=document.getElementById(id);if(field)this.current[id]=field.value.replace(',','.');});
    if(changedField==='contributionMargin'){
      const withoutMargin=Calculator.calculate({...this.current,markup:0},this.pricing);
      const requestedDb=Math.max(0,Number(document.getElementById('contributionMargin')?.value.replace(',','.'))||0);
      this.current.dg=withoutMargin.base?requestedDb/(withoutMargin.base+requestedDb)*100:0;
      const dg=document.getElementById('dg');
      if(dg)dg.value=Number(this.current.dg).toFixed(1);
    }
    this.current.markup=dgToMarkup(this.current.dg);
    Store.saveOverride(this.current.productId,{supplier:this.current.supplier,type:this.current.type});
    const calculation=Calculator.calculate(this.current,this.pricing),unitPrice=document.getElementById('unitPrice'),db=document.getElementById('contributionMargin');
    if(unitPrice) unitPrice.textContent=Calculator.format(calculation.units?calculation.sales/calculation.units:0);
    if(db&&changedField!=='contributionMargin') db.value=Math.round(calculation.sales-calculation.base);
  };
  globalThis.KalkyleSuppliers=Object.freeze([...suppliers]);
  globalThis.KalkyleProductTypes=Object.freeze([...productTypes]);
  globalThis.KalkyleDefaultType=defaultType;
})();
