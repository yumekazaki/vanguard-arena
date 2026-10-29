"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const definitions = require("./ability-contributions/batch-ABILITY-0003.js");
Engine.registerAbilityDefinitions(definitions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const batch = new Map(definitions.map(definition => [definition.cardId, definition]));

function fixture(cardId, side = "human", overrides = {}) {
  const definition = batch.get(cardId);
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card && definition, `${cardId} has an exact catalog card and definition`);
  const source = { uid: `source-${cardId}`, cardId, cardName: card.name, ownerPlayerId: side === "human" ? "host" : "guest", controllerPlayerId: side === "human" ? "host" : "guest", grade: card.grade, unitCard: true, power: 8000 };
  const vanguard = { uid: `vg-${side}`, cardId: "fixture-vg", cardName: overrides.vanguardName || (cardId === "cfa-10055" ? "Youthberk, Skyfall Arms" : "Fixture Vanguard"), grade: overrides.vanguardGrade ?? (cardId === "cfa-10072" ? 3 : 3), ownerPlayerId: side === "human" ? "host" : "guest", controllerPlayerId: side === "human" ? "host" : "guest", unitCard: true };
  const player = { playerId: side === "human" ? "host" : "guest", vanguard, rear: [source, null, null, null, null], damage: Array.from({ length: overrides.damageCount ?? 2 }, (_, i) => ({ uid: `damage-${side}-${i}`, cardId: "fixture-damage", faceDown: false, ownerPlayerId: side === "human" ? "host" : "guest", controllerPlayerId: side === "human" ? "host" : "guest" })), hand: [], soul: [], drop: [], deck: overrides.deck || [{ uid: "draw-top", cardId: "fixture-draw", ownerPlayerId: side === "human" ? "host" : "guest", controllerPlayerId: side === "human" ? "host" : "guest" }], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: side === "human" ? "guest" : "host", vanguard: { uid: "opp-vg", cardId: "opp-vg", grade: 3, ownerPlayerId: side === "human" ? "guest" : "host", controllerPlayerId: side === "human" ? "guest" : "host" }, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const players = side === "human" ? { human: player, bot: opponent } : { bot: player, human: opponent };
  const ability = Engine.parseCardAbilities(card).find(item => item.id === definition.id);
  assert.ok(ability?.definition, `${definition.id} is parsed with its reviewed definition`);
  return { side, source, player, ability, state: { matchId: "batch-0003", stateVersion: 1, processedActionIds: [], phase: 4, turn: 1, side, players } };
}

function activate(f, options = {}) {
  const playerId = f.side === "human" ? "host" : "guest";
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: options.actorAuthUid || (f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: options.actionId || `activate-${f.state.stateVersion}`,
    expectedStateVersion: options.expectedStateVersion ?? f.state.stateVersion,
    payload: { sourceCardInstanceId: options.sourceUid || f.source.uid, abilityId: options.abilityId || f.ability.id,
      selection: { costSelections: { cb: options.cbUids ?? f.player.damage.slice(0, 2).map(card => card.uid), sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("batch contribution exactly matches the two catalog ACTs and trusted reducer operations", () => {
  for (const definition of definitions) {
    const card = catalog.find(item => item.id === definition.cardId);
    const parsed = Engine.parseCardAbilities(card).find(item => item.id === definition.id);
    assert.equal(parsed.printedText, definition.printedText);
    assert.equal(parsed.kind, "ACT");
    assert.deepEqual(parsed.requiredLocation, ["rear-guard"]);
    assert.equal(Reducer.supportsServerAbilityEffects(parsed), true);
    assert.equal(definition.once, true);
  }
});

test("host and joining player independently activate the legal ability and receive its effect", () => {
  for (const cardId of batch.keys()) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, side), result = activate(f);
    assert.equal(result.ok, true, `${cardId} ${side}: ${result.reason}`);
    assert.equal(f.player.damage.filter(card => card.faceDown).length, 2);
    if (cardId === "cfa-10055") assert.equal(f.source.turnPowerBoost, 10000);
    else assert.equal(f.player.hand.length, 1);
  }
});

test("activation rejects wrong Vanguard conditions and unavailable costs without partial effects", () => {
  const nameFail = fixture("cfa-10055", "human", { vanguardName: "Unrelated Vanguard", damageCount: 3 });
  assert.equal(activate(nameFail).ok, false);
  assert.equal(nameFail.source.turnPowerBoost, undefined);
  assert.equal(nameFail.player.damage.every(card => !card.faceDown), true);
  const gradeFail = fixture("cfa-10072", "human", { vanguardGrade: 2, damageCount: 3 });
  assert.equal(activate(gradeFail).ok, false);
  assert.equal(gradeFail.player.hand.length, 0);
  assert.equal(gradeFail.player.damage.every(card => !card.faceDown), true);
  const costFail = fixture("cfa-10072", "human", { damageCount: 1 });
  assert.equal(activate(costFail).ok, false);
  assert.equal(costFail.player.hand.length, 0);
  assert.equal(costFail.player.damage[0].faceDown, false);
});

test("once-per-turn, field, phase, and controller restrictions are enforced by the reducer", () => {
  const used = fixture("cfa-10072", "human", { damageCount: 4, deck: [{ uid: "d1", cardId: "d1" }, { uid: "d2", cardId: "d2" }] });
  assert.equal(activate(used, { actionId: "first-use" }).ok, true);
  assert.equal(activate(used, { actionId: "second-use" }).ok, false);
  const offField = fixture("cfa-10055", "human"); offField.player.rear[0] = null;
  assert.equal(activate(offField).ok, false);
  const wrongPhase = fixture("cfa-10072", "human"); wrongPhase.state.phase = 3;
  assert.equal(activate(wrongPhase).ok, false);
  const forged = fixture("cfa-10072", "bot");
  assert.equal(activate(forged, { actorAuthUid: seats.hostAuthUid }).ok, false);
});
