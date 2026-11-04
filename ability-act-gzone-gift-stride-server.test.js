"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const CATALOG = loadCatalog();
const FORCE_IDS = ["cfa-10780", "cfa-11106", "cfa-11110", "cfa-11112", "cfa-11124", "cfa-11126", "cfa-11128", "cfa-11136", "cfa-11144", "cfa-11146"];
const ACCEL_IDS = ["cfa-11108", "cfa-11116", "cfa-11118", "cfa-11120", "cfa-11122", "cfa-11132", "cfa-11138", "cfa-11142"];
const FAMILY = [
  ...FORCE_IDS.map(cardId => ({ cardId, giftType: "Force" })),
  ...ACCEL_IDS.map(cardId => ({ cardId, giftType: "Accel" }))
].map(entry => {
  const card = CATALOG.find(item => String(item.id) === entry.cardId);
  assert.ok(card, `catalog card ${entry.cardId}`);
  const text = String(card.text || "");
  const abilityText = text.split(/\r?\n/).find(line => /^ACT \[G Zone\]:/i.test(line));
  assert.ok(abilityText, `${entry.cardId} has the expected G-zone ACT`);
  const vanguardName = abilityText.match(/If your vanguard is a grade 3 ["“]([^"”]+)["”]/i)?.[1];
  assert.ok(vanguardName, `${entry.cardId} has its printed Vanguard condition`);
  assert.match(abilityText, new RegExp(`get two Imaginary Gift:${entry.giftType}\\.`, "i"));
  return { ...entry, card, abilityId: `${entry.cardId}:0`, abilityText, vanguardName };
});

const SEATS = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
const cardFor = id => CATALOG.find(card => String(card.id) === String(id));
const gradeOne = CATALOG.find(card => Number(card.grade) === 1 && /unit/i.test(card.type || ""));
const gradeTwo = CATALOG.find(card => Number(card.grade) === 2 && /unit/i.test(card.type || ""));
const drawCard = CATALOG.find(card => Number(card.grade) === 0 && /trigger/i.test(card.type || "")) || gradeOne;
assert.ok(gradeOne && gradeTwo && drawCard, "catalog has representative hand-cost and draw cards");

function instance(definition, uid, playerId, extra = {}) {
  return {
    uid,
    cardId: String(definition.id),
    cardName: definition.name,
    type: definition.type,
    grade: Number(definition.grade),
    power: Number(definition.power || 0),
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...extra
  };
}

function abilityFor(entry) {
  const ability = Engine.parseCardAbilitiesCached(entry.card).find(item => item.id === entry.abilityId);
  assert.ok(ability, `${entry.abilityId} parses`);
  return ability;
}

function fixture({ entry = FAMILY[0], side = "human", giftCount = 0, vanguardName = entry.vanguardName, vanguardGrade = 3, phase = 3, stridePerformed = false, sourceFaceUp = false, matchingCopy = true } = {}) {
  const ownId = side === "human" ? "player-host" : "player-guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherId = side === "human" ? "player-guest" : "player-host";
  const makePlayer = (playerId, name, grade) => ({
    playerId,
    vanguard: { uid: `vg-${playerId}`, cardId: `fixture-vg-${playerId}`, cardName: name, name, type: "Unit", grade, ownerPlayerId: playerId, controllerPlayerId: playerId },
    gDeck: [], gZone: [], hand: [], deck: [], drop: [], soul: [], damage: [], rear: Array(5).fill(null), usedAbilities: [],
    gifts: 0, giftZones: [], accelZones: 0, accelTypes: []
  });
  const players = {
    human: makePlayer(side === "human" ? ownId : otherId, side === "human" ? vanguardName : "Unrelated Vanguard", side === "human" ? vanguardGrade : 2),
    bot: makePlayer(side === "bot" ? ownId : otherId, side === "bot" ? vanguardName : "Unrelated Vanguard", side === "bot" ? vanguardGrade : 2)
  };
  const player = players[side];
  const source = instance(entry.card, `g-unit-${side}-${entry.cardId}`, ownId, { type: "G Unit", grade: 4, faceUp: sourceFaceUp, gDeckCard: true });
  player.gZone.push(source);
  const sameNameCopy = matchingCopy ? instance(entry.card, `same-name-copy-${side}-${entry.cardId}`, ownId, { type: "G Unit", grade: 4, faceUp: false, gDeckCard: true }) : null;
  if (sameNameCopy) player.gZone.push(sameNameCopy);
  const costOne = instance(gradeOne, `cost-g1-${side}`, ownId);
  const costTwo = instance(gradeTwo, `cost-g2-${side}`, ownId);
  player.hand.push(costOne, costTwo);
  const beforeDeck = Array.from({ length: 6 }, (_, index) => instance(drawCard, `deck-${side}-${index}`, ownId));
  player.deck.push(...beforeDeck);
  player.gifts = giftCount;
  const state = {
    matchId: `gift-stride-${entry.cardId}-${side}`,
    stateVersion: 1,
    processedActionIds: [],
    pendingAbilities: [],
    pendingAbility: null,
    pendingTrigger: null,
    pendingAttack: null,
    pendingTurnEnd: null,
    side,
    phase,
    turn: 2,
    turnStartGrades: { [side]: 3 },
    stridePerformed,
    players
  };
  return { state, side, ownId, otherId, player, source, sameNameCopy, costOne, costTwo, beforeDeck, entry, ability: abilityFor(entry) };
}

function validGiftChoices(entry) {
  return entry.giftType === "Force"
    ? [{ type: "Force I", zone: "vanguard" }, { type: "Force II", zone: "rear-left" }]
    : [{ type: "Accel II" }, { type: "Accel I" }];
}

function activate(f, overrides = {}, actorAuthUid = f.side === "human" ? SEATS.hostAuthUid : SEATS.guestAuthUid) {
  const selection = {
    costSelections: { gradeSumDiscard: [f.costOne.uid, f.costTwo.uid] },
    effectUid: f.sameNameCopy?.uid || null,
    giftChoices: validGiftChoices(f.entry),
    ...overrides
  };
  return Reducer.applyManualAbilityActivation(f.state, {
    actorAuthUid,
    actionId: `activate-gift-stride-${f.side}-${f.entry.cardId}`,
    expectedStateVersion: f.state.stateVersion,
    payload: { sourceCardInstanceId: f.source.uid, abilityId: f.entry.abilityId, selection }
  }, SEATS, Engine);
}

test("all 18 exact card definitions model the named-grade-3 condition, grade-sum cost, and ordered Stride/flip/two-gift effects", () => {
  for (const entry of FAMILY) {
    const ability = abilityFor(entry);
    assert.equal(ability.kind, "ACT", entry.abilityId);
    assert.equal(ability.definition.printedText, entry.abilityText, entry.abilityId);
    assert.deepEqual(ability.requiredLocation, ["g-zone"], entry.abilityId);
    assert.ok(ability.conditions.some(condition => condition.type === "controller-vanguard-name-contains" && condition.value === entry.vanguardName && condition.exact === true), `${entry.abilityId}: exact Vanguard name`);
    assert.ok(ability.conditions.some(condition => condition.type === "controller-vanguard-grade-equals" && Number(condition.count) === 3), `${entry.abilityId}: exact grade condition`);
    assert.ok(ability.conditions.some(condition => condition.type === "controller-has-no-imaginary-gift-this-fight"), `${entry.abilityId}: no prior Gift condition`);
    assert.deepEqual(ability.costs, [{ type: "discard-grade-sum", minimumGrade: 3 }], entry.abilityId);
    assert.deepEqual(ability.definition.effects.map(step => step.op), ["stride-source-from-g-zone", "flip-same-name-g-zone-face-up", "grant-imaginary-gifts"], entry.abilityId);
    assert.equal(ability.definition.effects[0].target, "source");
    assert.equal(ability.definition.effects[1].target, "selected-g-zone-card");
    assert.equal(ability.definition.effects[2].giftType, entry.giftType);
    assert.equal(ability.definition.effects[2].count, 2);
    assert.equal(Reducer.hasTrustedServerAbilityDefinition(ability, Engine), true, entry.abilityId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability), true, entry.abilityId);
  }
});

test("the host and joining player can pay the grade-sum cost, Stride, flip the other copy, and receive their own two gifts", () => {
  for (const entry of FAMILY) for (const side of ["human", "bot"]) {
    const f = fixture({ entry, side });
    const deckSize = f.player.deck.length;
    const result = activate(f);
    assert.equal(result.ok, true, `${entry.abilityId}/${side}: ${JSON.stringify(result)}`);
    assert.equal(f.player.vanguard.uid, f.source.uid, `${entry.abilityId}/${side}: exact G Unit becomes Vanguard`);
    assert.equal(f.player.vanguard.strideHeart.uid, `vg-${f.ownId}`, `${entry.abilityId}/${side}: prior Vanguard becomes heart`);
    assert.equal(f.player.gZone.some(card => card.uid === f.source.uid), false, `${entry.abilityId}/${side}: source leaves G Zone`);
    assert.equal(f.player.gZone.find(card => card.uid === f.sameNameCopy.uid)?.faceUp, true, `${entry.abilityId}/${side}: selected same-name copy flips after Stride`);
    assert.equal(f.player.hand.some(card => card.uid === f.costOne.uid || card.uid === f.costTwo.uid), false);
    assert.ok(f.player.drop.some(card => card.uid === f.costOne.uid));
    assert.ok(f.player.drop.some(card => card.uid === f.costTwo.uid));
    assert.equal(f.player.gifts, 2);
    if (entry.giftType === "Force") {
      assert.deepEqual(f.player.giftZones, [{ type: "Force I", zone: "vanguard" }, { type: "Force II", zone: "rear-left" }]);
      assert.equal(f.player.accelZones, 0);
      assert.equal(f.player.deck.length, deckSize);
    } else {
      assert.equal(f.player.accelZones, 2);
      assert.deepEqual(f.player.accelTypes, ["Accel II", "Accel I"]);
      assert.equal(f.player.rear.length, 7, `${entry.abilityId}/${side}: two Accel circles are added`);
      assert.equal(f.player.deck.length, deckSize - 1, `${entry.abilityId}/${side}: Accel II draws once`);
    }
    assert.equal(f.state.stridePerformed, true);
    assert.ok(result.events.some(event => event.type === "card.stridden" && event.cardInstanceId === f.source.uid));
    assert.ok(result.events.some(event => event.type === "card.discarded" && event.subjectCardInstanceId === f.costOne.uid));
  }
});

test("the entire resolution is rejected without partial changes when an activation condition or Stride requirement is false", () => {
  const cases = FAMILY.slice(0, 2).flatMap(entry => [
    fixture({ entry, giftCount: 1 }),
    fixture({ entry, vanguardName: "Wrong Vanguard" }),
    fixture({ entry, vanguardGrade: 4 }),
    fixture({ entry, phase: 4 }),
    fixture({ entry, stridePerformed: true }),
    fixture({ entry, sourceFaceUp: true }),
    fixture({ entry, matchingCopy: false })
  ]);
  for (const f of cases) {
    const before = JSON.stringify(f.state);
    const result = activate(f);
    assert.equal(result.ok, false, `${f.entry.abilityId}: ${JSON.stringify(result)}`);
    assert.equal(JSON.stringify(f.state), before, `${f.entry.abilityId}: rejected atomically`);
  }
});

test("insufficient or forged grade-sum costs and forged same-name flip choices never partially resolve", () => {
  for (const entry of [FAMILY[0], FAMILY.at(-1)]) {
    const shortCost = fixture({ entry });
    const beforeCost = JSON.stringify(shortCost.state);
    const insufficient = activate(shortCost, { costSelections: { gradeSumDiscard: [shortCost.costOne.uid] } });
    assert.equal(insufficient.ok, false);
    assert.equal(JSON.stringify(shortCost.state), beforeCost);

    const forgedCost = fixture({ entry });
    const beforeForgedCost = JSON.stringify(forgedCost.state);
    const forged = activate(forgedCost, { costSelections: { gradeSumDiscard: ["not-in-hand"] } });
    assert.equal(forged.ok, false);
    assert.equal(JSON.stringify(forgedCost.state), beforeForgedCost);

    const invalidFlip = fixture({ entry });
    const beforeFlip = JSON.stringify(invalidFlip.state);
    const invalid = activate(invalidFlip, { effectUid: invalidFlip.source.uid });
    assert.equal(invalid.ok, false);
    assert.equal(JSON.stringify(invalidFlip.state), beforeFlip);
  }
});

test("gift selections must match the card's Force or Accel gift type and legal circle requirements", () => {
  const force = fixture({ entry: FAMILY[0] });
  const beforeForce = JSON.stringify(force.state);
  assert.equal(activate(force, { giftChoices: [{ type: "Accel I" }, { type: "Accel II" }] }).ok, false);
  assert.equal(JSON.stringify(force.state), beforeForce);

  const invalidForceZone = fixture({ entry: FAMILY[0] });
  const beforeZone = JSON.stringify(invalidForceZone.state);
  assert.equal(activate(invalidForceZone, { giftChoices: [{ type: "Force I", zone: "drop" }, { type: "Force II", zone: "rear-left" }] }).ok, false);
  assert.equal(JSON.stringify(invalidForceZone.state), beforeZone);

  const accel = fixture({ entry: FAMILY.at(-1) });
  const beforeAccel = JSON.stringify(accel.state);
  assert.equal(activate(accel, { giftChoices: [{ type: "Accel I", zone: "vanguard" }, { type: "Accel II", zone: "rear-left" }] }).ok, false);
  assert.equal(JSON.stringify(accel.state), beforeAccel);
});

test("an opponent cannot activate the other player's G-zone ability", () => {
  const f = fixture({ entry: FAMILY[0], side: "bot" });
  const before = JSON.stringify(f.state);
  const result = activate(f, {}, SEATS.hostAuthUid);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(f.state), before);
});
