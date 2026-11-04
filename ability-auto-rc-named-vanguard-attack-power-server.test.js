"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const FAMILY = [
  { cardId: "cfa-4410", abilityId: "cfa-4410:1", name: "Chronojet", amount: 2000, vanguardName: "Chronojet Dragon", reference: "https://en.cf-vanguard.com/cardlist/?cardno=G-CHB01%2F007EN&expansion=91&view=text" },
  { cardId: "cfa-9696", abilityId: "cfa-9696:1", name: "Overlord", amount: 5000, vanguardName: "Dragonic Overlord the End", reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT05%2F002EN" },
  { cardId: "cfa-10769", abilityId: "cfa-10769:0", name: "Avantgarda", amount: 5000, vanguardName: "Blue Deathster, \"Skyrender\" Avantgarda", reference: "https://en.cf-vanguard.com/cardlist/?cardno=D-SS12%2F063EN" }
];
const PATTERN = "auto-rc-named-vanguard-attack-power-turn-v1";
const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = id => CATALOG.find(card => String(card.id) === String(id));
const make = (cardId, uid, owner, extra = {}) => {
  const card = cardFor(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  return { uid, cardId: String(card.id), cardName: card.name, type: card.type, grade: Number(card.grade), power: Number(card.power || 0), ownerPlayerId: owner, controllerPlayerId: owner, ...extra };
};
const authFor = side => side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid;

function fixture({ side = "human", entry = FAMILY[0], vanguardName = entry.vanguardName, vanguardAttacks = true, sourceZone = "rear-left" } = {}) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = side === "human" ? "player-guest" : "player-host";
  const sourceCard = cardFor(entry.cardId);
  assert.ok(sourceCard);
  const source = make(entry.cardId, `source-${side}-${entry.cardId}`, ownId, { zone: sourceZone === "vanguard" ? "vanguard" : "rear-guard", circle: sourceZone });
  if (sourceZone === "vanguard") { source.cardName = `${entry.name} Vanguard`; source.name = source.cardName; source.grade = 3; }
  const vanguardDefinition = CATALOG.find(card => String(card.name).toLowerCase() === String(vanguardName).toLowerCase());
  const vanguard = vanguardDefinition
    ? make(vanguardDefinition.id, `vg-${side}`, ownId, { zone: "vanguard", circle: "vanguard" })
    : { uid: `vg-${side}`, cardId: `test-vanguard-${side}`, cardName: vanguardName, name: vanguardName, grade: 3, ownerPlayerId: ownId, controllerPlayerId: ownId, zone: "vanguard", circle: "vanguard" };
  const opponentVanguard = make("cfa-14047", `opponent-vg-${side}`, otherId, { zone: "vanguard", circle: "vanguard" });
  const player = (playerId, vg, rear) => ({ playerId, vanguard: vg, rear, hand: [], deck: [], damage: [], soul: [], drop: [], bind: [], orders: [], crests: [], extra: [], gDeck: [], gZone: [], triggerZone: [], guardCircle: [], usedAbilities: [] });
  const attackVanguard = sourceZone === "vanguard" ? source : vanguard;
  const own = player(ownId, attackVanguard, sourceZone === "vanguard" ? Array(5).fill(null) : [source, null, null, null, null]);
  const opponent = player(otherId, opponentVanguard, Array(5).fill(null));
  const battleId = `named-vg-attack-${side}-${entry.cardId}`;
  const state = {
    matchId: `named-vg-attack-${side}-${entry.cardId}`, stateVersion: 3, turn: 4, phase: 5, side,
    processedActionIds: [], processedEventIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    players: { human: side === "human" ? own : opponent, bot: side === "bot" ? own : opponent },
    pendingAttack: {
      battleId, attackerSide: side, attackerPlayerId: ownId, attackerUid: vanguardAttacks ? attackVanguard.uid : source.uid,
      attackerZone: vanguardAttacks ? "vanguard" : sourceZone, defenderSide: otherSide, defenderPlayerId: otherId,
      targetUid: opponentVanguard.uid, targetZone: "vanguard", power: 13000, targetPower: 13000, critical: 1,
      guardCards: [], defenderDone: false, driveChecksRemaining: 0, driveCountPrompt: false
    }
  };
  const attacker = vanguardAttacks ? attackVanguard : source;
  const attackerZone = vanguardAttacks ? "vanguard" : sourceZone;
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: ownId, turnPlayerId: ownId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: ownId, sourceControllerPlayerId: ownId,
    cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: ownId, subjectControllerPlayerId: ownId,
    attackingCardInstanceIds: [attacker.uid], previousLocation: attackerZone, currentLocation: attackerZone,
    targetCardInstanceIds: [opponentVanguard.uid], targetLocation: "vanguard", battleId, phase: "battle", timingWindow: "attack-declared"
  });
  const ability = Engine.parseCardAbilitiesCached(sourceCard).find(item => item.id === entry.abilityId);
  assert.ok(ability, `${entry.abilityId} parsed`);
  return { state, event, source, vanguard: attackVanguard, opponentVanguard, ability, side, ownId, entry };
}

function discover(f, event = f.event) { return Reducer.discoverAutoTriggers(f.state, [event], Engine); }
function resolve(f, { actor = authFor(f.side), accept = true, actionId = `resolve-${f.side}-${f.entry.cardId}` } = {}) {
  const pending = f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actor, actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept, selection: { instanceUid: f.source.uid, abilityId: pending?.ability?.id || f.ability.id, costSelections: { cb: [], sb: [], discard: [], reveal: [] } } }
  }, SEATS, Engine);
}

test("officially sourced examples compile with exact trigger, source circle, condition, duration, and server validation", () => {
  for (const entry of FAMILY) {
    const ability = Engine.parseCardAbilitiesCached(cardFor(entry.cardId)).find(item => item.id === entry.abilityId);
    assert.ok(ability);
    assert.equal(ability.definition.source.patternId, PATTERN);
    assert.equal(ability.definition.printedText, `AUTO [RC]: When your vanguard with \"${entry.name}\" in its card name attacks, this unit gets power +${entry.amount} until end of turn.`);
    assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(ability.trigger, { status: "recognized-trigger", eventType: "unit.attacked", subject: "vanguard", circles: ["vanguard"] });
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-name-contains", value: entry.name }]);
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.canDecline, false);
    assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: entry.amount, duration: "turn" }]);
    assert.ok(ability.definition.source.officialReferences.includes(entry.reference));
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true);
  }
});

test("host and joining player each receive and resolve power for their own Vanguard attack", () => {
  for (const side of ["human", "bot"]) for (const entry of FAMILY) {
    const f = fixture({ side, entry });
    const found = discover(f);
    assert.equal(found.queued.length, 1, `${side}/${entry.cardId}: ${JSON.stringify(found.skipped)}`);
    assert.equal(f.state.pendingAbility.side, side);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId, f.ownId);
    const result = resolve(f);
    assert.equal(result.ok, true, `${side}/${entry.cardId}: ${result.reason}`);
    assert.equal(f.source.turnPowerBoost, entry.amount);
    assert.equal(f.source.turnPowerExpiry, f.ownId);
    assert.equal(f.source.power, Number(cardFor(entry.cardId).power));
  }
});

test("another Rear-Guard attacking, an opponent Vanguard attacking, wrong Vanguard name, or wrong source circle does not trigger", () => {
  for (const entry of FAMILY) {
    const rearAttack = fixture({ entry, vanguardAttacks: false });
    assert.equal(discover(rearAttack).queued.length, 0, `${entry.cardId}: another unit attacks`);
    const wrongName = fixture({ entry, vanguardName: "Unrelated Vanguard" });
    assert.equal(discover(wrongName).queued.length, 0, `${entry.cardId}: vanguard name condition`);
    const wrongZone = fixture({ entry, sourceZone: "vanguard" });
    assert.equal(discover(wrongZone).queued.length, 0, `${entry.cardId}: source must remain in RC`);

    const opponentAttack = fixture({ entry });
    const opponentSide = opponentAttack.side === "human" ? "bot" : "human";
    const attacker = opponentAttack.state.players[opponentSide].vanguard;
    const event = Engine.createGameEvent(opponentAttack.state, {
      type: "unit.attacked", actingPlayerId: attacker.controllerPlayerId, turnPlayerId: attacker.controllerPlayerId,
      sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId, sourceControllerPlayerId: attacker.controllerPlayerId,
      cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: attacker.ownerPlayerId, subjectControllerPlayerId: attacker.controllerPlayerId,
      attackingCardInstanceIds: [attacker.uid], previousLocation: "vanguard", currentLocation: "vanguard",
      targetCardInstanceIds: [opponentAttack.vanguard.uid], targetLocation: "vanguard", battleId: "opponent-battle", phase: "battle", timingWindow: "attack-declared"
    });
    opponentAttack.state.pendingAttack = { ...opponentAttack.state.pendingAttack, battleId: "opponent-battle", attackerSide: opponentSide, attackerPlayerId: attacker.controllerPlayerId, attackerUid: attacker.uid, attackerZone: "vanguard", defenderSide: opponentAttack.side, defenderPlayerId: opponentAttack.ownId, targetUid: opponentAttack.vanguard.uid };
    assert.equal(discover(opponentAttack, event).queued.length, 0, `${entry.cardId}: opponent Vanguard attack`);
  }
});

test("duplicate event resolves once; a distinct later Vanguard attack can trigger again because no usage limit is printed", () => {
  const f = fixture({ side: "bot", entry: FAMILY[1] });
  assert.equal(discover(f).queued.length, 1);
  assert.equal(discover(f).queued.length, 0);
  assert.equal(resolve(f).ok, true);
  assert.equal(f.source.turnPowerBoost, 5000);
  const secondBattleId = "named-vg-second-attack";
  f.state.pendingAttack = { ...f.state.pendingAttack, battleId: secondBattleId, power: 13000 };
  const secondEvent = Engine.createGameEvent(f.state, { ...f.event, eventId: undefined, battleId: secondBattleId });
  assert.equal(discover(f, secondEvent).queued.length, 1);
  assert.equal(resolve(f, { actionId: "second-attack-resolution" }).ok, true);
  assert.equal(f.source.turnPowerBoost, 10000);
});

