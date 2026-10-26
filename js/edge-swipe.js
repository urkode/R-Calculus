/* iOS-style back gesture: only a deliberate right-swipe started at the left edge. */
(() => {
  const edgeWidth = 30;
  const minimumDistance = 82;
  const maximumVerticalDrift = 58;
  let gesture = null;

  function activeBackButton() {
    const root = document.getElementById('app');
    const activeView = root?.firstElementChild;
    return activeView?.querySelector('[data-back], #ratesBack, #multiCalcBack') || null;
  }

  function begin(pointer) {
    if (pointer.clientX > edgeWidth) return;
    if (!activeBackButton()) return;
    gesture = { id:pointer.pointerId, x:pointer.clientX, y:pointer.clientY };
  }

  function end(pointer) {
    if (!gesture || gesture.id !== pointer.pointerId) return;
    const horizontal = pointer.clientX - gesture.x;
    const vertical = Math.abs(pointer.clientY - gesture.y);
    gesture = null;
    if (horizontal < minimumDistance || vertical > maximumVerticalDrift) return;
    activeBackButton()?.click();
  }

  document.addEventListener('pointerdown', event => begin(event), { passive:true });
  document.addEventListener('pointerup', event => end(event), { passive:true });
  document.addEventListener('pointercancel', () => { gesture = null; }, { passive:true });
})();
