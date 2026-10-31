/* Presentation only: preserve the original action nodes and their listeners. */
(() => {
  const table = document.querySelector('#game-table');
  const fullscreen = document.querySelector('#battlefield-fullscreen');
  const controls = document.querySelector('#battlefield-controls');
  if (!table || !fullscreen || !controls) return;
  const column = table.closest('.table-column');
  const quick = column.querySelector('.quick-control-drawer');
  const manual = column.querySelector('.manual-actions');
  const dialog = document.createElement('dialog');
  dialog.id = 'battlefield-controls-dialog';
  dialog.className = 'battlefield-controls-dialog';
  dialog.setAttribute('aria-labelledby', 'battlefield-controls-title');
  dialog.innerHTML = '<header><div><span class="eyebrow">YOUR TABLE</span><h2 id="battlefield-controls-title">Other game controls</h2></div><button class="button" type="button" data-close-controls aria-label="Close game controls">Close ×</button></header><p>Use your usual table actions. Controls are available when the match allows them.</p>';
  const bottom = document.createElement('button');
  bottom.type = 'button';
  bottom.className = 'button battlefield-bottom-controls';
  bottom.textContent = 'Other game controls';
  bottom.setAttribute('aria-haspopup', 'dialog');
  bottom.setAttribute('aria-controls', dialog.id);
  manual.before(bottom);
  dialog.append(quick, manual);
  quick.open = true;
  manual.querySelector('.manual-command-drawer').open = true;
  document.body.append(dialog);
  const chat = document.querySelector('#online-chat');
  const chatHome = document.createComment('Online chat position');
  chat?.before(chatHome);
  const openControls = () => {
    if (document.body.classList.contains('battlefield-expanded') && chat && !chat.hidden) dialog.append(chat);
    if (!dialog.open) dialog.showModal();
  };
  dialog.addEventListener('close', () => { if (chat && chat.parentElement === dialog) chatHome.after(chat); });
  controls.addEventListener('click', openControls);
  bottom.addEventListener('click', openControls);
  dialog.querySelector('[data-close-controls]').addEventListener('click', () => dialog.close());

  let viewportOnly = false;
  let previousScroll = 0;
  function syncFullscreen() {
    const active = Boolean(document.fullscreenElement || viewportOnly);
    document.body.classList.toggle('battlefield-expanded', active);
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.title = active ? 'Exit full screen' : 'Full screen';
    fullscreen.querySelector('[data-fullscreen-label]').textContent = fullscreen.title;
    fullscreen.querySelector('[aria-hidden]').textContent = active ? '⤢' : '⛶';
    if (!active) window.scrollTo({ top: previousScroll });
  }
  fullscreen.addEventListener('click', async () => {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (viewportOnly) { viewportOnly = false; syncFullscreen(); return; }
    previousScroll = window.scrollY;
    // Fullscreen the document so existing dialogs, hand and context menus stay usable.
    try {
      if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen unavailable');
      await document.documentElement.requestFullscreen();
    } catch {
      // Browsers without native fullscreen still get an edge-to-edge battlefield.
      viewportOnly = true;
    }
    syncFullscreen();
  });
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && viewportOnly && !dialog.open && !document.body.classList.contains('hand-menu-open')) {
      viewportOnly = false;
      syncFullscreen();
    }
  });
  new MutationObserver(() => {
    if (document.querySelector('#view-play.active-view') && !document.querySelector('#match-layout').classList.contains('hidden')) return;
    if (dialog.open) dialog.close();
    if (!document.body.classList.contains('battlefield-expanded')) return;
    if (document.fullscreenElement) document.exitFullscreen();
    viewportOnly = false;
    syncFullscreen();
  }).observe(document.querySelector('#view-play'), { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
})();
