"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const IDS = ["cfa-134", "cfa-368", "cfa-510", "cfa-651"];
const TEXT = "ACT [VC/RC]: [Rest this unit & Choose a card from your hand, and discard it] Draw a card.";
const PATTERN = "act-rest-discard-draw-v1";
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

function card(uid, cardId, playerId) {
  const row = catalog.find(item => String(item.id) === String(cardId));
  return { uid, cardId, cardName: row?.name || "Test Card", type: row?.type || "Unit", grade: Number(row?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId };
}
function fixture(cardId = IDS[0], side = "human", zone = "rear-guard", { withDiscard = true, withDraw = true } = {}) {
  const row = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `compiled exact ability ${cardId}:0`);
  const n = ++sequence, owner = side === "human" ? "host-player" : "guest-player", opponent = side === "human" ? "guest-player" : "host-player";
  const source = card(`source-${n}`, cardId, owner), discarded = card(`discard-${n}`, "cfa-3", owner), drawn = card(`draw-${n}`, "cfa-4", owner);
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") }, own = players[side], other = players[side === "human" ? "bot" : "human"];
  if (zone === "vanguard") own.vanguard = source;
  else { source.circle = "rear-left"; own.rear[0] = source; }
  if (withDiscard) own.hand.push(discarded);
  if (withDraw) own.deck.push(drawn);
  const state = { matchId: "act-rest-discard-draw", stateVersion: 1, eventSequence: 0, processedActionIds: [], turn: 2, side, phase: 4,
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null, players };
  return { row, ability, source, discarded, drawn, own, other, side, state };
}
function activate(f, auth = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, discardIds = [f.discarded.uid]) {
  return Reducer.applyManualAbilityActivation(f.state, { actorAuthUid: auth, actionId: `act-rest-draw-${f.source.uid}-${f.state.stateVersion}`,
    expectedStateVersion: f.state.stateVersion, payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid,
      abilityId: f.ability.id, selection: { costSelections: { discard: discardIds } } } }, seats, Engine);
}

test("four exact ACT records match their own catalog text, index, costs, and draw effect", () => {
  for (const id of IDS) {
    const row = catalog.find(item => item.id === id), ability = Engine.parseCardAbilitiesCached(row).find(item => item.id === `${id}:0`);
    assert.ok(row, id);
    assert.equal(ability.printedText, TEXT, id);
    assert.equal(ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"], id);
    assert.deepEqual(ability.costs, [{ type: "discard", count: 1 }, { type: "rest-source", count: 1 }], id);
    assert.deepEqual(ability.effects, [{ op: "draw", count: 1 }], id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, id);
  }
});

test("the controller can activate the ability on either seat from VC or RC, paying the exact costs", () => {
  for (const id of IDS) for (const side of ["human", "bot"]) for (const zone of ["vanguard", "rear-guard"]) {
    const f = fixture(id, side, zone);
    const result = activate(f);
    assert.equal(result.ok, true, `${id}/${side}/${zone}: ${result.reason}`);
    assert.equal(f.source.rested, true);
    assert.deepEqual(f.own.hand, [f.drawn]);
    assert.deepEqual(f.own.drop, [f.discarded]);
    assert.equal(f.other.hand.length, 0);
    assert.deepEqual(result.events.map(event => event.type), ["card.discarded", "card.drawn"]);
    const replay = Reducer.applyManualAbilityActivation(f.state, { actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `act-rest-draw-${f.source.uid}-1`, expectedStateVersion: 1,
      payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: f.ability.id,
        selection: { costSelections: { discard: [f.discarded.uid] } } } }, seats, Engine);
    assert.equal(replay.reason, "duplicate-action");
    assert.equal(f.own.hand.filter(item => item.uid === f.drawn.uid).length, 1);
  }
});

test("opponent, wrong timing, rested source, unpayable/missing costs, and tampered definitions are rejected", () => {
  const proxy = fixture(IDS[0], "bot");
  assert.equal(activate(proxy, seats.hostAuthUid).reason, "not-actor-turn");

  const wrongPhase = fixture(); wrongPhase.state.phase = 2;
  assert.equal(activate(wrongPhase).reason, "wrong-timing-window");

  const rested = fixture(); rested.source.rested = true;
  assert.match(activate(rested).reason, /unpayable-cost/);
  assert.deepEqual(rested.own.hand, [rested.discarded]);
  assert.equal(rested.own.drop.length, 0);

  const noDiscard = fixture(IDS[0], "human", "rear-guard", { withDiscard: false });
  assert.match(activate(noDiscard).reason, /unpayable-cost/);
  assert.notEqual(noDiscard.source.rested, true);

  const badSelection = fixture();
  assert.equal(activate(badSelection, undefined, ["not-in-hand"]).reason, "cost-payment-rejected");
  assert.notEqual(badSelection.source.rested, true);
  assert.deepEqual(badSelection.own.hand, [badSelection.discarded]);

  const f = fixture();
  for (const mutate of [
    ability => { ability.definition.printedText = ability.definition.printedText.replace("Draw a card", "Draw two cards"); },
    ability => { ability.requiredLocation = ["guardian"]; },
    ability => { ability.costs[1].type = "counter-blast"; },
    ability => { ability.costs[0].count = 2; },
    ability => { ability.definition.effects[0].count = 2; },
    ability => { ability.definition.id = "cfa-368:0"; }
  ]) {
    const forged = structuredClone(f.ability);
    mutate(forged);
    assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
  }
});
