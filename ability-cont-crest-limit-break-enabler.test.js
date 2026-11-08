"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const PATTERN = "cont-crest-vanguard-limit-break-4-active-at-three-or-less-v1";
const ABILITY_IDS = ["cfa-12577:2", "cfa-12580:2", "cfa-12591:2"];
const CARD_IDS = ABILITY_IDS.map(abilityId => abilityId.slice(0, abilityId.lastIndexOf(":")));
const KEYWORD = "vanguard-limit-break-4-active-at-three-or-less";

function makePlayer(playerId, side) {
  return {
    playerId,
    vanguard: { uid: `${side}-vg`, cardId: "cfa-264", grade: 3, ownerPlayerId: playerId, controllerPlayerId: playerId },
    rear: [], crests: [], damage: [{ uid: `${side}-d1` }, { uid: `${side}-d2` }, { uid: `${side}-d3` }],
    deck: [], hand: [], soul: [], drop: [], orders: [], gZone: [], giftZones: [], attackCount: 0
  };
}

function makeState({ crestSide = null, crestCardId = "cfa-12580", crestOverrides = {} } = {}) {
  const human = makePlayer("host-player", "human");
  const bot = makePlayer("joining-player", "bot");
  if (crestSide) {
    const player = crestSide === "human" ? human : bot;
    player.crests.push({ uid: `${crestSide}-crest`, cardId: crestCardId, ownerPlayerId: player.playerId, controllerPlayerId: player.playerId, ...crestOverrides });
  }
  return { turn: 1, side: "human", phase: 1, firstSide: "human", players: { human, bot } };
}

function limitBreakContext(state, side = "human") {
  const player = state.players[side];
  const located = Engine.locateCardInstance(state, player.vanguard.uid);
  assert.ok(located && !located.ambiguous);
  return Reducer.buildConditionContext(state, {}, located, Engine);
}

test("the three official Crest entries compile as passive Crest-zone Limit Break enablers", () => {
  const cards = loadCatalog().filter(card => CARD_IDS.includes(String(card.id)));
  assert.equal(cards.length, CARD_IDS.length);
  for (const [index, card] of cards.entries()) {
    const abilityId = ABILITY_IDS[index];
    assert.equal(String(card.id), CARD_IDS[index]);
    assert.match(card.text, /CONT:\s*Your vanguard[’']s Limit Break 4 abilities are active even if your damage zone has three or less cards\./i);
    const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(ability, card.id);
    assert.equal(ability.kind, "CONT", card.id);
    assert.equal(ability.definition?.source?.patternId, PATTERN, card.id);
    assert.deepEqual(ability.requiredLocation, ["crest"], card.id);
    assert.deepEqual(ability.definition?.keywords, [KEYWORD], card.id);
    assert.equal(ability.definition?.source?.officialTextVerified, true, card.id);
    assert.match(ability.definition?.source?.officialReference || "", /Cardfight-Vanguard-Comprehensive-Rules-4\.52\.pdf$/i, card.id);
    assert.equal(Engine.isManuallyActivatable(ability), false, card.id);
  }
});

test("only the controller's active Crest or Rear-Guard enabler changes the Vanguard Limit Break condition", () => {
  const limitBreak = Engine.parseCardAbilities({
    id: "crest-limit-break-condition-vanguard",
    text: "AUTO [VC] Limit Break 4: When this unit attacks a vanguard, this unit gets power +5000 until end of that battle."
  })[0];
  const noEnabler = makeState();
  const base = limitBreakContext(noEnabler);
  assert.equal(base.vanguardLimitBreakActive, false);
  assert.equal(Engine.evaluateAbilityConditions(limitBreak, base), false);

  for (const side of ["human", "bot"]) {
    const ownCrest = makeState({ crestSide: side, crestCardId: "cfa-12580" });
    const ownContext = limitBreakContext(ownCrest, side);
    assert.equal(ownContext.vanguardLimitBreakActive, true, side);
    assert.equal(Engine.evaluateAbilityConditions(limitBreak, ownContext), true, side);
    const opponentContext = limitBreakContext(ownCrest, side === "human" ? "bot" : "human");
    assert.equal(opponentContext.vanguardLimitBreakActive, false, side);
  }

  const inactive = makeState({ crestSide: "human", crestOverrides: { faceUp: false } });
  assert.equal(limitBreakContext(inactive).vanguardLimitBreakActive, false);

  const rearEnabler = makeState();
  rearEnabler.players.human.rear.push({ uid: "rear-enabler", cardId: "cfa-2316", ownerPlayerId: "host-player", controllerPlayerId: "host-player" });
  const rearContext = limitBreakContext(rearEnabler);
  assert.equal(rearContext.vanguardLimitBreakActive, true);
});

test("the server condition builder rejects a locked or opponent-controlled enabler", () => {
  const lockedRear = makeState();
  lockedRear.players.human.rear.push({ uid: "locked-enabler", cardId: "cfa-2316", ownerPlayerId: "host-player", controllerPlayerId: "host-player", locked: true });
  assert.equal(limitBreakContext(lockedRear).vanguardLimitBreakActive, false);

  const stolenCrest = makeState({ crestSide: "human", crestOverrides: { controllerPlayerId: "joining-player" } });
  assert.equal(limitBreakContext(stolenCrest).vanguardLimitBreakActive, false);
});
