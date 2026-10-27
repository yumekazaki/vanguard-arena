"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-main-phase-source-to-soul-search-named-call-v1";
const FAMILY = new Map([
  ["cfa-5823", "Highspeed, Brakki"], ["cfa-5824", "Wonder Boy"], ["cfa-5825", "Juggernaut Maximum"],
  ["cfa-9457", "Agile Fullback"], ["cfa-9969", "Reckless Express"], ["cfa-9999", "Sky Diver"]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function unit(uid, cardId, cardName, owner, extra = {}) {
  return { uid, cardId, cardName, name: cardName, type: "Normal Unit", unitCard: true, grade: 2, ownerPlayerId: owner, controllerPlayerId: owner, rested: false, locked: false, ...extra };
}
function fixture(cardId, side = "bot", namedTarget = true) {
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentSide = side === "human" ? "bot" : "human", opponentId = side === "human" ? "player-guest" : "player-host";
  const card = catalog.find(item => String(item.id) === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === cardId + ":1");
  assert.ok(ability?.definition, cardId + ":1 compiles");
  const source = unit("source-" + side, cardId, card.name, ownerId, { grade: 1, zone: "rear-guard", circle: "rear-left" });
  const vanguard = unit("vg-" + side, "vg-" + side, "Vanguard", ownerId, { grade: 3, zone: "vanguard", circle: "vanguard" });
  const enemyVanguard = unit("enemy-vg-" + side, "enemy-vg-" + side, "Enemy Vanguard", opponentId, { grade: 3, zone: "vanguard", circle: "vanguard" });
  const target = unit("named-" + side, "named-" + cardId, FAMILY.get(cardId), ownerId, { grade: 2, zone: "deck" });
  const unrelated = unit("unrelated-" + side, "unrelated-" + cardId, "Unrelated unit", ownerId, { zone: "deck" });
  const makePlayer = (playerId, vg, rear, deck = []) => ({ playerId, vanguard: vg, rear, deck, hand: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], removed: [], triggerZone: [], crests: [], extra: [] });
  const state = { matchId: "named-call-" + cardId + "-" + side, stateVersion: 7, turn: 3, side, phase: 3, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], ridePerformed: true, firstTurnComplete: true, players: {} };
  state.players[side] = makePlayer(ownerId, vanguard, [source, null, null, null, null], namedTarget ? [target, unrelated] : [unrelated]);
  state.players[opponentSide] = makePlayer(opponentId, enemyVanguard, []);
  return { state, source, target, unrelated, ability, side, ownerId, opponentSide };
}
function advanceToMain(f) {
  return Reducer.applyGameAction(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: "main-phase-" + f.state.matchId + "-" + f.state.stateVersion, expectedStateVersion: f.state.stateVersion, payload: { action: "advance" } }, seats, Engine);
}

test("six exact source-to-Soul main-phase AUTO abilities preserve name, cost, circle, and phase trigger", () => {
  const found = new Map();
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  assert.deepEqual([...found.keys()].sort(), [...FAMILY.keys()].map(id => id + ":1").sort());
  assert.equal(auditCatalog(catalog).patterns[PATTERN], FAMILY.size);
  for (const [cardId, name] of FAMILY) {
    const ability = found.get(cardId + ":1");
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "phase.changed", subject: "controller", circles: [], requiredPhase: "main", turnRelation: "controller" });
    assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.definition.effects, [{ op: "search-deck-named-call-to-rearguard", target: "controller", cardName: name, maximum: 1, destination: "rear-guard", position: "stand", opensSourceCircle: true }]);
  }
});

test("the controller pays source-to-Soul, calls only the named unit to the opened circle, and shuffles on both seats", () => {
  for (const [cardId] of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side);
    const phase = advanceToMain(f);
    assert.equal(phase.ok, true, cardId + "/" + side + ": " + phase.reason);
    assert.equal(phase.events.some(event => event.type === "phase.changed" && event.phase === "main"), true);
    assert.equal(f.state.pendingAbility?.side, side, cardId + "/" + side + " receives its own prompt");
    assert.equal(f.state.pendingAbility?.instance?.uid, f.source.uid);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: "accept-named-call-" + f.state.matchId, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, effectUid: f.target.uid, callZone: "rear-left" } }
    }, seats, Engine);
    assert.equal(result.ok, true, cardId + "/" + side + ": " + result.reason);
    assert.equal(result.state.players[side].soul.some(card => card.uid === f.source.uid), true, "exact source paid the cost");
    assert.equal(result.state.players[side].rear[0].uid, f.target.uid, "vacated source circle receives the selected named unit");
    assert.equal(f.target.rested, false, "called unit enters standing");
    assert.equal(result.state.players[side].deck.some(card => card.uid === f.target.uid), false);
    assert.equal(result.events.filter(event => event.type === "card.placed" && event.cardInstanceId === f.target.uid).length, 1);
    assert.equal(result.state.players[side].rear[1], null, "unrelated rear circles stay unchanged");
  }
});

test("wrong phase, wrong source circle, opponent-only trigger, wrong named target, and forged response are rejected", () => {
  const wrongPhase = fixture("cfa-5823", "bot");
  wrongPhase.state.phase = 2;
  const rideToStride = advanceToMain(wrongPhase);
  assert.equal(rideToStride.ok, true);
  assert.equal(wrongPhase.state.pendingAbility, null, "entering Stride is not the Main Phase trigger");
  const main = advanceToMain(wrongPhase);
  assert.equal(main.ok, true);
  assert.equal(wrongPhase.state.pendingAbility?.side, "bot", "trigger appears only after entering Main");

  const wrongCircle = fixture("cfa-5823", "bot");
  wrongCircle.state.players.bot.rear[0] = null;
  wrongCircle.state.players.bot.vanguard = wrongCircle.source;
  wrongCircle.source.zone = "vanguard";
  wrongCircle.source.circle = "vanguard";
  wrongCircle.state.players.bot.vanguard = wrongCircle.source;
  wrongCircle.state.players.bot.rear[0] = null;
  assert.equal(advanceToMain(wrongCircle).state.pendingAbility, null, "a Vanguard source does not meet [RC]");

  const wrongTarget = fixture("cfa-5823", "bot", false);
  advanceToMain(wrongTarget);
  const before = JSON.stringify(wrongTarget.state);
  const invalid = Reducer.applyAbilityDecision(wrongTarget.state, { actorAuthUid: seats.guestAuthUid, actionId: "invalid-named-call", expectedStateVersion: wrongTarget.state.stateVersion, payload: { accept: true, selection: { instanceUid: wrongTarget.source.uid, abilityId: wrongTarget.ability.id, effectUid: wrongTarget.unrelated.uid, callZone: "rear-left" } } }, seats, Engine);
  assert.equal(invalid.ok, false, "an unrelated deck unit cannot satisfy the exact target name");
  assert.equal(JSON.stringify(wrongTarget.state), before, "invalid target cannot partially pay the source-to-Soul cost");

  const forged = fixture("cfa-5823", "bot");
  advanceToMain(forged);
  const unchanged = JSON.stringify(forged.state);
  assert.equal(Reducer.applyAbilityDecision(forged.state, { actorAuthUid: seats.hostAuthUid, actionId: "forged-named-call", expectedStateVersion: forged.state.stateVersion, payload: { accept: true, selection: { instanceUid: forged.source.uid, abilityId: forged.ability.id, effectUid: forged.target.uid, callZone: "rear-left" } } }, seats, Engine).ok, false);
  assert.equal(JSON.stringify(forged.state), unchanged);
});

test("optional search can be skipped after paying the source cost and still returns the source to Soul", () => {
  const f = fixture("cfa-5824", "human", false);
  advanceToMain(f);
  const result = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "skip-named-search", expectedStateVersion: f.state.stateVersion, payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } } }, seats, Engine);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.state.players.human.soul.some(card => card.uid === f.source.uid), true);
  assert.equal(result.state.players.human.deck.length, 1, "no unrelated card is called");
  assert.equal(result.state.players.human.rear.filter(Boolean).length, 0);
});
