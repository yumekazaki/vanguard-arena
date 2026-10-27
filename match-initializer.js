"use strict";

(function attachMatchInitializer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchInitializer = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createMatchInitializer() {
  function reject(reason, detail) { return { ok: false, reason, ...(detail ? { detail } : {}) }; }

  function submittedCardIds(deck) {
    if (!deck || !deck.cards || typeof deck.cards !== "object" || Array.isArray(deck.cards)) return null;
    return Object.keys(deck.cards).filter(id => Number(deck.cards[id]) > 0);
  }

  async function initializeRoom(roomCode, dependencies = {}) {
    const { rpc, cardDefinitions, bootstrap, engine, idFactory, uidFactory, random } = dependencies;
    if (typeof roomCode !== "string" || !/^[A-Fa-f0-9]{16}$/.test(roomCode)) return reject("invalid-room-code");
    if (typeof rpc !== "function" || typeof cardDefinitions !== "function" || !bootstrap?.createInitialMatchState || !engine) return reject("initializer-not-configured");

    let claim;
    try { claim = await rpc("claim_match_decks_for_initialization", { p_room_code: roomCode.toUpperCase() }); }
    catch { return reject("deck-claim-failed"); }
    if (claim?.ready !== true) return { ok: false, reason: claim?.reason || "decks-not-ready" };
    if (claim.roomCode !== roomCode.toUpperCase() || !claim.hostAuthUid || !claim.guestAuthUid || claim.hostAuthUid === claim.guestAuthUid) return reject("invalid-deck-claim");

    const hostIds = submittedCardIds(claim.hostDeck), guestIds = submittedCardIds(claim.guestDeck);
    if (!hostIds || !guestIds || new Set([...hostIds, ...guestIds]).size > 600) return reject("invalid-submitted-decks");
    let definitions;
    try { definitions = await cardDefinitions([...new Set([...hostIds, ...guestIds])]); }
    catch { return reject("card-catalog-unavailable"); }
    if (!Array.isArray(definitions)) return reject("card-catalog-unavailable");
    const cards = new Map(definitions.map(card => [String(card?.id || ""), card]));
    const expectedIds = new Set([...hostIds, ...guestIds]);
    if (cards.size !== definitions.length || [...expectedIds].some(id => !cards.has(id))) return reject("card-catalog-incomplete");
    const cardById = id => cards.get(String(id)) || null;

    const built = bootstrap.createInitialMatchState({
      hostDeck: claim.hostDeck,
      guestDeck: claim.guestDeck,
      hostAuthUid: claim.hostAuthUid,
      guestAuthUid: claim.guestAuthUid,
      hostName: "Host",
      guestName: "Joining player",
      cardById,
      engine,
      ...(idFactory ? { idFactory } : {}),
      ...(uidFactory ? { uidFactory } : {}),
      ...(random ? { random } : {})
    });
    if (!built?.ok || !built.state?.authoritySeats) return reject("deck-validation-failed", built?.detail || built?.reason);

    const seats = { hostSide: "human", guestSide: "bot", hostAuthUid: claim.hostAuthUid, guestAuthUid: claim.guestAuthUid };
    const canonical = dependencies.validateCanonicalMatchState?.(built.state, 0, seats);
    if (canonical && !canonical.ok) return reject("canonical-state-validation-failed", canonical.reason);
    try {
      const result = await rpc("initialize_match_game_state", { p_room_code: claim.roomCode, p_initial_state: built.state });
      return { ok: true, roomCode: claim.roomCode, stateVersion: Number(result?.stateVersion ?? 0), matchId: built.state.matchId };
    } catch {
      return reject("canonical-state-commit-failed");
    }
  }

  return Object.freeze({ initializeRoom });
});
