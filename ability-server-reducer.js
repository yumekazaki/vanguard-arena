"use strict";

/*
 * Trusted-side ability decision reducer primitives.
 *
 * This module deliberately accepts the authenticated seat separately from the
 * request body. It is a server building block, not a client authority shim.
 * The host/guest side mapping must be persisted with canonical match state.
 */
(function attachAbilityServerReducer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VanguardAbilityServerReducer = api;
})(typeof globalThis === "undefined" ? this : globalThis, function createAbilityServerReducer() {
  function reject(reason) { return { ok: false, reason }; }

  function secureRandomIndex(length) {
    if (!Number.isSafeInteger(length) || length < 1 || !globalThis.crypto?.getRandomValues) throw new Error("secure-random-unavailable");
    const range = 0x100000000, ceiling = Math.floor(range / length) * length;
    const sample = new Uint32Array(1);
    do { globalThis.crypto.getRandomValues(sample); } while (sample[0] >= ceiling);
    return sample[0] % length;
  }

  function secureShuffle(cards) {
    for (let index = cards.length - 1; index > 0; index--) {
      const swap = secureRandomIndex(index + 1);
      [cards[index], cards[swap]] = [cards[swap], cards[index]];
    }
    return cards;
  }

  function structureResolutionEvents(state, events, source, actorPlayerId, engine) {
    const turnPlayerId = state.players?.[state.side]?.playerId || actorPlayerId;
    return (events || []).map(event => {
      const subjectUid = event?.cardInstanceId || event?.subjectCardInstanceId || null;
      const subject = subjectUid ? engine.locateCardInstance(state, subjectUid) : null;
      return engine.createGameEvent(state, {
        ...event,
        actingPlayerId: actorPlayerId,
        turnPlayerId,
        sourceCardInstanceId: source?.uid || null,
        sourceOwnerPlayerId: source?.ownerPlayerId || actorPlayerId,
        sourceControllerPlayerId: source?.controllerPlayerId || actorPlayerId,
        cardInstanceId: subjectUid,
        subjectCardInstanceId: subjectUid,
        subjectOwnerPlayerId: subject && !subject.ambiguous ? subject.ownerPlayerId : event?.subjectOwnerPlayerId || null,
        subjectControllerPlayerId: subject && !subject.ambiguous ? subject.controllerPlayerId : event?.subjectControllerPlayerId || event?.controllerPlayerId || actorPlayerId,
        currentLocation: event?.currentLocation || (subject && !subject.ambiguous ? subject.circle || subject.zone : null),
        phase: state.phase,
        timingWindow: event?.timingWindow || "ability-resolution",
        battleId: event?.battleId || state.pendingAttack?.battleId || null
      });
    });
  }

  function playerSideForSeat(state, authUid, seats) {
    if (!state || !seats || typeof authUid !== "string") return null;
    const side = authUid === seats.hostAuthUid ? seats.hostSide
      : authUid === seats.guestAuthUid ? seats.guestSide : null;
    if (!side || !state.players?.[side]?.playerId) return null;
    return side;
  }

  const SERVER_EFFECT_OPS = new Set([
    "draw", "modify-power", "modify-power-target", "retire-target", "rest-target", "stand-target", "revelation-choice", "modify-critical", "rest-source", "stand-source",
    "counter-charge", "soul-charge", "move-source-to-soul", "call-source-from-soul", "engorge"
  ]);

  function serverCardDefinition(instance) {
    if (!instance) return null;
    return {
      id: String(instance.cardId || ""), name: instance.cardName || instance.name || "",
      type: instance.type || (instance.unitCard ? "Unit" : ""),
      grade: instance.grade, clan: instance.clan, clans: instance.clans,
      nation: instance.nation, nations: instance.nations, race: instance.race, races: instance.races
    };
  }

  function parseReviewedDefinition(instance, definition, engine) {
    if (!instance || String(definition?.cardId) !== String(instance.cardId) || typeof definition?.printedText !== "string") return null;
    const parsed = engine.parseCardAbilities({ id: String(instance.cardId), text: definition.printedText });
    const ability = parsed.find(candidate => candidate.kind === definition.kind);
    if (!ability) return null;
    return { ...ability, id: definition.id, definition, requiredLocation: definition.requiredLocation || ability.requiredLocation };
  }

  function serverReviewedAbilities(instance, engine) {
    const definitions = engine.getReviewedAbilityDefinitionsForCard?.(instance?.cardId) || [];
    return definitions.map(definition => parseReviewedDefinition(instance, definition, engine)).filter(Boolean);
  }

  function hasLegalReviewedTarget(state, source, actorPlayerId, step, engine) {
    const opponentPlayerId = Object.values(state.players || {}).find(player => player && player.playerId !== actorPlayerId)?.playerId || null;
    for (const [side, player] of Object.entries(state.players || {})) {
      const instances = [player?.vanguard, ...(player?.rear || [])].filter(Boolean);
      for (const candidate of instances) {
        const located = engine.locateCardInstance(state, candidate.uid);
        if (!located || located.ambiguous || !["vanguard", "rear-guard"].includes(located.zone)) continue;
        if (step.op === "stand-target" && candidate.rested !== true) continue;
        const context = {
          source, target: candidate, targetCard: serverCardDefinition(candidate),
          targetZone: located.circle || located.zone,
          sourceControllerPlayerId: actorPlayerId,
          targetControllerPlayerId: located.controllerPlayerId,
          opponentPlayerId
        };
        if (engine.matchesTargetFilter(step.targetFilter || {}, context)) return true;
      }
    }
    return false;
  }

  function serverContinuousPower(state, side, instance, location, attackContext, engine) {
    const player = state.players?.[side];
    if (!player || !instance || typeof engine.evaluateContinuousEffects !== "function") return 0;
    const opponent = Object.values(state.players || {}).find(candidate => candidate && candidate !== player);
    const common = {
      isControllerTurn: state.side === side,
      soulCardNames: (player.soul || []).map(card => card?.cardName).filter(Boolean),
      opponentVanguardGrade: Number(opponent?.vanguard?.grade ?? -1),
      controllerVanguardGrade: Number(player.vanguard?.grade ?? -1),
      controllerVanguardCardNames: engine.getCardNames?.({id:String(player.vanguard?.cardId||""),name:String(player.vanguard?.cardName||"")}) || [],
      normalOrderPlayedThisTurn: state.side === side && Number(state.ordersPlayedThisTurn || 0) > 0,
      controllerDamageCount: (player.damage || []).length,
      opponentTriggerRevealedThisTurn: player.opponentTriggerRevealedThisTurn === true,
      controllerFieldCards: [...(player.vanguard ? [player.vanguard] : []), ...(player.rear || [])].filter(Boolean).map(card => { const definition = serverCardDefinition(card); return { uid: card.uid, names: [card.cardName].filter(Boolean), clans: [definition.clan, ...(definition.clans || [])].filter(Boolean) }; }),
      generationBreakCount: engine.countGenerationBreakUnits?.(player, card => card?.gDeckCard === true) || 0,
      attackingVanguard: attackContext?.attackTargetZone === "vanguard" || (attackContext?.attackerUid === instance.uid && attackContext?.attackerZone === "vanguard")
    };
    const ownAbilities = serverReviewedAbilities(instance, engine);
    let power = engine.evaluateContinuousEffects(ownAbilities, { ...common, location, sourceInstanceId: instance.uid, targetInstanceId: instance.uid }).power;
    if (instance.hasAbilities !== false) return power;
    const sources = [
      ...(player.vanguard ? [{ instance: player.vanguard, location: "vanguard", faceUp: player.vanguard.faceUp !== false }] : []),
      ...(player.rear || []).filter(Boolean).map(card => ({ instance: card, location: "rear-guard", faceUp: card.faceUp !== false })),
      ...(player.gZone || []).filter(card => card?.faceUp === true).map(card => ({ instance: card, location: "g-zone", faceUp: true }))
    ];
    for (const source of sources) {
      const abilities = serverReviewedAbilities(source.instance, engine);
      if (!abilities.length) continue;
      power += engine.evaluateContinuousEffects(abilities, {
        ...common, sourceLocation: source.location, sourceFaceUp: source.faceUp, targetHasNoAbilities: true, sourceInstanceId: source.instance.uid, targetInstanceId: instance.uid
      }).power;
    }
    return power;
  }

  function serverContinuousCritical(state, side, instance, location, engine) {
    const player = state.players?.[side];
    if (!player || !instance || typeof engine.evaluateContinuousEffects !== "function") return 0;
    const opponent = Object.values(state.players || {}).find(candidate => candidate && candidate !== player);
    const context = {
      location,
      isControllerTurn: state.side === side,
      soulCardNames: (player.soul || []).map(card => card?.cardName).filter(Boolean),
      opponentVanguardGrade: Number(opponent?.vanguard?.grade ?? -1),
      controllerVanguardGrade: Number(player.vanguard?.grade ?? -1),
      controllerDamageCount: (player.damage || []).length,
      sourceInstanceId: instance.uid,
      targetInstanceId: instance.uid,
      generationBreakCount: engine.countGenerationBreakUnits?.(player, card => card?.gDeckCard === true) || 0
    };
    return engine.evaluateContinuousEffects(serverReviewedAbilities(instance, engine), context).critical;
  }

  function reviewedStrideCostGrade(instance, engine) {
    const definitions = engine.getReviewedAbilityDefinitionsForCard?.(instance?.cardId) || [];
    const abilities = definitions.map(definition => parseReviewedDefinition(instance, definition, engine)).filter(Boolean);
    const modifier = engine.evaluateStrideCostGrade?.(abilities, { location: "hand", isPayingStrideCost: true }) || { grade: 0 };
    if (!Number.isInteger(Number(instance?.grade)) || Number(instance.grade) < 0) return null;
    return modifier.treatedAsGradeThree ? 3 : Number(instance.grade) + Number(modifier.grade || 0);
  }

  function reviewedCardsShareName(left, right, engine) {
    if (!left || !right) return false;
    if (typeof engine.cardsShareName === "function") return engine.cardsShareName(
      { id: String(left.cardId || ""), name: String(left.cardName || left.name || "") },
      { id: String(right.cardId || ""), name: String(right.cardName || right.name || "") }
    );
    const leftName = String(left.cardName || left.name || "").trim().toLocaleLowerCase();
    const rightName = String(right.cardName || right.name || "").trim().toLocaleLowerCase();
    return Boolean(leftName && leftName === rightName);
  }

  function locateReviewedEffectTarget(state, pending, source, actorPlayerId, selection, engine) {
    const step = (pending?.ability?.definition?.effects || []).find(effect =>
      (effect?.op === "modify-power-target" && ["chosen", "boosted-unit"].includes(effect.target)) ||
      (["retire-target", "rest-target", "stand-target"].includes(effect?.op) && effect.target === "chosen"));
    if (!step) return { ok: true, context: { target: source, targetInPlay: true } };
    if (step.optionalTarget === true && selection?.optionalNoTarget === true) return { ok: true, context: { target: null, targetInPlay: false, optionalNoTarget: true } };
    if (step.optionalTarget === true && typeof selection?.targetUid !== "string" && !hasLegalReviewedTarget(state, source, actorPlayerId, step, engine)) return { ok: true, context: { target: null, targetInPlay: false, optionalNoTarget: true } };
    if (step.optionalTarget === true && typeof selection?.targetUid !== "string") return { ok: false, reason: "ability-target-choice-required" };
    if (step.op === "rest-target" && selection?.effectChoice !== "soul") {
      return { ok: true, context: { target: null, targetInPlay: false, effectChoice: selection?.effectChoice } };
    }
    if (step.op === "stand-target" && typeof selection?.targetUid !== "string") {
      if (step.noOpIfNoLegalTargets === true && !hasLegalReviewedTarget(state, source, actorPlayerId, step, engine)) return { ok: true, context: { target: null, targetInPlay: false, noLegalTarget: true } };
      return { ok: false, reason: "missing-ability-target" };
    }
    const controller = Object.values(state.players || {}).find(player => player?.playerId === actorPlayerId);
    const legalRearGuards = (controller?.rear || []).filter(card => card?.rested !== true);
    if (step.op === "rest-target" && !legalRearGuards.length && step.noOpIfNoLegalTargets === true) {
      return { ok: true, context: { target: null, targetInPlay: false, noLegalTarget: true, effectChoice: selection?.effectChoice } };
    }
    const event = pending.eventContext?.gameEvent;
    const targetUid = step.target === "boosted-unit" ? event?.boostedCardInstanceId : selection?.targetUid;
    if (step.target === "chosen" && typeof targetUid !== "string") return { ok: false, reason: "missing-ability-target" };
    if (step.target === "boosted-unit" && (!targetUid || event?.boosterCardInstanceId !== source.uid || event?.sourceCardInstanceId !== source.uid)) return { ok: false, reason: "boost-event-source-mismatch" };
    if (step.target === "boosted-unit" && selection?.targetUid != null && selection.targetUid !== targetUid) return { ok: false, reason: "boosted-target-is-event-bound" };
    const located = targetUid ? engine.locateCardInstance(state, targetUid) : null;
    if (!located || located.ambiguous || !["vanguard", "rear-guard"].includes(located.zone)) return { ok: false, reason: "invalid-ability-target" };
    const opponentPlayerId = Object.values(state.players || {}).find(player => player && player.playerId !== actorPlayerId)?.playerId || null;
    const targetZone = located.circle || located.zone;
    const targetCard = serverCardDefinition(located.instance);
    const matches = engine.matchesTargetFilter(step.targetFilter || {}, {
      source, target: located.instance, targetCard, targetZone,
      sourceControllerPlayerId: actorPlayerId, targetControllerPlayerId: located.controllerPlayerId,
      opponentPlayerId, isBeingAttacked: state.pendingAttack?.targetUid === targetUid
    });
    if (!matches) return { ok: false, reason: "ability-target-filter-not-met" };
    if (step.op === "stand-target" && located.instance.rested !== true) return { ok: false, reason: "ability-target-not-eligible" };
    return {
      ok: true,
      context: {
        target: located.instance, targetInPlay: true, targetSide: located.side,
        targetPlayer: state.players[located.side], targetCard, targetZone,
        sourceControllerPlayerId: actorPlayerId, targetControllerPlayerId: located.controllerPlayerId, opponentPlayerId
      }
    };
  }

  const EVENT_NAME_BY_TYPE = Object.freeze({
    "card.ridden": "ride", "card.placed": "place", "unit.attacked": "attack",
    "attack.step-started": "attackStep", "attack.declared": "attacked", "unit.boosted": "boost",
    "attack.hit": "hit", "card.retired": "retire", "card.moved": "move", "card.bound": "bind",
    "card.discarded": "discard", "card.drawn": "draw", "card.damage_moved": "damagePlace",
    "unit.stood": "stand", "unit.rested": "rest", "battle.close-step": "battleEnd", "drive.checked": "driveCheck",
    "damage.checked": "damageCheck", "trigger.checked": "triggerCheck", "characteristic.changed": "characteristic", "unit.became_harmony": "harmony",
    "unit.became_engorged": "engorge", "phase.changed": "phase", "turn.started": "start", "turn.ended": "end"
  });
  const SUPPORTED_CONDITION_TYPES = new Set([
    "damage-at-least", "limit-break-active", "damage-zone-empty", "opponent-attacking-unit-attacked-at-least",
    "source-placed-from-hand", "generation-break", "controller-went-second", "controller-turn", "source-face-up",
    "opponent-turn", "opponent-vanguard-grade-at-least", "controller-vanguard-grade-lower-than-opponent",
    "controller-vanguard-grade-at-most", "controller-vanguard-grade-at-least", "controller-has-no-rear-guards", "source-is-hollowed", "source-is-in-harmony",
    "controller-vanguard-is-blazing", "controller-vanguard-is-legion", "controller-has-empty-soul", "opponent-has-no-rear-guards",
    "controller-has-center-column-rear-guard", "controller-has-not-ridden-grade-three-plus-this-fight",
    "controller-back-row-rear-guards-at-most", "controller-back-row-grade-rear-guards-at-least",
    "controller-vanguard-is-attacked-unit", "controller-soul-count-at-least", "controller-damage-count-at-least",
    "controller-damage-count-more-than-opponent", "all-order-zones-count-at-least", "any-field-card-is-locked",
    "controller-other-rear-guards-of-clan-at-least", "controller-has-more-rear-guards-than-opponent", "controller-has-more-cards-in-hand-than-opponent",
    "controller-has-fewer-cards-in-hand-than-opponent", "controller-hand-size-at-least", "controller-hand-size-at-most",
    "opponent-rear-guards-at-most", "attack-target-grade-at-least", "controller-vanguard-name-contains",
    "controller-soul-has-card-name", "controller-vanguard-has-clan", "source-was-boosted", "attack-target-location"
  ]);

  function buildConditionContext(state, event, located, engine) {
    const controllerSide = Object.keys(state.players || {}).find(side => state.players[side]?.playerId === located.controllerPlayerId);
    const controller = controllerSide ? state.players[controllerSide] : null;
    const opponent = Object.values(state.players || {}).find(player => player && player !== controller);
    if (!controller || !opponent) return null;
    const rear = player => (player?.rear || []).filter(Boolean);
    const rearGuards = rear(controller), opposingRearGuards = rear(opponent);
    const vanguard = controller.vanguard, opposingVanguard = opponent.vanguard;
    const targetUid = event.targetCardInstanceId || event.targetCardInstanceIds?.[0] || null;
    const target = targetUid ? engine.locateCardInstance(state, targetUid) : null;
    const targetDefinition = target && !target.ambiguous ? target.instance : null;
    const faceUpGUnits = (controller.gZone || []).filter(card => card?.faceUp === true).length + (vanguard?.isGUnit === true ? 1 : 0);
    const center = controller.rear?.[3];
    const backRow = controller.rear?.slice(2) || [];
    const backRowGradeRearGuards = {};
    for (const card of backRow.filter(Boolean)) {
      const grade = Number(card.grade);
      if (Number.isInteger(grade)) backRowGradeRearGuards[grade] = Number(backRowGradeRearGuards[grade] || 0) + 1;
    }
    const thisTurnKey = `${state.turn}:${controllerSide}`;
    const sourceInHarmony = (state.harmonyAssociations || []).some(pair =>
      pair?.turnKey === thisTurnKey && (pair.firstUid === located.instance.uid || pair.secondUid === located.instance.uid));
    return {
      generationBreakCount: faceUpGUnits,
      damageCount: (controller.damage || []).length,
      controllerDamageCount: (controller.damage || []).length,
      opponentDamageCount: (opponent.damage || []).length,
      controllerRearGuards: rearGuards.length,
      controllerRearGuardClans: rearGuards.map(card => ({ uid: card.uid, clan: card.clan, clans: Array.isArray(card.clans) && card.clans.length ? card.clans : card.clan ? [card.clan] : [] })),
      opponentRearGuards: opposingRearGuards.length,
      controllerBackRowRearGuards: backRow.filter(Boolean).length,
      controllerBackRowGradeRearGuards: backRowGradeRearGuards,
      controllerHandCount: (controller.hand || []).length,
      opponentHandCount: (opponent.hand || []).length,
      controllerSoulCount: (controller.soul || []).length,
      allOrderZonesCount: (controller.orders || []).length + (opponent.orders || []).length,
      anyFieldCardIsLocked: [...rear(controller), ...rear(opponent)].some(card => card.locked === true),
      controllerCenterColumnRearGuard: Boolean(center),
      controllerWentSecond: Boolean(state.firstSide && state.firstSide !== controllerSide),
      isControllerTurn: state.side === controllerSide,
      isOpponentTurn: state.side !== controllerSide,
      sourceFaceUp: located.instance.faceUp !== false,
      sourceHollowed: located.instance.hollowed === true,
      sourceInHarmony,
      controllerVanguardIsBlazing: vanguard?.blazing === true,
      controllerVanguardIsLegion: typeof vanguard?.legionMateInstanceId === "string" && vanguard.legionMateInstanceId.length > 0,
      rodeGradeThreePlusThisFight: controller.rodeGradeThreePlusThisFight,
      controllerVanguardGrade: Number.isInteger(Number(vanguard?.grade)) ? Number(vanguard.grade) : undefined,
      opponentVanguardGrade: Number.isInteger(Number(opposingVanguard?.grade)) ? Number(opposingVanguard.grade) : undefined,
      vanguardName: vanguard?.cardName || vanguard?.name,
      vanguardNames: [vanguard?.cardName, vanguard?.name].filter(Boolean),
      vanguardClan: vanguard?.clan,
      vanguardClans: vanguard?.clans || [],
      vanguardText: vanguard?.text,
      controllerSoulCardNames: (controller.soul || []).map(card => card?.cardName || card?.name).filter(Boolean),
      attackTargetGrade: Number.isInteger(Number(event.targetGrade ?? targetDefinition?.grade)) ? Number(event.targetGrade ?? targetDefinition.grade) : undefined,
      eventTargetLocation: event.targetLocation || null,
      eventPreviousLocation: event.previousLocation || null,
      sourceInstanceId: located.instance.uid,
      boosterInstanceId: event.boosterCardInstanceId || null,
      boostedInstanceId: event.boostedCardInstanceId || null,
      eventSubjectInstanceId: event.subjectCardInstanceId || null,
      controllerVanguardIsAttackedUnit: Boolean(vanguard?.uid && (event.targetCardInstanceIds || []).includes(vanguard.uid)),
      opponentAttackingUnitAttackCount: event.sourceControllerPlayerId === opponent.playerId
        ? engine.getAttackCount(state, opponent.playerId, event.sourceCardInstanceId) : 0
    };
  }

  function discoverAutoTriggers(state, events, engine) {
    if (!state || !Array.isArray(events) || !engine?.getReviewedAbilityDefinitionsForCard) return { queued: [], skipped: [] };
    const queued = [], skipped = [], queue = state.pendingAbilities ||= [];
    const pendingKeys = new Set([state.pendingAbility, ...queue].filter(Boolean).map(item => `${item.side}:${item.instance?.uid}:${item.ability?.id}:${item.eventContext?.eventId}`));
    for (const event of events) {
      const eventName = EVENT_NAME_BY_TYPE[event?.type];
      if (!eventName || !event?.eventId) continue;
      for (const [side, player] of Object.entries(state.players || {})) {
        const instances = [player?.vanguard, ...(player?.rear || []), ...(player?.guardCircle || []), ...(player?.triggerZone || []), ...(player?.orders || []), ...(player?.drop || []), ...(player?.hand || []), ...(player?.soul || []), ...(player?.bind || [])].filter(card => card?.uid && card?.cardId != null);
        for (const instance of instances) {
          const located = engine.locateCardInstance(state, instance.uid);
          if (!located || located.ambiguous) continue;
          const definitions = engine.getReviewedAbilityDefinitionsForCard(instance.cardId);
          for (const definition of definitions) {
            if (definition.kind !== "AUTO") continue;
            const parsed = engine.parseCardAbilities({ id: String(instance.cardId), text: definition.printedText }).find(item => item.kind === "AUTO");
            if (!parsed) continue;
            const ability = { ...parsed, id: definition.id, cardId: String(definition.cardId), definition, effects: definition.effects };
            const readiness = engine.autoAbilityReadiness(ability);
            if (!readiness.ok || ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review" || ability.conditions?.some(condition => !SUPPORTED_CONDITION_TYPES.has(condition?.type)) || !Array.isArray(definition.effects) || definition.effects.some(step => !SERVER_EFFECT_OPS.has(step?.op))) continue;
            const sourceIsMovedSubject = event.subjectCardInstanceId === instance.uid || event.cardInstanceId === instance.uid;
            const sourceIsRideTarget = (event.targetCardInstanceIds || []).includes(instance.uid);
            const leavesSourceLocation = ["card.retired", "card.moved", "card.bound", "card.discarded", "card.damage_moved"].includes(event.type);
            const triggerSourceZone = sourceIsRideTarget && event.type === "card.ridden" && event.targetPreviousLocation
              ? event.targetPreviousLocation
              : sourceIsMovedSubject && leavesSourceLocation && event.previousLocation
              ? event.previousLocation
              : sourceIsMovedSubject && event.currentLocation ? event.currentLocation : located.circle || located.zone;
            const subjectZone = sourceIsRideTarget && event.type === "card.ridden"
              ? event.targetPreviousLocation
              : event.currentLocation || event.circle || null;
            if (!engine.eventMatchesAbilityTrigger(ability, eventName, event, instance.uid, triggerSourceZone, subjectZone, located.controllerPlayerId)) continue;
            const conditionContext = buildConditionContext(state, event, located, engine);
            if (!conditionContext || !engine.evaluateAbilityConditions(ability, conditionContext)) continue;
            const noTargetSteps = definition.effects.filter(step => step?.target === "chosen" && step.noOpIfNoLegalTargets === true && step.op === "stand-target");
            if (noTargetSteps.length === definition.effects.length && noTargetSteps.length > 0 && noTargetSteps.every(step => !hasLegalReviewedTarget(state, located.instance, located.controllerPlayerId, step, engine))) {
              const noTargetKey = `${side}:${instance.uid}:${ability.id}:${event.eventId}`;
              if (!pendingKeys.has(noTargetKey) && engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) {
                pendingKeys.add(noTargetKey);
                skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "no-legal-targets" });
              }
              continue;
            }
            let usageKey;
            try { usageKey = engine.abilityUsageKey(state.turn, located.controllerPlayerId, instance.uid, ability.id, ability.usageRestriction, definition.cardName, ability.printedText); }
            catch { continue; }
            const controller = Object.values(state.players || {}).find(candidate => candidate?.playerId === located.controllerPlayerId);
            if (!controller || (controller.usedAbilities || []).includes(usageKey)) continue;
            const controllerSide = Object.keys(state.players || {}).find(candidateSide => state.players[candidateSide]?.playerId === located.controllerPlayerId);
            if (!controllerSide) continue;
            const pending = {
              side: controllerSide,
              field: located.circle || located.zone,
              instance: located.instance,
              ability,
              triggerControllerPlayerId: located.controllerPlayerId,
              eventContext: {
                event: eventName, eventId: event.eventId, gameEvent: event,
                subjectZone, turnPlayerId: event.turnPlayerId || state.players[state.side]?.playerId || null,
                timingWindow: event.timingWindow || "ability-resolution",
                simultaneousWindowId: event.eventId
              }
            };
            const key = `${pending.side}:${instance.uid}:${ability.id}:${event.eventId}`;
            if (pendingKeys.has(key) || !engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) continue;
            pendingKeys.add(key);
            queue.push(pending);
            queued.push(pending);
          }
        }
      }
    }
    if (!state.pendingAbility && queue.length) {
      const turnPlayerId = state.players?.[state.side]?.playerId;
      const index = turnPlayerId ? queue.findIndex(item => item.triggerControllerPlayerId === turnPlayerId) : -1;
      state.pendingAbility = queue.splice(index >= 0 ? index : 0, 1)[0];
      state.pendingAbilityPriorityPlayerId = turnPlayerId || null;
    }
    return { queued, skipped };
  }

  function queueFollowupTriggers(state, events, engine) {
    const discovery = discoverAutoTriggers(state, events, engine);
    return discovery.queued;
  }

  function completePendingCheckCard(state, actorPlayerId, engine) {
    const pending = state?.pendingCheckCard;
    if (!pending || state.pendingTrigger || state.pendingAbility || (state.pendingAbilities || []).length) return null;
    const player = state.players?.[pending.side];
    if (!player || !Array.isArray(player.triggerZone) || !Array.isArray(player[pending.destination])) return null;
    const index = player.triggerZone.findIndex(card => card?.uid === pending.uid);
    if (index < 0) { state.pendingCheckCard = null; return null; }
    const [instance] = player.triggerZone.splice(index, 1);
    player[pending.destination].push(instance);
    state.pendingCheckCard = null;
    const events = [engine.createGameEvent(state, {
      type: pending.destination === "damage" ? "card.damage_moved" : "card.moved", actingPlayerId: actorPlayerId || player.playerId,
      turnPlayerId: state.players?.[state.side]?.playerId || player.playerId,
      sourceCardInstanceId: instance.uid, sourceOwnerPlayerId: instance.ownerPlayerId,
      sourceControllerPlayerId: instance.controllerPlayerId,
      cardInstanceId: instance.uid, subjectCardInstanceId: instance.uid,
      subjectOwnerPlayerId: instance.ownerPlayerId, subjectControllerPlayerId: instance.controllerPlayerId,
      previousLocation: "trigger", currentLocation: pending.destination,
      checkKind: pending.checkKind, battleId: pending.battleId,
      phase: state.phase, timingWindow: `${pending.checkKind}-check-resolution`
    })];
    if (pending.destination === "damage" && player.damage.length >= 6) state.pendingDamageLossSide = pending.side;
    return events;
  }

  function closePendingBattle(state, actorPlayerId, engine, events) {
    const attack = state.pendingAttack;
    if (!attack || attack.closing) return false;
    const participantIds = [attack.attackerUid, attack.boostUid, attack.targetUid].filter(Boolean);
    for (const item of engine.retireChargingUnitsAtBattleEnd?.(state.players, attack.battleId, participantIds) || []) {
      events.push(engine.createGameEvent(state, {
        type: "card.retired", actingPlayerId: actorPlayerId,
        turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
        sourceCardInstanceId: item.instance.uid, sourceOwnerPlayerId: item.instance.ownerPlayerId,
        sourceControllerPlayerId: item.instance.controllerPlayerId,
        cardInstanceId: item.instance.uid, subjectCardInstanceId: item.instance.uid,
        subjectOwnerPlayerId: item.instance.ownerPlayerId, subjectControllerPlayerId: item.instance.controllerPlayerId,
        previousLocation: item.previousLocation || item.zone, currentLocation: "deck",
        battleId: attack.battleId, phase: "battle", timingWindow: "battle-close-cleanup"
      }));
    }
    for (const uid of participantIds) {
      const located = engine.locateCardInstance(state, uid);
      if (!located || located.ambiguous) continue;
      for (const key of ["battleCriticalBoost", "battleCriticalExpiryBattleId", "battleShieldBoost", "battleShieldExpiryBattleId"]) delete located.instance[key];
    }
    events.push(engine.createGameEvent(state, {
      type: "battle.close-step", actingPlayerId: actorPlayerId,
      turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
      sourceCardInstanceId: attack.attackerUid,
      sourceControllerPlayerId: state.players[attack.attackerSide]?.playerId,
      subjectCardInstanceId: attack.attackerUid,
      subjectControllerPlayerId: state.players[attack.attackerSide]?.playerId,
      targetCardInstanceIds: [attack.targetUid], battleId: attack.battleId,
      phase: "battle", timingWindow: "battle-close-step"
    }));
    attack.closing = true;
    return true;
  }

  function finalizeClosedBattle(state) {
    if (!state.pendingAttack?.closing || state.pendingTrigger || state.pendingAbility || (state.pendingAbilities || []).length) return false;
    state.pendingAttack = null;
    return true;
  }

  function finalizePendingDamageLoss(state, actorPlayerId, engine) {
    const side = state?.pendingDamageLossSide;
    if (!side || state.pendingTrigger || state.pendingAbility || state.pendingCheckCard || (state.pendingAbilities || []).length) return null;
    state.pendingDamageLossSide = null;
    if ((state.players?.[side]?.damage || []).length < 6) return null;
    state.ended = true; state.loserSide = side;
    state.winnerSide = Object.keys(state.players || {}).find(candidate => candidate !== side) || null;
    state.endReason = "six-damage";
    return engine.createGameEvent(state, {
      type: "game.ended", actingPlayerId: actorPlayerId || state.players[side]?.playerId,
      turnPlayerId: state.players?.[state.side]?.playerId || actorPlayerId,
      phase: "battle", timingWindow: "damage-resolution", reason: "six-damage"
    });
  }

  function returnStriddenVanguard(player) {
    const unit = player?.vanguard, hearts = unit?.strideHearts || (unit?.strideHeart ? [unit.strideHeart] : null);
    if (!unit?.strideHeart || !Array.isArray(hearts) || !Array.isArray(player.gZone) || !Array.isArray(player.soul)) return false;
    const heart = hearts.find(card => card?.gDeckCard !== true && card?.gGuardian !== true) || unit.strideHeart;
    const gHearts = hearts.filter(card => card?.gDeckCard === true && card?.gGuardian !== true);
    const returnedGHeartIds = new Set(gHearts.map(card => card.uid));
    for (const card of gHearts) player.gZone.push({ ...card, faceUp: true, rested: false });
    for (const card of hearts) if (card?.uid !== heart.uid && !returnedGHeartIds.has(card?.uid)) player.soul.push(card);
    const stride = { ...unit };
    delete stride.strideHeart; delete stride.strideHearts;
    player.vanguard = { ...heart, rested: Boolean(unit.rested) };
    player.gZone.push({ ...stride, faceUp: true, rested: false });
    return true;
  }

  function continueTurnEnd(state, engine) {
    const ending = state.pendingTurnEnd;
    if (!ending || state.pendingAbility || (state.pendingAbilities || []).length) return [];
    const events = [];
    const endingPlayer = state.players?.[ending.side];
    if (!endingPlayer || endingPlayer.playerId !== ending.playerId) return [];
    if (!ending.cleanupQueued) {
      ending.cleanupQueued = true;
      const retired = engine.retireHollowedUnitsAtTurnEnd?.(state.players, ending.playerId) || [];
      for (const item of retired) events.push(engine.createGameEvent(state, {
        type: "card.retired", actingPlayerId: ending.playerId, turnPlayerId: ending.playerId,
        cardInstanceId: item.instance.uid, subjectCardInstanceId: item.instance.uid,
        subjectOwnerPlayerId: item.instance.ownerPlayerId || ending.playerId,
        subjectControllerPlayerId: item.instance.controllerPlayerId || ending.playerId,
        previousLocation: item.zone, currentLocation: "drop", phase: "end", timingWindow: "turn-end-cleanup"
      }));
      queueFollowupTriggers(state, events, engine);
      if (state.pendingAbility || (state.pendingAbilities || []).length) return events;
    }

    engine.expireHarmonyAssociations?.(state, `${state.turn}:${ending.side}`);
    engine.clearOpponentTriggerFacts?.(state.players);
    engine.expireTurnModifiers?.(state.players, ending.playerId);
    returnStriddenVanguard(endingPlayer);
    const nextSide = Object.keys(state.players || {}).find(candidate => candidate !== ending.side);
    const nextPlayer = nextSide ? state.players[nextSide] : null;
    if (!nextSide || !nextPlayer) return events;
    state.turn = Number(state.turn || 0) + 1;
    state.side = nextSide;
    state.phase = 0;
    state.firstTurnComplete = true;
    state.drewThisTurn = false;
    state.ridePerformed = false;
    state.stridePerformed = false;
    state.ordersPlayedThisTurn = 0;
    state.pendingAttack = null;
    state.pendingAttackSetup = null;
    state.pendingBattleEnd = null;
    state.pendingTurnEnd = null;
    state.attacksByUnitTurn = {};
    state.turnStartGrades ||= {};
    const grade = Number(nextPlayer.vanguard?.grade);
    state.turnStartGrades[nextSide] = Number.isInteger(grade) && grade >= 0 ? grade : null;

    const turnPlayerId = nextPlayer.playerId;
    events.push(engine.createGameEvent(state, {
      type: "turn.started", actingPlayerId: turnPlayerId, turnPlayerId,
      phase: "stand", timingWindow: "turn-start"
    }));
    const zones = ["vanguard", ...(nextPlayer.rear || []).map((_, index) => index)];
    const stood = [];
    for (const zone of zones) {
      const instance = zone === "vanguard" ? nextPlayer.vanguard : nextPlayer.rear[zone];
      if (!instance?.uid || instance.rested !== true) continue;
      instance.rested = false;
      stood.push(engine.createGameEvent(state, {
        type: "unit.stood", actingPlayerId: turnPlayerId, turnPlayerId,
        sourceCardInstanceId: instance.uid, sourceOwnerPlayerId: instance.ownerPlayerId || turnPlayerId,
        sourceControllerPlayerId: instance.controllerPlayerId || turnPlayerId,
        cardInstanceId: instance.uid, subjectCardInstanceId: instance.uid,
        subjectOwnerPlayerId: instance.ownerPlayerId || turnPlayerId,
        subjectControllerPlayerId: instance.controllerPlayerId || turnPlayerId,
        currentLocation: zone === "vanguard" ? "vanguard" : nextPlayer.rear[zone]?.circle || "rear-guard",
        phase: "stand", timingWindow: "stand-phase", before: { rested: true }, after: { rested: false }
      }));
    }
    events.push(...stood);
    queueFollowupTriggers(state, events, engine);
    return events;
  }

  function applyGameAction(state, command, seats, engine) {
    if (!state || !command || !engine) return reject("invalid-reducer-input");
    const side = playerSideForSeat(state, command.actorAuthUid, seats);
    if (!side) return reject("actor-not-seated");
    const player = state.players[side], actorPlayerId = player.playerId, action = command.payload?.action;
    if (Array.isArray(state.processedActionIds) && state.processedActionIds.includes(command.actionId)) return reject("duplicate-action");
    if (Number(command.expectedStateVersion) !== Number(state.stateVersion)) return reject("stale-state-version");
    if (state.ended) return reject("match-ended");
    const activeBattle = state.pendingAttack;
    const battleResponse = ["guard", "noGuard", "driveCount", "driveCheck", "triggerChoice", "resolveBattle", "damageCheck"].includes(action) && Boolean(activeBattle);
    const setupAction = ["setupRoll", "setupChoice", "setupMulligan"].includes(action);
    if (state.side !== side && !battleResponse && !setupAction) return reject("not-actor-turn");
    if ((state.pendingAbility && action !== "triggerChoice") || (state.pendingTrigger && action !== "triggerChoice") || (state.pendingAttack && !battleResponse) || state.pendingTurnEnd || ((state.pendingAbilities || []).length && action !== "triggerChoice")) return reject("resolution-in-progress");
    const events = [];
    const emitPhaseChange = (from, to) => events.push(engine.createGameEvent(state, {
      type: "phase.changed", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
      phase: to, timingWindow: "phase-start", before: { phase: from }, after: { phase: to }
    }));
    if (["guard", "noGuard", "driveCount", "driveCheck", "triggerChoice", "resolveBattle", "damageCheck"].includes(action)) {
      const attack = state.pendingAttack;
      if (!attack) return reject("no-pending-attack");
      if (action === "resolveBattle") {
        if (side !== attack.attackerSide) return reject("not-attacker-resolution-seat");
        if (!attack.defenderDone || attack.driveCountPrompt || Number(attack.driveChecksRemaining || 0) > 0 || attack.awaitingDrive) return reject("attack-resolution-incomplete");
        if (attack.closing) return reject("battle-already-closing");
        if (attack.damageChecksStarted) {
          if (Number(attack.damageChecksRemaining || 0) > 0) return reject("damage-checks-incomplete");
          closePendingBattle(state, actorPlayerId, engine, events);
        } else {
          const attackerLocation = engine.locateCardInstance(state, attack.attackerUid);
          const targetLocation = engine.locateCardInstance(state, attack.targetUid);
          const attackerValid = attackerLocation && !attackerLocation.ambiguous && attackerLocation.side === attack.attackerSide && attackerLocation.controllerPlayerId === attack.attackerPlayerId && ["vanguard", "rear-guard"].includes(attackerLocation.zone) && (attackerLocation.circle || attackerLocation.zone) === attack.attackerZone;
          const targetValid = targetLocation && !targetLocation.ambiguous && targetLocation.side === attack.defenderSide && targetLocation.controllerPlayerId === state.players[attack.defenderSide]?.playerId && ["vanguard", "rear-guard"].includes(targetLocation.zone) && (targetLocation.circle || targetLocation.zone) === attack.targetZone;
          let hit = false;
          if (attackerValid && targetValid && !attack.blocked) {
            // Effects mutate these canonical battle totals while the battle is open.
            // Keep them as the source of truth so guard shield and resolved triggers
            // are not lost by rebuilding power from the printed card stats here.
            hit = Number(attack.power) >= Number(attack.targetPower);
          }
          if (hit) {
            if (targetLocation.zone === "rear-guard" && (!Array.isArray(state.players[attack.defenderSide]?.drop) || state.players[attack.defenderSide].rear[targetLocation.index]?.uid !== attack.targetUid)) return reject("attack-target-moved-during-resolution");
            events.push(engine.createGameEvent(state, {
              type: "attack.hit", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
              sourceCardInstanceId: attack.attackerUid, sourceOwnerPlayerId: attackerLocation.ownerPlayerId,
              sourceControllerPlayerId: actorPlayerId, cardInstanceId: attack.targetUid,
              subjectCardInstanceId: attack.targetUid, subjectOwnerPlayerId: targetLocation.ownerPlayerId,
              subjectControllerPlayerId: targetLocation.controllerPlayerId,
              targetCardInstanceIds: [attack.targetUid], targetLocation: attack.targetZone,
              battleId: attack.battleId, phase: "battle", timingWindow: "attack-hit"
            }));
            if (targetLocation.zone === "vanguard" && Number(attack.critical || 0) > 0) {
              attack.damageChecksStarted = true;
              attack.damageChecksRemaining = Number(attack.critical);
              attack.damageCheckSide = attack.defenderSide;
            } else if (targetLocation.zone === "rear-guard") {
              const defender = state.players[attack.defenderSide], index = targetLocation.index;
              const [retired] = defender.rear.splice(index, 1, null); defender.drop.push(retired);
              events.push(engine.createGameEvent(state, {
                type: "card.retired", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
                sourceCardInstanceId: retired.uid, sourceOwnerPlayerId: retired.ownerPlayerId,
                sourceControllerPlayerId: retired.controllerPlayerId, cardInstanceId: retired.uid,
                subjectCardInstanceId: retired.uid, subjectOwnerPlayerId: retired.ownerPlayerId,
                subjectControllerPlayerId: retired.controllerPlayerId, previousLocation: attack.targetZone,
                currentLocation: "drop", battleId: attack.battleId, phase: "battle", timingWindow: "attack-hit-retire"
              }));
              closePendingBattle(state, actorPlayerId, engine, events);
            } else closePendingBattle(state, actorPlayerId, engine, events);
          } else closePendingBattle(state, actorPlayerId, engine, events);
        }
      } else if (action === "damageCheck") {
        if (side !== attack.damageCheckSide || !attack.damageChecksStarted || Number(attack.damageChecksRemaining || 0) <= 0 || attack.closing) return reject("damage-check-not-available");
        if (!Array.isArray(player.deck) || !Array.isArray(player.damage) || (player.triggerZone !== undefined && !Array.isArray(player.triggerZone)) || (player.triggerZone || []).length) return reject("invalid-damage-check-zones");
        const checked = player.deck[player.deck.length - 1];
        if (!checked?.uid || !checked.cardId) {
          state.ended = true; state.winnerSide = attack.attackerSide; state.loserSide = side; state.endReason = "deck-empty";
          events.push(engine.createGameEvent(state, { type: "game.ended", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId, phase: "battle", timingWindow: "damage-check", reason: "deck-empty" }));
          attack.damageChecksRemaining = 0;
        } else {
          player.deck.pop(); player.triggerZone ||= []; player.triggerZone.push(checked);
          attack.damageChecksRemaining -= 1;
          const kind = String(checked.triggerType || "").toLowerCase();
          if (kind === "over") {
            player.triggerZone.pop(); player.removed ||= []; player.removed.push(checked);
            // Over Trigger sub-abilities resolve in order even on a damage check:
            // remove this card, draw one, then give one of the checking player's
            // units +100,000,000 power. The drive-check-only extra text does not apply.
            const drawn = player.deck.pop();
            if (drawn) {
              player.hand.push(drawn);
              events.push(engine.createGameEvent(state, {
                type: "card.drawn", actingPlayerId: actorPlayerId,
                turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
                sourceCardInstanceId: checked.uid, sourceOwnerPlayerId: checked.ownerPlayerId,
                sourceControllerPlayerId: checked.controllerPlayerId,
                cardInstanceId: drawn.uid, subjectCardInstanceId: drawn.uid,
                subjectOwnerPlayerId: drawn.ownerPlayerId || actorPlayerId,
                subjectControllerPlayerId: drawn.controllerPlayerId || actorPlayerId,
                previousLocation: "deck", currentLocation: "hand", checkKind: "damage",
                battleId: attack.battleId, phase: "battle", timingWindow: "over-trigger-draw"
              }));
            } else {
              state.ended = true; state.winnerSide = attack.attackerSide; state.loserSide = side; state.endReason = "deck-empty";
              events.push(engine.createGameEvent(state, {
                type: "game.ended", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
                phase: "battle", timingWindow: "over-trigger-draw", reason: "deck-empty"
              }));
            }
            if (!state.ended && (player.vanguard || (player.rear || []).some(Boolean))) {
              state.pendingTrigger = {
                side, uid: checked.uid, cardName: checked.cardName || String(checked.cardId),
                kind, checkName: "damage", power: 100000000, turnOwner: side,
                stage: "over-target", battleId: attack.battleId
              };
            }
          } else {
            const trigger = ["critical", "draw", "stand", "heal", "front"].includes(kind);
            state.pendingCheckCard = { side, uid: checked.uid, destination: "damage", checkKind: "damage", battleId: attack.battleId };
            if (trigger) {
              const power = Number(checked.triggerPower || 10000);
              const opponentDamage = state.players[attack.attackerSide]?.damage?.length || 0;
              state.pendingTrigger = {
                side, uid: checked.uid, cardName: checked.cardName || String(checked.cardId), kind, checkName: "damage",
                power, turnOwner: side,
                stage: kind === "critical" ? "critical-target" : kind === "stand" ? "stand-target" : kind === "heal" && player.damage.length >= opponentDamage ? "heal-target" : "power-target",
                battleId: attack.battleId
              };
              if (kind === "draw") {
                if (player.deck.length) player.hand.push(player.deck.pop());
                else { state.ended = true; state.winnerSide = attack.attackerSide; state.loserSide = side; state.endReason = "deck-empty"; }
              } else if (kind === "front") {
                for (const [index, unit] of (player.rear || []).entries()) if (unit && (index < 2 || index >= 5)) { unit.turnPowerBoost = Number(unit.turnPowerBoost || 0) + power; unit.turnPowerExpiry = side; }
                if (player.vanguard) { player.vanguard.turnPowerBoost = Number(player.vanguard.turnPowerBoost || 0) + power; player.vanguard.turnPowerExpiry = side; }
                state.pendingTrigger = null;
              }
              if (state.pendingTrigger?.stage === "stand-target" && !(player.rear || []).some(unit => unit?.rested)) state.pendingTrigger.stage = "power-target";
              if (state.pendingTrigger?.stage === "heal-target" && !player.damage.length) state.pendingTrigger.stage = "power-target";
              if (state.pendingTrigger && !player.vanguard && !(player.rear || []).some(Boolean) && state.pendingTrigger.stage !== "heal-target" && state.pendingTrigger.stage !== "stand-target") state.pendingTrigger = null;
            }
          }
          const checkedEvent = engine.createGameEvent(state, {
            type: "damage.checked", actingPlayerId: actorPlayerId, turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
            sourceCardInstanceId: attack.attackerUid, sourceControllerPlayerId: attack.attackerPlayerId,
            cardInstanceId: checked.uid, subjectCardInstanceId: checked.uid,
            subjectOwnerPlayerId: checked.ownerPlayerId, subjectControllerPlayerId: checked.controllerPlayerId,
            checkedCardInstanceId: checked.uid, checkedCardTriggerType: kind || null, revealedTrigger: kind || null,
            previousLocation: "deck", currentLocation: "trigger", checkKind: "damage",
            checkIndex: Number(attack.damageChecksPerformed || 0) + 1, battleId: attack.battleId,
            phase: "battle", timingWindow: "damage-check"
          });
          events.push(checkedEvent);
          if (kind === "over") events.push(engine.createGameEvent(state, {
            type: "card.moved", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
            sourceCardInstanceId: checked.uid, sourceOwnerPlayerId: checked.ownerPlayerId,
            sourceControllerPlayerId: checked.controllerPlayerId, cardInstanceId: checked.uid,
            subjectCardInstanceId: checked.uid, subjectOwnerPlayerId: checked.ownerPlayerId,
            subjectControllerPlayerId: checked.controllerPlayerId, previousLocation: "trigger", currentLocation: "removed",
            checkKind: "damage", battleId: attack.battleId, phase: "battle", timingWindow: "over-trigger-removal"
          }));
          else if (!state.pendingTrigger) state.pendingCheckCard = { side, uid: checked.uid, destination: "damage", checkKind: "damage", battleId: attack.battleId };
          attack.damageChecksPerformed = Number(attack.damageChecksPerformed || 0) + 1;
          if (kind) engine.recordOpponentTriggerCheck?.(state.players, actorPlayerId, kind, "damage");
        }
      } else if (action === "driveCheck") {
        if (attack.attackerSide !== side || !attack.awaitingDrive || attack.driveChecksRemaining <= 0) return reject("drive-check-not-available");
        if (!Array.isArray(player.deck) || !Array.isArray(player.hand) || (player.triggerZone !== undefined && !Array.isArray(player.triggerZone)) || (player.triggerZone || []).length) return reject("invalid-drive-check-zones");
        const checked = player.deck[player.deck.length - 1];
        if (!checked?.uid || !checked.cardId) return reject("drive-check-deck-empty");
        player.deck.pop(); attack.driveChecksRemaining -= 1; attack.driveChecksPerformed = Number(attack.driveChecksPerformed || 0) + 1;
        const kind = String(checked.triggerType || "").toLowerCase();
        if (kind) engine.recordOpponentTriggerCheck?.(state.players, actorPlayerId, kind, "drive");
        player.triggerZone ||= [];
        player.triggerZone.push(checked);
        if (kind === "over") {
          player.triggerZone.pop(); player.removed ||= []; player.removed.push(checked);
          // An Over Trigger reveals from the deck, removes itself, and draws one.
          if (!player.deck.length) { state.ended = true; state.winnerSide = Object.keys(state.players).find(candidate => candidate !== side) || null; state.loserSide = side; state.endReason = "deck-empty"; }
          else player.hand.push(player.deck.pop());
          state.pendingTrigger = {
            side, uid: checked.uid, cardName: checked.cardName || String(checked.cardId), kind, checkName: "drive",
            power: 100000000, turnOwner: side, stage: "over-target", battleId: attack.battleId
          };
          if (!state.players[side].rear?.some(Boolean) && !state.players[side].vanguard) state.pendingTrigger = null;
        } else {
          if (["critical", "draw", "stand", "heal", "front"].includes(kind)) {
            const power = Number(checked.triggerPower || 10000);
            state.pendingTrigger = {
              side, uid: checked.uid, cardName: checked.cardName || String(checked.cardId), kind, checkName: "drive",
            power, turnOwner: side, stage: kind === "critical" ? "critical-target" : kind === "stand" ? "stand-target" : kind === "heal" && player.damage.length >= (state.players[attack.defenderSide]?.damage || []).length ? "heal-target" : "power-target",
              battleId: attack.battleId
            };
            state.pendingCheckCard = { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId: attack.battleId };
            if (kind === "draw") {
              if (player.deck.length) player.hand.push(player.deck.pop());
              else { state.ended = true; state.winnerSide = Object.keys(state.players).find(candidate => candidate !== side) || null; state.loserSide = side; state.endReason = "deck-empty"; }
            } else if (kind === "front") {
              for (const [index, unit] of (player.rear || []).entries()) if (unit && (index < 2 || index >= 5)) { unit.turnPowerBoost = Number(unit.turnPowerBoost || 0) + power; unit.turnPowerExpiry = side; }
              if (player.vanguard) { player.vanguard.turnPowerBoost = Number(player.vanguard.turnPowerBoost || 0) + power; player.vanguard.turnPowerExpiry = side; }
              state.pendingTrigger = null;
            }
            if (state.pendingTrigger && state.pendingTrigger.stage === "stand-target" && !(player.rear || []).some(unit => unit?.rested)) state.pendingTrigger.stage = "power-target";
            if (state.pendingTrigger && state.pendingTrigger.stage === "heal-target" && !player.damage.length) state.pendingTrigger.stage = "power-target";
            if (state.pendingTrigger && !player.vanguard && !(player.rear || []).some(Boolean) && state.pendingTrigger.stage !== "heal-target" && state.pendingTrigger.stage !== "stand-target") state.pendingTrigger = null;
          }
        }
        const checkedEvent = engine.createGameEvent(state, {
          type: "drive.checked", actingPlayerId: actorPlayerId, turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
          sourceCardInstanceId: attack.attackerUid, sourceControllerPlayerId: attack.attackerPlayerId || state.players[attack.attackerSide]?.playerId,
          cardInstanceId: checked.uid, subjectCardInstanceId: checked.uid,
          subjectOwnerPlayerId: checked.ownerPlayerId || actorPlayerId, subjectControllerPlayerId: checked.controllerPlayerId || actorPlayerId,
          checkedCardInstanceId: checked.uid, checkedCardTriggerType: kind || null, revealedTrigger: kind || null,
          checkedCardName: checked.cardName || null, checkedCardGrade: checked.grade ?? null,
          previousLocation: "deck", currentLocation: "trigger",
          checkKind: "drive", checkIndex: attack.driveChecksPerformed, battleId: attack.battleId,
          phase: "battle", timingWindow: "drive-check"
        });
        events.push(checkedEvent);
        if (!state.pendingTrigger && kind !== "over") state.pendingCheckCard = { side, uid: checked.uid, destination: "hand", checkKind: "drive", battleId: attack.battleId };
        if (kind === "over") events.push(engine.createGameEvent(state, {
          type: "card.moved", actingPlayerId: actorPlayerId, turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
          sourceCardInstanceId: checked.uid, sourceOwnerPlayerId: checked.ownerPlayerId,
          sourceControllerPlayerId: checked.controllerPlayerId, cardInstanceId: checked.uid,
          subjectCardInstanceId: checked.uid, subjectOwnerPlayerId: checked.ownerPlayerId,
          subjectControllerPlayerId: checked.controllerPlayerId, previousLocation: "trigger",
          currentLocation: "removed", checkKind: "drive", battleId: attack.battleId,
          phase: "battle", timingWindow: "over-trigger-removal"
        }));
        if (attack.driveChecksRemaining === 0) { attack.awaitingDrive = false; attack.driveChecksComplete = true; }
      } else if (action === "triggerChoice") {
        const pending = state.pendingTrigger;
        if (!pending || pending.side !== side || pending.battleId !== attack.battleId) return reject("trigger-choice-not-available");
        const uid = command.payload?.targetCardInstanceId;
        if (pending.stage === "heal-target") {
          const damageIndex = player.damage.findIndex(card => card?.uid === uid);
          if (damageIndex < 0) return reject("invalid-heal-target");
          const [healed] = player.damage.splice(damageIndex, 1); player.drop.push(healed);
          const powerExists = Boolean(player.vanguard || (player.rear || []).some(Boolean));
          pending.stage = powerExists ? "power-target" : null;
          if (!pending.stage) state.pendingTrigger = null;
        } else {
          const target = [player.vanguard, ...(player.rear || [])].find(card => card?.uid === uid);
          if (!target) return reject("invalid-trigger-target");
          if (pending.stage === "stand-target") {
            if (target === player.vanguard || !target.rested) return reject("invalid-stand-trigger-target");
            target.rested = false; target.cannotDriveChecksThisTurn = true; target.cannotDriveChecksExpiry = side; pending.stage = "power-target";
          } else if (pending.stage === "critical-target") {
            target.turnCriticalBoost = Number(target.turnCriticalBoost || 0) + 1; target.turnCriticalExpiry = pending.turnOwner;
            if (target.uid === attack.attackerUid) attack.critical = Number(attack.critical || 1) + 1;
            pending.stage = "power-target";
          } else if (pending.stage === "power-target" || pending.stage === "over-target") {
            target.turnPowerBoost = Number(target.turnPowerBoost || 0) + Number(pending.power || 0); target.turnPowerExpiry = pending.turnOwner;
            if (target.uid === attack.attackerUid) attack.power = Number(attack.power || 0) + Number(pending.power || 0);
            state.pendingTrigger = null;
          } else return reject("invalid-trigger-stage");
        }
      } else if (action === "driveCount") {
        if (attack.attackerSide !== side || !attack.defenderDone || !attack.driveCountPrompt || attack.driveCountChosen) return reject("drive-count-not-available");
        const count = command.payload?.count;
        if (!Number.isInteger(count) || count < 0 || count > Math.min(10, Number(attack.maxDriveChecks || 0))) return reject("invalid-drive-count");
        attack.driveChecksRemaining = count;
        attack.driveCountChosen = true;
        attack.driveCountPrompt = false;
        attack.awaitingDrive = count > 0;
        attack.driveChecksComplete = count === 0;
      } else {
        if (attack.defenderSide !== side || attack.defenderDone) return reject("not-defender-response-window");
        if (action === "noGuard") {
          attack.defenderDone = true;
          attack.blocked = Boolean(attack.perfectGuard);
          if (attack.attackerZone === "vanguard") {
            const attacker = engine.locateCardInstance(state, attack.attackerUid)?.instance;
            attack.driveCountPrompt = attacker?.cannotDriveChecksThisTurn !== true; attack.driveCountChosen = !attack.driveCountPrompt; attack.maxDriveChecks = attack.driveCountPrompt ? 10 : 0;
            if (!attack.driveCountPrompt) { attack.driveChecksRemaining = 0; attack.driveChecksComplete = true; }
          } else {
            attack.driveCountPrompt = false; attack.driveCountChosen = true; attack.driveChecksComplete = true;
          }
        } else {
          if (!Array.isArray(player.hand) || !Array.isArray(player.guardCircle)) return reject("invalid-guard-zones");
          const guardUid = command.payload?.cardInstanceId;
          const guardIndex = player.hand.findIndex(card => card?.uid === guardUid);
          if (typeof guardUid !== "string" || guardIndex < 0) return reject("guard-card-not-in-hand");
          const guardCard = player.hand[guardIndex];
          if (guardCard.ownerPlayerId !== actorPlayerId || guardCard.controllerPlayerId !== actorPlayerId) return reject("guard-card-not-owned-and-controlled");
          const baseShield = Number(guardCard.shield);
          if (!Number.isFinite(baseShield) || baseShield < 0) return reject("guard-shield-metadata-missing");
          const attackingPlayer = state.players[attack.attackerSide];
          const continuousShield = engine.evaluateContinuousShieldEffects?.(serverReviewedAbilities(guardCard, engine), {
            location: "guardian",
            opponentVanguardGrade: Number(attackingPlayer?.vanguard?.grade ?? -1),
            controllerVanguardGrade: Number(player.vanguard?.grade ?? -1),
            controllerVanguardCardNames: engine.getCardNames?.({id:String(player.vanguard?.cardId||""),name:String(player.vanguard?.cardName||"")}) || [],
            controllerDamageCount: (player.damage || []).length,
            generationBreakCount: engine.countGenerationBreakUnits?.(player, card => card?.gDeckCard === true) || 0,
            opponentTriggerRevealedThisTurn: player.opponentTriggerRevealedThisTurn === true
          }).shield || 0;
          const battleShield = attack.defenderSide === side && guardCard.battleShieldExpiryBattleId === attack.battleId ? Number(guardCard.battleShieldBoost || 0) : 0;
          const shield = baseShield + continuousShield + battleShield;
          const isPerfectGuard = guardCard.sentinel === true && shield === 0;
          let discardIndex = -1, discardCard = null;
          if (shield === 0 && !isPerfectGuard) return reject("zero-shield-card-cannot-guard");
          if (isPerfectGuard) {
            const discardUid = command.payload?.discardCardInstanceId;
            discardIndex = player.hand.findIndex(card => card?.uid === discardUid);
            if (typeof discardUid !== "string" || discardIndex < 0 || discardIndex === guardIndex) return reject("perfect-guard-needs-distinct-discard");
            discardCard = player.hand[discardIndex];
            if (discardCard.ownerPlayerId !== actorPlayerId || discardCard.controllerPlayerId !== actorPlayerId) return reject("discard-card-not-owned-and-controlled");
          } else if (command.payload?.discardCardInstanceId != null) return reject("unexpected-guard-discard");

          player.hand.splice(guardIndex, 1);
          if (discardCard) {
            const adjustedIndex = discardIndex > guardIndex ? discardIndex - 1 : discardIndex;
            player.hand.splice(adjustedIndex, 1);
            player.drop.push(discardCard);
            events.push(engine.createGameEvent(state, {
              type: "card.discarded", actingPlayerId: actorPlayerId, turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
              sourceCardInstanceId: discardCard.uid, sourceOwnerPlayerId: discardCard.ownerPlayerId,
              sourceControllerPlayerId: discardCard.controllerPlayerId,
              cardInstanceId: discardCard.uid, subjectCardInstanceId: discardCard.uid,
              subjectOwnerPlayerId: discardCard.ownerPlayerId, subjectControllerPlayerId: discardCard.controllerPlayerId,
              previousLocation: "hand", currentLocation: "drop", discardReason: "perfect-guard-cost",
              phase: "battle", timingWindow: "perfect-guard-cost", battleId: attack.battleId
            }));
          }
          guardCard.circle = "guardian"; guardCard.rested = false;
          player.guardCircle.push(guardCard); attack.guardCards ||= []; attack.guardCards.push(guardCard);
          attack.targetPower += shield;
          if (isPerfectGuard) {
            attack.perfectGuard = true; attack.defenderDone = true; attack.blocked = true;
            if (attack.attackerZone === "vanguard") {
              const attacker = engine.locateCardInstance(state, attack.attackerUid)?.instance;
              attack.driveCountPrompt = attacker?.cannotDriveChecksThisTurn !== true; attack.driveCountChosen = !attack.driveCountPrompt; attack.maxDriveChecks = attack.driveCountPrompt ? 10 : 0;
              if (!attack.driveCountPrompt) { attack.driveChecksRemaining = 0; attack.driveChecksComplete = true; }
            }
            else { attack.driveCountChosen = true; attack.driveChecksComplete = true; }
          }
          events.push(engine.createGameEvent(state, {
            type: "card.placed", actingPlayerId: actorPlayerId, turnPlayerId: state.players[state.side]?.playerId || actorPlayerId,
            sourceCardInstanceId: guardCard.uid, sourceOwnerPlayerId: guardCard.ownerPlayerId,
            sourceControllerPlayerId: guardCard.controllerPlayerId,
            cardInstanceId: guardCard.uid, subjectCardInstanceId: guardCard.uid,
            subjectOwnerPlayerId: guardCard.ownerPlayerId, subjectControllerPlayerId: guardCard.controllerPlayerId,
            previousLocation: "hand", currentLocation: "guardian", circle: "guardian",
            targetCardInstanceIds: [attack.targetUid], targetLocation: attack.targetZone,
            phase: "battle", timingWindow: "guard-placement", battleId: attack.battleId
          }));
        }
      }
    } else if (action === "attack") {
      if (Number(state.phase) !== 5) return reject("wrong-timing-window");
      if (state.firstTurnComplete === false && state.firstSide === side) return reject("first-player-cannot-attack-first-turn");
      const attackerUid = command.payload?.attackerCardInstanceId, targetUid = command.payload?.targetCardInstanceId;
      const attackerLocation = typeof attackerUid === "string" ? engine.locateCardInstance(state, attackerUid) : null;
      const targetLocation = typeof targetUid === "string" ? engine.locateCardInstance(state, targetUid) : null;
      if (!attackerLocation || attackerLocation.ambiguous || attackerLocation.controllerPlayerId !== actorPlayerId || !["vanguard", "rear-guard"].includes(attackerLocation.zone)) return reject("attacker-not-controlled-on-field");
      if (!targetLocation || targetLocation.ambiguous || targetLocation.controllerPlayerId === actorPlayerId || !["vanguard", "rear-guard"].includes(targetLocation.zone)) return reject("invalid-attack-target");
      const attacker = attackerLocation.instance, target = targetLocation.instance;
      if (attacker.unitCard !== true || attacker.rested || attacker.locked) return reject("attacker-cannot-attack");
      const isFrontRow = attackerLocation.zone === "vanguard" || attackerLocation.circle === "rear-left" || attackerLocation.circle === "rear-right" || String(attackerLocation.circle || "").startsWith("accel-");
      if (!isFrontRow && attacker.canAttackBackRow !== true) return reject("back-row-attacker-not-permitted");
      if (!Number.isFinite(attacker.power) || !Number.isFinite(target.power)) return reject("combat-power-metadata-missing");
      if (!Number.isInteger(Number(attacker.critical)) || Number(attacker.critical) < 1) return reject("attacker-critical-metadata-invalid");
      const defenderSide = targetLocation.side, defender = state.players[defenderSide];
      if (!defender || defender.playerId !== targetLocation.controllerPlayerId) return reject("invalid-defender-seat");
      let booster = null, boosterCircle = null, boostEvent = null;
      const boosterUid = command.payload?.boosterCardInstanceId;
      if (boosterUid != null) {
        const boosterLocation = typeof boosterUid === "string" ? engine.locateCardInstance(state, boosterUid) : null;
        if (!boosterLocation || boosterLocation.ambiguous || boosterLocation.controllerPlayerId !== actorPlayerId || boosterLocation.zone !== "rear-guard" || boosterLocation.instance.rested || boosterLocation.instance.locked || boosterLocation.instance.boostAbility !== true) return reject("invalid-booster");
        const expectedBoosterIndex = attackerLocation.zone === "vanguard" ? 3 : attackerLocation.circle === "rear-left" ? 2 : attackerLocation.circle === "rear-right" ? 4 : -1;
        if (expectedBoosterIndex < 0 || boosterLocation.side !== side || boosterLocation.index !== expectedBoosterIndex || !Number.isFinite(boosterLocation.instance.power)) return reject("booster-not-behind-attacker");
        booster = boosterLocation.instance; boosterCircle = boosterLocation.circle;
      }
      const battleId = `${state.matchId || "match"}:${command.actionId}`;
      const attackerZone = attackerLocation.circle || attackerLocation.zone;
      const targetZone = targetLocation.circle || targetLocation.zone;
      const powerOf = (instance, instanceSide, location) => Number(instance.power) + Number(instance.powerBoost || 0) + Number(instance.turnPowerBoost || 0) + serverContinuousPower(state, instanceSide, instance, location === "vanguard" ? "vanguard" : "rear-guard", { attackTargetZone: targetZone, attackerUid: attacker.uid, attackerZone }, engine);
      const attackerPlayerCount = engine.recordAttackCount(state, actorPlayerId, attacker.uid);
      attacker.rested = true;
      let boostPower = 0;
      if (booster) {
        booster.rested = true; boostPower = powerOf(booster, side, boosterCircle);
        boostEvent = engine.createGameEvent(state, {
          type: "unit.boosted", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
          sourceCardInstanceId: booster.uid, sourceOwnerPlayerId: booster.ownerPlayerId,
          sourceControllerPlayerId: booster.controllerPlayerId,
          cardInstanceId: booster.uid, subjectCardInstanceId: booster.uid,
          subjectOwnerPlayerId: booster.ownerPlayerId, subjectControllerPlayerId: booster.controllerPlayerId,
          boosterCardInstanceId: booster.uid, boostedCardInstanceId: attacker.uid,
          boosterCardName: booster.cardName || null, boostedCardName: attacker.cardName || null,
          boostedCardGrade: Number.isInteger(Number(attacker.grade)) ? Number(attacker.grade) : null,
          boostedCardClan: attacker.clan || null, boostedCardClans: attacker.clans || [],
          boostedCardLimitBreaks: attacker.hasLimitBreak4 === true ? [4] : [],
          previousLocation: boosterCircle, currentLocation: boosterCircle, targetLocation: targetZone,
          circle: boosterCircle, targetCardInstanceIds: [attacker.uid],
          phase: "battle", timingWindow: "boost-step", battleId,
          before: { rested: false }, after: { rested: true }
        });
      }
      const isVanguardAttack = attackerLocation.zone === "vanguard";
      state.pendingAttack = {
        battleId, attackerUid: attacker.uid, attackerSide: side, attackerZone, attackerPlayerId: actorPlayerId,
        defenderSide, targetUid: target.uid, targetZone, targetRearIndex: targetLocation.zone === "rear-guard" ? targetLocation.index : null,
        power: powerOf(attacker, side, attackerZone) + boostPower, targetPower: powerOf(target, defenderSide, targetZone), critical: Number(attacker.critical) + serverContinuousCritical(state, side, attacker, attackerLocation.zone === "vanguard" ? "vanguard" : "rear-guard", engine),
        boostUid: booster?.uid || null, boostPower, guardCards: [], defenderDone: false, perfectGuard: false,
        driveChecksRemaining: 0, driveChecksPerformed: 0, maxDriveChecks: isVanguardAttack ? 10 : 0,
        driveCountPrompt: false, driveCountChosen: !isVanguardAttack, awaitingDrive: false
      };
      events.push(engine.createGameEvent(state, {
        type: "attack.step-started", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId,
        sourceControllerPlayerId: attacker.controllerPlayerId,
        cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid,
        subjectOwnerPlayerId: attacker.ownerPlayerId, subjectControllerPlayerId: attacker.controllerPlayerId,
        previousLocation: attackerZone, currentLocation: attackerZone,
        phase: "battle", timingWindow: "attack-step-start", battleId,
        playerAttackCount: attackerPlayerCount, before: { rested: false }, after: { rested: true }
      }));
      if (boostEvent) events.push(boostEvent);
      events.push(engine.createGameEvent(state, {
        type: "unit.attacked", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId,
        sourceControllerPlayerId: attacker.controllerPlayerId,
        cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid,
        subjectOwnerPlayerId: attacker.ownerPlayerId, subjectControllerPlayerId: attacker.controllerPlayerId,
        previousLocation: attackerZone, currentLocation: attackerZone,
        targetCardInstanceIds: [target.uid], targetLocation: targetZone,
        boosterCardInstanceId: booster?.uid || null, battleId,
        phase: "battle", timingWindow: "attack-declared", playerAttackCount: attackerPlayerCount
      }));
      events.push(engine.createGameEvent(state, {
        type: "attack.declared", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId,
        sourceControllerPlayerId: attacker.controllerPlayerId,
        cardInstanceId: target.uid, subjectCardInstanceId: target.uid,
        subjectOwnerPlayerId: target.ownerPlayerId, subjectControllerPlayerId: target.controllerPlayerId,
        currentLocation: targetZone, targetCardInstanceIds: [target.uid], targetLocation: targetZone,
        attackingUnitInstanceId: attacker.uid, boosterCardInstanceId: booster?.uid || null,
        battleId, phase: "battle", timingWindow: "attack-declared"
      }));
    } else if (action === "endTurn") {
      if (Number(state.phase) !== 6) return reject("wrong-timing-window");
      state.pendingTurnEnd = { side, playerId: actorPlayerId, turn: state.turn, cleanupQueued: false };
      events.push(engine.createGameEvent(state, {
        type: "turn.ended", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        phase: "end", timingWindow: "turn-end"
      }));
      queueFollowupTriggers(state, events, engine);
      if (!state.pendingAbility && !(state.pendingAbilities || []).length) events.push(...continueTurnEnd(state, engine));
    } else if (action === "call") {
      if (Number(state.phase) !== 4) return reject("wrong-timing-window");
      if (!Array.isArray(player.hand) || !Array.isArray(player.rear) || !Array.isArray(player.drop)) return reject("invalid-call-zones");
      const sourceUid = command.payload?.cardInstanceId, rearIndex = command.payload?.rearIndex;
      if (!Number.isInteger(rearIndex) || rearIndex < 0 || rearIndex >= player.rear.length) return reject("invalid-call-circle");
      const handIndex = player.hand.findIndex(card => card?.uid === sourceUid);
      if (typeof sourceUid !== "string" || handIndex < 0) return reject("call-source-not-in-hand");
      const called = player.hand[handIndex], replaced = player.rear[rearIndex];
      if (called.ownerPlayerId !== actorPlayerId || called.controllerPlayerId !== actorPlayerId) return reject("call-source-not-owned-and-controlled");
      if (called.unitCard !== true || called.gDeckCard === true || called.gGuardian === true) return reject("card-cannot-be-called-to-rear-guard");
      if (replaced?.locked === true) return reject("call-circle-is-locked");
      const circle = rearIndex < 5
        ? ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right"][rearIndex]
        : `accel-${rearIndex - 4}`;
      if (replaced) {
        const replacedCircle = replaced.circle || circle;
        player.rear[rearIndex] = null;
        player.drop.push(replaced);
        events.push(engine.createGameEvent(state, {
          type: "card.retired", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
          sourceCardInstanceId: replaced.uid, sourceOwnerPlayerId: replaced.ownerPlayerId || actorPlayerId,
          sourceControllerPlayerId: replaced.controllerPlayerId || actorPlayerId,
          cardInstanceId: replaced.uid, subjectCardInstanceId: replaced.uid,
          subjectOwnerPlayerId: replaced.ownerPlayerId || actorPlayerId,
          subjectControllerPlayerId: replaced.controllerPlayerId || actorPlayerId,
          previousLocation: replacedCircle, currentLocation: "drop", circle: replacedCircle,
          phase: "main", timingWindow: "normal-call-replacement"
        }));
      }
      player.hand.splice(handIndex, 1);
      called.rested = false;
      called.circle = circle;
      player.rear[rearIndex] = called;
      events.push(engine.createGameEvent(state, {
        type: "card.placed", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: called.uid, sourceOwnerPlayerId: called.ownerPlayerId,
        sourceControllerPlayerId: called.controllerPlayerId,
        cardInstanceId: called.uid, subjectCardInstanceId: called.uid,
        subjectOwnerPlayerId: called.ownerPlayerId, subjectControllerPlayerId: called.controllerPlayerId,
        previousLocation: "hand", currentLocation: circle, circle,
        phase: "main", timingWindow: "normal-call"
      }));
    } else if (action === "ride") {
      if (Number(state.phase) !== 2) return reject("wrong-timing-window");
      if (state.ridePerformed === true) return reject("ride-already-performed");
      if (!Array.isArray(player.hand) || !Array.isArray(player.soul) || !player.vanguard) return reject("invalid-ride-zones");
      const sourceUid = command.payload?.cardInstanceId;
      const handIndex = player.hand.findIndex(card => card?.uid === sourceUid);
      if (typeof sourceUid !== "string" || handIndex < 0) return reject("ride-source-not-in-hand");
      const rider = player.hand[handIndex], previousVanguard = player.vanguard;
      if (rider.ownerPlayerId !== actorPlayerId || rider.controllerPlayerId !== actorPlayerId) return reject("ride-source-not-owned-and-controlled");
      const riderGrade = Number(rider.grade), vanguardGrade = Number(previousVanguard.grade);
      if (rider.unitCard !== true || rider.gDeckCard === true || rider.cannotBeRidden === true) return reject("card-cannot-be-ridden");
      if (!Number.isInteger(riderGrade) || !Number.isInteger(vanguardGrade) || riderGrade < vanguardGrade || riderGrade > vanguardGrade + 1) return reject("illegal-ride-grade");
      const sameNameRestricted = (player.crests || []).some(card => card?.sameNameRideRestriction === true);
      if (sameNameRestricted) {
        const nameKey = value => String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!rider.cardName || !previousVanguard.cardName) return reject("ride-name-metadata-missing");
        if (nameKey(rider.cardName) !== nameKey(previousVanguard.cardName)) return reject("crest-requires-same-name-ride");
      }
      if (riderGrade >= 3) engine.recordFightRide?.(player, { grade: riderGrade });
      player.hand.splice(handIndex, 1);
      player.soul.push(previousVanguard);
      player.vanguard = { ...rider, rested: false };
      state.ridePerformed = true;
      events.push(engine.createGameEvent(state, {
        type: "card.moved", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: previousVanguard.uid, sourceOwnerPlayerId: previousVanguard.ownerPlayerId || actorPlayerId,
        sourceControllerPlayerId: previousVanguard.controllerPlayerId || actorPlayerId,
        cardInstanceId: previousVanguard.uid, subjectCardInstanceId: previousVanguard.uid,
        subjectOwnerPlayerId: previousVanguard.ownerPlayerId || actorPlayerId,
        subjectControllerPlayerId: previousVanguard.controllerPlayerId || actorPlayerId,
        previousLocation: "vanguard", currentLocation: "soul", phase: "ride", timingWindow: "normal-ride"
      }));
      events.push(engine.createGameEvent(state, {
        type: "card.ridden", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName || rider.name || null, sourceOwnerPlayerId: rider.ownerPlayerId,
        sourceControllerPlayerId: rider.controllerPlayerId, sourceCardClan: rider.clan || null, sourceCardClans: rider.clans || [],
        cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
        subjectOwnerPlayerId: rider.ownerPlayerId, subjectControllerPlayerId: rider.controllerPlayerId,
        previousLocation: "hand", currentLocation: "vanguard", targetCardInstanceIds: [previousVanguard.uid],
        targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard",
        phase: "ride", timingWindow: "normal-ride"
      }));
    } else if (action === "stride") {
      if (Number(state.phase) !== 3) return reject("wrong-timing-window");
      if (state.stridePerformed === true) return reject("stride-already-performed");
      if (!Array.isArray(player.gDeck) || !Array.isArray(player.hand) || !Array.isArray(player.drop) || !player.vanguard) return reject("invalid-stride-zones");
      const opposing = Object.values(state.players || {}).find(candidate => candidate && candidate !== player);
      const ownGrade = Number(player.vanguard.grade), opposingGrade = Number(opposing?.vanguard?.grade);
      const turnStartGrade = Number(state.turnStartGrades?.[side]);
      if (!((ownGrade >= 3 && opposingGrade >= 3) || turnStartGrade >= 3)) return reject("stride-grade-requirement-not-met");
      const strideUid = command.payload?.strideCardInstanceId, submittedCosts = command.payload?.costCardInstanceIds;
      if (typeof strideUid !== "string" || !Array.isArray(submittedCosts) || !submittedCosts.length || submittedCosts.some(uid => typeof uid !== "string") || new Set(submittedCosts).size !== submittedCosts.length) return reject("invalid-stride-payment");
      const strideIndex = player.gDeck.findIndex(card => card?.uid === strideUid);
      if (strideIndex < 0) return reject("stride-card-not-in-g-deck");
      const strideCard = player.gDeck[strideIndex];
      if (strideCard.faceUp !== false || strideCard.gDeckCard !== true || strideCard.gGuardian === true || strideCard.ownerPlayerId !== actorPlayerId || strideCard.controllerPlayerId !== actorPlayerId) return reject("card-cannot-stride");
      const selectedCosts = submittedCosts.map(uid => player.hand.find(card => card?.uid === uid));
      if (selectedCosts.some(card => !card || card.ownerPlayerId !== actorPlayerId || card.controllerPlayerId !== actorPlayerId)) return reject("stride-cost-card-not-in-own-hand");
      let costLegal;
      if (strideCard.ultimateStride === true) {
        const hearts = player.vanguard.strideHearts || (player.vanguard.strideHeart ? [player.vanguard.strideHeart] : []);
        const nameReferences = [player.vanguard, ...hearts].filter(Boolean);
        costLegal = selectedCosts.length === 1 && nameReferences.some(reference => reviewedCardsShareName(reference, selectedCosts[0], engine));
      } else {
        const totalGrade = selectedCosts.reduce((sum, card) => {
          const grade = reviewedStrideCostGrade(card, engine);
          return grade === null ? Number.NaN : sum + grade;
        }, 0);
        costLegal = Number.isFinite(totalGrade) && totalGrade >= 3;
      }
      if (!costLegal) return reject(strideCard.ultimateStride === true ? "ultimate-stride-cost-not-met" : "stride-cost-grade-insufficient");

      const previousVanguard = player.vanguard;
      const hearts = (previousVanguard.strideHearts || (previousVanguard.strideHeart ? [previousVanguard.strideHeart] : [])).map(card => ({ ...card }));
      const previousHeart = { ...previousVanguard };
      delete previousHeart.strideHeart; delete previousHeart.strideHearts;
      hearts.push(previousHeart);
      const heart = hearts.find(card => card?.gDeckCard !== true && card?.gGuardian !== true);
      if (!heart) return reject("stride-heart-not-found");

      const costSet = new Set(submittedCosts);
      player.hand = player.hand.filter(card => !costSet.has(card.uid));
      for (const card of selectedCosts) {
        player.drop.push(card);
        events.push(engine.createGameEvent(state, {
          type: "card.discarded", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
          sourceCardInstanceId: card.uid, sourceOwnerPlayerId: card.ownerPlayerId,
          sourceControllerPlayerId: card.controllerPlayerId, cardInstanceId: card.uid,
          subjectCardInstanceId: card.uid, subjectOwnerPlayerId: card.ownerPlayerId,
          subjectControllerPlayerId: card.controllerPlayerId, previousLocation: "hand", currentLocation: "drop",
          phase: "stride", timingWindow: "stride-cost"
        }));
      }
      player.gDeck.splice(strideIndex, 1);
      const stridden = { ...strideCard, faceUp: true, rested: Boolean(previousVanguard.rested), circle: "vanguard", strideHeart: heart, strideHearts: hearts };
      player.vanguard = stridden;
      state.stridePerformed = true;
      events.push(engine.createGameEvent(state, {
        type: "card.placed", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: stridden.uid, sourceOwnerPlayerId: stridden.ownerPlayerId,
        sourceControllerPlayerId: stridden.controllerPlayerId, cardInstanceId: stridden.uid,
        subjectCardInstanceId: stridden.uid, subjectOwnerPlayerId: stridden.ownerPlayerId,
        subjectControllerPlayerId: stridden.controllerPlayerId, previousLocation: "g-deck",
        currentLocation: "vanguard", circle: "vanguard", phase: "stride", timingWindow: "normal-stride"
      }));
    } else if (action === "advance") {
      const phase = Number(state.phase);
      if (!Number.isInteger(phase) || phase < 0 || phase >= 6) return reject("wrong-timing-window");
      const nextPhase = phase + 1;
      if (nextPhase === 6) return reject("use-end-turn-action");
      const phaseNames = ["stand", "draw", "ride", "stride", "main", "battle", "end"];
      if (nextPhase === 1 && state.drewThisTurn === true) return reject("draw-already-performed");
      if (nextPhase === 1 && (!Array.isArray(player.deck) || !Array.isArray(player.hand))) return reject("invalid-player-zones");
      state.phase = nextPhase;
      emitPhaseChange(phaseNames[phase], phaseNames[nextPhase]);
      if (nextPhase === 1) {
        const top = player.deck.pop();
        if (!top) {
          const winnerSide = Object.keys(state.players).find(candidate => candidate !== side);
          state.ended = true; state.winnerSide = winnerSide || null; state.loserSide = side; state.endReason = "deck-empty";
          events.push(engine.createGameEvent(state, { type: "game.ended", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId, phase: nextPhase, timingWindow: "draw-phase", reason: "deck-empty" }));
        } else {
          player.hand.push(top); state.drewThisTurn = true;
          events.push(engine.createGameEvent(state, {
            type: "card.drawn", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
            sourceOwnerPlayerId: null, sourceControllerPlayerId: actorPlayerId,
            cardInstanceId: top.uid, subjectCardInstanceId: top.uid,
            subjectOwnerPlayerId: top.ownerPlayerId || actorPlayerId,
            subjectControllerPlayerId: top.controllerPlayerId || actorPlayerId,
            previousLocation: "deck", currentLocation: "hand", phase: nextPhase, timingWindow: "normal-draw-phase"
          }));
        }
      }
      if (nextPhase === 0) for (const card of [player.vanguard, ...(player.rear || [])]) if (card) card.rested = false;
    } else if (action === "setupRoll") {
      const setup = state.preMatch;
      if (!setup || setup.stage !== "roll" || !setup.rolls || setup.rolls[side] !== null) return reject("setup-roll-not-available");
      let roll;
      try { roll = secureRandomIndex(6) + 1; } catch { return reject("secure-random-unavailable"); }
      setup.rolls[side] = roll;
      const [hostRoll, guestRoll] = [setup.rolls.human, setup.rolls.bot];
      if (hostRoll !== null && guestRoll !== null) {
        if (hostRoll === guestRoll) { setup.rolls = { human: null, bot: null }; setup.winner = null; }
        else setup.winner = hostRoll > guestRoll ? "human" : "bot";
      }
      events.push(engine.createGameEvent(state, {
        type: "setup.roll-completed", actingPlayerId: actorPlayerId, turnPlayerId: null,
        roll, rollWinnerSide: setup.winner, phase: "pre-match", timingWindow: "setup-roll"
      }));
    } else if (action === "setupChoice") {
      const setup = state.preMatch, firstSide = command.payload?.firstSide;
      if (!setup || setup.stage !== "roll" || !["human", "bot"].includes(setup.winner) || setup.winner !== side) return reject("setup-choice-not-available");
      if (firstSide !== "human" && firstSide !== "bot") return reject("invalid-first-player-choice");
      setup.stage = "mulligan"; setup.firstSide = firstSide;
      events.push(engine.createGameEvent(state, {
        type: "setup.first-player-chosen", actingPlayerId: actorPlayerId, turnPlayerId: null,
        firstSide, phase: "pre-match", timingWindow: "setup-first-player-choice"
      }));
    } else if (action === "setupMulligan") {
      const setup = state.preMatch, submitted = command.payload?.cardInstanceIds;
      if (!setup || setup.stage !== "mulligan" || setup.mulliganDone?.[side] === true) return reject("setup-mulligan-not-available");
      if (side !== setup.firstSide && setup.mulliganDone?.[setup.firstSide] !== true) return reject("first-player-mulligan-must-resolve-first");
      if (!Array.isArray(submitted) || submitted.length > 5 || submitted.some(uid => typeof uid !== "string") || new Set(submitted).size !== submitted.length) return reject("invalid-mulligan-selection");
      if (!Array.isArray(player.hand) || !Array.isArray(player.deck)) return reject("invalid-mulligan-zones");
      const selected = new Set(submitted);
      const returned = player.hand.filter(card => selected.has(card?.uid));
      if (returned.length !== submitted.length || returned.some(card => card.ownerPlayerId !== actorPlayerId || card.controllerPlayerId !== actorPlayerId)) return reject("mulligan-card-not-in-own-hand");
      const otherSide = side === "human" ? "bot" : "human";
      if (setup.mulliganDone?.[otherSide] === true && (!setup.firstSide || !state.players[setup.firstSide])) return reject("first-player-choice-missing");
      let shuffledDeck, drawn;
      try {
        shuffledDeck = [...player.deck];
        if (returned.length) shuffledDeck.unshift(...returned);
        if (shuffledDeck.length < returned.length) return reject("mulligan-deck-too-small");
        drawn = [];
        for (let index = 0; index < returned.length; index++) drawn.push(shuffledDeck.pop());
        if (returned.length) secureShuffle(shuffledDeck);
      } catch { return reject("secure-random-unavailable"); }
      player.hand = [...player.hand.filter(card => !selected.has(card.uid)), ...drawn];
      player.deck = shuffledDeck;
      setup.mulliganDone[side] = true;
      for (const card of returned) events.push(engine.createGameEvent(state, {
        type: "card.moved", actingPlayerId: actorPlayerId, turnPlayerId: null,
        sourceCardInstanceId: card.uid, sourceOwnerPlayerId: card.ownerPlayerId,
        sourceControllerPlayerId: card.controllerPlayerId, cardInstanceId: card.uid,
        subjectCardInstanceId: card.uid, subjectOwnerPlayerId: card.ownerPlayerId,
        subjectControllerPlayerId: card.controllerPlayerId, previousLocation: "hand",
        currentLocation: "deck", phase: "pre-match", timingWindow: "opening-hand-mulligan-return"
      }));
      for (const card of drawn) events.push(engine.createGameEvent(state, {
        type: "card.drawn", actingPlayerId: actorPlayerId, turnPlayerId: null,
        cardInstanceId: card.uid, subjectCardInstanceId: card.uid,
        subjectOwnerPlayerId: card.ownerPlayerId, subjectControllerPlayerId: card.controllerPlayerId,
        previousLocation: "deck", currentLocation: "hand", phase: "pre-match",
        timingWindow: "opening-hand-mulligan-draw"
      }));
      if (setup.mulliganDone.human && setup.mulliganDone.bot) {
        state.preMatch = null; state.firstSide = setup.firstSide; state.side = setup.firstSide;
        state.phase = 0; state.turn = 1; state.drewThisTurn = false; state.ridePerformed = false;
        const firstPlayer = state.players[setup.firstSide];
        state.turnStartGrades ||= {};
        state.turnStartGrades[setup.firstSide] = Number(firstPlayer.vanguard?.grade ?? -1);
        events.push(engine.createGameEvent(state, {
          type: "turn.started", actingPlayerId: firstPlayer.playerId, turnPlayerId: firstPlayer.playerId,
          phase: "stand", timingWindow: "first-turn-start", before: { phase: "pre-match" }, after: { phase: "stand" }
        }));
      }
    } else if (action === "draw") {
      if (Number(state.phase) !== 1) return reject("wrong-timing-window");
      if (state.drewThisTurn === true) return reject("draw-already-performed");
      if (!Array.isArray(player.deck) || !Array.isArray(player.hand)) return reject("invalid-player-zones");
      const top = player.deck.pop();
      if (!top) {
        const winnerSide = Object.keys(state.players).find(candidate => candidate !== side);
        state.ended = true; state.winnerSide = winnerSide || null; state.loserSide = side; state.endReason = "deck-empty";
        events.push(engine.createGameEvent(state, { type: "game.ended", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId, phase: state.phase, timingWindow: "draw-phase", reason: "deck-empty" }));
      } else {
        player.hand.push(top); state.drewThisTurn = true;
        events.push(engine.createGameEvent(state, {
          type: "card.drawn", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
          sourceOwnerPlayerId: null, sourceControllerPlayerId: actorPlayerId,
          cardInstanceId: top.uid, subjectCardInstanceId: top.uid,
          subjectOwnerPlayerId: top.ownerPlayerId || actorPlayerId,
          subjectControllerPlayerId: top.controllerPlayerId || actorPlayerId,
          previousLocation: "deck", currentLocation: "hand", phase: state.phase, timingWindow: "normal-draw-phase"
        }));
      }
    } else return reject("unsupported-game-action");
    const triggerEvents = action === "setupMulligan"
      ? (state.preMatch ? [] : events.filter(event => event.type === "turn.started"))
      : events;
    queueFollowupTriggers(state, triggerEvents, engine);
    const completedCheck = completePendingCheckCard(state, actorPlayerId, engine);
    if (completedCheck) { events.push(...completedCheck); queueFollowupTriggers(state, completedCheck, engine); }
    const damageLoss = finalizePendingDamageLoss(state, actorPlayerId, engine);
    if (damageLoss) events.push(damageLoss);
    finalizeClosedBattle(state);
    state.processedActionIds ||= [];
    state.processedActionIds.push(command.actionId);
    state.stateVersion = Number(state.stateVersion || 0) + 1;
    return { ok: true, state, events, ...(state.endReason === "deck-empty" ? { winnerSide: state.winnerSide, loserSide: side } : {}) };
  }

  function applyManualAbilityActivation(state, command, seats, engine) {
    if (!state || !command || !engine) return reject("invalid-reducer-input");
    const side = playerSideForSeat(state, command.actorAuthUid, seats);
    if (!side) return reject("actor-not-seated");
    const player = state.players[side], actorPlayerId = player.playerId, payload = command.payload || {};
    if (Array.isArray(state.processedActionIds) && state.processedActionIds.includes(command.actionId)) return reject("duplicate-action");
    if (Number(command.expectedStateVersion) !== Number(state.stateVersion)) return reject("stale-state-version");
    if (state.side !== side || Number(state.phase) !== 4) return reject(state.side !== side ? "not-actor-turn" : "wrong-timing-window");
    if (state.pendingAbility || state.pendingTrigger || state.pendingAttack || state.pendingTurnEnd || (state.pendingAbilities || []).length) return reject("resolution-in-progress");
    const sourceUid = payload.sourceCardInstanceId, abilityId = payload.abilityId;
    if (typeof sourceUid !== "string" || typeof abilityId !== "string") return reject("invalid-skill-selection");
    const located = engine.locateCardInstance(state, sourceUid);
    if (!located || located.ambiguous || located.controllerPlayerId !== actorPlayerId || !["vanguard", "rear-guard"].includes(located.zone)) return reject("skill-source-not-controlled-on-field");

    // Only definitions explicitly registered by the trusted server can be requested.
    const reviewed = engine.getReviewedAbilityDefinitionsForCard?.(located.instance.cardId) || [];
    const definition = reviewed.find(item => item.id === abilityId);
    if (!definition || definition.kind !== "ACT" || String(definition.cardId) !== String(located.instance.cardId)) return reject("unreviewed-or-wrong-ability");
    const parsed = engine.parseCardAbilities({ id: String(located.instance.cardId), text: definition.printedText });
    const parsedAbility = parsed.find(item => item.kind === "ACT");
    if (!parsedAbility) return reject("invalid-reviewed-ability-text");
    const ability = { ...parsedAbility, id: definition.id, cardId: String(definition.cardId), definition, effects: definition.effects };
    if (!Array.isArray(ability.definition?.effects) || !ability.definition.effects.length || ability.definition.effects.some(step => !SERVER_EFFECT_OPS.has(step?.op))) return reject("unsupported-server-ability");
    if (ability.conditions?.length || ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review") return reject("unmodeled-activation-requirement");
    const sourceZone = located.circle || located.zone;
    const inPermittedZone = !ability.requiredLocation?.length || ability.requiredLocation.includes(sourceZone) || (sourceZone.startsWith("rear-") && ability.requiredLocation.includes("rear-guard"));
    const selection = payload.selection || {}, costs = selection.costSelections || {};
    if (!costs || typeof costs !== "object" || Array.isArray(costs) || Object.keys(costs).some(key => !["cb", "sb", "discard", "reveal"].includes(key))) return reject("invalid-cost-selection");
    let usageKey;
    try { usageKey = engine.abilityUsageKey(state.turn, actorPlayerId, sourceUid, ability.id, ability.usageRestriction, definition.cardName, ability.printedText); }
    catch { return reject("missing-usage-identity"); }
    const used = Boolean((player.usedAbilities || []).includes(usageKey));
    const permitted = engine.canActivateManualAbility(ability, {
      cardInstanceId: sourceUid, controllerPlayerId: located.controllerPlayerId, actorPlayerId,
      turnPlayerId: state.players[state.side]?.playerId, phase: "main", inPermittedZone,
      resolutionBlocked: false, alreadyUsed: used,
      conditions: {},
      resources: {
        faceUpDamage: (player.damage || []).filter(card => !card.faceDown).length,
        soulCount: (player.soul || []).length,
        discardableHand: (player.hand || []).filter(card => card.uid !== sourceUid).length,
        sourceRested: Boolean(located.instance.rested),
        sourceCanMoveToSoul: located.side === side,
        sourceCanRetire: located.side === side && located.zone === "rear-guard"
      }
    });
    if (!permitted.ok) return reject(`activation-${permitted.reason}`);

    const targetResolution = locateReviewedEffectTarget(state, { ability, eventContext: {} }, located.instance, actorPlayerId, selection, engine);
    if (!targetResolution.ok) return reject(targetResolution.reason);
    const eventLog = [];
    const context = {
      source: located.instance, sourceInPlay: true, sourceZone, sourceCircle: located.circle,
      side, player, match: state, turnId: state.turn, actorPlayerId,
      costSelections: costs, target: located.instance, targetInPlay: true,
      ...targetResolution.context,
      emitEvent: event => eventLog.push(event)
    };
    const result = engine.resolveEffectProgram(ability.definition.effects, engine.EFFECT_HANDLERS, context, draft => {
      const paid = engine.payAbilityCosts(ability, {
        ...draft, turnId: state.turn, actorPlayerId,
        cardDefinitionForInstance: () => definition.cardName ? { name: definition.cardName } : null
      }, { cb: costs.cb || [], sb: costs.sb || [], discard: costs.discard || [], reveal: costs.reveal || [] });
      return paid.ok;
    });
    if (!result.ok) return reject(result.reason || "effect-resolution-rejected");
    state.processedActionIds ||= [];
    state.processedActionIds.push(command.actionId);
    state.stateVersion = Number(state.stateVersion || 0) + 1;
    const events = structureResolutionEvents(state, eventLog, located.instance, actorPlayerId, engine);
    queueFollowupTriggers(state, events, engine);
    const completedCheck = completePendingCheckCard(state, actorPlayerId, engine);
    if (completedCheck) { events.push(...completedCheck); queueFollowupTriggers(state, completedCheck, engine); }
    const damageLoss = finalizePendingDamageLoss(state, actorPlayerId, engine);
    if (damageLoss) events.push(damageLoss);
    finalizeClosedBattle(state);
    return { ok: true, state, events, resolvedAbilityId: ability.id };
  }

  function applyAbilityDecision(state, command, seats, engine) {
    if (!state || !command || !engine) return reject("invalid-reducer-input");
    const side = playerSideForSeat(state, command.actorAuthUid, seats);
    if (!side) return reject("actor-not-seated");
    const actorPlayerId = state.players[side].playerId;
    if (Array.isArray(state.processedActionIds) && state.processedActionIds.includes(command.actionId)) return reject("duplicate-action");
    const pending = state.pendingAbility;
    if (state.pendingTrigger) return reject("trigger-resolution-pending");
    const selection = command.payload?.selection;
    const request = {
      actionId: command.actionId,
      matchId: state.matchId,
      expectedStateVersion: command.expectedStateVersion,
      actorPlayerId,
      accept: command.payload?.accept,
      selection
    };
    const legal = engine.validateAbilityDecision(state, request, actorPlayerId, pending);
    if (!legal.ok) return reject(legal.reason);
    const ability = pending?.ability;
    const program = ability?.definition?.effects;
    const ready = engine.autoAbilityReadiness(ability);
    if (!ready?.ok) return reject(`ability-not-ready:${ready?.reason || "unknown"}`);
    if (ability?.kind !== "AUTO" || ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review" || !Array.isArray(program) || !program.length || program.some(step => !SERVER_EFFECT_OPS.has(step?.op))) return reject("unsupported-server-ability");
    if (pending.side !== side || pending.instance?.uid !== selection?.instanceUid) return reject("ability-owner-mismatch");

    const located = engine.locateCardInstance(state, pending.instance.uid);
    if (!located || located.ambiguous || located.instance?.cardId !== pending.instance.cardId) {
      return reject("ability-source-not-found");
    }
    if (located.controllerPlayerId !== actorPlayerId || (ability.definition.cardId && String(ability.definition.cardId) !== String(located.instance.cardId))) return reject("source-identity-mismatch");
    const sourceZone = located.circle || located.zone;
    const sourceInPlay = located.zone === "vanguard" || located.zone === "rear-guard";
    const triggerContext = pending.eventContext;
    const triggerEvent = triggerContext?.gameEvent;
    if (!triggerContext?.eventId || !triggerEvent || triggerEvent.eventId !== triggerContext.eventId) return reject("trigger-event-missing");
    if (!engine.eventMatchesAbilityTrigger(ability, triggerContext.event, triggerEvent, located.instance.uid, pending.field || sourceZone, triggerContext.subjectZone || triggerEvent.currentLocation, actorPlayerId)) return reject("trigger-event-mismatch");
    if (!engine.canResolveAbilitySource(ability, pending, actorPlayerId, located.instance, sourceInPlay)) return reject("ability-source-no-longer-resolvable");
    const player = state.players[side];
    const targetIds = command.payload.selection.engorgeTargetUids || [];
    if (program.some(step => step.op === "engorge") && command.payload.accept && (!Array.isArray(targetIds) || !targetIds.length)) return reject("invalid-engorge-selection");
    const selectedEffectTarget = command.payload.accept
      ? locateReviewedEffectTarget(state, pending, located.instance, actorPlayerId, selection, engine)
      : { ok: true, context: { target: located.instance, targetInPlay: sourceInPlay } };
    if (!selectedEffectTarget.ok) return reject(selectedEffectTarget.reason);
    const engorgeTargetZones = Object.fromEntries(targetIds.map(uid => {
      const target = engine.locateCardInstance(state, uid);
      return [uid, target?.side === side && target.zone === "rear-guard" ? target.circle : null];
    }));

    const eventLog = [];
    const costSelections = selection.costSelections || {};
    const context = {
      source: located.instance,
      sourceInPlay,
      sourceZone,
      sourceCircle: located.circle,
      side,
      player,
      match: state,
      turnId: state.turn,
      actorPlayerId,
      costSelections,
      selectedDamageUids: selection.damageUids || [],
      engorgeTargetUids: targetIds,
      engorgeTargetZones,
      effectUid: selection.effectUid,
      effectChoice: selection.effectChoice,
      callZone: selection.callZone,
      cardDefinitionForInstance: serverCardDefinition,
      revelationTopUid: selection.revelationTopUid,
      ...selectedEffectTarget.context,
      sourceControllerPlayerId: actorPlayerId,
      emitEvent: event => eventLog.push(event)
    };

    if (command.payload.accept && selection.payCost !== false) {
      const result = engine.resolveEffectProgram(program, engine.EFFECT_HANDLERS, context, draft => {
        const paid = engine.payAbilityCosts(ability, {
          ...draft,
          turnId: state.turn,
          actorPlayerId,
          cardDefinitionForInstance: () => null
        }, {
          cb: costSelections.cb || [], sb: costSelections.sb || [],
          discard: costSelections.discard || [], reveal: costSelections.reveal || [],
          effectUid: selection.effectUid
        });
        return paid.ok;
      });
      if (!result.ok) return reject(result.reason || "effect-resolution-rejected");
    }

    state.processedActionIds ||= [];
    state.processedActionIds.push(command.actionId);
    state.pendingAbility = null;
    state.stateVersion = Number(state.stateVersion || 0) + 1;
    const events = structureResolutionEvents(state, eventLog, located.instance, actorPlayerId, engine);
    state.pendingAbility = null;
    queueFollowupTriggers(state, events, engine);
    const completedCheck = completePendingCheckCard(state, actorPlayerId, engine);
    if (completedCheck) { events.push(...completedCheck); queueFollowupTriggers(state, completedCheck, engine); }
    const damageLoss = finalizePendingDamageLoss(state, actorPlayerId, engine);
    if (damageLoss) events.push(damageLoss);
    finalizeClosedBattle(state);
    if (state.pendingTurnEnd && !state.pendingAbility && !(state.pendingAbilities || []).length) events.push(...continueTurnEnd(state, engine));
    return { ok: true, state, events, resolvedAbilityId: ability.id };
  }

  return Object.freeze({ playerSideForSeat, buildConditionContext, discoverAutoTriggers, returnStriddenVanguard, continueTurnEnd, applyGameAction, applyAbilityDecision, applyManualAbilityActivation, applyEngorgeDecision: applyAbilityDecision });
});
