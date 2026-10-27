"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1123", "Gold Paladin"], ["cfa-1234", "Bermuda Triangle"], ["cfa-1301", "Angel Feather"],
  ["cfa-1409", "Shadow Paladin"], ["cfa-1429", "Pale Moon"], ["cfa-1509", "Link Joker"],
  ["cfa-1521", "Dark Irregulars"], ["cfa-1604", "Nova Grappler"], ["cfa-1642", "Great Nature"],
  ["cfa-1669", "Kagero"], ["cfa-1758", "Neo Nectar"]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = "cfa-1123", side = "human", { clan = FAMILY.get(cardId), damageClan = clan } = {}) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-own-attack-clan-counter-blast-power-battle-v1");
  assert.ok(ability, `${cardId} ability is compiled`);
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "attacker", cardId, cardName: card.name, clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, power: 10000 };
  const vanguard = { uid: "vg", cardId: "vg", cardName: "Test Vanguard", clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: "opp-vg", cardId: "opp-vg", cardName: "Opponent Vanguard", clan: "Kagero", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const damage = [{ uid: "damage-1", cardId: "damage-1", clan: damageClan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, faceDown: false }];
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : opponentVanguard, rear: side === "human" ? [source, null, null, null, null] : Array(5).fill(null), damage: side === "human" ? damage : [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" ? [source, null, null, null, null] : Array(5).fill(null), damage: side === "bot" ? damage : [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  if (clan !== FAMILY.get(cardId)) players[side].vanguard.clan = clan;
  const state = { matchId: "clan-attack-test", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId: "battle-1", attackerSide: side, attackerUid: source.uid, attackerZone: "rear-left", defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceControllerPlayerId: ownerId, subjectCardInstanceId: source.uid,
    subjectControllerPlayerId: ownerId, attackingCardInstanceIds: [source.uid], currentLocation: "rear-left",
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: "battle-1", phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, ability, source, ownerId, side, damage };
}

test("the exact 11-card family compiles with its printed clan, attack, circle, cost, and battle duration", () => {
  for (const [cardId, clan] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.kind, "AUTO", cardId);
    assert.equal(f.ability.trigger.eventType, "unit.attacked", cardId);
    assert.equal(f.ability.trigger.subject, "source", cardId);
    assert.deepEqual(f.ability.requiredLocation, ["vanguard", "rear-guard"], cardId);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }], cardId);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 1, filter: { clan } }], cardId);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: 4000, duration: "battle" }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
  }
});

test("the source controller alone receives the trigger and pays their clan-matching Damage", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-1123", side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `clan-attack-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: ["damage-1"] } } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.damage[0].faceDown, true);
    assert.equal(f.state.pendingAttack.power, 14000);
  }
});

test("wrong-clan Damage cannot satisfy the cost and does not produce a prompt", () => {
  const f = fixture("cfa-1123", "bot", { damageClan: "Bermuda Triangle" });
  const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(result.queued.length, 0);
  assert.equal(f.state.pendingAbility || null, null);
});

test("the exact source must attack and its controller must still have the printed-clan Vanguard", () => {
  const wrongSource = fixture("cfa-1123", "bot");
  wrongSource.event = Engine.createGameEvent(wrongSource.state, {
    type: "unit.attacked", actingPlayerId: wrongSource.ownerId, turnPlayerId: wrongSource.ownerId,
    sourceCardInstanceId: "other-attacker", subjectCardInstanceId: "other-attacker", subjectControllerPlayerId: wrongSource.ownerId,
    attackingCardInstanceIds: ["other-attacker"], currentLocation: "rear-right", targetLocation: "vanguard", battleId: "other-battle"
  });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [wrongSource.event], Engine).queued.length, 0);

  const wrongClanVanguard = fixture("cfa-1123", "bot", { clan: "Bermuda Triangle" });
  assert.equal(Reducer.discoverAutoTriggers(wrongClanVanguard.state, [wrongClanVanguard.event], Engine).queued.length, 0);
});

test("wrong-clan payment selections are rejected without paying or applying the effect", () => {
  const f = fixture("cfa-1123", "bot", { damageClan: "Bermuda Triangle" });
  const player = { playerId: f.ownerId, damage: f.damage, soul: [], hand: [], drop: [], rear: [f.source] };
  const paid = Engine.payAbilityCosts(f.ability, { player, source: f.source, sourceZone: "rear-left", cardDefinitionForInstance: card => ({ clan: card.clan }) }, { cb: ["damage-1"] });
  assert.equal(paid.ok, false);
  assert.equal(paid.reason, "counter-blast-filter-not-met");
  assert.equal(f.damage[0].faceDown, false);
});
