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
  const cardArtByDatabaseId = new Map(cardList.filter((c) => Number.isFinite(Number(c.dbId))).map((c) => [Number(c.dbId), c.image]));
  const upstreamCardArtBase = "https://raw.githubusercontent.com/justkidding047356/cardfight-area/c2a5aad1f1e348500f1942a890c7e39a95953719";
  function artThumbnailUrl(id) {
    const image = cardArtByDatabaseId.get(Number(id));
    if (image?.startsWith("https://")) return `${upstreamCardArtBase}/CardSpriteMini2/n${id}.jpg`;
    return Number(id) > 10504 ? `${upstreamCardArtBase}/CardSpriteMini2/n${id}.jpg` : `assets/cards/mini/n${id}.jpg`;
  }
  function artFullImageUrl(id) {
    const image = cardArtByDatabaseId.get(Number(id));
    if (image) return image;
    return Number(id) > 10504 ? `${upstreamCardArtBase}/CardSprite/n${id}.jpg` : `assets/cards/full/n${id}.jpg`;
  }
  cardMap.set("token-quick-shield", { id: "token-quick-shield", name: "Quick Shield", grade: 0, nation: "Token", power: 0, shield: 5000, type: "Quick Shield Token", text: "Provides 5,000 shield when used to guard.", color: "#a39bff", glyph: "◇", source: "Vanguard Arena token" });
  cardMap.set("token-guardian-shield", { id: "token-guardian-shield", name: "Guardian Shield", grade: 0, nation: "Token", power: 0, shield: 2000, type: "Guardian Shield Token", text: "Provides 2,000 shield when used to guard.", color: "#89d4ee", glyph: "◇", source: "Vanguard Arena token" });
  cardMap.set("token-protect", { id: "token-protect", name: "Protect Marker", grade: 0, nation: "Token", power: 0, shield: 0, type: "Protect Marker", text: "When used to guard, discard one other card from your hand to completely stop the attack.", color: "#81d9ee", glyph: "◇", source: "Vanguard Arena token" });
  const artIds = Array.isArray(window.CARD_ART_IDS) ? window.CARD_ART_IDS : [];
  const isUnitCard = (card) => /\b(?:unit|trigger)\b/i.test(card?.type || "");
  const artPageSize = 60;
  let artPage = 0;
  let builderPage = 0;
  let libraryPage = 0;
  const cardPageSize = 48;
  const phases = ["Stand", "Draw", "Ride", "Stride", "Main", "Battle", "End"];
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  let view = "play";
  let builder = { id: null, name: "Untitled deck", cards: {}, starterCardId: "" };
  let selectedCard = null;
  let zoneFieldSelection = null;
  let match = null;
  let selectedZone = null;
  let botTimer = null;
  let activeCheckRevealId = null;
  let checkRevealTimer = null;
  const shownCheckRevealIds = new Set();
  let online = { role: null, peer: null, connection: null, watchers: [], roomId: null, publicRoomCode: null, heartbeat: null, joinRetry: null, relayStateReceived: false, applyingRemote: false, relayPlayerJoined: false, dialogMode: "host", selectedDeck: null, mulliganSelection: [], mulliganSubmitted: false };
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
    const powerLabel = (card.power === null || card.power === undefined ? "Unknown" : Number(card.power).toLocaleString());
    const shieldLabel = card.shield === null || card.shield === undefined ? "Unknown" : Number(card.shield) > 0 ? Number(card.shield).toLocaleString() : "—";
    return `<span class="game-card-wrap"><button class="game-card${selected ? " selected" : ""}" style="--card-accent:${escapeHtml(card.color || "#a39bff")}" data-card-id="${escapeHtml(card.id)}" aria-label="${escapeHtml(card.name)}, grade ${card.grade === null || card.grade === undefined ? "unknown" : gradeLabel}">
      <span class="grade-chip">${gradeLabel}</span><span class="trigger-chip${card.trigger ? "" : " no-trigger"}">${card.trigger ? escapeHtml(card.trigger) : "No Trigger"}</span>
      <span class="card-art">${cardImage(card)}</span><span class="card-copy"><span class="card-name">${escapeHtml(card.name)}</span><span class="card-subline"><span>G${gradeLabel} · ${escapeHtml(card.type)}</span><span>${count === null ? `P ${powerLabel} · S ${shieldLabel}` : `×${count}`}</span></span></span>
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
    const starterCardId = Object.keys(cards).find((id) => Number(cardMap.get(id)?.grade) === 0 && isUnitCard(cardMap.get(id))) || "";
    return { id: crypto.randomUUID?.() || String(Date.now()), name: "Demo Practice Deck", cards, starterCardId };
  }
  function practiceBotDeck() {
    const cards = {
      "cfa-7560": 4, "cfa-3570": 4, "cfa-7602": 4, "cfa-5973": 4,
      "cfa-7528": 2, "cfa-7381": 4, "cfa-7493": 4, "cfa-6870": 1,
      "cfa-3573": 4, "cfa-6826": 1, "cfa-3575": 4, "cfa-2594": 2,
      "cfa-5708": 3, "cfa-7557": 3, "cfa-5679": 4, "cfa-7472": 2,
      "cfa-4789": 3, "cfa-4755": 2, "cfa-7494": 3, "cfa-6635": 3,
      "cfa-5486": 1, "cfa-4826": 2, "cfa-4757": 1, "cfa-3767": 1
    };
    return { id: "practice-bot-83ua", name: "[MLB] deck · Deck Log 83UA", cards, starterCardId: "cfa-6826" };
  }  function isGDeckCard(card) { return /G Unit|G Guardian|G-Guard/i.test(String(card?.type || "")+" "+String(card?.name||"")); }
  function isGGuardian(card) { const info=(String(card?.type||"")+" "+String(card?.text||"")+" "+String(card?.name||"")).toLowerCase(); return info.includes("g guardian") || info.includes("g-guard") || info.includes("g guard") || (isGDeckCard(card) && Number(card?.grade)>=4 && Number(card?.power||0)===0 && Number(card?.shield||0)>0); }
  function deckCount(deck) { return Object.entries(deck.cards || {}).reduce((total, [id, qty]) => total + (isGDeckCard(cardMap.get(id)) ? 0 : Number(qty || 0)), 0); }
  function gDeckCount(deck) { return Object.entries(deck.cards || {}).reduce((total, [id, qty]) => total + (isGDeckCard(cardMap.get(id)) ? Number(qty || 0) : 0), 0); }
  function deckSummary(deck) {
    const counts = [0, 0, 0, 0]; let triggers = 0, heals = 0, overs = 0, sentinels = 0, regalis = 0; const names = new Map(), gNames = new Map();
    Object.entries(deck.cards || {}).forEach(([id, qty]) => { const c = cardMap.get(id); if (!c) return; const isG = isGDeckCard(c), grade = Number(c.grade); if (!isG && Number.isFinite(grade) && grade >= 0) counts[Math.min(3, grade)] += qty; if (!isG && c.trigger) { triggers += qty; if (/^Heal$/i.test(c.trigger)) heals += qty; if (/^Over$/i.test(c.trigger)) overs += qty; } if (!isG && /\bSentinel\b/i.test(String(c.text || "") + " " + String(c.type || ""))) sentinels += qty; if (!isG && /Regalis Piece/i.test(String(c.text || "") + " " + String(c.type || ""))) regalis += qty; const key=String(c.name || id).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, ""); const map=isG?gNames:names; map.set(key,(map.get(key)||0)+qty); });
    return { counts, triggers, heals, overs, sentinels, regalis, nameViolations: [...names.values(), ...gNames.values()].filter((qty) => qty > 4).length };
  }
  function renderBuilder() {
    $("#deck-name").value = builder.name || "";
    $("#builder-title").textContent = builder.name || "Untitled deck";
    const total = deckCount(builder), gTotal = gDeckCount(builder); const { counts, triggers, heals, overs, sentinels, regalis, nameViolations } = deckSummary(builder);
    $("#deck-total").textContent = `${total} / ${gTotal}`;
    $("#grade-breakdown").textContent = counts.join(" / ");
    $("#trigger-count").textContent = triggers;
    const validation = $("#deck-validation");
    const errors = []; if (!builder.starterCardId) errors.push("choose a Grade 0 starting Vanguard"); if (total !== 50) errors.push(`${total}/50 main-deck cards`); if (gTotal > 16) errors.push(`${gTotal}/16 G-deck cards`); if (triggers !== 16) errors.push(`${triggers}/16 triggers`); if (heals > 4) errors.push(`${heals}/4 Heal triggers`); if (overs > 1) errors.push(`${overs}/1 Over Trigger`); if (sentinels > 4) errors.push(`${sentinels}/4 Sentinels`); if (regalis > 1) errors.push(`${regalis}/1 Regalis Piece`); if (nameViolations) errors.push(`${nameViolations} card name limits`);
    validation.className = `deck-validation${errors.length ? " invalid" : total ? " valid" : ""}`; validation.textContent = errors.length ? `Deck rules to fix: ${errors.join(" · ")}.` : total ? "Deck construction limits are satisfied (Ride Deck rules excluded)." : "Add cards from the library to start building.";
    const starterOptions = Object.entries(builder.cards || {}).filter(([id, qty]) => qty > 0 && Number(cardMap.get(id)?.grade) === 0 && isUnitCard(cardMap.get(id))).map(([id, qty]) => ({ card: cardMap.get(id), qty })).filter((entry) => entry.card).sort((a, b) => a.card.name.localeCompare(b.card.name));
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
  function openLoadDeckDialog() {
    const decks = readSavedDecks(), select = $("#load-deck-choice"), confirm = $("#load-deck-confirm");
    select.innerHTML = decks.length ? decks.map((deck) => `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)} · ${deckCount(deck)} cards</option>`).join("") : '<option value="">No saved decks yet</option>';
    confirm.disabled = !decks.length;
    $("#load-deck-dialog").showModal();
  }
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
    $("#art-grid").innerHTML = pageItems.map((id) => `<button class="art-tile" data-art-id="${id}" title="Open image n${id}"><img loading="lazy" src="${artThumbnailUrl(id)}" alt="Card image n${id}"><span>n${id}</span></button>`).join("") || `<div class="empty-saved">No image numbers match.</div>`;
  }
  function showArtImage(id) {
    if (!artIds.includes(id)) return;
    $("#card-dialog-content").innerHTML = `<div class="art-dialog"><img src="${artFullImageUrl(id)}" alt="Card image n${id}" onerror="this.onerror=null;this.src='${artThumbnailUrl(id)}'"><p>Image file <b>n${id}.jpg</b> · Card name and rules not matched</p></div>`;
    $("#card-dialog").showModal();
  }
  function showCardDetails(id) {
    const card = cardMap.get(id); if (!card) return;
    $("#card-dialog-content").innerHTML = `<div class="dialog-card-layout"><div class="dialog-card-art">${cardImage(card)}</div><div class="dialog-card-info"><p class="eyebrow">${card.id.startsWith("demo-") ? "FICTIONAL DEMO CARD" : "CARD DETAILS"}</p><h2>${escapeHtml(card.name)}</h2><div class="dialog-card-stats">Grade ${card.grade === null || card.grade === undefined ? "Unknown" : escapeHtml(card.grade)}<br>${escapeHtml(card.type)} · ${card.trigger ? escapeHtml(card.trigger) + " Trigger" : "No Trigger"}<br>${escapeHtml((card.clans || []).join(", ") || card.clan || card.nation || "Clan not listed")}<br>Power ${card.power === null || card.power === undefined ? "Unknown" : Number(card.power).toLocaleString()} · Shield ${card.shield === null || card.shield === undefined ? "Unknown" : Number(card.shield) > 0 ? Number(card.shield).toLocaleString() : "—"}<br>Card database number ${escapeHtml(card.dbId ?? card.id)}</div><p>${escapeHtml(card.text || "No card text provided by the source database.")}</p><p>Data source: ${escapeHtml(card.source || "Not specified")}</p></div></div>`;
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
    const gDeck = allCards.filter((instance) => isGDeckCard(cardMap.get(instance.cardId)));
    const pile = allCards.filter((instance) => !gDeck.includes(instance));
    const starterId = deck.starterCardId || pile.find((instance) => Number(cardMap.get(instance.cardId)?.grade) === 0 && isUnitCard(cardMap.get(instance.cardId)))?.cardId;
    const starterIndex = pile.findIndex((instance) => instance.cardId === starterId);
    const vanguard = starterIndex >= 0 ? { ...pile.splice(starterIndex, 1)[0], rested: false } : null;
    shuffle(pile);
    return { name, deck: pile.slice(5), hand: pile.slice(0, 5), damage: [], drop: [], soul: [], bind: [], vanguard, rear: [null, null, null, null, null], accelZones: 0, accelTypes: [], giftZones: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: shuffle(gDeck), gZone: [], quickShields: 0, protectMarkers: 0, gifts: 0, human };
  }
  function openPracticeSetup() { $("#practice-setup-dialog").showModal(); }
  function startMatch(deck = null, firstSide = "human", onlineSetup = false) {
    const chosen = deck || (builder.cards && deckCount(builder) ? builder : null);
    const readyDeck = chosen && deckCount(chosen) ? chosen : defaultDeck();
    match = { players: { human: makePlayer(readyDeck, online.localName || "Player", true), bot: makePlayer(onlineSetup ? defaultDeck() : practiceBotDeck(), onlineSetup ? "Practice Bot" : "[MLB] Practice Bot") }, turn: 1, side: onlineSetup ? "human" : firstSide, firstSide: onlineSetup ? null : firstSide, firstTurnComplete: false, initialBotTurn: !onlineSetup && firstSide === "bot", preMatch: onlineSetup ? { stage: "roll", rolls: { human: null, bot: null }, winner: null, firstSide: null, mulliganDone: { human: false, bot: false } } : null, phase: 0, drewThisTurn: false, ridePerformed: false, stridePerformed: false, turnStartGrades: { human: 0, bot: 0 }, pendingStride: null, ordersPlayedThisTurn: 0, selected: null, pendingAttackSetup: null, pendingAttack: null, pendingTrigger: null, pendingAbility: null, pendingAbilities: [], pendingDamageQueue: [], botAttacks: [], revealed: null, checkReveals: [], log: [], ended: false, deckName: readyDeck.name };
    selectedCard = null; selectedZone = null;
    $("#match-layout").classList.remove("hidden"); $("#match-empty").classList.add("hidden");
    if (onlineSetup) setMessage("Waiting for both players to roll for first turn.");
    else { addLog(`${online.role ? "Online match" : "Practice match"} started with ${readyDeck.name}. ${firstSide === "human" ? "You chose to go first." : "You chose to go second."}`); setMessage(firstSide === "human" ? "Your turn — advance through Stand and Draw." : "Practice Bot goes first."); }
    renderMatch(); showView("play");
    if (!onlineSetup && firstSide === "bot") setTimeout(botTurn, 350);
  }
  function rollOnlineDieFor(side) {
    if (!match?.preMatch || match.preMatch.rolls[side] !== null) return;
    match.preMatch.rolls[side] = 1 + Math.floor(Math.random() * 6);
    const [hostRoll, guestRoll] = [match.preMatch.rolls.human, match.preMatch.rolls.bot];
    if (hostRoll !== null && guestRoll !== null) {
      if (hostRoll === guestRoll) {
        match.preMatch.rolls = { human: null, bot: null }; match.preMatch.winner = null;
        setMessage(`Both rolled ${hostRoll}. Roll again.`);
      } else {
        match.preMatch.winner = hostRoll > guestRoll ? "human" : "bot";
        setMessage(`${match.players[match.preMatch.winner].name} won the roll and chooses who goes first.`);
      }
    }
    renderMatch();
  }
  function chooseOnlineFirstPlayer(localChoice) {
    if (!match?.preMatch || match.preMatch.winner !== "human") return;
    if (online.role === "guest") {
      online.connection?.send({ type: "setup-choice", firstSide: localChoice });
      return;
    }
    beginOnlineMulligan(localChoice);
  }
  function beginOnlineMulligan(firstSide) {
    if (!match?.preMatch || !["human", "bot"].includes(firstSide)) return;
    match.preMatch.stage = "mulligan"; match.preMatch.firstSide = firstSide;
    online.mulliganSelection = []; online.mulliganSubmitted = false;
    addLog(`${match.players.human.name} and ${match.players.bot.name} finished the dice roll. ${match.players[firstSide].name} will go first after mulligans.`);
    setMessage("Both players may return any number of cards from their opening hands, then confirm to start.");
    renderMatch();
  }
  function finishOnlineMulligan() {
    const setup = match?.preMatch;
    if (!setup || !setup.mulliganDone?.human || !setup.mulliganDone?.bot) return;
    const firstSide = setup.firstSide;
    match.preMatch = null; match.firstSide = firstSide; match.side = firstSide; match.phase = 0; match.turn = 1; match.drewThisTurn = false; match.ridePerformed = false;
    addLog(`Both players completed their opening-hand mulligans. ${match.players[firstSide].name} goes first.`);
    setMessage(firstSide === "human" ? "Your turn — advance through Stand and Draw." : `${match.players.bot.name} goes first.`);
  }
  function completeOnlineMulligan(side, uids = []) {
    const setup = match?.preMatch, player = match?.players?.[side];
    if (!setup || setup.stage !== "mulligan" || !player || setup.mulliganDone?.[side]) return;
    const selected = new Set(Array.isArray(uids) ? uids : []);
    const returned = player.hand.filter((item) => selected.has(item.uid));
    player.hand = player.hand.filter((item) => !selected.has(item.uid));
    player.deck.unshift(...returned);
    for (let i = 0; i < returned.length; i++) draw(side);
    setup.mulliganDone[side] = true;
    addLog(`${player.name} ${returned.length ? `returned ${returned.length} card${returned.length === 1 ? "" : "s"} and drew ${returned.length} replacement${returned.length === 1 ? "" : "s"}` : "kept their opening hand"} and confirmed the mulligan.`);
    finishOnlineMulligan(); renderMatch();
  }
  function renderOnlineSetup() {
    const dialog = $("#online-start-dialog");
    if (!match?.preMatch) { if (dialog.open) dialog.close(); return; }
    if (online.role === "watcher") { if (dialog.open) dialog.close(); return; }
    const isMulligan = match.preMatch.stage === "mulligan";
    $("#online-roll-stage").classList.toggle("hidden", isMulligan);
    $("#online-mulligan-stage").classList.toggle("hidden", !isMulligan);
    $("#online-start-title").textContent = isMulligan ? "Opening hand mulligan" : "Roll for first turn";
    if (isMulligan) {
      const done = match.preMatch.mulliganDone || { human: false, bot: false }, submitted = online.mulliganSubmitted || done.human;
      const selection = new Set(online.mulliganSelection || []), hand = match.players.human.hand || [];
      $("#online-roll-status").textContent = done.human && done.bot ? "Both players confirmed." : done.human ? `${match.players.human.name} confirmed. Waiting for ${match.players.bot.name}.` : done.bot ? `${match.players.bot.name} confirmed. Choose any cards to return, or keep your hand.` : "Select any number of cards to put on the bottom of your deck, then draw that many. Or confirm with none selected.";
      $("#online-mulligan-cards").innerHTML = submitted ? `<p class="mulligan-waiting">${done.human ? "You’re done. Waiting for the other player…" : "Mulligan sent. Waiting for the host…"}</p>` : hand.map((item) => { const c = cardMap.get(item.cardId); return c ? `<button class="zone-view-card mulligan-card${selection.has(item.uid) ? " selected" : ""}" type="button" data-mulligan-uid="${escapeHtml(item.uid)}" aria-pressed="${selection.has(item.uid)}">${cardImage(c)}<b>${escapeHtml(c.name)}</b><small>${selection.has(item.uid) ? "Will return to deck" : "Keep in hand"}</small></button>` : ""; }).join("");
      const confirm = $("#online-mulligan-confirm"); confirm.textContent = online.role === "guest" ? "Confirm mulligan" : "Done mulliganing"; confirm.disabled = submitted || done.human;
      $("#online-mulligan-count").textContent = submitted ? "Waiting for the other player" : `${selection.size} card${selection.size === 1 ? "" : "s"} selected`;
    }
    if (!isMulligan) {
      const rolls = match.preMatch.rolls, winner = match.preMatch.winner || (rolls.human !== null && rolls.bot !== null ? (rolls.human > rolls.bot ? "human" : rolls.bot > rolls.human ? "bot" : null) : null);
      $("#online-roll-status").textContent = rolls.human === null || rolls.bot === null ? "Both players roll one die. Higher roll chooses who goes first." : winner ? `${match.players[winner].name} rolled higher and chooses first or second.` : `Tie at ${rolls.human}. Both players roll again.`;
      $("#online-local-roll").textContent = rolls.human === null ? "—" : String(rolls.human);
      $("#online-opponent-roll").textContent = rolls.bot === null ? "—" : String(rolls.bot);
      $("#roll-online-die").disabled = online.role === "watcher" || rolls.human !== null;
      $("#roll-online-die").textContent = rolls.human === null ? "Roll your die" : "You rolled";
      $("#online-first-choice").classList.toggle("hidden", winner !== "human" || online.role === "watcher");
    }
    if (!dialog.open) dialog.showModal();
  }
  function addLog(message) { if (!match) return; match.log.unshift({ time: new Date(), message }); match.log = match.log.slice(0, 15); renderLog(); }
  function renderLog() { if (!match) return; $("#match-log").innerHTML = match.log.map((entry) => `<div class="log-entry"><time>${entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>${escapeHtml(entry.message)}</span></div>`).join(""); }
  function setMessage(message) { $("#table-message").textContent = message; }
  function renderMatch() {
    if (!match) return;
    checkDamageEnd();
    const you = match.players.human, bot = match.players.bot;
    for (const side of [you, bot]) for (const instance of [...(side.hand || []), ...(side.crests || [])]) if (instance?.crestName) ensureCrestCard(instance.crestName);
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
    $("#human-order-zone").innerHTML = renderOrderCards(you.orders, "human"); $("#bot-order-zone").innerHTML = renderOrderCards(bot.orders, "bot"); $("#human-crest-zone").innerHTML = renderCrests(you.crests); $("#bot-crest-zone").innerHTML = renderCrests(bot.crests);
    $("#human-gzone").innerHTML = renderGZone(you); $("#bot-gzone").innerHTML = renderGZone(bot);
    $("#human-guard-circle").innerHTML = renderGuardCircle(you); $("#bot-guard-circle").innerHTML = renderGuardCircle(bot);
    $("#gift-count").textContent = String(you.gifts || 0);
    $(".human-line .player-title small").textContent = `YOUR SIDE · G ${you.gZone?.length || 0} · QUICK SHIELD ${you.quickShields || 0} · PROTECT ${you.protectMarkers || 0}`;
    $(".opponent-line .player-title small").textContent = `${online.role ? "OPPONENT" : "DEMO DECK"} · G ${bot.gZone?.length || 0} · QUICK SHIELD ${bot.quickShields || 0} · PROTECT ${bot.protectMarkers || 0}`;
    $("#human-damage").innerHTML = renderDamageCards(you);
    $("#bot-damage").innerHTML = renderDamageCards(bot);
    $("#bot-hand-count").textContent = `${bot.hand.length} CARDS`;
    $("#bot-hand").innerHTML = Array.from({ length: Math.min(8, bot.hand.length) }, () => `<span class="mini-back"></span>`).join("");
    renderZone("human", "vanguard", you.vanguard); renderZone("bot", "vanguard", bot.vanguard);
    const standardRearZones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right"];
    ["human", "bot"].forEach((side) => {
      const player = match.players[side]; player.accelZones = Math.max(0, Number(player.accelZones) || 0);
      while (player.rear.length < standardRearZones.length + player.accelZones) player.rear.push(null);
      player.accelTypes ||= [];
      while (player.accelTypes.length < player.accelZones) player.accelTypes.push("Accel I");
      const zoneIds = [...standardRearZones, ...Array.from({ length: player.accelZones }, (_, i) => `accel-${i + 1}`)];
      zoneIds.forEach((zone, index) => {
        if (zone.startsWith("accel-") && !$(`.field-zone[data-side="${side}"][data-zone="${zone}"]`)) {
          const row = $(`#${side}-accel-row`); if (row) row.insertAdjacentHTML("beforeend", `<div class="field-zone side-zone accel-zone" data-side="${side}" data-zone="${zone}"><span>ACCEL CIRCLE</span></div>`);
        }
        const zoneElement = $(`.field-zone[data-side="${side}"][data-zone="${zone}"]`); const accelRow = $(`#${side}-accel-row`); if (zone.startsWith("accel-") && zoneElement && accelRow && zoneElement.parentElement !== accelRow) accelRow.appendChild(zoneElement); renderZone(side, zone, player.rear[index]);
      });
      const accelRow = $(`#${side}-accel-row`); if (accelRow) { accelRow.style.display = player.accelZones ? "grid" : "none"; accelRow.style.gridTemplateColumns = `repeat(${3 + player.accelZones}, minmax(0, 1fr))`; accelRow.style.width = `calc(68% * ${(3 + player.accelZones) / 3})`; accelRow.style.left = `calc(50% - (68% * ${(3 + player.accelZones) / 3}) / 2)`; const leftAccelCount = Math.ceil(player.accelZones / 2); for (let i = 1; i <= player.accelZones; i++) { const column = i % 2 ? leftAccelCount - Math.floor((i - 1) / 2) : leftAccelCount + 4 + Math.floor((i - 1) / 2); const circle = $(`.field-zone[data-side="${side}"][data-zone="accel-${i}"]`); if (circle) { circle.style.gridColumn = String(column); circle.style.transform = i % 2 ? "translateX(-50%)" : "translateX(50%)"; } } }
    });
            $("#soul-pips").innerHTML = you.soul.slice(0, 7).map(() => `<span class="soul-pip"></span>`).join("");
    $("#hand-count").textContent = `${you.hand.length} card${you.hand.length === 1 ? "" : "s"}`;
    $("#hand-cards").innerHTML = you.hand.map((instance, i) => { const c = cardMap.get(instance.cardId); return c ? cardNode(c, match.selected === instance.uid).replace('data-card-id=', `data-hand-uid="${instance.uid}" data-hand-index="${i}" data-card-id=`) : ""; }).join("");
    updateActionAvailability(); renderLog(); renderGAssistDialog();
    if (match.revealed?.cards?.length) renderSharedReveal(); else if($("#reveal-dialog").open) $("#reveal-dialog").close();
    renderOnlineSetup(); renderTriggerPrompt(); renderAttackPrompt(); renderCrestPrompt(); renderPublicReveal(); renderCheckReveal();
    if (!online.applyingRemote && match.pendingAttack?.awaitingDrive) setTimeout(resolvePracticeAttackAfterDrives, 0);
    if (online.role === "host" && !online.applyingRemote) sendOnlineSnapshot();
  }
  function renderZone(side, zone, instance) {
    const el = $(`.field-zone[data-side="${side}"][data-zone="${zone}"]`); if (!el) return;
    el.innerHTML = `<span>${zone === "vanguard" ? "VANGUARD" : zone.startsWith("accel-") ? `ACCEL ${zone.slice(6)}` : "REAR-GUARD"}</span>`;
    const markers = (match.players[side].giftZones || []).filter((gift) => gift.zone === zone);
    if (markers.length) { const marker = document.createElement("b"); marker.className = "gift-zone-marker"; marker.textContent = markers.map((gift) => gift.type).join(" · "); el.appendChild(marker); } if (zone.startsWith("accel-")) { const marker = document.createElement("b"); marker.className = "gift-zone-marker accel-marker"; marker.textContent = match.players[side].accelTypes?.[Number(zone.slice(6)) - 1] || "Accel I"; el.appendChild(marker); }
    if (!instance) return;
    const c = cardMap.get(instance.cardId); if (!c) return;
    const turnPower = Number(instance.turnPowerBoost || 0), turnCrit = Number(instance.turnCriticalBoost || 0);
    const attackBoost = match.pendingAttack?.attackerUid === instance.uid ? Number(match.pendingAttack.boostPower || 0) : match.pendingAttackSetup?.attackerUid === instance.uid ? Number(match.pendingAttackSetup.boostPower || 0) : 0;
    const accelIndex = zone.startsWith("accel-") ? Number(zone.slice(6)) - 1 : -1; const accelType = accelIndex >= 0 ? (match.players[side].accelTypes?.[accelIndex] || "Accel I") : ""; const accelPower = match.side === side && accelType ? (/II/i.test(accelType) ? 5000 : 10000) : 0; const forcePower = match.side === side ? markers.filter((gift) => /^Force I$/i.test(gift.type || "")).length * 10000 : 0;
    const effectLabels = [];
    if (turnPower) effectLabels.push(`+${Math.round(turnPower / 1000)}k`);
    if (turnCrit) effectLabels.push(`+${turnCrit} CRIT`);
    if (attackBoost) effectLabels.push(`+${Math.round(attackBoost / 1000)}k BOOST · THIS ATTACK`);
    if (forcePower) effectLabels.push(`+${Math.round(forcePower / 1000)}k FORCE I`); if (accelPower) effectLabels.push(`+${Math.round(accelPower / 1000)}k ACCEL ${/II/i.test(accelType) ? "II" : "I"} · YOUR TURN`);
    const heartPower = Number(cardMap.get(instance.strideHeart?.cardId)?.power || 0) + Number(instance.strideHeart?.powerBoost || 0) + Number(instance.strideHeart?.turnPowerBoost || 0);
    const calculatedPower = Number(c.power || 0) + heartPower + Number(instance.powerBoost || 0) + turnPower + forcePower + accelPower + attackBoost;
    const guardPower = match.pendingAttack?.targetUid === instance.uid ? Math.max(0, Number(match.pendingAttack.targetPower || 0) - calculatedPower) : 0;
    const effectivePower = calculatedPower + guardPower;
    const effectivePowerLabel = c.power === null || c.power === undefined ? "Unknown" : effectivePower.toLocaleString();
    const printedCritical = Math.max(1, Number(c.critical || 1)); const forceCrit = markers.some((gift) => /^Force II$/i.test(gift.type || ""));
    const effectiveCrit = Math.max(1, printedCritical + turnCrit + (forceCrit ? Math.max(0, 2 - printedCritical) : 0));
    if (forceCrit) effectLabels.push("ORIGINAL CRITICAL 2 · FORCE II");
    const effectTag = effectLabels.length ? `<span class="turn-effect-badge">${escapeHtml(effectLabels.join(" · "))}</span>` : "";
    const shieldLabel = c.shield === null || c.shield === undefined ? "Unknown" : Number(c.shield) > 0 ? Number(c.shield).toLocaleString() : "—";
    const field = document.createElement("div"); field.className = `field-card${match.selected === instance.uid ? " selected" : ""}${instance.rested ? " rested" : ""}${instance.locked ? " locked" : ""}`; field.dataset.fieldUid = instance.uid; field.dataset.cardId = c.id; field.dataset.side = side; field.dataset.zone = zone; field.style.borderColor = `${c.color}88`; const powerBreakdown = [`base ${Number(c.power || 0).toLocaleString()}`, heartPower ? `+${heartPower.toLocaleString()} heart` : "", Number(instance.powerBoost || 0) ? `+${Number(instance.powerBoost).toLocaleString()} manual` : "", turnPower ? `+${turnPower.toLocaleString()} temporary until end of turn` : "", forcePower ? `+${forcePower.toLocaleString()} Force I for this turn` : "", guardPower ? `+${guardPower.toLocaleString()} guard shield for this attack` : ""].filter(Boolean).join(" · "); field.title = `${c.name}${heartPower ? ` · Heart: ${cardMap.get(instance.strideHeart.cardId)?.name || "Grade 3"}` : ""}\nPower: ${effectivePowerLabel}${effectiveCrit > 1 ? ` · ${effectiveCrit} critical` : ""} · Printed ${c.power === null || c.power === undefined ? "unknown" : Number(c.power).toLocaleString()} power · ${c.trigger || "No trigger"}\nShield: ${shieldLabel}\n${powerBreakdown}`; field.innerHTML = `${c.image ? `<img class="field-card-art" src="${escapeHtml(c.image)}" alt="" onerror="this.remove()">` : ""}<button class="card-zoom field-card-zoom" type="button" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}" title="Zoom card">⤢</button><span class="mini-grade">${instance.locked ? "LOCKED" : `G${c.grade === null || c.grade === undefined ? "?" : c.grade}`}</span>${effectTag}${guardPower ? `<span class="turn-effect-badge">+${guardPower.toLocaleString()} GUARD</span>` : ""}<span class="field-card-name">${escapeHtml(c.name)}</span><span class="field-card-stats"><b>${effectivePowerLabel}</b><span>${effectiveCrit} CRIT</span><small>SHIELD ${shieldLabel}</small></span>`;
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
  function canGAssist(player) { const grade = Number(cardMap.get(player?.vanguard?.cardId)?.grade ?? -1); return grade >= 0 && grade < 3 && !player.hand.some((item) => isUnitCard(cardMap.get(item.cardId)) && Number(cardMap.get(item.cardId)?.grade) === grade + 1) && player.deck.length > 0; }
  function renderGAssistDialog() {
    const state = match?.pendingGAssist;
    if (!state || state.ownerSide !== "human") { if ($("#g-assist-dialog").open) $("#g-assist-dialog").close(); return; }
    const player = match.players.human, choosing = state.stage === "choose";
    $("#g-assist-title").textContent = choosing ? "Look at the top five cards" : "Remove two cards from hand";
    $("#g-assist-help").textContent = choosing ? "Choose a Unit exactly one grade above your Vanguard to add to hand, or take none. The rest will be shuffled into your deck." : `You added ${cardMap.get(state.addedCardId)?.name || "a Unit"}. Choose two cards in your hand to remove from the game (${state.discardUids.length}/2).`;
    if (choosing) {
      const grade = Number(cardMap.get(player.vanguard?.cardId)?.grade || 0) + 1;
      $("#g-assist-content").innerHTML = state.cards.map((item) => { const card=cardMap.get(item.cardId), eligible=isUnitCard(card)&&Number(card?.grade)===grade; return card ? `<button class="zone-view-card${eligible?"":" disabled"}" type="button" data-gassist-choose="${escapeHtml(item.uid)}" ${eligible?"":"disabled"}>${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${eligible?"Eligible · add to hand":"Not the required grade"}</small></button>` : ""; }).join("") || "<p class=\"zone-empty-message\">No cards to look at.</p>";
      $("#g-assist-none").hidden=false; $("#g-assist-finish").hidden=true;
    } else {
      $("#g-assist-content").innerHTML = player.hand.map((item) => { const card=cardMap.get(item.cardId), selected=state.discardUids.includes(item.uid); return card ? `<button class="zone-view-card${selected?" selected":""}" type="button" data-gassist-discard="${escapeHtml(item.uid)}" aria-pressed="${selected}">${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${selected?"Remove from game":"Choose to remove"}</small></button>` : ""; }).join("");
      $("#g-assist-none").hidden=true; $("#g-assist-finish").hidden=false; $("#g-assist-finish").disabled=state.discardUids.length!==2;
    }
    if (!$("#g-assist-dialog").open) $("#g-assist-dialog").showModal();
  }  function renderGZone(player) {
    const faceUp = (player.gZone || []).map((instance) => { const c = cardMap.get(instance.cardId); return c ? `<button class="zone-card" data-card-zoom="${escapeHtml(c.id)}" title="Zoom ${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>` : ""; }).join("");
    const deck = player.gDeck || [], faceDownCount = deck.filter((item) => !item.faceUp).length, faceUpCount = deck.filter((item) => item.faceUp).length;
    return `${faceUp}<span class="zone-empty">${faceDownCount} face down · ${faceUpCount} face up in G deck</span>`;
  }
  function renderGuardCircle(player) { return (player.guardCircle || []).map((instance) => { const c = cardMap.get(instance.cardId); return c ? `<span class="zone-card guard-card" title="${escapeHtml(c.name)} · ${Number(c.shield || 0).toLocaleString()} shield">${escapeHtml(c.name)}</span>` : ""; }).join("") || '<span class="zone-empty">Empty</span>'; }
  function renderCrests(crests = []) {
    return (crests || []).map((item) => {
      const card = cardMap.get(item.cardId);
      return card ? `<button class="zone-card crest-card" type="button" data-card-zoom="${escapeHtml(card.id)}" title="${escapeHtml(card.name)} · Crest">${cardImage(card, "crest-card-art")}<span>${escapeHtml(card.name)}</span></button>` : "";
    }).join("") || '<span class="zone-empty">No Crest</span>';
  }
  function showOrderMenu(uid) {
    const item = match?.players.human.orders?.find(card => card.uid === uid), card = item && cardMap.get(item.cardId);
    if (!item || !card) return;
    match.selected = uid;
    $("#context-menu-title").textContent = card.name;
    $("#context-menu-help").textContent = "Order zone card actions.";
    const actions = [[`order-to-hand:${uid}`, "Return to hand"], [`order-to-top:${uid}`, "Return to deck top"], [`order-to-bottom:${uid}`, "Return to deck bottom"], [`order-to-drop:${uid}`, "Move to Drop"]];
    $("#context-menu-actions").innerHTML = actions.map(([action, label]) => `<button class="button" type="button" data-context-action="${escapeHtml(action)}">${label}</button>`).join("");
    if (!$("#context-menu-dialog").open) $("#context-menu-dialog").showModal();
  }
  function showDeckMenu() {
    if (!match || online.role === "watcher") return;
    const actions = [["deck-view", "View deck"], ["draw", "Draw a card"], ["top-to-drop", "Mill top card to Drop"], ["trigger-check", "Trigger check"], ["damage-check", "Damage check"], ["shuffle", "Shuffle deck"], ["soul-charge", "Soul Charge"], ["reveal-top-cards", "Look at top cards"]];
    $("#context-menu-title").textContent = "Deck actions";
    $("#context-menu-help").textContent = "Choose an action for your deck.";
    $("#context-menu-actions").innerHTML = actions.map(([action, label]) => `<button class="button" type="button" data-context-action="${action}">${label}</button>`).join("");
    if (!$("#context-menu-dialog").open) $("#context-menu-dialog").showModal();
  }
  function showContextMenu(kind) {
    if (!match || online.role === "watcher") return;
    const hand = selectedHandCard(), field = findFieldCard(match.selected);
    const card = hand ? cardMap.get(hand.cardId) : field?.side === "human" ? cardMap.get(field.instance.cardId) : null;
    if (!card) return;
    let actions = [];
    if (hand) {
      const order = /Order/i.test(card.type || ""), crest = /Crest/i.test(card.type || "");
      if (order) actions.push(["play-order", "Play Order"]);
      else if (crest) actions.push(["crest-place", "Place Crest"]);
      else { actions.push(["place:vanguard", "Ride"]); if (isUnitCard(card)) actions.push([`superior-ride:hand:${match.selected}`, "Superior Ride"]); actions.push(["selected-to-soul", "Put into Soul"]); }
      actions.push(["selected-to-drop", "Move to Drop"], ["bind", "Move to Bind"], ["hand-to-order", "Move to Order zone"], ["public-reveal", "Reveal to opponent"], ["hand-to-top", "Return to deck top"], ["hand-to-bottom", "Return to deck bottom"], ["hand-to-damage", "Move to Damage"]);
    } else if (field?.side === "human") {
      if (isUnitCard(card) && field.zone !== "vanguard") actions.push([`superior-ride:field:${field.instance.uid}`, "Superior Ride"]);
      if (field.zone === "vanguard") {
        if (match.phase === 5 && !match.pendingAttack) actions.push(["attack", "Attack"]);
        if (eligibleActivatedAbilities(field).length) actions.push(["open-skills", "Skill"]);
        actions.push(["view-selected-soul", "View Soul"], ["rest-selected", field.instance.rested ? "Stand" : "Rest"], ["selected-to-soul", "Put into Soul"], ["alter-power", "Alter power"]);
      } else {
        if (match.phase === 5 && !match.pendingAttack) actions.push(["attack", "Attack"]);
        if (eligibleActivatedAbilities(field).length) actions.push(["open-skills", "Skill"]);
        actions.push(["rest-selected", field.instance.rested ? "Stand" : "Rest"], ["move-select", "Move / Swap Rear-Guard"], ["selected-to-hand", "Return to hand"], ["selected-to-soul", "Put into Soul"], ["selected-to-top", "Return to deck top"], ["selected-to-bottom", "Return to deck bottom"], ["selected-to-drop", "Move to Drop"], ["bind", "Move to Bind"], ["alter-power", "Alter power"]);
      }
    }
    $("#context-menu-title").textContent = card.name;
    $("#context-menu-help").textContent = hand ? "Choose what to do with this card." : field?.zone === "vanguard" ? "Vanguard actions" : "Field card actions";
    $("#context-menu-actions").innerHTML = actions.map(([action, label]) => `<button class="button" type="button" data-context-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`).join("");
    if (!$("#context-menu-dialog").open) $("#context-menu-dialog").showModal();
  }
  function updateActionAvailability() {
    if (!match) return;
    const canAct = !match.ended && online.role !== "watcher";
    const handCard = match.players.human.hand.find((x) => x.uid === match.selected);
    const fieldCard = findFieldCard(match.selected);
    const pending = Boolean(match.pendingAttack);
    $("#draw-card").disabled = !canAct;
    const returnTop = $("[data-manual-action='hand-to-top']"), returnBottom = $("[data-manual-action='hand-to-bottom']");
    [returnTop, returnBottom].forEach((button) => { if (button) button.disabled = !canAct; });
    $("#ride-card").disabled = !canAct;
    $("#call-card").disabled = !canAct;
    $("#attack-card").disabled = !canAct;
    $("#play-order").disabled = !canAct;
    const attack = match.pendingAttack;
    const defending = Boolean(attack && attack.defenderSide === "human" && !attack.defenderDone);
    const canDefend = defending;
    $("#guard-card").hidden = !defending;
    $("#guard-card").disabled = !canAct || !canDefend;
    const interceptButton = $("#intercept-card");
    if (interceptButton) { interceptButton.hidden = !defending; interceptButton.disabled = !canAct || !eligibleInterceptors().length; }
    const gGuardButton=$(".action-buttons [data-manual-action='g-guard']");
    if(gGuardButton){gGuardButton.hidden=!defending;gGuardButton.disabled=!canAct;}
    const driveButton=$("[data-manual-action='drive-check']");if(driveButton){driveButton.disabled=true;driveButton.hidden=true;}
    $("#end-turn").disabled = !canAct;
    $("#advance-phase").disabled = !canAct;
    $$(".manual-actions [data-manual-action]").forEach((button) => { button.disabled = !canAct; });
    $$(".quick-control-row [data-manual-action]").forEach((button) => { button.disabled = !canAct; });
    const gAssistButton = $("[data-manual-action='g-assist']"); if (gAssistButton) gAssistButton.hidden = !(canAct && match.side === "human" && match.phase === 1 && canGAssist(match.players.human));
    const selectedToDrop = $("[data-manual-action='selected-to-drop']");
    if (selectedToDrop) selectedToDrop.disabled = !canAct;
    const selectedToSoul = $("[data-manual-action='selected-to-soul']");
    if (selectedToSoul) selectedToSoul.disabled = !canAct;
    const selectedVanguardSoul = $("[data-manual-action='view-selected-soul']");
    if (selectedVanguardSoul) selectedVanguardSoul.disabled = !canAct;
    const restSelected = $("[data-manual-action='rest-selected']");
    if (restSelected) restSelected.disabled = !canAct;
    const standSelected = $("[data-manual-action='stand-selected']");
    if (standSelected) standSelected.disabled = !canAct;
    const onHumanField = fieldCard?.side === "human", onHumanHand = Boolean(handCard);
    const contextualActions = {
      bind: onHumanField || onHumanHand, "selected-to-hand": onHumanField, "selected-to-drop": onHumanField || onHumanHand, "selected-to-soul": onHumanField || onHumanHand,
      "view-selected-soul": onHumanField && fieldCard.zone === "vanguard", "rest-selected": onHumanField && !fieldCard.instance.rested,
      "stand-selected": onHumanField && fieldCard.instance.rested,
      "hand-to-damage": onHumanHand, lock: onHumanField, power: onHumanField
    };
    Object.keys(contextualActions).forEach((action) => $$(`.selected-card-actions [data-manual-action="${action}"]`).forEach((button) => { button.hidden = false; }));
    $("#manual-selection-help").textContent = onHumanHand ? "Hand card selected · choose where to move or play it." : onHumanField ? `${fieldCard.zone === "vanguard" ? "Vanguard" : "Rear-Guard"} selected · choose a card action.` : "Select a card on your hand or field to see its actions.";
    $("#advance-phase").innerHTML = match.phase === phases.length - 1 ? `End turn <span>→</span>` : `Continue ${phases[match.phase + 1].toLowerCase()} phase <span>→</span>`;
    if (match.selected) {
      const cardId = handCard?.cardId || fieldCard?.instance.cardId; const c = cardMap.get(cardId);
      $("#selection-hint").textContent = c ? `${c.name} · G${c.grade}` : "Selected";
      $("#selected-summary").innerHTML = c ? `<span class="selected-card-icon">${escapeHtml(c.glyph || "✦")}</span><span><b>${escapeHtml(c.name)}</b><small>Grade ${c.grade} · ${escapeHtml(c.type)} · ${Math.round(c.power / 1000)}k power</small></span>` : `<span class="selected-card-icon">✦</span><span><b>Card selected</b><small>Choose an action</small></span>`;
    } else {
      const attackHint = !pending ? "Select a card to see actions" : attack.attackerSide === "human" ? (attack.defenderDone ? "Defense complete — finish your attack" : "Your attack — waiting for defense") : "Opponent attacking — choose Guard or No guard";
      const attackTitle = !pending ? "No card selected" : attack.attackerSide === "human" ? "Your attack is in progress" : "Attack incoming";
      const attackHelp = !pending ? "Choose a card from your hand or field" : attack.attackerSide === "human" ? (attack.defenderDone ? "Choose End this attack to continue." : "The defender is choosing whether to guard.") : "Use Guard or No guard";
      $("#selection-hint").textContent = attackHint;
      $("#selected-summary").innerHTML = `<span class="selected-card-icon">✦</span><span><b>${attackTitle}</b><small>${attackHelp}</small></span>`;
    }
    const noGuard = $("#no-guard"); if (noGuard) { noGuard.classList.toggle("hidden", !defending); noGuard.textContent = (attack?.guardCards?.length || 0) ? "Done guarding" : "No guard"; noGuard.disabled = !canAct || !canDefend; }
    const finishAttackButton = $("#finish-attack");
    if (finishAttackButton) {
      finishAttackButton.hidden = !attack || attack.attackerSide !== "human";
      finishAttackButton.disabled = !canAct || !attack?.defenderDone || Number(attack?.driveChecksRemaining || 0) > 0;
    }
    if (online.role === "watcher") $$(".action-buttons button").forEach((button) => { button.disabled = true; });
  }
  function findFieldCard(uid) {
    if (!uid || !match) return null;
    for (const side of ["human", "bot"]) { const p = match.players[side]; if (p.vanguard?.uid === uid) return { side, zone: "vanguard", instance: p.vanguard }; const i = p.rear.findIndex((x) => x?.uid === uid); if (i >= 0) return { side, zone: ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: p.accelZones || 0 }, (_, n) => `accel-${n + 1}`)][i], index: i, instance: p.rear[i] }; }
    return null;
  }
  function cardAbilities(card) {
    const text=String(card?.text||''), starts=[...text.matchAll(/(?:^|\n)\s*(?:\[(AUTO|ACT|CONT)\]|(AUTO|ACT|CONT))\s*:?/gi)];
    return starts.map((m,i)=>{const start=m.index+m[0].length-m[0].trimStart().length,raw=text.slice(start,starts[i+1]?.index??text.length).trim();return{kind:String(m[1]||m[2]).toUpperCase(),raw,gb:Number(raw.match(/(?:Generation\s*Break|GB)\s*[-( ]?\s*(\d+)/i)?.[1]||0),once:/\b1\s*\/\s*turn\b|\bonce per turn\b/i.test(raw),id:`${card.id}:${i}`}});
  }
  function generationBreakCount(side){const p=match?.players?.[side];if(!p)return 0;return(p.gZone||[]).filter(x=>x.faceUp).length+(p.gDeck||[]).filter(x=>x.faceUp).length+[p.vanguard,...(p.rear||[])].filter(x=>x&&isGDeckCard(cardMap.get(x.cardId))).length}
  function abilityZoneAllowed(a,f){const tokens=[...a.raw.toUpperCase().matchAll(/\[(VC\/RC|VC|RC|GC|SC|DROP|SOUL|HAND|BIND|DAMAGE(?: ZONE)?)\]|\((VC\/RC|VC|RC|GC|SC|DROP|SOUL|HAND|BIND|DAMAGE(?: ZONE)?)\)/g)].map(m=>m[1]||m[2]);if(!tokens.length)return true;const zone=f.zone==="vanguard"?"VC":f.zone==="soul"?"SOUL":f.zone==="drop"?"DROP":f.zone==="damage"?"DAMAGE ZONE":f.zone==="hand"?"HAND":f.zone==="bind"?"BIND":"RC";return tokens.some(token=>token==="VC/RC"?zone==="VC"||zone==="RC":token===zone)}
  function abilityTriggerMatches(a,eventName){if(a.kind!=="AUTO")return false;if(eventName==="ride"&&/\bforerunner\b/i.test(a.raw))return true;const p={ride:/when[^.\n]*(?:rode upon|is ridden|rides? on top|rides this unit|riding this unit|placed on (?:the )?vc by riding)/i,attack:/when[^.\n]*(?:this unit|your vanguard|a rear-guard|this card)?[^.\n]*attacks?/i,place:/when[^.\n]*(?:unit|card)[^.\n]*(?:placed|called)[^.\n]*(?:vc|rc|circle)/i,drop:/when[^.\n]*(?:this unit|this card|a rear-guard|a card)[^.\n]*(?:(?:put|placed|moved|sent)[^.\n]*(?:drop|retire)|retired)/i,damagePlace:/when[^.\n]*(?:a card|a unit|this card)[^.\n]*(?:put|placed|moved)[^.\n]*damage zone/i,damageLeave:/when[^.\n]*(?:a card|a unit|this card)[^.\n]*(?:removed|leaves?|moved|returned|put)[^.\n]*damage zone/i,end:/at the end of (?:your|the) turn/i}[eventName];return Boolean(p?.test(a.raw))}
  function queueOneAbility(side,source,ability,eventContext){const q=match.pendingAbilities||=([]),pending=match.pendingAbility;if((pending?.instance?.uid===source.instance.uid&&pending.ability.id===ability.id)||q.some(x=>x.instance.uid===source.instance.uid&&x.ability.id===ability.id))return;if(side==="bot"){const botMatch={side,field:source.zone,instance:source.instance,ability,eventContext};if(/\bforerunner\b/i.test(ability.raw)){const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:match.players[side].accelZones||0},(_,i)=>`accel-${i+1}`)];botMatch.callZone=zones.find((_,i)=>!match.players[side].rear[i])}resolveAbility(botMatch);return}q.push({side,field:source.zone,instance:source.instance,ability,eventContext})}
  function queueAbilityPrompts(eventName,side,subjectUid=null,eventContext={}){if(!match||online.role==="watcher")return;const player=match.players[side],fieldSources=fieldUnits(side).map(x=>({...x,side})),extraZones=eventName==="ride"?["soul"]:["place","damagePlace","damageLeave"].includes(eventName)?["soul","drop","damage"]:[];const zoneSources=extraZones.flatMap(zone=>(player[zone==="damage"?"damage":zone]||[]).map(instance=>({side,zone,instance}))),sources=[...fieldSources,...zoneSources],subject=subjectUid?findFieldCard(subjectUid):null,context={...eventContext,event:eventName,subjectUid,subjectZone:eventContext.zone||subject?.zone||null};for(const source of sources)for(const ability of cardAbilities(cardMap.get(source.instance.cardId))){if(!abilityTriggerMatches(ability,eventName)||!abilityZoneAllowed(ability,source)||generationBreakCount(side)<ability.gb||(ability.once&&abilityUsed(side,ability.id)))continue;if(eventName==="attack"&&/\bthis (?:unit|card)\b/i.test(ability.raw)&&source.instance.uid!==subjectUid)continue;if(eventName==="attack"&&/\byour vanguard\b/i.test(ability.raw)&&context.subjectZone&&context.subjectZone!=="vanguard")continue;if(eventName==="place"){const isSubject=source.instance.uid===subjectUid,listener=/when[^.\n]*(?:your )?(?:other|another|a) (?:unit|card)[^.\n]*(?:placed|called)/i.test(ability.raw),circleListener=/this unit[’']?s circle|same circle/i.test(ability.raw);if(isSubject&&!/when[^.\n]*this (?:unit|card)[^.\n]*(?:placed|called)/i.test(ability.raw)&&listener)continue;if(!isSubject){if(!listener)continue;if(circleListener&&(context.subjectZone||subject?.zone)!==(findFieldCard(source.instance.uid)?.zone||source.zone))continue}}queueOneAbility(side,source,ability,context)}showNextAbilityPrompt()}
  function queueMovedCardAbility(instance,side,eventName,zone="rear-left",eventContext={}){if(!match||!instance)return;const possibleZones=eventName==="drop"?[zone,"drop"]:[zone],context={...eventContext,event:eventName,sourceZone:zone,subjectUid:instance.uid};const source={side,zone,instance};for(const ability of cardAbilities(cardMap.get(instance.cardId)))if(abilityTriggerMatches(ability,eventName)&&possibleZones.some(current=>abilityZoneAllowed(ability,{side,zone:current,instance}))&&generationBreakCount(side)>=ability.gb&&(!ability.once||!abilityUsed(side,ability.id)))queueOneAbility(side,source,ability,context);showNextAbilityPrompt()}
  function abilityUsed(side,id){return(match?.players?.[side]?.usedAbilities||[]).includes(`${match.turn}:${side}:${id}`)}
  function eligibleActivatedAbilities(f){return f?cardAbilities(cardMap.get(f.instance.cardId)).filter(a=>a.kind==='ACT'&&abilityZoneAllowed(a,f)&&generationBreakCount(f.side)>=a.gb&&(!a.once||!abilityUsed(f.side,a.id))):[]}
  function showAbilityMenu(f){const a=eligibleActivatedAbilities(f);if(!a.length){toast('No activated skill is available (check its circle, once-per-turn use, and Generation Break).');return}const c=cardMap.get(f.instance.cardId);$('#context-menu-title').textContent=`${c?.name||'Card'} · Skill`,$('#context-menu-help').textContent=`Generation Break ${generationBreakCount(f.side)}. Choose an ability to activate.`,$('#context-menu-actions').innerHTML=a.map((x,i)=>`<button class="button" type="button" data-context-action="ability:${f.side}:${f.instance.uid}:${i}">${escapeHtml(x.raw)}</button>`).join('');if(!$('#context-menu-dialog').open)$('#context-menu-dialog').showModal()}
  function showNextAbilityPrompt(){if(match?.pendingTrigger)return;if(!match?.pendingAbility){if(!match?.pendingAbilities?.length||online.role==='watcher')return;match.pendingAbility=match.pendingAbilities.shift()}if($('#ability-dialog').open)return;const x=match.pendingAbility,c=cardMap.get(x.instance.cardId);$('#ability-dialog-title').textContent=`${c?.name||'Card'} · ${x.ability.kind==='ACT'?'Activate skill?':'Ability triggered'}`;$('#ability-dialog-text').textContent=x.ability.raw;$('#ability-dialog-status').textContent=`Generation Break ${generationBreakCount(x.side)}${x.ability.gb?` / GB${x.ability.gb}`:''}.`;renderAbilityCostChoices(x);renderAbilityEffectChoices(x);if(!$('#ability-dialog').open)$('#ability-dialog').showModal()}
  function renderAbilityCostChoices(x){const box=$('#ability-cost-choices'),p=match.players[x.side],t=x.ability.raw,q=(re,d=0)=>Number(t.match(re)?.[1]||d),cost={cb:q(/Counter[- ]Blast\s*\(?\s*(\d+)/i),sb:q(/Soul[- ]Blast\s*\(?\s*(\d+)/i),discard:q(/discard(?:ing)?\s*\(?\s*(\d+)/i,/discard (?:a|one) card/i.test(t)?1:0)};x.costSelections||={cb:[],sb:[],discard:[]};const groups=[['cb','Counter-Blast',(p.damage||[]).filter(c=>!c.faceDown)],['sb','Soul-Blast',p.soul||[]],['discard','Discard from hand',(p.hand||[]).filter(c=>c.uid!==x.instance.uid)]];box.innerHTML=groups.filter(([k])=>cost[k]>0).map(([k,label,cards])=>`<h3>${label} · choose ${cost[k]}</h3><div class="ability-cost-group">${cards.map(c=>{const a=cardMap.get(c.cardId),selected=x.costSelections[k].includes(c.uid);return a?`<button class="zone-view-card${selected?' selected':''}" type="button" data-ability-cost="${k}:${escapeHtml(c.uid)}" aria-pressed="${selected}">${cardImage(a)}<b>${escapeHtml(a.name)}</b></button>`:''}).join('')||'<p class="zone-empty-message">No cards available.</p>'}</div>`).join('')}
  function cardTextNumber(value){const text=String(value||"").toLowerCase().replace(/[- ]/g,"");if(/^\d+$/.test(text))return Number(text);const values={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20};return values[text]||0}
  function abilityChoicePool(x){const t=x.ability.raw,p=match.players[x.side];if((/\bcall this card\b|\bforerunner\b/i.test(t))&&p.soul?.some(c=>c.uid===x.instance.uid)){x.effectUid=x.instance.uid;return{kind:"soul",label:"Soul",cards:[x.instance]}}if(/choose[^.\n]*card[^.\n]*(?:from|in) your damage zone/i.test(t))return{kind:"damage",label:"Damage zone",cards:p.damage||[]};const topMatch=t.match(/(?:look at|reveal|top)[^.\n]*?\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+cards?\b/i),topCount=topMatch?cardTextNumber(topMatch[1]):0,topLimited=/look at|reveal|top \d+|top (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i.test(t),deckEffect=/(?:search|look at|reveal)[^.\n]*(?:your )?deck|call[^.\n]*from your deck/i.test(t);if(deckEffect){const limit=topLimited?Math.max(1,topCount||1):0;let cards=limit?p.deck.slice(-limit):p.deck.slice();const grade=t.match(/Grade\s*(\d+)/i)?.[1],name=t.match(/card named ["“]([^"”]+)["”]/i)?.[1],clan=t.match(/<([^>]+)>/)?.[1];if(/\bunit\b/i.test(t))cards=cards.filter(c=>isUnitCard(cardMap.get(c.cardId)));if(grade){const greater=/or greater|or higher/i.test(t);cards=cards.filter(c=>greater?Number(cardMap.get(c.cardId)?.grade)>=Number(grade):Number(cardMap.get(c.cardId)?.grade)===Number(grade))}if(name)cards=cards.filter(c=>cardMap.get(c.cardId)?.name?.toLowerCase()===name.toLowerCase());if(clan)cards=cards.filter(c=>String(cardMap.get(c.cardId)?.clan||"").toLowerCase()===clan.toLowerCase());return{kind:"deck",label:limit?`Top ${limit} cards of deck`:"Deck",cards}}if(/call[^.\n]*from your hand/i.test(t))return{kind:"hand",label:"Hand",cards:p.hand||[]};if(/call[^.\n]*from (?:your )?drop/i.test(t))return{kind:"drop",label:"Drop",cards:p.drop||[]};if(/call[^.\n]*from your soul/i.test(t))return{kind:"soul",label:"Soul",cards:p.soul||[]};return null}
  function renderAbilityEffectChoices(x){const box=$('#ability-effect-choices'),t=x.ability.raw,p=match.players[x.side],pool=abilityChoicePool(x),needsFieldTarget=/\b(?:choose|select|target)\b/i.test(t)&&/\b(?:unit|rear-guard|vanguard)\b/i.test(t)&&!pool;let html='';if(pool){const calling=/\bcall\b|\bforerunner\b/i.test(t);if(!x.effectUid){html+=`<h3>Choose a card from your ${pool.label}</h3><div class="ability-cost-group">${pool.cards.map(c=>{const card=cardMap.get(c.cardId),eligible=card&&(!calling||isUnitCard(card))&&(!calling||Number(card.grade||0)<=Number(cardMap.get(p.vanguard?.cardId)?.grade||0)),selected=x.effectUid===c.uid;return card&&eligible?`<button class="zone-view-card${selected?' selected':''}" type="button" data-ability-card="${escapeHtml(c.uid)}" aria-pressed="${selected}">${cardImage(card)}<b>${escapeHtml(card.name)}</b></button>`:''}).join('')||'<p class="zone-empty-message">No eligible cards.</p>'}</div>`}else{const chosen=pool.cards.find(c=>c.uid===x.effectUid),chosenCard=chosen&&cardMap.get(chosen.cardId);html+=`<p>Selected: <b>${escapeHtml(chosenCard?.name||'card')}</b> (${pool.label}).</p><button class="button" type="button" data-ability-clear-card>Choose a different card</button>`;if(calling){const zones=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right',...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)].filter((_,i)=>!/\bforerunner\b/i.test(t)||!p.rear[i]);html+=`<h3>Choose an open Rear-Guard circle</h3>${zones.map(z=>`<button class="button${x.callZone===z?' button-primary':''}" type="button" data-ability-zone="${z}">${z.replace('rear-','Rear-Guard ').replace('accel-','Accel ')}</button>`).join('')}`}}}if(needsFieldTarget){const enemy=/opponent|opposing/i.test(t),owner=enemy?(x.side==='human'?'bot':'human'):x.side;let units=fieldUnits(owner).map(f=>({...f,side:owner}));if(/rear-guards?/i.test(t))units=units.filter(f=>f.zone!=='vanguard');if(/same column/i.test(t)&&x.eventContext?.subjectZone){const column=rearColumn(x.eventContext.subjectZone);units=units.filter(f=>rearColumn(findFieldCard(f.instance.uid)?.zone)===column)}x.optionalNoTarget=/if no units were retired/i.test(t)&&units.length===0;html+=`<h3>Choose a target</h3><div class="ability-cost-group">${units.map(f=>{const c=cardMap.get(f.instance.cardId);return c?`<button class="zone-view-card${x.targetUid===f.instance.uid?' selected':''}" type="button" data-ability-target="${escapeHtml(f.instance.uid)}" aria-pressed="${x.targetUid===f.instance.uid}">${cardImage(c)}<b>${escapeHtml(c.name)}</b><small>${escapeHtml(f.zone)}</small></button>`:''}).join('')||'<p class="zone-empty-message">No legal targets.</p>'}</div>`}box.innerHTML=html}
  function resolveAbility(x){const p=match.players[x.side],u=x.instance,t=x.ability.raw;if(!/(?:draw|power|critical|rest|stand|soul\s*charge|counter[- ]charge|retire|search|call|forerunner)/i.test(t)){toast("This card text needs a card-specific effect before it can resolve automatically; its cost was not paid.");return false}const amount=(pat,def=0)=>Number(t.match(pat)?.[1]?.replace(/,/g,'')||def),cb=amount(/Counter[- ]Blast\s*\(?\s*(\d+)/i),sb=amount(/Soul[- ]Blast\s*\(?\s*(\d+)/i),dc=amount(/discard(?:ing)?\s*\(?\s*(\d+)/i,/discard (?:a|one) card/i.test(t)?1:0),pick=x.costSelections||{};if(x.side==='bot'&&!x.costSelections){pick.cb=(p.damage||[]).filter(c=>!c.faceDown).slice(0,cb).map(c=>c.uid);pick.sb=(p.soul||[]).slice(0,sb).map(c=>c.uid);pick.discard=(p.hand||[]).filter(c=>c.uid!==u.uid).slice(0,dc).map(c=>c.uid)}const d=(p.damage||[]).filter(c=>pick.cb?.includes(c.uid)&&!c.faceDown),s=(p.soul||[]).filter(c=>pick.sb?.includes(c.uid)),h=(p.hand||[]).filter(c=>pick.discard?.includes(c.uid)&&c.uid!==u.uid);if(d.length!==cb||s.length!==sb||h.length!==dc){toast('Choose exactly the cards required for this ability cost.');return false}const pool=abilityChoicePool(x),needsFieldTarget=/\b(?:choose|select|target)\b/i.test(t)&&/\b(?:unit|rear-guard|vanguard)\b/i.test(t)&&!pool;if(pool&&!x.effectUid){toast('Choose a card for this search or call effect.');return false}if(pool&&(/\bcall\b|\bforerunner\b/i.test(t))&&!x.callZone){toast('Choose a Rear-Guard circle for the call.');return false}if(needsFieldTarget&&!x.targetUid&&!x.optionalNoTarget){toast('Choose a legal target for this ability.');return false}d.forEach(c=>c.faceDown=true);s.forEach(c=>{p.soul=p.soul.filter(y=>y.uid!==c.uid);p.drop.push(c)});h.forEach(c=>{p.hand=p.hand.filter(y=>y.uid!==c.uid);p.drop.push(c)});if(/\brest this unit\b/i.test(t))u.rested=true;const drawConditional=/if no units were retired/i.test(t),n=drawConditional?(x.targetUid?0:1):amount(/\bdraw\s+(?:up to\s+)?(\d+)\s+cards?/i,/\bdraw a card\b/i.test(t)?1:0);for(let i=0;i<n;i++){const c=p.deck.pop();if(!c)break;p.hand.push(c)}const chosenTarget=x.targetUid?findFieldCard(x.targetUid)?.instance:u;const power=amount(/(?:gets?|gain|add)\s+(?:this unit\s+)?(?:Power\s*)?\+\s*([\d,]+)\s*(?:power|\[power\])?/i),crit=amount(/\+\s*(\d+)\s*critical/i);if(power&&chosenTarget){chosenTarget.turnPowerBoost=Number(chosenTarget.turnPowerBoost||0)+power;chosenTarget.turnPowerExpiry=x.side}if(crit&&chosenTarget){chosenTarget.turnCriticalBoost=Number(chosenTarget.turnCriticalBoost||0)+crit;chosenTarget.turnCriticalExpiry=x.side}const cc=amount(/Counter[- ]Charge\s*\(?\s*(\d+)/i);(p.damage||[]).filter(c=>c.faceDown).slice(0,cc).forEach(c=>c.faceDown=false);const sc=amount(/Soul\s*Charge\s*\(?\s*(\d+)/i,/\bSoul Charge\b/i.test(t)?1:0);for(let i=0;i<sc;i++){const card=p.deck.pop();if(!card)break;p.soul.push(card)}if(/\bstand\b/i.test(t)&&chosenTarget)chosenTarget.rested=false;if(/\bretire\b/i.test(t)){const target=x.targetUid?findFieldCard(x.targetUid):null,owner=target?.side||((x.side==='human')?'bot':'human'),rear=match.players[owner].rear,ri=target?rear.findIndex(c=>c?.uid===target.instance.uid):rear.findIndex(Boolean);if(ri>=0&&target){const removed=rear[ri];rear[ri]=null;match.players[owner].drop.push(removed);queueMovedCardAbility(removed,owner,'drop',target.zone)}}if(pool&&x.effectUid){const source=p[pool.kind],idx=source.findIndex(c=>c.uid===x.effectUid),card=idx>=0?source.splice(idx,1)[0]:null;if(card){if(pool.kind==="damage")queueAbilityPrompts("damageLeave",x.side,card.uid,{zone:"damage"});if(/\bcall\b|\bforerunner\b/i.test(t)){const zones=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right',...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)],slot=zones.indexOf(x.callZone);if(slot>=0&&(!/\bforerunner\b/i.test(t)||!p.rear[slot]))callUnitToRear(p,x.side,card,slot,{source:pool.kind,ability:true});else{source.push(card);toast(/\bforerunner\b/i.test(t)?"Forerunner needs an open Rear-Guard circle.":"Choose a Rear-Guard circle.");return false}}else if(/(?:drop zone|to drop)/i.test(t))p.drop.push(card);else if(/to the top of your deck|on top of your deck/i.test(t))p.deck.push(card);else if(/to the bottom of your deck/i.test(t))p.deck.unshift(card);else p.hand.push(card);if(pool.kind==='deck'&&/shuffle (?:your )?deck/i.test(t))shuffle(p.deck)}}if(x.ability.once){p.usedAbilities||=[];p.usedAbilities.push(`${match.turn}:${x.side}:${x.ability.id}`)}addLog(`${cardMap.get(u.cardId)?.name||'A unit'} resolved its ability${pool&&x.effectUid?' and selected a card':''}${n?` and drew ${n}`:''}${power?` (+${power.toLocaleString()} power)`:''}.`);return true}
  function selectedHandCard() { return match?.players.human.hand.find((x) => x.uid === match.selected); }
  function hasIntercept(card) { return /\bIntercept\b/i.test(String(card?.text || "")) || /Intercept/i.test(String(card?.skill || "")); }
  function eligibleInterceptors() {
    const attack = match?.pendingAttack;
    if (!attack || attack.defenderSide !== "human") return [];
    const player = match.players.human;
    return player.rear.map((unit, index) => ({ unit, index })).filter(({ unit, index }) => unit && index !== attack.targetRearIndex && (index < 2 || index >= 5) && Number(cardMap.get(unit.cardId)?.grade) === 2 && hasIntercept(cardMap.get(unit.cardId))).map(({ unit }) => unit);
  }
    function openInterceptDialog() {
    const choices = eligibleInterceptors();
    if (!choices.length) { toast("Only a front-row Rear-Guard with the Intercept ability that is not being attacked can intercept."); return; }
    $("#intercept-card-list").innerHTML = choices.map((unit) => { const c = cardMap.get(unit.cardId); return c ? `<button class="zone-view-card" type="button" data-intercept-uid="${escapeHtml(unit.uid)}">${cardImage(c)}<b>Intercept · ${escapeHtml(c.name)}</b><small>${Number(c.shield || 0).toLocaleString()} shield</small></button>` : ""; }).join("");
    $("#intercept-dialog").showModal();
  }
  function interceptWith(uid) {
    const unit = eligibleInterceptors().find((item) => item.uid === uid);
    if (!unit) { toast("That unit can no longer intercept."); return; }
    const player = match.players.human, index = player.rear.findIndex((item) => item?.uid === uid), shield = Number(cardMap.get(unit.cardId)?.shield || 0);
    if (index < 0) return;
    player.rear[index] = null; player.guardCircle ||= []; match.pendingAttack.guardCards ||= [];
    player.guardCircle.push(unit); match.pendingAttack.guardCards.push(unit); match.pendingAttack.targetPower += shield;
    addLog(`${player.name} intercepted with ${cardMap.get(unit.cardId)?.name || "a Grade 2 Rear-Guard"} (+${shield.toLocaleString()} shield).`);
    match.selected = null; renderMatch();
  }
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
  function fieldUnits(side) {
    const player = match.players[side];
    return [{ instance: player.vanguard, zone: "vanguard", label: "Vanguard" }, ...player.rear.map((instance, index) => ({ instance, zone: `rear-${index}`, label: `Rear-Guard ${index + 1}` }))].filter((item) => item.instance);
  }
  function triggerKind(instance) {
    const card = cardMap.get(instance?.cardId); const value = String(card?.trigger || "").toLowerCase();
    return ["over", "critical", "draw", "stand", "heal", "front"].find((kind) => value.includes(kind)) || "";
  }
  function isFrontRowZone(zone) { return zone === "vanguard" || zone === "rear-0" || zone === "rear-1" || (zone.startsWith("rear-") && Number(zone.slice(5)) >= 5); }
  function isSentinel(card) { return /\bsentinel\b|perfect guard/i.test(String(card?.text || "") + " " + String(card?.type || "")); }
  function triggerPower(instance) {
    const card = cardMap.get(instance?.cardId);
    return Number(card?.triggerPower || card?.trigger_power || card?.triggerValue) || 10000;
  }
  function renderTriggerPrompt() {
    const dialog = $("#trigger-prompt-dialog"), pending = match?.pendingTrigger;
    if (!dialog || !pending || pending.side !== "human" || online.applyingRemote || online.role === "watcher") { if (dialog?.open) dialog.close(); return; }
    const units = fieldUnits("human"), player = match.players.human;
    const stage = pending.stage;
    const title = stage === "critical-target" ? "Choose a unit for +1 critical" : stage === "over-target" ? "Choose a unit for +100,000,000 power" : stage === "power-target" ? `Choose a unit for +${Math.round(pending.power / 1000)}k power` : stage === "stand-target" ? "Choose a Rear-Guard to stand" : "Choose damage to heal";
    $("#trigger-prompt-title").textContent = title;
    $("#trigger-prompt-description").textContent = `${pending.cardName} activated from your ${pending.checkName} check. These effects last until end of turn.`;
    let targets = stage === "stand-target" ? units.filter((u) => u.zone !== "vanguard" && u.instance.rested) : stage === "heal-target" ? player.damage.map((item) => ({ instance: item, label: cardMap.get(item.cardId)?.name || "Damage" })) : units;
    const list = $("#trigger-prompt-targets");
    list.innerHTML = targets.map((target) => {
      const item = target.instance, card = cardMap.get(item.cardId);
      return `<button class="trigger-target" type="button" data-trigger-pick="${escapeHtml(item.uid)}">${card?.image ? `<img src="${escapeHtml(card.image)}" alt="">` : ""}<span><b>${escapeHtml(card?.name || target.label)}</b><small>${escapeHtml(target.label)}</small></span></button>`;
    }).join("") || `<p class="zone-empty-message">No legal cards to choose.</p>`;
    $("#trigger-prompt-skip").hidden = stage !== "heal-target";
    if (!dialog.open) dialog.showModal();
  }
  function renderCrestPrompt() {
    const pending = match?.pendingCrest;
    const dialog = $("#crest-prompt-dialog");
    if (!pending || pending.side !== "human" || online.role === "watcher" || online.applyingRemote) { if (dialog?.open) dialog.close(); return; }
    $("#crest-prompt-title").textContent = `Add ${pending.name}?`;
    $("#crest-prompt-copy").textContent = `This card's ride effect gives you the ${pending.name} Crest. Add it to your hand, then move it to your Crest zone.`;
    if (!dialog.open) dialog.showModal();
  }
  function askForCardCrest(side, instance) {
    const text = String(cardMap.get(instance?.cardId)?.text || "");
    const matchName = text.match(/prompted to get the ["“]([^"”]+)["”] crest upon ride/i);
    if (matchName) match.pendingCrest = { side, name: matchName[1], sourceUid: instance.uid };
  }
  function ensureCrestCard(name) {
    const existing = [...cardMap.values()].find(card => card.name === name && /Crest/i.test(card.type || ""));
    if (existing) return existing.id;
    const id = `crest-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (!cardMap.has(id)) cardMap.set(id, { id, name, grade: 0, power: 0, shield: 0, type: "Crest", text: `${name} Crest`, color: "#d7bd7b", glyph: "✧" });
    return id;
  }

  function renderPublicReveal() {
    const reveal = match?.publicReveal, dialog = $("#public-reveal-dialog");
    if (!reveal?.instance) { if (dialog.open) dialog.close(); return; }
    const card = cardMap.get(reveal.instance.cardId);
    if (!card) return;
    $("#public-reveal-title").textContent = `${reveal.owner === "human" ? match.players.human.name : match.players.bot.name} revealed a card`;
    $("#public-reveal-card").innerHTML = `<button class="zone-card-zoom" type="button" data-card-zoom="${escapeHtml(card.id)}" aria-label="Zoom ${escapeHtml(card.name)}">⤢</button>${cardImage(card)}<b>${escapeHtml(card.name)}</b>`;
    $("#public-reveal-close").classList.toggle("hidden", reveal.owner !== "human");
    if (!dialog.open) dialog.showModal();
  }
  function renderAttackPrompt() {
    const panel = $("#attack-choice-panel"), setup = match?.pendingAttackSetup, attack = match?.pendingAttack;
    if (!panel) return;
    if (attack?.driveCountPrompt && attack.attackerSide === "human" && online.role !== "watcher") {
      $("#attack-choice-title").textContent = "Choose the number of drive checks";
      $("#attack-choice-help").textContent = "Resolve this Vanguard drive value after the defender finishes guarding.";
      const count = Math.max(0, Number(attack.maxDriveChecks) || 0);
      $("#attack-choice-buttons").innerHTML = Array.from({ length: count + 1 }, (_, n) => `<button class="button button-primary" type="button" data-attack-choice="drive-count:${n}">${n} drive check${n === 1 ? "" : "s"}</button>`).join("");
      panel.hidden = false; return;
    }
    if (!setup || online.role === "watcher" || setup.attackerSide !== "human") { panel.hidden = true; return; }
    const attacker = findFieldCard(setup.attackerUid);
    if (!attacker) { match.pendingAttackSetup = null; panel.hidden = true; return; }
    const attackerName = cardMap.get(attacker.instance.cardId)?.name || "Unit";
    let choices = [];
    if (setup.stage === "boost") {
      const booster = findFieldCard(setup.boosterUid);
      $("#attack-choice-title").textContent = "Boost this attack?";
      $("#attack-choice-help").textContent = `${booster ? cardMap.get(booster.instance.cardId)?.name : "Your Rear-Guard"} is directly behind ${attackerName}. Boosting rests it and adds its power for this attack only.`;
      setMessage(`Choose whether to boost ${attackerName} before selecting an attack target.`);
      choices = [{ value: `boost:${setup.boosterUid}`, label: `Boost with ${booster ? cardMap.get(booster.instance.cardId)?.name : "rear-guard"}` }, { value: "boost:none", label: "Attack without a boost" }];
    } else {
      const defenderSide = setup.defenderSide || flipSide(setup.attackerSide), defender = match.players[defenderSide];
      $("#attack-choice-title").textContent = "Choose an attack target";
      $("#attack-choice-help").textContent = "Choose the opponent’s Vanguard or one of their front-row Rear-Guards.";
      setMessage(`Choose whether ${attackerName} attacks the Vanguard or a front-row Rear-Guard.`);
      if (defender.vanguard) choices.push({ value: `target:vanguard:${defender.vanguard.uid}`, label: `Vanguard · ${cardMap.get(defender.vanguard.cardId)?.name || "Unit"}` });
      defender.rear.forEach((unit, index) => {
        if (!unit) return;
        const zone = index === 0 ? "rear-left" : index === 1 ? "rear-right" : index >= 5 ? `accel-${index - 4}` : "";
        if (zone) choices.push({ value: `target:${zone}:${unit.uid}`, label: `Front Rear-Guard · ${cardMap.get(unit.cardId)?.name || "Unit"}` });
      });
    }
    $("#attack-choice-buttons").innerHTML = choices.map((choice) => `<button class="button button-primary" type="button" data-attack-choice="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</button>`).join("");
    panel.hidden = false;
  }
  function finishTriggerResolution() {
    const pending = match?.pendingTrigger;
    if (!pending) return;
    match.pendingTrigger = null;
    addLog(`${pending.cardName}'s trigger effects are active until end of turn.`);
    if (pending.after) pending.after();
    checkDamageEnd(pending.side);
    resolveDamageQueue();
    resolvePracticeAttackAfterDrives();
    showNextAbilityPrompt();
    if (!online.role && match.side === "bot" && !match.ended && !match.pendingTrigger && !match.pendingDamageQueue.length) setTimeout(nextBotAttack, 250);
  }
  function resolvePracticeAttackAfterDrives() {
    const attack = match?.pendingAttack;
    if (online.role === "guest") return;
    const driveSide = attack?.attackerSide;
    if (!attack?.awaitingDrive || !attack.defenderDone || !["human", "bot"].includes(driveSide) || match.pendingTrigger || match.pendingDamageQueue?.length) return;
    if (Number(attack.driveChecksRemaining || 0) <= 0) {
      attack.awaitingDrive = false; attack.blocked = Boolean(attack.perfectGuard || !attackHits(attack));
      if (!online.role) finishAttack(Boolean(attack.perfectGuard || !attackHits(attack)));
      else renderMatch();
      return;
    }
    if (attack.driveSequenceStarted) return;
    attack.driveSequenceStarted = true;
    setTimeout(() => {
      if (match?.pendingAttack !== attack || match.pendingTrigger) { attack.driveSequenceStarted = false; return; }
      const player = match.players[driveSide], top = player.deck.pop();
      attack.driveSequenceStarted = false;
      if (!top) { match.ended = true; addLog(`${player.name} lost because the deck is empty.`); setMessage("Match over — the deck is empty."); match.pendingAttack = null; renderMatch(); return; }
      attack.driveChecksRemaining -= 1;
      if (triggerKind(top) !== "over") player.hand.push(top);
      addLog(`${player.name} performed a drive check and revealed ${cardMap.get(top.cardId)?.name || "a card"}.`);
      beginTriggerResolution(driveSide, top, "drive");
      renderMatch();
      if (!match.pendingTrigger) setTimeout(resolvePracticeAttackAfterDrives, 350);
    }, 350);
  }
  function attackHits(attack) { return Number(attack?.power || 0) >= Number(attack?.targetPower || 0); }
  function checkDamageEnd() {
    if (!match || match.ended || match.pendingTrigger) return;
    const losers = ["human", "bot"].filter((side) => { const player = match.players[side]; return player.damage.length >= 6; });
    if (!losers.length) return;
    match.ended = true;
    if (losers.length === 2) { addLog("Both players met a losing condition. The match is a draw."); setMessage("Draw — both players met a losing condition."); return; }
    const winner = match.players[flipSide(losers[0])].name;
    addLog(`${winner} wins the match.`); setMessage(`${winner} wins — start a new match to play again.`);
  }
  function queueCheckReveal(side, instance, checkName) {
    if (!instance || !match) return;
    match.checkReveals ||= [];
    match.checkReveals.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, side, cardId: instance.cardId, checkName });
    if (match.checkReveals.length > 40) match.checkReveals.splice(0, match.checkReveals.length - 40);
  }
  function renderCheckReveal() {
    const panel = $("#check-reveal-flash");
    if (!match) { if (checkRevealTimer) clearTimeout(checkRevealTimer); checkRevealTimer = null; activeCheckRevealId = null; shownCheckRevealIds.clear(); panel.hidden = true; return; }
    if (activeCheckRevealId) return;
    const reveal = (match.checkReveals || []).find((item) => !shownCheckRevealIds.has(item.id));
    if (!reveal) { panel.hidden = true; return; }
    const card = cardMap.get(reveal.cardId);
    shownCheckRevealIds.add(reveal.id); activeCheckRevealId = reveal.id;
    $("#check-reveal-label").textContent = `${match.players[reveal.side]?.name || "A player"} · ${({ damage: "Damage check", trigger: "Trigger check", drive: "Drive check" })[reveal.checkName] || "Card revealed"}`;
    $("#check-reveal-card").innerHTML = card ? `${cardImage(card, "check-reveal-art")}<b>${escapeHtml(card.name)}</b>` : "Card revealed";
    panel.hidden = false; panel.classList.remove("flash"); void panel.offsetWidth; panel.classList.add("flash");
    checkRevealTimer = setTimeout(() => { panel.hidden = true; panel.classList.remove("flash"); activeCheckRevealId = null; checkRevealTimer = null; renderCheckReveal(); }, 650);
  }  function beginTriggerResolution(side, instance, checkName) {
    queueCheckReveal(side, instance, checkName);
    const kind = triggerKind(instance); if (!kind) return false;
    const player = match.players[side], power = triggerPower(instance), cardName = cardMap.get(instance.cardId)?.name || `${kind} trigger`;
    const turnOwner = match.side;
    const pending = { side, uid: instance.uid, cardName, kind, checkName, power, turnOwner, stage: "power-target" };
    if (kind === "over") {
      player.removed ||= []; player.removed.push(instance);
      if (checkName === "drive") {
        draw(side);
        if (!fieldUnits(side).length) { addLog(`${player.name} revealed an Over Trigger and drew 1; it was removed from the game.`); return false; }
        const pendingOver = { side, uid: instance.uid, cardName, kind, checkName, power: 100000000, turnOwner, stage: "over-target" };
        if (side === "bot" && !online.role) { const target=fieldUnits(side)[0]?.instance;if(target){target.turnPowerBoost=Number(target.turnPowerBoost||0)+100000000;target.turnPowerExpiry=turnOwner;} addLog("Practice Bot resolved its Over Trigger."); return false; }
        match.pendingTrigger = pendingOver;
      } else addLog(`${player.name} revealed an Over Trigger during a damage check; it was removed from the game and did not count as damage.`);
      return false;
    }
    if (kind === "draw") { if (draw(side)) addLog(`${side === "human" ? "You" : "Practice Bot"} drew 1 from the Draw Trigger.`); }
    if (kind === "critical") pending.stage = "critical-target";
    if (kind === "stand") pending.stage = "stand-target";
    if (kind === "heal") pending.stage = player.damage.length && player.damage.length >= match.players[flipSide(side)].damage.length ? "heal-target" : "power-target";
    if (kind === "front") {
      fieldUnits(side).filter((unit) => isFrontRowZone(unit.zone)).forEach((unit) => { unit.instance.turnPowerBoost = Number(unit.instance.turnPowerBoost || 0) + power; unit.instance.turnPowerExpiry=turnOwner; if(match.pendingAttack?.attackerUid===unit.instance.uid)match.pendingAttack.power+=power; });
      addLog(`${side === "human" ? "Your" : "Practice Bot's"} Front Trigger gave the front row +${Math.round(power / 1000)}k until end of turn.`); return false;
    }
    if (side === "bot" && !online.role) {
      if (pending.stage === "critical-target") { const target = fieldUnits(side).sort((a, b) => Number(a.zone !== "vanguard") - Number(b.zone !== "vanguard"))[0]?.instance; if (target) { target.turnCriticalBoost = Number(target.turnCriticalBoost || 0) + 1; target.turnCriticalExpiry=turnOwner; } pending.stage = "power-target"; }
      if (pending.stage === "stand-target") { const target = fieldUnits(side).find((unit) => unit.zone !== "vanguard" && unit.instance.rested); if (target) target.instance.rested = false; pending.stage = "power-target"; }
      const target = fieldUnits(side)[0]?.instance; if (target) { target.turnPowerBoost = Number(target.turnPowerBoost || 0) + power; target.turnPowerExpiry=turnOwner; }
      if (pending.stage === "heal-target") { const healed = player.damage.pop(); if (healed) { player.drop.push(healed); queueAbilityPrompts("damageLeave", "bot", healed.uid, {zone:"damage"}); } }
      addLog(`Practice Bot resolved its ${kind} trigger.`); return false;
    }
    if (pending.stage === "stand-target" && !fieldUnits(side).some((unit) => unit.zone !== "vanguard" && unit.instance.rested)) pending.stage = "power-target";
    if (pending.stage === "heal-target" && !player.damage.length) pending.stage = "power-target";
    if (!fieldUnits(side).length && pending.stage !== "heal-target" && pending.stage !== "stand-target") return false;
    match.pendingTrigger = pending; return true;
  }
  function chooseTriggerTarget(uid) {
    const pending = match?.pendingTrigger; if (!pending || pending.side !== "human") return;
    const player = match.players.human;
    if (pending.stage === "heal-target") {
      const index = player.damage.findIndex((item) => item.uid === uid); if (index < 0) return;
      const healed=player.damage.splice(index,1)[0];player.drop.push(healed);queueAbilityPrompts("damageLeave","human",healed.uid,{zone:"damage"});addLog(`${player.name} healed one damage to Drop.`);pending.stage = "power-target";
      if (!fieldUnits("human").length) finishTriggerResolution();
    } else {
      const unit = fieldUnits("human").find((item) => item.instance.uid === uid && (pending.stage !== "stand-target" || (item.zone !== "vanguard" && item.instance.rested))); if (!unit) return;
      if (pending.stage === "critical-target") { unit.instance.turnCriticalBoost = Number(unit.instance.turnCriticalBoost || 0) + 1; unit.instance.turnCriticalExpiry=pending.turnOwner; if (match.pendingAttack?.attackerUid === unit.instance.uid) match.pendingAttack.critical = Number(match.pendingAttack.critical || 1) + 1; addLog(`${cardMap.get(unit.instance.cardId)?.name || "A unit"} gets +1 critical until end of turn.`); pending.stage = "power-target"; }
      else if (pending.stage === "stand-target") { unit.instance.rested = false; addLog(`${cardMap.get(unit.instance.cardId)?.name || "A Rear-Guard"} stood.`); pending.stage = "power-target"; }
      else { unit.instance.turnPowerBoost = Number(unit.instance.turnPowerBoost || 0) + pending.power; unit.instance.turnPowerExpiry=pending.turnOwner; if(match.pendingAttack?.attackerUid===unit.instance.uid)match.pendingAttack.power+=pending.power; addLog(`${cardMap.get(unit.instance.cardId)?.name || "A unit"} gets +${pending.power >= 1000000 ? `${Math.round(pending.power / 1000000)}M` : `${Math.round(pending.power / 1000)}k`} power until end of turn.`); finishTriggerResolution(); }
    }
    renderMatch();
  }
  function drawForHuman() {
    if (!match || match.ended) { toast("Start a match before drawing."); return; }
    const card = draw("human"); if (!card) { setMessage("Your deck is empty."); return; }
    if (match.phase === 1 && match.side === "human") match.drewThisTurn = true;
    addLog(`${match.players.human.name} drew a card.`); setMessage("Card drawn."); renderMatch();
  }
  function rideHuman() {
    const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
    const p = match.players.human, grade = Number(cardMap.get(instance.cardId)?.grade || 0), currentGrade = Number(cardMap.get(p.vanguard?.cardId)?.grade || 0), previousVanguard=p.vanguard;
    if (match.side !== "human" || match.phase !== 2 || match.ridePerformed || grade < currentGrade || grade > currentGrade + 1) { toast("A normal ride is once per turn and must be the same grade or one grade higher than your Vanguard."); return; }
    p.hand = p.hand.filter((x) => x.uid !== instance.uid); if (p.vanguard) p.soul.push(p.vanguard); p.vanguard = { ...instance, rested: false }; match.ridePerformed = true; askForCardCrest("human", instance);
    match.selected = null; addLog(`You rode ${cardMap.get(instance.cardId)?.name || "a card"}.`); if(previousVanguard)queueMovedCardAbility(previousVanguard,"human","ride","vanguard"); queueAbilityPrompts("ride", "human"); queueAbilityPrompts("place", "human", instance.uid); setMessage("Ride complete."); renderMatch();
  }
  function callUnitToRear(player,side,instance,index,eventContext={}){
    const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)],zone=zones[index];
    if(!zone||!isUnitCard(cardMap.get(instance?.cardId)))return false;
    const displaced=player.rear[index]||null;
    if(displaced){player.rear[index]=null;player.drop.push(displaced);addLog(`${cardMap.get(displaced.cardId)?.name||"The Rear-Guard"} was called over and sent to Drop.`);queueMovedCardAbility(displaced,side,"drop",zone,{placementUid:instance.uid,placementZone:zone});}
    player.rear[index]={...instance,rested:false};
    queueAbilityPrompts("place",side,instance.uid,{...eventContext,zone,displacedUid:displaced?.uid||null});
    return true;
  }
  function rearColumn(zone){if(["rear-left","rear-back-left","rear-0","rear-2"].includes(zone))return"left";if(["rear-right","rear-back-right","rear-1","rear-4"].includes(zone))return"right";if(["rear-back-center","rear-3"].includes(zone))return"center";if(String(zone).startsWith("accel-"))return String(zone);return null}
  function callHuman() {
    const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
    const p = match.players.human, card = cardMap.get(instance.cardId), empty = p.rear.indexOf(null);
    if (match.side !== "human" || match.phase !== 4) { toast("You can call units during your Main phase."); return; }
    if (!isUnitCard(card) || Number(card.grade || 0) > Number(cardMap.get(p.vanguard?.cardId)?.grade || 0)) { toast("You can only call a Unit whose grade is no higher than your Vanguard."); return; }
    if (empty < 0) return;
    p.hand = p.hand.filter((x) => x.uid !== instance.uid); callUnitToRear(p,"human",instance,empty); match.selected = null;
    addLog(`You called ${cardMap.get(instance.cardId)?.name || "a card"} to the rear-guard circle.`); setMessage("Unit called."); renderMatch();
  }
  function attackerPower(entry) {
    const field = entry.side && entry.zone ? entry : findFieldCard(entry.instance.uid);
    const card = cardMap.get(entry.instance.cardId);
    const forcePower = field && match.side === field.side ? (match.players[field.side].giftZones || []).filter((gift) => gift.zone === field.zone && /^Force I$/i.test(gift.type || "")).length * 10000 : 0;
    const accelIndex = field?.zone.startsWith("accel-") ? Number(field.zone.slice(6)) - 1 : -1; const accelType = accelIndex >= 0 ? (match.players[field.side].accelTypes?.[accelIndex] || "Accel I") : ""; const accelPower = field && accelType && match.side === field.side ? (/II/i.test(accelType) ? 5000 : 10000) : 0; return Number(card?.power || 0) + Number(cardMap.get(entry.instance.strideHeart?.cardId)?.power || 0) + Number(entry.instance.strideHeart?.powerBoost || 0) + Number(entry.instance.strideHeart?.turnPowerBoost || 0) + Number(entry.instance.powerBoost || 0) + Number(entry.instance.turnPowerBoost || 0) + forcePower + accelPower;
  }
  function attackerCritical(entry) { const field = entry.side && entry.zone ? entry : findFieldCard(entry.instance.uid); const card = cardMap.get(entry.instance.cardId), printedCritical = Math.max(1, Number(card?.critical || 1)); const forceCrit = field && (match.players[field.side].giftZones || []).some((gift) => gift.zone === field.zone && /^Force II$/i.test(gift.type || "")); return Math.max(1, printedCritical + Number(entry.instance.turnCriticalBoost || 0) + (forceCrit ? Math.max(0, 2 - printedCritical) : 0)); }
  function getDriveValue(card) { const text = String(card?.text || ""); if (/Triple Drive/i.test(text)) return 3; if (/Twin Drive/i.test(text)) return 2; return 1; }
  function canAttackFromBackRow(field) { const text=String(cardMap.get(field.instance.cardId)?.text||""); return /attack(?:s|ing)? from (?:the )?back row|back row[^.\n]*can attack/i.test(text); }
  function directlyBehind(field) { const rear=match.players[field.side].rear;if(field.zone==="vanguard")return rear[3]||null;if(field.zone==="rear-left")return rear[2]||null;if(field.zone==="rear-right")return rear[4]||null;return null; }
  function resolveHumanAttack() {
    if (!match || match.ended) { toast("Start a match before attacking."); return; }
    if (!match.firstTurnComplete && match.side === match.firstSide) { toast("The player who goes first cannot attack during their first turn."); return; }
    if (match.pendingAttack || match.pendingAttackSetup) { toast("Finish the current attack before starting another."); return; }
    const field=findFieldCard(match.selected); if(!field||field.side!=="human"){toast("Select one of your units on the field to attack.");return;} if(field.instance.rested){toast("That unit is already rested.");return;} if(field.instance.locked){toast("That unit is locked and cannot attack.");return;}
    const front=field.zone==="vanguard"||field.zone==="rear-left"||field.zone==="rear-right"||field.zone.startsWith("accel-");
    if(!front&&!canAttackFromBackRow(field)){toast("Only a Vanguard or front-row Rear-Guard can attack unless its card text allows a back-row attack.");return;}
    const booster=(field.zone==="vanguard"||field.zone==="rear-left"||field.zone==="rear-right")?directlyBehind(field):null;
    match.pendingAttackSetup={attackerUid:field.instance.uid,attackerSide:"human",defenderSide:"bot",boosterUid:booster&&!booster.rested&&!booster.locked?booster.uid:null,stage:booster&&!booster.rested&&!booster.locked?"boost":"target"};
    match.selected=null;renderMatch();
  }
  function beginChosenAttack(choice) {
    const pendingAttack = match?.pendingAttack;
    if (pendingAttack?.driveCountPrompt && choice.startsWith("drive-count:")) {
      const count = Math.max(0, Math.min(Number(pendingAttack.maxDriveChecks) || 0, Number(choice.slice("drive-count:".length)) || 0));
      pendingAttack.driveChecksRemaining = count; pendingAttack.driveCountPrompt = false; pendingAttack.driveCountChosen = true;
      pendingAttack.awaitingDrive = count > 0;
      if (!count) resolvePracticeAttackAfterDrives();
      renderMatch(); return;
    }
    const setup=match?.pendingAttackSetup;if(!setup)return;
    if(setup.stage==="boost"){
      if(choice.startsWith("boost:")&&choice!=="boost:none"){
        const uid=choice.slice("boost:".length),booster=findFieldCard(uid);
        if(!booster||booster.side!==setup.attackerSide||booster.instance.rested||booster.instance.locked||uid!==setup.boosterUid){toast("That Rear-Guard can no longer boost this attack.");return;}
        booster.instance.rested=true;setup.boostUid=uid;setup.boostPower=attackerPower(booster);addLog(`${cardMap.get(booster.instance.cardId)?.name||"A Rear-Guard"} boosted for +${setup.boostPower.toLocaleString()} this attack.`);
      } else if(choice!=="boost:none")return;
      setup.stage="target";renderMatch();return;
    }
    if(!choice.startsWith("target:"))return;
    const [,zone,targetUid]=choice.split(":"),attacker=findFieldCard(setup.attackerUid),defenderSide=setup.defenderSide||flipSide(setup.attackerSide),defender=match.players[defenderSide];if(!attacker)return;
    let target=null,index=-1;
    if(zone==="vanguard")target=defender.vanguard?.uid===targetUid?defender.vanguard:null;
    else {index=defender.rear.findIndex(unit=>unit?.uid===targetUid);target=index>=0?defender.rear[index]:null;const targetZone=index===0?"rear-left":index===1?"rear-right":index>=5?`accel-${index-4}`:"";if(targetZone!==zone)target=null;}
    if(!target){toast("That attack target is no longer in its circle.");return;}
    attacker.instance.rested=true;
    const attackerCard=cardMap.get(attacker.instance.cardId),driveChecks=attacker.zone==="vanguard"?getDriveValue(attackerCard):0;
    match.pendingAttack={attacker:attackerCard?.name||"unit",attackerUid:attacker.instance.uid,attackerSide:setup.attackerSide,attackerZone:attacker.zone,defenderSide,targetUid,targetRearIndex:index, targetZone:zone,boostPower:Number(setup.boostPower||0),power:attackerPower(attacker)+Number(setup.boostPower||0),targetPower:attackerPower({instance:target}),critical:attackerCritical(attacker),guardCards:[],driveChecksRemaining:driveChecks,maxDriveChecks:driveChecks,driveCountPrompt:false,driveCountChosen:true,awaitingDrive:driveChecks>0};
    match.pendingAttackSetup=null;$("#attack-prompt-dialog").close();queueAbilityPrompts("attack",setup.attackerSide,attacker.instance.uid);addLog(`${match.pendingAttack.attacker} attacked ${match.players[defenderSide].name}'s ${zone==="vanguard"?"Vanguard":"Rear-Guard"}.`);
    if (!online.role && defenderSide === "bot") { if(match.pendingAbility||match.pendingAbilities?.length)match.resumeAfterAbility="bot-defense";else practiceBotDefend(); return; }
    setMessage(`${match.players[defenderSide].name} is defending — choose Guard or No guard.`);renderMatch();
  }
  function practiceBotDefend() {
    const attack = match?.pendingAttack; if (!attack || attack.defenderSide !== "bot") return;
    const bot = match.players.bot, candidates = bot.hand.map((x) => ({ x, shield: Number(cardMap.get(x.cardId)?.shield || 0) })).sort((a, b) => b.shield - a.shield);
    const needed = Math.max(0, attack.power - attack.targetPower), perfect = bot.hand.find(item => Number(cardMap.get(item.cardId)?.shield || 0) === 0 && isSentinel(cardMap.get(item.cardId))), cost = bot.hand.find(item => item.uid !== perfect?.uid);
    const attackerGrade=Number(cardMap.get(match.players[attack.attackerSide]?.vanguard?.cardId)?.grade||0),defenderGrade=Number(cardMap.get(bot.vanguard?.cardId)?.grade||0),heal=bot.hand.find(item=>triggerKind(item)==="heal"),gGuardian=bot.gDeck.find(item=>!item.faceUp&&isGGuardian(cardMap.get(item.cardId)));
    if(heal&&gGuardian&&attackerGrade>=3&&defenderGrade>=3&&Number(cardMap.get(gGuardian.cardId)?.shield||0)>needed&&Math.random()<0.25){bot.hand=bot.hand.filter(item=>item.uid!==heal.uid);bot.drop.push(heal);bot.gDeck=bot.gDeck.filter(item=>item.uid!==gGuardian.uid);bot.guardCircle.push(gGuardian);attack.guardCards.push(gGuardian);attack.targetPower+=Number(cardMap.get(gGuardian.cardId)?.shield||0);addLog(`Practice Bot discarded a Heal trigger to G-Guard with ${cardMap.get(gGuardian.cardId)?.name||"a G Guardian"}.`);completeAttackDefense(!attackHits(attack));return;}
    const intercept=bot.rear.map((unit,index)=>({unit,index,card:cardMap.get(unit?.cardId)})).find(({unit,index,card})=>unit&&index!==attack.targetRearIndex&&(index<2||index>=5)&&Number(card?.grade)===2&&hasIntercept(card)&&Number(card?.shield||0)>needed);
    if(intercept&&Math.random()<0.45){bot.rear[intercept.index]=null;intercept.unit.rested=true;bot.guardCircle.push(intercept.unit);attack.guardCards.push(intercept.unit);attack.targetPower+=Number(intercept.card.shield||0);addLog(`Practice Bot intercepted with ${intercept.card.name}.`);completeAttackDefense(!attackHits(attack));return;}
    if (perfect && cost && attack.power >= attack.targetPower && Math.random() < 0.2) {
      bot.hand = bot.hand.filter(item => item.uid !== perfect.uid && item.uid !== cost.uid); bot.drop.push(cost); bot.guardCircle.push(perfect); attack.guardCards.push(perfect); attack.perfectGuard = true;
      addLog(`Practice Bot used ${cardMap.get(perfect.cardId)?.name || "a zero-shield card"} as a perfect guard and discarded ${cardMap.get(cost.cardId)?.name || "a card"}.`);
      completeAttackDefense(true); return;
    }
    if (candidates[0]?.shield > needed && Math.random() < 0.28) {
      bot.hand = bot.hand.filter(x => x.uid !== candidates[0].x.uid); bot.guardCircle.push(candidates[0].x); attack.guardCards.push(candidates[0].x); attack.targetPower += candidates[0].shield;
      addLog(`Practice Bot guarded with ${cardMap.get(candidates[0].x.cardId)?.name || "a card"}.`);
    }
    completeAttackDefense(!attackHits(attack));
  }
  function finishAttack(blocked) {
    const attack=match?.pendingAttack;if(!attack)return;const defender=match.players[attack.defenderSide];
    for(const guard of attack.guardCards||[]){const card=cardMap.get(guard.cardId);if(isGGuardian(card))(defender.gDeck ||= []).push({...guard,faceUp:true,guarding:false});else defender.drop.push(guard);}
    defender.guardCircle=[];
    if(blocked)addLog(`${attack.attacker} was stopped by ${defender.name}'s guard.`);
    else { queueAbilityPrompts("hit",attack.attackerSide,attack.attackerUid); if(attack.targetZone==="vanguard"){addLog(`${attack.attacker} hit ${defender.name}'s Vanguard for ${attack.critical} damage.`);dealDamage(attack.defenderSide,attack.critical);}
    else {const index=defender.rear.findIndex(unit=>unit?.uid===attack.targetUid);if(index>=0){const unit=defender.rear.splice(index,1,null)[0];defender.drop.push(unit);addLog(`${cardMap.get(unit.cardId)?.name||"The Rear-Guard"} was hit and sent to Drop.`);queueMovedCardAbility(unit,attack.defenderSide,"drop","rear-left");}else addLog(`${attack.attacker} did not hit its Rear-Guard target.`);}}
    const attackerSide=attack.attackerSide;match.pendingAttack=null;match.pendingAttackSetup=null;match.selected=null;if($("#attack-prompt-dialog").open)$("#attack-prompt-dialog").close();renderMatch();
    if(!online.role&&attackerSide==="bot"&&!match.ended)setTimeout(nextBotAttack,450);
  }
  function dealDamage(side, amount = 1) {
    match.pendingDamageQueue ||= [];
    for (let i = 0; i < amount; i++) match.pendingDamageQueue.push(side);
    resolveDamageQueue();
  }
  function resolveDamageQueue() {
    while (match?.pendingDamageQueue?.length && !match.ended && !match.pendingTrigger) {
      const side = match.pendingDamageQueue.shift(), player = match.players[side], top = player.deck.pop();
      if (!top) { match.ended = true; addLog(`${side === "human" ? "You" : "Practice Bot"} lost because their deck is empty.`); setMessage("Match over — the deck is empty."); break; }
      if (triggerKind(top) !== "over") { player.damage.push(top); addLog(`${side === "human" ? "You" : "Practice Bot"} took 1 damage (${player.damage.length}/6).`); }
      beginTriggerResolution(side, top, "damage");
      if(triggerKind(top)!=="over")queueAbilityPrompts("damagePlace",side,top.uid,{zone:"damage"});
      checkDamageEnd(side);
    }
  }
  function humanGuard() {
    if (!match?.pendingAttack) return;
    if(match.pendingAttack.defenderSide!=="human"||match.pendingAttack.defenderDone){toast("Only the defending player can guard before finishing their defense.");return;}

    const instance = selectedHandCard();
    if (!instance) { toast("Select a card in your hand, then choose Guard. You can add more cards before choosing Done guarding."); return; }
    if(Number(cardMap.get(instance.cardId)?.shield||0)===0){if(!isSentinel(cardMap.get(instance.cardId))){toast("A zero-shield card can only guard if it has Sentinel.");return;}openProtectDiscardDialog(instance);return;}
    match.players.human.hand = match.players.human.hand.filter((x) => x.uid !== instance.uid);match.players.human.guardCircle.push(instance);match.pendingAttack.guardCards.push(instance);
    const shield=Number(cardMap.get(instance.cardId)?.shield||0);match.pendingAttack.targetPower+=shield;
    addLog(`${match.players.human.name} guarded with ${cardMap.get(instance.cardId)?.name||"a card"} for ${shield.toLocaleString()} shield.`);
    match.selected=null;renderMatch();
  }
  function openProtectDiscardDialog(marker) {
    const hand=match.players.human.hand.filter(item=>item.uid!==marker.uid),list=$("#protect-discard-list");
    if(!hand.length){toast("Protect Marker needs another card in your hand to discard.");return;}
    $("#protect-discard-dialog").dataset.markerUid=marker.uid;
    list.innerHTML=hand.map(item=>{const c=cardMap.get(item.cardId);return c?`<button class="zone-view-card" type="button" data-protect-cost="${escapeHtml(item.uid)}">${cardImage(c)}<b>Discard ${escapeHtml(c.name)}</b></button>`:"";}).join("");
    $("#protect-discard-dialog").showModal();
  }
  function resolveProtectGuard(markerUid,costUid) {
    const attack=match?.pendingAttack,player=match?.players?.human;
    if(!attack||attack.defenderSide!=="human"){toast("A perfect guard can only be used while defending an attack.");return;}
    const marker=player.hand.find(item=>item.uid===markerUid&&Number(cardMap.get(item.cardId)?.shield||0)===0&&isSentinel(cardMap.get(item.cardId))),cost=player.hand.find(item=>item.uid===costUid&&item.uid!==markerUid);
    if(!marker||!cost){toast("Choose a zero-shield card and a different card to discard.");return;}
    player.hand=player.hand.filter(item=>item.uid!==markerUid&&item.uid!==costUid);player.drop.push(cost);player.guardCircle||=[];attack.guardCards||[];player.guardCircle.push(marker);attack.guardCards.push(marker);attack.perfectGuard=true;addLog(`${player.name} discarded ${cardMap.get(cost.cardId)?.name||"a card"} with ${cardMap.get(marker.cardId)?.name||"a zero-shield card"}. The attack was stopped.`);match.selected=null;completeAttackDefense(true);
  }
  function completeAttackDefense(blocked) {
    const attack = match?.pendingAttack; if (!attack) return;
    attack.defenderDone = true;
    attack.blocked = Boolean(attack.perfectGuard || !attackHits(attack));
    if (Number(attack.maxDriveChecks || 0) > 0 && !attack.driveCountChosen) {
      attack.driveCountPrompt = true; attack.awaitingDrive = false;
      setMessage(`${match.players[attack.attackerSide].name} choose the number of drive checks.`);
      renderMatch(); return;
    }
    attack.driveCountPrompt = false;
    if (Number(attack.driveChecksRemaining || 0) > 0) {
      attack.awaitingDrive = true;
      setMessage(`${match.players[attack.attackerSide].name} must complete ${attack.driveChecksRemaining} Vanguard drive check${attack.driveChecksRemaining === 1 ? "" : "s"}.`);
      renderMatch(); return;
    }
    if (!online.role) { finishAttack(attack.blocked); return; }
    setMessage(`${match.players[attack.attackerSide].name} can finish the attack.`);
    renderMatch();
  }
  function confirmAttackFinished() {
    const attack = match?.pendingAttack;
    if (!attack || attack.attackerSide !== "human" || !attack.defenderDone || attack.driveCountPrompt || Number(attack.driveChecksRemaining || 0) > 0) {
      toast("Wait until the defender is done guarding before finishing this attack."); return;
    }
    finishAttack(Boolean(attack.perfectGuard || !attackHits(attack)));
  }
  function noGuard() {
    if (!match?.pendingAttack) { toast("No attack is waiting to be resolved."); return; }
    if(match.pendingAttack.defenderSide!=="human"){toast("The attacker must wait for the defending player to finish guarding.");return;}

    if (match.pendingAttack.defenderDone) return;
    completeAttackDefense(!attackHits(match.pendingAttack));
  }
  function canStrideForSide(side, turnStartGrade = -1) {
    const ownGrade = Number(cardMap.get(match?.players?.[side]?.vanguard?.cardId)?.grade ?? -1), opponentGrade = Number(cardMap.get(match?.players?.[flipSide(side)]?.vanguard?.cardId)?.grade ?? -1);
    return (ownGrade >= 3 && opponentGrade >= 3) || Number(turnStartGrade) >= 3;
  }
  function isStrideUnit(card) { return /G Unit/i.test(String(card?.type || "")) && !isGGuardian(card) && /\bStride\b/i.test(String(card?.text || "")); }
  function strideGrade(instance) { const card = cardMap.get(instance?.cardId); return /while paying[^.\n]*stride[^.\n]*grade\s*3/i.test(String(card?.text || "")) ? 3 : Number(card?.grade ?? 0); }
  function botStrideCost(strideCard, player) {
    const hand = player.hand || [], vanguard = cardMap.get(player.vanguard?.cardId), heartName = cardMap.get(player.vanguard?.strideHeart?.cardId)?.name;
    if (/Ultimate\s+Stride/i.test(String(strideCard?.text || ""))) { const payment = hand.find((item) => [vanguard?.name, heartName].includes(cardMap.get(item.cardId)?.name)); return payment ? [payment] : null; }
    const cards = hand.map((item) => ({ item, grade: strideGrade(item) }));
    for (const c of cards) if (c.grade >= 3) return [c.item];
    for (let i=0;i<cards.length;i++) for (let j=i+1;j<cards.length;j++) if (cards[i].grade+cards[j].grade>=3) return [cards[i].item,cards[j].item];
    for (let i=0;i<cards.length;i++) for (let j=i+1;j<cards.length;j++) for (let k=j+1;k<cards.length;k++) if (cards[i].grade+cards[j].grade+cards[k].grade>=3) return [cards[i].item,cards[j].item,cards[k].item];
    return null;
  }
  function performStrideForPlayer(player, stride, payment) {
    if (!stride || !payment?.length) return false;
    payment.forEach((cost) => { player.hand = player.hand.filter((item) => item.uid !== cost.uid); player.drop.push(cost); });
    const previous = player.vanguard, hearts = (previous?.strideHearts || (previous?.strideHeart ? [previous.strideHeart] : [])).map((item) => ({ ...item }));
    if (previous) { const old = { ...previous }; delete old.strideHeart; delete old.strideHearts; hearts.push(old); }
    const heart = hearts.find((item) => !isGDeckCard(cardMap.get(item.cardId)) && !isGGuardian(cardMap.get(item.cardId))) || null;
    player.vanguard = { ...stride, rested: Boolean(previous?.rested), strideHeart: heart, strideHearts: hearts };
    return true;
  }
  function botTurn() {
    if (!match || match.ended) return;
    match.side = "bot"; match.phase = 0; match.players.bot.vanguard && (match.players.bot.vanguard.rested = false); match.players.bot.rear.forEach((x) => x && (x.rested = false));
    const card = draw("bot"); if (card) addLog("Practice Bot drew a card for the Draw phase.");
    renderMatch(); setMessage("Practice Bot is taking its turn…");
    botTimer = setTimeout(() => {
      const bot = match.players.bot;
      const currentGrade = Number(cardMap.get(bot.vanguard?.cardId)?.grade ?? 0); match.turnStartGrades ||= {}; match.turnStartGrades.bot = currentGrade;
      if (canGAssist(bot)) {
        const revealed=[];for(let i=0;i<5&&bot.deck.length;i++)revealed.push(bot.deck.pop());
        const assistGrade=Number(cardMap.get(bot.vanguard?.cardId)?.grade||0)+1,found=revealed.find(item=>isUnitCard(cardMap.get(item.cardId))&&Number(cardMap.get(item.cardId)?.grade)===assistGrade);
        if(found){bot.hand.push(found);const costs=bot.hand.filter(item=>item.uid!==found.uid).sort((a,b)=>Number(cardMap.get(a.cardId)?.shield||0)-Number(cardMap.get(b.cardId)?.shield||0)).slice(0,2);bot.hand=bot.hand.filter(item=>!costs.some(cost=>cost.uid===item.uid));bot.removed||=[];bot.removed.push(...costs);addLog("Practice Bot used G Assist, added a grade-up Unit, and removed two hand cards from the game.");}
        else addLog("Practice Bot used G Assist but found no eligible Unit.");
        bot.deck.push(...revealed.filter(item=>item!==found));shuffle(bot.deck);
      }
      if (currentGrade < 3) {
        const nextRide = bot.hand.map((x) => ({ x, c: cardMap.get(x.cardId) })).find((item) => isUnitCard(item.c) && Number(item.c.grade) === currentGrade + 1);
        const sameGradeRide = nextRide ? null : bot.hand.map((x) => ({ x, c: cardMap.get(x.cardId) })).find((item) => isUnitCard(item.c) && Number(item.c.grade) === currentGrade);
        const ride = nextRide || sameGradeRide;
        if (ride) { const previous=bot.vanguard; bot.hand = bot.hand.filter((x) => x.uid !== ride.x.uid); if (bot.vanguard) bot.soul.push(bot.vanguard); bot.vanguard = { ...ride.x, rested: false }; addLog(`Practice Bot ${nextRide ? "rode up to" : "rode"} ${ride.c.name}.`); if(previous)queueMovedCardAbility(previous,"bot","ride","vanguard"); queueAbilityPrompts("place","bot",ride.x.uid); }
      } else addLog("Practice Bot is grade 3 or greater and will not make a normal ride.");
      const botGrade = Number(cardMap.get(bot.vanguard?.cardId)?.grade ?? 0);
      if (canStrideForSide("bot", match.turnStartGrades.bot)) {
        const choice = bot.gDeck.filter((item) => !item.faceUp && isStrideUnit(cardMap.get(item.cardId))).map((item) => ({ item, card: cardMap.get(item.cardId), payment: botStrideCost(cardMap.get(item.cardId), bot) })).find((entry) => entry.payment);
        if (choice) { const strideIndex = bot.gDeck.findIndex((item) => item.uid === choice.item.uid), stride = bot.gDeck.splice(strideIndex, 1)[0]; performStrideForPlayer(bot, stride, choice.payment); match.stridePerformed = true; addLog(`Practice Bot discarded cards to stride ${choice.card.name}.`); }
      }
      let calls = 0;
      while (bot.rear.includes(null) && calls < 2) { const unit = bot.hand.find((x) => { const card = cardMap.get(x.cardId); return isUnitCard(card) && Number(card.grade || 0) <= Number(cardMap.get(bot.vanguard?.cardId)?.grade || 0); }); if (!unit) break; bot.hand = bot.hand.filter((x) => x.uid !== unit.uid); bot.rear[bot.rear.indexOf(null)] = { ...unit, rested: false }; addLog(`Practice Bot called ${cardMap.get(unit.cardId)?.name}.`); queueAbilityPrompts("place","bot",unit.uid); calls++; }
      renderMatch(); setMessage("Practice Bot is attacking…");
      const attackers = (match.initialBotTurn && match.firstSide === "bot" ? [] : [bot.vanguard, ...bot.rear]).filter((x) => { if(!x||x.rested||x.locked)return false;const field=findFieldCard(x.uid);return field&&(field.zone==="vanguard"||field.zone==="rear-left"||field.zone==="rear-right"||field.zone.startsWith("accel-")||canAttackFromBackRow(field)); });
      match.botAttacks = attackers.map((x) => x.uid);
      setTimeout(nextBotAttack, 550);
    }, 750);
  }
  function nextBotAttack() {
    if (!match || match.ended || match.side !== "bot" || match.pendingAttack || match.pendingTrigger) return;
    const bot = match.players.bot; const uid = match.botAttacks.shift();
    if (!uid) { finishBotTurn(); return; }
    const attacker = [bot.vanguard, ...bot.rear].find((x) => x?.uid === uid); if (!attacker) { nextBotAttack(); return; }
    const c = cardMap.get(attacker.cardId), field = findFieldCard(uid); if (!field) { nextBotAttack(); return; }
    attacker.rested = true; const human = match.players.human; const frontRear = human.rear.map((unit, index) => ({ unit, zone: index === 0 ? "rear-left" : index === 1 ? "rear-right" : index >= 5 ? "accel-" + (index - 4) : "" })).filter((item) => item.unit && item.zone); const attackRear = frontRear.length && Math.random() < 0.33; const target = attackRear ? frontRear[Math.floor(Math.random() * frontRear.length)].unit : human.vanguard; const targetZone = attackRear ? frontRear.find((item) => item.unit.uid === target.uid).zone : "vanguard"; const targetPower = target ? attackerPower({ instance: target }) : 0;
    const driveCount = field.zone === "vanguard" ? getDriveValue(c) : 0;
    match.pendingAttack = { attacker: c?.name || "unit", attackerUid: uid, attackerSide: "bot", attackerZone: field.zone, defenderSide: "human", targetUid: target?.uid, targetRearIndex: attackRear ? human.rear.findIndex((unit) => unit?.uid === target?.uid) : -1, targetZone, power: attackerPower(field), targetPower, critical: attackerCritical(field), guardCards: [], driveChecksRemaining: driveCount, maxDriveChecks: driveCount, driveCountChosen: true, driveCountPrompt: false };
    queueAbilityPrompts("attack","bot",uid); match.selected = null; setMessage("Practice Bot attacks with " + (c?.name || "a unit") + (targetZone === "vanguard" ? "" : " at your " + (targetZone.startsWith("accel-") ? "Accel circle" : "Rear-Guard")) + ". Guard or take the hit."); renderMatch();
  }
  function finishBotTurn() {
    if (!match || match.ended) return;
    match.players.human.vanguard && (match.players.human.vanguard.rested = false); match.players.human.rear.forEach((x) => x && (x.rested = false));
    returnStriddenVanguard("bot"); clearTurnBonuses("bot"); match.side = "human"; match.phase = 0; match.drewThisTurn = false; match.ridePerformed = false; match.stridePerformed = false; match.turnStartGrades ||= {}; match.turnStartGrades.human = Number(cardMap.get(match.players.human.vanguard?.cardId)?.grade ?? -1); match.ordersPlayedThisTurn = 0; match.pendingAttack = null; match.selected = null;
    if (match.initialBotTurn) match.initialBotTurn = false; else match.turn += 1; match.firstTurnComplete = true;
    addLog("Your turn began — advance to Draw to draw a card.");
    setMessage("Your turn — Stand phase."); renderMatch();
  }
  function endTurn() {
    if (!match || match.ended) return;
    if (match.side !== "human" || match.phase !== phases.length - 1 || match.pendingAttack) { toast("Finish the End phase after any pending attack before ending your turn."); return; }
    if (online.role) {
      addLog(`${match.players.human.name} ended their turn.`); match.firstTurnComplete = true; returnStriddenVanguard("human"); clearTurnBonuses("human"); match.ridePerformed = false; match.stridePerformed = false; match.ordersPlayedThisTurn = 0; match.selected = null;
      match.players.human.vanguard && (match.players.human.vanguard.rested = false); match.players.human.rear.forEach((x) => x && (x.rested = false));
      match.side = "bot"; match.phase = 0; match.drewThisTurn = false;
      setMessage(`${match.players.bot.name}'s turn — Stand phase.`); renderMatch(); return;
    }
    addLog("You ended your turn."); match.firstTurnComplete = true; returnStriddenVanguard("human"); clearTurnBonuses("human"); match.ridePerformed = false; match.stridePerformed = false; match.ordersPlayedThisTurn = 0; match.selected = null; renderMatch(); botTurn();
  }
  function returnStriddenVanguard(side) { const player=match?.players?.[side],unit=player?.vanguard;if(!unit?.strideHeart)return;const hearts=unit.strideHearts||[unit.strideHeart],heart=hearts.find((item)=>!isGDeckCard(cardMap.get(item.cardId))&&!isGGuardian(cardMap.get(item.cardId)))||unit.strideHeart,stride={...unit};delete stride.strideHeart;delete stride.strideHearts;const gHearts=hearts.filter((item)=>isGDeckCard(cardMap.get(item.cardId))&&!isGGuardian(cardMap.get(item.cardId)));gHearts.forEach((item)=>player.gZone.push({...item,faceUp:true,rested:false}));hearts.filter((item)=>item.uid!==heart.uid&&!gHearts.some((g)=>g.uid===item.uid)).forEach((item)=>player.soul.push(item));player.vanguard={...heart,rested:Boolean(unit.rested)};player.gZone.push({...stride,faceUp:true,rested:false});addLog(`${cardMap.get(stride.cardId)?.name||"The G Unit"} and its G-unit heart cards returned face up to the G zone; ${cardMap.get(heart.cardId)?.name||"the heart"} returned to the Vanguard circle.`); }
  function clearTurnBonuses(side) { const seen=new Set();const walk=(value)=>{if(!value||typeof value!=="object"||seen.has(value))return;seen.add(value);if(value.turnPowerExpiry===side||value.turnPowerExpiry==null){value.turnPowerBoost=0;delete value.turnPowerExpiry;}if(value.turnCriticalExpiry===side||value.turnCriticalExpiry==null){value.turnCriticalBoost=0;delete value.turnCriticalExpiry;}Object.values(value).forEach(walk);};Object.values(match?.players||{}).forEach(walk); }
  function flipTurnBonusOwners(players) { const seen=new Set();const walk=(value)=>{if(!value||typeof value!=="object"||seen.has(value))return;seen.add(value);if(value.turnPowerExpiry)value.turnPowerExpiry=flipSide(value.turnPowerExpiry);if(value.turnCriticalExpiry)value.turnCriticalExpiry=flipSide(value.turnCriticalExpiry);Object.values(value).forEach(walk);};Object.values(players||{}).forEach(walk); }
  function advancePhase() {
    if (!match || match.ended) return;
    if (match.side !== "human" || match.pendingAttack) { toast("Wait until it is your turn and any pending attack is resolved."); return; }
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
  function performSuperiorRide(source, uid) {
    const player=match?.players?.human;
    if(!player||online.role==="watcher")return;
    let instance=null,sourceCards=null,field=null;
    if(source==="field"){
      field=findFieldCard(uid);
      if(field?.side!=="human"||field.zone==="vanguard"){toast("Choose one of your Rear-Guards to Superior Ride.");return;}
      instance=field.instance;
    }else{
      sourceCards={hand:player.hand,deck:player.deck,soul:player.soul,bind:player.bind||[],drop:player.drop,damage:player.damage,reveal:match.revealed?.owner==="human"?match.revealed.cards||[]:[]}[source];
      const index=sourceCards?.findIndex(card=>card.uid===uid)??-1;
      if(index<0)return;
      instance=sourceCards[index];
    }
    if(!isUnitCard(cardMap.get(instance?.cardId))){toast("Only a Unit card can be Superior Ridden.");return;}
    if(player.vanguard?.uid===instance.uid){toast("That card is already your Vanguard.");return;}
    if(field)player.rear[field.index]=null;
    else sourceCards.splice(sourceCards.findIndex(card=>card.uid===uid),1);
    const previous=player.vanguard;
    if(previous)player.soul.push(previous);
    player.vanguard={...instance,rested:false};
    if(source==="deck")shuffle(player.deck);
    if(match.revealed?.owner==="human"&&source==="reveal"&&!match.revealed.cards.length)match.revealed=null;
    match.selected=null;match.ridePerformed=true;
    addLog(`${player.name} Superior Rode ${cardMap.get(instance.cardId)?.name||"a Unit"} from ${source}.`);
    if(previous)queueMovedCardAbility(previous,"human","ride","vanguard");
    queueAbilityPrompts("ride","human");queueAbilityPrompts("place","human",instance.uid);
    askForCardCrest("human",instance);setMessage("Superior Ride complete.");
  }
  function manualGameAction(action) {
    if (!match || match.ended) return;
    const player = match.players.human, card = selectedHandCard();
    if (action.startsWith("superior-ride:")) { const [,source,uid]=action.split(":"); performSuperiorRide(source,uid); return; }
    if (action === "g-assist") {
      if (match.side !== "human" || match.phase !== 1 || !canGAssist(player) || match.pendingGAssist) { toast("G Assist is available during Draw only when you lack a Unit exactly one grade above your Vanguard."); return; }
      const cards=[]; for(let i=0;i<5&&player.deck.length;i++)cards.push(player.deck.pop());
      match.pendingGAssist={ownerSide:"human",stage:"choose",cards,discardUids:[]}; renderGAssistDialog(); return;
    } else if (action.startsWith("g-assist-pick:")) {
      const state=match.pendingGAssist,uid=action.slice("g-assist-pick:".length); if(!state||state.ownerSide!=="human"||state.stage!=="choose")return;
      const index=state.cards.findIndex(item=>item.uid===uid),instance=index>=0?state.cards[index]:null,grade=Number(cardMap.get(player.vanguard?.cardId)?.grade||0)+1;
      if(!instance||!isUnitCard(cardMap.get(instance.cardId))||Number(cardMap.get(instance.cardId)?.grade)!==grade){toast("Choose a Unit exactly one grade above your Vanguard.");return;}
      state.cards.splice(index,1);player.hand.push(instance);player.deck.push(...state.cards);shuffle(player.deck);state.cards=[];state.stage="discard";state.addedCardId=instance.cardId;state.discardUids=[];addLog(`${player.name} used G Assist to add ${cardMap.get(instance.cardId)?.name||"a Unit"} to hand.`);renderGAssistDialog();return;
    } else if (action === "g-assist-none") {
      const state=match.pendingGAssist;if(!state||state.ownerSide!=="human"||state.stage!=="choose")return;player.deck.push(...state.cards);shuffle(player.deck);match.pendingGAssist=null;$("#g-assist-dialog").close();addLog(`${player.name} declined G Assist and shuffled their deck.`);return;
    } else if (action.startsWith("g-assist-discard:")) {
      const state=match.pendingGAssist,uid=action.slice("g-assist-discard:".length);if(!state||state.ownerSide!=="human"||state.stage!=="discard"||!player.hand.some(item=>item.uid===uid))return;
      const selected=new Set(state.discardUids);selected.has(uid)?selected.delete(uid):selected.size<2&&selected.add(uid);state.discardUids=[...selected];renderGAssistDialog();return;
    } else if (action === "g-assist-finish") {
      const state=match.pendingGAssist;if(!state||state.ownerSide!=="human"||state.stage!=="discard"||state.discardUids.length!==2)return;
      const removed=player.hand.filter(item=>state.discardUids.includes(item.uid));if(removed.length!==2){toast("Choose two cards still in your hand.");return;}player.hand=player.hand.filter(item=>!state.discardUids.includes(item.uid));player.removed||=[];player.removed.push(...removed);match.pendingGAssist=null;$("#g-assist-dialog").close();addLog(`${player.name} removed two cards from the game for G Assist.`);return;
    } else if (action === "draw-card") {
      const card = draw("human"); if (!card) { toast("Your deck is empty."); return; }
      addLog(`${player.name} drew a card manually.`);
    } else if (action === "top-to-drop" || action === "mill") {
      const top=player.deck.pop();if(!top){toast("Your deck is empty.");return;}player.drop.push(top);addLog(`${player.name} sent ${cardMap.get(top.cardId)?.name||"the top card"} of the deck to Drop.`);
    } else if (action.startsWith("attack-choice:")) {
      beginChosenAttack(action.slice("attack-choice:".length));return;
    } else if (action === "hand-to-top" || action === "hand-to-bottom") {
      const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid);
      if (action === "hand-to-top") player.deck.push(instance); else player.deck.unshift(instance);
      match.selected = null;
      addLog(`${player.name} returned ${cardMap.get(instance.cardId)?.name || "a card"} to the ${action === "hand-to-top" ? "top" : "bottom"} of the deck.`);
    } else if (action === "damage-check" || action === "drive-check" || action === "trigger-check") {
      if(action==="drive-check"&&(!match.pendingAttack||match.pendingAttack.attackerSide!=="human"||match.pendingAttack.attackerZone!=="vanguard"||Number(match.pendingAttack.driveChecksRemaining||0)<=0)){toast("Only your Vanguard can perform a drive check, during its attack.");return;}
      if(action==="drive-check"){if(!player.deck.length){match.pendingAttack.driveChecksRemaining=0;match.pendingAttack.awaitingDrive=true;addLog(`${player.name} has no cards left to reveal; remaining drive checks were skipped.`);resolvePracticeAttackAfterDrives();return;}match.pendingAttack.driveChecksRemaining-=1;}
      const top = player.deck.pop(); if (!top) { toast("Your deck is empty."); return; }
      const kind = triggerKind(top), over = kind === "over";
      if (action === "damage-check") { if (!over) player.damage.push(top); } else if (!over) player.hand.push(top);
      const checkName = action === "damage-check" ? "damage" : action === "trigger-check" ? "trigger" : "drive";
      addLog(`${player.name} performed a ${checkName} check and revealed ${cardMap.get(top.cardId)?.name || "a card"}.`);
      beginTriggerResolution("human", top, checkName);
      if(action==="damage-check"&&triggerKind(top)!=="over")queueAbilityPrompts("damagePlace","human",top.uid,{zone:"damage"});
      checkDamageEnd("human");
      if(action==="drive-check")resolvePracticeAttackAfterDrives();
    } else if (action.startsWith("trigger-pick:")) {
      chooseTriggerTarget(action.slice("trigger-pick:".length)); return;
    } else if (action === "trigger-skip") {
      if (match.pendingTrigger?.stage === "heal-target") { match.pendingTrigger.stage = "power-target"; if (!fieldUnits("human").length) finishTriggerResolution(); }
    } else if (action.startsWith("place:")) {
      const zone = action.slice(6);
      if (zone === "vanguard") {
        const instance = selectedHandCard();
        if (!instance) { toast("Select a card in your hand first."); return; }
        const grade = Number(cardMap.get(instance.cardId)?.grade || 0), currentGrade = Number(cardMap.get(player.vanguard?.cardId)?.grade || 0), previousVanguard=player.vanguard;
        if (match.side !== "human" || match.phase !== 2 || match.ridePerformed || grade < currentGrade || grade > currentGrade + 1) { toast("A normal ride is once per turn and must be the same grade or one grade higher than your Vanguard."); return; }
        player.hand = player.hand.filter((item) => item.uid !== instance.uid); if (player.vanguard) player.soul.push(player.vanguard); player.vanguard = { ...instance, rested: false }; match.selected = null;
        match.ridePerformed = true; askForCardCrest("human", instance);
        addLog(`${player.name} rode ${cardMap.get(instance.cardId)?.name || "a card"} to vanguard.`); if(previousVanguard)queueMovedCardAbility(previousVanguard,"human","ride","vanguard"); queueAbilityPrompts("ride", "human"); queueAbilityPrompts("place", "human");
        renderMatch(); return;
      }
      if (match.side !== "human" || match.phase !== 4) { toast("You can call units during your Main phase."); return; }
      const index = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)].indexOf(zone);
      const instance = selectedHandCard();
      if (!instance || index < 0) { toast("Select a card and choose a rear-guard circle."); return; }
      if (!isUnitCard(cardMap.get(instance.cardId)) || Number(cardMap.get(instance.cardId)?.grade || 0) > Number(cardMap.get(player.vanguard?.cardId)?.grade || 0)) { toast("You can only call a Unit whose grade is no higher than your Vanguard."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); callUnitToRear(player,"human",instance,index,{source:"hand"}); match.selected = null;
      addLog(`${player.name} called ${cardMap.get(instance.cardId)?.name || "a card"} to the ${zone} circle.`);
    } else if (action === "alter-power") { $("#power-input-dialog").showModal(); return;
    } else if (action.startsWith("set-power:")) {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") return;
      const amount = Number(action.slice("set-power:".length)); if (!Number.isFinite(amount)) return;
      field.instance.powerBoost = Number(field.instance.powerBoost || 0) + amount;
      if (match.pendingAttack?.attackerUid === field.instance.uid) match.pendingAttack.power += amount;
      if (match.pendingAttack?.targetUid === field.instance.uid) match.pendingAttack.targetPower += amount;
      addLog(`${player.name} changed ${cardMap.get(field.instance.cardId)?.name || "a unit"}'s power by ${amount >= 0 ? "+" : ""}${amount.toLocaleString()}.`);    } else if (action === "crest-add") {
      const pending = match.pendingCrest;
      if (!pending || pending.side !== "human") return;
      player.hand.push({ uid: `crest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, cardId: ensureCrestCard(pending.name), crestName: pending.name, isToken: true });
      addLog(`${player.name} added the ${pending.name} Crest to hand.`); match.pendingCrest = null; $("#crest-prompt-dialog").close();
    } else if (action === "crest-skip") {
      if (match.pendingCrest?.side === "human") { addLog(`${player.name} declined the ${match.pendingCrest.name} Crest.`); match.pendingCrest = null; $("#crest-prompt-dialog").close(); }
    } else if (action === "crest-place") {
      const instance = selectedHandCard();
      if (!instance || cardMap.get(instance.cardId)?.type !== "Crest") { toast("Select a Crest in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); player.crests ||= []; player.crests.push(instance); match.selected = null; addLog(`${player.name} placed ${cardMap.get(instance.cardId)?.name} in the Crest zone.`);    } else if (action === "hand-to-order") {
      const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); player.orders ||= []; player.orders.push(instance); match.selected = null;
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a card"} from hand to the Order zone.`);
    } else if (action === "public-reveal") {
      const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
      match.publicReveal = { owner: "human", instance: { ...instance } };
      addLog(`${player.name} revealed ${cardMap.get(instance.cardId)?.name || "a card"} from hand to the opponent.`);
    } else if (action === "public-reveal-close") {
      if (match.publicReveal?.owner === "human") match.publicReveal = null;
    } else if (action === "play-order") {
      const instance = selectedHandCard();
      if (!instance || !/Order/i.test(cardMap.get(instance.cardId)?.type || "")) { toast("Select an Order card in your hand first."); return; }
      const orderCard = cardMap.get(instance.cardId), orderGrade = Number(cardMap.get(player.vanguard?.cardId)?.grade || 0);
      if (match.side !== "human" || match.phase !== 4 || /Blitz Order/i.test(orderCard.type) || (match.ordersPlayedThisTurn || 0) >= 1 || Number(orderCard.grade || 0) > orderGrade) { toast("During Main phase, play one non-Blitz Order per turn with grade no higher than your Vanguard."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); player.orders.push(instance); match.ordersPlayedThisTurn = (match.ordersPlayedThisTurn || 0) + 1; match.selected = null;
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
      const sourceZones = { deck: player.deck, bind: player.bind || [], gdeck: player.gDeck || [], soul: player.soul || [], drop: player.drop || [], damage: player.damage || [], reveal: match.revealed?.owner === "human" ? match.revealed.cards || [] : [] };
      const sourceCards = sourceZones[source], index = sourceCards?.findIndex((item) => item.uid === uid) ?? -1;
      if (index < 0) return;
      if (choice === "field") {
        const instance=sourceCards[index],card=cardMap.get(instance.cardId);
        if(!isUnitCard(card)){toast("Only a Unit can be placed on the field.");return;}
        if(source==="reveal"&&match.revealed?.owner!=="human"){toast("Only your revealed cards can be moved to the field.");return;}
        const rearZones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)];
        const rearIndex=rearZones.indexOf(targetZone);
        if(targetZone!=="vanguard"&&rearIndex<0){toast("Choose a Rear-Guard circle.");return;}

        sourceCards.splice(index,1);
        if(source==="damage")queueAbilityPrompts("damageLeave","human",instance.uid,{zone:"damage"});
        if(targetZone==="vanguard"){
          const previous=player.vanguard;if(previous)player.soul.push(previous);player.vanguard={...instance,rested:false};
          if(previous)queueMovedCardAbility(previous,"human","ride","vanguard");queueAbilityPrompts("ride","human",instance.uid,{zone:"vanguard"});queueAbilityPrompts("place","human",instance.uid,{zone:"vanguard"});
        }else callUnitToRear(player,"human",instance,rearIndex,{source});
        if(source==="reveal"&&!sourceCards.length)match.revealed=null;
        match.selected=null;zoneFieldSelection=null;addLog(`${player.name} moved ${card?.name||"a Unit"} from ${source==="soul"?"Soul":"a zone"} to ${targetZone==="vanguard"?"Vanguard":targetZone}.`);return;
      }
      const instance = sourceCards.splice(index, 1)[0];
      if(source==="damage")queueAbilityPrompts("damageLeave","human",instance.uid,{zone:"damage"});
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
      if(choice==="heal"){const healed=player.damage.splice(index,1)[0];player.drop.push(healed);queueAbilityPrompts("damageLeave","human",healed.uid,{zone:"damage"});}else damage.faceDown=choice === "counter-blast";
      $("#damage-dialog").close(); addLog(`${player.name} ${choice === "heal" ? "healed" : choice === "counter-blast" ? "Counter-Blasted" : "Counter-Charged"} ${cardMap.get(damage.cardId)?.name || "a damage card"}${choice === "heal" ? " to Drop" : ""}.`);
    } else if (action.startsWith("drop-action:")) {
      const [, choice, uid, zone] = action.split(":"); const index=player.drop.findIndex((item)=>item.uid===uid); if(index<0)return; const instance=player.drop[index];
      if(choice==="hand"){player.hand.push(player.drop.splice(index,1)[0]);} else if(choice==="soul"){player.soul.push(player.drop.splice(index,1)[0]);} else if(choice==="bind"){player.bind.push(player.drop.splice(index,1)[0]);} else if(choice==="deck-top"){player.deck.push(player.drop.splice(index,1)[0]);} else if(choice==="deck-bottom"){player.deck.unshift(player.drop.splice(index,1)[0]);}
      else if(choice==="field"){const fields=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>"accel-"+(i+1))],instance=player.drop.splice(index,1)[0];if(zone==="vanguard"){const previous=player.vanguard;if(previous)player.soul.push(previous);player.vanguard={...instance,rested:false};if(previous)queueMovedCardAbility(previous,"human","ride","vanguard");queueAbilityPrompts("ride","human",instance.uid,{zone:"vanguard"});queueAbilityPrompts("place","human",instance.uid,{zone:"vanguard"});}else{const ix=fields.indexOf(zone);if(ix<0){player.drop.splice(index,0,instance);toast("Choose a Rear-Guard circle.");return;}callUnitToRear(player,"human",instance,ix,{source:"drop"});}}
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
    } else if (["power", "minus-power", "power-1000", "minus-power-1000"].includes(action)) {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") { toast("Select one of your units first."); return; }
      const step = action.endsWith("1000") ? 1000 : 5000, amount = action.startsWith("minus-") ? -step : step;
      if (amount < 0 && Number(field.instance.powerBoost || 0) < step) { toast(`This unit has no +${step} power bonus to remove.`); return; }
      field.instance.powerBoost = Math.max(0, Number(field.instance.powerBoost || 0) + amount);
      if (match.pendingAttack?.attackerUid === field.instance.uid) match.pendingAttack.power = Math.max(0, Number(match.pendingAttack.power || 0) + amount);
      if (match.pendingAttack?.targetUid === field.instance.uid) match.pendingAttack.targetPower = Math.max(0, Number(match.pendingAttack.targetPower || 0) + amount);
      addLog(`${player.name} ${amount > 0 ? "gave" : "removed"} ${step} power ${amount > 0 ? "to" : "from"} ${cardMap.get(field.instance.cardId)?.name || "a unit"}.`);
    } else if (action.startsWith("gift-force:")) {
      const [, type, zone] = action.split(":");
      const zones = ["vanguard", "rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
      if (!zones.includes(zone)) { toast("Choose a circle for the Force marker."); return; }
      player.giftZones.push({ type, zone }); player.gifts = (player.gifts || 0) + 1; const stackCount = player.giftZones.filter((gift) => gift.zone === zone && gift.type === type).length; addLog(`${player.name} placed ${type} on ${zone}${stackCount > 1 ? ` (stack ${stackCount})` : ""}.`);
    } else if (action.startsWith("gift-accel:")) {
      const type = action.slice("gift-accel:".length); player.accelZones = (player.accelZones || 0) + 1; player.accelTypes ||= []; player.accelTypes.push(type); player.rear.push(null); player.gifts = (player.gifts || 0) + 1; if (/II/i.test(type)) { const drawn = draw(match.side); addLog(drawn ? `${player.name} drew a card for Accel II.` : `${player.name} could not draw for Accel II because the deck is empty.`); } addLog(`${player.name} created an ${type} circle.`);
    } else if (action === "shuffle") {
      shuffle(player.deck); addLog(`${player.name} shuffled their deck.`);
    } else if (action.startsWith("move-rear-to:")) {
      const [, uid, zone] = action.split(":");
      const selectedField = findFieldCard(uid);
      if (match.selected !== uid || selectedField?.side !== "human" || selectedField.zone === "vanguard") { toast("Select one of your Rear-Guards first."); return; }
      moveRearCardToZone(uid, zone); return;
    } else if (action === "stride" || action.startsWith("stride:") || action.startsWith("stride-cost:") || action === "stride-confirm") {
      if (action === "view-gdeck") { openGDeckDialog("inspect"); return; }
      if (action === "stride") { if (match.side !== "human" || match.phase !== 3) { toast("Stride during your Stride step."); return; } openGDeckDialog("stride"); return; }
      if (action.startsWith("stride:")) {
        const uid = action.slice("stride:".length), stride = player.gDeck.find((item) => item.uid === uid), strideCard = cardMap.get(stride?.cardId);
        if (match.side !== "human" || match.phase !== 3 || match.stridePerformed || !canStrideForSide("human", match.turnStartGrades?.human)) { toast("Stride is once per turn and requires both Vanguards at grade 3, or a grade 3 Vanguard at the start of your turn."); return; }
        if (!stride || stride.faceUp || !isStrideUnit(strideCard)) { toast("Choose a face-down G Unit with a Stride ability."); return; }
        match.pendingStride = { ownerSide: "human", unitUid: uid, costUids: [], costValue: 0 }; renderStrideCostDialog(); return;
      }
      if (action.startsWith("stride-cost:")) {
        const state = match.pendingStride, uid = action.slice("stride-cost:".length); if (!state || state.ownerSide !== "human") return;
        const item = player.hand.find((card) => card.uid === uid); if (!item) return;
        const stride = player.gDeck.find((card) => card.uid === state.unitUid), strideCard = cardMap.get(stride?.cardId), ultimate = /Ultimate\s+Stride/i.test(String(strideCard?.text || ""));
        if (ultimate) state.costUids = state.costUids.includes(uid) ? [] : [uid];
        else { const selected = new Set(state.costUids); selected.has(uid) ? selected.delete(uid) : selected.add(uid); state.costUids = [...selected]; }
        renderStrideCostDialog(); return;
      }
      const state = match.pendingStride; if (!state || state.ownerSide !== "human") return;
      const strideIndex = player.gDeck.findIndex((item) => item.uid === state.unitUid), stride = strideIndex >= 0 ? player.gDeck[strideIndex] : null, strideCard = cardMap.get(stride?.cardId), payment = player.hand.filter((item) => state.costUids.includes(item.uid));
      const ultimate = /Ultimate\s+Stride/i.test(String(strideCard?.text || "")), names = [cardMap.get(player.vanguard?.cardId)?.name, cardMap.get(player.vanguard?.strideHeart?.cardId)?.name];
      const validCost = ultimate ? payment.length === 1 && names.includes(cardMap.get(payment[0]?.cardId)?.name) : payment.length > 0 && payment.reduce((sum, item) => sum + strideGrade(item), 0) >= 3;
      if (!stride || stride.faceUp || !isStrideUnit(strideCard) || !validCost || match.stridePerformed || !canStrideForSide("human", match.turnStartGrades?.human)) { toast("Choose a legal Stride cost and eligible face-down G Unit."); return; }
      player.gDeck.splice(strideIndex, 1); performStrideForPlayer(player, stride, payment); match.stridePerformed = true; match.pendingStride = null; $("#stride-cost-dialog").close(); addLog(`${player.name} strode ${strideCard.name} over ${cardMap.get(player.vanguard.strideHeart?.cardId)?.name || "their Vanguard"}.`); return;
    } else if (action.startsWith("gdeck-flip-up:")) {
      const uid=action.slice("gdeck-flip-up:".length),index=player.gDeck.findIndex(item=>item.uid===uid);if(index<0){toast("That card is no longer face down in the G deck.");return;}const instance=player.gDeck.splice(index,1)[0];player.gZone.push({...instance,faceUp:true});addLog(`${player.name} turned ${cardMap.get(instance.cardId)?.name||"a G card"} face up in the G zone.`);
    } else if (action === "gdeck-to-g") {
      const unit = player.gDeck?.pop(); if (!unit) { toast("Your G deck is empty."); return; }
      player.gZone.push({ ...unit, faceUp: true }); addLog(`${player.name} placed a G-deck card face up in the G zone.`);
    } else if (action === "field-to-g") {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") { toast("Select a unit on your field first."); return; }
      const playerZone = field.zone === "vanguard" ? "vanguard" : "rear";
      if (playerZone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.gZone.push({ ...field.instance, faceUp: true }); match.selected = null; addLog(`${player.name} moved a field unit face up to the G zone.`);
    } else if (action === "flip-g-unit") {
      if ((player.gDeck || []).some((item) => item.faceUp)) { const item = player.gDeck.find((card) => card.faceUp); item.faceUp = false; addLog(`${player.name} turned a face-up G-deck card face down.`); return; }
      if (!player.gZone?.length) { toast("Your G zone is empty."); return; }
      player.gDeck.push(player.gZone.shift()); addLog(`${player.name} turned a G-zone card face down and returned it to the G deck.`);
    } else if (action === "g-guard" || action.startsWith("g-guard:")) {
      if (!match.pendingAttack||match.pendingAttack.defenderSide!=="human"||match.pendingAttack.defenderDone) { toast("Use G-Guard while you are defending an attack."); return; }
      if (action === "g-guard") { openGGuardCostDialog(); return; }
      const [,uid,healUid]=action.split(":"),grade=Number(cardMap.get(player.vanguard?.cardId)?.grade||0),attackerGrade=Number(cardMap.get(match.players[match.pendingAttack.attackerSide]?.vanguard?.cardId)?.grade||0),healIndex=player.hand.findIndex(item=>item.uid===healUid&&triggerKind(item)==="heal"),index=player.gDeck?.findIndex(item=>item.uid===uid)??-1,guardian=index>=0?cardMap.get(player.gDeck[index].cardId):null;
      if(grade<3||attackerGrade<3||healIndex<0||index<0||player.gDeck[index]?.faceUp||!isGGuardian(guardian)){toast("G-Guard needs a grade 3+ Vanguard, a Heal trigger to discard, and a face-down G Guardian.");return;}
      const cost=player.hand.splice(healIndex,1)[0],instance=player.gDeck.splice(index,1)[0];player.guardCircle||=[];match.pendingAttack.guardCards||=[];player.drop.push(cost);player.guardCircle.push(instance);match.pendingAttack.guardCards.push(instance);match.pendingAttack.targetPower+=Number(guardian.shield||0);
      addLog(`${player.name} discarded ${cardMap.get(cost.cardId)?.name||"a Heal trigger"} to G-Guard with ${guardian.name} (+${Number(guardian.shield||0).toLocaleString()} shield).`);match.selected=null;
      renderMatch();
    } else if (action.startsWith("guard-perfect:")) {
      const [,markerUid,costUid]=action.split(":");resolveProtectGuard(markerUid,costUid);return;
    } else if (action === "intercept") {
      openInterceptDialog(); return;
    } else if (action.startsWith("intercept:")) {
      interceptWith(action.slice("intercept:".length));
    } else if (action === "guard") {
      if (!match.pendingAttack) { toast("There is no incoming attack to guard."); return; }
      humanGuard(); return;
    } else if (action.startsWith("order-to-hand:") || action.startsWith("order-to-top:") || action.startsWith("order-to-bottom:")) {
      const [destination, uid] = action.split(":"); const index = player.orders.findIndex(item => item.uid === uid); if (index < 0) return;
      const instance = player.orders.splice(index, 1)[0];
      if (destination === "order-to-hand") player.hand.push(instance);
      else if (destination === "order-to-top") player.deck.push(instance);
      else player.deck.unshift(instance);
      match.selected = null; addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "an Order"} from the Order zone.`);    } else if (action.startsWith("order-to-drop:")) {
      const uid = action.slice("order-to-drop:".length), index = player.orders.findIndex((item) => item.uid === uid);
      if (index < 0) return;
      player.drop.push(player.orders.splice(index, 1)[0]); addLog(`${player.name} moved an Order from the Order zone to drop.`);
    } else if (action === "selected-to-top" || action === "selected-to-bottom") {
      const field = findFieldCard(match.selected); if (field?.side !== "human") { toast("Select one of your field cards first."); return; }
      if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      if (action === "selected-to-top") player.deck.push(field.instance); else player.deck.unshift(field.instance);
      addLog(`${player.name} returned ${cardMap.get(field.instance.cardId)?.name || "a card"} to the ${action === "selected-to-top" ? "top" : "bottom"} of the deck.`); match.selected = null;    } else if (action === "selected-to-hand") {
      const field = findFieldCard(match.selected);
      if (field?.side !== "human") { toast("Select one of your field cards first."); return; }
      if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.hand.push(field.instance); match.selected = null;
      addLog(`${player.name} returned ${cardMap.get(field.instance.cardId)?.name || "a card"} from the field to hand.`);
    } else if (action === "selected-to-drop") {
      const hand = selectedHandCard(), field = findFieldCard(match.selected);
      if (hand) { player.hand = player.hand.filter((item) => item.uid !== hand.uid); player.drop.push(hand); addLog(`${player.name} moved ${cardMap.get(hand.cardId)?.name || "a card"} from hand to Drop.`); }
      else if (field?.side === "human") { if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null; player.drop.push(field.instance); addLog(`${player.name} moved ${cardMap.get(field.instance.cardId)?.name || "a unit"} from the field to Drop.`); queueMovedCardAbility(field.instance,"human","drop",field.zone); }
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
      player.hand = player.hand.filter((item) => item.uid !== card.uid); player.damage.push(card); queueAbilityPrompts("damagePlace","human",card.uid,{zone:"damage"}); match.selected = null;
      addLog(`${player.name} moved ${cardMap.get(card.cardId)?.name || "a card"} from hand to damage.`);
    } else if (action === "quick-shield" || action === "guardian-shield") {
      const tokenId=action==="guardian-shield"?"token-guardian-shield":"token-quick-shield"; if(action==="guardian-shield")player.guardianShields=(player.guardianShields||0)+1;else player.quickShields=(player.quickShields||0)+1; player.hand.push({ uid: `${tokenId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, cardId: tokenId, isToken: true }); addLog(`${player.name} added a ${action==="guardian-shield"?"Guardian Shield (2,000)":"Quick Shield (5,000)"} to hand.`);
    } else if (action === "protect-to-hand") {
      player.protectMarkers = (player.protectMarkers || 0) + 1; player.hand.push({ uid: `protect-marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, cardId: "token-protect", isToken: true }); addLog(`${player.name} added a Protect marker to hand.`);
    }
    renderMatch();
  }
  function flipSide(side) { return side === "human" ? "bot" : side === "bot" ? "human" : side; }
  function onlineDeck() {
    if (online.selectedDeck && deckCount(online.selectedDeck)) return { name: online.selectedDeck.name, cards: { ...online.selectedDeck.cards }, starterCardId: online.selectedDeck.starterCardId || "" };
    if (builder.cards && deckCount(builder)) return { name: builder.name || "My Deck", cards: { ...builder.cards }, starterCardId: builder.starterCardId || "" };
    return defaultDeck();
  }
  function renderOnlineDeckChoices() {
    const select = $("#online-deck-choice"), decks = readSavedDecks();
    select.innerHTML = decks.length ? decks.map((deck) => `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)} · ${deckCount(deck)} cards</option>`).join("") : '<option value="">No saved decks — save a deck first</option>';
    const preferred = online.selectedDeck?.id || (decks.some((deck) => deck.id === builder.id) ? builder.id : decks[0]?.id) || "";
    if (preferred) select.value = preferred;
    $("#online-deck-help").textContent = decks.length ? "Choose the saved deck you’ll use for this online match." : "Create and save a deck in Deck folder before hosting or joining as a player.";
    $("#online-deck-wrap").classList.toggle("hidden", online.dialogMode === "join" && $("#online-join-role").value === "spectator");
  }
  function selectOnlineDeck() {
    const deck = readSavedDecks().find((item) => item.id === $("#online-deck-choice").value);
    if (!deck || !deckCount(deck)) { setOnlineError("Choose a saved deck before starting an online match. Save a deck from the Deck folder first."); return false; }
    online.selectedDeck = { ...deck, cards: { ...deck.cards } }; return true;
  }
  function setOnlineError(message = "") { $("#online-error").textContent = message; }
  function setConnectionPill(label) { $("#connection-pill").innerHTML = `<i></i> ${escapeHtml(label)}`; }
  function openOnlineDialog(mode, invite = "") {
    online.dialogMode = mode;
    $("#online-confirm").disabled = false;
    $("#online-dialog-title").textContent = mode === "host" ? "Host an online match" : "Join an online match";
    $("#online-dialog-copy").textContent = mode === "host" ? "Create a link and send it to your friend. Keep this page open while you play." : "Paste the invite link or room code your friend sent you.";
    $("#online-confirm").textContent = mode === "host" ? "Create invite" : "Join match";
    $("#join-code-wrap").classList.toggle("hidden", mode !== "join"); $("#host-room-fields").classList.toggle("hidden", mode !== "host");
    $("#online-name").value = localStorage.getItem("vanguardArenaPlayerName") || "Player";
    $("#join-code").value = invite;
    renderOnlineDeckChoices();
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
    $("#online-confirm").disabled = false; setOnlineError(message); toast(message);
  }
  function createRelayConnection(secret, role) {
    const handlers = { open: [], data: [], close: [], error: [] };
    const incomingEvent = role === "host" ? "to-host" : role === "guest" ? "to-player" : "to-watchers";
    const channel = account.client.channel(`vanguard-match:${secret}`, { config: { broadcast: { self: false } } });
    const connection = {
      open: false,
      isRelay: true,
      on(event, callback) { (handlers[event] ||= []).push(callback); return this; },
      off(event, callback) { handlers[event] = (handlers[event] || []).filter((item) => item !== callback); return this; },
      emit(event, value) { (handlers[event] || []).slice().forEach((callback) => callback(value)); },
      async send(message) {
        if (!this.open) return;
        let event = "to-host", senderRole = role === "guest" ? "player" : role;
        if (role === "host") event = message.type === "watch-state" ? "to-watchers" : "to-player";
        try {
          const status = await channel.send({ type: "broadcast", event, payload: { senderRole, message } });
          if (status !== "ok") this.emit("error", { type: "relay-error", message: "The online relay could not send an update." });
        } catch (error) { this.emit("error", { type: "relay-error", message: error?.message || "The online relay could not send an update." }); }
      },
      close() { if (!this.open) return; this.open = false; void account.client.removeChannel(channel); this.emit("close"); }
    };
    channel.on("broadcast", { event: incomingEvent }, (payload) => {
      const envelope = payload?.payload || {};
      const message = envelope.message;
      if (!message) return;
      if (role === "host") {
        if (envelope.senderRole === "watcher" && message.type === "watch") {
          const watcher = { open: true, send: (data) => connection.send(data), close() { this.open = false; online.watchers = online.watchers.filter((item) => item !== this); } };
          online.watchers.push(watcher); sendOnlineSnapshot(); return;
        }
        // This channel uses the unguessable room secret as its access boundary.
        // Older clients labeled the joining player "guest", so do not reject
        // their match actions based on optional role metadata.
        if (message.type === "join") {
          if (online.relayPlayerJoined) { sendOnlineSnapshot(); return; }
          online.relayPlayerJoined = true; setConnectionPill("CONNECTED"); setMessage("Opponent connected — your turn.");
        }
      } else if (envelope.senderRole !== "host") return;
      connection.emit("data", message);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { connection.open = true; connection.emit("open"); }
      else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) connection.emit("error", { type: "relay-error", message: `The online relay ${status.toLowerCase().replace(/_/g, " ")}.` });
    });
    return connection;
  }
  function randomHex(length) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, length);
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
    flipTurnBonusOwners(snapshot.players);
    snapshot.side = flipSide(snapshot.side);
    if (snapshot.revealed?.owner) snapshot.revealed.owner = flipSide(snapshot.revealed.owner);
    if (snapshot.publicReveal?.owner) snapshot.publicReveal.owner = flipSide(snapshot.publicReveal.owner);
    (snapshot.checkReveals || []).forEach((item) => { item.side = flipSide(item.side); });
    if (snapshot.firstSide) snapshot.firstSide = flipSide(snapshot.firstSide);
    if (snapshot.pendingAttack) { snapshot.pendingAttack.attackerSide = flipSide(snapshot.pendingAttack.attackerSide); snapshot.pendingAttack.defenderSide = flipSide(snapshot.pendingAttack.defenderSide); }
    if (snapshot.pendingGAssist?.ownerSide) { snapshot.pendingGAssist.ownerSide = flipSide(snapshot.pendingGAssist.ownerSide); if (snapshot.pendingGAssist.ownerSide !== "human") snapshot.pendingGAssist = null; }
    if (snapshot.pendingAttackSetup) { snapshot.pendingAttackSetup.attackerSide = flipSide(snapshot.pendingAttackSetup.attackerSide); snapshot.pendingAttackSetup.defenderSide = flipSide(snapshot.pendingAttackSetup.defenderSide); }
    if (snapshot.pendingTrigger?.side) snapshot.pendingTrigger.side = flipSide(snapshot.pendingTrigger.side);
    if (snapshot.pendingTrigger?.turnOwner) snapshot.pendingTrigger.turnOwner=flipSide(snapshot.pendingTrigger.turnOwner); if (snapshot.pendingCrest?.side) snapshot.pendingCrest.side = flipSide(snapshot.pendingCrest.side);
    if (snapshot.preMatch) {
      snapshot.preMatch.rolls = { human: snapshot.preMatch.rolls.bot, bot: snapshot.preMatch.rolls.human };
      if (snapshot.preMatch.winner) snapshot.preMatch.winner = flipSide(snapshot.preMatch.winner);
      if (snapshot.preMatch.firstSide) snapshot.preMatch.firstSide = flipSide(snapshot.preMatch.firstSide);
      if (snapshot.preMatch.mulliganDone) snapshot.preMatch.mulliganDone = { human: snapshot.preMatch.mulliganDone.bot, bot: snapshot.preMatch.mulliganDone.human };
    }
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
      const publicMatch = JSON.parse(JSON.stringify(match)); publicMatch.pendingGAssist = null;
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
    if (online.role === "guest" && online.connection?.isRelay) { online.relayStateReceived = true; if (online.joinRetry) { clearInterval(online.joinRetry); online.joinRetry = null; } $("#online-confirm").disabled = false; if ($("#online-dialog").open) $("#online-dialog").close(); }
    revealLocalMatch(); renderMatch(); if($("#deck-view-dialog").open)openMyDeck(); if($("#drop-dialog").open)openDropDialog($("#drop-dialog").dataset.side); if($("#bind-dialog").open)openBindDialog(); if($("#gdeck-dialog").open)openGDeckDialog($("#gdeck-dialog").dataset.kind,$("#gdeck-dialog").dataset.gGuardHealUid||""); if($("#soul-dialog").open)openSoulDialog($("#soul-dialog").dataset.blast==="1",$("#soul-dialog").dataset.side||"human");
  }
  function handleRemoteMessage(message) {
    if (!message || typeof message !== "object") return;
    if (online.role === "host" && message.type === "join") {
      if (!match) startMatch(onlineDeck(), "human", true);
      const deck = sanitizedDeck(message.deck);
      const playerName = String(message.name || "Opponent").slice(0, 24);
      match.players.bot = makePlayer(deck.cards && deckCount(deck) ? deck : defaultDeck(), playerName);
      match.deckName = online.selectedDeck?.name || builder.name || "Online match";
      addLog(`${playerName} joined with ${deck.name}.`); setMessage("Opponent connected — your turn."); renderMatch();
      sendOnlineSnapshot();
      return;
    }
    if (online.role === "guest" && message.type === "state") { updateGuestState(message.match); return; }
    if (online.role === "watcher" && message.type === "watch-state") { updateGuestState(message.match); $("#match-status").textContent = "SPECTATING · LIVE"; return; }
    if (online.role === "host" && match?.preMatch && message.type === "setup-roll") { rollOnlineDieFor("bot"); return; }
    if (online.role === "host" && match?.preMatch && message.type === "setup-choice") {
      if (match.preMatch.winner === "bot" && ["human", "bot"].includes(message.firstSide)) beginOnlineMulligan(flipSide(message.firstSide));
      return;
    }
    if (online.role === "host" && match?.preMatch && message.type === "setup-mulligan") {
      completeOnlineMulligan("bot", message.handUids || []);
      return;
    }
    if (online.role !== "host" || !match || !["action", "select"].includes(message.type)) return;
    const players = match.players;
    match.players = { human: players.bot, bot: players.human };
    flipTurnBonusOwners(match.players);
    match.side = flipSide(match.side);
    if (match.firstSide) match.firstSide = flipSide(match.firstSide);
    if (match.revealed?.owner) match.revealed.owner = flipSide(match.revealed.owner);
    if (match.publicReveal?.owner) match.publicReveal.owner = flipSide(match.publicReveal.owner);
    (match.checkReveals || []).forEach((item) => { item.side = flipSide(item.side); });
    if (match.pendingTrigger?.side) match.pendingTrigger.side = flipSide(match.pendingTrigger.side);
    if (match.pendingTrigger?.turnOwner) match.pendingTrigger.turnOwner=flipSide(match.pendingTrigger.turnOwner); if (match.pendingCrest?.side) match.pendingCrest.side=flipSide(match.pendingCrest.side);
    if(match.pendingAttack){match.pendingAttack.attackerSide=flipSide(match.pendingAttack.attackerSide);match.pendingAttack.defenderSide=flipSide(match.pendingAttack.defenderSide);}if(match.pendingGAssist?.ownerSide)match.pendingGAssist.ownerSide=flipSide(match.pendingGAssist.ownerSide);
    if(match.pendingAttackSetup){match.pendingAttackSetup.attackerSide=flipSide(match.pendingAttackSetup.attackerSide);match.pendingAttackSetup.defenderSide=flipSide(match.pendingAttackSetup.defenderSide);}
    match.selected = message.selected || null;
    online.applyingRemote = true;
    try {
      if (message.type === "select") renderMatch();
      else if (message.action?.startsWith("manual:")) manualGameAction(message.action.slice("manual:".length));
      else ({ draw: drawForHuman, ride: rideHuman, call: callHuman, attack: resolveHumanAttack, guard: humanGuard, noGuard, finishAttack: confirmAttackFinished, endTurn, advance: advancePhase }[message.action] || (() => {}))();
    } finally {
      match.players = players;
      flipTurnBonusOwners(match.players);
      match.side = flipSide(match.side);
      if (match.firstSide) match.firstSide = flipSide(match.firstSide);
      if (match.revealed?.owner) match.revealed.owner = flipSide(match.revealed.owner);
      if (match.publicReveal?.owner) match.publicReveal.owner = flipSide(match.publicReveal.owner);
      (match.checkReveals || []).forEach((item) => { item.side = flipSide(item.side); });
      if (match.pendingTrigger?.side) match.pendingTrigger.side = flipSide(match.pendingTrigger.side);
      if (match.pendingTrigger?.turnOwner) match.pendingTrigger.turnOwner=flipSide(match.pendingTrigger.turnOwner); if (match.pendingCrest?.side) match.pendingCrest.side=flipSide(match.pendingCrest.side);
      if(match.pendingAttack){match.pendingAttack.attackerSide=flipSide(match.pendingAttack.attackerSide);match.pendingAttack.defenderSide=flipSide(match.pendingAttack.defenderSide);}if(match.pendingGAssist?.ownerSide)match.pendingGAssist.ownerSide=flipSide(match.pendingGAssist.ownerSide);
      if(match.pendingAttackSetup){match.pendingAttackSetup.attackerSide=flipSide(match.pendingAttackSetup.attackerSide);match.pendingAttackSetup.defenderSide=flipSide(match.pendingAttackSetup.defenderSide);}
      online.applyingRemote = false;
    }
    renderMatch();
  }
  function bindOnlineConnection(connection, role) {
    online.connection = connection;
    connection.on("open", () => {
      if (role === "guest") {
        const sendJoin = () => connection.send({ type: "join", name: online.localName, deck: onlineDeck() });
        sendJoin();
        if (connection.isRelay) {
          setOnlineError("Connected to the relay. Waiting for the host to send the match…");
          online.relayStateReceived = false;
          if (online.joinRetry) clearInterval(online.joinRetry);
          online.joinRetry = setInterval(() => { if (online.connection === connection && !online.relayStateReceived && connection.open) sendJoin(); }, 2500);
        }
      }
      else if (role === "watcher") connection.send({ type: "watch", name: online.localName });
      else if (connection.isRelay) { setMessage("Invite link ready — waiting for your friend to join."); setConnectionPill("WAITING"); sendOnlineSnapshot(); }
      else { setMessage("Opponent connected — waiting for their deck."); sendOnlineSnapshot(); }
      if (role !== "host" || !connection.isRelay) { $("#match-status").textContent = "ONLINE · CONNECTED"; setConnectionPill("CONNECTED"); } const reconnectButton = $("#reconnect-match"); if (reconnectButton) reconnectButton.hidden = true;
    });
    connection.on("data", handleRemoteMessage);
    connection.on("close", () => { $("#match-status").textContent = "ONLINE · DISCONNECTED"; setConnectionPill("DISCONNECTED"); const reconnectButton = $("#reconnect-match"); if (role === "guest" && reconnectButton) reconnectButton.hidden = false; toast("Connection lost. Reconnect to continue this match."); });
    connection.on("error", onlinePeerError);
  }
  function reconnectOnlineMatch() { if (online.role !== "guest" || !online.roomId) { toast("Rejoin using the room code and password."); return; } if (online.joinRetry) { clearInterval(online.joinRetry); online.joinRetry = null; } const wasRelay = Boolean(online.connection?.isRelay); online.connection?.close?.(); if (wasRelay) bindOnlineConnection(createRelayConnection(online.roomId, "guest"), "guest"); else if (online.peer && !online.peer.destroyed) bindOnlineConnection(online.peer.connect(online.roomId, { reliable: true }), "guest"); else { toast("Rejoin using the room code and password."); return; } setConnectionPill("CONNECTING"); }
  function beginHosting() {
    if (!selectOnlineDeck()) return;
    if (!account.client) { setOnlineError("Room discovery needs the configured Supabase connection."); return; }
    if (!$("#room-password").value.trim()) { setOnlineError("Set a room password before creating the room."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    online.role = "host"; online.relayPlayerJoined = false; setConnectionPill("CONNECTING");
    void (async () => {
      const roomCode = randomHex(8).toUpperCase();
      const secret = randomHex(32);
      const { error } = await account.client.rpc("create_match_room", { p_room_code: roomCode, p_peer_id: `relay:${secret}`, p_room_name: $("#room-name").value.trim() || "Vanguard room", p_host_name: online.localName, p_password: $("#room-password").value });
      if (error) { setOnlineError("Could not publish this room. Run supabase/match-rooms.sql in the Supabase SQL Editor, then try again."); online.role = null; return; }
      online.roomId = secret; online.publicRoomCode = roomCode; $("#online-dialog").close(); startMatch(onlineDeck(), "human", true);
      online.heartbeat = setInterval(() => { if (account.client && online.publicRoomCode) void account.client.rpc("touch_match_room", { p_room_code: online.publicRoomCode }); }, 60000);
      match.players.human.name = online.localName; $("#online-invite").classList.remove("hidden");
      const invite = new URL(location.href); invite.searchParams.set("join", roomCode); invite.hash = "play"; $("#invite-link").value = invite.toString();
      const watch = new URL(location.href); watch.searchParams.delete("join"); watch.searchParams.set("watch", roomCode); watch.hash = "play"; $("#spectate-link").value = watch.toString();
      bindOnlineConnection(createRelayConnection(secret, "host"), "host");
      setMessage("Invite link ready — waiting for your friend to join."); renderMatch();
    })().catch((error) => { online.role = null; setOnlineError(`Could not start the online relay: ${error.message}`); });
  }
  async function beginJoining() {
    const watching = $("#online-join-role").value === "spectator" || new URLSearchParams(location.search).has("watch");
    if (!watching && !selectOnlineDeck()) return;
    const roomCode = getInviteId($("#join-code").value);
    if (!roomCode) { setOnlineError("Choose an open room or enter a room code."); return; }
    if (!account.client) { setOnlineError("Room discovery needs the configured Supabase connection."); return; }
    const { data: roomPeer, error: roomError } = await account.client.rpc("resolve_match_room", { p_room_code: roomCode, p_password: $("#join-password").value });
    const roomId = typeof roomPeer === "string" ? roomPeer : Array.isArray(roomPeer) ? roomPeer[0]?.peer_id : roomPeer?.peer_id;
    if (roomError || !roomId) { setOnlineError("Room not found, closed, or password is incorrect."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    online.role = watching ? "watcher" : "guest"; online.publicRoomCode = roomCode; setConnectionPill("CONNECTING");
    if (typeof roomId === "string" && roomId.startsWith("relay:")) {
      if (!account.client) { setOnlineError("The online relay needs the configured Supabase connection."); online.role = null; return; }
      const secret = roomId.slice("relay:".length); online.roomId = secret;
      bindOnlineConnection(createRelayConnection(secret, online.role), online.role);
      if (watching) { $("#online-dialog").close(); setMessage("Connecting to the live match…"); }
      else { $("#online-dialog-copy").textContent = "Connecting to the room. Keep this window open while we wait for the host’s match."; $("#online-confirm").disabled = true; setOnlineError("Connecting to the room…"); }
      return;
    }
    if (!window.Peer) { setOnlineError("This room uses the older direct connection mode, which this browser does not support. Ask the host to create a new room after updating the site."); online.role = null; return; }
    online.roomId = roomId; online.peer = new Peer();
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
    if (online.joinRetry) clearInterval(online.joinRetry);
    if (online.role === "host" && online.publicRoomCode && account.client) void account.client.rpc("close_match_room", { p_room_code: online.publicRoomCode });
    try { online.connection?.close(); online.watchers?.forEach((connection) => connection.close()); online.peer?.destroy(); } catch {}
    online = { role: null, peer: null, connection: null, watchers: [], roomId: null, publicRoomCode: null, heartbeat: null, joinRetry: null, relayStateReceived: false, applyingRemote: false, relayPlayerJoined: false, dialogMode: "host", selectedDeck: null, mulliganSelection: [], mulliganSubmitted: false };
    setConnectionPill("READY");
    $("#online-invite").classList.add("hidden");
  }
  function performOnlineAction(action) {
    if (online.role === "watcher") { toast("Spectators can watch but cannot change the match."); return; }
    if (online.role === "guest") {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      online.connection.send({ type: "action", action, selected: match?.selected || null }); return;
    }
    ({ draw: drawForHuman, ride: rideHuman, call: callHuman, attack: resolveHumanAttack, guard: humanGuard, noGuard, finishAttack: confirmAttackFinished, endTurn, advance: advancePhase }[action] || (() => {}))();
  }
  function openGiftDialog(kind) {
    const dialog = $("#gift-dialog"), force = kind === "force";
    $("#gift-type").innerHTML = force ? "<option>Force I</option><option>Force II</option>" : "<option>Accel I</option><option>Accel II</option>";
    $("#gift-zone-wrap").classList.toggle("hidden", !force);
    $("#gift-place-vanguard").classList.toggle("hidden", !force);
    const player = match?.players.human, zones = ["vanguard", "rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player?.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
    const names = { vanguard: "Vanguard", "rear-left": "Front left", "rear-right": "Front right", "rear-back-left": "Back left", "rear-back-center": "Back center", "rear-back-right": "Back right" };
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
    $("#soul-card-list").innerHTML = soul.length ? soul.map((instance) => { const card = cardMap.get(instance.cardId); return card ? `<article class="zone-view-card"><button class="zone-card-face${blast ? " selectable" : ""}" type="button" data-zone-select data-soul-uid="${escapeHtml(instance.uid)}">${cardImage(card)}<b>${escapeHtml(card.name)}</b></button><button class="zone-card-zoom" type="button" data-card-zoom="${escapeHtml(card.id)}" aria-label="Zoom ${escapeHtml(card.name)}">⤢</button>${canAct && !blast ? zoneMoveControls(instance,"soul") : ""}</article>` : ""; }).join("") : `<p class="zone-empty-message">${escapeHtml(player.name)}'s Soul is empty.</p>`;
    $("#soul-dialog").dataset.blast = blast ? "1" : "0"; $("#soul-dialog").dataset.side = side; if (!$("#soul-dialog").open) $("#soul-dialog").showModal();
  }
  function openDropDialog(side = "human") {
    if (!match) { toast("Start a match to view Drop."); return; }
    const own=side==="human", player=match.players[side], cards=player.drop||[];
    $("#drop-dialog-title").textContent=own?"Your Drop zone":player.name+" · Drop zone";
    const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>"accel-"+(i+1))];
    const labels={"rear-left":"Front left Rear-Guard","rear-right":"Front right Rear-Guard","rear-back-left":"Back left Rear-Guard","rear-back-center":"Back center Rear-Guard","rear-back-right":"Back right Rear-Guard"};
    const fieldOptions='<option value="">Move to field…</option><option value="vanguard">Vanguard</option>'+zones.map((zone,i)=>({zone,i,label:labels[zone]||("Accel "+(i-4))})).filter(({i})=>!player.rear[i]).map(({zone,label})=>'<option value="'+zone+'">'+label+'</option>').join("");
    $("#drop-card-list").innerHTML=cards.length?cards.map((instance)=>{const c=cardMap.get(instance.cardId);if(!c)return "";const unit=isUnitCard(c);const moves=own?'<div class="peek-actions" hidden><button class="button" data-drop-action="hand:'+escapeHtml(instance.uid)+'">Add to hand</button><button class="button" data-drop-action="soul:'+escapeHtml(instance.uid)+'">Add to Soul</button><button class="button" data-drop-action="bind:'+escapeHtml(instance.uid)+'">Bind card</button>'+(unit?'<button class="button" type="button" data-superior-ride="drop:'+escapeHtml(instance.uid)+'">Superior Ride</button><button class="button" data-zone-field-select="drop:'+escapeHtml(instance.uid)+'">Select to place on field</button><select class="text-input drop-field-select" data-drop-uid="'+escapeHtml(instance.uid)+'">'+fieldOptions+'</select>':'')+'<button class="button" data-drop-action="deck-top:'+escapeHtml(instance.uid)+'">Return to deck top</button><button class="button" data-drop-action="deck-bottom:'+escapeHtml(instance.uid)+'">Return to deck bottom</button></div>':'';return '<article class="zone-view-card"><button class="zone-card-face" type="button" data-zone-select>'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button><button class="zone-card-zoom" type="button" data-card-zoom="'+escapeHtml(c.id)+'" aria-label="Zoom '+escapeHtml(c.name)+'">⤢</button>'+moves+'</article>';}).join(""):'<p class="zone-empty-message">No cards in Drop yet.</p>';
    $("#drop-dialog").dataset.side=side;if(!$("#drop-dialog").open)$("#drop-dialog").showModal();
  }
  function zoneMoveControls(instance, source, canAct = true) {
    if (!canAct) return "";
    const card = cardMap.get(instance.cardId), unit = isUnitCard(card);
    const button = (choice, label) => `<button class="button" type="button" data-zone-move="${source}:${choice}:${escapeHtml(instance.uid)}">${label}</button>`;
    const fieldPick = unit && ["deck", "soul", "bind", "drop", "reveal", "gdeck"].includes(source) ? `<button class="button" type="button" data-zone-field-select="${source}:${escapeHtml(instance.uid)}">Select to place on field</button>` : "";
    const zones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: match.players.human.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
    const fieldOptions = zones.map((zone, i) => match.players.human.rear[i] ? "" : '<option value="' + zone + '">' + zone.replace("rear-", "").replace("back-", "back ").replaceAll("-", " ") + '</option>').join("");
    const superiorRide = unit && ["deck", "soul", "bind", "drop", "reveal"].includes(source) ? `<button class="button" type="button" data-superior-ride="${source}:${escapeHtml(instance.uid)}">Superior Ride</button>` : "";
    const fieldControl = source === "soul" && unit ? '<select class="text-input drop-field-select" data-soul-field-uid="' + escapeHtml(instance.uid) + '"><option value="">Call Unit to Rear-Guard…</option>' + fieldOptions + '</select>' : "";
    return '<div class="peek-actions"' + (source === "deck" ? "" : " hidden") + '>' + button("hand", "Add to hand") + (source !== "soul" ? button("soul", "Add to Soul") : "") + button("drop", "Send to Drop") + (source !== "bind" ? button("bind", "Bind card") : "") + (source !== "deck" ? button("deck-top", "Return to deck top") : "") + (source !== "deck" ? button("deck-bottom", "Return to deck bottom") : "") + fieldControl + fieldPick + superiorRide + '</div>';
  }
  function renderInteractiveCards(instances, prefix, canAct = true) {
    if (!instances?.length) return '<p class="zone-empty-message">No cards here.</p>';
    return instances.map((instance) => {
      const card = cardMap.get(instance.cardId); if (!card) return "";
      const controls = canAct ? (prefix === "deck-action" ? zoneMoveControls(instance, "deck") : '<div class="peek-actions" hidden><button class="button" type="button" data-peek-action="' + prefix + ':hand:' + escapeHtml(instance.uid) + '">Add to hand</button><button class="button" type="button" data-peek-action="' + prefix + ':soul:' + escapeHtml(instance.uid) + '">Add to Soul</button><button class="button" type="button" data-peek-action="' + prefix + ':drop:' + escapeHtml(instance.uid) + '">Send to Drop</button>' + (isUnitCard(card) ? '<button class="button" type="button" data-superior-ride="reveal:' + escapeHtml(instance.uid) + '">Superior Ride</button><button class="button" type="button" data-zone-field-select="reveal:' + escapeHtml(instance.uid) + '">Select to place on field</button>' : '') + '</div>') : '';
      return '<article class="zone-view-card"><button class="zone-card-face" type="button" data-zone-select aria-label="Select actions for ' + escapeHtml(card.name) + '">' + cardImage(card) + '<b>' + escapeHtml(card.name) + '</b></button><button class="zone-card-zoom" type="button" data-card-zoom="' + escapeHtml(card.id) + '" aria-label="Zoom ' + escapeHtml(card.name) + '">⤢</button>' + controls + '</article>';
    }).join("");
  }
  function openMyDeck() { if(!match){toast("Start a match to look through your deck.");return;} const cards=match.players.human.deck.slice().reverse(); $("#deck-view-title").textContent="Your deck · "+cards.length+" cards"; $("#deck-view-help").textContent="Choose any card to add to your hand, add a Unit to Soul, or send it to Drop."; $("#deck-view-list").innerHTML=renderInteractiveCards(cards,"deck-action"); if(!$("#deck-view-dialog").open)$("#deck-view-dialog").showModal(); }
  function openGGuardCostDialog() {
    const attack = match?.pendingAttack, player = match?.players?.human;
    if (!attack || attack.defenderSide !== "human" || attack.defenderDone) { toast("Use G-Guard while you are defending an attack."); return; }
    const grade = Number(cardMap.get(player.vanguard?.cardId)?.grade || 0);
    const attackerGrade = Number(cardMap.get(match.players[attack.attackerSide]?.vanguard?.cardId)?.grade || 0);
    if (grade < 3 || attackerGrade < 3) { toast("Both Vanguards must be grade 3 or greater to G-Guard."); return; }
    const healCards = player.hand.filter((item) => triggerKind(item) === "heal");
    if (!healCards.length) { toast("G-Guard requires a Heal trigger in your hand."); return; }
    $("#g-guard-heal-list").innerHTML = healCards.map((item) => {
      const card = cardMap.get(item.cardId); if (!card) return "";
      return '<button class="zone-view-card" type="button" data-g-guard-heal="' + escapeHtml(item.uid) + '">' + cardImage(card) + '<b>Discard ' + escapeHtml(card.name) + '</b><small>Heal trigger · G-Guard cost</small></button>';
    }).join("");
    $("#g-guard-cost-dialog").showModal();
  }
  function renderStrideCostDialog() {
    const state = match?.pendingStride;
    if (!state || state.ownerSide !== "human") { if ($("#stride-cost-dialog")?.open) $("#stride-cost-dialog").close(); return; }
    const player = match.players.human, stride = player.gDeck.find((item) => item.uid === state.unitUid), strideCard = cardMap.get(stride?.cardId);
    if (!strideCard) { match.pendingStride = null; $("#stride-cost-dialog").close(); return; }
    const ultimate = /Ultimate\s+Stride/i.test(String(strideCard.text || "")), heartName = cardMap.get(player.vanguard?.strideHeart?.cardId)?.name, vanguardName = cardMap.get(player.vanguard?.cardId)?.name;
    $("#stride-cost-title").textContent = `Stride ${strideCard.name}`;
    $("#stride-cost-help").textContent = ultimate ? "Choose a card with the same name as your Vanguard to discard." : `Choose card(s) to discard with total grade 3 or more. Stride grade selected: ${state.costValue || 0}.`;
    $("#stride-cost-cards").innerHTML = player.hand.map((item) => { const card = cardMap.get(item.cardId), selected = state.costUids.includes(item.uid), allowed = !ultimate || [vanguardName, heartName].includes(card?.name); return card ? `<button class="zone-view-card${selected ? " selected" : ""}${allowed ? "" : " disabled"}" type="button" data-stride-cost="${escapeHtml(item.uid)}" ${allowed ? "" : "disabled"}>${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${ultimate ? (allowed ? "Same name · discard" : "Does not match Vanguard") : `Stride grade ${strideGrade(item)}${selected ? " · selected" : ""}`}</small></button>` : ""; }).join("") || '<p class="zone-empty-message">No cards in hand to pay the Stride cost.</p>';
    const selected = player.hand.filter((item) => state.costUids.includes(item.uid));
    state.costValue = selected.reduce((sum, item) => sum + strideGrade(item), 0);
    const valid = ultimate ? selected.length === 1 && [vanguardName, heartName].includes(cardMap.get(selected[0].cardId)?.name) : selected.length > 0 && state.costValue >= 3;
    $("#stride-cost-confirm").disabled = !valid;
    if (!$("#stride-cost-dialog").open) $("#stride-cost-dialog").showModal();
  }
  function openGDeckDialog(kind, healUid = "") {
    if (!match) { toast("Start a match first."); return; }
    if (kind === "stride" && (match.stridePerformed || !canStrideForSide("human", match.turnStartGrades?.human))) { toast("Stride is once per turn. You need both Vanguards at grade 3, or you must have started this turn with a grade 3 Vanguard."); return; }
    const isGuard = kind === "g-guard", isInspect = kind === "inspect";
    const player=match.players.human,healCards=player.hand.filter(item=>triggerKind(item)==="heal"),vanguardGrade=Number(cardMap.get(player.vanguard?.cardId)?.grade||0),attackerGrade=Number(cardMap.get(match.players[match.pendingAttack?.attackerSide]?.vanguard?.cardId)?.grade||0),selectedHeal=healCards.find(item=>item.uid===healUid);
    if(isGuard&&(!match.pendingAttack||match.pendingAttack.defenderSide!=="human"||match.pendingAttack.defenderDone||(vanguardGrade<3||attackerGrade<3))){toast("G-Guard needs an active defense with both Vanguards at grade 3 or greater.");return;}
    if(isGuard&&!selectedHeal){openGGuardCostDialog();return;}
    const allCards = match.players.human.gDeck || [];
    const cards = isInspect ? allCards : allCards.filter((item) => {
      const card = cardMap.get(item.cardId);
      return !item.faceUp && (isGuard ? isGGuardian(card) : isStrideUnit(card));
    });
    $("#gdeck-dialog-title").textContent = isInspect ? "Your G-deck" : isGuard ? "Choose a G-Guard" : "Choose a G Unit to stride";
    $("#gdeck-dialog-help").textContent = isInspect ? "Select a face-down card and reveal it into your G zone, or zoom in to inspect it." : isGuard ? "Choose a face-down G-Guardian. It adds its shield for this defense and returns face up to your G deck when the attack ends." : "Stride during your Stride step. Pay the ability cost, place the G Unit on your Vanguard, then return it face up to the G zone at end of turn.";
    const healNotice=$("#g-guard-selected-heal");healNotice.classList.toggle("hidden",!isGuard);if(isGuard)healNotice.textContent="Selected Heal trigger: "+(cardMap.get(selectedHeal.cardId)?.name||"Heal trigger")+" (discarded when you choose a G-Guardian).";
    $("#gdeck-card-list").innerHTML = cards.length ? cards.map((item) => {
      const card = cardMap.get(item.cardId);
      const flip=`<button class="button" type="button" data-gdeck-flip="${escapeHtml(item.uid)}">Flip face up into G zone</button>`;
      const play=isGuard?'<button class="button button-primary" type="button" data-gdeck-action="g-guard:'+escapeHtml(item.uid)+':'+escapeHtml(selectedHeal.uid)+'">Guard with this G-Guardian</button>':'<button class="button button-primary" type="button" data-gdeck-action="stride:'+escapeHtml(item.uid)+'">Stride</button>';
      return card ? '<article class="zone-view-card"><button class="zone-card-face" type="button" data-zone-select>' + cardImage(card) + '<b>' + escapeHtml(card.name) + '</b></button><button class="zone-card-zoom" type="button" data-card-zoom="' + escapeHtml(card.id) + '" aria-label="Zoom ' + escapeHtml(card.name) + '">⤢</button><div class="peek-actions"' + (isInspect ? '' : isGuard ? '' : ' hidden') + '>' + (isInspect ? (!item.faceUp ? flip.replace("Flip face up into G zone", "Reveal selected card into G zone") : "Already revealed") : play + (isGuard ? '' : flip + zoneMoveControls(item,"gdeck"))) + '</div></article>' : "";
    }).join("") : '<p class="zone-empty-message">No ' + (isGuard ? "G Guardians" : "G Units") + ' are available in your G deck.</p>';
    $("#gdeck-dialog").dataset.kind = kind; $("#gdeck-dialog").dataset.gGuardHealUid = isGuard ? selectedHeal.uid : "";
    if (!$("#gdeck-dialog").open) $("#gdeck-dialog").showModal();
  }
  function renderSharedReveal() { const reveal=match?.revealed;if(!reveal?.cards?.length)return;const canAct=reveal.owner==="human"&&online.role!=="watcher";$("#reveal-dialog-title").textContent="Revealed cards · "+reveal.cards.length;$("#reveal-dialog-help").textContent=canAct?"Both players can see these cards. Move each to hand, Soul, or Drop, or finish looking to return the rest to the deck.":match.players.human.name+" revealed these cards. Both players can see them.";$("#reveal-card-list").innerHTML=renderInteractiveCards(reveal.cards,"reveal-action",canAct);$("#reveal-done").classList.toggle("hidden",!canAct);$("#reveal-close").classList.toggle("hidden",canAct);if(!$("#reveal-dialog").open)$("#reveal-dialog").showModal(); }
  function openBindDialog() { if(!match)return;const cards=match.players.human.bind||[];$("#bind-card-list").innerHTML=cards.length?cards.map((item)=>{const c=cardMap.get(item.cardId);return c?'<article class="zone-view-card"><button class="zone-card-face" type="button" data-zone-select>'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button><button class="zone-card-zoom" type="button" data-card-zoom="'+escapeHtml(c.id)+'" aria-label="Zoom '+escapeHtml(c.name)+'">⤢</button>'+zoneMoveControls(item,"bind")+'</article>':"";}).join(""):'<p class="zone-empty-message">No cards are bound.</p>';if(!$("#bind-dialog").open)$("#bind-dialog").showModal(); }
  function openDamageDialog(action) { if(!match){toast("Start a match first.");return;}const damage=match.players.human.damage||[];const eligible=damage.filter((item)=>action==="heal-damage"?true:action==="counter-blast"?!item.faceDown:item.faceDown);$("#damage-dialog-title").textContent=action==="heal-damage"?"Heal damage · choose a damage card":action==="counter-blast"?"Counter-Blast · choose face-up damage":"Counter-Charge · choose face-down damage";$("#damage-card-list").innerHTML=eligible.length?eligible.map((item)=>{const c=cardMap.get(item.cardId);return c?'<article class="zone-view-card"><button class="zone-card-face" type="button" data-damage-action="'+(action==="heal-damage"?"heal":action)+':'+escapeHtml(item.uid)+'" title="Choose '+escapeHtml(c.name)+'">'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button>'+(isUnitCard(c)?'<button class="button" type="button" data-superior-ride="damage:'+escapeHtml(item.uid)+'">Superior Ride</button>':'')+'</article>':"";}).join(""):'<p class="zone-empty-message">No eligible damage cards.</p>';$("#damage-dialog").dataset.action=action;$("#damage-dialog").showModal(); }
  function performManualAction(action) {
    if (action === "view-selected-soul") { openSoulDialog(false, "human"); return; }
    if (action === "intercept") { openInterceptDialog(); return; }
    if (online.role === "watcher") { toast("Spectators can watch but cannot change the match."); return; }
    if (action === "soul-blast") { openSoulDialog(true); return; }
    if (action === "stride") { openGDeckDialog(action); return; } if (action === "g-guard") { openGGuardCostDialog(); return; }
    if (action === "counter-blast" || action === "counter-charge" || action === "heal-damage") { openDamageDialog(action); return; }
    if (action === "g-assist" || action === "g-assist-none" || action === "g-assist-finish" || action.startsWith("g-assist-pick:") || action.startsWith("g-assist-discard:") || action.startsWith("superior-ride:") || action.startsWith("attack-choice:") || action.startsWith("zone-move:") || action.startsWith("deck-action:") || action.startsWith("reveal-action:") || action.startsWith("damage-action:") || action.startsWith("drop-action:") || action.startsWith("reveal-top:") || action.startsWith("trigger-pick:") || action === "trigger-skip" || action === "reveal-done" || action.startsWith("g-assist") ) { if(online.role==="guest"){if(!online.connection?.open){toast("You are disconnected from the match.");return;}online.connection.send({type:"action",action:"manual:"+action,selected:match?.selected||null});return;} manualGameAction(action); if(match)renderMatch(); if(action.startsWith("superior-ride:")){["deck-view-dialog","soul-dialog","bind-dialog","drop-dialog","damage-dialog","reveal-dialog"].forEach(id=>{if($("#"+id).open)$("#"+id).close()});} if(action.startsWith("deck-action:") && $("#deck-view-dialog").open)openMyDeck(); if(action.startsWith("zone-move:") && $("#deck-view-dialog").open)openMyDeck(); if(action.startsWith("zone-move:") && $("#bind-dialog").open)openBindDialog(); if(action.startsWith("zone-move:") && $("#gdeck-dialog").open)openGDeckDialog($("#gdeck-dialog").dataset.kind); if(action.startsWith("zone-move:") && $("#soul-dialog").open)openSoulDialog($("#soul-dialog").dataset.blast==="1",$("#soul-dialog").dataset.side||"human"); if(action.startsWith("drop-action:") && $("#drop-dialog").open)openDropDialog($("#drop-dialog").dataset.side); return; }
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
  $("#online-join-role").addEventListener("change", renderOnlineDeckChoices);
  $("#online-mulligan-cards").addEventListener("click", (event) => { const card = event.target.closest("[data-mulligan-uid]"); if (!card || online.mulliganSubmitted || match?.preMatch?.mulliganDone?.human) return; const selected = new Set(online.mulliganSelection || []); selected.has(card.dataset.mulliganUid) ? selected.delete(card.dataset.mulliganUid) : selected.add(card.dataset.mulliganUid); online.mulliganSelection = [...selected]; renderOnlineSetup(); });
  $("#online-mulligan-confirm").addEventListener("click", () => { if (!match?.preMatch || match.preMatch.stage !== "mulligan") return; if (online.role === "guest") { if (!online.connection?.open) { toast("You are disconnected from the match."); return; } online.mulliganSubmitted = true; online.connection.send({ type: "setup-mulligan", handUids: online.mulliganSelection || [] }); renderOnlineSetup(); } else if (online.role === "host") completeOnlineMulligan("human", online.mulliganSelection || []); });
  $("#refresh-rooms").addEventListener("click", () => void loadOpenRooms()); $("#room-list").addEventListener("change", () => { if ($("#room-list").value) $("#join-code").value = $("#room-list").value; });
  $("#online-cancel").addEventListener("click", () => $("#online-dialog").close()); $("#close-online-dialog").addEventListener("click", () => $("#online-dialog").close());
  $("#copy-invite").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#invite-link").value); toast("Invite link copied."); } catch { $("#invite-link").select(); document.execCommand("copy"); toast("Invite link copied."); } });
  $("#copy-spectate").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#spectate-link").value); toast("Spectator link copied."); } catch { $("#spectate-link").select(); document.execCommand("copy"); toast("Spectator link copied."); } });
  $("#new-match").addEventListener("click", () => { endOnlineSession(); openPracticeSetup(); }); $("#empty-start").addEventListener("click", () => { endOnlineSession(); openPracticeSetup(); }); $("#practice-start-confirm").addEventListener("click", () => { const firstSide = $("#practice-first-player").value; $("#practice-setup-dialog").close(); startMatch(null, firstSide); }); $("#reset-match").addEventListener("click", newMatchButton);
  $("#reconnect-match")?.addEventListener("click", reconnectOnlineMatch);
  $("#draw-card").addEventListener("click", () => performOnlineAction("draw")); $("#ride-card").addEventListener("click", () => performOnlineAction("ride")); $("#call-card").addEventListener("click", () => performOnlineAction("call")); $("#attack-card").addEventListener("click", () => performOnlineAction("attack")); $("#guard-card").addEventListener("click", () => performOnlineAction("guard")); $("#finish-attack").addEventListener("click", () => performOnlineAction("finishAttack")); $("#intercept-card").addEventListener("click", () => performManualAction("intercept")); $("#play-order").addEventListener("click", () => performManualAction("play-order")); $("#end-turn").addEventListener("click", () => performOnlineAction("endTurn")); $("#advance-phase").addEventListener("click", () => performOnlineAction("advance"));
  $$("[data-manual-action]").forEach((button) => button.addEventListener("click", () => performManualAction(button.dataset.manualAction)));
  $("#power-change-apply").addEventListener("click", () => { const value = Number($("#power-change-value").value); if (!Number.isFinite(value)) { toast("Enter a valid power amount."); return; } $("#power-input-dialog").close(); performManualAction(`set-power:${value}`); });
  $("#public-reveal-close").addEventListener("click", () => performManualAction("public-reveal-close"));
  document.addEventListener("click", (event) => { const zoom = event.target.closest?.("[data-card-zoom]"); if (!zoom) return; event.preventDefault(); event.stopPropagation(); showCardDetails(zoom.dataset.cardZoom); }, true);
  document.addEventListener("click",event=>{const button=event.target.closest?.("[data-superior-ride]");if(!button)return;event.preventDefault();event.stopPropagation();performManualAction("superior-ride:"+button.dataset.superiorRide);},true);
  $("#ability-dialog").addEventListener("cancel", event => { event.preventDefault(); });
  $('#ability-cost-choices').addEventListener('click',event=>{const b=event.target.closest('[data-ability-cost]'),x=match?.pendingAbility;if(!b||!x)return;const[k,uid]=b.dataset.abilityCost.split(':'),list=x.costSelections[k],t=x.ability.raw,re=k==='cb'?/Counter[- ]Blast\s*\(?\s*(\d+)/i:k==='sb'?/Soul[- ]Blast\s*\(?\s*(\d+)/i:/discard(?:ing)?\s*\(?\s*(\d+)/i,limit=Number(t.match(re)?.[1]||(/discard (?:a|one) card/i.test(t)?1:0)),i=list.indexOf(uid);if(i>=0)list.splice(i,1);else if(list.length<limit)list.push(uid);renderAbilityCostChoices(x)});
  $('#ability-effect-choices').addEventListener('click',event=>{const x=match?.pendingAbility;if(!x)return;const c=event.target.closest('[data-ability-card]'),t=event.target.closest('[data-ability-target]'),z=event.target.closest('[data-ability-zone]'),clear=event.target.closest('[data-ability-clear-card]');if(clear){x.effectUid=null;x.callZone=null}if(c)x.effectUid=c.dataset.abilityCard;if(t)x.targetUid=t.dataset.abilityTarget;if(z)x.callZone=z.dataset.abilityZone;renderAbilityEffectChoices(x)});
  $("#ability-accept").addEventListener("click", () => { const pending=match?.pendingAbility; if(!pending)return; const resolved=resolveAbility(pending); if(resolved){match.pendingAbility=null;$("#ability-dialog").close();if(match.pendingAbilities?.length)showNextAbilityPrompt();else if(match.resumeAfterAbility==="bot-defense"){match.resumeAfterAbility=null;practiceBotDefend()}else showNextAbilityPrompt();renderMatch();} });
  $("#ability-decline").addEventListener("click", () => { if(match?.pendingAbility){addLog(`${cardMap.get(match.pendingAbility.instance.cardId)?.name||"A unit"} ability was declined.`);match.pendingAbility=null;} $("#ability-dialog").close();if(match?.pendingAbilities?.length)showNextAbilityPrompt();else if(match?.resumeAfterAbility==="bot-defense"){match.resumeAfterAbility=null;practiceBotDefend()}else showNextAbilityPrompt();renderMatch(); });
  $("#context-menu-actions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-context-action]"); if (!button) return;
    const action = button.dataset.contextAction; $("#context-menu-dialog").close();
    if (action === "deck-view") { openMyDeck(); return; }
    if (action === "open-skills") { const f=findFieldCard(match?.selected); if(f)showAbilityMenu(f); return; }
    if (action.startsWith("ability:")) { const [,side,uid,index]=action.split(":"); const f=findFieldCard(uid),a=eligibleActivatedAbilities(f)[Number(index)]; if(a){match.pendingAbility={side,field:f.zone,instance:f.instance,ability:a};showNextAbilityPrompt()} return; }
    if (action === "attack" || action === "draw") { performOnlineAction(action); return; }
    if (action === "alter-power") { $("#power-input-dialog").showModal(); return; } if (action === "move-select") { toast("Choose a different Rear-Guard circle to move or swap this unit."); return; }
    if (action === "reveal-top-cards") { performManualAction(action); return; }
    if (action === "trigger-check" || action === "damage-check") { performManualAction(action); return; }
    performManualAction(action);
  });
  $("#crest-add-button").addEventListener("click", () => performManualAction("crest-add"));
  $("#crest-skip-button").addEventListener("click", () => performManualAction("crest-skip"));
  $(".game-table").addEventListener("click", (event) => {
    const deck = event.target.closest(".human-line .deck-zone"); if (deck) { showDeckMenu(); return; }
    const crestZone = event.target.closest("#human-crest-zone");
    if (crestZone && cardMap.get(selectedHandCard()?.cardId)?.type === "Crest") { performManualAction("crest-place"); return; }
  });  $("#hand-cards").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { e.stopPropagation(); showCardDetails(zoom.dataset.cardZoom); return; } const card = e.target.closest("[data-hand-uid]"); if (!card || !match || online.role === "watcher") return; match.selected = match.selected === card.dataset.handUid ? null : card.dataset.handUid; if (online.role === "guest" && online.connection?.open) online.connection.send({ type: "select", selected: match.selected }); renderMatch(); showContextMenu("hand"); });
  $(".game-table").addEventListener("click", (e) => { const zoom=e.target.closest("[data-card-zoom]"); if(zoom){e.stopPropagation();showCardDetails(zoom.dataset.cardZoom);return;} const zone=e.target.closest(".field-zone[data-side='human']"); if(zone&&match&&online.role!=="watcher"){if(zone.dataset.zone==="vanguard"&&selectedHandCard()){showContextMenu("hand");return;}if(zoneFieldSelection){const {source,uid}=zoneFieldSelection;zoneFieldSelection=null;performManualAction(`zone-move:${source}:field:${uid}:${zone.dataset.zone}`);return;}const selectedField=findFieldCard(match.selected);if(selectedField?.side==="human"&&selectedField.zone!=="vanguard"&&zone.dataset.zone!=="vanguard"&&zone.dataset.zone!==selectedField.zone){performManualAction(`move-rear-to:${match.selected}:${zone.dataset.zone}`);return;}if(!e.target.closest("[data-field-uid]")&&match.selected&&selectedHandCard()){performManualAction(`place:${zone.dataset.zone}`);return;}}if(e.target.closest("[data-gdeck-side='human']")){if(match.phase===3&&match.side==="human")performManualAction("stride");else openGDeckDialog("inspect");return;}const field=e.target.closest("[data-field-uid]");if(!field||!match||online.role==="watcher"||field.dataset.side!=="human")return;const uid=field.dataset.fieldUid;match.selected=match.selected===uid?null:uid;if(online.role==="guest"&&online.connection?.open)online.connection.send({type:"select",selected:match.selected});renderMatch();showContextMenu("field");});
  $("#gift-cancel").addEventListener("click", () => $("#gift-dialog").close()); $("#gift-close").addEventListener("click", () => $("#gift-dialog").close());
  $("#gift-confirm").addEventListener("click", (e) => { e.preventDefault(); const dialog = $("#gift-dialog"), type = $("#gift-type").value; if (dialog.dataset.kind === "force") { const zone = $("#gift-zone").value; if (!zone) { toast("Choose a circle for the Force marker."); return; } performManualAction(`gift-force:${type}:${zone}`); } else performManualAction(`gift-accel:${type}`); dialog.close(); });
  $("#gift-place-vanguard").addEventListener("click", (e) => { e.preventDefault(); const dialog = $("#gift-dialog"), type = $("#gift-type").value; if (dialog.dataset.kind !== "force") return; performManualAction(`gift-force:${type}:vanguard`); dialog.close(); });
  $("#view-soul").addEventListener("click", () => openSoulDialog(false,"human")); $("#view-opponent-soul").addEventListener("click", () => openSoulDialog(false,"bot")); $("#open-drop-zone").addEventListener("click", () => openDropDialog("human"));
  $(".opponent-field .vanguard-zone").addEventListener("click", (e) => { if (match && !e.target.closest("[data-card-zoom]") && e.target.closest("[data-field-uid]")) openSoulDialog(false,"bot"); });
  $("#open-my-deck").addEventListener("click", openMyDeck); $("#open-bind-zone").addEventListener("click", () => selectedHandCard() ? performManualAction("bind") : openBindDialog());
  $("#open-opponent-drop-zone").addEventListener("click",()=>openDropDialog("bot"));
  $$(".zone-card-list").forEach((list) => list.addEventListener("click", (event) => {
    const face = event.target.closest("[data-zone-select]");
    if (!face || (list.id === "soul-card-list" && $("#soul-dialog").dataset.blast === "1")) return;
    const article = face.closest(".zone-view-card");
    const wasSelected = article.classList.contains("selected");
    list.querySelectorAll(".zone-view-card").forEach((card) => { card.classList.remove("selected"); card.querySelectorAll(".peek-actions").forEach((panel) => { panel.hidden = true; }); });
    if (!wasSelected) { article.classList.add("selected"); article.querySelectorAll(".peek-actions").forEach((panel) => { panel.hidden = false; }); }
  }));
  document.addEventListener("click", (event) => { const button = event.target.closest("[data-zone-field-select]"); if (!button || !match) return; const [source, uid] = button.dataset.zoneFieldSelect.split(":"); zoneFieldSelection = { source, uid }; button.closest("dialog")?.close(); toast("Card selected. Click a Vanguard or empty Rear-Guard circle to place it."); });
  $$('[data-close-dialog]').forEach((button)=>button.addEventListener("click",()=>$("#"+button.dataset.closeDialog)?.close()));
  $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog && dialog.id !== "ability-dialog") dialog.close(); }));
  $("#reveal-top-cards").addEventListener("click",()=>performManualAction("reveal-top-cards"));
  $("#reveal-count-confirm").addEventListener("click",()=>{const n=Math.max(1,Math.min(60,Number($("#reveal-count").value)||1));$("#reveal-count-dialog").close();performManualAction("reveal-top:"+n);});
  $("#reveal-done").addEventListener("click",()=>performManualAction("reveal-done"));
  $("#reveal-close").addEventListener("click",()=>$("#reveal-dialog").close());
  $("#deck-view-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const move=e.target.closest("[data-zone-move]");if(move)performManualAction("zone-move:"+move.dataset.zoneMove);});
  $("#reveal-card-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const action=e.target.closest("[data-peek-action]");if(action)performManualAction(action.dataset.peekAction);});
  $("#g-assist-content").addEventListener("click",(event)=>{const pick=event.target.closest("[data-gassist-choose]");if(pick){performManualAction("g-assist-pick:"+pick.dataset.gassistChoose);return;}const discard=event.target.closest("[data-gassist-discard]");if(discard)performManualAction("g-assist-discard:"+discard.dataset.gassistDiscard);});
  $("#g-assist-none").addEventListener("click",()=>performManualAction("g-assist-none"));
  $("#open-gdeck").addEventListener("click",()=>openGDeckDialog("inspect"));
  $("#g-assist-finish").addEventListener("click",()=>performManualAction("g-assist-finish"));  $("#gdeck-card-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const flip=e.target.closest("[data-gdeck-flip]");if(flip){performManualAction("gdeck-flip-up:"+flip.dataset.gdeckFlip);if(match)openGDeckDialog($("#gdeck-dialog").dataset.kind);return;}const move=e.target.closest("[data-zone-move]");if(move){performManualAction("zone-move:"+move.dataset.zoneMove);return;}const action=e.target.closest("[data-gdeck-action]");if(action){$("#gdeck-dialog").close();performManualAction(action.dataset.gdeckAction);}});
  $("#g-guard-heal-list").addEventListener("click",(event)=>{const button=event.target.closest("[data-g-guard-heal]");if(!button)return;const uid=button.dataset.gGuardHeal;$("#g-guard-cost-dialog").close();openGDeckDialog("g-guard",uid);});
  $("#stride-cost-cards").addEventListener("click",(event)=>{const button=event.target.closest("[data-stride-cost]");if(button)performManualAction("stride-cost:"+button.dataset.strideCost);});
  $("#stride-cost-confirm").addEventListener("click",()=>performManualAction("stride-confirm"));
  ["#stride-cost-cancel","#stride-cost-cancel-button"].forEach((selector)=>$(selector).addEventListener("click",()=>{if(match)match.pendingStride=null;$("#stride-cost-dialog").close();}));
  $("#attack-choice-buttons").addEventListener("click",(e)=>{const button=e.target.closest("[data-attack-choice]");if(button)performManualAction("attack-choice:"+button.dataset.attackChoice);});
  $("#protect-discard-list").addEventListener("click",(e)=>{const button=e.target.closest("[data-protect-cost]");if(!button)return;const marker=$("#protect-discard-dialog").dataset.markerUid;$("#protect-discard-dialog").close();performManualAction(`guard-perfect:${marker}:${button.dataset.protectCost}`);});
  $("#intercept-card-list").addEventListener("click",(e)=>{const button=e.target.closest("[data-intercept-uid]");if(!button)return;$("#intercept-dialog").close();performManualAction(`intercept:${button.dataset.interceptUid}`);});
  $("#bind-card-list").addEventListener("click",(e)=>{const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const move=e.target.closest("[data-zone-move]");if(move)performManualAction("zone-move:"+move.dataset.zoneMove);});
  $("#damage-card-list").addEventListener("click",(e)=>{const action=e.target.closest("[data-damage-action]");if(action){$("#damage-dialog").close();performManualAction("damage-action:"+action.dataset.damageAction);}});
  $("#trigger-prompt-targets").addEventListener("click",(e)=>{const target=e.target.closest("[data-trigger-pick]");if(target)performManualAction("trigger-pick:"+target.dataset.triggerPick);});
  $("#trigger-prompt-skip").addEventListener("click",()=>performManualAction("trigger-skip"));
  $("#close-soul-dialog").addEventListener("click", () => $("#soul-dialog").close()); $("#soul-blast-cancel").addEventListener("click", () => $("#soul-dialog").close());
  $("#soul-card-list").addEventListener("click", (e) => { const move=e.target.closest("[data-zone-move]");if(move){performManualAction("zone-move:"+move.dataset.zoneMove);return;}const zoom=e.target.closest("[data-card-zoom]");if(zoom&&!$("#soul-dialog").dataset.blast){showCardDetails(zoom.dataset.cardZoom);return;}const card=e.target.closest("[data-soul-uid]");if(card&&$("#soul-dialog").dataset.blast)card.classList.toggle("selected"); });
  $("#soul-card-list").addEventListener("change",(e)=>{const select=e.target.closest("[data-soul-field-uid]");if(select?.value)performManualAction("zone-move:soul:field:"+select.dataset.soulFieldUid+":"+select.value);});
  $("#soul-blast-confirm").addEventListener("click", () => { const ids = [...$$("#soul-card-list [data-soul-uid].selected")].map((node) => node.dataset.soulUid); if (!ids.length) { toast("Select at least one card to Soul Blast."); return; } performManualAction(`soul-blast:${ids.join(",")}`); $("#soul-dialog").close(); });
  $("#close-drop-dialog").addEventListener("click", () => $("#drop-dialog").close()); $("#drop-dialog-close").addEventListener("click", () => $("#drop-dialog").close());
  $("#drop-card-list").addEventListener("click", (e) => { const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const action=e.target.closest("[data-drop-action]");if(action)performManualAction("drop-action:"+action.dataset.dropAction); });
  $("#drop-card-list").addEventListener("change",(e)=>{const select=e.target.closest("[data-drop-uid]");if(select?.value)performManualAction("drop-action:field:"+select.dataset.dropUid+":"+select.value);});
  $("#human-damage").addEventListener("click", (e) => { if (e.target.closest("[data-card-zoom]")) return; performManualAction("counter-blast"); });
  $("#human-order-zone").addEventListener("click", (e) => { if (e.target.closest("[data-card-zoom]")) return; const selected = selectedHandCard(); if (selected && /Order/i.test(cardMap.get(selected.cardId)?.type || "")) { performManualAction("play-order"); return; } const order = e.target.closest("[data-order-uid]"); if (order) { showOrderMenu(order.dataset.orderUid); return; } });
  $("#advance-phase").addEventListener("click", () => { if (match?.pendingAttack) return; });
  const noGuardButton = document.createElement("button"); noGuardButton.id = "no-guard"; noGuardButton.className = "button button-quiet hidden"; noGuardButton.textContent = "No guard"; noGuardButton.addEventListener("click", () => performOnlineAction("noGuard")); $(".action-buttons").insertBefore(noGuardButton, $("#guard-card"));
  $("#sort-hand").addEventListener("click", () => { if (!match) return; match.players.human.hand.sort((a, b) => { const ca = cardMap.get(a.cardId), cb = cardMap.get(b.cardId); return (ca?.grade || 0) - (cb?.grade || 0) || ca?.name.localeCompare(cb?.name); }); renderMatch(); });
  $("#clear-log").addEventListener("click", () => { if (match) { match.log = []; renderLog(); } });
  $("#create-deck").addEventListener("click", () => { emptyDeck(); showView("decks"); $("#deck-name").focus(); });
  $("#save-deck").addEventListener("click", saveDeck); $("#load-deck-editor").addEventListener("click", openLoadDeckDialog); $("#load-deck-confirm").addEventListener("click", () => { const deck = readSavedDecks().find((item) => item.id === $("#load-deck-choice").value); if (!deck) { toast("Choose a saved deck first."); return; } $("#load-deck-dialog").close(); loadDeck(deck); }); $("#starter-vanguard").addEventListener("change", () => { builder.starterCardId = $("#starter-vanguard").value; renderBuilder(); }); $("#deck-name").addEventListener("input", () => { builder.name = $("#deck-name").value; $("#builder-title").textContent = builder.name || "Untitled deck"; });
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
  $("#match-menu").addEventListener("click", () => { if (confirm("Start a new practice match? The current match will end.")) { endOnlineSession(); openPracticeSetup(); } });
  $("#roll-online-die").addEventListener("click", () => { if (online.role === "guest") { if (!online.connection?.open) { toast("Wait for the host to connect, then roll again."); return; } online.connection.send({ type: "setup-roll" }); } else if (online.role === "host") rollOnlineDieFor("human"); });
  window.addEventListener("pagehide", () => { if (online.role === "host" && online.publicRoomCode && account.client) void account.client.rpc("close_match_room", { p_room_code: online.publicRoomCode }); });
  $$("[data-first-choice]").forEach((button) => button.addEventListener("click", () => chooseOnlineFirstPlayer(button.dataset.firstChoice)));
  $("#online-start-dialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#card-dialog").addEventListener("click", (e) => { if (e.target === $("#card-dialog")) $("#card-dialog").close(); });
  populateClanFilters(); updateDeckCount(); renderBuilder(); renderLibrary(); renderArtGallery(); renderSavedDecks();
  initializeAccounts();
  const initial = ["play", "decks", "cards"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "play"; showView(initial);
  if (!readSavedDecks().length) { $("#match-layout").classList.add("hidden"); $("#match-empty").classList.remove("hidden"); }
  const inviteParams = new URLSearchParams(location.search); if (inviteParams.has("join") || inviteParams.has("watch")) { openOnlineDialog("join", location.href); if (inviteParams.has("watch")) { $("#online-join-role").value = "spectator"; renderOnlineDeckChoices(); } }
})();
