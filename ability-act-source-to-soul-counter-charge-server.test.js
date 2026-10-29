"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS = ["cfa-4259", "cfa-4787", "cfa-5089", "cfa-5383", "cfa-5652", "cfa-5741"];
const PATTERN = "act-source-to-soul-counter-charge-v1";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] });

function fixture(cardId = IDS[0], side = "human") {
  const card = catalog.find(item => String(item.id) === cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
  assert.ok(ability, `compiled ability ${cardId}`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: card.name, type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, circle: "rear-left", grade: Number(card.grade || 0) };
  const downDamage = { uid: `damage-down-${side}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: true };
  const upDamage = { uid: `damage-up-${side}`, cardId: "cfa-3", ownerPlayerId: playerId, controllerPlayerId: playerId, faceDown: false };
  const own = player(playerId), other = player(opponentId);
  own.rear[0] = source; own.damage.push(downDamage, upDamage);
  const state = { matchId: `act-source-soul-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 4, pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null, players: side === "human" ? { human: own, bot: other } : { human: other, bot: own } };
  return { card, ability, source, own, other, side, state, downDamage, upDamage };
}

function activate(f, actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, selection = {}) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid, actionId: `activate-${f.card.id}-${f.side}-${f.state.stateVersion}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection }
  }, seats, Engine);
}

test("the six exact RC source-to-Soul Counter Charge ACT definitions are trusted", () => {
  assert.equal(IDS.length, 6);
  for (const id of IDS) {
    const f = fixture(id);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(id).some(item => item.id === f.ability.id), id);
    assert.equal(f.ability.kind, "ACT", id);
    assert.equal(f.ability.printedText, "ACT [RC]: [Put this unit into your soul] Counter Charge 1.", id);
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"], id);
    assert.deepEqual(f.ability.costs, [{ type: "source-to-soul", count: 1 }], id);
    assert.deepEqual(f.ability.effects, [{ op: "counter-charge", count: 1 }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
});

test("host and joining player independently pay the exact source-to-Soul cost and Counter Charge", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) {
    const f = fixture(id, side);
    const result = activate(f, undefined, { damageUids: [f.downDamage.uid] });
    assert.equal(result.ok, true, `${id}/${side}: ${result.reason}`);
    assert.equal(f.own.rear.includes(f.source), false, `${id}/${side} source leaves RC`);
    assert.equal(f.own.soul.some(card => card.uid === f.source.uid), true, `${id}/${side} exact source enters Soul`);
    assert.equal(f.downDamage.faceDown, false, `${id}/${side} Counter Charges its selected damage`);
    assert.equal(f.upDamage.faceDown, false, `${id}/${side} does not alter face-up damage`);
    assert.equal(f.other.soul.length, 0);
    assert.equal(f.other.damage.length, 0);
  }
});

test("wrong actor, zone, phase, cost selection, or damage target is rejected without partial payment", () => {
  const cases = [
    { label: "forged actor", mutate: () => {}, actor: seats.guestAuthUid, selection: { damageUids: [] } },
    { label: "wrong zone", mutate: f => { f.own.rear[0] = null; f.own.hand.push(f.source); }, selection: { damageUids: [] } },
    { label: "wrong phase", mutate: f => { f.state.phase = 2; }, selection: { damageUids: [] } },
    { label: "forged cost selection", mutate: () => {}, selection: { costSelections: { cb: ["not-a-payment"] }, damageUids: [] } },
    { label: "invalid Counter Charge target", mutate: () => {}, selection: { damageUids: ["opponent-damage"] } },
    { label: "missing Counter Charge target", mutate: () => {}, selection: { damageUids: [] } }
  ];
  for (const invalid of cases) {
    const f = fixture(); invalid.mutate(f);
    const snapshot = JSON.stringify(f.state);
    const result = activate(f, invalid.actor, invalid.selection);
    assert.equal(result.ok, false, invalid.label);
    assert.equal(JSON.stringify(f.state), snapshot, `${invalid.label} must not partially pay`);
  }
});

test("a server-side ability with altered source cost or effect is not trusted", () => {
  const f = fixture();
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, costs: [{ type: "counter-blast", count: 1 }] }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, effects: [{ op: "draw", count: 1 }] } }), false);
});
