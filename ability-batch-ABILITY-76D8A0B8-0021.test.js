"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const batch = require("./ability-contributions/batch-ABILITY-76D8A0B8-0021.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const EXPECTED_IDS = [
  "cfa-11439:0", "cfa-11439:1", "cfa-11440:0", "cfa-11441:0", "cfa-11446:0",
  "cfa-11447:0", "cfa-11448:0", "cfa-11449:0", "cfa-1144:0", "cfa-11450:0",
  "cfa-11452:0", "cfa-11452:1", "cfa-11453:0", "cfa-11453:1", "cfa-11454:0",
  "cfa-11455:0", "cfa-11455:1", "cfa-11457:0", "cfa-11457:1", "cfa-11458:0",
  "cfa-11458:1", "cfa-1145:0", "cfa-1145:1", "cfa-11461:0", "cfa-11464:0",
  "cfa-11464:1", "cfa-11465:0", "cfa-11466:0", "cfa-11466:1", "cfa-11467:0",
  "cfa-11467:1", "cfa-11468:0", "cfa-11468:1", "cfa-11469:0", "cfa-1146:0",
  "cfa-11470:0", "cfa-11470:1"
];
const SUPPORTED = [
  "cfa-11452:0", "cfa-11452:1", "cfa-11453:0", "cfa-11453:1",
  "cfa-1145:0", "cfa-1145:1", "cfa-1146:0"
];
const BLOCKED = EXPECTED_IDS.filter(id => !SUPPORTED.includes(id));
const cardFor = id => cards.get(String(id));

function abilityFor(id) {
  const cardId = id.slice(0, id.lastIndexOf(":"));
  const card = cardFor(cardId);
  assert.ok(card, `catalog contains card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `parser retains exact ability ID ${id}`);
  return { card, ability };
}

function instance(cardId, uid, playerId, extra = {}) {
  const definition = cardFor(cardId);
  assert.ok(definition, `catalog card ${cardId} exists`);
  const clans = Engine.getCardClans(definition);
  return {
    uid,
    cardId: String(cardId),
    cardName: definition.name,
    type: definition.type || "Unit",
    grade: Number(definition.grade || 0),
    power: Number(definition.power || 0),
    shield: Number(definition.shield || 0),
    clan: clans[0] || "",
    clans,
    unitCard: /unit|trigger/i.test(String(definition.type || "")),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function emptyPlayer(playerId) {
  return {
    playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [],
    damage: [], drop: [], bind: [], orders: [], crests: [], guardCircle: [],
    triggerZone: [], gDeck: [], gZone: []
  };
}

function authFor(side) {
  return side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
}

function placementFixture({ side, circle }) {
  const otherSide = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const source = instance("cfa-1146", `cumin-${side}-${circle}`, ownerId, { zone: circle, circle });
  const own = emptyPlayer(ownerId), opponent = emptyPlayer(otherId);
  if (circle === "vanguard") own.vanguard = source;
  else {
    own.vanguard = instance("cfa-1136", `genesis-vanguard-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
    own.rear[0] = source;
  }
  const top = instance("cfa-4", `top-${side}-${circle}`, ownerId);
  own.deck = [top];
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = {
    matchId: `batch21-cumin-${side}-${circle}`, stateVersion: 1, turn: 2, phase: 4,
    side, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [],
    processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingEffectChoice: null, pendingAttack: null, players
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: circle, circle,
    phase: "main", timingWindow: "normal-call"
  });
  return { state, event, source, top, own, opponent, side, otherSide };
}

function decideCumin(f, accept, actorAuthUid = authFor(f.side)) {
  const ability = abilityFor("cfa-1146:0").ability;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId: `${f.state.matchId}-${accept ? "accept" : "decline"}-${actorAuthUid}`,
    matchId: f.state.matchId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: ability.id } }
  }, seats, Engine);
}

function guardianFixture({ sourceCardId, side }) {
  const otherSide = side === "human" ? "bot" : "human";
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const ability = abilityFor(`${sourceCardId}:1`).ability;
  const source = instance(sourceCardId, `guardian-${sourceCardId}-${side}`, ownerId, { zone: "guardian", circle: "guardian" });
  const targetCardId = sourceCardId === "cfa-1145" ? "cfa-1136" : "cfa-2";
  const target = instance(targetCardId, `target-${sourceCardId}-${side}`, ownerId, { zone: "vanguard", circle: "vanguard" });
  const payment = instance(sourceCardId === "cfa-1145" ? "cfa-1146" : "cfa-2", `payment-${sourceCardId}-${side}`, ownerId);
  const attacker = instance("cfa-3", `attacker-${sourceCardId}-${side}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const own = emptyPlayer(ownerId), opponent = emptyPlayer(otherId);
  own.vanguard = target;
  own.hand = [payment];
  own.guardCircle = [source];
  opponent.vanguard = attacker;
  const players = side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own };
  const state = {
    matchId: `batch21-guardian-${sourceCardId}-${side}`, stateVersion: 1,
    turn: 2, phase: 5, side: otherSide, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, pendingEffectChoice: null,
    pendingAttack: {
      battleId: `battle-${sourceCardId}-${side}`, attackerSide: otherSide,
      attackerUid: attacker.uid, attackerZone: "vanguard", defenderSide: side,
      targetUid: target.uid, targetZone: "vanguard", guardCards: [],
      power: 18000, targetPower: 10000, critical: 1
    },
    players
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: ownerId, turnPlayerId: otherId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId,
    sourceControllerPlayerId: ownerId, cardInstanceId: source.uid,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId,
    subjectControllerPlayerId: ownerId, previousLocation: "hand",
    currentLocation: "guardian", circle: "guardian", phase: "battle",
    timingWindow: "guard", battleId: state.pendingAttack.battleId
  });
  return { state, event, source, target, payment, ability, side, otherSide, ownerId };
}

function decideGuardian(f, actorAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId: `resolve-${f.source.uid}-${actorAuthUid}`,
    matchId: f.state.matchId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response", accept: true,
      selection: {
        instanceUid: f.source.uid, abilityId: f.ability.id,
        targetUid: f.target.uid,
        costSelections: { cb: [], sb: [], discard: [f.payment.uid], reveal: [] }
      }
    }
  }, seats, Engine);
}

test("the claimed assignment is audited exactly once, with no unreviewed definitions added", () => {
  assert.deepEqual(batch.audit.auditedAbilityIds, EXPECTED_IDS);
  assert.equal(new Set(batch.audit.auditedAbilityIds).size, 37);
  assert.equal(new Set(batch.audit.auditedAbilityIds.map(id => id.slice(0, id.lastIndexOf(":")))).size, 25);
  assert.equal(batch.audit.alreadySupportedAbilityIds.length, 7);
  assert.deepEqual(batch.audit.alreadySupportedAbilityIds, SUPPORTED);
  assert.deepEqual(batch.audit.proposedDefinitionIds, []);
  assert.equal(batch.length, 0);
  assert.equal(batch.audit.blocked.length, 30);
  assert.deepEqual(batch.audit.blocked.map(item => item.abilityId), BLOCKED);
  assert.ok(batch.audit.blocked.every(item => typeof item.blocker === "string" && item.blocker.length > 40));
  for (const id of EXPECTED_IDS) abilityFor(id);
});

test("existing Sentinel keyword, Guardian protection, and Cumin definitions preserve their exact scope", () => {
  for (const id of ["cfa-11452:0", "cfa-11453:0", "cfa-1145:0"]) {
    const { card, ability } = abilityFor(id);
    assert.equal(ability.kind, "CONT", id);
    assert.deepEqual(ability.definition?.keywords, ["sentinel"], id);
    assert.deepEqual(Engine.getCardAbilityKeywords(card), ["sentinel"], id);
    assert.equal(ability.effects, null, `${id} is a keyword, not an activated effect`);
    assert.equal(Engine.isManuallyActivatable(ability), false, id);
  }

  for (const id of ["cfa-11452:1", "cfa-11453:1"]) {
    const { ability } = abilityFor(id);
    assert.equal(ability.definition?.source?.patternId, "auto-gc-when-placed-discard-protect-unit-v1", id);
    assert.deepEqual(ability.requiredLocation, ["guardian"], id);
    assert.equal(ability.trigger.eventType, "card.placed", id);
    assert.deepEqual(ability.trigger.circles, ["guardian"], id);
    assert.deepEqual(ability.costs, [{ type: "discard", count: 1 }], id);
    assert.equal(ability.effects[0]?.op, "protect-target", id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }

  const kushinada = abilityFor("cfa-1145:1").ability;
  assert.equal(kushinada.definition?.source?.patternId, "auto-gc-discard-protect-attacked-unit-v1");
  assert.deepEqual(kushinada.costs, [{ type: "discard", count: 1, filter: { clan: "Genesis" } }]);
  assert.equal(kushinada.effects[0]?.targetFilter?.mustBeAttacked, true);
  assert.equal(kushinada.effects[0]?.targetFilter?.clan, "Genesis");
  assert.equal(Reducer.supportsServerAbilityEffects(kushinada), true);

  const cumin = abilityFor("cfa-1146:0").ability;
  assert.equal(cumin.definition?.source?.patternId, "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1");
  assert.deepEqual(cumin.requiredLocation, ["vanguard", "rear-guard"]);
  assert.deepEqual(cumin.trigger.circles, ["vanguard", "rear-guard"]);
  assert.deepEqual(cumin.conditions, [{ type: "controller-vanguard-has-clan", value: "Genesis" }]);
  assert.deepEqual(cumin.effects, [{ op: "soul-charge", count: 1 }]);
  assert.equal(cumin.canDecline, true);
  assert.equal(Reducer.supportsServerAbilityEffects(cumin), true);
});

test("existing Cumin AUTO resolves only for its controller from either seat and legal circle", () => {
  for (const side of ["human", "bot"]) for (const circle of ["vanguard", "rear-left"]) {
    const f = placementFixture({ side, circle });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${side}/${circle}`);
    assert.equal(f.state.pendingAbility.side, side, `${side}/${circle}`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${side}/${circle}`);
    const before = JSON.stringify(f.state);
    const forged = decideCumin(f, true, authFor(f.side === "human" ? "bot" : "human"));
    assert.equal(forged.ok, false, `${side}/${circle}: opponent cannot resolve it`);
    assert.equal(JSON.stringify(f.state), before, `${side}/${circle}: rejected resolution is atomic`);
    const resolved = decideCumin(f, true);
    assert.equal(resolved.ok, true, `${side}/${circle}: ${resolved.reason}`);
    assert.deepEqual(f.own.soul.map(card => card.uid), [f.top.uid], `${side}/${circle}`);
    assert.deepEqual(f.own.deck, [], `${side}/${circle}`);
    assert.deepEqual(f.opponent.soul, [], `${side}/${circle}`);
    assert.equal(f.state.pendingAbility, null, `${side}/${circle}`);
  }
});

test("existing Guardian Circle protection AUTO resolves for host and joining player with their own cost", () => {
  for (const sourceCardId of ["cfa-11452", "cfa-11453", "cfa-1145"]) for (const side of ["human", "bot"]) {
    const f = guardianFixture({ sourceCardId, side });
    const discovered = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovered.queued.length, 1, `${sourceCardId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side, `${sourceCardId}/${side}`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${sourceCardId}/${side}`);
    const before = JSON.stringify(f.state);
    const forged = decideGuardian(f, authFor(f.otherSide));
    assert.equal(forged.ok, false, `${sourceCardId}/${side}: opponent cannot resolve it`);
    assert.equal(JSON.stringify(f.state), before, `${sourceCardId}/${side}: rejected resolution is atomic`);
    const resolved = decideGuardian(f, authFor(side));
    assert.equal(resolved.ok, true, `${sourceCardId}/${side}: ${resolved.reason}`);
    assert.equal(f.state.pendingAttack.perfectGuard, true, `${sourceCardId}/${side}`);
    assert.deepEqual(f.state.players[side].drop.map(card => card.uid), [f.payment.uid], `${sourceCardId}/${side}: owner pays`);
    assert.deepEqual(f.state.players[side].hand, [], `${sourceCardId}/${side}`);
    assert.deepEqual(f.state.players[f.otherSide].drop, [], `${sourceCardId}/${side}`);
  }
});

test("every unsupported automatic and continuous ability fails closed", () => {
  for (const id of BLOCKED) {
    const { ability } = abilityFor(id);
    assert.equal(ability.definition, null, `${id} has no reviewed definition`);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, `${id} is not server-trusted`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${id} cannot resolve server-side`);
    if (ability.kind === "AUTO") {
      assert.equal(Engine.autoAbilityReadiness(ability).ok, false, `${id} cannot become a pending skill`);
    } else if (ability.kind === "CONT") {
      const result = Engine.evaluateContinuousEffects([ability], {
        location: ability.requiredLocation?.[0] || "vanguard",
        sourceInstanceId: `source-${id}`, targetInstanceId: `source-${id}`,
        isControllerTurn: true, controllerVanguardGrade: 3, opponentVanguardGrade: 3,
        controllerFieldCards: [
          { uid: "taiga", zone: "rear-guard", names: ["Ultraman Taiga \"Pose\""] },
          { uid: "titas", zone: "rear-guard", names: ["Ultraman Titas \"Pose\""] },
          { uid: "fuma", zone: "rear-guard", names: ["Ultraman Fuma \"Pose\""] }
        ],
        soulCardNames: ["Ultraman X", "Ultraman Exceed X"]
      });
      assert.deepEqual(result, { power: 0, critical: 0, drive: 0 }, `${id} has no speculative continuous effect`);
    }
  }
});

test("unsupported ACT abilities are rejected by the authoritative reducer without paying or moving cards", () => {
  for (const id of BLOCKED) {
    const { ability } = abilityFor(id);
    if (ability.kind !== "ACT") continue;
    const cardId = ability.cardId, ownerId = "player-host";
    const source = instance(cardId, `blocked-act-${id}`, ownerId);
    const own = emptyPlayer(ownerId), opponent = emptyPlayer("player-guest");
    if ((ability.requiredLocation || []).includes("vanguard")) {
      source.zone = "vanguard";
      source.circle = "vanguard";
      own.vanguard = source;
    } else {
      source.zone = "rear-guard";
      source.circle = "rear-left";
      own.rear[0] = source;
    }
    own.hand = [instance("cfa-2", `hand-${id}`, ownerId)];
    own.soul = [instance("cfa-3", `soul-${id}`, ownerId)];
    own.damage = [instance("cfa-4", `damage-${id}`, ownerId)];
    const state = {
      matchId: `batch21-blocked-act-${id}`, stateVersion: 1, turn: 2, phase: 4,
      side: "human", eventSequence: 0, processedActionIds: [], processedEventIds: [],
      pendingAbilities: [], pendingAbility: null, pendingAttack: null,
      players: { human: own, bot: opponent }
    };
    const before = JSON.stringify(state);
    const result = Reducer.applyManualAbilityActivation(state, {
      actorAuthUid: seats.hostAuthUid,
      actionId: `try-unsupported-${id}`,
      expectedStateVersion: state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: source.uid, abilityId: id, selection: {} }
    }, seats, Engine);
    assert.equal(result.ok, false, `${id} must reject: ${result.reason}`);
    assert.equal(JSON.stringify(state), before, `${id} rejection must not mutate costs or zones`);
  }
});

test("the audit records direct Bushiroad sources and distinguishes verified matches from blockers", () => {
  const references = new Map(batch.audit.officialReferences.map(item => [item.abilityId || item.abilityIds[0], item]));
  assert.match(references.get("cfa-1144:0").url, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
  assert.match(references.get("cfa-1145:0").url, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
  assert.match(references.get("cfa-1146:0").url, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//);
  assert.ok(batch.audit.provenanceWarnings.some(item => item.abilityIds.includes("cfa-11439:0")));
  assert.ok(batch.audit.provenanceWarnings.some(item => item.abilityIds.includes("cfa-11452:1")));
  assert.ok(batch.audit.provenanceWarnings.some(item => item.abilityIds.includes("cfa-1144:0")));
});
