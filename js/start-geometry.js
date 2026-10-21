/* Normalizes the home markup to the R Studios start-screen structure.
   It deliberately changes only the home view after App has rendered it. */
function alignHomeWithStudios() {
  const start = document.querySelector('.start-view');
  if (!start) { requestAnimationFrame(alignHomeWithStudios); return; }
  const field = start.querySelector('.living-field');
  if (field) {
    const stars = field.querySelector('.ambient-stars');
    const orbits = document.createElement('div');
    orbits.className = 'colour-orbits';
    orbits.setAttribute('aria-hidden', 'true');
    field.replaceWith(orbits);
    if (stars) orbits.after(stars);
  }
  const trigger = start.querySelector('#openMenu');
  if (trigger && !trigger.parentElement.classList.contains('start-actions')) {
    const actions = document.createElement('div');
    actions.className = 'start-actions';
    trigger.replaceWith(actions);
    actions.append(trigger);
  }
  const catalog = start.querySelector('#openCatalog');
  if (catalog) catalog.childNodes[0].nodeValue = 'Produktliste ';
}

document.addEventListener('DOMContentLoaded', alignHomeWithStudios);
