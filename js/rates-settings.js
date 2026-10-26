/* Global rate settings live outside individual calculations, but are reused by new ones. */
(() => {
  const defaults = { design: 950, installation: 850, detail1: 0, detail2: 120, detail3: 240, detail4: 360 };
  const values = () => ({ ...defaults, ...(Store.rates?.() || {}) });
  globalThis.Rates = { values };

  const field = () => '<div class="living-field" aria-hidden="true"><div class="ambient-stars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="edge-tint" aria-hidden="true"></div>';

  function open() {
    const rate = values();
    const root = document.getElementById('app');
    const outgoing = root.firstElementChild?.cloneNode(true);
    document.getElementById('app').innerHTML = `<section class="app-view rates-view">${field()}<header class="view-top"><div class="path">R Kalkyle / Kategorier / Satser</div><div class="view-title-row"><button class="back-button" id="ratesBack" aria-label="Tilbake">‹</button><h1 class="view-title">Satser</h1></div></header><div class="scroll-content"><section class="sheet rates-sheet"><p class="rates-intro">Disse satsene vedlikeholdes separat og brukes som grunnlag i nye kalkyler. Alle beløp er eks. mva.</p><div class="form-grid"><label>Design (kr / time)<input id="rateDesign" type="number" inputmode="decimal" min="0" value="${rate.design}"></label><label>Montering (kr / time)<input id="rateInstallation" type="number" inputmode="decimal" min="0" value="${rate.installation}"></label><div class="section-label">Detaljnivå – kr per enhet, eks. mva</div><label>Detaljnivå 1<input id="rateDetail1" type="number" inputmode="decimal" min="0" value="${rate.detail1}"></label><label>Detaljnivå 2<input id="rateDetail2" type="number" inputmode="decimal" min="0" value="${rate.detail2}"></label><label>Detaljnivå 3<input id="rateDetail3" type="number" inputmode="decimal" min="0" value="${rate.detail3}"></label><label>Detaljnivå 4<input id="rateDetail4" type="number" inputmode="decimal" min="0" value="${rate.detail4}"></label></div><div class="actions"><button class="primary" id="saveRates">Lagre satser</button></div></section></div></section>`;
    const incoming = root.firstElementChild;
    if (outgoing && incoming) {
      incoming.classList.add('slide-enter-right');
      outgoing.classList.add('slide-exit-left');
      root.append(outgoing);
      outgoing.addEventListener('animationend', () => outgoing.remove(), { once:true });
    }
    document.getElementById('ratesBack').onclick = () => {
      const returning = root.firstElementChild?.cloneNode(true);
      globalThis.CatalogNavigation.show('catalog');
      const catalogue = root.firstElementChild;
      if (returning && catalogue) {
        catalogue.classList.add('slide-enter-left');
        returning.classList.add('slide-exit-right');
        root.append(returning);
        returning.addEventListener('animationend', () => returning.remove(), { once:true });
      }
    };
    document.getElementById('saveRates').onclick = () => {
      Store.saveRates({ design:Number(document.getElementById('rateDesign').value)||0, installation:Number(document.getElementById('rateInstallation').value)||0, detail1:Number(document.getElementById('rateDetail1').value)||0, detail2:Number(document.getElementById('rateDetail2').value)||0, detail3:Number(document.getElementById('rateDetail3').value)||0, detail4:Number(document.getElementById('rateDetail4').value)||0 });
      document.getElementById('saveRates').textContent = 'Satser lagret';
    };
  }
  globalThis.Rates.open = open;
})();
