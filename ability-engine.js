/* Shared ability-definition boundary. Runtime game rules are added in stages. */
(function attachAbilityEngine(root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.VanguardAbilityEngine = engine;
})(typeof globalThis === "undefined" ? this : globalThis, function createAbilityEngine() {
  /**
   * @typedef {object} AbilityDefinition
   * @property {string} id Stable definition ID for this printed ability.
   * @property {string} cardId Card definition ID; the owning in-game instance is separate.
   * @property {"AUTO"|"ACT"|"CONT"} kind Printed ability category.
   * @property {string} raw Original ability text, preserved verbatim after the label.
   * @property {number} gb Parsed Generation Break threshold, or zero.
   * @property {boolean} once Whether this text includes a once-per-turn phrase.
   * @property {"unreviewed"} implementationStatus Needs structured rules validation before being called fully supported.
   */
  const abilityDefinitions = new Map();
  function createCardInstance(cardId, ownerPlayerId, uid = null) {
    if (cardId === undefined || cardId === null || !ownerPlayerId) throw new TypeError("Card instances require a definition ID and owner player ID.");
    return { uid: uid || `${cardId}-${Math.random().toString(36).slice(2, 11)}`, cardId, ownerPlayerId, controllerPlayerId: ownerPlayerId };
  }
  const effectOperations = new Set(["draw", "modify-power", "modify-critical", "modify-drive", "counter-charge", "soul-charge", "rest-source", "stand-source"]);
  const EFFECT_HANDLERS = Object.freeze({
    "modify-power": Object.freeze({
      validate(step, context) { return step.target === "source" && Number.isFinite(Number(step.amount)) && Number(step.amount) > 0 && step.duration === "turn" && context?.sourceInPlay === true && Boolean(context?.source); },
      apply(step, context) {
        context.source.turnPowerBoost = Number(context.source.turnPowerBoost || 0) + Number(step.amount);
        context.source.turnPowerExpiry = context.side;
        if (context.match?.pendingAttack?.attackerUid === context.source.uid) context.match.pendingAttack.power += Number(step.amount);
        return true;
      }
    })
  });
  function normalizePrintedText(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function registerAbilityDefinitions(definitions) {
    if (!Array.isArray(definitions)) throw new TypeError("Ability definitions must be an array.");
    for (const definition of definitions) {
      if (!definition?.id || !definition.cardId || !definition.kind || !definition.printedText || !Array.isArray(definition.effects) || !definition.effects.length) throw new TypeError("A reviewed ability definition is incomplete.");
      if (definition.effects.some(effect => {
        if (!effectOperations.has(effect.op)) return true;
        if (effect.op === "modify-power") return effect.target !== "source" || !Number.isInteger(Number(effect.amount)) || Number(effect.amount) <= 0 || effect.duration !== "turn";
        return false;
      })) throw new TypeError("An ability definition contains an unsupported or invalid effect operation.");
      const prior = abilityDefinitions.get(definition.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(definition)) throw new Error("Conflicting ability definition: " + definition.id);
      abilityDefinitions.set(definition.id, Object.freeze(JSON.parse(JSON.stringify(definition))));
    }
    return abilityDefinitions.size;
  }
  function getAbilityDefinition(id, printedText) {
    const definition = abilityDefinitions.get(id);
    return definition && normalizePrintedText(definition.printedText) === normalizePrintedText(printedText) ? definition : null;
  }
  function validateEffectProgram(program, handlers, context = {}) {
    if (!Array.isArray(program) || !program.length) return { ok: false, reason: "empty-effect-program" };
    for (let index = 0; index < program.length; index++) {
      const step = program[index], handler = handlers?.[step?.op];
      if (!step || !effectOperations.has(step.op) || !handler || typeof handler.validate !== "function" || typeof handler.apply !== "function") return { ok: false, reason: "unsupported-effect", index };
      let valid = false;
      try { valid = handler.validate(step, context) === true; } catch { valid = false; }
      if (!valid) return { ok: false, reason: "invalid-effect", index };
    }
    return { ok: true };
  }
  function resolveEffectProgram(program, handlers, context = {}) {
    const validation = validateEffectProgram(program, handlers, context);
    if (!validation.ok) return { ...validation, applied: 0 };
    const results = [];
    try {
      for (const step of program) results.push(handlers[step.op].apply(step, context));
    } catch {
      return { ok: false, reason: "effect-handler-failed", applied: results.length, results };
    }
    return { ok: true, applied: results.length, results };
  }
  function parseAbilityLocation(raw) {
    const header=String(raw||"").match(/^(?:\(([^)]*)\)|\[([^\]]*)\])\s*:?\s*/);
    if(!header)return [];
    const text=(header[1]||header[2]).toLowerCase(),locations=[];
    if(/\bvc\b|vanguard/.test(text))locations.push("vanguard");
    if(/\brc\b|rear[- ]guard/.test(text))locations.push("rear-guard");
    if(/\bgc\b|guardian/.test(text))locations.push("guardian");
    if(/\bsc\b|soul/.test(text))locations.push("soul");
    return locations;
  }
  function compileAutoTrigger(raw) {
    const text=String(raw||"").replace(/^(?:\([^)]*\)|\[[^\]]*\])\s*:?\s*/,"").replace(/^(?:\[[^\]]+\]\s*)+/,"");
    const result=(eventType,subject,circles=[])=>({status:"recognized-trigger",eventType,subject,circles});
    if(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+attacks?\b/i.test(text))return result("unit.attacked","source");
    if(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\b/i.test(text))return result("unit.boosted","source");
    if(/\bforerunner\b[^.]*\bwhen another unit[^.]*rides this unit\b/i.test(text))return result("card.ridden","event-subject");
    if(/\bwhen(?:ever)?\s+(?:an|the) attack hits?[^.]*\bthis unit boosted\b/i.test(text))return result("attack.hit","booster");
    if(/\bwhen(?:ever)?\s+(?:this unit|this card)(?:\x27s)? attack hits?\b|\bwhen(?:ever)?\s+(?:this unit|this card) hits?\b/i.test(text))return result("attack.hit","source");
    if(/\bwhen(?:ever)?\s+(?:another unit|a unit)\s+(?:is\s+)?placed\s+on\s+\(?\s*VC\b[^.]*\bby riding this unit\b/i.test(text)||/\bwhen(?:ever)?\s+this unit\s+(?:is\s+)?(?:rode|ridden) upon\b/i.test(text))return result("card.ridden","event-subject",["vanguard"]);
    const placement=text.match(/\bwhen(?:ever)?\s+(this unit|this card|your vanguard|another unit|a unit|any unit)\s+(?:is\s+)?(?:placed|called)\s+(?:on|onto)\s+([^,.;]+)/i);
    if(placement){const place=placement[2],circles=[];if(/\bVC\b|vanguard circle/i.test(place))circles.push("vanguard");if(/\bRC\b|rear[- ]guard circle/i.test(place))circles.push("rear-guard");if(circles.length){const subject=/^this (?:unit|card)$/i.test(placement[1])?"source":/^your vanguard$/i.test(placement[1])?"vanguard":"any";return result("card.placed",subject,circles)}}
    return {status:"needs-review",eventType:null,subject:null,circles:[]};
  }
  function parseAbilityCosts(raw) {
    const text = String(raw || "");
    const explicit = [...text.matchAll(/\bCOST\s*\[([^\]]+)\]|\[((?:CB|SB|Counter[- ]Blast|Soul[- ]Blast|discard|rest this unit)[^\]]*)\]/gi)];
    const mentionsCost = /\bCOST\b|\b(?:CB|SB|Counter[- ]Blast|Soul[- ]Blast|discard|rest this unit|put this unit into your soul)\b/i.test(text);
    if (!explicit.length) return { status: mentionsCost ? "needs-review" : "no-cost", costs: [] };
    const clause = explicit.map(match => match[1] || match[2]).join(" & ");
    const costs = [];
    const patterns = [
      ["counter-blast", /(?:CB|Counter[- ]Blast)\s*\(?\s*(\d+)/gi],
      ["soul-blast", /(?:SB|Soul[- ]Blast)\s*\(?\s*(\d+)/gi],
      ["discard", /discard(?:ing)?\s+(?:a|one|(\d+))\s+cards?(?:\s+from\s+(?:your\s+)?hand)?/gi]
    ];
    let remainder = clause;
    for (const [type, pattern] of patterns) {
      for (const match of clause.matchAll(pattern)) costs.push({ type, count: Number(match[1] || 1) });
      remainder = remainder.replace(pattern, " ");
    }
    if (/rest this unit/i.test(remainder)) { costs.push({ type: "rest-source", count: 1 }); remainder = remainder.replace(/rest this unit/i, " "); }
    const residue = remainder.replace(/[\s&+(),.;:[\]0-9-]/g, "").toLowerCase();
    if (residue || !costs.length) return { status: "needs-review", costs: [] };
    return { status: "supported-cost", costs };
  }
  function canPayAbilityCosts(ability, resources = {}) {
    if (!ability || ability.costStatus === "needs-review") return false;
    const costs = ability.costs || [];
    for (const cost of costs) {
      if (cost.type === "counter-blast" && Number(resources.faceUpDamage || 0) < cost.count) return false;
      if (cost.type === "soul-blast" && Number(resources.soulCount || 0) < cost.count) return false;
      if (cost.type === "discard" && Number(resources.discardableHand || 0) < cost.count) return false;
      if (cost.type === "rest-source" && resources.sourceRested) return false;
    }
    return true;
  }
  function parseAbilityConditions(raw) {
    let remaining = String(raw || "").replace(/\bif you do\b/gi, " ");
    const conditions = [];
    const patterns = [
      [/\bif your opponent has no rear[- ]guards?\b/i, { type: "opponent-has-no-rear-guards" }],
      [/\bif you have no rear[- ]guards?\b/i, { type: "controller-has-no-rear-guards" }],
      [/\bif you have an? <([^>]+)> vanguard\b/i, null],
      [/\bif (?:this unit|this card) (?:was|is) boosted\b/i, { type: "source-was-boosted" }],
      [/\bif (?:this unit|it) attacks? a vanguard\b/i, { type: "attack-target-location", location: "vanguard" }]
    ];
    for (const [pattern, definition] of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      for (const match of [...remaining.matchAll(regex)]) {
        conditions.push(definition ? { ...definition } : { type: "controller-vanguard-has-clan", value: match[1] });
        remaining = remaining.replace(match[0], " ");
      }
    }
    return { conditions, status: /\b(?:if|unless|while)\b/i.test(remaining) ? "needs-review" : "modeled" };
  }
  function evaluateAbilityConditions(ability, context = {}) {
    if (!ability || ability.conditionStatus === "needs-review") return false;
    for (const condition of ability.conditions || []) {
      if (condition.type === "controller-has-no-rear-guards" && Number(context.controllerRearGuards || 0) !== 0) return false;
      if (condition.type === "opponent-has-no-rear-guards" && Number(context.opponentRearGuards || 0) !== 0) return false;
      if (condition.type === "controller-vanguard-has-clan") {
        const clan = String(condition.value || "").toLowerCase();
        const names = [context.vanguardClan, ...(context.vanguardClans || []), context.vanguardText].filter(Boolean).map(value => String(value).toLowerCase());
        if (!names.some(value => value.includes(clan))) return false;
      }
      if (condition.type === "source-was-boosted" && !(context.boosterInstanceId && (context.boostedInstanceId === context.sourceInstanceId || context.eventSubjectInstanceId === context.sourceInstanceId))) return false;
      if (condition.type === "attack-target-location" && context.eventTargetLocation !== condition.location) return false;
    }
    return true;
  }
  function parseCardAbilities(card) {
    const text=String(card?.text||"");
    const starts=[...text.matchAll(/(?:^|\n)\s*(?:\[(AUTO|ACT|CONT)\]|(AUTO|ACT|CONT))\s*:?/gi)];
    return starts.map((match,index)=>{
      const labelOffset=match[0].search(/(?:\[(?:AUTO|ACT|CONT)\]|AUTO|ACT|CONT)/i),end=starts[index+1]?.index??text.length,raw=text.slice(match.index+match[0].length,end).trim(),printedText=text.slice(match.index+Math.max(labelOffset,0),end).trim(),kind=String(match[1]||match[2]).toUpperCase();
      const trigger=kind==="AUTO"?compileAutoTrigger(raw):null,costInfo=parseAbilityCosts(raw),conditionInfo=parseAbilityConditions(raw),definition=getAbilityDefinition(String(card.id||"")+":"+index,printedText),hasUnparsedConditions=conditionInfo.status==="needs-review",hasUnparsedChoices=/\b(?:may|choose|select|target)\b/i.test(raw),hasUnparsedCosts=costInfo.status==="needs-review";
      return {id:String(card.id||"")+":"+index,cardId:String(card.id||""),kind,raw,printedText,definition,effects:definition?.effects||null,gb:Number(raw.match(/(?:Generation\s*Break|GB)\s*[-( ]?\s*(\d+)/i)?.[1]||0),once:/\b1\s*\/\s*turn\b|\bonce per turn\b/i.test(raw),requiredLocation:parseAbilityLocation(raw),trigger,costs:costInfo.costs,conditions:conditionInfo.conditions,conditionStatus:hasUnparsedConditions?"needs-review":conditionInfo.conditions.length?"modeled":"no-explicit-condition-detected",choiceStatus:hasUnparsedChoices?"needs-review":"no-explicit-choice-detected",costStatus:hasUnparsedCosts?"needs-review":costInfo.status,implementationStatus:definition?"structured-effect-definition":kind==="AUTO"?(trigger.status==="needs-review"||hasUnparsedConditions||hasUnparsedCosts?"needs-review":"trigger-definition-pending-validation"):kind==="ACT"?"manual-definition-pending-validation":"continuous-definition-pending-validation"};
    });
  }
  function abilityUsageKey(turnId, playerId, cardInstanceId, abilityId) { if (turnId == null || !playerId || !cardInstanceId || !abilityId) throw new TypeError("Ability usage records require turn, player, card, and ability identities."); return `${turnId}:${playerId}:${cardInstanceId}:${abilityId}`; }
  function isManuallyActivatable(ability) { return ability?.kind === "ACT"; }
  function canActivateManualAbility(ability, context = {}) {
    if (!isManuallyActivatable(ability)) return { ok: false, reason: "not-manual" };
    if (!context.cardInstanceId || !context.controllerPlayerId || context.actorPlayerId !== context.controllerPlayerId) return { ok: false, reason: "not-controller" };
    if (context.turnPlayerId !== context.actorPlayerId) return { ok: false, reason: "not-turn-player" };
    if (context.resolutionBlocked) return { ok: false, reason: "resolution-in-progress" };
    if (context.phase !== "main") return { ok: false, reason: "wrong-timing-window" };
    if (context.inPermittedZone !== true) return { ok: false, reason: "wrong-zone" };
    if (ability.once && context.alreadyUsed) return { ok: false, reason: "usage-restriction" };
    if (!canPayAbilityCosts(ability, context.resources || {})) return { ok: false, reason: "unpayable-cost" };
    if (context.conditions && !evaluateAbilityConditions(ability, context.conditions)) return { ok: false, reason: "condition-not-met" };
    return { ok: true };
  }
  function eventMatchesAbilityTrigger(ability,eventName,event,sourceUid,sourceZone,subjectZone) {
    const trigger=ability?.trigger;
    if(ability?.kind!=="AUTO"||trigger?.status!=="recognized-trigger"||trigger.eventType!==({ride:"card.ridden",place:"card.placed",attack:"unit.attacked",boost:"unit.boosted",hit:"attack.hit"})[eventName])return false;
    if(ability.conditionStatus==="needs-review"||ability.costStatus==="needs-review")return false;
    const normalizeLocation=value=>value==="vanguard"?"vanguard":value==="soul"?"soul":value==="drop"?"drop":value==="damage"?"damage":value==="bind"?"bind":value==="hand"?"hand":value==="guardian"?"guardian":/^(?:rear-|accel-|rear\d)/.test(String(value||""))?"rear-guard":null;
    if(ability.requiredLocation.length&&!ability.requiredLocation.includes(normalizeLocation(sourceZone)))return false;
    if(trigger.circles.length&&!trigger.circles.includes(normalizeLocation(subjectZone)))return false;
    if(trigger.subject==="source"&&!eventSubjectMatches(event,sourceUid,"source"))return false;
    if(trigger.subject==="event-subject"&&!eventSubjectMatches(event,sourceUid,"event-subject"))return false;
    if(trigger.subject==="booster"&&!eventSubjectMatches(event,sourceUid,"booster"))return false;
    if(trigger.subject==="boosted-unit"&&!eventSubjectMatches(event,sourceUid,"boosted-unit"))return false;
    if(trigger.subject==="vanguard"&&normalizeLocation(subjectZone)!=="vanguard")return false;
    return true;
  }


  const GAME_EVENT_TYPES = Object.freeze([
    "card.placed", "card.ridden", "unit.attacked", "unit.boosted", "attack.hit", "attack.defended",
    "card.retired", "card.moved", "card.bound", "card.discarded", "card.drawn", "card.damage_moved",
    "drive.checked", "damage.checked", "turn.started", "turn.ended", "phase.changed", "characteristic.changed"
  ]);

  /** Create a serializable event envelope; player sides are temporary fallbacks until player IDs exist. */
  function createGameEvent(state, input) {
    if (!state || !input?.type || !input?.actingPlayerId) throw new TypeError("Game events require match state, type, and acting player.");
    state.eventSequence = Number(state.eventSequence || 0) + 1;
    const eventId = input.eventId || `${state.matchId || "match"}:${state.eventSequence}`;
    return Object.freeze({
      eventId,
      type: String(input.type),
      actingPlayerId: String(input.actingPlayerId),
      turnPlayerId: String(input.turnPlayerId || ""),
      sourceCardInstanceId: input.sourceCardInstanceId || null,
      sourceOwnerPlayerId: input.sourceOwnerPlayerId || null,
      sourceControllerPlayerId: input.sourceControllerPlayerId || null,
      subjectCardInstanceId: input.subjectCardInstanceId || null,
      subjectOwnerPlayerId: input.subjectOwnerPlayerId || null,
      subjectControllerPlayerId: input.subjectControllerPlayerId || null,
      boosterCardInstanceId: input.boosterCardInstanceId || null,
      boostedCardInstanceId: input.boostedCardInstanceId || null,
      targetCardInstanceIds: Array.isArray(input.targetCardInstanceIds) ? [...input.targetCardInstanceIds] : [],
      previousLocation: input.previousLocation || null,
      currentLocation: input.currentLocation || null,
      circle: input.circle || null,
      battleId: input.battleId || null,
      phase: input.phase ?? null,
      timingWindow: input.timingWindow || null,
      before: input.before ?? null,
      after: input.after ?? null
    });
  }

  /** Return false for event IDs already consumed by this match. */
  function claimGameEvent(state, eventId) {
    if (!state || !eventId) return false;
    const processed = state.processedEventIds ||= [];
    if (processed.includes(eventId)) return false;
    processed.push(eventId);
    return true;
  }

  function validateRemoteRequest(state, request) {
    if (!state || !request || typeof request.actionId !== "string" || !request.actionId.trim()) return { ok: false, reason: "missing-action-id" };
    if ((state.processedActionIds || []).includes(request.actionId)) return { ok: false, reason: "duplicate-action" };
    const expected = Number(request.expectedStateVersion);
    const current = Number(state.stateVersion || 0);
    if (!Number.isInteger(expected) || expected !== current) return { ok: false, reason: "stale-state-version", expected, current };
    return { ok: true };
  }
  function validateAbilityDecision(state, request, expectedPlayerId, pending) {
    const replay = validateRemoteRequest(state, request);
    if (!replay.ok) return replay;
    if (!request.matchId || request.matchId !== state.matchId) return { ok: false, reason: "wrong-match" };
    if (!expectedPlayerId || request.actorPlayerId !== expectedPlayerId) return { ok: false, reason: "wrong-actor" };
    if (!pending || pending.instance?.uid !== request.selection?.instanceUid || pending.ability?.id !== request.selection?.abilityId) return { ok: false, reason: "wrong-ability" };
    if (pending.instance?.controllerPlayerId !== expectedPlayerId) return { ok: false, reason: "source-not-controlled" };
    return { ok: true };
  }
  function claimRemoteRequest(state, actionId, limit = 512) {
    if (!state || !actionId || (state.processedActionIds || []).includes(actionId)) return false;
    const processed = state.processedActionIds ||= [];
    processed.push(actionId);
    if (processed.length > limit) processed.splice(0, processed.length - limit);
    return true;
  }

  /** Match explicit ability subject semantics against stable card-instance IDs. */
  function eventSubjectMatches(event, abilitySourceInstanceId, subject = "source") {
    if (!event || !abilitySourceInstanceId) return false;
    if (subject === "source") return event.sourceCardInstanceId === abilitySourceInstanceId;
    if (subject === "event-subject") return event.subjectCardInstanceId === abilitySourceInstanceId;
    if (subject === "booster") return event.boosterCardInstanceId === abilitySourceInstanceId;
    if (subject === "boosted-unit") return event.boostedCardInstanceId === abilitySourceInstanceId;
    if (subject === "any") return true;
    return false;
  }
  return Object.freeze({ createCardInstance, parseCardAbilities, parseAbilityCosts, parseAbilityConditions, evaluateAbilityConditions, canPayAbilityCosts, registerAbilityDefinitions, EFFECT_HANDLERS, validateEffectProgram, resolveEffectProgram, compileAutoTrigger, isManuallyActivatable, canActivateManualAbility, abilityUsageKey, eventMatchesAbilityTrigger, GAME_EVENT_TYPES, createGameEvent, claimGameEvent, validateRemoteRequest, validateAbilityDecision, claimRemoteRequest, eventSubjectMatches });
});