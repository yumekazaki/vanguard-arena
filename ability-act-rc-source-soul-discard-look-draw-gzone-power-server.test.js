"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const IDS_A = ["cfa-3801", "cfa-4074", "cfa-4097", "cfa-4229", "cfa-4314", "cfa-4540"];
const IDS_B = ["cfa-3870", "cfa-4060"];
const IDS = [...IDS_A, ...IDS_B];
const EXACT_ACT_ABILITY_IDS = ["cfa-3801:1", "cfa-3870:1", "cfa-4060:1", "cfa-4074:1", "cfa-4097:1", "cfa-4229:1", "cfa-4314:1", "cfa-4540:1"];
const PATTERN = "act-rc-source-soul-normal-discard-look-draw-gzone-power-v1";
const TEXT_A = "ACT [RC]: [Put this unit into your soul & Choose a normal unit from your hand, and discard it] Look at the top card of your deck, put it on the top or bottom of your deck, and draw a card. If the number of face up cards in your G zone is one or more, choose one of your units, and it gets power +5000 until end of turn.";
const TEXT_B = "ACT [RC]: [Put this unit into your soul & Choose a normal unit from your hand, and discard it] Look at the top card of your deck, put it on the top or bottom of your deck, draw a card, and if the number of face up cards in your G zone is one or more, choose one of your units, and it gets power +5000 until end of turn.";
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] };
}
function card(uid, cardId, ownerPlayerId, extra = {}) {
  return { uid, cardId, ownerPlayerId, controllerPlayerId: ownerPlayerId, type: "Unit", unitCard: true, ...extra };
}
function fixture(cardId = IDS_A[0], side = "human", { faceUpGZone = true } = {}) {
  const definition = catalog.find(item => item.id === cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:1`);
  assert.ok(ability?.definition, `compiled ${cardId}:1`);
  const owner = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = card(`source-${cardId}-${side}`, cardId, owner, { circle: "rear-left", grade: Number(definition.grade || 0) });
  const discard = card(`discard-${cardId}-${side}`, "cfa-1", owner);
  const deckBottom = card(`bottom-${cardId}-${side}`, "cfa-2", owner);
  const deckTop = card(`top-${cardId}-${side}`, "cfa-1", owner);
  const vanguard = card(`vg-${side}`, "cfa-1", owner, { grade: 3, power: 10000, circle: "vanguard" });
  const opponentVanguard = card(`opponent-vg-${side}`, "cfa-1", opponentId, { grade: 3, power: 10000, circle: "vanguard" });
  const own = player(owner), other = player(opponentId);
  own.vanguard = vanguard;
  other.vanguard = opponentVanguard;
  own.rear[0] = source;
  own.hand.push(discard);
  own.deck.push(deckBottom, deckTop);
  if (faceUpGZone) own.gZone.push(card(`gzone-faceup-${side}`, "cfa-1", owner, { faceUp: true, gDeckCard: true }));
  const state = { matchId: `act-look-draw-${cardId}-${side}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [], turn: 2, side, phase: 4,
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null,
    players: side === "human" ? { human: own, bot: other } : { human: other, bot: own } };
  return { card: definition, ability, source, discard, deckBottom, deckTop, vanguard, opponentVanguard, own, other, side, state };
}
function activate(f, { actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, discardUid = f.discard.uid, effectUid = f.own.deck.at(-1)?.uid || null, deckDestination = "top", targetUid = f.own.vanguard.uid } = {}) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid, actionId: `activate-${f.card.id}-${f.side}-${f.state.stateVersion}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: f.ability.id,
      selection: { effectUid, deckDestination, targetUid, costSelections: { cb: [], sb: [], discard: [discardUid], reveal: [] } } }
  }, seats, Engine);
}

test("all eight cards retain their exact two printed ACT variants and share one reviewed definition", () => {
  assert.equal(IDS.length, 8);
  assert.deepEqual(IDS.map(id => `${id}:1`).sort(), EXACT_ACT_ABILITY_IDS.slice().sort());
  for (const id of IDS) {
    const f = fixture(id);
    assert.ok(EXACT_ACT_ABILITY_IDS.includes(f.ability.id), `exact ACT ability ID ${f.ability.id}`);
    assert.equal(f.ability.kind, "ACT", id);
    assert.equal(f.ability.printedText, IDS_A.includes(id) ? TEXT_A : TEXT_B, id);
    assert.equal(f.ability.definition.source.patternId, PATTERN, id);
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"], id);
    assert.deepEqual(f.ability.costs, [
      { type: "source-to-soul", count: 1 },
      { type: "discard", count: 1, filter: { cardType: "normal-unit" } }
    ], id);
    assert.deepEqual(f.ability.definition.effects, [
      { op: "reorder-deck-card", target: "chosen", destination: "player-choice", requireTopCard: true, allowEmptyDeck: true },
      { op: "draw", count: 1 },
      { op: "modify-power-target", target: "chosen", amount: 5000, duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit" }, condition: { op: "controller-face-up-g-zone-count-at-least", count: 1 } }
    ], id);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, id);
  }
  for (const [id, officialReference] of Object.entries({
    "cfa-4074": "https://en.cf-vanguard.com/cardlist/?cardno=G-BT08%2F093EN",
    "cfa-4097": "https://en.cf-vanguard.com/cardlist/?cardno=G-BT08%2F071EN"
  })) {
    const ability = fixture(id).ability;
    assert.equal(ability.printedText, TEXT_A, `${id}: official printed-text variant`);
    assert.equal(ability.definition.source.dataset, "Bushiroad official card list", `${id}: text provenance`);
    assert.equal(ability.definition.source.officialReference, officialReference, `${id}: direct official card reference`);
  }
});

test("host and joiner each pay their own costs, choose deck order, draw, and apply the gated power", () => {
  for (const cardId of IDS) for (const side of ["human", "bot"]) for (const deckDestination of ["top", "bottom"]) {
    const f = fixture(cardId, side), result = activate(f, { deckDestination });
    assert.equal(result.ok, true, `${cardId}/${side}/${deckDestination}: ${result.reason}`);
    assert.equal(f.own.rear.includes(f.source), false);
    assert.equal(f.own.soul.some(item => item.uid === f.source.uid), true);
    assert.equal(f.own.hand.some(item => item.uid === f.discard.uid), false);
    assert.equal(f.other.hand.length, 0);
    assert.equal(f.other.soul.length, 0);
    assert.equal(f.own.hand.some(item => item.uid === (deckDestination === "top" ? f.deckTop.uid : f.deckBottom.uid)), true);
    assert.equal(f.vanguard.turnPowerBoost, 5000);
    assert.equal(f.vanguard.turnPowerExpiry, f.own.playerId);
    assert.equal(f.opponentVanguard.turnPowerBoost || 0, 0);
  }
});

test("without a face-up G-zone card, target choice is skipped while source cost, reorder, and draw still resolve", () => {
  const f = fixture(IDS_A[0], "bot", { faceUpGZone: false });
  const result = activate(f, { targetUid: undefined });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.vanguard.turnPowerBoost || 0, 0);
  assert.equal(f.own.soul.some(item => item.uid === f.source.uid), true);
  assert.equal(f.own.hand.some(item => item.uid === f.deckTop.uid), true);
});

test("trigger cards cannot pay the normal-unit discard cost and invalid targets are rejected atomically", () => {
  const triggerCost = fixture();
  const trigger = card("trigger-cost", "cfa-3", triggerCost.own.playerId);
  triggerCost.own.hand.push(trigger);
  const beforeCost = JSON.stringify(triggerCost.state);
  assert.equal(activate(triggerCost, { discardUid: trigger.uid }).ok, false);
  assert.equal(JSON.stringify(triggerCost.state), beforeCost);

  const opponentTarget = fixture();
  const beforeTarget = JSON.stringify(opponentTarget.state);
  assert.equal(activate(opponentTarget, { targetUid: opponentTarget.opponentVanguard.uid }).ok, false);
  assert.equal(JSON.stringify(opponentTarget.state), beforeTarget);
});

test("a stale or non-top deck selection, wrong phase, or forged host action is rejected without payment", () => {
  const staleTop = fixture();
  const beforeTop = JSON.stringify(staleTop.state);
  assert.equal(activate(staleTop, { effectUid: staleTop.deckBottom.uid }).ok, false);
  assert.equal(JSON.stringify(staleTop.state), beforeTop);

  const wrongPhase = fixture(); wrongPhase.state.phase = 2;
  assert.equal(activate(wrongPhase).ok, false);
  const joinerTurn = fixture(IDS_B[0], "bot");
  const beforeForged = JSON.stringify(joinerTurn.state);
  assert.equal(activate(joinerTurn, { actorAuthUid: seats.hostAuthUid }).ok, false);
  assert.equal(JSON.stringify(joinerTurn.state), beforeForged);
});

test("server rejects modified text, cost filters, and conditional effects", () => {
  const f = fixture();
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, printedText: TEXT_B } }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, costs: [{ type: "discard", count: 1 }] }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, effects: [{ op: "draw", count: 8 }] } }), false);
});
