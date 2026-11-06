"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Engine = require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const contribution = require("./ability-contributions/batch-ABILITY-76D8A0B8-0010.js");
const { loadCatalog } = require("./scripts/audit-ability-catalog.js");

const BATCH_ID = "ABILITY-76D8A0B8-0010";
const EXPECTED = [
  ["cfa-11096:1", "AUTO [RC]: At the end of the battle this unit boosted, if your vanguard is grade 4 or greater, COST [put this unit into soul], choose one of your units, and it gets power +5000 until end of turn.", "The only close-step source-to-soul power handler requires its exact unconditional text; this ability adds a grade-4 Vanguard condition."],
  ["cfa-11099:1", "AUTO [RC]: When this unit attacks a grade 3 or greater unit, this unit gets power +5000 until end of that battle for each of your opponent’s open RC in the same column as this unit.", "Existing target-grade attack-power support is fixed at +5000; the per-open-circle same-column scaling effect has no matching handler."],
  ["cfa-11095:0", "AUTO [RC]: When this unit attacks, if it is the fifth battle of this turn or more, and you have a vanguard with \"Maelstrom\" in its card name, this unit gets power +10000 until end of that battle, and at the end of that battle, retire this unit, and draw a card.", "The fifth-battle and Maelstrom conditions plus delayed retire-and-draw sequence have no matching handler."],
  ["cfa-11097:0", "AUTO [RC]: When this unit attacks, if your drop has two or more blitz orders, COST [Counter Blast 1], and until end of that battle, this unit’s attack will hit regardless of power if the sum of your opponent’s guardians shield is not 15000 or greater.", "The conditional attack-hits-regardless-of-power shield threshold is not implemented by an existing authoritative handler."],
  ["cfa-11101:1", "AUTO [VC]: When this unit attacks a vanguard, COST [bind a \"Deepening Night, Tamayura\" from soul], choose up to one card each with \"Ririmi\" or \"Rarami\" in their card names from your soul, call them to RC, and they get power +5000 until end of turn. At the end of that turn, ride the card bound for this cost as rest.\n\nGlitter (This card is a Glitter which seeks the Fire Regalis)\n\n(SHIFT + left click to activate persona ride)", "Binding a named soul card, selecting two named soul units, calling and powering them, then scheduling a ride is a multi-step sequence without a matching handler."],
  ["cfa-11099:0", "AUTO: When this card is placed on RC other than by a unit card’s ability, if you played a normal order this turn, COST [Soul Blast 1], look at the top five cards of your deck, choose up to one card with grade less than or equal to your vanguard’s from among them and reveal it, call it to RC if it is a unit card, and put it into hand if it is a normal order. Shuffle the deck.", "The top-five selection branches by card type (call a unit or add a normal order to hand); no exact handler supports this sequence."],
  ["cfa-11101:0", "AUTO: When this unit is placed by riding from \"Deepening Night, Tamayura\", search your deck or drop for up to one order card without Regalis Piece, reveal it and put it into hand, and if you searched the deck, shuffle the deck. Activate persona ride.", "The ride-source trigger needs exact previous-rider matching, deck-or-drop Order filtering, Regalis Piece exclusion, and Persona Ride; existing named-rider support only searches a same-name card from Deck."],
  ["cfa-11093:1", "AUTO: When this unit is placed on RC, if you have a vanguard with \"Bastion\" in its card name, COST [put a grade 3 or greater card from drop into soul], choose one of your vanguards, and it gets power +5000 until end of turn. If you put a card with \"Bastion\" in its card name for this cost, for this cost, and you did not Counter Charge this turn, Counter Charge 1.", "The grade-filtered Drop-to-Soul cost and conditional Bastion-name Counter Charge are not supported by a matching handler."],
  ["cfa-11094:0", "AUTO: When this unit is placed on RC, if you have a vanguard with only «Aqua Force» for its clan, COST [discard a card from hand], search your deck or drop for up to one Blue Storm Armada card, reveal it and put it into hand, and if you searched the deck, shuffle the deck.", "The Aqua Force-only Vanguard condition, discard cost, and Deck-or-Drop Blue Storm Armada search do not match an existing handler."],
  ["cfa-11096:0", "AUTO: When this unit is retired from GC, COST [Soul Blast 1], and call this card to an open back row RC as rest.", "The retired-from-GC trigger with Soul Blast and a rested open back-row call has no matching authoritative revive handler."],
  ["cfa-11093:0", "CONT [RC/Hand/Trigger Zone]: During your turn, if you have a vanguard with \"Bastion\" in its card name, this card gets grade +2 / power +2000.", "The continuous card-level grade and power changes across RC, Hand, and Trigger Zone have no matching continuous handler."]
];

function readBatchRows() {
  const registryPath = path.join(__dirname, "ability-work-registry.jsonl");
  return fs.readFileSync(registryPath, "utf8").trim().split(/\r?\n/).map(JSON.parse)
    .filter(row => row.batchId === BATCH_ID && row.implementationStatus === "unreviewed");
}

test("batch contribution stays empty until an exact trusted server handler is available", () => {
  assert.deepEqual(contribution, []);
  const rows = readBatchRows();
  assert.deepEqual(rows.map(row => row.abilityId).sort(), EXPECTED.map(([id]) => id).sort());
});

const catalog = loadCatalog();
for (const [abilityId, printedText, blocker] of EXPECTED) {
  test(`${abilityId} remains explicitly unsupported: ${blocker}`, () => {
    const row = readBatchRows().find(item => item.abilityId === abilityId);
    assert.ok(row, `${abilityId} must remain in the claimed batch`);
    assert.equal(row.implementationStatus, "unreviewed");
    assert.equal(row.printedText, printedText);

    const card = catalog.find(item => String(item.id) === row.cardId);
    assert.ok(card, `catalog card ${row.cardId} must exist`);
    const parsed = Engine.parseCardAbilitiesCached(card).find(item => item.id === abilityId);
    assert.ok(parsed, `${abilityId} must parse as an ability record`);
    assert.equal(parsed.kind, row.kind);
    assert.equal(parsed.printedText, printedText);
    assert.equal(parsed.definition, null, `${abilityId} must not be presented as implemented`);
    assert.equal(Engine.getReviewedAbilityDefinitionsForCard(row.cardId).some(item => item.id === abilityId), false);
  });
}
