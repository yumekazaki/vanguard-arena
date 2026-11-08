"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-3396", "cfa-3651", "cfa-3713", "cfa-4157", "cfa-4357", "cfa-4446", "cfa-4459", "cfa-4873"];
const OFFICIAL_NUMBERS = {"cfa-3396":"G-TD06/008EN","cfa-3651":"G-TD08/008EN","cfa-3713":"G-SD02/008EN","cfa-4157":"G-TD09/008EN","cfa-4357":"G-TD10/008EN","cfa-4446":"G-TD12/008EN","cfa-4459":"G-TD11/008EN","cfa-4873":"G-TD13/009EN"};
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const card = id => catalog.find(item => String(item.id) === id);
const instance = (id, uid, playerId, extra = {}) => {
  const definition = card(id);
  return { uid, cardId: id, cardName: definition?.name || id, type: definition?.type || "Unit", grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
};

function fixture(cardId, side = "bot", hasFaceUpGUnit = true) {
  const sourceDefinition = card(cardId);
  const ability = Engine.parseCardAbilities(sourceDefinition).find(item => item.definition?.source?.patternId === "auto-intercept-generation-break-shield-battle-v1");
  const opponentSide = side === "human" ? "bot" : "human";
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = instance(cardId, `source-${cardId}-${side}`, playerId, { zone: "guardian", circle: "guardian" });
  const vanguard = instance("cfa-3", `vanguard-${side}`, playerId, { zone: "vanguard", circle: "vanguard" });
  const attacker = instance("cfa-3", `attacker-${side}`, opponentId, { zone: "vanguard", circle: "vanguard" });
  const faceUpGUnit = { uid: `gunit-${side}`, cardId: "gunit", gDeckCard: true, faceUp: true, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const own = { playerId, vanguard, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [source], orders: [], gDeck: [], gZone: hasFaceUpGUnit ? [faceUpGUnit] : [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: attacker, rear: Array(5).fill(null), hand: [], drop: [], soul: [], damage: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const battleId = `explicit-gb-intercept-${cardId}-${side}`;
  const state = {
    matchId: "explicit-gb-intercept-match", stateVersion: 2, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    side: opponentSide, phase: 5, turn: 3, players: { [side]: own, [opponentSide]: opponent },
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: opponentSide, attackerPlayerId: opponentId, attackerZone: "vanguard", defenderSide: side, targetUid: vanguard.uid, targetZone: "vanguard", guardCards: [source], targetPower: 10000 }
  };
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: opponentId, sourceCardInstanceId: source.uid,
    sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId, previousLocation: "rear-left", currentLocation: "guardian",
    circle: "guardian", targetCardInstanceIds: [vanguard.uid], targetLocation: "vanguard", attackingUnitInstanceId: attacker.uid,
    battleId, phase: "battle", timingWindow: "guard-placement"
  });
  return { ability, source, own, state, event, side };
}

function resolve(fixtureValue, authUid) {
  return Reducer.applyAbilityDecision(fixtureValue.state, {
    actorAuthUid: authUid,
    actionId: `explicit-gb-intercept-${fixtureValue.source.uid}`,
    expectedStateVersion: fixtureValue.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: fixtureValue.source.uid, abilityId: fixtureValue.ability.id } }
  }, seats, Engine);
}

test("the explicit Generation Break wording compiles as one trusted exact intercept mechanic", () => {
  for (const id of IDS) {
    const f = fixture(id);
    assert.ok(f.ability, `${id} parsed`);
    assert.equal(f.ability.id, `${id}:0`);
    assert.equal(f.ability.gb, 1);
    assert.deepEqual(f.ability.conditions, ["cfa-3396", "cfa-3713"].includes(id) ? [{ type: "generation-break", count: 1 }] : []);
    assert.equal(f.ability.definition.effects[0].op, "modify-shield-source");
    assert.equal(f.ability.definition.effects[0].amount, 10000);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability, Engine), true);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
    assert.equal(f.ability.definition.source.officialTextVerified, true);
    assert.equal(f.ability.definition.source.officialCardNumber, OFFICIAL_NUMBERS[id]);
  }
});

test("either player's exact intercept resolves only for its controller", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 1, `${id}/${side}: ${JSON.stringify(result.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const authUid = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = resolve(f, authUid);
    assert.equal(resolved.ok, true, `${id}/${side}: ${resolved.reason}`);
    assert.equal(f.source.battleShieldBoost, 10000);
    assert.equal(f.source.battleShieldExpiryBattleId, f.state.pendingAttack.battleId);
    assert.equal(f.state.pendingAttack.targetPower, 20000);
  }
});

test("the effect is withheld without Generation Break and rejects a forged source event", () => {
  const noGb = fixture(IDS[0], "bot", false);
  assert.equal(Reducer.discoverAutoTriggers(noGb.state, [noGb.event], Engine).queued.length, 0);
  assert.equal(noGb.state.pendingAbility || null, null);

  const wrongSource = fixture(IDS[0]);
  const forged = Object.freeze({ ...wrongSource.event, sourceCardInstanceId: "unrelated-unit", subjectCardInstanceId: "unrelated-unit", cardInstanceId: "unrelated-unit", eventId: "wrong-intercept-source" });
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [forged], Engine).queued.length, 0);
  assert.equal(wrongSource.state.pendingAbility || null, null);
});


test("Bad Eater Clown stays unsupported until its full Power, Soul Charge, and call sequence is modeled", () => {
  const definition = card("cfa-3381");
  assert.match(definition.text, /this unit gets power \+10000 until end of that battle/i);
  assert.match(definition.text, /Soul Charge 1, choose up to one grade 2 or less card from your soul/i);
  const ability = Engine.parseCardAbilities(definition)[0];
  assert.equal(ability.id, "cfa-3381:0");
  assert.equal(ability.definition, null);
  assert.equal(Engine.autoAbilityReadiness(ability).ok, false);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false);
});

test("an intercept ability without verified official source text is not offered by the server", () => {
  const f = fixture("cfa-4972");
  assert.equal(f.ability.definition.source.officialTextVerified, undefined);
  assert.equal(Reducer.supportsServerAbilityEffects(f.ability), false);
  const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
  assert.equal(result.queued.length, 0);
});
