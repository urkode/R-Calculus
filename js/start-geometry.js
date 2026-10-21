/* Keep Calculus' dynamic home markup in the exact same coordinate model as R Studios. */
const renderWithCanonicalHome = App.render.bind(App);

function normalizeHomeGeometry() {
  const start = document.querySelector('.start-view');
  if (!start) return;
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
}
globalThis.normalizeHomeGeometry = normalizeHomeGeometry;

App.render = function render(view, arg) {
  const result = renderWithCanonicalHome(view, arg);
  if (view === 'home') normalizeHomeGeometry();
  return result;
};
