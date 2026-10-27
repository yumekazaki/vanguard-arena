"use strict";

(function attachWorkerCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchWorkerCore = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createWorkerCore() {
  const CARD_ZONES = Object.freeze(["deck", "hand", "damage", "drop", "soul", "bind", "rear", "orders", "crests", "guardCircle", "extra", "gDeck", "gZone", "removed"]);

  function validateCanonicalMatchState(state, expectedVersion, seats) {
    if (!state || typeof state !== "object" || Array.isArray(state) || typeof state.matchId !== "string" || !state.matchId) return { ok: false, reason: "invalid-canonical-match" };
    if (!Number.isSafeInteger(Number(expectedVersion)) || Number(state.stateVersion) !== Number(expectedVersion)) return { ok: false, reason: "canonical-version-mismatch" };
    if (!seats || !state.players?.[seats.hostSide] || !state.players?.[seats.guestSide] || seats.hostSide === seats.guestSide) return { ok: false, reason: "canonical-seat-mapping-missing" };
    const playerEntries = Object.entries(state.players);
    if (playerEntries.length !== 2) return { ok: false, reason: "invalid-player-count" };
    const playerIds = playerEntries.map(([, player]) => player?.playerId);
    if (playerIds.some(id => typeof id !== "string" || !id) || new Set(playerIds).size !== playerIds.length) return { ok: false, reason: "invalid-player-identities" };
    const knownPlayers = new Set(playerIds), seenInstances = new Set();
    for (const [side, player] of playerEntries) {
      for (const zone of CARD_ZONES) if (!Array.isArray(player[zone])) return { ok: false, reason: "missing-card-zone", side, zone };
      if (player.triggerZone !== undefined && !Array.isArray(player.triggerZone)) return { ok: false, reason: "invalid-card-zone", side, zone: "triggerZone" };
      const instances = [player.vanguard, ...CARD_ZONES.flatMap(zone => player[zone]), ...(player.triggerZone || [])];
      for (const instance of instances) {
        if (instance == null) continue;
        if (typeof instance !== "object" || Array.isArray(instance) || typeof instance.uid !== "string" || !instance.uid || instance.uid.length > 180 || (typeof instance.cardId !== "string" && typeof instance.cardId !== "number") || String(instance.cardId).length === 0) return { ok: false, reason: "invalid-card-instance", side };
        if (instance.grade !== undefined && (!Number.isInteger(instance.grade) || instance.grade < 0 || instance.grade > 99)) return { ok: false, reason: "invalid-card-grade", uid: instance.uid };
        if (instance.cardName !== undefined && (typeof instance.cardName !== "string" || instance.cardName.length > 240)) return { ok: false, reason: "invalid-card-name-metadata", uid: instance.uid };
        if (instance.legionMateInstanceId !== undefined && (typeof instance.legionMateInstanceId !== "string" || !instance.legionMateInstanceId || instance.legionMateInstanceId.length > 180 || instance.legionMateInstanceId === instance.uid)) return { ok: false, reason: "invalid-legion-mate-instance", uid: instance.uid };
        if (instance.triggerType !== undefined && (typeof instance.triggerType !== "string" || !["critical", "draw", "stand", "heal", "front", "over"].includes(instance.triggerType))) return { ok: false, reason: "invalid-card-trigger-metadata", uid: instance.uid };
        if (instance.triggerPower !== undefined && (!Number.isFinite(instance.triggerPower) || instance.triggerPower < 0)) return { ok: false, reason: "invalid-card-trigger-power", uid: instance.uid };
        for (const key of ["gDeckCard", "gGuardian", "ultimateStride", "hasAbilities", "unitCard", "cannotBeRidden", "sameNameRideRestriction", "sentinel"]) if (instance[key] !== undefined && typeof instance[key] !== "boolean") return { ok: false, reason: "invalid-card-rules-metadata", uid: instance.uid, key };
        for (const key of ["power", "shield", "critical"]) if (instance[key] !== undefined && (!Number.isFinite(instance[key]) || instance[key] < 0)) return { ok: false, reason: "invalid-card-combat-stat", uid: instance.uid, key };
        if (instance.drive !== undefined && (!Number.isInteger(instance.drive) || instance.drive < 0 || instance.drive > 10)) return { ok: false, reason: "invalid-card-drive-stat", uid: instance.uid };
        for (const key of ["boostAbility", "canAttackBackRow", "cannotDriveChecksThisTurn"]) if (instance[key] !== undefined && typeof instance[key] !== "boolean") return { ok: false, reason: "invalid-card-rules-metadata", uid: instance.uid, key };
        if (seenInstances.has(instance.uid)) return { ok: false, reason: "duplicate-card-instance-id", uid: instance.uid };
        seenInstances.add(instance.uid);
        if (typeof instance.ownerPlayerId !== "string" || !knownPlayers.has(instance.ownerPlayerId)) return { ok: false, reason: "invalid-card-owner", uid: instance.uid };
        if (typeof instance.controllerPlayerId !== "string" || !knownPlayers.has(instance.controllerPlayerId)) return { ok: false, reason: "invalid-card-controller", uid: instance.uid };
      }
    }
    return { ok: true, cardCount: seenInstances.size };
  }

  function seatMapping(claim) {
    const state = claim?.state;
    const authoritySeats = state?.authoritySeats;
    if (!state || !authoritySeats || !claim.hostAuthUid || !claim.guestAuthUid) return null;
    const hostSide = authoritySeats.hostSide;
    const guestSide = authoritySeats.guestSide;
    if (!hostSide || !guestSide || hostSide === guestSide || !state.players?.[hostSide] || !state.players?.[guestSide]) return null;
    return { hostAuthUid: claim.hostAuthUid, guestAuthUid: claim.guestAuthUid, hostSide, guestSide };
  }

  function isRoomSeatAuthUid(authUid, roomSeats) {
    if (typeof authUid !== "string" || !authUid || !roomSeats || typeof roomSeats !== "object") return false;
    return authUid === roomSeats.host_auth_uid || authUid === roomSeats.guest_auth_uid;
  }

  async function processRoomAction(roomCode, { rpc, engine, reducer }) {
    if (typeof roomCode !== "string" || !roomCode.trim() || typeof rpc !== "function" || !engine || !reducer) {
      throw new TypeError("roomCode, rpc, engine, and reducer are required");
    }
    const claim = await rpc("claim_match_action", { p_room_code: roomCode.trim(), p_lease_seconds: 30 });
    if (!claim?.claimed) return { processed: false, reason: claim?.reason || "no-queued-command" };

    let outcome;
    const seats = seatMapping(claim);
    if (!seats) outcome = { ok: false, reason: "canonical-seat-mapping-missing" };
    else {
      const validState = validateCanonicalMatchState(claim.state, claim.expectedStateVersion, seats);
      if (!validState.ok) outcome = { ok: false, reason: validState.reason };
    }
    if (seats && !outcome && !["ability-response", "manual-ability-activation", "game-action"].includes(claim.payload?.type)) outcome = { ok: false, reason: "unsupported-command" };
    if (seats && !outcome && claim.payload?.type === "ability-response") {
      const applyAbilityDecision = reducer.applyAbilityDecision || reducer.applyEngorgeDecision;
      outcome = typeof applyAbilityDecision === "function" ? applyAbilityDecision(claim.state, {
        actorAuthUid: claim.actorAuthUid,
        actionId: claim.actionId,
        expectedStateVersion: claim.expectedStateVersion,
        payload: claim.payload
      }, seats, engine) : { ok: false, reason: "unsupported-command" };
    }
    if (seats && !outcome && claim.payload?.type === "manual-ability-activation") {
      outcome = typeof reducer.applyManualAbilityActivation === "function" ? reducer.applyManualAbilityActivation(claim.state, {
        actorAuthUid: claim.actorAuthUid,
        actionId: claim.actionId,
        expectedStateVersion: claim.expectedStateVersion,
        payload: claim.payload
      }, seats, engine) : { ok: false, reason: "unsupported-command" };
    }
    if (seats && !outcome && claim.payload?.type === "game-action") {
      outcome = typeof reducer.applyGameAction === "function" ? reducer.applyGameAction(claim.state, {
        actorAuthUid: claim.actorAuthUid,
        actionId: claim.actionId,
        expectedStateVersion: claim.expectedStateVersion,
        payload: claim.payload
      }, seats, engine) : { ok: false, reason: "unsupported-command" };
    }

    const result = outcome.ok
      ? { ok: true, resolvedAbilityId: outcome.resolvedAbilityId, events: outcome.events || [] }
      : { ok: false, reason: outcome.reason || "command-rejected" };
    const completed = await rpc("complete_match_action", {
      p_room_code: claim.roomCode || roomCode.trim(),
      p_action_id: claim.actionId,
      p_claim_token: claim.leaseToken,
      p_accepted: outcome.ok === true,
      p_next_state: outcome.ok ? outcome.state : null,
      p_result: result
    });
    if (!completed?.ok || completed.accepted !== (outcome.ok === true)) {
      throw new Error("The claimed command could not be committed with its lease token");
    }
    return { processed: true, accepted: outcome.ok === true, result, stateVersion: completed.stateVersion };
  }

  return Object.freeze({ processRoomAction, seatMapping, validateCanonicalMatchState, isRoomSeatAuthUid });
});
