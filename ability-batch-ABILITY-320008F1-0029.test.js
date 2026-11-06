"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const Worker = require("./supabase/functions/match-worker/worker-core.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const audit = require("./ability-contributions/batch-ABILITY-320008F1-0029.js");

const root = __dirname;
const batchId = "ABILITY-320008F1-0029";
const queuedAbilityCounts = new Map();
for (const batch of require("./ability-work-batches.json").batches) {
  for (const id of batch.abilityIds) queuedAbilityCounts.set(id, (queuedAbilityCounts.get(id) || 0) + 1);
}
const catalog = loadCatalog(root);
const cards = new Map(catalog.map(card => [String(card.id), card]));
const parsed = new Map(catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).map(ability => [ability.id, ability])));
const expectedSupportedIds = [
  "cfa-10774:0", "cfa-10775:0", "cfa-10775:1", "cfa-10776:0", "cfa-10777:0",
  "cfa-1077:0", "cfa-10781:0", "cfa-10781:1", "cfa-10825:0"
];

test("batch 0029 classifies all 38 exact abilities without changing production definitions", () => {
  assert.equal(audit.batchId, batchId);
  assert.equal(audit.abilityIds.length, 38);
  assert.equal(new Set(audit.abilityIds).size, 38);
  assert.ok(audit.abilityIds.every(id => queuedAbilityCounts.get(id) === 1), "historical audit IDs stay tracked exactly once after queue regrouping");
  assert.deepEqual([...audit.alreadySupportedAbilityIds].sort(), [...expectedSupportedIds].sort());
  assert.equal(audit.supportedDefinitions.length, 9);
  assert.equal(audit.unsupportedSiblings.length, 29);
  assert.deepEqual(audit.proposedDefinitions, []);
});

test("existing AUTO handlers and special CONT/ride paths are distinguished correctly", () => {
  const source = fs.readFileSync(path.join(root, "ability-server-reducer.js"), "utf8");
  for (const item of audit.supportedDefinitions) {
    const ability = parsed.get(item.abilityId);
    assert.ok(ability, item.abilityId);
    assert.equal(ability.cardId, item.abilityId.slice(0, item.abilityId.lastIndexOf(":")));
    assert.equal(item.printedText, ability.printedText);
    assert.equal(ability.definition.id, item.abilityId);
    if (item.supportMode === "authoritative-auto-resolution") {
      assert.equal(ability.kind, "AUTO", item.abilityId);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, item.abilityId);
    } else {
      assert.equal(ability.kind, "CONT", item.abilityId);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), false, item.abilityId);
      assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, item.abilityId);
    }
  }
  assert.deepEqual([...audit.supportedDefinitions.map(item => item.abilityId)].sort(), [...expectedSupportedIds].sort());

  const astrolabeTest = fs.readFileSync(path.join(root, "ability-messiah-any-player-locked-continuous-power-server.test.js"), "utf8");
  assert.match(astrolabeTest, /cfa-10775/);
  assert.match(astrolabeTest, /cfa-10777/);
  const rideTest = fs.readFileSync(path.join(root, "ability-candidate-320008f1-0007-named-vanguard-ride-restriction.test.js"), "utf8");
  assert.match(rideTest, /cfa-10825:0/);
  assert.match(source, /engine\.canRideCard\(serverCardDefinition\(rider\)/);
  assert.match(source, /evaluateContinuousShieldEffects\?\.\(suppression\.suppressed\?\[\]:serverReviewedAbilities\(instance, engine\)/);

  const astrolabe = parsed.get("cfa-10775:0");
  const noLock = Engine.evaluateContinuousEffects([astrolabe], {
    location: "rear-guard", isControllerTurn: true, anyFieldCardIsLocked: false,
    generationBreakCount: 2, sourceInstanceId: "source", targetInstanceId: "source"
  });
  const locked = Engine.evaluateContinuousEffects([astrolabe], {
    location: "rear-guard", isControllerTurn: true, anyFieldCardIsLocked: true,
    generationBreakCount: 2, sourceInstanceId: "source", targetInstanceId: "source"
  });
  assert.equal(noLock.power, 0);
  assert.equal(locked.power, 10000);
  assert.equal(Engine.evaluateContinuousEffects([astrolabe], {
    location: "rear-guard", isControllerTurn: true, anyFieldCardIsLocked: true,
    generationBreakCount: 1, sourceInstanceId: "source", targetInstanceId: "source"
  }).power, 0);

  const shield = parsed.get("cfa-10776:0");
  assert.equal(Engine.evaluateContinuousShieldEffects([shield], {
    location: "guardian", controllerVanguardCardNames: ["Alter Ego Messiah"]
  }).shield, 5000);
  assert.equal(Engine.evaluateContinuousShieldEffects([shield], {
    location: "guardian", controllerVanguardCardNames: ["Different Vanguard"]
  }).shield, 0);
  assert.equal(Engine.evaluateContinuousShieldEffects([shield], {
    location: "rear-guard", controllerVanguardCardNames: ["Alter Ego Messiah"]
  }).shield, 0);

  for (const id of ["cfa-10772:0", "cfa-10824:0"]) {
    const card = cards.get(id.slice(0, id.lastIndexOf(":")));
    assert.equal(Engine.canRideCard(card), false, id);
    const ability = parsed.get(id);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, id);
    assert.equal(audit.unsupportedSiblings.find(item => item.abilityId === id)?.trustedServerDefinition, false, id);
  }
});

function rideClaim(riderCardId, riderName, riderGrade, previousVanguardGrade, previousVanguardName) {
  const mkPlayer = playerId => ({
    playerId, vanguard: null, deck: [], hand: [], damage: [], rear: [], drop: [], soul: [], bind: [],
    orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: []
  });
  const state = {
    matchId: "batch-0029-ride", stateVersion: 2, processedActionIds: [], turn: 2, phase: 2, side: "bot",
    authoritySeats: { hostSide: "human", guestSide: "bot" }, pendingAttack: null, pendingAbility: null, pendingAbilities: [],
    players: { human: mkPlayer("host-player"), bot: mkPlayer("guest-player") }
  };
  state.players.bot.vanguard = {
    uid: "prior-vanguard", cardId: "cfa-ordinary-vanguard", cardName: previousVanguardName,
    grade: previousVanguardGrade, ownerPlayerId: "guest-player", controllerPlayerId: "guest-player"
  };
  state.players.bot.hand.push({
    uid: "ride-source", cardId: riderCardId, cardName: riderName, grade: riderGrade, unitCard: true,
    ownerPlayerId: "guest-player", controllerPlayerId: "guest-player"
  });
  return {
    state, hostAuthUid: "auth-host", guestAuthUid: "auth-guest", actorAuthUid: "auth-guest",
    actionId: "batch-0029-ride-action", expectedStateVersion: 2,
    payload: { type: "game-action", action: "ride", cardInstanceId: "ride-source" }
  };
}

test("the authoritative ride reducer enforces Zorga Masques grade and name restrictions", () => {
  const invalid = rideClaim("cfa-10825", "Teasing Spiritualist, Zorga Masques", 3, 3, "Grade 3 Different Vanguard");
  const before = JSON.stringify(invalid.state);
  const rejected = Reducer.applyGameAction(invalid.state, {
    actorAuthUid: invalid.actorAuthUid, actionId: invalid.actionId,
    expectedStateVersion: invalid.expectedStateVersion, payload: invalid.payload
  }, Worker.seatMapping(invalid), Engine);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "ride-restriction");
  assert.equal(JSON.stringify(invalid.state), before);

  const legal = rideClaim("cfa-10825", "Teasing Spiritualist, Zorga Masques", 3, 3, "Grade 3 Deep Sea Spiritualist, Zorga");
  const accepted = Reducer.applyGameAction(legal.state, {
    actorAuthUid: legal.actorAuthUid, actionId: legal.actionId,
    expectedStateVersion: legal.expectedStateVersion, payload: legal.payload
  }, Worker.seatMapping(legal), Engine);
  assert.equal(accepted.ok, true, accepted.reason);
});

test("all remaining abilities have exact catalog text and a concrete implementation blocker", () => {
  const supported = new Set(expectedSupportedIds);
  const blocked = new Map(audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(blocked.size, 29);
  for (const abilityId of audit.abilityIds) {
    const ability = parsed.get(abilityId);
    assert.ok(ability, abilityId);
    assert.equal(ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    assert.ok(cards.has(ability.cardId), abilityId);
    if (supported.has(abilityId)) continue;
    const item = blocked.get(abilityId);
    assert.ok(item, abilityId);
    assert.equal(item.catalogPrintedText, ability.printedText, abilityId);
    if (ability.definition) assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), false, abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, abilityId);
    assert.ok(item.blocker.length > 65, abilityId);
  }
  assert.deepEqual([...blocked.keys()].sort(), audit.abilityIds.filter(id => !supported.has(id)).sort());
});

test("official source reviews are only claimed for the abilities whose printed text was checked", () => {
  assert.equal(audit.officialTextReviews.length, 23);
  for (const item of audit.officialTextReviews) {
    assert.ok(audit.abilityIds.includes(item.abilityId), item.abilityId);
    assert.match(item.officialReference, /^https:\/\/en\.cf-vanguard\.com\/cardlist\//, item.abilityId);
    assert.ok(item.officialPrintedText.length > 30, item.abilityId);
    assert.equal(item.matchesCatalogText, true, item.abilityId);
    assert.equal(parsed.get(item.abilityId).printedText.length > 10, true, item.abilityId);
  }
  assert.equal(audit.officialTextReviewedAbilityIds.length, 23);
});
