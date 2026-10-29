"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([
  ["cfa-1984", { index: 2, name: "Brawler, Big Bang Knuckle Dragon", circle: "vanguard", power: 3000 }],
  ["cfa-2119", { index: 0, name: "Metalborg, Sandstorm", circle: "vanguard/rear-guard", power: 3000 }],
  ["cfa-2137", { index: 0, name: "Nobody From Olmeca", circle: "vanguard/rear-guard", power: 3000 }],
  ["cfa-2142", { index: 0, name: "Brawler, Headband of Greed", circle: "vanguard/rear-guard", power: 3000 }],
  ["cfa-2151", { index: 0, name: "Seeker, Gigantech Driver", circle: "vanguard/rear-guard", power: 3000 }],
  ["cfa-2341", { index: 0, name: "Liberator, Feather Lion", circle: "vanguard/rear-guard", power: 3000 }],
  ["cfa-2353", { index: 0, name: "Star-vader, Metal Griffin", circle: "vanguard/rear-guard", power: 3000 }]
]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const textFor = ({ circle }) => `AUTO [${circle === "vanguard" ? "VC" : "VC/RC"}]: [Soul Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets power +3000 until end of that battle.`;

function fixture(cardId = "cfa-2119", side = "human", circle = "rear-guard", changes = {}) {
  const spec = FAMILY.get(cardId);
  assert.ok(spec, `known family card ${cardId}`);
  const card = catalog.find(item => item.id === cardId);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.definition?.source?.patternId === "auto-own-attack-soul-blast-power-battle-v1");
  assert.ok(ability, `${cardId} ability compiles`);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const attackZone = circle === "vanguard" ? "vanguard" : "rear-left";
  const source = { uid: "attacker", cardId, cardName: card.name, ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, power: 10000 };
  const vanguard = { uid: "own-vg", cardId: "own-vg-definition", cardName: "Test Vanguard", ownerPlayerId: playerId, controllerPlayerId: playerId, unitCard: true, grade: 3 };
  const opponentVanguard = { uid: "opp-vg", cardId: "opp-vg-definition", cardName: "Opponent Vanguard", ownerPlayerId: opponentId, controllerPlayerId: opponentId, unitCard: true, grade: 3 };
  const soul = Array.from({ length: changes.soulCount ?? 1 }, (_, i) => ({ uid: `soul-${i + 1}`, cardId: `soul-${i + 1}`, ownerPlayerId: playerId, controllerPlayerId: playerId }));
  const players = {
    human: { playerId: "player-host", vanguard: side === "human" ? (circle === "vanguard" ? source : vanguard) : opponentVanguard, rear: side === "human" && circle !== "vanguard" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: [], soul: side === "human" ? soul : [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] },
    bot: { playerId: "player-guest", vanguard: side === "bot" ? (circle === "vanguard" ? source : vanguard) : opponentVanguard, rear: side === "bot" && circle !== "vanguard" ? [source, null, null, null, null] : Array(5).fill(null), damage: [], hand: [], soul: side === "bot" ? soul : [], drop: [], deck: [], bind: [], orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] }
  };
  const state = {
    matchId: "own-attack-soul-blast-test", stateVersion: 1, turn: 2, side, phase: 5,
    eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], players,
    pendingAttack: {
      battleId: "battle-1", attackerSide: side, attackerUid: source.uid,
      attackerPlayerId: playerId, attackerZone: attackZone,
      defenderSide: side === "human" ? "bot" : "human", targetUid: opponentVanguard.uid,
      targetZone: "vanguard", power: 10000, critical: 1
    }
  };
  let event = Engine.createGameEvent(state, {
    eventId: "attack-event-1", type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: source.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: source.uid, subjectCardInstanceId: source.uid,
    subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    attackingCardInstanceIds: [source.uid], currentLocation: attackZone, previousLocation: attackZone,
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard",
    battleId: "battle-1", phase: "battle", timingWindow: "attack-declared"
  });
  event = { ...event, ...changes.event };
  return { state, event, ability, source, playerId, side, soul, target: opponentVanguard, spec };
}

function discover(f) { return Reducer.discoverAutoTriggers(f.state, [f.event], Engine); }
function choose(f, options = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: options.actorAuthUid || (f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid),
    actionId: options.actionId || `soul-power-${f.side}`,
    expectedStateVersion: f.state.stateVersion,
    payload: {
      type: "ability-response", accept: options.accept !== false,
      selection: { instanceUid: f.source.uid, abilityId: f.ability.id,
        costSelections: { sb: options.soulUids || f.soul.slice(0, 1).map(card => card.uid) } }
    }
  }, seats, Engine);
}

test("seven catalog abilities preserve exact text, ability index, circle scope, SB cost, and battle power", () => {
  for (const [cardId, spec] of FAMILY) {
    const f = fixture(cardId, "human", spec.circle === "vanguard" ? "vanguard" : "rear-guard");
    assert.equal(f.ability.id, `${cardId}:${spec.index}`);
    assert.equal(f.ability.definition.printedText, textFor(spec));
    assert.equal(f.ability.definition.source.patternId, "auto-own-attack-soul-blast-power-battle-v1");
    assert.equal(f.ability.kind, "AUTO");
    assert.deepEqual(f.ability.requiredLocation, spec.circle === "vanguard" ? ["vanguard"] : ["vanguard", "rear-guard"]);
    assert.equal(f.ability.trigger.eventType, "unit.attacked");
    assert.equal(f.ability.trigger.subject, "source");
    assert.equal(f.ability.trigger.targetLocation, "vanguard");
    assert.deepEqual(f.ability.costs, [{ type: "soul-blast", count: 1 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "battle" }]);
    assert.equal(f.ability.canDecline, true);
  }
});

test("host and joiner can each pay their own Soul Blast for a Vanguard attack and gain +3000 this battle", () => {
  for (const side of ["human", "bot"]) {
    for (const circle of ["vanguard", "rear-guard"]) {
      const f = fixture("cfa-2119", side, circle);
      assert.equal(discover(f).queued.length, 1);
      assert.equal(f.state.pendingAbility.side, side);
      assert.equal(choose(f).ok, true);
      assert.equal(f.state.players[side].soul.length, 0);
      assert.equal(f.state.players[side].drop.length, 1);
      assert.equal(f.state.pendingAttack.power, 13000);
    }
  }
  const vcOnlyRear = fixture("cfa-1984", "human", "rear-guard");
  assert.equal(discover(vcOnlyRear).queued.length, 0);
});

test("declining the optional cost resolves without payment or power change", () => {
  const f = fixture();
  assert.equal(discover(f).queued.length, 1);
  assert.equal(choose(f, { accept: false }).ok, true);
  assert.equal(f.state.players[f.side].soul.length, 1);
  assert.equal(f.state.players[f.side].drop.length, 0);
  assert.equal(f.state.pendingAttack.power, 10000);
});

test("insufficient Soul prevents eligibility; an invalid selected Soul rejects atomically", () => {
  const short = fixture("cfa-2119", "bot", "rear-guard", { soulCount: 0 });
  assert.equal(discover(short).queued.length, 0);
  const invalid = fixture();
  assert.equal(discover(invalid).queued.length, 1);
  const beforeVersion = invalid.state.stateVersion;
  const result = choose(invalid, { soulUids: ["forged-soul"] });
  assert.equal(result.ok, false);
  assert.equal(invalid.state.players[invalid.side].soul.length, 1);
  assert.equal(invalid.state.players[invalid.side].drop.length, 0);
  assert.equal(invalid.state.pendingAttack.power, 10000);
  assert.equal(invalid.state.stateVersion, beforeVersion);
});

test("wrong attacker, target, circle, battle, phase, timing, or acting player cannot queue this ability", () => {
  const mutations = [
    { event: { sourceCardInstanceId: "other", cardInstanceId: "other", subjectCardInstanceId: "other", attackingCardInstanceIds: ["other"] } },
    { event: { targetLocation: "rear-left" } },
    { event: { currentLocation: "guardian" } },
    { event: { battleId: "other-battle" } },
    { event: { phase: "main" } },
    { event: { timingWindow: "guard-step" } },
    { event: { actingPlayerId: "player-guest" } }
  ];
  for (const changes of mutations) {
    const f = fixture("cfa-2119", "human", "rear-guard", changes);
    assert.equal(discover(f).queued.length, 0, JSON.stringify(changes));
  }
  const wrongController = fixture("cfa-2119", "human", "rear-guard", { event: { sourceControllerPlayerId: "player-guest", subjectControllerPlayerId: "player-guest" } });
  assert.equal(discover(wrongController).queued.length, 0);
});

test("wrong seat cannot proxy a joiner decision and duplicate responses do not pay or boost twice", () => {
  const forged = fixture("cfa-2119", "bot");
  assert.equal(discover(forged).queued.length, 1);
  const proxyResult = choose(forged, { actorAuthUid: seats.hostAuthUid });
  assert.equal(proxyResult.ok, false);
  assert.equal(forged.state.players.bot.soul.length, 1);
  assert.equal(forged.state.pendingAttack.power, 10000);

  const duplicate = fixture("cfa-2119", "human");
  assert.equal(discover(duplicate).queued.length, 1);
  assert.equal(choose(duplicate, { actionId: "same-action" }).ok, true);
  const duplicateResult = choose(duplicate, { actionId: "same-action" });
  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicate.state.players.human.soul.length, 0);
  assert.equal(duplicate.state.players.human.drop.length, 1);
  assert.equal(duplicate.state.pendingAttack.power, 13000);
});

test("tampered card ID, printed text, cost, location, trigger, effect, or duration is rejected", () => {
  const f = fixture();
  const changes = [
    { cardId: "cfa-99999" },
    { printedText: f.ability.definition.printedText.replace("Soul Blast 1", "Soul Blast 2") },
    { costs: [{ type: "soul-blast", count: 2 }] },
    { requiredLocation: ["vanguard"] },
    { trigger: { ...f.ability.trigger, targetLocation: "rear-guard" } },
    { effects: [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }] },
    { effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }] }
  ];
  for (const change of changes) {
    const tampered = { ...f.ability, ...change,
      definition: { ...f.ability.definition, ...change } };
    assert.equal(Reducer.supportsServerAbilityEffects(tampered), false, JSON.stringify(change));
  }
});
