"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const MAIN_DEFINITIONS = require("./ability-definitions.js");
const contributions = require("./ability-contributions/batch-ABILITY-76D8A0B8-0116.js");
Engine.registerAbilityDefinitions(MAIN_DEFINITIONS);
Engine.registerAbilityDefinitions(contributions);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const IMPLEMENTED = {
  id: "cfa-1818:0",
  cardId: "cfa-1818",
  text: "CONT [VC/RC]: During your turn, if the number of «Murakumo» rear-guards you have is four or more, this unit gets power +3000.",
  pattern: "cont-vc-rc-own-turn-clan-rearguard-count-power-v1"
};
const UNSUPPORTED = new Map([
  ["cfa-1795:1", "The ACT selects a different Vanguard and grants it a nested AUTO; the available temporary-grant handler only grants an ability to its own exact source instance."],
  ["cfa-181:1", "Requires an exact booster-hit event, Counter Blast 1 plus source-to-Soul cost, then a top-three Gold Paladin call-rest choice and ordered bottom-deck handling; no current effect program matches that complete sequence."],
  ["cfa-1823:0", "Requires the exact source to have boosted a Narukami with Limit Break 4 before a Vanguard hit, then Counter Blast 2 and draw; current boosted-hit handlers use different conditions and costs."],
  ["cfa-1796:0", "Requires a grade-3 Ezel Vanguard placement event and a Counter-Blast-paid top-card Gold Paladin call to an open RC; current top-search handlers do not implement this trigger and call destination together."],
  ["cfa-1824:0", "Requires a Pale Moon moved from Soul to RC to trigger this exact Soul instance, call it to RC, and schedule that source back to Soul at turn end; the full event and delayed return sequence is unsupported."],
  ["cfa-1825:0", "Requires a fourth-or-later battle Limit Break attack, Counter Blast plus selecting/resting/locking a Rear-Guard, temporary power and critical, and a granted miss-at-battle-end AUTO; the nested lock and miss sequence is unsupported."],
  ["cfa-1821:0", "Requires Limit Break and a Vanguard attack, then a top-five search filtered by the name of a Neo Nectar already on the field, calling the selected card to RC and shuffling; no current call handler supports that dynamic field-name filter."],
  ["cfa-1807:0", "The attack condition depends on the battle opponent's power being at least 12000; there is no supported structured condition for that power comparison." ]
]);

function abilityFor(id) {
  const cardId = id.split(":")[0], card = CATALOG.get(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `parsed ability ${id}`);
  return { card, ability };
}

function makeInstance(cardId, uid, playerId, overrides = {}) {
  const card = CATALOG.get(String(cardId));
  return {
    uid,
    cardId: String(cardId),
    cardName: card?.name,
    grade: Number(card?.grade ?? 0),
    power: Number(card?.power ?? 0),
    critical: 1,
    type: card?.type,
    unitCard: card?.type === "Unit",
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    rested: false,
    ...overrides
  };
}

function gameFixture({ side = "human", sourceLocation = "rear-guard", rearguardClan = "Murakumo", rearguardCount = 4 } = {}) {
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = makeInstance("cfa-1818", `source-${side}-${sourceLocation}`, playerId);
  const own = {
    playerId,
    vanguard: sourceLocation === "vanguard" ? source : makeInstance("cfa-1821", `vg-${side}`, playerId),
    rear: Array(5).fill(null),
    hand: [], soul: [], drop: [], bind: [], damage: [], deck: [], orders: [], crests: [],
    giftZones: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  };
  if (sourceLocation === "rear-guard") own.rear[0] = source;
  let placed = sourceLocation === "rear-guard" ? 1 : 0;
  for (let i = 0; i < 5 && placed < rearguardCount; i++) {
    if (own.rear[i]) continue;
    own.rear[i] = makeInstance(rearguardClan === "Murakumo" ? "cfa-1818" : "cfa-1807", `rg-${side}-${i}`, playerId);
    placed++;
  }
  const opponent = {
    playerId: opponentId,
    vanguard: makeInstance("cfa-1821", `enemy-vg-${side}`, opponentId),
    rear: Array(5).fill(null), hand: [], soul: [], drop: [], bind: [], damage: [], deck: [],
    orders: [], crests: [], giftZones: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: []
  };
  const state = {
    matchId: `batch-0116-${side}-${sourceLocation}-${rearguardCount}-${rearguardClan}`,
    stateVersion: 1,
    eventSequence: 0,
    processedActionIds: [],
    processedAbilityTriggers: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingTrigger: null,
    pendingAttack: null,
    turn: 2,
    side,
    phase: 5,
    firstTurnComplete: true,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  return { state, source, own, opponent, side, playerId, opponentSide };
}

function attack(fixture) {
  return Reducer.applyGameAction(fixture.state, {
    actorAuthUid: fixture.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${fixture.state.matchId}`,
    expectedStateVersion: fixture.state.stateVersion,
    payload: {
      type: "game-action",
      action: "attack",
      attackerCardInstanceId: fixture.source.uid,
      targetCardInstanceId: fixture.opponent.vanguard.uid
    }
  }, SEATS, Engine);
}

test("Chain Geek definition preserves exact text and uses the server's existing continuous evaluator", () => {
  const { card, ability } = abilityFor(IMPLEMENTED.id);
  const definition = contributions.find(item => item.id === IMPLEMENTED.id);
  assert.ok(card.text.includes(IMPLEMENTED.text));
  assert.deepEqual(contributions.map(item => item.id), [IMPLEMENTED.id]);
  assert.equal(definition.printedText, IMPLEMENTED.text);
  assert.deepEqual(definition.requiredLocation, ["vanguard", "rear-guard"]);
  assert.deepEqual(definition.effects, [{
    op: "continuous-power", target: "source", amount: 3000, duration: "continuous",
    condition: { op: "all", conditions: [
      { op: "controller-turn" },
      { op: "controller-rearguard-clan-count-at-least", clan: "Murakumo", count: 4 }
    ] }
  }]);
  assert.equal(ability.definition?.source?.patternId, IMPLEMENTED.pattern);
  assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
  assert.equal(Engine.evaluateContinuousEffects([ability], {
    location: "rear-guard",
    sourceLocation: "rear-guard",
    sourceInstanceId: "source",
    targetInstanceId: "source",
    isControllerTurn: true,
    controllerFieldCards: Array.from({ length: 4 }, (_, index) => ({ uid: `rg-${index}`, zone: "rear-guard", clan: "Murakumo", clans: ["Murakumo"] }))
  }).power, 3000, "the existing continuous evaluator accepts and resolves the ability effect");
});

test("Chain Geek grants +3000 on either printed circle for both players with four Murakumo Rear-Guards", () => {
  const { ability } = abilityFor(IMPLEMENTED.id);
  for (const side of ["human", "bot"]) for (const sourceLocation of ["vanguard", "rear-guard"]) {
    const fixture = gameFixture({ side, sourceLocation, rearguardCount: 4 });
    const result = attack(fixture);
    assert.equal(result.ok, true, `${side}/${sourceLocation}: ${result.reason}`);
    assert.equal(fixture.state.pendingAttack.power, Number(fixture.source.power) + 3000, `${side}/${sourceLocation}`);
    assert.ok(Engine.parseCardAbilitiesCached(CATALOG.get("cfa-1818")).some(item => item.id === ability.id));
  }
});

test("Chain Geek fails closed below four, with wrong-clan, duplicate, off-circle, or opponent-turn state", () => {
  const { ability } = abilityFor(IMPLEMENTED.id);
  const evaluate = ({ location = "rear-guard", isControllerTurn = true, rear = [], duplicate = false } = {}) => {
    const cards = rear.map((clan, index) => ({
      uid: duplicate && (index === 0 || index === rear.length - 1) ? "same-instance" : `rear-${index}`,
      zone: "rear-guard",
      clan,
      clans: [clan]
    }));
    return Engine.evaluateContinuousEffects([ability], {
      location,
      sourceLocation: location,
      sourceInstanceId: "source",
      targetInstanceId: "source",
      isControllerTurn,
      controllerFieldCards: cards
    }).power;
  };
  assert.equal(evaluate({ rear: ["Murakumo", "Murakumo", "Murakumo"] }), 0, "three clan Rear-Guards fail");
  assert.equal(evaluate({ rear: ["Murakumo", "Murakumo", "Murakumo", "Kagero"] }), 0, "wrong-clan Rear-Guard does not count");
  assert.equal(evaluate({ rear: ["Murakumo", "Murakumo", "Murakumo", "Murakumo"], duplicate: true }), 0, "duplicate instance IDs count once");
  assert.equal(evaluate({ rear: ["Murakumo", "Murakumo", "Murakumo", "Murakumo"], isControllerTurn: false }), 0, "only active on its controller's turn");
  assert.equal(evaluate({ rear: ["Murakumo", "Murakumo", "Murakumo", "Murakumo"], location: "guardian" }), 0, "not active outside VC/RC");
  assert.equal(evaluate({ rear: ["Murakumo", "Murakumo", "Murakumo", "Murakumo"] }), 3000, "four unique Murakumo Rear-Guards qualify");
});

test("remaining unreviewed assignments stay unsupported with explicit blockers", () => {
  assert.equal(UNSUPPORTED.size, 8);
  for (const [id, blocker] of UNSUPPORTED) {
    const { card, ability } = abilityFor(id);
    assert.ok(card.text.includes(ability.printedText), `${id} exact catalog text`);
    assert.ok(blocker.length > 30, `${id} has a specific blocker`);
    assert.equal(Boolean(ability.definition), false, `${id} has no reviewed definition`);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${id} remains unsupported`);
    assert.equal(contributions.some(item => item.id === id), false, `${id} is not falsely compiled`);
  }
});
