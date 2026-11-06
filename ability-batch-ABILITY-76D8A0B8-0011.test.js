"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer = require("./ability-server-reducer.js");
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0011.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-76D8A0B8-0011";
const ASSIGNED = [
  "cfa-11137:0", "cfa-11137:1", "cfa-11139:0", "cfa-11139:1", "cfa-11141:0", "cfa-11141:1",
  "cfa-11143:0", "cfa-11143:1", "cfa-11145:0", "cfa-11145:1", "cfa-11147:0", "cfa-11147:1",
  "cfa-11148:0", "cfa-11149:0", "cfa-11149:1", "cfa-1114:0", "cfa-11150:0", "cfa-1115:0",
  "cfa-1116:0", "cfa-11174:0", "cfa-11174:1", "cfa-11175:0", "cfa-11175:1", "cfa-11176:0",
  "cfa-11178:0", "cfa-11178:1", "cfa-11179:0", "cfa-11179:1", "cfa-11180:0", "cfa-11180:1",
  "cfa-11181:0", "cfa-11182:0", "cfa-11182:1", "cfa-11183:0", "cfa-11184:0", "cfa-11184:1",
  "cfa-11185:0", "cfa-11185:1", "cfa-11185:2", "cfa-11186:0", "cfa-11186:1", "cfa-1118:0"
];

// These definitions are already in the shared engine. The 13 whose exact
// printed skills could be matched to an official Bushiroad card-list source
// are counted as ability-level verified below. Five more have existing code
// but remain blocked from that count because their exact official wording was
// not independently confirmed in this audit.
const EXISTING_DEFINITIONS = {
  "cfa-1114:0": "auto-own-attack-vanguard-clan-power-battle-v1",
  "cfa-11137:0": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
  "cfa-11137:1": "auto-self-revealed-damage-check-draw-v1",
  "cfa-11139:0": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
  "cfa-11139:1": "auto-self-revealed-damage-check-draw-v1",
  "cfa-11141:0": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
  "cfa-11141:1": "auto-self-revealed-damage-check-draw-v1",
  "cfa-11143:0": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
  "cfa-11143:1": "auto-self-revealed-damage-check-draw-v1",
  "cfa-11145:0": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
  "cfa-11145:1": "auto-self-revealed-damage-check-draw-v1",
  "cfa-11147:0": "auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",
  "cfa-11147:1": "auto-self-revealed-damage-check-draw-v1",
  "cfa-11178:0": "auto-rode-upon-named-grade-source-call-v1",
  "cfa-11179:0": "auto-rode-upon-named-grade-source-call-v1",
  "cfa-11184:0": "cont-card-name-alias-v1",
  "cfa-11185:0": "cont-card-name-alias-v1",
  "cfa-11186:0": "cont-card-name-alias-v1"
};

const VERIFIED_PRODUCTION = [
  "cfa-11137:0", "cfa-11137:1", "cfa-11139:0", "cfa-11139:1", "cfa-11141:0", "cfa-11141:1",
  "cfa-11143:0", "cfa-11143:1", "cfa-11145:0", "cfa-11145:1", "cfa-11147:0", "cfa-11147:1",
  "cfa-11179:0"
];

const EXISTING_SOURCE_BLOCKERS = {
  "cfa-1114:0": "An existing trusted handler is present, but the available local catalog record was not matched to an official Bushiroad card-text page. Do not count this as verified production behavior until its card identity and exact wording are confirmed.",
  "cfa-11178:0": "An existing trusted ride-call handler is present, but the exact official text for Ilondrina was not verified. Third-party listings vary in the card-name fragment, so the local Mythiarq predicate must not be certified from those listings.",
  "cfa-11184:0": "An existing CONT alias definition is present, but the official errata record confirms only the card identity, not the exact ability wording. Keep out of the verified count pending official text review.",
  "cfa-11185:0": "An existing CONT alias definition is present, but the official errata record confirms only the card identity, not the exact ability wording. Keep out of the verified count pending official text review.",
  "cfa-11186:0": "An existing CONT alias definition is present, but the official errata record confirms only the card identity, not the exact ability wording. Keep out of the verified count pending official text review."
};

const UNSUPPORTED = {
  "cfa-11148:0": "The exact booster identity, required rest cost, Soul Charge, power and critical change, and battle duration need a single authoritative resolver definition; this batch is not authorized to add shared handlers.",
  "cfa-11149:0": "The trigger must match the exact rest-for-cost action from Battling Rogue, then pay Counter Blast and stand this exact front-row unit; no trusted definition is linked.",
  "cfa-11149:1": "This must match an ability-caused stand of this exact unit and grant turn power; no trusted definition is linked.",
  "cfa-11150:0": "The Soul Blast and top-five Kurheol Realm search require a private selection, reveal, hand movement, and shuffle; no trusted complete handler is linked.",
  "cfa-1115:0": "The source must be on VC or RC during its controller's main phase and gain turn power only when an opponent rear-guard is retired; no trusted exact event handler is linked.",
  "cfa-1116:0": "The ACT requires a same-clan rest cost, bottom-deck movement of that exact rear-guard, then a same-name friendly-unit choice and turn power; no trusted definition is linked.",
  "cfa-11174:0": "The Shojodoji condition, Counter Blast, top-five normal Stealth-unit filter, reveal, hand choice, and shuffle are not covered by a trusted complete handler.",
  "cfa-11174:1": "The trigger must match this exact source moving from RC to Soul during its controller's turn, then process the opponent's face-up bind target before giving a chosen Vanguard turn power; no trusted handler is linked.",
  "cfa-11175:0": "The on-placement ability has an optional choice from Drop and moves the chosen Stealth card to Soul; no trusted definition is linked.",
  "cfa-11175:1": "The trigger refers to another unit placed from Bind Zone, but the cost moves this exact source to Soul and draws for its controller; no trusted complete handler is linked.",
  "cfa-11176:0": "This attack ability combines an exact Shojodoji Vanguard check, Counter Blast, binding another rear-guard, opponent bind-zone removal, and a conditional optional return from the controller's Bind Zone; no trusted ordered resolver is linked.",
  "cfa-11178:1": "The CONT condition depends on another exact Mythiarq rear-guard being called by an ability this turn, Vanguard grade, back-row circle, and same-column front-row targets; no trusted continuous evaluator is linked.",
  "cfa-11179:1": "The placement effect has a Mythiarq unit count, optional Soul Charge, opponent rear-guard target, and an intercept restriction through turn end; no trusted complete handler is linked.",
  "cfa-11180:0": "The VC placement effect combines top-seven inspection, grade-limited call, shuffle, unit count, and an opponent-owned hand discard choice; no trusted complete resolver is linked.",
  "cfa-11180:1": "The attack effect pays Counter Blast, returns a Mythiarq rear-guard, then calls up to one different-name Mythiarq unit from hand; no trusted complete resolver is linked.",
  "cfa-11181:0": "The trigger must match this exact unit boosting a Mythiarq unit, check face-down damage and whether Counter Charge already occurred this turn, then Counter Charge; no trusted definition is linked.",
  "cfa-11182:0": "The placement effect conditionally grants turn power before Soul Blast and a target's next-Stand-Phase restriction; no trusted sequence and target handler is linked.",
  "cfa-11182:1": "The ACT is once per turn, checks the Vanguard, binds a different-name Mythiarq rear-guard, and calls that exact bound card to RC; no trusted definition is linked.",
  "cfa-11183:0": "The on-placement unit-count condition grants turn power before Counter Blast and draw. The catalog name also differs from Bushiroad's official Alpieral spelling, so text identity and behavior both need review.",
  "cfa-11184:1": "The optional top-seven effect requires a Glitter-ability or Stealth-name filter, movement to Soul, and shuffle; no trusted complete handler is linked.",
  "cfa-11185:1": "The attack trigger requires a grade-3 Vanguard target and at least two Set Orders, then battle-only power for this exact attacker; no trusted definition is linked.",
  "cfa-11185:2": "The trigger must identify a Set Order played from hand and just placed in Order Zone, then pay Counter Blast and call this exact Drop source; no trusted handler is linked.",
  "cfa-11186:1": "The on-placement effect pays Counter Blast plus Soul Blast, inspects and privately selects from the top three, and branches between call and hand placement before shuffle; no trusted complete handler is linked.",
  "cfa-1118:0": "The end-phase trigger requires this exact RC-to-Drop movement, a Great Nature Vanguard, an optional Soul Blast, and up to two face-up damage choices; no trusted handler covers this sequence."
};

const OFFICIAL_TEXT_SOURCES = {
  "cfa-11137": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=G-CB01%2FS12EN", note: "Both AUTO texts appear on the official card-list entry." },
  "cfa-11139": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=66&view=text", note: "The official G-CB02 list gives both Petros abilities." },
  "cfa-11141": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=80&sort=no&view=text", note: "The official G-TCB02 list gives Bombscissor's attack and damage-check abilities." },
  "cfa-11143": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=80&sort=no&view=text", note: "The official G-TCB02 list gives Ponbelly's attack and damage-check abilities." },
  "cfa-11145": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=G-BT04%2F022EN", note: "Official Mylis entry gives both AUTO abilities." },
  "cfa-11147": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=G-BT02%2F011EN", note: "Official Belenus entry gives both AUTO abilities." },
  "cfa-11148": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F066EN", note: "Official card-list entry gives the complete boosted-attack cost and effect." },
  "cfa-11149": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F068EN", note: "Official card-list entry gives both rest-for-cost and ability-stand AUTO texts." },
  "cfa-11150": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F071EN", note: "Official card-list entry gives the placement, Soul Blast, and top-five search text." },
  "cfa-11174": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&sort=no&view=text", note: "Official D-BT11 list gives both Izasaou AUTO texts." },
  "cfa-11175": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&sort=no&view=text", note: "Official D-BT11 list gives both Kagechika AUTO texts." },
  "cfa-11176": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=208&s_param=d-Dragon+Empire&sort=no&view=image&view=text", note: "Official D-BT11 Dragon Empire list gives the full Dualwielder AUTO." },
  "cfa-11179": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F094EN", note: "Official Luruthmanta entry gives both the ride-call and placement abilities." },
  "cfa-11180": { status: "exact", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F013EN", note: "Official Luruthzul entry gives both AUTO texts." },
  "cfa-1114": { status: "not-verified", url: null, note: "No official card-text entry was located for the local Holy Edge Knight record." },
  "cfa-1115": { status: "not-verified", url: null, note: "No official card-text entry was located for the local Dragon Dancer, Stormy record." },
  "cfa-1116": { status: "not-verified", url: null, note: "No official card-text entry was located for the local Stealth Fiend, Gashadokuro record." },
  "cfa-1118": { status: "not-verified", url: null, note: "No official card-text entry was located for the local Soft Tank Sloth record." },
  "cfa-11178": { status: "not-verified", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F098EN", note: "The official card identity is known, but the official text page could not be retrieved; third-party listings differ on the name fragment. Exact wording is not certified." },
  "cfa-11181": { status: "not-verified", url: "https://en.cf-vanguard.com/cardlist/?cardno=D-BT11%2F099EN", note: "The official card identity is known, but the exact AUTO wording was not retrieved from Bushiroad's card list." },
  "cfa-11182": { status: "partial", url: "https://en.cf-vanguard.com/deckrecipe/detail/d-bt11-luruthzul", note: "Official deck recipe summarizes Miumililin's effects but does not reproduce the complete cost wording; not enough to certify the catalog text." },
  "cfa-11183": { status: "conflicting-name", url: "https://en.cf-vanguard.com/deckrecipe/detail/d-bt11-luruthzul", note: "Bushiroad's recipe uses the spelling Alpieral, while the local catalog record is Alpiral; exact card-text identity remains unresolved." },
  "cfa-11184": { status: "identity-only", url: "https://en.cf-vanguard.com/errata/page/4/", note: "Official errata page lists D-BT11/SECP01EN as Stealth Fiend, Kodama, but does not provide the ability text used here." },
  "cfa-11185": { status: "identity-only", url: "https://en.cf-vanguard.com/errata/page/4/", note: "Official errata page lists D-BT11/SECP03EN as Cosmic Battler, Norrsken, but does not provide its ability text." },
  "cfa-11186": { status: "identity-only", url: "https://en.cf-vanguard.com/errata/page/4/", note: "Official errata page lists D-BT11/SECP04EN as Divine Knight of White Streaks, Rumesgard, but does not provide its ability text." }
};

const WHOLE_CARD_STATUS = Object.fromEntries([
  "cfa-11137", "cfa-11139", "cfa-1114", "cfa-11141", "cfa-11143", "cfa-11145", "cfa-11147",
  "cfa-11148", "cfa-11149", "cfa-1115", "cfa-11150", "cfa-1116", "cfa-11174", "cfa-11175",
  "cfa-11176", "cfa-11178", "cfa-11179", "cfa-1118", "cfa-11180", "cfa-11181", "cfa-11182",
  "cfa-11183", "cfa-11184", "cfa-11185", "cfa-11186"
].map(cardId => [cardId, {
  status: "unverified",
  reason: "This batch establishes evidence per ability only. It does not certify every printed skill on this card together in full gameplay."
}]));

const catalog = loadCatalog();
const catalogById = new Map(catalog.map(card => [String(card.id), card]));
const registryRows = fs.readFileSync(path.join(__dirname, "ability-work-registry.jsonl"), "utf8")
  .trim().split(/\r?\n/).map(JSON.parse);
const batchRows = registryRows.filter(row => row.batchId === BATCH_ID);
const rowById = new Map(batchRows.map(row => [row.abilityId, row]));
const allClassifiedIds = [
  ...Object.keys(EXISTING_DEFINITIONS),
  ...Object.keys(UNSUPPORTED)
];

function abilityFor(id) {
  const row = rowById.get(id);
  assert.ok(row, `${id} is assigned in the shared registry`);
  const card = catalogById.get(row.cardId);
  assert.ok(card, `catalog card ${row.cardId} exists`);
  const ability = Engine.parseCardAbilitiesCached(card).find(item => item.id === id);
  assert.ok(ability, `${id} parses as its own ability record`);
  return { row, card, ability };
}

function makePlayer(playerId, vanguard = null, rear = []) {
  return { playerId, vanguard, rear, hand: [], soul: [], damage: [], drop: [], deck: [], bind: [],
    orders: [], guardCircle: [], gDeck: [], gZone: [], triggerZone: [] };
}

function namedVanguardFixture(cardId, side) {
  const abilityId = `${cardId}:0`;
  const { card, ability } = abilityFor(abilityId);
  const playerId = side === "human" ? "host" : "guest";
  const otherSide = side === "human" ? "bot" : "human";
  const otherPlayerId = otherSide === "human" ? "host" : "guest";
  const name = ability.conditions.find(condition => condition.type === "controller-vanguard-name-contains")?.value;
  const source = { uid: `source-${cardId}-${side}`, cardId, cardName: card.name, grade: Number(card.grade),
    type: card.type, unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId };
  const attacker = { uid: `attacker-${cardId}-${side}`, cardId: "test-vanguard", cardName: `Grade 3 ${name} Vanguard`,
    grade: 3, type: "Unit", unitCard: true, ownerPlayerId: playerId, controllerPlayerId: playerId, clan: card.clan };
  const target = { uid: `target-${cardId}-${side}`, cardId: "test-opponent-vanguard", cardName: "Opponent Vanguard",
    grade: 3, type: "Unit", unitCard: true, ownerPlayerId: otherPlayerId, controllerPlayerId: otherPlayerId };
  const deck = [{ uid: `continue-${side}`, cardId: "continue" }, { uid: `draw-${side}`, cardId: "draw" }];
  const owner = makePlayer(playerId, attacker, [source]);
  owner.deck = deck;
  const opponent = makePlayer(otherPlayerId, target, []);
  const players = side === "human" ? { human: owner, bot: opponent } : { human: opponent, bot: owner };
  const battleId = `named-vg-${cardId}-${side}`;
  const state = { matchId: "ability-batch-76d8a0b8-0011", stateVersion: 4, eventSequence: 0,
    processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
    turn: 4, side, phase: 5, players,
    pendingAttack: { battleId, attackerSide: side, attackerPlayerId: playerId, attackerUid: attacker.uid,
      attackerZone: "vanguard", defenderSide: otherSide, targetUid: target.uid, targetZone: "vanguard",
      power: 13000, targetPower: 13000, critical: 1 } };
  const event = Engine.createGameEvent(state, { type: "unit.attacked", actingPlayerId: playerId, turnPlayerId: playerId,
    sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: playerId, sourceControllerPlayerId: playerId,
    subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: playerId, subjectControllerPlayerId: playerId,
    currentLocation: "vanguard", circle: "vanguard", targetCardInstanceIds: [target.uid], targetLocation: "vanguard",
    battleId, phase: "battle", timingWindow: "attack-declared" });
  return { state, side, playerId, otherSide, source, attacker, target, event, ability };
}

test("batch scope is fully classified by ability, without silently certifying whole cards", () => {
  assert.deepEqual(contribution, []);
  assert.equal(batchRows.length, ASSIGNED.length);
  assert.deepEqual(batchRows.map(row => row.abilityId).sort(), ASSIGNED.slice().sort());
  assert.deepEqual(allClassifiedIds.slice().sort(), ASSIGNED.slice().sort());
  assert.equal(new Set(allClassifiedIds).size, ASSIGNED.length);
  assert.equal(Object.keys(EXISTING_DEFINITIONS).length, 18);
  assert.equal(VERIFIED_PRODUCTION.length, 13);
  assert.equal(Object.keys(EXISTING_SOURCE_BLOCKERS).length, 5);
  assert.equal(Object.keys(UNSUPPORTED).length, 24);
  assert.deepEqual(Object.keys(OFFICIAL_TEXT_SOURCES).sort(), [...new Set(ASSIGNED.map(id => id.split(":")[0]))].sort());
  for (const [cardId, status] of Object.entries(WHOLE_CARD_STATUS)) {
    assert.equal(status.status, "unverified", `${cardId} remains a whole-card verification item`);
    assert.ok(status.reason.length > 30, `${cardId} explains the scope limit`);
  }
  assert.deepEqual(Object.keys(WHOLE_CARD_STATUS).sort(), [...new Set(ASSIGNED.map(id => id.split(":")[0]))].sort());
});

test("verified production definitions match official text, preserve exact catalog text, and have focused regression evidence", () => {
  for (const [id, patternId] of Object.entries(EXISTING_DEFINITIONS)) {
    const { row, card, ability } = abilityFor(id);
    assert.equal(ability.printedText, row.printedText, `${id}: catalog/registry text is unchanged`);
    const reviewed = Engine.getReviewedAbilityDefinitionsForCard(row.cardId).find(item => item.id === id);
    assert.ok(reviewed, `${id}: definition is in the reviewed engine`);
    assert.equal(ability.definition?.source?.patternId, patternId, `${id}: expected reusable pattern`);
    if (VERIFIED_PRODUCTION.includes(id)) {
      const source = OFFICIAL_TEXT_SOURCES[row.cardId];
      assert.equal(source.status, "exact", `${id}: official source text was checked`);
      assert.equal(row.implementationStatus, "tests-passing", `${id}: registry has ability-level test status`);
      assert.ok(row.verification.testFiles.length > 0, `${id}: focused evidence is linked`);
      assert.equal(Reducer.supportsServerAbilityEffects(ability), true, `${id}: authoritative resolver supports this ability`);
      for (const file of row.verification.testFiles) assert.equal(fs.existsSync(path.join(__dirname, file)), true, `${id}: ${file} exists`);
    } else {
      assert.ok(EXISTING_SOURCE_BLOCKERS[id], `${id}: source blocker is explicit`);
      assert.notEqual(OFFICIAL_TEXT_SOURCES[row.cardId].status, "exact", `${id}: source gap is not counted as verified`);
    }
    assert.ok(card.text.includes(ability.printedText), `${id}: raw catalog retains the original printed text`);
  }
});

test("the six verified named-grade trigger abilities resolve only for their exact controller on either seat", () => {
  const seats = { hostAuthUid: "auth-host", guestAuthUid: "auth-guest", hostSide: "human", guestSide: "bot" };
  const family = ["cfa-11137", "cfa-11139", "cfa-11141", "cfa-11143", "cfa-11145", "cfa-11147"];
  for (const cardId of family) for (const side of ["human", "bot"]) {
    const f = namedVanguardFixture(cardId, side);
    const queued = Reducer.discoverAutoTriggers(f.state, [f.event], Engine);
    assert.equal(queued.queued.length, 1, `${cardId}:${side}`);
    assert.equal(f.state.pendingAbility.side, side, `${cardId}:${side}: prompt seat`);
    assert.equal(f.state.pendingAbility.instance.uid, f.source.uid, `${cardId}:${side}: exact source instance`);
    const auth = side === "human" ? seats.hostAuthUid : seats.guestAuthUid;
    const result = Reducer.applyAbilityDecision(f.state, {
      actorAuthUid: auth, actionId: `resolve-${cardId}-${side}`, expectedStateVersion: f.state.stateVersion,
      payload: { type: "ability-response", accept: true, selection: {
        instanceUid: f.source.uid, abilityId: `${cardId}:0`, targetUid: f.attacker.uid,
        costSelections: { cb: [], sb: [], discard: [], reveal: [] }
      }, targetUid: f.attacker.uid }
    }, seats, Engine);
    assert.equal(result.ok, true, `${cardId}:${side}: ${result.reason}`);
    assert.ok(f.state.players[side].soul.some(item => item.uid === f.source.uid), `${cardId}:${side}: source pays Soul cost`);
    assert.equal(f.state.players[side].hand[0]?.uid, `draw-${side}`, `${cardId}:${side}: controller draws`);
    assert.equal(f.state.pendingAttack.power, 18000, `${cardId}:${side}: power applies to this battle`);
    assert.equal(f.state.players[f.otherSide].hand.length, 0, `${cardId}:${side}: opponent receives no private effect`);
    assert.equal(f.state.pendingAbility, null, `${cardId}:${side}: prompt resolves once`);

    const wrong = namedVanguardFixture(cardId, side);
    const wrongEvent = { ...wrong.event, sourceCardInstanceId: "unrelated-vanguard", subjectCardInstanceId: "unrelated-vanguard" };
    assert.equal(Reducer.discoverAutoTriggers(wrong.state, [wrongEvent], Engine).queued.length, 0,
      `${cardId}:${side}: another unit's attack cannot trigger this source skill`);
  }
});

test("all other assigned IDs are explicit blockers and remain fail-closed for both owners", () => {
  const eventTypes = ["unit.attacked", "unit.boosted", "card.placed", "card.ridden", "card.retired", "damage.checked", "order.played"];
  for (const [id, reason] of Object.entries(UNSUPPORTED)) {
    const { row, card, ability } = abilityFor(id);
    assert.ok(reason.length > 70, `${id}: blocker identifies missing exact mechanics`);
    assert.equal(row.implementationStatus, "unreviewed", `${id}: blocked skill is not marked implemented`);
    assert.equal(ability.definition, null, `${id}: no compiled definition is exposed`);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(row.cardId).some(item => item.id === id), false,
      `${id}: no reviewed runtime definition is exposed`);
    assert.equal(ability.printedText, row.printedText, `${id}: the catalog text remains exact`);
    const sourceEvidence = OFFICIAL_TEXT_SOURCES[row.cardId];
    assert.ok(sourceEvidence, `${id}: official-source review status is recorded`);
    if (sourceEvidence.status !== "exact") assert.ok(sourceEvidence.note.length > 30, `${id}: source gap is explicit`);

    for (const side of ["human", "bot"]) {
      const ownerId = side === "human" ? "host" : "guest";
      const otherSide = side === "human" ? "bot" : "human";
      const otherId = otherSide === "human" ? "host" : "guest";
      const source = { uid: `blocked-${id}-${side}`, cardId: row.cardId, cardName: card.name,
        type: card.type, grade: Number(card.grade), unitCard: true, ownerPlayerId: ownerId, controllerPlayerId: ownerId };
      const own = makePlayer(ownerId, { uid: `vg-${side}`, cardName: "Test Vanguard", grade: 3,
        type: "Unit", unitCard: true, ownerPlayerId: ownerId, controllerPlayerId: ownerId }, [source]);
      const opponent = makePlayer(otherId, { uid: `opp-vg-${side}`, cardName: "Test Opponent Vanguard", grade: 3,
        type: "Unit", unitCard: true, ownerPlayerId: otherId, controllerPlayerId: otherId }, []);
      const state = { matchId: `blocked-${id}`, stateVersion: 1, eventSequence: 0,
        processedEventIds: [], processedActionIds: [], processedAbilityTriggers: [], pendingAbilities: [], pendingAbility: null,
        turn: 1, side, phase: 5, players: side === "human" ? { human: own, bot: opponent } : { human: opponent, bot: own } };
      for (const [index, type] of eventTypes.entries()) {
        const event = Engine.createGameEvent(state, { eventId: `${id}-${side}-${index}`, type,
          actingPlayerId: ownerId, turnPlayerId: ownerId, sourceCardInstanceId: source.uid,
          sourceOwnerPlayerId: ownerId, sourceControllerPlayerId: ownerId, subjectCardInstanceId: source.uid,
          subjectOwnerPlayerId: ownerId, subjectControllerPlayerId: ownerId, currentLocation: "rear-guard",
          circle: "rear-left", timingWindow: "batch-audit" });
        assert.equal(Reducer.discoverAutoTriggers(state, [event], Engine).queued.length, 0,
          `${id}:${side}: unsupported/unverified text never creates an AUTO prompt`);
        assert.equal(state.pendingAbility, null, `${id}:${side}: no stuck or repeated prompt`);
      }
    }
  }
});

test("whole-card completion is not inferred from passing ability-level tests", () => {
  for (const cardId of Object.keys(WHOLE_CARD_STATUS)) {
    const rows = batchRows.filter(row => row.cardId === cardId);
    const parsed = Engine.parseCardAbilitiesCached(catalogById.get(cardId));
    assert.ok(rows.length > 0, `${cardId}: at least one assigned ability`);
    assert.equal(parsed.length, rows.length, `${cardId}: every catalog ability is in this batch's accounting`);
    assert.equal(WHOLE_CARD_STATUS[cardId].status, "unverified", `${cardId}: whole-card status stays separate`);
  }
});
