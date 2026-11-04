"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-911", "cfa-913", "cfa-916"];
const cards = new Map(loadCatalog().map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function instance(cardId, uid, playerId, extra = {}) {
  const definition = cards.get(String(cardId)) || {};
  return { uid, cardId: String(cardId), cardName: definition.name || String(cardId), grade: Number(definition.grade || 0), unitCard: true,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function blankPlayer(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
}
function fixture(cardId = IDS[0], side = "human", options = {}) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const definition = cards.get(cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `reviewed ability for ${cardId}`);
  const source = instance(cardId, `source-${cardId}-${side}`, playerId, { faceDown: options.faceDown === true });
  const target = instance(options.targetCardId || "cfa-918", `vanguard-${side}`, playerId, { grade: 3 });
  const enemy = instance("cfa-680", `enemy-${side}`, opponentId, { grade: 3 });
  const players = { human: blankPlayer("player-host"), bot: blankPlayer("player-guest") };
  players[side].damage.push(source);
  players[side].vanguard = target;
  players[side === "human" ? "bot" : "human"].vanguard = enemy;
  const state = { matchId: "act-damage-zone-self-face-down", stateVersion: 1, processedActionIds: [], turn: 4, phase: options.phase ?? 4, side, players };
  return { state, source, target, enemy, ability, side };
}
function activate(f, { targetUid = f.target.uid, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `activate-${f.source.uid}-${f.state.stateVersion}` } = {}) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: auth, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { targetUid, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("the three real BT09 abilities compile as a Damage Zone ACT with a self face-down cost", () => {
  for (const id of IDS) {
    const f = fixture(id), trusted = Engine.getReviewedAbilityDefinitionsForCard(id).find(item => item.id === f.ability.id);
    assert.ok(trusted, `${id} definition is trusted by the reducer`);
    assert.equal(f.ability.printedText, "ACT [Damage Zone]: [Turn this card from face up to face down] Choose your «Angel Feather» vanguard, and that unit gets power +3000 until end of turn.");
    assert.equal(f.ability.definition.source.patternId, "act-damage-zone-turn-self-face-down-angel-feather-vanguard-power-turn-v1");
    assert.deepEqual(f.ability.requiredLocation, ["damage"]);
    assert.deepEqual(f.ability.costs, [{ type: "source-turn-face-down", count: 1 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power-target", target: "chosen", amount: 3000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard", clan: "Angel Feather" } }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player pay with their own face-up damage source and boost only their Angel Feather Vanguard", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side), result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.source.faceDown, true);
    assert.equal(f.target.turnPowerBoost, 3000);
    assert.equal(f.target.turnPowerExpiry, f.state.players[side].playerId);
    assert.equal(f.enemy.turnPowerBoost, undefined);
    assert.ok(result.events.some(event => event.type === "characteristic.changed" && event.cardInstanceId === f.source.uid && event.reason === "ability-cost"));
    assert.ok(result.events.some(event => event.type === "characteristic.changed" && event.cardInstanceId === f.target.uid && event.reason === "power-modified"));
    Engine.expireTurnModifiers(f.state.players, f.state.players[side].playerId);
    assert.equal(f.target.turnPowerBoost, 0);
    assert.equal(f.target.turnPowerExpiry, undefined);
  }
});

test("reject face-down, wrong-zone, wrong-window, wrong-controller, and wrong-clan activations atomically", () => {
  const faceDown = fixture(IDS[0], "human", { faceDown: true }), faceDownBefore = JSON.stringify(faceDown.state);
  assert.equal(activate(faceDown).ok, false);
  assert.equal(JSON.stringify(faceDown.state), faceDownBefore);

  const wrongZone = fixture();
  wrongZone.state.players.human.damage = [];
  wrongZone.state.players.human.rear[0] = wrongZone.source;
  const wrongZoneBefore = JSON.stringify(wrongZone.state);
  assert.equal(activate(wrongZone).ok, false);
  assert.equal(JSON.stringify(wrongZone.state), wrongZoneBefore);

  const wrongPhase = fixture(IDS[0], "human", { phase: 5 }), wrongPhaseBefore = JSON.stringify(wrongPhase.state);
  assert.equal(activate(wrongPhase).ok, false);
  assert.equal(JSON.stringify(wrongPhase.state), wrongPhaseBefore);

  const wrongClan = fixture(IDS[0], "human", { targetCardId: "cfa-680" }), wrongClanBefore = JSON.stringify(wrongClan.state);
  assert.equal(activate(wrongClan).ok, false);
  assert.equal(JSON.stringify(wrongClan.state), wrongClanBefore);

  const wrongPlayer = fixture(IDS[0], "bot"), wrongPlayerBefore = JSON.stringify(wrongPlayer.state);
  assert.equal(activate(wrongPlayer, { auth: seats.hostAuthUid, actionId: "forged-host-activation" }).ok, false);
  assert.equal(JSON.stringify(wrongPlayer.state), wrongPlayerBefore);
});

test("damage-zone cost cannot be paid with a different card, and invalid targets do not partially flip the source", () => {
  const f = fixture();
  const extraDamage = instance("cfa-915", "other-damage", "player-host");
  f.state.players.human.damage.push(extraDamage);
  const before = JSON.stringify(f.state);
  assert.equal(activate(f, { targetUid: f.enemy.uid }).ok, false);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(extraDamage.faceDown, undefined);
});
