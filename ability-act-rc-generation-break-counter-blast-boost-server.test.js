"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "act-rc-generation-break-counter-blast-grant-boost-v1";
const EXPECTED = Object.freeze(["cfa-3951:2", "cfa-5092:1"]);
const TEXT = 'ACT [RC] Generation Break 1: [Counter Blast 1] This unit gets "Boost" until end of turn.';
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = new Map(loadCatalog().map(card => [String(card.id), card]));
let sequence = 0;

function cardInstance(cardId, uid, playerId, extra = {}) {
  const card = catalog.get(String(cardId));
  return { uid, cardId: String(cardId), cardName: card?.name || "Unit", type: card?.type || "Unit", unitCard: true,
    grade: Number(card?.grade || 0), power: Number(card?.power || 0), critical: Number(card?.critical || 1),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(abilityId = EXPECTED[0], side = "human", { generationBreak = true, counterBlast = true } = {}) {
  const n = ++sequence, cardId = abilityId.slice(0, abilityId.lastIndexOf(":"));
  const owner = side === "human" ? "host-player" : "guest-player";
  const otherSide = side === "human" ? "bot" : "human";
  const opponent = otherSide === "human" ? "host-player" : "guest-player";
  const source = cardInstance(cardId, `source-${n}`, owner);
  const damageCard = cardInstance("cfa-1", `damage-${n}`, owner, { faceDown: false });
  const gUnit = cardInstance("cfa-1", `g-unit-${n}`, owner, { gDeckCard: true, isGUnit: true, faceUp: true });
  const player = playerId => ({ playerId, vanguard: cardInstance("cfa-3", `vg-${n}-${playerId}`, playerId), rear: Array(5).fill(null),
    hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], crests: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  const own = players[side], opponentPlayer = players[otherSide];
  own.rear[2] = source;
  if (counterBlast) own.damage.push(damageCard);
  if (generationBreak) own.gZone.push(gUnit);
  const state = { matchId: `act-gb-boost-${n}`, stateVersion: 1, eventSequence: 0, processedActionIds: [], processedAbilityTriggers: [],
    processedEventIds: [], turn: 2, side, phase: 4, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    pendingAttack: null, players };
  const ability = Engine.parseCardAbilitiesCached(catalog.get(cardId)).find(item => item.id === abilityId);
  assert.ok(ability, `${abilityId} parses`);
  return { ability, cardId, damageCard, own, opponentPlayer, owner, players, side, source, state };
}

function activate(f, authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `activate-${f.source.uid}`, ability = f.ability) {
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: ability.id,
      selection: { costSelections: { cb: f.own.damage.filter(card => !card.faceDown).slice(0, 1).map(card => card.uid), sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("both exact catalog abilities compile as explicit manual ACTs with GB1 and Counter-Blast 1", () => {
  const found = [];
  for (const cardId of ["cfa-3951", "cfa-5092"]) {
    const card = catalog.get(cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === PATTERN);
    assert.ok(ability, `${cardId} has its exact definition`);
    found.push(ability.id);
    assert.equal(ability.printedText, TEXT);
    assert.equal(ability.kind, "ACT");
    assert.equal(ability.trigger, null, "an ACT does not become an automatic prompt");
    assert.equal(ability.gb, 1);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(ability.definition.activationWindow, "main");
    assert.equal(ability.definition.optional, false);
    assert.equal(ability.definition.source.officialTextVerified, false, "catalog text is not represented as official-source verified");
    assert.deepEqual(ability.definition.effects, [{ op: "grant-temporary-boost", target: "source", duration: "turn" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
  assert.deepEqual(found.sort(), [...EXPECTED].sort());
});

test("host and joining player each pay their own Counter-Blast and receive turn-limited Boost", () => {
  for (const abilityId of EXPECTED) for (const side of ["human", "bot"]) {
    const f = fixture(abilityId, side);
    const result = activate(f);
    assert.equal(result.ok, true, `${abilityId}/${side}: ${result.reason}`);
    assert.equal(f.damageCard.faceDown, true, "the activating player paid Counter-Blast 1");
    assert.equal(f.source.boostAbility, true, "the exact source received Boost");
    assert.equal(f.source.temporaryBoostAbility, true);
    assert.equal(f.source.temporaryBoostAbilityExpiry, f.owner);
    assert.equal(f.opponentPlayer.damage.length, 0, "the opponent paid no cost");
    Engine.expireTurnModifiers(f.players, f.owner);
    assert.equal(f.source.temporaryBoostAbility, undefined, "granted Boost expires at the end of that player's turn");
    assert.equal(f.source.boostAbility, undefined);
  }
});

test("Generation Break, Counter-Blast availability, phase, source circle, and controller are enforced before payment", () => {
  for (const options of [{ generationBreak: false }, { counterBlast: false }]) {
    const f = fixture(EXPECTED[0], "human", options), before = structuredClone(f.own);
    assert.equal(activate(f).ok, false);
    assert.deepEqual(f.own, before, "rejected activation does not partially alter costs or field");
  }
  const timing = fixture();
  timing.state.phase = 5;
  assert.equal(activate(timing).reason, "wrong-timing-window");
  assert.equal(timing.damageCard.faceDown, false);
  const wrongCircle = fixture();
  wrongCircle.own.rear[2] = null;
  wrongCircle.own.vanguard = wrongCircle.source;
  assert.equal(activate(wrongCircle).reason, "activation-wrong-zone");
  assert.equal(wrongCircle.damageCard.faceDown, false);
  const wrongActor = fixture(EXPECTED[1], "bot");
  assert.equal(activate(wrongActor, seats.hostAuthUid).ok, false);
  assert.equal(wrongActor.damageCard.faceDown, false);
});

test("the server rejects a tampered effect program for the exact card IDs", () => {
  const f = fixture();
  const forged = structuredClone(f.ability);
  forged.definition.effects[0].duration = "battle";
  assert.equal(Reducer.supportsServerAbilityEffects(forged), false);
});
