"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const CATALOG = loadCatalog();
const BY_ID = new Map(CATALOG.map(card => [String(card.id), card]));
const FAMILY = [
  ["cfa-273", "Ruler Chameleon"],
  ["cfa-284", "Pencil Squire, Hammsuke"],
  ["cfa-301", "Pencil Knight, Hammsuke"],
  ["cfa-309", "Pencil Hero, Hammsuke"]
];
const GREAT_NATURE_VANGUARD = CATALOG.find(card => card.clan === "Great Nature" && Number(card.grade) === 3);
const OTHER_VANGUARD = CATALOG.find(card => card.clan !== "Great Nature" && Number(card.grade) === 3);
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };

function inst(cardId, uid, playerId, overrides = {}) {
  const definition = BY_ID.get(String(cardId)) || {};
  return {
    uid, cardId: String(cardId), ownerPlayerId: playerId, controllerPlayerId: playerId,
    cardName: definition.name, name: definition.name, grade: definition.grade, clan: definition.clan,
    clans: definition.clans || (definition.clan ? [definition.clan] : []), faceDown: false, ...overrides
  };
}

function fixture({ cardId = FAMILY[0][0], side = "bot", eventType = "card.retired", vanguard = GREAT_NATURE_VANGUARD } = {}) {
  assert.ok(GREAT_NATURE_VANGUARD, "catalog has a Great Nature grade 3 Vanguard for the condition test");
  const [expectedId, targetName] = FAMILY.find(([id]) => id === cardId);
  assert.equal(expectedId, cardId);
  const sourceDefinition = BY_ID.get(cardId);
  const source = inst(cardId, `source-${side}-${cardId}`, side === "human" ? "host-player" : "guest-player", { type: sourceDefinition.type });
  const playerId = source.ownerPlayerId;
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const own = {
    playerId, vanguard: inst(vanguard.id, `vg-${side}`, playerId), rear: Array(5).fill(null),
    hand: [], deck: [], drop: [source], soul: [], damage: [inst("cfa-273", `cb-${side}`, playerId)],
    bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  own.deck.push(inst(cardId, `search-${side}-${cardId}`, playerId, { cardName: targetName, name: targetName }));
  own.deck.push(inst("cfa-303", `unrelated-${side}-${cardId}`, playerId));
  const other = {
    playerId: opponentId, vanguard: inst(OTHER_VANGUARD.id, `other-vg-${side}`, opponentId), rear: Array(5).fill(null),
    hand: [], deck: [], drop: [], soul: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const state = {
    matchId: `end-phase-name-search-${cardId}-${side}`, stateVersion: 1, turn: 7, side, phase: 6,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, players: side === "human" ? { human: own, bot: other } : { human: other, bot: own }
  };
  const event = Engine.createGameEvent(state, {
    eventId: `leave-rc-${cardId}-${side}`, type: eventType,
    actingPlayerId: opponentId, turnPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: "rear-left", currentLocation: "drop", circle: "rear-left",
    phase: "end", timingWindow: "end-phase-cleanup", reason: "ability-effect"
  });
  const ability = Engine.parseCardAbilities(sourceDefinition).find(item => item.id === `${cardId}:0`);
  return { state, event, ability, source, own, other, playerId, side, target: own.deck[0], unrelated: own.deck[1], damage: own.damage[0], targetName };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function resolve(f, selection = {}, accept = true, actorAuthUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId: `resolve-${f.state.matchId}-${actorAuthUid}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...selection } }
  }, SEATS, Engine);
}

test("all four exact End Phase RC-drop searches are supported and resolve for both players", () => {
  for (const [cardId, targetName] of FAMILY) {
    for (const side of ["human", "bot"]) {
      for (const eventType of ["card.moved", "card.retired"]) {
        const f = fixture({ cardId, side, eventType });
        assert.equal(Engine.parseCardAbilities(BY_ID.get(cardId)).length, 1, "all printed skill blocks on this card are included in the reviewed batch");
        assert.equal(f.ability.definition.source.patternId, "auto-end-phase-rc-drop-counter-blast-same-name-search-v1");
        assert.equal(f.ability.printedText, BY_ID.get(cardId).text.split(/\n\s*\n/).slice(1).join("\n\n"));
        assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
        assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition => definition.id === `${cardId}:0`));
        assert.equal(Engine.eventMatchesAbilityTrigger(f.ability, eventType === "card.retired" ? "retire" : "move", f.event, f.source.uid, f.event.previousLocation, f.event.currentLocation, f.playerId), true, JSON.stringify({ trigger: f.ability.trigger, event: f.event }));
        const queued = discover(f);
        assert.equal(queued.queued.length, 1, `${side}/${eventType}/${cardId}: ${JSON.stringify(queued.skipped)}`);
        assert.equal(f.state.pendingAbility.side, side, "the unit controller receives the decision");
        assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, "the pending ability retains its exact source instance");
        assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.playerId);
        assert.equal(discover(f).queued.length, 0, "the same event cannot queue the same AUTO twice");
        const opponentAuthUid = side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid;
        assert.equal(resolve(f, {}, true, opponentAuthUid).ok, false, "the other seat cannot resolve this controller's prompt");
        assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, "rejected remote decision leaves the controller's prompt intact");
        assert.equal(resolve(f, { effectUid: f.target.uid, costSelections: { cb: [f.damage.uid] } }).ok, true);
        assert.equal(f.damage.faceDown, true, "Counter Blast is paid by the ability controller");
        assert.ok(f.own.hand.some(card => card.uid === f.target.uid), "the exact-name card is added to its controller's hand");
        assert.ok(!f.own.deck.some(card => card.uid === f.target.uid));
        assert.ok(f.own.deck.some(card => card.uid === f.unrelated.uid));
        assert.equal(f.other.hand.length, 0, "the other seat never receives the searched card");
        assert.equal(targetName, f.ability.definition.effects[0].cardName);
      }
    }
  }
});

test("the AUTO is not offered outside its exact move, circle, End Phase, controller turn, or clan condition", () => {
  const cases = [
    ["another card moved", f => ({ ...f.event, cardInstanceId: "different", subjectCardInstanceId: "different" })],
    ["not from RC", f => ({ ...f.event, previousLocation: "vanguard" })],
    ["not to Drop", f => ({ ...f.event, currentLocation: "hand" })],
    ["not End Phase", f => ({ ...f.event, phase: "main" })],
    ["opponent's turn", f => ({ ...f.event, turnPlayerId: f.other.playerId })],
    ["wrong source owner", f => ({ ...f.event, subjectOwnerPlayerId: f.other.playerId })],
    ["wrong source controller", f => ({ ...f.event, subjectControllerPlayerId: f.other.playerId })],
    ["unseated actor", f => ({ ...f.event, actingPlayerId: "forged-player" })]
  ];
  for (const [label, alter] of cases) {
    const f = fixture();
    const result = Reducer.discoverAutoTriggers(f.state, [alter(f)], Engine);
    assert.equal(result.queued.length, 0, label);
    assert.equal(f.state.pendingAbility, null, label);
  }
  const wrongClan = fixture({ vanguard: OTHER_VANGUARD });
  assert.equal(discover(wrongClan).queued.length, 0, "Great Nature Vanguard condition is mandatory");
  const wrongStatePhase = fixture();
  wrongStatePhase.state.phase = 4;
  assert.equal(discover(wrongStatePhase).queued.length, 0, "the authoritative match must still be in End Phase");
  const wrongActiveSeat = fixture();
  wrongActiveSeat.state.side = wrongActiveSeat.side === "human" ? "bot" : "human";
  assert.equal(discover(wrongActiveSeat).queued.length, 0, "the active turn seat must match the ability controller");
  const noCounterBlast = fixture();
  noCounterBlast.damage.faceDown = true;
  const unavailable = discover(noCounterBlast);
  assert.equal(unavailable.queued.length, 0, "unpayable optional costs do not produce an activation prompt");
  assert.ok(unavailable.skipped.some(item => item.reason === "unpayable-cost"));
});

test("resolution revalidates the condition, exact target, and Counter Blast atomically", () => {
  const conditionChanged = fixture();
  assert.equal(discover(conditionChanged).queued.length, 1);
  conditionChanged.own.vanguard = inst(OTHER_VANGUARD.id, "replacement-vg", conditionChanged.playerId);
  const conditionResult = resolve(conditionChanged, { effectUid: conditionChanged.target.uid, costSelections: { cb: [conditionChanged.damage.uid] } });
  assert.equal(conditionResult.ok, false);
  assert.equal(conditionChanged.damage.faceDown, false);
  assert.ok(conditionChanged.own.deck.some(card => card.uid === conditionChanged.target.uid));

  const invalidCost = fixture();
  assert.equal(discover(invalidCost).queued.length, 1);
  const costResult = resolve(invalidCost, { effectUid: invalidCost.target.uid, costSelections: { cb: ["not-a-damage-card"] } });
  assert.equal(costResult.ok, false);
  assert.equal(invalidCost.damage.faceDown, false);
  assert.ok(invalidCost.own.deck.some(card => card.uid === invalidCost.target.uid));

  const invalidTarget = fixture();
  assert.equal(discover(invalidTarget).queued.length, 1);
  const targetResult = resolve(invalidTarget, { effectUid: invalidTarget.unrelated.uid, costSelections: { cb: [invalidTarget.damage.uid] } });
  assert.equal(targetResult.ok, false);
  assert.equal(invalidTarget.damage.faceDown, false, "invalid target choice cannot partially pay the cost");
  assert.ok(invalidTarget.own.deck.some(card => card.uid === invalidTarget.target.uid));
});

test("a forged card text, card ID, or effect cannot use this server-trusted search", () => {
  const f = fixture();
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, printedText: "AUTO: When this unit attacks, draw a card." } }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, cardId: "cfa-999", definition: { ...f.ability.definition, cardId: "cfa-999" } }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, effects: [{ op: "draw", count: 1 }] } }), false);
});
