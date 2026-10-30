"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = [
  "cfa-1079:0", "cfa-1107:0", "cfa-1196:0", "cfa-1342:0", "cfa-1344:0", "cfa-1356:1", "cfa-1388:0",
  "cfa-1452:0", "cfa-1471:0", "cfa-1534:0", "cfa-1539:1", "cfa-158:0", "cfa-1592:0", "cfa-1593:1",
  "cfa-1629:0", "cfa-1658:0", "cfa-1731:1", "cfa-1821:1", "cfa-1833:1", "cfa-1956:1", "cfa-2001:1",
  "cfa-2035:0", "cfa-2047:0", "cfa-2195:0", "cfa-2249:0", "cfa-2261:0", "cfa-2326:2", "cfa-245:0",
  "cfa-2869:0", "cfa-289:0", "cfa-325:0", "cfa-33:0", "cfa-366:0", "cfa-531:1", "cfa-559:0", "cfa-608:0",
  "cfa-650:0", "cfa-687:0", "cfa-714:0", "cfa-843:0", "cfa-853:1", "cfa-993:0"
];
const catalog = loadCatalog(process.cwd());
const cards = new Map(catalog.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function abilityFor(abilityId) {
  const [cardId] = abilityId.split(":");
  const card = cards.get(cardId);
  assert.ok(card, `${cardId} exists in catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
  assert.ok(ability, `${abilityId} is parsed`);
  return { card, ability };
}

function stateFor(abilityId, side, { extraCostPayments = 0 } = {}) {
  const { card, ability } = abilityFor(abilityId);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${abilityId}-${side}`, cardId: card.id, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, rested: false };
  const cost = ability.costs[0]?.count || 0;
  const damage = Array.from({ length: cost * (1 + extraCostPayments) }, (_, i) => ({ uid: `damage-${side}-${i}`, cardId: `cfa-1`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: false }));
  const player = { playerId, vanguard: { uid: `vanguard-${abilityId}-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: playerId, controllerPlayerId: playerId }, rear: Array(5).fill(null), hand: [], damage, soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  if (ability.requiredLocation.includes("vanguard")) player.vanguard = source;
  else player.rear[0] = source;
  const opponent = { playerId: opponentId, vanguard: null, rear: Array(5).fill(null), hand: [], damage: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  return { state: { matchId: `act-counter-blast-${abilityId}-${side}`, stateVersion: 1, eventSequence: 0, turn: 1, side, phase: 4, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } }, source, ability, player, damage };
}

const singleSkillAbilityIds = IDS.filter(id => Engine.parseCardAbilitiesCached(abilityFor(id).card).length === 1);

test("all 42 exact Counter-Blast source-power ACT records preserve their text, costs, circles, and turn effects", () => {
  assert.equal(IDS.length, 42);
  for (const id of IDS) {
    const { ability } = abilityFor(id);
    const power = Number(ability.printedText.match(/power\s*\+(\d+)/i)?.[1]);
    const cost = Number(ability.printedText.match(/Counter Blast\s+(\d+)/i)?.[1]);
    assert.equal(ability.kind, "ACT", id);
    assert.equal(ability.definition.source.patternId, "act-counter-blast-source-power-turn-v1", id);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: cost }], id);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: power, duration: "turn" }], id);
    assert.equal(ability.requiredLocation.includes("vanguard"), /\[VC(?:\/RC)?\]/i.test(ability.printedText), id);
    assert.equal(ability.requiredLocation.includes("rear-guard"), /\[VC\/RC\]/i.test(ability.printedText), id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("host and joining player each pay their own exact Counter Blast for representative circle and cost variants", () => {
  for (const abilityId of ["cfa-245:0", "cfa-1534:0", "cfa-1356:1"]) for (const side of ["human", "bot"]) {
    const f = stateFor(abilityId, side);
    const result = Reducer.applyManualAbilityActivation(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `resolve-${side}-${abilityId}`,
      expectedStateVersion: f.state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId,
        selection: { costSelections: { cb: f.damage.map(card => card.uid), sb: [], discard: [], reveal: [] } } }
    }, seats, Engine);
    assert.equal(result.ok, true, `${side} ${abilityId}: ${result.reason}`);
    assert.equal(f.damage.every(card => card.faceDown === true), true, `${side} ${abilityId} paid its own damage`);
    assert.equal(f.source.turnPowerBoost, f.ability.definition.effects[0].amount, `${side} ${abilityId} receives the effect`);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].damage.length, 0);
  }
});

test("30 sole-skill ACT cards preserve their full card text, metadata, exact location, costs, and no once-per-turn limit", () => {
  assert.equal(singleSkillAbilityIds.length, 30);
  assert.equal(new Set(singleSkillAbilityIds.map(id => id.split(":")[0])).size, 30);
  for (const id of singleSkillAbilityIds) {
    const { card, ability } = abilityFor(id);
    assert.equal(Engine.parseCardAbilitiesCached(card).length, 1, `${id}: no other printed ability is unreviewed`);
    assert.ok(card.text.includes(ability.printedText), `${id}: exact ACT text is retained`);
    assert.equal(card.type, "Unit", id);
    assert.ok(Number.isFinite(Number(card.grade)), `${id}: grade metadata`);
    assert.ok(Number.isFinite(Number(card.power)), `${id}: power metadata`);
    assert.equal(ability.kind, "ACT", id);
    assert.deepEqual(ability.definition.costs, ability.costs, id);
    assert.deepEqual(ability.requiredLocation, ability.definition.requiredLocation, id);
    assert.equal(ability.once, false, `${id}: printed text has no once-per-turn restriction`);
    assert.equal(ability.usageRestriction, null, `${id}: no hidden usage restriction`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("every sole-skill ACT resolves repeatedly for its controller on either seat while costs are payable", () => {
  for (const abilityId of singleSkillAbilityIds) for (const side of ["human", "bot"]) {
    const f = stateFor(abilityId, side, { extraCostPayments: 1 });
    for (let activation = 0; activation < 2; activation++) {
      const result = Reducer.applyManualAbilityActivation(f.state, {
        actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
        actionId: `repeat-${side}-${abilityId}-${activation}`,
        expectedStateVersion: f.state.stateVersion,
        payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId,
          selection: { costSelections: { cb: f.damage.filter(card => !card.faceDown).slice(0, f.ability.costs[0].count).map(card => card.uid), sb: [], discard: [], reveal: [] } } }
      }, seats, Engine);
      assert.equal(result.ok, true, `${side} ${abilityId} activation ${activation}: ${result.reason}`);
      assert.equal(f.source.turnPowerBoost, f.ability.definition.effects[0].amount * (activation + 1), `${side} ${abilityId} stacks only its own paid activations`);
    }
    assert.equal(f.damage.every(card => card.faceDown), true, `${side} ${abilityId} pays from the controller's own Damage`);
  }
});

test("illegal ACT requests from every sole-skill card reject atomically for both seats", () => {
  for (const abilityId of singleSkillAbilityIds) for (const side of ["human", "bot"]) {
    const attempt = (f, actorAuthUid, actionId) => Reducer.applyManualAbilityActivation(f.state, {
      actorAuthUid, actionId, expectedStateVersion: f.state.stateVersion,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId,
        selection: { costSelections: { cb: f.damage.map(card => card.uid), sb: [], discard: [], reveal: [] } } }
    }, seats, Engine);

    const insufficient = stateFor(abilityId, side);
    insufficient.damage.forEach(card => { card.faceDown = true; });
    const noCostBefore = JSON.stringify(insufficient.state);
    assert.equal(attempt(insufficient, side === "human" ? seats.hostAuthUid : seats.guestAuthUid, `no-cost-${side}-${abilityId}`).ok, false, `${abilityId}: unavailable Counter Blast`);
    assert.equal(JSON.stringify(insufficient.state), noCostBefore, `${abilityId}: failed payment is atomic`);

    const forged = stateFor(abilityId, side), forgedBefore = JSON.stringify(forged.state);
    assert.equal(attempt(forged, side === "human" ? seats.guestAuthUid : seats.hostAuthUid, `forged-${side}-${abilityId}`).ok, false, `${abilityId}: opponent cannot activate it`);
    assert.equal(JSON.stringify(forged.state), forgedBefore);

    const offTurn = stateFor(abilityId, side);
    offTurn.state.side = side === "human" ? "bot" : "human";
    const offTurnBefore = JSON.stringify(offTurn.state);
    assert.equal(attempt(offTurn, side === "human" ? seats.hostAuthUid : seats.guestAuthUid, `off-turn-${side}-${abilityId}`).ok, false, `${abilityId}: wrong turn`);
    assert.equal(JSON.stringify(offTurn.state), offTurnBefore);

    const offField = stateFor(abilityId, side), controller = offField.state.players[side];
    if (controller.vanguard?.uid === offField.source.uid) controller.vanguard = { uid: `replacement-vanguard-${abilityId}`, cardId: "cfa-3", grade: 3, ownerPlayerId: controller.playerId, controllerPlayerId: controller.playerId };
    else controller.rear = controller.rear.map(card => card?.uid === offField.source.uid ? null : card);
    controller.hand.push(offField.source);
    const offFieldBefore = JSON.stringify(offField.state);
    assert.equal(attempt(offField, side === "human" ? seats.hostAuthUid : seats.guestAuthUid, `off-field-${side}-${abilityId}`).ok, false, `${abilityId}: source outside its legal circle`);
    assert.equal(JSON.stringify(offField.state), offFieldBefore);
  }
});
