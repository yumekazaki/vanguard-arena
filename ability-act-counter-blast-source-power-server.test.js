"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-130", ["Oasis Girl", 1, 1000]], ["cfa-518", ["Iron Tail Dragon", 1, 1000]],
  ["cfa-658", ["Soul Guiding Elf", 1, 1000]], ["cfa-903", ["Stealth Beast, Night Panther", 1, 1000]],
  ["cfa-1025", ["Parabolic Moose", 2, 4000]]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = "cfa-130", side = "human", circle = "rear-guard", cbCount = 2) {
  const [name, cb, power] = FAMILY.get(cardId), card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "act-counter-blast-source-power-during-turn-v1");
  assert.ok(ability, `${cardId} compiles`);
  const playerId = side === "human" ? "player-host" : "player-guest", otherPlayerId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "act-source", cardId, cardName: name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 9000 };
  const opponentVanguard = { uid: "opponent-vanguard", cardId: "opponent-vanguard-definition", ownerPlayerId: otherPlayerId, controllerPlayerId: otherPlayerId, unitCard: true, grade: 3 };
  const damage = Array.from({ length: cbCount }, (_, i) => ({ uid: `damage-${i + 1}`, cardId: `damage-${i + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: false }));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? (circle === "vanguard" ? source : { uid: "human-vg", cardId: "human-vg", ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true }) : opponentVanguard,
      rear: side === "human" && circle !== "vanguard" ? [source, null, null, null, null] : Array(5).fill(null), damage: side === "human" ? damage : [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? (circle === "vanguard" ? source : { uid: "bot-vg", cardId: "bot-vg", ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true }) : opponentVanguard,
      rear: side === "bot" && circle !== "vanguard" ? [source, null, null, null, null] : Array(5).fill(null), damage: side === "bot" ? damage : [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  return { state: { matchId: "act-cb-power-test", stateVersion: 4, processedActionIds: [], side, phase: 4, turn: 3, players }, ability, source, side, damage, cb, power };
}
function activate(f, options = {}) {
  const selections = options.damageUids || f.damage.filter(card => !card.faceDown).slice(0, f.cb).map(card => card.uid);
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: options.actorAuthUid || (f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: options.actionId || `activate-${f.state.stateVersion}`,
    expectedStateVersion: options.expectedStateVersion ?? f.state.stateVersion,
    payload: { sourceCardInstanceId: options.sourceUid || f.source.uid, abilityId: options.abilityId || f.ability.id,
      selection: { costSelections: { cb: selections, sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("all five trusted definitions exactly preserve printed costs, power, source, circles, and no once limit", () => {
  for (const [cardId, [name, cb, power]] of FAMILY) {
    const f = fixture(cardId);
    const definition = Engine.getReviewedAbilityDefinitionsForCard(cardId).find(item => item.id === f.ability.id);
    assert.ok(definition, `${cardId} is trusted`);
    assert.equal(definition.printedText, `ACT [VC/RC]: [Counter Blast ${cb}] During this turn, this unit gets power +${power}.`);
    assert.equal(definition.source.patternId, "act-counter-blast-source-power-during-turn-v1");
    assert.deepEqual(definition.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(definition.costs, [{ type: "counter-blast", count: cb }]);
    assert.deepEqual(definition.effects, [{ op: "modify-power", target: "source", amount: power, duration: "turn" }]);
    assert.equal(definition.once, undefined, `${name} has no once-per-turn restriction`);
    assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition }), true);
  }
});

test("host and joining player can activate each exact ability from VC or RC and pay the printed Counter Blast", () => {
  for (const cardId of FAMILY.keys()) for (const side of ["human", "bot"]) for (const circle of ["vanguard", "rear-guard"]) {
    const f = fixture(cardId, side, circle);
    const result = activate(f);
    assert.equal(result.ok, true, `${cardId} ${side} ${circle}: ${result.reason}`);
    assert.equal(f.state.players[side].damage.filter(item => item.faceDown).length, f.cb);
    assert.equal(f.state.players[side].damage.filter(item => !item.faceDown).length, 2 - f.cb);
    assert.equal(f.source.turnPowerBoost, f.power);
    assert.equal(f.source.turnPowerExpiry, f.state.players[side].playerId);
  }
});

test("activation rejects insufficient or forged Counter Blast selections without partial changes", () => {
  const insufficient = fixture("cfa-1025", "human", "rear-guard", 1);
  const rejected = activate(insufficient);
  assert.equal(rejected.ok, false);
  assert.equal(insufficient.damage[0].faceDown, false);
  assert.equal(insufficient.source.turnPowerBoost, undefined);
  const forged = fixture("cfa-130");
  const invalid = activate(forged, { damageUids: ["forged-damage"] });
  assert.equal(invalid.ok, false);
  assert.equal(forged.damage[0].faceDown, false);
  assert.equal(forged.source.turnPowerBoost, undefined);
});

test("manual timing, controller, field-source and player-seat restrictions reject illegal activation", () => {
  const wrongTurn = fixture(); wrongTurn.state.side = "bot";
  assert.equal(activate(wrongTurn).ok, false);
  const wrongPhase = fixture(); wrongPhase.state.phase = 3;
  assert.equal(activate(wrongPhase).ok, false);
  const offField = fixture(); offField.state.players.human.rear[0] = null;
  assert.equal(activate(offField).ok, false);
  const opponentSource = fixture(); opponentSource.state.players.bot.rear[0] = { ...opponentSource.source, ownerPlayerId: "player-guest", controllerPlayerId: "player-guest" }; opponentSource.state.players.human.rear[0] = null;
  assert.equal(activate(opponentSource).ok, false);
  const guest = fixture("cfa-130", "bot");
  assert.equal(activate(guest, { actorAuthUid: seats.hostAuthUid }).ok, false);
});

test("ACT is not once per turn: the same source can pay and activate twice in one turn", () => {
  const f = fixture("cfa-130", "human", "rear-guard", 1);
  assert.equal(activate(f, { actionId: "first-use" }).ok, true);
  f.damage.push({ uid: "damage-extra", cardId: "damage-extra", ownerPlayerId: "player-host", controllerPlayerId: "player-host", faceDown: false });
  assert.equal(activate(f, { actionId: "second-use" }).ok, true);
  assert.equal(f.damage.every(card => card.faceDown), true);
  assert.equal(f.source.turnPowerBoost, 2000);
});

test("tampered ability ID, card, text, cost, location, once restriction, or effect fails closed", () => {
  const f = fixture();
  const cases = [
    { id: "cfa-130:9" }, { cardId: "cfa-999" },
    { printedText: f.ability.definition.printedText.replace("Counter Blast 1", "Counter Blast 2") },
    { costs: [{ type: "counter-blast", count: 2 }] }, { requiredLocation: ["vanguard"] },
    { once: true }, { usageRestriction: { type: "once-per-turn", scope: "ability-instance", reset: "turn" } },
    { effects: [{ op: "modify-power", target: "source", amount: 2000, duration: "turn" }] },
    { effects: [{ op: "modify-power", target: "source", amount: 1000, duration: "battle" }] }
  ];
  for (const change of cases) {
    const ability = { ...f.ability, ...change, definition: { ...f.ability.definition, ...change } };
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, JSON.stringify(change));
  }
});
