"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
const Reducer = require("./ability-server-reducer.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0014.js");
engine.registerAbilityDefinitions(contribution);
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));

test("the contribution audits every assigned ability once and separates existing support, its proposal, and blockers", () => {
  const assigned = require("./ability-work-batches.json").batches.find(batch => batch.batchId === "ABILITY-76D8A0B8-0014").abilityIds;
  const audit = contribution.audit;
  assert.equal(audit.batchId, "ABILITY-76D8A0B8-0014");
  assert.equal(audit.auditedAbilityIds.length, 40);
  assert.deepEqual([...audit.auditedAbilityIds].sort(), [...assigned].sort());
  assert.equal(new Set(audit.auditedAbilityIds).size, 40);
  assert.equal(audit.alreadySupportedAbilityIds.length, 8);
  for (const abilityId of audit.alreadySupportedAbilityIds) {
    const [cardId] = abilityId.split(":");
    const card = catalogById.get(cardId);
    assert.ok(card, `${abilityId} has a catalog card`);
    const ability = engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(ability?.definition, `${abilityId} is already compiled`);
  }
  assert.deepEqual(audit.proposedDefinitionIds, ["cfa-11260:0"]);
  assert.equal(audit.blocked.length, 31);
  assert.equal(new Set(audit.blocked.map(row => row.abilityId)).size, 31);
  for (const row of audit.blocked) {
    assert.ok(assigned.includes(row.abilityId), `${row.abilityId} is assigned`);
    assert.ok(row.blocker.length > 60, `${row.abilityId} has a concrete blocker`);
  }
  const accounted = new Set([...audit.alreadySupportedAbilityIds, ...audit.proposedDefinitionIds, ...audit.blocked.map(row => row.abilityId)]);
  assert.deepEqual([...accounted].sort(), [...assigned].sort());
});

test("Ningenmukotsu's exact CONT is a passive Rear-Guard Shinken Hissatsu bonus with no cost or choice", () => {
  const card = catalogById.get("cfa-11260");
  assert.ok(card);
  const ability = engine.parseCardAbilitiesCached(card).find(item => item.id === "cfa-11260:0");
  assert.ok(ability);
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.printedText, "CONT [RC] Shinken Hissatsu(This ability is active if you have three or more damage): This unit gets power +5000. (Active on opponent’s turn too.)");
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
  assert.equal(ability.definition.source.cardNumber, "D-TB04/062EN");
  assert.equal(ability.definition.effects[0].op, "continuous-power");
  assert.deepEqual(ability.definition.effects[0].condition, { op: "controller-damage-at-least", count: 3 });
  assert.deepEqual(ability.costs, []);
  assert.equal(engine.isManuallyActivatable(ability), false);
  assert.equal(ability.definition.choicesReviewed, undefined);
  assert.equal(ability.choiceStatus, "no-explicit-choice-detected");
});

test("the CONT applies at the threshold for either seat and on either player's turn", () => {
  const ability = engine.parseCardAbilitiesCached(catalogById.get("cfa-11260")).find(item => item.id === "cfa-11260:0");
  for (const seat of ["host", "joiner"]) {
    const sourceUid = `ningen-${seat}`;
    for (const isControllerTurn of [true, false]) {
      assert.equal(engine.evaluateContinuousEffects([ability], {
        sourceLocation: "rear-guard",
        location: "rear-guard",
        sourceInstanceId: sourceUid,
        targetInstanceId: sourceUid,
        controllerPlayerId: `${seat}-player`,
        controllerDamageCount: 3,
        isControllerTurn
      }).power, 5000, `${seat}, controller turn=${isControllerTurn}`);
    }
  }
});

test("the authoritative battle calculation applies Shinken Hissatsu for host and joining-player sources", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const player = (playerId, vanguard = null, rear = [], damage = []) => ({
    playerId, vanguard, rear, damage, deck: [], hand: [], drop: [], soul: [], bind: [],
    orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  });
  for (const side of ["human", "bot"]) {
    const owner = side === "human" ? "host" : "guest";
    const opponentSide = side === "human" ? "bot" : "human";
    const opponentId = side === "human" ? "guest" : "host";
    const source = engine.createCardInstance("cfa-11260", owner, `ningen-${side}`, {
      zone: "rear-guard", circle: "rear-left", power: 13000, grade: 3
    });
    const vanguard = engine.createCardInstance("cfa-3", owner, `friendly-vg-${side}`, {
      zone: "vanguard", circle: "vanguard", power: 13000, grade: 3
    });
    const opposingVanguard = engine.createCardInstance("cfa-3", opponentId, `opposing-vg-${side}`, {
      zone: "vanguard", circle: "vanguard", power: 13000, grade: 3
    });
    source.unitCard = true;
    source.critical = 1;
    source.drive = 1;
    vanguard.unitCard = true;
    opposingVanguard.unitCard = true;
    const damage = Array.from({ length: 3 }, (_, index) => engine.createCardInstance(
      "cfa-0", owner, `damage-${side}-${index}`, { zone: "damage" }
    ));
    const players = {};
    players[side] = player(owner, vanguard, [source, null, null, null, null], damage);
    players[opponentSide] = player(opponentId, opposingVanguard);
    const state = {
      matchId: `ningen-battle-${side}`, stateVersion: 0, turn: 2, side, phase: 5,
      firstTurnComplete: true, processedActionIds: [], pendingAbility: null, pendingAbilities: [],
      authoritySeats: seats, players
    };
    const outcome = Reducer.applyGameAction(state, {
      actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
      actionId: `ningen-attack-${side}`, expectedStateVersion: 0,
      payload: {
        type: "game-action", action: "attack",
        attackerCardInstanceId: source.uid, targetCardInstanceId: opposingVanguard.uid
      }
    }, seats, engine);
    assert.equal(outcome.ok, true, outcome.reason);
    assert.equal(outcome.state.pendingAttack.power, 18000, `${side} receives the 5000 continuous bonus on its own attack`);
  }
});

test("the CONT rejects a different instance, a wrong circle, and fewer than three damage", () => {
  const ability = engine.parseCardAbilitiesCached(catalogById.get("cfa-11260")).find(item => item.id === "cfa-11260:0");
  const base = {
    sourceInstanceId: "ningen-source-instance",
    targetInstanceId: "ningen-source-instance",
    controllerDamageCount: 3,
    isControllerTurn: false
  };
  assert.equal(engine.evaluateContinuousEffects([ability], { ...base, targetInstanceId: "another-copy" , location: "rear-guard" }).power, 0);
  assert.equal(engine.evaluateContinuousEffects([ability], { ...base, location: "vanguard" }).power, 0);
  assert.equal(engine.evaluateContinuousEffects([ability], { ...base, location: "guardian" }).power, 0);
  assert.equal(engine.evaluateContinuousEffects([ability], { ...base, location: "rear-guard", controllerDamageCount: 2 }).power, 0);
});
