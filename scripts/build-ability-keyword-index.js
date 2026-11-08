"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const engine = require("../ability-engine.js");
engine.registerAbilityDefinitions(require("../ability-definitions.js"));
const { loadCatalog } = require("./audit-ability-catalog.js");

// These are literal text cues for triage. They deliberately do not create or
// validate an ability definition; an unmatched or multi-event skill needs review.
const AUTO_EVENT_CUES = Object.freeze([
  { id: "source-placement", event: "card.placed", subject: "source", re: /\bwhen\s+(?:(?:this unit|this card)\s+(?:is placed on|is put on)|placed on)\s+\(?\s*(RC|VC|GC)\s*\)?(?:\s+from\s+(hand|deck|drop|soul|bind zone))?/i },
  { id: "source-placement-shortform", event: "card.placed", subject: "source", re: /\bwhen\s+(?:(?:this unit|this card)\s+is placed(?!\s+on\b)|placed)\b/i },
  { id: "source-intercepts", event: "card.placed", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+intercepts?\b/i },
  { id: "source-rode-upon", event: "card.ridden", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+is\s+(?:rode|ridden)\s+upon\b/i },
  { id: "source-boosts", event: "unit.boosted", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+boosts?(?:\s+a\s+(?:vanguard|rear-guard))?\b/i },
  { id: "source-attacks", event: "unit.attacked", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+attacks?(?:\s+(?:a\s+)?vanguard)?\b/i },
  { id: "source-attack-hits", event: "attack.hit", subject: "source", re: /\bwhen\s+(?:this unit|this card)(?:'s|’s)\s+attack\s+hits?\b/i },
  { id: "unspecified-attack-hits", event: "attack.hit", subject: "unspecified", re: /\bwhen\s+the attack\s+hits?\b/i },
  { id: "source-boosted-attack-hits", event: "attack.hit", subject: "booster", re: /\bwhen\s+(?:an attack hits during the battle that this unit boosted|the attack this unit boosted hits)\b/i },
  { id: "own-drive-check", event: "drive.checked", subject: "controller-check", re: /\bwhen\s+your\s+drive check\s+reveals?\b/i },
  { id: "source-drive-check", event: "drive.checked", subject: "source-check", re: /\bwhen\s+(?:this unit|this card)(?:[’']s)\s+drive check\s+reveals?\b/i },
  { id: "own-damage-check", event: "damage.checked", subject: "controller-check", re: /\bwhen\s+your\s+damage check\s+reveals?\b/i },
  { id: "source-ridden-upon-shortform", event: "card.ridden", subject: "source", re: /\bwhen\s+rode upon\b/i },
  { id: "source-retired", event: "card.retired", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+is retired\b/i },
  { id: "source-discarded", event: "card.discarded", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+is discarded\b/i },
  { id: "source-bound", event: "card.bound", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+is bound\b/i },
  { id: "source-ridden-by-another", event: "card.ridden", subject: "ridden-source", re: /\bwhen\s+(?:another unit(?: from the same clan)?|another [«<][^»>]+[»>]|a card named\s+"[^"]+"|a unit|a [^,.]{1,70})\s+rides this unit\b/i },
  { id: "source-is-boosted", event: "unit.boosted", subject: "boosted-source", re: /\bwhen\s+(?:this unit|this card)\s+is boosted by\b/i },
  { id: "source-becomes-rest", event: "unit.rested", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+becomes rest\b/i },
  { id: "source-becomes-stand", event: "unit.stood", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+becomes stand\b/i },
  { id: "friendly-attack-hits-vanguard", event: "attack.hit", subject: "controller-attacker", re: /\bwhen\s+your\s+(?:vanguard|rear-guards?)(?:[’']s)?\s+attack hits (?:a |the )?vanguard\b/i },
  { id: "source-moved-from-gc-to-drop", event: "card.moved", subject: "source", re: /\bwhen\s+(?:this unit|this card)\s+(?:is moved|is put) from (?:the )?GC to (?:the )?drop zone\b/i },
  { id: "battle-close-step-after-attack", event: "battle.close-step", subject: "attacking-unit", re: /\bat the beginning of the close step of the battle that (?:this unit|your vanguard) attacked\b/i },
  { id: "turn-beginning", event: "phase.changed", subject: "turn-player", re: /\bat the beginning of (?:your|each) turn\b/i },
  { id: "phase-beginning", event: "phase.changed", subject: "turn-player", re: /\bat the beginning of your (?:ride|main|battle|end) phase\b/i }
]);

const RULE_KEYWORD_CUES = Object.freeze([
  ["twin-drive", /\btwin\s+drive\b/i], ["triple-drive", /\btriple\s+drive\b/i],
  ["intercept", /\bintercept\b/i], ["boost", /\bboost\b/i], ["restraint", /\brestraint\b/i],
  ["limit-break", /\blimit\s+break\b/i], ["forerunner", /\bforerunner\b/i], ["lord", /\blord\b/i],
  ["sentinel", /\bsentinel\b/i], ["seek-mate", /\bseek\s+mate\b/i], ["d-seek-mate", /\bd\s*[-–]?\s*seek\s+mate\b/i],
  ["stride-skill", /\bstride\s+skill\b/i], ["ultimate-stride-skill", /\bultimate\s+stride\s+skill\b/i],
  ["generation-break", /\bgeneration\s+break\b|\bG\s*[-–]?\s*break\s*\d/i], ["resist", /\bresist\b/i],
  ["g-guardian", /\bG\s*[-–]?\s*guardian\b/i], ["brave", /\bbrave\b/i], ["oracle", /\boracle\b/i],
  ["rescue", /\brescue\b/i], ["ritual", /\britual\b/i], ["unite", /\bunite\b/i],
  ["revelation", /\brevelation\b/i], ["blaze", /\bblaze\b/i], ["afterimage", /\bafterimage\b/i],
  ["dominate", /\bdominate\b/i], ["engorge", /\bengorge\b/i], ["shadowstitch", /\bshadowstitch\b/i],
  ["thunderstrike", /\bthunderstrike\b/i], ["rush", /\brush\b/i], ["burst", /\bburst\b/i],
  ["charge", /\bcharge\b/i], ["darkness", /\bdarkness\b/i], ["magia", /\bmagia\b/i],
  ["time-leap", /\btime\s+leap\b/i], ["hollow", /\bhollow\b/i], ["harmony", /\bharmony\b/i],
  ["wave", /\bwave\s*[-–]\s*(?:\d|first|second|third)/i], ["dark-device", /\bdark\s+device\b/i],
  ["success", /\bsuccess\s*\d/i], ["bloom", /\bbloom\b/i], ["melody", /\bmelody\b/i],
  ["overdress", /\boverdress\b/i], ["white-wings", /\bwhite\s+wings\b/i], ["black-wings", /\bblack\s+wings\b/i],
  ["dressboost", /\bdress\s*boost\b/i], ["powerful", /\bpowerful\b/i], ["friend", /\bfriend\b/i],
  ["glitter", /\bglitter\b/i], ["revol-dress", /\brevol\s*[-–]?\s*dress\b/i], ["xoverdress", /\bxover\s*[-–]?\s*dress\b/i],
  ["cannonball", /\bcannonball\b/i], ["regalis-piece", /\bregalis\s+piece\b/i], ["dressup", /\bdress\s*up\b/i],
  ["unisondress", /\bunison\s*dress\b/i], ["overcharge", /\bovercharge\b/i], ["malwyrm", /\bmalwyrm\b/i],
  ["ace-unit", /\bace\s+unit\b/i], ["rewrite", /\brewrite\b/i], ["mental-pollution", /\bmental\s+pollution\b/i],
  ["happy-toys", /\bhappy\s+toys\b/i], ["sweetlink", /\bsweet\s*link\b/i]
]);

// Additional literal mechanics used in the card pool but not named as headings
// in the supplied rules excerpt.
const ADDITIONAL_KEYWORD_CUES = Object.freeze([
  ["legion", /\blegion\b/i], ["persona-ride", /\bpersona\s+ride\b|\bpersona\s+rode\b/i],
  ["final-rush", /\bfinal\s+rush\b/i], ["final-burst", /\bfinal\s+burst\b/i],
  ["over-soul", /\bover\s*soul\b/i]
]);
const KEYWORD_MECHANICS = Object.freeze([...RULE_KEYWORD_CUES, ...ADDITIONAL_KEYWORD_CUES]);

const KEYWORD_CUES = Object.freeze({
  costs: [
    ["counter-blast", /\bcounter\s*[- ]?blast\b/i], ["soul-blast", /\bsoul\s*[- ]?blast\b/i],
    ["energy-blast", /\benergy\s*[- ]?blast\b/i], ["energy-charge", /\benergy\s*[- ]?charge\b/i],
    ["discard", /\bdiscard\b/i], ["rest", /\brest this unit\b/i], ["retire", /\bretire this unit\b/i],
    ["move-source", /\bput this unit into (?:your )?(?:soul|drop|bind zone|deck)\b/i]
  ],
  effects: [
    ["draw", /\bdraw\b/i], ["search", /\bsearch\b/i], ["call", /\bcall\b/i], ["ride", /\bride\b/i],
    ["stride", /\bstride\b/i], ["retire", /\bretire\b/i], ["bind", /\bbind\b/i], ["move", /\b(?:put|return|move)\b/i],
    ["power", /\bpower\b/i], ["critical", /\bcritical\b/i], ["stand", /\bstand\b/i], ["lock", /\block\b/i],
    ["soul-charge", /\bsoul\s*[- ]?charge\b/i], ["counter-charge", /\bcounter\s*[- ]?charge\b/i],
    ["reveal", /\breveal\b/i], ["shuffle", /\bshuffle\b/i]
  ],
  requirements: [
    ["if", /\bif\b/i], ["while", /\bwhile\b/i], ["during", /\bduring\b/i],
    ["generation-break", /\bgeneration break\b/i], ["limit-break", /\blimit break\b/i],
    ["grade", /\bgrade\s*\d\b/i], ["card-name", /\bin its card name\b|\bcard named\b/i],
    ["clan-or-nation", /[«<][^»>]+[»>]/]
  ],
  restrictions: [
    ["once-per-turn", /\b(?:1|one)\s*\/\s*turn\b|\bonce per turn\b/i],
    ["once-per-fight", /\bonce per fight\b/i], ["once-per-game", /\bonce per game\b/i]
  ]
});

function unique(values) { return [...new Set(values)]; }

function classifyAutoEvent(text) {
  const matches = [];
  for (const cue of AUTO_EVENT_CUES) {
    const match = cue.re.exec(text);
    if (!match) continue;
    const record = { cue: cue.id, event: cue.event, subject: cue.subject, matchedText: match[0] };
    if (cue.id === "source-placement") {
      record.circle = String(match[1] || "").toLowerCase() || null;
      record.origin = String(match[2] || "").toLowerCase() || null;
    }
    if (cue.id === "source-intercepts") {
      // Intercept means this exact source moves from RC to GC. This is only a
      // literal index cue; it does not establish that the ability is supported.
      record.circle = "guardian";
      record.origin = "rear-guard";
    }
    matches.push({ index: match.index, record });
  }
  matches.sort((a, b) => a.index - b.index || a.record.cue.localeCompare(b.record.cue));
  if (!matches.length) return { status: "unclassified", event: null, candidates: [] };
  if (matches.length > 1) return { status: "ambiguous-multiple-cues", event: null, candidates: matches.map(item => item.record) };
  return { status: "literal-cue", ...matches[0].record, candidates: [] };
}

function extractKeywordTags(text, category) {
  return unique(KEYWORD_CUES[category].filter(([, re]) => re.test(text)).map(([tag]) => tag));
}

function normalizePrintedText(text) {
  return String(text || "").replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim();
}

function exactTextFamilyId(kind, text) {
  return `exact-${crypto.createHash("sha256").update(`${kind || "unknown"}\0${normalizePrintedText(text)}`).digest("hex").slice(0, 16)}`;
}

function extractKeywordMechanics(text) {
  return unique(KEYWORD_MECHANICS.filter(([, re]) => re.test(text)).map(([tag]) => tag));
}

function indexAbility(card, ability, evidenceById = new Map()) {
  const text = normalizePrintedText(ability.raw || ability.printedText || "");
  const header = text.match(/^\s*(?:AUTO|ACT|CONT)?\s*\[([^\]]+)\]/i)?.[1] || "";
  const locationTags = unique((header.match(/\b(?:VC|RC|GC|G zone|soul|drop|hand|deck|damage|bind zone|order zone|trigger zone|ride deck)\b/gi) || []).map(item => item.toLowerCase()));
  const record = {
    cardId: String(card.id || ""), abilityId: String(ability.id || ""), kind: ability.kind || "unknown",
    printedText: text, locationTags,
    trigger: ability.kind === "AUTO" ? classifyAutoEvent(text) : null,
    costTags: extractKeywordTags(text, "costs"), effectTags: extractKeywordTags(text, "effects"),
    requirementTags: extractKeywordTags(text, "requirements"), restrictionTags: extractKeywordTags(text, "restrictions"),
    keywordMechanics: extractKeywordMechanics(text),
    exactTextFamilyId: exactTextFamilyId(ability.kind, text),
    compiled: Boolean(ability.definition), mechanicGroup: ability.definition?.source?.patternId || null,
    evidenceStatus: evidenceById.get(ability.id)?.status || "none"
  };
  record.reviewState = record.compiled ? (record.evidenceStatus === "fully-verified" ? "fully-verified" : record.evidenceStatus === "tests-passing" ? "tests-passing" : "compiled-unverified") : "unsupported-or-unreviewed";
  return record;
}

function buildAbilityKeywordIndex(cards, manifest = { records: [] }, parseAbilities = engine.parseCardAbilitiesCached) {
  if (!Array.isArray(cards)) throw new TypeError("A catalog card array is required.");
  const evidenceById = new Map((Array.isArray(manifest?.records) ? manifest.records : []).map(record => [record.abilityId, record]));
  const records = cards.flatMap(card => parseAbilities(card).map(ability => indexAbility(card, ability, evidenceById)));
  const groups = new Map(), keywordGroups = new Map(), exactTextGroups = new Map();
  const add = (map, key, record) => { const group = map.get(key) || []; group.push(record); map.set(key, group); };
  for (const record of records) {
    const cueKey = record.kind !== "AUTO" ? "not-auto"
      : record.trigger.status === "literal-cue"
        ? [record.trigger.cue, record.trigger.event, record.trigger.subject, record.trigger.circle || "", record.trigger.origin || ""].join("|")
        : record.trigger.status;
    if (record.kind === "AUTO") add(groups, cueKey, record);
    const keywordKey = [record.kind, cueKey, `cost:${record.costTags.slice().sort().join(",") || "none"}`, `effect:${record.effectTags.slice().sort().join(",") || "none"}`, `requirement:${record.requirementTags.slice().sort().join(",") || "none"}`, `restriction:${record.restrictionTags.slice().sort().join(",") || "none"}`].join("|");
    record.keywordFamily = keywordKey;
    add(keywordGroups, keywordKey, record);
    add(exactTextGroups, record.exactTextFamilyId, record);
  }
  const summarizeGroups = map => [...map].map(([key, items]) => ({
    key, abilityCount: items.length, compiled: items.filter(item => item.compiled).length,
    unsupportedOrUnreviewed: items.filter(item => !item.compiled).length,
    passingAbilityEvidence: items.filter(item => ["tests-passing", "fully-verified"].includes(item.evidenceStatus)).length,
    abilityIds: items.map(item => item.abilityId).sort()
  })).sort((a, b) => b.unsupportedOrUnreviewed - a.unsupportedOrUnreviewed || b.abilityCount - a.abilityCount || a.key.localeCompare(b.key));
  const triggerGroups = summarizeGroups(groups);
  const keywordMechanicGroups = summarizeGroups(keywordGroups);
  const keywordMechanicCoverage = KEYWORD_MECHANICS.map(([keyword]) => {
    const selected = records.filter(record => record.keywordMechanics.includes(keyword));
    return {
      keyword, abilityCount: selected.length,
      compiled: selected.filter(record => record.compiled).length,
      unsupportedOrUnreviewed: selected.filter(record => !record.compiled).length,
      passingAbilityEvidence: selected.filter(record => ["tests-passing", "fully-verified"].includes(record.evidenceStatus)).length,
      fullyVerified: selected.filter(record => record.evidenceStatus === "fully-verified").length
    };
  }).sort((a, b) => b.unsupportedOrUnreviewed - a.unsupportedOrUnreviewed || b.abilityCount - a.abilityCount || a.keyword.localeCompare(b.keyword));
  const identicalPrintedTextGroups = [...exactTextGroups].filter(([, items]) => items.length > 1).map(([familyId, items]) => ({
    familyId, kind: items[0].kind, printedText: items[0].printedText,
    abilityCount: items.length, cardCount: new Set(items.map(item => item.cardId)).size,
    compiled: items.filter(item => item.compiled).length,
    unsupportedOrUnreviewed: items.filter(item => !item.compiled).length,
    passingAbilityEvidence: items.filter(item => ["tests-passing", "fully-verified"].includes(item.evidenceStatus)).length,
    abilityIds: items.map(item => item.abilityId).sort()
  })).sort((a, b) => b.unsupportedOrUnreviewed - a.unsupportedOrUnreviewed || b.abilityCount - a.abilityCount || a.familyId.localeCompare(b.familyId));
  const byKind = Object.fromEntries(["AUTO", "ACT", "CONT", "unknown"].map(kind => {
    const selected = records.filter(item => item.kind === kind);
    return [kind, {
      abilities: selected.length, compiled: selected.filter(item => item.compiled).length,
      unsupportedOrUnreviewed: selected.filter(item => !item.compiled).length,
      withLiteralRequirements: selected.filter(item => item.requirementTags.length).length,
      withCosts: selected.filter(item => item.costTags.length).length,
      withRestrictions: selected.filter(item => item.restrictionTags.length).length
    }];
  }));
  const auto = records.filter(item => item.kind === "AUTO");
  return {
    schemaVersion: 1,
    purpose: "Literal-keyword triage only. This index does not prove card text, rules interpretation, eligibility, resolution, or verification.",
    generatedAt: new Date().toISOString(),
    cards: cards.length, abilityBlocks: records.length, byKind,
    autoTriggerCueStatus: {
      literalSingleCue: auto.filter(item => item.trigger.status === "literal-cue").length,
      ambiguousMultipleCues: auto.filter(item => item.trigger.status === "ambiguous-multiple-cues").length,
      unclassified: auto.filter(item => item.trigger.status === "unclassified").length
    },
    ruleKeywordCueCount: RULE_KEYWORD_CUES.length,
    keywordMechanicCoverage, triggerGroups, keywordMechanicGroups, identicalPrintedTextGroups, records
  };
}

function main(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "card-verification-manifest.json"), "utf8"));
  const index = buildAbilityKeywordIndex(loadCatalog(root), manifest);
  const outputIndex = argv.indexOf("--output");
  const destination = path.resolve(root, outputIndex >= 0 ? argv[outputIndex + 1] || ".card-pipeline/ability-keyword-index.json" : ".card-pipeline/ability-keyword-index.json");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(index, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, destination);
  const summarize = groups => groups.slice(0, 20).map(({ key, abilityCount, compiled, unsupportedOrUnreviewed, passingAbilityEvidence }) => ({ key, abilityCount, compiled, unsupportedOrUnreviewed, passingAbilityEvidence }));
  const summarizeExact = groups => groups.slice(0, 20).map(({ familyId, kind, abilityCount, cardCount, compiled, unsupportedOrUnreviewed, passingAbilityEvidence, abilityIds }) => ({ familyId, kind, abilityCount, cardCount, compiled, unsupportedOrUnreviewed, passingAbilityEvidence, abilityIds }));
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, destination), cards: index.cards, abilityBlocks: index.abilityBlocks, byKind: index.byKind, autoTriggerCueStatus: index.autoTriggerCueStatus, ruleKeywordCueCount: index.ruleKeywordCueCount, topKeywordCoverage: index.keywordMechanicCoverage.slice(0, 20), topTriggerGroups: summarize(index.triggerGroups), topKeywordMechanicGroups: summarize(index.keywordMechanicGroups), identicalPrintedTextFamilyCount: index.identicalPrintedTextGroups.length, duplicatedAbilityCount: index.identicalPrintedTextGroups.reduce((total, group) => total + group.abilityCount, 0), topIdenticalPrintedTextFamilies: summarizeExact(index.identicalPrintedTextGroups) }, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { AUTO_EVENT_CUES, RULE_KEYWORD_CUES, ADDITIONAL_KEYWORD_CUES, KEYWORD_MECHANICS, classifyAutoEvent, extractKeywordTags, extractKeywordMechanics, normalizePrintedText, exactTextFamilyId, indexAbility, buildAbilityKeywordIndex };
