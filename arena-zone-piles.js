/* Zone artwork and pile summaries only. No cards are moved between game zones. */
(() => {
  const back = 'assets/ui/vanguard-card-back.jpg';
  const observed = new Map();
  let sequence = 0, lastMatch = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'faceup-gdeck-dialog';
  dialog.className = 'help-dialog zone-view-dialog';
  dialog.innerHTML = '<p class="eyebrow">G-DECK · FACE UP</p><h2 id="faceup-gdeck-title">Face-up G-deck</h2><p>Click a card for its actions. Use the zoom icon to inspect it.</p><div id="faceup-gdeck-list" class="zone-card-list"></div><div class="empty-actions"><button class="button" type="button">Close</button></div>';
  dialog.querySelector('.empty-actions button').addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  for (const side of ['human','bot']) {
    const original = document.querySelector(`.gdeck-button[data-gdeck-side="${side}"]`);
    const frame = document.createElement('div');
    frame.className = 'gdeck-button gdeck-pile-frame';
    original.before(frame);
    frame.append(original);
    original.classList.add('gdeck-face-down');
    const up = document.createElement('button');
    up.className = 'gdeck-face-up';
    up.type = 'button';
    up.dataset.faceupSide = side;
    up.innerHTML = `<small>UP</small><b id="${side}-gdeck-up-count">0</b>`;
    up.setAttribute('aria-label', side === 'human' ? 'View your face-up G-deck' : 'View opponent face-up G-deck');
    frame.append(up);
    up.addEventListener('click', () => document.dispatchEvent(new CustomEvent('arena:faceup-gdeck', { detail:{side} })));
  }
  function faceUpCards(player) {
    return [...(player.gZone || []).filter(card => card.faceUp), ...(player.gDeck || []).filter(card => card.faceUp)].map(card => ({ card, source:(player.gZone || []).includes(card) ? 'gzone' : 'gdeck' }));
  }
  function artwork(node, url) {
    node.classList.toggle('zone-has-art', Boolean(url));
    node.style.setProperty('--zone-art', url ? `url(${JSON.stringify(url)})` : 'none');
  }
  window.VanguardZonePiles = {
    faceUpCards,
    render(match, cardImageUrl) {
      if (lastMatch !== match.matchId) { observed.clear(); sequence=0; lastMatch=match.matchId; }
      for (const side of ['human','bot']) {
        const player = match.players[side], line = document.querySelector(`.${side === 'human' ? 'human' : 'opponent'}-line`);
        artwork(line.querySelector('.deck-zone'), back);
        const latestDrop = player.drop?.at(-1);
        artwork(line.querySelector('.drop-zone'), latestDrop ? cardImageUrl(latestDrop.cardId) : null);
        const down = line.querySelector('[data-gdeck-side]'), up = line.querySelector('[data-faceup-side]'), standard = player.format === 'standard';
        down.parentElement.classList.toggle('is-ride-deck', standard);
        up.hidden = standard;
        artwork(down, back);
        down.querySelector('small').textContent = standard ? 'RIDE DECK' : 'DOWN';
        down.querySelector('b').textContent = standard ? (player.rideDeck || []).length : (player.gDeck || []).filter(card => !card.faceUp).length;
        const cards = faceUpCards(player), live = new Set(cards.map(({card}) => `${side}:${card.uid}`));
        for (const key of observed.keys()) if(key.startsWith(side+':') && !live.has(key))observed.delete(key);
        for (const {card} of cards) { const key=`${side}:${card.uid}`; if(!observed.has(key))observed.set(key,++sequence); }
        const latest = cards.slice().sort((a,b) => observed.get(`${side}:${b.card.uid}`)-observed.get(`${side}:${a.card.uid}`))[0]?.card;
        up.querySelector('b').textContent = cards.length;
        artwork(up, latest ? cardImageUrl(latest.cardId) : null);
      }
    }
  };
})();
