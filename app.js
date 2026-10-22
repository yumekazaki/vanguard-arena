(() => {
  const colors = ["#c797f4", "#79c9c0", "#f0a875", "#89a8f2", "#e886bc", "#a7ce77", "#e4cf7d", "#84c3e4"];
  const glyphs = ["✦", "✧", "◇", "❖", "⬡", "✺", "⌁", "❋"];
  const sampleCards = [];
  const ranks = ["Wayfinder", "Glimmer", "Trailkeeper", "Lantern", "Mistwalker", "Skyward", "Bramble", "Tidecaller", "Moonlit", "Ember", "Cloudstep", "Ironbloom"];
  const grades = [0, 1, 2, 3];
  for (let i = 0; i < 48; i++) {
    const grade = grades[i % 4];
    const trigger = grade === 0 && i % 7 === 0;
    const number = String(i + 1).padStart(3, "0");
    sampleCards.push({
      id: `demo-${number}`,
      name: `${ranks[i % ranks.length]} ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ""}`,
      grade,
      nation: ["Verdant Reach", "Cinder Vale", "Cloud Archive", "Dusk Harbor"][i % 4],
      power: [5000, 8000, 10000, 13000][grade] + (i % 3) * 500,
      shield: trigger ? 15000 : [10000, 5000, 5000, 0][grade],
      type: trigger ? "Trigger" : "Unit",
      trigger: trigger ? ["Draw", "Critical", "Heal", "Front"][i % 4] : "",
      text: trigger ? `Fictional ${["Draw", "Critical", "Heal", "Front"][i % 4]} demo trigger. This text is placeholder content.` : "Fictional sample card for prototype testing. No real Vanguard card text or effect is represented.",
      color: colors[i % colors.length],
      glyph: glyphs[i % glyphs.length],
      source: "Built-in fictional demo card",
      permission: "Original placeholder content"
    });
  }
  const userCards = Array.isArray(window.USER_CARDS) ? window.USER_CARDS.map((card, i) => ({ ...card, color: card.color || colors[i % colors.length], glyph: glyphs[i % glyphs.length], type: card.type || "Unit", trigger: card.trigger || "" })) : [];
  const importedCatalog = Array.isArray(window.CARD_CATALOG) ? window.CARD_CATALOG : [];
  const cardList = importedCatalog.length ? [...importedCatalog, ...userCards] : [...sampleCards, ...userCards];
  const cardMap = new Map(cardList.map((c) => [c.id, c]));
  const artIds = Array.isArray(window.CARD_ART_IDS) ? window.CARD_ART_IDS : [];
  const artPageSize = 60;
  let artPage = 0;
  let builderPage = 0;
  let libraryPage = 0;
  const cardPageSize = 48;
  const phases = ["Ride", "Main", "Battle", "End"];
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  let view = "play";
  let builder = { id: null, name: "Untitled deck", cards: {} };
  let selectedCard = null;
  let match = null;
  let selectedZone = null;
  let botTimer = null;
  let online = { role: null, peer: null, connection: null, roomId: null, applyingRemote: false, dialogMode: "host" };

  function readSavedDecks() {
    try { return JSON.parse(localStorage.getItem("vanguardArenaDecks") || "[]"); } catch { return []; }
  }
  function writeSavedDecks(decks) { localStorage.setItem("vanguardArenaDecks", JSON.stringify(decks)); updateDeckCount(); }
  function updateDeckCount() { $("#deck-count").textContent = readSavedDecks().length; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function cardImage(card, className = "card-image") {
    if (!card?.image) return `<span class="card-art-glyph">${escapeHtml(card?.glyph || "✦")}</span>`;
    return `<img class="${className}" src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')" /><span class="card-art-glyph hidden">${escapeHtml(card.glyph || "✦")}</span>`;
  }
  function cardNode(card, selected = false, count = null) {
    const gradeLabel = card.grade === null || card.grade === undefined ? "?" : escapeHtml(card.grade);
    return `<button class="game-card${selected ? " selected" : ""}" style="--card-accent:${escapeHtml(card.color || "#a39bff")}" data-card-id="${escapeHtml(card.id)}" aria-label="${escapeHtml(card.name)}, grade ${gradeLabel}">
      <span class="grade-chip">${gradeLabel}</span>${card.trigger ? `<span class="trigger-chip">${escapeHtml(card.trigger)}</span>` : ""}
      <span class="card-art">${cardImage(card)}</span><span class="card-copy"><span class="card-name">${escapeHtml(card.name)}</span><span class="card-subline"><span>G${escapeHtml(card.grade)} · ${escapeHtml(card.type)}</span><span>${count === null ? `${Math.round(card.power / 1000)}k` : `×${count}`}</span></span></span>
    </button>`;
  }
  function showView(next) {
    view = next;
    $$(".view").forEach((el) => el.classList.toggle("active-view", el.id === `view-${next}`));
    $$(".nav-button").forEach((el) => el.classList.toggle("active", el.dataset.view === next));
    if (next === "decks") { renderBuilder(); renderSavedDecks(); }
    if (next === "cards") renderLibrary();
    window.location.hash = next;
  }
  function emptyDeck() { builder = { id: null, name: "Untitled deck", cards: {} }; renderBuilder(); }
  function defaultDeck() {
    const cards = {};
    const pool = cardList.filter((c) => c.type === "Unit" || c.type === "Trigger");
    for (let i = 0; i < 50; i++) { const card = pool[(i * 7 + Math.floor(i / pool.length)) % pool.length]; cards[card.id] = (cards[card.id] || 0) + 1; }
    return { id: crypto.randomUUID?.() || String(Date.now()), name: "Demo Practice Deck", cards };
  }
  function deckCount(deck) { return Object.values(deck.cards || {}).reduce((a, b) => a + Number(b || 0), 0); }
  function deckSummary(deck) {
    const counts = [0, 0, 0, 0]; let triggers = 0;
    Object.entries(deck.cards || {}).forEach(([id, qty]) => { const c = cardMap.get(id); if (!c) return; const grade = Number(c.grade); if (Number.isFinite(grade) && grade >= 0) counts[Math.min(3, grade)] += qty; if (c.trigger) triggers += qty; });
    return { counts, triggers };
  }
  function renderBuilder() {
    $("#deck-name").value = builder.name || "";
    $("#builder-title").textContent = builder.name || "Untitled deck";
    const total = deckCount(builder); const { counts, triggers } = deckSummary(builder);
    $("#deck-total").textContent = total;
    $("#grade-breakdown").textContent = counts.join(" / ");
    $("#trigger-count").textContent = triggers;
    const validation = $("#deck-validation");
    if (!total) { validation.className = "deck-validation"; validation.textContent = "Add cards from the library to start building."; }
    else if (total !== 50) { validation.className = "deck-validation invalid"; validation.textContent = `${total}/50 main-deck cards. Premium format legality is not verified.`; }
    else { validation.className = "deck-validation valid"; validation.textContent = "50 main-deck cards · Premium format legality is not verified."; }
    const rows = Object.entries(builder.cards || {}).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ card: cardMap.get(id), qty })).filter((x) => x.card).sort((a, b) => a.card.grade - b.card.grade || a.card.name.localeCompare(b.card.name));
    $("#deck-list").innerHTML = rows.length ? rows.map(({ card, qty }) => `<div class="deck-row"><img src="${escapeHtml(card.image || "")}" onerror="this.style.display='none'" alt=""/><span class="row-grade">${card.grade === null || card.grade === undefined ? "G?" : `G${escapeHtml(card.grade)}`}</span><span class="row-title">${escapeHtml(card.name)}<small>${escapeHtml(card.clan || card.nation || "Clan not listed")} · ${escapeHtml(card.type)}${card.trigger ? ` · ${escapeHtml(card.trigger)}` : ""}</small></span><span class="qty-controls"><button data-qty="-1" data-id="${escapeHtml(card.id)}">−</button>${qty}<button data-qty="1" data-id="${escapeHtml(card.id)}">+</button><button class="remove-row" data-remove="${escapeHtml(card.id)}" title="Remove">×</button></span></div>`).join("") : `<div class="empty-saved">Your deck is empty. Choose cards from the library.</div>`;
    renderBuilderCards();
  }
  function renderBuilderCards() {
    const term = $("#card-search").value.trim().toLowerCase(); const grade = $("#grade-filter").value; const clan = $("#builder-clan-filter").value;
    const filtered = cardList.filter((c) => gradeMatches(c, grade) && clanMatches(c, clan) && (!term || `${c.name} ${c.id} ${c.dbId || ""} ${c.clan || ""} ${c.nation || ""} ${c.type}`.toLowerCase().includes(term)));
    const pages = Math.max(1, Math.ceil(filtered.length / cardPageSize)); builderPage = Math.min(builderPage, pages - 1);
    const visible = filtered.slice(builderPage * cardPageSize, (builderPage + 1) * cardPageSize);
    $("#builder-results-count").textContent = `${filtered.length.toLocaleString()} cards`;
    $("#builder-page-label").textContent = `${builderPage + 1} / ${pages}`;
    $("#builder-prev").disabled = builderPage === 0; $("#builder-next").disabled = builderPage >= pages - 1;
    $("#builder-card-grid").innerHTML = visible.map((c) => cardNode(c, false, builder.cards[c.id] || 0)).join("") || `<div class="empty-saved">No cards found.</div>`;
  }
  function gradeMatches(card, selected) {
    if (selected === "all") return true;
    if (selected === "unknown") return card.grade === null || card.grade === undefined;
    const grade = Number(card.grade);
    if (!Number.isFinite(grade)) return false;
    if (selected === "5+") return grade >= 5;
    return grade === Number(selected);
  }
  function clanMatches(card, selected) {
    if (selected === "all") return true;
    if (selected === "unknown") return !(card.clans || (card.clan ? [card.clan] : [])).length;
    return (card.clans || []).includes(selected) || card.clan === selected;
  }
  function populateClanFilters() {
    const clans = [...new Set(cardList.flatMap((c) => c.clans?.length ? c.clans : c.clan ? [c.clan] : []))].sort((a,b) => a.localeCompare(b));
    ["#builder-clan-filter", "#library-clan"].forEach((selector) => {
      const select = $(selector); if (!select) return;
      select.innerHTML = `<option value="all">All clans</option>${clans.map((clan) => `<option value="${escapeHtml(clan)}">${escapeHtml(clan)}</option>`).join("")}<option value="unknown">No clan listed</option>`;
    });
  }
  function saveDeck() {
    const name = $("#deck-name").value.trim() || "Untitled deck"; const existing = readSavedDecks();
    const id = builder.id || (crypto.randomUUID?.() || String(Date.now()));
    const saved = { id, name, cards: { ...builder.cards }, updatedAt: new Date().toISOString() };
    const index = existing.findIndex((d) => d.id === id);
    if (index >= 0) existing[index] = saved; else existing.unshift(saved);
    builder = { ...saved }; writeSavedDecks(existing); renderBuilder(); renderSavedDecks();
    toast("Deck saved in this browser");
  }
  function loadDeck(deck) { builder = { id: deck.id, name: deck.name, cards: { ...deck.cards } }; renderBuilder(); showView("decks"); toast(`Loaded “${deck.name}” into the builder`); }
  function renderSavedDecks() {
    const decks = readSavedDecks(); $("#saved-deck-subtitle").textContent = decks.length ? `${decks.length} deck${decks.length === 1 ? "" : "s"}` : "No decks yet";
    $("#saved-decks").innerHTML = decks.length ? decks.map((d) => { const s = deckSummary(d); const preview = Object.keys(d.cards || {}).slice(0, 5).map((id) => cardMap.get(id)).filter(Boolean); return `<article class="saved-deck-card"><h3>${escapeHtml(d.name)}</h3><div class="saved-deck-meta">${deckCount(d)} cards · G${s.counts.join(" / ")} · ${escapeHtml(new Date(d.updatedAt || Date.now()).toLocaleDateString())}</div><div style="display:flex;gap:4px;margin-bottom:12px">${preview.map((c) => `<span title="${escapeHtml(c.name)}" style="width:27px;height:36px;border-radius:4px;border:1px solid #fff2;background:${c.color};display:grid;place-items:center;overflow:hidden">${c.image ? `<img src="${escapeHtml(c.image)}" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()"/>` : c.glyph}</span>`).join("")}</div><div class="saved-deck-actions"><button class="button button-primary" data-load-deck="${escapeHtml(d.id)}">Open</button><button class="button" data-duplicate-deck="${escapeHtml(d.id)}">Duplicate</button><button class="button" data-export-saved="${escapeHtml(d.id)}">Export</button><button class="button" data-delete-deck="${escapeHtml(d.id)}" title="Delete">×</button></div></article>`; }).join("") : `<div class="empty-saved">Saved decks appear here. Build a deck and choose Save deck.</div>`;
    updateDeckCount();
  }
  function renderLibrary() {
    const term = $("#library-search").value.trim().toLowerCase(); const grade = $("#library-grade").value; const clan = $("#library-clan").value;
    const filtered = cardList.filter((c) => gradeMatches(c, grade) && clanMatches(c, clan) && (!term || `${c.name} ${c.id} ${c.dbId || ""} ${c.clan || ""} ${c.nation || ""} ${c.type}`.toLowerCase().includes(term)));
    const pages = Math.max(1, Math.ceil(filtered.length / cardPageSize)); libraryPage = Math.min(libraryPage, pages - 1);
    const visible = filtered.slice(libraryPage * cardPageSize, (libraryPage + 1) * cardPageSize);
    $("#library-count").textContent = `${filtered.length.toLocaleString()} cards · ${importedCatalog.length.toLocaleString()} matched to your images`;
    $("#library-page-label").textContent = `${libraryPage + 1} / ${pages}`;
    $("#library-prev").disabled = libraryPage === 0; $("#library-next").disabled = libraryPage >= pages - 1;
    $("#library-grid").innerHTML = visible.map((c) => `<article class="library-card" data-card-detail="${escapeHtml(c.id)}"><div class="library-art">${cardImage(c)}<span class="grade-chip">${c.grade === null || c.grade === undefined ? "G?" : `G${escapeHtml(c.grade)}`}</span></div><div class="library-card-copy"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.clan || c.nation || "Clan not listed")} · ${escapeHtml(c.type)}${c.trigger ? ` · ${escapeHtml(c.trigger)}` : ""}</span></div></article>`).join("") || `<div class="empty-saved">No matching cards.</div>`;
  }
  function renderArtGallery() {
    const input = $("#art-search");
    if (!input) return;
    const term = input.value.trim().replace(/^n/i, "");
    const filtered = term ? artIds.filter((id) => String(id).includes(term)) : artIds;
    const pages = Math.max(1, Math.ceil(filtered.length / artPageSize));
    artPage = Math.min(artPage, pages - 1);
    const pageItems = filtered.slice(artPage * artPageSize, (artPage + 1) * artPageSize);
    $("#art-count").textContent = `${filtered.length.toLocaleString()} images`;
    $("#art-page").textContent = `${artPage + 1} / ${pages}`;
    $("#art-prev").disabled = artPage === 0;
    $("#art-next").disabled = artPage >= pages - 1;
    $("#art-grid").innerHTML = pageItems.map((id) => `<button class="art-tile" data-art-id="${id}" title="Open image n${id}"><img loading="lazy" src="assets/cards/mini/n${id}.jpg" alt="Card image n${id}"><span>n${id}</span></button>`).join("") || `<div class="empty-saved">No image numbers match.</div>`;
  }
  function showArtImage(id) {
    if (!artIds.includes(id)) return;
    $("#card-dialog-content").innerHTML = `<div class="art-dialog"><img src="assets/cards/full/n${id}.jpg" alt="Card image n${id}" onerror="this.onerror=null;this.src='assets/cards/mini/n${id}.jpg'"><p>Image file <b>n${id}.jpg</b> · Card name and rules not matched</p></div>`;
    $("#card-dialog").showModal();
  }
  function showCardDetails(id) {
    const card = cardMap.get(id); if (!card) return;
    $("#card-dialog-content").innerHTML = `<div class="dialog-card-layout"><div class="dialog-card-art">${cardImage(card)}</div><div class="dialog-card-info"><p class="eyebrow">${card.id.startsWith("demo-") ? "FICTIONAL DEMO CARD" : "CARD DETAILS"}</p><h2>${escapeHtml(card.name)}</h2><div class="dialog-card-stats">Grade ${card.grade === null || card.grade === undefined ? "not listed" : escapeHtml(card.grade)}<br>${escapeHtml(card.type)}${card.trigger ? ` · ${escapeHtml(card.trigger)}` : ""}<br>${escapeHtml((card.clans || []).join(", ") || card.clan || card.nation || "Clan not listed")}<br>Power ${escapeHtml(card.power || 0).toLocaleString()} · Shield ${escapeHtml(card.shield || 0).toLocaleString()}<br>Card database number ${escapeHtml(card.dbId ?? card.id)}</div><p>${escapeHtml(card.text || "No card text provided by the source database.")}</p><p>Data source: ${escapeHtml(card.source || "Not specified")}</p></div></div>`;
    $("#card-dialog").showModal();
  }
  function cardInstances(deck) {
    const list = [];
    Object.entries(deck.cards || {}).forEach(([id, qty]) => { for (let i = 0; i < qty; i++) list.push({ uid: `${id}-${Math.random().toString(36).slice(2, 9)}`, cardId: id }); });
    return list;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function makePlayer(deck, name, human = false) {
    const pile = shuffle(cardInstances(deck)); return { name, deck: pile.slice(5), hand: pile.slice(0, 5), damage: [], drop: [], soul: [], vanguard: null, rear: [null, null], human };
  }
  function startMatch(deck = null) {
    const chosen = deck || (builder.cards && deckCount(builder) ? builder : null);
    const readyDeck = chosen && deckCount(chosen) ? chosen : defaultDeck();
    match = { players: { human: makePlayer(readyDeck, "Player", true), bot: makePlayer(defaultDeck(), "Practice Bot") }, turn: 1, side: "human", phase: 0, selected: null, pendingAttack: null, botAttacks: [], log: [], ended: false, deckName: readyDeck.name };
    selectedCard = null; selectedZone = null;
    $("#match-layout").classList.remove("hidden"); $("#match-empty").classList.add("hidden");
    addLog(`${online.role ? "Online match" : "Practice match"} started with ${readyDeck.name}.`); setMessage("Your turn — ride a unit or advance the phase."); renderMatch(); showView("play");
  }
  function addLog(message) { if (!match) return; match.log.unshift({ time: new Date(), message }); match.log = match.log.slice(0, 15); renderLog(); }
  function renderLog() { if (!match) return; $("#match-log").innerHTML = match.log.map((entry) => `<div class="log-entry"><time>${entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>${escapeHtml(entry.message)}</span></div>`).join(""); }
  function setMessage(message) { $("#table-message").textContent = message; }
  function renderMatch() {
    if (!match) return;
    const you = match.players.human, bot = match.players.bot;
    $("#human-name").textContent = you.name; $("#table-human-name").textContent = you.name;
    $("#opponent-name").textContent = bot.name; $("#table-opponent-name").textContent = bot.name;
    $("#match-status").textContent = online.role ? "ONLINE MATCH" : "PRACTICE MATCH";
    $("#opponent-deck-label").textContent = online.role ? "OPPONENT" : "DEMO DECK";
    $("#turn-label").textContent = match.side === "human" ? "YOUR TURN" : "OPPONENT TURN";
    $("#phase-label").textContent = match.side === "human" ? `${phases[match.phase]} phase` : "Practice Bot";
    $("#turn-number").textContent = String(match.turn).padStart(2, "0"); $("#table-turn").textContent = String(match.turn).padStart(2, "0");
    $("#phase-count").textContent = `${match.phase + 1} / ${phases.length}`;
    $("#phase-list").innerHTML = phases.map((p, i) => `<div class="phase-item${i === match.phase ? " active" : ""}${i < match.phase ? " past" : ""}"><span class="phase-bullet">${i < match.phase ? "✓" : i + 1}</span>${p} phase</div>`).join("");
    $$(".phase-segment").forEach((el, i) => { el.classList.toggle("done", i < match.phase); el.classList.toggle("current", i === match.phase); });
    $("#human-deck-count").textContent = you.deck.length; $("#bot-deck-count").textContent = bot.deck.length; $("#human-drop-count").textContent = you.drop.length;
    $("#human-damage").innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="damage-heart${i < you.damage.length ? " filled" : ""}"></span>`).join("");
    $("#bot-damage").innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="damage-heart${i < bot.damage.length ? " filled" : ""}"></span>`).join("");
    $("#bot-hand-count").textContent = `${bot.hand.length} CARDS`;
    $("#bot-hand").innerHTML = Array.from({ length: Math.min(8, bot.hand.length) }, () => `<span class="mini-back"></span>`).join("");
    renderZone("human", "vanguard", you.vanguard); renderZone("bot", "vanguard", bot.vanguard);
    renderZone("human", "rear-left", you.rear[0]); renderZone("human", "rear-right", you.rear[1]);
    renderZone("bot", "rear-left", bot.rear[0]); renderZone("bot", "rear-right", bot.rear[1]);
    $("#soul-pips").innerHTML = you.soul.slice(0, 7).map(() => `<span class="soul-pip"></span>`).join("");
    $("#hand-count").textContent = `${you.hand.length} card${you.hand.length === 1 ? "" : "s"}`;
    $("#hand-cards").innerHTML = you.hand.map((instance, i) => { const c = cardMap.get(instance.cardId); return c ? cardNode(c, match.selected === instance.uid).replace('data-card-id=', `data-hand-uid="${instance.uid}" data-hand-index="${i}" data-card-id=`) : ""; }).join("");
    updateActionAvailability(); renderLog();
    if (online.role === "host" && online.connection?.open && !online.applyingRemote) sendOnlineSnapshot();
  }
  function renderZone(side, zone, instance) {
    const el = $(`.field-zone[data-side="${side}"][data-zone="${zone}"]`); if (!el) return;
    el.innerHTML = `<span>${zone === "vanguard" ? "VANGUARD" : "REAR-GUARD"}</span>`;
    if (!instance) return;
    const c = cardMap.get(instance.cardId); if (!c) return;
    const field = document.createElement("div"); field.className = `field-card${match.selected === instance.uid ? " selected" : ""}${instance.rested ? " rested" : ""}`; field.dataset.fieldUid = instance.uid; field.dataset.side = side; field.dataset.zone = zone; field.style.borderColor = `${c.color}88`; field.innerHTML = `<span class="mini-grade">G${c.grade}</span><span class="field-card-name">${escapeHtml(c.name)}</span><span class="field-card-stats"><b>${Math.round(c.power / 1000)}k</b><span>${escapeHtml(c.trigger || "UNIT")}</span></span>`;
    if (c.image) { field.style.backgroundImage = `linear-gradient(#1118,#111c),url("${String(c.image).replace(/["\\]/g, "")}")`; field.style.backgroundSize = "cover"; }
    el.appendChild(field);
  }
  function updateActionAvailability() {
    if (!match) return;
    const humanTurn = match.side === "human" && !match.ended;
    const handCard = match.players.human.hand.find((x) => x.uid === match.selected);
    const fieldCard = findFieldCard(match.selected);
    const pending = Boolean(match.pendingAttack);
    $("#draw-card").disabled = !humanTurn || pending || match.players.human.deck.length === 0;
    $("#ride-card").disabled = !humanTurn || pending || match.phase !== 0 || !handCard;
    $("#call-card").disabled = !humanTurn || pending || match.phase !== 1 || !handCard || !match.players.human.rear.includes(null);
    $("#attack-card").disabled = !humanTurn || pending || match.phase !== 2 || !fieldCard || fieldCard.instance.rested;
    $("#guard-card").disabled = !pending || match.side === "human" || match.players.human.hand.length === 0;
    $("#end-turn").disabled = !humanTurn || pending;
    $("#advance-phase").disabled = !humanTurn || pending;
    $("#advance-phase").innerHTML = match.phase === phases.length - 1 ? `End turn <span>→</span>` : `Continue ${phases[match.phase + 1].toLowerCase()} phase <span>→</span>`;
    if (match.selected) {
      const cardId = handCard?.cardId || fieldCard?.instance.cardId; const c = cardMap.get(cardId);
      $("#selection-hint").textContent = c ? `${c.name} · G${c.grade}` : "Selected";
      $("#selected-summary").innerHTML = c ? `<span class="selected-card-icon">${escapeHtml(c.glyph || "✦")}</span><span><b>${escapeHtml(c.name)}</b><small>Grade ${c.grade} · ${escapeHtml(c.type)} · ${Math.round(c.power / 1000)}k power</small></span>` : `<span class="selected-card-icon">✦</span><span><b>Card selected</b><small>Choose an action</small></span>`;
    } else {
      $("#selection-hint").textContent = pending ? "Opponent attacking — choose Guard or No guard" : "Select a card to see actions";
      $("#selected-summary").innerHTML = `<span class="selected-card-icon">✦</span><span><b>${pending ? "Attack incoming" : "No card selected"}</b><small>${pending ? "Use Guard or No guard" : "Choose a card from your hand or field"}</small></span>`;
    }
    const noGuard = $("#no-guard"); if (noGuard) noGuard.classList.toggle("hidden", !pending || match.side === "human");
  }
  function findFieldCard(uid) {
    if (!uid || !match) return null;
    for (const side of ["human", "bot"]) { const p = match.players[side]; if (p.vanguard?.uid === uid) return { side, zone: "vanguard", instance: p.vanguard }; const i = p.rear.findIndex((x) => x?.uid === uid); if (i >= 0) return { side, zone: i === 0 ? "rear-left" : "rear-right", index: i, instance: p.rear[i] }; }
    return null;
  }
  function selectedHandCard() { return match?.players.human.hand.find((x) => x.uid === match.selected); }
  function draw(side) {
    const p = match.players[side]; if (!p.deck.length) return null;
    const card = p.deck.pop(); p.hand.push(card); return card;
  }
  function drawForHuman() {
    if (!match || match.side !== "human" || match.pendingAttack) return;
    const card = draw("human"); if (!card) { setMessage("Your deck is empty."); return; }
    addLog("You drew a card."); setMessage("Card drawn."); renderMatch();
  }
  function rideHuman() {
    const instance = selectedHandCard(); if (!instance || match.phase !== 0) return;
    const p = match.players.human; p.hand = p.hand.filter((x) => x.uid !== instance.uid); if (p.vanguard) p.soul.push(p.vanguard); p.vanguard = { ...instance, rested: false };
    match.selected = null; addLog(`You rode ${cardMap.get(instance.cardId)?.name || "a card"}.`); setMessage("Ride complete."); renderMatch();
  }
  function callHuman() {
    const instance = selectedHandCard(); if (!instance || match.phase !== 1) return;
    const p = match.players.human; const empty = p.rear.indexOf(null); if (empty < 0) return;
    p.hand = p.hand.filter((x) => x.uid !== instance.uid); p.rear[empty] = { ...instance, rested: false }; match.selected = null;
    addLog(`You called ${cardMap.get(instance.cardId)?.name || "a card"} to the rear-guard circle.`); setMessage("Unit called."); renderMatch();
  }
  function attackerPower(entry) { return Number(cardMap.get(entry.instance.cardId)?.power || 0); }
  function resolveHumanAttack() {
    const field = findFieldCard(match.selected); if (!field || field.side !== "human" || field.instance.rested || match.phase !== 2 || !match.players.bot.vanguard) return;
    field.instance.rested = true;
    const attackPower = attackerPower(field); const defenderPower = Number(cardMap.get(match.players.bot.vanguard.cardId)?.power || 0);
    if (online.role) {
      match.pendingAttack = { attacker: cardMap.get(field.instance.cardId)?.name || "unit", power: attackPower, targetPower: defenderPower };
      match.selected = null; addLog(`${match.pendingAttack.attacker} attacked ${match.players.bot.name}'s vanguard.`); setMessage(`${match.players.bot.name} is defending — guard or take the hit.`); renderMatch(); return;
    }
    const candidates = match.players.bot.hand.map((x) => ({ x, shield: Number(cardMap.get(x.cardId)?.shield || 0) })).sort((a, b) => b.shield - a.shield);
    let guarded = false;
    if (candidates[0]?.shield > Math.max(0, attackPower - defenderPower) && Math.random() < 0.28) { match.players.bot.hand = match.players.bot.hand.filter((x) => x.uid !== candidates[0].x.uid); match.players.bot.drop.push(candidates[0].x); guarded = true; }
    addLog(`You attacked the opposing vanguard${guarded ? "; the bot guarded." : "."}`);
    if (!guarded && attackPower >= defenderPower) dealDamage("bot");
    match.selected = null; renderMatch();
  }
  function dealDamage(side) {
    const p = match.players[side]; const top = p.deck.pop(); if (top) p.damage.push(top);
    addLog(`${side === "human" ? "You" : "Practice Bot"} took 1 damage (${p.damage.length}/6).`);
    if (p.damage.length >= 6) { match.ended = true; addLog(side === "human" ? "Practice Bot wins the demo match." : "You win the demo match!"); setMessage(side === "human" ? "Practice Bot wins — start a new match to play again." : "You win! Start a new match to play again."); }
  }
  function humanGuard() {
    if (!match?.pendingAttack) return;
    let instance = selectedHandCard();
    if (!instance && match.players.human.hand.length) instance = match.players.human.hand.slice().sort((a, b) => Number(cardMap.get(b.cardId)?.shield || 0) - Number(cardMap.get(a.cardId)?.shield || 0))[0];
    if (!instance) return noGuard();
    match.players.human.hand = match.players.human.hand.filter((x) => x.uid !== instance.uid); match.players.human.drop.push(instance);
    addLog(`${match.players.human.name} guarded with ${cardMap.get(instance.cardId)?.name || "a card"}.`); match.pendingAttack = null; match.selected = null; renderMatch();
    if (!online.role) setTimeout(nextBotAttack, 450);
  }
  function noGuard() {
    if (!match?.pendingAttack) return;
    const attack = match.pendingAttack; addLog(`${match.players.human.name} did not guard ${attack.attacker} — taking 1 damage.`); dealDamage("human"); match.pendingAttack = null; match.selected = null; renderMatch();
    if (!online.role && !match.ended) setTimeout(nextBotAttack, 450);
  }
  function botTurn() {
    if (!match || match.ended) return;
    match.side = "bot"; match.phase = 0; match.players.bot.vanguard && (match.players.bot.vanguard.rested = false); match.players.bot.rear.forEach((x) => x && (x.rested = false));
    const card = draw("bot"); if (card) addLog("Practice Bot drew a card.");
    renderMatch(); setMessage("Practice Bot is taking its turn…");
    botTimer = setTimeout(() => {
      const bot = match.players.bot;
      const ride = bot.hand.map((x) => ({ x, c: cardMap.get(x.cardId) })).sort((a, b) => (b.c?.grade || 0) - (a.c?.grade || 0))[0];
      if (ride) { bot.hand = bot.hand.filter((x) => x.uid !== ride.x.uid); if (bot.vanguard) bot.soul.push(bot.vanguard); bot.vanguard = { ...ride.x, rested: false }; addLog(`Practice Bot rode ${ride.c.name}.`); }
      let calls = 0;
      while (bot.rear.includes(null) && calls < 2) { const unit = bot.hand.find((x) => cardMap.get(x.cardId)?.type !== "Trigger"); if (!unit) break; bot.hand = bot.hand.filter((x) => x.uid !== unit.uid); bot.rear[bot.rear.indexOf(null)] = { ...unit, rested: false }; addLog(`Practice Bot called ${cardMap.get(unit.cardId)?.name}.`); calls++; }
      renderMatch(); setMessage("Practice Bot is attacking…");
      const attackers = [bot.vanguard, ...bot.rear].filter((x) => x && !x.rested);
      match.botAttacks = attackers.map((x) => x.uid);
      setTimeout(nextBotAttack, 550);
    }, 750);
  }
  function nextBotAttack() {
    if (!match || match.ended || match.side !== "bot" || match.pendingAttack) return;
    const bot = match.players.bot; const uid = match.botAttacks.shift();
    if (!uid) { finishBotTurn(); return; }
    const attacker = [bot.vanguard, ...bot.rear].find((x) => x?.uid === uid); if (!attacker) { nextBotAttack(); return; }
    attacker.rested = true; const c = cardMap.get(attacker.cardId); const target = match.players.human.vanguard; const targetPower = target ? Number(cardMap.get(target.cardId)?.power || 0) : 0;
    match.pendingAttack = { attacker: c?.name || "unit", power: Number(c?.power || 0), targetPower };
    match.selected = null; setMessage(`Practice Bot attacks with ${c?.name || "a unit"}. Guard or take the hit.`); renderMatch();
  }
  function finishBotTurn() {
    if (!match || match.ended) return;
    match.players.human.vanguard && (match.players.human.vanguard.rested = false); match.players.human.rear.forEach((x) => x && (x.rested = false));
    match.side = "human"; match.phase = 0; match.pendingAttack = null; match.selected = null; match.turn += 1; const drawn = draw("human");
    if (drawn) addLog("Your turn began — you drew a card.");
    setMessage("Your turn — ride, build your field, and attack."); renderMatch();
  }
  function endTurn() {
    if (!match || match.side !== "human" || match.pendingAttack || match.ended) return;
    if (online.role) {
      addLog(`${match.players.human.name} ended their turn.`); match.selected = null;
      match.players.human.vanguard && (match.players.human.vanguard.rested = false); match.players.human.rear.forEach((x) => x && (x.rested = false));
      match.side = "bot"; match.phase = 0; const drawn = draw("bot"); if (drawn) addLog(`${match.players.bot.name}'s turn began — they drew a card.`);
      setMessage(`${match.players.bot.name}'s turn.`); renderMatch(); return;
    }
    addLog("You ended your turn."); match.selected = null; renderMatch(); botTurn();
  }
  function advancePhase() {
    if (!match || match.side !== "human" || match.pendingAttack || match.ended) return;
    if (match.phase >= phases.length - 1) { endTurn(); return; }
    match.phase += 1; match.selected = null; setMessage(`${phases[match.phase]} phase.`); addLog(`You entered ${phases[match.phase].toLowerCase()} phase.`); renderMatch();
  }
  function flipSide(side) { return side === "human" ? "bot" : side === "bot" ? "human" : side; }
  function onlineDeck() {
    if (builder.cards && deckCount(builder)) return { name: builder.name || "My Deck", cards: { ...builder.cards } };
    return defaultDeck();
  }
  function setOnlineError(message = "") { $("#online-error").textContent = message; }
  function setConnectionPill(label) { $("#connection-pill").innerHTML = `<i></i> ${escapeHtml(label)}`; }
  function openOnlineDialog(mode, invite = "") {
    online.dialogMode = mode;
    $("#online-dialog-title").textContent = mode === "host" ? "Host an online match" : "Join an online match";
    $("#online-dialog-copy").textContent = mode === "host" ? "Create a link and send it to your friend. Keep this page open while you play." : "Paste the invite link or room code your friend sent you.";
    $("#online-confirm").textContent = mode === "host" ? "Create invite" : "Join match";
    $("#join-code-wrap").classList.toggle("hidden", mode !== "join");
    $("#online-name").value = localStorage.getItem("vanguardArenaPlayerName") || "Player";
    $("#join-code").value = invite;
    setOnlineError("");
    $("#online-dialog").showModal();
  }
  function onlinePeerError(error) {
    const message = error?.type === "peer-unavailable" ? "That invite is no longer active. Ask your friend to create a new one." : `Online connection error: ${error?.message || error?.type || "please try again"}`;
    setOnlineError(message); toast(message);
  }
  function getInviteId(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try { const url = new URL(text); return url.searchParams.get("join") || ""; } catch { return text; }
  }
  function sanitizedDeck(deck) {
    const cards = {};
    Object.entries(deck?.cards || {}).forEach(([id, qty]) => { if (cardMap.has(id)) cards[id] = Math.max(0, Math.min(4, Number(qty) || 0)); });
    return { name: String(deck?.name || "Online Deck").slice(0, 40), cards };
  }
  function revealLocalMatch() { if (!match) return; $("#match-layout").classList.remove("hidden"); $("#match-empty").classList.add("hidden"); showView("play"); }
  function snapshotForGuest() {
    const snapshot = JSON.parse(JSON.stringify(match));
    snapshot.players = { human: snapshot.players.bot, bot: snapshot.players.human };
    snapshot.side = flipSide(snapshot.side);
    const visibleIds = new Set(snapshot.players.human.hand.map((card) => card.uid));
    [snapshot.players.human.vanguard, ...snapshot.players.human.rear].filter(Boolean).forEach((card) => visibleIds.add(card.uid));
    if (!visibleIds.has(snapshot.selected)) snapshot.selected = null;
    snapshot.players.bot.hand = snapshot.players.bot.hand.map((_, i) => ({ uid: `hidden-${i}`, cardId: null }));
    return snapshot;
  }
  function sendOnlineSnapshot() {
    if (online.role !== "host" || !online.connection?.open || !match) return;
    try { online.connection.send({ type: "state", match: snapshotForGuest() }); } catch { setOnlineError("Unable to send the latest match state. Reconnect and try again."); }
  }
  function updateGuestState(snapshot) {
    if (!snapshot) return;
    match = snapshot;
    match.log = (match.log || []).map((entry) => ({ ...entry, time: new Date(entry.time) }));
    selectedCard = null; selectedZone = null;
    if (match.players?.human) match.players.human.name = online.localName || match.players.human.name;
    revealLocalMatch(); renderMatch();
  }
  function handleRemoteMessage(message) {
    if (!message || typeof message !== "object") return;
    if (online.role === "host" && message.type === "join") {
      if (!match) startMatch(onlineDeck());
      const deck = sanitizedDeck(message.deck);
      const playerName = String(message.name || "Opponent").slice(0, 24);
      match.players.bot = makePlayer(deck.cards && deckCount(deck) ? deck : defaultDeck(), playerName);
      match.deckName = builder.name || "Online match";
      addLog(`${playerName} joined with ${deck.name}.`); setMessage("Opponent connected — your turn."); renderMatch();
      return;
    }
    if (online.role === "guest" && message.type === "state") { updateGuestState(message.match); return; }
    if (online.role !== "host" || !match || !["action", "select"].includes(message.type)) return;
    const players = match.players;
    match.players = { human: players.bot, bot: players.human };
    match.side = flipSide(match.side);
    match.selected = message.selected || null;
    online.applyingRemote = true;
    try {
      if (message.type === "select") renderMatch();
      else ({ draw: drawForHuman, ride: rideHuman, call: callHuman, attack: resolveHumanAttack, guard: humanGuard, noGuard, endTurn, advance: advancePhase }[message.action] || (() => {}))();
    } finally {
      match.players = players;
      match.side = flipSide(match.side);
      online.applyingRemote = false;
    }
    renderMatch();
  }
  function bindOnlineConnection(connection, role) {
    online.connection = connection;
    connection.on("open", () => {
      if (role === "guest") connection.send({ type: "join", name: online.localName, deck: onlineDeck() });
      else { setMessage("Opponent connected — waiting for their deck."); sendOnlineSnapshot(); }
      $("#match-status").textContent = "ONLINE · CONNECTED"; setConnectionPill("CONNECTED");
    });
    connection.on("data", handleRemoteMessage);
    connection.on("close", () => { $("#match-status").textContent = "ONLINE · DISCONNECTED"; setConnectionPill("DISCONNECTED"); toast("Friend disconnected. The match is still on this device."); });
    connection.on("error", onlinePeerError);
  }
  function beginHosting() {
    if (!window.Peer) { setOnlineError("The online connection library did not load. Check your internet connection and reload."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    online.role = "host"; setConnectionPill("CONNECTING"); online.peer = new Peer();
    online.peer.on("open", (id) => {
      online.roomId = id; $("#online-dialog").close(); startMatch(onlineDeck());
      match.players.human.name = online.localName; $("#online-invite").classList.remove("hidden");
      const invite = new URL(location.href); invite.searchParams.set("join", id); invite.hash = "play"; $("#invite-link").value = invite.toString();
      setConnectionPill("WAITING"); setMessage("Invite link ready — waiting for your friend to join."); renderMatch();
    });
    online.peer.on("connection", (connection) => {
      if (online.connection?.open) { connection.close(); return; }
      bindOnlineConnection(connection, "host");
    });
    online.peer.on("error", onlinePeerError);
  }
  function beginJoining() {
    const roomId = getInviteId($("#join-code").value);
    if (!roomId) { setOnlineError("Paste a valid invite link or room code."); return; }
    if (!window.Peer) { setOnlineError("The online connection library did not load. Check your internet connection and reload."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    online.role = "guest"; online.roomId = roomId; setConnectionPill("CONNECTING"); online.peer = new Peer();
    online.peer.on("open", () => bindOnlineConnection(online.peer.connect(roomId, { reliable: true }), "guest"));
    online.peer.on("error", onlinePeerError);
    $("#online-dialog").close(); setMessage("Connecting to your friend's match…");
  }
  function endOnlineSession() {
    try { online.connection?.close(); online.peer?.destroy(); } catch {}
    online = { role: null, peer: null, connection: null, roomId: null, applyingRemote: false, dialogMode: "host" };
    setConnectionPill("READY");
    $("#online-invite").classList.add("hidden");
  }
  function performOnlineAction(action) {
    if (online.role === "guest") {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      online.connection.send({ type: "action", action, selected: match?.selected || null }); return;
    }
    ({ draw: drawForHuman, ride: rideHuman, call: callHuman, attack: resolveHumanAttack, guard: humanGuard, noGuard, endTurn, advance: advancePhase }[action] || (() => {}))();
  }
  function exportDeck(deck, filename) {
    const content = JSON.stringify({ format: "Vanguard Arena local demo deck", name: deck.name, cards: deck.cards, exportedAt: new Date().toISOString() }, null, 2);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "application/json" })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importDeckFile(file) {
    const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); const cards = data.cards || data; if (!cards || typeof cards !== "object") throw new Error("Invalid deck format"); builder = { id: null, name: data.name || file.name.replace(/\.json$/i, ""), cards: {} }; Object.entries(cards).forEach(([id, qty]) => { if (cardMap.has(id)) builder.cards[id] = Math.max(0, Math.min(4, Number(qty) || 0)); }); renderBuilder(); showView("decks"); toast("Deck imported"); } catch { toast("Could not read that deck JSON"); } }; reader.readAsText(file);
  }
  function toast(text) {
    let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.style.cssText = "position:fixed;bottom:23px;left:50%;transform:translateX(-50%);background:#252633;border:1px solid #ffffff2a;color:#fff;padding:11px 15px;border-radius:9px;box-shadow:0 12px 35px #0009;font:11px 'DM Sans',sans-serif;z-index:20;transition:.2s"; document.body.appendChild(el); }
    el.textContent = text; el.style.opacity = "1"; clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.opacity = "0"; }, 2200);
  }
  function newMatchButton() { if (botTimer) clearTimeout(botTimer); endOnlineSession(); match = null; selectedCard = null; $("#match-layout").classList.add("hidden"); $("#match-empty").classList.remove("hidden"); showView("play"); }

  $$(".nav-button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
  $$('[data-goto]').forEach((b) => b.addEventListener("click", () => showView(b.dataset.goto)));
  $("#host-online").addEventListener("click", () => openOnlineDialog("host")); $("#host-online-empty").addEventListener("click", () => openOnlineDialog("host"));
  $("#join-online").addEventListener("click", () => openOnlineDialog("join")); $("#join-online-empty").addEventListener("click", () => openOnlineDialog("join"));
  $("#online-confirm").addEventListener("click", () => online.dialogMode === "host" ? beginHosting() : beginJoining());
  $("#online-cancel").addEventListener("click", () => $("#online-dialog").close()); $("#close-online-dialog").addEventListener("click", () => $("#online-dialog").close());
  $("#copy-invite").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#invite-link").value); toast("Invite link copied."); } catch { $("#invite-link").select(); document.execCommand("copy"); toast("Invite link copied."); } });
  $("#new-match").addEventListener("click", () => { endOnlineSession(); startMatch(); }); $("#empty-start").addEventListener("click", () => { endOnlineSession(); startMatch(); }); $("#reset-match").addEventListener("click", newMatchButton);
  $("#draw-card").addEventListener("click", () => performOnlineAction("draw")); $("#ride-card").addEventListener("click", () => performOnlineAction("ride")); $("#call-card").addEventListener("click", () => performOnlineAction("call")); $("#attack-card").addEventListener("click", () => performOnlineAction("attack")); $("#guard-card").addEventListener("click", () => performOnlineAction("guard")); $("#end-turn").addEventListener("click", () => performOnlineAction("endTurn")); $("#advance-phase").addEventListener("click", () => performOnlineAction("advance"));
  $("#hand-cards").addEventListener("click", (e) => { const card = e.target.closest("[data-hand-uid]"); if (!card || !match || match.side !== "human") return; match.selected = match.selected === card.dataset.handUid ? null : card.dataset.handUid; if (online.role === "guest" && online.connection?.open) online.connection.send({ type: "select", selected: match.selected }); renderMatch(); });
  $(".game-table").addEventListener("click", (e) => { const field = e.target.closest("[data-field-uid]"); if (!field || !match || field.dataset.side !== "human") return; match.selected = match.selected === field.dataset.fieldUid ? null : field.dataset.fieldUid; if (online.role === "guest" && online.connection?.open) online.connection.send({ type: "select", selected: match.selected }); renderMatch(); });
  $("#advance-phase").addEventListener("click", () => { if (match?.pendingAttack) return; });
  const noGuardButton = document.createElement("button"); noGuardButton.id = "no-guard"; noGuardButton.className = "button button-quiet hidden"; noGuardButton.textContent = "No guard"; noGuardButton.addEventListener("click", () => performOnlineAction("noGuard")); $(".action-buttons").insertBefore(noGuardButton, $("#guard-card"));
  $("#sort-hand").addEventListener("click", () => { if (!match) return; match.players.human.hand.sort((a, b) => { const ca = cardMap.get(a.cardId), cb = cardMap.get(b.cardId); return (ca?.grade || 0) - (cb?.grade || 0) || ca?.name.localeCompare(cb?.name); }); renderMatch(); });
  $("#clear-log").addEventListener("click", () => { if (match) { match.log = []; renderLog(); } });
  $("#create-deck").addEventListener("click", () => { emptyDeck(); showView("decks"); $("#deck-name").focus(); });
  $("#save-deck").addEventListener("click", saveDeck); $("#deck-name").addEventListener("input", () => { builder.name = $("#deck-name").value; $("#builder-title").textContent = builder.name || "Untitled deck"; });
  $("#card-search").addEventListener("input", () => { builderPage = 0; renderBuilderCards(); }); $("#grade-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-clan-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); });
  $("#builder-prev").addEventListener("click", () => { builderPage = Math.max(0, builderPage - 1); renderBuilderCards(); }); $("#builder-next").addEventListener("click", () => { builderPage += 1; renderBuilderCards(); });
  $("#builder-card-grid").addEventListener("click", (e) => { const node = e.target.closest("[data-card-id]"); if (!node) return; const id = node.dataset.cardId; builder.cards[id] = Math.min(4, (builder.cards[id] || 0) + 1); renderBuilder(); });
  $("#deck-list").addEventListener("click", (e) => { const q = e.target.closest("[data-qty]"); const r = e.target.closest("[data-remove]"); if (q) { const id = q.dataset.id; builder.cards[id] = Math.max(0, Math.min(4, (builder.cards[id] || 0) + Number(q.dataset.qty))); if (!builder.cards[id]) delete builder.cards[id]; renderBuilder(); } if (r) { delete builder.cards[r.dataset.remove]; renderBuilder(); } });
  $("#saved-decks").addEventListener("click", (e) => { const load = e.target.closest("[data-load-deck]"); const duplicate = e.target.closest("[data-duplicate-deck]"); const remove = e.target.closest("[data-delete-deck]"); const exp = e.target.closest("[data-export-saved]"); const decks = readSavedDecks(); if (load) { const d = decks.find((x) => x.id === load.dataset.loadDeck); if (d) loadDeck(d); } if (duplicate) { const d = decks.find((x) => x.id === duplicate.dataset.duplicateDeck); if (d) { const copy = { ...d, id: crypto.randomUUID?.() || String(Date.now()), name: `${d.name} Copy`, updatedAt: new Date().toISOString() }; decks.unshift(copy); writeSavedDecks(decks); renderSavedDecks(); toast("Deck duplicated"); } } if (remove) { const d = decks.find((x) => x.id === remove.dataset.deleteDeck); if (d && confirm(`Delete “${d.name}” from this browser?`)) { writeSavedDecks(decks.filter((x) => x.id !== d.id)); renderSavedDecks(); } } if (exp) { const d = decks.find((x) => x.id === exp.dataset.exportSaved); if (d) exportDeck(d, `${d.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.json`); } });
  $("#export-deck").addEventListener("click", () => exportDeck(builder, `${builder.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.json`));
  $("#import-deck").addEventListener("click", () => $("#deck-file").click()); $("#deck-file").addEventListener("change", (e) => { if (e.target.files[0]) importDeckFile(e.target.files[0]); e.target.value = ""; });
  $("#library-search").addEventListener("input", () => { libraryPage = 0; renderLibrary(); }); $("#library-grade").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-clan").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-prev").addEventListener("click", () => { libraryPage = Math.max(0, libraryPage - 1); renderLibrary(); }); $("#library-next").addEventListener("click", () => { libraryPage += 1; renderLibrary(); }); $("#library-grid").addEventListener("click", (e) => { const node = e.target.closest("[data-card-detail]"); if (node) showCardDetails(node.dataset.cardDetail); });
  $("#art-search").addEventListener("input", () => { artPage = 0; renderArtGallery(); });
  $("#art-prev").addEventListener("click", () => { artPage = Math.max(0, artPage - 1); renderArtGallery(); });
  $("#art-next").addEventListener("click", () => { artPage += 1; renderArtGallery(); });
  $("#art-grid").addEventListener("click", (e) => { const tile = e.target.closest("[data-art-id]"); if (tile) showArtImage(Number(tile.dataset.artId)); });
  $("#close-card-dialog").addEventListener("click", () => $("#card-dialog").close()); $("#help-button").addEventListener("click", () => $("#help-dialog").showModal()); $("#close-help-dialog").addEventListener("click", () => $("#help-dialog").close());
  $("#match-menu").addEventListener("click", () => { if (confirm("Start a new practice match? The current match will end.")) { endOnlineSession(); startMatch(); } });
  $("#card-dialog").addEventListener("click", (e) => { if (e.target === $("#card-dialog")) $("#card-dialog").close(); });
  populateClanFilters(); updateDeckCount(); renderBuilder(); renderLibrary(); renderArtGallery(); renderSavedDecks();
  const initial = ["play", "decks", "cards"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "play"; showView(initial);
  if (!readSavedDecks().length) { $("#match-layout").classList.add("hidden"); $("#match-empty").classList.remove("hidden"); }
  const joinInvite = new URLSearchParams(location.search).get("join"); if (joinInvite) openOnlineDialog("join", location.href);
})();
