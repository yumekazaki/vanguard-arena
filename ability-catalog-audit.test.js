"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditCatalog, loadCatalog } = require("./scripts/audit-ability-catalog.js");
const engine = require("./ability-engine.js");
engine.registerAbilityDefinitions(require("./ability-definitions.js"));

function compiled(kind, overrides = {}) {
  return {
    id: "sample:0", kind, definition: { cardId: "sample", kind, effects: [{ op: "draw", count: 1 }], source: { patternId: "reviewed-sample" } },
    trigger: kind === "AUTO" ? { status: "recognized-trigger" } : null,
    conditionStatus: "no-explicit-condition-detected", costStatus: "none", ...overrides
  };
}

test("catalog audit separates compiled abilities from unsupported records and reports coverage", () => {
  const cards = [{ id: "sample" }, { id: "unknown" }];
  const report = auditCatalog(cards, card => card.id === "sample" ? [compiled("AUTO"), compiled("ACT")] : [{ id: "unknown:0", kind: "AUTO", definition: null }]);
  assert.equal(report.cardRecords, 2);
  assert.equal(report.abilityBlocks, 3);
  assert.equal(report.compiled, 2);
  assert.equal(report.unsupported, 1);
  assert.deepEqual(report.compiledByKind, { AUTO: 1, ACT: 1, CONT: 0, OTHER: 0 });
  assert.equal(report.patterns["reviewed-sample"], 2);
  assert.equal(report.coveragePercent, 66.67);
  assert.deepEqual(report.invalidCompiled, []);
  assert.equal(report.cardsParsed,2);
  assert.equal(report.cardsWithAbilities,2);
  assert.equal(report.cardsWithAtLeastOneCompiledAbility,1);
  assert.equal(report.cardsWithAllAbilityBlocksCompiledAndAuditValid,1);
  assert.equal(report.cardsWithUnsupportedAbilityBlocks,1);
  assert.equal(report.cardsWithUnmodeledRequirements,1);
});

test("catalog audit flags compiled abilities with missing triggers or unmodeled requirements", () => {
  const bad = compiled("AUTO", { trigger: { status: "needs-review" }, conditionStatus: "needs-review", costStatus: "needs-review", choiceStatus: "needs-review" });
  const report = auditCatalog([{ id: "sample" }], () => [bad]);
  assert.deepEqual(report.invalidCompiled[0].reasons, ["unrecognized-auto-trigger", "unmodeled-condition", "unmodeled-cost", "unmodeled-choice"]);
});

test("real catalog AUTO abilities enter the queue only when every required program part is modeled",()=>{
  let autoCount=0,readyCount=0;
  for(const card of loadCatalog())for(const ability of engine.parseCardAbilitiesCached(card)){
    if(ability.kind!=="AUTO")continue;
    autoCount++;
    const readiness=engine.autoAbilityReadiness(ability);
    if(!readiness.ok)continue;
    readyCount++;
    assert.equal(ability.trigger?.status,"recognized-trigger",`${card.id} ${ability.id}`);
    assert.equal(ability.definition?.kind,"AUTO",`${card.id} ${ability.id}`);
    assert.ok(Array.isArray(ability.definition.effects)&&ability.definition.effects.length,`${card.id} ${ability.id}`);
    assert.notEqual(ability.conditionStatus,"needs-review",`${card.id} ${ability.id}`);
    assert.notEqual(ability.costStatus,"needs-review",`${card.id} ${ability.id}`);
    assert.notEqual(ability.choiceStatus,"needs-review",`${card.id} ${ability.id}`);
  }
  assert.ok(autoCount>10000);
  assert.ok(readyCount>1000);
  assert.ok(readyCount<autoCount);
});

test("optional Counter-Blast own-attack power abilities remain ready because may-pay-cost is modeled",()=>{
  const abilities=loadCatalog().flatMap(card=>engine.parseCardAbilitiesCached(card)).filter(ability=>ability.definition?.source?.patternId==="auto-own-attack-counter-blast-power-battle-v1");
  assert.equal(abilities.length,24);
  for(const ability of abilities){
    assert.equal(ability.costStatus,"supported-cost",ability.id);
    assert.notEqual(ability.choiceStatus,"needs-review",ability.id);
    assert.equal(ability.canDecline,true,ability.id);
    assert.deepEqual(engine.autoAbilityReadiness(ability),{ok:true},ability.id);
  }
});

test("reviewed AUTO and ACT choice handlers are not blocked by generic choice-text detection",()=>{
  const reviewed=new Set([
    "auto-forerunner-same-clan-ride-call-source-v1","auto-gc-discard-protect-attacked-unit-v1","auto-gc-protect-then-conditional-discard-v1","auto-gc-sentinel-protect-friendly-unit-v1","auto-vanguard-placement-draw-discard-v1","auto-placement-top-five-grade-three-search-discard-v1","auto-boosted-battle-close-source-to-soul-power-v1","auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1","auto-boosting-unit-attack-hit-discard-draw-v1","auto-rode-upon-optional-source-call-v1","auto-drive-check-front-trigger-critical-turn-v1","auto-revelation-keyword-v1","auto-ride-phase-discard-source-call-rested-v1","auto-rc-vanguard-boost-soul-blast-draw-discard-v1","auto-rc-vanguard-boost-draw-discard-v1","act-rest-discard-draw-v1","act-vanguard-counter-blast-unlock-friendly-locked-v1","act-rest-source-front-row-ally-power-v1"
  ]),found=new Set();
  for(const card of loadCatalog())for(const ability of engine.parseCardAbilitiesCached(card))if(reviewed.has(ability.definition?.source?.patternId)){
    found.add(ability.definition.source.patternId);
    assert.notEqual(ability.choiceStatus,"needs-review",`${card.id} ${ability.id}`);
    if(ability.kind==="AUTO")assert.deepEqual(engine.autoAbilityReadiness(ability),{ok:true},`${card.id} ${ability.id}`);
  }
  assert.deepEqual([...found].sort(),[...reviewed].sort());
});

test("Forerunner compiler covers 362 exact keyword and reminder-text AUTO abilities",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);let count=0;for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-forerunner-same-clan-ride-call-source-v1")continue;count++;assert.equal(ability.kind,"AUTO",card.id);assert.equal(ability.trigger?.eventType,"card.ridden",card.id);assert.equal(ability.trigger?.subject,"event-subject",card.id);assert.deepEqual(ability.definition.effects,[{op:"call-source-from-soul",target:"source",position:"stand"}],card.id)}assert.equal(count,362);assert.equal(count,report.patterns["auto-forerunner-same-clan-ride-call-source-v1"]);for(const id of ["cfa-3347","cfa-3793","cfa-3978","cfa-5338"]){const card=cards.find(item=>item.id===id);assert.equal(engine.parseCardAbilitiesCached(card)[0].definition?.source?.patternId,undefined,id)}assert.deepEqual(report.invalidCompiled,[]);
});

test("plain rode-upon optional calls compile only for seven exact ride-trigger cards",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);let count=0;for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-rode-upon-optional-source-call-v1")continue;count++;assert.equal(ability.trigger?.eventType,"card.ridden",card.id);assert.equal(ability.trigger?.subject,"event-subject",card.id);assert.deepEqual(ability.trigger?.circles,["vanguard"],card.id);assert.deepEqual(ability.definition.effects,[{op:"call-source-from-soul",target:"source",position:"stand"}],card.id);assert.equal(ability.canDecline,true,card.id)}assert.equal(count,7);assert.equal(report.patterns["auto-rode-upon-optional-source-call-v1"],7);assert.deepEqual(report.invalidCompiled,[]);
});

test("Harmony association AUTO compiler covers only the 47 exact keyword/reminder records",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);let count=0;for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-harmony-same-column-association-v1")continue;count++;assert.equal(ability.kind,"AUTO",card.id);assert.equal(ability.trigger?.eventType,"card.placed",card.id);assert.equal(ability.trigger?.subject,"any",card.id);assert.deepEqual(ability.definition.effects,[{op:"associate-harmony-units",target:"source-and-event-subject",duration:"turn"}],card.id);assert.ok(ability.requiredLocation.includes("vanguard")||ability.requiredLocation.includes("rear-guard"),card.id)}assert.equal(count,47);assert.equal(report.patterns["auto-harmony-same-column-association-v1"],47);assert.deepEqual(report.invalidCompiled,[]);
});

test("all six exact optional GC-retirement-to-Soul catalog abilities compile as declinable source-scoped AUTO skills",()=>{
  const matches=[];
  for(const card of loadCatalog())for(const ability of engine.parseCardAbilitiesCached(card))if(ability.raw==="When this unit is retired from GC, you may put this card into soul.")matches.push({card,ability});
  assert.equal(matches.length,6);
  for(const {card,ability} of matches){
    assert.equal(ability.definition?.source?.patternId,"auto-gc-retire-optional-source-to-soul-v1",`${card.id} ${card.name}`);
    assert.equal(ability.trigger?.eventType,"card.retired");assert.equal(ability.trigger?.subject,"source");
    assert.equal(ability.trigger?.sourceLocation,"guardian");assert.equal(ability.trigger?.destinationLocation,"drop");
    assert.equal(ability.canDecline,true);assert.equal(ability.choiceStatus,"modeled");assert.equal(engine.canDeclineAbility(ability),true);
  }
});

test("implicit GC retirement-to-Soul wording compiles only as a source-specific guardian retirement trigger",()=>{
  const rows=loadCatalog().flatMap(card=>engine.parseCardAbilitiesCached(card).map(ability=>({card,ability}))).filter(({ability})=>ability.raw==="When retired from GC, you may put this card into your soul.");
  assert.equal(rows.length,5);
  for(const {card,ability} of rows){
    assert.equal(ability.definition?.source?.patternId,"auto-gc-retire-optional-source-to-soul-v1",card.id);
    assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"card.retired",subject:"source",circles:[],sourceLocation:"guardian",destinationLocation:"drop"},card.id);
    assert.equal(ability.canDecline,true,card.id);assert.deepEqual(engine.autoAbilityReadiness(ability),{ok:true},card.id);
  }
});


test("all catalog matches for the reviewed RC own-turn CONT power template remain validated",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["cont-rc-own-turn-power-v1"],26);
  assert.deepEqual(report.invalidCompiled,[]);
});


test("all exact catalog matches for the reviewed GC shield template remain valid",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["cont-gc-opponent-grade-shield-v1"],55);
  assert.deepEqual(report.invalidCompiled,[]);
});

test("qualified boosted-unit AUTO power definitions cover reviewed catalog records only",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["auto-boosted-by-qualified-unit-power-v1"],42);
  assert.deepEqual(report.invalidCompiled,[]);
});

test("Pastel Deer power-threshold boost critical remains tied to its single catalog record",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["auto-boosted-by-power-threshold-critical-battle-v1"],1);
  assert.deepEqual(report.invalidCompiled,[]);
});


test("all exact Hand CONT Stride grade-boost matches remain supported and valid",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["cont-hand-stride-cost-grade-boost-v1"],30);
  assert.deepEqual(report.invalidCompiled,[]);
});


test("all 34 exact Hand CONT Stride grade-three replacement matches remain supported",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["cont-hand-stride-cost-treated-grade-three-v1"],34);
  assert.deepEqual(report.invalidCompiled,[]);
});


test("all catalog instances of the exact damage-check reveal draw AUTO remain valid",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["auto-self-revealed-damage-check-draw-v1"],24);
  assert.deepEqual(report.invalidCompiled,[]);
});

test("all six simple real attack-versus-grade power abilities compile with their target-grade requirement",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const {parseCardAbilitiesCached}=require("./ability-engine.js");
  let matching=0;
  for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){
    if(!/^AUTO \[RC\]: When this unit attacks a grade 3 or greater unit, this unit gets power \+5000 until end of that battle\.(?: \(SHIFT \+ left click to get a Persona Shield ticket\))?$/i.test(ability.printedText.replace(/\s+/g," ").trim()))continue;
    matching++;assert.equal(ability.definition?.source?.patternId,"auto-own-attack-target-grade-power-battle-v1");
    assert.equal(ability.conditions.find(condition=>condition.type==="attack-target-grade-at-least")?.count,3);
  }
  assert.equal(matching,7);
});

test("real catalog named-boost compiler matches retain name filters and Soul-Blast costs",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["auto-boosts-named-unit-power-battle-v1"],7);
  assert.equal(report.patterns["auto-soul-blast-named-boost-power-battle-v1"],23);
  for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){
    if(ability.definition?.source?.patternId!=="auto-soul-blast-named-boost-power-battle-v1")continue;
    assert.equal(ability.trigger?.eventType,"unit.boosted");assert.equal(ability.trigger?.subject,"source");
    assert.equal(ability.effects[0]?.target,"boosted-unit");assert.equal(ability.effects[0]?.duration,"battle");
    assert.equal(ability.costs.some(cost=>cost.type==="soul-blast"),true);
  }
});

test("all fourteen attack-hit abilities on the exact booster compile with discard and draw",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-boosting-unit-attack-hit-discard-draw-v1"],14);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-boosting-unit-attack-hit-discard-draw-v1")continue;assert.equal(ability.trigger?.eventType,"attack.hit");assert.equal(ability.trigger?.subject,"booster");assert.deepEqual(ability.costs,[{type:"discard",count:1}]);assert.deepEqual(ability.effects,[{op:"draw",count:1}]);}
});

test("all five exact catalog Vanguard attack-hit draw abilities are source and circle scoped",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-vanguard-own-attack-hit-draw-v1")matches.push({card,ability});
 assert.equal(matches.length,5);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-6634","cfa-7013","cfa-7966","cfa-8073","cfa-8106"]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.equal(ability.trigger?.eventType,"attack.hit");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.definition.effects,[{op:"draw",count:1}]);assert.equal(ability.conditionStatus,"no-explicit-condition-detected");assert.equal(ability.costStatus,"no-cost");}
});

test("mandatory Counter-Blast own-attack power template compiles its four exact catalog entries",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-own-attack-counter-blast-power-mandatory-battle-v1"],4);assert.deepEqual(report.invalidCompiled,[]);
});

test("all five grade-gated Soul-Blast boost abilities retain event-grade and opponent-grade requirements",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-boost-grade-opponent-vanguard-grade-soul-blast-power-battle-v1"],5);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-boost-grade-opponent-vanguard-grade-soul-blast-power-battle-v1")continue;assert.equal(ability.trigger?.boostedUnitGradeAtLeast,3);assert.equal(ability.conditions.some(condition=>condition.type==="opponent-vanguard-grade-at-least"&&condition.count===3),true);assert.deepEqual(ability.costs,[{type:"soul-blast",count:1}]);}
});

test("all exact Vanguard Main-phase Soul Charge and power abilities compile",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const {parseCardAbilitiesCached}=require("./ability-engine.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["auto-vanguard-main-phase-soul-charge-power-v1"],15);
  for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){
    if(ability.definition?.source?.patternId!=="auto-vanguard-main-phase-soul-charge-power-v1")continue;
    assert.equal(ability.trigger?.eventType,"phase.changed");
    assert.equal(ability.trigger?.requiredPhase,"main");
    assert.equal(ability.trigger?.turnRelation,"controller");
    assert.deepEqual(ability.definition.effects.map(effect=>effect.op),["soul-charge","modify-power"]);
  }
  assert.deepEqual(report.invalidCompiled,[]);
});

test("all standalone Sentinel keyword reminder variants compile as structured CONT keywords",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const {parseCardAbilitiesCached}=require("./ability-engine.js");
  const report=auditCatalog(loadCatalog());
  assert.equal(report.patterns["cont-sentinel-keyword-v1"],410);
  let count=0;
  for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){
    if(ability.definition?.source?.patternId!=="cont-sentinel-keyword-v1")continue;
    count++;
    assert.equal(ability.kind,"CONT");
    assert.deepEqual(ability.definition.keywords,["sentinel"]);
    assert.equal(ability.trigger,null);
    assert.equal(ability.definition.effects,undefined);
  }
  assert.equal(count,410);
  assert.deepEqual(report.invalidCompiled,[]);
});


test("all exact Lord keyword templates compile as continuous attack restrictions",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["cont-lord-attack-restriction-v1"],115);assert.deepEqual(report.invalidCompiled,[]);
});


test("all exact ride draw and Quick Shield abilities compile with ride and grade-sensitive effects",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-rode-upon-draw-quick-shield-v1"],115);assert.deepEqual(report.invalidCompiled,[]);
  for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-rode-upon-draw-quick-shield-v1")continue;assert.equal(ability.trigger?.eventType,"card.ridden");assert.equal(ability.trigger?.subject,"event-subject");assert.equal(ability.effects[0]?.op,"draw");assert.equal(ability.effects[1]?.op,"create-token");assert.equal(ability.effects[1]?.condition?.grade,1);assert.deepEqual(ability.conditions,[])}
});


test("all exact Guardian Circle discard protection variants compile with attacked-target validation",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-gc-discard-protect-attacked-unit-v1"],73);assert.deepEqual(report.invalidCompiled,[]);
  for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-gc-discard-protect-attacked-unit-v1")continue;assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.circles.includes("guardian"),true);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.effects[0]?.requiresAttackedTarget,true);assert.equal(ability.effects[0]?.targetFilter?.mustBeAttacked,true)}
});


test("all 92 exact Guardian Circle when-placed discard protection abilities compile",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-gc-when-placed-discard-protect-unit-v1"],92);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-gc-when-placed-discard-protect-unit-v1")continue;assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.costs.reduce((sum,cost)=>sum+cost.count,0),1);assert.equal(ability.effects[0]?.target,"chosen")}
});


test("all 24 RC GB1 Vanguard-attack sacrifice abilities compile with source, target, and effect order",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-rc-gb-vanguard-attack-sacrifice-draw-power-v1"],24);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-rc-gb-vanguard-attack-sacrifice-draw-power-v1")continue;assert.equal(ability.gb,1);assert.equal(ability.trigger?.subject,"vanguard");assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.deepEqual(ability.effects.map(effect=>effect.op),["draw","modify-power-target"]);assert.equal(ability.effects[1].duration,"battle")}
});


test("all 24 RC Generation Break Vanguard-attack sacrifice effects have exact subject and ordered effects",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-rc-gb-vanguard-attack-sacrifice-draw-power-v1"],24);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-rc-gb-vanguard-attack-sacrifice-draw-power-v1")continue;assert.equal(ability.gb,1);assert.equal(ability.trigger?.subject,"vanguard");assert.equal(ability.trigger?.eventType,"unit.attacked");assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.deepEqual(ability.effects.map(effect=>effect.op),["draw","modify-power-target"]);assert.equal(ability.effects[1].targetFilter.zone,"vanguard")}
});

test("all conditional-discard Guardian Circle protection variants compile to exact ordered effects",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-gc-protect-then-conditional-discard-v1"],63);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-gc-protect-then-conditional-discard-v1")continue;assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.deepEqual(ability.conditions,[]);assert.deepEqual(ability.effects.map(effect=>effect.op),["protect-target","discard-from-hand"]);assert.equal(ability.effects[0].requiresAttackedTarget,true);assert.deepEqual(ability.effects[1].condition,{op:"hand-count-at-least",count:2})}
});

test("all catalog all-clans-and-nations abilities compile as continuous identity keywords",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["cont-all-clans-and-nations-v1"],28);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-all-clans-and-nations-v1")continue;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition.keywords,["all-clans-and-nations"]);assert.equal(ability.trigger,null);assert.equal(ability.definition.effects,undefined)}
});

test("all 24 Vanguard CONT missed-attack hit-effect cards compile as a source-scoped keyword",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["cont-vanguard-missed-attack-hit-effects-v1"],24);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-vanguard-missed-attack-hit-effects-v1")continue;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.definition.keywords,["missed-attack-hit-effects"]);assert.equal(ability.trigger,null);assert.equal(ability.definition.effects,undefined)}
});


test("all exact Vanguard Limit Break enabler CONT cards compile as rear-guard-only keywords",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-vanguard-limit-break-4-active-at-three-or-less-v1"],24);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-vanguard-limit-break-4-active-at-three-or-less-v1")continue;count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.definition.keywords,["vanguard-limit-break-4-active-at-three-or-less"]);assert.equal(ability.trigger,null);assert.equal(ability.definition.effects,undefined)}assert.equal(count,24);
});


test("all 28 exact Vanguard placement draw-discard AUTO records compile with their shared-name restriction",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-vanguard-placement-draw-discard-v1"],28);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-vanguard-placement-draw-discard-v1")continue;count++;assert.deepEqual(ability.definition.effects.map(step=>step.op),["draw-then-discard"]);assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.ok(ability.trigger?.circles.length);assert.equal(ability.canDecline,false);if(/same card name once a turn/i.test(ability.printedText))assert.deepEqual(ability.usageRestriction,{type:"once-per-turn",scope:"card-name-and-ability",reset:"turn"});assert.equal(ability.choiceStatus,"modeled")}assert.equal(count,28);
});


test("all 22 exact boosted battle close-step source-to-Soul power AUTO records compile",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-boosted-battle-close-source-to-soul-power-v1"],22);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-boosted-battle-close-source-to-soul-power-v1")continue;count++;assert.equal(ability.trigger?.eventType,"battle.close-step");assert.equal(ability.trigger?.subject,"booster");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.effects[0]?.op,"modify-power-target");assert.deepEqual(ability.effects[0]?.targetFilter,{controller:"source-controller",cardType:"unit"})}assert.equal(count,22);
});

test("all seven dual-circle opponent trigger-check power and shield CONT abilities compile with structured turn-state conditions",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-rc-gc-opponent-check-trigger-power-shield-v1"],7);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-rc-gc-opponent-check-trigger-power-shield-v1")continue;count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["rear-guard","guardian"]);assert.deepEqual(ability.definition.effects.map(effect=>effect.op),["continuous-power","continuous-shield"]);assert.ok(ability.definition.effects.every(effect=>effect.condition?.op==="opponent-trigger-revealed-this-turn"&&effect.amount===10000));assert.equal(ability.conditionStatus,"no-explicit-condition-detected")}assert.equal(count,7);
});

test("all six dual-circle CONT abilities with an OR grade-or-damage condition preserve both live predicates",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-rc-gc-vanguard-grade-or-damage-power-shield-v1"],6);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-rc-gc-vanguard-grade-or-damage-power-shield-v1")continue;count++;assert.deepEqual(ability.requiredLocation,["rear-guard","guardian"]);assert.deepEqual(ability.definition.effects.map(effect=>[effect.op,effect.amount,effect.location]),[["continuous-power",5000,"rear-guard"],["continuous-shield",5000,"guardian"]]);const condition=ability.definition.effects[0].condition;assert.equal(condition.op,"any");assert.deepEqual(condition.conditions,[{op:"controller-vanguard-grade-less-than-opponent"},{op:"controller-damage-at-least",count:4}]);assert.equal(ability.conditionStatus,"no-explicit-condition-detected")}assert.equal(count,6);
});

test("all six lower-controller-grade GC shield AUTO abilities compile with strict source and grade checks",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-gc-controller-vanguard-lower-grade-shield-v1"],6);assert.deepEqual(report.invalidCompiled,[]);let count=0;
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-gc-controller-vanguard-lower-grade-shield-v1")continue;count++;assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.requiredLocation,["guardian"]);assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-grade-lower-than-opponent"}]);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:10000,duration:"battle"}]);}
 assert.equal(count,6);
});

test("all seven Kiwame Crest same-name ride restrictions compile as passive rule effects",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),cards=loadCatalog(),expected=["cfa-11213","cfa-11214","cfa-11215","cfa-11216","cfa-11241","cfa-11244","cfa-11254"],matches=[];
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card))if(ability.raw==="You cannot ride a unit with a different card name from your vanguard.")matches.push({card,ability});
 assert.deepEqual(matches.map(item=>item.card.id).sort(),expected.sort());
 for(const {card,ability} of matches){assert.equal(ability.kind,"CONT",card.id);assert.equal(ability.definition?.source?.patternId,"cont-crest-ride-same-name-vanguard-v1",card.id);assert.deepEqual(ability.definition?.continuousRestrictions,[{type:"ride-same-name-as-vanguard"}],card.id);assert.deepEqual(ability.requiredLocation,[],card.id);}
});

test("all six real Restraint CONT abilities compile to circle-scoped passive attack restrictions",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-vc-rc-restraint-cannot-attack-v1"],6);assert.deepEqual(report.invalidCompiled,[]);let count=0;
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-vc-rc-restraint-cannot-attack-v1")continue;count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);assert.deepEqual(ability.definition.keywords,["restraint"]);assert.deepEqual(ability.definition.continuousRestrictions,[{type:"restraint"}]);assert.equal(ability.trigger,null);}
 assert.equal(count,6);
});

test("all six exact RC/GC Intercept grant CONT abilities compile with continuous shield",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),expected=["cfa-13995","cfa-13999","cfa-14000","cfa-14005","cfa-14010","cfa-14013"],matches=[];assert.equal(report.patterns["cont-rc-gc-grant-intercept-shield-v1"],6);assert.deepEqual(report.invalidCompiled,[]);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-rc-gc-grant-intercept-shield-v1")matches.push({card,ability});
 assert.deepEqual(matches.map(item=>item.card.id).sort(),expected.sort());for(const {ability} of matches){assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["rear-guard","guardian"]);assert.deepEqual(ability.definition.keywords,["intercept"]);assert.deepEqual(ability.definition.effects,[{op:"continuous-shield",target:"source",amount:5000,duration:"continuous",condition:{op:"always"}}]);assert.equal(ability.trigger,null)}
});

test("all twelve bare Charge AUTO keyword records use the official effect-placement and battle-end rule",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card))if(ability.raw==="Charge.")matches.push({card,ability});
 assert.equal(matches.length,12);assert.equal(report.patterns["auto-charge-effect-placement-bottom-deck-after-battle-v1"],23);assert.deepEqual(report.invalidCompiled,[]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.equal(ability.definition?.source?.patternId,"auto-charge-effect-placement-bottom-deck-after-battle-v1");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.trigger?.circles,["rear-guard"]);assert.equal(ability.trigger?.effectPlacementOnly,true);assert.equal(ability.canDecline,true);assert.deepEqual(ability.definition.effects,[{op:"set-charging",target:"source"}]);}
});

test("the exact Vanguard boost draw-discard catalog card is compiled and audit-clean",()=>{const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-rc-vanguard-boost-draw-discard-v1"],1);assert.deepEqual(report.invalidCompiled,[])});

test("catalog audit compiles all exact top-five grade-three placement searches",()=>{const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const cards=loadCatalog(),matches=[];for(const card of cards)for(const ability of require("./ability-engine.js").parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-placement-top-five-grade-three-search-discard-v1")matches.push(ability);assert.equal(matches.length,25);assert.ok(matches.every(ability=>ability.trigger?.sourceLocation==="hand"&&ability.conditionStatus==="no-explicit-condition-detected"&&ability.costStatus==="no-cost"));assert.deepEqual(auditCatalog(cards).invalidCompiled,[])});

test("exact standalone Resist CONT variants compile and remain target-protective",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["cont-resist-keyword-v1"],22);assert.deepEqual(report.invalidCompiled,[]);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-resist-keyword-v1"){assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition.keywords,["resist"]);assert.equal(ability.trigger,null);assert.equal(ability.effects,null)}
});

test("all seven exact RC cannot-be-chosen CONT catalog abilities are location-scoped passive Resist",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-rc-cannot-be-chosen-by-opponent-v1"],7);assert.deepEqual(report.invalidCompiled,[]);let count=0;
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-rc-cannot-be-chosen-by-opponent-v1"){count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.definition.keywords,["resist"]);assert.equal(ability.trigger,null);assert.equal(ability.effects,null)}
 assert.equal(count,7);
});

test("all four GC Generation Break shield CONT catalog abilities use a live GB threshold",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-gc-generation-break-shield-v1"],4);assert.deepEqual(report.invalidCompiled,[]);let count=0;
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-gc-generation-break-shield-v1"){count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["guardian"]);assert.equal(ability.gb,1);assert.deepEqual(ability.definition.effects,[{op:"continuous-shield",target:"source",amount:5000,duration:"continuous",condition:{op:"generation-break",count:1}}]);}
 assert.equal(count,4);
});

test("all six exact Cannot Be Ridden catalog CONT abilities compile as ride restrictions",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-card-cannot-be-ridden-v1"],6);assert.deepEqual(report.invalidCompiled,[]);let count=0;
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-card-cannot-be-ridden-v1"){count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition.keywords,["cannot-be-ridden"]);assert.equal(ability.requiredLocation.length,0);assert.equal(engine.canRideCard(card),false);}
 assert.equal(count,6);
});

test("all six Normal Order conditional CONT power abilities compile without activation prompts",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached,isManuallyActivatable}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-rc-normal-order-power-v1"],6);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-rc-normal-order-power-v1"){count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.definition.effects[0].condition,{op:"normal-order-played-this-turn"});assert.equal(isManuallyActivatable(ability),false)}assert.equal(count,6);
});

test("all five attack-battle CONT power records compile as non-activated effects",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached,isManuallyActivatable}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-rc-attacks-vanguard-battle-power-v1"],5);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-rc-attacks-vanguard-battle-power-v1"){count++;assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.definition.effects[0].condition,{op:"attacking-vanguard"});assert.equal(isManuallyActivatable(ability),false)}assert.equal(count,5);
});

test("the exact opponent/controller Vanguard grade CONT power families compile and audit cleanly",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["cont-rc-opponent-vanguard-grade-power-v1"],5);assert.equal(report.patterns["cont-rc-controller-vanguard-grade-power-v1"],4);assert.deepEqual(report.invalidCompiled,[]);let opponent=0,controller=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){const id=ability.definition?.source?.patternId;if(id==="cont-rc-opponent-vanguard-grade-power-v1"){opponent++;assert.equal(ability.requiredLocation[0],"rear-guard");assert.deepEqual(ability.definition.effects[0].condition,{op:"opponent-vanguard-grade-at-least",grade:3,controllerTurn:true})}if(id==="cont-rc-controller-vanguard-grade-power-v1"){controller++;assert.equal(ability.requiredLocation[0],"rear-guard");assert.deepEqual(ability.definition.effects[0].condition,{op:"controller-vanguard-grade-at-least",grade:3})}}assert.equal(opponent,5);assert.equal(controller,4);
});

test("all exact Counter-Blast GC top-deck calling abilities compile as a source-specific optional AUTO",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-gc-counter-blast-call-top-to-guardian-v1"],16);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-gc-counter-blast-call-top-to-guardian-v1")continue;count++;assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.sourceLocation,"hand");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.equal(ability.definition.effects[0]?.count,5);assert.equal(ability.canDecline,true)}assert.equal(count,16);
});
test("all 15 exact Ride Phase discard Soul-Blast bottom-deck draw abilities compile with both structured costs",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1"],15);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1")continue;count++;assert.equal(ability.trigger?.eventType,"card.discarded");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.sourceLocation,"hand");assert.equal(ability.trigger?.requiredPhase,"ride");assert.deepEqual(ability.costs,[{type:"soul-blast",count:1},{type:"source-to-bottom-deck",count:1}]);assert.deepEqual(ability.definition.effects,[{op:"draw",count:1}])}assert.equal(count,15);
});
test("all seven current-attacker second-attack GC shield abilities compile with the turn counter condition",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-gc-opponent-second-attack-shield-v1"],7);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-gc-opponent-second-attack-shield-v1")continue;count++;assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.deepEqual(ability.conditions,[{type:"opponent-attacking-unit-attacked-at-least",count:2}]);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.definition.effects,[{op:"modify-shield-source",target:"source",amount:15000,duration:"battle"}])}assert.equal(count,7);
});
test("all seven exact VC placement discard-draw AUTO records compile with strict source and cost metadata",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);assert.equal(report.patterns["auto-vanguard-placement-discard-draw-v1"],7);assert.deepEqual(report.invalidCompiled,[]);let count=0;for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-vanguard-placement-discard-draw-v1")continue;count++;assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["vanguard"]);assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.costs,[{type:"discard",count:1}]);assert.equal(ability.canDecline,false);assert.deepEqual(ability.definition.effects,[{op:"draw",count:1}])}assert.equal(count,7);
});test("all exact Ride-phase Hand grade-two top-five search abilities compile with source cost and grade gate",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1"],22);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1")continue;assert.equal(ability.trigger?.requiredPhase,"ride");assert.deepEqual(ability.requiredLocation,["hand"]);assert.deepEqual(ability.costs,[{type:"source-discard",count:1}]);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-grade-at-most",count:1}]);assert.deepEqual(ability.definition.effects,[{op:"search-top-up-to-one-grade-to-hand",target:"controller",lookCount:5,maximumGrade:2}]);}assert.deepEqual(report.invalidCompiled,[]);
});
test("the real Battle Sister, Mille-feuille paid VC draw compiles with both mandatory resource costs",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const matches=[];for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-placed-circle-counter-soul-draw-v1")matches.push({card,ability});assert.equal(matches.length,1);assert.equal(matches[0].card.name,"Battle Sister, Mille-feuille");assert.deepEqual(matches[0].ability.costs,[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]);
});
test("all 24 exact RC-from-hand Grade 3 reveal/search/discard abilities compile",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-rc-from-hand-reveal-grade-three-search-name-discard-v1"],24);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-rc-from-hand-reveal-grade-three-search-name-discard-v1")continue;assert.equal(ability.trigger?.eventType,"card.placed");assert.deepEqual(ability.trigger?.circles,["rear-guard"]);assert.equal(ability.trigger?.sourceLocation,"hand");assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.costs,[{type:"reveal-grade-from-hand",count:1,grade:3}]);assert.deepEqual(ability.definition.effects[0],{op:"search-deck-named-grade-three-then-discard",target:"controller",grade:3,nameContains:ability.definition.effects[0].nameContains,discardCount:1})}assert.deepEqual(report.invalidCompiled,[]);
});
test("all four real placed-unit Counter-Blast retire cards compile their exact circles, costs, clans, and target filter",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());assert.equal(report.patterns["auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1"],4);for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1")continue;assert.deepEqual(ability.costs,[{type:"counter-blast",count:2}]);assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.conditions.length,card.name==="Gwynn the Ripper"||card.name==="Dragonic Deathscythe"?1:0);assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"opponent",zone:"rear-guard",maxGrade:2})}assert.deepEqual(report.invalidCompiled,[]);
});

test("all real catalog copies of the Rest-source front-row ACT use the shared typed target rule",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["act-rest-source-front-row-ally-power-v1"],4);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="act-rest-source-front-row-ally-power-v1"){
  assert.deepEqual(ability.costs,[{type:"rest-source",count:1}]);assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"source-controller",cardType:"unit",excludeSource:true,row:"front"});
 }
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all five real Counter-Blast During-this-turn ACT records compile as source power abilities",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["act-counter-blast-source-power-during-turn-v1"],5);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(/\[Counter Blast \d+\] During this turn, this unit gets power \+\d+\./i.test(ability.raw||'')){
  assert.equal(ability.definition?.source?.patternId,"act-counter-blast-source-power-during-turn-v1");assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.conditionStatus,"no-explicit-condition-detected");
 }
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all 25 source-to-Soul friendly-power ACT records use the same parsed target effect",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["act-source-to-soul-choose-friendly-power-turn-v1"],25);
 const matched=[];for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="act-source-to-soul-choose-friendly-power-turn-v1"){
  matched.push(card.id);assert.equal(ability.choiceStatus,"no-explicit-choice-detected");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.definition.effects[0].targetFilter.excludeSource,true);
 }
 assert.ok(matched.includes("cfa-2208"));assert.ok(matched.includes("cfa-2552"));assert.ok(matched.includes("cfa-4069"));assert.ok(matched.includes("cfa-5041"));assert.ok(matched.includes("cfa-5748"));assert.deepEqual(report.invalidCompiled,[]);
});

test("all six same-name search power ACT catalog definitions preserve once-per-turn costs and optional choice",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["act-counter-blast-same-name-search-power-v1"],6);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="act-counter-blast-same-name-search-power-v1"){
  assert.equal(ability.kind,"ACT");assert.equal(ability.once,true);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.equal(ability.choiceStatus,"modeled");assert.equal(ability.definition.effects[0].op,"search-deck-same-name-to-hand");assert.equal(ability.definition.effects[1].op,"modify-power");
 }
 const app=require("node:fs").readFileSync("app.js","utf8");assert.ok(app.includes("same card name as this unit"));assert.ok(app.includes("Choose no card"));assert.ok(app.includes("step.op===\"search-deck-same-name-to-hand\""));assert.deepEqual(report.invalidCompiled,[]);
});

test("all five exact real Vanguard Counter-Blast unlock ACTs use locked friendly-unit targeting",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["act-vanguard-counter-blast-unlock-friendly-locked-v1"],5);
 const ids=[];for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="act-vanguard-counter-blast-unlock-friendly-locked-v1"){
  ids.push(card.id);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"source-controller",locked:true});assert.deepEqual(ability.requiredLocation,["vanguard"]);
 }
 for(const id of ["cfa-1777","cfa-1778","cfa-1779","cfa-1780","cfa-1781"])assert.ok(ids.includes(id));
 const app=require("node:fs").readFileSync("app.js","utf8");assert.ok(app.includes("unlock-target"));assert.ok(app.includes("unit.unlocked"));assert.deepEqual(report.invalidCompiled,[]);
});

test("all 91 exact named-Soul CONT records preserve circle, name, turn, and continuous effect",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["cont-named-soul-card-power-v1"],91);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="cont-named-soul-card-power-v1"){
  assert.equal(ability.kind,"CONT");assert.notEqual(ability.conditionStatus,"needs-review");assert.equal(ability.definition.effects[0].op,"continuous-power");assert.equal(ability.definition.effects[0].condition.op,"soul-has-card-name");assert.equal(ability.definition.effects[0].condition.controllerTurn,/During your turn/i.test(ability.raw));assert.ok(["vanguard","rear-guard"].some(location=>ability.requiredLocation.includes(location)));
 }
 assert.deepEqual(report.invalidCompiled,[]);
});

test("both named-Soul ACT records enforce the printed condition before Counter-Blast and resolve power plus critical",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["act-counter-blast-named-soul-power-critical-turn-v1"],2);
 for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="act-counter-blast-named-soul-power-critical-turn-v1"){
  assert.equal(ability.kind,"ACT");assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.costs,[{type:"counter-blast",count:2}]);assert.deepEqual(ability.definition.effects.map(effect=>effect.op),["modify-power","modify-critical"]);assert.deepEqual(ability.requiredLocation,["vanguard"]);
 }
 assert.deepEqual(report.invalidCompiled,[]);
});

test("both exact empty-Soul own-attack AUTO records keep attacker identity and Soul/clan requirements",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-own-attack-empty-soul-power-battle-v1"],2);
 const ids=[];for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-own-attack-empty-soul-power-battle-v1"){
  ids.push(card.id);assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.eventType,"unit.attacked");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.conditionStatus,"modeled");assert.equal(ability.definition.effects[0].op,"modify-power");assert.equal(ability.definition.effects[0].duration,"battle");
 }
 assert.ok(ids.includes("cfa-396"));assert.ok(ids.includes("cfa-412"));assert.deepEqual(report.invalidCompiled,[]);
 const app=require("node:fs").readFileSync("app.js","utf8");assert.ok(app.includes("controllerSoulCount:(player.soul||[]).length"));
});

test("six real own-attack hand-condition abilities preserve hand thresholds, GB, target, and battle effects",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-own-attack-hand-condition-power-battle-v1"],6);
 const ids=[];for(const card of loadCatalog())for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-own-attack-hand-condition-power-battle-v1"){
  ids.push(card.id);assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.eventType,"unit.attacked");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.conditionStatus,"modeled");assert.equal(ability.definition.effects[0].op,"modify-power");assert.equal(ability.definition.effects[0].duration,"battle");
 }
 for(const id of ["cfa-348","cfa-395","cfa-413","cfa-1643","cfa-3428","cfa-5417"])assert.ok(ids.includes(id));assert.deepEqual(report.invalidCompiled,[]);
});

test("Rear-Guard advantage AUTO compiler covers prefixed and legacy unlabeled attack text",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-own-attack-rear-guard-advantage-power-battle-v1"],26);
 for(const cardId of ["cfa-538","cfa-549","cfa-667","cfa-690","cfa-1461"]){const card=loadCatalog().find(item=>item.id===cardId);const ability=parseCardAbilitiesCached(card).find(item=>item.definition?.source?.patternId==="auto-own-attack-rear-guard-advantage-power-battle-v1");assert.ok(ability);assert.deepEqual(ability.conditions,[{type:"controller-has-more-rear-guards-than-opponent"}]);assert.equal(ability.trigger?.subject,"source");assert.equal(ability.conditionStatus,"modeled");}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("unconditional Vanguard own-attack power compiler covers its three legacy articles",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-own-attack-power-battle-v1"],11);
 for(const cardId of ["cfa-839","cfa-856","cfa-868"]){const card=loadCatalog().find(item=>item.id===cardId);const ability=parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:1`);assert.ok(ability);assert.equal(ability.definition?.source?.patternId,"auto-own-attack-power-battle-v1");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.definition.effects,[{op:"modify-power",target:"source",amount:4000,duration:"battle"}]);}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("26 real RC placement AUTO abilities preserve exact source origin, friendly filters, costs, and power",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);let deckOrigin=0,paid=0;
 assert.equal(report.patterns["auto-rc-placement-choose-friendly-clan-power-turn-v1"],26);
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-rc-placement-choose-friendly-clan-power-turn-v1"){
  assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["rear-guard"]);assert.equal(ability.choiceStatus,"modeled");
  const filter=ability.definition.effects[0].targetFilter;assert.equal(filter.controller,"source-controller");assert.equal(filter.excludeSource,true);assert.equal(filter.cardType,"unit");assert.equal(ability.definition.effects[0].op,"modify-power-target");assert.equal(ability.definition.effects[0].duration,"turn");
  if(ability.trigger.sourceLocation){assert.equal(ability.trigger.sourceLocation,"deck");deckOrigin++}if(ability.costs.length){assert.deepEqual(ability.costs,[{type:"counter-blast",count:card.id==="cfa-248"||card.id==="cfa-984"?2:1}]);paid++}
 }
 assert.equal(deckOrigin,3);assert.equal(paid,4);assert.deepEqual(report.invalidCompiled,[]);
 const app=require("node:fs").readFileSync("app.js","utf8");assert.ok(app.includes("&&!(ability.costs||[]).length"));assert.ok(app.includes("chosenStep.noOpIfNoLegalTargets&&!abilityTargetChoices"));
});

test("Honebami Toushirou compiles only the exact Vanguard boost Soul Blast template",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-3077"),ability=parseCardAbilitiesCached(card).find(item=>item.definition?.source?.patternId==="auto-rc-vanguard-boost-soul-blast-draw-discard-v1");
 assert.ok(ability);assert.equal(report.patterns["auto-rc-vanguard-boost-soul-blast-draw-discard-v1"],1);assert.deepEqual(ability.costs,[{type:"soul-blast",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(report.invalidCompiled,[]);
});

test("exact VC Counter-Blast and Soul-Blast named searches compile from four real catalog cards",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-vanguard-placement-counter-soul-named-search-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-vanguard-placement-counter-soul-named-search-v1"],4);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-2025","cfa-2027","cfa-2213","cfa-2214"]);for(const {ability} of matches){assert.equal(ability.trigger?.eventType,"card.placed");assert.deepEqual(ability.trigger?.circles,["vanguard"]);assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]);assert.deepEqual(ability.definition.effects.map(step=>step.op),["search-deck-same-name-to-hand"])}assert.deepEqual(report.invalidCompiled,[]);
});

test("all exact Order Zone placement draw records compile with source identity",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-order-zone-placement-draw-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-order-zone-placement-draw-v1"],8);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-10288","cfa-10411","cfa-10456","cfa-10459","cfa-12167","cfa-13038","cfa-8315","cfa-9115"]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["order"]);assert.deepEqual(ability.definition.effects,[{op:"draw",count:1}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all nine unconditional intercept shield abilities compile with Guardian Circle timing",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-intercept-shield-battle-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-intercept-shield-battle-v1"],9);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-2032","cfa-2046","cfa-2247","cfa-2257","cfa-2523","cfa-2534","cfa-2681","cfa-2695","cfa-3075"]);
 for(const {ability} of matches){assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:5000,duration:"battle"}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("18 clan-gated intercept shield abilities preserve the required Vanguard clan",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-intercept-clan-vanguard-shield-battle-v1")matches.push({card,ability});
 const ids=["cfa-25","cfa-95","cfa-151","cfa-212","cfa-297","cfa-345","cfa-375","cfa-533","cfa-580","cfa-618","cfa-677","cfa-722","cfa-862","cfa-1076","cfa-1104","cfa-1462","cfa-1470","cfa-1683"];
 assert.equal(report.patterns["auto-intercept-clan-vanguard-shield-battle-v1"],18);assert.deepEqual(matches.map(item=>item.card.id).sort(),ids.sort());
 for(const {ability} of matches){assert.equal(ability.trigger?.eventType,"card.placed");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.equal(ability.conditions.length,1);assert.equal(ability.conditions[0].type,"controller-vanguard-has-clan");assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:5000,duration:"battle"}]);assert.equal(ability.conditionStatus,"modeled")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("nine structured state conditions compile as exact battle-scoped Intercept shield effects",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-intercept-shield-structured-condition-battle-v1")matches.push({card,ability});
 const ids=["cfa-2840","cfa-5165","cfa-8453","cfa-9585","cfa-9604","cfa-9626","cfa-9738","cfa-10101","cfa-10182"];
 assert.equal(report.patterns["auto-intercept-shield-structured-condition-battle-v1"],9);assert.deepEqual(matches.map(item=>item.card.id).sort(),ids.sort());
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.eventType,"card.placed");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.equal(ability.conditions.length,1);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:ability.effects[0].amount,duration:"battle"}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("four controller-Vanguard-attacked Intercept cards require the actual defended Vanguard",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-intercept-controller-vanguard-attacked-shield-battle-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-intercept-controller-vanguard-attacked-shield-battle-v1"],4);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-4353","cfa-4483","cfa-4534","cfa-5184"]);
 for(const {ability} of matches){assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.deepEqual(ability.conditions,[{type:"controller-vanguard-is-attacked-unit"}]);assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:5000,duration:"battle"}]);assert.equal(ability.conditionStatus,"modeled")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("seven Generation Break Intercept shield abilities require GB1",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-intercept-generation-break-shield-battle-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-intercept-generation-break-shield-battle-v1"],7);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-3651","cfa-4157","cfa-4357","cfa-4446","cfa-4459","cfa-4873","cfa-4972"]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.equal(ability.gb,1);assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:ability.effects[0].amount,duration:"battle"}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("seven front-trigger critical abilities compile with controller and check-type restrictions",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-drive-check-front-trigger-critical-turn-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-drive-check-front-trigger-critical-turn-v1"],7);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-7110","cfa-7812","cfa-7813","cfa-7814","cfa-7815","cfa-7816","cfa-7817"]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",revealedTrigger:"front"});assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);assert.equal(ability.once,true);assert.deepEqual(ability.effects,[{op:"modify-critical",target:"source",amount:1,duration:"turn"}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("ten Vanguard drive-check clan abilities inspect the exact revealed instance",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-vanguard-drive-check-revealed-clan-power-battle-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-vanguard-drive-check-revealed-clan-power-battle-v1"],10);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-32","cfa-221","cfa-304","cfa-674","cfa-681","cfa-1799","cfa-1802","cfa-1809","cfa-1814","cfa-1890"].sort());
 const expected=new Map([["cfa-32",[null,"Shadow Paladin",2000]],["cfa-221",[3,"Gold Paladin",5000]],["cfa-304",[3,"Great Nature",5000]],["cfa-674",[3,"Royal Paladin",5000]],["cfa-681",[3,"Royal Paladin",5000]],["cfa-1799",[null,"Gold Paladin",2000]],["cfa-1802",[null,"Royal Paladin",2000]],["cfa-1809",[null,"Kagero",2000]],["cfa-1814",[null,"Genesis",2000]],["cfa-1890",[null,"Link Joker",2000]]]);
 for(const {card,ability} of matches){const [grade,clan,power]=expected.get(card.id);assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"source",circles:[],checkKind:"drive",revealedGrade:grade,revealedClan:clan});assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.effects,[{op:"modify-power",target:"source",amount:power,duration:"battle"}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("Death Army Rear-Guards compile only for a grade-three Nova Grappler Vanguard check",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-rc-vanguard-drive-check-grade-clan-stand-source-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-rc-vanguard-drive-check-grade-clan-stand-source-v1"],3);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-128","cfa-143","cfa-1602"]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkSourceLocation:"vanguard",revealedGrade:3,revealedClan:"Nova Grappler"});assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.effects,[{op:"stand-source",target:"source"}]);assert.equal(ability.canDecline,false)}assert.deepEqual(report.invalidCompiled,[]);
});

test("Shinichi Kudo and Heiji Hattori compile normal-unit drive-check power AUTO",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId==="auto-drive-check-normal-unit-source-power-turn-v1")matches.push({card,ability});
 assert.equal(report.patterns["auto-drive-check-normal-unit-source-power-turn-v1"],2);assert.deepEqual(matches.map(item=>item.card.id).sort(),["cfa-11397","cfa-11400"]);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkedCardTriggerType:""});assert.deepEqual(ability.effects,[{op:"modify-power",target:"source",amount:3000,duration:"turn"}]);assert.equal(ability.costStatus,"no-cost")}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("Fetter Creator Van compiles its optional normal-drive-check Soul cost",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-4080"),ability=parseCardAbilitiesCached(card).find(item=>item.definition?.source?.patternId==="auto-rc-drive-check-normal-unit-source-soul-draw-v1");
 assert.ok(ability);assert.equal(report.patterns["auto-rc-drive-check-normal-unit-source-soul-draw-v1"],1);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkedCardTriggerType:""});assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.gb,1);assert.equal(ability.canDecline,true);assert.deepEqual(ability.effects,[{op:"draw",count:1}]);assert.deepEqual(report.invalidCompiled,[]);
});

test("Waveflow Dragon compiles its checked-normal-unit cost and rear-guard target",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-7087"),ability=parseCardAbilitiesCached(card).find(item=>item.definition?.source?.patternId==="auto-rc-drive-check-normal-unit-source-soul-rearguard-power-v1");
 assert.ok(ability);assert.equal(report.patterns["auto-rc-drive-check-normal-unit-source-soul-rearguard-power-v1"],1);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkedCardTriggerType:""});assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.deepEqual(ability.definition.effects,[{op:"modify-power-target",target:"chosen",amount:5000,duration:"turn",targetFilter:{controller:"source-controller",zone:"rear-guard",cardType:"unit",excludeSource:true}}]);assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(report.invalidCompiled,[]);
});

test("Gun Trooper, Klephts compiles its named-Vanguard drive-check ability",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-7132"),ability=parseCardAbilitiesCached(card)[0];
 assert.equal(report.patterns["auto-rc-normal-drive-check-named-vanguard-retire-source-drive-v1"],1);assert.equal(ability.definition?.source?.patternId,"auto-rc-normal-drive-check-named-vanguard-retire-source-drive-v1");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"source-retire",count:1}]);assert.deepEqual(ability.effects,[{op:"modify-drive-target",target:"attacking-vanguard",amount:1,duration:"battle"}]);assert.equal(ability.conditionStatus,"modeled");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(report.invalidCompiled,[]);
});

test("Storm Element, Cycloned compiles abilityless normal drive-check stand AUTO",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-7474"),ability=parseCardAbilitiesCached(card).find(item=>item.kind==="AUTO");
 assert.equal(report.patterns["auto-vanguard-drive-check-abilityless-normal-stand-rearguard-v1"],1);assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.checkedCardHasNoAbilities,true);assert.equal(ability.trigger?.requiresBattleSourceMatch,true);assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.effects,[{op:"stand-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard",cardType:"unit"}}]);assert.deepEqual(report.invalidCompiled,[]);
});

test("Storm Element, Cycloned compiles the VC/G-zone abilityless continuous power ability",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-7474"),ability=parseCardAbilitiesCached(card).find(item=>item.kind==="CONT");
 assert.equal(report.patterns["cont-vc-gzone-abilityless-controller-units-power-v1"],1);assert.deepEqual(ability.requiredLocation,["vanguard","g-zone"]);assert.deepEqual(ability.definition.effects,[{op:"continuous-power",target:"all-controller-units",amount:5000,duration:"continuous",condition:{op:"controller-turn",sourceFaceUp:true,targetHasNoAbilities:true}}]);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(report.invalidCompiled,[]);
});

test("Dauntless Dominate Dragon compiles only its reviewed locked drive-check AUTO",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached,registerAbilityDefinitions}=require("./ability-engine.js");registerAbilityDefinitions(require("./ability-definitions.js"));const cards=loadCatalog(),report=auditCatalog(cards),card=cards.find(item=>item.id==="cfa-9421"),abilities=parseCardAbilitiesCached(card),ability=abilities[0];
 assert.equal(report.patterns["auto-vanguard-drive-check-normal-unit-lock-reveal-and-battle-bonus-v1"],1);assert.equal(ability.definition?.source?.patternId,"auto-vanguard-drive-check-normal-unit-lock-reveal-and-battle-bonus-v1");assert.equal(ability.definition?.source?.officialReference,"https://en.cf-vanguard.com/cardlist/?cardno=D-VS03%2F022EN&expansion=180&view=text");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkedCardTriggerType:""});assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.deepEqual(ability.definition.effects,[{op:"call-checked-card-locked",target:"checked-card",position:"locked"},{op:"modify-power",target:"source",amount:10000,duration:"battle",ifPreviousEffectSucceeded:0},{op:"modify-drive",target:"source",amount:1,duration:"battle",ifPreviousEffectSucceeded:0}]);assert.equal(abilities[1].definition,null);assert.deepEqual(report.invalidCompiled,[]);
});

test("ride-phase discard-call AUTO compiles all six catalog cards with exact phase and card identity",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards),ids=["cfa-12252","cfa-12264","cfa-12275","cfa-12351","cfa-12355","cfa-12374"],matches=cards.filter(card=>ids.includes(card.id));
 assert.equal(matches.length,6);assert.equal(report.patterns["auto-ride-phase-discard-source-call-rested-v1"],6);for(const card of matches){const ability=parseCardAbilitiesCached(card)[0];assert.equal(ability.definition?.source?.officialReference,"https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=220&s_param=d-Dark+States&sort=no&view=text");assert.deepEqual(ability.costs,[]);assert.equal(ability.trigger?.eventType,"card.discarded");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.sourceLocation,"hand");assert.equal(ability.trigger?.destinationLocation,"drop");assert.equal(ability.trigger?.requiredPhase,"ride");assert.deepEqual(ability.definition.effects,[{op:"call-source-from-drop-rested",target:"source",position:"rest"}]);assert.equal(ability.canDecline,true)}assert.deepEqual(report.invalidCompiled,[]);
});

test("zone-unspecified name-alias CONT compiles all 75 catalog entries, including the exact regarded-as wording",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached,getCardNames,getReviewedAbilityDefinitionsForCard}=require("./ability-engine.js");const cards=loadCatalog(),report=auditCatalog(cards);let count=0,regardedAsCount=0;
 for(const card of cards)for(const ability of parseCardAbilitiesCached(card)){if(ability.definition?.source?.patternId!=="cont-card-name-alias-v1")continue;count++;assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,[]);assert.equal(ability.definition.keywords[0].name,"card-name-alias");assert.ok(getCardNames(card).length>=2);assert.ok(getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.keywords?.[0]?.name==="card-name-alias"),card.id);if(/This card is regarded as/i.test(ability.printedText))regardedAsCount++}
 assert.equal(count,75);assert.equal(regardedAsCount,27);assert.equal(report.patterns["cont-card-name-alias-v1"],75);assert.deepEqual(report.invalidCompiled,[]);
});

test("VC filtered top-five search compiles the 21 exact keyword/race catalog abilities",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const ids=["cfa-3002","cfa-3483","cfa-3501","cfa-3544","cfa-3550","cfa-3552","cfa-3610","cfa-3629","cfa-3781","cfa-3792","cfa-3799","cfa-3808","cfa-3947","cfa-3967","cfa-3985","cfa-4298","cfa-4333","cfa-4352","cfa-4369","cfa-5495","cfa-6135"],cards=loadCatalog(),report=auditCatalog(cards),matches=cards.filter(card=>ids.includes(card.id));
 assert.equal(matches.length,21);assert.equal(report.patterns["auto-vanguard-placement-top-five-filtered-search-hand-v1"],21);for(const card of matches){const ability=parseCardAbilitiesCached(card).find(item=>item.definition?.source?.patternId==="auto-vanguard-placement-top-five-filtered-search-hand-v1");assert.ok(ability,card.id);assert.equal(ability.kind,"AUTO");assert.equal(ability.choiceStatus,"modeled");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(ability.definition.effects[0],{op:"search-top-up-to-one-filtered-to-hand",target:"controller",lookCount:5,maximum:1,filter:ability.definition.effects[0].filter});assert.ok(ability.definition.effects[0].filter.abilityKeyword||ability.definition.effects[0].filter.abilityKeywordsAny||ability.definition.effects[0].filter.race)}assert.deepEqual(report.invalidCompiled,[]);
});


test("Grade 3 ACT top-five source-to-Soul searches compile for the real catalog family",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog()),ids=["cfa-83","cfa-178","cfa-235","cfa-265","cfa-323","cfa-381","cfa-444","cfa-707","cfa-733","cfa-781","cfa-834","cfa-899","cfa-953","cfa-989","cfa-1068","cfa-1229","cfa-1599","cfa-2405","cfa-2439","cfa-2474","cfa-3505","cfa-3519","cfa-5531"],cards=loadCatalog().filter(card=>ids.includes(card.id));
 assert.equal(cards.length,ids.length);assert.equal(report.patterns["act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1"],ids.length);
 for(const card of cards){const ability=parseCardAbilitiesCached(card).find(item=>item.kind==="ACT");assert.equal(ability.definition?.source?.patternId,"act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1",card.id);assert.deepEqual(ability.requiredLocation,["rear-guard"],card.id);assert.equal(ability.costStatus,"supported-cost",card.id);assert.equal(ability.choiceStatus,"modeled",card.id);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"source-to-soul",count:1}],card.id);assert.equal(ability.definition.effects[0].filter.minGrade,3,card.id);assert.deepEqual(ability.definition.effects[0].filter.cardType,"unit",card.id)}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("unconditional own-Vanguard attack power supports legacy source and duration wording",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached}=require("./ability-engine.js");const report=auditCatalog(loadCatalog());
 assert.equal(report.patterns["auto-own-attack-vanguard-power-battle-v1"],66);
 for(const cardId of ["cfa-918","cfa-1027","cfa-2028","cfa-2233","cfa-2465","cfa-2598","cfa-2900"]){const card=loadCatalog().find(item=>item.id===cardId);const ability=parseCardAbilitiesCached(card).find(item=>item.definition?.source?.patternId==="auto-own-attack-vanguard-power-battle-v1");assert.ok(ability);assert.equal(ability.trigger?.eventType,"unit.attacked");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.targetLocation,"vanguard");assert.equal(ability.conditionStatus,"no-explicit-condition-detected");assert.deepEqual(ability.definition.effects,[{op:"modify-power",target:"source",amount:Number(ability.definition.printedText.match(/power \+(\d+)/i)?.[1]),duration:"battle"}]);}
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all real G-Guardian discard AUTO variants preserve their exact payment reason",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const {parseCardAbilitiesCached,createGameEvent,eventMatchesAbilityTrigger}=require("./ability-engine.js");let matches=0;
 for(const card of loadCatalog())for(const parsed of parseCardAbilitiesCached(card)){if(!/discarded for the cost of calling a G guardian/i.test(parsed.raw))continue;matches++;assert.equal(parsed.trigger?.eventType,"card.discarded",card.id);assert.equal(parsed.trigger?.discardReason,"g-guardian-cost",card.id);assert.equal(parsed.trigger?.sourceLocation,"hand",card.id);assert.equal(parsed.definition?.source?.patternId,"auto-g-guardian-discard-bind-heal-charge-choice-v1",card.id);assert.equal(parsed.costStatus,"supported-cost",card.id);const ability={...parsed,conditionStatus:"modeled",costStatus:"no-cost"},uid=card.id+"-instance",eventFor=reason=>createGameEvent({matchId:"catalog-g-guard",eventSequence:0},{type:"card.discarded",actingPlayerId:"owner",sourceCardInstanceId:uid,sourceOwnerPlayerId:"owner",sourceControllerPlayerId:"owner",subjectCardInstanceId:uid,subjectOwnerPlayerId:"owner",subjectControllerPlayerId:"owner",previousLocation:"hand",currentLocation:"drop",discardReason:reason});assert.equal(eventMatchesAbilityTrigger(ability,"discard",eventFor("stride-cost"),uid,"hand","hand","owner"),false,card.id);assert.equal(eventMatchesAbilityTrigger(ability,"discard",eventFor("g-guardian-cost"),uid,"hand","hand","owner"),true,card.id)}
 assert.equal(matches,39);
});

test("all 15 clan-conditioned attack-hit draw abilities share the strict paid-draw compiler",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["auto-own-attack-hit-counter-blast-draw-v1"],15);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="auto-own-attack-hit-counter-blast-draw-v1")continue;
  matches.push({card,ability});
  assert.ok(engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.source.patternId==="auto-own-attack-hit-counter-blast-draw-v1"),card.id);
  assert.equal(ability.trigger?.eventType,"attack.hit",card.id);
  assert.equal(ability.trigger?.subject,"source",card.id);
  assert.deepEqual(ability.requiredLocation,ability.raw.startsWith("[VC]:")?["vanguard"]:ability.raw.startsWith("[RC]:")?["rear-guard"]:["vanguard","rear-guard"],card.id);
  assert.deepEqual(ability.costs,[{type:"counter-blast",count:2}],card.id);
  const clan=ability.raw.match(/[«<]([^»>]+)[»>] vanguard/i)?.[1];
  assert.ok(clan,card.id);
  assert.deepEqual(ability.conditions,[{type:"controller-vanguard-has-clan",value:clan}],card.id);
  assert.equal(engine.evaluateAbilityConditions(ability,{vanguardClan:clan}),true,card.id);
  assert.equal(engine.evaluateAbilityConditions(ability,{vanguardClan:"Unrelated Clan"}),false,card.id);
  assert.deepEqual(ability.definition.effects,[{op:"draw",count:1}],card.id);
  assert.equal(ability.canDecline,true,card.id);
 }
 assert.equal(matches.length,15);
 const sample=matches[0],uid=`${sample.card.id}:copy-a`,event=engine.createGameEvent({matchId:"attack-hit-family"},{type:"attack.hit",actingPlayerId:"p1",sourceCardInstanceId:uid,sourceControllerPlayerId:"p1",targetLocation:"vanguard",battleId:"battle-a"});
 assert.equal(engine.eventMatchesAbilityTrigger(sample.ability,"hit",event,uid,"vanguard","vanguard","p1"),true);
 assert.equal(engine.eventMatchesAbilityTrigger(sample.ability,"hit",event,uid,"rear-left","rear-left","p1"),true);
 assert.equal(engine.eventMatchesAbilityTrigger(sample.ability,"hit",event,`${sample.card.id}:copy-b`,"vanguard","vanguard","p1"),false);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all eight exact clan-conditioned VC-or-RC Soul Charge AUTO abilities remain instance scoped",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["auto-vanguard-or-rearguard-placement-clan-soul-charge-v1"],8);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="auto-vanguard-or-rearguard-placement-clan-soul-charge-v1")continue;
  matches.push({card,ability});
  assert.ok(engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.source.patternId==="auto-vanguard-or-rearguard-placement-clan-soul-charge-v1"),card.id);
  assert.deepEqual(ability.trigger?.circles,["vanguard","rear-guard"],card.id);
  assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"],card.id);
  assert.equal(ability.trigger?.eventType,"card.placed",card.id);
  assert.equal(ability.trigger?.subject,"source",card.id);
  const clan=ability.raw.match(/[«<]([^»>]+)[»>] vanguard/i)?.[1];
  assert.ok(clan,card.id);
  assert.deepEqual(ability.conditions,[{type:"controller-vanguard-has-clan",value:clan}],card.id);
  assert.equal(engine.evaluateAbilityConditions(ability,{vanguardClan:clan}),true,card.id);
  assert.equal(engine.evaluateAbilityConditions(ability,{vanguardClan:"Unrelated Clan"}),false,card.id);
  assert.deepEqual(ability.definition.effects,[{op:"soul-charge",count:1}],card.id);
  assert.equal(ability.choiceStatus,"modeled",card.id);
  assert.equal(ability.canDecline,true,card.id);
 }
 assert.equal(matches.length,8);
 const sample=matches[0],uid=`${sample.card.id}:copy-a`,event=engine.createGameEvent({matchId:"placement-soul-charge"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:uid,sourceControllerPlayerId:"p1",subjectCardInstanceId:uid,previousLocation:"hand",currentLocation:"vanguard"});
 assert.equal(engine.eventMatchesAbilityTrigger(sample.ability,"place",event,uid,"vanguard","vanguard","p1"),true);
 assert.equal(engine.eventMatchesAbilityTrigger(sample.ability,"place",event,`${sample.card.id}:copy-b`,"vanguard","vanguard","p1"),false);
 assert.equal(engine.eventMatchesAbilityTrigger(sample.ability,"place",{...event,currentLocation:"guardian"},uid,"vanguard","guardian","p1"),false);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all thirty optional source-to-soul power ACT abilities preserve target optionality and filters",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["act-source-to-soul-optional-up-to-one-friendly-power-v1"],30);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="act-source-to-soul-optional-up-to-one-friendly-power-v1")continue;
  matches.push({card,ability});
  assert.ok(engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.source.patternId==="act-source-to-soul-optional-up-to-one-friendly-power-v1"),card.id);
  assert.deepEqual(ability.requiredLocation,["rear-guard"],card.id);
  assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}],card.id);
  assert.equal(ability.choiceStatus,"modeled",card.id);
  const effect=ability.definition.effects[0];
  assert.equal(effect.op,"modify-power-target",card.id);
  assert.equal(effect.optionalTarget,true,card.id);
  assert.equal(effect.duration,"turn",card.id);
  assert.equal(Number.isInteger(effect.amount)&&effect.amount>0,true,card.id);
  assert.equal(effect.targetFilter.controller,"source-controller",card.id);
  assert.equal(effect.targetFilter.excludeSource,true,card.id);
 }
 assert.equal(matches.length,30);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all twenty-six named Vanguard CONT power abilities enforce their printed turn and name, plus grade where stated",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["cont-rc-own-turn-named-grade-vanguard-power-v1"],26);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="cont-rc-own-turn-named-grade-vanguard-power-v1")continue;
  matches.push({card,ability});
  assert.ok(engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.source.patternId==="cont-rc-own-turn-named-grade-vanguard-power-v1"),card.id);
  assert.deepEqual(ability.requiredLocation,["rear-guard"],card.id);
  const condition=ability.definition.effects[0].condition;
  assert.equal(condition.op,"all",card.id);
  const operators=condition.conditions.map(item=>item.op),nameCondition=condition.conditions.find(item=>item.op==="controller-vanguard-card-name-contains"),gradeCondition=condition.conditions.find(item=>item.op==="controller-vanguard-grade-at-least");
  assert.deepEqual(operators,gradeCondition?["controller-turn","controller-vanguard-grade-at-least","controller-vanguard-card-name-contains"]:["controller-turn","controller-vanguard-card-name-contains"],card.id);
  const amount=ability.definition.effects[0].amount,name=nameCondition.name,grade=gradeCondition?.grade??0;
  const applicable=context=>engine.evaluateContinuousEffects([ability],{...context,location:"rear-guard",sourceInstanceId:"source",targetInstanceId:"source"}).power;
  assert.equal(applicable({isControllerTurn:true,controllerVanguardGrade:grade,controllerVanguardCardNames:[`Prefix ${name} Suffix`]}),amount,card.id);
  assert.equal(applicable({isControllerTurn:false,controllerVanguardGrade:grade,controllerVanguardCardNames:[name]}),0,card.id);
  if(gradeCondition)assert.equal(applicable({isControllerTurn:true,controllerVanguardGrade:grade-1,controllerVanguardCardNames:[name]}),0,card.id);
  assert.equal(applicable({isControllerTurn:true,controllerVanguardGrade:grade,controllerVanguardCardNames:["Unrelated Vanguard"]}),0,card.id);
 }
 assert.equal(matches.length,26);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("all twelve named-and-grade Guardian CONT shield abilities require the exact circle and both predicates",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["cont-gc-named-grade-vanguard-shield-v1"],12);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="cont-gc-named-grade-vanguard-shield-v1")continue;
  matches.push({card,ability});
  assert.ok(engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.source.patternId==="cont-gc-named-grade-vanguard-shield-v1"),card.id);
  assert.deepEqual(ability.requiredLocation,["guardian"],card.id);
  const effect=ability.definition.effects[0],condition=effect.condition,grade=condition.conditions.find(item=>item.op==="controller-vanguard-grade-at-least").grade,name=condition.conditions.find(item=>item.op==="controller-vanguard-card-name-contains").name;
  const evaluate=(location,controllerVanguardGrade,controllerVanguardCardNames)=>engine.evaluateContinuousShieldEffects([ability],{location,controllerVanguardGrade,controllerVanguardCardNames}).shield;
  assert.equal(evaluate("guardian",grade,[name]),effect.amount,card.id);
  assert.equal(evaluate("guardian",grade-1,[name]),0,card.id);
  assert.equal(evaluate("guardian",grade,["Unrelated Vanguard"]),0,card.id);
  assert.equal(evaluate("rear-guard",grade,[name]),0,card.id);
 }
 assert.equal(matches.length,12);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("named-Vanguard Guardian CONT shield batch preserves exact name, circle, and amount for all nine catalog cards",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["cont-gc-named-vanguard-shield-v1"],9);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="cont-gc-named-vanguard-shield-v1")continue;
  matches.push({card,ability});
  assert.ok(engine.getReviewedAbilityDefinitionsForCard(card.id).some(definition=>definition.id===ability.id&&definition.source.patternId==="cont-gc-named-vanguard-shield-v1"),card.id);
  assert.deepEqual(ability.requiredLocation,["guardian"],card.id);
  const effect=ability.definition.effects[0],name=effect.condition.name;
  assert.equal(engine.evaluateContinuousShieldEffects([ability],{location:"guardian",controllerVanguardCardNames:[`Example ${name} Vanguard`]}).shield,effect.amount,card.id);
  assert.equal(engine.evaluateContinuousShieldEffects([ability],{location:"guardian",controllerVanguardCardNames:["Unrelated Vanguard"]}).shield,0,card.id);
  assert.equal(engine.evaluateContinuousShieldEffects([ability],{location:"rear-guard",controllerVanguardCardNames:[`Example ${name} Vanguard`]}).shield,0,card.id);
 }
 assert.equal(matches.length,9);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("non-clan VC/RC CONT power penalty compiles all eleven exact catalog abilities and checks only controller field clans",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["cont-vc-rc-non-clan-field-power-penalty-v1"],11);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="cont-vc-rc-non-clan-field-power-penalty-v1")continue;
  matches.push({card,ability});assert.equal(ability.conditionStatus,"modeled",card.id);assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"],card.id);
  const effect=ability.definition.effects[0],clan=effect.condition.clan,context={controllerFieldCards:[{uid:"matching-vanguard",clans:[clan]},{uid:"source",clans:[card.clan]}]};
  assert.equal(engine.evaluateContinuousEffects([ability],{...context,location:"rear-guard",sourceInstanceId:"source",targetInstanceId:"source"}).power,0,card.id);
  assert.equal(engine.evaluateContinuousEffects([ability],{...context,location:"vanguard",sourceInstanceId:"source",targetInstanceId:"source",controllerFieldCards:[...context.controllerFieldCards,{uid:"different-clan-rear",clans:["Unrelated Clan"]}]}).power,-2000,card.id);
  assert.equal(engine.evaluateContinuousEffects([ability],{...context,location:"guardian",sourceInstanceId:"source",targetInstanceId:"source",controllerFieldCards:[{uid:"foreign",clans:["Unrelated Clan"]}]}).power,0,card.id);
  assert.equal(engine.evaluateContinuousEffects([ability],{...context,location:"rear-guard",sourceInstanceId:"source",targetInstanceId:"source",controllerFieldCards:[{uid:"ambiguous",clans:[clan,"Unrelated Clan"]}]}).power,0,card.id);
 }
 assert.equal(matches.length,11);
 assert.deepEqual(report.invalidCompiled,[]);
});

test("six named-grade dual-circle CONT abilities keep RC power and GC shield in separate legal locations",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["cont-rc-gc-named-grade-vanguard-power-shield-v1"],6);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="cont-rc-gc-named-grade-vanguard-power-shield-v1")continue;
  matches.push({card,ability});assert.equal(ability.conditionStatus,"modeled",card.id);assert.deepEqual(ability.requiredLocation,["rear-guard","guardian"],card.id);
  const [power,shield]=ability.effects,name=power.condition.conditions.find(item=>item.op==="controller-vanguard-card-name-contains").name,grade=power.condition.conditions.find(item=>item.op==="controller-vanguard-grade-at-least").grade;
  assert.equal(engine.evaluateContinuousEffects([ability],{location:"rear-guard",controllerVanguardGrade:grade,controllerVanguardCardNames:[`Vanguard ${name}`],sourceInstanceId:"source",targetInstanceId:"source"}).power,power.amount,card.id);
  assert.equal(engine.evaluateContinuousEffects([ability],{location:"rear-guard",controllerVanguardGrade:grade-1,controllerVanguardCardNames:[`Vanguard ${name}`],sourceInstanceId:"source",targetInstanceId:"source"}).power,0,card.id);
  assert.equal(engine.evaluateContinuousEffects([ability],{location:"rear-guard",controllerVanguardGrade:grade,controllerVanguardCardNames:["Unrelated Vanguard"],sourceInstanceId:"source",targetInstanceId:"source"}).power,0,card.id);
  assert.equal(engine.evaluateContinuousShieldEffects([ability],{location:"guardian",controllerVanguardGrade:grade,controllerVanguardCardNames:[`Vanguard ${name}`]}).shield,shield.amount,card.id);
  assert.equal(engine.evaluateContinuousShieldEffects([ability],{location:"guardian",controllerVanguardGrade:grade-1,controllerVanguardCardNames:[`Vanguard ${name}`]}).shield,0,card.id);
 }
 assert.equal(matches.length,6);assert.deepEqual(report.invalidCompiled,[]);
});

test("optional clan-rider call AUTO matches the exact ridden source and rider clan across fourteen records",()=>{
 const cards=loadCatalog(),report=auditCatalog(cards),matches=[];
 assert.equal(report.patterns["auto-ridden-unit-clan-optional-source-call-v1"],14);
 for(const card of cards)for(const ability of engine.parseCardAbilitiesCached(card)){
  if(ability.definition?.source?.patternId!=="auto-ridden-unit-clan-optional-source-call-v1")continue;
  matches.push({card,ability});assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"card.ridden",subject:"ridden-unit",circles:[],riderClan:ability.trigger.riderClan},card.id);
  assert.equal(ability.canDecline,true,card.id);assert.equal(ability.choiceStatus,"modeled",card.id);
  assert.deepEqual(ability.definition.effects,[{op:"call-source-from-soul",target:"source",position:"stand"}],card.id);
  const event=engine.createGameEvent({matchId:"rider-clan"},{type:"card.ridden",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"rider",sourceCardClan:ability.trigger.riderClan,subjectCardInstanceId:"rider",targetCardInstanceIds:["ridden-source"],targetPreviousLocation:"vanguard",targetLocation:"vanguard"});
  assert.equal(engine.eventMatchesAbilityTrigger(ability,"ride",event,"ridden-source","vanguard","vanguard","p1"),true,card.id);
  assert.equal(engine.eventMatchesAbilityTrigger(ability,"ride",{...event,targetCardInstanceIds:["other-source"]},"ridden-source","vanguard","vanguard","p1"),false,card.id);
  assert.equal(engine.eventMatchesAbilityTrigger(ability,"ride",{...event,sourceCardClan:"Wrong Clan",sourceCardClans:[]},"ridden-source","vanguard","vanguard","p1"),false,card.id);
 }
 assert.equal(matches.length,14);assert.deepEqual(report.invalidCompiled,[]);
});

test("unsupported ability similarity queue groups for review without merging source text or ability types",()=>{
 const {buildUnsupportedPatternQueue}=require("./scripts/unsupported-ability-patterns.js");
 const cards=[
  {id:"queue-auto-a",text:'AUTO [RC]: When this unit attacks, if your vanguard is Legion, this unit gets power +1000 until end of that battle.'},
  {id:"queue-auto-b",text:'AUTO [RC]: When this unit attacks, if your vanguard is Legion, this unit gets power +1000 until end of that battle.'},
  {id:"queue-auto-c",text:'AUTO [RC]: When this unit attacks, if your vanguard is Legion, this unit gets power +5000 until end of that battle.'},
  {id:"queue-act-a",text:'ACT [RC]: When this unit attacks, if your vanguard is Legion, this unit gets power +1000 until end of that battle.'}
 ];
 const queue=buildUnsupportedPatternQueue(cards),auto=queue.groups.find(group=>group.abilityKind==="AUTO"),act=queue.groups.find(group=>group.abilityKind==="ACT");
 assert.equal(queue.metrics.cardsScanned,4);
 assert.equal(queue.metrics.unsupportedAbilityBlocks,4);
 assert.equal(auto.occurrenceCount,3);
 assert.equal(auto.distinctTextVariants,2);
 assert.deepEqual(auto.variants.flatMap(variant=>variant.occurrences.map(item=>item.cardId)).sort(),["queue-auto-a","queue-auto-b","queue-auto-c"]);
 assert.equal(act.occurrenceCount,1);
 assert.match(queue.disclaimer,/review candidates only/i);
});
