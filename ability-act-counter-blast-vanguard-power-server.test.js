"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-10064", "cfa-8876"];
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function card(id, uid, playerId, grade = 3) {
  const definition = cards.get(String(id)) || {};
  return { uid, cardId: String(id), cardName: definition.name || id, grade, unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human", counterBlast = 2) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const enemyId = side === "human" ? "player-guest" : "player-host";
  const definition = cards.get(cardId), ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId} compiles`);
  const source = card(cardId, `source-${cardId}-${side}`, ownerId, 1);
  const target = card("target-vanguard", `vanguard-${side}`, ownerId, 3);
  const damage = Array.from({ length: counterBlast }, (_, index) => ({ uid: `damage-${side}-${index}`, cardId: `damage-${index}`, faceDown: false, ownerPlayerId: ownerId, controllerPlayerId: ownerId }));
  const blank = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] });
  const players = { human: blank("player-host"), bot: blank("player-guest") };
  players[side].rear[0] = source; players[side].vanguard = target; players[side].damage = damage;
  players[side === "human" ? "bot" : "human"].vanguard = card("enemy-vanguard", `enemy-${side}`, enemyId, 3);
  return { state: { matchId: "act-counter-blast-vanguard-power", stateVersion: 1, processedActionIds: [], turn: 2, phase: 4, side, players }, source, target, damage, ability, side };
}
function activate(f, targetUid = f.target.uid, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `activate-${f.source.uid}-${f.state.stateVersion}`) {
  return Reducer.applyManualAbilityActivation(f.state, { actorAuthUid: auth, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { targetUid, costSelections: { cb: f.damage.filter(card => !card.faceDown).slice(0, 1).map(card => card.uid), sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("both exact real ACT cards compile as once-per-turn Rear-Guard Vanguard-target power abilities", () => {
  for (const id of IDS) {
    const f = fixture(id), trusted = Engine.getReviewedAbilityDefinitionsForCard(id).find(item => item.id === f.ability.id);
    assert.ok(trusted, `${id} is trusted`);
    assert.equal(f.ability.printedText, "ACT [RC] 1/Turn: COST [Counter Blast 1], choose one of your vanguards, and it gets power +5000 until end of turn.");
    assert.equal(f.ability.definition.source.patternId, "act-rc-counter-blast-choose-vanguard-power-turn-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power-target", target: "chosen", amount: 5000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player independently pay Counter Blast and power only their chosen Vanguard", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side), result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.damage[0].faceDown, true);
    assert.equal(f.target.turnPowerBoost, 5000);
    assert.equal(f.target.turnPowerExpiry, f.state.players[side].playerId);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].vanguard.turnPowerBoost, undefined);
  }
});

test("once-per-turn, insufficient Counter Blast, illegal target, and forged player reject atomically", () => {
  const repeated = fixture();
  assert.equal(activate(repeated).ok, true);
  repeated.state.stateVersion++;
  const afterFirst = JSON.stringify(repeated.state);
  assert.equal(activate(repeated, repeated.target.uid, seats.hostAuthUid, "repeat").ok, false);
  assert.equal(JSON.stringify(repeated.state), afterFirst);

  const insufficient = fixture(IDS[0], "human", 0), beforeInsufficient = JSON.stringify(insufficient.state);
  assert.equal(activate(insufficient).ok, false);
  assert.equal(JSON.stringify(insufficient.state), beforeInsufficient);

  const invalidTarget = fixture(), beforeTarget = JSON.stringify(invalidTarget.state);
  assert.equal(activate(invalidTarget, invalidTarget.state.players.bot.vanguard.uid).ok, false);
  assert.equal(JSON.stringify(invalidTarget.state), beforeTarget);

  const forged = fixture(IDS[0], "bot"), beforeForged = JSON.stringify(forged.state);
  assert.equal(activate(forged, forged.target.uid, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(forged.state), beforeForged);
});
