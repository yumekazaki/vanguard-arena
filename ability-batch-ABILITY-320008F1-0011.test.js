"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const contribution = require("./ability-contributions/batch-ABILITY-320008F1-0011.js");

const expected = [
  "cfa-10288:0", "cfa-10288:1", "cfa-10289:0", "cfa-10289:1", "cfa-10290:0",
  "cfa-10291:0", "cfa-10291:1", "cfa-10292:0", "cfa-10293:0", "cfa-10294:0",
  "cfa-10295:0", "cfa-10296:0", "cfa-10296:1", "cfa-10297:0", "cfa-10298:0",
  "cfa-10299:0", "cfa-1029:0", "cfa-1029:1", "cfa-1029:2", "cfa-10300:0",
  "cfa-10302:0", "cfa-10303:0", "cfa-10304:0", "cfa-10304:1", "cfa-10305:0",
  "cfa-10305:1", "cfa-10308:0", "cfa-10309:0", "cfa-10310:0", "cfa-10311:0",
  "cfa-10312:0", "cfa-1031:0", "cfa-103:0"
];
const supportedIds = ["cfa-1029:0", "cfa-1029:1", "cfa-10288:0", "cfa-10308:0", "cfa-103:0"];
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const abilities = new Map();
for (const card of catalog) for (const ability of Engine.parseCardAbilitiesCached(card)) abilities.set(ability.id, { card, ability });

test("batch 0011 classifies exactly its 33 assigned abilities across 25 cards", () => {
  assert.deepEqual(contribution.audit.abilityIds, expected);
  assert.equal(new Set(expected).size, 33);
  assert.equal(contribution.audit.cards.length, 25);
  assert.deepEqual(contribution.audit.alreadySupportedAbilityIds, supportedIds);
  assert.deepEqual(contribution.audit.proposedDefinitionIds, []);
  assert.deepEqual(contribution.audit.implementedAbilityIds, []);
  assert.equal(contribution.audit.unsupportedSiblings.length, 28);
  assert.equal(contribution.length, 0);
  assert.equal(contribution.audit.status, "five-existing-definitions-28-blocked");
});

test("every ability retains its exact catalog text and every unsupported ability fails closed", () => {
  const supported = new Set(supportedIds);
  const blockers = new Map(contribution.audit.unsupportedSiblings.map(item => [item.abilityId, item]));
  assert.equal(supported.size + blockers.size, expected.length);
  for (const abilityId of expected) {
    const found = abilities.get(abilityId);
    assert.ok(found, `${abilityId} parses from its assigned card`);
    assert.ok(found.card.text.includes(found.ability.printedText), `${abilityId} retains exact catalog text`);
    assert.equal(found.ability.cardId, abilityId.slice(0, abilityId.lastIndexOf(":")));
    if (supported.has(abilityId)) {
      assert.ok(found.ability.definition, `${abilityId} has a compiled production definition`);
      continue;
    }
    const blocked = blockers.get(abilityId);
    assert.ok(blocked, `${abilityId} has one blocker record`);
    assert.equal(blocked.kind, found.ability.kind);
    assert.equal(blocked.catalogPrintedText, found.ability.printedText);
    assert.ok(blocked.blocker.length > 80, `${abilityId} names the missing rule/effect behavior`);
    assert.equal(found.ability.definition, null, `${abilityId} is not guessed or compiled`);
    assert.equal(Reducer.supportsServerAbilityEffects(found.ability), false, `${abilityId} cannot resolve as a server effect`);
    if (found.ability.kind === "AUTO") assert.equal(Engine.autoAbilityReadiness(found.ability).ok, false, abilityId);
    if (found.ability.kind === "ACT") assert.equal(Engine.canActivateManualAbility(found.ability, {}).ok, false, abilityId);
    if (found.ability.kind === "CONT") assert.equal(Engine.isManuallyActivatable(found.ability), false, abilityId);
  }
});

test("the three supported effect definitions use trusted server paths and have both-seat regression coverage", () => {
  const expectedPatterns = {
    "cfa-1029:0": "auto-forerunner-same-clan-ride-call-source-v1",
    "cfa-10288:0": "auto-order-zone-placement-draw-v1",
    "cfa-10308:0": "auto-rc-placement-named-vanguard-soul-charge-power-v1"
  };
  for (const [abilityId, pattern] of Object.entries(expectedPatterns)) {
    const ability = abilities.get(abilityId).ability;
    assert.equal(ability.definition.source.patternId, pattern);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, abilityId);
    assert.equal(Engine.isManuallyActivatable(ability), false, `${abilityId} AUTO is not manual`);
  }
  const forerunner = require("node:fs").readFileSync("ability-batch-forerunner-same-clan-ride-call.test.js", "utf8");
  const orderDraw = require("node:fs").readFileSync("ability-auto-order-zone-placement-draw-server.test.js", "utf8");
  const lilfaPlacement = require("node:fs").readFileSync("ability-rc-named-vanguard-soul-charge-power-server.test.js", "utf8");
  assert.match(forerunner, /every catalog Forerunner resolves from its own Soul for both host and joining player/i);
  assert.match(orderDraw, /host and joining player receive and resolve only their own exact Order Zone draw/i);
  assert.match(lilfaPlacement, /each exact source resolves Soul Charge then its power for its own controller on both seats/i);
});

const dabidSeats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const dabidAbility = abilities.get("cfa-103:0").ability;
function dabidFixture(side, { faceUpCost = true, otherAttacker = false } = {}) {
  const ownerId = side === "human" ? "player-host" : "player-guest";
  const enemyId = side === "human" ? "player-guest" : "player-host";
  const source = { uid: `dabid-${side}`, cardId: "cfa-103", ownerPlayerId: ownerId, controllerPlayerId: ownerId, power: 9000, unitCard: true };
  const other = { uid: `other-attacker-${side}`, cardId: "cfa-14", ownerPlayerId: ownerId, controllerPlayerId: ownerId, power: 10000, unitCard: true };
  const attacker = otherAttacker ? other : source;
  const enemy = { uid: `enemy-vg-${side}`, cardId: "cfa-3", grade: 3, ownerPlayerId: enemyId, controllerPlayerId: enemyId };
  const payment = { uid: `damage-${side}`, cardId: "cfa-2", faceDown: !faceUpCost, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
  const player = id => ({ playerId: id, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("player-host"), bot: player("player-guest") };
  players[side].vanguard = otherAttacker ? { uid: `own-vg-${side}`, cardId: "cfa-14", grade: 3, ownerPlayerId: ownerId, controllerPlayerId: ownerId } : source;
  if (otherAttacker) players[side].rear[0] = other;
  players[side].damage.push(payment);
  players[side === "human" ? "bot" : "human"].vanguard = enemy;
  const battleId = `dabid-battle-${side}`;
  const state = { matchId: `dabid-${side}`, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null, side, turn: 2, phase: 5, players,
    pendingAttack: { battleId, attackerUid: attacker.uid, attackerSide: side, attackerPlayerId: ownerId, attackerZone: otherAttacker ? "rear-left" : "vanguard", targetUid: enemy.uid, targetZone: "vanguard", defenderSide: side === "human" ? "bot" : "human", power: 9000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId,
    attackingCardInstanceIds: [attacker.uid], currentLocation: state.pendingAttack.attackerZone, previousLocation: state.pendingAttack.attackerZone,
    targetCardInstanceIds: [enemy.uid], targetLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, source, attacker, enemy, payment, event, side, ownerId };
}
function dabidDecision(f, { accept = true, authUid = f.side === "human" ? dabidSeats.hostAuthUid : dabidSeats.guestAuthUid, actionId = `dabid-${f.side}-${accept}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection: { instanceUid: f.source.uid, abilityId: dabidAbility.id, costSelections: { cb: accept ? [f.payment.uid] : [] } } } }, dabidSeats, Engine);
}

test("Key Anchor, Dabid preserves its exact optional Counter-Blast 1 attack ability", () => {
  const ability = dabidAbility;
  assert.equal(ability.printedText, abilities.get("cfa-103:0").ability.printedText);
  assert.equal(ability.canDecline, true);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]);
  assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true);
  assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
});

test("Key Anchor's exact attacking instance prompts and resolves for its own controller on both seats", () => {
  for (const side of ["human", "bot"]) {
    const f = dabidFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 1, side);
    assert.equal(f.state.pendingAbility.side, side, `${side} owns its own prompt`);
    const wrongAuth = side === "human" ? dabidSeats.guestAuthUid : dabidSeats.hostAuthUid;
    assert.equal(dabidDecision(f, { authUid: wrongAuth, actionId: `dabid-wrong-${side}` }).ok, false, `${side} rejects the other player`);
    const result = dabidDecision(f);
    assert.equal(result.ok, true, `${side}: ${result.reason}`);
    assert.equal(f.payment.faceDown, true, `${side} pays their own Counter-Blast`);
    assert.equal(f.source.turnPowerBoost, 3000, `${side} receives the power`);
    assert.equal(f.source.turnPowerExpiry, f.ownerId, `${side} power expires with its controller's turn`);
    assert.equal(f.enemy.turnPowerBoost || 0, 0, `${side} opponent does not receive the effect`);
  }
});

test("Key Anchor cannot trigger from another unit's attack, cannot pay unavailable cost, and can decline", () => {
  for (const side of ["human", "bot"]) {
    const otherAttack = dabidFixture(side, { otherAttacker: true });
    assert.equal(Reducer.discoverAutoTriggers(otherAttack.state, [otherAttack.event], Engine).queued.length, 0, `${side}: another source attacked`);
    const noCounterBlast = dabidFixture(side, { faceUpCost: false });
    assert.equal(Reducer.discoverAutoTriggers(noCounterBlast.state, [noCounterBlast.event], Engine).queued.length, 1, `${side}: its attack still makes the optional AUTO eligible`);
    const beforeUnaffordable = JSON.stringify({ source: noCounterBlast.source, payment: noCounterBlast.payment });
    assert.equal(dabidDecision(noCounterBlast).ok, false, `${side}: unavailable Counter-Blast cannot be paid`);
    assert.equal(JSON.stringify({ source: noCounterBlast.source, payment: noCounterBlast.payment }), beforeUnaffordable, `${side}: failed cost does not partially resolve`);
    const declined = dabidFixture(side);
    assert.equal(Reducer.discoverAutoTriggers(declined.state, [declined.event], Engine).queued.length, 1);
    assert.equal(dabidDecision(declined, { accept: false }).ok, true);
    assert.equal(declined.payment.faceDown, false, `${side}: declining does not pay`);
    assert.equal(declined.source.turnPowerBoost || 0, 0, `${side}: declining does not apply power`);
  }
});

test("compiled Soh Koh Restraint stays continuous and blocks only its exact VC/RC unit for either seat", () => {
  const ability = abilities.get("cfa-1029:1").ability;
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.definition.source.patternId, "cont-vc-rc-restraint-cannot-attack-v1");
  assert.equal(Engine.isManuallyActivatable(ability), false);
  for (const side of ["human", "bot"]) {
    const sourceInstanceId = `soh-koh-${side}`;
    for (const location of ["vanguard", "rear-guard"]) {
      const result = Engine.evaluateContinuousRestrictions([ability], {
        location, sourceInstanceId, sourceCard: catalogById.get("cfa-1029")
      });
      assert.equal(result.legal, false, `${side}/${location}`);
      assert.equal(result.restrictions[0].type, "restraint");
    }
    for (const location of ["guardian", "hand", "soul"]) {
      assert.equal(Engine.evaluateContinuousRestrictions([ability], {
        location, sourceInstanceId, sourceCard: catalogById.get("cfa-1029")
      }).legal, true, `${side}/${location} is outside VC/RC`);
    }
  }
});

test("only Noqno and Luticia entries claim exact official text review", () => {
  assert.equal(contribution.audit.officialTextChecked, false, "official checks cover only part of the batch");
  assert.deepEqual([...contribution.audit.officiallyCheckedAbilityIds].sort(), [
    "cfa-10289:0", "cfa-10289:1", "cfa-10304:0", "cfa-10304:1"
  ]);
  for (const abilityId of contribution.audit.officiallyCheckedAbilityIds) {
    const blocked = contribution.audit.unsupportedSiblings.find(item => item.abilityId === abilityId);
    assert.ok(blocked?.officialReference, `${abilityId} official Bushiroad source recorded`);
    assert.ok(blocked?.officialCardNumber, `${abilityId} official set/card number recorded`);
    assert.ok(blocked?.officialPrintedText, `${abilityId} official text copied verbatim`);
    assert.equal(blocked.catalogPrintedText, abilities.get(abilityId).ability.printedText, `${abilityId} local text remains intact`);
    assert.equal(abilities.get(abilityId).ability.definition, null, `${abilityId} stays blocked without the matching engine handler`);
  }
  assert.equal(contribution.audit.unsupportedSiblings.find(item => item.abilityId === "cfa-10289:0").officialReference,
    "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2F015EN");
  assert.equal(contribution.audit.unsupportedSiblings.find(item => item.abilityId === "cfa-10304:1").officialReference,
    "https://en.cf-vanguard.com/cardlist/?cardno=D-LBT03%2FFFR02EN");
});
