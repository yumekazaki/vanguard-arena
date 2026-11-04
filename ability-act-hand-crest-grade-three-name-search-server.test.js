"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const FAMILY = "act-hand-crest-grade-three-name-fragment-search-v1";
const SPECS = Object.freeze({
  "cfa-10778": { abilityId: "cfa-10778:1", crestName: "Alter Ego Messiah", fragment: "Messiah", targetId: "cfa-2881" },
  "cfa-12193": { abilityId: "cfa-12193:1", crestName: "Demon Stealth Dragon, Shiranui \"Oboro\"", fragment: "Demon Stealth Dragon, Shiranui", targetId: "cfa-4827" },
  "cfa-12202": { abilityId: "cfa-12202:0", crestName: "Dragheart, Luard", fragment: "Luard", targetId: "cfa-4226" },
  "cfa-13200": { abilityId: "cfa-13200:1", crestName: "Masked Magician, Harri", fragment: "Harri", targetId: "cfa-3280" },
  "cfa-13207": { abilityId: "cfa-13207:1", crestName: "Vampire Princess of Night Fog, Nightrose", fragment: "Nightrose", targetId: "cfa-3422" }
});

function card(cardId) {
  const found = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(found, `catalog card ${cardId} exists`);
  return found;
}

function instance(definition, uid, playerId, overrides = {}) {
  return {
    uid, cardId: String(definition.id || definition.cardId), cardName: definition.name || definition.cardName,
    type: definition.type || "Unit", grade: Number(definition.grade), clan: definition.clan, clans: definition.clans,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides
  };
}

function abilityFor(cardId) {
  const spec = SPECS[cardId], found = Engine.parseCardAbilitiesCached(card(cardId)).find(item => item.id === spec.abilityId);
  assert.ok(found, `${spec.abilityId} has a compiled ACT definition`);
  return found;
}

function setup({ cardId = "cfa-10778", ownerSide = "human", zone = "deck", crest = "owner", crestName = null, target = null } = {}) {
  const spec = SPECS[cardId], ability = abilityFor(cardId), sourceDefinition = card(cardId);
  const ownerId = ownerSide === "human" ? "host-player" : "guest-player";
  const otherSide = ownerSide === "human" ? "bot" : "human";
  const otherId = otherSide === "human" ? "host-player" : "guest-player";
  const source = instance(sourceDefinition, `${ownerSide}-act-source`, ownerId);
  const targetCard = target || instance(card(spec.targetId), `${ownerSide}-matching-grade-three`, ownerId);
  const unrelated = instance(card("cfa-3"), `${ownerSide}-unrelated-grade-three`, ownerId);
  const owner = {
    playerId: ownerId, vanguard: instance(card("cfa-3"), `${ownerSide}-vanguard`, ownerId),
    rear: [null, null, null, null, null], hand: [source], soul: [], drop: zone === "drop" ? [targetCard] : [],
    deck: zone === "deck" ? [unrelated, targetCard] : [unrelated], damage: [], bind: [], orders: [], crests: [],
    guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opponent = {
    playerId: otherId, vanguard: instance(card("cfa-3"), `${otherSide}-vanguard`, otherId),
    rear: [null, null, null, null, null], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [],
    crests: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const crestInstance = instance({ id: `test-crest-${cardId}`, name: crestName || spec.crestName, type: "Crest", grade: 0 },
    `${ownerSide}-crest`, crest === "opponent" ? otherId : ownerId, { crestName: crestName || spec.crestName });
  if (crest === "owner") owner.crests.push(crestInstance);
  else if (crest === "wrong") owner.crests.push({ ...crestInstance, cardName: "A different crest", crestName: "A different crest" });
  else if (crest === "opponent") opponent.crests.push(crestInstance);
  const state = {
    matchId: "hand-crest-search", stateVersion: 9, processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [],
    turn: 3, side: ownerSide, phase: 4,
    players: ownerSide === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner }
  };
  return { ability, cardId, owner, opponent, ownerId, otherId, ownerSide, otherSide, source, targetCard, unrelated, state, zone };
}

function activate(fixture, { auth = fixture.ownerSide === "human" ? "auth-host" : "auth-guest", actionId = `activate-${fixture.cardId}-${fixture.ownerSide}`,
  zone = fixture.zone, effectUid = fixture.targetCard?.uid ?? null, sourceUid = fixture.source.uid, abilityId = fixture.ability.id } = {}) {
  return Reducer.applyManualAbilityActivation(fixture.state, {
    actorAuthUid: auth, actionId, expectedStateVersion: fixture.state.stateVersion,
    payload: { sourceCardInstanceId: sourceUid, abilityId, selection: {
      costSelections: { cb: [], sb: [], discard: [], reveal: [] }, effectSourceZone: zone, effectUid
    } }
  }, seats, Engine);
}

test("only the five reviewed hand ACT definitions are trusted, with exact crest, grade, and name filters", () => {
  for (const [cardId, spec] of Object.entries(SPECS)) {
    const ability = abilityFor(cardId);
    assert.equal(ability.definition.source.patternId, FAMILY);
    assert.equal(ability.conditionStatus, "modeled");
    assert.deepEqual(ability.conditions, [{ type: "controller-has-crest", cardName: spec.crestName }]);
    assert.deepEqual(ability.requiredLocation, ["hand"]);
    assert.deepEqual(ability.costs, [{ type: "source-discard", count: 1 }]);
    assert.deepEqual(ability.definition.effects, [{ op: "search-deck-or-drop-named-to-hand", target: "controller", maximum: 1,
      cardNameContains: spec.fragment, grade: 3, reveal: true, shuffleIfDeckSearched: true }]);
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(item => item.id === spec.abilityId));
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);

    const wrongGrade = structuredClone(ability);
    wrongGrade.definition.effects[0].grade = 2;
    assert.equal(Reducer.supportsServerAbilityEffects(wrongGrade), false, `${cardId} rejects a changed grade filter`);
    const wrongCrest = structuredClone(ability);
    wrongCrest.definition.conditions[0].cardName = "some other crest";
    assert.equal(Reducer.supportsServerAbilityEffects(wrongCrest), false, `${cardId} rejects a changed Crest condition`);
    const exactNameOnly = structuredClone(ability);
    exactNameOnly.definition.effects[0].cardName = spec.fragment;
    delete exactNameOnly.definition.effects[0].cardNameContains;
    assert.equal(Reducer.supportsServerAbilityEffects(exactNameOnly), false, `${cardId} rejects replacing substring matching with exact-name matching`);
  }
});

test("host and joining player can each pay the source cost and resolve all five ACTs from their own hand", () => {
  for (const [index, cardId] of Object.keys(SPECS).entries()) {
    for (const ownerSide of ["human", "bot"]) {
      const zone = (index + (ownerSide === "bot" ? 1 : 0)) % 2 ? "drop" : "deck";
      const fixture = setup({ cardId, ownerSide, zone });
      const deckBefore = fixture.owner.deck.map(item => item.uid);
      const result = activate(fixture, { actionId: `resolve-${cardId}-${ownerSide}` });
      assert.equal(result.ok, true, `${cardId} ${ownerSide}: ${result.reason}`);
      assert.ok(fixture.owner.drop.some(item => item.uid === fixture.source.uid), "the exact source card pays the discard cost");
      assert.ok(fixture.owner.hand.some(item => item.uid === fixture.targetCard.uid), "the chosen Grade 3 name match enters the activating player's hand");
      assert.ok(!fixture.owner.deck.some(item => item.uid === fixture.targetCard.uid) && !fixture.owner.drop.some(item => item.uid === fixture.targetCard.uid));
      assert.deepEqual(fixture.opponent.hand, [], "the opponent receives no card benefit");
      assert.ok(result.events.some(event => event.type === "card.revealed" && event.cardInstanceId === fixture.targetCard.uid), "the selected card is revealed");
      if (zone === "drop") assert.deepEqual(fixture.owner.deck.map(item => item.uid), deckBefore, "Drop search does not shuffle the deck");
      assert.equal(fixture.state.stateVersion, 10);
    }
  }
});

test("the exact Crest must be controlled by the activating player", () => {
  for (const crest of ["none", "wrong", "opponent"]) {
    const fixture = setup({ cardId: "cfa-10778", ownerSide: "bot", crest });
    const before = JSON.stringify(fixture.state);
    const result = activate(fixture, { actionId: `reject-${crest}-crest` });
    assert.equal(result.ok, false, crest);
    assert.equal(JSON.stringify(fixture.state), before, "condition rejection does not partially pay or resolve");
  }
});

test("chosen cards are revalidated for Grade 3, name fragment, and the selected search zone", () => {
  const cases = [
    { label: "wrong grade", target: { id: "wrong-grade", cardName: "Messiah Vanguard", grade: 2, type: "Unit" }, zone: "deck" },
    { label: "wrong name", target: { id: "wrong-name", cardName: "Unrelated Vanguard", grade: 3, type: "Unit" }, zone: "deck" },
    { label: "outside selected zone", target: { id: "drop-only", cardName: "Messiah Vanguard", grade: 3, type: "Unit" }, zone: "drop", selectedZone: "deck" }
  ];
  for (const item of cases) {
    const target = { id: `synthetic-${item.target.id}`, name: item.target.cardName, grade: item.target.grade, type: item.target.type };
    const fixture = setup({ cardId: "cfa-10778", ownerSide: "bot", zone: item.zone, target: instance(target, item.target.id, "guest-player") });
    const before = JSON.stringify(fixture.state);
    const result = activate(fixture, { zone: item.selectedZone || item.zone, effectUid: fixture.targetCard.uid, actionId: `invalid-${item.label.replace(/\s/g, "-")}` });
    assert.equal(result.ok, false, item.label);
    assert.equal(JSON.stringify(fixture.state), before, `${item.label} rejection is atomic`);
  }
});

test("the player may choose no card, and the search zone controls whether the deck is shuffled", () => {
  const fixture = setup({ cardId: "cfa-13207", ownerSide: "bot", zone: "drop" });
  const deckBefore = fixture.owner.deck.map(item => item.uid);
  const result = activate(fixture, { effectUid: null, actionId: "choose-no-nightrose" });
  assert.equal(result.ok, true, result.reason);
  assert.ok(fixture.owner.drop.some(item => item.uid === fixture.source.uid));
  assert.ok(fixture.owner.drop.some(item => item.uid === fixture.targetCard.uid));
  assert.deepEqual(fixture.owner.deck.map(item => item.uid), deckBefore);

  const handler = Engine.EFFECT_HANDLERS["search-deck-or-drop-named-to-hand"];
  let shuffleCount = 0;
  const deckContext = { player: { hand: [], deck: [{ uid: "deck-match", cardId: "candidate", cardName: "Alter Ego Messiah", grade: 3 }] },
    effectSourceZone: "deck", effectUid: null, cardDefinitionForInstance: item => item,
    shuffleDeck: () => { shuffleCount++; } };
  const step = { op: "search-deck-or-drop-named-to-hand", target: "controller", maximum: 1, cardNameContains: "Messiah", grade: 3, reveal: true, shuffleIfDeckSearched: true };
  assert.equal(handler.validate(step, deckContext), true);
  handler.apply(step, deckContext);
  assert.equal(shuffleCount, 1, "searching the Deck shuffles even when choosing no card");
});

test("wrong phase, wrong source zone, forged player, and duplicate requests are rejected", () => {
  const wrongPhase = setup({ cardId: "cfa-12193", ownerSide: "bot" });
  wrongPhase.state.phase = 3;
  let before = JSON.stringify(wrongPhase.state);
  assert.equal(activate(wrongPhase, { actionId: "wrong-main-window" }).ok, false);
  assert.equal(JSON.stringify(wrongPhase.state), before);

  const wrongZone = setup({ cardId: "cfa-12193", ownerSide: "bot" });
  wrongZone.owner.hand = [];
  wrongZone.owner.rear[0] = wrongZone.source;
  before = JSON.stringify(wrongZone.state);
  assert.equal(activate(wrongZone, { actionId: "source-left-hand" }).ok, false);
  assert.equal(JSON.stringify(wrongZone.state), before);

  const forged = setup({ cardId: "cfa-12193", ownerSide: "bot" });
  forged.state.side = "human";
  before = JSON.stringify(forged.state);
  assert.equal(activate(forged, { auth: "auth-host", actionId: "host-forges-guest-card" }).ok, false);
  assert.equal(JSON.stringify(forged.state), before);

  const duplicate = setup({ cardId: "cfa-13200", ownerSide: "human" });
  const actionId = "first-harri-search";
  assert.equal(activate(duplicate, { actionId }).ok, true);
  const afterFirst = JSON.stringify(duplicate.state);
  assert.equal(activate(duplicate, { actionId }).reason, "duplicate-action");
  assert.equal(JSON.stringify(duplicate.state), afterFirst);
});
