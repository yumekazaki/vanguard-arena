"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const CARDS = [
  { cardId: "cfa-2661", abilityId: "cfa-2661:0", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-SD01%2F002EN", pattern: "auto-vanguard-hit-gb-counter-blast-opponent-grade-two-to-owner-deck-bottom-v1" },
  { cardId: "cfa-2668", abilityId: "cfa-2668:0", reference: "https://en.cf-vanguard.com/cardlist/?cardno=PR%2F0186EN", pattern: "auto-vanguard-hit-gb-counter-blast-grade-two-search-call-v1" }
];
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let sequence = 0;

const cardDefinition = id => CATALOG.find(card => String(card.id) === String(id));
const gradeUnit = grade => {
  const found = CATALOG.find(card => Number(card.grade) === grade && /\bunit\b/i.test(String(card.type || "")) && !card.gDeckCard && !card.trigger);
  assert.ok(found, `catalog has a normal grade-${grade} unit`);
  return String(found.id);
};
const make = (cardId, uid, ownerPlayerId, extra = {}) => {
  const definition = cardDefinition(cardId);
  assert.ok(definition, `catalog card ${cardId}`);
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type, grade: Number(definition.grade), ownerPlayerId, controllerPlayerId: ownerPlayerId, ...extra };
};
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [], guardCircle: [], usedAbilities: [] });

function fixture(side, cardId, options = {}) {
  const number = ++sequence;
  const ownSide = side;
  const otherSide = side === "human" ? "bot" : "human";
  const ownId = side === "human" ? "player-host" : "player-guest";
  const otherId = otherSide === "human" ? "player-host" : "player-guest";
  const source = make(cardId, `source-${number}`, ownId, { zone: "vanguard", circle: "vanguard" });
  const own = player(ownId), other = player(otherId);
  own.vanguard = source;
  other.vanguard = make(gradeUnit(3), `opponent-vg-${number}`, otherId, { zone: "vanguard", circle: "vanguard" });
  own.damage = options.noCost ? [] : [make(gradeUnit(0), `damage-${number}`, ownId, { faceDown: false, zone: "damage" })];
  own.gZone = options.noGenerationBreak ? [] : [make(gradeUnit(0), `g-unit-${number}`, ownId, { faceUp: true, gDeckCard: true, isGUnit: true, zone: "g-zone" })];
  if (cardId === "cfa-2668") {
    own.deck = options.dubthach
      ? [make(gradeUnit(1), `deck-g1-${number}`, ownId), make("cfa-10593", `deck-dubthach-${number}`, ownId), make(gradeUnit(3), `deck-g3-${number}`, ownId)]
      : [make(gradeUnit(1), `deck-g1-${number}`, ownId), make(gradeUnit(2), `deck-g2-${number}`, ownId), make(gradeUnit(3), `deck-g3-${number}`, ownId)];
    if (options.noOpenCircle) own.rear.fill(make(gradeUnit(0), `occupied-${number}`, ownId));
  }
  if (cardId === "cfa-2661" && options.target) {
    const targetOwner = options.stolenTarget ? ownId : otherId;
    other.rear[0] = make(gradeUnit(options.targetGrade ?? 2), `target-${number}`, targetOwner, { controllerPlayerId: otherId, zone: "rear-guard", circle: "rear-left", locked: options.locked === true });
  }
  const players = { human: side === "human" ? own : other, bot: side === "bot" ? own : other };
  const battleId = `battle-${number}`;
  const state = {
    matchId: `match-${number}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: "battle", side: ownSide,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null,
    pendingAttack: { battleId, closing: true, attackerSide: ownSide, attackerPlayerId: ownId, attackerUid: source.uid, attackerZone: "vanguard", defenderSide: otherSide,
      targetUid: other.vanguard.uid, targetZone: "vanguard", power: 30000, targetPower: 10000, critical: 1 }, players
  };
  const ability = Engine.parseCardAbilitiesCached(cardDefinition(cardId)).find(item => item.id === `${cardId}:0`);
  assert.ok(ability, `${cardId}:0 compiles from exact catalog text`);
  const event = Engine.createGameEvent(state, {
    type: "attack.hit", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    cardInstanceId: other.vanguard.uid, subjectCardInstanceId: other.vanguard.uid,
    subjectOwnerPlayerId: otherId, subjectControllerPlayerId: otherId,
    targetCardInstanceIds: [other.vanguard.uid], targetLocation: "vanguard", attackingUnitInstanceId: source.uid,
    previousLocation: "vanguard", currentLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-hit"
  });
  return { state, side, otherSide, own, other, ownId, otherId, source, ability, event, battleId, cardId };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, selection = {}, authUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, accept = true) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId: `resolve-${f.state.matchId}-${f.state.stateVersion}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...selection } }
  }, SEATS, Engine);
}

test("both official Vanguard hit abilities compile with their exact GB1, Counter-Blast, target, and effect wording", () => {
  for (const entry of CARDS) {
    const ability = Engine.parseCardAbilitiesCached(cardDefinition(entry.cardId)).find(item => item.id === entry.abilityId);
    assert.equal(ability.definition.source.patternId, entry.pattern);
    assert.equal(ability.kind, "AUTO");
    assert.deepEqual(ability.requiredLocation, ["vanguard"]);
    assert.equal(ability.trigger.eventType, "attack.hit");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, "vanguard");
    assert.deepEqual(ability.conditions, [{ type: "generation-break", count: 1 }]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.definition.source.officialReferences, [entry.reference]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("Divergence Dragon prompts only for its own Vanguard hit and resolves a legal opponent grade-2-or-less Rear-Guard to its owner's deck", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, "cfa-2661", { target: true, stolenTarget: side === "bot" });
    const discovered = discover(f);
    assert.equal(discovered.queued.length, 1, JSON.stringify(discovered.skipped));
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(discover(f).queued.length, 0, "replayed event is deduplicated");
    const target = f.other.rear[0];
    const result = resolve(f, { targetUid: target.uid, costSelections: { cb: f.own.damage.map(card => card.uid), sb: [], discard: [], reveal: [] } });
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.other.rear[0], null);
    const owner = f.state.players[target.ownerPlayerId === f.ownId ? f.side : f.otherSide];
    assert.equal(owner.deck[0].uid, target.uid, "the card returns face down to its actual owner's deck bottom");
    assert.equal(owner.deck[0].faceUp, false);
    assert.equal(owner.deck[0].controllerPlayerId, target.ownerPlayerId);
  }
});

test("Divergence Dragon rejects another source, a non-Vanguard hit, wrong grade, locked target, missing GB, and unpaid cost", () => {
  const unrelated = fixture("human", "cfa-2661", { target: true });
  const wrongSourceEvent = { ...unrelated.event, eventId: `${unrelated.event.eventId}-other`, sourceCardInstanceId: "different-vanguard", attackingUnitInstanceId: "different-vanguard" };
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [wrongSourceEvent], Engine).queued.length, 0);
  const wrongLocation = fixture("human", "cfa-2661", { target: true });
  assert.equal(Reducer.discoverAutoTriggers(wrongLocation.state, [{ ...wrongLocation.event, eventId: `${wrongLocation.event.eventId}-rear`, targetLocation: "rear-left" }], Engine).queued.length, 0);
  for (const options of [{ target: true, targetGrade: 3 }, { target: true, locked: true }, { noGenerationBreak: true, target: true }, { noCost: true, target: true }, {}]) {
    const f = fixture("human", "cfa-2661", options);
    assert.equal(discover(f).queued.length, 0, JSON.stringify(options));
  }
});

test("resolved bottom-deck movement carries exact reducer-stamped effect provenance", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, "cfa-2661", { target: true });
    assert.equal(discover(f).queued.length, 1);
    const target = f.other.rear[0];
    const result = resolve(f, { targetUid: target.uid, costSelections: { cb: f.own.damage.map(card => card.uid), sb: [], discard: [], reveal: [] } });
    assert.equal(result.ok, true, result.reason);

    const move = result.events.find(event => event.type === "card.moved" && event.subjectCardInstanceId === target.uid);
    assert.ok(move, "the resolved effect emits one movement event for the exact target instance");
    assert.equal(move.previousLocation, "rear-left");
    assert.equal(move.currentLocation, "deck");
    assert.equal(move.destinationPosition, "bottom");
    assert.equal(move.subjectControllerPlayerId, f.otherId);
    assert.equal(move.sourceCardInstanceId, f.source.uid);
    assert.equal(move.sourceControllerPlayerId, f.ownId);
    assert.deepEqual(move.effectProvenance, {
      cause: "card-effect",
      sourceCardInstanceId: f.source.uid,
      sourceControllerPlayerId: f.ownId,
      abilitySourceInstanceId: f.source.uid,
      abilitySourceControllerPlayerId: f.ownId,
      actingPlayerId: f.ownId,
      sourceAbilityId: f.ability.id,
      abilitySourceLocation: { zone: "vanguard", circle: "vanguard" }
    });

    const watcher = {
      kind: "AUTO",
      conditionStatus: "reviewed",
      costStatus: "reviewed",
      requiredLocation: ["rear-guard"],
      trigger: {
        status: "recognized-trigger",
        eventType: "card.moved",
        subject: "different-card",
        circles: [],
        sourceLocation: "rear-guard",
        destinationLocation: "deck",
        destinationPosition: "bottom",
        subjectControllerRelation: "opponent",
        effectCause: "card-effect",
        effectSourceControllerRelation: "source-controller"
      }
    };
    assert.equal(Engine.eventMatchesAbilityTrigger(watcher, "move", move, "watcher-card", "rear-right", "deck", f.ownId), true,
      "a source-controller AUTO matches only the opponent Rear-Guard moved by that player's resolving card effect");
    assert.equal(Engine.eventMatchesAbilityTrigger(watcher, "move", { ...move, destinationPosition: "top" }, "watcher-card", "rear-right", "deck", f.ownId), false,
      "top-deck movement does not satisfy bottom-deck wording");
    assert.equal(Engine.eventMatchesAbilityTrigger(watcher, "move", { ...move, effectProvenance: null }, "watcher-card", "rear-right", "deck", f.ownId), false,
      "an unprovenanced or manual movement cannot satisfy card-effect wording");
    const forged = {
      ...move,
      eventId: `${move.eventId}-forged-provenance`,
      effectProvenance: { ...move.effectProvenance, sourceCardInstanceId: "forged-effect-source" }
    };
    const forgedResult = Reducer.discoverAutoTriggers(f.state, [forged], Engine);
    assert.ok(forgedResult.skipped.some(item => item.reason === "event-provenance-effect-source-invalid"),
      "the reducer rejects a nested provenance envelope that does not match the event source");
  }
});

test("structured movement and effect-cause trigger fields reject invalid definitions", () => {
  const trigger = {
    status: "recognized-trigger",
    eventType: "card.moved",
    subject: "different-card",
    circles: []
  };
  for (const invalidTrigger of [
    { ...trigger, destinationPosition: "middle" },
    { ...trigger, effectCause: "manual" },
    { ...trigger, effectCause: "card-effect", effectSourceControllerRelation: "any-player" },
    { ...trigger, effectSourceControllerRelation: "source-controller" },
    { ...trigger, abilitySourceLocation: { zone: "vanguard", circle: "attacker" } },
    { ...trigger, abilitySourceLocation: "vanguard" }
  ]) {
    assert.throws(() => Engine.registerAbilityDefinitions([{
      id: `invalid-trigger-${++sequence}:0`,
      cardId: `invalid-trigger-${sequence}`,
      kind: "AUTO",
      printedText: "AUTO: When a card moves, this unit gets power +5000.",
      requiredLocation: ["rear-guard"],
      trigger: invalidTrigger,
      effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "turn" }]
    }]), /invalid structured trigger fields/);
  }
});

test("the joining player's Divergence Dragon prompt belongs only to the joining player", () => {
  const f = fixture("bot", "cfa-2661", { target: true });
  const discovered = discover(f);
  assert.equal(discovered.queued.length, 1, JSON.stringify(discovered.skipped));
  const before = JSON.stringify(f.state);
  const forged = resolve(f, { targetUid: f.other.rear[0].uid, costSelections: { cb: f.own.damage.map(card => card.uid) } }, SEATS.hostAuthUid);
  assert.equal(forged.ok, false);
  assert.equal(JSON.stringify(f.state), before);
  const accepted = resolve(f, { targetUid: f.other.rear[0].uid, costSelections: { cb: f.own.damage.map(card => card.uid) } }, SEATS.guestAuthUid);
  assert.equal(accepted.ok, true, accepted.reason);
});

test("Knight of Sincerity calls only a grade-2 unit to an open Rear-Guard circle and shuffles", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, "cfa-2668");
    const discovered = discover(f);
    assert.equal(discovered.queued.length, 1, JSON.stringify(discovered.skipped));
    const chosen = f.own.deck.find(card => Number(card.grade) === 2);
    const result = resolve(f, { effectUid: chosen.uid, callZone: "rear-left", costSelections: { cb: f.own.damage.map(card => card.uid), sb: [], discard: [], reveal: [] } });
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.rear[0].uid, chosen.uid);
    assert.equal(f.own.rear[0].rested, false);
    assert.equal(f.own.deck.some(card => card.uid === chosen.uid), false);
    assert.equal(f.own.deck.length, 2);
    assert.equal(f.own.damage[0].faceDown, true, "Counter-Blast is paid");
  }
});

test("Knight of Sincerity rejects wrong grades, occupied circles, forged event sources, and unpaid cost", () => {
  const wrongGrade = fixture("human", "cfa-2668");
  const discovered = discover(wrongGrade);
  assert.equal(discovered.queued.length, 1, JSON.stringify(discovered.skipped));
  const wrongCard = wrongGrade.own.deck.find(card => Number(card.grade) === 3);
  const rejectedGrade = resolve(wrongGrade, { effectUid: wrongCard.uid, callZone: "rear-left", costSelections: { cb: wrongGrade.own.damage.map(card => card.uid) } });
  assert.equal(rejectedGrade.ok, false);
  assert.equal(wrongGrade.own.deck.some(card => card.uid === wrongCard.uid), true);

  const noCost = fixture("human", "cfa-2668", { noCost: true });
  assert.equal(discover(noCost).queued.length, 0);

  const wrongSource = fixture("human", "cfa-2668");
  const wrongEvent = { ...wrongSource.event, eventId: `${wrongSource.event.eventId}-different`, sourceCardInstanceId: "other-card", attackingUnitInstanceId: "other-card" };
  assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [wrongEvent], Engine).queued.length, 0);
});

test("both optional abilities can be declined once without paying or re-prompting", () => {
  for (const entry of CARDS) {
    const f = fixture("human", entry.cardId, entry.cardId === "cfa-2661" ? { target: true } : {});
    const discovered = discover(f);
    assert.equal(discovered.queued.length, 1, JSON.stringify(discovered.skipped));
    const result = resolve(f, {}, SEATS.hostAuthUid, false);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.own.damage.some(card => !card.faceDown), true, "declining leaves Counter-Blast unpaid");
    assert.equal(discover(f).queued.length, 0, "declined event cannot prompt again");
  }
});

test("Dubthach parses only the exact Vanguard-ability deck-call AUTO with its printed Boost and power duration", () => {
  const card = cardDefinition("cfa-10593");
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-10593:0");
  assert.equal(card.name, "Knight of Harrowing Fear, Dubthach");
  assert.equal(ability.kind, "AUTO");
  assert.equal(ability.definition.source.patternId, "auto-rc-deck-placement-by-vanguard-ability-boost-power-turn-v1");
  assert.equal(ability.definition.source.officialReference, "https://en.cf-vanguard.com/cardlist/?cardno=D-BT08%2F080EN");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.deepEqual(ability.trigger.abilitySourceLocation, { zone: "vanguard", circle: "vanguard" });
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.equal(ability.trigger.sourceLocation, "deck");
  assert.equal(ability.trigger.effectCause, "card-ability");
  assert.deepEqual(ability.definition.effects, [
    { op: "grant-temporary-boost", target: "source", duration: "turn" },
    { op: "modify-power", target: "source", amount: 5000, duration: "turn" }
  ]);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("a Vanguard ability calling Dubthach from deck triggers and resolves it for the acting host or joiner", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(side, "cfa-2668", { dubthach: true });
    assert.equal(discover(f).queued.length, 1);
    const dubthach = f.own.deck.find(card => card.cardId === "cfa-10593");
    assert.ok(dubthach);
    const callResult = resolve(f, {
      effectUid: dubthach.uid,
      callZone: "rear-left",
      costSelections: { cb: f.own.damage.map(card => card.uid), sb: [], discard: [], reveal: [] }
    });
    assert.equal(callResult.ok, true, `${side}: ${callResult.reason}`);
    const placement = callResult.events.find(event => event.type === "card.placed" && event.subjectCardInstanceId === dubthach.uid);
    assert.ok(placement, "the Vanguard ability emits the exact Deck-to-Rear-Guard placement event");
    assert.equal(placement.previousLocation, "deck");
    assert.equal(placement.currentLocation, "rear-guard");
    assert.equal(placement.circle, "rear-left");
    assert.equal(placement.sourceAbilityId, "cfa-2668:0");
    assert.equal(placement.abilitySourceInstanceId, f.source.uid);
    assert.deepEqual(placement.abilitySourceLocation, { zone: "vanguard", circle: "vanguard" });
    assert.deepEqual(placement.effectProvenance.abilitySourceLocation, { zone: "vanguard", circle: "vanguard" });
    assert.equal(f.state.pendingAbility?.ability?.id, "cfa-10593:0", "Dubthach's own controller receives the AUTO prompt");
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, dubthach.uid);

    const accepted = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
      actionId: `resolve-dubthach-${side}-${f.state.stateVersion}`,
      expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: dubthach.uid, abilityId: "cfa-10593:0" } }
    }, SEATS, Engine);
    assert.equal(accepted.ok, true, `${side}: ${accepted.reason}`);
    assert.equal(dubthach.boostAbility, true);
    assert.equal(dubthach.temporaryBoostAbility, true);
    assert.equal(dubthach.turnPowerBoost, 5000);
    assert.equal(dubthach.turnPowerExpiry, f.ownId);
  }
});

test("Dubthach rejects non-Deck placement, other circles, missing ability provenance, and a non-Vanguard ability source", () => {
  const f = fixture("human", "cfa-2668", { dubthach: true });
  assert.equal(discover(f).queued.length, 1);
  const dubthach = f.own.deck.find(card => card.cardId === "cfa-10593");
  const result = resolve(f, { effectUid: dubthach.uid, callZone: "rear-left", costSelections: { cb: f.own.damage.map(card => card.uid) } });
  assert.equal(result.ok, true, result.reason);
  const placement = result.events.find(event => event.type === "card.placed" && event.subjectCardInstanceId === dubthach.uid);
  const ability = Engine.parseCardAbilitiesCached(cardDefinition("cfa-10593")).find(item => item.id === "cfa-10593:0");
  const matches = event => Engine.eventMatchesAbilityTrigger(ability, "place", event, dubthach.uid, "rear-left", "rear-left", f.ownId);
  assert.equal(matches(placement), true, "the reducer-stamped Vanguard source and Deck-to-RC move satisfy the trigger");
  assert.equal(matches({ ...placement, previousLocation: "hand" }), false);
  assert.equal(matches({ ...placement, currentLocation: "vanguard", circle: "vanguard" }), false);
  assert.equal(matches({ ...placement, effectProvenance: null, abilitySourceLocation: null }), false);
  assert.equal(matches({
    ...placement,
    abilitySourceLocation: { zone: "rear-guard", circle: "rear-right" },
    effectProvenance: { ...placement.effectProvenance, abilitySourceLocation: { zone: "rear-guard", circle: "rear-right" } }
  }), false);
  assert.equal(matches({
    ...placement,
    cardInstanceId: "different-instance",
    subjectCardInstanceId: "different-instance"
  }), false);
});
