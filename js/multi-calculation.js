/* Shared calculation: combine catalogue products in one customer total. */
(() => {
  let lines = [];
  let pickerFilters = { supplier: '', type: '', sort: 'most-used' };
  const money = value => new Intl.NumberFormat('nb-NO', { style:'currency', currency:'NOK', maximumFractionDigits:0 }).format(value || 0);
  const typeOf = product => { const v = `${product.name||''} ${product.category||''} ${product.subcategory||''}`.toLocaleLowerCase('nb-NO'); if (/folie|dekal|vision/.test(v)) return 'Folie'; if (/dibond|pvc|akryl|plate/.test(v)) return 'Plate'; if (/banner|papir|plakat|print/.test(v)) return 'Print'; if (/rollup|beachflagg|display/.test(v)) return 'Display'; if (/skilt|lysboks|bokstav/.test(v)) return 'Skilt'; return 'Annet'; };
  const departmentOf = product => { const v = `${product.category||''} ${product.subcategory||''}`.toLocaleLowerCase('nb-NO'); if (v.includes('bildekor')) return 'Bil'; if (v.includes('skilt')) return 'Skilt'; if (v.includes('print')) return 'Print'; return product.category || 'Annet'; };
  const catalogueProducts = () => { const overrides=Store.overrides?.()||{};const decorate=(product,category,subcategory)=>{const item={...product,category,subcategory},override=overrides[product.id]||{};return {...item,supplier:override.supplier??product.supplier??'Udefinert',type:override.type??product.type??typeOf(item),department:departmentOf(item)};};const standard=(App.catalog?.categories||[]).flatMap(category=>(category.subcategories||[]).flatMap(subcategory=>(subcategory.products||[]).map(product=>decorate(product,category.label,subcategory.label))));const custom=(Store.customProducts?.()||[]).map(product=>decorate(product,'Eget produkt',''));return [...standard,...custom]; };
  const optionList = (products,field,label) => { const configured=field==='supplier'?(globalThis.KalkyleSuppliers||[]):field==='type'?(globalThis.KalkyleProductTypes||[]):[];return `<option value="">Alle ${label}</option>${[...new Set([...products.map(product=>product[field]).filter(Boolean),...configured])].sort((a,b)=>a.localeCompare(b,'nb')).map(value=>`<option value="${value}">${value}</option>`).join('')}`; };
  const activeFilterCount = () => ['supplier','type'].filter(key=>pickerFilters[key]).length;
  const filteredProducts = query => { const normalized=query.trim().toLocaleLowerCase('nb-NO'),usage=Store.productUsage?.()||{}; return catalogueProducts().filter(product=>{const haystack=`${product.name} ${product.category} ${product.subcategory} ${product.supplier} ${product.type} ${product.department}`.toLocaleLowerCase('nb-NO');return(!normalized||haystack.includes(normalized))&&(!pickerFilters.supplier||product.supplier===pickerFilters.supplier)&&(!pickerFilters.type||product.type===pickerFilters.type);}).sort((a,b)=>{if(pickerFilters.sort==='most-used')return(Number(usage[b.id])||0)-(Number(usage[a.id])||0)||a.name.localeCompare(b.name,'nb');if(pickerFilters.sort==='price-asc')return(Number(a.purchasePrice)||0)-(Number(b.purchasePrice)||0);if(pickerFilters.sort==='price-desc')return(Number(b.purchasePrice)||0)-(Number(a.purchasePrice)||0);return a.name.localeCompare(b.name,'nb');});};
  const rollPlanForLine = line => {
    const product = line.product;
    if (!(Number(product.rollWidthCm) > 0) || product.unit !== 'lm') return null;
    return globalThis.RollMaterial?.plan({
      widthCm: line.wallWidthCm,
      heightCm: line.wallHeightCm,
      quantity: line.quantity,
      rollWidthCm: product.rollWidthCm,
      edgeTrimCm: product.edgeTrimCm,
      seamOverlapCm: product.seamOverlapCm,
      orientation: 'vertical'
    });
  };
  const productTotal = line => {
    const p=line.product,q=Math.max(0,Number(line.quantity)||0),rollPlan=rollPlanForLine(line);
    const materialUnits=rollPlan ? rollPlan.linearMeters : q;
    const material=materialUnits*(Number(p.purchasePrice)||0)*(Number(p.wasteFactor)||1);
    const extras=q*(line.selectedExtras||[]).reduce((sum,id)=>sum+(Number((p.extras||[]).find(extra=>extra.id===id)?.price)||0),0);
    const exVat=(material+extras)*(1+(Number(p.markup)||0)),vat=exVat*(Number(App.pricing.vatRate)||.25);
    return{exVat,vat,total:exVat+vat,materialUnits,rollPlan};
  };
  const rollSummary = line => {
    const plan=rollPlanForLine(line);
    if(!plan) return '<span>Legg inn veggbredde og -høyde for å beregne rullforbruk.</span>';
    const direction=plan.orientation==='vertical'?'Stående baner':'Liggende baner';
    return `<strong>${direction}: ${plan.panelCount} baner · ${plan.linearMeters.toFixed(2).replace('.',',')} lm</strong><span>Svinn ${plan.wasteSqm.toFixed(2).replace('.',',')} m² (${plan.wastePercent.toFixed(1).replace('.',',')} %) · ${plan.seams} skjøter</span>`;
  };
  const rollControls = (line,index) => {
    const p=line.product;
    if(!(Number(p.rollWidthCm)>0)||p.unit!=='lm') return '';
    return `<div class="multi-roll-controls"><span class="multi-roll-heading">Mål per stk</span><div class="multi-roll-inputs"><label>Bredde (cm)<input data-roll-width="${index}" type="number" inputmode="decimal" min="0" step="0.1" value="${line.wallWidthCm||''}" placeholder="Bredde"></label><label>Høyde (cm)<input data-roll-height="${index}" type="number" inputmode="decimal" min="0" step="0.1" value="${line.wallHeightCm||''}" placeholder="Høyde"></label></div><div class="multi-roll-meta">${rollSummary(line)}</div></div>`;
  };
  const lineControl = (line,index) => { const extras=line.product.extras||[]; if(!extras.length)return '';const selected=line.selectedExtras||[];return `<details class="multi-addons" data-addons="${index}" ${line.addonsOpen?'open':''}><summary>Tilvalg <span>${selected.length?`(${selected.length})`:'Velg'}</span></summary><div class="multi-addon-menu">${extras.map(extra=>`<label><input data-extra="${index}" value="${extra.id}" type="checkbox" ${selected.includes(extra.id)?'checked':''}><span>${extra.label}</span><b>+ ${money(extra.price)} / ${extra.unit||'stk'}</b></label>`).join('')}</div></details>`; };
  function resetRoute(root){const current=root.firstElementChild;Array.from(root.children).slice(1).forEach(node=>node.remove());if(!current)return null;current.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());current.classList.remove('slide-enter-right','slide-enter-left','slide-exit-left','slide-exit-right');['position','inset','zIndex','willChange','transform','opacity'].forEach(property=>current.style[property]='');return current;}
  function animateForward(root,outgoing,incoming){if(!outgoing)return;incoming.classList.add('slide-enter-right');outgoing.classList.add('slide-exit-left');root.append(outgoing);outgoing.addEventListener('animationend',()=>outgoing.remove(),{once:true});}
  function returnHome(){const root=document.getElementById('app'),outgoing=resetRoute(root)?.cloneNode(true);App.render('home');globalThis.normalizeHomeGeometry?.();const incoming=root.firstElementChild;if(!outgoing||!incoming)return;[incoming,outgoing].forEach((node,index)=>{node.style.position='absolute';node.style.inset='0';node.style.zIndex=String(21-index);node.style.willChange='transform,opacity';});root.append(outgoing);if(typeof incoming.animate==='function'){const options={duration:520,easing:'cubic-bezier(.22,.78,0,1)',fill:'both'},enter=incoming.animate([{transform:'translate3d(-26%,0,0)',opacity:.68},{transform:'translate3d(0,0,0)',opacity:1}],options),exit=outgoing.animate([{transform:'translate3d(0,0,0)',opacity:1},{transform:'translate3d(100%,0,0)',opacity:.68}],options);Promise.allSettled([enter.finished,exit.finished]).then(()=>{outgoing.remove();incoming.style.willChange='';});}else{incoming.classList.add('slide-enter-left');outgoing.classList.add('slide-exit-right');outgoing.addEventListener('animationend',()=>outgoing.remove(),{once:true});}}
  function shell(){const products=catalogueProducts();return `<section class="app-view multi-calc-view"><div class="living-field" aria-hidden="true"><div class="ambient-stars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="edge-tint" aria-hidden="true"></div><header class="view-top"><div class="path">R Kalkyle / Ny kalkulasjon</div><div class="view-title-row"><button class="back-button" id="multiCalcBack" aria-label="Tilbake">‹</button><h1 class="view-title">Materialkostnad</h1></div></header><div class="scroll-content multi-calc-content"><section class="multi-total"><span>Totalpris kunde eks. mva</span><strong id="multiTotal">${money(0)}</strong><small id="multiTotalMeta">${money(0)} INKL. 25% MVA</small></section><section class="multi-lines"><div class="multi-section-heading"><h2>Produkter</h2><span id="multiCount">0 produkter</span></div><div id="multiLines" class="multi-line-list"></div></section><section class="sheet multi-add-section"><button id="multiPickerOpen" type="button" class="multi-add-button"><span>＋</span>Legg til produkt</button></section></div><div id="multiPickerDialog" class="multi-picker-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="multiPickerTitle"><section class="multi-picker-card"><header class="multi-picker-head"><div><p>Produktkatalog</p><h2 id="multiPickerTitle">Legg til produkt</h2></div><button id="multiPickerClose" type="button" aria-label="Lukk">×</button></header><input id="multiSearch" class="product-search" type="search" autocomplete="off" placeholder="Søk i produktlisten" aria-label="Søk i produktlisten"><div class="multi-picker-toolbar"><button id="multiFilter" class="multi-picker-control" type="button">Filter <span id="multiFilterCount"></span></button><label class="multi-picker-sort">Sorter<select id="multiSort"><option value="most-used">Mest brukt</option><option value="name-asc">Alfabetisk</option><option value="price-asc">Laveste innkjøpspris</option><option value="price-desc">Høyeste innkjøpspris</option></select></label></div><div class="multi-picker-result-bar"><strong id="multiResultCount"></strong><span>Trykk på et produkt for å legge det til</span></div><div id="multiResults" class="multi-result-list"></div></section></div><div id="multiFilterDialog" class="multi-filter-dialog hidden" role="dialog" aria-modal="true"><div class="multi-filter-card"><div class="multi-filter-head"><h2>Filtrer produkter</h2><button id="multiFilterClose" type="button" aria-label="Lukk">×</button></div><label>Leverandør<select id="multiSupplier">${optionList(products,'supplier','leverandører')}</select></label><label>Type<select id="multiType">${optionList(products,'type','typer')}</select></label><label>Avdeling<select id="multiDepartment">${optionList(products,'department','avdelinger')}</select></label><div class="multi-filter-actions"><button id="multiFilterReset" type="button">Nullstill</button><button id="multiFilterApply" class="primary" type="button">Bruk filter</button></div></div></div></section>`;}
  function renderLines(){const container=document.getElementById('multiLines'),totals=lines.reduce((sum,line)=>{const result=productTotal(line);return{exVat:sum.exVat+result.exVat,total:sum.total+result.total};},{exVat:0,total:0});document.getElementById('multiTotal').textContent=money(totals.exVat);document.getElementById('multiTotalMeta').textContent=`${money(totals.total)} INKL. 25% MVA`;document.getElementById('multiCount').textContent=lines.length===1?'1 produkt':`${lines.length} produkter`;container.innerHTML=lines.length?lines.map((line,index)=>`<article class="multi-line ${line.product.extras?.length?'has-addons':''}"><div class="multi-line-main"><strong>${line.product.name}</strong><small>${line.product.category}${line.product.subcategory?` · ${line.product.subcategory}`:''}</small></div><b class="multi-line-total"><small>Eks. mva</small>${money(productTotal(line).exVat)}</b><button class="multi-remove" type="button" data-remove="${index}" aria-label="Fjern ${line.product.name}">×</button><label class="multi-quantity">Antall <span><input data-quantity="${index}" type="number" inputmode="decimal" min="0" step="0.1" value="${line.quantity}"><b>${line.product.unit}</b></span></label>${lineControl(line,index)}</article>`).join(''):'<p class="multi-empty">Ingen produkter er lagt til ennå.</p>';const updateScrollFades=()=>{const host=container.closest('.multi-lines');host?.classList.toggle('has-more-above',container.scrollTop>2);host?.classList.toggle('has-more-below',container.scrollTop+container.clientHeight<container.scrollHeight-2);};container.onscroll=updateScrollFades;requestAnimationFrame(updateScrollFades);container.querySelectorAll('[data-quantity]').forEach(input=>input.addEventListener('input',event=>{lines[Number(event.currentTarget.dataset.quantity)].quantity=event.currentTarget.value;renderLines();}));container.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',event=>{lines.splice(Number(event.currentTarget.dataset.remove),1);renderLines();}));container.querySelectorAll('[data-extra]').forEach(input=>input.addEventListener('change',event=>{const line=lines[Number(event.currentTarget.dataset.extra)],id=event.currentTarget.value;line.selectedExtras=event.currentTarget.checked?[...(line.selectedExtras||[]),id]:(line.selectedExtras||[]).filter(value=>value!==id);line.addonsOpen=true;renderLines();}));container.querySelectorAll('.multi-addons').forEach(details=>details.addEventListener('toggle',event=>{lines[Number(event.currentTarget.dataset.addons)].addonsOpen=event.currentTarget.open;}));}
  function renderResults(query=''){const results=document.getElementById('multiResults'),products=filteredProducts(query),usage=Store.productUsage?.()||{};document.getElementById('multiResultCount').textContent=products.length===1?'1 produkt':`${products.length} produkter`;results.innerHTML=products.map(product=>`<button type="button" class="multi-result" data-product-id="${product.id}"><span><strong>${product.name}</strong><small>${product.department} · ${product.type} · Innkjøp eks. mva ${money(product.purchasePrice)} / ${product.unit}</small></span><em>Brukt ${Number(usage[product.id])||0} ganger</em></button>`).join('')||'<p class="multi-empty">Ingen produkter matcher søket eller filtrene.</p>';results.querySelectorAll('[data-product-id]').forEach(button=>button.addEventListener('click',event=>{const product=catalogueProducts().find(item=>item.id===event.currentTarget.dataset.productId);if(!product)return;const isRollMaterial=Number(product.rollWidthCm)>0&&product.unit==='lm';const existing=isRollMaterial?null:lines.find(line=>line.product.id===product.id);if(existing)existing.quantity=Number(existing.quantity||0)+1;else lines.push({product,quantity:1,detailLevel:1});Store.recordProductUse?.(product.id);renderLines();renderResults(document.getElementById('multiSearch').value);}));const count=activeFilterCount();document.getElementById('multiFilterCount').textContent=count?`(${count})`:'';}
  function open(){lines=[];pickerFilters={supplier:'',type:'',department:'',sort:'most-used'};const root=document.getElementById('app'),outgoing=resetRoute(root)?.cloneNode(true);root.innerHTML=shell();animateForward(root,outgoing,root.firstElementChild);document.getElementById('multiCalcBack').onclick=returnHome;const search=document.getElementById('multiSearch'),picker=document.getElementById('multiPickerDialog'),filter=document.getElementById('multiFilterDialog');document.getElementById('multiPickerOpen').onclick=()=>{picker.classList.remove('hidden');search.focus();renderResults(search.value);};document.getElementById('multiPickerClose').onclick=()=>picker.classList.add('hidden');picker.addEventListener('click',event=>{if(event.target===picker)picker.classList.add('hidden');});search.addEventListener('input',()=>renderResults(search.value));document.getElementById('multiSort').addEventListener('change',event=>{pickerFilters.sort=event.currentTarget.value;renderResults(search.value);});document.getElementById('multiFilter').onclick=()=>{['supplier','type','department'].forEach(key=>document.getElementById(`multi${key[0].toUpperCase()}${key.slice(1)}`).value=pickerFilters[key]);filter.classList.remove('hidden');};document.getElementById('multiFilterClose').onclick=()=>filter.classList.add('hidden');filter.addEventListener('click',event=>{if(event.target===filter)filter.classList.add('hidden');});document.getElementById('multiFilterReset').onclick=()=>['Supplier','Type','Department'].forEach(key=>document.getElementById(`multi${key}`).value='');document.getElementById('multiFilterApply').onclick=()=>{pickerFilters.supplier=document.getElementById('multiSupplier').value;pickerFilters.type=document.getElementById('multiType').value;pickerFilters.department=document.getElementById('multiDepartment').value;filter.classList.add('hidden');renderResults(search.value);};renderLines();renderResults();}
  /* Roll materials need their own measuring controls in the combined estimate.
     Keep this renderer separate from the compact standard-product renderer so
     ordinary products remain just as small as before. */
  renderLines = function() {
    const container = document.getElementById('multiLines');
    const totals = lines.reduce((sum, line) => {
      const result = productTotal(line);
      return { exVat: sum.exVat + result.exVat, total: sum.total + result.total };
    }, { exVat: 0, total: 0 });
    document.getElementById('multiTotal').textContent = money(totals.exVat);
    document.getElementById('multiTotalMeta').textContent = `${money(totals.total)} INKL. 25% MVA`;
    document.getElementById('multiCount').textContent = lines.length === 1 ? '1 produkt' : `${lines.length} produkter`;
    container.innerHTML = lines.length ? lines.map((line, index) => {
      const roll = !!rollPlanForLine({ ...line, wallWidthCm: line.wallWidthCm || 0, wallHeightCm: line.wallHeightCm || 0 }) || (Number(line.product.rollWidthCm) > 0 && line.product.unit === 'lm');
      return `<article class="multi-line ${line.product.extras?.length ? 'has-addons' : ''} ${roll ? 'has-roll' : ''}"><div class="multi-line-main"><strong>${line.product.name}</strong><small>${line.product.category}${line.product.subcategory ? ` · ${line.product.subcategory}` : ''}</small></div><b class="multi-line-total"><small>Eks. mva</small>${money(productTotal(line).exVat)}</b><button class="multi-remove" type="button" data-remove="${index}" aria-label="Fjern ${line.product.name}">×</button><label class="multi-quantity">Antall <span><input data-quantity="${index}" type="number" inputmode="decimal" min="0" step="0.1" value="${line.quantity}"><b>${roll ? 'stk' : line.product.unit}</b></span></label>${lineControl(line,index)}${rollControls(line,index)}</article>`;
    }).join('') : '<p class="multi-empty">Ingen produkter er lagt til ennå.</p>';
    const updateScrollFades = () => {
      const host = container.closest('.multi-lines');
      host?.classList.toggle('has-more-above', container.scrollTop > 2);
      host?.classList.toggle('has-more-below', container.scrollTop + container.clientHeight < container.scrollHeight - 2);
    };
    container.onscroll = updateScrollFades;
    requestAnimationFrame(updateScrollFades);
    container.querySelectorAll('[data-quantity]').forEach(input => input.addEventListener('change', event => {
      lines[Number(event.currentTarget.dataset.quantity)].quantity = event.currentTarget.value;
      renderLines();
    }));
    container.querySelectorAll('[data-roll-width],[data-roll-height]').forEach(input => input.addEventListener('change', event => {
      const index = Number(event.currentTarget.dataset.rollWidth ?? event.currentTarget.dataset.rollHeight);
      const line = lines[index];
      if (event.currentTarget.dataset.rollWidth !== undefined) line.wallWidthCm = event.currentTarget.value;
      else line.wallHeightCm = event.currentTarget.value;
      renderLines();
    }));
    container.querySelectorAll('[data-roll-width],[data-roll-height]').forEach(input => input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.currentTarget.blur();
    }));
    container.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => {
      lines.splice(Number(event.currentTarget.dataset.remove), 1);
      renderLines();
    }));
    container.querySelectorAll('[data-extra]').forEach(input => input.addEventListener('change', event => {
      const line = lines[Number(event.currentTarget.dataset.extra)], id = event.currentTarget.value;
      line.selectedExtras = event.currentTarget.checked ? [...(line.selectedExtras || []), id] : (line.selectedExtras || []).filter(value => value !== id);
      line.addonsOpen = true;
      renderLines();
    }));
    container.querySelectorAll('.multi-addons').forEach(details => details.addEventListener('toggle', event => {
      lines[Number(event.currentTarget.dataset.addons)].addonsOpen = event.currentTarget.open;
    }));
  };
  const rollStyle = document.createElement('style');
  rollStyle.textContent = '.multi-line.has-roll{grid-template-rows:auto auto auto!important}.multi-roll-controls{grid-column:1 / -1;display:grid;gap:7px;padding:7px 8px 8px;border:1px solid #ffffff24;border-radius:10px;background:#ffffff08}.multi-roll-heading{color:#ffffffb8;font-size:.64rem;font-weight:750}.multi-roll-inputs{display:grid;grid-template-columns:1fr 1fr;gap:6px}.multi-roll-inputs label{display:grid;gap:3px;color:#ffffffb8;font-size:.64rem;font-weight:750}.multi-roll-inputs input{box-sizing:border-box;width:100%;height:31px;padding:5px 6px;border:1px solid #ffffff35;border-radius:8px;background:#17060dcc;color:#fff;font:16px system-ui}.multi-roll-meta{display:grid;gap:2px;color:#ffffffb8;font-size:.7rem;line-height:1.25}.multi-roll-meta strong{color:#fff;font-size:.75rem}';
  document.head.append(rollStyle);
  document.addEventListener('click',event=>{const button=event.target.closest('#newCalculation');if(!button)return;event.preventDefault();event.stopImmediatePropagation();open();},true);
  document.addEventListener('input',event=>{if(!event.target.matches('[data-quantity]'))return;event.stopImmediatePropagation();},true);
  document.addEventListener('change',event=>{const input=event.target;if(!input.matches('[data-quantity]'))return;event.stopImmediatePropagation();lines[Number(input.dataset.quantity)].quantity=input.value;renderLines();},true);
  document.addEventListener('focusin',event=>{const input=event.target;if(!input.matches('[data-quantity]'))return;requestAnimationFrame(()=>input.select());},true);
  document.addEventListener('keydown',event=>{const input=event.target;if(!input.matches('[data-quantity]')||event.key!=='Enter')return;event.preventDefault();input.blur();},true);
  /* Safari paints the standalone safe-area from the document background, not from the dialog backdrop.
     Set the final composite colour synchronously on both roots before the dialog state changes. */
  const setSafeColor=color=>[document.documentElement,document.body].forEach(node=>{node.style.setProperty('background',color,'important');node.style.setProperty('background-color',color,'important');node.style.setProperty('background-image','none','important');});
  document.addEventListener('click',event=>{if(!event.target.closest('#multiPickerOpen'))return;event.preventDefault();event.stopImmediatePropagation();pickerFilters={supplier:'',type:'',department:'',sort:'most-used'};const search=document.getElementById('multiSearch'),sort=document.getElementById('multiSort');if(search)search.value='';if(sort)sort.value='most-used';setSafeColor('#270b15');document.getElementById('multiPickerDialog')?.classList.remove('hidden');renderResults('');},true);
  document.addEventListener('click',event=>{if(!event.target.closest('#multiFilter'))return;event.preventDefault();event.stopImmediatePropagation();setSafeColor('#1d0813');['supplier','type','department'].forEach(key=>document.getElementById(`multi${key[0].toUpperCase()}${key.slice(1)}`).value=pickerFilters[key]);document.getElementById('multiFilterDialog')?.classList.remove('hidden');},true);
  function closeDialog(dialog){if(!dialog||dialog.classList.contains('hidden')||dialog.classList.contains('is-closing'))return;const picker=document.getElementById('multiPickerDialog');setSafeColor(dialog.id==='multiFilterDialog'&&picker&&!picker.classList.contains('hidden')?'#270b15':'#3a1118');dialog.classList.add('is-closing');setTimeout(()=>{dialog.classList.remove('is-closing');dialog.classList.add('hidden');},280);}
  /* A product's open tilvalg list owns the next outside tap. In particular the
     remove button closes it first, so an accidental tap cannot delete a line. */
  window.addEventListener('click',event=>{const openAddons=[...document.querySelectorAll('.multi-addons[open]')];if(!openAddons.length||event.target.closest('.multi-addons'))return;openAddons.forEach(menu=>{menu.open=false;});event.preventDefault();event.stopImmediatePropagation();},true);
  document.addEventListener('click',event=>{const apply=event.target.closest('#multiFilterApply'),closeButton=event.target.closest('#multiPickerClose,#multiFilterClose'),outside=event.target.id==='multiPickerDialog'||event.target.id==='multiFilterDialog';if(apply){event.preventDefault();event.stopImmediatePropagation();pickerFilters.supplier=document.getElementById('multiSupplier').value;pickerFilters.type=document.getElementById('multiType').value;pickerFilters.department=document.getElementById('multiDepartment').value;renderResults(document.getElementById('multiSearch').value);closeDialog(document.getElementById('multiFilterDialog'));return;}if(closeButton||outside){event.preventDefault();event.stopImmediatePropagation();closeDialog(document.getElementById(closeButton?.id==='multiFilterClose'||event.target.id==='multiFilterDialog'?'multiFilterDialog':'multiPickerDialog'));return;}if(!event.target.closest('.multi-result'))return;requestAnimationFrame(()=>closeDialog(document.getElementById('multiPickerDialog')));},true);

  // The current calculation is deliberately memory-only: a browser refresh
  // discards it, while a normal detour away from this view keeps it for 30 min.
  let sessionExpiryTimer = null;
  const originalOpen = open;
  const originalReturnHome = returnHome;
  const installResetButton = () => {
    const add = document.getElementById('multiPickerOpen');
    if (!add || document.getElementById('multiReset')) return;
    const reset = document.createElement('button');
    reset.id = 'multiReset';
    reset.type = 'button';
    reset.className = 'multi-reset-button';
    reset.textContent = 'Nullstill';
    reset.onclick = () => { lines = []; renderLines(); };
    add.before(reset);
  };
  open = function() {
    clearTimeout(sessionExpiryTimer);
    const retainedLines = lines;
    originalOpen();
    lines = retainedLines;
    renderLines();
    installResetButton();
  };
  returnHome = function() {
    clearTimeout(sessionExpiryTimer);
    sessionExpiryTimer = setTimeout(() => { lines = []; }, 30 * 60 * 1000);
    return originalReturnHome();
  };
  const sessionStyle = document.createElement('style');
  sessionStyle.textContent = '.multi-add-section{display:grid!important;grid-template-columns:auto minmax(0,1fr);gap:8px;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.multi-add-button{min-width:0}.multi-reset-button{min-height:58px;padding:0 13px;border:1px solid #ffffff42;border-radius:16px;background:#ffffff10;color:#fff;font:750 .78rem/1 inherit;cursor:pointer}';
  document.head.append(sessionStyle);
})();
