"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batch = require("./ability-contributions/batch-ABILITY-76D8A0B8-0018.js");
Engine.registerAbilityDefinitions(batch);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const EXPECTED_IDS = [
  "cfa-11346:0", "cfa-11346:1", "cfa-11347:0", "cfa-11350:0", "cfa-11350:1",
  "cfa-11351:0", "cfa-11351:1", "cfa-11352:0", "cfa-11353:0", "cfa-11353:1",
  "cfa-11354:0", "cfa-11355:0", "cfa-11356:0", "cfa-11356:1", "cfa-11356:2",
  "cfa-11357:0", "cfa-11358:0", "cfa-11364:0", "cfa-11364:1", "cfa-11365:0",
  "cfa-11365:1", "cfa-11366:0", "cfa-11366:1", "cfa-11366:2", "cfa-11367:0",
  "cfa-11367:1", "cfa-11368:0", "cfa-11368:1", "cfa-11369:0", "cfa-11369:1",
  "cfa-11369:2", "cfa-1136:0", "cfa-1136:1", "cfa-11370:0", "cfa-11371:0",
  "cfa-11371:1", "cfa-11372:0", "cfa-11372:1", "cfa-11373:0", "cfa-11374:0",
  "cfa-11375:0", "cfa-11375:1", "cfa-1137:0", "cfa-1137:1"
];
const SUPPORTED = ["cfa-11356:0", "cfa-11356:1", "cfa-11356:2", "cfa-1136:1", "cfa-1137:0", "cfa-1137:1"];
const cardFor = id => cards.get(id.slice(0, id.lastIndexOf(":")));
const abilityFor = id => {
  const card = cardFor(id);
  assert.ok(card, `catalog card exists for ${id}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(entry => entry.id === id);
  assert.ok(ability, `catalog parser preserves exact ability ID ${id}`);
  return { card, ability };
};

function instance(cardOrId, uid, playerId, overrides = {}) {
  const card = typeof cardOrId === "string" ? cards.get(cardOrId) : cardOrId;
  assert.ok(card, `catalog card exists for ${cardOrId}`);
  return {
    uid, cardId: String(card.id), cardName: card.name, type: card.type || "Unit", grade: Number(card.grade || 0),
    clan: card.clan, clans: [...(card.clans || [card.clan].filter(Boolean))], power: Number(card.power || 0),
    shield: Number(card.shield || 0), unitCard: true, critical: 1, drive: 1, rested: false, locked: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [], bind: [],
    orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
}

function attackFixture(abilityId, side, { damageCount = 4, vanguardClan = "Genesis" } = {}) {
  const { card, ability } = abilityFor(abilityId);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const rearAbility = abilityId === "cfa-1137:1";
  const attackZone = rearAbility ? "rear-left" : "vanguard";
  const source = instance(card, `saffron-${abilityId}-${side}`, ownerId, {
    zone: rearAbility ? "rear-guard" : "vanguard", circle: attackZone
  });
  const vgCard = vanguardClan === "Genesis"
    ? cards.get("cfa-1136")
    : catalog.find(item => item.clan === vanguardClan && Number(item.grade) >= 3 && item.type === "Unit");
  assert.ok(vgCard, `catalog has a Grade 3+ ${vanguardClan} Vanguard for condition testing`);
  const ownVanguard = rearAbility
    ? instance(vgCard, `own-vg-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" })
    : source;
  const opposingVanguard = instance("cfa-3", `opp-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard", grade: 3 });
  const own = player(ownerId), opponent = player(opponentId);
  own.vanguard = ownVanguard;
  if (rearAbility) own.rear[0] = source;
  own.damage = Array.from({ length: damageCount }, (_, index) => instance("cfa-2", `damage-${side}-${index}`, ownerId, { zone: "damage" }));
  opponent.vanguard = opposingVanguard;
  const state = {
    matchId: `batch18-attack-${abilityId}-${side}`, stateVersion: 1, turn: 4, side, phase: 5, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId: `battle-${abilityId}-${side}`, attackerSide: side, attackerUid: source.uid,
      attackerPlayerId: ownerId, attackerZone: attackZone, defenderSide: side === "human" ? "bot" : "human",
      targetUid: opposingVanguard.uid, targetZone: "vanguard", power: 10000, targetPower: Number(opposingVanguard.power || 10000), critical: 1 }
  };
  const event = Engine.createGameEvent(state, {
    eventId: `event-${abilityId}-${side}`, type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], previousLocation: attackZone, currentLocation: attackZone,
    targetCardInstanceIds: [opposingVanguard.uid], targetLocation: "vanguard", battleId: state.pendingAttack.battleId,
    phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, ability, source, side, ownerId, opponentId, own, opponent };
}

function respond(state, ability, source, actorAuthUid, actionId, selection = {}) {
  return Reducer.applyAbilityDecision(state, {
    actorAuthUid, actionId, expectedStateVersion: state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: source.uid, abilityId: ability.id, ...selection } }
  }, seats, Engine);
}

test("batch 0018 accounts for all 44 exact ability IDs without pretending unhandled skills are implemented", () => {
  assert.equal(batch.audit.batchId, "ABILITY-76D8A0B8-0018");
  assert.equal(batch.audit.baselineCommit, "76d8a0b86451f6de05d4477b2ca08772925ce9cf");
  assert.deepEqual(batch.audit.auditedAbilityIds, EXPECTED_IDS);
  assert.equal(new Set(batch.audit.auditedAbilityIds).size, 44);
  assert.deepEqual(batch.audit.alreadySupportedAbilityIds, SUPPORTED);
  assert.deepEqual(batch.audit.proposedDefinitionIds, []);
  assert.equal(batch.audit.blocked.length, 38);
  assert.equal(batch.length, 0, "this batch adds no unverified or unsupported effect definitions");
  const accounted = [...batch.audit.alreadySupportedAbilityIds, ...batch.audit.proposedDefinitionIds, ...batch.audit.blocked.map(row => row.abilityId)];
  assert.equal(new Set(accounted).size, 44, "each ability has exactly one audit outcome");
  assert.deepEqual([...accounted].sort(), [...EXPECTED_IDS].sort());
  for (const id of EXPECTED_IDS) {
    const { card, ability } = abilityFor(id);
    assert.ok(card.text.includes(ability.printedText), `${id}: original printed text remains in the catalog`);
  }
});

test("all blocked abilities remain fail-closed with a concrete blocker", () => {
  for (const { abilityId, blocker } of batch.audit.blocked) {
    const { ability } = abilityFor(abilityId);
    assert.equal(ability.definition, null, `${abilityId}: no guessed effect was attached`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${abilityId}: server does not claim to resolve it`);
    if (ability.kind === "ACT") {
      assert.equal(Engine.isManuallyActivatable(ability), true, `${abilityId}: the parsed ability type is ACT`);
      assert.equal(Engine.canActivateManualAbility(ability, {
        cardInstanceId: "source", controllerPlayerId: "player", actorPlayerId: "player", turnPlayerId: "player",
        phase: "main", inPermittedZone: true, conditions: {}, resources: {}
      }).reason, "unsupported-effect", `${abilityId}: missing definition keeps it unavailable`);
    }
    assert.ok(blocker.length > 50, `${abilityId}: blocker describes the missing handler, gate, or source validation`);
  }
});

test("official Artemis CONT is passive, exact-name gated, and never prompts for activation", () => {
  const { ability } = abilityFor("cfa-1136:1");
  assert.equal(ability.definition.source.patternId, "cont-named-soul-card-power-v1");
  assert.equal(ability.definition.printedText, ability.printedText);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), false, "passive CONT is not a resolving server prompt");
  assert.equal(Engine.isManuallyActivatable(ability), false);
  assert.equal(Engine.evaluateContinuousEffects([ability], {
    location: "vanguard", soulCardNames: ["Twilight Hunter, Artemis"]
  }).power, 1000);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "vanguard", soulCardNames: ["Other"] }).power, 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], {
    location: "rear-guard", soulCardNames: ["Twilight Hunter, Artemis"]
  }).power, 0);
  const ref = batch.audit.officialReferences.find(row => row.abilityId === ability.id);
  assert.equal(ref.cardNumber, "BT10/013EN");
  assert.match(ref.url, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
});

test("official Saffron own-Vanguard-attack AUTO resolves for either controller and rejects wrong source, circle, and conditions", () => {
  for (const side of ["human", "bot"]) {
    const f = attackFixture("cfa-1137:0", side);
    assert.equal(f.ability.definition.source.patternId, "auto-legacy-limit-break-vanguard-attack-power-v1");
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side, `${side}: prompt belongs to source controller`);
    const otherAuth = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(respond(f.state, f.ability, f.source, otherAuth, `proxy-${side}`).ok, false, `${side}: opponent cannot resolve`);
    const ownAuth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = respond(f.state, f.ability, f.source, ownAuth, `resolve-${side}`);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || ""}`);
    assert.equal(f.state.pendingAttack.power, 15000, `${side}: +5000 lasts through battle`);

    const wrongSource = attackFixture("cfa-1137:0", side);
    const unrelatedEvent = Engine.createGameEvent(wrongSource.state, {
      ...wrongSource.event, eventId: undefined, sourceCardInstanceId: "other-copy", cardInstanceId: "other-copy",
      subjectCardInstanceId: "other-copy", attackingCardInstanceIds: ["other-copy"]
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelatedEvent], Engine).queued.length, 0, `${side}: unrelated unit attack`);

    const wrongCircle = attackFixture("cfa-1137:0", side);
    const rearEvent = Engine.createGameEvent(wrongCircle.state, {
      ...wrongCircle.event, eventId: undefined, previousLocation: "rear-left", currentLocation: "rear-left"
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [rearEvent], Engine).queued.length, 0, `${side}: Vanguard-only source moved off VC`);

    const belowLimit = attackFixture("cfa-1137:0", side, { damageCount: 3 });
    assert.equal(Reducer.discoverAutoTriggers(belowLimit.state, [belowLimit.event], Engine).queued.length, 0, `${side}: Limit Break inactive`);
    const rearSaffron = attackFixture("cfa-1137:1", side);
    assert.equal(Reducer.discoverAutoTriggers(rearSaffron.state, [rearSaffron.event], Engine).queued.length, 1, `${side}: Rear-Guard attack with Genesis Vanguard`);
    assert.equal(rearSaffron.state.pendingAbility.side, side);
    assert.equal(respond(rearSaffron.state, rearSaffron.ability, rearSaffron.source, ownAuth, `rear-resolve-${side}`).ok, true);
    assert.equal(rearSaffron.state.pendingAttack.power, 12000);
    const wrongClan = attackFixture("cfa-1137:1", side, { vanguardClan: "Kagero" });
    assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0, `${side}: no Genesis Vanguard`);
  }
});

function guardFixture(side) {
  const { card, ability } = abilityFor("cfa-11356:1");
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = instance(card, `sentinel-${side}`, ownerId, { zone: "guardian", circle: "guardian" });
  const payment = instance("cfa-2", `discard-${side}`, ownerId, { zone: "hand" });
  const target = instance("cfa-3", `target-${side}`, ownerId, { zone: "rear-guard", circle: "rear-left" });
  const own = player(ownerId), opponent = player(opponentId);
  own.vanguard = instance("cfa-3", `own-vg-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  own.rear[0] = target; own.hand = [payment]; own.guardCircle = [source];
  opponent.vanguard = instance("cfa-3", `opp-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const attackerSide = side === "human" ? "bot" : "human";
  const state = {
    matchId: `batch18-guard-${side}`, stateVersion: 1, turn: 3, phase: 5, side: attackerSide, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own },
    pendingAttack: { battleId: `guard-battle-${side}`, attackerSide, attackerUid: opponent.vanguard.uid,
      attackerPlayerId: opponentId, attackerZone: "vanguard", defenderSide: side, targetUid: target.uid,
      targetZone: "rear-left", guardCards: [], power: 18000, targetPower: 10000, critical: 1 }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: opponentId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "guardian", circle: "guardian", timingWindow: "guard-placement",
    battleId: state.pendingAttack.battleId
  });
  return { state, event, ability, source, payment, target, own, opponent, side };
}

test("existing Sentinel AUTO prompts and resolves its discard and protection for the correct seat", () => {
  const sentinel = abilityFor("cfa-11356:0").ability;
  assert.equal(sentinel.kind, "CONT");
  assert.deepEqual(sentinel.definition.keywords, ["sentinel"]);
  assert.equal(Engine.hasAbilityKeyword([sentinel], "sentinel"), true);
  assert.equal(Engine.isManuallyActivatable(sentinel), false);
  for (const side of ["human", "bot"]) {
    const f = guardFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side, `${side}: private prompt belongs to guard controller`);
    const wrongActor = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(respond(f.state, f.ability, f.source, wrongActor, `guard-proxy-${side}`, {
      targetUid: f.target.uid, costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] }
    }).ok, false, `${side}: opponent cannot pay or resolve`);
    const rightActor = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = respond(f.state, f.ability, f.source, rightActor, `guard-resolve-${side}`, {
      targetUid: f.target.uid, costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] }
    });
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || ""}`);
    assert.equal(f.state.pendingAttack.perfectGuard, true, `${side}: chosen unit cannot be hit`);
    assert.deepEqual(f.own.drop.map(card => card.uid), [f.payment.uid], `${side}: correct player paid discard`);

    const wrongSource = guardFixture(side);
    const unrelated = Engine.createGameEvent(wrongSource.state, {
      ...wrongSource.event, eventId: undefined, cardInstanceId: "different", subjectCardInstanceId: "different",
      sourceCardInstanceId: "different"
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelated], Engine).queued.length, 0, `${side}: unrelated placement`);
    const wrongZone = guardFixture(side);
    const rearPlacement = Engine.createGameEvent(wrongZone.state, {
      ...wrongZone.event, eventId: undefined, previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left"
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongZone.state, [rearPlacement], Engine).queued.length, 0, `${side}: not placed on GC`);
  }
});

test("existing Vanguard placement draw-then-discard resolves privately for either player", () => {
  const { card, ability } = abilityFor("cfa-11356:2");
  assert.equal(ability.definition.source.patternId, "auto-vanguard-placement-draw-discard-v1");
  for (const side of ["human", "bot"]) {
    const ownerId = side === "human" ? "player-host" : "player-guest";
    const opponentId = side === "human" ? "player-guest" : "player-host";
    const source = instance(card, `placed-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
    const held = instance("cfa-2", `held-${side}`, ownerId, { zone: "hand" });
    const drawn = instance("cfa-3", `drawn-${side}`, ownerId, { zone: "deck" });
    const own = player(ownerId), opponent = player(opponentId);
    own.vanguard = source; own.hand = [held]; own.deck = [drawn];
    opponent.vanguard = instance("cfa-3", `opponent-vg-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
    const state = {
      matchId: `batch18-draw-discard-${side}`, stateVersion: 1, turn: 3, phase: 2, side, eventSequence: 0,
      processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [],
      players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own }
    };
    const event = Engine.createGameEvent(state, {
      type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
      sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
      cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
      previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", timingWindow: "ride"
    });
    assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 1, side);
    assert.equal(state.pendingAbility.side, side);
    const wrongActor = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(respond(state, ability, source, wrongActor, `draw-proxy-${side}`, { effectDiscardUid: drawn.uid }).ok, false);
    const actor = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = respond(state, ability, source, actor, `draw-resolve-${side}`, { effectDiscardUid: drawn.uid });
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason || ""}`);
    assert.deepEqual(own.hand.map(item => item.uid), [held.uid], `${side}: draw occurred before discard`);
    assert.deepEqual(own.drop.map(item => item.uid), [drawn.uid], `${side}: chosen discard belongs to this controller`);
    assert.deepEqual(opponent.drop, [], `${side}: opponent's zones stay private and unchanged`);

    const wrongCircle = { ...event, eventId: undefined, previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left" };
    const invalid = { ...state, pendingAbility: null, pendingAbilities: [], processedAbilityTriggers: [] };
    assert.equal(Reducer.discoverAutoTriggers(invalid, [Engine.createGameEvent(invalid, wrongCircle)], Engine).queued.length, 0, `${side}: VC-only placement`);
  }
});
