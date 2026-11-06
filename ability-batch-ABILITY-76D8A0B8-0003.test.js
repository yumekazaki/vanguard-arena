"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
const contributions = require("./ability-contributions/batch-ABILITY-76D8A0B8-0003.js");
const MAIN_DEFINITIONS = require("./ability-definitions.js");
Engine.registerAbilityDefinitions(MAIN_DEFINITIONS);
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = new Map(loadCatalog().map(card => [String(card.id), card]));
const SUPPORTED = [
  {
    id: "cfa-1072:0",
    pattern: "auto-legacy-limit-break-vanguard-attack-power-v1",
    text: "AUTO [VC] Limit Break 4 (This ability is active if you have four or more damage): When this unit attacks a vanguard, this unit gets power +5000 until end of that battle.",
    effects: [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]
  },
  {
    id: "cfa-1072:1",
    pattern: "auto-own-attack-vanguard-clan-power-battle-v1",
    text: "AUTO [RC]: When this unit attacks a vanguard, if you have a «Narukami» vanguard, this unit gets power +2000 until end of that battle.",
    effects: [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]
  },
  {
    id: "cfa-10717:0",
    pattern: "auto-rc-placement-counter-blast-place-dragontree-marker-v1",
    text: "AUTO: When this unit is placed on RC, COST [Counter Blast 1], choose one of your RC without any Dragontree markers, and put a Dragontree marker.",
    effects: [{ op: "place-circle-marker", target: "chosen-controller-circle", markerType: "Dragontree", circleTypes: ["rear-guard"] }]
  },
  {
    id: "cfa-10730:0",
    pattern: "auto-rc-placement-counter-blast-place-dragontree-marker-v1",
    text: "AUTO: When this unit is placed on RC, COST [Counter Blast 1], choose one of your RC without any Dragontree markers, and put a Dragontree marker.",
    effects: [{ op: "place-circle-marker", target: "chosen-controller-circle", markerType: "Dragontree", circleTypes: ["rear-guard"] }]
  }
];

// Records stay unsupported until the listed engine capability exists.
// cfa-10724:0 shares the exact ride-and-call mechanic with cfa-10743:0 in batch 0004.
// Recommended future shared handler: exact ridden source + rider name filter,
// choose the named mate from Soul, then call both instances to legal RCs.
const UNSUPPORTED = new Map([
  ["cfa-10715:0", "Final Burst has no structured trigger event or event-origin fact."],
  ["cfa-10716:0", "Drive-check reveal cannot yet call the checked instance to RC and grant it Boost in one resolution."],
  ["cfa-10717:1", "No effect program calls a grade-filtered top-five deck choice to this source's same-column RC and shuffles."],
  ["cfa-10718:0", "No ordered choice handler returns two differently named set orders from Drop; persona-ride condition also lacks this exact definition."],
  ["cfa-10719:0", "No exact Soul-Blast event captures 4+ paid for the Vanguard ability, prior stand-by-ability history, and delayed end-turn retire/hand effect."],
  ["cfa-10720:0", "Retiring a Plant token as an activation cost is not a supported selectable cost."],
  ["cfa-10721:0", "No event identifies a critical trigger Soul-Blasted specifically as the cost of this Vanguard ability."],
  ["cfa-10721:1", "Binding all critical triggers among a Soul-Blast cost and applying three count-dependent effects is not represented."],
  ["cfa-10723:0", "Soul Charge does not expose its moved-card results for a conditional draw when one was a critical trigger."],
  ["cfa-10723:1", "Binding a selected trigger unit from Soul as an ACT cost is unsupported."],
  ["cfa-10724:0", "No handler selects a named Soul mate and calls it together with the exact ridden source; this is shared with batch 0004 cfa-10743:0."],
  ["cfa-10724:1", "No effect handler selects two trigger units from Drop and moves them to Soul before applying power."],
  ["cfa-10725:0", "No effect handler selects two trigger units from Drop and moves them to Soul."],
  ["cfa-10725:1", "Continuous conditions do not inspect whether a critical trigger is in Bind while granting both power and shield."],
  ["cfa-10726:0", "No continuous restriction prevents Rear-Guards from being hit based on whether the Vanguard was attacked this turn."],
  ["cfa-10727:0", "No Drop-to-hand target handler filters for grade 2 Strategy cards."],
  ["cfa-10728:0", "Temporary-ability grants target the source on VC; this effect must target the boosted unit on VC or RC."],
  ["cfa-10729:0", "No effect handler selects two trigger units from Drop and moves them to Soul."],
  ["cfa-10730:1", "Soul calling supports this exact source, not a selected grade-1-or-less Soul card called to the source's column."],
  ["cfa-10731:0", "No effect handler moves selected Rear-Guards owned by either player into their respective controllers' Soul and counts those choices for power."],
  ["cfa-10732:0", "Placement events do not carry a validated 'placed by a card ability' condition for this AUTO."],
  ["cfa-10733:0", "Per-marker power is supported, but continuous critical conditional on at least three markers is not."],
  ["cfa-10733:1", "The Calamity/Over Trigger ride-deck sequence, removal, trigger resolution, and marked-unit stand are not supported effects."],
  ["cfa-10734:0", "No selectable effect moves a trigger from Hand or Drop to Soul and draws only for the Hand choice."],
  ["cfa-10735:0", "Continuous conditions do not count trigger units in Bind."],
  ["cfa-10736:0", "Continuous Soul power counts matching cards, not distinct Calamity names."],
  ["cfa-10736:1", "Ride-deck Calamity movement, three-card ride-deck cost, named search/ride, and marker placement are not supported as one effect sequence."],
  ["cfa-10737:0", "The move event does not validate that this source entered Soul specifically by a Greedon Vanguard ability."],
  ["cfa-10737:1", "Soul-zone attack restriction requiring the opponent to call two or more cards at once is unsupported."],
  ["cfa-10738:0", "The source-cause trigger and conditional power-then-drive reduction sequence are unsupported."],
  ["cfa-10739:0", "X-overDress state is not an available condition for an own-attack AUTO."]
]);

const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
function abilityFor(id) {
  const cardId = id.split(":")[0], card = CATALOG.get(cardId);
  assert.ok(card, `catalog card ${cardId}`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `parsed ability ${id}`);
  return { card, ability };
}
function cardInstance(cardId, uid, playerId, extra = {}) {
  const definition = CATALOG.get(String(cardId));
  return {
    uid, cardId: String(cardId), cardName: definition?.name, grade: Number(definition?.grade ?? 0),
    power: Number(definition?.power ?? 0), type: definition?.type, unitCard: definition?.type === "Unit",
    ownerPlayerId: playerId, controllerPlayerId: playerId, ...extra
  };
}

function attackFixture(abilityId, side, { damageCount = 4, vanguardClan = "Narukami", eventSourceUid } = {}) {
  const { card, ability } = abilityFor(abilityId);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = cardInstance(card.id, `source-${abilityId}-${side}`, playerId, { power: 10000 });
  const target = cardInstance("cfa-3", `target-${side}`, opponentId, { grade: 3, power: 13000 });
  const vanguardCardId = vanguardClan === "Narukami" ? "cfa-864" : "cfa-540";
  const own = { playerId, vanguard: abilityId === "cfa-1072:0" ? source : cardInstance(vanguardCardId, `vg-${side}`, playerId, { clan: vanguardClan, clans: [vanguardClan], grade: 3 }), rear: Array(5).fill(null), damage: Array.from({ length: damageCount }, (_, i) => ({ uid: `damage-${side}-${i}`, faceDown: false, ownerPlayerId: playerId, controllerPlayerId: playerId })), hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], giftZones: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  if (abilityId === "cfa-1072:1") own.rear[0] = source;
  const opponent = { playerId: opponentId, vanguard: target, rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], giftZones: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = {
    matchId: `batch0003-attack-${abilityId}-${side}`, stateVersion: 1, eventSequence: 0, processedEventIds: [],
    processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null,
    pendingAttack: { battleId: `battle-${abilityId}-${side}`, attackerSide: side, attackerUid: source.uid, attackerPlayerId: playerId, attackerZone: abilityId === "cfa-1072:0" ? "vanguard" : "rear-left", defenderSide: side === "human" ? "bot" : "human", targetUid: target.uid, targetZone: "vanguard", power: source.power, targetPower: target.power },
    turn: 2, side, phase: 5,
    players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own }
  };
  const eventSource = eventSourceUid || source.uid;
  const event = Engine.createGameEvent(state, {
    type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: eventSource, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    subjectCardInstanceId: eventSource, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    cardInstanceId: eventSource, attackingCardInstanceIds: [eventSource], targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    previousLocation: abilityId === "cfa-1072:0" ? "vanguard" : "rear-left",
    currentLocation: abilityId === "cfa-1072:0" ? "vanguard" : "rear-left",
    battleId: state.pendingAttack.battleId, phase: "battle", timingWindow: "attack-declared"
  });
  return { card, ability, source, target, own, opponent, state, event, side, playerId };
}

function placementFixture(abilityId, side, { origin = "hand", circle = "rear-left", sourceEventUid } = {}) {
  const { ability, card } = abilityFor(abilityId);
  const playerId = side === "human" ? "player-host" : "player-guest";
  const opponentId = side === "human" ? "player-guest" : "player-host";
  const source = cardInstance(card.id, `source-${abilityId}-${side}`, playerId);
  const own = { playerId, vanguard: cardInstance("cfa-3", `vg-${side}`, playerId, { grade: 3 }), rear: Array(5).fill(null), damage: [{ uid: `damage-${side}`, faceDown: false, ownerPlayerId: playerId, controllerPlayerId: playerId }], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], giftZones: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  own.rear[0] = source;
  const opponent = { playerId: opponentId, vanguard: cardInstance("cfa-3", `enemy-vg-${side}`, opponentId), rear: Array(5).fill(null), damage: [], hand: [], soul: [], drop: [], bind: [], deck: [], orders: [], crests: [], giftZones: [], guardCircle: [], triggerZone: [], gDeck: [], gZone: [] };
  const state = { matchId: `batch0003-place-${abilityId}-${side}`, stateVersion: 1, eventSequence: 0, processedEventIds: [], processedAbilityTriggers: [], processedActionIds: [], pendingAbilities: [], pendingAbility: null, pendingTrigger: null, turn: 2, side, phase: 2, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
  const eventSource = sourceEventUid || source.uid;
  const event = Engine.createGameEvent(state, {
    type: "card.placed", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: eventSource, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    cardInstanceId: eventSource, subjectCardInstanceId: eventSource, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    previousLocation: origin, currentLocation: circle, circle, phase: "main", timingWindow: "placement"
  });
  return { ability, source, own, opponent, state, event, side, playerId };
}

function decide(f, { circleZone, actorAuthUid, actionId = `resolve-${f.ability.id}-${f.side}` } = {}) {
  return Reducer.applyAbilityDecision(f.state, {
    actorAuthUid: actorAuthUid || (f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid),
    actionId, expectedStateVersion: f.state.stateVersion,
    payload: { type: "ability-response", accept: true, selection: { instanceUid: f.source.uid, abilityId: f.ability.id, ...(circleZone ? { circleZone } : {}), costSelections: { cb: [f.own.damage[0]?.uid].filter(Boolean) } } }
  }, SEATS, Engine);
}

test("the assigned implemented definitions retain exact source text and server-supported effects", () => {
  assert.equal(contributions.length, 0, "supported definitions are already in the main definition set; do not register duplicates");
  for (const expected of SUPPORTED) {
    const { card, ability } = abilityFor(expected.id);
    const definition = MAIN_DEFINITIONS.find(item => item.id === expected.id);
    assert.ok(card.text.includes(expected.text), expected.id);
    assert.ok(definition, expected.id);
    assert.equal(definition.printedText, expected.text, expected.id);
    assert.equal(ability.definition?.source?.patternId, expected.pattern, expected.id);
    assert.deepEqual(ability.definition?.effects, expected.effects, expected.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, expected.id);
  }
});

test("Discharging Dragon requires its own Vanguard attack, Limit Break, and Narukami Vanguard as printed", () => {
  for (const side of ["human", "bot"]) {
    const belowBreak = attackFixture("cfa-1072:0", side, { damageCount: 3 });
    assert.equal(Reducer.discoverAutoTriggers(belowBreak.state, [belowBreak.event], Engine).queued.length, 0);

    const wrongSource = attackFixture("cfa-1072:0", side);
    const unrelatedEvent = { ...wrongSource.event, sourceCardInstanceId: "another-unit", subjectCardInstanceId: "another-unit", attackingCardInstanceIds: ["another-unit"] };
    assert.equal(Reducer.discoverAutoTriggers(wrongSource.state, [unrelatedEvent], Engine).queued.length, 0);

    const limitBreak = attackFixture("cfa-1072:0", side);
    assert.equal(Reducer.discoverAutoTriggers(limitBreak.state, [limitBreak.event], Engine).queued.length, 1);
    assert.equal(Reducer.applyAbilityDecision(limitBreak.state, { actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId: `lb-${side}`, expectedStateVersion: 1, payload: { accept: true, selection: { instanceUid: limitBreak.source.uid, abilityId: limitBreak.ability.id } } }, SEATS, Engine).ok, true);
    assert.equal(limitBreak.state.pendingAttack.power, 15000);

    const wrongClan = attackFixture("cfa-1072:1", side, { vanguardClan: "Kagero" });
    assert.equal(Reducer.discoverAutoTriggers(wrongClan.state, [wrongClan.event], Engine).queued.length, 0);
    const rcAttack = attackFixture("cfa-1072:1", side);
    const wrongTarget = { ...rcAttack.event, targetLocation: "rear-guard" };
    assert.equal(Reducer.discoverAutoTriggers(rcAttack.state, [wrongTarget], Engine).queued.length, 0);
    const clanAttackResult = Reducer.discoverAutoTriggers(rcAttack.state, [rcAttack.event], Engine);
    assert.equal(clanAttackResult.queued.length, 1, JSON.stringify({ side, skipped: clanAttackResult.skipped, event: rcAttack.event, ability: rcAttack.ability }));
    assert.equal(Reducer.applyAbilityDecision(rcAttack.state, { actorAuthUid: side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid, actionId: `narukami-${side}`, expectedStateVersion: 1, payload: { accept: true, selection: { instanceUid: rcAttack.source.uid, abilityId: rcAttack.ability.id } } }, SEATS, Engine).ok, true);
    assert.equal(rcAttack.state.pendingAttack.power, 12000);
  }
});

test("both Dragontree placement definitions resolve only their source's RC placement and require payable Counter Blast", () => {
  for (const abilityId of ["cfa-10717:0", "cfa-10730:0"]) for (const side of ["human", "bot"]) {
    const valid = placementFixture(abilityId, side, { origin: "hand" });
    assert.equal(Reducer.discoverAutoTriggers(valid.state, [valid.event], Engine).queued.length, 1, `${abilityId}/${side}`);
    assert.equal(valid.state.pendingAbility.side, side);
    assert.equal(decide(valid, { circleZone: "rear-right" }).ok, true);
    assert.deepEqual(valid.own.giftZones, [{ type: "Dragontree", zone: "rear-right" }]);
    assert.equal(valid.own.damage[0].faceDown, true);
    assert.deepEqual(valid.opponent.giftZones, []);

    const otherInstance = placementFixture(abilityId, side, { sourceEventUid: "another-instance" });
    assert.equal(Reducer.discoverAutoTriggers(otherInstance.state, [otherInstance.event], Engine).queued.length, 0);
    const wrongCircle = placementFixture(abilityId, side);
    const vanguardEvent = { ...wrongCircle.event, currentLocation: "vanguard", circle: "vanguard" };
    assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state, [vanguardEvent], Engine).queued.length, 0);
    const noCost = placementFixture(abilityId, side);
    noCost.own.damage[0].faceDown = true;
    assert.equal(Reducer.discoverAutoTriggers(noCost.state, [noCost.event], Engine).queued.length, 0);
    const wrongActor = placementFixture(abilityId, side);
    assert.equal(Reducer.discoverAutoTriggers(wrongActor.state, [wrongActor.event], Engine).queued.length, 1);
    const snapshot = JSON.stringify(wrongActor.state);
    assert.equal(decide(wrongActor, { circleZone: "rear-right", actorAuthUid: side === "human" ? SEATS.guestAuthUid : SEATS.hostAuthUid }).ok, false);
    assert.equal(JSON.stringify(wrongActor.state), snapshot);
  }
});

test("all other assigned abilities remain unsupported with explicit engine blockers", () => {
  assert.equal(UNSUPPORTED.size, 31);
  for (const [id, blocker] of UNSUPPORTED) {
    assert.ok(blocker.length > 12, `${id} blocker is specific`);
    assert.equal(SUPPORTED.some(item => item.id === id), false, `${id} is not marked implemented`);
    const { ability } = abilityFor(id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), false, `${id}: ${blocker}`);
  }
});
