"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const family = "act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1";
const familyIds = ["cfa-83", "cfa-178", "cfa-235", "cfa-265", "cfa-323", "cfa-381", "cfa-444", "cfa-707", "cfa-733", "cfa-781", "cfa-834", "cfa-899", "cfa-953", "cfa-989", "cfa-1068", "cfa-1229", "cfa-1599", "cfa-2405", "cfa-2439", "cfa-2474", "cfa-3505", "cfa-3519", "cfa-5531"];
const genericIds = new Set(["cfa-2405", "cfa-2439", "cfa-2474", "cfa-3505", "cfa-3519"]);

function card(cardId) {
  const found = catalog.find(item => String(item.id) === String(cardId));
  assert.ok(found, `catalog card ${cardId} exists`);
  return found;
}

function instance(definition, uid, playerId, overrides = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit",
    grade: Number(definition.grade), clan: definition.clan, clans: definition.clans,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function setup({ ownerSide = "bot", sourceCardId = "cfa-83", target = null, extras = [], damageFaceUp = true } = {}) {
  const sourceDef = card(sourceCardId);
  const ability = Engine.parseCardAbilitiesCached(sourceDef).find(item => item.definition?.source?.patternId === family);
  assert.ok(ability, `${sourceCardId} belongs to the reviewed family`);
  Engine.registerAbilityDefinitions([ability.definition]);
  const ownerId = ownerSide === "human" ? "host" : "guest";
  const source = instance(sourceDef, `${ownerSide}-source`, ownerId, { circle: "rear-left", zone: "rear-guard", unitCard: true });
  const matched = target || (genericIds.has(sourceCardId) ? instance(card("cfa-7415"), `${ownerSide}-order-target`, ownerId) : instance(card("cfa-98"), `${ownerSide}-matched-target`, ownerId));
  const bottom = instance(card("cfa-3"), `${ownerSide}-bottom`, ownerId);
  const player = { playerId: ownerId, vanguard: instance(card("cfa-3"), `${ownerSide}-vg`, ownerId, { unitCard: true }),
    rear: [source, null, null, null, null], hand: [], soul: [], drop: [], deck: [bottom, ...extras, matched],
    damage: [instance(card("cfa-3"), `${ownerSide}-cb`, ownerId, { faceDown: !damageFaceUp })], bind: [], orders: [],
    guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponentSide = ownerSide === "human" ? "bot" : "human", opponentId = ownerSide === "human" ? "guest" : "host";
  const opponent = { playerId: opponentId, vanguard: instance(card("cfa-3"), `${opponentSide}-vg`, opponentId, { unitCard: true }),
    rear: [], hand: [], soul: [], drop: [], deck: [], damage: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: "act-rc-grade-three-search", stateVersion: 3, processedActionIds: [], turn: 2,
    side: ownerSide, phase: 4, players: ownerSide === "human" ? { human: player, bot: opponent } : { human: opponent, bot: player } };
  return { state, ability, source, player, ownerSide, ownerId, matched, bottom, extras };
}

function activate(fixture, { auth = fixture.ownerSide === "human" ? "auth-host" : "auth-guest", effectUid = null, costUid = fixture.player.damage[0]?.uid, actionId = "activate-grade-three-search" } = {}) {
  return Reducer.applyManualAbilityActivation(fixture.state, { actorAuthUid: auth, actionId,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { sourceCardInstanceId: fixture.source.uid, abilityId: fixture.ability.id,
      selection: { costSelections: { cb: costUid ? [costUid] : [], sb: [], discard: [], reveal: [] }, effectUid } }
  }, seats, Engine);
}

test("only the exact 23 reviewed ACT definitions are supported; generic filtered search stays unsupported", () => {
  const abilities = [];
  for (const definition of catalog) for (const ability of Engine.parseCardAbilitiesCached(definition)) {
    if (ability.definition?.source?.patternId === family) abilities.push(ability);
  }
  assert.equal(abilities.length, 23);
  assert.deepEqual(abilities.map(ability => ability.cardId).sort(), familyIds.slice().sort());
  assert.ok(abilities.every(ability => Reducer.supportsServerAbilityEffects(ability)));
  assert.ok(Engine.getReviewedAbilityDefinitionsForCard("cfa-83").some(definition => definition.source?.patternId === family));
  assert.equal(Reducer.supportsServerEffectOperation("search-top-up-to-one-filtered-to-hand"), false);
  const tampered = structuredClone(abilities[0]);
  tampered.definition.effects[0].filter.minGrade = 2;
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
});

test("host and joining player can use the ACT on their own Rear-Guard during Main Phase", () => {
  for (const ownerSide of ["human", "bot"]) {
    const fixture = setup({ ownerSide });
    const result = activate(fixture, { effectUid: fixture.matched.uid, actionId: `use-${ownerSide}` });
    assert.equal(result.ok, true, result.reason);
    assert.equal(fixture.state.players[ownerSide].rear[0], null);
    assert.equal(fixture.player.soul.at(-1).uid, fixture.source.uid);
    assert.equal(fixture.player.damage[0].faceDown, true, "Counter-Blast is paid");
    assert.ok(fixture.player.hand.some(item => item.uid === fixture.matched.uid));
    assert.ok(!fixture.player.deck.some(item => item.uid === fixture.matched.uid));
    const revealed = result.events.find(event => event.type === "card.revealed" && event.cardInstanceId === fixture.matched.uid);
    assert.ok(revealed);
    assert.equal(revealed.previousLocation, "deck");
    assert.equal(revealed.currentLocation, "hand");
    assert.equal(revealed.revealedCardId, fixture.matched.cardId);
    assert.equal(revealed.revealedCardName, fixture.matched.cardName);
    assert.equal(revealed.revealedCardGrade, fixture.matched.grade);
    assert.ok(result.events.some(event => event.type === "card.moved" && event.cardInstanceId === fixture.source.uid && event.currentLocation === "soul"));
  }
});

test("clan/unit filters and top-five boundary are enforced, while generic wording accepts a grade-3 order", () => {
  const clanAbility = Engine.parseCardAbilitiesCached(card("cfa-83")).find(item => item.definition?.source?.patternId === family);
  const aqua = instance(card("cfa-98"), "aqua-grade3", "guest");
  assert.equal(Reducer.supportsServerAbilityEffects(clanAbility), true);
  const valid = setup({ ownerSide: "bot", sourceCardId: "cfa-83", target: aqua });
  assert.equal(activate(valid, { effectUid: aqua.uid, actionId: "select-aqua-unit" }).ok, true);

  for (const ownerSide of ["human", "bot"]) {
    const ownerId = ownerSide === "human" ? "host" : "guest";
    const wrongClan = setup({ ownerSide, sourceCardId: "cfa-83", target: instance(card("cfa-98"), `${ownerSide}-wrong-clan`, ownerId, { clan: "Kagero", clans: ["Kagero"] }) });
    const beforeWrongClan = JSON.stringify(wrongClan.state);
    assert.equal(activate(wrongClan, { effectUid: wrongClan.matched.uid, actionId: `reject-wrong-clan-${ownerSide}` }).ok, false);
    assert.equal(JSON.stringify(wrongClan.state), beforeWrongClan);
  }

  const deep = setup({ ownerSide: "bot", sourceCardId: "cfa-83", extras: [instance(card("cfa-98"), "outside-top-five", "guest")] });
  deep.player.deck.push(...Array.from({ length: 5 }, (_, index) => instance(card("cfa-3"), `top-nonmatch-${index}`, "guest")));
  const beforeDeep = JSON.stringify(deep.state);
  assert.equal(activate(deep, { effectUid: "outside-top-five", actionId: "reject-outside-top-five" }).ok, false);
  assert.equal(JSON.stringify(deep.state), beforeDeep);

  const generic = setup({ ownerSide: "human", sourceCardId: "cfa-2405", target: instance(card("cfa-7415"), "grade3-order", "host") });
  assert.equal(generic.matched.type, "Normal Order");
  assert.equal(activate(generic, { effectUid: generic.matched.uid, actionId: "generic-grade3-order" }).ok, true,
    "printed generic wording filters by grade only, so a Grade 3 Order is legal");
});

test("no-search choice still pays both costs and shuffles the looked-at cards back", () => {
  const fixture = setup({ ownerSide: "bot" });
  const deckUids = fixture.player.deck.map(item => item.uid);
  const result = activate(fixture, { effectUid: null, actionId: "skip-search-choice" });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(fixture.player.hand, []);
  assert.equal(fixture.player.soul.at(-1).uid, fixture.source.uid);
  assert.equal(fixture.player.damage[0].faceDown, true);
  assert.deepEqual(new Set(fixture.player.deck.map(item => item.uid)), new Set(deckUids));
});

test("wrong timing, wrong circle, wrong actor, unavailable Counter-Blast, and invalid target reject atomically", () => {
  const offTurn = setup({ ownerSide: "bot" });
  offTurn.state.side = "human";
  let before = JSON.stringify(offTurn.state);
  assert.equal(activate(offTurn, { actionId: "wrong-turn" }).reason, "not-actor-turn");
  assert.equal(JSON.stringify(offTurn.state), before);

  const wrongPhase = setup({ ownerSide: "bot" });
  wrongPhase.state.phase = 3;
  before = JSON.stringify(wrongPhase.state);
  assert.equal(activate(wrongPhase, { actionId: "wrong-phase" }).reason, "wrong-timing-window");
  assert.equal(JSON.stringify(wrongPhase.state), before);

  const wrongCircle = setup({ ownerSide: "bot" });
  wrongCircle.player.rear[0] = null;
  wrongCircle.player.vanguard = wrongCircle.source;
  before = JSON.stringify(wrongCircle.state);
  assert.equal(activate(wrongCircle, { actionId: "wrong-circle" }).ok, false);
  assert.equal(JSON.stringify(wrongCircle.state), before);

  for (const ownerSide of ["human", "bot"]) {
    const noCb = setup({ ownerSide, damageFaceUp: false });
    before = JSON.stringify(noCb.state);
    assert.equal(activate(noCb, { actionId: `no-counterblast-${ownerSide}` }).ok, false);
    assert.equal(JSON.stringify(noCb.state), before);

    const invalidTarget = setup({ ownerSide });
    before = JSON.stringify(invalidTarget.state);
    assert.equal(activate(invalidTarget, { effectUid: "not-in-deck", actionId: `invalid-search-target-${ownerSide}` }).ok, false);
    assert.equal(JSON.stringify(invalidTarget.state), before);

    const foreignCost = setup({ ownerSide });
    const foreignDamageUid = foreignCost.state.players[ownerSide === "human" ? "bot" : "human"].vanguard.uid;
    before = JSON.stringify(foreignCost.state);
    assert.equal(activate(foreignCost, { costUid: foreignDamageUid, actionId: `foreign-cost-${ownerSide}` }).ok, false);
    assert.equal(JSON.stringify(foreignCost.state), before);

    const forged = setup({ ownerSide });
    before = JSON.stringify(forged.state);
    const otherAuth = ownerSide === "human" ? "auth-guest" : "auth-host";
    assert.notEqual(activate(forged, { auth: otherAuth, actionId: `opponent-forges-${ownerSide}` }).ok, true);
    assert.equal(JSON.stringify(forged.state), before);
  }
});
