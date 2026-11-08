"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CARD_ID = "cfa-260";
const OFFICIAL_CARD = "https://en.cf-vanguard.com/cardlist/?cardno=BT04%2F004EN&expansion=15&view=image";
const catalog = loadCatalog();
const cardDefinition = catalog.find(card => card.id === CARD_ID);
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };

function card(cardId, uid, playerId, extra = {}) {
  const definition = catalog.find(item => item.id === cardId);
  return {
    uid, cardId, cardName: definition?.name || cardId,
    type: "Normal Unit", unitCard: true,
    grade: Number(definition?.grade || 0), power: Number(definition?.power || 0),
    critical: 1, drive: 1, faceUp: true, rested: false,
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function attackFixture(side, { soulOwner = null, soulName = "Enigman Wave", sourceZone = "vanguard" } = {}) {
  const ownPlayerId = side === "human" ? "host-player" : "guest-player";
  const opponentSide = side === "human" ? "bot" : "human";
  const opponentPlayerId = side === "human" ? "guest-player" : "host-player";
  const source = card(CARD_ID, `storm-${side}`, ownPlayerId);
  const ownVanguard = sourceZone === "vanguard" ? source : card("cfa-14", `own-vg-${side}`, ownPlayerId, { zone: "vanguard", circle: "vanguard" });
  const target = card("cfa-14", `target-${side}`, opponentPlayerId, { zone: "vanguard", circle: "vanguard" });
  const createPlayer = (playerId, vanguard) => ({
    playerId, vanguard, rear: Array(5).fill(null), hand: [], deck: [], soul: [], damage: [], drop: [], bind: [],
    orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [], removed: [], triggerZone: []
  });
  const players = { human: createPlayer("host-player", null), bot: createPlayer("guest-player", null) };
  players[side].vanguard = ownVanguard;
  players[opponentSide].vanguard = target;
  if (sourceZone !== "vanguard") {
    source.zone = "rear-guard";
    source.circle = sourceZone;
    players[side].rear[0] = source;
  }
  if (soulOwner) {
    const ownerSide = soulOwner === "controller" ? side : opponentSide;
    const ownerId = ownerSide === "human" ? "host-player" : "guest-player";
    players[ownerSide].soul.push(card("fixture-enigman-wave", `soul-${soulOwner}-${side}`, ownerId, { cardName: soulName }));
  }
  const state = {
    matchId: `enigman-storm-${side}-${soulOwner || "no-soul"}-${sourceZone}`,
    stateVersion: 0, turn: 2, side, phase: 5, firstTurnComplete: true,
    processedActionIds: [], pendingAttack: null, pendingAbility: null, pendingAbilities: [], pendingTrigger: null,
    authoritySeats: { hostSide: "human", guestSide: "bot" }, players
  };
  const command = {
    actorAuthUid: side === "human" ? seats.hostAuthUid : seats.guestAuthUid,
    actionId: `attack-${state.matchId}`, expectedStateVersion: 0,
    payload: { type: "game-action", action: "attack", attackerCardInstanceId: source.uid, targetCardInstanceId: target.uid }
  };
  return { state, command, source };
}

test("cfa-260:0 and cfa-260:1 match both Enigman Storm abilities in Bushiroad's BT04 listing", () => {
  assert.ok(cardDefinition);
  const abilities = Engine.parseCardAbilities(cardDefinition);
  assert.deepEqual(abilities.map(ability => ability.id), ["cfa-260:0", "cfa-260:1"]);
  const soulPower = abilities.find(ability => ability.id === "cfa-260:0");
  const attackStep = abilities.find(ability => ability.id === "cfa-260:1");
  assert.equal(soulPower.printedText, 'CONT [VC]: If you have a card named "Enigman Wave" in your soul, this unit gets power +1000.');
  assert.equal(attackStep.printedText, "AUTO [VC]: At the beginning of your attack step, if this unit’s power is 15000 or greater, this unit gets critical +1 until end of that battle.");
  for (const ability of [soulPower, attackStep]) {
    assert.equal(ability.definition.source.officialCardNumber, "BT04/004EN");
    assert.equal(ability.definition.source.officialReference, OFFICIAL_CARD);
    assert.equal(ability.definition.source.officialTextVerified, true);
  }
  assert.equal(soulPower.definition.source.patternId, "cont-named-soul-card-power-v1");
  assert.equal(attackStep.definition.source.patternId, "auto-attack-step-source-power-critical-battle-v1");
});

test("cfa-260:0 grants its exact +1000 only to this Vanguard while its controller has Enigman Wave in Soul", () => {
  const ability = Engine.parseCardAbilities(cardDefinition).find(item => item.id === "cfa-260:0");
  for (const side of ["host", "joining player"]) {
    const evaluate = (location, soulCardNames, sourceInstanceId = "storm-source", targetInstanceId = "storm-source") => Engine.evaluateContinuousEffects([ability], {
      location, sourceLocation: location, sourceInstanceId, targetInstanceId, soulCardNames, isControllerTurn: false
    }).power;
    assert.equal(evaluate("vanguard", ["Enigman Wave"]), 1000, `${side}: exact Soul name applies`);
    assert.equal(evaluate("vanguard", ["enigman wave"]), 1000, `${side}: printed name comparison is case-insensitive`);
    assert.equal(evaluate("vanguard", ["Enigman Wave, Another Form"]), 0, `${side}: a partial name does not apply`);
    assert.equal(evaluate("vanguard", []), 0, `${side}: missing Soul card does not apply`);
    assert.equal(evaluate("rear-guard", ["Enigman Wave"]), 0, `${side}: Rear-Guard circle does not apply`);
    assert.equal(evaluate("vanguard", ["Enigman Wave"], "other-instance", "storm-source"), 0, `${side}: a different card instance cannot receive the bonus`);
  }
});

test("the authoritative attack power uses only the controller's Soul for host and joining player", () => {
  for (const side of ["human", "bot"]) {
    const ownSoul = attackFixture(side, { soulOwner: "controller" });
    const ownResult = Reducer.applyGameAction(ownSoul.state, ownSoul.command, seats, Engine);
    assert.equal(ownResult.ok, true, `${side}: ${ownResult.reason}`);
    assert.equal(ownResult.state.pendingAttack.power, 11000, `${side}: own Enigman Wave grants +1000`);

    const opponentSoul = attackFixture(side, { soulOwner: "opponent" });
    const opponentResult = Reducer.applyGameAction(opponentSoul.state, opponentSoul.command, seats, Engine);
    assert.equal(opponentResult.ok, true, `${side}: ${opponentResult.reason}`);
    assert.equal(opponentResult.state.pendingAttack.power, 10000, `${side}: opponent Soul is not used`);

    const wrongName = attackFixture(side, { soulOwner: "controller", soulName: "Enigman Wave, Another Form" });
    const wrongNameResult = Reducer.applyGameAction(wrongName.state, wrongName.command, seats, Engine);
    assert.equal(wrongNameResult.ok, true, `${side}: ${wrongNameResult.reason}`);
    assert.equal(wrongNameResult.state.pendingAttack.power, 10000, `${side}: non-exact name is rejected`);

    const wrongCircle = attackFixture(side, { soulOwner: "controller", sourceZone: "rear-left" });
    const wrongCircleResult = Reducer.applyGameAction(wrongCircle.state, wrongCircle.command, seats, Engine);
    assert.equal(wrongCircleResult.ok, true, `${side}: ${wrongCircleResult.reason}`);
    assert.equal(wrongCircleResult.state.pendingAttack.power, 10000, `${side}: the VC-only bonus does not apply on RC`);
  }
});
