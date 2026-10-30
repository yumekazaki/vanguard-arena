"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const reviewed = pattern => catalog.flatMap(definition => Engine.parseCardAbilitiesCached(definition)
  .filter(ability => ability.definition?.source?.patternId === pattern).map(ability => ({ definition, ability })));
const lords = reviewed("cont-lord-attack-restriction-v1");
const restraints = reviewed("cont-vc-rc-restraint-cannot-attack-v1");
const rearGuardRestraints = reviewed("cont-rc-restraint-cannot-attack-v1");
const allClans = reviewed("cont-all-clans-and-nations-v1");
function card(definition, uid, playerId, extra = {}) {
  return { uid, cardId: String(definition.id), cardName: definition.name, type: definition.type || "Unit", unitCard: true,
    grade: Number(definition.grade || 0), power: Number(definition.power || 10000), critical: 1,
    clan: definition.clan, clans: definition.clans || (definition.clan ? [definition.clan] : []),
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}
const findCard = id => { const found = catalog.find(definition => String(definition.id) === String(id)); assert.ok(found); return found; };

function attackFixture({ side = "bot", sourceDefinition = lords[0].definition, location = "vanguard", allyDefinition, foreignDefinition } = {}) {
  const ownerId = side === "human" ? "player-host" : "player-guest", opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = card(sourceDefinition, `${side}-source`, ownerId);
  const ownVanguard = location === "vanguard" ? source : card(findCard("cfa-3"), `${side}-own-vanguard`, ownerId, { grade: 3, clan: source.clan, clans: source.clans });
  const rear = Array(5).fill(null);
  if (location === "rear-left") rear[0] = source;
  if (allyDefinition) rear[1] = card(allyDefinition, `${side}-ally`, ownerId);
  if (foreignDefinition) rear[2] = card(foreignDefinition, `${side}-foreign`, ownerId);
  const target = card(findCard("cfa-3"), `${opponentSide}-target`, opponentId, { grade: 3 });
  const own = { playerId: ownerId, vanguard: ownVanguard, rear, guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [], gDeck: [], gZone: [], triggerZone: [] };
  const opponent = { playerId: opponentId, vanguard: target, rear: Array(5).fill(null), guardCircle: [], orders: [], drop: [], hand: [], soul: [], bind: [], damage: [], deck: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `continuous-attack-${side}-${location}`, stateVersion: 0, processedActionIds: [], processedAbilityTriggers: [],
    turn: 3, side, phase: 5, firstTurnComplete: true, pendingAttack: null, pendingAbility: null, pendingAbilities: [],
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const auth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
  const result = Reducer.applyGameAction(state, { actorAuthUid: auth, actionId: `attack-${side}-${location}`, expectedStateVersion: 0,
    payload: { action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: target.uid } }, seats, Engine);
  return { state, result, source, target, owner: own, auth };
}

test("all real Lord, All Clans and Nations, and Restraint definitions are registered and retain their exact rules", () => {
  assert.equal(lords.length, 115);
  assert.equal(restraints.length, 6);
  assert.equal(allClans.length, 28);
  for (const { definition, ability } of [...lords, ...restraints, ...allClans]) {
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(definition.id).some(item => item.id === ability.id), ability.id);
    assert.equal(ability.kind, "CONT", ability.id);
  }
});

test("the authority rejects cross-clan Lord attacks for both players without mutating state", () => {
  const lord = lords.find(item => item.definition.clan === "Gold Paladin").definition;
  const foreign = findCard("cfa-934");
  for (const side of ["human", "bot"]) for (const location of ["vanguard", "rear-left"]) {
    const f = attackFixture({ side, sourceDefinition: lord, location, foreignDefinition: foreign });
    const before = JSON.stringify(f.state);
    assert.equal(f.result.ok, false, `${side}/${location}`);
    assert.equal(f.result.reason, "lord-requires-all-other-units-to-share-a-clan");
    assert.equal(JSON.stringify(f.state), before);
  }
});

test("Lord permits same-clan units and All Clans and Nations units but rejects unknown clan identity", () => {
  const lord = lords.find(item => item.definition.clan === "Gold Paladin").definition;
  const sameClan = lord;
  const allClansDefinition = findCard("cfa-2454");
  const foreign = findCard("cfa-934");
  for (const side of ["human", "bot"]) {
    assert.equal(attackFixture({ side, sourceDefinition: lord, allyDefinition: sameClan }).result.ok, true);
    assert.equal(attackFixture({ side, sourceDefinition: lord, allyDefinition: allClansDefinition }).result.ok, true);
    const unknown = { ...foreign, id: "unknown-clan-card", clan: null, clans: [] };
    assert.equal(attackFixture({ side, sourceDefinition: lord, foreignDefinition: unknown }).result.reason, "lord-requires-all-other-units-to-share-a-clan");
  }
});

test("Restraint blocks only the exact restricted attacker; an unrelated unit can still attack", () => {
  const restraint = restraints[0].definition;
  const plain = findCard("cfa-3");
  for (const side of ["human", "bot"]) {
    for (const location of ["vanguard", "rear-left"]) {
      const blocked = attackFixture({ side, sourceDefinition: restraint.definition || restraint, location });
      assert.equal(blocked.result.ok, false, `${side}/${location}`);
      assert.equal(blocked.result.reason, "unit-with-restraint-cannot-attack");
    }
    const allowed = attackFixture({ side, sourceDefinition: plain, foreignDefinition: findCard("cfa-934") });
    assert.equal(allowed.result.ok, true, `${side}: an unrelated attacker is not restricted by another card's CONT`);
  }
});

test("RC-only Restraint blocks its own Rear-Guard attack for either seat but is inactive on Vanguard", () => {
  assert.equal([...rearGuardRestraints].map(item => item.definition.id).sort().join(","), "cfa-5788,cfa-6269,cfa-6271");
  for (const side of ["human", "bot"]) for (const item of rearGuardRestraints) {
    const blocked = attackFixture({ side, sourceDefinition: item.definition, location: "rear-left" });
    assert.equal(blocked.result.ok, false, `${side}/${item.definition.id} on RC`);
    assert.equal(blocked.result.reason, "unit-with-restraint-cannot-attack");
    const inactive = attackFixture({ side, sourceDefinition: item.definition, location: "vanguard" });
    assert.equal(inactive.result.ok, true, `${side}/${item.definition.id} moved to VC`);
  }
});
