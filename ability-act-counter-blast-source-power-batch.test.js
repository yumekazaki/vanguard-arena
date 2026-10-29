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

function stateFor(abilityId, side) {
  const { card, ability } = abilityFor(abilityId);
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${abilityId}-${side}`, cardId: card.id, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, rested: false };
  const cost = ability.costs[0]?.count || 0;
  const damage = Array.from({ length: cost }, (_, i) => ({ uid: `damage-${side}-${i}`, cardId: `cfa-1`, ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: false }));
  const player = { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], damage, soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  if (ability.requiredLocation.includes("vanguard")) player.vanguard = source;
  else player.rear[0] = source;
  const opponent = { playerId: opponentId, vanguard: null, rear: Array(5).fill(null), hand: [], damage: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
  return { state: { matchId: `act-counter-blast-${abilityId}-${side}`, stateVersion: 1, eventSequence: 0, turn: 1, side, phase: 4, processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], players: side === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } }, source, ability, player, damage };
}

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
