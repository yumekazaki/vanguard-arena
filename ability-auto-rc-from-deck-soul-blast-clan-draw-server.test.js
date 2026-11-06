"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const mainDefinitions = require("./ability-definitions.js");
const contributions = [
  ...require("./ability-contributions/batch-ABILITY-76D8A0B8-0111.js"),
  ...require("./ability-contributions/batch-ABILITY-76D8A0B8-0121.js"),
  ...require("./ability-contributions/batch-ABILITY-76D8A0B8-0124.js"),
];
Engine.registerAbilityDefinitions([...mainDefinitions, ...contributions]);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-place-rc-from-deck-soul-blast-clan-draw-v1";
const FAMILY = [
  { cardId: "cfa-1537", abilityId: "cfa-1537:0", clan: "Royal Paladin" },
  { cardId: "cfa-1830", abilityId: "cfa-1830:0", clan: "Shadow Paladin" },
  { cardId: "cfa-191", abilityId: "cfa-191:0", clan: "Gold Paladin" },
];
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const catalogCard = cardId => catalog.find(card => String(card.id) === String(cardId));
const contributionById = new Map(contributions.map(definition => [definition.id, definition]));
const playerIdFor = side => side === "human" ? "host-player" : "guest-player";
const authUidFor = side => side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
const opponentAuthUidFor = side => side === "human" ? seats.guestAuthUid : seats.hostAuthUid;

function makePlayer(playerId, clan, { soulCount = 1 } = {}) {
  const draw = { uid: `draw-${playerId}`, cardId: "cfa-1", ownerPlayerId: playerId, controllerPlayerId: playerId, type: "Unit", unitCard: true };
  const vanguard = { uid: `vanguard-${playerId}`, cardId: "test-vanguard", cardName: `${clan} Vanguard`, clan, clans: [clan], grade: 3, type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId };
  return {
    playerId,
    vanguard,
    rear: Array(5).fill(null),
    deck: [draw],
    drop: [],
    hand: [],
    soul: Array.from({ length: soulCount }, (_, index) => ({ uid: `soul-${playerId}-${index}`, cardId: "cfa-1", ownerPlayerId: playerId, controllerPlayerId: playerId })),
    damage: [],
    bind: [],
    orders: [],
    guardCircle: [],
    gDeck: [],
    gZone: [],
    triggerZone: [],
  };
}

function fixture({
  cardId = FAMILY[0].cardId,
  side = "human",
  sourceLocation = "rear-guard",
  previousLocation = "deck",
  sourceEvent = "ability-source",
  clan,
  soulCount = 1,
} = {}) {
  const familyEntry = FAMILY.find(entry => entry.cardId === cardId);
  assert.ok(familyEntry, `family card ${cardId}`);
  const definition = contributionById.get(familyEntry.abilityId);
  const card = catalogCard(cardId);
  assert.ok(definition, `contribution definition ${familyEntry.abilityId}`);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === familyEntry.abilityId);
  assert.ok(ability, `parsed ability ${familyEntry.abilityId}`);
  const actorPlayerId = playerIdFor(side), opponentPlayerId = playerIdFor(side === "human" ? "bot" : "human");
  const matchingClan = clan ?? familyEntry.clan;
  const own = makePlayer(actorPlayerId, matchingClan, { soulCount });
  const other = makePlayer(opponentPlayerId, "Kagero");
  const source = { uid: `ability-source-${side}-${cardId}`, cardId, cardName: card.name, grade: 1, type: "Unit", unitCard: true, ownerPlayerId: actorPlayerId, controllerPlayerId: actorPlayerId };
  if (sourceLocation === "vanguard") {
    own.vanguard = { ...source, clan: matchingClan, clans: [matchingClan], grade: 1 };
  } else {
    own.rear[0] = source;
  }
  const players = side === "human" ? { human: own, bot: other } : { human: other, bot: own };
  const state = {
    matchId: `deck-soul-draw-${cardId}-${side}-${sourceEvent}`,
    stateVersion: 1,
    turn: 2,
    phase: 4,
    side,
    eventSequence: 0,
    processedEventIds: [],
    processedAbilityTriggers: [],
    processedActionIds: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingTrigger: null,
    players,
  };
  let eventSource = source;
  if (sourceEvent === "another-instance") {
    eventSource = { uid: `unrelated-instance-${side}`, cardId: "cfa-1", cardName: "Flogal", grade: 0, type: "Unit", unitCard: true, ownerPlayerId: actorPlayerId, controllerPlayerId: actorPlayerId };
    own.rear[1] = eventSource;
  } else if (sourceEvent === "unknown-instance") {
    eventSource = { uid: `unknown-instance-${side}`, cardId: "cfa-1", ownerPlayerId: actorPlayerId, controllerPlayerId: actorPlayerId };
  }
  const circle = sourceLocation === "vanguard" ? "vanguard" : "rear-left";
  const event = Engine.createGameEvent(state, {
    eventId: `placed-${cardId}-${side}-${sourceEvent}-${previousLocation}-${circle}`,
    type: "card.placed",
    actingPlayerId: actorPlayerId,
    turnPlayerId: actorPlayerId,
    sourceCardInstanceId: eventSource.uid,
    sourceOwnerPlayerId: eventSource.ownerPlayerId,
    sourceControllerPlayerId: eventSource.controllerPlayerId,
    cardInstanceId: eventSource.uid,
    subjectCardInstanceId: eventSource.uid,
    subjectOwnerPlayerId: eventSource.ownerPlayerId,
    subjectControllerPlayerId: eventSource.controllerPlayerId,
    previousLocation,
    currentLocation: circle,
    circle,
    phase: "main",
    timingWindow: "call-from-deck",
  });
  return { state, event, ability, definition, source, eventSource, own, other, side, actorPlayerId, familyEntry };
}

function discover(f) {
  return Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
}

function answer(f, { actorAuthUid = authUidFor(f.side), accept = true, actionId = `resolve-${f.side}-${f.ability.id}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid,
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response",
      accept,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
        costSelections: { cb: [], sb: [f.own.soul[0]?.uid].filter(Boolean), discard: [], reveal: [] } },
    },
  }, seats, Engine);
}

test("three contributions preserve exact text, optional AUTO, deck-origin restriction, clan, cost, and draw", () => {
  assert.equal(contributions.length, FAMILY.length);
  assert.deepEqual(contributions.map(definition => definition.id).sort(), FAMILY.map(entry => entry.abilityId).sort());
  for (const entry of FAMILY) {
    const card = catalogCard(entry.cardId);
    const definition = contributionById.get(entry.abilityId);
    assert.ok(card.text.includes(definition.printedText), entry.abilityId);
    assert.equal(definition.source.patternId, PATTERN, entry.abilityId);
    assert.equal(definition.kind, "AUTO", entry.abilityId);
    assert.equal(definition.optional, true, entry.abilityId);
    assert.deepEqual(definition.requiredLocation, ["rear-guard"], entry.abilityId);
    assert.equal(definition.trigger.eventType, "card.placed", entry.abilityId);
    assert.equal(definition.trigger.subject, "source", entry.abilityId);
    assert.deepEqual(definition.trigger.circles, ["rear-guard"], entry.abilityId);
    assert.equal(definition.trigger.sourceLocation, "deck", entry.abilityId);
    assert.equal(definition.trigger.destinationLocation, "rear-guard", entry.abilityId);
    assert.deepEqual(definition.conditions, [{ type: "controller-vanguard-has-clan", value: entry.clan }], entry.abilityId);
    assert.deepEqual(definition.costs, [{ type: "soul-blast", count: 1 }], entry.abilityId);
    assert.deepEqual(definition.effects, [{ op: "draw", count: 1 }], entry.abilityId);
    assert.equal(definition.conditionsReviewed, true, entry.abilityId);
    assert.equal(definition.costsReviewed, true, entry.abilityId);
    assert.equal(definition.choicesReviewed, true, entry.abilityId);
    assert.equal(definition.canDecline, true, entry.abilityId);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === entry.abilityId);
    assert.equal(ability.definition.source.patternId, PATTERN, entry.abilityId);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"], entry.abilityId);
    assert.equal(ability.trigger.sourceLocation, "deck", entry.abilityId);
    assert.equal(ability.trigger.destinationLocation, "rear-guard", entry.abilityId);
  }
});

test("only the exact source instance placed from deck onto RC is eligible", () => {
  for (const entry of FAMILY) {
    const valid = fixture({ cardId: entry.cardId });
    assert.equal(discover(valid).queued.length, 1, entry.abilityId);
    assert.equal(valid.state.pendingAbility.instance.uid, valid.source.uid, entry.abilityId);
    assert.equal(valid.state.pendingAbility.ability.id, entry.abilityId, entry.abilityId);

    for (const invalid of [
      { previousLocation: "hand" },
      { previousLocation: "drop" },
      { sourceEvent: "another-instance" },
      { sourceEvent: "unknown-instance" },
      { sourceLocation: "vanguard" },
    ]) {
      const f = fixture({ cardId: entry.cardId, ...invalid });
      assert.equal(discover(f).queued.length, 0, `${entry.abilityId}/${JSON.stringify(invalid)}`);
      assert.equal(f.state.pendingAbility, null, `${entry.abilityId}/${JSON.stringify(invalid)}`);
    }
  }
});

test("the controller's matching Vanguard clan and payable Soul Blast are required before prompting", () => {
  for (const entry of FAMILY) {
    for (const invalid of [
      { clan: "Kagero" },
      { soulCount: 0 },
    ]) {
      const f = fixture({ cardId: entry.cardId, ...invalid });
      assert.equal(discover(f).queued.length, 0, `${entry.abilityId}/${JSON.stringify(invalid)}`);
      assert.equal(f.state.pendingAbility, null, `${entry.abilityId}/${JSON.stringify(invalid)}`);
    }
  }
});

test("each seat privately resolves its own optional ability, pays one Soul Blast, and draws one card", () => {
  for (const entry of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ cardId: entry.cardId, side });
    assert.equal(discover(f).queued.length, 1, `${entry.abilityId}/${side}`);
    assert.equal(f.state.pendingAbility.side, side, `${entry.abilityId}/${side}`);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.actorPlayerId, `${entry.abilityId}/${side}`);

    if (side === "bot") {
      const before = JSON.stringify(f.state);
      assert.equal(answer(f, { actorAuthUid: opponentAuthUidFor(side), actionId: `host-forged-${entry.abilityId}` }).ok, false);
      assert.equal(JSON.stringify(f.state), before, entry.abilityId);
    }

    const applied = answer(f);
    assert.equal(applied.ok, true, applied.reason);
    assert.equal(f.own.soul.length, 0, `${entry.abilityId}/${side}`);
    assert.equal(f.own.hand.some(card => card.uid === `draw-${f.actorPlayerId}`), true, `${entry.abilityId}/${side}`);
    assert.equal(f.other.hand.length, 0, `${entry.abilityId}/${side}`);
    assert.equal(f.other.deck.length, 1, `${entry.abilityId}/${side}`);
  }
});

test("declining does not pay or draw and a duplicate event or answer cannot resolve twice", () => {
  for (const entry of FAMILY) {
    const declined = fixture({ cardId: entry.cardId, side: "bot" });
    assert.equal(discover(declined).queued.length, 1, entry.abilityId);
    const declineResult = answer(declined, { accept: false });
    assert.equal(declineResult.ok, true, declineResult.reason);
    assert.equal(declined.own.soul.length, 1, entry.abilityId);
    assert.equal(declined.own.hand.length, 0, entry.abilityId);
    assert.equal(discover(declined).queued.length, 0, entry.abilityId);

    const resolved = fixture({ cardId: entry.cardId, side: "bot" });
    assert.equal(discover(resolved).queued.length, 1, entry.abilityId);
    assert.equal(discover(resolved).queued.length, 0, entry.abilityId);
    assert.equal(answer(resolved).ok, true, entry.abilityId);
    const afterFirstResolution = JSON.stringify(resolved.state);
    assert.equal(answer(resolved, { actionId: `duplicate-${entry.abilityId}` }).ok, false, entry.abilityId);
    assert.equal(JSON.stringify(resolved.state), afterFirstResolution, entry.abilityId);
  }
});
