"use strict";

(function attachMatchBootstrap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardMatchBootstrap = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createMatchBootstrap() {
  const G_DECK_PATTERN = /G Unit|G Guardian|G-Guard/i;
  const UNIT_PATTERN = /\b(?:unit|trigger)\b/i;
  const DEFAULT_REAR_ZONES = 5;

  function isGDeckCard(card) { return G_DECK_PATTERN.test(`${card?.type || ""} ${card?.name || ""}`); }
  function isUnitCard(card) { return UNIT_PATTERN.test(String(card?.type || "")); }
  function nameKey(card, id) { return String(card?.name || id).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, ""); }

  function validateDecklist(deck, cardById, engine) {
    if (!deck || typeof deck !== "object" || Array.isArray(deck) || !deck.cards || typeof deck.cards !== "object" || Array.isArray(deck.cards)) return { ok: false, reason: "invalid-deck" };
    const mainNames = new Map(), gNames = new Map();
    let mainCount = 0, gCount = 0, triggers = 0, heals = 0, overs = 0, sentinels = 0, regalis = 0;
    for (const [cardId, rawCount] of Object.entries(deck.cards)) {
      if (!Number.isInteger(rawCount) || rawCount < 0 || rawCount > 4) return { ok: false, reason: "invalid-card-count", cardId };
      if (rawCount === 0) continue;
      const card = cardById(cardId);
      if (!card || String(card.id) !== cardId) return { ok: false, reason: "unknown-card", cardId };
      const isG = isGDeckCard(card), names = isG ? gNames : mainNames, key = nameKey(card, cardId);
      names.set(key, (names.get(key) || 0) + rawCount);
      if (isG) gCount += rawCount;
      else {
        mainCount += rawCount;
        if (card.trigger) { triggers += rawCount; if (/^heal$/i.test(card.trigger)) heals += rawCount; if (/^over$/i.test(card.trigger)) overs += rawCount; }
        if (engine?.hasAbilityKeyword?.(card, "sentinel") || /\bsentinel\b|perfect guard/i.test(`${card.text || ""} ${card.type || ""}`)) sentinels += rawCount;
        if (/Regalis Piece/i.test(`${card.text || ""} ${card.type || ""}`)) regalis += rawCount;
      }
    }
    if (mainCount !== 50) return { ok: false, reason: "main-deck-must-have-50", actual: mainCount };
    if (gCount > 16) return { ok: false, reason: "g-deck-exceeds-16", actual: gCount };
    if (triggers !== 16) return { ok: false, reason: "main-deck-must-have-16-triggers", actual: triggers };
    if (heals > 4 || overs > 1 || sentinels > 4 || regalis > 1) return { ok: false, reason: "deck-restriction-exceeded", heals, overs, sentinels, regalis };
    if ([...mainNames.values(), ...gNames.values()].some(count => count > 4)) return { ok: false, reason: "same-name-limit-exceeded" };
    const starter = typeof deck.starterCardId === "string" ? cardById(deck.starterCardId) : null;
    if (!starter || !(Number(starter.grade) === 0 && isUnitCard(starter) && Number(deck.cards[starter.id]) > 0 && !isGDeckCard(starter))) return { ok: false, reason: "invalid-starter" };
    return { ok: true, mainCount, gCount, starterCardId: starter.id };
  }

  function shuffleInPlace(cards, random) {
    for (let index = cards.length - 1; index > 0; index--) {
      const sample = Number(random());
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError("random must return a number in [0, 1)");
      const swap = Math.floor(sample * (index + 1));
      [cards[index], cards[swap]] = [cards[swap], cards[index]];
    }
    return cards;
  }

  function secureRandomFloat() {
    if (!globalThis.crypto?.getRandomValues) throw new Error("A secure random source is required to bootstrap a match");
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] / 0x100000000;
  }

  function makePlayer(deck, { playerId, name, human, cardById, engine, uidFactory, random }) {
    const all = [];
    for (const [cardId, count] of Object.entries(deck.cards)) {
      const definition = cardById(cardId), grade = Number(definition?.grade);
      const parsedAbilities = engine.parseCardAbilities?.(definition) || [];
      const printedDrive = /Triple Drive/i.test(String(definition?.text || "")) ? 3 : /Twin Drive/i.test(String(definition?.text || "")) ? 2 : 1;
      const instanceState = {
        ...(Number.isInteger(grade) && grade >= 0 ? { grade } : {}),
        ...(definition?.power != null && Number.isFinite(Number(definition.power)) ? { power: Number(definition.power) } : {}),
        ...(definition?.shield != null && Number.isFinite(Number(definition.shield)) ? { shield: Number(definition.shield) } : {}),
        ...(typeof definition?.type === "string" ? { type: definition.type } : {}),
        hasAbilities: parsedAbilities.length > 0,
        hasLimitBreak4: /\bLimit Break 4\s*\(This ability is active if you have (?:four|4) or more damage\)/i.test(String(definition?.text || "")),
        ...(typeof definition?.clan === "string" ? { clan: definition.clan } : {}),
        ...(Array.isArray(definition?.clans) ? { clans: [...definition.clans] } : {}),
        ...(typeof definition?.nation === "string" ? { nation: definition.nation } : {}),
        ...(Array.isArray(definition?.nations) ? { nations: [...definition.nations] } : {}),
        ...(typeof definition?.race === "string" ? { race: definition.race } : {}),
        ...(Array.isArray(definition?.races) ? { races: [...definition.races] } : {}),
        critical: Number.isFinite(Number(definition?.critical)) && Number(definition.critical) > 0 ? Number(definition.critical) : 1,
        drive: printedDrive,
        ...(isGDeckCard(definition) ? { gDeckCard: true } : {}),
        ...(/G Guardian|G-Guard/i.test(`${definition?.type || ""} ${definition?.name || ""}`) ? { gGuardian: true } : {}),
        ...(/\bUltimate Stride\b/i.test(String(definition?.text || "")) ? { ultimateStride: true } : {}),
        ...(typeof definition?.name === "string" ? { cardName: definition.name } : {}),
        ...(typeof definition?.trigger === "string" ? { triggerType: definition.trigger.toLowerCase() } : {}),
        ...(definition?.triggerPower != null && Number.isFinite(Number(definition.triggerPower)) ? { triggerPower: Number(definition.triggerPower) } : {}),
        ...(isUnitCard(definition) ? { unitCard: true } : {}),
        ...(engine.hasAbilityKeyword(definition, "boost") ? { boostAbility: true } : {}),
        ...(engine.hasAbilityKeyword(definition, "sentinel") ? { sentinel: true } : {}),
        ...(/attack(?:s|ing)? from (?:the )?back row|back row[^.\n]*can attack/i.test(String(definition?.text || "")) ? { canAttackBackRow: true } : {}),
        ...(engine.hasAbilityKeyword(definition, "cannot-be-ridden") ? { cannotBeRidden: true } : {}),
        ...(parsedAbilities.some(ability => ability.kind === "CONT" && ability.definition?.continuousRestrictions?.some(restriction => restriction.type === "ride-same-name-as-vanguard")) ? { sameNameRideRestriction: true } : {})
      };
      for (let copy = 0; copy < count; copy++) all.push(engine.createCardInstance(cardId, playerId, uidFactory(), instanceState));
    }
    const gDeck = all.filter(instance => isGDeckCard(cardById(instance.cardId))).map(instance => ({ ...instance, faceUp: false }));
    const main = all.filter(instance => !isGDeckCard(cardById(instance.cardId)));
    const starterId = deck.starterCardId || main.find(instance => Number(cardById(instance.cardId)?.grade) === 0 && isUnitCard(cardById(instance.cardId)))?.cardId;
    const starterIndex = main.findIndex(instance => instance.cardId === starterId);
    if (starterIndex < 0) throw new Error("Validated starter instance was not created");
    const vanguard = { ...main.splice(starterIndex, 1)[0], rested: false };
    shuffleInPlace(main, random);
    shuffleInPlace(gDeck, random);
    return {
      playerId, name: String(name || "Player").slice(0, 24), deck: main.slice(5), hand: main.slice(0, 5), damage: [], drop: [], soul: [], bind: [],
      vanguard, rodeGradeThreePlusThisFight: false, opponentTriggerRevealedThisTurn: false, rear: Array(DEFAULT_REAR_ZONES).fill(null),
      accelZones: 0, accelTypes: [], giftZones: [], orders: [], crests: [], guardCircle: [], triggerZone: [], extra: [], gDeck, gZone: [], removed: [],
      quickShields: 0, protectMarkers: 0, gifts: 0, human: Boolean(human)
    };
  }

  function createInitialMatchState(options) {
    const { hostDeck, guestDeck, hostAuthUid, guestAuthUid, cardById, engine } = options || {};
    if (!options || typeof cardById !== "function" || !engine?.createCardInstance || !engine?.hasAbilityKeyword) throw new TypeError("card database and shared ability engine are required");
    if (!hostAuthUid || !guestAuthUid || hostAuthUid === guestAuthUid) throw new TypeError("two distinct authenticated room seats are required");
    const hostValidation = validateDecklist(hostDeck, cardById, engine), guestValidation = validateDecklist(guestDeck, cardById, engine);
    if (!hostValidation.ok) return { ok: false, reason: "invalid-host-deck", detail: hostValidation };
    if (!guestValidation.ok) return { ok: false, reason: "invalid-guest-deck", detail: guestValidation };
    const uidFactory = options.uidFactory || (() => globalThis.crypto.randomUUID());
    const random = options.random || secureRandomFloat;
    const matchId = (options.idFactory || (() => globalThis.crypto.randomUUID()))();
    const hostPlayerId = (options.idFactory || (() => globalThis.crypto.randomUUID()))();
    const guestPlayerId = (options.idFactory || (() => globalThis.crypto.randomUUID()))();
    if ([matchId, hostPlayerId, guestPlayerId].some(id => typeof id !== "string" || !id) || new Set([matchId, hostPlayerId, guestPlayerId]).size !== 3) throw new Error("idFactory must return distinct nonempty strings");
    const allIds = new Set([matchId, hostPlayerId, guestPlayerId]);
    const uniqueUid = () => { const uid = uidFactory(); if (typeof uid !== "string" || !uid || allIds.has(uid)) throw new Error("uidFactory must return unique nonempty strings"); allIds.add(uid); return uid; };
    const host = makePlayer(hostDeck, { playerId: hostPlayerId, name: options.hostName, human: true, cardById, engine, uidFactory: uniqueUid, random });
    const guest = makePlayer(guestDeck, { playerId: guestPlayerId, name: options.guestName, human: false, cardById, engine, uidFactory: uniqueUid, random });
    return {
      ok: true,
      state: {
        matchId, stateVersion: 0, processedActionIds: [], eventSequence: 0, processedEventIds: [], players: { human: host, bot: guest },
        authoritySeats: { hostSide: "human", guestSide: "bot" }, turn: 1, side: "human", firstSide: null, firstTurnComplete: false,
        initialBotTurn: false, preMatch: { stage: "roll", rolls: { human: null, bot: null }, winner: null, firstSide: null, mulliganDone: { human: false, bot: false } },
        phase: 0, drewThisTurn: false, ridePerformed: false, stridePerformed: false, turnStartGrades: { human: 0, bot: 0 },
        pendingStride: null, pendingProtectGuard: null, ordersPlayedThisTurn: 0, selected: null, pendingAttackSetup: null, pendingAttack: null,
        pendingBattleEnd: null, pendingTrigger: null, pendingAbility: null, pendingAbilities: [], attacksByUnitTurn: {}, pendingDamageQueue: [],
        botAttacks: [], revealed: null, checkReveals: [], log: [], ended: false, deckName: String(hostDeck.name || "Online match").slice(0, 40)
      }
    };
  }

  return Object.freeze({ isGDeckCard, isUnitCard, validateDecklist, shuffleInPlace, secureRandomFloat, createInitialMatchState });
});
