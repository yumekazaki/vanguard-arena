"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./ability-engine.js");
const { loadCatalog, auditCatalog } = require("./scripts/audit-ability-catalog.js");
const definitions = require("./ability-contributions/batch-PRIMARY-WORKER-CONT-SOUL-CLAN-COUNT-6-4.js");
const cases = [
  ["cfa-459", "Poet of Darkness, Amon", "Dark Irregulars"],
  ["cfa-470", "Demon of Aspiration, Amon", "Dark Irregulars"],
  ["cfa-643", "Borgal", "Royal Paladin"],
  ["cfa-668", "Gigantech Dozer", "Royal Paladin"]
];
const cards = loadCatalog();
test("batch exports no unsafe approximation while the shared Soul clan-count dependency is absent", () => {
  assert.deepEqual(definitions, []);
  engine.registerAbilityDefinitions(definitions);
});
for (const [id, name, clan] of cases) {
  const card = cards.find(card => card.id === id);
  test(`${id}: exact catalog text and complete printed-block review`, () => {
    assert.equal(card.name, name);
    const abilities = engine.parseCardAbilities(card);
    assert.equal(abilities.length, 1);
    const [ability] = abilities;
    assert.equal(ability.id, `${id}:0`);
    assert.equal(ability.printedText, `CONT [VC/RC]: During your turn, if the number of «${clan}» in your soul is six or more, this unit gets power +3000.`);
    assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
    assert.equal(ability.definition, null);
    assert.equal(ability.conditionStatus, "needs-review");
    assert.deepEqual(ability.costs, []);
    assert.equal(ability.trigger, null);
  });
  test(`${id}: unsupported CONT rejects manual activation from either seat without mutation`, () => {
    const [ability] = engine.parseCardAbilities(card);
    for (const controller of ["p1", "p2"]) for (const actor of ["p1", "p2"]) {
      const context = { cardInstanceId: "source", controllerPlayerId: controller, actorPlayerId: actor, turnPlayerId: actor };
      const before = structuredClone(context);
      assert.equal(engine.isManuallyActivatable(ability), false);
      assert.deepEqual(engine.canActivateManualAbility(ability, context), { ok: false, reason: "not-manual" });
      assert.deepEqual(context, before);
    }
  });
  test(`${id}: unsupported effect fails closed across threshold, turn, location and source contexts`, () => {
    const abilities = engine.parseCardAbilities(card);
    for (const player of ["p1", "p2"]) for (const count of [0, 5, 6, 7])
      for (const location of ["vanguard", "rear-guard", "guardian", "soul", "hand", "drop"])
        for (const ownTurn of [true, false]) for (const target of ["source", "other"]) {
          const context = { controllerPlayerId: player, sourceLocation: location, isControllerTurn: ownTurn,
            sourceInstanceId: "source", targetInstanceId: target,
            soulCardNames: Array(count).fill(clan), controllerSoulCount: count };
          const before = structuredClone(context);
          assert.equal(engine.evaluateContinuousEffects(abilities, context).power, 0);
          assert.deepEqual(context, before);
        }
  });
  // These are acceptance requirements, NOT passing implementation evidence.
  test.todo(`${id}: both seats gain exactly +3000 at six/seven matching-clan Soul instances on VC/RC during own turn; names need not contain clan`);
  test.todo(`${id}: five matching plus wrong-clan sixth, opponent Soul, RC clan cards, duplicate UID and missing identity cannot meet threshold`);
  test.todo(`${id}: effective multi-clan/all-clan Soul identities count once per instance; same-name distinct instances count separately`);
  test.todo(`${id}: source-only bonus disappears immediately after Soul loss, clan change, control change, leaving VC/RC or turn end; repeated evaluation never stacks`);
}
test("assigned cards remain unsupported in catalog audit and never count as completed", () => {
  const report = auditCatalog(cases.map(([id]) => cards.find(card => card.id === id)));
  assert.equal(report.abilityBlocks, 4);
  assert.equal(report.compiled, 0);
  assert.equal(report.unsupported, 4);
  assert.equal(report.cardsWithAllAbilityBlocksCompiledAndAuditValid, 0);
  assert.deepEqual(report.invalidCompiled, []);
});
