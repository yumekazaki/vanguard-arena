/* Opt-in presentation lifecycle. Never reads or changes game/deck state. */
(() => {
  let active = false, cleanup = [];
  function updateViewport() {
    if (!active) return;
    const viewport = window.visualViewport;
    document.body.style.setProperty('--arena-mobile-height', `${Math.round(viewport?.height || window.innerHeight)}px`);
    document.body.style.setProperty('--arena-mobile-top', `${Math.round(viewport?.offsetTop || 0)}px`);
    document.body.style.setProperty('--arena-mobile-bottom', `${Math.round(Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0)))}px`);
  }
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanup.push(() => target.removeEventListener(type, handler, options));
  }
  function addTouchTools() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button mobile-card-info-button';
    button.textContent = 'Card info';
    button.setAttribute('aria-haspopup', 'dialog');
    const dialog = document.createElement('dialog');
    dialog.className = 'mobile-card-info';
    dialog.setAttribute('aria-label', 'Card information');
    const heading = document.createElement('h2');
    heading.textContent = 'Card information';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'button'; close.textContent = 'Close';
    const content = document.createElement('div');
    content.className = 'mobile-card-info-content';
    const header = document.createElement('header'); header.append(heading, close);
    dialog.append(header, content);
    document.querySelector('.topbar-right')?.append(button);
    document.body.append(dialog);
    const updateInfo = () => {
      if (!dialog.open) return;
      const source = document.querySelector('.active-view .card-inspector .inspector-content');
      const copies = source ? [...source.childNodes].map(node => node.cloneNode(true)) : [];
      copies.forEach(node => {
        node.removeAttribute?.('id');
        node.querySelectorAll?.('[id]').forEach(child => child.removeAttribute('id'));
      });
      content.replaceChildren(...copies);
      if (!copies.length) content.textContent = 'Tap a card, then open Card info to read its details. The card’s zoom button also opens its image and text.';
    };
    listen(button, 'click', () => { dialog.showModal(); updateInfo(); });
    listen(close, 'click', () => dialog.close());
    const infoObserver = new MutationObserver(updateInfo);
    document.querySelectorAll('.card-inspector .inspector-content').forEach(source => infoObserver.observe(source, {childList:true, subtree:true}));
    cleanup.push(() => { infoObserver.disconnect(); if(dialog.open)dialog.close(); dialog.remove(); button.remove(); });

    const search = document.querySelector('.visual-workshop .card-browser');
    if (search) {
      const fold = document.createElement('details');
      fold.className = 'mobile-search-fold';
      const summary = document.createElement('summary');
      summary.textContent = 'Find cards · Search & filters';
      search.before(fold); fold.append(summary, search);
      cleanup.push(() => fold.replaceWith(search));
    }

    // Do not prevent touch scrolling or pinch gestures. Suppress only a click
    // following a moved touch on the same card, never a normal tap or key press.
    const cardSelector = '.fighter-option,.game-card-wrap,.deck-grid-card,.zone-view-card,.field-card,.library-card';
    const touches = new Set();
    let gesture = null, blocked = null;
    listen(document, 'pointerdown', event => {
      if(event.pointerType !== 'touch')return;
      touches.add(event.pointerId);
      const root = event.target.closest(cardSelector);
      gesture = touches.size === 1 && root ? {id:event.pointerId,x:event.clientX,y:event.clientY,root,moved:false} : null;
    }, {capture:true,passive:true});
    listen(document, 'pointermove', event => {
      if(gesture?.id === event.pointerId && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>12)gesture.moved=true;
    }, {capture:true,passive:true});
    const finish = event => {
      touches.delete(event.pointerId);
      if(gesture?.id !== event.pointerId)return;
      if(gesture.moved || event.type === 'pointercancel')blocked={root:gesture.root,until:Date.now()+500};
      gesture=null;
    };
    listen(document, 'pointerup', finish, {capture:true,passive:true});
    listen(document, 'pointercancel', finish, {capture:true,passive:true});
    listen(document, 'click', event => {
      if(event.detail !== 0 && blocked && Date.now() < blocked.until && event.target.closest(cardSelector) === blocked.root){
        event.preventDefault(); event.stopImmediatePropagation(); blocked=null;
      }
    }, true);
  }
  function enable() {
    active = true;
    updateViewport();
    listen(window, 'resize', updateViewport);
    if (window.visualViewport) {
      listen(window.visualViewport, 'resize', updateViewport);
      listen(window.visualViewport, 'scroll', updateViewport);
    }
    addTouchTools();
  }
  function disable() {
    active = false;
    cleanup.forEach(fn => fn());
    cleanup = [];
    document.body.style.removeProperty('--arena-mobile-height');
    document.body.style.removeProperty('--arena-mobile-top');
    document.body.style.removeProperty('--arena-mobile-bottom');
  }
  function sync() {
    const enabled = document.body.classList.contains('mobile-mode');
    if (enabled && !active) enable();
    else if (!enabled && active) disable();
  }
  new MutationObserver(sync).observe(document.body, { attributes:true, attributeFilter:['class'] });
  sync();
})();
