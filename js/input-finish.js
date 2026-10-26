/* iOS-friendly editing for calculation fields. A value is selected on focus
   and is only committed from the shared-calculation list with the checkmark. */
(() => {
  let approvedQuantityInput = null;
  const selector = '.calculator input,[data-quantity]';
  const viewport = document.querySelector('meta[name="viewport"]');
  const viewportContent = viewport?.getAttribute('content') || '';

  function resetZoom() {
    window.scrollTo(0, 0);
    if (!viewport) return;
    viewport.setAttribute('content', `${viewportContent},maximum-scale=1`);
    requestAnimationFrame(() => setTimeout(() => viewport.setAttribute('content', viewportContent), 80));
  }

  function removeChecks(except) {
    document.querySelectorAll('.inline-input-confirm').forEach(button => {
      if (button !== except) button.remove();
    });
    document.querySelectorAll('.inline-input-host').forEach(host => {
      if (!host.querySelector('.inline-input-confirm')) host.classList.remove('inline-input-host');
    });
  }

  function addCheck(input) {
    const parent = input.parentElement;
    if (!parent || parent.querySelector('.inline-input-confirm')) return;
    removeChecks();
    parent.classList.add('inline-input-host');
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'inline-input-confirm';
    confirm.setAttribute('aria-label', 'Bekreft verdi');
    confirm.textContent = '✓';
    confirm.addEventListener('pointerdown', event => event.preventDefault());
    confirm.addEventListener('click', event => {
      event.preventDefault();
      if (input.matches('[data-quantity]')) {
        approvedQuantityInput = input;
        input.dispatchEvent(new Event('change', { bubbles:true }));
      } else {
        input.blur();
        removeChecks();
      }
      resetZoom();
    });
    parent.append(confirm);
  }

  /* Window capture precedes the older list listener on document. This keeps a
     quantity open until the deliberate confirmation tap. */
  window.addEventListener('change', event => {
    const input = event.target;
    if (!input.matches?.('[data-quantity]')) return;
    if (input === approvedQuantityInput) {
      approvedQuantityInput = null;
      return;
    }
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('focusin', event => {
    const input = event.target;
    if (!input.matches?.(selector)) return;
    requestAnimationFrame(() => {
      input.select?.();
      addCheck(input);
    });
  });
})();
