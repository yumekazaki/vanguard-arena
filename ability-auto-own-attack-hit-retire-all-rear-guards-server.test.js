"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-34", { number: "BT05/036EN", name: "Knight of Purgatory, Skull Face" }],
  ["cfa-484", { number: "BT01/036EN", name: "Demon Eater" }],
  ["cfa-682", { number: "BT01/009EN", name: "Demon Slaying Knight, Lohengrin" }]
]);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const catalog = loadCatalog();
const printedText = "AUTO [VC/RC]: [Soul Blast 8 & Counter Blast 5] When this unit’s attack hits, you may pay the cost. If you do, retire all of your opponent’s rear-guards.";

function fixture({ cardId = "cfa-34", side = "human", circle = "vanguard", soulCount = 8, faceUpDamageCount = 5 } = {}) {
  const card = catalog.find(item => item.id === cardId);
  assert.ok(card, `${cardId} is in the card catalog`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === `${cardId}:1`);
  assert.ok(ability, `${cardId}:1 compiles`);
  const actorId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const opponentSide = side === "human" ? "bot" : "human";
  const source = { uid: "ability-source", cardId, cardName: card.name, ownerPlayerId: actorId, controllerPlayerId: actorId, unitCard: true, power: 10000 };
  const vanguard = { uid: "own-vanguard", cardId: "test-vanguard", ownerPlayerId: actorId, controllerPlayerId: actorId, unitCard: true, grade: 3, power: 13000 };
  const opponentVanguard = { uid: "opponent-vanguard", cardId: "test-opponent-vanguard", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3, power: 13000 };
  const damage = Array.from({ length: faceUpDamageCount }, (_, index) => ({ uid: `damage-${index}`, cardId: `damage-${index}`, ownerPlayerId: actorId, controllerPlayerId: actorId, faceDown: false }));
  const soul = Array.from({ length: soulCount }, (_, index) => ({ uid: `soul-${index}`, cardId: `soul-${index}`, ownerPlayerId: actorId, controllerPlayerId: actorId }));
  const opponentRear = Array.from({ length: 8 }, (_, index) => ({
    uid: `enemy-rear-${index}`, cardId: `enemy-card-${index}`, ownerPlayerId: index === 6 ? actorId : opponentId,
    controllerPlayerId: opponentId, unitCard: true, grade: 1, locked: index === 2,
    circle: index < 5 ? ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right"][index] : `accel-${index - 4}`
  }));
  const ownPlayer = {
    playerId: actorId, vanguard: circle === "vanguard" ? source : vanguard,
    rear: circle === "rear-guard" ? [source, null, null, null, null] : Array(5).fill(null),
    hand: [], damage, soul, drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const opposingPlayer = {
    playerId: opponentId, vanguard: opponentVanguard, rear: opponentRear,
    hand: [], damage: [], soul: [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: []
  };
  const players = side === "human" ? { human: ownPlayer, bot: opposingPlayer } : { human: opposingPlayer, bot: ownPlayer };
  const sourceZone = circle === "vanguard" ? "vanguard" : "rear-left";
  const state = {
    matchId: "retire-all-attack-hit-test", stateVersion: 1, turn: 2, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: {
      battleId: `battle-${side}-${circle}`, attackerSide: side, attackerUid: source.uid,
      attackerPlayerId: actorId, attackerZone: sourceZone, defenderSide: opponentSide,
      targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 18000, targetPower: 13000, critical: 1
    }
  };
  const event = Engine.createGameEvent(state, {
    eventId: `hit-${side}-${circle}`, type: "attack.hit", actingPlayerId: actorId, turnPlayerId: actorId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: actorId, sourceControllerPlayerId: actorId,
    cardInstanceId: opponentVanguard.uid, subjectCardInstanceId: opponentVanguard.uid,
    subjectOwnerPlayerId: opponentId, subjectControllerPlayerId: opponentId,
    attackingUnitInstanceId: source.uid, attackingCardInstanceIds: [source.uid],
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard",
    currentLocation: sourceZone, previousLocation: sourceZone,
    battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-hit"
  });
  return { state, event, ability, source, side, actorId, opponentId, opponentSide, damage, soul, opponentRear, card };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function decide(f, { accept = true, authUid, actionId = `resolve-${f.side}`, selection = {} } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: authUid || (f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId,
    expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: {
      instanceUid: f.source.uid, abilityId: f.ability.id,
      costSelections: { cb: f.damage.slice(0, 5).map(item => item.uid), sb: f.soul.slice(0, 8).map(item => item.uid), ...selection.costSelections },
      ...selection
    } }
  }, seats, Engine);
}

test("the three exact cards retain their text, costs, source circles, and shared retire-all effect", () => {
  for (const [cardId, spec] of FAMILY) {
    const f = fixture({ cardId });
    assert.equal(f.card.name, spec.name);
    assert.equal(f.ability.definition.printedText, printedText);
    assert.equal(f.ability.definition.source.officialCardNumber, spec.number);
    assert.equal(f.ability.definition.source.patternId, "auto-own-attack-hit-soul-blast-counter-blast-retire-all-v1");
    assert.deepEqual(f.ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.deepEqual(f.ability.costs, [{ type: "soul-blast", count: 8 }, { type: "counter-blast", count: 5 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "retire-all-opponent-rearguards", target: "opponent-rear-guards" }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("host and joining player can each activate their own exact Vanguard or Rear-Guard attack-hit ability", () => {
  for (const side of ["human", "bot"]) for (const circle of ["vanguard", "rear-guard"]) {
    const f = fixture({ side, circle });
    assert.equal(discover(f).queued.length, 1, `${side} ${circle}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.actorId);
    assert.equal(decide(f).ok, true);
    assert.equal(f.state.players[side].soul.length, 0);
    assert.equal(f.state.players[side].damage.filter(item => item.faceDown).length, 5);
    assert.equal(f.state.players[side].drop.filter(item => item.uid.startsWith("soul-")).length, 8);
    const opposing = f.state.players[f.opponentSide];
    assert.equal(opposing.rear.filter(Boolean).length, 1, "only the locked Rear-Guard remains");
    assert.deepEqual(opposing.rear.map(item => item?.uid).filter(Boolean), ["enemy-rear-2"]);
    assert.equal(opposing.drop.filter(item => item.uid.startsWith("enemy-rear-")).length, 6);
    assert.equal(f.state.players[side].drop.some(item => item.uid === "enemy-rear-6" && item.controllerPlayerId === f.actorId), true,
      "a stolen unit goes to its owner’s Drop with control returned to its owner");
  }
});

test("unaffordable Soul Blast or Counter Blast prevents the prompt", () => {
  for (const f of [fixture({ soulCount: 7 }), fixture({ faceUpDamageCount: 4 })]) {
    assert.equal(discover(f).queued.length, 0);
    assert.equal(f.state.pendingAbility, undefined);
    assert.equal(f.state.players[f.side].drop.length, 0);
    assert.equal(f.state.players[f.side].damage.some(item => item.faceDown), false);
  }
});

test("declining leaves both resources and the opponent field untouched", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  assert.equal(decide(f, { accept: false }).ok, true);
  assert.equal(f.state.players[f.side].soul.length, 8);
  assert.equal(f.state.players[f.side].damage.filter(item => !item.faceDown).length, 5);
  assert.equal(f.state.players[f.opponentSide].rear.filter(Boolean).length, 8);
});

test("wrong attacker identity, wrong circle, and wrong battle target do not make this ability eligible", () => {
  const f = fixture();
  for (const patch of [
    { sourceCardInstanceId: "unrelated-unit", attackingUnitInstanceId: "unrelated-unit" },
    { targetLocation: "rear-left" }
  ]) {
    const altered = { ...f.event, ...patch };
    assert.equal(Reducer.discoverAutoTriggers(f.state, [altered], Engine).queued.length, 0);
  }
  const wrongCircle = fixture();
  wrongCircle.state.pendingAttack.attackerZone = "rear-right";
  assert.equal(discover(wrongCircle).queued.length, 0);
  const liveShape = fixture();
  const liveEventShape = { ...liveShape.event, attackingCardInstanceIds: [], currentLocation: null };
  assert.equal(Reducer.discoverAutoTriggers(liveShape.state, [liveEventShape], Engine).queued.length, 1,
    "the real server attack.hit event omits currentLocation and the optional attacker list");
  assert.equal(discover(f).queued.length, 1);
});

test("only the owner of a joining player's prompt may resolve it", () => {
  const f = fixture({ side: "bot" });
  assert.equal(discover(f).queued.length, 1);
  const hostAttempt = decide(f, { authUid: seats.hostAuthUid, actionId: "host-cannot-resolve-guest-ability" });
  assert.equal(hostAttempt.ok, false);
  assert.equal(f.state.players.bot.soul.length, 8);
  assert.equal(f.state.players.bot.damage.filter(item => !item.faceDown).length, 5);
  assert.equal(f.state.players.human.rear.filter(Boolean).length, 8);
});

test("forged cost cards reject atomically and duplicate event IDs do not enqueue twice", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  assert.equal(Reducer.discoverAutoTriggers(f.state, [f.event], Engine).queued.length, 0);
  const version = f.state.stateVersion;
  const invalid = decide(f, { selection: { costSelections: { cb: ["forged-damage"], sb: f.soul.slice(0, 8).map(item => item.uid) } } });
  assert.equal(invalid.ok, false);
  assert.equal(f.state.stateVersion, version);
  assert.equal(f.state.players[f.side].soul.length, 8);
  assert.equal(f.state.players[f.side].damage.filter(item => !item.faceDown).length, 5);
  assert.equal(f.state.players[f.opponentSide].rear.filter(Boolean).length, 8);
});
