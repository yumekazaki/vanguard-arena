"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const FAMILY = new Map([["cfa-1329", "Tachikaze"], ["cfa-786", "Pale Moon"], ["cfa-879", "Murakumo"]]);
const catalog = loadCatalog();
const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const player = playerId => ({ playerId, vanguard: null, rear: Array(5).fill(null), hand: [], soul: [], drop: [], damage: [], bind: [], deck: [], orders: [], crests: [], guardCircle: [], extra: [], gDeck: [], gZone: [] });
function card(uid, cardId, owner, extra = {}) { return { uid, cardId, ownerPlayerId: owner, controllerPlayerId: owner, type: "Unit", ...extra }; }
function fixture(cardId = "cfa-1329", side = "human", options = {}) {
  const clan = FAMILY.get(cardId), owner = side === "human" ? "player-host" : "player-guest", opponent = side === "human" ? "player-guest" : "player-host";
  const source = card(`source-${side}`, cardId, owner, { circle: "rear-left", grade: 1, name: "Source" });
  const vg = card(`vg-${side}`, "vg", owner, { clan: options.vanguardClan || clan, clans: [options.vanguardClan || clan], grade: 3, name: "Friendly Vanguard" });
  const damageDown = card(`damage-down-${side}`, "damage-down", owner, { faceDown: true });
  const damageUp = card(`damage-up-${side}`, "damage-up", owner, { faceDown: false });
  const own = player(owner), other = player(opponent); own.vanguard = vg; own.rear[0] = source; own.damage = [damageDown, damageUp];
  const state = { matchId: `act-clan-countercharge-${side}`, stateVersion: 1, turn: 2, side, phase: options.phase ?? 4, eventSequence: 0,
    processedActionIds: [], processedAbilityTriggers: [], pendingAbility: null, pendingAbilities: [], pendingTrigger: null, pendingAttack: null,
    players: side === "human" ? { human: own, bot: other } : { human: other, bot: own } };
  const definition = catalog.find(c => c.id === cardId), ability = Engine.parseCardAbilitiesCached(definition).find(a => a.id === `${cardId}:0`);
  assert.ok(ability, `compiled ${cardId}:0`);
  return { cardId, clan, source, own, other, state, ability, damageDown, damageUp, side };
}
function activate(f, { actorAuthUid = f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, damageUids = [f.damageDown.uid] } = {}) {
  return Reducer.applyManualAbilityActivation(f.state, { actorAuthUid, actionId: `act-clan-charge-${f.side}-${f.state.stateVersion}`, expectedStateVersion: f.state.stateVersion,
    payload: { type: "manual-ability-activation", sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { damageUids } } }, seats, Engine);
}

test("three clan-gated source-to-Soul ACT definitions preserve their clan, target choice, and costs", () => {
  for (const [cardId, clan] of FAMILY) {
    const f = fixture(cardId);
    assert.equal(f.ability.definition.source.patternId, "act-source-to-soul-clan-counter-charge-v1");
    assert.deepEqual(f.ability.requiredLocation, ["rear-guard"]);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-vanguard-has-clan", value: clan }]);
    assert.deepEqual(f.ability.costs, [{ type: "source-to-soul", count: 1 }]);
    assert.deepEqual(f.ability.definition.effects, [{ op: "counter-charge", count: 1 }]);
    assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true);
  }
});

test("both online seats pay their own source-to-Soul cost and flip only their selected damage", () => {
  for (const side of ["human", "bot"]) for (const cardId of FAMILY.keys()) {
    const f = fixture(cardId, side), result = activate(f);
    assert.equal(result.ok, true, `${cardId}/${side}: ${result.reason}`);
    assert.ok(f.own.soul.some(c => c.uid === f.source.uid));
    assert.equal(f.own.rear.includes(f.source), false);
    assert.equal(f.damageDown.faceDown, false);
    assert.equal(f.damageUp.faceDown, false);
    assert.equal(f.other.soul.length, 0);
  }
});

test("wrong Vanguard clan, actor, circle, timing, or damage selection rejects atomically", () => {
  const invalidCases = [
    { label: "wrong Vanguard clan", options: { vanguardClan: "Kagero" } },
    { label: "wrong timing", options: { phase: 2 } }
  ];
  for (const item of invalidCases) {
    const f = fixture("cfa-786", "human", item.options), before = JSON.stringify(f.state);
    assert.equal(activate(f).ok, false, item.label);
    assert.equal(JSON.stringify(f.state), before, item.label);
  }
  const wrongZone = fixture(); wrongZone.own.rear[0] = null; wrongZone.own.hand.push(wrongZone.source);
  const zoneBefore = JSON.stringify(wrongZone.state); assert.equal(activate(wrongZone).ok, false); assert.equal(JSON.stringify(wrongZone.state), zoneBefore);
  const forged = fixture("cfa-879", "bot"), forgedBefore = JSON.stringify(forged.state);
  assert.equal(activate(forged, { actorAuthUid: seats.hostAuthUid }).ok, false); assert.equal(JSON.stringify(forged.state), forgedBefore);
  for (const damageUids of [[], ["opponent-damage"], [fixture().damageUp.uid]]) {
    const f = fixture(), before = JSON.stringify(f.state);
    assert.equal(activate(f, { damageUids }).ok, false);
    assert.equal(JSON.stringify(f.state), before);
  }
});

test("tampered clan or cost cannot bypass the server ability allowlist", () => {
  const f = fixture();
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, costs: [{ type: "counter-blast", count: 1 }] }), false);
  assert.equal(Reducer.supportsServerAbilityEffects({ ...f.ability, definition: { ...f.ability.definition, printedText: f.ability.printedText.replace("Tachikaze", "Genesis") } }), false);
});
