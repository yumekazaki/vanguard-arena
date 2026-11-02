/* Opt-in presentation lifecycle. Never reads or changes game/deck state. */
(() => {
  let active = false, cleanup = [];
  function updateViewport() {
    if (!active) return;
    const viewport = window.visualViewport;
    document.body.style.setProperty('--arena-mobile-height', `${Math.round(viewport?.height || window.innerHeight)}px`);
  }
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanup.push(() => target.removeEventListener(type, handler, options));
  }
  function enable() {
    active = true;
    updateViewport();
    listen(window, 'resize', updateViewport);
    if (window.visualViewport) {
      listen(window.visualViewport, 'resize', updateViewport);
      listen(window.visualViewport, 'scroll', updateViewport);
    }
  }
  function disable() {
    active = false;
    cleanup.forEach(fn => fn());
    cleanup = [];
    document.body.style.removeProperty('--arena-mobile-height');
  }
  function sync() {
    const enabled = document.body.classList.contains('mobile-mode');
    if (enabled && !active) enable();
    else if (!enabled && active) disable();
  }
  new MutationObserver(sync).observe(document.body, { attributes:true, attributeFilter:['class'] });
  sync();
})();
