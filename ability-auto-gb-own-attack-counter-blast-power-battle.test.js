"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "auto-gb-own-attack-counter-blast-power-battle-v1";
const FAMILY = [
  { cardId: "cfa-3377", name: "Breathing Coatl", cardNumber: "G-TD07/002EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-TD07%2F002EN" },
  { cardId: "cfa-3393", name: "Steam Knight, Ilku", cardNumber: "G-TD06/004EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-TD06%2F004EN" },
  { cardId: "cfa-3650", name: "Dragon Undead, Bone Dragon", cardNumber: "G-TD08/003EN", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-TD08%2F003EN" }
];
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const CATALOG = loadCatalog();
const BY_ID = new Map(CATALOG.map(card => [String(card.id), card]));
let sequence = 0;

function card(uid, cardId, playerId, extra = {}) {
  const definition = BY_ID.get(String(cardId));
  return { uid, cardId, cardName: definition?.name || "Test unit", type: definition?.type || "Unit", grade: Number(definition?.grade || 0),
    ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, ...extra };
}

function fixture(spec = FAMILY[0], side = "human", { sourceZone = "rear-left", targetZone = "vanguard", generationBreak = true, counterBlast = true } = {}) {
  const id = ++sequence, enemySide = side === "human" ? "bot" : "human";
  const sourcePlayerId = side === "human" ? "host-player" : "guest-player";
  const defenderPlayerId = side === "human" ? "guest-player" : "host-player";
  const source = card(`attacker-${id}`, spec.cardId, sourcePlayerId);
  const ownVanguard = card(`own-vg-${id}`, "cfa-3", sourcePlayerId, { grade: 3 });
  const target = card(`target-${id}`, targetZone === "vanguard" ? "cfa-3" : "cfa-20", defenderPlayerId,
    targetZone === "vanguard" ? { grade: 3 } : { grade: 1, zone: "rear-guard", circle: "rear-left" });
  const damage = counterBlast ? [card(`damage-${id}`, "cfa-10", sourcePlayerId, { faceDown: false, zone: "damage" })] : [];
  const gUnit = card(`gb-unit-${id}`, "g-unit-test", sourcePlayerId, { faceUp: generationBreak, gDeckCard: true, isGUnit: true, zone: "g-zone" });
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], deck: [], soul: [], drop: [], damage: [], bind: [],
    orders: [], crests: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = sourceZone === "vanguard" ? source : ownVanguard;
  if (sourceZone !== "vanguard") players[side].rear[0] = source;
  players[side].damage = damage;
  if (generationBreak) players[side].gZone = [gUnit];
  players[enemySide].vanguard = targetZone === "vanguard" ? target : card(`enemy-vg-${id}`, "cfa-3", defenderPlayerId, { grade: 3 });
  if (targetZone !== "vanguard") players[enemySide].rear[0] = target;

  const battleId = `gb-own-attack-${id}`;
  const state = { matchId: `gb-own-attack-match-${id}`, stateVersion: 1, eventSequence: 0, turn: 3, phase: 5, side,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    players, pendingAttack: { battleId, attackerSide: side, attackerPlayerId: sourcePlayerId, attackerUid: source.uid,
      attackerZone: sourceZone, defenderSide: enemySide, defenderPlayerId, targetUid: target.uid, targetZone,
      power: 10000, targetPower: 10000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: sourcePlayerId, turnPlayerId: sourcePlayerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: sourcePlayerId, sourceControllerPlayerId: sourcePlayerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid, subjectOwnerPlayerId: sourcePlayerId, subjectControllerPlayerId: sourcePlayerId,
    attackingCardInstanceIds: [source.uid], currentLocation: sourceZone, previousLocation: sourceZone,
    targetCardInstanceIds: [target.uid], targetLocation: targetZone, battleId, phase: "battle", timingWindow: "attack-declared" });
  const definition = BY_ID.get(spec.cardId);
  const ability = Engine.parseCardAbilitiesCached(definition).find(item => item.id === `${spec.cardId}:0`);
  assert.ok(ability, `${spec.cardId}:0 parses`);
  return { id, spec, side, enemySide, sourcePlayerId, defenderPlayerId, source, ownVanguard, target, damage, gUnit, state, event, ability, battleId };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function respond(f, { accept = true, actor = f.side, costUids = f.damage.map(item => item.uid), actionId = `resolve-${f.battleId}-${accept}` } = {}) {
  const authUid = actor === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;
  return Reducer.applyAbilityDecision(f.state, { actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: costUids } } } }, SEATS, Engine);
}

test("the exact three-card official family keeps its GB, Counter Blast, optionality, and battle power", () => {
  for (const spec of FAMILY) {
    const definition = BY_ID.get(spec.cardId), abilities = Engine.parseCardAbilitiesCached(definition), ability = abilities[0];
    assert.equal(definition.name, spec.name);
    assert.equal(abilities.length, 1, `${spec.cardId} has no unfinished sibling ability`);
    assert.equal(ability.id, `${spec.cardId}:0`);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.source.dataset, "Bushiroad official card list");
    assert.equal(ability.definition.source.officialCardNumber, spec.cardNumber);
    assert.equal(ability.definition.source.officialReference, spec.reference);
    assert.equal(ability.definition.source.officialTextVerified, true);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.conditions, [{ type: "generation-break", count: 1 }]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
    assert.equal(ability.trigger.eventType, "unit.attacked");
    assert.equal(ability.trigger.subject, "source");
    assert.equal(ability.trigger.targetLocation, null, "the printed ability does not restrict the attack target");
    assert.equal(ability.canDecline, true);
    assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player may each resolve their own attack AUTO from VC or RC", () => {
  for (const spec of FAMILY) for (const side of ["human", "bot"]) for (const sourceZone of ["vanguard", "rear-left"]) for (const targetZone of ["vanguard", "rear-left"]) {
    const f = fixture(spec, side, { sourceZone, targetZone });
    const result = discover(f);
    assert.equal(result.queued.length, 1, `${spec.cardId}/${side}/${sourceZone}/${targetZone}: ${JSON.stringify(result)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side).pendingAbility.instance.uid, f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state, side === "human" ? "bot" : "human").pendingAbility, null);
    const resultOfChoice = respond(f);
    assert.equal(resultOfChoice.ok, true, `${spec.cardId}/${side}: ${JSON.stringify(resultOfChoice)}`);
    assert.equal(f.state.players[side].damage[0].faceDown, true, "the ability controller pays Counter Blast");
    assert.equal(f.state.pendingAttack.power, 13000);
    assert.equal(f.state.pendingAbility, null);
  }
});

test("declining resolves cleanly without paying or granting power", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture(FAMILY[0], side);
    assert.equal(discover(f).queued.length, 1);
    assert.equal(respond(f, { accept: false }).ok, true);
    assert.equal(f.state.players[side].damage[0].faceDown, false);
    assert.equal(f.state.pendingAttack.power, 10000);
    assert.equal(f.state.pendingAbility, null);
  }
});

test("Generation Break and Counter Blast are mandatory for eligibility and rechecked at resolution", () => {
  const noGb = fixture(FAMILY[0], "human", { generationBreak: false });
  assert.equal(discover(noGb).queued.length, 0);
  const noCb = fixture(FAMILY[0], "human", { counterBlast: false });
  assert.equal(discover(noCb).queued.length, 0);
  const changed = fixture(FAMILY[0], "bot");
  assert.equal(discover(changed).queued.length, 1);
  changed.state.players[changed.side].gZone[0].faceUp = false;
  const before = JSON.stringify(changed.state);
  const rejected = respond(changed);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /condition-no-longer-met/);
  assert.equal(changed.state.players[changed.side].damage[0].faceDown, false);
  assert.equal(changed.state.pendingAttack.power, 10000);
  assert.equal(JSON.stringify(changed.state), before, "the rejected response leaves all game state unchanged");
});

test("other attackers, wrong source identity, invalid battle timing, and forged controller data cannot trigger", () => {
  const checks = [
    f => ({ ...f.event, eventId: `other-source-${f.id}`, sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other", attackingCardInstanceIds: ["other"] }),
    f => ({ ...f.event, eventId: `wrong-battle-${f.id}`, battleId: "wrong-battle" }),
    f => ({ ...f.event, eventId: `wrong-phase-${f.id}`, phase: "main" }),
    f => ({ ...f.event, eventId: `wrong-window-${f.id}`, timingWindow: "guard-step" }),
    f => ({ ...f.event, eventId: `wrong-owner-${f.id}`, sourceOwnerPlayerId: "opponent" }),
    f => ({ ...f.event, eventId: `wrong-circle-${f.id}`, currentLocation: "guardian" })
  ];
  for (const build of checks) {
    const f = fixture(FAMILY[0], "human");
    assert.equal(Reducer.discoverAutoTriggers(f.state, [build(f)], Engine).queued.length, 0);
  }
});

test("an invalid Counter Blast target is rejected atomically and the opponent cannot answer for the source controller", () => {
  const invalidCost = fixture(FAMILY[0], "human");
  assert.equal(discover(invalidCost).queued.length, 1);
  const powerBefore = invalidCost.state.pendingAttack.power;
  const badCost = respond(invalidCost, { costUids: ["not-damage"] });
  assert.equal(badCost.ok, false);
  assert.equal(invalidCost.state.players.human.damage[0].faceDown, false);
  assert.equal(invalidCost.state.pendingAttack.power, powerBefore);

  const joined = fixture(FAMILY[0], "bot");
  assert.equal(discover(joined).queued.length, 1);
  const before = JSON.stringify(joined.state);
  const forged = respond(joined, { actor: "human" });
  assert.equal(forged.ok, false);
  assert.equal(JSON.stringify(joined.state), before);
});

test("duplicate attack events and duplicate decisions do not apply the battle modifier twice", () => {
  const f = fixture(FAMILY[1], "bot");
  assert.equal(discover(f).queued.length, 1);
  assert.equal(discover(f).queued.length, 0);
  const first = respond(f);
  assert.equal(first.ok, true);
  const duplicate = respond(f, { actionId: `duplicate-${f.battleId}` });
  assert.equal(duplicate.ok, false);
  assert.equal(f.state.pendingAttack.power, 13000);
  assert.equal(f.state.players.bot.damage[0].faceDown, true);
});
