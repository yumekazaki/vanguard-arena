"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const PATTERN = "cont-vc-rc-turn-clan-soul-threshold-power-v1";
const FAMILY = new Map([
  ["cfa-459", { clan: "Dark Irregulars", soulCardId: "cfa-459" }],
  ["cfa-470", { clan: "Dark Irregulars", soulCardId: "cfa-459" }],
  ["cfa-643", { clan: "Royal Paladin", soulCardId: "cfa-643" }],
  ["cfa-668", { clan: "Royal Paladin", soulCardId: "cfa-643" }]
]);
const SEATS = { hostAuthUid: "host-auth", guestAuthUid: "guest-auth", hostSide: "human", guestSide: "bot" };
const PLAYER_IDS = { human: "host-player", bot: "guest-player" };

function makeCard(cardId, uid, ownerPlayerId, controllerPlayerId = ownerPlayerId, extra = {}) {
  const definition = CATALOG.get(String(cardId));
  assert.ok(definition, `catalog card ${cardId} exists`);
  return Engine.createCardInstance(String(cardId), ownerPlayerId, uid, {
    cardName: definition.name,
    type: definition.type,
    grade: Number(definition.grade),
    power: Number(definition.power),
    shield: Number(definition.shield),
    unitCard: definition.type === "Unit",
    critical: 1,
    controllerPlayerId,
    ...extra
  });
}

function soulCopies(clan, playerId, prefix, count) {
  const cardId = clan === "Dark Irregulars" ? "cfa-459" : "cfa-643";
  return Array.from({ length: count }, (_, index) => makeCard(cardId, `${prefix}-soul-${index}`, playerId, playerId, { zone: "soul" }));
}

function fixture({ cardId = "cfa-459", side = "human", soulCount = 6, opponentSoulCount = 0, activeSide = side, sourceLocation = "rear-guard" } = {}) {
  const sourceDefinition = CATALOG.get(cardId);
  const clan = FAMILY.get(cardId).clan;
  const sourcePlayerId = PLAYER_IDS[side];
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentPlayerId = PLAYER_IDS[opponentSide];
  const source = makeCard(cardId, `source-${cardId}-${side}`, sourcePlayerId, sourcePlayerId, {
    zone: sourceLocation, circle: sourceLocation === "vanguard" ? "vanguard" : "rear-left"
  });
  const ownVanguard = sourceLocation === "vanguard"
    ? source
    : makeCard("cfa-1", `own-vanguard-${side}`, sourcePlayerId, sourcePlayerId, { zone: "vanguard", circle: "vanguard" });
  const opponentVanguard = makeCard("cfa-1", `opponent-vanguard-${side}`, opponentPlayerId, opponentPlayerId, { zone: "vanguard", circle: "vanguard" });
  const makePlayer = (playerId, vanguard) => ({
    playerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], damage: [], drop: [], soul: [], bind: [], orders: [],
    crests: [], guardCircle: [], triggerZone: [], gZone: [], gDeck: [], removed: [], giftZones: []
  });
  const owner = makePlayer(sourcePlayerId, ownVanguard);
  const opponent = makePlayer(opponentPlayerId, opponentVanguard);
  if (sourceLocation === "rear-guard") owner.rear[0] = source;
  owner.soul = soulCopies(clan, sourcePlayerId, `own-${cardId}-${side}`, soulCount);
  opponent.soul = soulCopies(clan, opponentPlayerId, `opponent-${cardId}-${side}`, opponentSoulCount);
  const players = { [side]: owner, [opponentSide]: opponent };
  const state = {
    matchId: `clan-soul-${cardId}-${side}-${soulCount}-${activeSide}`,
    stateVersion: 1, turn: 2, side: activeSide, phase: 5, firstTurnComplete: true,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    pendingTrigger: null, pendingAttack: null, players
  };
  const actorSide = activeSide;
  const actor = players[actorSide];
  const defender = players[actorSide === side ? opponentSide : side];
  const attacker = actorSide === side ? source : actor.vanguard;
  const command = {
    actorAuthUid: actorSide === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
    actionId: `attack-${state.matchId}`,
    expectedStateVersion: state.stateVersion,
    payload: { action: "attack", attackerCardInstanceId: attacker.uid,
      targetCardInstanceId: actorSide === side ? defender.vanguard.uid : source.uid }
  };
  return { sourceDefinition, source, owner, opponent, state, command, side, opponentSide, sourcePlayerId, clan };
}

test("four real VC/RC CONT abilities compile the exact clan Soul threshold", () => {
  for (const [cardId, expected] of FAMILY) {
    const card = CATALOG.get(cardId);
    const ability = Engine.parseCardAbilitiesCached(card).find(value => value.definition?.source?.patternId === PATTERN);
    assert.ok(ability, `${cardId} has the shared definition`);
    assert.equal(ability.id, `${cardId}:0`);
    assert.equal(ability.kind, "CONT");
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.conditionStatus, "modeled");
    assert.equal(ability.definition.conditionsReviewed, true);
    assert.deepEqual(ability.definition.effects, [{
      op: "continuous-power", target: "source", amount: 3000, duration: "continuous",
      condition: { op: "all", conditions: [{ op: "controller-turn" }, { op: "soul-clan-count-at-least", clan: expected.clan, count: 6 }] }
    }]);
  }
});

test("six distinct controlled clan cards in Soul grant power to the exact source on VC or RC for either seat", () => {
  for (const [cardId] of FAMILY) for (const side of ["human", "bot"]) for (const sourceLocation of ["vanguard", "rear-guard"]) {
    const f = fixture({ cardId, side, soulCount: 6, opponentSoulCount: 8, sourceLocation });
    const result = Reducer.applyGameAction(f.state, {
      actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid,
      actionId: `attack-${f.state.matchId}`,
      expectedStateVersion: f.state.stateVersion,
      payload: { type: "game-action", action: "attack", attackerCardInstanceId: f.source.uid, targetCardInstanceId: f.opponent.vanguard.uid }
    }, SEATS, Engine);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power, Number(f.sourceDefinition.power) + 3000, `${cardId}/${side}`);
  }
});

test("fewer than six, wrong-turn, or opponent-only Soul cards do not grant the power", () => {
  for (const [cardId] of FAMILY) {
    for (const sourceLocation of ["vanguard", "rear-guard"]) {
      for (const scenario of [
        { name: "five own Soul cards", soulCount: 5, opponentSoulCount: 8, activeSide: "human" },
        { name: "opponent-only Soul cards", soulCount: 0, opponentSoulCount: 8, activeSide: "human" },
        { name: "wrong turn", soulCount: 6, opponentSoulCount: 0, activeSide: "bot" }
      ]) {
        const f = fixture({ cardId, sourceLocation, ...scenario });
        const result = Reducer.applyGameAction(f.state, {
          actorAuthUid: f.command.actorAuthUid, actionId: `attack-${f.state.matchId}`, expectedStateVersion: f.state.stateVersion,
          payload: { type: "game-action", action: "attack", attackerCardInstanceId: f.command.payload.attackerCardInstanceId,
            targetCardInstanceId: f.command.payload.targetCardInstanceId }
        }, SEATS, Engine);
        assert.equal(result.ok, true, `${cardId}/${sourceLocation}/${scenario.name}: ${result.reason}`);
        const actualSourcePower = scenario.activeSide === "human"
          ? f.state.pendingAttack.power
          : f.state.pendingAttack.targetPower;
        assert.equal(actualSourcePower, Number(f.sourceDefinition.power), `${cardId}/${sourceLocation}/${scenario.name}`);
      }
    }
  }
});

test("Soul condition fails closed for missing, duplicate, wrong-zone, or wrong-controller instance data", () => {
  const card = CATALOG.get("cfa-459");
  const ability = Engine.parseCardAbilitiesCached(card).find(value => value.definition?.source?.patternId === PATTERN);
  const cards = soulCopies("Dark Irregulars", "owner", "safe", 6).map(instance => ({
    uid: instance.uid, controllerPlayerId: "owner", zone: "soul", clans: Engine.getCardClans(CATALOG.get(instance.cardId))
  }));
  const evaluate = (controllerSoulCards, isControllerTurn = true) => Engine.evaluateContinuousEffects([ability], {
    location: "rear-guard", isControllerTurn, controllerPlayerId: "owner", sourceInstanceId: "source", targetInstanceId: "source", controllerSoulCards
  }).power;
  assert.equal(evaluate(cards), 3000);
  const otherClan = soulCopies("Royal Paladin", "owner", "wrong-clan", 6).map(instance => ({
    uid: instance.uid, controllerPlayerId: "owner", zone: "soul", clans: Engine.getCardClans(CATALOG.get(instance.cardId))
  }));
  assert.equal(evaluate(otherClan), 0);
  assert.equal(evaluate(cards, false), 0);
  assert.equal(evaluate(cards.slice(0, 5)), 0);
  assert.equal(evaluate(undefined), 0);
  assert.equal(evaluate(cards.map(card => ({ ...card, zone: "drop" }))), 0);
  assert.equal(evaluate(cards.map((card, index) => index === 0 ? { ...card, controllerPlayerId: "opponent" } : card)), 0);
  assert.equal(evaluate(cards.map((card, index) => index === 0 ? { ...card, uid: undefined } : card)), 0);
  assert.equal(evaluate(cards.map((card, index) => index === 1 ? { ...card, uid: cards[0].uid } : card)), 0);
  assert.equal(evaluate(cards.map((card, index) => index === 0 ? { ...card, clans: [] } : card)), 0);
  assert.equal(Engine.evaluateContinuousEffects([ability], { location: "guardian", isControllerTurn: true, controllerPlayerId: "owner", controllerSoulCards: cards }).power, 0);
});

test("browser and authoritative reducer construct identity-aware Soul clan context", () => {
  assert.match(fs.readFileSync("app.js", "utf8"), /controllerSoulCards=\(player\.soul\|\|\[\]\)\.map\(card=>\{const definition=cardMap\.get\(card\?\.cardId\)/);
  assert.match(fs.readFileSync("ability-server-reducer.js", "utf8"), /controllerSoulCards: \(player\.soul \|\| \[\]\)\.map\(card => \{ const definition = serverCardDefinition\(card\)/);
});
