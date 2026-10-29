/* Presentation only: observe card elements without intercepting their game actions. */
(() => {
  const panels = Array.from(document.querySelectorAll('.card-inspector')).map(panel => ({
    panel, content: panel.querySelector('.inspector-content'),
    status: panel.querySelector('[data-inspector-status], #inspector-status'),
    unpin: panel.querySelector('[data-inspector-unpin], #inspector-unpin'),
    currentId: null, pinned: false
  }));
  if (!panels.length) return;
  let catalog = new Map();
  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const number = value => value == null ? 'Unknown' : Number(value).toLocaleString();
  function updateStatus(state) {
    state.status.textContent = state.pinned ? 'Pinned card' : 'Live preview';
    state.unpin.hidden = !state.pinned;
  }
  function show(state, id, pin) {
    const card = catalog.get(id);
    if (!card || !state.panel.closest('.active-view') || (state.pinned && !pin)) return;
    if (pin) state.pinned = true;
    state.panel.classList.add('has-card');
    updateStatus(state);
    if (state.currentId === id) return;
    state.currentId = id;
    const fragment = document.createDocumentFragment();
    if (card.image) {
      const image = document.createElement('img');
      image.src = card.image;
      image.alt = card.name;
      image.className = 'inspector-art';
      image.addEventListener('error', () => image.replaceWith(text('p', 'Card image unavailable', 'inspector-image-fallback')));
      fragment.append(image);
    } else fragment.append(text('div', card.glyph || '◇', 'inspector-image-fallback'));
    const copy = document.createElement('div');
    copy.className = 'inspector-copy';
    copy.tabIndex = 0;
    copy.setAttribute('aria-label', 'Scrollable card information');
    copy.append(text('h2', card.name), text('p', [(card.clans || []).join(', ') || card.clan || card.nation, card.type, card.trigger && `${card.trigger} Trigger`].filter(Boolean).join(' · '), 'inspector-meta'));
    const stats = document.createElement('dl');
    stats.className = 'inspector-stats';
    for (const [label, value] of [['Grade', card.grade ?? '?'], ['Power', number(card.power)], ['Shield', number(card.shield)]]) {
      const group = document.createElement('div');
      group.append(text('dt', label), text('dd', value));
      stats.append(group);
    }
    copy.append(stats, text('h3', 'Card text'), text('p', card.text || 'No card text provided by the source database.', 'inspector-rules'));
    copy.append(text('p', `Database ${card.dbId ?? card.id} · ${card.source || 'Source not specified'}`, 'inspector-source'));
    fragment.append(copy);
    state.content.replaceChildren(fragment);
    state.content.scrollTop = 0;
  }
  function cardId(target) {
    if (!(target instanceof Element) || target.closest('.card-inspector')) return null;
    const direct = target.closest('[data-card-id], [data-card-zoom], [data-card-detail]');
    if (direct) return direct.dataset.cardId || direct.dataset.cardZoom || direct.dataset.cardDetail;
    return target.closest('.game-card-wrap, .zone-card-wrap, .zone-view-card')?.querySelector('[data-card-zoom]')?.dataset.cardZoom;
  }
  function inspect(event, pin = false) {
    const id = cardId(event.target);
    if (id) panels.forEach(state => show(state, id, pin));
  }
  document.addEventListener('pointerover', event => { if (event.pointerType !== 'touch') inspect(event); });
  document.addEventListener('focusin', event => inspect(event));
  // Keep identity before existing handlers re-render; do not prevent or stop their events.
  document.addEventListener('click', event => inspect(event, true), true);
  panels.forEach(state => {
    state.unpin.addEventListener('click', () => { state.pinned = false; updateStatus(state); });
    state.panel.querySelector('[data-inspector-close]')?.addEventListener('click', () => {
      state.pinned = false;
      updateStatus(state);
      state.panel.classList.remove('has-card');
    });
  });
  window.ArenaInspector = { setCatalog(cards) { catalog = new Map(cards.map(card => [card.id, card])); } };
})();
