"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = [
  ["cfa-4692", "Seven Stars Mutant Deity, Relish Lady", "cfa-4691"],
  ["cfa-4696", "Blessed Sparkle, Sandy", "cfa-4695"],
  ["cfa-4697", "Singularity Protector, Lozenge Magus Apex", null],
  ["cfa-4705", "Witch Queen of Iniquity, Jeliddo", "cfa-4706"],
  ["cfa-4734", "Jinx Stealth Fiend, Zashikihime", "cfa-4735"],
  ["cfa-4765", "Diabolist of Solicitation, Negronora", "cfa-4753"],
];
const PATTERN = "auto-g-guardian-named-call-discard-grade-one-draw-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CATALOG = loadCatalog();
const byId = id => CATALOG.find(card => String(card.id) === String(id));
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], usedAbilities: [] });

function fixture({ family = FAMILY[0], side = "bot", eligibleCost = true } = {}) {
  const [cardId, calledName, calledId] = family;
  const definition = byId(cardId);
  assert.ok(definition, `source card ${cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `ability ${cardId}:0 is parsed`);
  const ownId = side === "human" ? "host-player" : "guest-player";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: definition.name, type: definition.type,
    grade: Number(definition.grade), ownerPlayerId: ownId, controllerPlayerId: ownId, unitCard: true };
  const gradeOne = CATALOG.find(card => Number(card.grade) <= 1 && /unit/i.test(String(card.type)));
  const gradeTwo = CATALOG.find(card => Number(card.grade) === 2 && /unit/i.test(String(card.type)));
  const deckTopDefinition = CATALOG.find(card => /unit/i.test(String(card.type)) && card.id !== cardId);
  assert.ok(gradeOne && gradeTwo && deckTopDefinition, "catalog has legal, illegal, and draw cards");
  const discard = { uid: `discard-${side}`, cardId: eligibleCost ? gradeOne.id : gradeTwo.id, cardName: gradeOne.name,
    type: gradeOne.type, grade: Number(eligibleCost ? gradeOne.grade : gradeTwo.grade), ownerPlayerId: ownId, controllerPlayerId: ownId };
  const deckTop = { uid: `deck-top-${side}`, cardId: deckTopDefinition.id, cardName: deckTopDefinition.name,
    type: deckTopDefinition.type, grade: Number(deckTopDefinition.grade), ownerPlayerId: ownId, controllerPlayerId: ownId };
  const calledGUnit = { uid: `called-${side}-${cardId}`, cardId: calledId || "synthetic-lozenge-apex", cardName: calledName,
    type: "G Unit", grade: 4, ownerPlayerId: ownId, controllerPlayerId: ownId, circle: "guardian" };
  const own = player(ownId), opponent = player(opponentId);
  own.vanguard = { uid: `vg-${side}`, cardId: "cfa-1", cardName: "Test Vanguard", grade: 3, ownerPlayerId: ownId, controllerPlayerId: ownId, unitCard: true };
  own.drop.push(source);
  own.hand.push(discard);
  own.deck.push(deckTop);
  own.guardCircle.push(calledGUnit);
  const state = { matchId: `g-guardian-named-call-${side}-${cardId}`, stateVersion: 1, turn: 4,
    side: side === "human" ? "bot" : "human", phase: 5, eventSequence: 0, processedEventIds: [],
    processedAbilityTriggers: [], processedActionIds: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "card.discarded", actingPlayerId: ownId,
    turnPlayerId: opponentId, sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId,
    sourceControllerPlayerId: ownId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownId, subjectControllerPlayerId: ownId, previousLocation: "hand", currentLocation: "drop",
    discardReason: "g-guardian-cost", timingWindow: "g-guardian-cost", calledGUnitCardId: calledGUnit.cardId,
    calledGUnitInstanceId: calledGUnit.uid, calledGUnitCardName: calledName, calledGUnitPreviousLocation: "g-deck" });
  return { state, ability, source, discard, deckTop, calledGUnit, side, ownId, opponentId, calledName, calledId, event };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decide(f, { accept = true, actionId = `resolve-${f.side}-${f.ability.id}`, costUid = accept ? f.discard.uid : null, actor = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      costSelections: { cb: [], sb: [], discard: costUid ? [costUid] : [], reveal: [] } } } }, SEATS, Engine);
}

test("all six exact G-Guardian call-discard AUTO definitions preserve their named-call and grade-filter semantics", () => {
  for (const family of FAMILY) {
    const f = fixture({ family });
    assert.equal(f.ability.definition?.source?.patternId, PATTERN, family[0]);
    assert.equal(f.ability.kind, "AUTO", family[0]);
    assert.equal(f.ability.id, `${family[0]}:0`, family[0]);
    assert.equal(f.ability.trigger?.eventType, "card.discarded", family[0]);
    assert.equal(f.ability.trigger?.subject, "source", family[0]);
    assert.equal(f.ability.trigger?.sourceLocation, "hand", family[0]);
    assert.equal(f.ability.trigger?.destinationLocation, "drop", family[0]);
    assert.equal(f.ability.trigger?.discardReason, "g-guardian-cost", family[0]);
    assert.equal(f.ability.trigger?.calledGUnitName, family[1], family[0]);
    assert.equal(f.ability.definition?.optional, true, family[0]);
    assert.deepEqual(f.ability.costs, [{ type: "discard", count: 1, filter: { maxGrade: 1 } }], family[0]);
    assert.deepEqual(f.ability.definition?.effects, [{ op: "draw", count: 1 }], family[0]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, family[0]);
  }
});

test("host and joining player each receive and resolve only their own named G-Guardian discard prompt", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture({ family: FAMILY[side === "human" ? 0 : 4], side });
    const result = discover(f);
    assert.equal(result.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownId);
    const forged = decide(f, { actor: side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid, actionId: `forged-${side}` });
    assert.equal(forged.ok, false);
    assert.equal(f.state.players[side].hand.length, 1);
    assert.equal(f.state.players[side].deck.length, 1);
    const resolved = decide(f);
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(f.state.players[side].hand.length, 1);
    assert.equal(f.state.players[side].hand[0].uid, f.deckTop.uid);
    assert.equal(f.state.players[side].deck.length, 0);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
    assert.equal(f.state.pendingAbility, null);
    assert.equal(decide(f).reason, "duplicate-action");
  }
});

test("named-call AUTO rejects an unrelated G-unit name, source copy, discard reason, movement, or controller", () => {
  const mutateAndDiscover = changes => {
    const f = fixture({ family: FAMILY[0] });
    const event = Engine.createGameEvent(f.state, { ...f.event, ...changes, eventId: undefined });
    assert.equal(discover(f, event).queued.length, 0, JSON.stringify(changes));
  };
  mutateAndDiscover({ calledGUnitCardName: "Unrelated G Guardian", calledGUnitCardId: "other-g-unit" });
  mutateAndDiscover({ sourceCardInstanceId: "another-copy", cardInstanceId: "another-copy" });
  mutateAndDiscover({ discardReason: "stride-cost", reason: "stride-cost" });
  mutateAndDiscover({ previousLocation: "soul" });
  mutateAndDiscover({ currentLocation: "bind" });
  mutateAndDiscover({ actingPlayerId: "opponent-player", sourceControllerPlayerId: "opponent-player", subjectControllerPlayerId: "opponent-player" });
});

test("no Grade 1-or-less hand card means the AUTO does not queue an unpayable prompt", () => {
  const f = fixture({ family: FAMILY[0], eligibleCost: false });
  const beforeHand = f.state.players.bot.hand.map(card => card.uid);
  const beforeDeck = f.state.players.bot.deck.map(card => card.uid);
  assert.equal(discover(f).queued.length, 0);
  assert.equal(f.state.pendingAbility, null);
  assert.equal(f.state.pendingAbilities.length, 0);
  assert.deepEqual(f.state.players.bot.hand.map(card => card.uid), beforeHand);
  assert.deepEqual(f.state.players.bot.deck.map(card => card.uid), beforeDeck);
});

test("a forged Grade 2 cost selection is rejected without partially discarding or drawing", () => {
  const f = fixture({ family: FAMILY[0], eligibleCost: true });
  assert.equal(discover(f).queued.length, 1);
  const gradeTwo = CATALOG.find(card => Number(card.grade) === 2 && /unit/i.test(String(card.type)));
  const illegalCost = { uid: "illegal-grade-two-cost", cardId: gradeTwo.id, cardName: gradeTwo.name,
    type: gradeTwo.type, grade: Number(gradeTwo.grade), ownerPlayerId: f.ownId, controllerPlayerId: f.ownId };
  f.state.players.bot.hand.splice(0, 1, illegalCost);
  f.discard = illegalCost;
  const before = JSON.stringify(f.state.players.bot);
  const result = decide(f);
  assert.equal(result.ok, false);
  assert.ok(["discard-filter-not-met", "cost-payment-rejected"].includes(result.reason), result.reason);
  assert.equal(JSON.stringify(f.state.players.bot), before);
});

test("declining the optional G-Guardian draw cost leaves hand and deck unchanged", () => {
  const f = fixture({ family: FAMILY[2], side: "human" });
  assert.equal(discover(f).queued.length, 1);
  const beforeHand = f.state.players.human.hand.map(card => card.uid);
  const beforeDeck = f.state.players.human.deck.map(card => card.uid);
  const result = decide(f, { accept: false, actionId: "decline-named-call-draw" });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(f.state.players.human.hand.map(card => card.uid), beforeHand);
  assert.deepEqual(f.state.players.human.deck.map(card => card.uid), beforeDeck);
});

test("duplicate discard events do not queue or resolve the same named-call AUTO twice", () => {
  const f = fixture({ family: FAMILY[5] });
  assert.equal(discover(f).queued.length, 1);
  assert.equal(discover(f).queued.length, 0);
  const first = decide(f, { actionId: "one-g-guardian-draw" });
  assert.equal(first.ok, true, first.reason);
  assert.equal(f.state.players.bot.hand.filter(card => card.uid === f.deckTop.uid).length, 1);
  assert.equal(decide(f, { actionId: "one-g-guardian-draw" }).reason, "duplicate-action");
  assert.equal(f.state.players.bot.hand.filter(card => card.uid === f.deckTop.uid).length, 1);
});
