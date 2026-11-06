"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0006.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-76D8A0B8-0006";
const ASSIGNED = [
  "cfa-10936:0", "cfa-10937:0", "cfa-10937:1", "cfa-10938:0", "cfa-10938:1",
  "cfa-1094:0", "cfa-1094:1", "cfa-1094:2", "cfa-1095:0", "cfa-10965:0",
  "cfa-10966:0", "cfa-10967:0", "cfa-10968:0", "cfa-10969:0", "cfa-1096:0",
  "cfa-10970:0", "cfa-10970:1", "cfa-10971:0", "cfa-10971:1", "cfa-10972:0",
  "cfa-10972:1", "cfa-10972:2", "cfa-10973:0", "cfa-10973:1", "cfa-10976:0",
  "cfa-10976:1", "cfa-10977:0", "cfa-10978:0", "cfa-10979:0", "cfa-1097:0",
  "cfa-1097:1", "cfa-10980:0", "cfa-10980:1", "cfa-10982:0", "cfa-10982:1",
  "cfa-10983:0", "cfa-10983:1", "cfa-10984:0", "cfa-10984:1", "cfa-1098:0",
  "cfa-1098:1", "cfa-1098:2"
];

const ALREADY_SUPPORTED = {
  "cfa-1094:2": "cont-lord-attack-restriction-v1",
  "cfa-10967:0": "auto-boost-grade-opponent-vanguard-grade-soul-blast-power-battle-v1",
  "cfa-10979:0": "auto-boost-grade-opponent-vanguard-grade-soul-blast-power-battle-v1",
  "cfa-1097:1": "cont-lord-attack-restriction-v1",
  "cfa-10980:0": "cont-rc-normal-order-power-v1",
  "cfa-10980:1": "auto-rc-placement-counter-blast-deck-or-drop-named-search-v1",
  "cfa-1098:1": "auto-boosted-by-qualified-unit-power-v1",
  "cfa-1098:2": "cont-lord-attack-restriction-v1"
};

const UNSUPPORTED = {
  "cfa-10936:0": "The top-five search needs grade-3/name filtering, distinct original names, up to two private selections, and a draw only when no cards are revealed; no single trusted effect sequence supports all of this.",
  "cfa-10937:0": "Continuous power needs a controller-turn condition plus a count of face-down Order Zone cards; the trusted continuous-condition model has no such Order Zone count.",
  "cfa-10937:1": "The effect has an alternate Soul Blast cost after Persona Ride, an alternative hand-to-soul cost, and a Song deck search; the trusted cost and search handlers do not model this full alternative-cost ability.",
  "cfa-10938:0": "The Vanguard placement trigger requires top-five inspection, a grade-limited unit choice, a legal Rear-Guard call, and deck shuffle; no trusted handler models that full call sequence.",
  "cfa-10938:1": "The attack ability must sing a selected face-up Song, then conditionally pay a named grade-3 Soul Blast, gain drive, and restrict Sentinel calls; the linked Order action and battle restriction are not a supported complete sequence.",
  "cfa-1094:0": "This requires a missed-attack close-step trigger, Limit Break, optional Counter Blast plus three named discards, stand and critical effects, and a same-turn usage lock; no trusted handler validates all stages.",
  "cfa-1094:1": "The Counter Blast cost filters damage cards by the Eradicator name; there is no trusted named-card Counter Blast payment handler for this ACT.",
  "cfa-1095:0": "The exact booster must grant +4000 to its Spike Brothers battle target and then move itself to deck bottom at that battle's close step; no trusted handler covers that combined timing and movement.",
  "cfa-10965:0": "The own-attack power/draw effect depends on whether a Normal Order was played this turn; that condition is modeled for continuous effects, but no trusted authoritative AUTO handler covers this conditional attack sequence.",
  "cfa-10966:0": "The trigger must identify that this exact Rear-Guard was chosen by a qualifying Vanguard ability; no structured chosen-by-ability event is available to a trusted resolver.",
  "cfa-10968:0": "The placement event must retain that a named Vanguard ability placed this exact unit; no trusted handler combines that provenance with Soul Blast, Counter Charge, and temporary power.",
  "cfa-10969:0": "The source must be moved to Soul by an ability, satisfy the Pale Moon-only clan condition, bind itself, and search Deck or Drop for a grade-3 card into Soul; no trusted handler covers the event and ordered zone choices.",
  "cfa-1096:0": "The attack-hit effect combines Counter Blast, putting a Spike Brothers hand card into Soul, Deck search, and calling to an open circle; no trusted handler validates the whole cost and call sequence.",
  "cfa-10970:0": "The continuous bonus counts Blue Storm Armada cards in the Order Zone, including while the opponent acts; no trusted continuous-power handler counts that exact zone/card identity.",
  "cfa-10970:1": "The close-step trigger depends on another Rear-Guard attacking in the source's column and swaps circle positions after Counter Blast; no trusted same-column position-swap handler exists.",
  "cfa-10971:0": "The placement trigger must inspect three cards, choose up to one for Soul, and order the rest on the deck bottom; no trusted handler supports this exact top-three/remainder sequence.",
  "cfa-10971:1": "The source's own attack close step requires the Minerva name condition, Soul Blast and self-retire, then a hand-or-drop Soul choice with a conditional draw; no trusted handler supports the full sequence.",
  "cfa-10972:0": "The ACT needs a three-Rear-Guard cost and temporarily grants a CONT ability to Plant tokens while also increasing Drive; generic temporary ability granting to tokens is not implemented.",
  "cfa-10972:1": "The ACT binds a chosen Order card and calls up to two Plant tokens; token characteristics and this exact combined cost/call resolution are not supported by trusted handlers.",
  "cfa-10972:2": "The attack effect must choose and stand a Plant token and calculate power from distinct-name Order cards across Drop and Bind; the required token target and combined distinct-name count are unsupported.",
  "cfa-10973:0": "This CONT changes Deck search/choice eligibility by treating this card as a selected unit; the engine has no trusted Deck-search replacement rule for it.",
  "cfa-10973:1": "This CONT replaces a Deck-to-Rear-Guard call with a move to hand; the engine has no trusted call-replacement rule for this card.",
  "cfa-10976:0": "The power condition depends on this turn's exact ride-from card and Persona Ride; the trusted continuous-condition state does not retain both pieces of provenance for resolution.",
  "cfa-10976:1": "The Rear-Guard placement effect requires a Vanguard-or-Soul card-name check before Counter Blast and draw; no trusted exact ability definition authorizes that combination.",
  "cfa-10977:0": "The own-attack ability conditionally pays Counter Blast, returns up to two other Rear-Guards, and grants battle power; no trusted handler supports this conditional multi-target return sequence.",
  "cfa-10978:0": "The power condition checks the Vanguard's original power, which is distinct from its current modified power; the trusted continuous evaluator does not track this predicate.",
  "cfa-1097:0": "The Limit Break attack effect pays Counter Blast and a named-card discard, searches for up to two Spike Brothers, calls them to separate open circles, and shuffles; no trusted handler supports the full search/cost sequence.",
  "cfa-10982:0": "This placement effect has an 'other than by an ability' source restriction, Normal Order condition, top-five grade filter, then unit-to-circle or Order-to-hand branching; no trusted handler supports the exact staged choice.",
  "cfa-10982:1": "This attack bonus depends on target grade and the number of units controlled; no trusted handler covers both boundaries for this source's own attack.",
  "cfa-10983:0": "The effect needs a named-Vanguard condition, Soul Blast plus discard, and a search across two set-order grades; no trusted handler supports the exact cost and mixed-grade filter.",
  "cfa-10983:1": "The source's own attack close step needs a retire cost, a Glitter target choice, and turn-duration power; no trusted handler supports this complete sequence.",
  "cfa-10984:0": "The ride trigger must identify the exact grade-3 Thegrea rider, grant its name temporarily, search a Thegrea unit, and move it to Soul; temporary name aliasing and this ride/search sequence are unsupported.",
  "cfa-10984:1": "This once-per-turn ACT searches Soul for a different named grade-3 ride, then conditionally binds the source, performs Persona Ride, and prohibits further riding; no trusted handler supports the staged ride and restrictions.",
  "cfa-1098:0": "The Limit Break ride trigger grants a Vanguard power and a temporary AUTO that powers a Spike Brothers attack and returns that attacker to deck bottom at close step; no generic temporary-AUTO grant or complete delayed effect handler supports it."
};

const registryRows = () => fs.readFileSync(path.join(__dirname, "ability-work-registry.jsonl"), "utf8").trim().split(/\r?\n/).map(JSON.parse);
const batchRows = () => registryRows().filter(row => row.batchId === BATCH_ID);
const catalog = loadCatalog();

test("batch scope is accounted for without duplicate or out-of-batch definitions", () => {
  assert.deepEqual(contribution, []);
  const ids = batchRows().map(row => row.abilityId).sort();
  assert.deepEqual(ids, ASSIGNED.slice().sort());
  assert.equal(Object.keys(ALREADY_SUPPORTED).length + Object.keys(UNSUPPORTED).length, ASSIGNED.length);
  assert.deepEqual([...Object.keys(ALREADY_SUPPORTED), ...Object.keys(UNSUPPORTED)].sort(), ASSIGNED.slice().sort());
});

test("existing trusted definitions remain linked to their regression-backed patterns", () => {
  for (const [abilityId, patternId] of Object.entries(ALREADY_SUPPORTED)) {
    const row = batchRows().find(item => item.abilityId === abilityId);
    assert.ok(row, `${abilityId} is assigned`);
    assert.equal(row.implementationStatus, "tests-passing");
    assert.ok(row.verification.testFiles.length > 0, `${abilityId} has existing focused evidence`);
    const card = catalog.find(item => String(item.id) === row.cardId);
    const parsed = card && Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.equal(parsed?.definition?.source?.patternId, patternId, `${abilityId} keeps its exact trusted handler`);
  }
});

for (const [abilityId, blocker] of Object.entries(UNSUPPORTED)) {
  test(`${abilityId} remains unavailable: ${blocker}`, () => {
    assert.ok(blocker.length > 40, "blocker must identify the missing exact behavior");
    const row = batchRows().find(item => item.abilityId === abilityId);
    assert.ok(row, `${abilityId} is assigned to this batch`);
    assert.equal(row.implementationStatus, "unreviewed");
    const card = catalog.find(item => String(item.id) === row.cardId);
    assert.ok(card, `catalog card ${row.cardId} exists`);
    const parsed = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(parsed, `${abilityId} parses as an ability record`);
    assert.equal(parsed.printedText, row.printedText);
    assert.equal(parsed.definition, null, `${abilityId} must not be exposed as an implemented ability`);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(row.cardId).some(item => item.id === abilityId), false);
  });
}
