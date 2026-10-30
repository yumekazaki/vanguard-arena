"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1017:0", ["Pale Moon", "vanguard", 6000]], ["cfa-1017:1", ["Pale Moon", "rear-guard", 3000]],
  ["cfa-1066:0", ["Gold Paladin", "vanguard", 6000]], ["cfa-1066:1", ["Gold Paladin", "rear-guard", 3000]],
  ["cfa-1668:0", ["Narukami", "vanguard", 6000]], ["cfa-1668:1", ["Narukami", "rear-guard", 3000]],
  ["cfa-1725:0", ["Kagero", "vanguard", 6000]], ["cfa-1725:1", ["Kagero", "rear-guard", 3000]],
  ["cfa-1958:0", ["Bermuda Triangle", "vanguard", 5000, "both"]]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(id = "cfa-1017:1", side = "human") {
  const [clan, circle, power, both] = FAMILY.get(id);
  const cardId = id.split(":")[0], card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability?.definition, `${id} has a compiled definition`);
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "attacker", cardId, cardName: card.name, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, power: 10000 };
  const vanguard = { uid: "vg", cardId: "vg", cardName: "Vanguard", clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: "opp-vg", cardId: "opp-vg", cardName: "Opponent Vanguard", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const discardable = { uid: "clan-hand", cardId: "clan-hand", clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true };
  const wrongClan = { uid: "wrong-clan", cardId: "wrong-clan", clan: "Genesis", ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true };
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" && circle === "vanguard" ? source : side === "human" ? vanguard : opponentVanguard, rear: side === "human" && circle !== "vanguard" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: side === "human" ? [discardable, wrongClan] : [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" && circle === "vanguard" ? source : side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" && circle !== "vanguard" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: side === "bot" ? [discardable, wrongClan] : [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "clan-discard-attack", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId: "attack-1", attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId, attackerZone: circle === "vanguard" ? "vanguard" : "rear-left", defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], currentLocation: circle === "vanguard" ? "vanguard" : "rear-left", previousLocation: circle === "vanguard" ? "vanguard" : "rear-left",
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: "attack-1", phase: "battle", timingWindow: "attack-declared" });
  return { id, card, ability, cardId, clan, power, both, side, ownerId, source, discardable, wrongClan, state, event };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, uid = "clan-hand") {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `clan-discard-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.id, costSelections: { discard: [uid] } } } }, seats, Engine);
}

test("nine exact catalog abilities preserve source circle, clan discard, optionality, power, and duration", () => {
  for (const [id, [clan, circle, power, both]] of FAMILY) {
    const f = fixture(id);
    assert.equal(f.ability.trigger.eventType, "unit.attacked", id);
    assert.equal(f.ability.trigger.subject, "source", id);
    assert.deepEqual(f.ability.requiredLocation, both ? ["vanguard", "rear-guard"] : [circle], id);
    assert.deepEqual(f.ability.costs, [{ type: "discard", count: 1, filter: { clan } }], id);
    assert.equal(f.ability.definition.optional, true, id);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: power, duration: "battle" }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
});

test("host and joining player independently pay their own matching clan card and gain battle power", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-1017:1", side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(resolve(f).ok, true);
    assert.equal(f.state.players[side].hand.length, 1);
    assert.equal(f.state.players[side].hand[0].uid, "wrong-clan");
    assert.equal(f.state.players[side].drop[0].uid, "clan-hand");
    assert.equal(f.state.pendingAttack.power, 13000);
  }
});

test("VC and RC amounts and clan filters match each card's exact wording", () => {
  for (const id of FAMILY.keys()) {
    const f = fixture(id);
    assert.equal(discover(f).queued.length, 1, id);
    assert.equal(resolve(f).ok, true, id);
    assert.equal(f.state.pendingAttack.power, 10000 + f.power, id);
    assert.equal(f.state.players[f.side].drop[0].uid, "clan-hand", id);
  }
});

test("another attack, wrong circle, missing cost card, or invalid discard cannot resolve the skill", () => {
  const unrelated = fixture("cfa-1017:1");
  unrelated.event = { ...unrelated.event, sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other", attackingCardInstanceIds: ["other"] };
  assert.equal(discover(unrelated).queued.length, 0);
  const wrongCircle = fixture("cfa-1017:0");
  wrongCircle.state.players.human.vanguard = { ...wrongCircle.source, uid: "different-vg" };
  assert.equal(discover(wrongCircle).queued.length, 0);
  const insufficient = fixture();
  insufficient.state.players.human.hand = [insufficient.wrongClan];
  assert.equal(discover(insufficient).queued.length, 0);
  const invalid = fixture();
  assert.equal(discover(invalid).queued.length, 1);
  const before = { hand: invalid.state.players.human.hand.map(card => card.uid), drop: invalid.state.players.human.drop.length, power: invalid.state.pendingAttack.power, version: invalid.state.stateVersion };
  assert.equal(resolve(invalid, "wrong-clan").ok, false);
  assert.deepEqual(invalid.state.players.human.hand.map(card => card.uid), before.hand);
  assert.equal(invalid.state.players.human.drop.length, before.drop);
  assert.equal(invalid.state.pendingAttack.power, before.power);
  assert.equal(invalid.state.stateVersion, before.version);
});

test("declining is free, and a modified card definition is rejected by authoritative validation", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  const decline = Reducer.applyAbilityDecision(f.state, { actorAuthUid: seats.hostAuthUid, actionId: "decline-clan-discard", expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: false, selection: { instanceUid: f.source.uid, abilityId: f.id } } }, seats, Engine);
  assert.equal(decline.ok, true);
  assert.equal(f.state.players.human.hand.length, 2);
  assert.equal(f.state.pendingAttack.power, 10000);
  const tampered = { ...f.ability, definition: { ...f.ability.definition, printedText: f.ability.definition.printedText.replace("Pale Moon", "Genesis") } };
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
});
