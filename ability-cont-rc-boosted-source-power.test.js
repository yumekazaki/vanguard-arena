"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-rc-boosted-source-power-battle-v1";
const IDS = new Map([["cfa-5764:0", "cfa-5764"], ["cfa-6902:1", "cfa-6902"], ["cfa-7942:1", "cfa-7942"]]);
const cards = loadCatalog();

function attackWithBoost({ side = "bot", useSource = true, useOtherBooster = false } = {}) {
  const owner = side === "human" ? "player-host" : "player-guest", other = side === "human" ? "player-guest" : "player-host", otherSide = side === "human" ? "bot" : "human";
  const source = { uid: `source-${side}`, cardId: "cfa-5764", cardName: "Flame of Hope, Aermo", type: "Normal Unit", unitCard: true, grade: 1, power: 7000, critical: 1, drive: 1, boostAbility: true, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
  const unrelatedBooster = { uid: `unrelated-booster-${side}`, cardId: "booster", type: "Normal Unit", unitCard: true, grade: 1, power: 7000, critical: 1, drive: 1, boostAbility: true, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
  const vanguard = { uid: `vanguard-${side}`, cardId: "vg", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, drive: 1, rested: false, locked: false, ownerPlayerId: owner, controllerPlayerId: owner };
  const defender = { uid: `defender-${side}`, cardId: "defender", type: "Normal Unit", unitCard: true, grade: 3, power: 13000, critical: 1, rested: false, locked: false, ownerPlayerId: other, controllerPlayerId: other };
  const player = (playerId, vanguard, rear = []) => ({ playerId, vanguard, rear, deck: [], hand: [], damage: [], drop: [], soul: [], bind: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: [] });
  const rear = [source, null, null, useOtherBooster ? unrelatedBooster : useSource ? source : null, null];
  if (useOtherBooster || useSource) rear[0] = null;
  else rear[0] = source;
  const state = { matchId: `cont-boost-${side}-${useSource}-${useOtherBooster}`, stateVersion: 0, processedActionIds: [], turn: 4, side, phase: 5, firstTurnComplete: true, pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, authoritySeats: { hostSide: "human", guestSide: "bot" }, players: {} };
  state.players[side] = player(owner, vanguard, rear);
  state.players[otherSide] = player(other, defender);
  const booster = useOtherBooster ? unrelatedBooster : useSource ? source : null;
  const result = Reducer.applyGameAction(state, { actorAuthUid: side === "human" ? "auth-host" : "auth-guest", actionId: state.matchId, expectedStateVersion: 0, payload: { type: "game-action", action: "attack", attackerCardInstanceId: vanguard.uid, targetCardInstanceId: defender.uid, boosterCardInstanceId: booster?.uid || null } }, { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" }, Engine);
  return { state: result.state || state, result, source };
}

test("three exact Rear-Guard CONT definitions preserve the boost-battle condition and printed bonus", () => {
  const audit = auditCatalog(cards), found = new Map();
  for (const card of cards) for (const ability of Engine.parseCardAbilitiesCached(card)) if (ability.definition?.source?.patternId === PATTERN) found.set(ability.id, ability);
  assert.equal(audit.patterns[PATTERN], IDS.size);
  assert.deepEqual([...found.keys()].sort(), [...IDS.keys()].sort());
  assert.deepEqual(audit.invalidCompiled, []);
  for (const [id, cardId] of IDS) {
    const ability = found.get(id);
    assert.equal(ability.cardId, cardId);
    assert.equal(ability.kind, "CONT");
    assert.equal(ability.trigger, null);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.definition.effects, [{ op: "continuous-power", target: "source", amount: 3000, duration: "continuous", condition: { op: "source-boosted-this-battle" } }]);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition => definition.id === id && definition.source.patternId === PATTERN));
  }
});

test("only the exact source booster gains +3000 for the battle, as calculated by authority for either seat", () => {
  for (const side of ["human", "bot"]) {
    const boosted = attackWithBoost({ side });
    assert.equal(boosted.result.ok, true, boosted.result.reason);
    assert.equal(boosted.state.pendingAttack.power, 23000, `${side}: 13000 Vanguard + 10000 boosted unit`);
    assert.equal(boosted.state.pendingAbility, null, "a CONT does not create a skill prompt");
    const unrelated = attackWithBoost({ side, useSource: false, useOtherBooster: true });
    assert.equal(unrelated.result.ok, true, unrelated.result.reason);
    assert.equal(unrelated.state.pendingAttack.power, 20000, `${side}: unrelated booster gets no CONT bonus`);
    const noBoost = attackWithBoost({ side, useSource: false });
    assert.equal(noBoost.result.ok, true, noBoost.result.reason);
    assert.equal(noBoost.state.pendingAttack.power, 13000, `${side}: no booster, no boost-battle CONT`);
  }
});

test("the CONT power is inactive outside the exact source's boost battle and outside RC", () => {
  const ability = foundAbility("cfa-5764:0");
  const amount = context => Engine.evaluateContinuousEffects([ability], { sourceInstanceId: "booster", targetInstanceId: "booster", ...context }).power;
  assert.equal(amount({ location: "rear-guard", sourceWasBooster: true }), 3000);
  assert.equal(amount({ location: "rear-guard", sourceWasBooster: false }), 0);
  assert.equal(amount({ location: "vanguard", sourceWasBooster: true }), 0);
});

function foundAbility(id) {
  const card = cards.find(item => item.id === id.slice(0, id.lastIndexOf(":")));
  return Engine.parseCardAbilitiesCached(card).find(ability => ability.id === id);
}
