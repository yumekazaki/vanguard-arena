"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0013.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const EXPECTED_IDS = [
  "cfa-11212:0", "cfa-11212:1", "cfa-11213:0", "cfa-11213:1", "cfa-11214:0", "cfa-11214:1",
  "cfa-11215:0", "cfa-11215:1", "cfa-11216:0", "cfa-11216:1", "cfa-11218:0", "cfa-11219:0",
  "cfa-11220:0", "cfa-11221:0", "cfa-11222:0", "cfa-11223:0", "cfa-11224:0", "cfa-11225:0",
  "cfa-11225:1", "cfa-11226:0", "cfa-11226:1", "cfa-11226:2", "cfa-11227:0", "cfa-11227:1",
  "cfa-1122:0", "cfa-11230:0", "cfa-11232:0", "cfa-11232:1", "cfa-11233:0", "cfa-11233:1",
  "cfa-11234:0", "cfa-11234:1", "cfa-11235:0", "cfa-11236:0", "cfa-11236:1", "cfa-11237:0",
  "cfa-11238:0", "cfa-1123:0"
];
const ALREADY_SUPPORTED = [
  "cfa-11213:0", "cfa-11214:0", "cfa-11215:0", "cfa-11216:0",
  "cfa-11226:0", "cfa-1122:0", "cfa-11230:0", "cfa-1123:0"
];
const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const playerIdFor = side => side === "human" ? "player-host" : "player-guest";
const otherSide = side => side === "human" ? "bot" : "human";

function cardInstance(uid, cardId, ownerPlayerId, zone, circle = null, extra = {}) {
  const definition = cards.get(cardId);
  assert.ok(definition, `catalog card ${cardId} exists`);
  return {
    uid, cardId, cardName: definition.name, name: definition.name, type: definition.type,
    unitCard: definition.type === "Unit" || definition.type === "Trigger",
    grade: definition.grade, clan: definition.clan, clans: definition.clans || (definition.clan ? [definition.clan] : []),
    race: (definition.text || "").split(/\r?\n/)[0].split("/").slice(1).join("/").trim(),
    ownerPlayerId, controllerPlayerId: ownerPlayerId, zone, circle, rested: false,
    turnPowerBoost: 0, ...extra
  };
}

function makeState(side, matchId) {
  const ownerId = playerIdFor(side), opponentSide = otherSide(side), opponentId = playerIdFor(opponentSide);
  const players = {
    human: { playerId: "player-host", vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], removed: [], triggerZone: [], crests: [] },
    bot: { playerId: "player-guest", vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], removed: [], triggerZone: [], crests: [] }
  };
  players[side].vanguard = cardInstance(`vg-${side}`, "cfa-1122", ownerId, "vanguard", "vanguard");
  players[opponentSide].vanguard = cardInstance(`opp-vg-${side}`, "cfa-1122", opponentId, "vanguard", "vanguard");
  return {
    matchId, stateVersion: 0, turn: 4, side, phase: 5, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], players
  };
}

function abilityFor(abilityId) {
  const separator = abilityId.lastIndexOf(":");
  const cardId = abilityId.slice(0, separator), index = Number(abilityId.slice(separator + 1));
  const card = cards.get(cardId);
  assert.ok(card, `card ${cardId} exists in the catalog`);
  const ability = Engine.parseCardAbilitiesCached(card)[index];
  assert.ok(ability, `ability ${abilityId} exists in the catalog parse`);
  assert.equal(ability.id, abilityId);
  return { card, ability };
}

function resolvePending(state, side, ability, instance, selection = {}) {
  return Reducer.applyAbilityDecision(state, {
    actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `batch-0013-resolve-${state.matchId}-${side}`,
    expectedStateVersion: state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: instance.uid, abilityId: ability.id, ...selection } }
  }, seats, Engine);
}

function muungalFixture(side) {
  const state = makeState(side, `batch-0013-muungal-${side}`), ownerId = playerIdFor(side), opponent = otherSide(side);
  const source = cardInstance(`muungal-${side}`, "cfa-1122", ownerId, "rear-guard", "rear-left");
  const placedVanguard = cardInstance(`placed-vg-${side}`, "cfa-1122", ownerId, "vanguard", "vanguard");
  state.players[side].rear[0] = source;
  state.players[side].vanguard = placedVanguard;
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: placedVanguard.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: placedVanguard.uid, subjectCardInstanceId: placedVanguard.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "ride", timingWindow: "normal-ride"
  });
  return { state, source, event, side, opponent };
}

function segwaridesFixture(side) {
  const state = makeState(side, `batch-0013-segwarides-${side}`), ownerId = playerIdFor(side), opponentId = playerIdFor(otherSide(side));
  const source = cardInstance(`segwarides-${side}`, "cfa-1123", ownerId, "rear-guard", "rear-left");
  const target = state.players[otherSide(side)].vanguard;
  state.players[side].rear[0] = source;
  state.players[side].damage.push(cardInstance(`damage-${side}`, "cfa-1122", ownerId, "damage", null, { faceDown: false }));
  state.pendingAttack = {
    battleId: `segwarides-battle-${side}`, attackerSide: side, attackerPlayerId: ownerId,
    attackerUid: source.uid, attackerZone: "rear-left", defenderSide: otherSide(side), defenderPlayerId: opponentId,
    targetUid: target.uid, targetZone: "vanguard", power: 10000, targetPower: 13000, critical: 1
  };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, attackingCardInstanceIds: [source.uid],
    currentLocation: "rear-left", targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared"
  });
  return { state, source, target, event, side };
}

function sasanukiFixture(side, { eventBooster = true } = {}) {
  const state = makeState(side, `batch-0013-sasanuki-${side}`), ownerId = playerIdFor(side), opponent = otherSide(side);
  const source = cardInstance(`sasanuki-${side}`, "cfa-11230", ownerId, "rear-guard", "rear-left");
  const target = cardInstance(`target-${side}`, "cfa-1122", ownerId, "rear-guard", "rear-right");
  const attacker = state.players[side].vanguard;
  state.players[side].rear[0] = source;
  state.players[side].rear[1] = target;
  state.pendingAttack = {
    battleId: `sasanuki-battle-${side}`, attackerSide: side, attackerPlayerId: ownerId,
    attackerUid: attacker.uid, attackerZone: "vanguard", defenderSide: opponent,
    defenderPlayerId: playerIdFor(opponent), targetUid: state.players[opponent].vanguard.uid,
    targetZone: "vanguard", boostUid: eventBooster ? source.uid : "different-booster", boostZone: "rear-left", power: 16000
  };
  const event = Engine.createGameEvent(state, {
    type: "battle.close-step", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingUnitInstanceId: attacker.uid, attackingCardInstanceIds: [attacker.uid],
    boosterCardInstanceId: eventBooster ? source.uid : "different-booster", boostedCardInstanceId: attacker.uid,
    previousLocation: "vanguard", currentLocation: "vanguard", targetCardInstanceIds: [state.players[opponent].vanguard.uid],
    targetLocation: "vanguard", battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "close-step"
  });
  return { state, source, target, event, side };
}

test("the batch audit accounts for all 38 exact ability IDs on 25 card instances", () => {
  assert.equal(Object.keys(contribution).length, 0, "no unsupported or duplicate definition is exported");
  assert.equal(Object.prototype.propertyIsEnumerable.call(contribution, "audit"), false, "the audit stays non-enumerable");
  assert.deepEqual(contribution.audit.abilityIds, EXPECTED_IDS);
  assert.equal(contribution.audit.assignedAbilityCount, 38);
  assert.equal(contribution.audit.uniqueCardInstanceCount, 25);
  assert.equal(contribution.audit.newlyImplementedCount, 0);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, ALREADY_SUPPORTED);
  assert.equal(contribution.audit.unsupportedAbilityIds.length, 30);
  assert.equal(contribution.audit.unsupportedAbilities.length, 30);
  assert.equal(contribution.audit.unsupportedAbilities.every(record => record.blocker.length > 40), true);

  const seen = new Set();
  for (const abilityId of EXPECTED_IDS) {
    const { card, ability } = abilityFor(abilityId);
    assert.ok(card.text.includes(ability.printedText), `${abilityId}: parsed wording is present in exact catalog text`);
    assert.equal(seen.has(abilityId), false, `${abilityId} is unique in the assignment`);
    seen.add(abilityId);
    if (ALREADY_SUPPORTED.includes(abilityId)) {
      assert.ok(ability.definition, `${abilityId} has an existing definition`);
      if (ability.kind === "AUTO") assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${abilityId} uses an authoritative effect handler`);
      else assert.ok(ability.definition.source?.patternId?.startsWith("cont-"), `${abilityId} has a typed continuous handler`);
    } else {
      assert.equal(ability.definition || null, null, `${abilityId} remains fail-closed without an exact definition`);
      assert.ok(contribution.audit.unsupportedAbilities.some(record => record.abilityId === abilityId), `${abilityId} has a concrete blocker`);
    }
  }
  assert.equal(seen.size, 38);
});

test("already-supported Kiwame Crest ride restrictions and Kasen alias are location-scoped", () => {
  for (const side of ["human", "bot"]) {
    const sameName = cards.get("cfa-11212"), otherName = cards.get("cfa-11221");
    for (const crestId of ["cfa-11213", "cfa-11214", "cfa-11215", "cfa-11216"]) {
      const crest = cards.get(crestId), ability = Engine.parseCardAbilitiesCached(crest)[0];
      assert.equal(ability.id, `${crestId}:0`);
      assert.equal(ability.definition.source.patternId, "cont-crest-ride-same-name-vanguard-v1");
      const context = { vanguardCard: { ...sameName, uid: `${side}-vg` }, crests: [crest] };
      assert.equal(Engine.canRideCard({ ...sameName, uid: `${side}-same-name-copy` }, context), true, `${side}/${crestId}: same-name ride allowed`);
      assert.equal(Engine.canRideCard({ ...otherName, uid: `${side}-other-name-copy` }, context), false, `${side}/${crestId}: different-name ride rejected`);
    }
  }

  const kasen = cards.get("cfa-11226"), aliasAbility = Engine.parseCardAbilitiesCached(kasen)[0];
  assert.equal(aliasAbility.definition.source.patternId, "cont-vc-rc-card-name-alias-v1");
  assert.deepEqual(Engine.getCardNames(kasen, { location: "vanguard" }), ["Kasen Kanesada Kiwame Sentou", "Kasen Kanesada Kiwame"]);
  assert.deepEqual(Engine.getCardNames(kasen, { location: "rear-guard" }), ["Kasen Kanesada Kiwame Sentou", "Kasen Kanesada Kiwame"]);
  assert.deepEqual(Engine.getCardNames(kasen, { location: "hand" }), ["Kasen Kanesada Kiwame Sentou"], "alias is not applied from an unpermitted location");
});

test("Muungal's exact grade-and-clan Vanguard-placement AUTO resolves independently for both controllers", () => {
  const { ability } = abilityFor("cfa-1122:0");
  assert.equal(ability.definition.source.patternId, "auto-rc-own-vanguard-grade-clan-placement-power-v1");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.conditions, [
    { type: "event-subject-grade-equals", count: 3 },
    { type: "event-subject-has-clan", value: "Gold Paladin" }
  ]);

  for (const side of ["human", "bot"]) {
    const f = muungalFixture(side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);

    const unrelated = Engine.createGameEvent(f.state, {
      type: "card.placed", actingPlayerId: playerIdFor(otherSide(side)), turnPlayerId: playerIdFor(otherSide(side)),
      sourceCardInstanceId: f.state.players[otherSide(side)].vanguard.uid,
      sourceOwnerPlayerId: playerIdFor(otherSide(side)), sourceControllerPlayerId: playerIdFor(otherSide(side)),
      cardInstanceId: f.state.players[otherSide(side)].vanguard.uid, subjectCardInstanceId: f.state.players[otherSide(side)].vanguard.uid,
      subjectOwnerPlayerId: playerIdFor(otherSide(side)), subjectControllerPlayerId: playerIdFor(otherSide(side)),
      previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "ride", timingWindow: "normal-ride"
    });
    const wrongState = makeState(side, `muungal-unrelated-${side}`);
    wrongState.players[side].rear[0] = f.source;
    assert.equal(Reducer.discoverAutoTriggers(wrongState, [unrelated], Engine).queued.length, 0, `${side}: opponent's placement cannot satisfy the source controller's trigger`);

    const wrongGradeState = makeState(side, `muungal-wrong-grade-${side}`);
    const wrongGradeSource = cardInstance(`muungal-wrong-grade-source-${side}`, "cfa-1122", playerIdFor(side), "rear-guard", "rear-left");
    const wrongGradeVanguard = cardInstance(`grade-two-vg-${side}`, "cfa-1123", playerIdFor(side), "vanguard", "vanguard");
    wrongGradeState.players[side].rear[0] = wrongGradeSource;
    wrongGradeState.players[side].vanguard = wrongGradeVanguard;
    const wrongGradeEvent = Engine.createGameEvent(wrongGradeState, {
      type: "card.placed", actingPlayerId: playerIdFor(side), turnPlayerId: playerIdFor(side),
      sourceCardInstanceId: wrongGradeVanguard.uid, sourceOwnerPlayerId: playerIdFor(side), sourceControllerPlayerId: playerIdFor(side),
      cardInstanceId: wrongGradeVanguard.uid, subjectCardInstanceId: wrongGradeVanguard.uid,
      subjectOwnerPlayerId: playerIdFor(side), subjectControllerPlayerId: playerIdFor(side),
      previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard", phase: "ride", timingWindow: "normal-ride"
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongGradeState, [wrongGradeEvent], Engine).queued.length, 0, `${side}: Grade 2 Vanguard fails the Grade 3 condition`);

    const wrongActor = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const before = f.source.turnPowerBoost;
    const proxy = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: wrongActor, actionId: `muungal-proxy-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id } }
    }, seats, Engine);
    assert.equal(proxy.ok, false, `${side}: opposing seat cannot resolve this ability`);
    assert.equal(f.source.turnPowerBoost, before);

    const resolved = resolvePending(f.state, side, ability, f.source);
    assert.equal(resolved.ok, true, `${side}: ${resolved.reason}`);
    assert.equal(f.source.turnPowerBoost, 10000);
    assert.equal(f.state.players[side].vanguard.turnPowerBoost || 0, 0, `${side}: only the exact Rear-Guard source receives power`);
  }
});

test("Segwarides requires its own attack and a payable Gold Paladin Counter Blast on both seats", () => {
  const { ability } = abilityFor("cfa-1123:0");
  assert.equal(ability.definition.source.patternId, "auto-own-attack-clan-counter-blast-power-battle-v1");
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1, filter: { clan: "Gold Paladin" } }]);

  for (const side of ["human", "bot"]) {
    const f = segwaridesFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side);
    const wrongSeat = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const proxy = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: wrongSeat, actionId: `segwarides-proxy-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id, costSelections: { cb: [`damage-${side}`] } } }
    }, seats, Engine);
    assert.equal(proxy.ok, false, `${side}: host cannot answer for the guest or vice versa`);
    assert.equal(f.state.players[side].damage[0].faceDown, false, `${side}: rejected proxy pays no cost`);

    const result = resolvePending(f.state, side, ability, f.source, { costSelections: { cb: [`damage-${side}`] } });
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.state.players[side].damage[0].faceDown, true, `${side}: correct controller pays their own damage`);
    assert.equal(f.state.pendingAttack.power, 14000, `${side}: own attacker gets +4000 for this battle`);

    const missingCost = segwaridesFixture(side);
    missingCost.state.players[side].damage = [];
    assert.equal(Reducer.discoverAutoTriggers(missingCost.state, [missingCost.event], Engine).queued.length, 0, `${side}: unavailable Counter Blast cannot prompt`);

    const differentAttacker = segwaridesFixture(side);
    const unrelatedAttack = Engine.createGameEvent(differentAttacker.state, {
      type: "unit.attacked", actingPlayerId: playerIdFor(side), turnPlayerId: playerIdFor(side),
      sourceCardInstanceId: `other-attacker-${side}`, sourceControllerPlayerId: playerIdFor(side),
      cardInstanceId: `other-attacker-${side}`, subjectCardInstanceId: `other-attacker-${side}`,
      subjectControllerPlayerId: playerIdFor(side), attackingCardInstanceIds: [`other-attacker-${side}`],
      currentLocation: "rear-right", targetCardInstanceIds: [differentAttacker.target.uid], targetLocation: "vanguard",
      battleId: `different-battle-${side}`, phase: "battle", timingWindow: "attack-declared"
    });
    assert.equal(Reducer.discoverAutoTriggers(differentAttacker.state, [unrelatedAttack], Engine).queued.length, 0, `${side}: another unit's attack does not trigger the source`);
  }
});

test("Sasanuki checks the exact booster at battle close and resolves its source-to-Soul cost for both seats", () => {
  const { ability } = abilityFor("cfa-11230:0");
  assert.equal(ability.definition.source.patternId, "auto-boosted-battle-close-source-to-soul-power-v1");
  assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);

  for (const side of ["human", "bot"]) {
    const wrongBooster = sasanukiFixture(side, { eventBooster: false });
    assert.equal(Reducer.discoverAutoTriggers(wrongBooster.state, [wrongBooster.event], Engine).queued.length, 0, `${side}: different booster cannot trigger it`);

    const f = sasanukiFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side);
    const wrongSeat = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const proxy = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: wrongSeat, actionId: `sasanuki-proxy-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: ability.id, targetUid: f.target.uid } }
    }, seats, Engine);
    assert.equal(proxy.ok, false, `${side}: wrong seat cannot resolve`);
    assert.equal(f.state.players[side].rear.includes(f.source), true, `${side}: rejected resolution does not pay the cost`);
    assert.equal(f.target.turnPowerBoost || 0, 0);

    const result = resolvePending(f.state, side, ability, f.source, { targetUid: f.target.uid });
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.state.players[side].soul.some(card => card.uid === f.source.uid), true, `${side}: exact booster pays source-to-Soul`);
    assert.equal(f.target.turnPowerBoost, 2000, `${side}: selected friendly unit receives turn power`);
    assert.equal(f.state.players[side].rear.includes(f.source), false);
  }
});

test("unsupported manual abilities and passive CONT abilities fail closed", () => {
  for (const abilityId of EXPECTED_IDS) {
    const { ability } = abilityFor(abilityId);
    if (ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(ability, {}).ok, false, `${abilityId}: unsupported ACT cannot be manually used`);
    if (ability.kind === "CONT") assert.equal(Engine.canActivateManualAbility(ability, {}).ok, false, `${abilityId}: CONT is not a manual activation`);
  }
});
