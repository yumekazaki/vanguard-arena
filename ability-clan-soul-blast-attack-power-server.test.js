"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1798", ["Genesis", 3, 4000]], ["cfa-520", ["Kagero", 1, 3000]],
  ["cfa-605", ["Spike Brothers", 1, 3000]], ["cfa-646", ["Royal Paladin", 1, 3000]],
  ["cfa-844", ["Narukami", 1, 3000]]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = "cfa-520", side = "human", overrides = {}) {
  const [clan, soulCost] = FAMILY.get(cardId);
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-own-attack-clan-soul-blast-power-battle-v1");
  assert.ok(ability, `${cardId} definition compiles`);
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "attacker", cardId, cardName: card.name, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, power: 10000 };
  const vanguard = { uid: "vg", cardId: "vg", cardName: "Clan Vanguard", clan: overrides.clan ?? clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: "opp-vg", cardId: "opp-vg", cardName: "Opponent Vanguard", clan: "Kagero", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const soul = Array.from({ length: overrides.soulCount ?? soulCost }, (_, i) => ({ uid: `soul-${i + 1}`, cardId: `soul-${i + 1}`, ownerPlayerId: ownerId, controllerPlayerId: ownerId }));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : opponentVanguard, rear: side === "human" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: [], soul: side === "human" ? soul : [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: [], soul: side === "bot" ? soul : [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = { matchId: "clan-sb-test", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId: "battle-1", attackerSide: side, attackerUid: source.uid, attackerPlayerId: ownerId, attackerZone: "rear-left", defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [source.uid], currentLocation: "rear-left", previousLocation: "rear-left",
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: "battle-1", phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, ability, source, ownerId, side, soul, clan, soulCost, power: FAMILY.get(cardId)[2] };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function decision(f, options = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: options.actionId || `clan-sb-${f.side}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { sb: options.soulUids || f.soul.slice(0, f.soulCost).map(card => card.uid) } } }
  }, seats, Engine);
}

test("all five exact catalog definitions retain their printed clan, Soul Blast, power and battle duration", () => {
  for (const [cardId, [clan, count, power]] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.kind, "AUTO", cardId);
    assert.equal(f.ability.trigger.eventType, "unit.attacked", cardId);
    assert.equal(f.ability.trigger.subject, "source", cardId);
    assert.deepEqual(f.ability.requiredLocation, ["vanguard", "rear-guard"], cardId);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }], cardId);
    assert.deepEqual(f.ability.costs, [{ type: "soul-blast", count }], cardId);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: power, duration: "battle" }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
  }
});

test("host and joining player each resolve their own exact attacker, pay their own Soul and gain battle power", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-520", side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decision(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.state.players[side].soul.length, 0);
    assert.equal(f.state.players[side].drop.length, 1);
    assert.equal(f.state.pendingAttack.power, 13000);
  }
});

test("printed amount and Soul Blast count resolve per card, including Genesis Soul Blast 3", () => {
  for (const cardId of FAMILY.keys()) {
    const f = fixture(cardId);
    assert.equal(discover(f).queued.length, 1, cardId);
    assert.equal(decision(f).ok, true, cardId);
    assert.equal(f.state.pendingAttack.power, 10000 + f.power, cardId);
    assert.equal(f.state.players[f.side].drop.length, f.soulCost, cardId);
  }
});

test("another unit's attack and a nonmatching Vanguard clan never queue this source ability", () => {
  const unrelated = fixture("cfa-520", "bot");
  unrelated.event = { ...unrelated.event, sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other", attackingCardInstanceIds: ["other"] };
  assert.equal(discover(unrelated).queued.length, 0);
  const wrongClan = fixture("cfa-520", "human", { clan: "Genesis" });
  assert.equal(discover(wrongClan).queued.length, 0);
});

test("insufficient Soul prevents a prompt and an invalid Soul selection rejects atomically", () => {
  const short = fixture("cfa-1798", "bot", { soulCount: 2 });
  assert.equal(discover(short).queued.length, 0);
  const invalid = fixture("cfa-1798");
  assert.equal(discover(invalid).queued.length, 1);
  const versionBefore = invalid.state.stateVersion;
  const result = decision(invalid, { soulUids: ["soul-1", "forged-soul", "soul-3"] });
  assert.equal(result.ok, false);
  assert.deepEqual(invalid.state.players[invalid.side].soul.map(card => card.uid), ["soul-1", "soul-2", "soul-3"]);
  assert.equal(invalid.state.pendingAttack.power, 10000);
  assert.equal(Boolean(invalid.state.processedActionIds?.includes("clan-sb-human")), false);
  assert.equal(invalid.state.stateVersion, versionBefore);
});

test("resolution rejects a changed clan, different battle, target, phase or attack window without partial effects", () => {
  const mutations = [
    f => { f.state.players[f.side].vanguard.clan = "Genesis"; },
    f => { f.state.pendingAttack.battleId = "other-battle"; },
    f => { f.state.pendingAttack.targetUid = "other-target"; },
    f => { f.event = { ...f.event, phase: "main" }; f.state.pendingAbility.eventContext.gameEvent = f.event; },
    f => { f.event = { ...f.event, timingWindow: "guard-step" }; f.state.pendingAbility.eventContext.gameEvent = f.event; }
  ];
  for (const mutate of mutations) {
    const f = fixture("cfa-520", "bot");
    assert.equal(discover(f).queued.length, 1);
    mutate(f);
    const result = decision(f);
    assert.equal(result.ok, false);
    assert.equal(f.state.players[f.side].soul.length, 1);
    assert.equal(f.state.players[f.side].drop.length, 0);
    assert.equal(f.state.pendingAttack.power, 10000);
  }
});

test("a definition with changed printed text is not enabled by the exact server allowlist", () => {
  const f = fixture("cfa-520");
  const tampered = { ...f.ability, definition: { ...f.ability.definition, printedText: f.ability.definition.printedText.replace("Kagero", "Genesis") } };
  assert.equal(Reducer.supportsServerAbilityEffects(tampered), false);
});
