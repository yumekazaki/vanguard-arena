/* Presentation only: observes public card elements; never handles match actions. */
(() => {
  const panel = document.querySelector('.card-inspector');
  if (!panel) return;
  const content = document.querySelector('#inspector-content');
  const status = document.querySelector('#inspector-status');
  const unpin = document.querySelector('#inspector-unpin');
  let catalog = new Map(), currentId = null, pinned = false;
  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const number = value => value == null ? 'Unknown' : Number(value).toLocaleString();
  function updateStatus() {
    status.textContent = pinned ? 'Pinned card' : 'Live preview';
    unpin.hidden = !pinned;
  }
  function show(id, pin = false) {
    const card = catalog.get(id);
    if (!card || (pinned && !pin)) return;
    if (pin) pinned = true;
    updateStatus();
    if (currentId === id) return;
    currentId = id;
    const fragment = document.createDocumentFragment();
    if (card.image) {
      const image = document.createElement('img');
      image.src = card.image;
      image.alt = card.name;
      image.className = 'inspector-art';
      image.addEventListener('error', () => { image.replaceWith(text('p', 'Card image unavailable', 'inspector-image-fallback')); });
      fragment.append(image);
    } else fragment.append(text('div', card.glyph || '◇', 'inspector-image-fallback'));
    fragment.append(text('h2', card.name));
    fragment.append(text('p', [card.clan || card.nation, card.type, card.trigger && `${card.trigger} Trigger`].filter(Boolean).join(' · '), 'inspector-meta'));
    const stats = document.createElement('dl');
    stats.className = 'inspector-stats';
    for (const [label, value] of [['Grade', card.grade ?? '?'], ['Power', number(card.power)], ['Shield', number(card.shield)]]) {
      const group = document.createElement('div');
      group.append(text('dt', label), text('dd', value));
      stats.append(group);
    }
    fragment.append(stats, text('h3', 'Card text'), text('p', card.text || 'No card text provided by the source database.', 'inspector-rules'));
    fragment.append(text('p', `Database ${card.dbId ?? card.id} · ${card.source || 'Source not specified'}`, 'inspector-source'));
    content.replaceChildren(fragment);
    content.scrollTop = 0;
  }
  function cardId(target) {
    if (!(target instanceof Element) || target.closest('.card-inspector')) return null;
    const direct = target.closest('[data-card-id], [data-card-zoom], [data-card-detail]');
    if (direct) return direct.dataset.cardId || direct.dataset.cardZoom || direct.dataset.cardDetail;
    const wrapper = target.closest('.game-card-wrap, .zone-card-wrap, .zone-view-card');
    return wrapper?.querySelector('[data-card-zoom]')?.dataset.cardZoom;
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const id = cardId(event.target);
    if (id) show(id);
  });
  document.addEventListener('focusin', event => {
    const id = cardId(event.target);
    if (id) show(id);
  });
  // Capture the identity before the original click handlers re-render the board.
  // Do not prevent defaults or stop propagation: gameplay selection stays intact.
  document.addEventListener('click', event => {
    const id = cardId(event.target);
    if (id) show(id, true);
  }, true);
  unpin.addEventListener('click', () => { pinned = false; updateStatus(); });
  window.ArenaInspector = { setCatalog(cards) { catalog = new Map(cards.map(card => [card.id, card])); } };
})();
