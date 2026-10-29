"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-ride-phase-top-five-named-ride-bottom-deck-v1";
const FAMILY = [
  ["cfa-401", 0, "Goddess of the Half Moon, Tsukuyomi"],
  ["cfa-416", 1, "Goddess of the Full Moon, Tsukuyomi"],
  ["cfa-631", 0, "Knight of Quests, Galahad"],
  ["cfa-676", 1, "Knight of Godly Speed, Galahad"],
  ["cfa-11769", 1, "Ning Sweat16! [2]"],
  ["cfa-11771", 0, "Proud Sweat16! [2]"],
  ["cfa-11773", 0, "Eh Sweat16! [2]"],
];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => String(card.id) === String(id));
const byName = name => catalog.find(card => card.name === name);
const abilityFor = (cardId, index) => Engine.parseCardAbilitiesCached(byId(cardId)).find(ability => ability.id === `${cardId}:${index}`);

function cardInstance(definition, uid, playerId, overrides = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...overrides };
}

function fixture({ cardId = FAMILY[0][0], abilityIndex = FAMILY[0][1], side = "bot", matchingTopCard = true } = {}) {
  const sourceDefinition = byId(cardId), ability = abilityFor(cardId, abilityIndex);
  assert.ok(sourceDefinition, `catalog source ${cardId}`);
  assert.ok(ability, `compiled source ability ${cardId}:${abilityIndex}`);
  const tuple = FAMILY.find(item => item[0] === cardId), targetDefinition = byName(tuple[2]);
  assert.ok(targetDefinition, `catalog ride target ${tuple[2]}`);
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human", opponentId = opponentSide === "human" ? "player-host" : "player-guest";
  const source = cardInstance(sourceDefinition, `source-${side}-${cardId}`, ownerId);
  const oldBottom = cardInstance(byId("cfa-3"), `old-bottom-${side}`, ownerId);
  const fillers = Array.from({ length: 5 }, (_, index) => cardInstance(byId(index % 2 ? "cfa-3" : "cfa-4"), `top-${side}-${index}`, ownerId));
  const target = cardInstance(targetDefinition, `target-${side}-${cardId}`, ownerId);
  const topFive = fillers.slice();
  if (matchingTopCard) topFive[2] = target;
  const own = { playerId: ownerId, vanguard: source, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [],
    deck: [oldBottom, ...topFive], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const opponent = { playerId: opponentId,
    vanguard: cardInstance(byId("cfa-98"), `opponent-vg-${side}`, opponentId, { grade: 3 }),
    rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [],
    guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `ride-phase-search-${cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 2,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbility: null, pendingAbilities: [], pendingTrigger: null, ridePerformed: false,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const event = Engine.createGameEvent(state, { type: "phase.changed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    phase: "ride", timingWindow: "phase-start",
    before: { phase: "draw" }, after: { phase: "ride" } });
  return { state, event, ability, sourceDefinition, targetDefinition, source, target, topFive, oldBottom, own, opponent,
    side, ownerId, opponentSide, opponentId };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function decide(f, selection = {}, { actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
  actionId = `ride-phase-${f.ability.id}-${f.side}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid,
      abilityId: f.ability.id, effectUid: null, deckBottomUids: [], costSelections: { cb: [], sb: [], discard: [], reveal: [] }, ...selection } }
  }, seats, Engine);
}

test("all seven exact Ride Phase cards compile the named top-five ride and trusted effect", () => {
  const definitions = [];
  for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) {
    if (ability.definition?.source?.patternId === PATTERN) definitions.push(ability);
  }
  assert.equal(definitions.length, FAMILY.length);
  for (const [cardId, index, name] of FAMILY) {
    const ability = abilityFor(cardId, index);
    assert.ok(ability);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.kind, "AUTO");
    assert.equal(ability.trigger.eventType, "phase.changed");
    assert.equal(ability.trigger.requiredPhase, "ride");
    assert.equal(ability.trigger.turnRelation, "controller");
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.match(ability.printedText, new RegExp(`search for up to one card named "${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" from among them, ride it`));
    assert.deepEqual(ability.definition.effects, [{ op: "ride-top-five-named-card", target: "controller",
      lookCount: 5, cardName: name, bottomOrder: "chosen-rest" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("the correct controller privately chooses and rides only their exact named card from the top five", () => {
  for (const [cardId, abilityIndex] of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId, abilityIndex, side });
    const queued = discover(f);
    assert.equal(queued.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const remaining = f.topFive.filter(card => card.uid !== f.target.uid).map(card => card.uid);
    const bottomOrder = [remaining[2], remaining[0], remaining[3], remaining[1]];
    const beforeOther = JSON.stringify(f.opponent);
    const forged = decide(f, { effectUid: f.target.uid, deckBottomUids: bottomOrder },
      { actor: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, actionId: `forged-${side}` });
    assert.equal(forged.ok, false);
    const resolved = decide(f, { effectUid: f.target.uid, deckBottomUids: bottomOrder });
    assert.equal(resolved.ok, true, resolved.reason);
    assert.equal(f.own.vanguard.uid, f.target.uid);
    assert.ok(f.own.soul.some(card => card.uid === f.source.uid));
    assert.deepEqual(f.own.deck.map(card => card.uid), [...bottomOrder, f.oldBottom.uid]);
    assert.equal(f.state.ridePerformed, true);
    assert.equal(JSON.stringify(f.opponent), beforeOther, "opponent zones remain private and unchanged");
    assert.equal(f.state.pendingAbility, null);
  }
});

test("no matching card can be chosen: all five cards return in the selected order and normal ride remains available", () => {
  const f = fixture({ matchingTopCard: false });
  assert.equal(discover(f).queued.length, 1);
  const order = [f.topFive[4].uid, f.topFive[1].uid, f.topFive[3].uid, f.topFive[0].uid, f.topFive[2].uid];
  const result = decide(f, { effectUid: null, deckBottomUids: order });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.own.vanguard.uid, f.source.uid);
  assert.deepEqual(f.own.soul, []);
  assert.deepEqual(f.own.deck.map(card => card.uid), [...order, f.oldBottom.uid]);
  assert.equal(f.state.ridePerformed, false);
});

test("only the exact Vanguard's own Ride Phase start triggers once", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  assert.equal(discover(f).queued.length, 0, "same phase event cannot be reprocessed");
  for (const changes of [
    { phase: "main" },
    { timingWindow: "normal-ride" },
    { turnPlayerId: f.opponentId, actingPlayerId: f.opponentId },
  ]) {
    const other = fixture();
    const event = Engine.createGameEvent(other.state, { ...other.event, eventId: `invalid-${Object.keys(changes)[0]}`, ...changes });
    assert.equal(discover(other, event).queued.length, 0, JSON.stringify(changes));
  }
  const wrongCircle = fixture();
  wrongCircle.own.vanguard = null; wrongCircle.own.rear[0] = wrongCircle.source;
  assert.equal(discover(wrongCircle).queued.length, 0, "source must still be the Vanguard");
});

test("ride choice and deck-bottom order reject stale, duplicate, omitted, foreign, and off-top-five cards atomically", () => {
  const f = fixture();
  discover(f);
  const remaining = f.topFive.filter(card => card.uid !== f.target.uid).map(card => card.uid);
  const badSelections = [
    { effectUid: f.target.uid, deckBottomUids: remaining.slice(1) },
    { effectUid: f.target.uid, deckBottomUids: [remaining[0], remaining[0], ...remaining.slice(2)] },
    { effectUid: f.target.uid, deckBottomUids: [...remaining, f.target.uid] },
    { effectUid: f.oldBottom.uid, deckBottomUids: remaining },
    { effectUid: null, deckBottomUids: ["foreign-card", ...remaining] },
  ];
  for (const selection of badSelections) {
    const current = fixture(); discover(current);
    const before = JSON.stringify(current.state);
    const result = decide(current, selection, { actionId: `invalid-choice-${badSelections.indexOf(selection)}` });
    assert.equal(result.ok, false, JSON.stringify(selection));
    assert.equal(JSON.stringify(current.state), before, "invalid order leaves the state unchanged");
  }
});

test("phase event and resolution duplicates cannot ride or consume the normal-ride restriction twice", () => {
  const f = fixture();
  const event = f.event;
  assert.equal(discover(f, event).queued.length, 1);
  assert.equal(discover(f, event).queued.length, 0);
  const bottomOrder = f.topFive.filter(card => card.uid !== f.target.uid).map(card => card.uid);
  const actionId = "same-ride-phase-resolution";
  assert.equal(decide(f, { effectUid: f.target.uid, deckBottomUids: bottomOrder }, { actionId }).ok, true);
  const after = JSON.stringify(f.state);
  const duplicate = decide(f, { effectUid: f.target.uid, deckBottomUids: bottomOrder }, { actionId });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate-action");
  assert.equal(JSON.stringify(f.state), after);
});
