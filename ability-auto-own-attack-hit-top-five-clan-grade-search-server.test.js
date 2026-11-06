"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contributions = [
  ...require("./ability-contributions/batch-ABILITY-76D8A0B8-0029.js"),
  ...require("./ability-contributions/batch-ABILITY-76D8A0B8-0112.js"),
  ...require("./ability-contributions/batch-ABILITY-76D8A0B8-0119.js")
];
Engine.registerAbilityDefinitions(contributions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-own-attack-hit-counter-blast-top-five-clan-grade-search-v1";
const FAMILY = new Map([
  ["cfa-1167", "Narukami"],
  ["cfa-1571", "Oracle Think Tank"],
  ["cfa-1775", "Gold Paladin"]
]);
const CATALOG = loadCatalog();
const CARDS = new Map(CATALOG.map(card => [String(card.id), card]));
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
let fixtureSequence = 0;

function cardInstance(cardId, uid, playerId, overrides = {}) {
  const definition = CARDS.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return { uid, cardId: String(cardId), cardName: definition.name, type: definition.type,
    grade: Number(definition.grade), clan: definition.clan, clans: definition.clans,
    unitCard: definition.type === "Unit", ownerPlayerId: playerId, controllerPlayerId: playerId, ...overrides };
}

function abilityFor(cardId) {
  const card = CARDS.get(String(cardId));
  assert.ok(card, `catalog card ${cardId} exists`);
  return Engine.parseCardAbilitiesCached(card).find(ability => ability.id === `${cardId}:0`);
}

function candidateFor(cardId, predicate = () => true) {
  const clan = FAMILY.get(String(cardId));
  const result = CATALOG.find(card => card.type === "Unit" && Number(card.grade) >= 3 &&
    (card.clan === clan || card.clans?.includes(clan)) && predicate(card));
  assert.ok(result, `catalog contains a Grade 3+ ${clan} Unit`);
  return result;
}

function setup({ side = "bot", sourceCardId = "cfa-1167", sourceCircle = "rear-left", cbReady = true,
  topCardIds = null, includeLegalTarget = true } = {}) {
  const sequence = ++fixtureSequence;
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = cardInstance(sourceCardId, `source-${sequence}`, ownerId,
    sourceCircle === "vanguard" ? { circle: "vanguard", zone: "vanguard" } : { circle: sourceCircle, zone: "rear-guard" });
  const legal = includeLegalTarget ? cardInstance(candidateFor(sourceCardId).id, `legal-${sequence}`, ownerId) : null;
  const fillers = (topCardIds || []).map((id, index) => cardInstance(id, `top-${sequence}-${index}`, ownerId));
  const deck = fillers.length ? fillers : [cardInstance("cfa-1", `filler-${sequence}`, ownerId)];
  if (legal && !deck.some(item => item.uid === legal.uid)) deck.splice(2, 0, legal);
  while (deck.length < 5) deck.push(cardInstance("cfa-1", `extra-${sequence}-${deck.length}`, ownerId));
  const makePlayer = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const own = makePlayer(ownerId), enemy = makePlayer(opponentId);
  if (sourceCircle === "vanguard") own.vanguard = source;
  else own.rear[0] = source;
  own.damage = [cardInstance("cfa-1", `cb-${sequence}`, ownerId, { faceDown: !cbReady })];
  own.deck = deck;
  enemy.vanguard = cardInstance("cfa-3", `opponent-vg-${sequence}`, opponentId);
  const state = { matchId: `own-attack-search-${sequence}`, stateVersion: 3, eventSequence: 0, processedEventIds: [],
    processedActionIds: [], processedAbilityTriggers: [], side, turn: 4, phase: 5,
    pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    players: side === "human" ? { human: own, bot: enemy } : { human: enemy, bot: own } };
  const battleId = `battle-${sequence}`;
  state.pendingAttack = { battleId, attackerSide: side, attackerPlayerId: ownerId, attackerUid: source.uid,
    attackerZone: sourceCircle, defenderSide: opponentSide, defenderPlayerId: opponentId,
    targetUid: enemy.vanguard.uid, targetZone: "vanguard", power: 18000, targetPower: 13000, critical: 1 };
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: enemy.vanguard.uid, subjectCardInstanceId: enemy.vanguard.uid,
    subjectOwnerPlayerId: opponentId, subjectControllerPlayerId: opponentId,
    attackingUnitInstanceId: source.uid, attackingCardInstanceIds: [source.uid],
    targetCardInstanceIds: [enemy.vanguard.uid], targetLocation: "vanguard",
    currentLocation: sourceCircle, battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, side, ownerId, opponentId, own, enemy, source, legal, event, battleId };
}

function discover(fixture, event = fixture.event) {
  return Reducer.discoverAutoTriggers(fixture.state, [event], Engine);
}

function respond(fixture, { accept = true, effectUid = null, actorAuthUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid } = {}) {
  return Reducer.applyAbilityDecision(fixture.state, { actorAuthUid,
    actionId: `resolve-${fixture.state.matchId}-${accept ? "yes" : "no"}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: { type: "ability-response", accept,
      selection: { instanceUid: fixture.source.uid, abilityId: `${fixture.source.cardId}:0`,
        effectUid, costSelections: { cb: [fixture.own.damage[0].uid], sb: [], discard: [], reveal: [] } } }
  }, seats, Engine);
}

test("the three exact card definitions preserve own-hit timing, optional CB1, and printed search filters", () => {
  assert.equal(contributions.length, 3);
  for (const [cardId, clan] of FAMILY) {
    const definition = contributions.find(item => item.cardId === cardId);
    const ability = abilityFor(cardId);
    assert.ok(definition, `${cardId}:0 is contributed`);
    assert.equal(definition.id, `${cardId}:0`);
    assert.equal(definition.printedText, ability.printedText, `${cardId}:0 preserves exact catalog text`);
    assert.equal(definition.kind, "AUTO");
    assert.equal(definition.optional, true);
    assert.deepEqual(definition.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(definition.trigger, { status: "recognized-trigger", eventType: "attack.hit", subject: "source", targetLocation: "vanguard", circles: [] });
    assert.deepEqual(definition.costs, [{ type: "counter-blast", count: 1 }]);
    assert.deepEqual(definition.effects, [{ op: "search-top-up-to-one-filtered-to-hand", target: "controller", lookCount: 5, maximum: 1,
      filter: { minGrade: 3, clan } }]);
    assert.equal(ability.definition?.source?.patternId, PATTERN);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, cardId);
  }
});

test("only the exact source unit hitting the opponent Vanguard queues on its printed VC or RC", () => {
  for (const side of ["human", "bot"]) for (const circle of ["vanguard", "rear-left"]) {
    const fixture = setup({ side, sourceCircle: circle });
    const result = discover(fixture);
    assert.equal(result.queued.length, 1, `${side} ${circle}`);
    assert.equal(fixture.state.pendingAbility.side, side);
    assert.equal(fixture.state.pendingAbility.instance.uid, fixture.source.uid);
    assert.equal(fixture.state.pendingAbility.triggerControllerPlayerId, fixture.ownerId);
    assert.equal(discover(fixture).queued.length, 0, "duplicate hit event is not queued twice");
  }
});

test("a non-hit, another attacker, or an attack against a Rear-Guard cannot trigger this AUTO", () => {
  const fixture = setup({ side: "bot" });
  const nonHit = Engine.createGameEvent(fixture.state, { ...fixture.event, eventId: undefined, type: "unit.attacked", timingWindow: "attack-declared" });
  assert.equal(discover(fixture, nonHit).queued.length, 0);
  const differentAttacker = Engine.createGameEvent(fixture.state, { ...fixture.event, eventId: undefined,
    sourceCardInstanceId: "other-source", attackingUnitInstanceId: "other-source", attackingCardInstanceIds: ["other-source"] });
  assert.equal(discover(fixture, differentAttacker).queued.length, 0);
  const wrongTarget = Engine.createGameEvent(fixture.state, { ...fixture.event, eventId: undefined,
    subjectCardInstanceId: "opponent-rear", cardInstanceId: "opponent-rear", targetCardInstanceIds: ["opponent-rear"], targetLocation: "rear-guard" });
  assert.equal(discover(fixture, wrongTarget).queued.length, 0);
});

test("unpayable Counter-Blast does not prompt; declining the optional cost has no effect", () => {
  const noCb = setup({ side: "bot", cbReady: false });
  assert.equal(discover(noCb).queued.length, 0);
  const declined = setup({ side: "bot" });
  assert.equal(discover(declined).queued.length, 1);
  const beforeDeck = declined.own.deck.map(card => card.uid);
  const beforeDamage = declined.own.damage.map(card => card.faceDown);
  const result = respond(declined, { accept: false });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(declined.own.damage.map(card => card.faceDown), beforeDamage);
  assert.deepEqual(declined.own.deck.map(card => card.uid), beforeDeck);
  assert.equal(declined.own.hand.length, 0);
});

test("the controller may choose no search target after paying, while shuffle still resolves", () => {
  const fixture = setup({ side: "human", includeLegalTarget: false });
  assert.equal(discover(fixture).queued.length, 1);
  const beforeDeck = new Set(fixture.own.deck.map(card => card.uid));
  const result = respond(fixture, { effectUid: null });
  assert.equal(result.ok, true, result.reason);
  assert.equal(fixture.own.damage[0].faceDown, true, "Counter-Blast is paid");
  assert.equal(fixture.own.hand.length, 0);
  assert.deepEqual(new Set(fixture.own.deck.map(card => card.uid)), beforeDeck);
});

test("the shared top-five handler reveals the selected legal card and shuffles once", () => {
  const definition = contributions[0], effect = definition.effects[0];
  const legal = cardInstance(candidateFor(definition.cardId).id, "direct-legal-top-five", "host");
  const other = cardInstance("cfa-1", "direct-unselected-top-five", "host");
  const player = { playerId: "host", deck: [other, legal], hand: [] };
  const events = [];
  let shuffleCalls = 0;
  const context = { player, side: "human", actorPlayerId: "host", effectUid: legal.uid,
    cardDefinitionForInstance: card => CARDS.get(String(card.cardId)),
    shuffleDeck(deck) { shuffleCalls++; deck.reverse(); },
    emitEvent(event) { events.push(event); } };
  const result = Engine.EFFECT_HANDLERS[effect.op].apply(effect, context);
  assert.equal(result.revealedCardUid, legal.uid);
  assert.deepEqual(player.hand.map(card => card.uid), [legal.uid]);
  assert.deepEqual(player.deck.map(card => card.uid), [other.uid]);
  assert.equal(shuffleCalls, 1);
  assert.ok(events.some(event => event.type === "card.revealed" && event.cardInstanceId === legal.uid));
});

test("the selected card must be a matching Grade 3+ clan card among the top five", () => {
  for (const cardId of FAMILY.keys()) {
    const valid = setup({ sourceCardId: cardId, side: "bot" });
    assert.equal(discover(valid).queued.length, 1);
    const target = valid.legal;
    const resolved = respond(valid, { effectUid: target.uid });
    assert.equal(resolved.ok, true, `${cardId}: ${resolved.reason || ""}`);
    assert.ok(valid.own.hand.some(card => card.uid === target.uid));
    assert.ok(resolved.events.some(event => event.type === "card.revealed" && event.cardInstanceId === target.uid));
    assert.ok(!valid.own.deck.some(card => card.uid === target.uid));

    const clan = FAMILY.get(cardId);
    const wrongClanDef = CATALOG.find(card => card.type === "Unit" && Number(card.grade) >= 3 && card.clan !== clan && !card.clans?.includes(clan));
    assert.ok(wrongClanDef, `wrong-clan target for ${cardId}`);
    const wrongClan = setup({ sourceCardId: cardId, side: "bot", topCardIds: [wrongClanDef.id] });
    assert.equal(discover(wrongClan).queued.length, 1);
    const before = JSON.stringify({ deck: wrongClan.own.deck, hand: wrongClan.own.hand, damage: wrongClan.own.damage });
    assert.equal(respond(wrongClan, { effectUid: wrongClan.own.deck[0].uid }).ok, false);
    assert.equal(JSON.stringify({ deck: wrongClan.own.deck, hand: wrongClan.own.hand, damage: wrongClan.own.damage }), before);

    const outside = setup({ sourceCardId: cardId, side: "bot", includeLegalTarget: false });
    const legalOutside = cardInstance(candidateFor(cardId).id, `outside-${cardId}`, outside.ownerId);
    outside.own.deck.push(legalOutside, ...Array.from({ length: 5 }, (_, i) => cardInstance("cfa-1", `filler-outside-${cardId}-${i}`, outside.ownerId)));
    assert.equal(discover(outside).queued.length, 1);
    const beforeOutside = JSON.stringify({ deck: outside.own.deck, hand: outside.own.hand, damage: outside.own.damage });
    assert.equal(respond(outside, { effectUid: legalOutside.uid }).ok, false, "a card below the top five cannot be selected");
    assert.equal(JSON.stringify({ deck: outside.own.deck, hand: outside.own.hand, damage: outside.own.damage }), beforeOutside);
  }
});

test("host and joining player use their own cost, deck, and hand; the other seat cannot resolve", () => {
  for (const side of ["human", "bot"]) {
    const fixture = setup({ side });
    assert.equal(discover(fixture).queued.length, 1);
    const illegalActor = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    const before = JSON.stringify(fixture.state);
    assert.equal(respond(fixture, { effectUid: fixture.legal.uid, actorAuthUid: illegalActor }).ok, false);
    assert.equal(JSON.stringify(fixture.state), before);
    const result = respond(fixture, { effectUid: fixture.legal.uid });
    assert.equal(result.ok, true, result.reason);
    assert.ok(fixture.own.hand.some(card => card.uid === fixture.legal.uid));
    assert.equal(fixture.enemy.hand.length, 0);
    assert.equal(fixture.own.damage[0].faceDown, true);
    assert.equal(fixture.enemy.damage.length, 0);
  }
});
