"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-159", [1, "Nova Grappler", "Gold Rutile"]], ["cfa-160", [0, "Nova Grappler", "Lion Heat"]],
  ["cfa-214", [0, "Gold Paladin", "Photon Archer, Griflet"]], ["cfa-306", [0, "Great Nature", "Dumbbell Kangaroo"]],
  ["cfa-377", [0, "Neo Nectar", "Avatar of the Plains, Behemoth"]]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function makeCard(uid, cardId, playerId, extra = {}) {
  return { uid, cardId, ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra };
}

function fixture(cardId = "cfa-160", side = "human", options = {}) {
  const [index, clan, name] = FAMILY.get(cardId);
  const ownerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "guest-player" : "host-player";
  const source = makeCard("source-vg", cardId, ownerId, { cardName: name, name, type: "Unit", clan, clans: [clan], grade: 3 });
  const vanguard = makeCard("opponent-vg", "opp-vg", opponentId, { cardName: "Opponent Vanguard", name: "Opponent Vanguard", type: "Unit", clan: "Kagero", grade: 3 });
  const targets = options.targets === false ? [] : [makeCard("target-rg", "rg-card", ownerId, {
    cardName: options.targetName || "Clan Rear-Guard", name: options.targetName || "Clan Rear-Guard", type: "Unit",
    clan: options.targetClan || clan, clans: [options.targetClan || clan], grade: 1, rested: options.rested === true
  })];
  const damage = Array.from({ length: options.faceUpDamage ?? 2 }, (_, n) => makeCard(`damage-${n}`, `damage-card-${n}`, ownerId, { faceDown: false }));
  const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] });
  const players = { human: player("host-player"), bot: player("guest-player") };
  players[side].vanguard = source;
  players[side].rear[0] = targets[0] || null;
  players[side].damage = damage;
  players[opponentSide].vanguard = vanguard;
  const state = {
    matchId: "vanguard-hit-clan-stand", stateVersion: 1, turn: 4, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [],
    pendingAbilities: [], pendingAbility: null, pendingTrigger: null, players,
    pendingAttack: {
      battleId: "hit-battle", closing: true, attackerSide: side, attackerPlayerId: ownerId,
      attackerUid: source.uid, attackerZone: "vanguard", defenderSide: opponentSide,
      targetUid: vanguard.uid, targetZone: "vanguard", power: 20000, targetPower: 10000, critical: 1
    }
  };
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:${index}`);
  assert.ok(ability, `${cardId} definition compiles`);
  const event = Engine.createGameEvent(state, {
    type: "attack.hit", actingPlayerId: ownerId, turnPlayerId: ownerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId,
    cardInstanceId: vanguard.uid, subjectCardInstanceId: vanguard.uid, subjectOwnerPlayerId: opponentId,
    subjectControllerPlayerId: opponentId, targetCardInstanceIds: [vanguard.uid], targetLocation: "vanguard",
    attackingUnitInstanceId: source.uid, battleId: "hit-battle", phase: "battle", timingWindow: "attack-hit"
  });
  return { state, ability, source, targets, damage, side, ownerId, opponentSide, event, clan };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function decide(f, { accept = true, targetUid = f.targets[0]?.uid, cbUids = f.damage.slice(0, 2).map(card => card.uid), authUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId = `action-${f.side}` } = {}) {
  const selection = { instanceUid: f.source.uid, abilityId: f.ability.id, costSelections: { cb: cbUids } };
  if (targetUid) selection.targetUid = targetUid;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { accept, selection }
  }, seats, Engine);
}

test("all five exact definitions preserve card identity, clan, cost, and target operation", () => {
  for (const [cardId, [index, clan, name]] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.definition.source.patternId, "auto-vanguard-own-attack-hit-clan-counter-blast-stand-v1");
    assert.equal(f.ability.definition.cardId, cardId);
    assert.equal(f.ability.id, `${cardId}:${index}`);
    assert.match(f.ability.printedText, new RegExp(clan.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(f.ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 2 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "stand-target", target: "chosen", allowAlreadyStanding: true, noOpIfNoLegalTargets: true, targetFilter: { controller: "source-controller", cardType: "unit", zone: "rear-guard", clan } }]);
    assert.ok(name);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("multi-AUTO source selects only the matching ability ID and rejects a mismatched definition", () => {
  const card = catalog.find(item => item.id === "cfa-159");
  const parsed = Engine.parseCardAbilitiesCached(card).filter(item => item.kind === "AUTO");
  assert.deepEqual(parsed.map(item => item.id), ["cfa-159:0", "cfa-159:1"]);
  const f = fixture("cfa-159", "human", { rested: true });
  const discovered = discover(f);
  assert.deepEqual(discovered.queued.map(item => item.ability.id), ["cfa-159:1"]);
  const unrelated = { ...f.ability, id: "cfa-159:0", definition: { ...f.ability.definition, id: "cfa-159:0", printedText: parsed[0].printedText } };
  assert.equal(Reducer.supportsServerAbilityEffects(unrelated), false);
});

test("host and joining player resolve only their own Vanguard hit and pay their own Counter Blast", () => {
  for (const side of ["human", "bot"]) {
    const f = fixture("cfa-160", side, { rested: true });
    assert.equal(discover(f).queued.length, 1);
    assert.equal(f.state.pendingAbility.side, side);
    const result = decide(f);
    assert.equal(result.ok, true, result.reason);
    assert.equal(f.targets[0].rested, false);
    assert.equal(f.damage.filter(card => card.faceDown).length, 2);
    assert.ok(result.events.some(event => event.type === "unit.stood" && event.cardInstanceId === f.targets[0].uid));
  }
});

test("already-standing eligible Rear-Guards can be chosen and resolve as a no-op", () => {
  const f = fixture("cfa-214", "bot", { rested: false });
  assert.equal(discover(f).queued.length, 1);
  const result = decide(f);
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.targets[0].rested, false);
  assert.equal(result.events.some(event => event.type === "unit.stood"), false);
  assert.equal(f.damage.filter(card => card.faceDown).length, 2);
});

test("when no eligible target exists, optional payment remains available and the stand instruction does nothing", () => {
  const f = fixture("cfa-306", "human", { targets: false });
  assert.equal(discover(f).queued.length, 1);
  const result = decide(f, { targetUid: null });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.damage.filter(card => card.faceDown).length, 2);
  assert.equal(f.state.players[f.side].rear.filter(Boolean).length, 0);
});

test("wrong clan, opponent-controlled, or non-Rear-Guard targets reject before paying", () => {
  const wrongClan = fixture("cfa-377", "human", { rested: true, targetClan: "Kagero" });
  assert.equal(discover(wrongClan).queued.length, 1);
  const beforeWrongClan = wrongClan.damage.map(card => card.faceDown);
  assert.equal(decide(wrongClan).ok, false);
  assert.deepEqual(wrongClan.damage.map(card => card.faceDown), beforeWrongClan);
  assert.equal(wrongClan.state.stateVersion, 1);
  const wrongZone = fixture("cfa-377", "human", { rested: true });
  assert.equal(discover(wrongZone).queued.length, 1);
  const beforeWrongZone = wrongZone.damage.map(card => card.faceDown);
  assert.equal(decide(wrongZone, { targetUid: wrongZone.source.uid }).ok, false);
  assert.deepEqual(wrongZone.damage.map(card => card.faceDown), beforeWrongZone);
  const f = fixture("cfa-159", "bot", { rested: true });
  const opposing = makeCard("opponent-rg", "opponent-rg-card", "host-player", { type: "Unit", clan: "Nova Grappler", rested: true });
  f.state.players.human.rear[0] = opposing;
  assert.equal(discover(f).queued.length, 1);
  const before = f.damage.map(card => card.faceDown);
  const result = decide(f, { targetUid: opposing.uid });
  assert.equal(result.ok, false);
  assert.deepEqual(f.damage.map(card => card.faceDown), before);
});

test("unpayable cost does not prompt and invalid CB selections reject atomically", () => {
  const short = fixture("cfa-306", "bot", { faceUpDamage: 1 });
  assert.equal(discover(short).queued.length, 0);
  const f = fixture("cfa-306", "human", { rested: true });
  assert.equal(discover(f).queued.length, 1);
  const before = f.damage.map(card => card.faceDown);
  const result = decide(f, { cbUids: [f.damage[0].uid, "forged"] });
  assert.equal(result.ok, false);
  assert.deepEqual(f.damage.map(card => card.faceDown), before);
  assert.equal(f.targets[0].rested, true);
  assert.equal(f.state.stateVersion, 1);
});

test("wrong source, non-Vanguard target, stale battle, and wrong seat never resolve", () => {
  const wrongSource = fixture("cfa-160");
  wrongSource.event = { ...wrongSource.event, sourceCardInstanceId: "other", attackingUnitInstanceId: "other" };
  assert.equal(discover(wrongSource).queued.length, 0);
  const wrongTarget = fixture("cfa-160");
  wrongTarget.state.pendingAttack.targetZone = "rear-left";
  wrongTarget.event = { ...wrongTarget.event, targetLocation: "rear-left" };
  assert.equal(discover(wrongTarget).queued.length, 0);
  const stale = fixture("cfa-214", "bot", { rested: true });
  assert.equal(discover(stale).queued.length, 1);
  stale.state.pendingAttack.battleId = "stale-battle";
  const before = stale.damage.map(card => card.faceDown);
  assert.equal(decide(stale).ok, false);
  assert.deepEqual(stale.damage.map(card => card.faceDown), before);
  const wrongSeat = fixture("cfa-214", "bot", { rested: true });
  assert.equal(discover(wrongSeat).queued.length, 1);
  const result = decide(wrongSeat, { authUid: seats.hostAuthUid });
  assert.equal(result.ok, false);
  assert.equal(wrongSeat.damage.filter(card => card.faceDown).length, 0);
});

test("declining does not pay cost or alter the chosen Rear-Guard", () => {
  const f = fixture("cfa-160", "human", { rested: true });
  assert.equal(discover(f).queued.length, 1);
  const result = decide(f, { accept: false });
  assert.equal(result.ok, true, result.reason);
  assert.equal(f.targets[0].rested, true);
  assert.equal(f.damage.filter(card => card.faceDown).length, 0);
});
