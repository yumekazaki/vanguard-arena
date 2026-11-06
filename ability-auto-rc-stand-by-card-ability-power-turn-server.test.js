"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const byId = new Map(catalog.map(card => [String(card.id), card]));
const abilityIds = ["cfa-10025:1", "cfa-10026:1"];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function instance(cardId, uid, playerId, extra = {}) {
  const definition = byId.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return {
    uid, cardId: String(cardId), cardName: definition.name, grade: Number(definition.grade),
    type: definition.type || "Unit", unitCard: true,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function player(playerId, vanguard, rear, triggerZone = []) {
  return { playerId, vanguard, rear, hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone, usedAbilities: [] };
}

function fixture(cardId, side = "human") {
  const card = byId.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:1`);
  assert.ok(ability?.definition, `${cardId}:1 has a reviewed definition`);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const source = instance(cardId, `unit-${cardId}-${++sequence}`, playerId, { circle: "rear-left", zone: "rear-guard", rested: true, power: 9000 });
  const vanguard = instance("cfa-7474", `vanguard-${side}-${sequence}`, playerId, { circle: "vanguard", zone: "vanguard", rested: false, faceUp: true });
  const opponentVanguard = instance("cfa-7474", `opponent-vanguard-${side}-${sequence}`, opponentId, { circle: "vanguard", zone: "vanguard", rested: false, faceUp: true });
  const standCard = byId.get("cfa-5");
  assert.equal(String(standCard?.trigger || "").toLowerCase(), "stand");
  const checked = instance("cfa-5", `stand-trigger-${side}-${sequence}`, playerId, { zone: "trigger", triggerType: "stand" });
  const own = player(playerId, vanguard, [source, null, null, null, null], [checked]);
  const other = player(opponentId, opponentVanguard, [null, null, null, null, null]);
  const players = side === "human" ? { human: own, bot: other } : { human: other, bot: own };
  const attackerSide = opponentSide;
  const battleId = null;
  const state = {
    matchId: "card-ability-stand-test", stateVersion: 1, turn: 4, side: attackerSide, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], players,
    pendingAttack: { battleId, attackerSide, attackerUid: opponentVanguard.uid, attackerZone: "vanguard", attackerPlayerId: opponentId, defenderSide: side, targetUid: vanguard.uid, targetZone: "vanguard", defenderDone: true, guardCards: [] },
    pendingCheckCard: { side, uid: checked.uid, destination: "damage", checkKind: "damage", battleId },
    pendingTrigger: { side, uid: checked.uid, cardName: standCard.name, kind: "stand", checkName: "damage", power: 10000, turnOwner: side, stage: "stand-target", battleId }
  };
  return { state, ability, card, source, checked, side, playerId, opponentId, battleId };
}

function actor(side) { return side === "human" ? "auth-host" : "auth-guest"; }

function resolvePending(f, accept = true, actionId = `resolve-${f.source.uid}`) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor(f.side), actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: pending.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

function emittedAbilityEvent(f, sourceCard, sourceAbilityId, subject = f.source, overrides = {}) {
  const sourcePlayerId = sourceCard.controllerPlayerId;
  return Engine.createGameEvent(f.state, {
    type: "unit.stood", actingPlayerId: sourcePlayerId, turnPlayerId: f.opponentId,
    sourceCardInstanceId: sourceCard.uid, sourceOwnerPlayerId: sourceCard.ownerPlayerId, sourceControllerPlayerId: sourcePlayerId,
    abilitySourceInstanceId: sourceCard.uid, abilitySourceOwnerPlayerId: sourceCard.ownerPlayerId, abilitySourceControllerPlayerId: sourcePlayerId,
    sourceAbilityId,
    effectProvenance: { cause: "card-effect", sourceCardInstanceId: sourceCard.uid, sourceControllerPlayerId: sourcePlayerId, abilitySourceInstanceId: sourceCard.uid, abilitySourceControllerPlayerId: sourcePlayerId, actingPlayerId: sourcePlayerId, sourceAbilityId },
    cardInstanceId: subject.uid, subjectCardInstanceId: subject.uid, subjectOwnerPlayerId: subject.ownerPlayerId,
    subjectControllerPlayerId: subject.controllerPlayerId, previousLocation: subject.circle, currentLocation: subject.circle,
    circle: subject.circle, phase: "main", timingWindow: "ability-resolution", before: { rested: true }, after: { rested: false }, ...overrides
  });
}

test("both Ripple AUTO definitions preserve their [RC], exact source, once-per-turn, and end-of-turn power text", () => {
  for (const id of abilityIds) {
    const ability = Engine.parseCardAbilitiesCached(byId.get(id.slice(0, id.lastIndexOf(":")))).find(item => item.id === id);
    assert.equal(ability.printedText, "AUTO [RC] 1/Turn: When this unit stand by your card’s ability, this unit gets power +5000 until end of turn.");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "unit.stood", subject: "event-subject", circles: ["rear-guard"], subjectControllerRelation: "source-controller", effectCause: "card-ability", effectSourceControllerRelation: "source-controller" });
    assert.deepEqual(ability.usageRestriction, { type: "once-per-turn", scope: "ability-instance", reset: "turn" });
    assert.equal(ability.canDecline, false);
    assert.equal(ability.definition.consumeUsageOnTrigger, true);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  }
});

test("a checked Stand trigger attributes its exact stand event and resolves the correct player's exact Rear-Guard ability", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-10025", side);
    const stood = Reducer.applyGameAction(f.state, {
      actorAuthUid: actor(side), actionId: `stand-select-${side}-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "game-action", action: "triggerChoice", targetCardInstanceId: f.source.uid }
    }, seats, Engine);
    assert.equal(stood.ok, true, stood.reason);
    const event = stood.events.find(item => item.type === "unit.stood");
    assert.ok(event, "the trigger choice emits one structured stand event");
    assert.equal(event.subjectCardInstanceId, f.source.uid);
    assert.equal(event.sourceCardInstanceId, f.checked.uid, "the source is the checked Stand trigger card");
    assert.equal(event.sourceAbilityId, "cfa-5:trigger:stand");
    assert.equal(event.effectProvenance.sourceAbilityId, event.sourceAbilityId);
    const rediscovery = Reducer.discoverAutoTriggers(f.state, [event], Engine);
    assert.equal(f.state.pendingAbilities.some(item => item.ability.id === f.ability.id), true, JSON.stringify({ events: stood.events, rediscovery, pendingAbility: f.state.pendingAbility, pendingAbilities: f.state.pendingAbilities }));

    const triggerPower = Reducer.applyGameAction(f.state, {
      actorAuthUid: actor(side), actionId: `stand-trigger-power-${side}-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "game-action", action: "triggerChoice", targetCardInstanceId: f.source.uid }
    }, seats, Engine);
    assert.equal(triggerPower.ok, true, triggerPower.reason);
    assert.equal(f.state.pendingAbility?.side, side, "the prompt belongs to the card controller");
    assert.equal(f.state.pendingAbility?.instance.uid, f.source.uid);

    const wrongSeat = side === "human" ? "auth-guest" : "auth-host";
    const beforeWrongSeat = JSON.stringify(f.state);
    const forged = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: wrongSeat, actionId: `wrong-seat-${side}-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
      payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
    }, seats, Engine);
    assert.equal(forged.ok, false);
    assert.equal(JSON.stringify(f.state), beforeWrongSeat);

    const resolved = resolvePending(f);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(Number(f.source.turnPowerBoost), 15000, "the trigger and card AUTO power are both applied");
    assert.equal(f.state.pendingAbility, null);
    assert.equal(f.state.players[side].usedAbilities.length, 1);
    assert.equal(f.state.players[side].damage.some(card => card.uid === f.checked.uid), true, "the checked trigger completes to damage after its pending abilities resolve");
  }
});

test("a 1/Turn stand AUTO is locked while pending and cannot trigger again after resolution", () => {
  const f = fixture("cfa-10025", "human");
  const first = Reducer.applyGameAction(f.state, {
    actorAuthUid: actor(f.side), actionId: `first-stand-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "triggerChoice", targetCardInstanceId: f.source.uid }
  }, seats, Engine);
  assert.equal(first.ok, true, first.reason);
  const duplicateWhilePending = emittedAbilityEvent(f, f.state.players.human.vanguard, "cfa-7474:1");
  const pendingResult = Reducer.discoverAutoTriggers(f.state, [duplicateWhilePending], Engine);
  assert.equal(pendingResult.queued.length, 0);
  assert.ok(pendingResult.skipped.some(item => item.reason === "usage-restriction-pending"));

  const finishTriggerPower = Reducer.applyGameAction(f.state, {
    actorAuthUid: actor(f.side), actionId: `finish-trigger-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "triggerChoice", targetCardInstanceId: f.source.uid }
  }, seats, Engine);
  assert.equal(finishTriggerPower.ok, true, finishTriggerPower.reason);
  assert.equal(resolvePending(f, true, `resolve-once-${f.source.uid}`).ok, true);
  const secondSource = f.state.players.human.vanguard;
  const secondEvent = emittedAbilityEvent(f, secondSource, "cfa-7474:1");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [secondEvent], Engine).queued.length, 0, "a new stand event cannot reuse the ability this turn");
  f.state.turn += 1;
  const nextTurnEvent = emittedAbilityEvent(f, secondSource, "cfa-7474:1", f.source, { eventId: undefined });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [nextTurnEvent], Engine).queued.length, 1, "the restriction resets on the next turn");
});

test("a rule stand and a different card instance do not satisfy this source's trigger; circle and controller limits hold", () => {
  const f = fixture("cfa-10025", "human");
  const ruleStand = Engine.createGameEvent(f.state, {
    type: "unit.stood", actingPlayerId: f.playerId, turnPlayerId: f.playerId,
    sourceCardInstanceId: f.source.uid, sourceOwnerPlayerId: f.playerId, sourceControllerPlayerId: f.playerId,
    cardInstanceId: f.source.uid, subjectCardInstanceId: f.source.uid, subjectOwnerPlayerId: f.playerId,
    subjectControllerPlayerId: f.playerId, previousLocation: "rear-left", currentLocation: "rear-left", circle: "rear-left",
    phase: "stand", timingWindow: "stand-phase", before: { rested: true }, after: { rested: false }
  });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [ruleStand], Engine).queued.length, 0);

  const ownAbilitySource = f.state.players.human.vanguard;
  const otherCopy = instance("cfa-10025", `other-copy-${sequence}`, f.playerId, { circle: "rear-right", zone: "rear-guard", rested: false });
  f.state.players.human.rear[1] = otherCopy;
  const otherCopyResult = Reducer.discoverAutoTriggers(f.state, [emittedAbilityEvent(f, ownAbilitySource, "cfa-7474:1", otherCopy)], Engine);
  assert.equal(otherCopyResult.queued.length, 1, "the exact other copy's ability may trigger for its own stand event");
  assert.equal(otherCopyResult.queued[0].instance.uid, otherCopy.uid);
  assert.notEqual(otherCopyResult.queued[0].instance.uid, f.source.uid, "a stand of another copy cannot trigger this source instance");

  const vanguardStand = emittedAbilityEvent(f, ownAbilitySource, "cfa-7474:1", f.source, { circle: "vanguard", currentLocation: "vanguard", previousLocation: "vanguard" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [vanguardStand], Engine).queued.length, 0);

  const opponentSource = instance("cfa-7474", `opponent-effect-${sequence}`, f.opponentId, { circle: "vanguard", zone: "vanguard", faceUp: true });
  f.state.players.bot.hand.push(opponentSource);
  const opponentAbilityStand = emittedAbilityEvent(f, opponentSource, "cfa-7474:1");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [opponentAbilityStand], Engine).queued.length, 0);

  const validProvenance = emittedAbilityEvent(f, ownAbilitySource, "cfa-7474:1");
  const forged = { ...validProvenance, effectProvenance: { ...validProvenance.effectProvenance, sourceAbilityId: "forged" } };
  const rejected = Reducer.discoverAutoTriggers(f.state, [forged], Engine);
  assert.equal(rejected.queued.length, 0);
  assert.ok(rejected.skipped.some(item => item.reason === "event-provenance-source-ability-invalid" || item.reason === "event-provenance-effect-source-invalid"));
});
