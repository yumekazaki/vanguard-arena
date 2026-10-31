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
  const importedCardIds = new Set(importedCatalog.map(card => card.id));
  const cardList = importedCatalog.length ? [...importedCatalog, ...userCards] : [...sampleCards, ...userCards];
  const cardMap = new Map(cardList.map((c) => [c.id, c]));
  window.ArenaInspector?.setCatalog(cardList);
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
  const gradeOf = (card, fallback = -1) => card?.grade !== null && card?.grade !== undefined && Number.isFinite(Number(card.grade)) ? Number(card.grade) : fallback;
  const artPageSize = 60;
  let artPage = 0;
  let builderPage = 0;
  let libraryPage = 0;
  const cardPageSize = 48;
  const phases = ["Stand", "Draw", "Ride", "Stride", "Main", "Battle", "End"];
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  let view = "play";
  let builder = { id: null, name: "Untitled deck", format: "premium", cards: {}, starterCardId: "", rideDeck: [] };
  let selectedCard = null;
  let pendingCallSelectionUid = null;
  let zoneFieldSelection = null;
  let match = null;
  let selectedZone = null;
  let botTimer = null;
  let activeCheckRevealId = null;
  let checkRevealTimer = null;
  const shownCheckRevealIds = new Set();
  let online = { role: null, peer: null, connection: null, watchConnection: null, watchers: [], roomId: null, publicRoomCode: null, heartbeat: null, joinRetry: null, remoteRequestTimer: null, remoteRequestPending: null, relayStateReceived: false, applyingRemote: false, relayPlayerJoined: false, dialogMode: "host", selectedDeck: null, mulliganSelection: [], mulliganSubmitted: false, abilityResponsePending: null, lastSentStateSignature: null, turnOrderAnnouncementPending: false, turnOrderAnnouncementMatchId: null, turnOrderAnnouncementTimer: null };
  const localDeckStorageKey = "vanguardArenaDecks";
  const account = { client: null, matchClient: null, user: null, syncing: false, recovery: false, profile: null };
  const profileAvatars = [
    { id: "aichi", name: "Aichi Sendou", series: "Original", src: "assets/ui/aichi-sendou.png" },
    { id: "emi", name: "Emi Sendou", series: "Original", src: "https://anime.cf-vanguard.com/vg2018-if/wordpress/wp-content/uploads/char-stand-e01.png" },
    { id: "kai", name: "Toshiki Kai", series: "Original", src: "assets/ui/profile-face-kai.png" },
    { id: "misaki", name: "Misaki Tokura", series: "Original", src: "assets/ui/profile-face-misaki.png" },
    { id: "kamui", name: "Kamui Katsuragi", series: "Original", src: "assets/ui/profile-face-kamui.png" },
    { id: "ren", name: "Ren Suzugamori", series: "Original", src: "https://anime.cf-vanguard.com/vg2018-if/wordpress/wp-content/uploads/char-stand-05.png" },
    { id: "asaka", name: "Asaka Narumi", series: "Original", src: "https://anime.cf-vanguard.com/vg2018-if/wordpress/wp-content/uploads/char-stand-b12.png" },
    { id: "kourin", name: "Kourin Tatsunagi", series: "Original", src: "https://anime.cf-vanguard.com/vg2018-if/wordpress/wp-content/uploads/char-stand-b03.png" },
    { id: "chrono", name: "Chrono Shindou", series: "Vanguard G", src: "https://www.tv-tokyo.co.jp/anime/cf-vanguard-g/images/chara/chara01.png" },
    { id: "shion", name: "Shion Kiba", series: "Vanguard G", src: "https://www.tv-tokyo.co.jp/anime/cf-vanguard-g/images/chara/chara02.png" },
    { id: "tokoha", name: "Tokoha Anjou", series: "Vanguard G", src: "https://www.tv-tokyo.co.jp/anime/cf-vanguard-g/images/chara/chara03.png" },
    { id: "ibuki", name: "Koji Ibuki", series: "Vanguard G", src: "https://www.tv-tokyo.co.jp/anime/cf-vanguard-g/images/chara/chara08.png" }
  ];
  function profileAvatarStorageKey() { return `vanguardArenaProfileAvatar:${account.user?.id || "local"}`; }
  function selectedProfileAvatar() { return localStorage.getItem(profileAvatarStorageKey()) || account.user?.user_metadata?.profile_avatar || ""; }
  async function saveProfileAvatar(id) {
    localStorage.setItem(profileAvatarStorageKey(), id);
    if (account.user && account.client) {
      const { data, error } = await account.client.auth.updateUser({ data: { ...(account.user.user_metadata || {}), profile_avatar: id } });
      if (!error && data?.user) account.user = data.user;
      else if ($("#profile-status")) $("#profile-status").textContent = "Portrait saved on this device; account sync failed.";
    }
    renderProfileAvatarPicker();
    if (match) renderMatch();
  }
  function profileAvatarImage(id, fallback = "✦") {
    const avatar = profileAvatars.find(item => item.id === id);
    return avatar ? `<img class="profile-img profile-img-${avatar.id}" src="${avatar.src}" alt="" onerror="this.replaceWith(document.createTextNode('${avatar.name[0]}'))" />` : escapeHtml(fallback);
  }
  function renderProfileAvatarPicker() {
    const picker = $("#profile-avatar-picker"); if (!picker) return;
    const selected = selectedProfileAvatar();
    const current = $("#profile-avatar-current"), chosen = profileAvatars.find(avatar => avatar.id === selected);
    if (current) current.innerHTML = `<span class="profile-current-image">${profileAvatarImage(selected, "?")}</span><span><small>YOUR PROFILE PORTRAIT</small><b>${escapeHtml(chosen?.name || "Choose a fighter portrait")}</b><em>${chosen ? `${escapeHtml(chosen.series)} series` : "Pick a character below"}</em></span>`;
    picker.innerHTML = profileAvatars.map(avatar => `<button class="profile-avatar-option${selected === avatar.id ? " selected" : ""}" type="button" data-profile-avatar="${avatar.id}" aria-pressed="${selected === avatar.id}" aria-label="Choose ${avatar.name}"><span>${profileAvatarImage(avatar.id)}</span><b>${avatar.name}</b><small>${avatar.series} series</small></button>`).join("");
  }
  function paintMatchAvatar(selector, id, fallback) {
    const element = $(selector); if (element) element.innerHTML = profileAvatarImage(id, fallback);
  }

  function deckStorageKey() { return account.user ? `${localDeckStorageKey}:${account.user.id}` : localDeckStorageKey; }
  function readSavedDecks() {
    try { return JSON.parse(localStorage.getItem(deckStorageKey()) || "[]"); } catch { return []; }
  }
  function writeSavedDecks(decks) { localStorage.setItem(deckStorageKey(), JSON.stringify(decks)); updateDeckCount(); if (account.user && !account.syncing) void persistCloudDecks(decks); }
  // A browser preference, scoped to the current deck folder; saved deck data stays unchanged.
  const restoredDefaultDeckScopes = new Set();
  let defaultDeckStartupSnapshot = JSON.stringify(builder);
  function defaultDeckStorageKey() { return `${deckStorageKey()}:defaultDeckId`; }
  function savedDefaultDeck() {
    const id = localStorage.getItem(defaultDeckStorageKey());
    return id ? readSavedDecks().find(deck => String(deck.id) === id) || null : null;
  }
  function restoreDefaultDeck() {
    const scope = defaultDeckStorageKey(), deck = savedDefaultDeck();
    // Account decks may arrive later. Never replace work started while they were loading.
    if (!deck || restoredDefaultDeckScopes.has(scope) || match || JSON.stringify(builder) !== defaultDeckStartupSnapshot) return;
    builder = { id: deck.id, name: deck.name, format: deck.format === "standard" ? "standard" : "premium", cards: { ...deck.cards }, starterCardId: deck.starterCardId || "", rideDeck: [...(deck.rideDeck || [])] };
    restoredDefaultDeckScopes.add(scope);
    defaultDeckStartupSnapshot = JSON.stringify(builder);
    renderBuilder();
  }
  function makeDefaultDeck(id) {
    const deck = readSavedDecks().find(item => String(item.id) === String(id));
    if (!deck) return;
    localStorage.setItem(defaultDeckStorageKey(), String(deck.id));
    restoredDefaultDeckScopes.add(defaultDeckStorageKey());
    builder = { id: deck.id, name: deck.name, format: deck.format === "standard" ? "standard" : "premium", cards: { ...deck.cards }, starterCardId: deck.starterCardId || "", rideDeck: [...(deck.rideDeck || [])] };
    renderBuilder(); renderSavedDecks();
    toast(`“${deck.name}” is your default deck for the workshop and practice`);
  }
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
    $("#account-button").textContent = account.user ? `Account · ${(account.user.email || "Player").split("@")[0]}` : "Sign in";
    $("#account-import-local").classList.toggle("hidden", !account.user || !localDecksToImport().length);
    $("#profile-username").value = account.profile?.username || "";
    $("#profile-display-name").value = account.profile?.display_name || "";
    $("#profile-bio").value = account.profile?.bio || "";
    if (account.profile?.username) $("#account-button").textContent = `@${account.profile.username}`;
    renderProfileAvatarPicker();
    if (config?.url && config?.publishableKey && !window.supabase?.createClient) {
      $("#account-setup-needed").classList.remove("hidden");
      $("#account-setup-needed").innerHTML = "The account service library did not load. Check your internet connection and reload the page.";
    }
  }
  function localDecksToImport() { try { return JSON.parse(localStorage.getItem(localDeckStorageKey) || "[]"); } catch { return []; } }
  function cloudDeckRows(decks, userId = account.user?.id) { return decks.map((deck) => ({ user_id: userId, deck_id: String(deck.id), name: String(deck.name || "Untitled deck"), cards: { ...(deck.cards && typeof deck.cards === "object" ? deck.cards : {}), __starterCardId: deck.starterCardId || null, __deckFormat: deck.format === "standard" ? "standard" : "premium", __rideDeck: Array.isArray(deck.rideDeck) ? deck.rideDeck : [] }, updated_at: deck.updatedAt || new Date().toISOString() })); }
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
      [...readSavedDecks(), ...(data || []).map((row) => { const stored = row.cards || {}; const { __starterCardId, __deckFormat, __rideDeck, ...cards } = stored; return { id: row.deck_id, name: row.name, cards, starterCardId: __starterCardId || "", format: __deckFormat === "standard" ? "standard" : "premium", rideDeck: Array.isArray(__rideDeck) ? __rideDeck : [], updatedAt: row.updated_at }; })].forEach((deck) => {
        const current = decks.get(String(deck.id));
        if (!current || Date.parse(deck.updatedAt || 0) > Date.parse(current.updatedAt || 0)) decks.set(String(deck.id), deck);
      });
      const merged = [...decks.values()].sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
      localStorage.setItem(deckStorageKey(), JSON.stringify(merged)); updateDeckCount(); restoreDefaultDeck(); renderSavedDecks();
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
      account.matchClient = window.supabase.createClient(config.url, config.publishableKey, { auth: { storageKey: "vanguard-arena-match-session", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      account.client.auth.onAuthStateChange((event, session) => {
        const previousUserId = account.user?.id;
        account.user = session?.user || null; if (previousUserId !== account.user?.id) account.profile = null; account.recovery = event === "PASSWORD_RECOVERY";
        refreshAccountUI(); updateDeckCount(); restoreDefaultDeck(); renderSavedDecks();
        if (account.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) setTimeout(() => { void syncCloudDecks(); void loadPlayerProfile(); }, 0);
        if (account.recovery) { accountMessage("Enter a new password, then choose Save new password."); setTimeout(openAccountDialog, 0); }
        if (!account.user) $("#account-sync-status").textContent = "Your account is signed out. Local decks remain in this browser.";
      });
      account.client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        account.user = data.session?.user || null; refreshAccountUI(); updateDeckCount(); restoreDefaultDeck(); renderSavedDecks();
        if (account.user) { void syncCloudDecks(); void loadPlayerProfile(); }
      }).catch((error) => accountMessage(`Couldn't restore your account session: ${error.message}`, true));
    } catch (error) { accountMessage(`Account setup error: ${error.message}`, true); }
    refreshAccountUI();
  }
  async function ensureOnlineMatchSession() {
    if(!account.matchClient)return false;
    try {
      const current=await account.matchClient.auth.getSession();if(current.error)throw current.error;
      if(current.data?.session?.user)return true;
      const created=await account.matchClient.auth.signInAnonymously();if(created.error)throw created.error;
      if(!created.data?.session?.user)throw new Error("The match session was not created.");
      return true;
    } catch(error) {
      setOnlineError("Online player identity needs Supabase Anonymous Sign-Ins enabled and the match-auth-v1.sql migration installed. " + (error?.message||""));
      return false;
    }
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
  function emptyDeck(format = "premium") { builder = { id: null, name: "Untitled deck", format: format === "standard" ? "standard" : "premium", cards: {}, starterCardId: "", rideDeck: [] }; renderBuilder(); }
  function defaultDeck() {
    const cards = {};
    const pool = cardList.filter((c) => c.type === "Unit" || c.type === "Trigger");
    for (let i = 0; i < 50; i++) { const card = pool[(i * 7 + Math.floor(i / pool.length)) % pool.length]; cards[card.id] = (cards[card.id] || 0) + 1; }
    const starterCardId = Object.keys(cards).find((id) => Number(cardMap.get(id)?.grade) === 0 && isUnitCard(cardMap.get(id))) || "";
    return { id: crypto.randomUUID?.() || String(Date.now()), name: "Demo Practice Deck", format: "premium", cards, starterCardId, rideDeck: [] };
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
  function standardRideDeckErrors(deck) {
    if (deck?.format !== "standard") return [];
    const selected = Array.isArray(deck.rideDeck) ? deck.rideDeck : [], errors = [];
    [0, 1, 2, 3].forEach((grade, index) => {
      const id = selected[index], card = cardMap.get(id);
      if (!card || !isUnitCard(card) || Number(card.grade) !== grade || Number(deck.cards?.[id] || 0) < selected.filter(value => value === id).length) errors.push(`select a Grade ${grade} unit for the Ride Deck`);
    });
    return errors;
  }
  function deckReadyErrors(deck) {
    const errors = standardRideDeckErrors(deck), total = deckCount(deck), gTotal = gDeckCount(deck);
    if (total !== 50) errors.push(`deck has ${total}/50 cards`);
    if (deck?.format === "standard") { if (gTotal) errors.push("Standard decks cannot include G-deck cards"); }
    else if (!deck?.starterCardId || Number(cardMap.get(deck.starterCardId)?.grade) !== 0 || !isUnitCard(cardMap.get(deck.starterCardId)) || Number(deck.cards?.[deck.starterCardId] || 0) < 1) errors.push("choose a Grade 0 starting Vanguard from the deck");
    return errors;
  }
  function rideDeckOptions(grade) {
    return Object.entries(builder.cards || {}).filter(([id, qty]) => Number(qty) > 0 && Number(cardMap.get(id)?.grade) === grade && isUnitCard(cardMap.get(id))).map(([id]) => cardMap.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }
  function deckNameKey(card, id) { return String(card?.name || id).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function namedDeckLimits(deck) {
    const limits = new Map(), engine = window.VanguardAbilityEngine;
    if (!engine?.parseCardAbilities) return limits;
    for (const [id, qty] of Object.entries(deck?.cards || {})) if (Number(qty) > 0) {
      const card = cardMap.get(id); if (!card) continue;
      for (const ability of engine.parseCardAbilitiesCached?.(card) || engine.parseCardAbilities(card)) for (const restriction of ability.definition?.continuousRestrictions || []) {
        if (restriction.type !== "named-deck-copy-limit") continue;
        const key = deckNameKey({ name: restriction.cardName }, restriction.cardName), maximum = Number(restriction.maximum);
        if (Number.isSafeInteger(maximum) && maximum > 0) limits.set(key, Math.min(limits.get(key) || maximum, maximum));
      }
    }
    return limits;
  }
  function deckCopyLimitForCard(card, deck = builder) {
    const key = deckNameKey(card, card?.id), limits = namedDeckLimits(deck), engine = window.VanguardAbilityEngine;
    for (const ability of engine?.parseCardAbilitiesCached?.(card) || engine?.parseCardAbilities?.(card) || []) for (const restriction of ability.definition?.continuousRestrictions || []) {
      if (restriction.type === "named-deck-copy-limit" && deckNameKey({ name: restriction.cardName }, restriction.cardName) === key) {
        const maximum = Number(restriction.maximum); if (Number.isSafeInteger(maximum) && maximum > 0) limits.set(key, Math.min(limits.get(key) || maximum, maximum));
      }
    }
    return limits.get(key) || 4;
  }
  function deckSummary(deck) {
    const counts = [0, 0, 0, 0]; let triggers = 0, heals = 0, overs = 0, sentinels = 0, regalis = 0; const names = new Map(), gNames = new Map(), limits = namedDeckLimits(deck);
    Object.entries(deck.cards || {}).forEach(([id, qty]) => { const c = cardMap.get(id); if (!c) return; const isG = isGDeckCard(c), grade = Number(c.grade); if (!isG && Number.isFinite(grade) && grade >= 0) counts[Math.min(3, grade)] += qty; if (!isG && c.trigger) { triggers += qty; if (/^Heal$/i.test(c.trigger)) heals += qty; if (/^Over$/i.test(c.trigger)) overs += qty; } if (!isG && isSentinel(c)) sentinels += qty; if (!isG && /Regalis Piece/i.test(String(c.text || "") + " " + String(c.type || ""))) regalis += qty; const key=deckNameKey(c,id); const map=isG?gNames:names; map.set(key,(map.get(key)||0)+qty); });
    const nameViolations = [...names].filter(([key, qty]) => qty > (limits.get(key) || 4)).length + [...gNames.values()].filter(qty => qty > 4).length;
    return { counts, triggers, heals, overs, sentinels, regalis, nameViolations };
  }
  function renderBuilder() {
    $("#deck-name").value = builder.name || "";
    $("#builder-title").textContent = builder.name || "Untitled deck";
    const total = deckCount(builder), gTotal = gDeckCount(builder); const { counts, triggers, heals, overs, sentinels, regalis, nameViolations } = deckSummary(builder);
    $("#deck-total").textContent = builder.format === "standard" ? `${total} / ${(builder.rideDeck || []).filter(Boolean).length}` : `${total} / ${gTotal}`;
    $("#main-gdeck-label").textContent = builder.format === "standard" ? "MAIN / RIDE DECK" : "MAIN / G DECK";
    $("#grade-breakdown").textContent = counts.join(" / ");
    $("#trigger-count").textContent = triggers;
    const validation = $("#deck-validation");
    const isStandard = builder.format === "standard", errors = isStandard ? standardRideDeckErrors(builder) : [];
    if (isStandard && gTotal) errors.push("Standard decks cannot include G-deck cards");
    if (!isStandard && !builder.starterCardId) errors.push("choose a Grade 0 starting Vanguard"); if (total !== 50) errors.push(`${total}/50 main-deck cards`); if (!isStandard && gTotal > 16) errors.push(`${gTotal}/16 G-deck cards`); if (triggers !== 16) errors.push(`${triggers}/16 triggers`); if (heals > 4) errors.push(`${heals}/4 Heal triggers`); if (overs > 1) errors.push(`${overs}/1 Over Trigger`); if (sentinels > 4) errors.push(`${sentinels}/4 Sentinels`); if (regalis > 1) errors.push(`${regalis}/1 Regalis Piece`); if (nameViolations) errors.push(`${nameViolations} card name limits`);
    validation.className = `deck-validation${errors.length ? " invalid" : total ? " valid" : ""}`; validation.textContent = errors.length ? `Deck rules to fix: ${errors.join(" · ")}.` : total ? "Deck construction limits are satisfied (Ride Deck rules excluded)." : "Add cards from the library to start building.";
    const starterOptions = Object.entries(builder.cards || {}).filter(([id, qty]) => qty > 0 && Number(cardMap.get(id)?.grade) === 0 && isUnitCard(cardMap.get(id))).map(([id, qty]) => ({ card: cardMap.get(id), qty })).filter((entry) => entry.card).sort((a, b) => a.card.name.localeCompare(b.card.name));
    if (builder.starterCardId && !starterOptions.some(({ card }) => card.id === builder.starterCardId)) builder.starterCardId = "";
    $("#deck-format-label").textContent = isStandard ? "STANDARD" : "PREMIUM";
    $("#premium-deck-fields").classList.toggle("hidden", isStandard); $("#standard-deck-fields").classList.toggle("hidden", !isStandard);
    if (!Array.isArray(builder.rideDeck)) builder.rideDeck = [];
    [0, 1, 2, 3].forEach((grade) => { const select = $(`#ride-deck-${grade}`); if (!select) return; select.innerHTML = `<option value="">Choose a Grade ${grade} unit…</option>${rideDeckOptions(grade).map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)} · ×${Number(builder.cards[card.id] || 0)}</option>`).join("")}`; select.value = builder.rideDeck[grade] || ""; });
    $("#starter-vanguard").innerHTML = `<option value="">Choose a Grade 0 unit…</option>${starterOptions.map(({ card, qty }) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)} · ×${qty}</option>`).join("")}`;
    $("#starter-vanguard").value = builder.starterCardId || "";
    $("#starter-vanguard-help").textContent = builder.starterCardId ? `${cardMap.get(builder.starterCardId)?.name || "Selected unit"} will begin on your Vanguard circle.` : "Choose a Grade 0 unit from your deck. It starts on your Vanguard circle.";
    const rows = Object.entries(builder.cards || {}).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ card: cardMap.get(id), qty })).filter((x) => x.card).sort((a, b) => a.card.grade - b.card.grade || a.card.name.localeCompare(b.card.name));
    // Presentation only: every copy is visible; existing quantity and zoom handlers are reused.
    const visualCard = (card, qty, copy) => `<article class="deck-grid-card" data-card-id="${escapeHtml(card.id)}"><button class="deck-grid-image" type="button" aria-label="Inspect ${escapeHtml(card.name)}, copy ${copy + 1} of ${qty}">${cardImage(card)}</button><button class="deck-grid-zoom" type="button" data-card-zoom="${escapeHtml(card.id)}" aria-label="Zoom ${escapeHtml(card.name)}">⤢</button><span class="deck-copy-number">${copy + 1}/${qty}</span><div class="deck-copy-controls"><button type="button" data-qty="-1" data-id="${escapeHtml(card.id)}" aria-label="Remove one ${escapeHtml(card.name)}">−</button><button type="button" data-qty="1" data-id="${escapeHtml(card.id)}" aria-label="Add one ${escapeHtml(card.name)}">+</button><button type="button" data-remove="${escapeHtml(card.id)}" aria-label="Remove all ${escapeHtml(card.name)}" title="Remove all copies">×</button></div></article>`;
    const visualSection = (items, title, count, limit, extra = false) => {
      const cards = items.flatMap(({card, qty}) => Array.from({length:qty}, (_,copy) => visualCard(card,qty,copy))).join("");
      const slots = Array.from({length:Math.max(0,limit-count)}, () => '<span class="deck-empty-slot" aria-hidden="true"></span>').join("");
      return `<section class="workshop-deck-section${extra ? " workshop-gdeck" : ""}" aria-label="${title}"><header><h3>${title}</h3><span>${count} / ${limit}</span></header><div class="deck-grid-stage"><div class="deck-card-grid">${cards}${slots}</div>${!count ? `<div class="deck-empty-prompt"><b>${extra ? "Your G deck" : "Your next deck starts here"}</b><span>${extra ? "G Units and G Guardians appear here." : "Search on the right, then click a card to add it."}</span></div>` : ""}</div></section>`;
    };
    $("#deck-list").innerHTML = visualSection(rows.filter(({card}) => !isGDeckCard(card)), "Main deck", total, 50) + (isStandard ? "" : visualSection(rows.filter(({card}) => isGDeckCard(card)), "G deck", gTotal, 16, true));
    renderBuilderCards();
  }
  function renderBuilderCards() {
    const term = $("#card-search").value.trim().toLowerCase(); const grade = $("#grade-filter").value; const clan = $("#builder-clan-filter").value; const nation = $("#builder-nation-filter").value;
    const cardType = $("#builder-type-filter").value, triggerType = $("#builder-trigger-filter").value;
    const abilityTerm = $("#card-text-search").value.trim().toLowerCase();
    const filtered = cardList.filter((c) => (!abilityTerm || String(c.text || "").toLowerCase().includes(abilityTerm)) && (cardType === "all" || (cardType === "order" && /order/i.test(String(c.type || c.cardType || "")))) && (triggerType === "all" || String(c.trigger || c.triggerType || c.trigger_type || "").toLowerCase().replace(/[^a-z]/g, "").includes(triggerType)) && gradeMatches(c, grade) && clanMatches(c, clan) && nationMatches(c, nation) && (!term || `${c.name} ${c.id} ${c.dbId || ""} ${c.clan || ""} ${c.nation || ""} ${c.type} ${c.trigger || ""}`.toLowerCase().includes(term)));
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
    const allClans=window.VanguardAbilityEngine?.hasAbilityKeyword(importedCardIds.has(card.id) ? card.id : card,"all-clans-and-nations")===true;
    if (selected === "unknown") return !(card.clans || (card.clan ? [card.clan] : [])).length&&!allClans;
    return allClans||(card.clans || []).includes(selected) || card.clan === selected;
  }
  function nationMatches(card, selected) {
    const nations = card.nations?.length ? card.nations : (card.nation ? [card.nation] : []);
    if (selected === "all") return true;
    const allClansAndNations=window.VanguardAbilityEngine?.hasAbilityKeyword(importedCardIds.has(card.id) ? card.id : card,"all-clans-and-nations")===true;
    if (selected === "unknown") return nations.length === 0&&!allClansAndNations;
    return allClansAndNations||nations.includes(selected);
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
    const saved = { id, name, format: builder.format === "standard" ? "standard" : "premium", cards: { ...builder.cards }, starterCardId: builder.starterCardId || "", rideDeck: [...(builder.rideDeck || [])], updatedAt: new Date().toISOString() };
    const index = existing.findIndex((d) => d.id === id);
    if (index >= 0) existing[index] = saved; else existing.unshift(saved);
    builder = { ...saved }; writeSavedDecks(existing); renderBuilder(); renderSavedDecks();
    toast(account.user ? "Deck saved to your account folder" : "Deck saved in this browser");
  }
  function loadDeck(deck) { builder = { id: deck.id, name: deck.name, format: deck.format === "standard" ? "standard" : "premium", cards: { ...deck.cards }, starterCardId: deck.starterCardId || "", rideDeck: [...(deck.rideDeck || [])] }; renderBuilder(); showView("decks"); toast(`Loaded “${deck.name}” into the builder`); }
  function openLoadDeckDialog() {
    const decks = readSavedDecks(), select = $("#load-deck-choice"), confirm = $("#load-deck-confirm");
    select.innerHTML = decks.length ? decks.map((deck) => `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)} · ${deckCount(deck)} cards</option>`).join("") : '<option value="">No saved decks yet</option>';
    confirm.disabled = !decks.length;
    $("#load-deck-dialog").showModal();
  }
  function renderSavedDecks() {
    const decks = readSavedDecks(), defaultId = savedDefaultDeck()?.id; $("#saved-deck-subtitle").textContent = decks.length ? `${decks.length} deck${decks.length === 1 ? "" : "s"}` : "No decks yet";
    $("#saved-deck-eyebrow").textContent = account.user ? "ONLINE ACCOUNT DECK FOLDER" : "DECK FOLDER · THIS BROWSER";
    $("#deck-folder-help").textContent = account.user ? "This folder syncs to your account. Your saved decks load here whenever you sign in." : "Sign in to sync this folder across devices. Save decks here, then they load whenever you sign in.";
    $("#saved-decks").innerHTML = decks.length ? decks.map((d) => { const s = deckSummary(d); const preview = Object.keys(d.cards || {}).slice(0, 5).map((id) => cardMap.get(id)).filter(Boolean); return `<article class="saved-deck-card${d.id === defaultId ? " is-default-deck" : ""}"><h3>${escapeHtml(d.name)}</h3><div class="saved-deck-meta">${deckCount(d)} cards · G${s.counts.join(" / ")} · ${escapeHtml(new Date(d.updatedAt || Date.now()).toLocaleDateString())}</div><div class="saved-deck-preview">${preview.map((c) => `<button class="saved-deck-preview-card" type="button" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}" title="Zoom ${escapeHtml(c.name)}">${c.image ? `<img src="${escapeHtml(c.image)}" alt="" onerror="this.remove()"/>` : escapeHtml(c.glyph)}</button>`).join("")}</div><div class="saved-deck-actions"><button class="button button-primary" data-load-deck="${escapeHtml(d.id)}">Open</button><button class="button" data-duplicate-deck="${escapeHtml(d.id)}">Duplicate</button><button class="button" data-export-saved="${escapeHtml(d.id)}">Export</button><button class="button" data-delete-deck="${escapeHtml(d.id)}" title="Delete">×</button></div><button class="button saved-deck-default" type="button" data-default-deck="${escapeHtml(d.id)}" aria-pressed="${d.id === defaultId}">${d.id === defaultId ? "✓ Default deck" : "Make default deck"}</button></article>`; }).join("") : `<div class="empty-saved">Saved decks appear here. Build a deck and choose Save deck.</div>`;
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
  function cardInstances(deck, ownerPlayerId) {
    const list = [];
    Object.entries(deck.cards || {}).forEach(([id, qty]) => { for (let i = 0; i < qty; i++) list.push(window.VanguardAbilityEngine.createCardInstance(id, ownerPlayerId)); });
    return list;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function makePlayer(deck, name, human = false, avatarId = "") {
    const playerId = crypto.randomUUID?.() || 'player-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const allCards = cardInstances(deck, playerId);
    const gDeck = allCards.filter((instance) => isGDeckCard(cardMap.get(instance.cardId)));
    gDeck.forEach(instance => { instance.faceUp = false; });
    let pile = allCards.filter((instance) => !gDeck.includes(instance)), vanguard = null, rideDeck = [];
    if (deck.format === "standard") {
      (deck.rideDeck || []).forEach((cardId) => { const index = pile.findIndex((instance) => instance.cardId === cardId); if (index >= 0) rideDeck.push(pile.splice(index, 1)[0]); });
      const starter = rideDeck.find((instance) => Number(cardMap.get(instance.cardId)?.grade) === 0);
      if (starter) { rideDeck = rideDeck.filter((instance) => instance.uid !== starter.uid); vanguard = { ...starter, rested: false }; }
    } else {
      const starterId = deck.starterCardId || pile.find((instance) => Number(cardMap.get(instance.cardId)?.grade) === 0 && isUnitCard(cardMap.get(instance.cardId)))?.cardId;
      const starterIndex = pile.findIndex((instance) => instance.cardId === starterId);
      if (starterIndex >= 0) vanguard = { ...pile.splice(starterIndex, 1)[0], rested: false };
    }
    shuffle(pile);
    return { playerId, name, avatarId: profileAvatars.some(avatar => avatar.id === avatarId) ? avatarId : "", format: deck.format === "standard" ? "standard" : "premium", deck: pile.slice(5), hand: pile.slice(0, 5), damage: [], drop: [], soul: [], bind: [], vanguard, rideDeck, rodeGradeThreePlusThisFight: false, opponentTriggerRevealedThisTurn:false, rear: [null, null, null, null, null], accelZones: 0, accelTypes: [], giftZones: [], orders: [], crests: [], energy: 0, energySpentThisTurn: 0, guardCircle: [], extra: [], gDeck: shuffle(gDeck), gZone: [], removed: [], quickShields: 0, protectMarkers: 0, gifts: 0, human };
  }
  function openPracticeSetup() { $("#practice-setup-dialog").showModal(); }
  function openPracticeMulligan() {
    if (!match || online.role || !match.practiceOpeningChoicePending) return;
    match.practiceMulliganSelection = [];
    renderPracticeMulligan();
    $("#practice-mulligan-dialog").showModal();
  }
  function renderPracticeMulligan() {
    if (!match) return;
    const selected = new Set(match.practiceMulliganSelection || []), hand = match.players.human.hand || [];
    $("#practice-mulligan-cards").innerHTML = hand.map(item => { const card = cardMap.get(item.cardId); return card ? `<button class="zone-view-card mulligan-card${selected.has(item.uid) ? " selected" : ""}" type="button" data-practice-mulligan-uid="${escapeHtml(item.uid)}" aria-pressed="${selected.has(item.uid)}">${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${selected.has(item.uid) ? "Will return to deck" : "Keep in hand"}</small></button>` : ""; }).join("");
    $("#practice-mulligan-count").textContent = `${selected.size} card${selected.size === 1 ? "" : "s"} selected`;
    $("#practice-mulligan-confirm").disabled = selected.size === 0;
  }
  function finishPracticeOpeningChoice(mulligan) {
    if (!match || online.role || !match.practiceOpeningChoicePending) return;
    const player = match.players.human, selected = new Set(match.practiceMulliganSelection || []);
    if (mulligan) {
      const returned = player.hand.filter(item => selected.has(item.uid));
      if (!returned.length || returned.length !== selected.size) { toast("Choose at least one card from your opening hand."); return; }
      player.hand = player.hand.filter(item => !selected.has(item.uid));
      player.deck.unshift(...returned);
      for (let i = 0; i < returned.length; i++) { const card = player.deck.pop(); if (card) player.hand.push(card); }
      shuffle(player.deck);
      addLog(`${player.name} mulliganed ${returned.length} card${returned.length === 1 ? "" : "s"}.`);
    } else addLog(`${player.name} kept their opening hand.`);
    match.practiceOpeningChoicePending = false;
    $("#practice-mulligan-dialog").close();
    if (match.firstSide === "human") { match.turnStartGrades.human = Number(cardMap.get(match.players.human.vanguard?.cardId)?.grade ?? -1); queueTurnStartEvent("human"); setMessage("Your turn — advance through Stand and Draw."); }
    else { setMessage("Practice Bot goes first."); setTimeout(botTurn, 350); }
    renderMatch();
  }
  function startMatch(deck = null, firstSide = "human", onlineSetup = false) {
    const chosen = deck || (builder.cards && deckCount(builder) ? builder : null);
    const readyDeck = chosen && deckCount(chosen) ? chosen : defaultDeck();
    if (chosen?.format === "standard" && deckReadyErrors(chosen).length) { toast(`Cannot start this Standard deck: ${deckReadyErrors(chosen).join("; ")}.`); return; }
    match = { matchId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, stateVersion: 0, processedActionIds: [], eventSequence: 0, processedEventIds: [], players: { human: makePlayer(readyDeck, online.localName || "Player", true, selectedProfileAvatar()), bot: makePlayer(onlineSetup ? defaultDeck() : practiceBotDeck(), onlineSetup ? "Practice Bot" : "[MLB] Practice Bot") }, turn: 1, side: onlineSetup ? "human" : firstSide, firstSide: onlineSetup ? null : firstSide, firstTurnComplete: false, initialBotTurn: !onlineSetup && firstSide === "bot", preMatch: onlineSetup ? { stage: "roll", rolls: { human: null, bot: null }, winner: null, firstSide: null, mulliganDone: { human: false, bot: false } } : null, practiceOpeningChoicePending: !onlineSetup && !online.role, practiceMulliganSelection: [], phase: 0, drewThisTurn: false, ridePerformed: false, stridePerformed: false, turnStartGrades: { human: 0, bot: 0 }, pendingStride: null, pendingRide: null, pendingProtectGuard: null, ordersPlayedThisTurn: 0, selected: null, pendingAttackSetup: null, pendingAttack: null, pendingBattleEnd: null, pendingTrigger: null, pendingAbility: null, pendingAbilities: [], attacksByUnitTurn: Object.create(null), pendingDamageQueue: [], botAttacks: [], revealed: null, checkReveals: [], log: [], ended: false, deckName: readyDeck.name };
    selectedCard = null; selectedZone = null;
    $("#match-layout").classList.remove("hidden"); $("#match-empty").classList.add("hidden");
    if (onlineSetup) setMessage("Waiting for both players to roll for first turn.");
    else { addLog(`${online.role ? "Online match" : "Practice match"} started with ${readyDeck.name}. ${firstSide === "human" ? "You chose to go first." : "You chose to go second."}`); setMessage(!onlineSetup && !online.role ? "Choose a mulligan or keep your opening hand." : firstSide === "human" ? "Your turn — advance through Stand and Draw." : "Practice Bot goes first."); }
    renderMatch(); showView("play");
    if (!onlineSetup && !online.role) { openPracticeMulligan(); return; }
    if(!onlineSetup&&firstSide==="human"){match.turnStartGrades.human=Number(cardMap.get(match.players.human.vanguard?.cardId)?.grade??-1);queueTurnStartEvent("human")}
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
      sendGuestRequest("setup-choice",{firstSide:localChoice});
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
    match.turnStartGrades[firstSide]=Number(cardMap.get(match.players[firstSide].vanguard?.cardId)?.grade??-1);queueTurnStartEvent(firstSide);
  }
  function completeOnlineMulligan(side, uids = []) {
    const setup = match?.preMatch, player = match?.players?.[side];
    if (!setup || setup.stage !== "mulligan" || !player || setup.mulliganDone?.[side]) return;
    if (side !== setup.firstSide && !setup.mulliganDone?.[setup.firstSide]) { toast("The player going first must finish their mulligan first."); return; }
    if (!Array.isArray(uids) || uids.some(uid => typeof uid !== "string") || new Set(uids).size !== uids.length) { toast("Choose valid, unique cards from your hand."); return; }
    const selected = new Set(uids);
    const returned = player.hand.filter((item) => selected.has(item.uid));
    if (returned.length !== selected.size) { toast("A selected card is no longer in your hand. Refresh the match and try again."); return; }
    player.hand = player.hand.filter((item) => !selected.has(item.uid));
    player.deck.unshift(...returned);
    for (let i = 0; i < returned.length; i++) { const card = player.deck.pop(); if (card) player.hand.push(card); }
    if (returned.length) shuffle(player.deck);
    setup.mulliganDone[side] = true;
    if (side === "human" && online.role) online.turnOrderAnnouncementPending = true;
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
      const done = match.preMatch.mulliganDone || { human: false, bot: false }, localSide = "human", submitted = online.mulliganSubmitted || done[localSide];
      const waitingForFirstPlayer = localSide !== match.preMatch.firstSide && !done[match.preMatch.firstSide];
      const selection = new Set(online.mulliganSelection || []), hand = match.players.human.hand || [];
      $("#online-roll-status").textContent = done.human && done.bot ? "Both players confirmed." : waitingForFirstPlayer ? `${match.players[match.preMatch.firstSide]?.name || "First player"} must finish first.` : done.human ? `${match.players.human.name} confirmed. Waiting for ${match.players.bot.name}.` : done.bot ? `${match.players.bot.name} confirmed. Choose any cards to return, or keep your hand.` : "Select any number of cards to put on the bottom of your deck, then draw that many. Or confirm with none selected.";
      $("#online-mulligan-cards").innerHTML = submitted ? `<p class="mulligan-waiting">${done[localSide] ? "You’re done. Waiting for the other player…" : "Mulligan sent. Waiting for the first player to finish…"}</p>` : hand.map((item) => { const c = cardMap.get(item.cardId); return c ? `<button class="zone-view-card mulligan-card${selection.has(item.uid) ? " selected" : ""}" type="button" data-mulligan-uid="${escapeHtml(item.uid)}" aria-pressed="${selection.has(item.uid)}">${cardImage(c)}<b>${escapeHtml(c.name)}</b><small>${selection.has(item.uid) ? "Will return to deck" : "Keep in hand"}</small></button>` : ""; }).join("");
      const confirm = $("#online-mulligan-confirm"); confirm.textContent = online.role === "guest" ? "Confirm mulligan" : "Done mulliganing"; confirm.disabled = submitted || done[localSide] || waitingForFirstPlayer;
      $("#online-mulligan-count").textContent = waitingForFirstPlayer ? "Waiting for the first player" : submitted ? "Waiting for the other player" : `${selection.size} card${selection.size === 1 ? "" : "s"} selected`;
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
  function updateOnlineChat() {
    window.VanguardTableChat?.controller?.setSession({
      role: online.role, sessionId: online.publicRoomCode || online.roomId || "",
      matchId: match?.matchId || "",
      connected: Boolean(online.connection?.open) && (online.role !== "host" || !online.connection?.isRelay || online.relayPlayerJoined),
      localName: online.localName || match?.players?.human?.name || "Player",
      opponentName: match?.players?.bot?.name || "Opponent",
      send: message => online.connection?.send(message)
    });
  }
  function renderMatch() {
    updateOnlineChat();
    if (!match) return;
    window.VanguardArenaVisualEffects?.beforeRender();
    checkDamageEnd();
    const you = match.players.human, bot = match.players.bot;
    for (const side of [you, bot]) for (const instance of [...(side.hand || []), ...(side.crests || [])]) if (instance?.crestName) ensureCrestCard(instance.crestName);
    $("#human-name").textContent = you.name; $("#table-human-name").textContent = you.name;
    $("#opponent-name").textContent = bot.name; $("#table-opponent-name").textContent = bot.name;
    paintMatchAvatar(".human-avatar", online.role === "watcher" ? you.avatarId : selectedProfileAvatar(), "P");
    paintMatchAvatar(".bot-avatar", online.role === "guest" ? you.avatarId : bot.avatarId, "✦");
    $("#match-status").textContent = online.role === "watcher" ? "SPECTATING · LIVE" : online.role ? "ONLINE MATCH" : "PRACTICE MATCH";
    $("#opponent-deck-label").textContent = online.role ? "OPPONENT" : "DEMO DECK";
    $("#turn-label").textContent = match.side === "human" ? "YOUR TURN" : "OPPONENT TURN";
    $("#phase-label").textContent = match.side === "human" ? `${phases[match.phase]} phase` : `Practice Bot · ${phases[match.phase]} phase`;
    $("#turn-number").textContent = String(match.turn).padStart(2, "0"); $("#table-turn").textContent = String(match.turn).padStart(2, "0");
    const visiblePhaseIndices = match.players[match.side]?.format === "standard" ? [0, 1, 2, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6], currentVisiblePhase = visiblePhaseIndices.indexOf(match.phase);
    $("#phase-count").textContent = `${Math.max(0, currentVisiblePhase) + 1} / ${visiblePhaseIndices.length}`;
    $("#phase-list").innerHTML = visiblePhaseIndices.map((phase, i) => `<div class="phase-item${phase === match.phase ? " active" : ""}${phase < match.phase ? " past" : ""}"><span class="phase-bullet">${phase < match.phase ? "✓" : i + 1}</span>${phases[phase]} phase</div>`).join("");
    $$(".phase-segment").forEach((el, i) => { const phase = visiblePhaseIndices[i]; el.classList.toggle("done", phase !== undefined && phase < match.phase); el.classList.toggle("current", phase === match.phase); el.classList.toggle("hidden", phase === undefined); });
    $("#human-deck-count").textContent = you.deck.length; $("#bot-deck-count").textContent = bot.deck.length; $("#human-drop-count").textContent = you.drop.length; $("#bot-drop-count").textContent = bot.drop.length;
    $("#soul-count").textContent = String(you.soul.length);
    $("#human-gdeck-count").textContent = you.format === "standard" ? (you.rideDeck?.length || 0) : (you.gDeck?.length || 0); $("#bot-gdeck-count").textContent = bot.format === "standard" ? (bot.rideDeck?.length || 0) : (bot.gDeck?.length || 0); $("#human-bind-count").textContent = you.bind?.length || 0; $("#bot-soul-count").textContent = bot.soul?.length || 0;
    [["human", you], ["bot", bot]].forEach(([side, player]) => { const button = $(`.gdeck-button[data-gdeck-side="${side}"]`); if (button) { button.querySelector("small").textContent = player.format === "standard" ? "RIDE DECK" : "G DECK"; button.classList.toggle("ride-deck-button", player.format === "standard"); } const label = $(`#${side}-gzone`).previousElementSibling; if (label) label.textContent = player.format === "standard" ? "RIDE DECK" : "G ZONE"; });
    $("#human-order-zone").innerHTML = renderOrderCards(you.orders, "human"); $("#bot-order-zone").innerHTML = renderOrderCards(bot.orders, "bot"); $("#human-order-count").textContent=String(you.orders?.length||0); $("#bot-order-count").textContent=String(bot.orders?.length||0); $("#human-crest-zone").innerHTML = renderCrests(you.crests); $("#bot-crest-zone").innerHTML = renderCrests(bot.crests);
    $("#human-gzone").innerHTML = renderGZone(you, true); $("#bot-gzone").innerHTML = renderGZone(bot, false);
    $("#human-guard-circle").innerHTML = renderGuardCircle(you); $("#bot-guard-circle").innerHTML = renderGuardCircle(bot);
    $("#gift-count").textContent = String(you.gifts || 0);
    $(".human-line .player-title small").textContent = `YOUR SIDE · G ${you.gZone?.length || 0} · QUICK SHIELD ${you.quickShields || 0} · PROTECT ${you.protectMarkers || 0}`;
    $(".opponent-line .player-title small").textContent = `${online.role ? "OPPONENT" : "DEMO DECK"} · G ${bot.gZone?.length || 0} · QUICK SHIELD ${bot.quickShields || 0} · PROTECT ${bot.protectMarkers || 0}`;
    $("#human-damage").innerHTML = renderDamageCards(you);
    $("#bot-damage").innerHTML = renderDamageCards(bot);
    $("#bot-hand-count").textContent = `${bot.hand.length} CARDS`;
    $("#bot-hand").innerHTML = Array.from({ length: Math.min(8, bot.hand.length) }, () => `<span class="mini-back"></span>`).join("");
    renderZone("human", "vanguard", you.vanguard); renderZone("bot", "vanguard", bot.vanguard); renderRideDeckFlow();
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
      const accelRow = $(`#${side}-accel-row`); if (accelRow) { accelRow.style.display = player.accelZones ? "grid" : "none"; accelRow.style.gridTemplateColumns = `repeat(${3 + player.accelZones}, minmax(0, 1fr))`; accelRow.style.width = "96%"; accelRow.style.left = "2%"; const leftAccelCount = Math.ceil(player.accelZones / 2); for (let i = 1; i <= player.accelZones; i++) { const column = i % 2 ? leftAccelCount - Math.floor((i - 1) / 2) : leftAccelCount + 4 + Math.floor((i - 1) / 2); const circle = $(`.field-zone[data-side="${side}"][data-zone="accel-${i}"]`); if (circle) { circle.style.gridColumn = String(column); circle.style.transform = "none"; } } }
    });
            $("#soul-pips").innerHTML = you.soul.slice(0, 7).map(() => `<span class="soul-pip"></span>`).join("");
    $("#hand-count").textContent = `${you.hand.length} card${you.hand.length === 1 ? "" : "s"}`;
    $("#hand-cards").innerHTML = you.hand.map((instance, i) => { const c = cardMap.get(instance.cardId); return c ? cardNode(c, match.selected === instance.uid).replace('data-card-id=', `data-hand-uid="${instance.uid}" data-hand-index="${i}" data-card-id=`) : ""; }).join("");
    updateActionAvailability(); renderLog(); renderGAssistDialog(); renderRemotePaymentPrompt();
    if (match.revealed?.cards?.length) renderSharedReveal(); else if($("#reveal-dialog").open) $("#reveal-dialog").close();
    renderOnlineSetup(); renderTriggerPrompt(); renderAttackPrompt(); renderBattleActionPrompt(); renderAttackArrow(); renderCrestPrompt(); renderPublicReveal(); renderCheckReveal(); renderOnlineTurnOrderAnnouncement(); renderRideDeckFlow();
    window.VanguardArenaVisualEffects?.afterRender(match);
    if(!online.applyingRemote)showNextAbilityPrompt();
    if (!online.applyingRemote && match.pendingAttack?.awaitingDrive) setTimeout(resolvePracticeAttackAfterDrives, 0);
    if (online.role === "host" && !online.applyingRemote) sendOnlineSnapshot();
  }
  function effectiveShieldValue(instance,side,zone="guardian"){if(!instance)return 0;const base=Number(cardMap.get(instance.cardId)?.shield||0),player=match?.players?.[side],opponent=match?.players?.[flipSide(side)],opponentGrade=gradeOf(cardMap.get(opponent?.vanguard?.cardId)),controllerGrade=gradeOf(cardMap.get(player?.vanguard?.cardId)),abilities=cardAbilities(cardMap.get(instance.cardId));const battleBonus=match?.pendingAttack?.defenderSide===side&&instance.battleShieldExpiryBattleId===match.pendingAttack.battleId?Number(instance.battleShieldBoost||0):0;return base+window.VanguardAbilityEngine.evaluateContinuousShieldEffects(abilities,{location:zone==="guardian"?"guardian":zone,opponentVanguardGrade:opponentGrade,opponentGZoneCardCount:(opponent?.gZone||[]).length,opponentFaceUpGZoneCardCount:(opponent?.gZone||[]).filter(card=>card?.faceUp===true).length,controllerVanguardGrade:controllerGrade,controllerVanguardCardNames:window.VanguardAbilityEngine.getCardNames(cardMap.get(player?.vanguard?.cardId)),controllerDamageCount:(player?.damage||[]).length,generationBreakCount:generationBreakCount(side),opponentTriggerRevealedThisTurn:player?.opponentTriggerRevealedThisTurn===true}).shield+battleBonus}
  function continuousPowerBonus(instance,side,zone,attackContext={}){const player=match?.players?.[side];if(!instance||!player)return 0;const soulCardNames=(player.soul||[]).flatMap(card=>window.VanguardAbilityEngine.getCardNames(cardMap.get(card.cardId))),opponentVanguardGrade=gradeOf(cardMap.get(match.players[flipSide(side)]?.vanguard?.cardId)),controllerVanguardGrade=gradeOf(cardMap.get(player.vanguard?.cardId)),controllerVanguardCardNames=window.VanguardAbilityEngine.getCardNames(cardMap.get(player.vanguard?.cardId)),attack=match.pendingAttack,attackingVanguard=attackContext.attackTargetZone==="vanguard"||(attack?.attackerUid===instance.uid&&attack.targetZone==="vanguard"),controllerFieldCards=[...(player.vanguard?[player.vanguard]:[]),...(player.rear||[])].filter(Boolean).map(card=>{const definition=cardMap.get(card.cardId);return{uid:card.uid,zone:card.uid===player.vanguard?.uid?"vanguard":"rear-guard",names:window.VanguardAbilityEngine.getCardNames(definition),clans:[definition?.clan,...(definition?.clans||[])].filter(Boolean)}}),orderCount=match.side===side?Number(match.ordersPlayedThisTurn||0):Number(player.ordersPlayedThisTurn||0),common={sourceAttackedThisBattle:attack?.attackerUid===instance.uid,controllerDamageCards:(player.damage||[]).filter(card=>card&&typeof card.uid==="string").map(card=>({uid:card.uid,faceDown:card.faceDown===true,names:window.VanguardAbilityEngine.getCardNames(cardMap.get(card.cardId),{location:"damage"})})),soulCardNames,controllerFieldCards,dragontreeMarkerCount:(player.giftZones||[]).filter(marker=>marker?.type==="Dragontree"&&/^(?:rear-|accel-)/.test(String(marker.zone||""))).length,isControllerTurn:match.side===side,opponentVanguardGrade,opponentGZoneCardCount:(match.players[flipSide(side)]?.gZone||[]).length,opponentFaceUpGZoneCardCount:(match.players[flipSide(side)]?.gZone||[]).filter(card=>card?.faceUp===true).length,controllerVanguardGrade,controllerVanguardCardNames,normalOrderPlayedThisTurn:match.side===side&&orderCount>0,orderPlayedThisTurn:match.side===side&&orderCount>0,sourceWasBooster:Boolean((attackContext.boosterCardInstanceId===instance.uid&&attackContext.boostedUnitInstanceId&&findFieldCard(attackContext.boostedUnitInstanceId))||attack?.boostUid===instance.uid),controllerDamageCount:(player.damage||[]).length,opponentTriggerRevealedThisTurn:player.opponentTriggerRevealedThisTurn===true,attackingVanguard};const instanceLocation=zone==="vanguard"?"vanguard":zone?"rear-guard":null;let total=window.VanguardAbilityEngine.evaluateContinuousEffects(cardAbilities(cardMap.get(instance.cardId)),{...common,location:instanceLocation,sourceInstanceId:instance.uid,targetInstanceId:instance.uid}).power;const targetHasNoAbilities=cardAbilities(cardMap.get(instance.cardId)).length===0;if(!targetHasNoAbilities)return total;const sources=[...(player.vanguard?[{instance:player.vanguard,location:"vanguard",faceUp:true}]:[]),...(player.rear||[]).map(card=>card?{instance:card,location:/^accel-/.test(card.zone||"")?"rear-guard":"rear-guard",faceUp:true}:null).filter(Boolean),...(player.gZone||[]).filter(card=>card?.faceUp===true).map(instance=>({instance,location:"g-zone",faceUp:true}))];for(const source of sources){const sourceAbilities=cardAbilities(cardMap.get(source.instance.cardId));if(!sourceAbilities.length)continue;total+=window.VanguardAbilityEngine.evaluateContinuousEffects(sourceAbilities,{...common,sourceLocation:source.location,sourceFaceUp:source.faceUp,targetHasNoAbilities:true,sourceInstanceId:source.instance.uid,targetInstanceId:instance.uid}).power}return total}
  function renderZone(side, zone, instance) {
    const el = $(`.field-zone[data-side="${side}"][data-zone="${zone}"]`); if (!el) return;
    el.innerHTML = `<span>${zone === "vanguard" ? "VANGUARD" : zone.startsWith("accel-") ? `ACCEL ${zone.slice(6)}` : "REAR-GUARD"}</span>`;
    const markers = (match.players[side].giftZones || []).filter((gift) => gift.zone === zone);
    if (markers.length) { const marker = document.createElement("b"); marker.className = "gift-zone-marker"; marker.textContent = markers.map((gift) => gift.type).join(" · "); el.appendChild(marker); } if (zone.startsWith("accel-")) { const marker = document.createElement("b"); marker.className = "gift-zone-marker accel-marker"; marker.textContent = match.players[side].accelTypes?.[Number(zone.slice(6)) - 1] || "Accel I"; el.appendChild(marker); }
    if (!instance) return;
    const c = cardMap.get(instance.cardId); if (!c) return;
    const continuousPower = continuousPowerBonus(instance,side,zone), turnPower = Number(instance.turnPowerBoost || 0), turnCrit = Number(instance.turnCriticalBoost || 0);
    const attackBoost = match.pendingAttack?.attackerUid === instance.uid ? Number(match.pendingAttack.boostPower || 0) : match.pendingAttackSetup?.attackerUid === instance.uid ? Number(match.pendingAttackSetup.boostPower || 0) : 0;
    const accelIndex = zone.startsWith("accel-") ? Number(zone.slice(6)) - 1 : -1; const accelType = accelIndex >= 0 ? (match.players[side].accelTypes?.[accelIndex] || "Accel I") : ""; const accelPower = match.side === side && accelType ? (/II/i.test(accelType) ? 5000 : 10000) : 0; const forcePower = match.side === side ? markers.filter((gift) => /^Force I$/i.test(gift.type || "")).length * 10000 : 0;
    const effectLabels = [];
    if (turnPower) effectLabels.push(`${turnPower > 0 ? "+" : ""}${Math.round(turnPower / 1000)}k TURN`); if (continuousPower) effectLabels.push(`+${Math.round(continuousPower / 1000)}k CONT`);
    if (turnCrit) effectLabels.push(`+${turnCrit} CRIT`);
    if (attackBoost) effectLabels.push(`+${Math.round(attackBoost / 1000)}k BOOST · THIS ATTACK`);
    if (forcePower) effectLabels.push(`+${Math.round(forcePower / 1000)}k FORCE I`); if (accelPower) effectLabels.push(`+${Math.round(accelPower / 1000)}k ACCEL ${/II/i.test(accelType) ? "II" : "I"} · YOUR TURN`);
    const heartPower = Number(cardMap.get(instance.strideHeart?.cardId)?.power || 0) + Number(instance.strideHeart?.powerBoost || 0) + Number(instance.strideHeart?.turnPowerBoost || 0);
    const calculatedPower = Number(c.power || 0) + heartPower + Number(instance.powerBoost || 0) + turnPower + continuousPower + forcePower + accelPower + attackBoost;
    const guardPower = match.pendingAttack?.targetUid === instance.uid ? Math.max(0, Number(match.pendingAttack.targetPower || 0) - calculatedPower) : 0;
    const effectivePower = calculatedPower + guardPower;
    const effectivePowerLabel = c.power === null || c.power === undefined ? "Unknown" : effectivePower.toLocaleString();
    const printedCritical = Math.max(1, Number(c.critical || 1)); const forceCrit = markers.filter((gift) => /^Force II$/i.test(gift.type || "")).length;
    const effectiveCrit = Math.max(1, printedCritical + turnCrit + forceCrit);
    if (forceCrit) effectLabels.push(`+${forceCrit} CRITICAL · FORCE II`);
    const effectTag = effectLabels.length ? `<span class="turn-effect-badge">${escapeHtml(effectLabels.join(" · "))}</span>` : "";
    const shieldLabel = c.shield === null || c.shield === undefined ? "Unknown" : Number(c.shield) > 0 ? Number(c.shield).toLocaleString() : "—";
    const field = document.createElement("div"); field.className = `field-card${match.selected === instance.uid ? " selected" : ""}${instance.rested ? " rested" : ""}${instance.locked ? " locked" : ""}`; field.dataset.fieldUid = instance.uid; field.dataset.cardId = c.id; field.dataset.side = side; field.dataset.zone = zone; field.style.borderColor = `${c.color}88`; const powerBreakdown = [`base ${Number(c.power || 0).toLocaleString()}`, heartPower ? `+${heartPower.toLocaleString()} heart` : "", Number(instance.powerBoost || 0) ? `+${Number(instance.powerBoost).toLocaleString()} persistent` : "", turnPower ? `${turnPower > 0 ? "+" : ""}${turnPower.toLocaleString()} temporary until end of turn` : "", continuousPower ? `+${continuousPower.toLocaleString()} continuous ability` : "", forcePower ? `+${forcePower.toLocaleString()} Force I for this turn` : "", guardPower ? `+${guardPower.toLocaleString()} guard shield for this attack` : ""].filter(Boolean).join(" · "); field.title = `${c.name}${heartPower ? ` · Heart: ${cardMap.get(instance.strideHeart.cardId)?.name || "Grade 3"}` : ""}\nPower: ${effectivePowerLabel}${effectiveCrit > 1 ? ` · ${effectiveCrit} critical` : ""} · Printed ${c.power === null || c.power === undefined ? "unknown" : Number(c.power).toLocaleString()} power · ${c.trigger || "No trigger"}\nShield: ${shieldLabel}\n${powerBreakdown}`; field.innerHTML = `${c.image ? `<img class="field-card-art" src="${escapeHtml(c.image)}" alt="" onerror="this.remove()">` : ""}<button class="card-zoom field-card-zoom" type="button" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}" title="Zoom card">⤢</button><span class="mini-grade">${instance.locked ? "LOCKED" : `G${c.grade === null || c.grade === undefined ? "?" : c.grade}`}</span>${effectTag}${guardPower ? `<span class="turn-effect-badge">+${guardPower.toLocaleString()} GUARD</span>` : ""}<span class="field-card-name">${escapeHtml(c.name)}</span><span class="field-card-stats"><b>${effectivePowerLabel}</b><span>${effectiveCrit} CRIT</span><small>SHIELD ${shieldLabel}</small></span>`;
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
    return (orders || []).map((instance) => { const c = cardMap.get(instance.cardId); if (!c) return ""; const faceDown=instance.faceDown===true,hidden=faceDown&&side!=="human",label=hidden?"Face-down Order":`${c.name}${instance.rested?" · RESTED":""}${faceDown?" · FACE-DOWN":""}`; return `<span class="zone-card-wrap${instance.rested?" order-rested":""}"><button class="zone-card${instance.rested?" order-rested":""}" type="button" ${side==="human"?`data-order-uid="${escapeHtml(instance.uid)}"`:`${hidden?"":"data-card-zoom=\""+escapeHtml(c.id)+"\""}`} data-side="${side}" title="${hidden?"Face-down Order":escapeHtml(c.name)+(instance.rested?" · Rested":"")+(faceDown?" · Face down":"")}">${escapeHtml(label)}</button>${side==="human"&&!hidden?`<button class="zone-zoom" type="button" data-card-zoom="${escapeHtml(c.id)}" aria-label="Zoom ${escapeHtml(c.name)}">⤢</button>`:""}</span>`; }).join("") || `<span class="zone-empty">No orders</span>`;
  }
  function canGAssist(player) { const grade = gradeOf(cardMap.get(player?.vanguard?.cardId)); return grade >= 0 && grade < 3 && !player.hand.some((item) => isUnitCard(cardMap.get(item.cardId)) && Number(cardMap.get(item.cardId)?.grade) === grade + 1) && player.deck.length > 0; }
  function renderGAssistDialog() {
    const state = match?.pendingGAssist;
    if (!state || state.ownerSide !== "human") { if ($("#g-assist-dialog").open) $("#g-assist-dialog").close(); return; }
    const player = match.players.human, choosing = state.stage === "choose";
    $("#g-assist-title").textContent = choosing ? "Look at the top five cards" : "Remove two cards from hand";
    $("#g-assist-help").textContent = choosing ? "Choose a Unit exactly one grade above your Vanguard to add to hand, or take none. The rest will be shuffled into your deck." : `You added ${cardMap.get(state.addedCardId)?.name || "a Unit"}. Choose two cards in your hand to remove from the game (${state.discardUids.length}/2).`;
    if (choosing) {
      const grade = gradeOf(cardMap.get(player.vanguard?.cardId)) + 1;
      $("#g-assist-content").innerHTML = state.cards.map((item) => { const card=cardMap.get(item.cardId), eligible=isUnitCard(card)&&Number(card?.grade)===grade; return card ? `<button class="zone-view-card${eligible?"":" disabled"}" type="button" data-gassist-choose="${escapeHtml(item.uid)}" ${eligible?"":"disabled"}>${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${eligible?"Eligible · add to hand":"Not the required grade"}</small></button>` : ""; }).join("") || "<p class=\"zone-empty-message\">No cards to look at.</p>";
      $("#g-assist-none").hidden=false; $("#g-assist-finish").hidden=true;
    } else {
      $("#g-assist-content").innerHTML = player.hand.map((item) => { const card=cardMap.get(item.cardId), selected=state.discardUids.includes(item.uid); return card ? `<button class="zone-view-card${selected?" selected":""}" type="button" data-gassist-discard="${escapeHtml(item.uid)}" aria-pressed="${selected}">${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${selected?"Remove from game":"Choose to remove"}</small></button>` : ""; }).join("");
      $("#g-assist-none").hidden=true; $("#g-assist-finish").hidden=false; $("#g-assist-finish").disabled=state.discardUids.length!==2;
    }
    if (!$("#g-assist-dialog").open) $("#g-assist-dialog").showModal();
  }  function renderGZone(player, canFlip = false) {
    if (player.format === "standard") return (player.rideDeck || []).map((instance) => { const card = cardMap.get(instance.cardId); return card ? `<button class="zone-card ride-deck-card" type="button" data-ride-deck-open="1" title="Grade ${escapeHtml(card.grade)} · available during Ride phase">G${escapeHtml(card.grade)} · ${escapeHtml(card.name)}</button>` : ""; }).join("") || '<span class="zone-empty">Ride Deck is empty</span>';
    const faceUp = (player.gZone || []).map((instance) => { const c = cardMap.get(instance.cardId); if (!c) return ""; return instance.faceUp ? `<button class="zone-card" data-card-zoom="${escapeHtml(c.id)}" title="Zoom ${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>` : canFlip ? `<button class="zone-card" type="button" data-gzone-flip-up="${escapeHtml(instance.uid)}" title="Flip this G-zone card face up">Face-down G card · Flip face up</button>` : `<span class="zone-card" aria-label="Face-down G-zone card">Face-down G card</span>`; }).join("");
    const deck = player.gDeck || [], faceDownCount = deck.filter((item) => !item.faceUp).length, faceUpCount = deck.filter((item) => item.faceUp).length;
    return `${faceUp}<span class="zone-empty">${faceDownCount} face down · ${faceUpCount} face up in G deck</span>`;
  }
  function renderRideDeckFlow() {
    const state = match?.pendingRide;
    if (!state || state.ownerSide !== "human" || match.players.human.format !== "standard" || online.role === "watcher") { if ($("#ride-deck-dialog")?.open) $("#ride-deck-dialog").close(); if ($("#ride-deck-cost-dialog")?.open) $("#ride-deck-cost-dialog").close(); return; }
    const player = match.players.human, currentGrade = Number(cardMap.get(player.vanguard?.cardId)?.grade ?? -1);
    if (state.stage === "choose") {
      const eligible = (player.rideDeck || []).filter(item => { const grade = Number(cardMap.get(item.cardId)?.grade); return Number.isInteger(grade) && grade >= currentGrade && grade <= currentGrade + 1; });
      $("#ride-deck-dialog-help").textContent = `Current Vanguard grade ${currentGrade}. Choose a same-grade or one-grade-higher unit.`;
      $("#ride-deck-card-list").innerHTML = eligible.map(item => { const card = cardMap.get(item.cardId); return card ? `<button class="zone-view-card${item.uid === state.unitUid ? " selected" : ""}" type="button" data-ride-deck-select="${escapeHtml(item.uid)}">${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>Grade ${escapeHtml(card.grade)}${item.uid === state.unitUid ? " · selected" : " · select"}</small></button>` : ""; }).join("") || '<p class="zone-empty-message">No eligible units remain in your Ride Deck.</p>';
      $("#ride-deck-begin").disabled = !eligible.some(item => item.uid === state.unitUid); if (!$("#ride-deck-dialog").open) $("#ride-deck-dialog").showModal();
      if ($("#ride-deck-cost-dialog").open) $("#ride-deck-cost-dialog").close(); return;
    }
    const rider = player.rideDeck.find(item => item.uid === state.unitUid), riderCard = cardMap.get(rider?.cardId); if (!riderCard) { match.pendingRide = null; return; }
    $("#ride-deck-cost-title").textContent = `Discard to ride ${riderCard.name}`;
    $("#ride-deck-cost-cards").innerHTML = player.hand.map(item => { const card = cardMap.get(item.cardId); return card ? `<button class="zone-view-card${state.costUid === item.uid ? " selected" : ""}" type="button" data-ride-deck-cost="${escapeHtml(item.uid)}">${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${state.costUid === item.uid ? "Selected · discard" : "Choose as cost"}</small></button>` : ""; }).join("") || '<p class="zone-empty-message">You need a card in hand to pay the ride cost.</p>';
    $("#ride-deck-cost-confirm").disabled = !state.costUid || !player.hand.some(item => item.uid === state.costUid); if ($("#ride-deck-dialog").open) $("#ride-deck-dialog").close(); if (!$("#ride-deck-cost-dialog").open) $("#ride-deck-cost-dialog").showModal();
  }
  function renderGuardCircle(player) { const side=player===match?.players?.human?"human":"bot"; return (player.guardCircle || []).map((instance) => { const c = cardMap.get(instance.cardId); return c ? `<span class="zone-card guard-card" title="${escapeHtml(c.name)} · ${effectiveShieldValue(instance,side).toLocaleString()} shield">${escapeHtml(c.name)}</span>` : ""; }).join("") || '<span class="zone-empty">Empty</span>'; }
  function renderCrests(crests = []) {
    return (crests || []).map((item) => {
      const card = cardMap.get(item.cardId);
      return card ? `<button class="zone-card crest-card" type="button" data-card-zoom="${escapeHtml(card.id)}" title="${escapeHtml(card.name)} · Crest">${cardImage(card, "crest-card-art")}<span>${escapeHtml(card.name)}</span></button>` : "";
    }).join("") || '<span class="zone-empty">No Crest</span>';
  }
  function openOrdersDialog(side="human") {
    if(!match)return;
    const player=match.players[side],orders=player?.orders||[],isOwner=side==="human"&&online.role!=="watcher";
    $("#order-zone-dialog-title").textContent=isOwner?"Your Order zone":`${player?.name||"Opponent"} · Order zone`;
    $("#order-zone-dialog-help").textContent=isOwner?"Select any Order to rest or stand it, flip it face down or face up, add it to your hand, or send it to Drop.":"Opponent Orders are shown face up; face-down Orders remain hidden.";
    $("#order-zone-card-list").innerHTML=orders.length?orders.map(item=>{const card=cardMap.get(item.cardId),hidden=item.faceDown===true&&!isOwner;if(!card)return"";return `<article class="zone-view-card">${hidden?'<div class="zone-card-face order-hidden-card"><span>V</span><b>Face-down Order</b></div>':`<button class="zone-card-face" type="button" ${isOwner?`data-order-view-uid="${escapeHtml(item.uid)}"`:`data-card-zoom="${escapeHtml(card.id)}"`}>${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${item.rested?"Rested · ":""}${item.faceDown?"Face down":"Face up"}</small></button>`}${!hidden?`<button class="zone-card-zoom" type="button" data-card-zoom="${escapeHtml(card.id)}" aria-label="Zoom ${escapeHtml(card.name)}">⤢</button>`:""}</article>`}).join(""):'<p class="zone-empty-message">No Orders are in this zone yet. Play an Order from your hand to place it here.</p>';
    if(!$("#order-zone-dialog").open)$("#order-zone-dialog").showModal();
  }
  function showOrderMenu(uid) {
    const item = match?.players.human.orders?.find(card => card.uid === uid), card = item && cardMap.get(item.cardId);
    if (!item || !card) return;
    match.selected = uid;
    $("#context-menu-title").textContent = card.name;
    $("#context-menu-help").textContent = "Order zone card actions.";
    const actions = [[`order-rest:${uid}`, item.rested?"Stand":"Rest"], [`order-flip:${uid}`, item.faceDown?"Turn face up":"Turn face down"], [`order-to-hand:${uid}`, "Add to hand"], [`order-to-soul:${uid}`, "Add to Soul"], [`order-to-top:${uid}`, "Return to deck top"], [`order-to-bottom:${uid}`, "Return to deck bottom"], [`order-to-drop:${uid}`, "Send to Drop"]];
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
      else { actions.push(["place:vanguard", "Ride"]); if (isUnitCard(card) && window.VanguardAbilityEngine.canCallCard(card,{dragontreeMarkerCount:(match?.players?.human?.giftZones||[]).filter(marker=>marker?.type==="Dragontree"&&/^(?:rear-|accel-)/.test(String(marker.zone||""))).length})) actions.push(["call-to-circle", "Call"]); if (isUnitCard(card)) actions.push([`superior-ride:hand:${match.selected}`, "Superior Ride"]); actions.push(["selected-to-soul", "Put into Soul"]); }
      actions.push(["selected-to-drop", "Move to Drop"], ["bind", "Move to Bind"], ["hand-to-order", "Move to Order zone"], ["public-reveal", "Reveal to opponent"], ["hand-to-top", "Return to deck top"], ["hand-to-bottom", "Return to deck bottom"], ["hand-to-damage", "Move to Damage"]);
    } else if (field?.side === "human") {
      actions.push(["add-critical", "Add +1 critical this turn"]);
      if (isUnitCard(card) && field.zone !== "vanguard") actions.push([`superior-ride:field:${field.instance.uid}`, "Superior Ride"]);
      if (field.zone === "vanguard") {
        if (match.phase === 5 && !match.pendingAttack) actions.push(["attack", "Attack"]);
        actions.push(["view-selected-soul", "View Soul"], ["rest-selected", field.instance.rested ? "Stand" : "Rest"], ["selected-to-soul", "Put into Soul"], ["alter-power", "Alter power"]);
      } else {
        if (match.phase === 5 && !match.pendingAttack) actions.push(["attack", "Attack"]);
        actions.push(["rest-selected", field.instance.rested ? "Stand" : "Rest"], ["move-select", "Move / Swap Rear-Guard"], ["selected-to-hand", "Return to hand"], ["selected-to-soul", "Put into Soul"], ["selected-to-top", "Return to deck top"], ["selected-to-bottom", "Return to deck bottom"], ["selected-to-drop", "Move to Drop"], ["bind", "Move to Bind"], ["alter-power", "Alter power"]);
      }
    }
    if(field?.side==="human"&&eligibleActivatedAbilities(field).length)actions.push(["open-skills","Activate skill"]);
    $("#context-menu-title").textContent = card.name;
    $("#context-menu-help").textContent = hand ? "Choose what to do with this card." : field?.zone === "vanguard" ? "Vanguard actions" : "Field card actions";
    $("#context-menu-actions").innerHTML = actions.map(([action, label]) => `<button class="button" type="button" data-context-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`).join("");
    if (!$("#context-menu-dialog").open) $("#context-menu-dialog").showModal();
  }
  function updateActionAvailability() {
    if (!match) return;
    const canAct = !match.ended && online.role !== "watcher" && !match.practiceOpeningChoicePending;
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
    const nextPhase = match.players.human.format === "standard" && match.phase === 2 ? 4 : match.phase + 1;
    $("#advance-phase").innerHTML = match.phase === phases.length - 1 ? `End turn <span>→</span>` : `Continue ${phases[nextPhase].toLowerCase()} phase <span>→</span>`;
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
      finishAttackButton.hidden = !attack || attack.attackerSide !== "human" || attack.finishing || Boolean(match.pendingBattleEnd || match.pendingHitResolution || (match.pendingDamageQueue || []).length);
      finishAttackButton.disabled = !canAct || !attack?.defenderDone || Number(attack?.driveChecksRemaining || 0) > 0;
    }
    if (online.role === "watcher") $$(".action-buttons button").forEach((button) => { button.disabled = true; });
  }
  function findFieldCard(uid) {
    const located=window.VanguardAbilityEngine.locateCardInstance(match,uid);if(!located||located.ambiguous||!located.circle||!located.side)return null;
    return{side:located.side,zone:located.circle,index:located.index,instance:located.instance};
  }
  function cardAbilities(card) {
    return window.VanguardAbilityEngine.parseCardAbilities(card);
  }
  function abilityCostCount(ability,type,costOverride=null){return (costOverride||ability?.costs||[]).filter(cost=>cost.type===type).reduce((sum,cost)=>sum+Number(cost.count||0),0)}
  function abilityDiscardCards(side,source,ability){const costs=(ability?.costs||[]).filter(cost=>cost.type==="discard"),filtered=costs.filter(cost=>cost.filter);if(filtered.length&&(filtered.length!==costs.length||filtered.some(cost=>JSON.stringify(cost.filter)!==JSON.stringify(filtered[0].filter))))return[];const filter=filtered[0]?.filter,player=match.players[side];return(player?.hand||[]).filter(card=>card.uid!==source?.instance?.uid&&(!filter||window.VanguardAbilityEngine.matchesTargetFilter(filter,{targetCard:cardMap.get(card.cardId)})))}
  function generationBreakCount(side){const p=match?.players?.[side];return window.VanguardAbilityEngine.countGenerationBreakUnits(p,instance=>isGDeckCard(cardMap.get(instance?.cardId)))}
  function abilityZoneAllowed(a,f){if(a.requiredCircle?.length&&!a.requiredCircle.includes(f.zone))return false;const sourceZone=f.zone==="g-deck"?"g-zone":f.zone==="guardian"?"guardian":String(f.zone||"").startsWith("rear-")||String(f.zone||"").startsWith("accel-")?"rear-guard":f.zone;if(a.requiredLocation?.length&&!a.requiredLocation.includes(sourceZone))return false;if(sourceZone==="g-zone"&&(f.instance.faceUp!==false||(f.zone==="g-deck"&&f.instance.gDeckCard!==true)))return false;const tokens=[...a.raw.toUpperCase().matchAll(/\[(VC\/RC|VC|RC|GC|SC|G ZONE|DROP|SOUL|HAND|BIND|DAMAGE(?: ZONE)?)\]|\((VC\/RC|VC|RC|GC|SC|G ZONE|DROP|SOUL|HAND|BIND|DAMAGE(?: ZONE)?)\)/g)].map(m=>m[1]||m[2]);if(!tokens.length)return true;const zone=f.zone==="vanguard"?"VC":f.zone==="guardian"?"GC":f.zone==="soul"?"SOUL":f.zone==="drop"?"DROP":f.zone==="damage"?"DAMAGE ZONE":f.zone==="hand"?"HAND":f.zone==="bind"?"BIND":sourceZone==="g-zone"?"G ZONE":"RC";return tokens.some(token=>token==="VC/RC"?zone==="VC"||zone==="RC":token===zone)}
  function abilityConditionContext(side,source,eventContext={}){const player=match?.players?.[side];if(!player)return{};const opponent=match.players[flipSide(side)],vanguard=cardMap.get(player.vanguard?.cardId);return{rodeGradeThreePlusThisFight:player.rodeGradeThreePlusThisFight===true,controllerVanguardGrade:gradeOf(vanguard),controllerVanguardCardNames:window.VanguardAbilityEngine.getCardNames(vanguard,{location:"vanguard"}),controllerVanguardIsBlazing:Boolean(player.vanguard?.blazing),controllerWentSecond:side!==match.firstSide,damageCount:(player.damage||[]).length,vanguardLimitBreakActive:(player.damage||[]).length>=4||(source.zone==="vanguard"&&(player.rear||[]).some(instance=>instance&&window.VanguardAbilityEngine.hasAbilityKeyword(cardMap.get(instance.cardId),"vanguard-limit-break-4-active-at-three-or-less"))),isControllerTurn:match.side===side,isOpponentTurn:match.side!==side,controllerRearGuards:(player.rear||[]).filter(Boolean).length,opponentRearGuards:(opponent?.rear||[]).filter(Boolean).length,controllerFieldCards:[...(player.vanguard?[player.vanguard]:[]),...(player.rear||[]).filter(Boolean)].map(instance=>({uid:instance.uid,zone:instance.uid===player.vanguard?.uid?"vanguard":"rear-guard",names:window.VanguardAbilityEngine.getCardNames(cardMap.get(instance.cardId),{location:instance.uid===player.vanguard?.uid?"vanguard":"rear-guard"}),clan:cardMap.get(instance.cardId)?.clan,clans:cardMap.get(instance.cardId)?.clans||[],allClansAndNations:window.VanguardAbilityEngine.hasAbilityKeyword(instance.cardId,"all-clans-and-nations"),hasLimitBreak4:instance.hasLimitBreak4===true})),controllerRearGuardClans:(player.rear||[]).filter(Boolean).map(instance=>({uid:instance.uid,clans:(cardMap.get(instance.cardId)?.clans||[]).length?cardMap.get(instance.cardId).clans:cardMap.get(instance.cardId)?.clan?[cardMap.get(instance.cardId).clan]:[]})),turnSide:match.side,opponentVanguardGrade:gradeOf(cardMap.get(opponent?.vanguard?.cardId)),controllerHandCount:(player.hand||[]).length,controllerDropCount:(player.drop||[]).length,sourceEverLegioned:source.instance.everLegioned===true,sourceInLegion:Boolean(source.instance.legionMate||source.instance.legionMateInstanceId),controllerSoulCardNames:(player.soul||[]).flatMap(instance=>window.VanguardAbilityEngine.getCardNames(cardMap.get(instance.cardId))),controllerSoulCount:(player.soul||[]).length,controllerDamageCount:(player.damage||[]).length,opponentDamageCount:(opponent?.damage||[]).length,controllerBackRowRearGuards:(player.rear||[]).slice(2,5).filter(Boolean).length,controllerBackRowGradeRearGuards:(player.rear||[]).slice(2,5).filter(Boolean).reduce((counts,instance)=>{const grade=gradeOf(cardMap.get(instance.cardId));if(grade<=1)counts[grade]=(counts[grade]||0)+1;return counts;},{}),allOrderZonesCount:(match.players.human.orders||[]).length+(match.players.bot.orders||[]).length,anyFieldCardIsLocked:["human","bot"].some(fieldSide=>fieldUnits(fieldSide).some(field=>field.instance.locked===true)),opponentHandCount:(opponent?.hand||[]).length,attackTargetGrade:Number(cardMap.get(findMatchInstance(match.pendingAttack?.targetUid)?.cardId)?.grade??-1),controllerVanguardIsAttackedUnit:eventContext.event==="place"&&eventContext.targetZone==="vanguard"&&eventContext.targetUid===player.vanguard?.uid,controllerCenterColumnRearGuard:Boolean(player.rear?.[3]),vanguardName:vanguard?.name,vanguardNames:window.VanguardAbilityEngine.getCardNames(vanguard),vanguardClan:vanguard?.clan,vanguardClans:vanguard?.clans,vanguardText:vanguard?.text,sourceInstanceId:source.instance.uid,sourceFaceUp:source.instance.faceUp!==false,sourceHollowed:source.instance.hollowed===true,sourceInHarmony:window.VanguardAbilityEngine.isCardInHarmony(match,source.instance.uid,`${match.turn}:${match.side}`),boosterInstanceId:eventContext.boostUid,boostedInstanceId:eventContext.boostedUid,eventSubjectInstanceId:eventContext.subjectUid,eventTargetLocation:eventContext.targetZone==="vanguard"?"vanguard":eventContext.targetZone==="rear-guard"?"rear-guard":null,eventPreviousLocation:eventContext.gameEvent?.previousLocation||eventContext.sourceZone||null,generationBreakCount:generationBreakCount(side),opponentAttackingUnitAttackCount:Number(eventContext.gameEvent?.attackingUnitAttackCount??eventContext.attackingUnitAttackCount??0)}}
  function hasEnergyGenerator(player){return (player?.crests||[]).some(instance=>/energy generator/i.test(String(cardMap.get(instance.cardId)?.name||instance.crestName||instance.cardName||"")))}
  function chargeEnergyAtRidePhase(player){if(!player)return 0;player.energy=Math.min(10,Math.max(0,Number(player.energy)||0)+(hasEnergyGenerator(player)?3:0));player.energySpentThisTurn=0;return player.energy}
  function abilityRequirementsMet(a,side,source,eventContext={}){const player=match?.players?.[side],abilityController=a.kind==="AUTO"&&eventContext.eventId?eventContext.triggerControllerPlayerId||source.instance.controllerPlayerId:source.instance.controllerPlayerId;if(!player||abilityController&&abilityController!==player.playerId)return false;if(a.definition?.source?.patternId==="auto-g-guardian-named-call-discard-grade-one-draw-v1"&&!abilityDiscardCards(side,source,a).length)return false;if(a.kind!=="AUTO"&&!window.VanguardAbilityEngine.canPayAbilityCosts(a,{energy:Number(player.energy)||0,hasEnergyGenerator:hasEnergyGenerator(player),faceUpDamage:(player.damage||[]).filter(card=>!card.faceDown).length,faceUpDamageCards:(player.damage||[]).filter(card=>!card.faceDown),cardDefinitionForInstance:card=>cardMap.get(card.cardId),soulCount:(player.soul||[]).length,discardableHand:(player.hand||[]).filter(card=>card.uid!==source.instance.uid).length,sourceCanDiscard:(player.hand||[]).some(card=>card.uid===source.instance.uid),revealableGradeThreeHand:(player.hand||[]).filter(card=>gradeOf(cardMap.get(card.cardId))===3).length,sourceRested:Boolean(source.instance.rested),sourceCanMoveToSoul:Boolean(findFieldCard(source.instance.uid)?.side===side),sourceCanRetire:Boolean(findFieldCard(source.instance.uid)?.side===side&&findFieldCard(source.instance.uid)?.zone!=="vanguard")}))return false;if(a.kind!=="AUTO"&&!window.VanguardAbilityEngine.canPayAbilityCosts(a,{energy:Number(player.energy)||0,hasEnergyGenerator:hasEnergyGenerator(player),faceUpDamage:(player.damage||[]).filter(card=>!card.faceDown).length,faceUpDamageCards:(player.damage||[]).filter(card=>!card.faceDown),cardDefinitionForInstance:card=>cardMap.get(card.cardId),soulCount:(player.soul||[]).length,discardableHand:(player.hand||[]).filter(card=>card.uid!==source.instance.uid).length,sourceCanDiscard:(player.hand||[]).some(card=>card.uid===source.instance.uid),revealableGradeThreeHand:(player.hand||[]).filter(card=>gradeOf(cardMap.get(card.cardId))===3).length,sourceRested:Boolean(source.instance.rested),sourceCanMoveToSoul:Boolean(findFieldCard(source.instance.uid)?.side===side),sourceCanRetire:Boolean(findFieldCard(source.instance.uid)?.side===side&&findFieldCard(source.instance.uid)?.zone!=="vanguard")}))return false;const opponent=match.players[flipSide(side)],vanguard=cardMap.get(player.vanguard?.cardId);if(!window.VanguardAbilityEngine.evaluateAbilityConditions(a,abilityConditionContext(side,source,eventContext)))return false;if((a.once||a.usageRestriction)&&abilityUsed(side,source.instance.uid,a))return false;if(!abilityZoneAllowed(a,source)||generationBreakCount(side)<a.gb)return false;const raw=a.raw,cb=Number(raw.match(/Counter[- ]Blast\s*\(?\s*(\d+)/i)?.[1]||0),sb=Number(raw.match(/Soul[- ]Blast\s*\(?\s*(\d+)/i)?.[1]||0),discard=abilityCostCount(a,"discard");if(a.kind!=="AUTO"&&((player.damage||[]).filter(card=>!card.faceDown).length<cb||(player.soul||[]).length<sb||abilityDiscardCards(side,source,a).length<discard))return false;if(/put\s+(?:two|2)\s+rear-guards?\s+into your soul/i.test(raw)&&fieldUnits(side).filter(field=>field.zone!=="vanguard").length<2)return false;if(/\bforerunner\b/i.test(raw)&&!(player.rear||[]).some(card=>!card))return false;if(/if your opponent has no rear-guards/i.test(raw)&&match.players[flipSide(side)].rear.some(Boolean))return false;if(/if you have no rear-guards/i.test(raw)&&player.rear.some(Boolean))return false;const namedVanguard=raw.match(/if you have (?:an? )?(?:vanguard|[<"“])?\s*[<"“]?([^>"”]+)[>"”]? vanguard/i)?.[1];if(namedVanguard){const vg=cardMap.get(player.vanguard?.cardId);if(!window.VanguardAbilityEngine.cardHasName(vg,namedVanguard.trim(),{contains:true,location:"vanguard"})&&!String(vg?.text||"").toLowerCase().includes(namedVanguard.trim().toLowerCase()))return false}const clan=raw.match(/if you have an? [<«]([^>»]+)[>»] vanguard/i)?.[1];if(clan){const vg=cardMap.get(player.vanguard?.cardId);if(!String(vg?.text||"").toLowerCase().includes(clan.toLowerCase())&&!String(vg?.clan||"").toLowerCase().includes(clan.toLowerCase())&&!(vg?.clans||[]).some(value=>String(value).toLowerCase()===clan.toLowerCase()))return false}if(/\b(?:this (?:unit|card)|it|your vanguard)\b[^.\n]{0,80}\b(?:was|is) boosted\b|\bif[^.\n]{0,80}\b(?:this (?:unit|card)|it)\b[^.\n]{0,40}\bboosted\b/i.test(raw)&&["attack","hit"].includes(eventContext.event)&&(source.instance.uid!==eventContext.subjectUid||!eventContext.boostUid))return false;if(/attack it boosted/i.test(raw)&&eventContext.event==="hit"&&(source.instance.uid!==eventContext.subjectUid||!eventContext.boostUid))return false;if(/hits? a vanguard/i.test(raw)&&eventContext.event==="hit"&&eventContext.targetZone&&eventContext.targetZone!=="vanguard")return false;return true}
  function abilityTriggerMatches(a,eventName,event,sourceUid,sourceZone,subjectZone,sourceControllerPlayerId){return window.VanguardAbilityEngine.eventMatchesAbilityTrigger(a,eventName,event,sourceUid,sourceZone,subjectZone,sourceControllerPlayerId)}
  function abilityTargetChoices(side,source,ability,eventContext={}){
    const step=ability?.definition?.effects?.find(effect=>effect.target==="chosen"&&["modify-power-target","retire-target","stand-target","rest-target","unlock-target","protect-target"].includes(effect.op));if(!step)return[];
    const raw=String(ability.raw||""),filter=step.targetFilter||{},enemy=filter.controller==="opponent"||(!filter.controller&&/opponent|opposing/i.test(raw)),targetSide=enemy?flipSide(side):side;
    let targets=fieldUnits(targetSide).map(field=>({...field,side:targetSide}));
    targets=targets.filter(field=>window.VanguardAbilityEngine.matchesTargetFilter(filter,{source:source.instance,sourceControllerPlayerId:source.instance.controllerPlayerId||match.players[side]?.playerId,target:field.instance,targetControllerPlayerId:field.instance.controllerPlayerId||match.players[targetSide]?.playerId,opponentPlayerId:match.players[flipSide(side)]?.playerId,targetCard:cardMap.get(field.instance.cardId),targetZone:field.zone,isBeingAttacked:match.pendingAttack?.targetUid===field.instance.uid}));
    if(step.op==="stand-target")targets=targets.filter(field=>field.instance.rested);if(step.op==="rest-target")targets=targets.filter(field=>!field.instance.rested);
    if(/same column/i.test(raw)&&eventContext.subjectZone){const column=rearColumn(eventContext.subjectZone);targets=targets.filter(field=>rearColumn(field.zone)===column)}
    return targets;
  }  function prepareBotAbility(side,source,ability,eventContext={}){const p=match.players[side],x={side,field:source.zone,instance:source.instance,ability,eventContext,costSelections:{cb:[],sb:[],discard:[],reveal:[]},triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[side]?.playerId},raw=ability.raw;if(Array.isArray(ability.costAlternatives))x.costAlternativeIndex=ability.costAlternatives.findIndex(costs=>window.VanguardAbilityEngine.canPayAbilityCosts({...ability,costs,costAlternatives:undefined},{faceUpDamage:(p.damage||[]).filter(card=>!card.faceDown).length,energy:p.energy,hasEnergyGenerator:hasEnergyGenerator(p)}));if(ability.definition?.effects?.some(effect=>effect.op==="reorder-deck-card"))x.deckDestination="top";const cb=abilityCostCount(ability,"counter-blast",ability.costAlternatives?.[x.costAlternativeIndex]),sb=abilityCostCount(ability,"soul-blast",ability.costAlternatives?.[x.costAlternativeIndex]),discard=abilityCostCount(ability,"discard",ability.costAlternatives?.[x.costAlternativeIndex]);x.costSelections.cb=(p.damage||[]).filter(card=>!card.faceDown&&(ability.costs||[]).filter(cost=>cost.type==="counter-blast").every(cost=>abilityCostInstanceMatches(cost,card))).slice(0,cb).map(card=>card.uid);x.costSelections.sb=(p.soul||[]).slice(0,sb).map(card=>card.uid);x.costSelections.discard=abilityDiscardCards(side,source,ability).sort((a,b)=>Number(cardMap.get(a.cardId)?.grade||0)-Number(cardMap.get(b.cardId)?.grade||0)).slice(0,discard).map(card=>card.uid);x.costSelections.reveal=(p.hand||[]).filter(card=>gradeOf(cardMap.get(card.cardId))===3).slice(0,abilityCostCount(ability,"reveal-grade-from-hand")).map(card=>card.uid);const rideTop=ability.definition?.effects?.find(step=>step.op==="ride-top-five-named-card");if(rideTop){const looked=(p.deck||[]).slice(-Math.min(5,(p.deck||[]).length)),chosen=looked.find(card=>canAbilityRideCard(side,card,rideTop));x.effectUid=chosen?.uid||null;x.deckBottomUids=looked.filter(card=>card.uid!==x.effectUid).map(card=>card.uid)}const deckDrop=ability.definition?.effects?.find(step=>step.op==="search-deck-or-drop-named-to-hand");if(deckDrop){const matchZone=(zone)=>(p[zone]||[]).find(card=>window.VanguardAbilityEngine.cardHasName(cardMap.get(card.cardId),deckDrop.cardName));const found=matchZone("deck")||matchZone("drop");x.effectSourceZone=found&&p.deck.includes(found)?"deck":"drop";x.effectUid=found?.uid||null}const pool=abilityChoicePool(x);if(pool){const candidates=pool.cards.filter(card=>!/\bcall\b|\bforerunner\b/i.test(raw)||isUnitCard(cardMap.get(card.cardId)));const chosen=candidates.find(card=>/\bforerunner\b/i.test(raw)&&card.uid===source.instance.uid)||candidates[0];if(chosen)x.effectUid=chosen.uid;if(/\bcall\b|\bforerunner\b/i.test(raw)){const zones=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right',...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)];x.callZone=zones.find((_,i)=>!p.rear[i]);}}if((/\b(?:choose|select|target)\b/i.test(raw)||ability.definition?.effects?.some(effect=>effect.target==="chosen"))&&/\b(?:unit|rear-guard|vanguard)\b/i.test(raw)){const owner=/opponent|opposing/i.test(raw)?(side==='human'?'bot':'human'):side;let targets=fieldUnits(owner).map(field=>({...field,side:owner}));if(/rear-guards?/i.test(raw))targets=targets.filter(field=>field.zone!=='vanguard');const targetEffect=ability.definition?.effects?.find(effect=>effect.target==='chosen');if(targetEffect?.targetFilter)targets=targets.filter(field=>window.VanguardAbilityEngine.matchesTargetFilter(targetEffect.targetFilter,{source:source.instance,sourceControllerPlayerId:source.instance.controllerPlayerId||p.playerId,target:field.instance,targetControllerPlayerId:field.instance.controllerPlayerId||match.players[owner]?.playerId,opponentPlayerId:match.players[flipSide(side)]?.playerId,targetCard:cardMap.get(field.instance.cardId),targetZone:field.zone,isBeingAttacked:match.pendingAttack?.targetUid===field.instance.uid}));if(targetEffect?.op==='stand-target')targets=targets.filter(field=>field.instance.rested);if(targetEffect?.noOpIfNoLegalTargets&&!targets.length)x.noLegalTarget=true;if(/same column/i.test(raw)&&eventContext.subjectZone){const column=rearColumn(eventContext.subjectZone);targets=targets.filter(field=>rearColumn(field.zone)===column)}const target=targets.sort((a,b)=>Number(cardMap.get(b.instance.cardId)?.power||0)-Number(cardMap.get(a.instance.cardId)?.power||0))[0];if(target)x.targetUid=target.instance.uid;else if(/if no units were retired/i.test(raw))x.optionalNoTarget=true}if(ability.definition?.effects?.some(step=>step.op==="place-circle-marker")){const marker=ability.definition.effects.find(step=>step.op==="place-circle-marker"),zones=[...(marker.circleTypes.includes("vanguard")&&p.vanguard&&!((p.giftZones||[]).some(item=>item?.type===marker.markerType&&item.zone==="vanguard"))?["vanguard"]:[]),...["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)].filter((zone,index)=>((marker.markerType==="Dragontree"&&zone.startsWith("accel-"))||index<p.rear.length)&&!((p.giftZones||[]).some(item=>item?.type===marker.markerType&&item.zone===zone)))];x.circleZone=zones[0]||null}return x}  function abilityCostInstanceMatches(cost,instance){if(!cost?.filter?.clan)return true;const card=cardMap.get(instance?.cardId),clan=String(cost.filter.clan).toLowerCase();if(/all clans and nations/i.test(String(card?.text||'')))return true;const values=[card?.clan,...(card?.clans||[])].filter(Boolean).map(value=>String(value).toLowerCase());return values.length?values.includes(clan):String(card?.text||'').split(/\r?\n/)[0].split('/')[0].trim().toLowerCase()===clan}function abilityCostPaymentAvailable(ability,side,source){const player=match?.players?.[side];if(!player)return false;return window.VanguardAbilityEngine.evaluateAutoCostPayment(ability,{energy:Number(player.energy)||0,hasEnergyGenerator:hasEnergyGenerator(player),sourceCanBind:Boolean((player.drop||[]).some(card=>card.uid===source.instance.uid)),sourceCanBindFromFieldOrDrop:Boolean((player.drop||[]).some(card=>card.uid===source.instance.uid)||fieldUnits(side).some(field=>field.instance.uid===source.instance.uid&&field.zone!=="vanguard")),bindableHealInDrop:(player.drop||[]).filter(card=>card.uid!==source.instance.uid&&String(cardMap.get(card.cardId)?.trigger||"").toLowerCase()==="heal").length,faceUpDamage:(player.damage||[]).filter(card=>!card.faceDown).length,soulCount:(player.soul||[]).length,discardableHand:abilityDiscardCards(side,source,ability).length,revealableGradeThreeHand:(player.hand||[]).filter(card=>gradeOf(cardMap.get(card.cardId))===3).length,sourceCanDiscard:(player.hand||[]).some(card=>card.uid===source.instance.uid),sourceRested:Boolean(source.instance.rested),sourceCanMoveToSoul:Boolean(findFieldCard(source.instance.uid)?.side===side),sourceCanRetire:Boolean(findFieldCard(source.instance.uid)?.side===side&&findFieldCard(source.instance.uid)?.zone!=="vanguard"),sourceCanMoveToBottomDeck:Boolean(player.drop?.some(card=>card.uid===source.instance.uid))}).payCost}function queueOneAbility(side,source,ability,eventContext){if(eventContext?.perfectGuardPaid&&ability.definition?.effects?.some(effect=>effect.op==="protect-target"))return;if(ability.kind==="AUTO"&&eventContext?.eventId&&!window.VanguardAbilityEngine.claimAbilityTrigger(match,eventContext.eventId,source.instance.uid,ability.id))return;if(ability.kind==="AUTO"&&!ability.definition?.effects){addLog((cardMap.get(source.instance.cardId)?.name||"A unit")+" met an AUTO trigger, but its effect is not reviewed and supported yet.");return}if(ability.kind==="AUTO"&&!window.VanguardAbilityEngine.autoAbilityReadiness(ability).ok)return;if(ability.kind==="AUTO"&&((ability.costs||[]).length||(ability.costAlternatives||[]).length)&&!abilityCostPaymentAvailable(ability,side,source)){const unpaid={side,field:source.zone,instance:source.instance,ability,eventContext,triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[side]?.playerId,skipCostPayment:true};if(match.collectingAbilityTriggers){unpaid.resolveAfterEventScan=true;(match.pendingAbilities||=[]).push(unpaid)}else resolveAbility(unpaid);return}const q=match.pendingAbilities||=([]),pending=match.pendingAbility;if(!eventContext?.eventId&&((pending?.instance?.uid===source.instance.uid&&pending.ability.id===ability.id)||q.some(x=>x.instance.uid===source.instance.uid&&x.ability.id===ability.id)))return;if(side==="bot"&&!online.role){const botMatch=prepareBotAbility(side,source,ability,eventContext);if(match.collectingAbilityTriggers){botMatch.resolveAfterEventScan=true;q.push(botMatch)}else resolveAbility(botMatch);return}const noTargetStep=ability.definition?.effects?.find(step=>step.target==="chosen"&&step.noOpIfNoLegalTargets);if(noTargetStep&&!abilityTargetChoices(side,source,ability,eventContext).length&&!(ability.costs||[]).length){const immediate={side,field:source.zone,instance:source.instance,ability,eventContext,triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[side]?.playerId,noLegalTarget:true};if(match.collectingAbilityTriggers){immediate.resolveAfterEventScan=true;q.push(immediate)}else resolveAbility(immediate);return}if(ability.definition&&ability.kind==="AUTO"&&!ability.canDecline&&ability.choiceStatus==="no-explicit-choice-detected"&&!(ability.costs||[]).length&&!(ability.effects||[]).some(effect=>effect.target==="chosen")){const immediate={side,field:source.zone,instance:source.instance,ability,eventContext,triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[side]?.playerId};if(match.collectingAbilityTriggers){immediate.resolveAfterEventScan=true;q.push(immediate)}else resolveAbility(immediate);return}q.push({side,field:source.zone,instance:source.instance,ability,eventContext,triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[side]?.playerId})}
  function attackAbilityMatchesSubject(raw,source,context){const full=String(raw||""),phrase=full.match(/\bwhen(?:ever)?\b([^.\n]{0,120}?)\battacks?\b/i)?.[1]||"";if(!phrase)return false;if(/\battacks?\s+(?:a|an|the)\s+vanguard\b/i.test(full)&&context.targetZone!=="vanguard")return false;if(/\battacks?\s+(?:a|an|the)\s+rear[- ]guard\b/i.test(full)&&context.targetZone!=="rear-guard")return false;if(/\b(?:this (?:unit|card|rear-guard|vanguard)|it)\b/i.test(phrase))return window.VanguardAbilityEngine.eventSubjectMatches(context.gameEvent,source.instance.uid,"source");if(/\byour vanguard\b/i.test(phrase))return context.subjectZone==="vanguard";if(/\b(?:another|other|one of your|your)\b[^.\n]{0,50}\b(?:unit|rear-guard|card)s?\b/i.test(phrase))return Boolean(context.subjectUid);return source.instance.uid===context.subjectUid}  function hitAbilityMatchesSubject(raw,source,context){const phrase=String(raw||"").match(/\bwhen(?:ever)?\b([^.\n]{0,140}?)\bhits?\b/i)?.[1]||"";if(!phrase)return false;if(/\bthis unit boosted\b/i.test(raw))return window.VanguardAbilityEngine.eventSubjectMatches(context.gameEvent,source.instance.uid,"booster");if(/\b(?:this (?:unit|card)|it)\b/i.test(phrase))return window.VanguardAbilityEngine.eventSubjectMatches(context.gameEvent,source.instance.uid,"source");if(/\byour vanguard\b/i.test(phrase))return context.subjectZone==="vanguard";if(/\byour rear-guard|one of your rear-guards\b/i.test(phrase))return /^rear-|^accel-/.test(context.subjectZone||"");if(/\b(?:an attack|another unit|your rear-guard(?:s)?)\b/i.test(phrase))return Boolean(context.subjectUid);return source.instance.uid===context.subjectUid}  function abilityBoostConditionsMet(a,source,context){const raw=a.raw;if(context.event==="boost"&&source.instance.uid!==context.subjectUid)return false;if(context.event==="hit"&&/\bthis unit boosted\b/i.test(raw)&&source.instance.uid!==context.boostUid)return false;const targetUid=context.event==="boost"?context.boostedUid:context.subjectUid,target=targetUid?findFieldCard(targetUid):null,targetCard=target?cardMap.get(target.instance.cardId):null;const clan=raw.match(/\bboost(?:s|ed)\b[^.\n]{0,70}[«<]([^»>]+)[»>]\s+vanguard/i)?.[1];if(clan&&(!target||target.zone!=="vanguard"||!String(targetCard?.clan||targetCard?.nation||"").toLowerCase().includes(clan.toLowerCase())&&!(targetCard?.clans||[]).some(value=>String(value).toLowerCase()===clan.toLowerCase())&&!String(targetCard?.text||"").toLowerCase().includes(clan.toLowerCase())))return false;const named=raw.match(/\bboost(?:s|ed)\b[^.\n]{0,70}(?:unit|card) named ["“]([^"”]+)["”]/i)?.[1];if(named&&(targetCard?.name||"").toLowerCase()!==named.trim().toLowerCase())return false;const withName=raw.match(/\bboost(?:s|ed)\b[^.\n]{0,70}(?:card|unit) with ["“]([^"”]+)["”] in its card name/i)?.[1];if(withName&&!(targetCard?.name||"").toLowerCase().includes(withName.toLowerCase()))return false;return true}  function placeAbilityMatchesSubject(raw,source,context){if(/\\bwhen this unit intercepts\\b/i.test(String(raw||"")))return window.VanguardAbilityEngine.eventSubjectMatches(context.gameEvent,source.instance.uid,"source");const phrase=String(raw||"").match(/\bwhen(?:ever)?\b([^\.\n]{0,140}?)\b(?:placed|called|put)\b/i)?.[1]||"";if(!phrase||!context.subjectUid)return false;const same=window.VanguardAbilityEngine.eventSubjectMatches(context.gameEvent,source.instance.uid,"event-subject"),sourceField=findFieldCard(source.instance.uid);if(/\b(?:this (?:unit|card|rear-guard|vanguard)|it)\b/i.test(phrase))return same;if(/\b(?:another|other)\b/i.test(phrase)){if(same)return false;if(/this unit.{0,3}circle|same circle/i.test(raw))return (sourceField?.zone||source.zone)===context.subjectZone;return true}if(/\byour vanguard\b/i.test(phrase))return context.subjectZone==="vanguard";if(/\bone of your [^.\n]{0,25}(?:units?|rear-guards?)|your rear-guard|your rear guard|your unit|a unit|a card|any unit|any card/i.test(phrase))return true;return same}  function findMatchInstance(uid){const located=window.VanguardAbilityEngine.locateCardInstance(match,uid);return located&&!located.ambiguous?located.instance:null}
function standUnitAndQueue(side, field) { if (!field?.instance?.rested) return false; field.instance.rested=false; const player=match.players[side]; queueAbilityPrompts("stand",side,field.instance.uid,{zone:field.zone,actingPlayerId:player?.playerId||side,timingWindow:"stand-phase",before:{rested:true},after:{rested:false}}); return true; }
  function queuePhaseChangeEvent(side,fromPhase,toPhase){const player=match?.players?.[side];if(!player)return;queueAbilityPrompts("phase",side,null,{phase:String(toPhase||"").toLowerCase(),actingPlayerId:player.playerId||side,turnPlayerId:player.playerId||side,timingWindow:"phase-start",before:{phase:String(fromPhase||"").toLowerCase()},after:{phase:String(toPhase||"").toLowerCase()}})}  function queueTurnStartEvent(side){const player=match?.players?.[side];if(!player)return;queueAbilityPrompts("start",side,null,{actingPlayerId:player.playerId||side,turnPlayerId:player.playerId||side,timingWindow:"turn-start"})}
  function queueTurnEndEvent(side,endPhaseRescan=false){const player=match?.players?.[side],pending=match?.pendingTurnEnd;if(!player)return;if(endPhaseRescan&&pending)pending.endPhaseRescanInProgress=true;try{queueAbilityPrompts("end",side,null,{eventId:pending?.turnEndEventId,actingPlayerId:player.playerId||side,turnPlayerId:player.playerId||side,timingWindow:"turn-end",endPhaseRescan})}finally{if(endPhaseRescan&&pending)pending.endPhaseRescanInProgress=false}}
  function standAllUnits(side) { const fields=abilityFieldUnits(side).filter(field=>field.instance.rested); if(!fields.length)return; const player=match.players[side],simultaneousWindowId=`${match.matchId}:stand:${match.turn}:${player?.playerId||side}`; const wasCollecting=Boolean(match.collectingAbilityTriggers); match.collectingAbilityTriggers=true; fields.forEach(field=>field.instance.rested=false); for(const field of fields)queueAbilityPrompts("stand",side,field.instance.uid,{zone:field.zone,actingPlayerId:player?.playerId||side,timingWindow:"stand-phase",simultaneousWindowId,before:{rested:true},after:{rested:false}}); match.collectingAbilityTriggers=wasCollecting; if(!wasCollecting){const immediate=(match.pendingAbilities||[]).filter(item=>item.resolveAfterEventScan);match.pendingAbilities=(match.pendingAbilities||[]).filter(item=>!item.resolveAfterEventScan);flushCollectedAbilityTriggers(immediate)} }
function queueAbilityPrompts(eventName,side,subjectUid=null,eventContext={}){
    if(!match||online.role==="watcher")return;if(eventName==="ride"&&subjectUid)window.VanguardAbilityEngine.removeHarmonyAssociationsForInstance(match,subjectUid);
    if(eventName==="place"&&eventContext.zone==="guardian"&&match.pendingAttack?.defenderSide===side&&(!eventContext.battleId||eventContext.battleId===match.pendingAttack.battleId)){const attack=match.pendingAttack,attackingPlayer=match.players[attack.attackerSide],attackingPlayerId=attackingPlayer?.playerId||attack.attackerSide;eventContext={...eventContext,attackingUnitInstanceId:attack.attackerUid,attackingUnitAttackCount:window.VanguardAbilityEngine.getAttackCount(match,attackingPlayerId,attack.attackerUid)}}
    if(eventName==="ride"&&match.pendingTurnEnd&&Number(match.pendingTurnEnd.turn)===Number(match.turn)&&(eventContext.actingPlayerId||match.players?.[side]?.playerId)===match.pendingTurnEnd.playerId)match.pendingTurnEnd.endPhaseRescanPending=true;
    if(Number(match.effectResolutionDepth||0)>0){(match.deferredAbilityEvents||=[]).push({kind:"prompt",eventName,side,subjectUid,eventContext});return}
    const wasCollecting=Boolean(match.collectingAbilityTriggers); const player=match.players[side],eventZone=eventName==="damageLeave"?(eventContext.currentLocation||"drop"):eventContext.zone||findFieldCard(subjectUid)?.zone||null;
    const eventType=({ride:"card.ridden",place:"card.placed",attack:"unit.attacked",attackStep:"attack.step-started",attacked:"attack.declared",draw:"card.drawn",boost:"unit.boosted",hit:"attack.hit",stand:"unit.stood",unlock:"unit.unlocked",drop:"card.moved",damagePlace:"card.damage_moved",damageLeave:"card.moved",end:"turn.ended",start:"turn.started",phase:"phase.changed",driveCheck:"drive.checked",battleEnd:"battle.close-step",damageCheck:"damage.checked",triggerCheck:"trigger.checked",harmony:"unit.became_harmony",engorge:"unit.became_engorged",legion:"unit.legioned"})[eventName]||"game.action";
    const sourceUid=eventContext.sourceCardInstanceId||eventContext.riderUid||(eventName==="ride"?player.vanguard?.uid:["driveCheck","damageCheck","triggerCheck"].includes(eventName)?null:subjectUid),sourceInstance=findMatchInstance(sourceUid),boosterUid=eventContext.boostUid||(eventName==="boost"?subjectUid:null),boosterInstance=findMatchInstance(boosterUid),boosterDefinition=cardMap.get(boosterInstance?.cardId),boosterPower=eventContext.boosterPower??(eventName==="boost"&&boosterUid&&findFieldCard(boosterUid)?attackerPower(findFieldCard(boosterUid)):null);
    const rideEvent=eventName==="ride"&&sourceInstance&&subjectUid?window.VanguardAbilityEngine.createRideGameEvent(match,{eventId:eventContext.eventId,rider:sourceInstance,ridden:findMatchInstance(subjectUid),actingPlayerId:eventContext.actingPlayerId||player.playerId||side,turnPlayerId:eventContext.turnPlayerId||match.players[match.side]?.playerId||match.side,previousLocation:eventContext.riderPreviousLocation||eventContext.sourceZone||eventContext.source||"hand",timingWindow:eventContext.timingWindow||"normal-ride"}):null;const structuredEvent=rideEvent||window.VanguardAbilityEngine.createGameEvent(match,{eventId:eventContext.eventId,type:eventType,actingPlayerId:eventContext.actingPlayerId||player.playerId||side,turnPlayerId:eventContext.turnPlayerId||match.players[match.side]?.playerId||match.side,sourceCardInstanceId:sourceUid,sourceCardName:eventContext.sourceCardName||cardMap.get(sourceInstance?.cardId)?.name||null,sourceCardGrade:eventContext.sourceCardGrade??Number(cardMap.get(sourceInstance?.cardId)?.grade??-1),sourceOwnerPlayerId:eventContext.sourceOwnerPlayerId||sourceInstance?.ownerPlayerId||(sourceUid?player.playerId:null),sourceControllerPlayerId:eventContext.sourceControllerPlayerId||sourceInstance?.controllerPlayerId||(sourceUid?player.playerId:null),sourceCardClan:eventContext.sourceCardClan||cardMap.get(sourceInstance?.cardId)?.clan||null,sourceCardClans:eventContext.sourceCardClans||cardMap.get(sourceInstance?.cardId)?.clans||[],subjectCardInstanceId:subjectUid,subjectOwnerPlayerId:eventContext.subjectOwnerPlayerId||findMatchInstance(subjectUid)?.ownerPlayerId||(subjectUid?player.playerId:null),subjectControllerPlayerId:eventContext.subjectControllerPlayerId||findMatchInstance(subjectUid)?.controllerPlayerId||(subjectUid?player.playerId:null),boosterCardInstanceId:boosterUid,boosterCardName:eventContext.boosterCardName||boosterDefinition?.name||null,boosterCardClan:eventContext.boosterCardClan||boosterDefinition?.clan||null,boosterCardClans:eventContext.boosterCardClans||[],boosterCardRace:eventContext.boosterCardRace||boosterDefinition?.race||null,boosterCardRaces:eventContext.boosterCardRaces||boosterDefinition?.races||[],boosterPower,boosterCardText:eventContext.boosterCardText||boosterDefinition?.text||null,boostedCardInstanceId:eventContext.boostedUid||null,boostedCardName:eventContext.boostedCardName||(eventContext.boostedUid?cardMap.get(findFieldCard(eventContext.boostedUid)?.instance.cardId)?.name:null),boostedCardGrade:eventContext.boostedUid?Number(cardMap.get(findFieldCard(eventContext.boostedUid)?.instance.cardId)?.grade??-1):null,boostedCardClan:eventContext.boostedUid?cardMap.get(findFieldCard(eventContext.boostedUid)?.instance.cardId)?.clan||null:null,boostedCardClans:eventContext.boostedUid?cardMap.get(findFieldCard(eventContext.boostedUid)?.instance.cardId)?.clans||[]:[],boostedCardLimitBreaks:eventContext.boostedUid&&/\bLimit Break 4\s*\(This ability is active if you have (?:four|4) or more damage\)/i.test(cardMap.get(findFieldCard(eventContext.boostedUid)?.instance.cardId)?.text||"")?[4]:[],targetCardInstanceIds:eventContext.targetCardInstanceIds||(eventContext.targetUid?[eventContext.targetUid]:[]),targetLocation:eventContext.targetZone||(eventName==="boost"&&eventContext.boostedUid?findFieldCard(eventContext.boostedUid)?.zone:null),previousLocation:eventContext.previousLocation||eventContext.sourceZone||eventContext.source||(eventName==="damageLeave"?"damage":eventName==="ride"?"vanguard":null),currentLocation:eventContext.currentLocation||eventZone,circle:eventContext.circle||eventZone,battleId:eventContext.battleId||match.pendingAttack?.battleId||null,attackingUnitInstanceId:eventContext.attackingUnitInstanceId||null,attackingCardInstanceIds:eventContext.attackingCardInstanceIds||[],attackingUnitAttackCount:eventContext.attackingUnitAttackCount??(sourceUid&&eventName==="attack"?window.VanguardAbilityEngine.getAttackCount(match,eventContext.actingPlayerId||player.playerId||side,sourceUid):null),playerAttackCount:eventContext.playerAttackCount??(eventName==="attack"?window.VanguardAbilityEngine.getPlayerAttackCount(match,eventContext.actingPlayerId||player.playerId||side):null),phase:eventContext.phase||phases[match.phase]?.toLowerCase()||null,timingWindow:eventContext.timingWindow||eventName,attackHitOverride:eventContext.attackHitOverride===true,checkKind:eventContext.checkKind||null,checkSourceLocation:eventContext.checkSourceLocation||null,checkIndex:eventContext.checkIndex,checkedCardInstanceId:subjectUid,checkedCardName:eventContext.subjectInstance?cardMap.get(eventContext.subjectInstance.cardId)?.name||null:null,checkedCardGrade:eventContext.subjectInstance?Number(cardMap.get(eventContext.subjectInstance.cardId)?.grade??-1):null,checkedCardClan:eventContext.subjectInstance?cardMap.get(eventContext.subjectInstance.cardId)?.clan||null:null,checkedCardClans:eventContext.subjectInstance?cardMap.get(eventContext.subjectInstance.cardId)?.clans||[]:[],checkedCardText:eventContext.subjectInstance?cardMap.get(eventContext.subjectInstance.cardId)?.text||null:null,checkedCardTriggerType:eventContext.subjectInstance&&typeof cardMap.get(eventContext.subjectInstance.cardId)?.trigger==="string"?cardMap.get(eventContext.subjectInstance.cardId).trigger:null,revealedTrigger:eventContext.revealedTrigger||null,before:eventContext.before||null,after:eventContext.after||null});
    const pendingEnd=match.pendingTurnEnd,turnEndRescan=eventName==="end"&&eventContext.endPhaseRescan===true&&pendingEnd&&structuredEvent.eventId===pendingEnd.turnEndEventId&&structuredEvent.actingPlayerId===pendingEnd.playerId&&structuredEvent.turnPlayerId===pendingEnd.playerId&&structuredEvent.phase==="end"&&structuredEvent.timingWindow==="turn-end"&&Number(pendingEnd.turn)===Number(match.turn)&&Number(match.phase)===phases.length-1&&match.players?.[pendingEnd.side]?.playerId===pendingEnd.playerId&&pendingEnd.endPhaseRescanInProgress===true;
    if(eventContext.endPhaseRescan&&!turnEndRescan)return;
    if(!turnEndRescan&&!window.VanguardAbilityEngine.claimGameEvent(match,structuredEvent.eventId))return;
    let movedInstance=eventContext.subjectInstance||null;if(!movedInstance&&eventName==="draw")movedInstance=findMatchInstance(subjectUid)||null;if(!movedInstance&&eventName==="place"&&eventContext.sourceZone==="guardian")movedInstance=(player.guardCircle||[]).find(card=>card.uid===subjectUid)||null;if(!movedInstance&&eventName==="ride")movedInstance=(player.soul||[]).find(card=>card.uid===subjectUid)||null;if(!movedInstance&&eventName==="damagePlace")movedInstance=(player.damage||[]).find(card=>card.uid===subjectUid)||null;if(!movedInstance&&eventName==="damageLeave")movedInstance=["damage","drop","hand","soul","bind","deck"].flatMap(zone=>player[zone]||[]).find(card=>card.uid===subjectUid)||null;if(!movedInstance&&["driveCheck","damageCheck","triggerCheck"].includes(eventName))movedInstance=eventContext.subjectInstance||findMatchInstance(subjectUid)||null;
    const movedSource=movedInstance?[{side,zone:eventName==="ride"?"vanguard":eventName==="damagePlace"?"damage":eventName==="draw"?(eventContext.currentLocation||"hand"):eventContext.sourceZone||"damage",instance:movedInstance}]:[];
    const fieldSources=[... ["human","bot"].flatMap(fieldSide=>abilityFieldUnits(fieldSide).map(field=>({...field,side:fieldSide})))],handSources=eventName==="phase"?["human","bot"].flatMap(fieldSide=>(match.players[fieldSide]?.hand||[]).map(instance=>({side:fieldSide,zone:"hand",instance}))):[],sources=[...fieldSources,...handSources,...movedSource],subject=subjectUid?findFieldCard(subjectUid):null;
    const context={...eventContext,event:eventName,eventId:structuredEvent.eventId,gameEvent:structuredEvent,subjectUid,subjectZone:eventName==="ride"?structuredEvent.targetLocation:eventContext.zone||subject?.zone||null};
    match.collectingAbilityTriggers=true;
    for(const source of sources){
       if(eventName==="hit"&&eventContext.hitOverrideSourceUid&&source.instance.uid!==eventContext.hitOverrideSourceUid)continue;
     const sourceSide=source.side,sourceContext={...context,triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[sourceSide]?.playerId};
      for(const ability of cardAbilities(cardMap.get(source.instance.cardId))){
        if(eventName==="ride"&&!window.VanguardAbilityEngine.eventSubjectMatches(structuredEvent,source.instance.uid,ability.trigger?.subject||"event-subject"))continue;
        if(eventName==="place"&&ability.definition?.source?.patternId==="auto-harmony-same-column-association-v1"){const placed=subjectUid?findFieldCard(subjectUid):null,sourceController=source.instance.controllerPlayerId||match.players[sourceSide]?.playerId,placedController=placed?.instance.controllerPlayerId||match.players[placed?.side]?.playerId;if(!placed||source.instance.uid===subjectUid||sourceSide!==side||sourceController!==placedController||rearColumn(source.zone)!==rearColumn(placed.zone))continue;sourceContext.harmonySameColumnAtTrigger=true;}if(eventName==="ride"&&ability.definition?.source?.patternId==="auto-forerunner-same-clan-ride-call-source-v1"){const rider=findMatchInstance(structuredEvent.sourceCardInstanceId),riderCard=cardMap.get(rider?.cardId),sourceCard=cardMap.get(source.instance.cardId),clans=card=>[...(Array.isArray(card?.clans)?card.clans:[]),...(card?.clan?[card.clan]:[])].map(value=>String(value).trim().toLowerCase()).filter(Boolean);if(!clans(sourceCard).some(clan=>clans(riderCard).includes(clan)))continue;}
        if(!abilityTriggerMatches(ability,eventName,structuredEvent,source.instance.uid,source.zone,sourceContext.subjectZone,sourceContext.triggerControllerPlayerId)||!abilityRequirementsMet(ability,sourceSide,source,sourceContext))continue;
        if(eventName==="attack"&&ability.trigger?.subject!=="controller"&&!attackAbilityMatchesSubject(ability.raw,source,sourceContext))continue;
        if(eventName==="boost"&&!window.VanguardAbilityEngine.eventSubjectMatches(structuredEvent,source.instance.uid,"booster"))continue;
        if(eventName==="hit"&&!hitAbilityMatchesSubject(ability.raw,source,sourceContext))continue;
        if(!abilityBoostConditionsMet(ability,source,sourceContext))continue;
        if(eventName==="damagePlace"&&/\bthis (?:unit|card)\b/i.test(ability.raw)&&source.instance.uid!==subjectUid)continue;
        if(eventName==="damageLeave"&&/\bthis (?:unit|card)\b/i.test(ability.raw)&&source.instance.uid!==subjectUid)continue;
        if(eventName==="hit"&&/attack it boosted/i.test(ability.raw)&&source.instance.uid!==subjectUid&&rearColumn(source.zone)!==rearColumn(sourceContext.subjectZone))continue;
        if(eventName==="hit"&&/hits? a vanguard/i.test(ability.raw)&&sourceContext.targetZone&&sourceContext.targetZone!=="vanguard")continue;
        if(eventName==="place"&&!placeAbilityMatchesSubject(ability.raw,source,sourceContext))continue;
        queueOneAbility(sourceSide,source,ability,sourceContext);
      }
    }
    if(wasCollecting)return;match.collectingAbilityTriggers=false;const immediate=(match.pendingAbilities||[]).filter(x=>x.resolveAfterEventScan);match.pendingAbilities=(match.pendingAbilities||[]).filter(x=>!x.resolveAfterEventScan);flushCollectedAbilityTriggers(immediate)
  }
function queueMovedCardAbility(instance,side,eventName,zone="rear-left",eventContext={}){
    if(!match||!instance)return;window.VanguardAbilityEngine.removeHarmonyAssociationsForInstance(match,instance.uid);
    if(Number(match.effectResolutionDepth||0)>0){(match.deferredAbilityEvents||=[]).push({kind:"movement",instance,side,eventName,zone,eventContext});return}
    const player=match.players[side],eventType=({drop:"card.moved",retire:"card.retired",bind:"card.bound",discard:"card.discarded",move:"card.moved",soulMove:"card.moved",damageLeave:"card.moved",damagePlace:"card.damage_moved"})[eventName];if(!eventType)return;
    const previousLocation=eventContext.previousLocation||zone,currentLocation=eventContext.currentLocation||({drop:"drop",retire:"drop",bind:"bind",discard:"drop",damageLeave:"drop",damagePlace:"damage",soulMove:"soul"})[eventName];
    const gameEvent=window.VanguardAbilityEngine.createGameEvent(match,{eventId:eventContext.eventId,type:eventType,actingPlayerId:eventContext.actingPlayerId||player.playerId||side,turnPlayerId:eventContext.turnPlayerId||match.players[match.side]?.playerId||match.side,sourceCardInstanceId:instance.uid,sourceOwnerPlayerId:instance.ownerPlayerId||player.playerId,sourceControllerPlayerId:instance.controllerPlayerId||player.playerId,subjectCardInstanceId:instance.uid,subjectOwnerPlayerId:instance.ownerPlayerId||player.playerId,subjectControllerPlayerId:instance.controllerPlayerId||player.playerId,previousLocation,currentLocation,reason:eventContext.reason||eventContext.discardReason||null,discardReason:eventContext.discardReason||eventContext.reason||null,calledGUnitCardId:eventContext.calledGUnitCardId||null,calledGUnitInstanceId:eventContext.calledGUnitInstanceId||null,calledGUnitCardName:eventContext.calledGUnitCardName||null,circle:previousLocation,battleId:eventContext.battleId||match.pendingAttack?.battleId||null,attackingUnitInstanceId:eventContext.attackingUnitInstanceId||null,attackingUnitAttackCount:eventContext.attackingUnitAttackCount,phase:phases[match.phase]?.toLowerCase()||null,timingWindow:eventContext.timingWindow||eventName,before:eventContext.before||null,after:eventContext.after||null});
    if(!window.VanguardAbilityEngine.claimGameEvent(match,gameEvent.eventId))return;
    const baseContext={...eventContext,event:eventName,eventId:gameEvent.eventId,gameEvent,currentLocation,subjectUid:instance.uid,subjectZone:previousLocation};
    const sources=[{side,zone:previousLocation,instance},...["human","bot"].flatMap(fieldSide=>abilityFieldUnits(fieldSide).map(field=>({...field,side:fieldSide}))),...["human","bot"].flatMap(fieldSide=>(match.players[fieldSide]?.drop||[]).filter(card=>cardAbilities(cardMap.get(card.cardId)).some(ability=>ability.definition?.requiredLocation==="drop")).map(instance=>({side:fieldSide,zone:"drop",instance})))];
    match.collectingAbilityTriggers=true;
    for(const source of sources){
      const triggerSide=source.side,context={...baseContext,sourceZone:source.zone,triggerControllerPlayerId:source.instance.controllerPlayerId||match.players[triggerSide]?.playerId};
      for(const ability of cardAbilities(cardMap.get(source.instance.cardId))){
        if(!abilityTriggerMatches(ability,eventName,gameEvent,source.instance.uid,source.zone,previousLocation,context.triggerControllerPlayerId))continue;
        if(!abilityRequirementsMet(ability,triggerSide,source,context))continue;
        queueOneAbility(triggerSide,source,ability,context);
      }
    }
    match.collectingAbilityTriggers=false;
    const immediate=(match.pendingAbilities||[]).filter(x=>x.resolveAfterEventScan);match.pendingAbilities=(match.pendingAbilities||[]).filter(x=>!x.resolveAfterEventScan);flushCollectedAbilityTriggers(immediate)
  }
  function flushCollectedAbilityTriggers(immediate){const queue=match.pendingAbilities||[],state={pendingAbility:match.pendingAbility,pendingAbilities:[...queue,...immediate]},handled=new Set();for(const pending of immediate){if(handled.has(pending))continue;const group=window.VanguardAbilityEngine.simultaneousAbilityGroup(state,pending);if(group.length>1&&pending.side==="bot"&&!online.role){for(const item of group){handled.add(item);if(item.resolveAfterEventScan){delete item.resolveAfterEventScan;resolveAbility(item)}}}else if(group.length>1){for(const item of group){handled.add(item);if(item.resolveAfterEventScan){delete item.resolveAfterEventScan;item.orderChoiceRequired=true;queue.push(item)}}}else{delete pending.resolveAfterEventScan;resolveAbility(pending)}}showNextAbilityPrompt()}
  function abilityUsed(side,instanceUid,abilityOrId){const player=match?.players?.[side],ability=abilityOrId&&typeof abilityOrId==="object"?abilityOrId:null,id=ability?.id||abilityOrId,instance=findMatchInstance(instanceUid),name=cardMap.get(instance?.cardId)?.name;return(player?.usedAbilities||[]).includes(window.VanguardAbilityEngine.abilityUsageKey(match.turn,player.playerId||side,instanceUid,id,ability?.usageRestriction,name,ability?.printedText||ability?.raw))}
  function eligibleActivatedAbilities(f){if(!f||match?.side!==f.side)return[];const player=match.players[f.side],turnPlayer=match.players[match.side];return cardAbilities(cardMap.get(f.instance.cardId)).filter(a=>{if(!window.VanguardAbilityEngine.isManuallyActivatable(a)||!a.definition?.effects||!abilityRequirementsMet(a,f.side,f,{event:"ACT"})||!window.VanguardAbilityEngine.hasLegalAbilityTargets(a,step=>abilityTargetChoices(f.side,f,a,{event:"ACT"}).length))return false;const allowed=window.VanguardAbilityEngine.canActivateManualAbility(a,{cardInstanceId:f.instance.uid,controllerPlayerId:f.instance.controllerPlayerId||player.playerId,actorPlayerId:player.playerId,turnPlayerId:turnPlayer.playerId,phase:phases[match.phase]?.toLowerCase(),conditions:abilityConditionContext(f.side,f,{event:"ACT"}),resolutionBlocked:Boolean(match.pendingAbility||match.pendingTrigger||match.pendingAttack),inPermittedZone:abilityZoneAllowed(a,f),alreadyUsed:(a.once||a.usageRestriction)&&abilityUsed(f.side,f.instance.uid,a),resources:{faceUpDamage:(player.damage||[]).filter(card=>!card.faceDown).length,soulCount:(player.soul||[]).length,discardableHand:abilityDiscardCards(f.side,f,a).length,sourceRested:Boolean(f.instance.rested),sourceCanMoveToSoul:Boolean(findFieldCard(f.instance.uid)?.side===f.side),sourceCanRetire:Boolean(findFieldCard(f.instance.uid)?.side===f.side&&findFieldCard(f.instance.uid)?.zone!=="vanguard")}});return allowed.ok})}
  function useBotActivatedSkills(){for(const field of fieldUnits("bot").map(x=>({...x,side:"bot"}))){for(const ability of eligibleActivatedAbilities(field)){if(!/(?:draw|power|critical|rest|stand|soul\s*charge|counter[- ]charge|retire|search|call|drive)/i.test(ability.raw))continue;if(/if your opponent has no rear-guards/i.test(ability.raw)&&match.players.human.rear.some(Boolean))continue;const request=prepareBotAbility("bot",field,ability);resolveAbility(request)}}}
  function showAbilityMenu(f){const a=eligibleActivatedAbilities(f);if(!a.length){const unreviewed=cardAbilities(cardMap.get(f.instance.cardId)).some(ability=>ability.kind==="ACT"&&!ability.definition?.effects);toast(unreviewed?"This card has an ACT ability, but its effect is not reviewed and supported yet.":'No activated skill is available (check its circle, once-per-turn use, and Generation Break).');return}const c=cardMap.get(f.instance.cardId);$('#context-menu-title').textContent=`${c?.name||'Card'} · Skill`,$('#context-menu-help').textContent=`Generation Break ${generationBreakCount(f.side)}. Choose an ability to activate.`,$('#context-menu-actions').innerHTML=a.map(x=>`<button class="button" type="button" data-context-action="ability:${f.side}:${f.instance.uid}:${escapeHtml(encodeURIComponent(x.id))}">${escapeHtml(x.printedText||x.raw)}</button>`).join('');if(!$('#context-menu-dialog').open)$('#context-menu-dialog').showModal()}
  function chooseAbilityResolutionOrder(event){const button=event.target.closest("[data-ability-order-index]"),current=match?.pendingAbility;if(!button||!current)return;const group=window.VanguardAbilityEngine.simultaneousAbilityGroup(match,current),chosen=group[Number(button.dataset.abilityOrderIndex)];if(!chosen)return;if(chosen!==current){const queue=match.pendingAbilities||[],index=queue.indexOf(chosen);if(index<0)return;queue[index]=current;match.pendingAbility=chosen}chosen.orderChosen=true;$("#ability-dialog").close();showNextAbilityPrompt()}
  function showNextAbilityPrompt() {
    const dialog = $("#ability-dialog");
    const localTriggerPending = match?.pendingTrigger && (online.role !== "host" && online.role !== "guest" || match.pendingTrigger.side === "human");
    if (online.applyingRemote || online.role === "watcher" || localTriggerPending) { if (dialog.open) dialog.close(); return; }
    if (!match) return;
    window.VanguardAbilityEngine.prunePendingAbilitiesWithConsumedUsage(match,pending=>abilityUsed(pending.side,pending.instance.uid,pending.ability));
    if (online.role === "guest" && online.abilityResponsePending) {
      const response = online.abilityResponsePending, queue = match.pendingAbilities || [];
      const stillPending = [match.pendingAbility, ...queue].some(item => item?.side === "human" && item.instance?.uid === response.uid && item.ability?.id === response.abilityId);
      if (!stillPending || response.accept) online.abilityResponsePending = null;
      else { if (dialog.open) dialog.close(); return; }
    }
    const localPlayerId = match.players?.human?.playerId;
    const selectedPrompt = window.VanguardAbilityEngine.promotePendingAbilityForPlayer(match, localPlayerId, "human");
    if (!selectedPrompt) { if (dialog.open) dialog.close(); return; }
    const x = selectedPrompt;
    const orderGroup=window.VanguardAbilityEngine.simultaneousAbilityGroup(match,selectedPrompt),orderPanel=$("#ability-order-panel");
    if(selectedPrompt.ability.kind==="AUTO"&&orderGroup.length>1&&!selectedPrompt.orderChosen){orderPanel.hidden=false;$("#ability-order-options").innerHTML=orderGroup.map((item,index)=>{const card=cardMap.get(item.instance.cardId);return `<button class="button" type="button" data-ability-order-index="${index}">${escapeHtml(card?.name||"Card")} · ${escapeHtml(item.ability.printedText||item.ability.raw)}</button>`}).join("");$("#ability-dialog-title").textContent="Choose ability order";$("#ability-dialog-text").textContent="Several AUTO abilities you control became eligible at the same time. Choose which one to resolve first.";$("#ability-dialog-status").textContent="";$("#ability-cost-choices").hidden=true;$("#ability-effect-choices").hidden=true;$("#ability-accept").hidden=true;$("#ability-decline").hidden=true;if(!dialog.open)dialog.showModal();return}orderPanel.hidden=true;$("#ability-cost-choices").hidden=false;$("#ability-effect-choices").hidden=false;$("#ability-accept").hidden=false;$("#ability-decline").hidden=!window.VanguardAbilityEngine.canDeclineAbility(selectedPrompt.ability)||(selectedPrompt.ability.kind==="AUTO"&&(selectedPrompt.ability.costs||[]).length>0);

    if (x.side !== "human" || (x.triggerControllerPlayerId||x.instance?.controllerPlayerId) !== localPlayerId) { if (dialog.open) dialog.close(); return; }
    if (dialog.open) return;
    const c = cardMap.get(x.instance.cardId);
    $("#ability-dialog-title").textContent = `${c?.name || "Card"} · ${x.ability.kind === "ACT" ? "Activate skill?" : "Ability triggered"}`;
    $("#ability-dialog-text").textContent = x.ability.printedText || x.ability.raw;$("#ability-decline").textContent=x.ability.kind==="ACT"?"Cancel activation":"Resolve without optional effect";
    $("#ability-dialog-status").textContent = `Generation Break ${generationBreakCount(x.side)}${x.ability.gb ? ` / GB${x.ability.gb}` : ""}.`;
    $("#ability-decline").hidden=!window.VanguardAbilityEngine.canDeclineAbility(x.ability)||(x.ability.kind==="AUTO"&&((x.ability.costs||[]).length||(x.ability.costAlternatives||[]).length>0));$("#ability-skip-cost").hidden=!(x.ability.kind==="AUTO"&&window.VanguardAbilityEngine.canDeclineAbility(x.ability)&&((x.ability.costs||[]).length||(x.ability.costAlternatives||[]).length>0));
    renderAbilityCostChoices(x); renderAbilityEffectChoices(x);
    if (!dialog.open) dialog.showModal();
  }
  function renderAbilityCostChoices(x){
    const box=$("#ability-cost-choices"),p=match.players[x.side],alternatives=x.ability.costAlternatives,hasAlternatives=Array.isArray(alternatives)&&alternatives.length>1;
    if(hasAlternatives&&(x.costAlternativeIndex==null||x.costAlternativeIndex<0||x.costAlternativeIndex>=alternatives.length))x.costAlternativeIndex=0;
    const activeCosts=hasAlternatives?alternatives[x.costAlternativeIndex]:x.ability.costs||[],costAbility={...x.ability,costs:activeCosts};
    const cost={cb:abilityCostCount(costAbility,"counter-blast"),sb:abilityCostCount(costAbility,"soul-blast"),discard:abilityCostCount(costAbility,"discard"),reveal:abilityCostCount(costAbility,"reveal-grade-from-hand")};
    x.costSelections||={cb:[],sb:[],discard:[],reveal:[]};x.costSelections.reveal||=[];
    const optionButtons=hasAlternatives?'<h3>Choose one cost</h3>'+alternatives.map((branch,index)=>{const label=branch.map(c=>({"counter-blast":"Counter-Blast","energy-blast":"Energy Blast","soul-blast":"Soul-Blast"}[c.type]||c.type)+" "+c.count).join(" + "),resource={faceUpDamage:(p.damage||[]).filter(c=>!c.faceDown).length,energy:p.energy,hasEnergyGenerator:hasEnergyGenerator(p)},available=window.VanguardAbilityEngine.canPayAbilityCosts({...x.ability,costs:branch,costAlternatives:undefined},resource);return '<button class="button'+(index===x.costAlternativeIndex?' button-primary':'')+'" type="button" data-cost-alternative="'+index+'" '+(available?'':'disabled')+'>'+escapeHtml(label)+(available?'':' · unavailable')+'</button>'}).join(''):"";
    const groups=[['cb','Counter-Blast',(p.damage||[]).filter(c=>!c.faceDown&&activeCosts.filter(cost=>cost.type==='counter-blast').every(cost=>abilityCostInstanceMatches(cost,c)))],['sb','Soul-Blast',p.soul||[]],['discard','Discard from hand',abilityDiscardCards(x.side,{instance:x.instance},costAbility)],['reveal','Reveal a Grade 3 card from hand',(p.hand||[]).filter(c=>gradeOf(cardMap.get(c.cardId))===3)]];
    box.innerHTML=optionButtons+groups.filter(([k])=>cost[k]>0).map(([k,label,cards])=>'<h3>'+label+' · choose '+cost[k]+'</h3><div class="ability-cost-group">'+(cards.map(c=>{const a=cardMap.get(c.cardId),selected=x.costSelections[k].includes(c.uid);return a?'<button class="zone-view-card'+(selected?' selected':'')+'" type="button" data-ability-cost="'+k+':'+escapeHtml(c.uid)+'" aria-pressed="'+selected+'">'+cardImage(a)+'<b>'+escapeHtml(a.name)+'</b></button>':''}).join('')||'<p class="zone-empty-message">No cards available.</p>')+'</div>').join('');
  }
  function cardTextNumber(value){const text=String(value||"").toLowerCase().replace(/[- ]/g,"");if(/^\d+$/.test(text))return Number(text);const values={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20};return values[text]||0}
  function abilityChoicePoolBase(x){const discardedReturn=x.ability.definition?.effects?.find(step=>step.op==="return-trigger-discard-to-hand");if(discardedReturn){const event=x.eventContext?.gameEvent,uid=event?.subjectCardInstanceId||event?.cardInstanceId,p=match.players[x.side],card=(p.drop||[]).find(item=>item.uid===uid&&uid!==x.instance.uid);const cards=card?[card]:[];if(x.effectUid&&!cards.some(item=>item.uid===x.effectUid))x.effectUid=null;return{kind:"drop",label:"the card discarded by this event",cards}}const revoldressRide=x.ability.definition?.effects?.find(step=>step.op==="ride-revoldress-source-from-soul-rested");if(revoldressRide){const p=match.players[x.side],vanguard=cardMap.get(p.vanguard?.cardId),crests=(p.crests||[]).map(crest=>cardMap.get(crest.cardId)),cards=(p.soul||[]).filter(card=>{const definition=cardMap.get(card.cardId);return Boolean(definition&&isUnitCard(definition)&&definition.gDeckCard!==true&&card.gDeckCard!==true&&card.cannotBeRidden!==true&&/\bRevolDress\b/i.test(String(definition.text||""))&&window.VanguardAbilityEngine.canRideCard(definition,{vanguardCard:vanguard,crests}));});if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"soul",label:"RevolDress unit in Soul",cards}}const legionStep=x.ability.definition?.effects?.find(step=>step.op==="seek-mate"),namedCallStep=x.ability.definition?.effects?.find(step=>step.op==="search-deck-named-call-to-rearguard");if(namedCallStep){const p=match.players[x.side],zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)],openZones=zones.filter((_,i)=>i<p.rear.length&&(!p.rear[i]||namedCallStep.opensSourceCircle&&p.rear[i]?.uid===x.instance.uid)),cards=openZones.length?(p.deck||[]).filter(card=>{const definition=cardMap.get(card.cardId);return definition&&isUnitCard(definition)&&window.VanguardAbilityEngine.cardHasName(definition,namedCallStep.cardName)}):[];if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;if(x.callZone&&!openZones.includes(x.callZone))x.callZone=null;return{kind:"deck",label:"Deck",cards}}if(legionStep){const p=match.players[x.side],returned=(p.drop||[]).filter(card=>(x.legionDropUids||[]).includes(card.uid)),cards=[...(p.deck||[]),...returned].filter(card=>window.VanguardAbilityEngine.cardHasName(cardMap.get(card.cardId),legionStep.mateName));if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"legion-deck",label:"Deck",cards}}const t=x.ability.raw,p=match.players[x.side],gGuardianCharge=x.ability.definition?.effects?.find(step=>step.op==="g-guardian-discard-charge-choice");if(gGuardianCharge){const cards=(p.drop||[]).filter(card=>card.uid!==x.instance.uid&&String(cardMap.get(card.cardId)?.trigger||"").toLowerCase()==="heal");if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"drop",label:"another Heal trigger in Drop",cards}}const handToSoul=x.ability.definition?.effects?.find(step=>step.op==="move-filtered-hand-card-to-soul");if(handToSoul){const cards=(p.hand||[]).filter(card=>window.VanguardAbilityEngine.matchesTargetFilter(handToSoul.filter,{targetCard:cardMap.get(card.cardId)}));if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"hand",label:"Hand",cards}}const filteredSearch=x.ability.definition?.effects?.find(step=>step.op==="search-top-up-to-one-filtered-to-hand");if(filteredSearch){const limit=Math.min(Number(filteredSearch.lookCount||0),p.deck?.length||0),cards=(p.deck||[]).slice(-limit).filter(card=>window.VanguardAbilityEngine.matchesTargetFilter(filteredSearch.filter,{targetCard:cardMap.get(card.cardId)}));if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"deck",label:`Top ${filteredSearch.lookCount} cards of deck`,cards}}if((/\bcall this card\b|\bforerunner\b/i.test(t))&&p.soul?.some(c=>c.uid===x.instance.uid)){x.effectUid=x.instance.uid;return{kind:"soul",label:"Soul",cards:[x.instance]}}if(/choose[^.\n]*card[^.\n]*(?:from|in) your damage zone/i.test(t))return{kind:"damage",label:"Damage zone",cards:p.damage||[]};const topMatch=t.match(/(?:look at|reveal|top)[^.\n]*?\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+cards?\b/i),topCount=topMatch?cardTextNumber(topMatch[1]):0,topLimited=/look at|reveal|top \d+|top (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i.test(t),deckEffect=/(?:search|look at|reveal)[^.\n]*(?:your )?deck|call[^.\n]*from your deck/i.test(t);if(deckEffect){const limit=topLimited?Math.max(1,topCount||1):0;let cards=limit?p.deck.slice(-limit):p.deck.slice();const grade=t.match(/Grade\s*(\d+)/i)?.[1],gradeAtMost=/or less|or lower/i.test(t),name=t.match(/card named ["“]([^"”]+)["”]/i)?.[1],clan=t.match(/<([^>]+)>/)?.[1];if(/\bunit\b/i.test(t))cards=cards.filter(c=>isUnitCard(cardMap.get(c.cardId)));if(grade){const greater=/or greater|or higher/i.test(t);cards=cards.filter(c=>greater?Number(cardMap.get(c.cardId)?.grade)>=Number(grade):gradeAtMost?Number(cardMap.get(c.cardId)?.grade)<=Number(grade):Number(cardMap.get(c.cardId)?.grade)===Number(grade))}if(name)cards=cards.filter(c=>window.VanguardAbilityEngine.cardHasName(cardMap.get(c.cardId),name));if(/same card name as this unit/i.test(t)){const sourceDefinition=cardMap.get(x.instance.cardId);cards=cards.filter(c=>window.VanguardAbilityEngine.cardsShareName(sourceDefinition,cardMap.get(c.cardId)))}const namedWith=t.match(/with ["“]([^"”]+)["”] in its card name/i)?.[1];if(namedWith)cards=cards.filter(c=>cardMap.get(c.cardId)?.name?.toLowerCase().includes(namedWith.toLowerCase()));if(clan)cards=cards.filter(c=>String(cardMap.get(c.cardId)?.clan||"").toLowerCase()===clan.toLowerCase());return{kind:"deck",label:limit?`Top ${limit} cards of deck`:"Deck",cards}}if(/call[^.\n]*from your hand/i.test(t))return{kind:"hand",label:"Hand",cards:p.hand||[]};if(/call[^.\n]*from (?:your )?drop/i.test(t))return{kind:"drop",label:"Drop",cards:p.drop||[]};if(/call[^.\n]*from your soul/i.test(t))return{kind:"soul",label:"Soul",cards:p.soul||[]};return null}
  function canAbilityRideCard(side,instance,step){const player=match?.players?.[side],definition=cardMap.get(instance?.cardId),vanguard=player?.vanguard,oldDefinition=cardMap.get(vanguard?.cardId),grade=Number(definition?.grade),oldGrade=Number(oldDefinition?.grade);if(!player||!vanguard||!isUnitCard(definition)||definition.gDeckCard===true||instance?.gDeckCard===true||instance?.cannotBeRidden===true||!Number.isInteger(grade)||!Number.isInteger(oldGrade)||grade<oldGrade||grade>oldGrade+1||!window.VanguardAbilityEngine.cardHasName(definition,step.cardName)||!window.VanguardAbilityEngine.canRideCard(definition,{vanguardCard:oldDefinition,crests:player.crests||[]}))return false;const sameNameRestricted=(player.crests||[]).some(card=>card?.sameNameRideRestriction===true);return !sameNameRestricted||window.VanguardAbilityEngine.cardsShareName(definition,oldDefinition)}
  function abilityChoicePool(x){const rideStep=x.ability.definition?.effects?.find(item=>item.op==="ride-top-five-named-card");if(rideStep){const p=match.players[x.side],lookedAt=(p.deck||[]).slice(-Math.min(5,(p.deck||[]).length)),cards=lookedAt.filter(card=>canAbilityRideCard(x.side,card,rideStep));if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"ride-top-five",label:"top five cards of your Deck",cards,lookedAt}}const step=x.ability.definition?.effects?.find(item=>item.op==="search-deck-or-drop-named-to-hand");if(step){const p=match.players[x.side],zone=x.effectSourceZone,list=zone==="deck"?p.deck:zone==="drop"?p.drop:[],cards=(list||[]).filter(card=>window.VanguardAbilityEngine.cardHasName(cardMap.get(card.cardId),step.cardName));if(x.effectUid&&!cards.some(card=>card.uid===x.effectUid))x.effectUid=null;return{kind:"deck-or-drop",label:zone==="deck"?"Deck":zone==="drop"?"Drop":"Deck or Drop",cards}}return abilityChoicePoolBase(x)}
  function renderAbilityEffectChoices(x){$("#ability-accept").disabled=false;const box=$('#ability-effect-choices'),t=x.ability.raw,p=match.players[x.side],pool=abilityChoicePool(x),revelationTop=p.deck?.[p.deck.length-1]||null,legionStep=x.ability.definition?.effects?.find(step=>step.op==="seek-mate"),namedCallStep=x.ability.definition?.effects?.find(step=>step.op==="search-deck-named-call-to-rearguard"),deckDropStep=x.ability.definition?.effects?.find(step=>step.op==="search-deck-or-drop-named-to-hand"),rideStep=x.ability.definition?.effects?.find(step=>step.op==="ride-top-five-named-card");discardEffect=x.ability.definition?.effects?.find(step=>step.op==="discard-from-hand"||step.op==="draw-then-discard"||step.op==="search-top-grade-three-to-hand-then-discard"||step.op==="search-deck-named-grade-three-then-discard"),needsFieldTarget=Boolean(x.ability.definition?.effects?.some(step=>step.target==="chosen"&&["modify-power-target","retire-target","stand-target","rest-target","unlock-target","protect-target"].includes(step.op)))&&!pool&&(!x.ability.definition?.effects?.some(step=>step.op==="revelation-choice")||x.effectChoice==="soul");if(x.ability.definition?.effects?.some(step=>step.op==="revelation-choice")&&!Object.hasOwn(x,"revelationTopUid")){x.revelationTopUid=revelationTop?.uid||null;x.revelationTopCardId=revelationTop?.cardId||null}let html='';const discardedReturnStep=x.ability.definition?.effects?.find(step=>step.op==="return-trigger-discard-to-hand");if(discardedReturnStep){const card=pool?.cards?.[0],definition=card&&cardMap.get(card.cardId);html+='<h3>Choose the card discarded by this event to return to your hand</h3>'+(card&&definition?'<button class="zone-view-card'+(x.effectUid===card.uid?' selected':'')+'" type="button" data-ability-card="'+escapeHtml(card.uid)+'">'+cardImage(definition)+'<b>'+escapeHtml(definition.name)+'</b><small>Discarded by this event</small></button>':'<p class="zone-empty-message">The discarded card is no longer in your Drop.</p>');if(!card||x.effectUid!==card.uid)$("#ability-accept").disabled=true}if(rideStep){const lookedAt=pool?.lookedAt||[],eligible=new Set(pool?.cards.map(card=>card.uid)||[]),remaining=lookedAt.filter(card=>card.uid!==x.effectUid);if(!Array.isArray(x.deckBottomUids)||x.deckBottomUids.length!==remaining.length||new Set(x.deckBottomUids).size!==remaining.length||x.deckBottomUids.some(uid=>!remaining.some(card=>card.uid===uid)))x.deckBottomUids=remaining.map(card=>card.uid);html+='<h3>Look at the top '+lookedAt.length+' card'+(lookedAt.length===1?'':'s')+' of your Deck</h3><div class="ability-cost-group">'+lookedAt.map(card=>{const definition=cardMap.get(card.cardId),eligibleCard=eligible.has(card.uid);return eligibleCard?'<button class="zone-view-card'+(x.effectUid===card.uid?' selected':'')+'" type="button" data-ability-card="'+escapeHtml(card.uid)+'">'+cardImage(definition)+'<b>'+escapeHtml(definition?.name||'Card')+'</b><small>Ride this card</small></button>':'<div class="zone-view-card">'+cardImage(definition)+'<b>'+escapeHtml(definition?.name||'Card')+'</b></div>'}).join('')+'</div><button class="button" type="button" data-ability-no-ride>Do not ride a card</button><h3>Put the remaining cards on the bottom of your Deck</h3><p>The first card below becomes the bottommost card. Use the arrows to choose their order.</p><ol>'+x.deckBottomUids.map((uid,index)=>{const card=remaining.find(item=>item.uid===uid),definition=card&&cardMap.get(card.cardId);return '<li><span>'+escapeHtml(definition?.name||'Card')+'</span> <button class="button" type="button" data-bottom-up="'+index+'"'+(index===0?' disabled':'')+'>↑</button> <button class="button" type="button" data-bottom-down="'+index+'"'+(index===x.deckBottomUids.length-1?' disabled':'')+'>↓</button></li>'}).join('')+'</ol>'}if(deckDropStep){html+='<h3>Choose a search zone</h3><button class="button'+(x.effectSourceZone==='deck'?' button-primary':'')+'" type="button" data-ability-source-zone="deck">Deck</button><button class="button'+(x.effectSourceZone==='drop'?' button-primary':'')+'" type="button" data-ability-source-zone="drop">Drop</button>';if(x.effectSourceZone){html+='<button class="button" type="button" data-ability-no-search-card>Choose no card</button>';if(pool.cards.length)html+='<h3>Choose up to one exact-name card from '+(x.effectSourceZone==='deck'?'your Deck':'your Drop')+'</h3><div class="ability-cost-group">'+pool.cards.map(card=>{const definition=cardMap.get(card.cardId);return '<button class="zone-view-card'+(x.effectUid===card.uid?' selected':'')+'" type="button" data-ability-card="'+escapeHtml(card.uid)+'">'+cardImage(definition)+'<b>'+escapeHtml(definition?.name||'Card')+'</b></button>'}).join('')+'</div>';else html+='<p class="zone-empty-message">No matching card in that zone. You may still choose this zone.</p>'}}if(legionStep){const drops=(p.drop||[]);x.legionDropUids=Array.isArray(x.legionDropUids)?x.legionDropUids.filter(uid=>drops.some(card=>card.uid===uid)):[];html+='<h3>Seek Mate · choose four cards from your Drop to return to your deck</h3><div class="ability-cost-group">'+drops.map((card,index)=>{const def=cardMap.get(card.cardId),selected=x.legionDropUids.includes(card.uid);return def?'<button class="zone-view-card'+(selected?' selected':'')+'" type="button" data-legion-drop="'+escapeHtml(card.uid)+'" aria-pressed="'+selected+'"><b>'+(index+1)+'. '+escapeHtml(def.name)+'</b><small>'+(selected?'Selected to return':'Drop')+'</small></button>':''}).join('')+'</div>';if(x.legionDropUids.length!==4)$('#ability-accept').disabled=true;html+='<h3>Search for '+escapeHtml(legionStep.mateName)+' (optional)</h3><button class="button" type="button" data-ability-clear-card>Do not search</button>';if(pool.cards.length)html+='<div class="ability-cost-group">'+pool.cards.map(card=>{const def=cardMap.get(card.cardId);return def?'<button class="zone-view-card'+(x.effectUid===card.uid?' selected':'')+'" type="button" data-ability-card="'+escapeHtml(card.uid)+'" aria-pressed="'+(x.effectUid===card.uid)+'">'+cardImage(def)+'<b>'+escapeHtml(def.name)+'</b></button>':''}).join('')+'</div>';else html+='<p class="zone-empty-message">No matching card in deck.</p>'}if(x.ability.definition?.effects?.some(step=>step.op==="engorge")){const units=fieldUnits(x.side).filter(field=>field.zone!=="vanguard"&&field.instance.uid!==x.instance.uid);x.engorgeTargetUids=Array.isArray(x.engorgeTargetUids)?x.engorgeTargetUids.filter(uid=>units.some(field=>field.instance.uid===uid)):[];html+="<h3>Engorge · choose one or more of your other Rear-Guards to retire</h3><div class=\"ability-cost-group\">"+units.map(field=>{const card=cardMap.get(field.instance.cardId),selected=x.engorgeTargetUids.includes(field.instance.uid);return card?"<button class=\"zone-view-card"+(selected?" selected":"")+"\" type=\"button\" data-engorge-target=\""+escapeHtml(field.instance.uid)+"\" aria-pressed=\""+selected+"\">"+cardImage(card)+"<b>"+escapeHtml(card.name)+"</b><small>"+escapeHtml(field.zone)+"</small></button>":""}).join("")+"</div>"+(units.length?"":"<p class=\"zone-empty-message\">No other Rear-Guards can be selected.</p>")}if(x.ability.definition?.effects?.some(step=>step.op==="revelation-choice")){const topDef=x.revelationTopCardId&&cardMap.get(x.revelationTopCardId);html+='<h3>Revelation · look at the top card</h3>'+(topDef?'<div class="ability-cost-group"><div class="zone-view-card">'+cardImage(topDef)+'<b>'+escapeHtml(topDef.name)+'</b></div></div>':'<p>Your deck is empty.</p>')+(revelationTop?.uid!==x.revelationTopUid?'<p class="zone-empty-message">The top card changed. This choice is no longer valid.</p>':'')+'<h3>Choose whether to put the top card of your deck into your soul</h3><button class="button'+(x.effectChoice==="soul"?' button-primary':'')+'" type="button" data-ability-choice="soul">Put it into my soul</button><button class="button'+(x.effectChoice==="keep-top"?' button-primary':'')+'" type="button" data-ability-choice="keep-top">Keep it on top</button>';if(x.effectChoice!=="soul"&&x.effectChoice!=="keep-top")$("#ability-accept").disabled=true}if(discardEffect){const drawThenDiscard=discardEffect.op==="draw-then-discard",searchThenDiscard=discardEffect.op==="search-top-grade-three-to-hand-then-discard",searchNamedThenDiscard=discardEffect.op==="search-deck-named-grade-three-then-discard",threshold=drawThenDiscard?1:Number(discardEffect.condition?.count||0),searchedCard=(searchThenDiscard||searchNamedThenDiscard)&&x.effectUid?p.deck.find(card=>card.uid===x.effectUid):null,options=[...(p.hand||[]),...(drawThenDiscard&&p.deck?.length?[p.deck[p.deck.length-1]]:[]),...(searchedCard?[searchedCard]:[])],needsDiscard=drawThenDiscard?Boolean(p.deck?.length):searchThenDiscard?Boolean(searchedCard):searchNamedThenDiscard?Boolean((p.hand||[]).length||searchedCard):p.hand.length>=threshold;if(!options.some(card=>card.uid===x.effectDiscardUid))x.effectDiscardUid=null;if(needsDiscard)html+='<h3>'+(drawThenDiscard?'Choose a card to discard after drawing':(searchThenDiscard||searchNamedThenDiscard)?'Choose a card to discard after the search':'Choose a card to discard after this unit is protected')+'</h3><div class="ability-cost-group">'+options.map((card,index)=>{const definition=cardMap.get(card.cardId),topDraw=drawThenDiscard&&p.deck?.length&&card.uid===p.deck[p.deck.length-1]?.uid&&!p.hand.some(item=>item.uid===card.uid),searched=(searchThenDiscard||searchNamedThenDiscard)&&card.uid===x.effectUid;return definition?'<button class="zone-view-card'+(x.effectDiscardUid===card.uid?' selected':'')+'" type="button" data-ability-discard="'+escapeHtml(card.uid)+'" aria-pressed="'+(x.effectDiscardUid===card.uid)+'">'+cardImage(definition)+'<b>'+escapeHtml(definition.name)+'</b><small>'+(topDraw?'Top card drawn first':searched?'Revealed card added to hand first':'Hand')+'</small></button>':''}).join('')+'</div>'}if(x.ability.definition?.effects?.some(step=>step.op==="reorder-deck-card")&&pool?.cards.length===1&&!x.effectUid)x.effectUid=pool.cards[0].uid;if(pool&&!legionStep&&!deckDropStep&&!rideStep){const optionalSearch=x.ability.definition?.effects?.some(step=>step.op==="search-top-up-to-one-grade-to-hand"||step.op==="search-top-up-to-one-filtered-to-hand"||step.op==="move-filtered-hand-card-to-soul"||step.op==="search-deck-named-grade-three-then-discard"||step.op==="search-deck-same-name-to-hand"||step.op==="search-deck-named-call-to-rearguard");if(optionalSearch)html+="<button class=\"button\" type=\"button\" data-ability-clear-card>Choose no card</button>";const calling=/\bcall\b|\bforerunner\b/i.test(t);if(!x.effectUid){html+=`<h3>Choose a card from your ${pool.label}</h3><div class="ability-cost-group">${pool.cards.map(c=>{const card=cardMap.get(c.cardId),eligible=card&&(!calling||isUnitCard(card))&&(!calling||gradeOf(card)<=Number(cardMap.get(p.vanguard?.cardId)?.grade||0)),selected=x.effectUid===c.uid;return card&&eligible?`<button class="zone-view-card${selected?' selected':''}" type="button" data-ability-card="${escapeHtml(c.uid)}" aria-pressed="${selected}">${cardImage(card)}<b>${escapeHtml(card.name)}</b></button>`:''}).join('')||'<p class="zone-empty-message">No eligible cards.</p>'}</div>`}else{const chosen=pool.cards.find(c=>c.uid===x.effectUid),chosenCard=chosen&&cardMap.get(chosen.cardId);html+=`<p>Selected: <b>${escapeHtml(chosenCard?.name||'card')}</b> (${pool.label}).</p><button class="button" type="button" data-ability-clear-card>Choose a different card</button>`;if(calling){const zones=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right',...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)].filter((_,i)=>namedCallStep?(!p.rear[i]||namedCallStep.opensSourceCircle&&p.rear[i]?.uid===x.instance.uid):(!/\bforerunner\b/i.test(t)||!p.rear[i]));if(x.callZone&&!zones.includes(x.callZone))x.callZone=null;html+=`<h3>Choose an open Rear-Guard circle</h3>${zones.map(z=>`<button class="button${x.callZone===z?' button-primary':''}" type="button" data-ability-zone="${z}">${z.replace('rear-','Rear-Guard ').replace('accel-','Accel ')}</button>`).join('')}`}}}if(needsFieldTarget){const enemy=/opponent|opposing/i.test(t),owner=enemy?(x.side==='human'?'bot':'human'):x.side;let units=fieldUnits(owner).map(f=>({...f,side:owner}));if(/rear-guards?/i.test(t))units=units.filter(f=>f.zone!=='vanguard');const targetFilter=x.ability.definition?.effects?.find(step=>step.target==='chosen')?.targetFilter,targetEffect=x.ability.definition?.effects?.find(step=>step.target==='chosen'),optionalTarget=targetEffect?.optionalTarget===true;if(x.ability.definition?.effects?.some(step=>step.op==="stand-target"))units=units.filter(f=>f.instance.rested);if(x.ability.definition?.effects?.some(step=>step.op==="rest-target"))units=units.filter(f=>!f.instance.rested);units=units.filter(f=>window.VanguardAbilityEngine.matchesTargetFilter(targetFilter||{},{source:x.instance,sourceControllerPlayerId:x.instance.controllerPlayerId||p.playerId,target:f.instance,targetControllerPlayerId:f.instance.controllerPlayerId||match.players[f.side]?.playerId,opponentPlayerId:match.players[enemy?(x.side==='human'?'bot':'human'):x.side]?.playerId,targetCard:cardMap.get(f.instance.cardId),targetZone:f.zone,isBeingAttacked:match.pendingAttack?.targetUid===f.instance.uid}));if(/same column/i.test(t)&&x.eventContext?.subjectZone){const column=rearColumn(x.eventContext.subjectZone);units=units.filter(f=>rearColumn(findFieldCard(f.instance.uid)?.zone)===column)}x.optionalNoTarget=/if no units were retired/i.test(t)&&units.length===0;if(optionalTarget){if(!units.length){x.optionalNoTarget=true;x.targetUid=null}html+="<h3>Optional target</h3><button class=\"button"+(x.optionalNoTarget?" button-primary":"")+"\" type=\"button\" data-ability-no-target>Choose no target</button>";if(units.length&&!x.targetUid&&!x.optionalNoTarget)$("#ability-accept").disabled=true}html+=`<h3>Choose a target</h3><div class="ability-cost-group">${units.map(f=>{const c=cardMap.get(f.instance.cardId);return c?`<button class="zone-view-card${x.targetUid===f.instance.uid?' selected':''}" type="button" data-ability-target="${escapeHtml(f.instance.uid)}" aria-pressed="${x.targetUid===f.instance.uid}">${cardImage(c)}<b>${escapeHtml(c.name)}</b><small>${escapeHtml(f.zone)}</small></button>`:''}).join('')||'<p class="zone-empty-message">No legal targets.</p>'}</div>`}if(x.ability.definition?.effects?.some(step=>step.op==="reorder-deck-card")){html+='<h3>Choose where to put the revealed card</h3>';html+='<button class="button'+(x.deckDestination==="top"?' button-primary':'')+'" type="button" data-deck-destination="top">Top of deck</button>';html+='<button class="button'+(x.deckDestination==="bottom"?' button-primary':'')+'" type="button" data-deck-destination="bottom">Bottom of deck</button>'}const gGuardianCharge=x.ability.definition?.effects?.find(step=>step.op==="g-guardian-discard-charge-choice");if(gGuardianCharge){html+="<h3>Choose one charge effect</h3><button class=\"button"+(x.chargeChoice==="counter-charge"?" button-primary":"")+"\" type=\"button\" data-ability-charge=\"counter-charge\">Counter Charge 1</button><button class=\"button"+(x.chargeChoice==="soul-charge"?" button-primary":"")+"\" type=\"button\" data-ability-charge=\"soul-charge\">Soul Charge 1</button>";if(x.chargeChoice==="counter-charge"){const faceDown=(p.damage||[]).filter(card=>card.faceDown),required=Math.min(1,faceDown.length);x.damageUids=(x.damageUids||[]).filter(uid=>faceDown.some(card=>card.uid===uid));if(required===1)html+="<h3>Choose a face-down damage card</h3><div class=\"ability-cost-group\">"+faceDown.map(card=>{const c=cardMap.get(card.cardId),selected=x.damageUids.includes(card.uid);return c?"<button class=\"zone-view-card"+(selected?" selected":"")+"\" type=\"button\" data-ability-damage=\""+escapeHtml(card.uid)+"\" aria-pressed=\""+selected+"\">"+cardImage(c)+"<b>"+escapeHtml(c.name)+"</b></button>":""}).join("")+"</div>";if(x.damageUids.length!==required)$("#ability-accept").disabled=true}else x.damageUids=[];if(!x.effectUid||!x.chargeChoice)$("#ability-accept").disabled=true}const chargeStep=x.ability.definition?.effects?.find(step=>step.op==="counter-charge");if(chargeStep){const faceDown=(p.damage||[]).filter(card=>card.faceDown),required=Math.min(Number(chargeStep.count)||0,faceDown.length);x.damageUids=Array.isArray(x.damageUids)?x.damageUids.filter(uid=>faceDown.some(card=>card.uid===uid)):[];if(faceDown.length<=Number(chargeStep.count))x.damageUids=faceDown.map(card=>card.uid);html+='<h3>Counter-Charge · choose '+required+' face-down damage card'+(required===1?'':'s')+'</h3><div class="ability-cost-group">'+faceDown.map(card=>{const c=cardMap.get(card.cardId),selected=x.damageUids.includes(card.uid);return c?'<button class="zone-view-card'+(selected?' selected':'')+'" type="button" data-ability-damage="'+escapeHtml(card.uid)+'" aria-pressed="'+selected+'">'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b></button>':''}).join('')+(faceDown.length?'':'<p class="zone-empty-message">No face-down damage; Counter-Charge resolves as much as possible.</p>')+'</div>';$("#ability-accept").disabled=x.damageUids.length!==required;}const lockedCallStep=x.ability.definition?.effects?.find(step=>step.op==="call-checked-card-locked");if(lockedCallStep){const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)],legal=zones.map((zone,index)=>({zone,index})).filter(item=>item.index<p.rear.length&&p.rear[item.index]?.locked!==true);if(legal.length){html+='<h3>Choose a Rear-Guard circle for the locked card</h3>'+legal.map(({zone,index})=>`<button class="button${x.callZone===zone?' button-primary':''}" type="button" data-ability-zone="${zone}">${zone.replace('rear-','Rear-Guard ').replace('accel-','Accel ')}${p.rear[index]?' · retire the unit there':''}</button>`).join('')}else html+='<p>No Rear-Guard circle is available; the card and battle bonuses will not be applied.</p>'}
const forerunnerCallStep=x.ability.definition?.effects?.find(step=>step.op==="call-source-from-soul");if(forerunnerCallStep){const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)],legal=zones.map((zone,index)=>({zone,index})).filter(item=>item.index<p.rear.length&&p.rear[item.index]===null);if(legal.length){html+="<h3>Choose an open Rear-Guard circle</h3>"+legal.map(({zone})=>`<button class="button${x.callZone===zone?' button-primary':''}" type="button" data-ability-zone="${zone}">${zone.replace('rear-','Rear-Guard ' ).replace('accel-','Accel ')}</button>`).join('')}else html+="<p>No open Rear-Guard circle is available for Forerunner.</p>"}const dropRestCallStep=x.ability.definition?.effects?.find(step=>step.op==="call-source-from-drop-rested");if(dropRestCallStep){const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)],legal=zones.map((zone,index)=>({zone,index})).filter(item=>item.index<p.rear.length&&p.rear[item.index]?.locked!==true);if(legal.length){html+='<h3>Choose a Rear-Guard circle</h3>'+legal.map(({zone,index})=>`<button class="button${x.callZone===zone?' button-primary':''}" type="button" data-ability-zone="${zone}">${zone.replace('rear-','Rear-Guard ').replace('accel-','Accel ')}${p.rear[index]?' · retire the unit there':''}</button>`).join('')}else html+='<p>No legal Rear-Guard circle is available.</p>'}
const anyCircleCallStep=lockedCallStep||dropRestCallStep;if(anyCircleCallStep){const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)],legal=zones.map((zone,index)=>({zone,index})).filter(item=>item.index<p.rear.length&&p.rear[item.index]?.locked!==true);if(legal.length&&!legal.some(item=>item.zone===x.callZone))$("#ability-accept").disabled=true}
if(deckDropStep&&!x.effectSourceZone)$("#ability-accept").disabled=true;if(rideStep){const remaining=(pool?.lookedAt||[]).filter(card=>card.uid!==x.effectUid);if(!Array.isArray(x.deckBottomUids)||x.deckBottomUids.length!==remaining.length||new Set(x.deckBottomUids).size!==remaining.length||x.deckBottomUids.some(uid=>!remaining.some(card=>card.uid===uid)))$("#ability-accept").disabled=true;}const markerStep=x.ability.definition?.effects?.find(step=>step.op==="place-circle-marker");if(markerStep){const zones=[...(markerStep.circleTypes.includes("vanguard")&&p.vanguard&&!((p.giftZones||[]).some(marker=>marker?.zone==="vanguard"&&marker?.type===markerStep.markerType))?[{zone:"vanguard"}]:[]),...["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)].map((zone,index)=>({zone,index})).filter(item=>((markerStep.markerType==="Dragontree"&&item.zone.startsWith("accel-"))||item.index<p.rear.length)&&!((p.giftZones||[]).some(marker=>marker?.zone===item.zone&&marker?.type===markerStep.markerType)))];if(x.circleZone&&!zones.some(item=>item.zone===x.circleZone))x.circleZone=null;const markerName=markerStep.markerType==="Dragontree"?"Dragontree":"Treasures";html+=`<h3>Choose one of your ${markerStep.circleTypes.includes("vanguard")?"VC or ":""}RC without a ${markerName} marker</h3>`+zones.map(item=>`<button class="button${x.circleZone===item.zone?' button-primary':''}" type="button" data-circle-marker-zone="${item.zone}">${item.zone.replace('rear-','Rear-Guard ').replace('accel-','Accel ')}</button>`).join("")+(zones.length?"":"<p class=\"zone-empty-message\">There is no legal circle for a "+markerName+" marker.</p>");if(!x.circleZone)$("#ability-accept").disabled=true;}html+=renderGuardianReplacementChoice(x);box.innerHTML=html;if(namedCallStep&&x.effectUid&&!x.callZone)$("#ability-accept").disabled=true;const guardianChoice=x.ability.definition?.effects?.some(step=>step.op==="g-guardian-grade-three-replacement-choice");if(guardianChoice&&(!x.effectChoice||!x.targetUid))$("#ability-accept").disabled=true;const chosenStep=x.ability.definition?.effects?.find(step=>step.target==="chosen"&&["modify-power-target","retire-target","stand-target","rest-target","unlock-target","protect-target"].includes(step.op));if(chosenStep&&!(chosenStep.op==="rest-target"&&x.effectChoice!=="soul")&&!x.targetUid&&!(chosenStep.noOpIfNoLegalTargets&&!abilityTargetChoices(x.side,x,x.ability,x.eventContext||{}).length)&&!(chosenStep.optionalTarget&&(x.optionalNoTarget||!abilityTargetChoices(x.side,x,x.ability,x.eventContext||{}).length)))$("#ability-accept").disabled=true;if(x.ability.definition?.effects?.some(step=>step.op==="engorge")&&!(x.engorgeTargetUids||[]).length)$("#ability-accept").disabled=true;if(discardEffect&&((discardEffect.op==="draw-then-discard"&&Boolean(p.deck?.length))||((discardEffect.op==="search-top-grade-three-to-hand-then-discard"&&Boolean(x.effectUid))||(discardEffect.op==="search-deck-named-grade-three-then-discard"&&Boolean((p.hand||[]).length||x.effectUid)))||(discardEffect.op!=="draw-then-discard"&&discardEffect.op!=="search-top-grade-three-to-hand-then-discard"&&discardEffect.op!=="search-deck-named-grade-three-then-discard"&&(p.hand||[]).length>=Number(discardEffect.condition?.count||0)))&&!x.effectDiscardUid)$("#ability-accept").disabled=true}
  function renderGuardianReplacementChoice(x){const step=x.ability.definition?.effects?.find(item=>item.op==="g-guardian-grade-three-replacement-choice");if(!step)return"";const choices=step.choices||[],choice=choices.find(item=>item.id===x.effectChoice);let html='<h3>Choose one G-Guardian effect</h3>'+choices.map(item=>'<button class="button'+(x.effectChoice===item.id?' button-primary':'')+'" type="button" data-ability-choice="'+escapeHtml(item.id)+'">'+(item.id==='vanguard-power'?'Your vanguard gets +10000 power':'An opponent unit gets -2 critical')+'</button>').join('');if(choice){const opposing=x.side==='human'?'bot':'human',owner=choice.targetFilter.controller==='opponent'?opposing:x.side;let units=fieldUnits(owner).map(f=>({...f,side:owner}));units=units.filter(f=>window.VanguardAbilityEngine.matchesTargetFilter(choice.targetFilter,{source:x.instance,sourceControllerPlayerId:x.instance.controllerPlayerId||match.players[x.side]?.playerId,target:f.instance,targetControllerPlayerId:f.instance.controllerPlayerId||match.players[f.side]?.playerId,opponentPlayerId:match.players[opposing]?.playerId,targetCard:cardMap.get(f.instance.cardId),targetZone:f.zone}));html+='<h3>Choose a unit</h3><div class="ability-cost-group">'+units.map(f=>{const c=cardMap.get(f.instance.cardId);return c?'<button class="zone-view-card'+(x.targetUid===f.instance.uid?' selected':'')+'" type="button" data-ability-target="'+escapeHtml(f.instance.uid)+'">'+cardImage(c)+'<b>'+escapeHtml(c.name)+'</b><small>'+escapeHtml(f.zone)+'</small></button>':''}).join('')+'</div>'}return html}
  function resolveReviewedAbility(x,definition){
    const player=match?.players?.[x.side],fieldNow=findFieldCard(x.instance?.uid),sourceInstance=fieldNow?.instance||findMatchInstance(x.instance?.uid),ability=x.ability,triggerControllerPlayerId=x.triggerControllerPlayerId||sourceInstance?.controllerPlayerId,eventContext={...x.eventContext,triggerControllerPlayerId},field=(fieldNow||sourceInstance)?{side:x.side,zone:window.VanguardAbilityEngine.abilitySourceZoneAtResolution(ability,{...x,eventContext},fieldNow?.zone)||eventContext.sourceZone||eventContext.zone||x.field||"soul",instance:sourceInstance}:null;
    if(!player||!field||field.instance.cardId!==x.instance.cardId||!window.VanguardAbilityEngine.canResolveAbilitySource(ability,{...x,eventContext,triggerControllerPlayerId},player.playerId,sourceInstance,Boolean(fieldNow))){toast("This ability source is no longer controlled by you.");return false;}
    if(!abilityRequirementsMet(ability,x.side,field,eventContext)){toast("This ability no longer meets its activation conditions.");return false;}
    if(x.skipCostPayment&&ability.kind==="AUTO"&&((ability.costs||[]).length||(ability.costAlternatives||[]).length)){addLog((cardMap.get(field.instance.cardId)?.name||"A unit")+" resolved its AUTO ability without paying the cost.");return true;}const costs={cb:abilityCostCount(ability,"counter-blast",ability.costAlternatives?.[x.costAlternativeIndex]),sb:abilityCostCount(ability,"soul-blast",ability.costAlternatives?.[x.costAlternativeIndex]),discard:abilityCostCount(ability,"discard",ability.costAlternatives?.[x.costAlternativeIndex]),sourceToSoul:abilityCostCount(ability,"source-to-soul",ability.costAlternatives?.[x.costAlternativeIndex]),sourceRetire:abilityCostCount(ability,"source-retire",ability.costAlternatives?.[x.costAlternativeIndex])},selection=x.costSelections||{cb:[],sb:[],discard:[]};
    const cb=(player.damage||[]).filter(card=>selection.cb?.includes(card.uid)&&!card.faceDown),sb=(player.soul||[]).filter(card=>selection.sb?.includes(card.uid)),discard=(player.hand||[]).filter(card=>selection.discard?.includes(card.uid)&&card.uid!==field.instance.uid);
    if(cb.length!==costs.cb||sb.length!==costs.sb||discard.length!==costs.discard||(costs.sourceToSoul!==0&&!findFieldCard(field.instance.uid))){toast("Choose exactly the cards required to pay this ability's cost.");return false;}
    const guardianChoiceStep=definition.effects.find(step=>step.op==="g-guardian-grade-three-replacement-choice"),guardianChoice=guardianChoiceStep?.choices?.find(choice=>choice.id===x.effectChoice),revelationStep=definition.effects.find(step=>step.op==="revelation-choice"),targetStep=definition.effects.find(step=>step.target==="chosen"||step.target==="boosted-unit")||(guardianChoice?{target:"chosen",targetFilter:guardianChoice.targetFilter}:null),targetUid=targetStep?.target==="boosted-unit"?(x.eventContext?.boostedUid||null):x.targetUid,targetField=targetUid?findFieldCard(targetUid):null,targetCard=targetField?cardMap.get(targetField.instance.cardId):null;
    if(guardianChoiceStep&&!guardianChoice){toast("Choose one of the available G-Guardian effects.");return false;}if(revelationStep&&! ["soul","keep-top"].includes(x.effectChoice)){toast("Choose whether to put the revealed card into your soul.");return false;}
    const optionalNoTarget=targetStep?.optionalTarget===true&&x.optionalNoTarget===true,noLegalTarget=Boolean((targetStep?.noOpIfNoLegalTargets||targetStep?.optionalTarget)&&!targetUid&&!abilityTargetChoices(x.side,field,ability,eventContext).length),skipRestTarget=targetStep?.op==="rest-target"&&x.effectChoice!=="soul";if(targetStep&&!skipRestTarget&&!optionalNoTarget&&!noLegalTarget&&(!targetField||!window.VanguardAbilityEngine.matchesTargetFilter(targetStep.targetFilter,{source:field.instance,sourceControllerPlayerId:field.instance.controllerPlayerId||player.playerId,target:targetField.instance,targetControllerPlayerId:targetField.instance.controllerPlayerId||match.players[targetField.side]?.playerId,opponentPlayerId:match.players[flipSide(x.side)]?.playerId,targetCard,targetZone:targetField.zone,isBeingAttacked:match.pendingAttack?.targetUid===targetField.instance.uid}))){toast("Choose a target that meets this ability's conditions.");return false;}if(targetStep?.optionalTarget===true&&!optionalNoTarget&&!targetUid&& !noLegalTarget){toast("Choose a target or choose no target.");return false;}
    const reorderStep=definition.effects.find(step=>step.op==="reorder-deck-card"),reorderPool=reorderStep?abilityChoicePool(x):null,selectedEffectCard=reorderStep?reorderPool?.cards.find(card=>card.uid===x.effectUid):null;const context={source:field.instance,player,side:x.side,sidePlayerId:player.playerId,sourceZone:field.zone,turnSide:match.side,controllerRearGuards:(player.rear||[]).filter(Boolean).length,controllerFieldCards:[...(player.vanguard?[player.vanguard]:[]),...(player.rear||[]).filter(Boolean)].map(instance=>({uid:instance.uid,clan:cardMap.get(instance.cardId)?.clan,clans:cardMap.get(instance.cardId)?.clans||[],hasLimitBreak4:instance.hasLimitBreak4===true})),controllerRearGuardClans:(player.rear||[]).filter(Boolean).map(instance=>({uid:instance.uid,clans:(cardMap.get(instance.cardId)?.clans||[]).length?cardMap.get(instance.cardId).clans:cardMap.get(instance.cardId)?.clan?[cardMap.get(instance.cardId).clan]:[]})),opponentRearGuards:(match.players[flipSide(x.side)]?.rear||[]).filter(Boolean).length,match,battleId:eventContext.battleId||null,effectChoice:x.effectChoice||null,circleZone:x.circleZone||null,selectedCard:selectedEffectCard,chargeChoice:x.chargeChoice||null,checkedCard:eventContext.subjectInstance||null,checkedCardInstanceId:eventContext.subjectUid||eventContext.checkedCardInstanceId||null,callZone:x.callZone||null,cardDefinitionForId:id=>cardMap.get(id),opponentVanguardGrade:gradeOf(cardMap.get(match.players[flipSide(x.side)]?.vanguard?.cardId)),shieldValueForInstance:card=>effectiveShieldValue(card,x.side,"guardian"),deckDestination:x.deckDestination,sourceInPlay:Boolean(fieldNow&&fieldNow.side===x.side),eventId:eventContext.eventId||null,triggerEvent:eventContext.gameEvent||null,actorPlayerId:player.playerId||x.side,sourceBindCostPaid:false,eventSubjectUid:eventContext.subjectUid||null,harmonySameColumnAtTrigger:eventContext.harmonySameColumnAtTrigger===true,harmonyTurnKey:`${match.turn}:${match.side}`,noLegalTarget,target:targetField?.instance||null,targetInPlay:Boolean(targetField),targetControllerPlayerId:targetField?.instance.controllerPlayerId||match.players[targetField?.side]?.playerId,targetSide:targetField?.side||null,targetPlayer:targetField?match.players[targetField.side]:null,opponentPlayerId:match.players[flipSide(x.side)]?.playerId,targetCard,targetZone:targetField?.zone||null,sourceControllerPlayerId:triggerControllerPlayerId||player.playerId,revelationTopUid:x.revelationTopUid??null,engorgeTargetUids:x.engorgeTargetUids||[],engorgeTargetZones:Object.fromEntries(fieldUnits(x.side).filter(field=>(x.engorgeTargetUids||[]).includes(field.instance.uid)).map(field=>[field.instance.uid,field.zone])),selectedDamageUids:x.damageUids||[],effectDiscardUid:x.effectDiscardUid||null,effectUid:x.effectUid||null,effectSourceZone:x.effectSourceZone||null,deckBottomUids:x.deckBottomUids||[],legionDropUids:x.legionDropUids||[],shuffleDeck:shuffle,cardDefinitionForInstance:card=>cardMap.get(card.cardId),canRideCard:(rider,previous)=>{const riderDefinition=cardMap.get(rider.cardId),previousDefinition=cardMap.get(previous.cardId),crests=(player.crests||[]).map(crest=>cardMap.get(crest.cardId));return Boolean(riderDefinition&&previousDefinition&&isUnitCard(riderDefinition)&&riderDefinition.gDeckCard!==true&&rider.gDeckCard!==true&&rider.cannotBeRidden!==true&&window.VanguardAbilityEngine.canRideCard(riderDefinition,{vanguardCard:previousDefinition,crests}))},emitEvent:event=>{if(event?.type==="unit.became_engorged"){const engorged=findFieldCard(event.cardInstanceId);if(engorged)queueAbilityPrompts("engorge",engorged.side,event.cardInstanceId,{zone:engorged.zone,subjectInstance:engorged.instance,retiredCount:event.retiredCount,totalRetiredCount:event.totalRetiredCount,timingWindow:"engorge-resolution"});return}if(event?.type==="unit.legioned"){const leader=findMatchInstance(event.legionLeaderInstanceId||event.cardInstanceId);if(leader)queueAbilityPrompts("legion",x.side,leader.uid,{zone:"vanguard",currentLocation:"vanguard",subjectInstance:leader,subjectControllerPlayerId:leader.controllerPlayerId||player.playerId,sourceCardInstanceId:leader.uid,timingWindow:"seek-mate-resolution"});return}if(event?.type==="unit.became_harmony"){const unit=findFieldCard(event.cardInstanceId);if(unit)queueAbilityPrompts("harmony",unit.side,unit.instance.uid,{zone:unit.zone,subjectInstance:unit.instance,timingWindow:"harmony-association"});return}if(event?.type==="card.ridden"){const previousUid=event.targetCardInstanceIds?.[0],previous=previousUid&&findMatchInstance(previousUid);if(previous)queueAbilityPrompts("ride",x.side,previous.uid,{sourceZone:"vanguard",previousLocation:"vanguard",currentLocation:"soul",zone:"soul",subjectInstance:previous,timingWindow:event.timingWindow||"ability-ride"});return}if(event?.type==="card.placed"){const movedSide=event.controllerSide||x.side,moved=match.players[movedSide]?.guardCircle?.find(card=>card.uid===event.cardInstanceId);if(moved){queueAbilityPrompts("place",movedSide,event.cardInstanceId,{sourceZone:"guardian",previousLocation:event.previousLocation||"deck",zone:"guardian",currentLocation:"guardian",subjectInstance:moved,timingWindow:"effect-guardian-placement",battleId:match.pendingAttack?.battleId});return}const placed=findFieldCard(event.cardInstanceId);if(placed&&event.position!=="locked")queueAbilityPrompts("place",movedSide,event.cardInstanceId,{sourceZone:event.previousLocation||"hand",previousLocation:event.previousLocation||"hand",zone:placed.zone,currentLocation:placed.zone,subjectInstance:placed.instance,timingWindow:"effect-rear-placement",battleId:match.pendingAttack?.battleId});return}if(event?.type==="card.revealed"){const revealed=findMatchInstance(event.cardInstanceId);if(revealed)addLog(player.name+" revealed "+(cardMap.get(revealed.cardId)?.name||"a card")+".");return}if(event?.type==="card.drawn"){const drawn=findMatchInstance(event.cardInstanceId);if(drawn)queueAbilityPrompts("draw",x.side,drawn.uid,{sourceZone:"deck",currentLocation:"hand",subjectInstance:drawn,timingWindow:"effect-draw"});return}if(event?.type==="unit.stood"){const stood=findFieldCard(event.cardInstanceId);if(stood)queueAbilityPrompts("stand",stood.side,event.cardInstanceId,{zone:stood.zone,actingPlayerId:player.playerId||x.side,timingWindow:"effect-stand"});return}if(event?.type==="unit.unlocked"){const unlocked=findFieldCard(event.cardInstanceId);if(unlocked)queueAbilityPrompts("unlock",unlocked.side,event.cardInstanceId,{zone:unlocked.zone,actingPlayerId:player.playerId||x.side,timingWindow:"effect-unlock"});return}if(event?.type==="card.damage_moved"){const movedSide=event.controllerSide||x.side,moved=match.players[movedSide]?.damage?.find(card=>card.uid===event.cardInstanceId);if(moved)queueAbilityPrompts("damagePlace",movedSide,moved.uid,{zone:"damage",sourceZone:event.previousLocation||"deck",currentLocation:"damage",subjectInstance:moved,actingPlayerId:player.playerId||x.side,timingWindow:"effect-damage-placement"});return}if(event?.type!=="card.discarded"&&event?.type!=="card.moved"&&event?.type!=="card.retired"&&event?.type!=="card.bound")return;const movedSide=event.controllerSide||x.side,movedPlayer=match.players[movedSide],moved=[...(movedPlayer?.drop||[]),...(movedPlayer?.soul||[]),...(movedPlayer?.hand||[]),...(movedPlayer?.deck||[]),...(movedPlayer?.bind||[])].find(card=>card.uid===event.cardInstanceId);if(moved)queueMovedCardAbility(moved,movedSide,event.type==="card.discarded"?"discard":event.type==="card.retired"?"retire":event.type==="card.bound"?"bind":"move",event.previousLocation||"deck",{currentLocation:event.currentLocation||event.to||"soul",actingPlayerId:player.playerId||x.side,reason:event.reason||null,abilitySourceInstanceId:event.abilitySourceInstanceId||null})}};
    context.optionalNoTarget=optionalNoTarget||noLegalTarget;
    context.onEffectDeckOut=()=>{match.ended=true;match.loserSide=x.side;match.winnerSide=flipSide(x.side);match.endReason="deck-empty";match.pendingAttack=null;match.pendingAbility=null;match.pendingAbilities=[];match.pendingTrigger=null;match.pendingDamageQueue=[];match.deferredAbilityEvents=[];addLog(`${player.name} lost because the deck is empty.`);setMessage("Match over — the deck is empty.")};
    const handlers=window.VanguardAbilityEngine.EFFECT_HANDLERS;
    const ready=window.VanguardAbilityEngine.validateEffectProgram(definition.effects,handlers,context);if(!ready.ok){toast("This effect definition is not valid for the current game state.");return false;}
    match.effectResolutionDepth=(match.effectResolutionDepth||0)+1;let result;try{result=window.VanguardAbilityEngine.resolveEffectProgram(definition.effects,handlers,context,draft=>{const paymentContext={...draft,turnId:match.turn,actorPlayerId:player.playerId||x.side,side:x.side,sourceZone:field.zone,hasEnergyGenerator:hasEnergyGenerator(draft.player),cardDefinitionForInstance:card=>cardMap.get(card.cardId)},paid=window.VanguardAbilityEngine.payAbilityCosts(ability,paymentContext,{...selection,effectUid:x.effectUid,costAlternativeIndex:x.costAlternativeIndex});if(paid.ok&&paymentContext.sourceBindCostPaid)draft.sourceBindCostPaid=true;return paid.ok});}finally{match.effectResolutionDepth=Math.max(0,Number(match.effectResolutionDepth||1)-1);if(!match.effectResolutionDepth){const deferred=match.deferredAbilityEvents||[];match.deferredAbilityEvents=[];for(const event of deferred)if(event.kind==="movement")queueMovedCardAbility(event.instance,event.side,event.eventName,event.zone,event.eventContext);else queueAbilityPrompts(event.eventName,event.side,event.subjectUid,event.eventContext)}}if(!result.ok){toast("The validated ability effect could not resolve.");return false;}
    const revealed=definition.effects.some(step=>["search-top-grade-three-to-hand-then-discard","search-top-up-to-one-grade-to-hand","search-deck-named-grade-three-then-discard","search-deck-same-name-to-hand"].includes(step.op))?result.results.find(value=>value&&typeof value==="object"&&value.revealedCardId):null;if(revealed)addLog(player.name+" revealed "+(cardMap.get(revealed.revealedCardId)?.name||"a card")+" and put it into hand.");addLog((cardMap.get(field.instance.cardId)?.name||"A unit")+" resolved its reviewed ability.");return true;
  }
  function resolveAbility(x){if(x.ability?.definition?.effects)return resolveReviewedAbility(x,x.ability.definition);toast("This ability effect is not reviewed and supported yet; no cost was paid.");return false}
  function selectedHandCard() { return match?.players.human.hand.find((x) => x.uid === match.selected); }
  function hasIntercept(card) { return /\bIntercept\b/i.test(String(card?.text || "")) || /Intercept/i.test(String(card?.skill || "")) || cardAbilities(card).some(ability=>ability.definition?.keywords?.includes("intercept")); }
  function eligibleInterceptors() {
    const attack = match?.pendingAttack;
    if (!attack || attack.defenderSide !== "human" || attack.defenderDone) return [];
    const player = match.players.human;
    return (player.rear || []).map((unit, index) => ({ unit, index })).filter(({ unit, index }) => {
      if (!unit || index === attack.targetRearIndex || !(index < 2 || index >= 5)) return false;
      const card = cardMap.get(unit.cardId);
      return Number(card?.grade ?? -1) >= 2 || hasIntercept(card);
    }).map(({ unit }) => unit);
  }
    function openInterceptDialog() {
    const choices = eligibleInterceptors();
    if (!choices.length) { toast("Only a front-row Grade 2+ Rear-Guard (or a unit with Intercept) that is not being attacked can intercept."); return; }
    $("#intercept-card-list").innerHTML = choices.map((unit) => { const c = cardMap.get(unit.cardId); return c ? `<button class="zone-view-card" type="button" data-intercept-uid="${escapeHtml(unit.uid)}">${cardImage(c)}<b>Intercept · ${escapeHtml(c.name)}</b><small>${effectiveShieldValue(unit,"human").toLocaleString()} shield</small></button>` : ""; }).join("");
    $("#intercept-dialog").showModal();
  }
  function interceptWith(uid) {
    const unit = eligibleInterceptors().find((item) => item.uid === uid);
    if (!unit) { toast("That unit can no longer intercept."); return; }
    const player = match.players.human, index = player.rear.findIndex((item) => item?.uid === uid), shield = effectiveShieldValue(unit,"human");
    if (index < 0) return;
    player.rear[index] = null; player.guardCircle ||= []; match.pendingAttack.guardCards ||= [];
    player.guardCircle.push(unit); match.pendingAttack.guardCards.push(unit); match.pendingAttack.targetPower += shield;
    addLog(`${player.name} intercepted with ${cardMap.get(unit.cardId)?.name || "a Grade 2 Rear-Guard"} (+${shield.toLocaleString()} shield).`);queueAbilityPrompts("place","human",unit.uid,{sourceZone:"guardian",previousLocation:index<5?["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right"][index]:"accel-"+(index-4),zone:"guardian",currentLocation:"guardian",subjectInstance:unit,timingWindow:"guard-placement",battleId:match.pendingAttack?.battleId||null,targetUid:match.pendingAttack?.targetUid||null,targetZone:match.pendingAttack?.targetZone||null});
    match.selected = null; renderMatch();
  }
  function moveRearCardToZone(uid, zone) {
    const player = match.players.human;
    const rearZones = ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: player.accelZones || 0 }, (_, i) => `accel-${i + 1}`)];
    const from = player.rear.findIndex((item) => item?.uid === uid), to = rearZones.indexOf(zone);
    if (from < 0 || to < 0 || from === to) { match.moveRearUid = null; toast(from === to ? "That card is already in this circle." : "Choose an available Rear-Guard circle."); renderMatch(); return; }
    const moved = player.rear[from], displaced = player.rear[to];
    player.rear[to] = moved; player.rear[from] = displaced || null;
    queueMovedCardAbility(moved,"human","move",rearZones[from],{currentLocation:zone});
    if(displaced)queueMovedCardAbility(displaced,"human","move",zone,{currentLocation:rearZones[from]});
    match.moveRearUid = null; match.selected = null;
    addLog(displaced ? `${player.name} swapped two Rear-Guards.` : `${player.name} moved a Rear-Guard to another circle.`);
    renderMatch();
  }
  function draw(side) {
    const p = match.players[side]; if (!p.deck.length) return null;
    const card = p.deck.pop(); p.hand.push(card); queueAbilityPrompts("draw",side,card.uid,{sourceZone:"deck",currentLocation:"hand",subjectInstance:card,timingWindow:"draw"}); return card;
  }
  function fieldUnits(side) {
    const player = match.players[side];
    return [{ instance: player.vanguard, zone: "vanguard", label: "Vanguard" }, ...player.rear.map((instance, index) => ({ instance, zone: `rear-${index}`, label: `Rear-Guard ${index + 1}` }))].filter((item) => item.instance);
  }
  function abilityFieldUnits(side) {
    const units = fieldUnits(side);
    const leader = match.players[side]?.vanguard, mate = leader?.legionMate;
    if (mate?.uid && mate.legionLeaderInstanceId === leader?.uid) units.push({ instance: mate, zone: "vanguard", label: "Legion Mate" });
    return units;
  }
  function triggerKind(instance) {
    const card = cardMap.get(instance?.cardId); const value = String(card?.trigger || "").toLowerCase();
    return ["over", "critical", "draw", "stand", "heal", "front"].find((kind) => value.includes(kind)) || "";
  }
  function recordOpponentCheckTrigger(checkSide,instance,checkType){return window.VanguardAbilityEngine.recordOpponentTriggerCheck(match?.players,match?.players?.[checkSide]?.playerId,triggerKind(instance),checkType)}
  function isFrontRowZone(zone) { return zone === "vanguard" || zone === "rear-0" || zone === "rear-1" || (zone.startsWith("rear-") && Number(zone.slice(5)) >= 5); }
  function isSentinel(card) { return window.VanguardAbilityEngine.hasAbilityKeyword(cardAbilities(card),"sentinel")||/\bsentinel\b|perfect guard/i.test(String(card?.text||"")+" "+String(card?.type||"")); }
  function isGGuardCostCard(instance) { const card=cardMap.get(instance?.cardId);return triggerKind(instance)==="heal"||window.VanguardAbilityEngine.hasAbilityKeyword(card,"g-guardian-heal-cost-substitute"); }
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
    $("#public-reveal-card").dataset.cardId = card.id;
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
      const count = Math.min(10, Math.max(0, Number(attack.maxDriveChecks) || 0));
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
        if (zone) { const circleLabel = zone.startsWith("accel-") ? `Accel Circle ${zone.slice(6)}` : "Front Rear-Guard"; choices.push({ value: `target:${zone}:${unit.uid}`, label: `${circleLabel} · ${cardMap.get(unit.cardId)?.name || "Unit"}` }); }
      });
    }
    $("#attack-choice-buttons").innerHTML = choices.map((choice) => `<button class="button button-primary" type="button" data-attack-choice="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</button>`).join("");
    panel.hidden = false;
  }
  function renderBattleActionPrompt() {
    const panel = $("#battle-action-panel"), attack = match?.pendingAttack, choicePanel = $("#attack-choice-panel");
    if (!panel) return;
    if (!attack || attack.finishing || match.pendingAbility || match.pendingTrigger || match.pendingBattleEnd || match.pendingHitResolution || (match.pendingDamageQueue || []).length) { panel.hidden = true; return; }
    const buttons = $("#battle-action-buttons");
    let title = "", help = "", actions = [];
    if (attack.defenderSide === "human" && !attack.defenderDone && !attack.driveCountPrompt) {
      const player = match.players.human;
      const attackerGrade = Number(cardMap.get(match.players[attack.attackerSide]?.vanguard?.cardId)?.grade ?? -1);
      const ownGrade = Number(cardMap.get(player.vanguard?.cardId)?.grade ?? -1);
      title = "Defend this attack";
      help = "Choose how to defend. Your guard and G-Guard decisions stay on your screen.";
      actions.push({ id: "guard", label: "Guard" }, { id: "noGuard", label: "No guard" });
      const canGGuard = ownGrade >= 3 && attackerGrade >= 3 && player.hand.some(item => triggerKind(item) === "heal") && (player.gDeck || []).some(item => !item.faceUp && isGGuardian(cardMap.get(item.cardId)));
      if (canGGuard) actions.push({ id: "g-guard", label: "G-Guard" });
      if (eligibleInterceptors().length) actions.push({ id: "intercept", label: "Intercept" });
    } else if ((attack.attackerSide === "human" || !online.role) && attack.defenderDone && !attack.awaitingDrive && !attack.driveCountPrompt && Number(attack.driveChecksRemaining || 0) <= 0) {
      title = "Attack resolution complete";
      help = "Drive checks and attack effects are resolved. End the attack to continue.";
      actions.push({ id: "finishAttack", label: "End this attack" });
    } else if (attack.attackerSide === "human" && !attack.defenderDone) {
      title = "Waiting for defense";
      help = "The defending player is choosing whether and how to guard.";
    } else {
      panel.hidden = true;
      return;
    }
    $("#battle-action-title").textContent = title;
    $("#battle-action-help").textContent = help;
    buttons.innerHTML = actions.map(item => '<button class="button button-primary" type="button" data-battle-action="' + item.id + '">' + item.label + '</button>').join("");
    panel.hidden = false;
  }
  function hideAttackArrow(layer = document.getElementById("attack-arrow-layer")) {
    if (!layer) return;
    layer.hidden = true;
    layer.style.display = "none";
    layer.style.visibility = "hidden";
    layer.dataset.attackId = "";
  }
  function attackArrowIsSuppressed(attack) {
    return !attack?.targetUid || attack.finishing || Boolean(
      match?.pendingBattleEnd || match?.pendingHitResolution ||
      match?.pendingDamageQueue?.length || match?.pendingTrigger
    );
  }
  function dismissAttackArrow() {
    hideAttackArrow();
  }
  function renderAttackArrow() {
    const attack = match?.pendingAttack;
    let layer = document.getElementById("attack-arrow-layer");
    if (attackArrowIsSuppressed(attack)) { hideAttackArrow(layer); return; }
    if (!layer) {
      layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      layer.id = "attack-arrow-layer";
      layer.classList.add("attack-arrow-layer");
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    } else if (layer.parentElement !== document.body) document.body.appendChild(layer);
    const attackId = String(attack.battleId || (attack.attackerUid + ":" + attack.targetUid));
    const draw = () => {
      if (match?.pendingAttack !== attack || attackArrowIsSuppressed(attack)) { hideAttackArrow(layer); return; }
      const cards = Array.from(document.querySelectorAll(".field-card[data-field-uid]"));
      const source = cards.find(card => card.dataset.fieldUid === String(attack.attackerUid));
      const target = cards.find(card => card.dataset.fieldUid === String(attack.targetUid));
      if (!source || !target) { hideAttackArrow(layer); return; }
      const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
      if (!from.width || !from.height || !to.width || !to.height) { hideAttackArrow(layer); return; }
      const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight);
      layer.setAttribute("viewBox", "0 0 " + width + " " + height);
      layer.setAttribute("preserveAspectRatio", "none");
      Object.assign(layer.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "9500", display: "block", visibility: "visible", pointerEvents: "none", overflow: "visible" });
      if (layer.dataset.attackId !== attackId || !layer.querySelector(".attack-arrow-path")) {
        layer.innerHTML = '<defs><marker id="attack-arrow-head-live" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L12 7 L1 13 Z" class="attack-arrow-head"></path></marker></defs><path class="attack-arrow-path attack-arrow-glow"></path><path class="attack-arrow-path" marker-end="url(#attack-arrow-head-live)"></path><circle class="attack-arrow-origin" r="8"></circle>';
        layer.dataset.attackId = attackId;
      }
      const x1 = from.left + from.width / 2, y1 = from.top + from.height / 2;
      const x2 = to.left + to.width / 2, y2 = to.top + to.height / 2;
      const dx = x2 - x1, dy = y2 - y1, curve = Math.min(60, Math.max(20, Math.hypot(dx, dy) * .1));
      const d = "M " + x1 + " " + y1 + " C " + (x1 + dx * .3 + curve) + " " + (y1 + dy * .1) + ", " + (x2 - dx * .3 + curve) + " " + (y2 - dy * .1) + ", " + x2 + " " + y2;
      layer.querySelectorAll(".attack-arrow-path").forEach(path => path.setAttribute("d", d));
      layer.querySelector(".attack-arrow-origin").setAttribute("cx", x1);
      layer.querySelector(".attack-arrow-origin").setAttribute("cy", y1);
      layer.removeAttribute("hidden");
      layer.hidden = false;
    };
    layer.dataset.attackId = attackId;
    requestAnimationFrame(draw);
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
      setMessage(`${match.players[attack.attackerSide].name} can finish the attack.`);
      renderMatch();
      return;
    }
    if (attack.driveSequenceStarted) return;
    attack.driveSequenceStarted = true;
    setTimeout(() => {
      if (match?.pendingAttack !== attack || match.pendingTrigger) { attack.driveSequenceStarted = false; return; }
      const player = match.players[driveSide], top = player.deck.pop();
      attack.driveSequenceStarted = false;
      if (!top) { match.ended = true; addLog(`${player.name} lost because the deck is empty.`); setMessage("Match over — the deck is empty."); match.pendingAttack = null; renderMatch(); return; }
      attack.driveChecksRemaining -= 1; attack.driveChecksPerformed=Number(attack.driveChecksPerformed||0)+1;recordOpponentCheckTrigger(driveSide,top,"drive");
      if (triggerKind(top) !== "over") player.hand.push(top);
      addLog(`${player.name} performed a drive check and revealed ${cardMap.get(top.cardId)?.name || "a card"}.`);
      beginTriggerResolution(driveSide, top, "drive");
      queueAbilityPrompts("driveCheck",driveSide,top.uid,{sourceCardInstanceId:attack.attackerUid,actingPlayerId:player.playerId,sourceZone:"deck",previousLocation:"deck",currentLocation:triggerKind(top)==="over"?"revealed":"hand",subjectInstance:top,checkKind:"drive",checkSourceLocation:attack.attackerZone,checkIndex:Math.max(1,Number(attack.driveChecksPerformed||1)),revealedTrigger:triggerKind(top),battleId:attack.battleId,timingWindow:"drive-check"});
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
  function renderOnlineTurnOrderAnnouncement() {
    if (!online.turnOrderAnnouncementPending || !online.role || online.role === "watcher" || !match || match.preMatch) return;
    const matchId = String(match.matchId || online.roomId || "online-match");
    if (online.turnOrderAnnouncementMatchId === matchId) { online.turnOrderAnnouncementPending = false; return; }
    const flash = $("#turn-order-flash"), label = $("#turn-order-flash-label");
    if (!flash || !label) return;
    online.turnOrderAnnouncementPending = false;
    online.turnOrderAnnouncementMatchId = matchId;
    label.textContent = match.firstSide === "human" ? "You are going first" : "You are going second";
    flash.hidden = false;
    flash.classList.remove("flash");
    void flash.offsetWidth;
    flash.classList.add("flash");
    if (online.turnOrderAnnouncementTimer) clearTimeout(online.turnOrderAnnouncementTimer);
    online.turnOrderAnnouncementTimer = setTimeout(() => {
      flash.hidden = true;
      flash.classList.remove("flash");
      online.turnOrderAnnouncementTimer = null;
    }, 1150);
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
    checkRevealTimer = setTimeout(() => { panel.hidden = true; panel.classList.remove("flash"); activeCheckRevealId = null; checkRevealTimer = null; renderCheckReveal(); }, 1150);
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
      if (pending.stage === "stand-target") { const target = fieldUnits(side).find((unit) => unit.zone !== "vanguard" && unit.instance.rested); if (target) standUnitAndQueue(side,target); pending.stage = "power-target"; }
      const target = fieldUnits(side)[0]?.instance; if (target) { target.turnPowerBoost = Number(target.turnPowerBoost || 0) + power; target.turnPowerExpiry=turnOwner; }
      if (pending.stage === "heal-target") { const healed = player.damage.pop(); if (healed) { player.drop.push(healed); queueAbilityPrompts("damageLeave", "bot", healed.uid, {zone:"damage"}); } }
      addLog(`Practice Bot resolved its ${kind} trigger.`); return false;
    }
    if (pending.stage === "stand-target" && !fieldUnits(side).some((unit) => unit.zone !== "vanguard" && unit.instance.rested)) pending.stage = "power-target";
    if (pending.stage === "heal-target" && !player.damage.length) pending.stage = "power-target";
    if (!fieldUnits(side).length && pending.stage !== "heal-target" && pending.stage !== "stand-target") return false;
    match.pendingTrigger = pending; return true;
  }
  function chooseTriggerTarget(uid, side = "human") {
    const pending = match?.pendingTrigger; if (!pending || pending.side !== side) return false;
    const player = match.players[side];
    if (pending.stage === "heal-target") {
      const index = player.damage.findIndex((item) => item.uid === uid); if (index < 0) return;
      const healed=player.damage.splice(index,1)[0];player.drop.push(healed);queueAbilityPrompts("damageLeave",side,healed.uid,{zone:"damage"});addLog(`${player.name} healed one damage to Drop.`);pending.stage = "power-target";
      if (!fieldUnits(side).length) finishTriggerResolution();
    } else {
      const unit = fieldUnits(side).find((item) => item.instance.uid === uid && (pending.stage !== "stand-target" || (item.zone !== "vanguard" && item.instance.rested))); if (!unit) return false;
      if (pending.stage === "critical-target") { unit.instance.turnCriticalBoost = Number(unit.instance.turnCriticalBoost || 0) + 1; unit.instance.turnCriticalExpiry=pending.turnOwner; if (match.pendingAttack?.attackerUid === unit.instance.uid) match.pendingAttack.critical = Number(match.pendingAttack.critical || 1) + 1; addLog(`${cardMap.get(unit.instance.cardId)?.name || "A unit"} gets +1 critical until end of turn.`); pending.stage = "power-target"; }
      else if (pending.stage === "stand-target") { standUnitAndQueue(side,unit); addLog(`${cardMap.get(unit.instance.cardId)?.name || "A Rear-Guard"} stood.`); pending.stage = "power-target"; }
      else { unit.instance.turnPowerBoost = Number(unit.instance.turnPowerBoost || 0) + pending.power; unit.instance.turnPowerExpiry=pending.turnOwner; if(match.pendingAttack?.attackerUid===unit.instance.uid)match.pendingAttack.power+=pending.power; addLog(`${cardMap.get(unit.instance.cardId)?.name || "A unit"} gets +${pending.power >= 1000000 ? `${Math.round(pending.power / 1000000)}M` : `${Math.round(pending.power / 1000)}k`} power until end of turn.`); finishTriggerResolution(); }
    }
    renderMatch(); return true;
  }
  function drawForHuman() {
    if (!match || match.ended) { toast("Start a match before drawing."); return; }
    const card = draw("human"); if (!card) { setMessage("Your deck is empty."); return; }
    if (match.phase === 1 && match.side === "human") match.drewThisTurn = true;
    addLog(`${match.players.human.name} drew a card.`); setMessage("Card drawn."); renderMatch();
  }
  function rideHuman() {
    const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
    const p = match.players.human;
    if(!window.VanguardAbilityEngine.canRideCard(cardMap.get(instance.cardId),{vanguardCard:cardMap.get(p.vanguard?.cardId),crests:(p.crests||[]).map(crest=>cardMap.get(crest.cardId))})){toast("This card cannot be ridden under your current ride restrictions.");return;}
    const grade = gradeOf(cardMap.get(instance.cardId)), currentGrade = gradeOf(cardMap.get(p.vanguard?.cardId)), previousVanguard=p.vanguard;
    if (match.side !== "human" || match.phase !== 2 || match.ridePerformed || grade < 0 || currentGrade < 0 || grade < currentGrade || grade > currentGrade + 1) { toast("A normal ride is once per turn and must be the same grade or one grade higher than your Vanguard."); return; }
    p.hand = p.hand.filter((x) => x.uid !== instance.uid); if (p.vanguard) p.soul.push(p.vanguard); p.vanguard = { ...instance, rested: false }; window.VanguardAbilityEngine.recordFightRide(p,cardMap.get(instance.cardId)); match.ridePerformed = true; askForCardCrest("human", instance);
    match.selected = null; addLog(`You rode ${cardMap.get(instance.cardId)?.name || "a card"}.`); if(previousVanguard)queueAbilityPrompts("ride","human",previousVanguard.uid,{zone:"soul"}); queueAbilityPrompts("place", "human", instance.uid,{source:"hand",zone:"vanguard"}); setMessage("Ride complete."); renderMatch();
  }
  function callUnitToRear(player,side,instance,index,eventContext={}){
    const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)],zone=zones[index];
    if(!zone||!isUnitCard(cardMap.get(instance?.cardId)))return false;
    const displaced=player.rear[index]||null;
    if(displaced){player.rear[index]=null;player.drop.push(displaced);addLog(`${cardMap.get(displaced.cardId)?.name||"The Rear-Guard"} was called over and sent to Drop.`);queueMovedCardAbility(displaced,side,"retire",zone,{placementUid:instance.uid,placementZone:zone});}
    player.rear[index]={...instance,rested:false};
    queueAbilityPrompts("place",side,instance.uid,{...eventContext,zone,displacedUid:displaced?.uid||null});
    return true;
  }
  function rearColumn(zone){if(zone==="vanguard"||["rear-back-center","rear-3"].includes(zone))return"center";if(["rear-left","rear-back-left","rear-0","rear-2"].includes(zone))return"left";if(["rear-right","rear-back-right","rear-1","rear-4"].includes(zone))return"right";if(String(zone).startsWith("accel-"))return String(zone);return null}
  function callHuman() {
    const instance = selectedHandCard(); if (!instance) { toast("Select a card in your hand first."); return; }
    const p = match.players.human, card = cardMap.get(instance.cardId), empty = p.rear.indexOf(null);
    if (match.side !== "human" || match.phase !== 4) { toast("You can call units during your Main phase."); return; }
    if (!isUnitCard(card) || gradeOf(card) < 0 || gradeOf(card) > gradeOf(cardMap.get(p.vanguard?.cardId))) { toast("You can only call a Unit whose grade is no higher than your Vanguard."); return; }
    if (empty < 0) return;
    p.hand = p.hand.filter((x) => x.uid !== instance.uid); callUnitToRear(p,"human",instance,empty,{source:"hand"}); match.selected = null;
    addLog(`You called ${cardMap.get(instance.cardId)?.name || "a card"} to the rear-guard circle.`); setMessage("Unit called."); renderMatch();
  }
  function attackerPower(entry,attackContext={}) {
    const field = entry.side && entry.zone ? entry : findFieldCard(entry.instance.uid);
    const card = cardMap.get(entry.instance.cardId),mlbSoul=card?.name==="Majesty Lord Blaster"&&field&&(()=>{const names=(match.players[field.side].soul||[]).map(x=>cardMap.get(x.cardId)?.name);return names.includes("Blaster Blade")&&names.includes("Blaster Dark")})();
    const forcePower = field && match.side === field.side ? (match.players[field.side].giftZones || []).filter((gift) => gift.zone === field.zone && /^Force I$/i.test(gift.type || "")).length * 10000 : 0;
    const accelIndex = field?.zone.startsWith("accel-") ? Number(field.zone.slice(6)) - 1 : -1; const accelType = accelIndex >= 0 ? (match.players[field.side].accelTypes?.[accelIndex] || "Accel I") : ""; const accelPower = field && accelType && match.side === field.side ? (/II/i.test(accelType) ? 5000 : 10000) : 0; return Number(card?.power || 0) + (mlbSoul&&field.zone==="vanguard"?5000:0) + Number(cardMap.get(entry.instance.strideHeart?.cardId)?.power || 0) + Number(entry.instance.strideHeart?.powerBoost || 0) + Number(entry.instance.strideHeart?.turnPowerBoost || 0) + Number(entry.instance.powerBoost || 0) + Number(entry.instance.turnPowerBoost || 0) + continuousPowerBonus(entry.instance,field.side,field.zone,{...attackContext,attackTargetZone:attackContext.targetZone}) + forcePower + accelPower;
  }
  function attackerCritical(entry) { const field = entry.side && entry.zone ? entry : findFieldCard(entry.instance.uid); const card = cardMap.get(entry.instance.cardId), printedCritical = Math.max(1, Number(card?.critical || 1)),fieldSide=field?.side||findFieldCard(entry.instance.uid)?.side,mlbSoul=card?.name==="Majesty Lord Blaster"&&fieldSide&&(()=>{const names=(match.players[fieldSide].soul||[]).map(x=>cardMap.get(x.cardId)?.name);return names.includes("Blaster Blade")&&names.includes("Blaster Dark")})(); const forceCrit = field ? (match.players[field.side].giftZones || []).filter((gift) => gift.zone === field.zone && /^Force II$/i.test(gift.type || "")).length : 0; return Math.max(1, printedCritical + (mlbSoul?1:0) + Number(entry.instance.turnCriticalBoost || 0) + forceCrit); }
  function getDriveValue(card,instance=null) { const text=String(card?.text||"");let value=/Triple Drive/i.test(text)?3:/Twin Drive/i.test(text)?2:1;const unit=instance?.instance||instance;value+=Number(unit?.turnDriveBoost||0);const field=instance?.side?instance:instance?.uid?findFieldCard(instance.uid):null;if(card?.name==="Majesty Lord Blaster"&&field?.zone==="vanguard"){const p=match.players[field.side],soulNames=(p.soul||[]).map(x=>cardMap.get(x.cardId)?.name);if(soulNames.includes("Blaster Blade")&&soulNames.includes("Blaster Dark"))value+=1}return value; }
  function continuousAttackRestriction(field){const player=match?.players?.[field?.side];if(!player||!field?.instance)return{legal:true,restrictions:[]};const controlledUnits=[player.vanguard,...(player.rear||[])].filter(Boolean).map(instance=>({uid:instance.uid,card:cardMap.get(instance.cardId)}));const location=field.zone==="vanguard"?"vanguard":field.zone==="guardian"?"guardian":field.zone?.startsWith("rear-")||field.zone?.startsWith("accel-")?"rear-guard":null;return window.VanguardAbilityEngine.evaluateContinuousRestrictions(cardAbilities(cardMap.get(field.instance.cardId)),{sourceInstanceId:field.instance.uid,sourceCard:cardMap.get(field.instance.cardId),location,controlledUnits})}
  function continuousBoostRestriction(field){if(!field?.instance)return{legal:true,restrictions:[]};const source=cardMap.get(field.instance.cardId),location=field.zone==="vanguard"?"vanguard":"rear-guard";return window.VanguardAbilityEngine.evaluateContinuousRestrictions(cardAbilities(source),{sourceInstanceId:field.instance.uid,sourceCard:source,location,action:"boost"})}
  function canAttackFromBackRow(field) { const text=String(cardMap.get(field.instance.cardId)?.text||""); return /attack(?:s|ing)? from (?:the )?back row|back row[^.\n]*can attack/i.test(text); }
  function directlyBehind(field) { const rear=match.players[field.side].rear;if(field.zone==="vanguard")return rear[3]||null;if(field.zone==="rear-left")return rear[2]||null;if(field.zone==="rear-right")return rear[4]||null;return null; }
  function resolveHumanAttack() {
    if (!match || match.ended) { toast("Start a match before attacking."); return; }
    if (!match.firstTurnComplete && match.side === match.firstSide) { toast("The player who goes first cannot attack during their first turn."); return; }
    if (match.pendingAttack || match.pendingAttackSetup) { toast("Finish the current attack before starting another."); return; }
    const field=findFieldCard(match.selected); if(!field||field.side!=="human"){toast("Select one of your units on the field to attack.");return;} if(field.instance.rested){toast("That unit is already rested.");return;} if(field.instance.locked){toast("That unit is locked and cannot attack.");return;}if(field.instance.cannotAttackTurnKey===`${match.turn}:${match.side}`){toast("This unit cannot attack this turn.");return;}const restriction=continuousAttackRestriction(field);if(!restriction.legal){toast("This unit cannot attack because your field does not meet its Lord restriction.");return;}
    const front=field.zone==="vanguard"||field.zone==="rear-left"||field.zone==="rear-right"||field.zone.startsWith("accel-");
    if(!front&&!canAttackFromBackRow(field)){toast("Only a Vanguard or front-row Rear-Guard can attack unless its card text allows a back-row attack.");return;}
    const boosterAllowed=continuousBoostRestriction(field).legal,booster=boosterAllowed&&(field.zone==="vanguard"||field.zone==="rear-left"||field.zone==="rear-right")?directlyBehind(field):null;
    queueAbilityPrompts("attackStep","human",field.instance.uid,{actingPlayerId:match.players.human.playerId||"human",playerAttackCount:window.VanguardAbilityEngine.getPlayerAttackCount(match,match.players.human.playerId||"human")+1,timingWindow:"attack-step-start"});
    match.pendingAttackSetup={attackerUid:field.instance.uid,attackerSide:"human",defenderSide:"bot",boosterUid:booster&&!booster.rested&&!booster.locked?booster.uid:null,stage:boosterAllowed&&booster&&!booster.rested&&!booster.locked?"boost":"target"};
    match.selected=null;renderMatch();
  }
  function beginChosenAttack(choice) {
    const pendingAttack = match?.pendingAttack;
    if (pendingAttack?.driveCountPrompt && choice.startsWith("drive-count:")) {
      const count = Math.max(0, Math.min(Number(pendingAttack.maxDriveChecks) || 0, Number(choice.slice("drive-count:".length)) || 0));
      pendingAttack.driveChecksRemaining = count; pendingAttack.driveCountPrompt = false; pendingAttack.driveCountChosen = true;
      pendingAttack.awaitingDrive = count > 0;

      renderMatch(); return;
    }
    const setup=match?.pendingAttackSetup;if(!setup)return;
    if(setup.stage==="boost"){
      if(choice.startsWith("boost:")&&choice!=="boost:none"){
        const uid=choice.slice("boost:".length),booster=findFieldCard(uid);
        if(!booster||booster.side!==setup.attackerSide||booster.instance.rested||booster.instance.locked||uid!==setup.boosterUid){toast("That Rear-Guard can no longer boost this attack.");return;}
        const attacker=findFieldCard(setup.attackerUid);if(!continuousBoostRestriction(attacker).legal){toast("This Vanguard cannot be boosted by its owner's units.");return;}
        booster.instance.rested=true;setup.boostUid=uid;setup.boostPower=attackerPower(booster,{boosterCardInstanceId:uid,boostedUnitInstanceId:setup.attackerUid});addLog(`${cardMap.get(booster.instance.cardId)?.name||"A Rear-Guard"} boosted for +${setup.boostPower.toLocaleString()} this attack.`);
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
    const attackerCard=cardMap.get(attacker.instance.cardId),isVanguardAttack=attacker.zone==="vanguard",legionMate=isVanguardAttack&&attacker.instance.legionMate?.uid&&attacker.instance.legionMate.legionLeaderInstanceId===attacker.instance.uid?attacker.instance.legionMate:null,attackingCardInstanceIds=[attacker.instance.uid,...(legionMate?[legionMate.uid]:[])];
    if(legionMate){legionMate.rested=true;legionMate.position="rest";}
    match.pendingAttack={battleId:crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,attacker:attackerCard?.name||"unit",attackerUid:attacker.instance.uid,attackerSide:setup.attackerSide,attackerZone:attacker.zone,attackingCardInstanceIds,defenderSide,targetUid,targetRearIndex:index, targetZone:zone,boostPower:Number(setup.boostPower||0),boostUid:setup.boostUid||null,power:attackerPower(attacker,{targetZone:zone,boosterCardInstanceId:setup.boostUid||null,boostedUnitInstanceId:setup.boostUid?attacker.instance.uid:null})+(legionMate?attackerPower({instance:legionMate,side:setup.attackerSide,zone:"vanguard"},{targetZone:zone}):0)+Number(setup.boostPower||0),targetPower:attackerPower({instance:target}),critical:attackerCritical(attacker),guardCards:[],driveChecksRemaining:0,driveChecksPerformed:0,maxDriveChecks:isVanguardAttack?10:0,driveCountPrompt:false,driveCountChosen:!isVanguardAttack,awaitingDrive:false};
    window.VanguardAbilityEngine.recordAttackCount(match,match.players[setup.attackerSide].playerId||setup.attackerSide,attacker.instance.uid);
    match.pendingAttackSetup=null;$("#attack-prompt-dialog").close();if(setup.boostUid)queueAbilityPrompts("boost",setup.attackerSide,setup.boostUid,{zone:findFieldCard(setup.boostUid)?.zone||null,boostedUid:attacker.instance.uid});queueAbilityPrompts("attack",setup.attackerSide,attacker.instance.uid,{zone:attacker.zone,targetZone:zone,boostUid:setup.boostUid||null,attackingCardInstanceIds,battleId:match.pendingAttack.battleId});queueAbilityPrompts("attacked",defenderSide,target.uid,{zone,targetZone:zone,sourceCardInstanceId:attacker.instance.uid,attackingCardInstanceIds,actingPlayerId:match.players[setup.attackerSide].playerId,boostUid:match.pendingAttack.boostUid,battleId:match.pendingAttack.battleId,timingWindow:"attack-declared"});addLog(`${match.pendingAttack.attacker} attacked ${match.players[defenderSide].name}'s ${zone==="vanguard"?"Vanguard":"Rear-Guard"}.`);
    renderMatch();
    if (!online.role && defenderSide === "bot") { if(match.pendingAbility||match.pendingAbilities?.length)match.resumeAfterAbility="bot-defense";else practiceBotDefend(); return; }
    setMessage(`${match.players[defenderSide].name} is defending — choose Guard or No guard.`);renderMatch();
  }
  function practiceBotDefend() {
    const attack=match?.pendingAttack;if(!attack||attack.defenderSide!=="bot")return;const bot=match.players.bot,needed=Math.max(0,attack.power-attack.targetPower),wouldHit=attack.power>=attack.targetPower;
    if(!wouldHit){completeAttackDefense(false);return;}
    const lethal=(bot.damage||[]).length+Number(attack.critical||1)>=6,highPressure=attack.targetZone==="vanguard"&&((bot.damage||[]).length>=4||Number(attack.critical||1)>=2),rearIndex=Number(attack.targetRearIndex),rearTarget=attack.targetZone!=="vanguard"?bot.rear[rearIndex]:null,rearCard=cardMap.get(rearTarget?.cardId),protectRear=Boolean(rearTarget&&(Number(rearCard?.grade||0)>=2||hasIntercept(rearCard))&&Math.random()<0.45),shouldGuard=lethal||highPressure||protectRear||(attack.targetZone==="vanguard"&&(bot.damage||[]).length>=3&&Math.random()<0.22);
    if(!shouldGuard){completeAttackDefense(false);return;}
    const hand=bot.hand||[],sentinel=hand.find(item=>isSentinel(cardMap.get(item.cardId))&&effectiveShieldValue(item,"bot")===0),discardCost=hand.filter(item=>item.uid!==sentinel?.uid).sort((a,b)=>(Number(cardMap.get(a.cardId)?.grade||0)+(/Heal/i.test(cardMap.get(a.cardId)?.trigger||"")?8:0))-(Number(cardMap.get(b.cardId)?.grade||0)+(/Heal/i.test(cardMap.get(b.cardId)?.trigger||"")?8:0)))[0];
    if(sentinel&&discardCost&&(lethal||highPressure||needed>=10000)){bot.hand=bot.hand.filter(item=>item.uid!==sentinel.uid&&item.uid!==discardCost.uid);bot.drop.push(discardCost);queueMovedCardAbility(discardCost,"bot","discard","hand");bot.guardCircle.push(sentinel);attack.guardCards.push(sentinel);queueAbilityPrompts("place","bot",sentinel.uid,{sourceZone:"guardian",previousLocation:"hand",zone:"guardian",currentLocation:"guardian",subjectInstance:sentinel,timingWindow:"guard-placement",battleId:attack.battleId});attack.perfectGuard=true;addLog(`Practice Bot used ${cardMap.get(sentinel.cardId)?.name||"a Sentinel"} and discarded ${cardMap.get(discardCost.cardId)?.name||"a card"} to completely guard the attack.`);completeAttackDefense(true);return;}
    const shields=hand.filter(item=>effectiveShieldValue(item,"bot")>0).map(item=>({item,shield:effectiveShieldValue(item,"bot"),cost:100+Number(cardMap.get(item.cardId)?.grade||0)*6+(/Heal/i.test(cardMap.get(item.cardId)?.trigger||"")?55:0)+(/AUTO|ACT/i.test(cardMap.get(item.cardId)?.text||"")?18:0)})),plans=[];const visit=(index,total,chosen,cost)=>{if(total>needed){plans.push({chosen:[...chosen],total,cost});return;}if(index>=shields.length||chosen.length>=4)return;visit(index+1,total,chosen,cost);chosen.push(shields[index]);visit(index+1,total+shields[index].shield,chosen,cost+shields[index].cost);chosen.pop()};visit(0,0,[],0);plans.sort((a,b)=>a.cost-b.cost||a.chosen.length-b.chosen.length);const plan=plans[0];
    const attackerGrade=Number(cardMap.get(match.players[attack.attackerSide]?.vanguard?.cardId)?.grade||0),defenderGrade=gradeOf(cardMap.get(bot.vanguard?.cardId)),heal=hand.find(isGGuardCostCard),gGuardians=(bot.gDeck||[]).filter(item=>!item.faceUp&&isGGuardian(cardMap.get(item.cardId))).sort((a,b)=>effectiveShieldValue(b,"bot")-effectiveShieldValue(a,"bot")),gGuardian=gGuardians[0],gShield=gGuardian?effectiveShieldValue(gGuardian,"bot"):0,canGGuard=Boolean(heal&&gGuardian&&attackerGrade>=3&&defenderGrade>=3&&gShield>needed);
    if(canGGuard&&(lethal||highPressure||!plan||plan.chosen.length>=2)){bot.hand=bot.hand.filter(item=>item.uid!==heal.uid);bot.drop.push(heal);queueMovedCardAbility(heal,"bot","discard","hand",{discardReason:"g-guardian-cost",calledGUnitCardId:gGuardian.cardId,calledGUnitInstanceId:gGuardian.uid,calledGUnitCardName:cardMap.get(gGuardian.cardId)?.name||null,calledGUnitPreviousLocation:"g-deck"});bot.gDeck=bot.gDeck.filter(item=>item.uid!==gGuardian.uid);bot.guardCircle.push(gGuardian);attack.guardCards.push(gGuardian);queueAbilityPrompts("place","bot",gGuardian.uid,{sourceZone:"guardian",previousLocation:"g-deck",zone:"guardian",currentLocation:"guardian",subjectInstance:gGuardian,timingWindow:"guard-placement",battleId:attack.battleId});attack.targetPower+=gShield;addLog(`Practice Bot discarded a Heal trigger and used ${cardMap.get(gGuardian.cardId)?.name||"a G-Guardian"} to guard for ${gShield.toLocaleString()}.`);completeAttackDefense(!attackHits(attack));return;}
    if(plan){for(const entry of plan.chosen){bot.hand=bot.hand.filter(item=>item.uid!==entry.item.uid);bot.guardCircle.push(entry.item);attack.guardCards.push(entry.item);queueAbilityPrompts("place","bot",entry.item.uid,{sourceZone:"guardian",previousLocation:"hand",zone:"guardian",currentLocation:"guardian",subjectInstance:entry.item,timingWindow:"guard-placement",battleId:attack.battleId});attack.targetPower+=entry.shield;}addLog(`Practice Bot guarded with ${plan.chosen.map(entry=>cardMap.get(entry.item.cardId)?.name||"a card").join(" and ")} for ${plan.chosen.reduce((sum,entry)=>sum+entry.shield,0).toLocaleString()} shield.`);completeAttackDefense(!attackHits(attack));return;}
    completeAttackDefense(false);
  }  function resolvePendingBattleEnd(){const pending=match?.pendingBattleEnd;if(!pending||match.pendingAbility||match.pendingAbilities?.length||match.pendingTrigger||match.pendingDamageQueue?.length||match.pendingHitResolution)return false;match.pendingBattleEnd=null;const participantInstanceIds=[pending.attackerUid,pending.boostUid,pending.targetUid].filter(uid=>findMatchInstance(uid)?.charging===true);if(participantInstanceIds.length)match.pendingChargeCleanup={battleId:pending.battleId,participantInstanceIds};queueAbilityPrompts("battleEnd",pending.attackerSide,pending.attackerUid,{...pending,sourceCardInstanceId:pending.attackerUid,boostedUid:pending.attackerUid,turnPlayerId:match.players[pending.attackerSide]?.playerId,timingWindow:"close-step"});return true}
  function finishAttack(blocked) {
    const attack=match?.pendingAttack;if(!attack||attack.finishing)return;attack.finishing=true;dismissAttackArrow(attack);$("#battle-action-panel").hidden=true;const defender=match.players[attack.defenderSide];match.pendingBattleEnd={attackerSide:attack.attackerSide,attackerUid:attack.attackerUid,targetZone:attack.targetZone,targetUid:attack.targetUid,boostUid:attack.boostUid,battleId:attack.battleId};
    for(const guard of attack.guardCards||[]){if(guard.battleShieldExpiryBattleId===attack.battleId){guard.battleShieldBoost=0;delete guard.battleShieldExpiryBattleId}const card=cardMap.get(guard.cardId);if(isGGuardian(card)){(defender.gDeck ||= []).push({...guard,faceUp:true,guarding:false});queueMovedCardAbility(guard,attack.defenderSide,"move","guardian",{currentLocation:"g-deck",battleId:attack.battleId});}else{defender.drop.push(guard);queueMovedCardAbility(guard,attack.defenderSide,"move","guardian",{currentLocation:"drop",battleId:attack.battleId});queueMovedCardAbility(guard,attack.defenderSide,"retire","guardian",{currentLocation:"drop",battleId:attack.battleId});}}
    defender.guardCircle=[];
    if(blocked)addLog(`${attack.attacker} was stopped by ${defender.name}'s guard.`);
    else { if(attack.targetZone==="vanguard"){addLog(`${attack.attacker} hit ${defender.name}'s Vanguard for ${attack.critical} damage.`);match.pendingHitResolution={attackerSide:attack.attackerSide,attackerUid:attack.attackerUid,targetZone:attack.targetZone,targetUid:attack.targetUid,boostUid:attack.boostUid,battleId:attack.battleId};dealDamage(attack.defenderSide,attack.critical);}
    else {const index=defender.rear.findIndex(unit=>unit?.uid===attack.targetUid);if(index>=0){const unit=defender.rear.splice(index,1,null)[0];defender.drop.push(unit);addLog(`${cardMap.get(unit.cardId)?.name||"The Rear-Guard"} was hit and sent to Drop.`);queueMovedCardAbility(unit,attack.defenderSide,"retire",attack.targetZone);queueAbilityPrompts("hit",attack.attackerSide,attack.attackerUid,{targetZone:attack.targetZone,targetUid:attack.targetUid,boostUid:attack.boostUid,battleId:attack.battleId,timingWindow:"rear-guard-hit"});}else addLog(`${attack.attacker} did not hit its Rear-Guard target.`);}}
    const attackerSide=attack.attackerSide,attacker=findFieldCard(attack.attackerUid),missedHitOverride=Boolean(blocked&&attacker?.zone==="vanguard"&&window.VanguardAbilityEngine.hasAbilityKeyword(cardMap.get(attacker.instance.cardId),"missed-attack-hit-effects"))?{attackerSide,attackerUid:attack.attackerUid,targetZone:attack.targetZone,targetUid:attack.targetUid,boostUid:attack.boostUid,battleId:attack.battleId}:null;match.pendingAttack=null;match.pendingAttackSetup=null;match.selected=null;setMessage("Attack ended.");if($("#attack-prompt-dialog").open)$("#attack-prompt-dialog").close();if(missedHitOverride)queueAbilityPrompts("hit",missedHitOverride.attackerSide,missedHitOverride.attackerUid,{...missedHitOverride,hitOverrideSourceUid:missedHitOverride.attackerUid,attackHitOverride:true,timingWindow:"vanguard-missed-attack-hit-override"});resolvePendingBattleEnd();resumeAbilityQueue();renderMatch();
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
      recordOpponentCheckTrigger(side,top,"damage");beginTriggerResolution(side, top, "damage");
      if(triggerKind(top)!=="over")queueAbilityPrompts("damagePlace",side,top.uid,{zone:"damage",sourceZone:"deck",currentLocation:"damage"});
      checkDamageEnd(side);
    }
    if(match&&!match.pendingTrigger&&!match.pendingDamageQueue?.length&&match.pendingHitResolution){const hit=match.pendingHitResolution;match.pendingHitResolution=null;queueAbilityPrompts("hit",hit.attackerSide,hit.attackerUid,{targetZone:hit.targetZone,targetUid:hit.targetUid,boostUid:hit.boostUid,battleId:hit.battleId,timingWindow:"vanguard-hit-after-damage-checks"});resolvePendingBattleEnd();resumeAbilityQueue();}
  }
  function humanGuard() {
    if (!match?.pendingAttack) return;
    if(match.pendingAttack.defenderSide!=="human"||match.pendingAttack.defenderDone){toast("Only the defending player can guard before finishing their defense.");return;}

    const instance = selectedHandCard();
    if (!instance) { toast("Select a card in your hand, then choose Guard. You can add more cards before choosing Done guarding."); return; }
    if(effectiveShieldValue(instance,"human")===0){if(!isSentinel(cardMap.get(instance.cardId))){toast("A zero-shield card can only guard if it has Sentinel.");return;}if(online.applyingRemote){match.pendingProtectGuard={ownerSide:"human",markerUid:instance.uid};return;}openProtectDiscardDialog(instance);return;}
    match.players.human.hand = match.players.human.hand.filter((x) => x.uid !== instance.uid);match.players.human.guardCircle.push(instance);match.pendingAttack.guardCards.push(instance);
    const shield=effectiveShieldValue(instance,"human");match.pendingAttack.targetPower+=shield;
    addLog(`${match.players.human.name} guarded with ${cardMap.get(instance.cardId)?.name||"a card"} for ${shield.toLocaleString()} shield.`);queueAbilityPrompts("place","human",instance.uid,{sourceZone:"guardian",previousLocation:"hand",zone:"guardian",currentLocation:"guardian",subjectInstance:instance,timingWindow:"guard-placement",battleId:match.pendingAttack?.battleId||null,targetUid:match.pendingAttack?.targetUid||null,targetZone:match.pendingAttack?.targetZone||null});
    match.selected=null;renderMatch();
  }
  function openProtectDiscardDialog(marker) {
    if(!marker)return;
    if($("#protect-discard-dialog").open&&$("#protect-discard-dialog").dataset.markerUid===marker.uid)return;
    const hand=match.players.human.hand.filter(item=>item.uid!==marker.uid),list=$("#protect-discard-list");
    if(!hand.length){toast("Protect Marker needs another card in your hand to discard.");return;}
    $("#protect-discard-dialog").dataset.markerUid=marker.uid;
    list.innerHTML=hand.map(item=>{const c=cardMap.get(item.cardId);return c?`<button class="zone-view-card" type="button" data-protect-cost="${escapeHtml(item.uid)}">${cardImage(c)}<b>Discard ${escapeHtml(c.name)}</b></button>`:"";}).join("");
    $("#protect-discard-dialog").showModal();
  }
  function renderRemotePaymentPrompt(){
    if(online.role!=="guest")return;
    if(match.pendingStride?.ownerSide==="human")renderStrideCostDialog();else if($("#stride-cost-dialog").open)$("#stride-cost-dialog").close();
    const pending=match.pendingProtectGuard;
    if(pending?.ownerSide==="human"){const marker=match.players.human.hand.find(item=>item.uid===pending.markerUid);if(marker)openProtectDiscardDialog(marker);}
    else if($("#protect-discard-dialog").open)$("#protect-discard-dialog").close();
  }
  function resolveProtectGuard(markerUid,costUid) {
    const attack=match?.pendingAttack,player=match?.players?.human;
    if(!attack||attack.defenderSide!=="human"){toast("A perfect guard can only be used while defending an attack.");return;}
    const marker=player.hand.find(item=>item.uid===markerUid&&Number(cardMap.get(item.cardId)?.shield||0)===0&&isSentinel(cardMap.get(item.cardId))),cost=player.hand.find(item=>item.uid===costUid&&item.uid!==markerUid);
    if(!marker||!cost){toast("Choose a zero-shield card and a different card to discard.");return;}
    player.hand=player.hand.filter(item=>item.uid!==markerUid&&item.uid!==costUid);match.pendingProtectGuard=null;player.drop.push(cost);player.guardCircle||=[];attack.guardCards||[];player.guardCircle.push(marker);attack.guardCards.push(marker);attack.perfectGuard=true;addLog(`${player.name} discarded ${cardMap.get(cost.cardId)?.name||"a card"} with ${cardMap.get(marker.cardId)?.name||"a zero-shield card"}. The attack was stopped.`);queueMovedCardAbility(cost,"human","discard","hand");queueAbilityPrompts("place","human",marker.uid,{sourceZone:"guardian",previousLocation:"hand",zone:"guardian",currentLocation:"guardian",subjectInstance:marker,timingWindow:"guard-placement",battleId:attack.battleId,perfectGuardPaid:true});match.selected=null;completeAttackDefense(true);
  }
  function completeAttackDefense(blocked) {
    const attack = match?.pendingAttack; if (!attack) return;
    attack.defenderDone = true;
    attack.blocked = Boolean(attack.perfectGuard || !attackHits(attack));
    if (attack.attackerZone === "vanguard" && !attack.driveCountChosen) {
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
    setMessage(`${match.players[attack.attackerSide].name} can finish the attack.`);
    renderMatch();
  }
  function confirmAttackFinished() {
    const attack = match?.pendingAttack;
    if (!attack || (online.role && attack.attackerSide !== "human") || !attack.defenderDone || attack.driveCountPrompt || Number(attack.driveChecksRemaining || 0) > 0) {
      toast("Wait until the defender is done guarding before finishing this attack."); return;
    }
    finishAttack(Boolean(attack.perfectGuard || !attackHits(attack)));
  }
  function noGuard() {
    if (!match?.pendingAttack) { toast("No attack is waiting to be resolved."); return; }
    if(match.pendingAttack.defenderSide!=="human"){toast("The attacker must wait for the defending player to finish guarding.");return;}

    if (match.pendingAttack.defenderDone) return;
    match.pendingProtectGuard=null;completeAttackDefense(!attackHits(match.pendingAttack));
  }
  function canStrideForSide(side, turnStartGrade = -1) {
    const ownGrade = Number(cardMap.get(match?.players?.[side]?.vanguard?.cardId)?.grade ?? -1), opponentGrade = Number(cardMap.get(match?.players?.[flipSide(side)]?.vanguard?.cardId)?.grade ?? -1);
    return ownGrade >= 3 && (opponentGrade >= 3 || Number(turnStartGrade) >= 3);
  }
  function isStrideUnit(card) { return /G Unit/i.test(String(card?.type || "")) && !isGGuardian(card) && /\bStride\b/i.test(String(card?.text || "")); }
  function strideGrade(instance,isPayingStrideCost=false) { const card=cardMap.get(instance?.cardId),text=String(card?.text||""); const payingForStride=/(?:pay(?:ing)?[^.\n]*stride|stride[^.\n]*(?:pay|cost))/i.test(text); const countsAsGradeThree=/(?:grade\s*(?:is\s*)?(?:regarded|treated|considered)\s*(?:as\s*)?3|(?:regarded|treated|considered)\s+as\s+grade\s*3|counts?\s+as\s+grade\s*3|grade\s*3\s+(?:for|when paying)[^.\n]*stride)/i.test(text); if(payingForStride&&countsAsGradeThree)return 3;const modifier=window.VanguardAbilityEngine.evaluateStrideCostGrade(cardAbilities(card),{location:"hand",isPayingStrideCost});return (modifier.treatedAsGradeThree?3:gradeOf(card))+modifier.grade; }
  function botStridePriority(card,player){const name=String(card?.name||""),vg=String(cardMap.get(player.vanguard?.cardId)?.name||""),faceUp=(player.gZone||[]).some(x=>x.faceUp),cb=(player.damage||[]).some(x=>!x.faceDown);if(/Saint of Twin Sword/i.test(name)&&cb&&/Blaster|Alfred/i.test(vg))return 120;if(/Gancelot Peace Saver/i.test(name)&&/Blaster|Alfred/i.test(vg))return 110;if(/Crystaluster/i.test(name)&&faceUp&&(player.rear||[]).filter(Boolean).length>=3)return 90;return Number(card?.power||0)/1000+(String(card?.text||"").match(/AUTO|ACT/g)||[]).length*2}
  function botCallPriority(card,player){const name=String(card?.name||"");if(name==="Blaster Blade"&&!(player.soul||[]).some(x=>cardMap.get(x.cardId)?.name===name))return 120;if(name==="Blaster Dark"&&!(player.soul||[]).some(x=>cardMap.get(x.cardId)?.name===name))return 115;if(/Blaster-friend, Barcgal|Wingal Brave/i.test(name))return 105;if(/Blaster Blade/i.test(name))return 100;if(/Llew/i.test(name))return 90;if(Number(card?.grade)>=2)return 50;if(/Flogal/i.test(name))return 45;return 30+(String(card?.text||"").match(/AUTO|ACT/g)||[]).length*5}
  function botUseBlasterOrder(player){if((player.ordersPlayedThisTurn||0)>=1)return false;const orderIndex=player.hand.findIndex(x=>cardMap.get(x.cardId)?.name==="When Light and Darkness Intersects");if(orderIndex<0)return false;const fieldNames=[player.vanguard,...(player.rear||[])].filter(Boolean).map(x=>cardMap.get(x.cardId)?.name||"");let wanted="";if(fieldNames.includes("Blaster Blade")&&!fieldNames.includes("Blaster Dark"))wanted="Blaster Dark";else if(fieldNames.includes("Blaster Dark")&&!fieldNames.includes("Blaster Blade"))wanted="Blaster Blade";else if(fieldNames.includes("Blaster Blade")&&fieldNames.includes("Blaster Dark"))wanted="Majesty Lord Blaster";if(!wanted)return false;const targetIndex=player.deck.findIndex(x=>cardMap.get(x.cardId)?.name===wanted);if(targetIndex<0)return false;const order=player.hand.splice(orderIndex,1)[0],found=player.deck.splice(targetIndex,1)[0];player.hand.push(found);player.drop.push(order);queueMovedCardAbility(order,"bot","move","hand",{currentLocation:"drop"});player.ordersPlayedThisTurn=(player.ordersPlayedThisTurn||0)+1;shuffle(player.deck);addLog(`Practice Bot played When Light and Darkness Intersects and added ${wanted} to its hand.`);return true}  function botStrideCost(strideCard, player) {
    const hand = player.hand || [], vanguard = cardMap.get(player.vanguard?.cardId), heartName = cardMap.get(player.vanguard?.strideHeart?.cardId)?.name;
    if (/Ultimate\s+Stride/i.test(String(strideCard?.text || ""))) { const payment = hand.find((item) => [vanguard?.name, heartName].includes(cardMap.get(item.cardId)?.name)); return payment ? [payment] : null; }
    const cards = hand.map((item) => ({ item, grade: strideGrade(item,true) }));
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
  function advanceBotPhase(nextPhase){if(!match)return false;const nextIndex=typeof nextPhase==="number"?nextPhase:phases.indexOf(nextPhase);if(!Number.isInteger(nextIndex)||nextIndex<0||nextIndex>=phases.length)return false;const previous=phases[match.phase];let advanced=false;try{advanced=Boolean(window.VanguardPracticeBot?.advancePhase?.(match,nextIndex,phases,(side,from,to)=>{if(!from)return;try{queuePhaseChangeEvent(side,from,to)}catch(error){console.error("Practice Bot phase event failed; keeping the phase transition.",error);addLog(`Practice Bot could not process the ${String(to).toLowerCase()}-phase trigger.`)}}))}catch(error){console.error("Practice Bot phase helper failed; applying the phase change directly.",error)}if(match.phase!==nextIndex){match.phase=nextIndex;advanced=true;if(previous)try{queuePhaseChangeEvent("bot",previous,phases[nextIndex])}catch(error){console.error("Practice Bot fallback phase event failed; keeping the phase transition.",error);addLog(`Practice Bot could not process the ${phases[nextIndex].toLowerCase()}-phase trigger.`)}}if(advanced&&nextIndex===2)chargeEnergyAtRidePhase(match.players.bot);if(advanced)renderMatch();return advanced;}
  function botTurn() {
    if (!match || match.ended) return;
    const botTurnMatch=match;
    match.side = "bot"; match.phase = 0; match.turnStartGrades ||= {}; match.turnStartGrades.bot=Number(cardMap.get(match.players.bot.vanguard?.cardId)?.grade??-1);
    const continueBotTurn = () => {
      // Turn-start abilities can legitimately advance the match turn while
      // resolving. Only abandon this continuation if the match was replaced,
      // ended, or is no longer the bot's turn; a stale captured turn number
      // must not strand the bot in Draw after its draw has already happened.
      if(!match||match!==botTurnMatch||match.ended){botTimer=null;return;}
      botTimer=null;
      if(match.side!=="bot"){console.info("Practice Bot continuation cancelled because the bot no longer owns the turn.");return;}
      // Phase-start and draw abilities can pause the match for a human choice.
      // Keep the bot turn continuation alive until that decision is resolved;
      // otherwise the bot can remain visibly parked in Draw indefinitely.
      const humanDecisionPending=match.pendingAbility?.side==="human"||match.pendingTrigger?.side==="human"||(match.pendingAbilities||[]).some(item=>item?.side==="human");
      if(humanDecisionPending){
        setMessage("Practice Bot is waiting for you to resolve the pending ability or trigger.");
        // Re-open the owning player's decision UI on every continuation. The
        // bot must not pass a legal choice, but it must not wait invisibly if
        // rendering or another modal closed the prompt during trigger setup.
        showNextAbilityPrompt();
        renderTriggerPrompt();
        botTimer=setTimeout(continueBotTurn,250);
        return;
      }
      try {
      const bot = match.players.bot; bot.ordersPlayedThisTurn = 0;
      // Leave Draw as the first step of the continuation. Keep this ahead of
      // G Assist and all card selection so an error in optional bot setup can
      // never strand the visible match in Draw.
      advanceBotPhase("Ride");
      const currentGrade = gradeOf(cardMap.get(bot.vanguard?.cardId)); match.turnStartGrades ||= {}; match.turnStartGrades.bot = currentGrade;
      if (canGAssist(bot)) {
        const revealed=[];for(let i=0;i<5&&bot.deck.length;i++)revealed.push(bot.deck.pop());
        const assistGrade=gradeOf(cardMap.get(bot.vanguard?.cardId))+1,found=revealed.find(item=>isUnitCard(cardMap.get(item.cardId))&&Number(cardMap.get(item.cardId)?.grade)===assistGrade);
        if(found){bot.hand.push(found);const costs=bot.hand.filter(item=>item.uid!==found.uid).sort((a,b)=>Number(cardMap.get(a.cardId)?.shield||0)-Number(cardMap.get(b.cardId)?.shield||0)).slice(0,2);bot.hand=bot.hand.filter(item=>!costs.some(cost=>cost.uid===item.uid));bot.removed||=[];bot.removed.push(...costs);addLog("Practice Bot used G Assist, added a grade-up Unit, and removed two hand cards from the game.");}
        else addLog("Practice Bot used G Assist but found no eligible Unit.");
        bot.deck.push(...revealed.filter(item=>item!==found));shuffle(bot.deck);
      }
      if (currentGrade < 3) {
        const nextRide = bot.hand.map((x) => ({ x, c: cardMap.get(x.cardId) })).find((item) => isUnitCard(item.c) && Number(item.c.grade) === currentGrade + 1);
        const sameGradeRide = nextRide ? null : bot.hand.map((x) => ({ x, c: cardMap.get(x.cardId) })).find((item) => isUnitCard(item.c) && Number(item.c.grade) === currentGrade);
        const rideContext={vanguardCard:cardMap.get(bot.vanguard?.cardId),crests:(bot.crests||[]).map(crest=>cardMap.get(crest.cardId))};
        const ride = nextRide&&window.VanguardAbilityEngine.canRideCard(nextRide.c,rideContext)?nextRide:sameGradeRide&&window.VanguardAbilityEngine.canRideCard(sameGradeRide.c,rideContext)?sameGradeRide:null;
        if (ride) { const previous=bot.vanguard; bot.hand = bot.hand.filter((x) => x.uid !== ride.x.uid); if (bot.vanguard) bot.soul.push(bot.vanguard); bot.vanguard = { ...ride.x, rested: false }; window.VanguardAbilityEngine.recordFightRide(bot,ride.c); addLog(`Practice Bot ${nextRide ? "rode up to" : "rode"} ${ride.c.name}.`); if(previous)queueAbilityPrompts("ride","bot",previous.uid,{zone:"soul"}); queueAbilityPrompts("place","bot",ride.x.uid,{source:"hand",zone:"vanguard"}); }
      } else addLog("Practice Bot is grade 3 or greater and will not make a normal ride.");
      advanceBotPhase("Stride");
      const botGrade = Number(cardMap.get(bot.vanguard?.cardId)?.grade ?? 0);
      if (canStrideForSide("bot", match.turnStartGrades.bot)) {
        const choice = bot.gDeck.filter((item) => !item.faceUp && isStrideUnit(cardMap.get(item.cardId))).map((item) => ({ item, card: cardMap.get(item.cardId), payment: botStrideCost(cardMap.get(item.cardId), bot) })).filter((entry) => entry.payment).sort((a,b)=>botStridePriority(b.card,bot)-botStridePriority(a.card,bot))[0];
        if (choice) { const strideIndex = bot.gDeck.findIndex((item) => item.uid === choice.item.uid), stride = bot.gDeck.splice(strideIndex, 1)[0]; performStrideForPlayer(bot, stride, choice.payment); match.stridePerformed = true; choice.payment.forEach(cost=>queueMovedCardAbility(cost,"bot","discard","hand",{discardReason:"stride-cost",timingWindow:"stride-cost"})); addLog(`Practice Bot discarded cards to stride ${choice.card.name}.`); }
      }
      advanceBotPhase("Main");
      botUseBlasterOrder(bot);
      let calls = 0;
      while (bot.rear.includes(null) && calls < 2) { const unit = bot.hand.filter((x) => { const card = cardMap.get(x.cardId); return isUnitCard(card) && Number(card.grade || 0) <= Number(cardMap.get(bot.vanguard?.cardId)?.grade || 0); }).sort((a,b)=>botCallPriority(cardMap.get(b.cardId),bot)-botCallPriority(cardMap.get(a.cardId),bot))[0]; if (!unit) break; bot.hand = bot.hand.filter((x) => x.uid !== unit.uid); const card=cardMap.get(unit.cardId),preferred=Number(card.grade||0)>=2?[0,1,5,6,2,3,4]:[2,3,4,0,1,5,6],slot=preferred.map(i=>i<bot.rear.length?i:-1).find(i=>i>=0&&bot.rear[i]===null); if(slot<0){bot.hand.push(unit);break;} const zone=window.VanguardPracticeBot.rearGuardCircleForSlot(slot);if(!zone){bot.rear[slot]=null;bot.hand.push(unit);break;}bot.rear[slot] = { ...unit, rested: false, zone, circle: zone }; addLog(`Practice Bot called ${card.name} to ${slot<2||slot>=5?"the front row":"the back row"}.`); queueAbilityPrompts("place","bot",unit.uid,{source:"hand",zone}); calls++; }
      useBotActivatedSkills();
      advanceBotPhase("Battle");
      renderMatch(); setMessage("Practice Bot is attacking…");
      const attackOrder=[...bot.rear.slice(0,2),...bot.rear.slice(5),...bot.rear.slice(2,5),bot.vanguard]; const attackers = (match.initialBotTurn && match.firstSide === "bot" ? [] : attackOrder).filter((x) => { if(!x||x.rested||x.locked)return false;const field=findFieldCard(x.uid);return field&&continuousAttackRestriction(field).legal&&(field.zone==="vanguard"||field.zone==="rear-left"||field.zone==="rear-right"||field.zone.startsWith("accel-")||canAttackFromBackRow(field)); });
      match.botAttacks = attackers.map((x) => x.uid);
      setTimeout(nextBotAttack, 550);
      } catch(error) {
        console.error("Practice Bot turn failed; ending the bot turn safely.",error);
        addLog("Practice Bot could not complete an action. Its turn was ended so the match can continue.");
        finishBotTurn();
      }
    };
    botTimer = setTimeout(continueBotTurn, 750);
    // Arm the continuation before drawing: draw-trigger processing can open or
    // resolve abilities, and must never leave the practice match parked in Draw.
    try {
      queueTurnStartEvent("bot");
    } catch(error) {
      console.error("Practice Bot turn-start trigger failed; continuing the turn.",error);
      addLog("Practice Bot could not process a turn-start trigger; continuing its turn.");
    }
    try {
      standAllUnits("bot");
    } catch(error) {
      console.error("Practice Bot stand trigger failed; continuing the turn.",error);
      addLog("Practice Bot could not process a Stand trigger; continuing its turn.");
    }
    advanceBotPhase("Draw");
    try {
      const card = draw("bot");
      if (card) addLog("Practice Bot drew a card for the Draw phase.");
    } catch (error) {
      console.error("Practice Bot draw action failed; continuing its turn.", error);
      addLog("Practice Bot could not complete its Draw action; continuing its turn.");
    }
    renderMatch(); setMessage("Practice Bot is taking its turn…");
  }
  function nextBotAttack() {
    if(!match||match.ended||match.side!=="bot"||match.pendingAttack||match.pendingTrigger)return;const bot=match.players.bot,uid=match.botAttacks.shift();if(!uid){finishBotTurn();return}const attacker=[bot.vanguard,...bot.rear].find(x=>x?.uid===uid);if(!attacker){nextBotAttack();return}const card=cardMap.get(attacker.cardId),field=findFieldCard(uid);if(!field||!continuousAttackRestriction(field).legal){nextBotAttack();return}
    const column=rearColumn(field.zone),canBoost=continuousBoostRestriction(field).legal,booster=canBoost&&column?bot.rear.map((unit,index)=>({unit,index,zone:["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:bot.accelZones||0},(_,i)=>`accel-${i+1}`)][index]})).find(entry=>entry.unit&&!entry.unit.rested&&entry.zone.startsWith("rear-back")&&rearColumn(entry.zone)===column):null;let boostPower=0;if(booster){booster.unit.rested=true;boostPower=attackerPower({instance:booster.unit,side:"bot",zone:booster.zone},{boosterCardInstanceId:booster.unit.uid,boostedUnitInstanceId:uid});addLog(`Practice Bot boosted ${card?.name||"its unit"} with ${cardMap.get(booster.unit.cardId)?.name||"a Rear-Guard"}.`)}
    const legionMate=field.zone==="vanguard"&&attacker.legionMate?.uid&&attacker.legionMate.legionLeaderInstanceId===attacker.uid?attacker.legionMate:null,attackingCardInstanceIds=[attacker.uid,...(legionMate?[legionMate.uid]:[])],power=attackerPower({...field,instance:attacker},{boosterCardInstanceId:booster?.unit.uid||null,boostedUnitInstanceId:booster?.unit.uid?attacker.uid:null})+(legionMate?attackerPower({instance:legionMate,side:"bot",zone:"vanguard"}):0)+boostPower,human=match.players.human,front=human.rear.map((unit,index)=>({unit,index,zone:index===0?"rear-left":index===1?"rear-right":index>=5?`accel-${index-4}`:""})).filter(entry=>entry.unit&&entry.zone),valuable=front.filter(entry=>power>=attackerPower({instance:entry.unit,side:"human",zone:entry.zone})&&(Number(cardMap.get(entry.unit.cardId)?.grade||0)>=2||hasIntercept(cardMap.get(entry.unit.cardId)))).sort((a,b)=>Number(cardMap.get(b.unit.cardId)?.grade||0)-Number(cardMap.get(a.unit.cardId)?.grade||0)+Number(cardMap.get(b.unit.cardId)?.power||0)-Number(cardMap.get(a.unit.cardId)?.power||0))[0],attackRear=Boolean(valuable&&human.damage.length>=4);const target=attackRear?valuable.unit:human.vanguard,targetZone=attackRear?valuable.zone:"vanguard",targetPower=target?attackerPower({instance:target,side:"human",zone:targetZone}):0,driveCount=field.zone==="vanguard"?getDriveValue(card,field):0;
    queueAbilityPrompts("attackStep","bot",uid,{actingPlayerId:match.players.bot.playerId||"bot",playerAttackCount:window.VanguardAbilityEngine.getPlayerAttackCount(match,match.players.bot.playerId||"bot")+1,timingWindow:"attack-step-start"});attacker.rested=true;if(legionMate){legionMate.rested=true;legionMate.position="rest"}match.pendingAttack={battleId:crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,attacker:card?.name||"unit",attackerUid:uid,attackerSide:"bot",attackerZone:field.zone,attackingCardInstanceIds,defenderSide:"human",targetUid:target?.uid,targetRearIndex:attackRear?valuable.index:-1,targetZone,power,powerBeforeBoost:attackerPower({...field,instance:attacker}),boostPower,boostUid:booster?.unit.uid||null,targetPower,critical:attackerCritical({...field,instance:attacker}),guardCards:[],driveChecksRemaining:driveCount,driveChecksPerformed:0,maxDriveChecks:driveCount,driveCountChosen:true,driveCountPrompt:false};
    window.VanguardAbilityEngine.recordAttackCount(match,match.players.bot.playerId||"bot",uid);if(booster)queueAbilityPrompts("boost","bot",booster.unit.uid,{zone:booster.zone,boostedUid:uid});queueAbilityPrompts("attack","bot",uid,{zone:field.zone,targetZone,boostUid:booster?.unit.uid||null,attackingCardInstanceIds,battleId:match.pendingAttack.battleId});queueAbilityPrompts("attacked","human",target.uid,{zone:targetZone,targetZone,sourceCardInstanceId:uid,attackingCardInstanceIds,actingPlayerId:match.players.bot.playerId,boostUid:match.pendingAttack.boostUid,battleId:match.pendingAttack.battleId,timingWindow:"attack-declared"});match.selected=null;setMessage(`Practice Bot attacks with ${card?.name||"a unit"}${attackRear?` at your ${targetZone.startsWith("accel-")?"Accel circle":"Rear-Guard"}`:" your Vanguard"}. Guard or take the hit.`);renderMatch();
  }  function finishBotTurn(){if(!match||match.ended||match.pendingTurnEnd)return;advanceBotPhase("End");beginTurnEnd("bot")}
  function retireChargingUnitsAtBattleEnd(){const pending=match?.pendingChargeCleanup;if(!pending)return 0;match.pendingChargeCleanup=null;const retired=window.VanguardAbilityEngine.retireChargingUnitsAtBattleEnd(match.players,pending.battleId,pending.participantInstanceIds);for(const item of retired){addLog((cardMap.get(item.instance.cardId)?.name||"A charging Rear-Guard")+" was put on the bottom of its owner's deck at the end of battle.");queueMovedCardAbility(item.instance,item.side,"move",item.zone,{previousLocation:item.zone,currentLocation:"deck",battleId:item.battleId,actingPlayerId:match.players[item.side]?.playerId,timingWindow:"charge-retirement"})}return retired.length}
  function beginTurnEnd(side){const player=match?.players?.[side];if(!player||match.pendingTurnEnd)return;match.pendingTurnEnd={playerId:player.playerId,side,turn:match.turn,turnEndEventId:`${match.matchId||"match"}:turn-end:${match.turn}:${player.playerId}`};queueTurnEndEvent(side);resumeAbilityQueue();if(match?.pendingTurnEnd)renderMatch()}
  function resumeAbilityQueue(){if(!match)return;if(match.pendingAbility||match.pendingAbilities?.length){showNextAbilityPrompt();return}if(match.pendingTurnEnd?.endPhaseRescanPending){const pending=match.pendingTurnEnd;pending.endPhaseRescanPending=false;if(Number(pending.turn)===Number(match.turn)&&pending.playerId===match.players?.[pending.side]?.playerId)queueTurnEndEvent(pending.side,true);if(match.pendingAbility||match.pendingAbilities?.length){showNextAbilityPrompt();return}}resolvePendingBattleEnd();if(match.pendingAbility||match.pendingAbilities?.length){showNextAbilityPrompt();return}if(match.pendingChargeCleanup){retireChargingUnitsAtBattleEnd();if(match.pendingAbility||match.pendingAbilities?.length){showNextAbilityPrompt();return}}if(match.pendingTurnEnd){const playerId=match.pendingTurnEnd.playerId;match.pendingTurnEnd=null;completeTurnTransition(playerId);return}if(match.resumeAfterAbility==="bot-defense"){match.resumeAfterAbility=null;practiceBotDefend();return}showNextAbilityPrompt()}
  function retireHollowedUnitsAtTurnEnd(endingPlayerId){const seen=match.hollowRetiredThisTurn||=([]),candidates=[];for(const[side,player]of Object.entries(match.players||{}))for(let index=0;index<(player.rear||[]).length;index++){const instance=player.rear[index];if(instance?.hollowed===true&&instance.hollowedExpiry===endingPlayerId&&!seen.includes(`${match.turn}:${endingPlayerId}:${instance.uid}`))candidates.push({side,instance,zone:index<5?["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right"][index]:`accel-${index-4}`})}if(!candidates.length)return 0;for(const item of candidates)seen.push(`${match.turn}:${endingPlayerId}:${item.instance.uid}`);const retired=window.VanguardAbilityEngine.retireHollowedUnitsAtTurnEnd(match.players,endingPlayerId);for(const item of retired){addLog((cardMap.get(item.instance.cardId)?.name||"A hollowed Rear-Guard")+" was retired by Hollow at the end of the turn.");queueMovedCardAbility(item.instance,item.side,"retire",item.zone,{previousLocation:item.zone,currentLocation:"drop",actingPlayerId:endingPlayerId,turnPlayerId:endingPlayerId,timingWindow:"hollow-retirement"})}return retired.length}
  function completeTurnTransition(endingPlayerId){if(!match)return;const endingSide=["human","bot"].find(side=>match.players[side]?.playerId===endingPlayerId);if(!endingSide)return;const endingPlayer=match.players[endingSide];const hollowRetired=retireHollowedUnitsAtTurnEnd(endingPlayerId);if(hollowRetired&&(match.pendingAbility||match.pendingAbilities?.length)){match.pendingTurnEnd={playerId:endingPlayerId,side:endingSide,turn:match.turn};showNextAbilityPrompt();renderMatch();return}window.VanguardAbilityEngine.expireHarmonyAssociations(match,`${match.turn}:${endingSide}`);window.VanguardAbilityEngine.clearOpponentTriggerFacts(match.players);if(online.role){addLog(endingPlayer.name+" ended their turn.");match.firstTurnComplete=true;returnStriddenVanguard(endingSide);clearTurnBonuses(endingSide);match.ridePerformed=false;match.stridePerformed=false;match.ordersPlayedThisTurn=0;match.selected=null;match.pendingAttack=null;const nextSide=flipSide(endingSide);match.side=nextSide;match.phase=0;match.turn+=1;match.turnStartGrades||={};match.turnStartGrades[nextSide]=Number(cardMap.get(match.players[nextSide].vanguard?.cardId)?.grade??-1);match.drewThisTurn=false;queueTurnStartEvent(nextSide);standAllUnits(nextSide);setMessage(match.players[nextSide].name+"'s turn — Stand phase.");renderMatch();return}if(endingSide==="human"){addLog("You ended your turn.");match.firstTurnComplete=true;returnStriddenVanguard("human");clearTurnBonuses("human");match.ridePerformed=false;match.stridePerformed=false;match.ordersPlayedThisTurn=0;match.selected=null;renderMatch();botTurn();return}returnStriddenVanguard("bot");clearTurnBonuses("bot");match.side="human";match.phase=0;match.drewThisTurn=false;match.ridePerformed=false;match.stridePerformed=false;match.turnStartGrades||={};match.turnStartGrades.human=Number(cardMap.get(match.players.human.vanguard?.cardId)?.grade??-1);match.ordersPlayedThisTurn=0;match.pendingAttack=null;match.selected=null;if(match.initialBotTurn)match.initialBotTurn=false;else match.turn+=1;match.firstTurnComplete=true;queueTurnStartEvent("human");standAllUnits("human");addLog("Your turn began — advance to Draw to draw a card.");setMessage("Your turn — Stand phase.");renderMatch()}
  function endTurn(){if(!match||match.ended)return;if(match.pendingTurnEnd)return;if(match.side!=="human"||match.phase!==phases.length-1||match.pendingAttack||match.pendingAbility||match.pendingAbilities?.length||match.pendingTrigger){toast("Finish the End phase after resolving pending actions.");return}beginTurnEnd("human")}  function returnStriddenVanguard(side) { const player=match?.players?.[side],unit=player?.vanguard;if(!unit?.strideHeart)return;const hearts=unit.strideHearts||[unit.strideHeart],heart=hearts.find((item)=>!isGDeckCard(cardMap.get(item.cardId))&&!isGGuardian(cardMap.get(item.cardId)))||unit.strideHeart,stride={...unit};delete stride.strideHeart;delete stride.strideHearts;const gHearts=hearts.filter((item)=>isGDeckCard(cardMap.get(item.cardId))&&!isGGuardian(cardMap.get(item.cardId)));gHearts.forEach((item)=>player.gZone.push({...item,faceUp:true,rested:false}));hearts.filter((item)=>item.uid!==heart.uid&&!gHearts.some((g)=>g.uid===item.uid)).forEach((item)=>player.soul.push(item));player.vanguard={...heart,rested:Boolean(unit.rested)};player.gZone.push({...stride,faceUp:true,rested:false});addLog(`${cardMap.get(stride.cardId)?.name||"The G Unit"} and its G-unit heart cards returned face up to the G zone; ${cardMap.get(heart.cardId)?.name||"the heart"} returned to the Vanguard circle.`); }
  function clearTurnBonuses(side) { window.VanguardAbilityEngine.expireTurnModifiers(match?.players,side); }
  function flipTurnBonusOwners(players) { const seen=new Set();const walk=(value)=>{if(!value||typeof value!=="object"||seen.has(value))return;seen.add(value);if(value.turnPowerExpiry)value.turnPowerExpiry=flipSide(value.turnPowerExpiry);if(value.turnCriticalExpiry)value.turnCriticalExpiry=flipSide(value.turnCriticalExpiry);if(value.turnDriveExpiry)value.turnDriveExpiry=flipSide(value.turnDriveExpiry);if(value.engorgedExpiry)value.engorgedExpiry=flipSide(value.engorgedExpiry);if(value.engorgeRetiredCountExpiry)value.engorgeRetiredCountExpiry=flipSide(value.engorgeRetiredCountExpiry);Object.values(value).forEach(walk);};Object.values(players||{}).forEach(walk); }
  function advancePhase() {
    if (!match || match.ended) return;
    if (match.side !== "human" || match.pendingAttack || match.pendingTurnEnd || match.pendingAbility || match.pendingAbilities?.length || match.pendingTrigger) { toast("Wait until it is your turn and all pending actions are resolved."); return; }
    if (match.phase >= phases.length - 1) { endTurn(); return; }
    const previousPhase=phases[match.phase]; match.phase += 1; if(match.players.human.format==="standard"&&match.phase===3)match.phase=4; match.selected = null; queuePhaseChangeEvent("human",previousPhase,phases[match.phase]); if(match.phase===2)chargeEnergyAtRidePhase(match.players.human);
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
    if(!window.VanguardAbilityEngine.canRideCard(cardMap.get(instance.cardId),{vanguardCard:cardMap.get(player.vanguard?.cardId),crests:(player.crests||[]).map(crest=>cardMap.get(crest.cardId))})){toast("This card cannot be ridden under your current ride restrictions.");return;}
    if(player.vanguard?.uid===instance.uid){toast("That card is already your Vanguard.");return;}
    if(field)player.rear[field.index]=null;
    else sourceCards.splice(sourceCards.findIndex(card=>card.uid===uid),1);
    const previous=player.vanguard;
    if(previous)player.soul.push(previous);
    player.vanguard={...instance,rested:false};
    window.VanguardAbilityEngine.recordFightRide(player,cardMap.get(instance.cardId));
    if(source==="deck")shuffle(player.deck);
    if(match.revealed?.owner==="human"&&source==="reveal"&&!match.revealed.cards.length)match.revealed=null;
    match.selected=null;match.ridePerformed=true;
    addLog(`${player.name} Superior Rode ${cardMap.get(instance.cardId)?.name||"a Unit"} from ${source}.`);
    if(source==="damage")queueAbilityPrompts("damageLeave","human",instance.uid,{zone:"damage",currentLocation:"vanguard",subjectInstance:instance});else queueMovedCardAbility(instance,"human","move",field?.zone||source,{currentLocation:"vanguard"});if(previous)queueAbilityPrompts("ride","human",previous.uid,{zone:"soul"});queueAbilityPrompts("place","human",instance.uid,{sourceZone:field?.zone||source,source,zone:"vanguard",currentLocation:"vanguard"});
    askForCardCrest("human",instance);setMessage("Superior Ride complete.");
  }
  function manualGameAction(action) {
    if(match?.pendingTurnEnd){toast("Resolve the pending end-of-turn abilities first.");return;}
    if (!match || match.ended) return;
    const player = match.players.human, card = selectedHandCard();
    if (player.format === "standard" && (action === "stride" || action.startsWith("stride:") || action.startsWith("stride-cost:") || action === "stride-confirm" || action === "g-guard" || action.startsWith("g-guard:"))) { toast("Standard decks have a Ride Deck instead of a G-deck."); return; }
    if (action === "ride-deck-open") { if (player.format !== "standard" || match.side !== "human" || match.phase !== 2 || match.ridePerformed || match.pendingRide) { toast("Use your Ride Deck during your Ride phase, once per turn."); return; } match.pendingRide = { ownerSide: "human", stage: "choose", unitUid: "", costUid: "" }; return; }
    if (action === "ride-deck-cancel") { if (match.pendingRide?.ownerSide === "human") match.pendingRide = null; $("#ride-deck-dialog").close(); $("#ride-deck-cost-dialog").close(); return; }
    if (action.startsWith("ride-deck-select:")) { const state = match.pendingRide, uid = action.slice("ride-deck-select:".length), rider = player.rideDeck?.find(item => item.uid === uid), grade = Number(cardMap.get(rider?.cardId)?.grade), current = Number(cardMap.get(player.vanguard?.cardId)?.grade); if (!state || state.ownerSide !== "human" || state.stage !== "choose" || match.side !== "human" || match.phase !== 2 || match.ridePerformed || !rider || grade < current || grade > current + 1) { toast("That Ride Deck unit cannot be ridden now."); return; } state.unitUid = uid; return; }
    if (action === "ride-deck-begin") { const state = match.pendingRide, rider = player.rideDeck?.find(item => item.uid === state?.unitUid), grade = Number(cardMap.get(rider?.cardId)?.grade), current = Number(cardMap.get(player.vanguard?.cardId)?.grade); if (!state || state.ownerSide !== "human" || state.stage !== "choose" || !rider || grade < current || grade > current + 1 || match.side !== "human" || match.phase !== 2 || match.ridePerformed) { toast("Select a legal unit from your Ride Deck first."); return; } state.stage = "cost"; state.costUid = ""; return; }
    if (action.startsWith("ride-deck-cost:")) { const state = match.pendingRide, uid = action.slice("ride-deck-cost:".length); if (!state || state.ownerSide !== "human" || state.stage !== "cost" || !player.hand.some(item => item.uid === uid)) { toast("Choose a card in your hand to discard as the ride cost."); return; } state.costUid = uid; return; }
    if (action === "ride-deck-confirm") { const state = match.pendingRide, rideIndex = player.rideDeck?.findIndex(item => item.uid === state?.unitUid) ?? -1, costIndex = player.hand.findIndex(item => item.uid === state?.costUid), rider = rideIndex >= 0 ? player.rideDeck[rideIndex] : null, riderCard = cardMap.get(rider?.cardId), grade = Number(riderCard?.grade), current = Number(cardMap.get(player.vanguard?.cardId)?.grade); if (!state || state.ownerSide !== "human" || state.stage !== "cost" || match.side !== "human" || match.phase !== 2 || match.ridePerformed || rideIndex < 0 || costIndex < 0 || grade < current || grade > current + 1 || !window.VanguardAbilityEngine.canRideCard(riderCard, { vanguardCard: cardMap.get(player.vanguard?.cardId), crests: (player.crests || []).map(crest => cardMap.get(crest.cardId)) })) { toast("The Ride Deck choice or discard cost is no longer legal."); return; } const cost = player.hand.splice(costIndex, 1)[0], previous = player.vanguard; player.drop.push(cost); player.rideDeck.splice(rideIndex, 1); if (previous) player.soul.push(previous); player.vanguard = { ...rider, rested: false }; window.VanguardAbilityEngine.recordFightRide(player, riderCard); match.ridePerformed = true; match.pendingRide = null; $("#ride-deck-dialog").close(); $("#ride-deck-cost-dialog").close(); addLog(`${player.name} discarded a card and rode ${riderCard.name} from the Ride Deck.`); queueMovedCardAbility(cost, "human", "discard", "hand", { discardReason: "ride-deck-cost", timingWindow: "ride-cost" }); if (previous) queueAbilityPrompts("ride", "human", previous.uid, { zone: "soul" }); queueAbilityPrompts("place", "human", rider.uid, { source: "ride-deck", zone: "vanguard" }); askForCardCrest("human", rider); return; }
    if (action.startsWith("activate-skill:")) { const [,uid,...idParts]=action.split(":"); const abilityId=idParts.join(":"); const field=findFieldCard(uid),located=field?null:window.VanguardAbilityEngine.locateCardInstance(match,uid); const source=field?.side==="human"?{...field,side:"human"}:located&&!located.ambiguous&&located.side==="human"&&located.zone==="g-deck"?{side:"human",zone:"g-deck",instance:located.instance}:null; if(!source)return; const ability=eligibleActivatedAbilities(source).find(candidate=>candidate.id===abilityId); if(!ability){toast("This skill cannot be activated right now; check its conditions and once-per-turn use.");return;} if(match.pendingAbility||match.pendingTrigger){toast("Finish the current skill prompt first.");return;} match.pendingAbility={side:"human",field:source.zone,instance:source.instance,ability};showNextAbilityPrompt();return; }
    if (action.startsWith("superior-ride:")) { const [,source,uid]=action.split(":"); performSuperiorRide(source,uid); return; }
    if (action === "g-assist") {
      if (match.side !== "human" || match.phase !== 1 || !canGAssist(player) || match.pendingGAssist) { toast("G Assist is available during Draw only when you lack a Unit exactly one grade above your Vanguard."); return; }
      const cards=[]; for(let i=0;i<5&&player.deck.length;i++)cards.push(player.deck.pop());
      match.pendingGAssist={ownerSide:"human",stage:"choose",cards,discardUids:[]}; renderGAssistDialog(); return;
    } else if (action.startsWith("g-assist-pick:")) {
      const state=match.pendingGAssist,uid=action.slice("g-assist-pick:".length); if(!state||state.ownerSide!=="human"||state.stage!=="choose")return;
      const index=state.cards.findIndex(item=>item.uid===uid),instance=index>=0?state.cards[index]:null,grade=gradeOf(cardMap.get(player.vanguard?.cardId))+1;
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
      const top=player.deck.pop();if(!top){toast("Your deck is empty.");return;}player.drop.push(top);queueMovedCardAbility(top,"human","move","deck",{currentLocation:"drop"});addLog(`${player.name} sent ${cardMap.get(top.cardId)?.name||"the top card"} of the deck to Drop.`);
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
      if(action==="drive-check"){if(!player.deck.length){match.pendingAttack.driveChecksRemaining=0;match.pendingAttack.awaitingDrive=true;addLog(`${player.name} has no cards left to reveal; remaining drive checks were skipped.`);resolvePracticeAttackAfterDrives();return;}match.pendingAttack.driveChecksRemaining-=1;match.pendingAttack.driveChecksPerformed=Number(match.pendingAttack.driveChecksPerformed||0)+1;}
      const top = player.deck.pop(); if (!top) { toast("Your deck is empty."); return; }
      const kind = triggerKind(top), over = kind === "over";
      if (action === "damage-check") { if (!over) player.damage.push(top); } else if (!over) player.hand.push(top);
      const checkName = action === "damage-check" ? "damage" : action === "trigger-check" ? "trigger" : "drive";if(checkName==="damage"||checkName==="drive")recordOpponentCheckTrigger("human",top,checkName);
      addLog(`${player.name} performed a ${checkName} check and revealed ${cardMap.get(top.cardId)?.name || "a card"}.`);
      beginTriggerResolution("human", top, checkName);
      const checkEventName=checkName==="drive"?"driveCheck":checkName==="damage"?"damageCheck":"triggerCheck",checkLocation=over?"revealed":checkName==="damage"?"damage":"hand";queueAbilityPrompts(checkEventName,"human",top.uid,{sourceCardInstanceId:match.pendingAttack?.attackerUid||null,actingPlayerId:player.playerId,sourceZone:"deck",previousLocation:"deck",currentLocation:checkLocation,subjectInstance:top,checkKind:checkName,checkSourceLocation:match.pendingAttack?.attackerZone||null,checkIndex:checkName==="drive"?Math.max(1,Number(match.pendingAttack?.driveChecksPerformed||1)):1,revealedTrigger:kind,battleId:match.pendingAttack?.battleId||null,timingWindow:checkName+"-check"});
      if(action==="damage-check"&&triggerKind(top)!=="over")queueAbilityPrompts("damagePlace","human",top.uid,{zone:"damage",sourceZone:"deck",currentLocation:"damage"});
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
        if(!window.VanguardAbilityEngine.canRideCard(cardMap.get(instance.cardId),{vanguardCard:cardMap.get(player.vanguard?.cardId),crests:(player.crests||[]).map(crest=>cardMap.get(crest.cardId))})){toast("This card cannot be ridden under your current ride restrictions.");return;}
        const grade = gradeOf(cardMap.get(instance.cardId)), currentGrade = gradeOf(cardMap.get(player.vanguard?.cardId)), previousVanguard=player.vanguard;
        if (match.side !== "human" || match.phase !== 2 || match.ridePerformed || grade < 0 || currentGrade < 0 || grade < currentGrade || grade > currentGrade + 1) { toast("A normal ride is once per turn and must be the same grade or one grade higher than your Vanguard."); return; }
        player.hand = player.hand.filter((item) => item.uid !== instance.uid); if (player.vanguard) player.soul.push(player.vanguard); player.vanguard = { ...instance, rested: false }; window.VanguardAbilityEngine.recordFightRide(player,cardMap.get(instance.cardId)); match.selected = null;
        match.ridePerformed = true; askForCardCrest("human", instance);
        addLog(`${player.name} rode ${cardMap.get(instance.cardId)?.name || "a card"} to vanguard.`); if(previousVanguard)queueAbilityPrompts("ride","human",previousVanguard.uid,{zone:"soul"}); queueAbilityPrompts("place","human",instance.uid,{source:"hand",zone:"vanguard"});
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
    } else if (action === "add-critical") {
      const field=findFieldCard(match.selected); if(!field||field.side!=="human"||match.side!=="human"){toast("Choose one of your units during your turn.");return;}
      field.instance.turnCriticalBoost=Number(field.instance.turnCriticalBoost||0)+1;field.instance.turnCriticalExpiry="human";
      if(match.pendingAttack?.attackerUid===field.instance.uid)match.pendingAttack.critical+=1;
      addLog(`${player.name} gave ${cardMap.get(field.instance.cardId)?.name||"a unit"} +1 critical until end of turn.`);
    } else if (action.startsWith("set-power:")) {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") return;
      const amount = Number(action.slice("set-power:".length)); if (!Number.isFinite(amount)) return;
      field.instance.turnPowerBoost = Number(field.instance.turnPowerBoost || 0) + amount;
      field.instance.turnPowerExpiry = "human";
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
      queueAbilityPrompts("place","human",instance.uid,{sourceZone:"hand",zone:"order",currentLocation:"order",subjectInstance:instance,timingWindow:"order-zone-placement"});
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a card"} from hand to the Order zone.`);
    } else if (action.startsWith("gdeck-reveal:")) {
      const instance = player.gDeck?.find(item => item.uid === action.slice("gdeck-reveal:".length));
      if (!instance) { toast("That card is no longer in the G deck."); return; }
      // Reveal a copy so closing the existing shared reveal cannot move or flip the original.
      match.publicReveal = { owner: "human", instance: { ...instance } };
      addLog(`${player.name} revealed ${cardMap.get(instance.cardId)?.name || "a G card"} from the G deck. Its face-down state is unchanged.`);
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
      if (match.side !== "human" || match.phase !== 4 || /Blitz Order/i.test(orderCard.type) || (match.ordersPlayedThisTurn || 0) >= 1 || gradeOf(orderCard) < 0 || orderGrade < 0 || gradeOf(orderCard) > orderGrade) { toast("During Main phase, play one non-Blitz Order per turn with grade no higher than your Vanguard."); return; }
      player.hand = player.hand.filter((item) => item.uid !== instance.uid); player.orders.push(instance); match.ordersPlayedThisTurn = (match.ordersPlayedThisTurn || 0) + 1; match.selected = null;
      queueAbilityPrompts("place","human",instance.uid,{sourceZone:"hand",zone:"order",currentLocation:"order",subjectInstance:instance,timingWindow:"order-zone-placement"});
      addLog(`${player.name} played ${cardMap.get(instance.cardId)?.name || "an Order"} to the Order zone.`);
    } else if (action === "bind") {
      const field = findFieldCard(match.selected); const hand = selectedHandCard(); const instance = hand || (field?.side === "human" ? field.instance : null);
      if (!instance) { toast("Select a card in your hand or on your field to bind it."); return; }
      if (hand) player.hand = player.hand.filter((item) => item.uid !== instance.uid); else if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.bind ||= []; player.bind.push(instance); queueMovedCardAbility(instance,"human","bind",hand?"hand":field?.zone||"hand",{currentLocation:"bind"}); match.selected = null; addLog(`${player.name} bound ${cardMap.get(instance.cardId)?.name || "a card"}.`);
    } else if (action.startsWith("reveal-action:")) {
      const [, choice, uid] = action.split(":"); const reveal = match.revealed; if (!reveal || reveal.owner !== "human") return;
      const index = reveal.cards.findIndex((item) => item.uid === uid); if (index < 0) return; const instance = reveal.cards.splice(index, 1)[0];
      if (choice === "hand") player.hand.push(instance); else if (choice === "soul") player.soul.push(instance); else player.drop.push(instance);
      if(choice==="drop")queueMovedCardAbility(instance,"human","move","reveal",{currentLocation:"drop"});else if(choice==="soul")queueMovedCardAbility(instance,"human","soulMove","reveal",{currentLocation:"soul"});
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
        if(source==="damage")queueAbilityPrompts("damageLeave","human",instance.uid,{zone:"damage",currentLocation:targetZone==="vanguard"?"vanguard":"rear-guard",subjectInstance:instance});
        if(targetZone==="vanguard"){
          const previous=player.vanguard;if(previous)player.soul.push(previous);player.vanguard={...instance,rested:false};
          if(previous)queueAbilityPrompts("ride","human",previous.uid,{zone:"soul"});queueAbilityPrompts("place","human",instance.uid,{source,zone:"vanguard"});
        }else callUnitToRear(player,"human",instance,rearIndex,{source});
        if(source==="reveal"&&!sourceCards.length)match.revealed=null;
        match.selected=null;zoneFieldSelection=null;addLog(`${player.name} moved ${card?.name||"a Unit"} from ${source==="soul"?"Soul":"a zone"} to ${targetZone==="vanguard"?"Vanguard":targetZone}.`);return;
      }
      const instance = sourceCards.splice(index, 1)[0];
      if(source==="damage")queueAbilityPrompts("damageLeave","human",instance.uid,{zone:"damage",currentLocation:({hand:"hand",soul:"soul",bind:"bind","deck-top":"deck","deck-bottom":"deck",drop:"drop"})[choice]||"drop",subjectInstance:instance});
      if (choice === "hand") player.hand.push(instance);
      else if (choice === "soul") player.soul.push(instance);
      else if (choice === "bind") { player.bind ||= []; player.bind.push(instance); }
      else if (choice === "field") return;
      else if (choice === "deck-top") player.deck.push(instance);
      else if (choice === "deck-bottom") player.deck.unshift(instance);
      else player.drop.push(instance);
      const destination = { hand: "hand", soul: "Soul", bind: "Bind", drop: "Drop", "deck-top": "the top of the deck", "deck-bottom": "the bottom of the deck" }[choice] || "Drop";
      if(source!=="damage"){const currentLocation=({hand:"hand",soul:"soul",bind:"bind","deck-top":"deck","deck-bottom":"deck",drop:"drop"})[choice]||"drop",eventName=choice==="soul"?"soulMove":choice==="bind"?"bind":"move";queueMovedCardAbility(instance,"human",eventName,source,{currentLocation});}
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a card"} from ${source === "gdeck" ? "the G deck" : source === "bind" ? "Bind" : source === "soul" ? "Soul" : "the deck"} to ${destination}.`);
    } else if (action.startsWith("deck-action:")) {
      const [, choice, uid] = action.split(":"); const index = player.deck.findIndex((item) => item.uid === uid); if (index < 0) return; const instance = player.deck.splice(index, 1)[0];
      if (choice === "hand") player.hand.push(instance); else if (choice === "soul") player.soul.push(instance); else player.drop.push(instance); if(choice==="drop")queueMovedCardAbility(instance,"human","move","deck",{currentLocation:"drop"});
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "a card"} from the deck to ${choice === "hand" ? "hand" : choice === "soul" ? "Soul" : "Drop"}.`); renderMatch(); return;
    } else if (action.startsWith("damage-action:")) {
      const [, choice, uid] = action.split(":"); const index=player.damage.findIndex((item)=>item.uid===uid); if(index<0)return; const damage=player.damage[index];
      if(choice==="heal"){const healed=player.damage.splice(index,1)[0];player.drop.push(healed);queueAbilityPrompts("damageLeave","human",healed.uid,{zone:"damage"});}else damage.faceDown=choice === "counter-blast";
      $("#damage-dialog").close(); addLog(`${player.name} ${choice === "heal" ? "healed" : choice === "counter-blast" ? "Counter-Blasted" : "Counter-Charged"} ${cardMap.get(damage.cardId)?.name || "a damage card"}${choice === "heal" ? " to Drop" : ""}.`);
    } else if (action.startsWith("drop-action:")) {
      const [, choice, uid, zone] = action.split(":"); const index=player.drop.findIndex((item)=>item.uid===uid); if(index<0)return; const instance=player.drop[index];
      if(choice==="hand"){player.hand.push(player.drop.splice(index,1)[0]);} else if(choice==="soul"){player.soul.push(player.drop.splice(index,1)[0]);} else if(choice==="bind"){player.bind.push(player.drop.splice(index,1)[0]);} else if(choice==="deck-top"){player.deck.push(player.drop.splice(index,1)[0]);} else if(choice==="deck-bottom"){player.deck.unshift(player.drop.splice(index,1)[0]);}
      else if(choice==="field"){const fields=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>"accel-"+(i+1))],instance=player.drop.splice(index,1)[0];if(zone==="vanguard"){const previous=player.vanguard;if(previous)player.soul.push(previous);player.vanguard={...instance,rested:false};if(previous)queueAbilityPrompts("ride","human",previous.uid,{zone:"soul"});queueAbilityPrompts("place","human",instance.uid,{source:"drop",zone:"vanguard"});}else{const ix=fields.indexOf(zone);if(ix<0){player.drop.splice(index,0,instance);toast("Choose a Rear-Guard circle.");return;}callUnitToRear(player,"human",instance,ix,{source:"drop"});}}
      if(choice!=="field"){const currentLocation=({hand:"hand",soul:"soul",bind:"bind","deck-top":"deck","deck-bottom":"deck"})[choice]||"hand",eventName=choice==="soul"?"soulMove":choice==="bind"?"bind":"move";queueMovedCardAbility(instance,"human",eventName,"drop",{currentLocation});}
      addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name||"a Drop card"} ${choice==="hand"?"to hand":choice==="soul"?"to Soul":choice==="bind"?"to Bind":choice==="field"?"to the field":choice==="deck-top"?"to the top of the deck":"to the bottom of the deck"}.`);
    } else if (action === "counter-blast" || action === "counter-charge" || action === "heal-damage") { openDamageDialog(action); return;
    } else if (action.startsWith("soul-blast:")) {
      const wanted = new Set(action.slice("soul-blast:".length).split(",").filter(Boolean));
      const blasted = player.soul.filter((instance) => wanted.has(instance.uid));
      if (!blasted.length) { toast("Select at least one card in your soul."); return; }
      player.soul = player.soul.filter((instance) => !wanted.has(instance.uid)); player.drop.push(...blasted); blasted.forEach(card=>queueMovedCardAbility(card,"human","soulMove","soul",{currentLocation:"drop"})); addLog(`${player.name} Soul-Blasted ${blasted.length} card${blasted.length === 1 ? "" : "s"} to Drop.`);
    } else if (action === "soul-charge") {
      const top = player.deck.pop(); if (!top) { toast("Your deck is empty."); return; }
      player.soul.push(top); queueMovedCardAbility(top,"human","soulMove","deck",{currentLocation:"soul"}); addLog(`${player.name} Soul-Charged ${cardMap.get(top.cardId)?.name || "a card"}.`);
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
      field.instance.turnPowerBoost = Number(field.instance.turnPowerBoost || 0) + amount;
      field.instance.turnPowerExpiry = "human";
      if (match.pendingAttack?.attackerUid === field.instance.uid) match.pendingAttack.power = Number(match.pendingAttack.power || 0) + amount;
      if (match.pendingAttack?.targetUid === field.instance.uid) match.pendingAttack.targetPower = Number(match.pendingAttack.targetPower || 0) + amount;
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
    } else if (action === "stride" || action.startsWith("stride:") || action.startsWith("stride-cost:") || action === "stride-confirm" || action === "stride-cancel") {
      if (action === "view-gdeck") { openGDeckDialog("inspect"); return; }
      if (action === "stride") { if (match.side !== "human" || match.phase !== 3) { toast("Stride during your Stride step."); return; } openGDeckDialog("stride"); return; }
      if (action.startsWith("stride:")) {
        const uid = action.slice("stride:".length), stride = player.gDeck.find((item) => item.uid === uid), strideCard = cardMap.get(stride?.cardId);
        if (match.side !== "human" || match.phase !== 3 || match.stridePerformed || !canStrideForSide("human", match.turnStartGrades?.human)) { toast("Stride is once per turn. Your Vanguard must be grade 3 or greater, and either your opponent's Vanguard is grade 3 or greater or yours was grade 3 at the start of your turn."); return; }
        if (!stride || stride.faceUp || !isStrideUnit(strideCard)) { toast("Choose a face-down G Unit with a Stride ability."); return; }
        match.pendingStride = { ownerSide: "human", unitUid: uid, costUids: [], costValue: 0 }; if (!online.applyingRemote) renderStrideCostDialog(); return;
      }
      if (action === "stride-cancel") { if(match.pendingStride?.ownerSide==="human")match.pendingStride=null;$("#stride-cost-dialog").close();return; }
      if (action.startsWith("stride-cost:")) {
        const state = match.pendingStride, uid = action.slice("stride-cost:".length); if (!state || state.ownerSide !== "human") return;
        const item = player.hand.find((card) => card.uid === uid); if (!item) return;
        const stride = player.gDeck.find((card) => card.uid === state.unitUid), strideCard = cardMap.get(stride?.cardId), ultimate = /Ultimate\s+Stride/i.test(String(strideCard?.text || ""));
        if (ultimate) state.costUids = state.costUids.includes(uid) ? [] : [uid];
        else { const selected = new Set(state.costUids); selected.has(uid) ? selected.delete(uid) : selected.add(uid); state.costUids = [...selected]; } if (!online.applyingRemote) renderStrideCostDialog(); return;
      }
      const state = match.pendingStride; if (!state || state.ownerSide !== "human") return;
      const strideIndex = player.gDeck.findIndex((item) => item.uid === state.unitUid), stride = strideIndex >= 0 ? player.gDeck[strideIndex] : null, strideCard = cardMap.get(stride?.cardId), payment = player.hand.filter((item) => state.costUids.includes(item.uid));
      const ultimate = /Ultimate\s+Stride/i.test(String(strideCard?.text || "")), names = [cardMap.get(player.vanguard?.cardId)?.name, cardMap.get(player.vanguard?.strideHeart?.cardId)?.name];
      const validCost = ultimate ? payment.length === 1 && names.includes(cardMap.get(payment[0]?.cardId)?.name) : payment.length > 0 && payment.reduce((sum, item) => sum + strideGrade(item,true), 0) >= 3;
      if (!stride || stride.faceUp || !isStrideUnit(strideCard) || !validCost || match.stridePerformed || !canStrideForSide("human", match.turnStartGrades?.human)) { toast("Choose a legal Stride cost and eligible face-down G Unit."); return; }
      player.gDeck.splice(strideIndex, 1); performStrideForPlayer(player, stride, payment); match.stridePerformed = true; match.pendingStride = null; $("#stride-cost-dialog").close(); addLog(`${player.name} strode ${strideCard.name} over ${cardMap.get(player.vanguard.strideHeart?.cardId)?.name || "their Vanguard"}.`); payment.forEach(cost=>queueMovedCardAbility(cost,"human","discard","hand",{discardReason:"stride-cost",timingWindow:"stride-cost"})); renderMatch(); return;
    } else if (action.startsWith("gdeck-flip-up:")) {
      const uid=action.slice("gdeck-flip-up:".length),index=player.gDeck.findIndex(item=>item.uid===uid);if(index<0){toast("That card is no longer in the G deck.");return;}const instance=player.gDeck.splice(index,1)[0];player.gZone.push({...instance,faceUp:true});addLog(`${player.name} turned ${cardMap.get(instance.cardId)?.name||"a G card"} face up in the G zone.`);
    } else if (action.startsWith("gzone-flip-up:")) {
      const uid=action.slice("gzone-flip-up:".length),instance=player.gZone?.find(item=>item.uid===uid);if(!instance){toast("That card is no longer in the G zone.");return;}if(instance.faceUp){toast("That G-zone card is already face up.");return;}instance.faceUp=true;addLog(`${player.name} turned a G-zone card face up.`);
    } else if (action === "gdeck-to-g") {
      const unit = player.gDeck?.pop(); if (!unit) { toast("Your G deck is empty."); return; }
      player.gZone.push({ ...unit, faceUp: true }); addLog(`${player.name} placed a G-deck card face up in the G zone.`);
    } else if (action === "field-to-g") {
      const field = findFieldCard(match.selected); if (!field || field.side !== "human") { toast("Select a unit on your field first."); return; }
      const playerZone = field.zone === "vanguard" ? "vanguard" : "rear";
      if (playerZone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.gZone.push({ ...field.instance, faceUp: true }); queueMovedCardAbility(field.instance,"human","move",field.zone,{currentLocation:"g-zone"}); match.selected = null; addLog(`${player.name} moved a field unit face up to the G zone.`);
    } else if (action === "flip-g-unit") {
      const item=(player.gZone||[]).find(card=>card.faceUp);if(!item){toast("There are no face-up cards in your G zone.");return;}item.faceUp=false;addLog(`${player.name} turned a G-zone card face down.`);
    } else if (action === "g-guard" || action.startsWith("g-guard:")) {
      if (!match.pendingAttack||match.pendingAttack.defenderSide!=="human"||match.pendingAttack.defenderDone) { toast("Use G-Guard while you are defending an attack."); return; }
      if (action === "g-guard") { openGGuardCostDialog(); return; }
      const [,uid,healUid]=action.split(":"),grade=Number(cardMap.get(player.vanguard?.cardId)?.grade||0),attackerGrade=Number(cardMap.get(match.players[match.pendingAttack.attackerSide]?.vanguard?.cardId)?.grade||0),healIndex=player.hand.findIndex(item=>item.uid===healUid&&isGGuardCostCard(item)),index=player.gDeck?.findIndex(item=>item.uid===uid)??-1,guardian=index>=0?cardMap.get(player.gDeck[index].cardId):null;
      if(grade<3||attackerGrade<3||healIndex<0||index<0||player.gDeck[index]?.faceUp||!isGGuardian(guardian)){toast("G-Guard needs grade 3+ Vanguards, a legal Heal-cost card, and a face-down G Guardian.");return;}
      const cost=player.hand.splice(healIndex,1)[0],instance=player.gDeck.splice(index,1)[0];player.guardCircle||=[];match.pendingAttack.guardCards||=[];player.drop.push(cost);player.guardCircle.push(instance);match.pendingAttack.guardCards.push(instance);const shield=effectiveShieldValue(instance,"human");match.pendingAttack.targetPower+=shield;
      addLog(`${player.name} discarded ${cardMap.get(cost.cardId)?.name||"a Heal trigger"} to G-Guard with ${guardian.name} (+${shield.toLocaleString()} shield).`);queueMovedCardAbility(cost,"human","discard","hand",{discardReason:"g-guardian-cost",calledGUnitCardId:instance.cardId,calledGUnitInstanceId:instance.uid,calledGUnitCardName:guardian.name||null,calledGUnitPreviousLocation:"g-deck"});queueAbilityPrompts("place","human",instance.uid,{sourceZone:"guardian",previousLocation:"g-deck",zone:"guardian",currentLocation:"guardian",subjectInstance:instance,timingWindow:"guard-placement",battleId:match.pendingAttack?.battleId||null,targetUid:match.pendingAttack?.targetUid||null,targetZone:match.pendingAttack?.targetZone||null});match.selected=null;
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
    } else if(action.startsWith("order-to-soul:")) {
      const uid=action.slice("order-to-soul:".length),index=player.orders.findIndex(item=>item.uid===uid);if(index<0)return;const moved=player.orders.splice(index,1)[0];moved.rested=false;moved.faceDown=false;player.soul.push(moved);queueMovedCardAbility(moved,"human","soulMove","order",{currentLocation:"soul"});match.selected=null;addLog(`${player.name} moved ${cardMap.get(moved.cardId)?.name||"an Order"} from the Order zone to Soul.`);
    } else if(action.startsWith("order-rest:")) {
      const uid=action.slice("order-rest:".length),item=player.orders.find(card=>card.uid===uid);if(!item)return;item.rested=!item.rested;addLog(`${player.name} ${item.rested?"rested":"stood"} ${cardMap.get(item.cardId)?.name||"an Order"}.`);
    } else if(action.startsWith("order-flip:")) {
      const uid=action.slice("order-flip:".length),item=player.orders.find(card=>card.uid===uid);if(!item)return;item.faceDown=!item.faceDown;addLog(`${player.name} turned ${cardMap.get(item.cardId)?.name||"an Order"} ${item.faceDown?"face down":"face up"}.`);
    } else if (action.startsWith("order-to-hand:") || action.startsWith("order-to-top:") || action.startsWith("order-to-bottom:")) {
      const [destination, uid] = action.split(":"); const index = player.orders.findIndex(item => item.uid === uid); if (index < 0) return;
      const instance = player.orders.splice(index, 1)[0]; instance.rested=false; instance.faceDown=false;
      if (destination === "order-to-hand") { player.hand.push(instance); queueMovedCardAbility(instance,"human","move","order",{currentLocation:"hand"}); }
      else if (destination === "order-to-top") { player.deck.push(instance); queueMovedCardAbility(instance,"human","move","order",{currentLocation:"deck"}); }
      else { player.deck.unshift(instance); queueMovedCardAbility(instance,"human","move","order",{currentLocation:"deck"}); }
      match.selected = null; addLog(`${player.name} moved ${cardMap.get(instance.cardId)?.name || "an Order"} from the Order zone.`);    } else if (action.startsWith("order-to-drop:")) {
      const uid = action.slice("order-to-drop:".length), index = player.orders.findIndex((item) => item.uid === uid);
      if (index < 0) return;
      const moved=player.orders.splice(index, 1)[0]; moved.rested=false; moved.faceDown=false; player.drop.push(moved); queueMovedCardAbility(moved,"human","move","order",{currentLocation:"drop"}); addLog(`${player.name} moved an Order from the Order zone to drop.`);
    } else if (action === "selected-to-top" || action === "selected-to-bottom") {
      const field = findFieldCard(match.selected); if (field?.side !== "human") { toast("Select one of your field cards first."); return; }
      if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      if (action === "selected-to-top") player.deck.push(field.instance); else player.deck.unshift(field.instance);
      queueMovedCardAbility(field.instance,"human","move",field.zone,{currentLocation:"deck"});
      addLog(`${player.name} returned ${cardMap.get(field.instance.cardId)?.name || "a card"} to the ${action === "selected-to-top" ? "top" : "bottom"} of the deck.`); match.selected = null;    } else if (action === "selected-to-hand") {
      const field = findFieldCard(match.selected);
      if (field?.side !== "human") { toast("Select one of your field cards first."); return; }
      if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null;
      player.hand.push(field.instance); queueMovedCardAbility(field.instance,"human","move",field.zone,{currentLocation:"hand"}); match.selected = null;
      addLog(`${player.name} returned ${cardMap.get(field.instance.cardId)?.name || "a card"} from the field to hand.`);
    } else if (action === "selected-to-drop") {
      const hand = selectedHandCard(), field = findFieldCard(match.selected);
      if (hand) { player.hand = player.hand.filter((item) => item.uid !== hand.uid); player.drop.push(hand); queueMovedCardAbility(hand,"human","move","hand",{currentLocation:"drop"}); addLog(`${player.name} moved ${cardMap.get(hand.cardId)?.name || "a card"} from hand to Drop.`); }
      else if (field?.side === "human") { if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null; player.drop.push(field.instance); addLog(`${player.name} moved ${cardMap.get(field.instance.cardId)?.name || "a unit"} from the field to Drop.`); queueMovedCardAbility(field.instance,"human",field.zone==="vanguard"?"drop":"retire",field.zone); }
      else { toast("Select a card in your hand or on your field first."); return; }
      match.selected = null;
    } else if (action === "selected-to-soul") {
      const hand = selectedHandCard(), field = findFieldCard(match.selected);
      if (hand) { player.hand = player.hand.filter((item) => item.uid !== hand.uid); player.soul.push(hand); queueMovedCardAbility(hand,"human","soulMove","hand",{currentLocation:"soul"}); addLog(`${player.name} moved ${cardMap.get(hand.cardId)?.name || "a card"} from hand to Soul.`); }
      else if (field?.side === "human") { if (field.zone === "vanguard") player.vanguard = null; else player.rear[field.index] = null; player.soul.push(field.instance); queueMovedCardAbility(field.instance,"human","soulMove",field.zone,{currentLocation:"soul"}); addLog(`${player.name} moved ${cardMap.get(field.instance.cardId)?.name || "a unit"} from the field to Soul.`); }
      else { toast("Select a card in your hand or on your field first."); return; }
      match.selected = null;
    } else if (action === "add-damage" || action === "hand-to-damage") {
      if (!card) { toast("Select a card in your hand first."); return; }
      player.hand = player.hand.filter((item) => item.uid !== card.uid); player.damage.push(card); queueAbilityPrompts("damagePlace","human",card.uid,{zone:"damage",sourceZone:"hand",currentLocation:"damage"}); match.selected = null;
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
    if (online.selectedDeck && deckCount(online.selectedDeck)) return { name: online.selectedDeck.name, format: online.selectedDeck.format === "standard" ? "standard" : "premium", cards: { ...online.selectedDeck.cards }, starterCardId: online.selectedDeck.starterCardId || "", rideDeck: [...(online.selectedDeck.rideDeck || [])] };
    if (builder.cards && deckCount(builder)) return { name: builder.name || "My Deck", format: builder.format === "standard" ? "standard" : "premium", cards: { ...builder.cards }, starterCardId: builder.starterCardId || "", rideDeck: [...(builder.rideDeck || [])] };
    return defaultDeck();
  }
  async function registerOnlineDeckForAuthority(roomCode) {
    if (!account.matchClient || !roomCode || !["host", "guest"].includes(online.role)) return { submitted: false, ready: false };
    try {
      const { data, error } = await account.matchClient.rpc("submit_match_deck", { p_room_code: roomCode, p_deck: onlineDeck() });
      if (error || data?.ok !== true) return { submitted: false, ready: false, reason: error?.message || "deck-submit-rejected" };
      return { submitted: true, ready: data.ready === true };
    } catch (error) {
      return { submitted: false, ready: false, reason: error?.message || "deck-submit-failed" };
    }
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
    const errors = deckReadyErrors(deck); if (errors.length) { setOnlineError(`Fix this deck before online play: ${errors.join("; ")}.`); return false; }
    online.selectedDeck = { ...deck, format: deck.format === "standard" ? "standard" : "premium", cards: { ...deck.cards }, rideDeck: [...(deck.rideDeck || [])] }; return true;
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
    const watchRole = role === "watcher" || role === "host-watcher";
    const relayClient=watchRole?account.client:account.matchClient;
    if(!relayClient)throw new Error("The authenticated online relay is not initialized.");
    const outgoingTopic=watchRole?`vanguard-match:${secret}:watch`:`vanguard-room:${online.publicRoomCode}:${role==="guest"?"guest-host":"host-guest"}`;
    const incomingTopic=watchRole?outgoingTopic:`vanguard-room:${online.publicRoomCode}:${role==="guest"?"host-guest":"guest-host"}`;
    const outgoingEvent=role==="host"?"to-player":role==="host-watcher"?"to-watchers":"to-host";
    const incomingEvent=role==="host"||role==="host-watcher"?"to-host":role==="guest"?"to-player":"to-watchers";
    const senderRole=role==="guest"?"player":role==="host-watcher"?"host":role;
    const connection=window.VanguardMatchRelay.createConnection({client:relayClient,outgoingTopic,incomingTopic,outgoingEvent,incomingEvent,senderRole,isPrivate:!watchRole});
    connection.on("data",(envelope)=>{
      const message=envelope?.message;
      if(!message)return;
      if(role==="host-watcher"){
        if(envelope.senderRole!=="watcher"||message.type!=="watch")return;
        const watcher={open:true,send:data=>connection.send(data),close(){this.open=false;online.watchers=online.watchers.filter(item=>item!==this);}};
        online.watchers.push(watcher);sendOnlineSnapshot();return;
      }
      if(role==="host"){
        if(!["player","guest"].includes(envelope.senderRole))return;
        if(message.type==="join"){
          if(online.relayPlayerJoined){sendOnlineSnapshot();return;}
          online.relayPlayerJoined=true;setConnectionPill("CONNECTED");setMessage("Opponent connected — your turn.");
        }
      }else if(envelope.senderRole!=="host")return;
      connection.emit("data",message);
    });
    return connection;
  }  function randomHex(length) {
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
    Object.entries(deck?.cards || {}).forEach(([id, qty]) => { if (cardMap.has(id)) cards[id] = Math.max(0, Math.min(50, Number(qty) || 0)); });
    return { name: String(deck?.name || "Online Deck").slice(0, 40), format: deck?.format === "standard" ? "standard" : "premium", cards, starterCardId: cardMap.has(deck?.starterCardId) ? deck.starterCardId : "", rideDeck: Array.isArray(deck?.rideDeck) ? deck.rideDeck.slice(0, 4).filter(id => cardMap.has(id)) : [] };
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
    if (snapshot.pendingStride?.ownerSide) { snapshot.pendingStride.ownerSide = flipSide(snapshot.pendingStride.ownerSide); if(snapshot.pendingStride.ownerSide!=="human")snapshot.pendingStride=null; }
    if (snapshot.pendingRide?.ownerSide) { snapshot.pendingRide.ownerSide = flipSide(snapshot.pendingRide.ownerSide); if(snapshot.pendingRide.ownerSide!=="human")snapshot.pendingRide=null; }
    if (snapshot.pendingProtectGuard?.ownerSide) { snapshot.pendingProtectGuard.ownerSide = flipSide(snapshot.pendingProtectGuard.ownerSide); if(snapshot.pendingProtectGuard.ownerSide!=="human")snapshot.pendingProtectGuard=null; }
    if (snapshot.pendingAttackSetup) { snapshot.pendingAttackSetup.attackerSide = flipSide(snapshot.pendingAttackSetup.attackerSide); snapshot.pendingAttackSetup.defenderSide = flipSide(snapshot.pendingAttackSetup.defenderSide); }
    if (snapshot.pendingTrigger?.side) snapshot.pendingTrigger.side = flipSide(snapshot.pendingTrigger.side);
    if (snapshot.pendingTrigger?.turnOwner) snapshot.pendingTrigger.turnOwner=flipSide(snapshot.pendingTrigger.turnOwner); if (snapshot.pendingCrest?.side) snapshot.pendingCrest.side = flipSide(snapshot.pendingCrest.side);
    if (snapshot.pendingAbility?.side) snapshot.pendingAbility.side=flipSide(snapshot.pendingAbility.side); (snapshot.pendingAbilities||[]).forEach(item=>{if(item.side)item.side=flipSide(item.side)});
    Object.assign(snapshot,window.VanguardAbilityEngine.projectPendingAbilitiesForSide(snapshot,"human"));
    if (snapshot.preMatch) {
      snapshot.preMatch.rolls = { human: snapshot.preMatch.rolls.bot, bot: snapshot.preMatch.rolls.human };
      if (snapshot.preMatch.winner) snapshot.preMatch.winner = flipSide(snapshot.preMatch.winner);
      if (snapshot.preMatch.firstSide) snapshot.preMatch.firstSide = flipSide(snapshot.preMatch.firstSide);
      if (snapshot.preMatch.mulliganDone) snapshot.preMatch.mulliganDone = { human: snapshot.preMatch.mulliganDone.bot, bot: snapshot.preMatch.mulliganDone.human };
    }
    window.VanguardMatchStateProjection.hidePrivateZones(snapshot, ["bot"]);
    const visibleIds = new Set(snapshot.players.human.hand.map((card) => card.uid));
    [snapshot.players.human.vanguard, ...snapshot.players.human.rear].filter(Boolean).forEach((card) => visibleIds.add(card.uid));
    if (!visibleIds.has(snapshot.selected)) snapshot.selected = null;
    return snapshot;
  }
  function sendGuestRequest(type, payload = {}) {
    if (online.role !== "guest" || !online.connection?.open || type !== "select" && online.remoteRequestPending) return false;
    const expectedStateVersion = Number(match?.stateVersion || 0);
    const actionId = crypto.randomUUID?.() || 'guest-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const request={ type, ...payload, matchId: match?.matchId || null, actorPlayerId: match?.players?.human?.playerId || null, actionId, expectedStateVersion };
    if(type!=="select"){
      online.remoteRequestPending=actionId;
      online.remoteRequestTimer=setTimeout(()=>{if(online.remoteRequestPending!==actionId)return;online.remoteRequestPending=null;online.remoteRequestTimer=null;if(online.connection?.open){setMessage("The match is taking longer to respond. Resyncing with the host.");online.connection.send({type:"sync",matchId:match?.matchId||null,actorPlayerId:match?.players?.human?.playerId||null});}},10000);
    }
    let sendResult;try{sendResult=online.connection.isRelay?online.connection.send(request):(online.connection.send(request),true)}catch{sendResult=false;}
    Promise.resolve(sendResult).then(sent=>{if(type==="select"||online.remoteRequestPending!==actionId)return;if(!sent){clearTimeout(online.remoteRequestTimer);online.remoteRequestTimer=null;online.remoteRequestPending=null;setMessage("The action could not be sent. Try again when connected.");}}).catch(()=>{if(type==="select"||online.remoteRequestPending!==actionId)return;clearTimeout(online.remoteRequestTimer);online.remoteRequestTimer=null;online.remoteRequestPending=null;setMessage("The action could not be sent. Try again when connected.");});
    return true;
  }
  function versionMatchSnapshot() {
    if (!match) return;
    const state = JSON.parse(JSON.stringify(match));
    delete state.stateVersion; delete state.processedActionIds; delete state.selected;
    const signature = JSON.stringify(state);
    if (online.lastSentStateSignature === null) online.lastSentStateSignature = signature;
    else if (signature !== online.lastSentStateSignature) { match.stateVersion = Number(match.stateVersion || 0) + 1; online.lastSentStateSignature = signature; }
  }
  function sendOnlineSnapshot() {
    if (online.role !== "host" || !match) return;
    versionMatchSnapshot();
    try {
      if (online.connection?.open) online.connection.send({ type: "state", match: snapshotForGuest() });
      const publicMatch = JSON.parse(JSON.stringify(match)); publicMatch.pendingGAssist = null; publicMatch.pendingAbility = null; publicMatch.pendingAbilities = []; publicMatch.pendingStride = null; publicMatch.pendingRide = null; publicMatch.pendingProtectGuard = null; delete publicMatch.processedActionIds;
      window.VanguardMatchStateProjection.hidePrivateZones(publicMatch, ["human", "bot"]);
      online.watchers = online.watchers.filter((connection) => connection.open);
      online.watchers.forEach((connection) => connection.send({ type: "watch-state", match: publicMatch }));
      $("#spectator-count").textContent = `${online.watchers.length} spectator${online.watchers.length === 1 ? "" : "s"}`;
    } catch { setOnlineError("Unable to send the latest match state. Reconnect and try again."); }
  }
  function updateGuestState(snapshot) {
    if (!snapshot) return;
    // Relay/state messages can arrive out of order. Never roll a guest back to an
    // earlier battle snapshot after End Attack has already cleared pendingAttack.
    const incomingVersion = Number(snapshot.stateVersion || 0);
    const currentVersion = Number(match?.stateVersion || 0);
    if (snapshot.matchId && match?.matchId && snapshot.matchId !== match.matchId) return;
    if (incomingVersion < currentVersion) return;
    if(online.remoteRequestTimer){clearTimeout(online.remoteRequestTimer);online.remoteRequestTimer=null;}online.remoteRequestPending=null;
    match = snapshot;
    match.log = (match.log || []).map((entry) => ({ ...entry, time: new Date(entry.time) }));
    selectedCard = null; selectedZone = null;
    if (online.role === "guest" && match.players?.human) match.players.human.name = online.localName || match.players.human.name;
    if (online.role === "guest" && online.connection?.isRelay) { online.relayStateReceived = true; if (online.joinRetry) { clearInterval(online.joinRetry); online.joinRetry = null; } $("#online-confirm").disabled = false; if ($("#online-dialog").open) $("#online-dialog").close(); }
    revealLocalMatch(); renderMatch(); if($("#deck-view-dialog").open)openMyDeck(); if($("#drop-dialog").open)openDropDialog($("#drop-dialog").dataset.side); if($("#bind-dialog").open)openBindDialog(); if($("#gdeck-dialog").open)openGDeckDialog($("#gdeck-dialog").dataset.kind,$("#gdeck-dialog").dataset.gGuardHealUid||""); if($("#soul-dialog").open)openSoulDialog($("#soul-dialog").dataset.blast==="1",$("#soul-dialog").dataset.side||"human");
  }
  function handleRemoteMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "table-chat") { updateOnlineChat(); window.VanguardTableChat?.controller?.receive(message); return; }
    if (online.role === "host" && message.type === "join") {
      if (!match) startMatch(onlineDeck(), "human", true);
      const deck = sanitizedDeck(message.deck);
      const playerName = String(message.name || "Opponent").slice(0, 24);
      match.players.bot = makePlayer(deck.cards && deckCount(deck) ? deck : defaultDeck(), playerName, false, message.avatarId);
      match.deckName = online.selectedDeck?.name || builder.name || "Online match";
      addLog(`${playerName} joined with ${deck.name}.`); setMessage("Opponent connected — your turn."); renderMatch();
      sendOnlineSnapshot();
      return;
    }
    if(online.role==="host"&&message.type==="sync"){sendOnlineSnapshot();return;}
    if (online.role === "guest" && message.type === "state") { updateGuestState(message.match); return; }
    if (online.role === "host" && message.type === "ability-response" && match) {
      const requestStatus=window.VanguardAbilityEngine.validateRemoteRequest(match,message,match.players.bot.playerId);if(!requestStatus.ok){if(requestStatus.reason==="stale-state-version")sendOnlineSnapshot();return;}
      const selection=message.selection||{}, uid=selection.instanceUid, abilityId=selection.abilityId;
      const currentMatches=match.pendingAbility?.side==="bot"&&match.pendingAbility.instance.uid===uid&&match.pendingAbility.ability.id===abilityId;
      const queue=match.pendingAbilities||[], queueIndex=currentMatches?-1:queue.findIndex(item=>item.side==="bot"&&item.instance.uid===uid&&item.ability.id===abilityId);
      const pending=currentMatches?match.pendingAbility:queueIndex>=0?queue[queueIndex]:null;
      if(!pending)return;
      const decisionStatus=window.VanguardAbilityEngine.validateAbilityDecision(match,message,match.players.bot.playerId,pending,{hasEnergyGenerator:hasEnergyGenerator(match.players.bot)});if(!decisionStatus.ok){sendOnlineSnapshot();return;}window.VanguardAbilityEngine.claimRemoteRequest(match,message.actionId);
      pending.skipCostPayment=selection.payCost===false;pending.costSelections={cb:[...(selection.costSelections?.cb||[])],sb:[...(selection.costSelections?.sb||[])],discard:[...(selection.costSelections?.discard||[])],reveal:[...(selection.costSelections?.reveal||[])]};pending.costAlternativeIndex=selection.costAlternativeIndex;
      pending.effectUid=selection.effectUid||null;pending.effectSourceZone=selection.effectSourceZone||null;pending.deckBottomUids=Array.isArray(selection.deckBottomUids)?[...selection.deckBottomUids]:[];pending.legionDropUids=Array.isArray(selection.legionDropUids)?[...selection.legionDropUids]:[];pending.engorgeTargetUids=Array.isArray(selection.engorgeTargetUids)?[...selection.engorgeTargetUids]:[];pending.callZone=selection.callZone||null;pending.targetUid=selection.targetUid||null;pending.effectDiscardUid=selection.effectDiscardUid||null;pending.deckDestination=selection.deckDestination||null;pending.damageUids=Array.isArray(selection.damageUids)?[...selection.damageUids]:[];pending.optionalNoTarget=Boolean(selection.optionalNoTarget);pending.chargeChoice=selection.chargeChoice||null;pending.effectChoice=selection.effectChoice||null;pending.circleZone=selection.circleZone||null;pending.revelationTopUid=selection.revelationTopUid??null;
      if(!currentMatches)queue.splice(queueIndex,1);
      if(!message.accept&&!window.VanguardAbilityEngine.canDeclineAbility(pending.ability)){sendOnlineSnapshot();return;}if(message.accept){if(!resolveAbility(pending)){if(!currentMatches)queue.splice(Math.min(queueIndex,queue.length),0,pending);renderMatch();return;}}
      else addLog((cardMap.get(pending.instance.cardId)?.name||"A unit")+" ability was declined.");
      if(currentMatches)match.pendingAbility=null;
      $("#ability-dialog").close();resumeAbilityQueue();renderMatch();return;
    }
    if (online.role === "watcher" && message.type === "watch-state") { updateGuestState(message.match); $("#match-status").textContent = "SPECTATING · LIVE"; return; }
    if (online.role === "host" && match?.preMatch && ["setup-roll","setup-choice","setup-mulligan"].includes(message.type)) {
      const setupRequest=window.VanguardAbilityEngine.validateRemoteActionRequest(match,message,match.players.bot.playerId);if(!setupRequest.ok){sendOnlineSnapshot();return;}window.VanguardAbilityEngine.claimRemoteRequest(match,message.actionId);
      if(message.type==="setup-roll")rollOnlineDieFor("bot");
      else if(message.type==="setup-choice")beginOnlineMulligan(flipSide(message.firstSide));
      else completeOnlineMulligan("bot",message.handUids);
      return;
    }
    if (online.role !== "host" || !match || !["action", "select"].includes(message.type)) return;
    const requestStatus=window.VanguardAbilityEngine.validateRemoteActionRequest(match,message,match.players.bot.playerId);if(!requestStatus.ok){sendOnlineSnapshot();return;}if(message.type==="select"&&message.selected!==null){const joiner=match.players.bot,exists=Object.values(joiner).some(value=>Array.isArray(value)?value.some(card=>card?.uid===message.selected):value?.uid===message.selected);if(!exists){sendOnlineSnapshot();return}}window.VanguardAbilityEngine.claimRemoteRequest(match,message.actionId);

    // Trigger choices belong to the player who revealed the trigger. Resolve these
    // directly on that player's host-authoritative side instead of relying on the
    // temporary player-side swap used for ordinary remote actions.
    if(message.type==="action"&&message.action?.startsWith("manual:trigger-")){
      const action=message.action.slice("manual:".length);
      if(action.startsWith("trigger-pick:"))chooseTriggerTarget(action.slice("trigger-pick:".length),"bot");
      else if(action==="trigger-skip"&&match.pendingTrigger?.side==="bot"&&match.pendingTrigger.stage==="heal-target"){
        match.pendingTrigger.stage="power-target";
        if(!fieldUnits("bot").length)finishTriggerResolution();
        renderMatch();
      }
      return;
    }

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
    if(match.pendingAbility?.side)match.pendingAbility.side=flipSide(match.pendingAbility.side);(match.pendingAbilities||[]).forEach(item=>{if(item.side)item.side=flipSide(item.side)});
    if(match.pendingAttack){match.pendingAttack.attackerSide=flipSide(match.pendingAttack.attackerSide);match.pendingAttack.defenderSide=flipSide(match.pendingAttack.defenderSide);}if(match.pendingGAssist?.ownerSide)match.pendingGAssist.ownerSide=flipSide(match.pendingGAssist.ownerSide);
    if(match.pendingStride?.ownerSide)match.pendingStride.ownerSide=flipSide(match.pendingStride.ownerSide); if(match.pendingRide?.ownerSide)match.pendingRide.ownerSide=flipSide(match.pendingRide.ownerSide);
      if(match.pendingProtectGuard?.ownerSide)match.pendingProtectGuard.ownerSide=flipSide(match.pendingProtectGuard.ownerSide);
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
      if(match.pendingAbility?.side)match.pendingAbility.side=flipSide(match.pendingAbility.side);(match.pendingAbilities||[]).forEach(item=>{if(item.side)item.side=flipSide(item.side)});
      if(match.pendingAttack){match.pendingAttack.attackerSide=flipSide(match.pendingAttack.attackerSide);match.pendingAttack.defenderSide=flipSide(match.pendingAttack.defenderSide);}if(match.pendingGAssist?.ownerSide)match.pendingGAssist.ownerSide=flipSide(match.pendingGAssist.ownerSide);
    if(match.pendingStride?.ownerSide)match.pendingStride.ownerSide=flipSide(match.pendingStride.ownerSide); if(match.pendingRide?.ownerSide)match.pendingRide.ownerSide=flipSide(match.pendingRide.ownerSide);
      if(match.pendingProtectGuard?.ownerSide)match.pendingProtectGuard.ownerSide=flipSide(match.pendingProtectGuard.ownerSide);
      if(match.pendingAttackSetup){match.pendingAttackSetup.attackerSide=flipSide(match.pendingAttackSetup.attackerSide);match.pendingAttackSetup.defenderSide=flipSide(match.pendingAttackSetup.defenderSide);}
      online.applyingRemote = false;
    }
    renderMatch();
  }
  function bindOnlineConnection(connection, role) {
    if(role==="host-watcher")online.watchConnection=connection;else online.connection = connection;
    connection.on("open", () => {
      if (role === "guest") {
        const sendJoin = () => connection.send({ type: "join", name: online.localName, avatarId: selectedProfileAvatar(), deck: onlineDeck() });
        sendJoin();
        if (connection.isRelay) {
          setOnlineError("Connected to the relay. Waiting for the host to send the match…");
          online.relayStateReceived = false;
          if (online.joinRetry) clearInterval(online.joinRetry);
          online.joinRetry = setInterval(() => { if (online.connection === connection && !online.relayStateReceived && connection.open) sendJoin(); }, 2500);
        }
      }
      else if (role === "watcher") connection.send({ type: "watch", name: online.localName });
      else if (role === "host-watcher") { /* spectator traffic uses its isolated relay topic */ }
      else if (connection.isRelay) { setMessage("Invite link ready — waiting for your friend to join."); setConnectionPill("WAITING"); sendOnlineSnapshot(); }
      else { setMessage("Opponent connected — waiting for their deck."); sendOnlineSnapshot(); }
      if (role !== "host" || !connection.isRelay) { $("#match-status").textContent = "ONLINE · CONNECTED"; setConnectionPill("CONNECTED"); } const reconnectButton = $("#reconnect-match"); if (reconnectButton) reconnectButton.hidden = true;
    });
    connection.on("data", handleRemoteMessage);
    if (role === "host" || role === "guest") {
      connection.on("open", updateOnlineChat);
      connection.on("close", updateOnlineChat);
    }
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
      if(!(await ensureOnlineMatchSession())){online.role=null;return;}
      const roomCode = randomHex(8).toUpperCase();
      const secret = randomHex(32);
      const { error } = await account.matchClient.rpc("create_match_room", { p_room_code: roomCode, p_peer_id: `relay:${secret}`, p_room_name: $("#room-name").value.trim() || "Vanguard room", p_host_name: online.localName, p_password: $("#room-password").value });
      if (error) { setOnlineError("Could not publish this room. Run supabase/match-rooms.sql in the Supabase SQL Editor, then try again."); online.role = null; return; }
      online.roomId = secret; online.publicRoomCode = roomCode; $("#online-dialog").close();
      const authorityDeckStatus = await registerOnlineDeckForAuthority(roomCode);
      startMatch(onlineDeck(), "human", true);
      if (!authorityDeckStatus.submitted) addLog("This online room is using the current host relay. Server-authoritative match setup is not enabled for this project yet.");
      else addLog(authorityDeckStatus.ready ? "Both private deck submissions are ready; server match initialization is not connected yet." : "Your private deck submission is saved; waiting for the other player.");
      online.heartbeat = setInterval(() => { if (account.matchClient && online.publicRoomCode) void account.matchClient.rpc("touch_match_room", { p_room_code: online.publicRoomCode }); }, 60000);
      match.players.human.name = online.localName; $("#online-invite").classList.remove("hidden");
      const invite = new URL(location.href); invite.searchParams.set("join", roomCode); invite.hash = "play"; $("#invite-link").value = invite.toString();
      const watch = new URL(location.href); watch.searchParams.delete("join"); watch.searchParams.set("watch", roomCode); watch.hash = "play"; $("#spectate-link").value = watch.toString();
      bindOnlineConnection(createRelayConnection(secret, "host"), "host");
      bindOnlineConnection(createRelayConnection(secret, "host-watcher"), "host-watcher");
      setMessage("Invite link ready — waiting for your friend to join."); renderMatch();
    })().catch((error) => { online.role = null; setOnlineError(`Could not start the online relay: ${error.message}`); });
  }
  async function beginJoining() {
    const watching = $("#online-join-role").value === "spectator" || new URLSearchParams(location.search).has("watch");
    if (!watching && !selectOnlineDeck()) return;
    const roomCode = getInviteId($("#join-code").value);
    if (!roomCode) { setOnlineError("Choose an open room or enter a room code."); return; }
    if (!account.client) { setOnlineError("Room discovery needs the configured Supabase connection."); return; }
    if(!watching&&!(await ensureOnlineMatchSession()))return;
    const roomDirectoryClient=watching?account.client:account.matchClient;
    const roomResolutionRpc=watching?"resolve_match_room":"claim_player_match_room";
    const { data: roomPeer, error: roomError } = await roomDirectoryClient.rpc(roomResolutionRpc, { p_room_code: roomCode, p_password: $("#join-password").value });
    const roomId = typeof roomPeer === "string" ? roomPeer : Array.isArray(roomPeer) ? roomPeer[0]?.peer_id : roomPeer?.peer_id;
    if (roomError || !roomId) { setOnlineError("Room not found, closed, or password is incorrect."); return; }
    online.localName = String($("#online-name").value.trim() || "Player").slice(0, 24); localStorage.setItem("vanguardArenaPlayerName", online.localName);
    online.role = watching ? "watcher" : "guest"; online.publicRoomCode = roomCode; setConnectionPill("CONNECTING");
    if (!watching) {
      const authorityDeckStatus = await registerOnlineDeckForAuthority(roomCode);
      if (!authorityDeckStatus.submitted) setMessage("This room is using the current host relay; server-authoritative match setup is not enabled for this project yet.");
      else setMessage(authorityDeckStatus.ready ? "Both private deck submissions are ready; waiting for the host's existing match relay." : "Your private deck submission is saved; waiting for the host's existing match relay.");
    }
    if (typeof roomId === "string" && roomId.startsWith("relay:")) {
      if (!account.client) { setOnlineError("The online relay needs the configured Supabase connection."); online.role = null; return; }
      const secret = roomId.slice("relay:".length); online.roomId = secret;
      bindOnlineConnection(createRelayConnection(secret, watching ? "watcher" : "guest"), online.role);
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
    if (online.remoteRequestTimer) clearTimeout(online.remoteRequestTimer);
    if (online.role === "host" && online.publicRoomCode && account.matchClient) void account.matchClient.rpc("close_match_room", { p_room_code: online.publicRoomCode });
    try { online.connection?.close(); online.watchConnection?.close(); online.watchers?.forEach((connection) => connection.close()); online.peer?.destroy(); } catch {}
    online = { role: null, peer: null, connection: null, watchConnection: null, watchers: [], roomId: null, publicRoomCode: null, heartbeat: null, joinRetry: null, remoteRequestTimer: null, remoteRequestPending: null, relayStateReceived: false, applyingRemote: false, relayPlayerJoined: false, dialogMode: "host", selectedDeck: null, mulliganSelection: [], mulliganSubmitted: false, abilityResponsePending: null, lastSentStateSignature: null };
    updateOnlineChat();
    setConnectionPill("READY");
    $("#online-invite").classList.add("hidden");
  }
  function performOnlineAction(action) {
    if (online.role === "watcher") { toast("Spectators can watch but cannot change the match."); return; }
    if (online.role === "guest") {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      if (action === "finishAttack") { dismissAttackArrow(); $("#battle-action-panel").hidden = true; }
      if (action === "guard") { const instance=selectedHandCard(); if(instance&&Number(cardMap.get(instance.cardId)?.shield||0)===0){humanGuard();return;} }
      sendGuestRequest("action", { action, selected: match?.selected || null }); return;
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
    const healCards = player.hand.filter(isGGuardCostCard);
    if (!healCards.length) { toast("G-Guard requires a Heal trigger or a card with a G-Guardian Heal-cost ability."); return; }
    $("#g-guard-heal-list").innerHTML = healCards.map((item) => {
      const card = cardMap.get(item.cardId); if (!card) return "";
      return '<button class="zone-view-card" type="button" data-g-guard-heal="' + escapeHtml(item.uid) + '">' + cardImage(card) + '<b>Discard ' + escapeHtml(card.name) + '</b><small>G-Guard Heal cost</small></button>';
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
    $("#stride-cost-help").textContent = ultimate ? "Choose a card with the same name as your Vanguard to discard." : `Choose card(s) to discard with total grade 3 or more. Cards with a Stride-cost ability may count as grade 3. Selected grade: ${state.costValue || 0}.`;
    $("#stride-cost-cards").innerHTML = player.hand.map((item) => { const card = cardMap.get(item.cardId), selected = state.costUids.includes(item.uid), allowed = !ultimate || [vanguardName, heartName].includes(card?.name); return card ? `<button class="zone-view-card${selected ? " selected" : ""}${allowed ? "" : " disabled"}" type="button" data-stride-cost="${escapeHtml(item.uid)}" ${allowed ? "" : "disabled"}>${cardImage(card)}<b>${escapeHtml(card.name)}</b><small>${ultimate ? (allowed ? "Same name · discard" : "Does not match Vanguard") : `Stride grade ${strideGrade(item,true)}${selected ? " · selected" : ""}`}</small></button>` : ""; }).join("") || '<p class="zone-empty-message">No cards in hand to pay the Stride cost.</p>';
    const selected = player.hand.filter((item) => state.costUids.includes(item.uid));
    state.costValue = selected.reduce((sum, item) => sum + strideGrade(item,true), 0);
    const valid = ultimate ? selected.length === 1 && [vanguardName, heartName].includes(cardMap.get(selected[0].cardId)?.name) : selected.length > 0 && state.costValue >= 3;
    $("#stride-cost-confirm").disabled = !valid;
    if (!$("#stride-cost-dialog").open) $("#stride-cost-dialog").showModal();
  }
  function openGDeckDialog(kind, healUid = "") {
    if (!match) { toast("Start a match first."); return; }
    if (match.players.human.format === "standard" && kind !== "inspect") { toast("Standard decks use a Ride Deck and cannot stride or G-Guard."); return; }
    if (kind === "stride" && (match.stridePerformed || !canStrideForSide("human", match.turnStartGrades?.human))) { toast("Stride is once per turn. Your Vanguard must be grade 3 or greater, and either your opponent's Vanguard is grade 3 or greater or yours was grade 3 at the start of your turn."); return; }
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
    $("#gdeck-dialog-help").textContent = isInspect ? "Click a card or Reveal to show it temporarily; closing the reveal leaves it face down in the G deck. Flip face up places it face up in the G zone." : isGuard ? "Choose a face-down G-Guardian. It adds its shield for this defense and returns face up to your G deck when the attack ends." : "Stride during your Stride step. Pay the ability cost, place the G Unit on your Vanguard, then return it face up to the G zone at end of turn.";
    const healNotice=$("#g-guard-selected-heal");healNotice.classList.toggle("hidden",!isGuard);if(isGuard)healNotice.textContent="Selected Heal trigger: "+(cardMap.get(selectedHeal.cardId)?.name||"Heal trigger")+" (discarded when you choose a G-Guardian).";
    $("#gdeck-card-list").innerHTML = cards.length ? cards.map((item) => {
      const card = cardMap.get(item.cardId);
      const reveal = '<button class="button" type="button" data-gdeck-reveal="' + escapeHtml(item.uid) + '">Reveal</button>';
      const inspectStride = !item.faceUp && isStrideUnit(card) ? '<button class="button button-primary" type="button" data-gdeck-action="stride:' + escapeHtml(item.uid) + '"' + (match.side === "human" && match.phase === 3 && !match.stridePerformed && canStrideForSide("human", match.turnStartGrades?.human) ? '' : ' disabled title="Available during your Stride step when eligible"') + '>Stride</button>' : '';
      const flip=`<button class="button" type="button" data-gdeck-flip="${escapeHtml(item.uid)}">Flip face up</button>`;
      const play=isGuard?'<button class="button button-primary" type="button" data-gdeck-action="g-guard:'+escapeHtml(item.uid)+':'+escapeHtml(selectedHeal.uid)+'">Guard with this G-Guardian</button>':'<button class="button button-primary" type="button" data-gdeck-action="stride:'+escapeHtml(item.uid)+'">Stride</button>';
      const skills=!isGuard&&!isInspect&&match.side==="human"&&Number(match.phase)===3?eligibleActivatedAbilities({side:"human",zone:"g-deck",instance:item}).map(ability=>`<button class="button" type="button" data-gdeck-activate="${escapeHtml(item.uid)}" data-ability-id="${escapeHtml(encodeURIComponent(ability.id))}">Activate skill · ${escapeHtml(ability.printedText||ability.raw)}</button>`).join(""):"";
      return card ? '<article class="zone-view-card" data-card-id="' + escapeHtml(card.id) + '"><button class="zone-card-face" type="button" data-gdeck-reveal="' + escapeHtml(item.uid) + '">' + cardImage(card) + '<b>' + escapeHtml(card.name) + '</b><small>' + (item.faceUp ? 'Face up' : 'Face down') + '</small></button><button class="zone-card-zoom" type="button" data-card-zoom="' + escapeHtml(card.id) + '" aria-label="Zoom ' + escapeHtml(card.name) + '">⤢</button><div class="peek-actions"' + (isInspect || isGuard || kind === "stride" || skills ? '' : ' hidden') + '>' + (isInspect ? reveal + (!item.faceUp ? flip : "Face up") + inspectStride : play + skills + reveal + (isGuard ? '' : flip + zoneMoveControls(item,"gdeck"))) + '</div></article>' : "";
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
    if (online.role === "guest" && (action.startsWith("stride:") || action.startsWith("stride-cost:") || action === "stride-confirm" || action === "stride-cancel")) {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      manualGameAction(action);
      renderMatch();
      sendGuestRequest("action", { action: `manual:${action}`, selected: match?.selected || null });
      return;
    }
    if (action === "counter-blast" || action === "counter-charge" || action === "heal-damage") { openDamageDialog(action); return; }
    if (action.startsWith("ride-deck-") || action === "g-assist" || action === "g-assist-none" || action === "g-assist-finish" || action.startsWith("g-assist-pick:") || action.startsWith("g-assist-discard:") || action.startsWith("g-guard:") || action.startsWith("intercept:") || action.startsWith("superior-ride:") || action.startsWith("attack-choice:") || action.startsWith("zone-move:") || action.startsWith("deck-action:") || action.startsWith("reveal-action:") || action.startsWith("damage-action:") || action.startsWith("drop-action:") || action.startsWith("reveal-top:") || action.startsWith("gift-force:") || action.startsWith("gift-accel:") || action.startsWith("gdeck-reveal:") || action.startsWith("gdeck-flip-up:") || action.startsWith("trigger-pick:") || action === "trigger-skip" || action === "reveal-done" || action.startsWith("g-assist") ) { if(online.role==="guest"){if(!online.connection?.open){toast("You are disconnected from the match.");return;}sendGuestRequest("action",{action:"manual:"+action,selected:match?.selected||null});return;} manualGameAction(action); if(match)renderMatch(); if(action.startsWith("superior-ride:")){["deck-view-dialog","soul-dialog","bind-dialog","drop-dialog","damage-dialog","reveal-dialog"].forEach(id=>{if($("#"+id).open)$("#"+id).close()});} if(action.startsWith("deck-action:") && $("#deck-view-dialog").open)openMyDeck(); if(action.startsWith("zone-move:") && $("#deck-view-dialog").open)openMyDeck(); if(action.startsWith("zone-move:") && $("#bind-dialog").open)openBindDialog(); if(action.startsWith("zone-move:") && $("#gdeck-dialog").open)openGDeckDialog($("#gdeck-dialog").dataset.kind); if(action.startsWith("zone-move:") && $("#soul-dialog").open)openSoulDialog($("#soul-dialog").dataset.blast==="1",$("#soul-dialog").dataset.side||"human"); if(action.startsWith("drop-action:") && $("#drop-dialog").open)openDropDialog($("#drop-dialog").dataset.side); return; }
    if (action === "reveal-top-cards") { if (!match) { toast("Start a match first."); return; } $("#reveal-count-dialog").showModal(); return; }
    if (action === "gift-force" || action === "gift-accel") { openGiftDialog(action === "gift-force" ? "force" : "accel"); return; }
    if (online.role === "guest") {
      if (!online.connection?.open) { toast("You are disconnected from the match."); return; }
      sendGuestRequest("action", { action: `manual:${action}`, selected: match?.selected || null }); return;
    }
    manualGameAction(action);
  }
  function exportDeck(deck, filename) {
    const content = JSON.stringify({ format: "Vanguard Arena deck", name: deck.name, deckFormat: deck.format === "standard" ? "standard" : "premium", cards: deck.cards, starterCardId: deck.starterCardId || "", rideDeck: Array.isArray(deck.rideDeck) ? deck.rideDeck : [], exportedAt: new Date().toISOString() }, null, 2);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "application/json" })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importDeckFile(file) {
    const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); const cards = data.cards || data; if (!cards || typeof cards !== "object") throw new Error("Invalid deck format"); builder = { id: null, name: data.name || file.name.replace(/\.json$/i, ""), format: data.deckFormat === "standard" || data.format === "standard" ? "standard" : "premium", cards: {}, starterCardId: data.starterCardId || "", rideDeck: Array.isArray(data.rideDeck) ? data.rideDeck.slice(0, 4) : [] }; Object.entries(cards).forEach(([id, qty]) => { if (cardMap.has(id)) builder.cards[id] = Math.max(0, Math.min(50, Number(qty) || 0)); }); renderBuilder(); showView("decks"); toast("Deck imported"); } catch { toast("Could not read that deck JSON"); } }; reader.readAsText(file);
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
  function setMobileMode(enabled) {
    const button = $("#mobile-mode-button");
    document.body.classList.toggle("mobile-mode", enabled);
    try { localStorage.setItem("vanguardArenaMobileMode", enabled ? "on" : "off"); } catch {}
    button?.setAttribute("aria-pressed", String(enabled));
    if (button) button.textContent = enabled ? "Mobile mode: On" : "Mobile mode";
  }
  let mobileModeSaved = false;
  try { mobileModeSaved = localStorage.getItem("vanguardArenaMobileMode") === "on"; } catch {}
  setMobileMode(mobileModeSaved);
  $("#mobile-mode-button").addEventListener("click", () => setMobileMode(!document.body.classList.contains("mobile-mode")));
  $("#account-button").addEventListener("click", openAccountDialog); $("#close-account-dialog").addEventListener("click", () => $("#account-dialog").close());
  $("#profile-avatar-picker")?.addEventListener("click", event => {
    const option = event.target.closest("[data-profile-avatar]"); if (!option) return;
    void saveProfileAvatar(option.dataset.profileAvatar);
  });
  $("#account-signup").addEventListener("click", accountSignUp); $("#account-signin").addEventListener("click", accountSignIn); $("#account-signout").addEventListener("click", accountSignOut); $("#account-reset").addEventListener("click", resetAccountPassword); $("#account-update-password").addEventListener("click", updateAccountPassword); $("#account-import-local").addEventListener("click", importLocalDecks);
  $("#profile-save").addEventListener("click", savePlayerProfile);
  $("#online-confirm").addEventListener("click", () => online.dialogMode === "host" ? beginHosting() : beginJoining());
  $("#online-join-role").addEventListener("change", renderOnlineDeckChoices);
  $("#online-mulligan-cards").addEventListener("click", (event) => { const card = event.target.closest("[data-mulligan-uid]"); if (!card || online.mulliganSubmitted || match?.preMatch?.mulliganDone?.human) return; const selected = new Set(online.mulliganSelection || []); selected.has(card.dataset.mulliganUid) ? selected.delete(card.dataset.mulliganUid) : selected.add(card.dataset.mulliganUid); online.mulliganSelection = [...selected]; renderOnlineSetup(); });
  $("#practice-mulligan-cards").addEventListener("click", (event) => { const card = event.target.closest("[data-practice-mulligan-uid]"); if (!card || !match?.practiceOpeningChoicePending) return; const selected = new Set(match.practiceMulliganSelection || []); selected.has(card.dataset.practiceMulliganUid) ? selected.delete(card.dataset.practiceMulliganUid) : selected.add(card.dataset.practiceMulliganUid); match.practiceMulliganSelection = [...selected]; renderPracticeMulligan(); });
  $("#practice-mulligan-confirm").addEventListener("click", () => finishPracticeOpeningChoice(true));
  $("#practice-mulligan-keep").addEventListener("click", () => finishPracticeOpeningChoice(false));
  $("#practice-mulligan-dialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#online-mulligan-confirm").addEventListener("click", () => { if (!match?.preMatch || match.preMatch.stage !== "mulligan") return; if (online.role === "guest") { if (!online.connection?.open) { toast("You are disconnected from the match."); return; } online.mulliganSubmitted = true; online.turnOrderAnnouncementPending = true; sendGuestRequest("setup-mulligan",{handUids:online.mulliganSelection||[]}); renderOnlineSetup(); } else if (online.role === "host") completeOnlineMulligan("human", online.mulliganSelection || []); });
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
  $("#public-reveal-dialog").addEventListener("cancel", event => { event.preventDefault(); if (match?.publicReveal?.owner === "human") performManualAction("public-reveal-close"); });
  document.addEventListener("click", (event) => { const zoom = event.target.closest?.("[data-card-zoom]"); if (!zoom) return; event.preventDefault(); event.stopPropagation(); showCardDetails(zoom.dataset.cardZoom); }, true);
  document.addEventListener("click",event=>{const button=event.target.closest?.("[data-superior-ride]");if(!button)return;event.preventDefault();event.stopPropagation();performManualAction("superior-ride:"+button.dataset.superiorRide);},true);
  $("#ability-dialog").addEventListener("cancel", event => { event.preventDefault(); });
  $('#ability-cost-choices').addEventListener('click',event=>{const option=event.target.closest('[data-cost-alternative]'),x=match?.pendingAbility;if(option&&x){x.costAlternativeIndex=Number(option.dataset.costAlternative);x.costSelections={cb:[],sb:[],discard:[],reveal:[]};renderAbilityCostChoices(x);return;}const b=event.target.closest('[data-ability-cost]');if(!b||!x)return;const[k,uid]=b.dataset.abilityCost.split(':'),list=x.costSelections[k],limit=abilityCostCount(x.ability,k==='cb'?'counter-blast':k==='sb'?'soul-blast':k==='reveal'?'reveal-grade-from-hand':'discard',x.ability.costAlternatives?.[x.costAlternativeIndex]),i=list.indexOf(uid);if(i>=0)list.splice(i,1);else if(list.length<limit)list.push(uid);renderAbilityCostChoices(x)});
  $('#ability-effect-choices').addEventListener('click',event=>{const x=match?.pendingAbility;if(!x)return;const c=event.target.closest('[data-ability-card]'),markerZone=event.target.closest('[data-circle-marker-zone]'),sourceZone=event.target.closest('[data-ability-source-zone]'),noSearchCard=event.target.closest('[data-ability-no-search-card]'),noRide=event.target.closest('[data-ability-no-ride]'),bottomUp=event.target.closest('[data-bottom-up]'),bottomDown=event.target.closest('[data-bottom-down]'),legionDrop=event.target.closest('[data-legion-drop]'),choice=event.target.closest('[data-ability-choice]'),noTarget=event.target.closest('[data-ability-no-target]'),charge=event.target.closest('[data-ability-charge]'),engorgeTarget=event.target.closest('[data-engorge-target]'),t=event.target.closest('[data-ability-target]'),d=event.target.closest('[data-ability-discard]'),z=event.target.closest('[data-ability-zone]'),clear=event.target.closest('[data-ability-clear-card]'),deck=event.target.closest('[data-deck-destination]'),damage=event.target.closest('[data-ability-damage]');if(markerZone)x.circleZone=markerZone.dataset.circleMarkerZone;if(sourceZone){x.effectSourceZone=sourceZone.dataset.abilitySourceZone;x.effectUid=null}if(noSearchCard)x.effectUid=null;if(noRide){x.effectUid=null;const pool=abilityChoicePool(x);x.deckBottomUids=(pool?.lookedAt||[]).map(card=>card.uid)}if(clear){x.effectUid=null;x.effectDiscardUid=null;x.callZone=null;x.deckDestination=null}if(c){x.effectUid=c.dataset.abilityCard;const rideStep=x.ability.definition?.effects?.find(step=>step.op==="ride-top-five-named-card");if(rideStep)x.deckBottomUids=(abilityChoicePool(x)?.lookedAt||[]).filter(card=>card.uid!==x.effectUid).map(card=>card.uid)}if(bottomUp||bottomDown){const index=Number((bottomUp||bottomDown).dataset[bottomUp?"bottomUp":"bottomDown"]),step=x.ability.definition?.effects?.find(item=>item.op==="ride-top-five-named-card"),remaining=(abilityChoicePool(x)?.lookedAt||[]).filter(card=>card.uid!==x.effectUid);if(step&&Number.isInteger(index)){const order=Array.isArray(x.deckBottomUids)?[...x.deckBottomUids]:remaining.map(card=>card.uid),other=index+(bottomUp?-1:1);if(index>=0&&index<order.length&&other>=0&&other<order.length)[order[index],order[other]]=[order[other],order[index]];x.deckBottomUids=order}}if(legionDrop){const ids=new Set(x.legionDropUids||[]),uid=legionDrop.dataset.legionDrop;if(ids.has(uid))ids.delete(uid);else if(ids.size<4)ids.add(uid);x.legionDropUids=[...ids]}if(choice){x.effectChoice=choice.dataset.abilityChoice;x.targetUid=null}if(engorgeTarget){const ids=new Set(x.engorgeTargetUids||[]),uid=engorgeTarget.dataset.engorgeTarget;ids.has(uid)?ids.delete(uid):ids.add(uid);x.engorgeTargetUids=[...ids]}if(charge){x.chargeChoice=charge.dataset.abilityCharge;if(x.chargeChoice!=="counter-charge")x.damageUids=[]}if(noTarget){x.targetUid=null;x.optionalNoTarget=true}if(t){x.targetUid=t.dataset.abilityTarget;x.optionalNoTarget=false}if(d)x.effectDiscardUid=d.dataset.abilityDiscard;if(z)x.callZone=z.dataset.abilityZone;if(deck)x.deckDestination=deck.dataset.deckDestination;if(damage){const step=x.ability.definition?.effects?.find(item=>item.op==="counter-charge"),limit=Math.min(Number(step?.count||0),(match.players[x.side].damage||[]).filter(card=>card.faceDown).length),ids=new Set(x.damageUids||[]);ids.has(damage.dataset.abilityDamage)?ids.delete(damage.dataset.abilityDamage):ids.size<limit&&ids.add(damage.dataset.abilityDamage);x.damageUids=[...ids]}renderAbilityEffectChoices(x)});
  $("#ability-order-options").addEventListener("click",chooseAbilityResolutionOrder);
  $("#ability-skip-cost").addEventListener("click",()=>{const pending=match?.pendingAbility;if(!pending||pending.side!=="human"||pending.ability?.kind!=="AUTO"||!window.VanguardAbilityEngine.canDeclineAbility(pending.ability)||!((pending.ability.costs||[]).length||(pending.ability.costAlternatives||[]).length))return;pending.skipCostPayment=true;if(online.role==="guest"){if(!online.connection?.open){toast("You are disconnected from the match.");return;}online.abilityResponsePending={uid:pending.instance.uid,abilityId:pending.ability.id,accept:true};sendGuestRequest("ability-response",{accept:true,selection:{instanceUid:pending.instance.uid,abilityId:pending.ability.id,payCost:false,costSelections:{cb:[],sb:[],discard:[],reveal:[]}}});$("#ability-dialog").close();return;}const resolved=resolveAbility(pending);if(resolved){match.pendingAbility=null;$("#ability-dialog").close();resumeAbilityQueue();renderMatch();}});
  $("#ability-accept").addEventListener("click",()=>{const pending=match?.pendingAbility;if(!pending||pending.side!=="human")return;if(online.role==="guest"){if(!online.connection?.open){toast("You are disconnected from the match.");return;}online.abilityResponsePending={uid:pending.instance.uid,abilityId:pending.ability.id,accept:true};sendGuestRequest("ability-response",{accept:true,selection:{instanceUid:pending.instance.uid,abilityId:pending.ability.id,costSelections:pending.costSelections||{},costAlternativeIndex:pending.costAlternativeIndex,effectUid:pending.effectUid||null,effectSourceZone:pending.effectSourceZone||null,deckBottomUids:pending.deckBottomUids||[],legionDropUids:pending.legionDropUids||[],callZone:pending.callZone||null,targetUid:pending.targetUid||null,effectDiscardUid:pending.effectDiscardUid||null,deckDestination:pending.deckDestination||null,damageUids:pending.damageUids||[],optionalNoTarget:Boolean(pending.optionalNoTarget),chargeChoice:pending.chargeChoice||null,effectChoice:pending.effectChoice||null,circleZone:pending.circleZone||null,revelationTopUid:pending.revelationTopUid??null,engorgeTargetUids:pending.engorgeTargetUids||[]}});$("#ability-dialog").close();return;}const resolved=resolveAbility(pending);if(resolved){match.pendingAbility=null;$("#ability-dialog").close();resumeAbilityQueue();renderMatch();}});
  $("#ability-decline").addEventListener("click",()=>{const pending=match?.pendingAbility;if(!pending||pending.side!=="human"||!window.VanguardAbilityEngine.canDeclineAbility(pending.ability))return;if(online.role==="guest"){if(!online.connection?.open){toast("You are disconnected from the match.");return;}online.abilityResponsePending={uid:pending.instance.uid,abilityId:pending.ability.id,accept:false};sendGuestRequest("ability-response",{accept:false,selection:{instanceUid:pending.instance.uid,abilityId:pending.ability.id}});$("#ability-dialog").close();return;}addLog((cardMap.get(pending.instance.cardId)?.name||"A unit")+" ability was declined.");match.pendingAbility=null;$("#ability-dialog").close();resumeAbilityQueue();renderMatch();});
  $("#context-menu-actions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-context-action]"); if (!button) return;
    const action = button.dataset.contextAction; $("#context-menu-dialog").close();
    if (action === "deck-view") { openMyDeck(); return; }
    if (action === "open-skills") { const f=findFieldCard(match?.selected); if(f)showAbilityMenu(f); return; }
    if (action.startsWith("ability:")) { const [,side,uid,...idParts]=action.split(":"); let abilityId;try{abilityId=decodeURIComponent(idParts.join(":"))}catch{return} if(side!=="human")return;performManualAction("activate-skill:"+uid+":"+abilityId); return; }
    if (action === "call-to-circle") { const instance=selectedHandCard(),card=instance&&cardMap.get(instance.cardId),player=match?.players?.human;if(!instance||!isUnitCard(card)){toast("Select a Unit in your hand to call.");return;}if(!match||match.side!=="human"||match.phase!==4){toast("You can call Units during your Main phase.");return;}if(!window.VanguardAbilityEngine.canCallCard(card,{dragontreeMarkerCount:(player?.giftZones||[]).filter(marker=>marker?.type==="Dragontree"&&/^(?:rear-|accel-)/.test(String(marker.zone||""))).length})){toast("This unit can only be normal called while you have a Dragontree marker on a Rear-Guard Circle.");return;}if(gradeOf(card)>gradeOf(cardMap.get(player.vanguard?.cardId))){toast("You can only call a Unit whose grade is no higher than your Vanguard.");return;}pendingCallSelectionUid=instance.uid;toast("Select one of your Rear-Guard circles. A unit there will be sent to Drop.");return; }
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
  });  $("#hand-cards").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { e.stopPropagation(); showCardDetails(zoom.dataset.cardZoom); return; } const card = e.target.closest("[data-hand-uid]"); if (!card || !match || online.role === "watcher") return; match.selected = match.selected === card.dataset.handUid ? null : card.dataset.handUid; if (online.role === "guest" && online.connection?.open) sendGuestRequest("select",{selected:match.selected}); renderMatch(); showContextMenu("hand"); });
  $(".game-table").addEventListener("click", (e) => { const zoom=e.target.closest("[data-card-zoom]"); if(zoom){e.stopPropagation();showCardDetails(zoom.dataset.cardZoom);return;} if(e.target.closest("[data-ride-deck-open]")){performManualAction("ride-deck-open");return;} const zone=e.target.closest(".field-zone[data-side='human']"); if(zone&&match&&online.role!=="watcher"){if(pendingCallSelectionUid){if(zone.dataset.zone==="vanguard"){toast("Choose a Rear-Guard circle to call this Unit.");return;}const selected=selectedHandCard();if(!selected||selected.uid!==pendingCallSelectionUid){pendingCallSelectionUid=null;toast("That hand selection changed. Choose Call again.");return;}pendingCallSelectionUid=null;performManualAction(`place:${zone.dataset.zone}`);return;}if(zone.dataset.zone==="vanguard"&&selectedHandCard()){showContextMenu("hand");return;}if(zoneFieldSelection){const {source,uid}=zoneFieldSelection;zoneFieldSelection=null;performManualAction(`zone-move:${source}:field:${uid}:${zone.dataset.zone}`);return;}const selectedField=findFieldCard(match.selected);if(selectedField?.side==="human"&&selectedField.zone!=="vanguard"&&zone.dataset.zone!=="vanguard"&&zone.dataset.zone!==selectedField.zone){performManualAction(`move-rear-to:${match.selected}:${zone.dataset.zone}`);return;}if(!e.target.closest("[data-field-uid]")&&match.selected&&selectedHandCard()){performManualAction(`place:${zone.dataset.zone}`);return;}}if(e.target.closest("[data-gdeck-side='human']")){if(match.players.human.format==="standard")performManualAction("ride-deck-open");else if(match.phase===3&&match.side==="human")performManualAction("stride");else openGDeckDialog("inspect");return;}const field=e.target.closest("[data-field-uid]");if(!field||!match||online.role==="watcher"||field.dataset.side!=="human")return;const uid=field.dataset.fieldUid;match.selected=match.selected===uid?null:uid;if(online.role==="guest"&&online.connection?.open)sendGuestRequest("select",{selected:match.selected});renderMatch();showContextMenu("field");});
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
  $("#ride-deck-card-list").addEventListener("click", event => { const card = event.target.closest("[data-ride-deck-select]"); if (card) performManualAction("ride-deck-select:" + card.dataset.rideDeckSelect); });
  $("#ride-deck-begin").addEventListener("click", () => performManualAction("ride-deck-begin"));
  $("#ride-deck-cost-cards").addEventListener("click", event => { const card = event.target.closest("[data-ride-deck-cost]"); if (card) performManualAction("ride-deck-cost:" + card.dataset.rideDeckCost); });
  $("#ride-deck-cost-confirm").addEventListener("click", () => performManualAction("ride-deck-confirm"));
  $("#ride-deck-dialog").addEventListener("click", event => { if (event.target.closest("[data-ride-cancel]")) performManualAction("ride-deck-cancel"); });
  $("#ride-deck-cost-dialog").addEventListener("click", event => { if (event.target.closest("[data-ride-cancel]")) performManualAction("ride-deck-cancel"); });
  ["#ride-deck-dialog", "#ride-deck-cost-dialog"].forEach(selector => $(selector).addEventListener("cancel", event => { event.preventDefault(); performManualAction("ride-deck-cancel"); }));
  $("#g-assist-finish").addEventListener("click",()=>performManualAction("g-assist-finish"));
  $("#human-gzone").addEventListener("click",(e)=>{const flip=e.target.closest("[data-gzone-flip-up]");if(flip)performManualAction("gzone-flip-up:"+flip.dataset.gzoneFlipUp);else{const zoom=e.target.closest("[data-card-zoom]");if(zoom)showCardDetails(zoom.dataset.cardZoom);}});  $("#gdeck-card-list").addEventListener("click",(e)=>{const reveal=e.target.closest("[data-gdeck-reveal]");if(reveal){performManualAction("gdeck-reveal:"+reveal.dataset.gdeckReveal);return;}const zoom=e.target.closest("[data-card-zoom]");if(zoom){showCardDetails(zoom.dataset.cardZoom);return;}const activate=e.target.closest("[data-gdeck-activate]");if(activate){let abilityId;try{abilityId=decodeURIComponent(activate.dataset.abilityId)}catch{return;}$("#gdeck-dialog").close();performManualAction("activate-skill:"+activate.dataset.gdeckActivate+":"+abilityId);return;}const flip=e.target.closest("[data-gdeck-flip]");if(flip){performManualAction("gdeck-flip-up:"+flip.dataset.gdeckFlip);if(match)openGDeckDialog($("#gdeck-dialog").dataset.kind);return;}const move=e.target.closest("[data-zone-move]");if(move){performManualAction("zone-move:"+move.dataset.zoneMove);return;}const action=e.target.closest("[data-gdeck-action]");if(action){$("#gdeck-dialog").close();performManualAction(action.dataset.gdeckAction);}});
  $("#g-guard-heal-list").addEventListener("click",(event)=>{const button=event.target.closest("[data-g-guard-heal]");if(!button)return;const uid=button.dataset.gGuardHeal;$("#g-guard-cost-dialog").close();openGDeckDialog("g-guard",uid);});
  $("#stride-cost-cards").addEventListener("click",(event)=>{const button=event.target.closest("[data-stride-cost]");if(button)performManualAction("stride-cost:"+button.dataset.strideCost);});
  $("#stride-cost-confirm").addEventListener("click",()=>performManualAction("stride-confirm"));
  ["#stride-cost-cancel","#stride-cost-cancel-button"].forEach((selector)=>$(selector).addEventListener("click",()=>performManualAction("stride-cancel")));
  $("#attack-choice-buttons").addEventListener("click",(e)=>{const button=e.target.closest("[data-attack-choice]");if(button)performManualAction("attack-choice:"+button.dataset.attackChoice);});
  $("#battle-action-buttons").addEventListener("click",(e)=>{const button=e.target.closest("[data-battle-action]");if(!button)return;const action=button.dataset.battleAction;if(action==="g-guard"||action==="intercept")performManualAction(action);else performOnlineAction(action);});
  window.addEventListener("resize",renderAttackArrow);
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
  $("#view-human-orders").addEventListener("click",()=>openOrdersDialog("human")); $("#view-bot-orders").addEventListener("click",()=>openOrdersDialog("bot"));
  $("#order-zone-card-list").addEventListener("click",event=>{const view=event.target.closest("[data-order-view-uid]");if(view){const uid=view.dataset.orderViewUid;$("#order-zone-dialog").close();showOrderMenu(uid);return;}const zoom=event.target.closest("[data-card-zoom]");if(zoom)showCardDetails(zoom.dataset.cardZoom);});
  $("#advance-phase").addEventListener("click", () => { if (match?.pendingAttack) return; });
  const noGuardButton = document.createElement("button"); noGuardButton.id = "no-guard"; noGuardButton.className = "button button-quiet hidden"; noGuardButton.textContent = "No guard"; noGuardButton.addEventListener("click", () => performOnlineAction("noGuard")); $(".action-buttons").insertBefore(noGuardButton, $("#guard-card"));
  $("#sort-hand").addEventListener("click", () => { if (!match) return; match.players.human.hand.sort((a, b) => { const ca = cardMap.get(a.cardId), cb = cardMap.get(b.cardId); return (ca?.grade || 0) - (cb?.grade || 0) || ca?.name.localeCompare(cb?.name); }); renderMatch(); });
  $("#clear-log").addEventListener("click", () => { if (match) { match.log = []; renderLog(); } });
  $("#create-deck").addEventListener("click", () => $("#deck-format-dialog").showModal());
  $("#new-premium-deck").addEventListener("click", () => { $("#deck-format-dialog").close(); emptyDeck("premium"); showView("decks"); $("#deck-name").focus(); });
  $("#new-standard-deck").addEventListener("click", () => { $("#deck-format-dialog").close(); emptyDeck("standard"); showView("decks"); $("#deck-name").focus(); });
  $("#change-deck-format").addEventListener("click", () => { builder.format = builder.format === "standard" ? "premium" : "standard"; if (builder.format === "premium" && !builder.starterCardId) builder.starterCardId = builder.rideDeck?.[0] || ""; if (builder.format === "standard") builder.rideDeck ||= []; renderBuilder(); });
  $("#save-deck").addEventListener("click", saveDeck); $("#load-deck-editor").addEventListener("click", openLoadDeckDialog); $("#load-deck-confirm").addEventListener("click", () => { const deck = readSavedDecks().find((item) => item.id === $("#load-deck-choice").value); if (!deck) { toast("Choose a saved deck first."); return; } $("#load-deck-dialog").close(); loadDeck(deck); }); $("#starter-vanguard").addEventListener("change", () => { builder.starterCardId = $("#starter-vanguard").value; renderBuilder(); }); [0,1,2,3].forEach(grade => $(`#ride-deck-${grade}`).addEventListener("change", () => { builder.rideDeck[grade] = $(`#ride-deck-${grade}`).value; renderBuilder(); })); $("#deck-name").addEventListener("input", () => { builder.name = $("#deck-name").value; $("#builder-title").textContent = builder.name || "Untitled deck"; });
  $("#card-text-search").addEventListener("input", () => { builderPage = 0; renderBuilderCards(); });
  $("#card-search").addEventListener("input", () => { builderPage = 0; renderBuilderCards(); }); $("#grade-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-clan-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-nation-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-type-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); }); $("#builder-trigger-filter").addEventListener("change", () => { builderPage = 0; renderBuilderCards(); });
  $("#builder-prev").addEventListener("click", () => { builderPage = Math.max(0, builderPage - 1); renderBuilderCards(); }); $("#builder-next").addEventListener("click", () => { builderPage += 1; renderBuilderCards(); });
  $("#builder-card-grid").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { showCardDetails(zoom.dataset.cardZoom); return; } const node = e.target.closest("[data-card-id]"); if (!node) return; const id=node.dataset.cardId,card=cardMap.get(id);if(!card)return;const key=deckNameKey(card,id),sameNameCount=Object.entries(builder.cards||{}).reduce((sum,[otherId,qty])=>{const other=cardMap.get(otherId);return other&&isGDeckCard(other)===isGDeckCard(card)&&deckNameKey(other,otherId)===key?sum+Number(qty||0):sum},0);if(sameNameCount>=deckCopyLimitForCard(card,builder))return;builder.cards[id]=(builder.cards[id]||0)+1;renderBuilder(); });
  $("#deck-list").addEventListener("click", (e) => { const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { showCardDetails(zoom.dataset.cardZoom); return; } const q = e.target.closest("[data-qty]"); const r = e.target.closest("[data-remove]"); if (q) { const id=q.dataset.id,card=cardMap.get(id);if(!card)return;const next=Math.max(0,(builder.cards[id]||0)+Number(q.dataset.qty));if(Number(q.dataset.qty)>0){const key=deckNameKey(card,id),sameNameCount=Object.entries(builder.cards||{}).reduce((sum,[otherId,qty])=>{const other=cardMap.get(otherId);return other&&isGDeckCard(other)===isGDeckCard(card)&&deckNameKey(other,otherId)===key?sum+Number(qty||0):sum},0);if(sameNameCount>=deckCopyLimitForCard(card,builder))return;}builder.cards[id]=next;if(!builder.cards[id])delete builder.cards[id];renderBuilder(); } if (r) { delete builder.cards[r.dataset.remove]; renderBuilder(); } });
  $("#saved-decks").addEventListener("click", (e) => { const preferred = e.target.closest("[data-default-deck]"); if (preferred) { makeDefaultDeck(preferred.dataset.defaultDeck); return; } const zoom = e.target.closest("[data-card-zoom]"); if (zoom) { showCardDetails(zoom.dataset.cardZoom); return; } const load = e.target.closest("[data-load-deck]"); const duplicate = e.target.closest("[data-duplicate-deck]"); const remove = e.target.closest("[data-delete-deck]"); const exp = e.target.closest("[data-export-saved]"); const decks = readSavedDecks(); if (load) { const d = decks.find((x) => x.id === load.dataset.loadDeck); if (d) loadDeck(d); } if (duplicate) { const d = decks.find((x) => x.id === duplicate.dataset.duplicateDeck); if (d) { const copy = { ...d, id: crypto.randomUUID?.() || String(Date.now()), name: `${d.name} Copy`, updatedAt: new Date().toISOString() }; decks.unshift(copy); writeSavedDecks(decks); renderSavedDecks(); toast("Deck duplicated"); } } if (remove) { const d = decks.find((x) => x.id === remove.dataset.deleteDeck); if (d && confirm(`Delete “${d.name}” from this browser?`)) { if (String(savedDefaultDeck()?.id) === String(d.id)) localStorage.removeItem(defaultDeckStorageKey()); writeSavedDecks(decks.filter((x) => x.id !== d.id)); void deleteCloudDeck(d.id); renderSavedDecks(); } } if (exp) { const d = decks.find((x) => x.id === exp.dataset.exportSaved); if (d) exportDeck(d, `${d.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.json`); } });
  $("#export-deck").addEventListener("click", () => exportDeck(builder, `${builder.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.json`));
  $("#import-deck").addEventListener("click", () => $("#deck-file").click()); $("#deck-file").addEventListener("change", (e) => { if (e.target.files[0]) importDeckFile(e.target.files[0]); e.target.value = ""; });
  $("#library-search").addEventListener("input", () => { libraryPage = 0; renderLibrary(); }); $("#library-grade").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-clan").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-nation").addEventListener("change", () => { libraryPage = 0; renderLibrary(); }); $("#library-prev").addEventListener("click", () => { libraryPage = Math.max(0, libraryPage - 1); renderLibrary(); }); $("#library-next").addEventListener("click", () => { libraryPage += 1; renderLibrary(); }); $("#library-grid").addEventListener("click", (e) => { const node = e.target.closest("[data-card-detail]"); if (node) showCardDetails(node.dataset.cardDetail); });
  $("#art-search").addEventListener("input", () => { artPage = 0; renderArtGallery(); });
  $("#art-prev").addEventListener("click", () => { artPage = Math.max(0, artPage - 1); renderArtGallery(); });
  $("#art-next").addEventListener("click", () => { artPage += 1; renderArtGallery(); });
  $("#art-grid").addEventListener("click", (e) => { const tile = e.target.closest("[data-art-id]"); if (tile) showArtImage(Number(tile.dataset.artId)); });
  $("#close-card-dialog").addEventListener("click", () => $("#card-dialog").close()); $("#help-button").addEventListener("click", () => $("#help-dialog").showModal()); $("#close-help-dialog").addEventListener("click", () => $("#help-dialog").close());
  $("#match-menu").addEventListener("click", () => { if (confirm("Start a new practice match? The current match will end.")) { endOnlineSession(); openPracticeSetup(); } });
  $("#roll-online-die").addEventListener("click", () => { if (online.role === "guest") { if (!online.connection?.open) { toast("Wait for the host to connect, then roll again."); return; } sendGuestRequest("setup-roll"); } else if (online.role === "host") rollOnlineDieFor("human"); });
  window.addEventListener("pagehide", () => { if (online.role === "host" && online.publicRoomCode && account.client) void account.client.rpc("close_match_room", { p_room_code: online.publicRoomCode }); });
  $$("[data-first-choice]").forEach((button) => button.addEventListener("click", () => chooseOnlineFirstPlayer(button.dataset.firstChoice)));
  $("#online-start-dialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#card-dialog").addEventListener("click", (e) => { if (e.target === $("#card-dialog")) $("#card-dialog").close(); });
  populateClanFilters(); updateDeckCount(); restoreDefaultDeck(); renderBuilder(); renderLibrary(); renderArtGallery(); renderSavedDecks();
  initializeAccounts();
  const initial = ["play", "decks", "cards"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "play"; showView(initial);
  if (!readSavedDecks().length) { $("#match-layout").classList.add("hidden"); $("#match-empty").classList.remove("hidden"); }
  const inviteParams = new URLSearchParams(location.search); if (inviteParams.has("join") || inviteParams.has("watch")) { openOnlineDialog("join", location.href); if (inviteParams.has("watch")) { $("#online-join-role").value = "spectator"; renderOnlineDeckChoices(); } }
})();
