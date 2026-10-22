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
  cardMap.set("token-quick-shield", { id: "token-quick-shield", name: "Quick Shield", grade: 0, nation: "Token", power: 0, shield: 5000, type: "Quick Shield Token", text: "Placeholder token for a Quick Shield. Resolve its shield value manually.", color: "#a39bff", glyph: "◇", source: "Vanguard Arena token" });
  const artIds = Array.isArray(window.CARD_ART_IDS) ? window.CARD_ART_IDS : [];
  const artPageSize = 60;
  let artPage = 0;
  let builderPage = 0;
  let libraryPage = 0;
  const cardPageSize = 48;
  const phases = ["Stand", "Draw", "Ride", "Main", "Battle", "End"];
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  let view = "play";
  let builder = { id: null, name: "Untitled deck", cards: {}, starterCardId: "" };
  let selectedCard = null;
  let match = null;
  let selectedZone = null;
  let botTimer = null;
  let online = { role: null, peer: null, connection: null, watchers: [], roomId: null, publicRoomCode: null, heartbeat: null, applyingRemote: false, dialogMode: "host" };
  const localDeckStorageKey = "vanguardArenaDecks";
  const account = { client: null, user: null, syncing: false, recovery: false, profile: null };

  function deckStorageKey() { return account.user ? `${localDeckStorageKey}:${account.user.id}` : localDeckStorageKey; }
  function readSavedDecks() {
    try { return JSON.parse(localStorage.getItem(deckStorageKey()) || "[]"); } catch { return []; }
  }
  function writeSavedDecks(decks) { localStorage.setItem(deckStorageKey(), JSON.stringify(decks)); updateDeckCount(); if (account.user && !account.syncing) void persistCloudDecks(decks); }
  function updateDeckCount() { $("#deck-count").textContent = readSavedDecks().length; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function accountMessage(message, isError = false) { const el = $("#account-message"); if (!el) return; el.textContent = message; el.classList.toggle("error", isError); }
  function refreshAccountUI() {
    const config = window.VANGUARD_CLOUD_CONFIG;
    const ready = Boolean(account.client);
    $("#account-setup-needed").classList.toggle("hidden", ready);
    $("#account-form").classList.toggle("hidden", !ready || (Boolean(account.user) && !account.recovery));
    $("#account-signed-in").classList.toggle("hidden", !account.user || account.recovery);
    $("#account-signin").classList.toggle("hidden", account.recovery);
    $("#account-signup").classList.toggle("hidden", account.recovery);
    $("#account-reset").classList.toggle("hidden", account.recovery);
    $("#account-update-password").classList.toggle("hidden", !account.recovery);
    if (account.user) $("#account-email-label").textContent = account.user.email || "Signed-in player";
    $("#account-button").textContent = account.user ? `Account · ${(account.user.email || "Player").split("@")[0]}` : "Account";
    $("#account-import-local").classList.toggle("hidden", !account.user || !localDecksToImport().length);
    $("#profile-username").value = account.profile?.username || "";
    $("#profile-display-name").value = account.profile?.display_name || "";
    $("#profile-bio").value = account.profile?.bio || "";
    if (account.profile?.username) $("#account-button").textContent = `@${account.profile.username}`;
    if (config?.url && config?.publishableKey && !window.supabase?.createClient) {
      $("#account-setup-needed").classList.remove("hidden");
      $("#account-setup-needed").innerHTML = "The account service library did not load. Check your internet connection and reload the page.";
    }
  }
  function localDecksToImport() { try { return JSON.parse(localStorage.getItem(localDeckStorageKey) || "[]"); } catch { return []; } }
  function cloudDeckRows(decks, userId = account.user?.id) { return decks.map((deck) => ({ user_id: userId, deck_id: String(deck.id), name: String(deck.name || "Untitled deck"), cards: { ...(deck.cards && typeof deck.cards === "object" ? deck.cards : {}), __starterCardId: deck.starterCardId || null }, updated_at: deck.updatedAt || new Date().toISOString() })); }
  async function persistCloudDecks(decks) {
    if (!account.client || !account.user || !decks.length) return;
    $("#account-sync-status").textContent = "Saving decks to your account…";
    const { error } = await account.client.from("player_decks").upsert(cloudDeckRows(decks), { onConflict: "user_id,deck_id" });
    if (error) { $("#account-sync-status").textContent = `Cloud save failed: ${error.message}`; accountMessage("Decks are still saved in this browser, but cloud sync failed. Check the account setup guide.", true); }
    else $("#account-sync-status").textContent = `Synced ${decks.length} deck${decks.length === 1 ? "" : "s"} to your account.`;
  }
  async function deleteCloudDeck(deckId) {
    if (!account.client || !account.user) return;
    const { error } = await account.client.from("player_decks").delete().eq("user_id", account.user.id).eq("deck_id", String(deckId));
    if (error) { $("#account-sync-status").textContent = `Cloud delete failed: ${error.message}`; accountMessage("The deck was removed from this browser, but cloud deletion failed.", true); }
  }
  async function syncCloudDecks() {
    if (!account.client || !account.user || account.syncing) return;
    const userId = account.user.id;
    account.syncing = true;
    $("#account-sync-status").textContent = "Loading your saved decks…";
    try {
      const { data, error } = await account.client.from("player_decks").select("deck_id,name,cards,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
      if (error) throw error;
      const decks = new Map();
      [...readSavedDecks(), ...(data || []).map((row) => { const stored = row.cards || {}; const { __starterCardId, ...cards } = stored; return { id: row.deck_id, name: row.name, cards, starterCardId: __starterCardId || "", updatedAt: row.updated_at }; })].forEach((deck) => {
        const current = decks.get(String(deck.id));
        if (!current || Date.parse(deck.updatedAt || 0) > Date.parse(current.updatedAt || 0)) decks.set(String(deck.id), deck);
      });
      const merged = [...decks.values()].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
      localStorage.setItem(deckStorageKey(), JSON.stringify(merged)); updateDeckCount(); renderSavedDecks();
      if (merged.length) {
        const result = await account.client.from("player_decks").upsert(cloudDeckRows(merged, userId), { onConflict: "user_id,deck_id" });
        if (result.error) throw result.error;
      }
      $("#account-sync-status").textContent = `Synced ${merged.length} deck${merged.length === 1 ? "" : "s"} to your account.`;
    } catch (error) {
      $("#account-sync-status").textContent = `Deck sync failed: ${error.message}`;
      accountMessage("You are signed in, but deck sync failed. Check the database setup guide.", true);
    } finally { account.syncing = false; }
  }
  async function loadPlayerProfile() {
    if (!account.user || !account.client) return;
    const { data, error } = await account.client.from("player_profiles").select("username,display_name,bio").eq("user_id", account.user.id).maybeSingle();
    if (error) { $("#profile-status").textContent = "Profile storage is not set up yet. Run the updated SQL setup script."; return; }
    account.profile = data || null;
    if (!data) {
      const metadata = account.user.user_metadata || {};
      const fallback = (account.user.email || "player").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20).toLowerCase();
      account.profile = { username: metadata.username || fallback, display_name: metadata.display_name || localStorage.getItem("vanguardArenaPlayerName") || (account.user.email || "Player").split("@")[0], bio: "" };
      $("#profile-status").textContent = "Choose a unique username and save your profile.";
    } else $("#profile-status").textContent = "Profile loaded. Usernames and bios are visible to site visitors.";
    refreshAccountUI();
  }
  async function savePlayerProfile() {
    if (!account.user || !account.client) return;
    const username = $("#profile-username").value.trim().toLowerCase();
    const displayName = $("#profile-display-name").value.trim();
    const bio = $("#profile-bio").value.trim();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { $("#profile-status").textContent = "Username must be 3–20 characters: lowercase letters, numbers or underscores."; return; }
    if (!displayName || displayName.length > 32 || bio.length > 160) { $("#profile-status").textContent = "Enter a display name up to 32 characters; bio can be up to 160."; return; }
    $("#profile-status").textContent = "Saving profile…";
    const profile = { user_id: account.user.id, username, display_name: displayName, bio, updated_at: new Date().toISOString() };
    const { error } = await account.client.from("player_profiles").upsert(profile, { onConflict: "user_id" });
    if (error) { $("#profile-status").textContent = error.code === "23505" ? "That username is already taken. Choose another one." : `Could not save profile: ${error.message}`; return; }
    account.profile = { username, display_name: displayName, bio };
    localStorage.setItem("vanguardArenaPlayerName", displayName);
    refreshAccountUI(); $("#profile-status").textContent = `Saved. Friends will see ${displayName} (@${username}) in matches.`;
  }
  function openAccountDialog() { refreshAccountUI(); $("#account-dialog").showModal(); }
  function initializeAccounts() {
    const config = window.VANGUARD_CLOUD_CONFIG;
    if (!config?.url || !config?.publishableKey || !window.supabase?.createClient) { refreshAccountUI(); return; }
    try {
      account.client = window.supabase.createClient(config.url, config.publishableKey);
      account.client.auth.onAuthStateChange((event, session) => {
        const previousUserId = account.user?.id;
        account.user = session?.user || null; if (previousUserId !== account.user?.id) account.profile = null; account.recovery = event === "PASSWORD_RECOVERY";
        refreshAccountUI(); updateDeckCount(); renderSavedDecks();
        if (account.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) setTimeout(() => { void syncCloudDecks(); void loadPlayerProfile(); }, 0);
        if (account.recovery) { accountMessage("Enter a new password, then choose Save new password."); setTimeout(openAccountDialog, 0); }
        if (!account.user) $("#account-sync-status").textContent = "Your account is signed out. Local decks remain in this browser.";
      });
      account.client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        account.user = data.session?.user || null; refreshAccountUI(); updateDeckCount(); renderSavedDecks();
        if (account.user) { void syncCloudDecks(); void loadPlayerProfile(); }
      }).catch((error) => accountMessage(`Couldn't restore your account session: ${error.message}`, true));
    } catch (error) { accountMessage(`Account setup error: ${error.message}`, true); }
    refreshAccountUI();
  }
  async function accountSignUp() {
    if (!account.client) return;
    const email = $("#account-email").value.trim(); const password = $("#account-password").value;
    if (!email || password.length < 8) { accountMessage("Enter a valid email and a password with at least 8 characters.", true); return; }
    accountMessage("Creating your account…");
    const { data, error } = await account.client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
    if (error) accountMessage(error.message, true);
    else if (data.session) accountMessage("Account created and signed in.");
    else accountMessage("Account created. Check your email for the confirmation link before signing in.");
  }
  async function accountSignIn() {
    if (!account.client) return;
    const { error } = await account.client.auth.signInWithPassword({ email: $("#account-email").value.trim(), password: $("#account-password").value });
    if (error) accountMessage(error.message, true); else accountMessage("Signed in. Loading your decks…");
  }
  async function accountSignOut() { if (account.client) { const { error } = await account.client.auth.signOut(); if (error) accountMessage(error.message, true); else { account.user = null; accountMessage("Signed out. Your local decks are still here."); } } }
  async function resetAccountPassword() {
    if (!account.client) return;
    const email = $("#account-email").value.trim();
    if (!email) { accountMessage("Enter your email address first.", true); return; }
    const { error } = await account.client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
    accountMessage(error ? error.message : "If that email has an account, a password reset link is on the way.", Boolean(error));
  }
  async function updateAccountPassword() {
    if (!account.client || !account.recovery) return;
    const password = $("#account-password").value;
    if (password.length < 8) { accountMessage("Choose a new password with at least 8 characters.", true); return; }
    const { error } = await account.client.auth.updateUser({ password });
    if (error) accountMessage(error.message, true);
    else { account.recovery = false; refreshAccountUI(); accountMessage("Password updated."); }
  }
  async function importLocalDecks() {
    if (!account.user) return;
    const incoming = localDecksToImport(); const current = readSavedDecks(); const decks = new Map(current.map((d) => [String(d.id), d]));
    incoming.forEach((deck) => { const old = decks.get(String(deck.id)); if (!old || Date.parse(deck.updatedAt || 0) > Date.parse(old.updatedAt || 0)) decks.set(String(deck.id), deck); });
    writeSavedDecks([...decks.values()]); renderSavedDecks(); accountMessage(`Imported ${incoming.length} browser-saved deck${incoming.length === 1 ? "" : "s"}.`);
  }
  function cardImage(card, className = "card-image") {
    if (!card?.image) return `<span class="card-art-glyph">${escapeHtml(card?.glyph || "✦")}</span>`;
    return `<img class="${className}" src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')" /><span class="card-art-glyph hidden">${escapeHtml(card.glyph || "✦")}</span>`;
  }
  function cardNode(card, selected = false, count = null) {
    const gradeLabel = card.grade === null || card.grade === undefined ? "?" : escapeHtml(card.grade);
    return `<span class="game-card-wrap"><button class="game-card${selected ? " selected" : ""}" style="--card-accent:${escapeHtml(card.color || "#a39bff")}" data-card-id="${escapeHtml(card.id)}" aria-label="${escapeHtml(card.name)}, grade ${gradeLabel}">
      <span class="grade-chip">${gradeLabel}</span>${card.trigger ? `<span class="trigger-chip">${escapeHtml(card.trigger)}</span>` : ""}
      <span class="card-art">${cardImage(card)}</span><span class="card-copy"><span class="card-name">${escapeHtml(card.name)}</span><span class="card-subline"><span>G${escapeHtml(card.grade)} · ${escapeHtml(card.type)}</span><span>${count === null ? `${Math.round(card.power / 1000)}k` : `×${count}`}</span></span></span>
    </button><button class="card-zoom" type="button" data-card-zoom="${escapeHtml(card.id)}" aria-label="Zoom ${escapeHtml(card.name)}" title="Zoom card">⤢</button></span>`;
  }
  function showView(next) {
    view = next;
    $$(".view").forEach((el) => el.classList.toggle("active-view", el.id === `view-${next}`));
    $$(".nav-button").forEach((el) => el.classList.toggle("active", el.dataset.view === next));
    if (next === "decks") { renderBuilder(); renderSavedDecks(); }
    if (next === "cards") renderLibrary();
    window.location.hash = next;
  }
  function emptyDeck() { builder = { id: null, name: "Untitled deck", cards: {}, starterCardId: "" }; renderBuilder(); }
  function defaultDeck() {
    const cards = {};
    const pool = cardList.filter((c) => c.type === "Unit" || c.type === "Trigger");
    for (let i = 0; i < 50; i++) { const card = pool[(i * 7 + Math.floor(i / pool.length)) % pool.length]; cards[card.id] = (cards[card.id] || 0) + 1; }
    const starterCardId = Object.keys(cards).find((id) => Number(cardMap.get(id)?.grade) === 0 && /Unit/i.test(cardMap.get(id)?.type || "")) || "";
    return { id: crypto.randomUUID?.() || String(Date.now()), name: "Demo Practice Deck", cards, starterCardId };
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
    const starterOptions = Object.entries(builder.cards || {}).filter(([id, qty]) => qty > 0 && Number(cardMap.get(id)?.grade) === 0 && /Unit/i.test(cardMap.get(id)?.type || "")).map(([id, qty]) => ({ card: cardMap.get(id), qty })).filter((entry) => entry.card).sort((a, b) => a.card.name.localeCompare(b.card.name));
    if (builder.starterCardId && !starterOptions.some(({ card }) => card.id === builder.starterCardId)) builder.starterCardId = "";
    $("#starter-vanguard").innerHTML = `<option value="">Choose a Grade 0 unit…</option>${starterOptions.map(({ card, qty }) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)} · ×${qty}</option>`).join("")}`;
    $("#starter-vanguard").value = builder.starterCardId || "";
    $("#starter-vanguard-help").textContent = builder.starterCardId ? `${cardMap.get(builder.starterCardId)?.name || "Selected unit"} will begin on your Vanguard circle.` : "Choose a Grade 0 unit from your deck. It starts on your Vanguard circle.";
    const rows = Object.entries(builder.cards || {}).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ card: cardMap.get(id), qty })).filter((x) => x.card).sort((a, b) => a.card.grade - b.card.grade || a.card.name.localeCompare(b.card.name));
    $("#deck-list").innerHTML = rows.length ? rows.map(({ card, qty }) => `<div class="deck-row"><button class="deck-row-image" type="button" data-card-zoom="${escapeHtml(card.id)}" aria-label="Zoom ${escapeHtml(card.name)}" title="Zoom card">${cardImage(card)}</button><span class="row-grade">${card.grade === null || card.grade === undefined ? "G?" : `G${escapeHtml(card.grade)}`}</span><span class="row-title">${escapeHtml(card.name)}<small>${escapeHtml(card.clan || card.nation || "Clan not listed")} · ${escapeHtml(card.type)}${card.trigger ? ` · ${escapeHtml(card.trigger)}` : ""}</small></span><span class="qty-controls"><button data-qty="-1" data-id="${escapeHtml(card.id)}">−</button>${qty}<button data-qty="1" data-id="${escapeHtml(card.id)}">+</button><button class="remove-row" data-remove="${escapeHtml(card.id)}" title="Remove">×</button></span></div>`).join("") : `<div class="empty-saved">Your deck is empty. Choose cards from the library.</div>`;
    renderBuilderCards();
  }
  function renderBuilderCards() {
    const term = $("#card-search").value.trim().toLowerCase(); const grade = $("#grade-filter").value; const clan = $("#builder-clan-filter").value; const nation = $("#builder-nation-filter").value;
    const filtered = cardList.filter((c) => gradeMatches(c, grade) && clanMatches(c, clan) && nationMatches(c, nation) && (!term || `${c.name} ${c.id} ${c.dbId || ""} ${c.clan || ""} ${c.nation || ""} ${c.type} ${c.trigger || ""}`.toLowerCase().includes(term)));
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
  function nationMatches(card, selected) {
    const nations = card.nations?.length ? card.nations : (card.nation ? [card.nation] : []);
    if (selected === "all") return true;
    if (selected === "unknown") return nations.length === 0;
    return nations.includes(selected);
  }
  function populateClanFilters() {
    const clans = [...new Set(cardList.flatMap((c) => c.clans?.length ? c.clans : c.clan ? [c.clan] : []))].sort((a,b) => a.localeCompare(b));
    ["#builder-clan-filter", "#library-clan"].forEach((selector) => {
      const select = $(selector); if (!select) return;
      select.innerHTML = `<option value="all">All clans</option>${clans.map((clan) => `<option value="${escapeHtml(clan)}">${escapeHtml(clan)}</option>`).join("")}<option value="unknown">No clan listed</option>`;
    });
    const nations = [...new Set(cardList.flatMap((c) => c.nations?.length ? c.nations : c.nation ? [c.nation] : []))].sort((a,b) => a.localeCompare(b));
    ["#builder-nation-filter", "#library-nation"].forEach((selector) => {
      const select = $(selector); if (!select) return;
      select.innerHTML = `<option value="all">All nations</option>${nations.map((nation) => `<option value="${escapeHtml(nation)}">${escapeHtml(nation)}</option>`).join("")}<option value="unknown">No nation listed</option>`;
    });
  }
  function saveDeck() {
    const name = $("#deck-name").value.trim() || "Untitled deck"; const existing = readSavedDecks();
    const id = builder.id || (crypto.randomUUID?.() || String(Date.now()));
    const saved = { id, name, cards: { ...builder.cards }, starterCardId: builder.starterCardId || "", updatedAt: new Date().toISOString() };
    const index = existing.findIndex((d) => d.id === id);
    if (index >= 0) existing[index] = saved; else existing.unshift(saved);
    builder = { ...saved }; writeSavedDecks(existing); renderBuilder(); renderSavedDecks();
    toast(account.user ? "Deck saved to your account folder" : "Deck saved in this browser");
  }
  function loadDeck(deck) { builder = { id: deck.id, name: deck.name, cards: { ...deck.cards }, starterCardId: deck.starterCardId || "" }; renderBuilder(); showView("decks"); toast(`Loaded “${deck.name}” into the builder`); }
  function renderSavedDecks() {
    const decks = readSavedDecks(); $("#saved-deck-subtitle").textContent = decks.length ? `${decks.length} deck${decks.length === 1 ? "" : "s"}` : "No decks yet";
    $("#saved-deck-eyebrow").textContent = account.user ? "ONLINE ACCOUNT DECK FOLDER" : "DECK FOLDER · THIS BROWSER";
    $("#deck-folder-help").textContent = account.user ? "This folder syncs to your account. Your saved decks load here whenever you sign in." : "Sign in to sync this folder across devices. Save decks here, then they load whenever you sign in.";
    $("#saved-decks").innerHTML = decks.length ? decks.map((d) => { const s = deckSummary(d); const preview = Object.keys(d.cards || {}).slice(0, 5).map((id) => cardMap.get(id)).filter(Boolean); return `<article class="saved-deck-card"><h3>${escapeHtml(d.name)}</h3><div class="saved-deck-meta">${deckCount(d)} cards · G${s.counts.join(" / ")} · ${escapeHtml(new Date(d.updatedAt || Date.now()).toLocaleDateString())}</div><div class="saved-deck-preview">${preview.map((c) => `<button class="saved-deck-preview-card" type="button" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}" title="Zoom ${escapeHtml(c.name)}">${c.image ? `<img src="${escapeHtml(c.image)}" alt="" onerror="this.remove()"/>` : escapeHtml(c.glyph)}</button>`).join("")}</div><div class="saved-deck-actions"><button class="button button-primary" data-load-deck="${escapeHtml(d.id)}">Open</button><button class="button" data-duplicate-deck="${escapeHtml(d.id)}">Duplicate</button><button class="button" data-export-saved="${escapeHtml(d.id)}">Export</button><button class="button" data-delete-deck="${escapeHtml(d.id)}" title="Delete">×</button></div></article>`; }).join("") : `<div class="empty-saved">Saved decks appear here. Build a deck and choose Save deck.</div>`;
    updateDeckCount();
  }
  function renderLibrary() {
    const term = $("#library-search").value.trim().toLowerCase(); const grade = $("#library-grade").value; const clan = $("#library-clan").value; const nation = $("#library-nation").value;
    const filtered = cardList.filter((c) => gradeMatches(c, grade) && clanMatches(c, clan) && nationMatches(c, nation) && (!term || `${c.name} ${c.id} ${c.dbId || ""} ${c.clan || ""} ${c.nation || ""} ${c.type} ${c.trigger || ""}`.toLowerCase().includes(term)));
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
    const allCards = cardInstances(deck);
    const gDeck = allCards.filter((instance) => /G Unit|G Guardian|G-Guard/i.test(cardMap.get(instance.cardId)?.type || ""));
    const pile = allCards.filter((instance) => !gDeck.includes(instance));
    const starterId = deck.starterCardId || pile.find((instance) => Number(cardMap.get(instance.cardId)?.grade) === 0 && /Unit/i.test(cardMap.get(instance.cardId)?.type || ""))?.cardId;
    const starterIndex = pile.findIndex((instance) => instance.cardId === starterId);
    const vanguard = starterIndex >= 0 ? { ...pile.splice(starterIndex, 1)[0], rested: false } : null;
    shuffle(pile);
    return { name, deck: pile.slice(5), hand: pile.slice(0, 5), damage: [], drop: [], soul: [], bind: [], vanguard, rear: [null, null, null, null, null], accelZones: 0, giftZones: [], orders: [], extra: [], gDeck: shuffle(gDeck), gZone: [], quickShields: 0, gifts: 0, human };
  }
  function startMatch(deck = null) {
    const chosen = deck || (builder.cards && deckCount(builder) ? builder : null);
    const readyDeck = chosen && deckCount(chosen) ? chosen : defaultDeck();
    match = { players: { human: makePlayer(readyDeck, "Player", true), bot: makePlayer(defaultDeck(), "Practice Bot") }, turn: 1, side: "human", phase: 0, drewThisTurn: false, selected: null, pendingAttack: null, botAttacks: [], revealed: null, log: [], ended: false, deckName: readyDeck.name };
    selectedCard = null; selectedZone = null;
    $("#match-layout").classList.remove("hidden"); $("#match-empty").classList.add("hidden");
    addLog(`${online.role ? "Online match" : "Practice match"} started with ${readyDeck.name}.`); setMessage("Your turn — advance through Stand and Draw."); renderMatch(); showView("play");
  }
  function addLog(message) { if (!match) return; match.log.unshift({ time: new Date(), message }); match.log = match.log.slice(0, 15); renderLog(); }
  function renderLog() { if (!match) return; $("#match-log").innerHTML = match.log.map((entry) => `<div class="log-entry"><time>${entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>${escapeHtml(entry.message)}</span></div>`).join(""); }
  function setMessage(message) { $("#table-message").textContent = message; }
  function renderMatch() {
    if (!match) return;
    const you = match.players.human, bot = match.players.bot;
    $("#human-name").textContent = you.name; $("#table-human-name").textContent = you.name;
    $("#opponent-name").textContent = bot.name; $("#table-opponent-name").textContent = bot.name;
    $("#match-status").textContent = online.role === "watcher" ? "SPECTATING · LIVE" : online.role ? "ONLINE MATCH" : "PRACTICE MATCH";
    $("#opponent-deck-label").textContent = online.role ? "OPPONENT" : "DEMO DECK";
    $("#turn-label").textContent = match.side === "human" ? "YOUR TURN" : "OPPONENT TURN";
    $("#phase-label").textContent = match.side === "human" ? `${phases[match.phase]} phase` : `Practice Bot · ${phases[match.phase]} phase`;
    $("#turn-number").textContent = String(match.turn).padStart(2, "0"); $("#table-turn").textContent = String(match.turn).padStart(2, "0");
    $("#phase-count").textContent = `${match.phase + 1} / ${phases.length}`;
    $("#phase-list").innerHTML = phases.map((p, i) => `<div class="phase-item${i === match.phase ? " active" : ""}${i < match.phase ? " past" : ""}"><span class="phase-bullet">${i < match.phase ? "✓" : i + 1}</span>${p} phase</div>`).join("");
    $$(".phase-segment").forEach((el, i) => { el.classList.toggle("done", i < match.phase); el.classList.toggle("current", i === match.phase); });
    $("#human-deck-count").textContent = you.deck.length; $("#bot-deck-count").textContent = bot.deck.length; $("#human-drop-count").textContent = you.drop.length; $("#bot-drop-count").textContent = bot.drop.length;
    $("#soul-count").textContent = String(you.soul.length);
    $("#human-gdeck-count").textContent = you.gDeck?.length || 0; $("#bot-gdeck-count").textContent = bot.gDeck?.length || 0; $("#human-bind-count").textContent = you.bind?.length || 0; $("#bot-soul-count").textContent = bot.soul?.length || 0;
    $("#human-order-zone").innerHTML = renderOrderCards(you.orders, "human"); $("#bot-order-zone").innerHTML = renderOrderCards(bot.orders, "bot");
    $("#human-gzone").innerHTML = renderGZone(you); $("#bot-gzone").innerHTML = renderGZone(bot);
    $("#gift-count").textContent = String(you.gifts || 0);
    $(".human-line .player-title small").textContent = `YOUR SIDE · G ${you.gZone?.length || 0} · QUICK SHIELD ${you.quickShields || 0}`;
    $(".opponent-line .player-title small").textContent = `${online.role ? "OPPONENT" : "DEMO DECK"} · G ${bot.gZone?.length || 0} · QUICK SHIELD ${bot.quickShields || 0}`;
    $("#human-damage").innerHTML = renderDamageCards(you);
    $("#bot-damage").innerHTML = renderDamageCards(bot);
    $("#bot-hand-count").textContent = `${bot.hand.length} CARDS`;
    $("#bot-hand").innerHTML = Array.from({ length: Math.min(8, bot.hand.length) }, () => `<span class="mini-back"></span>`).join("");
    renderZone("human", "vanguard", you.vanguard); renderZone("bot", "vanguard", bot.vanguard);
    const standardRearZones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right"];
    ["human", "bot"].forEach((side) => {
      const player = match.players[side]; player.accelZones = Math.max(0, Number(player.accelZones) || 0);
      while (player.rear.length < standardRearZones.length + player.accelZones) player.rear.push(null);
      const zoneIds = [...standardRearZones, ...Array.from({ length: player.accelZones }, (_, i) => `accel-${i + 1}`)];
      zoneIds.forEach((zone, index) => {
        if (zone.startsWith("accel-") && !$(`.field-zone[data-side="${side}"][data-zone="${zone}"]`)) {
          const row = $(`#${side}-accel-row`); if (row) row.insertAdjacentHTML("beforeend", `<div class="field-zone accel-zone" data-side="${side}" data-zone="${zone}"><span>ACCEL CIRCLE</span></div>`);
        }
        renderZone(side, zone, player.rear[index]);
      });
    });
    $("#soul-pips").innerHTML = you.soul.slice(0, 7).map(() => `<span class="soul-pip"></span>`).join("");
    $("#hand-count").textContent = `${you.hand.length} card${you.hand.length === 1 ? "" : "s"}`;
    $("#hand-cards").innerHTML = you.hand.map((instance, i) => { const c = cardMap.get(instance.cardId); return c ? cardNode(c, match.selected === instance.uid).replace('data-card-id=', `data-hand-uid="${instance.uid}" data-hand-index="${i}" data-card-id=`) : ""; }).join("");
    updateActionAvailability(); renderLog();
    if (match.revealed?.cards?.length) renderSharedReveal(); else if($("#reveal-dialog").open) $("#reveal-dialog").close();
    if (online.role === "host" && !online.applyingRemote) sendOnlineSnapshot();
  }
  function renderZone(side, zone, instance) {
    const el = $(`.field-zone[data-side="${side}"][data-zone="${zone}"]`); if (!el) return;
    el.innerHTML = `<span>${zone === "vanguard" ? "VANGUARD" : "REAR-GUARD"}</span>`;
    const markers = (match.players[side].giftZones || []).filter((gift) => gift.zone === zone);
    if (markers.length) { const marker = document.createElement("b"); marker.className = "gift-zone-marker"; marker.textContent = markers.map((gift) => gift.type).join(" · "); el.appendChild(marker); }
    if (!instance) return;
    const c = cardMap.get(instance.cardId); if (!c) return;
    const field = document.createElement("div"); field.className = `field-card${match.selected === instance.uid ? " selected" : ""}${instance.rested ? " rested" : ""}${instance.locked ? " locked" : ""}`; field.dataset.fieldUid = instance.uid; field.dataset.cardId = c.id; field.dataset.side = side; field.dataset.zone = zone; field.style.borderColor = `${c.color}88`; field.innerHTML = `${c.image ? `<img class="field-card-art" src="${escapeHtml(c.image)}" alt="" onerror="this.remove()">` : ""}<button class="card-zoom field-card-zoom" type="button" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}" title="Zoom card">⤢</button><span class="mini-grade">${instance.locked ? "LOCKED" : `G${c.grade}`}</span><span class="field-card-name">${escapeHtml(c.name)}</span><span class="field-card-stats"><b>${Math.round((Number(c.power) + Number(instance.powerBoost || 0)) / 1000)}k</b><span>${escapeHtml(c.trigger || "UNIT")}</span></span>`;
    if (c.image) { field.style.backgroundImage = `linear-gradient(#1118,#111c),url("${String(c.image).replace(/["\\]/g, "")}")`; field.style.backgroundSize = "cover"; }
    el.appendChild(field);
  }
  function renderDamageCards(player) {
    const cards = (player.damage || []).map((instance) => {
      if (instance.faceDown) return `<span class="damage-card face-down" title="Face-down damage">V</span>`;
      const card = cardMap.get(instance.cardId); if (!card) return `<span class="damage-card">?</span>`;
      return `<button class="damage-card" type="button" data-card-zoom="${escapeHtml(card.id)}" title="${escapeHtml(card.name)} · click to zoom">${card.image ? `<img src="${escapeHtml(card.image)}" alt=""/>` : `<span>${escapeHtml(card.name)}</span>`}</button>`;
    }).join("");
    return `${cards}<span class="damage-total" aria-label="${player.damage.length} damage">${player.damage.length}/6</span>`;
  }
  function renderOrderCards(orders = [], side) {
    return (orders || []).map((instance) => { const c = cardMap.get(instance.cardId); return c ? `<span class="zone-card-wrap"><button class="zone-card" data-order-uid="${escapeHtml(instance.uid)}" data-side="${side}" title="Move ${escapeHtml(c.name)} to drop">${escapeHtml(c.name)}</button><button class="zone-zoom" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}">⤢</button></span>` : ""; }).join("") || `<span class="zone-empty">No orders</span>`;
  }
  function renderGZone(player) {
    const faceUp = (player.gZone || []).map((instance) => { const c = cardMap.get(instance.cardId); return c ? `<button class="zone-card" data-card-zoom="${escapeHtml(c.id)}" title="Zoom ${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>` : ""; }).join("");
    return `${faceUp}<span class="zone-empty">${(player.extra || []).length} face down</span>`;
  }
  function updateActionAvailability() {
    if (!match) return;
    const humanTurn = match.side === "human" && !match.ended;
    const handCard = match.players.human.hand.find((x) => x.uid === match.selected);
    const fieldCard = findFieldCard(match.selected);
    const pending = Boolean(match.pendingAttack);
    $("#draw-card").disabled = !humanTurn || pending || match.phase !== 1 || match.drewThisTurn || match.players.human.deck.length === 0;
    const returnTop = $("[data-manual-action='hand-to-top']"), returnBottom = $("[data-manual-action='hand-to-bottom']");
    [returnTop, returnBottom].forEach((button) => { if (button) button.disabled = !humanTurn || pending || !handCard || online.role === "watcher"; });
    $("#ride-card").disabled = !humanTurn || pending || match.phase !== 2 || !handCard;
    $("#call-card").disabled = !humanTurn || pending || match.phase !== 3 || !handCard || !match.players.human.rear.includes(null);
    $("#attack-card").disabled = !humanTurn || pending || match.phase !== 4 || !fieldCard || fieldCard.instance.rested || fieldCard.instance.locked;
    $("#play-order").disabled = !humanTurn || pending || match.phase !== 3 || !handCard || !/Order/i.test(cardMap.get(handCard.cardId)?.type || "");
    $("#guard-card").disabled = !pending || match.side === "human" || match.players.human.hand.length === 0;
    $("#end-turn").disabled = !humanTurn || pending;
    $("#advance-phase").disabled = !humanTurn || pending;
    $$(".manual-actions [data-manual-action]").forEach((button) => { const defenseAction = button.dataset.manualAction === "g-guard"; button.disabled = online.role === "watcher" || (!humanTurn && !(pending && defenseAction)); });
    const selectedToDrop = $("[data-manual-action='selected-to-drop']");
    if (selectedToDrop) selectedToDrop.disabled = online.role === "watcher" || !humanTurn || (!handCard && fieldCard?.side !== "human");
    const selectedToSoul = $("[data-manual-action='selected-to-soul']");
    if (selectedToSoul) selectedToSoul.disabled = online.role === "watcher" || !humanTurn || (!handCard && fieldCard?.side !== "human");
    const moveRearButton = $("[data-manual-action='move-rear']");
    if (moveRearButton) moveRearButton.disabled = online.role === "watcher" || !humanTurn || fieldCard?.side !== "human" || fieldCard.zone === "vanguard";
    const selectedVanguardSoul = $("[data-manual-action='view-selected-soul']");
    if (selectedVanguardSoul) selectedVanguardSoul.disabled = online.role === "watcher" || !fieldCard || fieldCard.side !== "human" || fieldCard.zone !== "vanguard";
    const restSelected = $("[data-manual-action='rest-selected']");
    if (restSelected) restSelected.disabled = online.role === "watcher" || match.ended || fieldCard?.side !== "human" || fieldCard.instance.rested;
    const standSelected = $("[data-manual-action='stand-selected']");
    if (standSelected) standSelected.disabled = online.role === "watcher" || match.ended || fieldCard?.side !== "human" || !fieldCard.instance.rested;
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
    if (online.role === "watcher") $$(".action-buttons button").forEach((button) => { button.disabled = true; });
  }
  function findFieldCard(uid) {
    if (!uid || !match) return null;
    for (const side of ["human", "bot"]) { const p = match.players[side]; if (p.vanguard?.uid === uid) return { side, zone: "vanguard", instance: p.vanguard }; const i = p.rear.findIndex((x) => x?.uid === uid); if (i >= 0) return { side, zone: ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: p.accelZones || 0 }, (_, n) => `accel-${n + 1}`)][i], index: i, instance: p.rear[i] }; }
    return null;
  }
  function selectedHandCard() { return match?.players.human.hand.find((x) => x.uid === match.selected); }
  function moveRearCardToZone(uid, zone) {
    const player = match.players.human;
    const rearZones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
    const from = player.rear.findIndex((item) => item?.uid === uid), to = rearZones.indexOf(zone);
    if (from < 0 || to < 0 || from === to) { match.moveRearUid = null; toast(from === to ? "That card is already in this circle." : "Choose an available Rear-Guard circle."); renderMatch(); return; }
    const moved = player.rear[from], displaced = player.rear[to];
    player.rear[to] = moved; player.rear[from] = displaced || null;
    match.moveRearUid = null; match.selected = null;
    addLog(displaced ? `${player.name} swapped two Rear-Guards.` : `${player.name} moved a Rear-Guard to another circle.`);
    renderMatch();
  }
  function draw(side) {
    const p = match.players[side]; if (!p.deck.length) return null;
    const card = p.deck.pop(); p.hand.push(card); return card;
  }
  function drawForHuman() {
    if (!match || match.side !== "human" || match.pendingAttack || match.phase !== 1 || match.drewThisTurn) return;
    const card = draw("human"); if (!card) { setMessage("Your deck is empty."); return; }
    match.drewThisTurn = true; addLog("You drew a card."); setMessage("Card drawn."); renderMatch();
  }
  function rideHuman() {
    const instance = selectedHandCard(); if (!instance || match.phase !== 2) return;
    const p = match.players.human; p.hand = p.hand.filter((x) => x.uid !== instance.uid); if (p.vanguard) p.soul.push(p.vanguard); p.vanguard = { ...instance, rested: false };
    match.selected = null; addLog(`You rode ${cardMap.get(instance.cardId)?.name || "a card"}.`); setMessage("Ride complete."); renderMatch();
  }
  function callHuman() {
    const instance = selectedHandCard(); if (!instance || match.phase !== 3) return;
    const p = match.players.human; const empty = p.rear.indexOf(null); if (empty < 0) return;
    p.hand = p.hand.filter((x) => x.uid !== instance.uid); p.rear[empty] = { ...instance, rested: false }; match.selected = null;
    addLog(`You called ${cardMap.get(instance.cardId)?.name || "a card"} to the rear-guard circle.`); setMessage("Unit called."); renderMatch();
  }
  function attackerPower(entry) { return Number(cardMap.get(entry.instance.cardId)?.power || 0); }
  function resolveHumanAttack() {
    const field = findFieldCard(match.selected); if (!field || field.side !== "human" || field.instance.rested || field.instance.locked || match.phase !== 4 || !match.players.bot.vanguard) return;
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
    match.side = "human"; match.phase = 0; match.drewThisTurn = false; match.pendingAttack = null; match.selected = null; match.turn += 1;
    addLog("Your turn began — advance to Draw to draw a card.");
    setMessage("Your turn — Stand phase."); renderMatch();
  }
  function endTurn() {
    if (!match || match.side !== "human" || match.pendingAttack || match.ended) return;
    if (online.role) {
      addLog(`${match.players.human.name} ended their turn.`); match.selected = null;
      match.players.human.vanguard && (match.players.human.vanguard.rested = false); match.players.human.rear.forEach((x) => x && (x.rested = false));
      match.side = "bot"; match.phase = 0; match.drewThisTurn = false;
      setMessage(`${match.players.bot.name}'s turn — Stand phase.`); renderMatch(); return;
    }
    addLog("You ended your turn."); match.selected = null; renderMatch(); botTurn();
  }
  function advancePhase() {
    if (!match || match.side !== "human" || match.pendingAttack || match.ended) return;
    if (match.phase >= phases.length - 1) { endTurn(); return; }
    match.phase += 1; match.selected = null;
    if (match.phase === 1 && !match.drewThisTurn) {
      const drawn = draw("human"); match.drewThisTurn = true;
      addLog(drawn ? `${match.players.human.name} drew a card for the Draw phase.` : `${match.players.human.name} has no cards to draw.`);
    }
    if (match.phase === 0) {
      const player = match.players.human; [player.vanguard, ...player.rear].forEach((unit) => { if (unit) unit.rested = false; });
    }
    setMessage(`${phases[match.phase]} phase.`); addLog(`You entered ${phases[match.phase].toLowerCase()} phase.`); renderMatch();
  }
  function manualGameAction(action) {
    if (!match || match.ended) return;
    const player = match.players.human, card = selectedHandCard();
    if (action === "draw-card") {
      const card = draw("human"); if (!card) { toast("Your deck is empty."); return; }
      addLog(`${player.name} drew a card manually.`);
    } else if (action === "hand-to-top" || action === "hand-to-bottom") {
      const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid);
      if (action === "hand-to-top") player.deck.push(instance); else player.deck.unshift(instance);
      match.selected = null;
      addLog(`${player.name} returned ${cardMap.get(instance.cardId)?.name || "a card"} to the ${action === "hand-to-top" ? "top" : "bottom"} of the deck.`);
    } else if (action === "damage-check" || action === "drive-check" || action === "trigger-check") {
      const top = player.deck.pop(); if (!top) { toast("Your deck is empty."); return; }
      if (action === "damage-check") player.damage.push({ ...top, faceDown: false }); else player.hand.push(top);
      const checkName = action === "damage-check" ? "damage" : action === "trigger-check" ? "trigger" : "drive";
      addLog(`${player.name} performed a ${checkName} check and revealed ${cardMap.get(top.cardId)?.name || "a card"}. Resolve trigger effects manually.`);
    } else if (action.startsWith("place:")) {
      const zone = action.slice(6);
      if (zone === "vanguard") {
        const instance = selectedHandCard();
        if (!instance || match.phase !== 2) { toast("Select a card during Ride phase to ride it."); return; }
        player.hand = player.hand.filter((item) => item.uid !== instance.uid); if (player.vanguard) player.soul.push(player.vanguard); player.vanguard = { ...instance, rested: false }; match.selected = null;
        addLog(`${player.name} rode ${cardMap.get(instance.cardId)?.name || "a card"} to vanguard.`);
        renderMatch(); return;
      }
      const index = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)].indexOf(zone);
      const instance = selectedHandCard();
      if (!instance || index < 0 || player.rear[index]) { toast("Select a card and choose an empty rear-guard circle."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); player.rear[index] = { ...instance, rested: false }; match.selected = null;
      addLog(`${player.name} placed ${cardMap.get(instance.cardId)?.name || "a card"} in the ${zone} circle.`);
    } else if (action === "play-order") {
      const instance = selectedHandCard();
      if (!instance || !/Order/i.test(cardMap.get(instance.cardId)?.type || "")) { toast("Select an Order card in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); player.orders.push(instance); match.selected = null;
      addLog(`${player.name} played ${cardMap.get(instance.cardId)?.name || "an Order"} to the Order zone.`);
    } else if (action === "bind") {
      const field = findFieldCard(match.selected); const hand = selectedHandCard(); const instance = hand || (field?.side === "human" ? field.instance : null);
      if (!instance) { toast("Select a card in your hand or on your field to bind it."); return; }
      if (hand) player.hand = player.hand.filter((item) => item.uid !== instance.uid); else if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.bind ||= []; player.bind.push(instance); match.selected = null; addLog(`${player.name} bound ${cardMap.get(instance.cardId)?.name || "a card"}.`);
    } else if (action.startsWith("reveal-action:")) {
      const [, choice, uid] = action.split(":"); const reveal = match.revealed; if (!reveal || reveal.owner !== "human") return;
      const index = reveal.cards.findIndex((item) => item.uid === uid); if (index < 0) return; const instance = reveal.cards.splice(index, 1)[0];
      if (choice === "hand") player.hand.push(instance); else if (choice === "soul") player.soul.push(instance); else player.drop.push(instance);
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a revealed card"} to ${choice === "hand" ? "hand" : choice === "soul" ? "Soul" : "Drop"}.`);
      if (!reveal.cards.length) { match.revealed = null; $("#reveal-dialog").close(); } else renderSharedReveal();
    } else if (action === "reveal-done") {
      if (match.revealed?.owner === "human") { player.deck.push(...match.revealed.cards.slice().reverse()); match.revealed = null; $("#reveal-dialog").close(); addLog(`${player.name} finished looking; unchosen cards returned to the top of the deck.`); }
    } else if (action.startsWith("reveal-top:")) {
      if (!player.deck.length) { toast("Your deck is empty."); return; }
      if (match.revealed?.cards?.length) { toast("Finish the current reveal first."); return; }
      const count = Math.max(1, Math.min(player.deck.length, Number(action.split(":")[1]) || 1)); const cards = []; for (let i = 0; i < count; i++) cards.push(player.deck.pop());
      match.revealed = { owner: "human", cards }; addLog(`${player.name} revealed ${cards.length} card${cards.length === 1 ? "" : "s"} from the top of the deck.`); renderSharedReveal();
    } else if (action.startsWith("zone-move:")) {
      const [, source, choice, uid, targetZone] = action.split(":");
      const sourceZones = { deck: player.deck, bind: player.bind || [], gdeck: player.gDeck || [], soul: player.soul || [] };
      const sourceCards = sourceZones[source], index = sourceCards?.findIndex((item) => item.uid === uid) ?? -1;
      if (index < 0) return;
      if (choice === "field") {
        const instance = sourceCards[index], card = cardMap.get(instance.cardId);
        if (!/Unit/i.test(card?.type || "")) { toast("Only a Unit can be placed on the field."); return; }
        const rearZones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
        if (targetZone === "vanguard") { sourceCards.splice(index, 1); if (player.vanguard) player.soul.push(player.vanguard); player.vanguard = { ...instance, rested: false }; }
        else { const rearIndex = rearZones.indexOf(targetZone); if (rearIndex < 0 || player.rear[rearIndex]) { toast("Choose an empty Rear-Guard circle."); return; } sourceCards.splice(index, 1); player.rear[rearIndex] = { ...instance, rested: false }; }
        match.selected = null;
        addLog(`${player.name} moved ${card?.name || "a Unit"} from ${source === "soul" ? "Soul" : "a zone"} to the field.`); return;
      }
      const instance = sourceCards.splice(index, 1)[0];
      if (choice === "hand") player.hand.push(instance);
      else if (choice === "soul") player.soul.push(instance);
      else if (choice === "bind") { player.bind ||= []; player.bind.push(instance); }
      else if (choice === "field") return;
      else if (choice === "deck-top") player.deck.push(instance);
      else if (choice === "deck-bottom") player.deck.unshift(instance);
      else player.drop.push(instance);
      const destination = { hand: "hand", soul: "Soul", bind: "Bind", drop: "Drop", "deck-top": "the top of the deck", "deck-bottom": "the bottom of the deck" }[choice] || "Drop";
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a card"} from ${source === "gdeck" ? "the G deck" : source === "bind" ? "Bind" : source === "soul" ? "Soul" : "the deck"} to ${destination}.`);
    } else if (action.startsWith("deck-action:")) {
      const [, choice, uid] = action.split(":"); const index = player.deck.findIndex((item) => item.uid === uid); if (index < 0) return; const instance = player.deck.splice(index, 1)[0];
      if (choice === "hand") player.hand.push(instance); else if (choice === "soul") player.soul.push(instance); else player.drop.push(instance);
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a card"} from the deck to ${choice === "hand" ? "hand" : choice === "soul" ? "Soul" : "Drop"}.`); renderMatch(); return;
    } else if (action.startsWith("damage-action:")) {
      const [, choice, uid] = action.split(":"); const index=player.damage.findIndex((item)=>item.uid===uid); if(index<0)return; const damage=player.damage[index];
      if(choice==="heal"){player.drop.push(player.damage.splice(index,1)[0]);}else damage.faceDown=choice === "counter-blast";
      $("#damage-dialog").close(); addLog(`${player.name} ${choice === "heal" ? "healed" : choice === "counter-blast" ? "Counter-Blasted" : "Counter-Charged"} ${cardMap.get(damage.cardId)?.name || "a damage card"}${choice === "heal" ? " to Drop" : ""}.`);
    } else if (action.startsWith("drop-action:")) {
      const [, choice, uid, zone] = action.split(":"); const index=player.drop.findIndex((item)=>item.uid===uid); if(index<0)return; const instance=player.drop[index];
      if(choice==="hand"){player.hand.push(player.drop.splice(index,1)[0]);} else if(choice==="soul"){player.soul.push(player.drop.splice(index,1)[0]);} else if(choice==="bind"){player.bind.push(player.drop.splice(index,1)[0]);} else if(choice==="deck-top"){player.deck.push(player.drop.splice(index,1)[0]);} else if(choice==="deck-bottom"){player.deck.unshift(player.drop.splice(index,1)[0]);}
      else if(choice==="field"){const fields=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>"accel-"+(i+1))];if(zone==="vanguard"){if(player.vanguard)player.soul.push(player.vanguard);player.vanguard={...player.drop.splice(index,1)[0],rested:false};}else{const ix=fields.indexOf(zone);if(ix<0||player.rear[ix]){toast("Choose an empty field circle first.");return;}player.rear[ix]={...player.drop.splice(index,1)[0],rested:false};}}
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name||"a Drop card"} ${choice==="hand"?"to hand":choice==="soul"?"to Soul":choice==="bind"?"to Bind":choice==="field"?"to the field":choice==="deck-top"?"to the top of the deck":"to the bottom of the deck"}.`);
    } else if (action === "counter-blast" || action === "counter-charge" || action === "heal-damage") { openDamageDialog(action); return;
    } else if (action.startsWith("soul-blast:")) {
      const wanted = new Set(action.slice("soul-blast:".length).split(",").filter(Boolean));
      const blasted = player.soul.filter((instance) => wanted.has(instance.uid));
      if (!blasted.length) { toast("Select at least one card in your soul."); return; }
      player.soul = player.soul.filter((instance) => !wanted.has(instance.uid)); player.drop.push(...blasted); addLog(`${player.name} Soul-Blasted ${blasted.length} card${blasted.length === 1 ? "" : "s"} to Drop.`);
    } else if (action === "soul-charge") {
      const top = player.deck.pop(); if (!top) { toast("Your deck is empty."); return; }
      player.soul.push(top); addLog(`${player.name} Soul-Charged ${cardMap.get(top.cardId)?.name || "a card"}.`);
    } else if (action === "lock") {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") { toast("Select one of your cards on the field to lock or unlock it."); return; }
      field.instance.locked = !field.instance.locked; addLog(`${player.name} ${field.instance.locked ? "locked" : "unlocked"} ${cardMap.get(field.instance.cardId)?.name || "a card"}.`);
    } else if (action === "rest-selected" || action === "stand-selected") {
      const field = findFieldCard(match.selected);
      if (!field || field.side !== "human") { toast("Select one of your cards on the field first."); return; }
      field.instance.rested = action === "rest-selected";
      const actionWord = field.instance.rested ? "rested" : "stood";
      const cardName = cardMap.get(field.instance.cardId)?.name || "a card";
      addLog(`${player.name} ${actionWord} ${cardName}.`);
      toast(`${cardName} ${actionWord}.`);
    } else if (action === "power") {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") { toast("Select one of your units first."); return; }
      field.instance.powerBoost = Number(field.instance.powerBoost || 0) + 5000; addLog(`${player.name} gave ${cardMap.get(field.instance.cardId)?.name || "a unit"} +5000 power.`);
    } else if (action.startsWith("gift-force:")) {
      const [, type, zone] = action.split(":");
      const zones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
      if (!zones.includes(zone)) { toast("Choose a circle for the Force marker."); return; }
      player.giftZones.push({ type, zone }); player.gifts = (player.gifts || 0) + 1; addLog(`${player.name} placed ${type} on ${zone}.`);
    } else if (action.startsWith("gift-accel:")) {
      const type = action.slice("gift-accel:".length); player.accelZones = (player.accelZones || 0) + 1; player.rear.push(null); player.gifts = (player.gifts || 0) + 1; addLog(`${player.name} created an ${type} circle.`);
    } else if (action === "shuffle") {
      shuffle(player.deck); addLog(`${player.name} shuffled their deck.`);
    } else if (action === "move-rear") {
      const field = findFieldCard(match.selected);
      if (field?.side !== "human" || field.zone === "vanguard") { toast("Select one of your Rear-Guards first."); return; }
      match.moveRearUid = field.instance.uid; toast("Choose a Rear-Guard circle. An occupied circle swaps the units.");
    } else if (action.startsWith("move-rear-to:")) {
      const [, uid, zone] = action.split(":");
      if (match.moveRearUid !== uid) { toast("Select a Rear-Guard and choose Move / Swap again."); return; }
      moveRearCardToZone(uid, zone); return;
    } else if (action === "stride" || action.startsWith("stride:")) {
      if (action === "stride") { openGDeckDialog("stride"); return; }
      const uid = action.slice("stride:".length); const unitIndex = player.gDeck?.findIndex((item) => item.uid === uid) ?? -1;
      const unit = unitIndex >= 0 ? player.gDeck.splice(unitIndex, 1)[0] : null; if (!unit) { toast("Choose a G Unit still in your G deck."); return; }
      if (player.vanguard) player.gZone.push({ ...player.vanguard, faceUp: true });
      player.vanguard = { ...unit, rested: false }; match.selected = null; addLog(`${player.name} strode ${cardMap.get(unit.cardId)?.name || "a G Unit"} from the G deck.`);
    } else if (action === "gdeck-to-g") {
      const unit = player.gDeck?.pop(); if (!unit) { toast("Your G deck is empty."); return; }
      player.gZone.push({ ...unit, faceUp: true }); addLog(`${player.name} placed a G-deck card face up in the G zone.`);
    } else if (action === "field-to-g") {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") { toast("Select a unit on your field first."); return; }
      const playerZone = field.zone === "vanguard" ? "vanguard" : "rear";
      if (playerZone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.gZone.push({ ...field.instance, faceUp: true }); match.selected = null; addLog(`${player.name} moved a field unit face up to the G zone.`);
    } else if (action === "flip-g-unit") {
      if (!player.gZone?.length) { toast("Your G zone is empty."); return; }
      player.extra.push(player.gZone.shift()); addLog(`${player.name} turned a G-zone card face down.`);
    } else if (action === "g-guard" || action.startsWith("g-guard:")) {
      if (!match.pendingAttack) { toast("Use G-guard while defending an attack."); return; }
      if (action === "g-guard") { openGDeckDialog("g-guard"); return; }
      const uid = action.slice("g-guard:".length); const index = player.gDeck?.findIndex((item) => item.uid === uid) ?? -1;
      const instance = index >= 0 ? player.gDeck.splice(index, 1)[0] : null; if (!instance) { toast("Choose a G-guard from your G deck."); return; }
      player.gZone.push({ ...instance, faceUp: true, guarding: true }); match.pendingAttack = null; match.selected = null;
      addLog(`${player.name} paid the G-guard cost and defended. Resolve shield effects manually.`);
      if (!online.role) setTimeout(nextBotAttack, 450);
    } else if (action === "guard") {
      if (!match.pendingAttack) { toast("There is no incoming attack to guard."); return; }
      humanGuard(); return;
    } else if (action.startsWith("order-to-drop:")) {
      const uid = action.slice("order-to-drop:".length), index = player.orders.findIndex((item) => item.uid === uid);
      if (index < 0) return;
      player.drop.push(player.orders.splice(index, 1)[0]); addLog(`${player.name} moved an Order from the Order zone to drop.`);
    } else if (action === "selected-to-drop") {
      const hand = selectedHandCard(), field = findFieldCard(match.selected);
      if (hand) { player.hand = player.hand.filter((item) => item.uid !== hand.uid); player.drop.push(hand); addLog(`${player.name} moved ${cardMap.get(hand.cardId)?.name || "a card"} from hand to Drop.`); }
      else if (field?.side === "human") { if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null; player.drop.push(field.instance); addLog(`${player.name} moved ${cardMap.get(field.instance.cardId)?.name || "a unit"} from the field to Drop.`); }
      else { toast("Select a card in your hand or on your field first."); return; }
      match.selected = null;
    } else if (action === "selected-to-soul") {
      const hand = selectedHandCard(), field = findFieldCard(match.selected);
      if (hand) { player.hand = player.hand.filter((item) => item.uid !== hand.uid); player.soul.push(hand); addLog(`${player.name} moved ${cardMap.get(hand.cardId)?.name || "a card"} from hand to Soul.`); }
      else if (field?.side === "human") { if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null; player.soul.push(field.instance); addLog(`${player.name} moved ${cardMap.get(field.instance.cardId)?.name || "a unit"} from the field to Soul.`); }
      else { toast("Select a card in your hand or on your field first."); return; }
      match.selected = null;
    } else if (action === "add-damage" || action === "hand-to-damage") {
      if (!card) { toast("Select a card in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== card.uid); player.damage.push(card); match.selected = null;
      addLog(`${player.name} moved ${cardMap.get(card.cardId)?.name || "a card"} from hand to damage.`);
    } else if (action === "quick-shield") {
      player.quickShields = (player.quickShields || 0) + 1; player.hand.push({ uid: `quick-shield-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, cardId: "token-quick-shield", isToken: true }); addLog(`${player.name} added a Quick Shield placeholder to hand.`);
    }
    renderMatch();
  }
  function flipSide(side) { return side === "human" ? "bot" : side === "bot" ? "human" : side; }
  function onlineDeck() {
    if (builder.cards && deckCount(builder)) return { name: builder.name || "My Deck", cards: { ...builder.cards }, starterCardId: builder.starterCardId || "" };
    return defaultDeck();
  }
  function setOnlineError(message = "") { $("#online-error").textContent = message; }
  function setConnectionPill(label) { $("#connection-pill").innerHTML = `<i></i> ${escapeHtml(label)}`; }
  function openOnlineDialog(mode, invite = "") {
    online.dialogMode = mode;
    $("#online-dialog-title").textContent = mode === "host" ? "Host an online match" : "Join an online match";
    $("#online-dialog-copy").textContent = mode === "host" ? "Create a link and send it to your friend. Keep this page open while you play." : "Paste the invite link or room code your friend sent you.";
    $("#online-confirm").textContent = mode === "host" ? "Create invite" : "Join match";
    $("#join-code-wrap").classList.toggle("hidden", mode !== "join"); $("#host-room-fields").classList.toggle("hidden", mode !== "host");
    $("#online-name").value = localStorage.getItem("vanguardArenaPlayerName") || "Player";
    $("#join-code").value = invite;
    if (mode === "join") void loadOpenRooms();
    setOnlineError("");
    $("#online-dialog").showModal();
  }
  async function loadOpenRooms() {
    const list = $("#room-list"); list.innerHTML = '<option value="">Loading rooms…</option>';
    if (!account.client) { list.innerHTML = '<option value="">Room directory unavailable</option>'; return; }
    const { data, error } = await account.client.rpc("list_match_rooms");
    if (error) { list.innerHTML = '<option value="">Room directory needs setup</option>'; return; }
    const rooms = data || []; list.innerHTML = rooms.length ? '<option value="">Choose an open room…</option>' + rooms.map((room) => `<option value="${escapeHtml(room.room_code)}">${escapeHtml(room.room_name)} · ${escapeHtml(room.host_name)} · ${escapeHtml(room.room_code)}</option>`).join("") : '<option value="">No open rooms found</option>';
  }
  function onlinePeerError(error) {
    const message = error?.type === "peer-unavailable" ? "That invite is no longer active. Ask your friend to create a new one." : `Online connection error: ${error?.message || error?.type || "please try again"}`;
    setOnlineError(message); toast(message);
  }
  function getInviteId(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try { const url = new URL(text); return url.searchParams.get("join") || url.searchParams.get("watch") || ""; } catch { return text; }
  }
  function sanitizedDeck(deck) {
    const cards = {};
    Object.entries(deck?.cards || {}).forEach(([id, qty]) => { if (cardMap.has(id)) cards[id] = Math.max(0, Math.min(4, Number(qty) || 0)); });
    return { name: String(deck?.name || "Online Deck").slice(0, 40), cards, starterCardId: cardMap.has(deck?.starterCardId) ? deck.starterCardId : "" };
  }
  function revealLocalMatch() { if (!match) return; $("#match-layout").classList.remove("hidden"); $("#match-empty").classList.add("hidden"); showView("play"); }
  function snapshotForGuest() {
    const snapshot = JSON.parse(JSON.stringify(match));
    snapshot.players = { human: snapshot.players.bot, bot: snapshot.players.human };
    snapshot.side = flipSide(snapshot.side);
    if (snapshot.revealed?.owner) snapshot.revealed.owner = flipSide(snapshot.revealed.owner);
    const visibleIds = new Set(snapshot.players.human.hand.map((card) => card.uid));
    [snapshot.players.human.vanguard, ...snapshot.players.human.rear].filter(Boolean).forEach((card) => visibleIds.add(card.uid));
    if (!visibleIds.has(snapshot.selected)) snapshot.selected = null;
    snapshot.players.bot.hand = snapshot.players.bot.hand.map((_, i) => ({ uid: `hidden-${i}`, cardId: null }));
    return snapshot;
  }
  function sendOnlineSnapshot() {
    if (online.role !== "host" || !match) return;
    try {
      if (online.connection?.open) online.connection.send({ type: "state", match: snapshotForGuest() });
      const publicMatch = JSON.parse(JSON.stringify(match));
      for (const side of ["human", "bot"]) publicMatch.players[side].hand = publicMatch.players[side].hand.map((_, i) => ({ uid: `hidden-${side}-${i}`, cardId: null }));
      online.watchers = online.watchers.filter((connection) => connection.open);
      online.watchers.forEach((connection) => connection.send({ type: "watch-state", match: publicMatch }));
      $("#spectator-count").textContent = `${online.watchers.length} spectator${online.watchers.length === 1 ? "" : "s"}`;
    } catch { setOnlineError("Unable to send the latest match state. Reconnect and try again."); }
  }
  function updateGuestState(snapshot) {
    if (!snapshot) return;
    match = snapshot;
    match.log = (match.log || []).map((entry) => ({ ...entry, time: new Date(entry.time) }));
    selectedCard = null; selectedZone = null;
    if (online.role === "guest" && match.players?.human) match.players.human.name = online.localName || match.players.human.name;
    revealLocalMatch(); renderMatch(); if($("#deck-view-dialog").open)openMyDeck(); if($("#drop-dialog").open)openDropDialog($("#drop-dialog").dataset.side); if($("#bind-dialog").open)openBindDialog(); if($("#gdeck-dialog").open)openGDeckDialog($("#gdeck-dialog").dataset.kind); if($("#soul-dialog").open)openSoulDialog($("#soul-dialog").dataset.blast==="1",$("#soul-dialog").dataset.side||"human");
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
    if (online.role === "watcher" && message.type === "watch-state") { updateGuestState(message.match); $("#match-status").textContent = "SPECTATING · LIVE"; return; }
    if (online.role !== "host" || !match || !["action", "select"].includes(message.type)) return;
    const players = match.players;
    match.players = { human: players.bot, bot: players.human };
    match.side = flipSide(match.side);
    if (match.revealed?.owner) match.revealed.owner = flipSide(match.revealed.owner);
    match.selected = message.selected || null;
    online.applyingRemote = true;
    try {
      if (message.type === "select") renderMatch();
      else if (message.action?.startsWith("manual:")) manualGameAction(message.action.slice(8));
      else ({ draw: drawForHuman, ride: rideHuman, call: callHuman, attack: resolveHumanAttack, guard: humanGuard, noGuard, endTurn, advance: advancePhase }[message.action] || (() => {}))();
    } finally {
      match.players = players;
      match.side = flipSide(match.side);
      if (match.revealed?.owner) match.revealed.owner = flipSide(match.revealed.owner);
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
    if (!account.client) { setOnlineError("Room discovery needs the configured Supabase connection."); return; }
    if (!$("#room-password").value.trim()) { setOnlineError("Set a room password before creating the room."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    online.role = "host"; setConnectionPill("CONNECTING"); online.peer = new Peer();
    online.peer.on("open", async (id) => {
      const roomCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const { error } = await account.client.rpc("create_match_room", { p_room_code: roomCode, p_peer_id: id, p_room_name: $("#room-name").value.trim() || "Vanguard room", p_host_name: online.localName, p_password: $("#room-password").value });
      if (error) { setOnlineError("Could not publish this room. Run supabase/match-rooms.sql in the Supabase SQL Editor, then try again."); online.peer.destroy(); online.peer = null; online.role = null; return; }
      online.roomId = id; online.publicRoomCode = roomCode; $("#online-dialog").close(); startMatch(onlineDeck());
      online.heartbeat = setInterval(() => { if (account.client && online.publicRoomCode) void account.client.rpc("touch_match_room", { p_room_code: online.publicRoomCode }); }, 60000);
      match.players.human.name = online.localName; $("#online-invite").classList.remove("hidden");
      const invite = new URL(location.href); invite.searchParams.set("join", roomCode); invite.hash = "play"; $("#invite-link").value = invite.toString();
      const watch = new URL(location.href); watch.searchParams.delete("join"); watch.searchParams.set("watch", roomCode); watch.hash = "play"; $("#spectate-link").value = watch.toString();
      setConnectionPill("WAITING"); setMessage("Invite link ready — waiting for your friend to join."); renderMatch();
    });
    online.peer.on("connection", (connection) => {
      const onFirstData = (message) => {
        connection.off("data", onFirstData);
        if (message?.type === "watch") {
          online.watchers.push(connection);
          connection.on("close", () => { online.watchers = online.watchers.filter((item) => item !== connection); sendOnlineSnapshot(); });
          connection.on("error", onlinePeerError); sendOnlineSnapshot();
        } else if (message?.type === "join" && !online.connection?.open) {
          bindOnlineConnection(connection, "host"); handleRemoteMessage(message);
        } else connection.close();
      };
      connection.on("data", onFirstData);
    });
    online.peer.on("error", onlinePeerError);
  }
  async function beginJoining() {
    const roomCode = getInviteId($("#join-code").value);
    if (!roomCode) { setOnlineError("Choose an open room or enter a room code."); return; }
    if (!account.client) { setOnlineError("Room discovery needs the configured Supabase connection."); return; }
    const { data: roomPeer, error: roomError } = await account.client.rpc("resolve_match_room", { p_room_code: roomCode, p_password: $("#join-password").value });
    const roomId = typeof roomPeer === "string" ? roomPeer : Array.isArray(roomPeer) ? roomPeer[0]?.peer_id : roomPeer?.peer_id;
    if (roomError || !roomId) { setOnlineError("Room not found, closed, or password is incorrect."); return; }
    if (!window.Peer) { setOnlineError("The online connection library did not load. Check your internet connection and reload."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    const watching = $("#online-join-role").value === "spectator" || new URLSearchParams(location.search).has("watch");
    online.role = watching ? "watcher" : "guest"; online.roomId = roomId; online.publicRoomCode = roomCode; setConnectionPill("CONNECTING"); online.peer = new Peer();
    online.peer.on("open", () => {
      if (watching) {
        const connection = online.peer.connect(roomId, { reliable: true }); online.connection = connection;
        connection.on("open", () => connection.send({ type: "watch", name: online.localName }));
        connection.on("data", (message) => { if (message?.type === "watch-state") { updateGuestState(message.match); $("#match-status").textContent = "SPECTATING · LIVE"; } });
        connection.on("close", () => { setConnectionPill("DISCONNECTED"); toast("Host disconnected."); }); connection.on("error", onlinePeerError);
      } else bindOnlineConnection(online.peer.connect(roomId, { reliable: true }), "guest");
    });
    online.peer.on("error", onlinePeerError);
    $("#online-dialog").close(); setMessage("Connecting to your friend's match…");
  }
  function endOnlineSession() {
    if (online.heartbeat) clearInterval(online.heartbeat);
    if (online.role === "host" && online.publicRoomCode && account.client) void account.client.rpc("close_match_room", { p_room_code: online.publicRoomCode });
    try { online.connection?.close(); online.watchers?.forEach((connection) => connection.close()); online.peer?.destroy(); } catch {}
    online = { role: null, peer: null, connection: null, watchers: [], roomId: null, publicRoomCode: null, heartbeat: null, applyingRemote: false, dialogMode: "host" };
    setConnectionPill("READY");
    $("#online-invite").classList.add("hidden");
  }
  function performOnlineAction(action) {
    if (online.role === "watcher") { toast("Spectators can watch but cannot change the match."); return; }
    if (online.role === "guest") {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      online.connection.send({ type: "action", action, selected: match?.selected || null }); return;
    }
    ({ draw: drawForHuman, ride: rideHuman, call: callHuman, attack: resolveHumanAttack, guard: humanGuard, noGuard, endTurn, advance: advancePhase }[action] || (() => {}))();
  }
  function openGiftDialog(kind) {
    const dialog = $("#gift-dialog"), force = kind === "force";
    $("#gift-type").innerHTML = force ? "<option>Force I</option><option>Force II</option>" : "<option>Accel I</option><option>Accel II</option>";
    $("#gift-zone-wrap").classList.toggle("hidden", !force);
    const player = match?.players.human, zones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player?.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
    const names = { "rear-left": "Front left", "rear-right": "Front right", "rear-back-left": "Back left", "rear-back-center": "Back center", "rear-back-right": "Back right" };
    $("#gift-zone").innerHTML = '<option value="">Choose a circle…</option>' + zones.map((zone) => `<option value="${zone}">${names[zone] || `Accel ${zone.split("-")[1]}`}</option>`).join("");
    dialog.dataset.kind = kind; dialog.showModal();
  }
  function openSoulDialog(blast = false, side = "human") {
    if (!match) { toast("Start a match to view Soul."); return; }
    const player = match.players[side], soul = player?.soul || [], canAct = side === "human" && online.role !== "watcher";
    blast = Boolean(blast && canAct);
    $("#soul-dialog-title").textContent = blast ? "Choose Soul Blast cards" : `${player.name}'s Soul`;
    $("#soul-dialog-help").textContent = blast ? "Select Soul cards to move to Drop." : `${soul.length} card${soul.length === 1 ? "" : "s"} under this Vanguard.`;
    $("#soul-blast-confirm").classList.toggle("hidden", !blast);
    $("#soul-blast-cancel").textContent = blast ? "Cancel" : "Stop viewing Soul";
    $("#soul-card-list").innerHTML = soul.length ? soul.map((instance) => { const card = cardMap.get(instance.cardId); return card ? `<article class="zone-view-card"><button class="zone-card-face${blast ? " selectable" : ""}" type="button" data-soul-uid="${escapeHtml(instance.uid)}" data-card-zoom="${escapeHtml(card.id)}">${cardImage(card)}<b>${escapeHtml(card.name)}</b></button>${canAct && !blast ? zoneMoveControls(instance,"soul") : ""}</article>` : ""; }).join("") : `<p class="zone-empty-message">${escapeHtml(player.name)}'s Soul is empty.</p>`;
    $("#soul-dialog").dataset.blast = blast ? "1" : "0"; $("#soul-dialog").dataset.side = side; if (!$("#soul-dialog").open) $("#soul-dialog").showModal();
  }
  function openDropDialog(side = "human") {
    if (!match) { toast("Start a match to view Drop."); return; }
    const own=side==="human", player=match.players[side], cards=player.drop||[];
    $("#drop-dialog-title").textContent=own?"Your Drop zone":player.name+" · Drop zone";
    const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>"accel-"+(i+1))];
    const labels={"rear-left":"Front left Rear-Guard","rear-right":"Front right Rear-Guard","rear-back-left":"Back left Rear-Guard","rear-back-center":"Back center Rear-Guard","rear-back-right":"Back right Rear-Guard"};
    const fieldOptions='<option value="">Move to field…</option><option value="vanguard">Vanguard</option>'+zones.map((zone,i)=>({zone,i,label:labels[zone]||("Accel "+(i-4))})).filter(({i})=>!player.rear[i]).map(({zone,label})=>'<option value="'+zone+'">'+label+'</option>').join("");
    $("#drop-card-list").innerHTML=cards.length?cards.map((instance)=>{const c=cardMap.get(instance.cardId);if(!c)return "";const unit=/Unit/i.test(c.type||"");const moves=own?'<div class="peek-actions"><button class="button" data-drop-action="hand:'+escapeHtml(instance.uid)+'">Add to hand</button><button class="button" data-drop-action="soul:'+escapeHtml(instance.uid)+'">Add to Soul</button><button class="button" data-drop-action="bind:'+escapeHtml(instance.uid)+'">Bind card</button>'+(unit?'<select class="text-input drop-field-select" data-drop-uid="'+escapeHtml(instance.uid)+'">'+fieldOptions+'</select>':'')+'<button class="button" data-drop-action="deck-top:'+escapeHtml(instance.uid)+'">Return to deck top</button><button class="button" data-drop-action="deck-bottom:'+escapeHtml(instance.uid)+'">Return to deck bottom</button></div>':'';return '<article class="zone-view-card"><button class="zone-card-face" type="button" data-card-zoom="'+escapeHtml(c.id)+'">'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button>'+moves+'</article>';}).join(""):'<p class="zone-empty-message">No cards in Drop yet.</p>';
    $("#drop-dialog").dataset.side=side;if(!$("#drop-dialog").open)$("#drop-dialog").showModal();
  }
  function zoneMoveControls(instance, source, canAct = true) {
    if (!canAct) return "";
    const card = cardMap.get(instance.cardId), unit = /Unit/i.test(card?.type || "");
    const button = (choice, label) => `<button class="button" type="button" data-zone-move="${source}:${choice}:${escapeHtml(instance.uid)}">${label}</button>`;
    const zones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: match.players.human.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
    const fieldOptions = zones.map((zone, i) => match.players.human.rear[i] ? "" : '<option value="' + zone + '">' + zone.replace("rear-", "").replace("back-", "back ").replaceAll("-", " ") + '</option>').join("");
    const fieldControl = source === "soul" && unit ? '<select class="text-input drop-field-select" data-soul-field-uid="' + escapeHtml(instance.uid) + '"><option value="">Move Unit to field…</option><option value="vanguard">Vanguard</option>' + fieldOptions + '</select>' : "";
    return '<div class="peek-actions">' + button("hand", "Add to hand") + (source !== "soul" ? button("soul", "Add to Soul") : "") + button("drop", "Send to Drop") + (source !== "bind" ? button("bind", "Bind card") : "") + (source !== "deck" ? button("deck-top", "Return to deck top") : "") + (source !== "deck" ? button("deck-bottom", "Return to deck bottom") : "") + fieldControl + '</div>';
  }
  function renderInteractiveCards(instances, prefix, canAct = true) {
    if (!instances?.length) return '<p class="zone-empty-message">No cards here.</p>';
    return instances.map((instance) => { const card=cardMap.get(instance.cardId); if(!card)return ""; const controls=canAct?(prefix==="deck-action"?zoneMoveControls(instance,"deck"): '<div class="peek-actions"><button class="button" type="button" data-peek-action="'+prefix+':hand:'+escapeHtml(instance.uid)+'">Add to hand</button><button class="button" type="button" data-peek-action="'+prefix+':soul:'+escapeHtml(instance.uid)+'">Add to Soul</button><button class="button" type="button" data-peek-action="'+prefix+':drop:'+escapeHtml(instance.uid)+'">Send to Drop</button></div>'):''; return '<article class="zone-view-card"><button class="zone-card-face" type="button" data-card-zoom="'+escapeHtml(card.id)+'">'+cardImage(card)+'<b>'+escapeHtml(card.name)+'</b></button>'+controls+'</article>'; }).join("");
  }
  function openMyDeck() { if(!match){toast("Start a match to look through your deck.");return;} const cards=match.players.human.deck.slice().reverse(); $("#deck-view-title").textContent="Your deck · "+cards.length+" cards"; $("#deck-view-help").textContent="Choose any card to add to your hand, add a Unit to Soul, or send it to Drop."; $("#deck-view-list").innerHTML=renderInteractiveCards(cards,"deck-action"); if(!$("#deck-view-dialog").open)$("#deck-view-dialog").showModal(); }
  function openGDeckDialog(kind) {
    if (!match) { toast("Start a match first."); return; }
    const isGuard = kind === "g-guard";
    const allCards = match.players.human.gDeck || [];
    const cards = allCards.filter((item) => {
      const type = cardMap.get(item.cardId)?.type || "";
      return isGuard ? /G\s*-?Guardian|G\s*-?Guard/i.test(type) : /G\s*Unit/i.test(type) && !/G\s*-?Guardian|G\s*-?Guard/i.test(type);
    });
    $("#gdeck-dialog-title").textContent = isGuard ? "Choose a G-guard" : "Choose a G Unit to stride";
    $("#gdeck-dialog-help").textContent = isGuard ? "Choose a G Guardian from your G deck to place face up in the G zone." : "Choose which G Unit to ride over your Vanguard.";
    $("#gdeck-card-list").innerHTML = cards.length ? cards.map((item) => {
      const card = cardMap.get(item.cardId);
      return card ? '<article class="zone-view-card"><button class="zone-card-face" type="button" data-card-zoom="' + escapeHtml(card.id) + '">' + cardImage(card) + '<b>' + escapeHtml(card.name) + '</b></button><button class="button button-primary" type="button" data-gdeck-action="' + (isGuard ? "g-guard" : "stride") + ':' + escapeHtml(item.uid) + '">' + (isGuard ? "G-guard" : "Stride") + '</button>' + zoneMoveControls(item,"gdeck") + '</article>' : "";
    }).join("") : '<p class="zone-empty-message">No ' + (isGuard ? "G Guardians" : "G Units") + ' are available in your G deck.</p>';
    $("#gdeck-dialog").dataset.kind = kind;
    if (!$("#gdeck-dialog").open) $("#gdeck-dialog").showModal();
  }
  function renderSharedReveal() { const reveal=match?.revealed;if(!reveal?.cards?.length)return;const canAct=reveal.owner==="human"&&online.role!=="watcher";$("#reveal-dialog-title").textContent="Revealed cards · "+reveal.cards.length;$("#reveal-dialog-help").textContent=canAct?"Both players can see these cards. Move each to hand, Soul, or Drop, or finish looking to return the rest to the deck.":match.players.human.name+" revealed these cards. Both players can see them.";$("#reveal-card-list").innerHTML=renderInteractiveCards(reveal.cards,"reveal-action",canAct);$("#reveal-done").classList.toggle("hidden",!canAct);$("#reveal-close").classList.toggle("hidden",canAct);if(!$("#reveal-dialog").open)$("#reveal-dialog").showModal(); }
  function openBindDialog() { if(!match)return;const cards=match.players.human.bind||[];$("#bind-card-list").innerHTML=cards.length?cards.map((item)=>{const c=cardMap.get(item.cardId);return c?'<article class="zone-view-card"><button class="zone-card-face" type="button" data-card-zoom="'+escapeHtml(c.id)+'">'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button>'+zoneMoveControls(item,"bind")+'</article>':"";}).join(""):'<p class="zone-empty-message">No cards are bound.</p>';if(!$("#bind-dialog").open)$("#bind-dialog").showModal(); }
  function openDamageDialog(action) { if(!match){toast("Start a match first.");return;}const damage=match.players.human.damage||[];const eligible=damage.filter((item)=>action==="heal-damage"?true:action==="counter-blast"?!item.faceDown:item.faceDown);$("#damage-dialog-title").textContent=action==="heal-damage"?"Heal damage · choose a damage card":action==="counter-blast"?"Counter-Blast · choose face-up damage":"Counter-Charge · choose face-down damage";$("#damage-card-list").innerHTML=eligible.length?eligible.map((item)=>{const c=cardMap.get(item.cardId);return c?'<button class="zone-view-card" type="button" data-damage-action="'+(action==="heal-damage"?"heal":action)+':'+escapeHtml(item.uid)+'" title="Choose '+escapeHtml(c.name)+'">'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button>':"";}).join(""):'<p class="zone-empty-message">No eligible damage cards.</p>';$("#damage-dialog").dataset.action=action;$("#damage-dialog").showModal(); }
  function performManualAction(action) {
    if (action === "view-selected-soul") { openSoulDialog(false, "human"); return; }
    if (online.role === "watcher") { toast("Spectators can watch but cannot change the match."); return; }
    if (action === "soul-blast") { openSoulDialog(true); return; }
    if (action === "stride" || action === "g-guard") { if(action === "g-guard" && !match?.pendingAttack){toast("Use G-guard while defending an attack.");return;} openGDeckDialog(action); return; }
    if (action === "counter-blast" || action === "counter-charge" || action === "heal-damage") { openDamageDialog(action); return; }
    if (action.startsWith("zone-move:") || action.startsWith("deck-action:") || action.startsWith("reveal-action:") || action.startsWith("damage-action:") || action.startsWith("drop-action:") || action.startsWith("reveal-top:") || action === "reveal-done") { if(online.role==="guest"){if(!online.connection?.open){toast("You are disconnected from the match.");return;}online.connection.send({type:"action",action:"manual:"+action,selected:match?.selected||null});return;} manualGameAction(action); if(match)renderMatch(); if(action.startsWith("deck-action:") && $("#deck-view-dialog").open)openMyDeck(); if(action.startsWith("zone-move:") && $("#deck-view-dialog").open)openMyDeck(); if(action.startsWith("zone-move:") && $("#bind-dialog").open)openBindDialog(); if(action.startsWith("zone-move:") && $("#gdeck-dialog").open)openGDeckDialog($("#gdeck-dialog").dataset.kind); if(action.startsWith("zone-move:") && $("#soul-dialog").open)openSoulDialog($("#soul-dialog").dataset.blast==="1",$("#soul-dialog").dataset.side||"human"); if(action.startsWith("drop-action:") && $("#drop-dialog").open)openDropDialog($("#drop-dialog").dataset.side); return; }
    if (action === "reveal-top-cards") { if (!match) { toast("Start a match first."); return; } $("#reveal-count-dialog").showModal(); return; }
    if (action === "gift-force" || action === "gift-accel") { openGiftDialog(action === "gift-force" ? "force" : "accel"); return; }
    if (online.role === "guest") {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      online.connection.send({ type: "action", action: `manual:${action}`, selected: match?.selected || null }); return;
    }
    manualGameAction(action);
  }
  function exportDeck(deck, filename) {
    const content = JSON.stringify({ format: "Vanguard Arena local demo deck", name: deck.name, cards: deck.cards, starterCardId: deck.starterCardId || "", exportedAt: new Date().toISOString() }, null, 2);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "application/json" })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importDeckFile(file) {
    const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); const cards = data.cards || data; if (!cards || typeof cards !== "object") throw new Error("Invalid deck format"); builder = { id: null, name: data.name || file.name.replace(/\.json$/i, ""), cards: {}, starterCardId: data.starterCardId || "" }; Object.entries(cards).forEach(([id, qty]) => { if (cardMap.has(id)) builder.cards[id] = Math.max(0, Math.min(4, Number(qty) || 0)); }); renderBuilder(); showView("decks"); toast("Deck imported"); } catch { toast("Could not read that deck JSON"); } }; reader.readAsText(file);
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
  $("#account-button").addEventListener("click", openAccountDialog); $("#close-account-dialog").addEventListener("click", () => $("#account-dialog").close());
  $("#account-signup").addEventListener("click", accountSignUp); $("#account-signin").addEventListener("click", accountSignIn); $("#account-signout").addEventListener("click", accountSignOut); $("#account-reset").addEventListener("click", resetAccountPassword); $("#account-update-password").addEventListener("click", updateAccountPassword); $("#account-import-local").addEventListener("click", importLocalDecks);
  $("#profile-save").addEventListener("click", savePlayerProfile);
  $("#online-confirm").addEventListener("click", () => online.dialogMode === "host" ? beginHosting() : beginJoining());
  $("#refresh-rooms").addEventListener("click", () => void loadOpenRooms()); $("#room-list").addEventListener("change", () => { if ($("#room-list").value) $("#join-code").value = $("#room-list").value; });
  $("#online-cancel").addEventListener("click", () => $("#online-dialog").close()); $("#close-online-dialog").addEventListener("click", () => $("#online-dialog").close());
  $("#copy-invite").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#invite-link").value); toast("Invite link copied."); } catch { $("#invite-link").select(); document.execCommand("copy"); toast("Invite link copied."); } });
  $("#copy-spectate").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#spectate-link").value); toast("Spectator link copied."); } catch { $("#spectate-link").select(); document.execCommand("copy"); toast("Spectator link copied."); } });
  $("#new-match").addEventListener("click", () => { endOnlineSession(); startMatch(); }); $("#empty-start").addEventListener("click", () => { endOnlineSession(); startMatch(); }); $("#reset-match").addEventListener("click", newMatchButton);
  $("#draw-card").addEventListener("click", () => performOnlineAction("draw")); $("#ride-card").addEventListener("click", () => performOnlineAction("ride")); $("#call-card").addEventListener("click", () => performOnlineAction("call")); $("#attack-card").addEventListener("click", () => performOnlineAction("attack")); $("#guard-card").addEventListener("click", () => performOnlineAction("guard")); $("#play-order").addEventListener("click", () => performManualAction("play-order")); $("#end-turn").addEventListener("click", () => performOnlineAction("endTurn")); $("#advance-phase").addEventListener("click", () => performOnlineAction("advance"));
  $$("[data-manual-action]").forEach((button) => button.addEventListener("click", () => performManualAction(button.dataset.manualAction)));
  $("#hand-cards").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { e.stopPropagation(); showCardDetails(zoom.dataset.cardZoom); return; } const card = e.target.closest("[data-hand-uid]"); if (!card || !match || online.role === "watcher" || match.side !== "human") return; match.selected = match.selected === card.dataset.handUid ? null : card.dataset.handUid; if (online.role === "guest" && online.connection?.open) online.connection.send({ type: "select", selected: match.selected }); renderMatch(); });
  $(".game-table").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { e.stopPropagation(); showCardDetails(zoom.dataset.cardZoom); return; } const zone = e.target.closest(".field-zone[data-side='human']"); if (zone && match?.moveRearUid && zone.dataset.zone !== "vanguard") { performManualAction(`move-rear-to:${match.moveRearUid}:${zone.dataset.zone}`); return; } if (zone && !e.target.closest("[data-field-uid]") && match?.selected && selectedHandCard()) { performManualAction(`place:${zone.dataset.zone}`); return; } if (e.target.closest("[data-gdeck-side='human']")) { performManualAction("stride"); return; } const field = e.target.closest("[data-field-uid]"); if (!field || !match || online.role === "watcher" || field.dataset.side !== "human") return; const uid = field.dataset.fieldUid; if (match.moveRearUid) { if (field.dataset.zone === "vanguard") { toast("Choose a Rear-Guard circle, not the Vanguard circle."); return; } performManualAction(`move-rear-to:${match.moveRearUid}:${field.dataset.zone}`); return; } match.selected = match.selected === uid ? null : uid; if (online.role === "guest" && online.connection?.open) online.connection.send({ type: "select", selected: match.selected }); renderMatch(); });
  $("#gift-cancel").addEventListener("click", () => $("#gift-dialog").close()); $("#gift-close").addEventListener("click", () => $("#gift-dialog").close());
  $("#gift-confirm").addEventListener("click", (e) => { e.preventDefault(); const dialog = $("#gift-dialog"), type = $("#gift-type").value; if (dialog.dataset.kind === "force") { const zone = $("#gift-zone").value; if (!zone) { toast("Choose a circle for the Force marker."); return; } performManualAction(`gift-force:${type}:${zone}`); } else performManualAction(`gift-accel:${type}`); dialog.close(); });
  $("#view-soul").addEventListener("click", () => openSoulDialog(false,"human")); $("#view-opponent-soul").addEventListener("click", () => openSoulDialog(false,"bot")); $("#open-drop-zone").addEventListener("click", () => openDropDialog("human"));
  $(".opponent-field .vanguard-zone").addEventListener("click", (e) => { if (match && !e.target.closest("[data-card-zoom]") && e.target.closest("[data-field-uid]")) openSoulDialog(false,"bot"); });
  $("#open-my-deck").addEventListener("click", openMyDeck); $("#open-bind-zone").addEventListener("click", openBindDialog);
  $("#open-opponent-drop-zone").addEventListener("click",()=>openDropDialog("bot"));
  $$('[data-close-dialog]').forEach((button)=>button.addEventListener("click",()=>$("#"+button.dataset.closeDialog)?.close()));
  $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  $("#reveal-top-cards").addEventListener("click",()=>performManualAction("reveal-top-cards"));
  $("#reveal-count-confirm").addEventListener("click",()=>{const n=Math.max(1,Math.min(60,Number($("#reveal-count").value)||1));$("#reveal-count-dialog").close();performManualAction("reveal-top:"+n);});
  $("#reveal-done").addEventListener("click",()=>performManualAction("reveal-done"));
  $("#reveal-close").addEventListener("click",()=>$("#reveal-dialog").close());
  $("#deck-view-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const move=e.target.closest("[data-zone-move]");if(move)performManualAction("zone-move:"+move.dataset.zoneMove);});
  $("#reveal-card-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const action=e.target.closest("[data-peek-action]");if(action)performManualAction(action.dataset.peekAction);});
  $("#gdeck-card-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const move=e.target.closest("[data-zone-move]");if(move){performManualAction("zone-move:"+move.dataset.zoneMove);return;}const action=e.target.closest("[data-gdeck-action]");if(action){$("#gdeck-dialog").close();performManualAction(action.dataset.gdeckAction);}});
  $("#bind-card-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const move=e.target.closest("[data-zone-move]");if(move)performManualAction("zone-move:"+move.dataset.zoneMove);});
  $("#damage-card-list").addEventListener("click",(e)=>{const action=e.target.closest("[data-damage-action]");if(action){$("#damage-dialog").close();performManualAction("damage-action:"+action.dataset.damageAction);}});
  $("#close-soul-dialog").addEventListener("click", () => $("#soul-dialog").close()); $("#soul-blast-cancel").addEventListener("click", () => $("#soul-dialog").close());
  $("#soul-card-list").addEventListener("click", (e) => { const move=e.target.closest("[data-zone-move]");if(move){performManualAction("zone-move:"+move.dataset.zoneMove);return;}const zoom=e.target.closest("[data-card-zoom]");if(zoom&&!$("#soul-dialog").dataset.blast){showCardDetails(zoom.dataset.cardZoom);return;}const card=e.target.closest("[data-soul-uid]");if(card&&$("#soul-dialog").dataset.blast)card.classList.toggle("selected"); });
  $("#soul-card-list").addEventListener("change",(e)=>{const select=e.target.closest("[data-soul-field-uid]");if(select?.value)performManualAction("zone-move:soul:field:"+select.dataset.soulFieldUid+":"+select.value);});
  $("#soul-blast-confirm").addEventListener("click", () => { const ids = [...$$("#soul-card-list [data-soul-uid].selected")].map((node) => node.dataset.soulUid); if (!ids.length) { toast("Select at least one card to Soul Blast."); return; } performManualAction(`soul-blast:${ids.join(",")}`); $("#soul-dialog").close(); });
  $("#close-drop-dialog").addEventListener("click", () => $("#drop-dialog").close()); $("#drop-dialog-close").addEventListener("click", () => $("#drop-dialog").close());
  $("#drop-card-list").addEventListener("click", (e) => { const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const action=e.target.closest("[data-drop-action]");if(action)performManualAction("drop-action:"+action.dataset.dropAction); });
  $("#drop-card-list").addEventListener("change",(e)=>{const select=e.target.closest("[data-drop-uid]");if(select?.value)performManualAction("drop-action:field:"+select.dataset.dropUid+":"+select.value);});
  $("#human-damage").addEventListener("click", (e) => { if (e.target.closest("[data-card-zoom]")) return; performManualAction("counter-blast"); });
  $("#human-order-zone").addEventListener("click", (e) => { if (e.target.closest("[data-card-zoom]")) return; const order = e.target.closest("[data-order-uid]"); if (order) performManualAction(`order-to-drop:${order.dataset.orderUid}`); });
  $("#advance-phase").addEventListener("click", () => { if (match?.pendingAttack) return; });
  const noGuardButton = document.createElement("button"); noGuardButton.id = "no-guard"; noGuardButton.className = "button button-quiet hidden"; noGuardButton.textContent = "No guard"; noGuardButton.addEventListener("click", () => performOnlineAction("noGuard")); $(".action-buttons").insertBefore(noGuardButton, $("#guard-card"));
  $("#sort-hand").addEventListener("click", () => { if (!match) return; match.players.human.hand.sort((a, b) => { const ca = cardMap.get(a.cardId), cb = cardMap.get(b.cardId); return (ca?.grade || 0) - (cb?.grade || 0) || ca?.name.localeCompare(cb?.name); }); renderMatch(); });
  $("#clear-log").addEventListener("click", () => { if (match) { match.log = []; renderLog(); } });
  $("#create-deck").addEventListener("click", () => { emptyDeck(); showView("decks"); $("#deck-name").focus(); });
  $("#save-deck").addEventListener("click", saveDeck); $("#starter-vanguard").addEventListener("change", () => { builder.starterCardId = $("#starter-vanguard").value; renderBuilder(); }); $("#deck-name").addEventListener("input", () => { builder.name = $("#deck-name").value; $("#builder-title").textContent = builder.name || "Untitled deck"; });
  $("#card-search").addEventListener("input", () => { builderPage = 0; renderBuilderCards(); }); $("#grade-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-clan-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-nation-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); });
  $("#builder-prev").addEventListener("click", () => { builderPage = Math.max(0, builderPage - 1); renderBuilderCards(); }); $("#builder-next").addEventListener("click", () => { builderPage += 1; renderBuilderCards(); });
  $("#builder-card-grid").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { showCardDetails(zoom.dataset.cardZoom); return; } const node = e.target.closest("[data-card-id]"); if (!node) return; const id = node.dataset.cardId; builder.cards[id] = Math.min(4, (builder.cards[id] || 0) + 1); renderBuilder(); });
  $("#deck-list").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { showCardDetails(zoom.dataset.cardZoom); return; } const q = e.target.closest("[data-qty]"); const r = e.target.closest("[data-remove]"); if (q) { const id = q.dataset.id; builder.cards[id] = Math.max(0, Math.min(4, (builder.cards[id] || 0) + Number(q.dataset.qty))); if (!builder.cards[id]) delete builder.cards[id]; renderBuilder(); } if (r) { delete builder.cards[r.dataset.remove]; renderBuilder(); } });
  $("#saved-decks").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { showCardDetails(zoom.dataset.cardZoom); return; } const load = e.target.closest("[data-load-deck]"); const duplicate = e.target.closest("[data-duplicate-deck]"); const remove = e.target.closest("[data-delete-deck]"); const exp = e.target.closest("[data-export-saved]"); const decks = readSavedDecks(); if (load) { const d = decks.find((x) => x.id === load.dataset.loadDeck); if (d) loadDeck(d); } if (duplicate) { const d = decks.find((x) => x.id === duplicate.dataset.duplicateDeck); if (d) { const copy = { ...d, id: crypto.randomUUID?.() || String(Date.now()), name: `${d.name} Copy`, updatedAt: new Date().toISOString() }; decks.unshift(copy); writeSavedDecks(decks); renderSavedDecks(); toast("Deck duplicated"); } } if (remove) { const d = decks.find((x) => x.id === remove.dataset.deleteDeck); if (d && confirm(`Delete “${d.name}” from this browser?`)) { writeSavedDecks(decks.filter((x) => x.id !== d.id)); void deleteCloudDeck(d.id); renderSavedDecks(); } } if (exp) { const d = decks.find((x) => x.id === exp.dataset.exportSaved); if (d) exportDeck(d, `${d.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.json`); } });
  $("#export-deck").addEventListener("click", () => exportDeck(builder, `${builder.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.json`));
  $("#import-deck").addEventListener("click", () => $("#deck-file").click()); $("#deck-file").addEventListener("change", (e) => { if (e.target.files[0]) importDeckFile(e.target.files[0]); e.target.value = ""; });
  $("#library-search").addEventListener("input", () => { libraryPage = 0; renderLibrary(); }); $("#library-grade").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-clan").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-nation").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-prev").addEventListener("click", () => { libraryPage = Math.max(0, libraryPage - 1); renderLibrary(); }); $("#library-next").addEventListener("click", () => { libraryPage += 1; renderLibrary(); }); $("#library-grid").addEventListener("click", (e) => { const node = e.target.closest("[data-card-detail]"); if (node) showCardDetails(node.dataset.cardDetail); });
  $("#art-search").addEventListener("input", () => { artPage = 0; renderArtGallery(); });
  $("#art-prev").addEventListener("click", () => { artPage = Math.max(0, artPage - 1); renderArtGallery(); });
  $("#art-next").addEventListener("click", () => { artPage += 1; renderArtGallery(); });
  $("#art-grid").addEventListener("click", (e) => { const tile = e.target.closest("[data-art-id]"); if (tile) showArtImage(Number(tile.dataset.artId)); });
  $("#close-card-dialog").addEventListener("click", () => $("#card-dialog").close()); $("#help-button").addEventListener("click", () => $("#help-dialog").showModal()); $("#close-help-dialog").addEventListener("click", () => $("#help-dialog").close());
  $("#match-menu").addEventListener("click", () => { if (confirm("Start a new practice match? The current match will end.")) { endOnlineSession(); startMatch(); } });
  $("#card-dialog").addEventListener("click", (e) => { if (e.target === $("#card-dialog")) $("#card-dialog").close(); });
  populateClanFilters(); updateDeckCount(); renderBuilder(); renderLibrary(); renderArtGallery(); renderSavedDecks();
  initializeAccounts();
  const initial = ["play", "decks", "cards"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "play"; showView(initial);
  if (!readSavedDecks().length) { $("#match-layout").classList.add("hidden"); $("#match-empty").classList.remove("hidden"); }
  const inviteParams = new URLSearchParams(location.search); if (inviteParams.has("join") || inviteParams.has("watch")) { openOnlineDialog("join", location.href); if (inviteParams.has("watch")) $("#online-join-role").value = "spectator"; }
})();
