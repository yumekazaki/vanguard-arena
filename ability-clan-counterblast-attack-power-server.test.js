"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1123", "Gold Paladin"], ["cfa-1234", "Bermuda Triangle"], ["cfa-1301", "Angel Feather"],
  ["cfa-1409", "Shadow Paladin"], ["cfa-1429", "Pale Moon"], ["cfa-1509", "Link Joker"],
  ["cfa-1521", "Dark Irregulars"], ["cfa-1604", "Nova Grappler"], ["cfa-1642", "Great Nature"],
  ["cfa-1669", "Kagero"], ["cfa-1758", "Neo Nectar"], ["cfa-1140", "Genesis"],
  ["cfa-1159", "Royal Paladin"], ["cfa-1170", "Narukami"], ["cfa-1187", "Spike Brothers"]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function fixture(cardId = "cfa-1123", side = "human", { clan = FAMILY.get(cardId), damageClan = clan, damageFaceDown = false, sourceAtVanguard = false } = {}) {
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-own-attack-clan-counter-blast-power-battle-v1");
  assert.ok(ability, `${cardId} ability is compiled`);
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: "attacker", cardId, cardName: card.name, clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, power: 10000 };
  const vanguard = { uid: "vg", cardId: "vg", cardName: "Test Vanguard", clan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: "opp-vg", cardId: "opp-vg", cardName: "Opponent Vanguard", clan: "Kagero", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const damage = [{ uid: "damage-1", cardId: "damage-1", clan: damageClan, ownerPlayerId: ownerId, controllerPlayerId: ownerId, faceDown: damageFaceDown }];
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? vanguard : opponentVanguard, rear: side === "human" ? [source, null, null, null, null] : Array(5).fill(null), damage: side === "human" ? damage : [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? vanguard : opponentVanguard, rear: side === "bot" ? [source, null, null, null, null] : Array(5).fill(null), damage: side === "bot" ? damage : [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const sourceZone = sourceAtVanguard ? "vanguard" : "rear-left";
  if (sourceAtVanguard) { players[side].vanguard = source; players[side].rear[0] = null; }
  if (clan !== FAMILY.get(cardId)) players[side].vanguard.clan = clan;
  const state = { matchId: "clan-attack-test", stateVersion: 1, turn: 2, side, phase: 5, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: { battleId: "battle-1", attackerSide: side, attackerPlayerId: ownerId, attackerUid: source.uid, attackerZone: sourceZone, defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 10000, targetPower: 30000, critical: 1 } };
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, attackingCardInstanceIds: [source.uid], currentLocation: sourceZone,
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId: "battle-1", phase: "battle", timingWindow: "attack-declared"
  });
  return { state, event, ability, source, ownerId, side, damage, cardText: card.text };
}

test("the exact family compiles only each printed clan, own-attack trigger, circle, cost, and battle duration", () => {
  for (const [cardId, clan] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.id, `${cardId}:0`, cardId);
    assert.ok(f.cardText.endsWith(f.ability.printedText), cardId);
    assert.equal(f.ability.kind, "AUTO", cardId);
    assert.equal(f.ability.definition.source.patternId, "auto-own-attack-clan-counter-blast-power-battle-v1", cardId);
    assert.equal(f.ability.trigger.eventType, "unit.attacked", cardId);
    assert.equal(f.ability.trigger.subject, "source", cardId);
    assert.deepEqual(f.ability.requiredLocation, ["vanguard", "rear-guard"], cardId);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }], cardId);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 1, filter: { clan } }], cardId);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: 4000, duration: "battle" }], cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
    if (["cfa-1140", "cfa-1159", "cfa-1170", "cfa-1187"].includes(cardId)) assert.equal(Engine.parseCardAbilitiesCached(catalog.find(item => item.id === cardId)).length, 1, cardId);
  }
});

test("the source controller alone receives the trigger and pays their clan-matching Damage", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-1123", side);
    const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(discovery.queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId);
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `clan-attack-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: ["damage-1"] } } }
    }, seats, Engine);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.damage[0].faceDown, true);
    assert.equal(f.state.pendingAttack.power, 14000);
  }
});

test("the four assigned cards prompt and resolve independently from VC and RC for both seats", () => {
  for (const cardId of ["cfa-1140", "cfa-1159", "cfa-1170", "cfa-1187"]) {
    for (const side of ["human", "bot"]) {
      for (const sourceAtVanguard of [false, true]) {
        const f = fixture(cardId, side, { sourceAtVanguard });
        const discovery = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
        assert.equal(discovery.queued.length, 1, `${cardId}/${side}/${sourceAtVanguard}`);
        assert.equal(f.state.pendingAbility.side, side, `${cardId}/${side}/${sourceAtVanguard}`);
        assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownerId, `${cardId}/${side}/${sourceAtVanguard}`);
        const wrongAuth = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
        const wrong = Reducer.applyAbilityDecision(f.state, {
          actorAuthUid: wrongAuth, actionId: `wrong-${cardId}-${side}-${sourceAtVanguard}`, expectedStateVersion: f.state.stateVersion,
          payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: ["damage-1"] } } }
        }, seats, Engine);
        assert.equal(wrong.ok, false, `${cardId}/${side}/${sourceAtVanguard} wrong player cannot resolve`);
        assert.equal(f.damage[0].faceDown, false, `${cardId}/${side}/${sourceAtVanguard} wrong player did not pay`);
        const result = Reducer.applyAbilityDecision(f.state, {
          actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
          actionId: `resolve-${cardId}-${side}-${sourceAtVanguard}`, expectedStateVersion: f.state.stateVersion,
          payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: ["damage-1"] } } }
        }, seats, Engine);
        assert.equal(result.ok, true, `${cardId}/${side}/${sourceAtVanguard}: ${result.reason}`);
        assert.equal(f.damage[0].faceDown, true, `${cardId}/${side}/${sourceAtVanguard} paid own damage`);
        assert.equal(f.state.pendingAttack.power, 14000, `${cardId}/${side}/${sourceAtVanguard} received source power`);
        assert.equal(f.source.power, 10000, `${cardId}/${side}/${sourceAtVanguard} battle-only modifier did not become permanent`);
      }
    }
  }
});

test("wrong-clan Damage cannot satisfy the cost and does not produce a prompt", () => {
  for (const cardId of ["cfa-1140", "cfa-1159", "cfa-1170", "cfa-1187"]) {
    const f = fixture(cardId, "bot", { damageClan: "Bermuda Triangle" });
    const result = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(result.queued.length, 0, cardId);
    assert.equal(f.state.pendingAbility || null, null, cardId);
    const noDamage = fixture(cardId, "human");
    noDamage.state.players.human.damage = [];
    assert.equal(Reducer.discoverAutoTriggers(noDamage.state, [noDamage.event], Engine).queued.length, 0, `${cardId} unavailable cost cannot prompt`);
    const faceDown = fixture(cardId, "human", { damageFaceDown: true });
    assert.equal(Reducer.discoverAutoTriggers(faceDown.state, [faceDown.event], Engine).queued.length, 0, `${cardId} face-down damage cannot pay`);
  }
});

test("the exact source must attack and its controller must still have the printed-clan Vanguard", () => {
  for (const cardId of ["cfa-1140", "cfa-1159", "cfa-1170", "cfa-1187"]) {
    const wrongSource = fixture(cardId, "bot");
    wrongSource.event = Engine.createGameEvent(wrongSource.state, {
      type: "unit.attacked", actingPlayerId: wrongSource.ownerId, turnPlayerId: wrongSource.ownerId,
      sourceCardInstanceId: "other-attacker", subjectCardInstanceId: "other-attacker", subjectControllerPlayerId: wrongSource.ownerId,
      attackingCardInstanceIds: ["other-attacker"], currentLocation: "rear-right", targetLocation: "vanguard", battleId: "other-battle"
    });
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [wrongSource.event], Engine).queued.length, 0, `${cardId} unrelated attack`);

    for (const side of ["human", "bot"]) {
      const wrongClanVanguard = fixture(cardId, side, { clan: "Bermuda Triangle" });
      assert.equal(Reducer.discoverAutoTriggers(wrongClanVanguard.state, [wrongClanVanguard.event], Engine).queued.length, 0, `${cardId}/${side} wrong Vanguard clan`);
    }
  }
});

test("wrong-clan payment selections are rejected without paying or applying the effect", () => {
  const f = fixture("cfa-1140", "bot", { damageClan: "Bermuda Triangle" });
  const player = { playerId: f.ownerId, damage: f.damage, soul: [], hand: [], drop: [], rear: [f.source] };
  const paid = Engine.payAbilityCosts(f.ability, { player, source: f.source, sourceZone: "rear-left", cardDefinitionForInstance: card => ({ clan: card.clan }) }, { cb: ["damage-1"] });
  assert.equal(paid.ok, false);
  assert.equal(paid.reason, "counter-blast-filter-not-met");
  assert.equal(f.damage[0].faceDown, false);
});

test("declining leaves damage and power untouched, while replays and stale versions cannot repeat a paid trigger", () => {
  const declined = fixture("cfa-1140", "bot");
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 0, "same event cannot queue twice");
  const no = Reducer.applyAbilityDecision(declined.state, {
    actorAuthUid: seats.guestAuthUid, actionId: "decline-genesis", expectedStateVersion: declined.state.stateVersion,
    payload: { type: "ability-response", accept: false, selection: { instanceUid: declined.source.uid, abilityId: declined.ability.id } }
  }, seats, Engine);
  assert.equal(no.ok, true, no.reason);
  assert.equal(declined.damage[0].faceDown, false);
  assert.equal(declined.state.pendingAttack.power, 10000);
  assert.equal(declined.state.pendingAbility, null);

  const paid = fixture("cfa-1187", "bot");
  assert.equal(Reducer.discoverAutoTriggers(paid.state, [paid.event], Engine).queued.length, 1);
  const command = {
    actorAuthUid: seats.guestAuthUid, actionId: "pay-spike-brothers", expectedStateVersion: paid.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: paid.source.uid, abilityId: paid.ability.id, costSelections: { cb: ["damage-1"] } } }
  };
  const resolved = Reducer.applyAbilityDecision(paid.state, command, seats, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(Reducer.applyAbilityDecision(paid.state, command, seats, Engine).reason, "duplicate-action");
  assert.equal(Reducer.applyAbilityDecision(paid.state, { ...command, actionId: "stale-spike-retry" }, seats, Engine).reason, "stale-state-version");
  assert.equal(paid.damage[0].faceDown, true);
  assert.equal(paid.state.pendingAttack.power, 14000);
});

test("acceptance revalidates the current clan Vanguard and exact battle before paying", () => {
  for (const change of ["vanguard-clan", "battle-id", "damage-clan"]) {
    const f = fixture("cfa-1170", "bot");
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
    if (change === "vanguard-clan") f.state.players.bot.vanguard.clan = "Kagero";
    else if (change === "battle-id") f.state.pendingAttack.battleId = "replacement-battle";
    else f.damage[0].clan = "Bermuda Triangle";
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: seats.guestAuthUid, actionId: `stale-${change}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: ["damage-1"] } } }
    }, seats, Engine);
    assert.equal(result.ok, false, change);
    assert.equal(f.damage[0].faceDown, false, change);
    assert.equal(f.state.pendingAttack.power, 10000, change);
    if (change !== "battle-id") {
      const declined = Reducer.applyAbilityDecision(f.state, {
        actorAuthUid: seats.guestAuthUid, actionId: `decline-after-${change}`, expectedStateVersion: f.state.stateVersion,
        payload: { type: "ability-response", accept: false, selection: { instanceUid: f.source.uid, abilityId: f.ability.id } }
      }, seats, Engine);
      assert.equal(declined.ok, true, `${change} can still be declined`);
      assert.equal(f.damage[0].faceDown, false, `${change} decline did not pay`);
      assert.equal(f.state.pendingAbility, null, `${change} decline clears the prompt`);
    }
  }
});

test("the attack modifier expires when its battle closes", () => {
  const f = fixture("cfa-1159", "human");
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1);
  const resolved = Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "resolve-royal-paladin", expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: ["damage-1"] } } }
  }, seats, Engine);
  assert.equal(resolved.ok, true, resolved.reason);
  assert.equal(f.state.pendingAttack.power, 14000);
  f.state.pendingAttack.defenderDone = true;
  f.state.pendingAttack.damageChecksStarted = true;
  f.state.pendingAttack.damageChecksRemaining = 0;
  const closed = Reducer.applyGameAction(f.state, {
    actorAuthUid: seats.hostAuthUid, actionId: "close-royal-battle", expectedStateVersion: f.state.stateVersion,
    payload: { type: "game-action", action: "resolveBattle" }
  }, seats, Engine);
  assert.equal(closed.ok, true, closed.reason);
  assert.equal(f.state.pendingAttack, null);
  assert.equal(f.source.power, 10000);
});
