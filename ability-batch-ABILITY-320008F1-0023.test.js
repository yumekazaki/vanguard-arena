"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0023.js");
Engine.registerAbilityDefinitions(audit.proposedDefinitions);

const parsed = new Map();
for (const card of loadCatalog()) {
  for (const ability of Engine.parseCardAbilitiesCached(card)) parsed.set(ability.id, ability);
}

test("all 38 reserved IDs have exact catalog text and an explicit support or blocker result", () => {
  const assignment = require("./ability-work-batches.json").batches
    .find(batch => batch.batchId === audit.batchId);
  assert.ok(assignment);
  assert.deepEqual([...assignment.abilityIds].sort(), [...audit.abilityIds].sort());
  assert.equal(audit.abilityIds.length, 38);
  assert.equal(new Set(audit.abilityIds).size, 38);
  assert.deepEqual(audit.alreadySupportedAbilityIds, ["cfa-10622:0", "cfa-1062:0", "cfa-1062:1"]);
  assert.equal(audit.supportedDefinitions.length, 3);
  assert.equal(audit.unsupportedAbilities.length, 34);
  assert.equal(audit.proposedDefinitions.length, 1);
  assert.deepEqual(audit.proposedDefinitions.map(definition => definition.id), ["cfa-10602:0"]);

  const supported = new Set(audit.alreadySupportedAbilityIds);
  const proposed = new Map(audit.proposedDefinitions.map(definition => [definition.id, definition]));
  const blocked = new Map(audit.unsupportedAbilities.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 34);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, `missing parsed catalog ability ${abilityId}`);
    assert.equal(ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")), abilityId);
    assert.equal(typeof ability.printedText, "string");
    assert.ok(ability.printedText.length > 10, abilityId);
    if (supported.has(abilityId)) {
      assert.ok(ability.definition, `${abilityId} is expected to remain supported`);
      assert.equal(ability.definition.id, abilityId);
      assert.equal(ability.definition.cardId, ability.cardId);
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.equal(blocked.has(abilityId), false);
    } else if (proposed.has(abilityId)) {
      assert.deepEqual(ability.definition, proposed.get(abilityId));
      assert.equal(ability.definition.printedText, ability.printedText);
      assert.equal(blocked.has(abilityId), false);
    } else {
      assert.equal(ability.definition, null, `${abilityId} must remain unsupported`);
      assert.equal(typeof blocked.get(abilityId)?.blocker, "string", abilityId);
      assert.ok(blocked.get(abilityId).blocker.length > 40, abilityId);
      assert.equal(blocked.get(abilityId).catalogPrintedText, ability.printedText);
    }
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id) && !proposed.has(id)).sort());
});

test("the three existing production entries remain distinct from Cider's new reviewed definition", () => {
  const expected = new Map([
    ["cfa-10622:0", "auto-rc-placement-counter-blast-place-dragontree-marker-v1"],
    ["cfa-1062:0", "auto-forerunner-same-clan-ride-call-source-v1"],
    ["cfa-1062:1", "act-source-to-soul-optional-up-to-one-friendly-power-v1"]
  ]);
  for (const definition of audit.supportedDefinitions) {
    assert.equal(definition.definitionSource, expected.get(definition.abilityId));
    assert.equal(parsed.get(definition.abilityId).definition.printedText, definition.printedText);
  }
  assert.deepEqual(audit.proposedDefinitions.map(definition => definition.id), ["cfa-10602:0"]);
  assert.equal(audit.alreadySupportedAbilityIds.includes("cfa-10602:0"), false);
});

test("official source checks are linked to Bushiroad entries and do not imply blocked text is compiled", () => {
  assert.equal(audit.verifiedOfficialAbilities.length, 5);
  for (const item of audit.verifiedOfficialAbilities) {
    assert.ok(audit.abilityIds.includes(item.abilityId));
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\/\?cardno=/);
    assert.ok(item.officialPrintedText.length > 25);
  }
  for (const item of audit.verifiedOfficialAbilities) {
    if (audit.alreadySupportedAbilityIds.includes(item.abilityId)) continue;
    assert.equal(parsed.get(item.abilityId).definition, null, `${item.abilityId} must not be promoted from source check alone`);
  }
});

const Reducer = require("./ability-server-reducer.js");
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => item.id === cardId);
  return { uid, cardId, cardName: definition?.name || cardId, grade: Number(definition?.grade || 0), ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
function battleFixture(side = "human", options = {}) {
  const playerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = opponentSide === "human" ? "host-player" : "guest-player";
  const source = card("cfa-10602", `source-${side}`, playerId, { zone: "rear-guard", circle: "rear-left", rested: true, faceUp: true });
  const otherBooster = options.otherBooster ? card("cfa-2", `other-booster-${side}`, playerId, { zone: "rear-guard", circle: "rear-right", rested: true }) : null;
  const attacker = card(options.minerva === false ? "cfa-1" : "cfa-10601", `attacker-${side}`, playerId, { zone: "vanguard", circle: "vanguard", power: 15000, rested: true });
  const target = card("cfa-14", `target-${side}`, opponentId, { zone: "vanguard", circle: "vanguard", power: 25000 });
  const makePlayer = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: makePlayer("host-player"), bot: makePlayer("guest-player") };
  players[side].vanguard = attacker;
  players[side].rear[0] = source;
  if (otherBooster) players[side].rear[1] = otherBooster;
  players[opponentSide].vanguard = target;
  const battleId = `minerva-close-${side}`;
  const state = {
    matchId: "batch-0023-minerva-close", stateVersion: 1, turn: 4, phase: 5, side,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, scheduledEffects: [], players,
    pendingAttack: {
      battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: playerId,
      attackerZone: "vanguard", targetUid: target.uid, targetZone: "vanguard", defenderSide: opponentSide,
      power: 15000, targetPower: 25000, critical: 1, boostUid: otherBooster?.uid || source.uid,
      boostPower: 5000, blocked: true, defenderDone: true, driveChecksRemaining: 0,
      awaitingDrive: false, damageChecksStarted: false, closing: false
    }
  };
  return { state, source, attacker, target, side, playerId, ability: Engine.parseCardAbilities(catalog.find(item => item.id === "cfa-10602")).find(item => item.id === "cfa-10602:0") };
}
function closeBattle(fixture) {
  const actorAuthUid = fixture.side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid, actionId: `close-${fixture.side}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { action: "resolveBattle" }
  }, seats, Engine);
}
function decide(fixture, actorAuthUid, accept) {
  return Reducer.applyAbilityDecision(fixture.state, {
    actorAuthUid, actionId: `resolve-${fixture.side}-${accept}`, expectedStateVersion: fixture.state.stateVersion,
    payload: { accept, selection: { instanceUid: fixture.source.uid, abilityId: "cfa-10602:0" } }
  }, seats, Engine);
}

test("Cider returns only the exact booster at the end of its controller's Minerva battle for either seat", () => {
  for (const side of ["human", "bot"]) {
    const fixture = battleFixture(side);
    const closed = closeBattle(fixture);
    assert.equal(closed.ok, true, JSON.stringify(closed));
    assert.ok(closed.events.some(event => event.type === "battle.close-step" && event.boosterCardInstanceId === fixture.source.uid));
    assert.equal(fixture.state.pendingAbility?.side, side);
    assert.equal(fixture.state.pendingAbility?.triggerControllerPlayerId, fixture.playerId);
    assert.equal(Reducer.supportsServerAbilityEffects(fixture.state.pendingAbility.ability), true);
    const opponentAuth = side === "human" ? seats.guestAuthUid : seats.hostAuthUid;
    assert.equal(decide(fixture, opponentAuth, true).ok, false);
    assert.equal(fixture.state.pendingAbility?.side, side);
    const ownAuth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const resolved = decide(fixture, ownAuth, true);
    assert.equal(resolved.ok, true, JSON.stringify(resolved));
    assert.equal(fixture.state.players[side].rear.some(item => item?.uid === fixture.source.uid), false);
    assert.ok(fixture.state.players[side].hand.some(item => item.uid === fixture.source.uid));
    assert.equal(fixture.state.players[opponentSide(side)].hand.some(item => item.uid === fixture.source.uid), false);
  }
});

function opponentSide(side) { return side === "human" ? "bot" : "human"; }

test("Cider does not prompt if another unit boosted or the controller lacks a Minerva Vanguard", () => {
  for (const fixture of [battleFixture("human", { otherBooster: true }), battleFixture("bot", { otherBooster: true }), battleFixture("human", { minerva: false }), battleFixture("bot", { minerva: false })]) {
    const result = closeBattle(fixture);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fixture.state.pendingAbility, null);
    assert.equal(fixture.state.pendingAbilities.length, 0);
    assert.ok(fixture.state.players[fixture.side].rear.some(item => item?.uid === fixture.source.uid));
  }
});

test("Cider ignores a battle event outside the battle-close timing window", () => {
  for (const side of ["human", "bot"]) {
    const fixture = battleFixture(side);
    const event = Engine.createGameEvent(fixture.state, {
      type: "battle.close-step", actingPlayerId: fixture.playerId, turnPlayerId: fixture.playerId,
      sourceCardInstanceId: fixture.attacker.uid, sourceControllerPlayerId: fixture.playerId,
      boosterCardInstanceId: fixture.source.uid, boostedCardInstanceId: fixture.attacker.uid,
      subjectCardInstanceId: fixture.attacker.uid, subjectControllerPlayerId: fixture.playerId,
      targetCardInstanceIds: [fixture.target.uid], battleId: fixture.state.pendingAttack.battleId,
      phase: "battle", timingWindow: "battle-close-cleanup"
    });
    const discovered = Reducer.discoverAutoTriggers(fixture.state, [event], Engine);
    assert.equal(discovered.queued.length, 0, JSON.stringify(discovered));
    assert.equal(fixture.state.pendingAbility, null);
  }
});

test("the optional Cider AUTO can be declined without moving the source", () => {
  for (const side of ["human", "bot"]) {
    const fixture = battleFixture(side);
    assert.equal(closeBattle(fixture).ok, true);
    const ownAuth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = decide(fixture, ownAuth, false);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(fixture.state.players[side].rear.some(item => item?.uid === fixture.source.uid));
    assert.equal(fixture.state.players[side].hand.some(item => item?.uid === fixture.source.uid), false);
  }
});
