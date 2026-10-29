"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");
const FAMILY = [["cfa-486", "Werwolf Sieger"], ["cfa-693", "Blaster Blade"]];
const catalog = loadCatalog(), seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function instance(id, uid, owner, extra = {}) { const def = catalog.find(c => c.id === id); return { uid, cardId: id, cardName: def?.name || id, type: def?.type || "Unit", grade: Number(def?.grade || 0), ownerPlayerId: owner, controllerPlayerId: owner, ...extra }; }
function fixture(cardId, soulName, side = "human", hasSoul = true, cost = true) {
  const pid = side === "human" ? "host-player" : "guest-player", enemy = side === "human" ? "bot" : "human", enemyId = side === "human" ? "guest-player" : "host-player";
  const source = instance(cardId, `source-${cardId}-${side}`, pid, { zone: "vanguard", circle: "vanguard", power: 10000, critical: 1 });
  const damage = Array.from({ length: cost ? 2 : 1 }, (_, i) => instance("cfa-3", `damage-${cardId}-${side}-${i}`, pid, { zone: "damage", faceDown: false }));
  const soul = hasSoul ? [instance("cfa-3", `soul-${cardId}-${side}`, pid, { cardName: soulName, zone: "soul" })] : [];
  const own = { playerId: pid, vanguard: source, rear: Array(5).fill(null), soul, damage, hand: [], drop: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const other = { playerId: enemyId, vanguard: null, rear: Array(5).fill(null), soul: [], damage: [], hand: [], drop: [], deck: [], bind: [], guardCircle: [], orders: [], gDeck: [], gZone: [], triggerZone: [] };
  const state = { matchId: `named-soul-${cardId}-${side}`, stateVersion: 1, processedActionIds: [], pendingAbilities: [], side, phase: 4, turn: 1, players: { [side]: own, [enemy]: other } };
  const ability = Engine.parseCardAbilities(catalog.find(c => c.id === cardId)).find(a => a.id === `${cardId}:0`);
  assert.ok(ability); return { state, own, other, source, damage, ability, side };
}
function activate(f) { return Reducer.applyManualAbilityActivation(f.state, { actorAuthUid: f.side === "human" ? seats.hostAuthUid : seats.guestAuthUid, actionId: `activate-${f.source.uid}`, expectedStateVersion: f.state.stateVersion, payload: { sourceCardInstanceId: f.source.uid, abilityId: f.ability.id, selection: { costSelections: { cb: f.damage.slice(0, 2).map(c => c.uid), sb: [], discard: [], reveal: [] } } } }, seats, Engine); }

test("both exact named-Soul ACT definitions are trusted and preserve circle, costs, conditions, and effects", () => {
  for (const [cardId, name] of FAMILY) {
    const f = fixture(cardId, name); assert.equal(Reducer.supportsServerAbilityEffects(f.ability), true, cardId);
    assert.deepEqual(f.ability.requiredLocation, ["vanguard"]);
    assert.deepEqual(f.ability.costs, [{ type: "counter-blast", count: 2 }]);
    assert.deepEqual(f.ability.conditions, [{ type: "controller-soul-has-card-name", value: name }]);
    assert.deepEqual(f.ability.definition.effects.map(e => [e.op, e.amount, e.duration]), [["modify-power", 5000, "turn"], ["modify-critical", 1, "turn"]]);
  }
});
test("host and joining player can each activate their own ACT and receive the power and critical", () => {
  for (const [cardId, name] of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture(cardId, name, side), result = activate(f); assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(f.source.turnPowerBoost, 5000); assert.equal(f.source.turnCriticalBoost, 1);
    assert.equal(f.damage.slice(0, 2).every(c => c.faceDown), true);
    assert.equal(f.other.vanguard, null);
  }
});
test("the ACT rejects a missing named Soul card, insufficient Counter-Blast, and an off-circle source atomically", () => {
  const noSoul = fixture(FAMILY[0][0], FAMILY[0][1], "human", false); assert.equal(activate(noSoul).ok, false); assert.equal(noSoul.source.turnPowerBoost, undefined);
  const noCost = fixture(FAMILY[1][0], FAMILY[1][1], "bot", true, false); assert.equal(activate(noCost).ok, false); assert.equal(noCost.source.turnCriticalBoost, undefined);
  const wrongCircle = fixture(FAMILY[0][0], FAMILY[0][1]); wrongCircle.own.vanguard = null; wrongCircle.own.rear[0] = wrongCircle.source; wrongCircle.source.zone = "rear-guard"; wrongCircle.source.circle = "rear-left"; assert.equal(activate(wrongCircle).ok, false); assert.equal(wrongCircle.source.turnPowerBoost, undefined);
});
