"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const cardById = new Map(catalog.map(card => [String(card.id), card]));
const contributions = require("./ability-contributions/batch-ABILITY-76D8A0B8-0126.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerAbilityDefinitions(contributions);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const GP_UNITS = ["cfa-183", "cfa-184", "cfa-185", "cfa-186"];
const UNSUPPORTED = [
  ["cfa-2098:1", "The bundled ACT needs Counter Blast plus a four-unit filtered retire-to-Soul cost, then a filtered Legion ride and mate selection; those parts are not supported together as one validated activation."],
  ["cfa-2099:0", "The current manual power handler cannot choose and modify two Vanguard targets in one ability."],
  ["cfa-2105:2", "The cost needs a Rear-Guard whose card name matches either unit on the controller's Vanguard; no validated dynamic same-name cost handler is available."],
  ["cfa-2105:1", "The opponent must reveal ten Deck cards and choose grade 0 cards to call onto distinct selected opponent circles; that opponent-controlled multi-choice call sequence is unsupported."],
  ["cfa-2103:0", "No validated full-Deck Alfred search-and-ride handler supports this ACT and its conditional Vanguard power effect."],
  ["cfa-211:0", "The existing Deck-call filter cannot jointly require Grade 0, Gold Paladin, and normal-unit card type."],
  ["cfa-2107:0", "The trigger must match the exact boosted battle and the effect must retire its source, then search and call a Grade 1-or-less unit rested; no matching validated handler supports that sequence."],
  ["cfa-2106:1", "The ability needs up to two front-row stand targets constrained by a same-column back-row unit; the current validated stand handler has no such multi-target filter."],
  ["cfa-2102:1", "The search filter must use the card name of the previously selected Duo Rear-Guard after returning it; no current handler preserves that dynamic choice through search."],
  ["cfa-2129:0", "The current same-name Rear-Guard condition only supports the inverse no-other-copy case, not requiring another copy and granting battle power." ]
];

let sequence = 0;
function card(uid, cardId, playerId, extra = {}) {
  const row = cardById.get(String(cardId)) || {};
  return { uid, cardId: String(cardId), cardName: row.name || String(cardId), type: row.type || "Unit", grade: Number(row.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: row.type !== "Order", ...extra };
}
function player(playerId) {
  return { playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [], removed: [], crests: [] };
}
function abilityFor(cardId, abilityId) {
  const ability = Engine.parseCardAbilitiesCached(cardById.get(cardId)).find(item => item.id === abilityId);
  assert.ok(ability, `${abilityId} exists in the catalog and compiles`);
  return ability;
}
function ownHitFixture(side = "human", { targetZone = "vanguard", sourceZone = "vanguard", guardCount = 4, wrongClanAt = -1 } = {}) {
  const n = ++sequence;
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const defenderId = side === "human" ? "guest-player" : "host-player";
  const defenderSide = side === "human" ? "bot" : "human";
  const source = card(`source-${n}`, "cfa-210", ownerId);
  const ownVg = sourceZone === "vanguard" ? source : card(`own-vg-${n}`, "cfa-3", ownerId);
  const target = card(`target-${n}`, "cfa-3", defenderId);
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = ownVg;
  const rearSlots = sourceZone === "rear-guard" ? [0, 1, 3, 4] : [0, 1, 2, 3];
  if (sourceZone === "rear-guard") players[side].rear[2] = source;
  players[defenderSide].vanguard = target;
  const ownRear = [];
  for (let i = 0; i < guardCount; i++) {
    const id = i === wrongClanAt ? "cfa-2064" : GP_UNITS[i % GP_UNITS.length];
    const unit = card(`gp-${n}-${i}`, id, ownerId);
    players[side].rear[rearSlots[i]] = unit;
    ownRear.push(unit);
  }
  const deckTop = card(`draw-${n}`, "cfa-2", ownerId);
  const deckNext = card(`next-${n}`, "cfa-4", ownerId);
  players[side].deck = [deckNext, deckTop];
  const battleId = `hit-${n}`;
  const attackerZone = sourceZone === "vanguard" ? "vanguard" : "rear-guard";
  const state = { matchId: `ability-batch-0126-hit-${n}`, stateVersion: 1, eventSequence: 0, turn: 4, phase: "battle", side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    players, pendingAttack: { battleId, attackerUid: source.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone,
      defenderSide, targetUid: target.uid, targetZone: targetZone === "vanguard" ? "vanguard" : "rear-left", power: 20000, targetPower: 10000, critical: 1 } };
  if (targetZone !== "vanguard") players[defenderSide].rear[0] = target;
  const event = Engine.createGameEvent(state, { type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: target.uid, subjectCardInstanceId: target.uid, subjectOwnerPlayerId: defenderId, subjectControllerPlayerId: defenderId,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone === "vanguard" ? "vanguard" : "rear-left",
    attackingUnitInstanceId: source.uid, currentLocation: attackerZone, previousLocation: attackerZone,
    battleId, phase: "battle", timingWindow: "attack-hit" });
  return { state, ability: abilityFor("cfa-210", "cfa-210:0"), source, target, ownRear, deckTop, deckNext, side, ownerId, defenderId, event };
}
function placedFixture(side = "human", phase = "battle") {
  const n = ++sequence;
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const otherId = side === "human" ? "guest-player" : "host-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = card(`jumbo-${n}`, "cfa-2117", ownerId, { circle: "rear-right" });
  const ownVg = card(`vg-${n}`, "cfa-3", ownerId);
  const oppVg = card(`opp-vg-${n}`, "cfa-3", otherId);
  const soulTop = card(`soul-top-${n}`, "cfa-2", ownerId);
  const deckNext = card(`deck-next-${n}`, "cfa-4", ownerId);
  const down = card(`damage-down-${n}`, "cfa-5", ownerId, { faceDown: true });
  const up = card(`damage-up-${n}`, "cfa-6", ownerId, { faceDown: false });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = ownVg;
  players[side].rear[1] = source;
  players[side].deck = [deckNext, soulTop];
  players[side].damage = [down, up];
  players[opponentSide].vanguard = oppVg;
  const state = { matchId: `ability-batch-0126-placement-${n}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: phase === "battle" ? 5 : 4, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, players };
  const event = Engine.createGameEvent(state, { type: "card.placed", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    previousLocation: "hand", currentLocation: "rear-right", circle: "rear-right", phase, timingWindow: "effect-rear-placement" });
  return { state, ability: abilityFor("cfa-2117", "cfa-2117:0"), source, soulTop, deckNext, down, up, side, ownerId, otherId, opponentSide, event };
}
function resolve(f, authUid, selection = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId: `resolve-${f.source.uid}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...selection } } }, seats, Engine);
}

test("the two included IDs match the exact catalog text and supported effect handlers", () => {
  const hit = abilityFor("cfa-210", "cfa-210:0");
  const placed = abilityFor("cfa-2117", "cfa-2117:0");
  assert.equal(hit.printedText, "AUTO [VC/RC]: When this unit’s attack hits a vanguard, if the number of other «Gold Paladin» rear-guards you have is four or more, draw a card.");
  assert.deepEqual(hit.requiredLocation, ["vanguard", "rear-guard"]);
  assert.equal(hit.trigger.subject, "source");
  assert.equal(hit.trigger.targetLocation, "vanguard");
  assert.deepEqual(hit.conditions, [{ type: "controller-other-rear-guards-of-clan-at-least", count: 4, clan: "Gold Paladin" }]);
  assert.deepEqual(hit.effects, [{ op: "draw", count: 1 }]);
  assert.equal(Reducer.supportsServerAbilityEffects(hit), true);
  assert.equal(placed.printedText, "AUTO: During your battle phase, when this unit is placed on RC, Soul Charge 1, choose a card from your damage zone, and turn it face up. (Counter Charge 1)");
  assert.deepEqual(placed.requiredLocation, ["rear-guard"]);
  assert.deepEqual(placed.effects, [{ op: "soul-charge", count: 1 }, { op: "counter-charge", count: 1 }]);
  assert.equal(placed.trigger.requiredPhase, "battle");
  assert.equal(placed.trigger.requiredTimingWindow, undefined);
  assert.equal(Reducer.supportsServerAbilityEffects(placed), true);
});

test("Providence Strategist draws for the correct controller after its own attack hits a Vanguard", () => {
  for (const side of ["human", "bot"]) for (const sourceZone of ["vanguard", "rear-guard"]) {
    const f = ownHitFixture(side, { sourceZone });
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1, `${side}: ${JSON.stringify(found)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0, "event replay is deduplicated");
    const result = resolve(f, side === "human" ? seats.hostAuthUid : seats.guestAuthUid);
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].hand, [f.deckTop]);
    assert.deepEqual(f.state.players[side].deck, [f.deckNext]);
    assert.equal(f.state.players[side === "human" ? "bot" : "human"].hand.length, 0);
  }
});

test("Providence Strategist rejects another attacker, a non-Vanguard target, or fewer than four other Gold Paladin Rear-Guards", () => {
  const otherAttacker = ownHitFixture();
  otherAttacker.event = Engine.createGameEvent(otherAttacker.state, { ...otherAttacker.event, eventId: undefined,
    sourceCardInstanceId: otherAttacker.ownRear[0].uid, attackingUnitInstanceId: otherAttacker.ownRear[0].uid });
  assert.equal(Reducer.discoverAutoTriggers(otherAttacker.state, [otherAttacker.event], Engine).queued.length, 0);

  const rearguardTarget = ownHitFixture("human", { targetZone: "rear-guard" });
  assert.equal(Reducer.discoverAutoTriggers(rearguardTarget.state, [rearguardTarget.event], Engine).queued.length, 0);

  for (const options of [{ guardCount: 3 }, { guardCount: 4, wrongClanAt: 3 }]) {
    const f = ownHitFixture("human", options);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  }
});

test("a host cannot resolve Providence Strategist for the joining player", () => {
  const f = ownHitFixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  assert.equal(resolve(f, seats.hostAuthUid).ok, false);
  assert.equal(JSON.stringify(f.state), before);
});

test("Jumbo the Stungun resolves Soul Charge then the controller-selected Counter Charge in its own Battle Phase", () => {
  for (const side of ["human", "bot"]) {
    const f = placedFixture(side);
    const found = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(found.queued.length, 1, `${side}: ${JSON.stringify(found)}`);
    assert.equal(f.state.pendingAbility.side, side);
    const result = resolve(f, side === "human" ? seats.hostAuthUid : seats.guestAuthUid, { damageUids: [f.down.uid] });
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(f.state.players[side].soul, [f.soulTop]);
    assert.deepEqual(f.state.players[side].deck, [f.deckNext]);
    assert.equal(f.down.faceDown, false);
    assert.equal(f.up.faceDown, false);
    assert.equal(f.state.players[f.opponentSide].soul.length, 0);
  }
});

test("Jumbo requires a Rear-Guard placement during its controller's Battle Phase", () => {
  const mainPhase = placedFixture("human", "main");
  assert.equal(Reducer.discoverAutoTriggers(mainPhase.state, [mainPhase.event], Engine).queued.length, 0);

  const wrongCircle = placedFixture();
  const guardian = Engine.createGameEvent(wrongCircle.state, { ...wrongCircle.event, eventId: "wrong-circle", currentLocation: "guardian", circle: "guardian" });
  assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [guardian], Engine).queued.length, 0);

  const unrelated = placedFixture();
  const other = card(`other-${sequence + 1}`, "cfa-183", unrelated.ownerId, { circle: "rear-left" });
  unrelated.state.players[unrelated.side].rear[0] = other;
  const otherPlaced = Engine.createGameEvent(unrelated.state, { ...unrelated.event, eventId: "other-card-placement",
    sourceCardInstanceId: other.uid, sourceOwnerPlayerId: unrelated.ownerId, sourceControllerPlayerId: unrelated.ownerId,
    cardInstanceId: other.uid, subjectCardInstanceId: other.uid, subjectOwnerPlayerId: unrelated.ownerId, subjectControllerPlayerId: unrelated.ownerId,
    currentLocation: "rear-left", circle: "rear-left" });
  assert.equal(Reducer.discoverAutoTriggers(unrelated.state, [otherPlaced], Engine).queued.length, 0);
});

test("Jumbo's joining-player prompt is private and an invalid damage target cannot partially resolve it", () => {
  const f = placedFixture("bot");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const before = JSON.stringify(f.state);
  assert.equal(resolve(f, seats.hostAuthUid, { damageUids: [f.down.uid] }).ok, false);
  assert.equal(JSON.stringify(f.state), before);

  assert.equal(resolve(f, seats.guestAuthUid, { damageUids: ["not-your-damage-card"] }).ok, false);
  assert.equal(f.soulTop.uid, f.state.players.bot.deck.at(-1).uid);
  assert.equal(f.down.faceDown, true);
  assert.equal(f.state.players.bot.soul.length, 0);
});

test("the other ten batch IDs are left out with explicit current handler blockers", () => {
  assert.equal(UNSUPPORTED.length, 10);
  assert.deepEqual(UNSUPPORTED.map(([id]) => id).sort(), [
    "cfa-2098:1", "cfa-2099:0", "cfa-2102:1", "cfa-2103:0", "cfa-2105:1", "cfa-2105:2",
    "cfa-2106:1", "cfa-2107:0", "cfa-211:0", "cfa-2129:0"
  ]);
  assert.deepEqual(contributions.map(definition => definition.id).sort(), ["cfa-210:0", "cfa-2117:0"]);
  assert.ok(UNSUPPORTED.every(([, blocker]) => blocker.length > 50));
});

