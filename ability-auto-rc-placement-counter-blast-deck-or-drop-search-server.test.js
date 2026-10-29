"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-rc-placement-counter-blast-deck-or-drop-named-search-v1";
const FAMILY = [
  ["cfa-10980", 1, "Uplifting Hymn"],
  ["cfa-11021", 1, "Sweet Honey Garden"],
  ["cfa-11052", 1, "Reception of the Famed Demonic Mansion"],
  ["cfa-11100", 1, "A Serious Fight!"],
  ["cfa-11963", 0, "Trick&Treat!"],
  ["cfa-12112", 1, "Pretty<3Demoncoord!"],
];
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const byId = id => catalog.find(card => String(card.id) === String(id));
const abilityFor = (cardId, index) => Engine.parseCardAbilitiesCached(byId(cardId)).find(ability => ability.id === `${cardId}:${index}`);
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), soul: [], drop: [], damage: [], hand: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });

function fixture({ cardId, index, side = "bot", zone = "deck", targetName, includeCost = true, wrongTarget = false } = {}) {
  const card = byId(cardId), ability = abilityFor(cardId, index), ownId = side === "human" ? "player-host" : "player-guest";
  assert.ok(card, `catalog source ${cardId}`); assert.ok(ability, `compiled ability ${cardId}:${index}`);
  const targetDefinition = catalog.find(item => item.name === (targetName || FAMILY.find(item => item[0] === cardId)?.[2]));
  assert.ok(targetDefinition, `catalog target ${targetName || FAMILY.find(item => item[0] === cardId)?.[2]}`);
  const source = { uid: `source-${side}-${cardId}`, cardId, cardName: card.name, ownerPlayerId: ownId, controllerPlayerId: ownId, type: card.type, grade: Number(card.grade), unitCard: true };
  const target = { uid: `target-${zone}-${cardId}`, cardId: wrongTarget ? "cfa-1" : targetDefinition.id, cardName: wrongTarget ? "Different Card" : targetDefinition.name, ownerPlayerId: ownId, controllerPlayerId: ownId };
  const own = player(ownId), otherId = side === "human" ? "player-guest" : "player-host", other = player(otherId);
  own.vanguard = { uid: `vg-${side}`, cardId: "cfa-31", cardName: "Vanguard", grade: 3, ownerPlayerId: ownId, controllerPlayerId: ownId, unitCard: true };
  own.rear[0] = source;
  own.damage = includeCost ? [{ uid: `cb-${side}`, cardId: "cfa-1", faceDown: false, ownerPlayerId: ownId, controllerPlayerId: ownId }] : [];
  if (zone === "deck") own.deck.push(target); else own.drop.push(target);
  const foreign = { ...target, uid: `foreign-${side}` }; other.deck.push(foreign);
  const players = side === "human" ? { human: own, bot: other } : { human: other, bot: own };
  const state = { matchId: `deck-drop-${cardId}-${side}`, stateVersion: 1, turn: 2, side, phase: 4, eventSequence: 0,
    processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownId, subjectControllerPlayerId: ownId,
    previousLocation: "hand", currentLocation: "rear-left", circle: "rear-guard", phase: "main", timingWindow: "normal-call" });
  return { state, event, ability, card, source, target, targetDefinition, side, ownId, otherId };
}

function decide(f, { actor = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `resolve-${f.side}-${f.card.id}`, effectSourceZone, effectUid } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: actor, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
      effectSourceZone, effectUid: effectUid || null, costSelections: { cb: [`cb-${f.side}`] } } } }, seats, Engine);
}

test("all six catalog definitions retain exact names, source-circle trigger, cost, and trusted handler", () => {
  const definitions = require("./ability-definitions.js").filter(definition => definition.source?.patternId === PATTERN);
  assert.equal(definitions.length, FAMILY.length);
  for (const [cardId, index, name] of FAMILY) {
    const ability = abilityFor(cardId, index);
    assert.ok(ability, `${cardId}:${index}`);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.match(ability.printedText, new RegExp(`search your deck or drop for up to one \\"${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\"`));
    assert.equal(ability.trigger.eventType, "card.placed"); assert.equal(ability.trigger.subject, "source");
    assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(ability.definition.effects[0].cardName, name);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("host and joining player each own the placement prompt and resolve a Deck or Drop search", () => {
  for (const side of ["human", "bot"]) for (const zone of ["deck", "drop"]) {
    const family = FAMILY[side === "human" ? 0 : 1];
    const f = fixture({ cardId: family[0], index: family[1], side, zone });
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownId);
    const beforeForeignHand = f.state.players[side === "human" ? "bot" : "human"].hand.length;
    const forged = decide(f, { actor: side === "human" ? seats.guestAuthUid : seats.hostAuthUid, effectSourceZone: zone, effectUid: f.target.uid });
    assert.equal(forged.ok, false);
    const result = decide(f, { effectSourceZone: zone, effectUid: f.target.uid });
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].hand.at(-1).uid, f.target.uid);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, beforeForeignHand);
    assert.equal(f.state.players[side].deck.some(card => card.uid === f.target.uid), false);
    assert.equal(f.state.players[side].drop.some(card => card.uid === f.target.uid), false);
    assert.equal(f.state.pendingAbility, null);
  }
});

test("exact placed source is prompted once; other source and non-RC placement are ignored", () => {
  const f = fixture({ cardId: FAMILY[0][0], index: FAMILY[0][1] });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  const wrongCircle = fixture({ cardId: FAMILY[0][0], index: FAMILY[0][1] });
  const event = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: "wrong-circle-event", sourceCardInstanceId: "other", subjectCardInstanceId: "other", currentLocation: "guardian", circle: "guardian" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [event], Engine).queued.length, 0);
});

test("unavailable CB, wrong zone, wrong-name/foreign/stale selections reject atomically", () => {
  const noCost = fixture({ cardId: FAMILY[0][0], index: FAMILY[0][1], includeCost: false });
  assert.equal(Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine).queued.length, 1);
  const beforeNoCost = JSON.stringify(noCost.state);
  const unpaid = decide(noCost, { effectSourceZone: "deck", effectUid: noCost.target.uid });
  assert.equal(unpaid.ok, false); assert.equal(JSON.stringify(noCost.state), beforeNoCost);
  for (const bad of [
    { zone: "drop", uid: "target-deck-cfa-10980" },
    { zone: "deck", uid: "foreign-bot" },
    { zone: "deck", uid: "missing-card" },
  ]) {
    const f = fixture({ cardId: FAMILY[0][0], index: FAMILY[0][1], zone: "deck" });
    if (bad.uid === "foreign-bot") bad.uid = f.state.players.bot.deck[0].uid;
    const before = JSON.stringify(f.state);
    const result = decide(f, { effectSourceZone: bad.zone, effectUid: bad.uid });
    assert.equal(result.ok, false, `reject ${bad.zone}/${bad.uid}`);
    assert.equal(JSON.stringify(f.state), before, "rejected resolution is atomic");
  }
  const wrong = fixture({ cardId: FAMILY[0][0], index: FAMILY[0][1], zone: "deck", wrongTarget: true });
  const before = JSON.stringify(wrong.state);
  assert.equal(decide(wrong, { effectSourceZone: "deck", effectUid: wrong.target.uid }).ok, false);
  assert.equal(JSON.stringify(wrong.state), before);
});

test("choosing a zone without a matching card is legal; shuffle occurs only after a Deck search", () => {
  const ability = abilityFor(FAMILY[0][0], FAMILY[0][1]), step = ability.definition.effects[0], handler = Engine.EFFECT_HANDLERS[step.op];
  const contextFor = zone => {
    const selected = { uid: `only-${zone}`, cardId: "target-id", cardName: FAMILY[0][2] };
    let shuffles = 0;
    return { context: { player: { playerId: "p", deck: zone === "deck" ? [selected] : [], drop: zone === "drop" ? [selected] : [], hand: [] },
      effectSourceZone: zone, effectUid: null, cardDefinitionForInstance: card => ({ name: card.cardName }), shuffleDeck: () => { shuffles++; }, emitEvent() {} },
      shuffles: () => shuffles };
  };
  const drop = contextFor("drop");
  assert.equal(handler.validate(step, drop.context), true);
  assert.deepEqual(handler.apply(step, drop.context), { searchedZone: "drop", revealedCardId: null, revealedCardUid: null });
  assert.equal(drop.shuffles(), 0);
  const deck = contextFor("deck");
  assert.equal(handler.validate(step, deck.context), true);
  handler.apply(step, deck.context);
  assert.equal(deck.shuffles(), 1);
});

test("duplicate resolution commands cannot move the named card twice", () => {
  const f = fixture({ cardId: FAMILY[0][0], index: FAMILY[0][1], zone: "drop" });
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const result = decide(f, { effectSourceZone: "drop", effectUid: f.target.uid, actionId: "one-resolution" });
  assert.equal(result.ok, true, result.reason);
  const snapshot = JSON.stringify(f.state);
  const duplicate = decide(f, { effectSourceZone: "drop", effectUid: f.target.uid, actionId: "one-resolution" });
  assert.equal(duplicate.ok, false);
  assert.equal(JSON.stringify(f.state), snapshot);
});
