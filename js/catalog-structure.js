const exampleProducts=[
  ['bildekor','bilfolie',{id:'refleksfolie',name:'Refleksfolie',unit:'m²',purchasePrice:530,wasteFactor:1.1,productionMinutesPerUnit:20,installationMinutesPerUnit:32,markup:.35}],
  ['bildekor','vindusdekor',{id:'etset_glassfolie',name:'Etset glassfolie',unit:'m²',purchasePrice:330,wasteFactor:1.08,productionMinutesPerUnit:14,installationMinutesPerUnit:22,markup:.35}],
  ['bildekor','dekaler',{id:'contour_dekal',name:'Contourkuttet dekal',unit:'m²',purchasePrice:220,wasteFactor:1.12,productionMinutesPerUnit:18,installationMinutesPerUnit:8,markup:.35}],
  ['bildekor','dekaler',{id:'refleks_dekal',name:'Refleksdekal',unit:'m²',purchasePrice:410,wasteFactor:1.12,productionMinutesPerUnit:18,installationMinutesPerUnit:8,markup:.35}],
  ['skilt','platematerialer',{id:'dibond_4mm',name:'Dibond 4 mm',unit:'m²',purchasePrice:460,wasteFactor:1.05,productionMinutesPerUnit:12,installationMinutesPerUnit:20,markup:.35}],
  ['skilt','fasadeskilt',{id:'pvc_bokstaver',name:'PVC-bokstaver',unit:'m²',purchasePrice:510,wasteFactor:1.08,productionMinutesPerUnit:26,installationMinutesPerUnit:32,markup:.35}],
  ['skilt','fasadeskilt',{id:'lysboks',name:'Lysboks',unit:'m²',purchasePrice:1450,wasteFactor:1.1,productionMinutesPerUnit:42,installationMinutesPerUnit:45,markup:.35}],
  ['skilt','skiltfolie',{id:'laminert_skiltfolie',name:'Laminert skiltfolie',unit:'m²',purchasePrice:285,wasteFactor:1.1,productionMinutesPerUnit:18,installationMinutesPerUnit:18,markup:.35}],
  ['skilt','skiltfolie',{id:'refleks_skiltfolie',name:'Refleksfolie til skilt',unit:'m²',purchasePrice:495,wasteFactor:1.1,productionMinutesPerUnit:18,installationMinutesPerUnit:18,markup:.35}],
  ['print','storformat',{id:'mesh_banner',name:'Mesh-banner',unit:'m²',purchasePrice:145,wasteFactor:1.05,productionMinutesPerUnit:10,installationMinutesPerUnit:0,markup:.35}],
  ['print','papirprint',{id:'klistremerke_ark',name:'Klistremerke-ark',unit:'m²',purchasePrice:115,wasteFactor:1.08,productionMinutesPerUnit:12,installationMinutesPerUnit:0,markup:.35}],
  ['print','display',{id:'rollup_100',name:'Rollup 100 cm',unit:'stk',purchasePrice:860,wasteFactor:1,productionMinutesPerUnit:20,installationMinutesPerUnit:0,markup:.35}],
  ['print','display',{id:'beachflagg_m',name:'Beachflagg M',unit:'stk',purchasePrice:980,wasteFactor:1,productionMinutesPerUnit:24,installationMinutesPerUnit:0,markup:.35,extras:[{id:'jordspyd',label:'Jordspyd',price:295},{id:'kryssfot',label:'Kryssfot',price:395},{id:'vannvekt',label:'Vannvekt',price:195},{id:'baerebag',label:'Bærebag',price:240}]}]
];

const originalInit=App.init.bind(App);
App.init=async function(){
  await originalInit();
  exampleProducts.forEach(([categoryId,subcategoryId,product])=>{
    const category=this.catalog.categories.find(item=>item.id===categoryId);
    const subcategory=category?.subcategories.find(item=>item.id===subcategoryId);
    if(subcategory&&!subcategory.products.some(item=>item.id===product.id))subcategory.products.push(product);
  });
};

const legacyRender=App.render.bind(App);
const Catalog={active:'home',depth:{home:0,categories:1,subcategories:2,products:3,newProduct:4},field(){return '<div class="living-field" aria-hidden="true"><div class="ambient-stars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="edge-tint" aria-hidden="true"></div>'},categories(){return App.catalog.categories},category(id){return this.categories().find(item=>item.id===id)},sub(category,id){return category.subcategories.find(item=>item.id===id)},shell(title,path,body,{back,add}={}){return `<section class="app-view">${this.field()}<header class="view-top"><div class="path">${path}</div><div class="view-title-row">${back?'<button class="back-button" data-back aria-label="Tilbake">‹</button>':''}<h1 class="view-title">${title}</h1>${add?'<button class="add-button" data-add aria-label="Legg til produkt">+</button>':''}</div></header><div class="scroll-content">${body}</div></section>`},prepareRoute(root){
  const current=root.firstElementChild;
  Array.from(root.children).slice(1).forEach(node=>node.remove());
  if(!current)return null;
  current.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());
  current.classList.remove('slide-enter-right','slide-enter-left','slide-exit-left','slide-exit-right');
  ['position','inset','zIndex','willChange','transform','opacity'].forEach(property=>current.style[property]='');
  return current;
},go(view,data={}){
  const root=document.getElementById('app'),previous=this.prepareRoute(root),from=this.active,forward=this.depth[view]>this.depth[from];
  if(view==='home'){
    const outgoing=previous?.cloneNode(true);
    legacyRender('home');
    globalThis.normalizeHomeGeometry?.();
    const incoming=root.firstElementChild;
    if(outgoing&&view!==from){
      [incoming,outgoing].forEach((node,index)=>{node.style.position='absolute';node.style.inset='0';node.style.zIndex=String(21-index);node.style.willChange='transform,opacity'});
      root.append(outgoing);
      if(typeof incoming.animate==='function'){
        const options={duration:520,easing:'cubic-bezier(.22,.78,0,1)',fill:'both'};
        const enter=incoming.animate([{transform:'translate3d(-26%,0,0)',opacity:.68},{transform:'translate3d(0,0,0)',opacity:1}],options);
        const exit=outgoing.animate([{transform:'translate3d(0,0,0)',opacity:1},{transform:'translate3d(100%,0,0)',opacity:.68}],options);
        Promise.allSettled([enter.finished,exit.finished]).then(()=>{outgoing.remove();incoming.style.willChange=''});
      }else{
        incoming.classList.add('slide-enter-left');
        outgoing.classList.add('slide-exit-right');
        let cleaned=false;
        const cleanup=()=>{if(cleaned)return;cleaned=true;outgoing.remove();incoming.classList.remove('slide-enter-right','slide-enter-left');};
        outgoing.addEventListener('animationend',event=>{if(event.target===outgoing&&/^slide-exit-/.test(event.animationName))cleanup();});
        setTimeout(cleanup,600);
      }
    }
    this.active='home';
    return;
  }
  root.innerHTML=this.template(view,data);
  const incoming=root.firstElementChild;
  if(previous&&view!==from){
    const outgoing=previous.cloneNode(true);
    incoming.classList.add(forward?'slide-enter-right':'slide-enter-left');
    outgoing.classList.add(forward?'slide-exit-left':'slide-exit-right');
    root.append(outgoing);
    let cleaned=false;
    const cleanup=()=>{if(cleaned)return;cleaned=true;outgoing.remove();incoming.classList.remove('slide-enter-right','slide-enter-left');};
    outgoing.addEventListener('animationend',event=>{if(event.target===outgoing&&/^slide-exit-/.test(event.animationName))cleanup();});
    // Safari occasionally skips animationend after a fast back/forward route.
    // Always clean the old view before the next navigation can begin.
    setTimeout(cleanup,600);
  }
  this.active=view;
  this.bind(view,data);
},template(view,data){if(view==='categories')return this.shell('Produktliste','R Kalkyle / Produktliste',`<div class="notice">Produkt- og innkjøpspriser er eksempelverdier.</div><div class="category-list">${this.categories().map((item,index)=>`<button class="list-card" data-category="${item.id}"><span class="card-icon">${['◉','▰','◌'][index%3]}</span><span><strong>${item.label}</strong><small>${item.description}</small></span><span class="arrow">›</span></button>`).join('')}</div>`,{back:true});const category=this.category(data.categoryId);if(view==='subcategories')return this.shell(category.label,`R Kalkyle / Produktliste / ${category.label}`,`<div class="category-list">${category.subcategories.map(item=>`<button class="list-card" data-subcategory="${item.id}"><span class="card-icon">◈</span><span><strong>${item.label}</strong><small>${item.description}</small></span><span class="arrow">›</span></button>`).join('')}</div>`,{back:true});const sub=this.sub(category,data.subcategoryId);if(view==='products'){const products=[...sub.products,...Store.customProducts().filter(item=>item.categoryId===category.id&&item.subcategoryId===sub.id)].sort((a,b)=>a.name.localeCompare(b.name,'nb'));return this.shell(sub.label,`R Kalkyle / Produktliste / ${category.label} / ${sub.label}`,`<input class="product-search" id="productSearch" type="search" autocomplete="off" placeholder="Søk etter produkt" aria-label="Søk etter produkt"><div class="product-list">${products.map(item=>`<button class="list-card" data-product="${item.id}"><span class="card-icon">¤</span><span><strong>${item.name}</strong><small>Innkjøp eks. mva: ${Calculator.format(item.purchasePrice)} / ${item.unit}</small></span><span class="arrow">›</span></button>`).join('')}</div>`,{back:true,add:true})}return this.shell('Nytt produkt',`R Kalkyle / Produktliste / ${category.label} / ${sub.label} / Nytt produkt`,`<section class="sheet product-editor"><h2>Legg til produkt</h2><p>Lagres lokalt på denne enheten.</p><div class="form-grid"><label class="wide">Produktnavn<input id="productName" placeholder="For eksempel: Refleksfolie"></label><label>Enhet<select id="unit"><option>m²</option><option>stk</option><option>lm</option></select></label><label>Innkjøpspris<input id="purchasePrice" type="number" placeholder="0"></label><label>Svinnfaktor<input id="wasteFactor" type="number" step=".01" value="1.05"></label><label>Påslag (0.35 = 35%)<input id="markup" type="number" step=".01" value="0.35"></label></div><div class="actions"><button class="primary" id="saveProduct">Lagre produkt</button></div></section>`,{back:true})},bind(view,data){const root=document.getElementById('app');if(view==='categories'){root.querySelector('[data-back]').onclick=()=>this.go('home');root.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>this.go('subcategories',{categoryId:button.dataset.category}));return}const category=this.category(data.categoryId);if(view==='subcategories'){root.querySelector('[data-back]').onclick=()=>this.go('categories');root.querySelectorAll('[data-subcategory]').forEach(button=>button.onclick=()=>this.go('products',{categoryId:category.id,subcategoryId:button.dataset.subcategory}));return}const sub=this.sub(category,data.subcategoryId);if(view==='products'){root.querySelector('[data-back]').onclick=()=>this.go('subcategories',data);root.querySelector('[data-add]').onclick=()=>this.go('newProduct',data);root.querySelector('#productSearch').oninput=event=>{const query=event.target.value.trim().toLocaleLowerCase('nb-NO');root.querySelectorAll('[data-product]').forEach(button=>button.hidden=!!query&&!button.textContent.toLocaleLowerCase('nb-NO').includes(query))};root.querySelectorAll('[data-product]').forEach(button=>button.onclick=()=>{const product=[...sub.products,...Store.customProducts()].find(item=>item.id===button.dataset.product);App.openCalc(Calculator.blank(product,category),product.name)});return}root.querySelector('[data-back]').onclick=()=>this.go('products',data);root.querySelector('#saveProduct').onclick=()=>{const name=root.querySelector('#productName').value.trim();if(!name)return alert('Gi produktet et navn.');Store.saveCustomProduct({id:`custom-${crypto.randomUUID()}`,categoryId:category.id,subcategoryId:sub.id,name,unit:root.querySelector('#unit').value,purchasePrice:Number(root.querySelector('#purchasePrice').value)||0,wasteFactor:Number(root.querySelector('#wasteFactor').value)||1,markup:Number(root.querySelector('#markup').value)||0});this.go('products',data)}}};
App.render=function(view,arg){if(view==='categories')return Catalog.go('categories');if(view==='subcategories'||view==='products'||view==='newProduct')return Catalog.go(view,arg);return legacyRender(view,arg)};
