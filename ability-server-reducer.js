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
  function resolveUsageRestriction(definition, parsedAbility) {
    return definition?.usageRestriction?.type ? definition.usageRestriction : parsedAbility?.usageRestriction || null;
  }
  function supportsServerEffectOperation(operation) { return SERVER_EFFECT_OPS.has(operation); }

  function isExactOracleTopDeckOrderAbility(ability) {
    const definition = ability?.definition, printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && String(definition?.cardId) === "cfa-2" &&
      String(ability.cardId) === "cfa-2" && ability.id === "cfa-2:0" &&
      printed === "AUTO: When this unit is placed on VC or RC, if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on the top or the bottom of your deck." &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" && ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["vanguard", "rear-guard"]) &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "controller-vanguard-has-clan", value: "Oracle Think Tank" }]) &&
      !(ability.costs || []).length && definition.effects?.length === 1 && definition.effects[0]?.op === "reorder-deck-card" &&
      definition.effects[0].target === "chosen" && definition.effects[0].destination === "player-choice";
  }

  function isExactSuccessAbility(ability) {
    const definition = ability?.definition, effect = definition?.effects?.[0];
    const threshold = Number(definition?.successThreshold);
    const expectedCircle = definition?.source?.patternId === "auto-success-rear-guard-power-threshold-v1";
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const printedCircle = printed.match(/^AUTO \[(VC|RC|VC\/RC)\]/i)?.[1]?.toUpperCase();
    const expectedLocations = printedCircle === "VC" ? ["vanguard"] : printedCircle === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"];
    return expectedCircle && ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      String(ability.cardId) === String(definition.cardId) && ability.id === `${definition.cardId}:${String(ability.id).split(":").at(-1)}` &&
      [20000, 25000].includes(threshold) && Number(effect?.threshold) === threshold && effect?.op === "set-successful" && effect?.target === "source" &&
      definition.trigger?.eventType === "characteristic.changed" && definition.trigger?.subject === "controller" && definition.trigger?.turnRelation === "controller" &&
      JSON.stringify(definition.requiredLocation || []) === JSON.stringify(expectedLocations) &&
      JSON.stringify(definition.conditions || []) === JSON.stringify([{ type: "controller-turn" }]) &&
      /^AUTO \[(?:VC|RC|VC\/RC)\]: Success (?:20000|25000)(?: \(When your rear-guards power becomes (?:20000|25000) or greater, this unit becomes successful until end of turn\.\))?\.?$/i.test(printed) &&
      Number(printed.match(/Success (\d+)/i)?.[1]) === threshold;
  }

  function isExactClanCounterBlastAttackPowerAbility(ability) {
    const expected = new Map([["cfa-1123", "Gold Paladin"], ["cfa-1234", "Bermuda Triangle"], ["cfa-1301", "Angel Feather"], ["cfa-1409", "Shadow Paladin"], ["cfa-1429", "Pale Moon"], ["cfa-1509", "Link Joker"], ["cfa-1521", "Dark Irregulars"], ["cfa-1604", "Nova Grappler"], ["cfa-1642", "Great Nature"], ["cfa-1669", "Kagero"], ["cfa-1758", "Neo Nectar"]]);
    const definition = ability?.definition, cardId = String(ability?.cardId || ""), clan = expected.get(cardId);
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
    const ending = cardId === "cfa-1123" ? "the end of that battle" : "end of that battle";
    const article = /^[aeiou]/i.test(clan || "") ? "an" : "a";
    const expectedText = `AUTO [VC/RC]: [Counter Blast 1-«${clan || ""}»] When this unit attacks, if you have ${article} «${clan || ""}» vanguard, you may pay the cost. If you do, this unit gets power +4000 until ${ending}.`;
    return Boolean(clan && ability?.kind === "AUTO" && definition?.kind === "AUTO" && ability.id === `${cardId}:0` &&
      definition?.source?.patternId === "auto-own-attack-clan-counter-blast-power-battle-v1" && printed === expectedText &&
      ability.trigger?.eventType === "unit.attacked" && ability.trigger?.subject === "source" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard", "rear-guard"]) &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "controller-vanguard-has-clan", value: clan }]) &&
      JSON.stringify(ability.costs || []) === JSON.stringify([{ type: "counter-blast", count: 1, filter: { clan } }]) &&
      definition?.optional === true && definition?.choicesReviewed === true && definition.effects?.length === 1 &&
      definition.effects[0]?.op === "modify-power" && definition.effects[0]?.target === "source" &&
      Number(definition.effects[0]?.amount) === 4000 && definition.effects[0]?.duration === "battle");
  }

  function isExactClanSoulBlastAttackPowerAbility(ability) {
    const expected = new Map([["cfa-1798", ["Genesis", 3, 4000]], ["cfa-520", ["Kagero", 1, 3000]], ["cfa-605", ["Spike Brothers", 1, 3000]], ["cfa-646", ["Royal Paladin", 1, 3000]], ["cfa-844", ["Narukami", 1, 3000]]]);
    const cardId = String(ability?.cardId || ""), [clan, soul, power] = expected.get(cardId) || [];
    const definition = ability?.definition;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
    const expectedText = `AUTO [VC/RC]: [Soul Blast ${soul}] When this unit attacks, if you have a «${clan || ""}» vanguard, you may pay the cost. If you do, this unit gets power +${power} until end of that battle.`;
    return Boolean(clan && ability?.id === `${cardId}:0` && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-own-attack-clan-soul-blast-power-battle-v1" && printed === expectedText &&
      ability.trigger?.eventType === "unit.attacked" && ability.trigger?.subject === "source" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard", "rear-guard"]) &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "controller-vanguard-has-clan", value: clan }]) &&
      JSON.stringify(ability.costs || []) === JSON.stringify([{ type: "soul-blast", count: soul }]) &&
      definition.optional === true && definition.choicesReviewed === true && definition.effects?.length === 1 &&
      definition.effects[0]?.op === "modify-power" && definition.effects[0]?.target === "source" &&
      Number(definition.effects[0]?.amount) === power && definition.effects[0]?.duration === "battle");
  }
  function exactClanSoulBlastAttackEventMatches(state, ability, source, located, event, actorPlayerId) {
    const attack = state?.pendingAttack, player = located && state.players?.[located.side];
    const sourceZone = located?.circle || located?.zone;
    return isExactClanSoulBlastAttackPowerAbility(ability) && event?.type === "unit.attacked" && Boolean(event.eventId && event.battleId) &&
      event.battleId === attack?.battleId && event.sourceCardInstanceId === source?.uid && event.cardInstanceId === source?.uid &&
      event.subjectCardInstanceId === source?.uid && (event.attackingCardInstanceIds || []).includes(source?.uid) &&
      event.sourceOwnerPlayerId === located?.ownerPlayerId && event.sourceControllerPlayerId === actorPlayerId &&
      event.subjectControllerPlayerId === actorPlayerId && event.actingPlayerId === actorPlayerId && event.turnPlayerId === actorPlayerId &&
      event.phase === "battle" && event.timingWindow === "attack-declared" && event.currentLocation === sourceZone &&
      (event.targetCardInstanceIds || []).includes(attack?.targetUid) && event.targetLocation === attack?.targetZone &&
      attack.attackerUid === source.uid && attack.attackerSide === located.side && attack.attackerPlayerId === actorPlayerId &&
      attack.attackerZone === sourceZone && attack.defenderSide !== located.side && located.zone === (sourceZone === "vanguard" ? "vanguard" : "rear-guard") &&
      located.controllerPlayerId === actorPlayerId && player?.playerId === actorPlayerId &&
      (sourceZone === "vanguard" ? player.vanguard?.uid === source.uid : player.rear?.some(card => card?.uid === source.uid));
  }

  const VANGUARD_HIT_CLAN_STAND = new Map([
    ["cfa-159", [1, "Nova Grappler"]], ["cfa-160", [0, "Nova Grappler"]],
    ["cfa-214", [0, "Gold Paladin"]], ["cfa-306", [0, "Great Nature"]], ["cfa-377", [0, "Neo Nectar"]]
  ]);

  function isExactVanguardHitClanStandAbility(ability) {
    const definition = ability?.definition, cardId = String(ability?.cardId || ""), [index, clan] = VANGUARD_HIT_CLAN_STAND.get(cardId) || [];
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    const expectedText = `AUTO [VC]: [Counter Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your «${clan || ""}» rear-guards, and stand it.`;
    const step = definition?.effects?.[0], filter = step?.targetFilter;
    return Boolean(clan && ability?.id === `${cardId}:${index}` && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-vanguard-own-attack-hit-clan-counter-blast-stand-v1" && printed === expectedText &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "attack.hit" && ability.trigger.subject === "source" &&
      ability.trigger.targetLocation === "vanguard" && JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard"]) &&
      !(ability.conditions || []).length && JSON.stringify(ability.costs || []) === JSON.stringify([{ type: "counter-blast", count: 2 }]) &&
      definition.optional === true && definition.choicesReviewed === true && definition.effects?.length === 1 &&
      step?.op === "stand-target" && step.target === "chosen" && step.allowAlreadyStanding === true && step.noOpIfNoLegalTargets === true &&
      filter?.controller === "source-controller" && filter.cardType === "unit" && filter.zone === "rear-guard" && filter.clan === clan &&
      Object.keys(filter).sort().join(",") === "cardType,clan,controller,zone");
  }

  function vanguardHitClanStandEventMatches(state, ability, source, located, event, actorPlayerId, engine) {
    const attack = state?.pendingAttack, player = located && state.players?.[located.side];
    const targetUid = attack?.targetUid;
    const target = targetUid ? engine.locateCardInstance(state, targetUid) : null;
    const checks = [isExactVanguardHitClanStandAbility(ability), event?.type === "attack.hit", Boolean(event.eventId && event.battleId),
      event.battleId === attack?.battleId && event.phase === "battle" && event.timingWindow === "attack-hit" &&
      event.sourceCardInstanceId === source?.uid && event.attackingUnitInstanceId === source?.uid &&
      event.sourceOwnerPlayerId === located?.ownerPlayerId && event.sourceControllerPlayerId === actorPlayerId &&
      event.actingPlayerId === actorPlayerId && event.turnPlayerId === actorPlayerId &&
      event.targetLocation === "vanguard" && event.subjectCardInstanceId === targetUid && event.cardInstanceId === targetUid &&
      (event.targetCardInstanceIds || []).length === 1 && event.targetCardInstanceIds[0] === targetUid &&
      attack?.attackerUid === source?.uid && attack.attackerSide === located?.side && attack.attackerPlayerId === actorPlayerId &&
      attack.attackerZone === "vanguard" && attack.targetZone === "vanguard" && attack.defenderSide !== located?.side &&
      located?.zone === "vanguard" && located.circle === "vanguard" && located.controllerPlayerId === actorPlayerId &&
      player?.playerId === actorPlayerId && player.vanguard?.uid === source.uid &&
      target && !target.ambiguous && target.zone === "vanguard" && target.circle === "vanguard" && target.side === attack.defenderSide &&
      state.players?.[attack.defenderSide]?.vanguard?.uid === targetUid];
    return checks.every(Boolean);
  }

  function isExactTriggerUnitDrivePowerAbility(ability) {
    const ids = new Map([["cfa-6292", 1], ["cfa-6890", 0], ["cfa-10857", 1]]);
    const cardId = String(ability?.cardId || ""), definition = ability?.definition;
    const expectedText = "AUTO [RC]: When your drive check reveals a trigger unit, this unit gets power +5000 until end of turn.";
    return ids.has(cardId) && ability?.id === cardId + ":" + ids.get(cardId) && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-rc-drive-check-trigger-unit-power-turn-v1" &&
      String(definition.printedText || ability.printedText || "").replace(/\s+/g, " ").trim() === expectedText &&
      ability.trigger?.eventType === "drive.checked" && ability.trigger?.subject === "controller" && ability.trigger?.checkKind === "drive" && ability.trigger?.checkedCardHasTriggerUnit === true &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) && !(ability.costs || []).length && !(ability.conditions || []).length &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "modify-power" &&
      definition.effects[0]?.target === "source" && Number(definition.effects[0]?.amount) === 5000 && definition.effects[0]?.duration === "turn";
  }
  function isExactRcPlacementSoulChargeOneAbility(ability) {
    const ids = new Map([["cfa-12553", 1], ["cfa-13513", 1], ["cfa-8405", 0]]);
    const cardId = String(ability?.cardId || ""), definition = ability?.definition;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ids.has(cardId) && ability?.id === `${cardId}:${ids.get(cardId)}` && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-rc-placement-soul-charge-one-v1" && printed === "AUTO: When this unit is placed on RC, Soul Charge 1." &&
      ability.trigger?.eventType === "card.placed" && ability.trigger?.subject === "source" && JSON.stringify(ability.trigger?.circles || []) === JSON.stringify(["rear-guard"]) &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) && !(ability.costs || []).length && !(ability.conditions || []).length && ability.canDecline === false &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "soul-charge" && definition.effects[0]?.count === 1;
  }
  function exactRcPlacementSoulChargeEventMatches(ability, source, located, event, actorPlayerId, state) {
    const player = located && state?.players?.[located.side];
    const isRearCircle = value => /^(?:rear-|accel-|rear\d)/.test(String(value || ""));
    return isExactRcPlacementSoulChargeOneAbility(ability) && event?.type === "card.placed" && Boolean(event.eventId) &&
      event.sourceCardInstanceId === source?.uid && event.cardInstanceId === source?.uid && event.subjectCardInstanceId === source?.uid &&
      isRearCircle(event.currentLocation) && isRearCircle(event.circle) && event.subjectOwnerPlayerId === located?.ownerPlayerId &&
      event.subjectControllerPlayerId === actorPlayerId && event.sourceControllerPlayerId === actorPlayerId && located?.zone === "rear-guard" &&
      located.controllerPlayerId === actorPlayerId && player?.playerId === actorPlayerId && player.rear?.some(card => card?.uid === source.uid);
  }
  function isExactVanguardOrRearGuardOptionalSoulChargeAbility(ability){
    const ids=new Map([["cfa-11339",1],["cfa-6033",0],["cfa-8117",0]]),cardId=String(ability?.cardId||""),definition=ability?.definition,printed=String(definition?.printedText||ability?.printedText||"").replace(/\s+/g," ").trim();
    return ids.has(cardId)&&ability?.id===`${cardId}:${ids.get(cardId)}`&&ability.kind==="AUTO"&&definition?.kind==="AUTO"&&definition.source?.patternId==="auto-vanguard-or-rearguard-placement-optional-soul-charge-one-v1"&&printed==="AUTO [VC/RC]: When placed, you may Soul Charge 1."&&ability.trigger?.eventType==="card.placed"&&ability.trigger?.subject==="source"&&JSON.stringify(ability.trigger?.circles||[])===JSON.stringify(["vanguard","rear-guard"])&&JSON.stringify(ability.requiredLocation||[])===JSON.stringify(["vanguard","rear-guard"])&&!(ability.costs||[]).length&&!(ability.conditions||[]).length&&ability.canDecline===true&&definition.optional===true&&definition.effects?.length===1&&definition.effects[0]?.op==="soul-charge"&&definition.effects[0]?.count===1;
  }
  function exactVanguardOrRearGuardOptionalSoulChargeEventMatches(ability,source,located,event,actorPlayerId,state){
    const player=located&&state?.players?.[located.side],current=String(event?.currentLocation||""),circle=String(event?.circle||""),onVanguard=current==="vanguard"&&circle==="vanguard"&&located?.zone==="vanguard"&&player?.vanguard?.uid===source?.uid,onRearGuard=/^(?:rear-|accel-|rear\d)/.test(current)&&/^(?:rear-|accel-|rear\d)/.test(circle)&&located?.zone==="rear-guard"&&located?.circle===circle&&player?.rear?.some(card=>card?.uid===source?.uid);
    return isExactVanguardOrRearGuardOptionalSoulChargeAbility(ability)&&event?.type==="card.placed"&&Boolean(event.eventId)&&event.sourceCardInstanceId===source?.uid&&event.cardInstanceId===source?.uid&&event.subjectCardInstanceId===source?.uid&&(onVanguard||onRearGuard)&&event.subjectOwnerPlayerId===located?.ownerPlayerId&&event.subjectControllerPlayerId===actorPlayerId&&event.sourceControllerPlayerId===actorPlayerId&&located.controllerPlayerId===actorPlayerId&&player?.playerId===actorPlayerId;
  }
  function isExactRcReturnToHandCostDrawAbility(ability){
    const ids=new Set(["cfa-2101","cfa-3565","cfa-4004"]),definition=ability?.definition,printed=String(definition?.printedText||ability?.printedText||"").replace(/\s+/g," ").trim();
    return ids.has(String(ability?.cardId||""))&&ability?.id===`${ability.cardId}:0`&&ability.kind==="AUTO"&&definition?.kind==="AUTO"&&definition.source?.patternId==="auto-rc-return-to-hand-counter-soul-blast-draw-v1"&&printed==="AUTO: [Counter Blast 1 & Soul Blast 1] When this unit is returned to your hand from RC, you may pay the cost. If you do, draw a card."&&ability.trigger?.eventType==="card.moved"&&ability.trigger?.subject==="source"&&ability.trigger?.sourceLocation==="rear-guard"&&ability.trigger?.destinationLocation==="hand"&&!(ability.requiredLocation||[]).length&&JSON.stringify(ability.costs||[])===JSON.stringify([{type:"counter-blast",count:1},{type:"soul-blast",count:1}])&&ability.canDecline===true&&definition.effects?.length===1&&definition.effects[0]?.op==="draw"&&definition.effects[0]?.count===1;
  }
  function exactRcReturnToHandCostDrawEventMatches(ability,source,located,event,actorPlayerId,state){
    const player=located&&state?.players?.[located.side],previous=String(event?.previousLocation||""),fromRear=/^(?:rear-|accel-|rear\d)/.test(previous);
    return isExactRcReturnToHandCostDrawAbility(ability)&&event?.type==="card.moved"&&Boolean(event.eventId)&&fromRear&&event.currentLocation==="hand"&&event.sourceCardInstanceId===source?.uid&&event.cardInstanceId===source?.uid&&event.subjectCardInstanceId===source?.uid&&event.subjectOwnerPlayerId===located?.ownerPlayerId&&event.sourceOwnerPlayerId===located?.ownerPlayerId&&event.subjectControllerPlayerId===actorPlayerId&&event.sourceControllerPlayerId===actorPlayerId&&located?.zone==="hand"&&located.controllerPlayerId===actorPlayerId&&player?.playerId===actorPlayerId&&player.hand?.some(card=>card?.uid===source?.uid);
  }
  function isExactDiscardSelfOptionalSoulAbility(ability) {
    const ids = new Set(["cfa-10174", "cfa-6865", "cfa-8590"]);
    const cardId = String(ability?.cardId || ""), definition = ability?.definition;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ids.has(cardId) && ability?.id === `${cardId}:0` && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-hand-discard-self-optional-to-soul-v1" &&
      printed === "AUTO: When this card is discarded from hand during your turn, you may put this card into your soul." &&
      ability.trigger?.eventType === "card.discarded" && ability.trigger?.subject === "event-subject" &&
      ability.trigger?.sourceLocation === "hand" && ability.trigger?.destinationLocation === "drop" && ability.trigger?.turnRelation === "controller" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["hand"]) && definition.optional === true && ability.canDecline === true &&
      !(ability.costs || []).length && JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "controller-turn" }]) && definition.effects?.length === 1 &&
      definition.effects[0]?.op === "move-source-to-soul" && definition.effects[0]?.target === "source" && definition.effects[0]?.from === "drop";
  }
  function exactDiscardSelfOptionalSoulEventMatches(ability, source, located, event, actorPlayerId, state) {
    const player = located && state?.players?.[located.side];
    return isExactDiscardSelfOptionalSoulAbility(ability) && event?.type === "card.discarded" && Boolean(event.eventId) &&
      event.cardInstanceId === source?.uid && event.subjectCardInstanceId === source?.uid && event.subjectOwnerPlayerId === located?.ownerPlayerId &&
      event.subjectControllerPlayerId === actorPlayerId && event.previousLocation === "hand" && event.currentLocation === "drop" &&
      event.turnPlayerId === actorPlayerId && located?.zone === "drop" && located.controllerPlayerId === actorPlayerId &&
      player?.playerId === actorPlayerId && player.drop?.some(card => card?.uid === source.uid);
  }
  function isExactVanguardAttackSoulChargePowerAbility(ability) {
    const ids = new Set(["cfa-1352", "cfa-1416", "cfa-1425"]);
    const cardId = String(ability?.cardId || ""), definition = ability?.definition;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ids.has(cardId) && ability?.id === `${cardId}:1` && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-vanguard-own-attack-soul-charge-power-battle-v1" &&
      printed === "AUTO [VC]: When this unit attacks a vanguard, Soul Charge 1, and this unit gets power +1000 until end of that battle." &&
      ability.trigger?.eventType === "unit.attacked" && ability.trigger?.subject === "source" &&
      JSON.stringify(ability.trigger?.circles || []) === JSON.stringify(["vanguard"]) && ability.trigger?.targetLocation === "vanguard" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard"]) && !(ability.costs || []).length && !(ability.conditions || []).length && ability.canDecline === false &&
      definition.effects?.length === 2 && definition.effects[0]?.op === "soul-charge" && definition.effects[0]?.count === 1 &&
      definition.effects[1]?.op === "modify-power" && definition.effects[1]?.target === "source" && Number(definition.effects[1]?.amount) === 1000 && definition.effects[1]?.duration === "battle";
  }
  function exactVanguardAttackSoulChargePowerEventMatches(state, ability, source, located, event, actorPlayerId) {
    const attack = state?.pendingAttack, player = located && state.players?.[located.side];
    return isExactVanguardAttackSoulChargePowerAbility(ability) && event?.type === "unit.attacked" && Boolean(event.eventId && event.battleId) &&
      event.battleId === attack?.battleId && event.sourceCardInstanceId === source?.uid && event.cardInstanceId === source?.uid &&
      event.subjectCardInstanceId === source?.uid && (event.attackingCardInstanceIds || []).includes(source?.uid) &&
      event.sourceOwnerPlayerId === located?.ownerPlayerId && event.sourceControllerPlayerId === actorPlayerId &&
      event.subjectControllerPlayerId === actorPlayerId && event.actingPlayerId === actorPlayerId && event.turnPlayerId === actorPlayerId &&
      event.targetLocation === "vanguard" && attack.attackerUid === source.uid && attack.attackerSide === located.side &&
      attack.attackerZone === "vanguard" && attack.targetZone === "vanguard" && attack.defenderSide !== located.side &&
      located.zone === "vanguard" && located.controllerPlayerId === actorPlayerId && player?.playerId === actorPlayerId && player.vanguard?.uid === source.uid;
  }
  function isExactBoostedCloseTypoAbility(ability) {
    const ids = new Set(["cfa-13434", "cfa-13449", "cfa-13493", "cfa-13518", "cfa-13551"]);
    const cardId = String(ability?.cardId || ""), definition = ability?.definition;
    const text = "AUTO [RC]: At the end of the batle this unit boosted, COST [put this unit into soul], choose one of your units, and it gets power +2000 until end of turn.";
    return ids.has(cardId) && ability?.id === `${cardId}:0` && ability.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition.source?.patternId === "auto-boosted-battle-close-source-to-soul-power-v1" &&
      String(definition.printedText || ability.printedText || "").replace(/\s+/g, " ").trim() === text &&
      ability.trigger?.eventType === "battle.close-step" && ability.trigger?.subject === "booster" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) &&
      JSON.stringify(ability.costs || []) === JSON.stringify([{ type: "source-to-soul", count: 1 }]) &&
      definition.effects?.length === 1 &&
      definition.effects[0]?.op === "modify-power-target" && definition.effects[0]?.target === "chosen" &&
      Number(definition.effects[0]?.amount) === 2000 && definition.effects[0]?.duration === "turn" &&
      JSON.stringify(definition.effects[0]?.targetFilter) === JSON.stringify({ controller: "source-controller", cardType: "unit" });
  }

  function exactDriveCheckAbility(ability, cardId, patternId, expectedText, effects, costs, conditions) {
    const definition = ability?.definition;
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && String(ability.cardId) === cardId &&
      String(definition.cardId) === cardId && ability.id === `${cardId}:0` &&
      String(definition.source?.patternId) === patternId &&
      String(definition.printedText || ability.printedText || "").replace(/\s+/g, " ").trim() === expectedText &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "drive.checked" &&
      ability.trigger.subject === "controller" && ability.trigger.checkKind === "drive" && ability.trigger.checkedCardTriggerType === "" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(cardId === "cfa-7132" ? ["rear-guard"] : ["vanguard"]) &&
      JSON.stringify(ability.costs || []) === JSON.stringify(costs) && JSON.stringify(ability.conditions || []) === JSON.stringify(conditions) &&
      JSON.stringify(definition.effects || []) === JSON.stringify(effects);
  }

  const GOD_HAND_DRIVE_TEXT = 'AUTO [RC]: When your drive check reveals a normal unit, if your vanguard is "Fighting Fist Dragon, God Hand Dragon", COST [Counter Blast 1 & retire this unit], and your vanguard gets drive +1 until end of that battle.';
  const DAUNTLESS_DRIVE_TEXT = "AUTO [VC]: When your drive check reveals a normal unit, COST [Counter Blast 1], and put that card on your RC as a locked card. If you put a card, this unit gets power +10000 / drive +1 until end of that battle.";
  function isExactGodHandDriveAbility(ability) {
    return exactDriveCheckAbility(ability, "cfa-7132", "auto-rc-normal-drive-check-named-vanguard-retire-source-drive-v1", GOD_HAND_DRIVE_TEXT,
      [{ op: "modify-drive-target", target: "attacking-vanguard", amount: 1, duration: "battle" }],
      [{ type: "counter-blast", count: 1 }, { type: "source-retire", count: 1 }],
      [{ type: "controller-vanguard-name-contains", value: "Fighting Fist Dragon, God Hand Dragon", exact: true }]);
  }
  function isExactDauntlessDriveAbility(ability) {
    return exactDriveCheckAbility(ability, "cfa-9421", "auto-vanguard-drive-check-normal-unit-lock-reveal-and-battle-bonus-v1", DAUNTLESS_DRIVE_TEXT,
      [{ op: "call-checked-card-locked", target: "checked-card", position: "locked" },
        { op: "modify-power", target: "source", amount: 10000, duration: "battle", ifPreviousEffectSucceeded: 0 },
        { op: "modify-drive", target: "source", amount: 1, duration: "battle", ifPreviousEffectSucceeded: 0 }],
      [{ type: "counter-blast", count: 1 }], []);
  }

  function exactNormalDriveCheckContext(state, ability, source, located, event, actorPlayerId) {
    if ((!isExactGodHandDriveAbility(ability) && !isExactDauntlessDriveAbility(ability)) ||
        event?.type !== "drive.checked" || event.checkKind !== "drive" || event.checkedCardTriggerType !== "" ||
        !event.eventId || !event.battleId || event.battleId !== state?.pendingAttack?.battleId ||
        event.actingPlayerId !== actorPlayerId || event.sourceCardInstanceId !== state.pendingAttack?.attackerUid ||
        event.sourceControllerPlayerId !== actorPlayerId || event.subjectCardInstanceId !== event.checkedCardInstanceId ||
        state.pendingCheckCard?.side !== located?.side || state.pendingCheckCard?.uid !== event.checkedCardInstanceId) return false;
    const attack = state.pendingAttack, controller = state.players?.[located.side];
    const attackerIsControllerVanguard = attack.attackerSide === located.side && attack.attackerZone === "vanguard" &&
      controller?.vanguard?.uid === attack.attackerUid && controller.vanguard.uid === event.sourceCardInstanceId;
    if (!attackerIsControllerVanguard || controller?.playerId !== actorPlayerId || located.controllerPlayerId !== actorPlayerId) return false;
    const checked = controller.triggerZone?.find(card => card?.uid === event.checkedCardInstanceId);
    const checkedDefinition = checked && serverCardDefinition(checked);
    if (!checked || !checkedDefinition || !/\bunit\b/i.test(String(checkedDefinition.type || "")) ||
        /\border\b/i.test(String(checkedDefinition.type || "")) || checkedDefinition.trigger) return false;
    if (isExactGodHandDriveAbility(ability)) return located.zone === "rear-guard" && attack.attackerUid === controller.vanguard.uid &&
      String(controller.vanguard.cardId) === "cfa-7046" && serverCardDefinition(controller.vanguard)?.name === "Fighting Fist Dragon, God Hand Dragon";
    return located.zone === "vanguard" && source?.uid === controller.vanguard.uid &&
      state.pendingCheckCard.destination === "hand" && attack.awaitingDrive !== undefined;
  }

  function exactTriggerUnitDriveCheckContext(state, ability, source, located, event, actorPlayerId) {
    if (!isExactTriggerUnitDrivePowerAbility(ability) || event?.type !== "drive.checked" || event.checkKind !== "drive" ||
        !String(event.checkedCardTriggerType || "").trim() || !event.eventId || !event.battleId || event.battleId !== state?.pendingAttack?.battleId ||
        event.actingPlayerId !== actorPlayerId || event.turnPlayerId !== actorPlayerId || event.sourceCardInstanceId !== state.pendingAttack?.attackerUid ||
        event.sourceControllerPlayerId !== actorPlayerId || event.subjectCardInstanceId !== event.checkedCardInstanceId ||
        state.pendingCheckCard?.side !== located?.side || state.pendingCheckCard?.uid !== event.checkedCardInstanceId || located?.zone !== "rear-guard" ||
        located.controllerPlayerId !== actorPlayerId || source?.locked === true) return false;
    const attack = state.pendingAttack, controller = state.players?.[located.side];
    if (attack.attackerSide !== located.side || attack.attackerZone !== "vanguard" || controller?.playerId !== actorPlayerId ||
        controller.vanguard?.uid !== attack.attackerUid || source?.uid === attack.attackerUid) return false;
    const checked = controller.triggerZone?.find(card => card?.uid === event.checkedCardInstanceId);
    const checkedTrigger = String(serverCardDefinition(checked)?.trigger || "").toLowerCase();
    return Boolean(checked && checkedTrigger && checkedTrigger === String(event.checkedCardTriggerType).toLowerCase());
  }
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
        abilitySourceInstanceId: event?.abilitySourceInstanceId || source?.uid || null,
        abilitySourceControllerPlayerId: event?.abilitySourceControllerPlayerId || actorPlayerId,
        abilitySourceOwnerPlayerId: event?.abilitySourceOwnerPlayerId || source?.ownerPlayerId || actorPlayerId,
        sourceCardInstanceId: source?.uid || null,
        sourceOwnerPlayerId: source?.ownerPlayerId || actorPlayerId,
        sourceControllerPlayerId: source?.controllerPlayerId || actorPlayerId,
        cardInstanceId: subjectUid,
        subjectCardInstanceId: subjectUid,
        subjectOwnerPlayerId: subject && !subject.ambiguous ? subject.ownerPlayerId : event?.subjectOwnerPlayerId || null,
        subjectControllerPlayerId: subject && !subject.ambiguous ? subject.controllerPlayerId : event?.subjectControllerPlayerId || event?.controllerPlayerId || actorPlayerId,
        currentLocation: event?.currentLocation || (subject && !subject.ambiguous ? subject.circle || subject.zone : null),
        phase: state.phase,
        timingWindow: event?.timingWindow || (event?.type === "card.placed" ? "effect-placement" : "ability-resolution"),
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
    "draw", "modify-power", "modify-power-target", "retire-target", "rest-target", "stand-target", "protect-target", "revelation-choice", "modify-critical", "rest-source", "stand-source", "set-charging", "call-top-to-guardian", "g-guardian-discard-charge-choice",
    "counter-charge", "soul-charge", "move-source-to-soul", "move-source-to-hand", "call-source-from-soul", "engorge", "seek-mate", "modify-defending-source-power", "search-deck-same-name-to-hand", "search-deck-named-call-to-rearguard", "call-source-from-drop-rested", "unlock-target", "protect-attacked-source", "set-successful"
  ]);
  const QUICK_SHIELD_RIDE_TEXT = "AUTO: When rode upon, draw a card. Then, if your opponent’s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand.";
  const CHARGE_CARD_IDS = new Set(["cfa-3429", "cfa-3474", "cfa-3490", "cfa-3492", "cfa-3495", "cfa-3500", "cfa-3501", "cfa-3506", "cfa-4142", "cfa-4232", "cfa-4269", "cfa-4275", "cfa-4312", "cfa-4327", "cfa-5203", "cfa-5204", "cfa-5206", "cfa-5207", "cfa-5208", "cfa-5215", "cfa-5226", "cfa-5313", "cfa-5316"]);
  const GUARDIAN_TOP_FIVE_CARD_IDS = new Set(["cfa-1987", "cfa-1996", "cfa-2077", "cfa-2088", "cfa-2097", "cfa-2156", "cfa-2178", "cfa-2241", "cfa-2302", "cfa-2364", "cfa-2389", "cfa-2403", "cfa-2744", "cfa-3091", "cfa-3138", "cfa-3391"]);

  function isExactForerunnerAbility(ability) {
    const definition = ability?.definition;
    const text = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-forerunner-same-clan-ride-call-source-v1" &&
      String(ability.cardId) === String(definition.cardId) &&
      /^AUTO:\s*Forerunner(?:\s*\(When (?:(?:another|a) )?(?:unit|card) (?:(?:of|from) the same clan|with the same clan) rides this unit, you may (?:call (?:this unit|this card|it)|it) to (?:a )?\(?RC\)?\.?\))?\.?$/i.test(text) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.ridden" &&
      ability.trigger.subject === "ridden-unit" && JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["vanguard"]) &&
      ability.canDecline === true && definition.optional === true && !(ability.costs || []).length && !(ability.conditions || []).length &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "call-source-from-soul" &&
      definition.effects[0]?.target === "source" && definition.effects[0]?.position === "stand";
  }

  function isExactChargeAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const knownWording = new Set([
      "AUTO: Charge.", "AUTO [RC]: Charge.",
      "AUTO: Charge (During the turn that this unit is placed on RC by an effect, it becomes in Charge, and put it on the bottom of you deck at the end of the battle in which it participated.)",
      "AUTO: Charge (During the turn that this unit is placed on RC by an effect, you may have this unit become in Charge. If you do, put it on the bottom of your deck at the end of a battle in which it participated.)",
      "AUTO: Charge (When this unit is placed on RC due to an effect, you may have it become charging for that turn. If you do, put it on the bottom of your deck at the end of its battle.)"
    ]).has(printed);
    const mandatory = String(definition?.cardId) === "cfa-3429";
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-charge-effect-placement-bottom-deck-after-battle-v1" &&
      CHARGE_CARD_IDS.has(String(definition.cardId)) && String(ability.cardId) === String(definition.cardId) &&
      String(ability.id) === `${String(definition.cardId)}:${String(ability.id).split(":").at(-1)}` && knownWording &&
      Boolean(definition.optional) === !mandatory && ability.canDecline === !mandatory &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.placed" && trigger.subject === "source" &&
      trigger.effectPlacementOnly === true && JSON.stringify(trigger.circles || []) === JSON.stringify(["rear-guard"]) &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) &&
      (ability.costs || []).length === 0 && (ability.conditions || []).length === 0 && effects.length === 1 &&
      effects[0]?.op === "set-charging" && effects[0].target === "source";
  }

  function isExactGuardianTopFiveCallAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    const cardId = String(definition?.cardId || ""), printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const knownText = printed === "AUTO: [Counter Blast 1] When this unit is placed on GC from your hand, you may pay the cost. If you do, call five cards from the top of your deck to GC at rest." ||
      printed === "AUTO: [Counter Blast 1] When this unit is placed on GC from hand, you may pay the cost. If you do, call five cards from the top of your deck to GC at rest.";
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-gc-counter-blast-call-top-to-guardian-v1" && GUARDIAN_TOP_FIVE_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && String(ability.id) === `${cardId}:1` && knownText &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.placed" && trigger.subject === "source" &&
      JSON.stringify(trigger.circles || []) === JSON.stringify(["guardian"]) && trigger.sourceLocation === "hand" &&
      ability.costs?.length === 1 && ability.costs[0]?.type === "counter-blast" && Number(ability.costs[0]?.count) === 1 &&
      ability.canDecline === true && !(ability.conditions || []).length && effects.length === 1 &&
      effects[0]?.op === "call-top-to-guardian" && effects[0].target === "controller" && Number(effects[0].count) === 5 &&
      effects[0].destination === "guardian" && effects[0].position === "rest";
  }

  function guardianTopFiveCallTriggerMatches(state, ability, source, located, event, actorPlayerId) {
    const attack = state?.pendingAttack, player = located && state.players?.[located.side];
    return isExactGuardianTopFiveCallAbility(ability) && Boolean(attack?.battleId) &&
      event?.type === "card.placed" && event.eventId && event.battleId === attack.battleId &&
      event.phase === "battle" && event.timingWindow === "guard-placement" && event.circle === "guardian" &&
      event.sourceCardInstanceId === source?.uid && event.cardInstanceId === source?.uid && event.subjectCardInstanceId === source?.uid &&
      event.previousLocation === "hand" && event.currentLocation === "guardian" &&
      event.actingPlayerId === actorPlayerId && event.subjectControllerPlayerId === actorPlayerId &&
      located?.zone === "guardian" && located.side === attack.defenderSide && located.controllerPlayerId === actorPlayerId &&
      event.subjectControllerPlayerId === player?.playerId && attack.defenderSide === located.side &&
      Array.isArray(player?.guardCircle) && player.guardCircle.some(card => card?.uid === source.uid) &&
      Array.isArray(attack.guardCards) && attack.guardCards.some(card => card?.uid === source.uid);
  }

  function clanSet(instanceOrEvent) {
    const values = [...(Array.isArray(instanceOrEvent?.clans) ? instanceOrEvent.clans : []), instanceOrEvent?.clan,
      ...(Array.isArray(instanceOrEvent?.sourceCardClans) ? instanceOrEvent.sourceCardClans : []), instanceOrEvent?.sourceCardClan];
    return new Set(values.filter(value => typeof value === "string" && value.trim()).map(value => value.trim().toLocaleLowerCase()));
  }

  function forerunnerRideMatches(state, ability, source, sourceLocation, event, engine) {
    if (!isExactForerunnerAbility(ability) || !source?.uid || !sourceLocation || !event || event.type !== "card.ridden" ||
        !Array.isArray(event.targetCardInstanceIds) || !event.targetCardInstanceIds.includes(source.uid) ||
        event.targetPreviousLocation !== "vanguard" || event.targetCurrentLocation !== "soul" || event.currentLocation !== "vanguard" ||
        event.subjectCardInstanceId !== event.sourceCardInstanceId || event.sourceControllerPlayerId !== sourceLocation.controllerPlayerId ||
        event.actingPlayerId !== sourceLocation.controllerPlayerId || sourceLocation.zone !== "soul" ||
        sourceLocation.controllerPlayerId !== source.controllerPlayerId ||
        !state.players?.[sourceLocation.side]?.soul?.some(card => card?.uid === source.uid)) return false;
    const riderLocation = engine?.locateCardInstance?.(state, event.sourceCardInstanceId);
    if (!riderLocation || riderLocation.ambiguous || riderLocation.zone !== "vanguard" ||
        riderLocation.side !== sourceLocation.side || riderLocation.controllerPlayerId !== sourceLocation.controllerPlayerId) return false;
    const sourceClans = clanSet(source), riderClans = clanSet(riderLocation.instance), eventRiderClans = clanSet(event);
    if (!sourceClans.size || !riderClans.size || !eventRiderClans.size) return false;
    if (![...riderClans].every(clan => eventRiderClans.has(clan)) ||
        ![...sourceClans].some(clan => riderClans.has(clan))) return false;
    return true;
  }

  function isExactQuickShieldRideAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-rode-upon-draw-quick-shield-v1" &&
      String(ability.id) === `${String(definition.cardId)}:0` && String(ability.cardId) === String(definition.cardId) &&
      definition.printedText === QUICK_SHIELD_RIDE_TEXT &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.ridden" &&
      trigger.subject === "event-target" && JSON.stringify(trigger.circles || []) === JSON.stringify(["vanguard"]) &&
      JSON.stringify(definition.requiredLocation || []) === JSON.stringify(["vanguard"]) &&
      (ability.costs || []).length === 0 && (ability.conditions || []).length === 0 && effects.length === 2 &&
      effects[0]?.op === "draw" && effects[0].count === 1 &&
      effects[1]?.op === "create-token" && effects[1].target === "controller" &&
      effects[1].tokenId === "token-quick-shield" && effects[1].count === 1 &&
      effects[1].condition?.op === "opponent-vanguard-grade-at-least" && effects[1].condition.grade === 1;
  }

  function isExactSecondPlayerRideDrawAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const exactText = /^AUTO: When this unit is rode upon, if you went second, draw a card\.(?: \((?:You will be prompted to get the "Energy Generator" crest upon ride\.|Hold TAB to view the related card\.)\))*$/i.test(printed);
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-rode-upon-second-player-draw-v1" &&
      String(ability.cardId) === String(definition.cardId) && String(ability.id) === String(definition.id) &&
      String(ability.id).startsWith(`${String(definition.cardId)}:`) && exactText &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.ridden" && trigger.subject === "event-target" &&
      JSON.stringify(trigger.circles || []) === JSON.stringify(["vanguard"]) &&
      JSON.stringify(definition.requiredLocation || []) === JSON.stringify(["vanguard"]) &&
      (ability.conditions || []).length === 1 && ability.conditions[0]?.type === "controller-went-second" &&
      (ability.costs || []).length === 0 && ability.canDecline === false && effects.length === 1 &&
      effects[0]?.op === "draw" && Number(effects[0].count) === 1;
  }

  function secondPlayerRideDrawTriggerMatches(state, ability, source, located, event, actorPlayerId, engine) {
    if (!isExactSecondPlayerRideDrawAbility(ability) || !source?.uid || !located || !event || event.type !== "card.ridden" ||
        event.timingWindow !== "normal-ride" || event.phase !== "ride" || event.sourceCardInstanceId === source.uid ||
        !(event.targetCardInstanceIds || []).includes(source.uid) || event.targetPreviousLocation !== "vanguard" ||
        event.targetCurrentLocation !== "soul" || event.targetLocation !== "vanguard" || event.currentLocation !== "vanguard" ||
        event.previousLocation !== "hand" || event.actingPlayerId !== actorPlayerId || event.turnPlayerId !== actorPlayerId ||
        event.sourceControllerPlayerId !== actorPlayerId || event.subjectCardInstanceId !== event.sourceCardInstanceId ||
        event.subjectControllerPlayerId !== actorPlayerId ||
        (event.targetControllerPlayerId && event.targetControllerPlayerId !== actorPlayerId) ||
        located.zone !== "soul" || located.controllerPlayerId !== actorPlayerId ||
        !state.players?.[located.side]?.soul?.some(card => card?.uid === source.uid)) return false;
    const rider = engine?.locateCardInstance?.(state, event.sourceCardInstanceId);
    return Boolean(rider && !rider.ambiguous && rider.zone === "vanguard" && rider.side === located.side && rider.controllerPlayerId === actorPlayerId);
  }

  function stableQuickShieldUid(matchId, actionId, eventId, sourceUid) {
    const value = `${String(matchId || "match")}\u0000${String(actionId || "")}\u0000${String(eventId || "")}\u0000${String(sourceUid || "")}`;
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < value.length; index++) {
      hash ^= BigInt(value.charCodeAt(index));
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return `token-quick-shield-${hash.toString(16).padStart(16, "0")}`;
  }

  const CONDITIONAL_DISCARD_GUARDIAN_CARD_IDS = new Set([
    "cfa-8254", "cfa-8359", "cfa-8364", "cfa-8370", "cfa-8372", "cfa-8481", "cfa-8800",
    "cfa-8850", "cfa-8851", "cfa-8852", "cfa-8853", "cfa-8854", "cfa-9154", "cfa-9905",
    "cfa-9909", "cfa-9910", "cfa-10040", "cfa-10186", "cfa-10191", "cfa-10196", "cfa-10201",
    "cfa-10206", "cfa-10445", "cfa-10543", "cfa-10844", "cfa-11624", "cfa-11898", "cfa-11933",
    "cfa-12005", "cfa-12085", "cfa-12125", "cfa-12176", "cfa-12188", "cfa-12227", "cfa-12255",
    "cfa-12342", "cfa-12379", "cfa-12380", "cfa-12413", "cfa-12414", "cfa-12415", "cfa-12416",
    "cfa-12417", "cfa-12418", "cfa-12554", "cfa-12752", "cfa-12830", "cfa-12908", "cfa-13037",
    "cfa-13082", "cfa-13199", "cfa-13206", "cfa-13316", "cfa-13373", "cfa-13401", "cfa-13404",
    "cfa-13405", "cfa-13406", "cfa-13407", "cfa-13408", "cfa-13941", "cfa-13977", "cfa-13984"
  ]);

  const RC_GRADE_THREE_NAME_SEARCH_CARD_IDS = new Set([
    "cfa-2471", "cfa-2485", "cfa-2503", "cfa-2509", "cfa-2517", "cfa-2518", "cfa-2626", "cfa-2647",
    "cfa-2714", "cfa-2775", "cfa-2891", "cfa-2940", "cfa-2948", "cfa-2960", "cfa-2977", "cfa-3029",
    "cfa-3120", "cfa-3130", "cfa-3140", "cfa-3326", "cfa-3423", "cfa-3472", "cfa-3475", "cfa-3482"
  ]);

  const INTERCEPT_SHIELD_CARD_IDS = new Set([
    "cfa-2032", "cfa-2046", "cfa-2247", "cfa-2257", "cfa-2523", "cfa-2534", "cfa-2681", "cfa-2695", "cfa-3075"
  ]);
  const CLAN_INTERCEPT_SHIELD_CARD_IDS = new Set(["cfa-1076", "cfa-1104", "cfa-1462", "cfa-1470", "cfa-151", "cfa-1683", "cfa-212", "cfa-25", "cfa-297", "cfa-345", "cfa-375", "cfa-533", "cfa-580", "cfa-618", "cfa-677", "cfa-722", "cfa-862", "cfa-95"]);
  const STRUCTURED_INTERCEPT_SHIELD_RULES = Object.freeze({
    "cfa-10101": { text: "AUTO: When this unit intercepts, if you have two or more grade 1 or less back row rear-guards, this unit gets shield +10000 until end of that battle.", condition: { type: "controller-back-row-grade-rear-guards-at-least", count: 2, maxGrade: 1 } },
    "cfa-10182": { text: "AUTO: When this unit intercepts, if your damage zone has more cards than your opponent, this unit gets shield +10000 until end of that battle.", condition: { type: "controller-damage-count-more-than-opponent" } },
    "cfa-2840": { text: "AUTO: When this unit intercepts, if the number of rear-guards you have in your back row is one or less, this unit gets shield +10000 until end of that battle.", condition: { type: "controller-back-row-rear-guards-at-most", count: 1 } },
    "cfa-5165": { text: "AUTO: When this unit intercepts, if there is a locked card, this unit gets shield +10000 until end of that battle.", condition: { type: "any-field-card-is-locked" } },
    "cfa-8453": { text: "AUTO: When this unit intercepts, if your opponent has two or less rear-guards, this unit gets shield +10000 until end of that battle.", condition: { type: "opponent-rear-guards-at-most", count: 2 } },
    "cfa-9585": { text: "AUTO: When this unit intercepts, if your soul has five or more cards, this unit gets shield +10000 until end of that battle.", condition: { type: "controller-soul-count-at-least", count: 5 } },
    "cfa-9604": { text: "AUTO: When this unit intercepts, if your order zone has two or more cards, this unit gets shield +10000 until end of that battle. (Includes your opponent’s cards)", condition: { type: "all-order-zones-count-at-least", count: 2 } },
    "cfa-9626": { text: "AUTO: When this unit intercepts, if your opponent’s vanguard is grade 3 or greater, this unit gets shield +10000 until end of that battle.", condition: { type: "opponent-vanguard-grade-at-least", count: 3 } },
    "cfa-9738": { text: "AUTO: When this unit intercepts, if your damage zone has three or more cards, this unit gets shield +10000 until the end of that battle.", condition: { type: "controller-damage-count-at-least", count: 3 } }
  });
  const SECOND_ATTACK_INTERCEPT_SHIELD_CARD_IDS = new Set(["cfa-10188", "cfa-10444", "cfa-9685", "cfa-9687", "cfa-9688", "cfa-9689", "cfa-9690"]);
  const GB_INTERCEPT_SHIELD_CARD_IDS = new Set(["cfa-3651", "cfa-4157", "cfa-4357", "cfa-4446", "cfa-4459", "cfa-4873", "cfa-4972"]);
  const LOWER_VANGUARD_GRADE_GUARDIAN_SHIELD_CARD_IDS = new Set(["cfa-10672", "cfa-10673", "cfa-10674", "cfa-10675", "cfa-10676", "cfa-12346"]);
  const QUALIFYING_CRITICAL_GC_SHIELD_CARD_IDS = new Set(["cfa-10187", "cfa-9686", "cfa-9765", "cfa-9766", "cfa-9767", "cfa-9768"]);
  const ATTACKED_VANGUARD_INTERCEPT_SHIELD_CARD_IDS = new Set(["cfa-4353", "cfa-4483", "cfa-4534", "cfa-5184"]);
  function isExactInterceptShieldAbility(ability) {
    const definition = ability?.definition;
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-intercept-shield-battle-v1" &&
      INTERCEPT_SHIELD_CARD_IDS.has(cardId) && String(ability.cardId) === cardId &&
      /^AUTO:\s*When this unit intercepts, this (?:unit|card) gets shield \+5000 until end of (?:that )?battle\.$/i.test(printed) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "source" && JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) &&
      ability.trigger.sourceLocation === "rear-guard" && !(ability.costs || []).length && !(ability.conditions || []).length &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "modify-shield-source" &&
      definition.effects[0]?.target === "source" && Number(definition.effects[0]?.amount) === 5000 && definition.effects[0]?.duration === "battle";
  }

  function isExactClanInterceptShieldAbility(ability) {
    const definition = ability?.definition, effect = definition?.effects?.[0];
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const match = printed.match(/^AUTO:\s*When this unit intercepts, if you have an? [«<]([^»>]+)[»>] vanguard, this (?:unit|card) gets shield \+5000 until (?:the )?end of (?:that )?battle\.$/i);
    const condition = ability?.conditions?.[0];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-intercept-clan-vanguard-shield-battle-v1" &&
      CLAN_INTERCEPT_SHIELD_CARD_IDS.has(cardId) && String(ability.cardId) === cardId && Boolean(match) &&
      condition?.type === "controller-vanguard-has-clan" && String(condition.value).toLowerCase() === match[1].toLowerCase() &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "source" && JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) &&
      ability.trigger.sourceLocation === "rear-guard" && !(ability.costs || []).length && definition.effects?.length === 1 &&
      effect?.op === "modify-shield-source" && effect.target === "source" && Number(effect.amount) === 5000 && effect.duration === "battle";
  }

  function isExactStructuredInterceptShieldAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || ""), rule = STRUCTURED_INTERCEPT_SHIELD_RULES[cardId];
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const expectedText = String(rule?.text || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const effect = definition?.effects?.[0];
    return Boolean(rule) && ability?.kind === "AUTO" && definition?.kind === "AUTO" && String(ability.cardId) === cardId &&
      definition?.source?.patternId === "auto-intercept-shield-structured-condition-battle-v1" && printed === expectedText &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([rule.condition]) && ability.trigger?.status === "recognized-trigger" &&
      ability.trigger.eventType === "card.placed" && ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) && ability.trigger.sourceLocation === "rear-guard" &&
      !(ability.costs || []).length && definition.effects?.length === 1 && effect?.op === "modify-shield-source" &&
      effect.target === "source" && Number(effect.amount) === 10000 && effect.duration === "battle";
  }

  function isExactSecondAttackInterceptShieldAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || ""), effect = definition?.effects?.[0];
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    const expected = "AUTO: When this unit is put on GC, if your opponent's attacking unit has attacked two or more times this turn, this unit gets shield +15000 until end of that battle. (Active if this battle is its second attack this turn or more)";
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && String(ability.cardId) === cardId &&
      SECOND_ATTACK_INTERCEPT_SHIELD_CARD_IDS.has(cardId) && definition.source?.patternId === "auto-gc-opponent-second-attack-shield-v1" &&
      printed.toLowerCase() === expected.toLowerCase() && ability.trigger?.status === "recognized-trigger" &&
      ability.trigger.eventType === "card.placed" && ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) && !(ability.costs || []).length &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "opponent-attacking-unit-attacked-at-least", count: 2 }]) &&
      definition.effects?.length === 1 && effect?.op === "modify-shield-source" && effect.target === "source" &&
      Number(effect.amount) === 15000 && effect.duration === "battle";
  }

  function isExactGenerationBreakInterceptShieldAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\\s+/g, " ").trim();
    const amount = cardId === "cfa-4972" ? 5000 : 10000;
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && GB_INTERCEPT_SHIELD_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:${cardId === "cfa-4972" ? 1 : 0}` && ability.gb === 1 &&
      definition.source?.patternId === "auto-intercept-generation-break-shield-battle-v1" &&
      printed === `AUTO Generation Break 1: When this unit intercepts, this unit gets shield +${amount} until end of that battle.` &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "source" && JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) &&
      ability.trigger.sourceLocation === "rear-guard" && !(ability.costs || []).length && !(ability.conditions || []).length &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "modify-shield-source" &&
      definition.effects[0].target === "source" && Number(definition.effects[0].amount) === amount && definition.effects[0].duration === "battle";
  }

  function isExactLowerVanguardGradeGuardianShieldAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && LOWER_VANGUARD_GRADE_GUARDIAN_SHIELD_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:0` &&
      definition.source?.patternId === "auto-gc-controller-vanguard-lower-grade-shield-v1" &&
      printed === "AUTO: When this unit is put on GC, if your vanguard's grade is less than your opponent's vanguard's grade, this unit gets shield +10000 until end of that battle." &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" && ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) && JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["guardian"]) &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "controller-vanguard-grade-lower-than-opponent" }]) &&
      !(ability.costs || []).length && definition.effects?.length === 1 && definition.effects[0]?.op === "modify-shield-source" &&
      definition.effects[0].target === "source" && Number(definition.effects[0].amount) === 10000 && definition.effects[0].duration === "battle";
  }

  function isExactAttackedVanguardInterceptShieldAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && ATTACKED_VANGUARD_INTERCEPT_SHIELD_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && definition.source?.patternId === "auto-intercept-controller-vanguard-attacked-shield-battle-v1" &&
      printed === "AUTO: When this unit intercepts during the battle that your vanguard was attacked, this unit gets shield +5000 until end of that battle." &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" && ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["guardian"]) && ability.trigger.sourceLocation === "rear-guard" &&
      JSON.stringify(ability.conditions || []) === JSON.stringify([{ type: "controller-vanguard-is-attacked-unit" }]) && !(ability.costs || []).length &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "modify-shield-source" && definition.effects[0].target === "source" &&
      Number(definition.effects[0].amount) === 5000 && definition.effects[0].duration === "battle";
  }

  function isAnyInterceptShieldAbility(ability) {
    return isExactInterceptShieldAbility(ability) || isExactClanInterceptShieldAbility(ability) ||
      isExactStructuredInterceptShieldAbility(ability) || isExactSecondAttackInterceptShieldAbility(ability) ||
      isExactGenerationBreakInterceptShieldAbility(ability) || isExactLowerVanguardGradeGuardianShieldAbility(ability) ||
      isExactAttackedVanguardInterceptShieldAbility(ability) || isExactQualifyingCriticalGcShieldAbility(ability);
  }

  function isExactQualifyingCriticalGcShieldAbility(ability) {
    const definition=ability?.definition,cardId=String(definition?.cardId||""),effect=definition?.effects?.[0];
    const printed=String(definition?.printedText||ability?.printedText||"").replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
    return ability?.kind==="AUTO"&&definition?.kind==="AUTO"&&QUALIFYING_CRITICAL_GC_SHIELD_CARD_IDS.has(cardId)&&
      String(ability.cardId)===cardId&&ability.id===`${cardId}:0`&&definition.source?.patternId==="auto-gc-qualifying-critical-shield-battle-v1"&&
      printed==="AUTO: When this unit is put on GC, if the attacking unit's critical is 2 or greater, and its critical is increased by an ability other than trigger effect or its original critical is 2 or greater, this unit gets shield +15000 until end of that battle."&&
      ability.trigger?.status==="recognized-trigger"&&ability.trigger.eventType==="card.placed"&&ability.trigger.subject==="source"&&
      JSON.stringify(ability.trigger.circles||[])===JSON.stringify(["guardian"])&&JSON.stringify(ability.requiredLocation||[])===JSON.stringify(["guardian"])&&
      !(ability.costs||[]).length&&!(ability.conditions||[]).length&&definition.effects?.length===1&&effect?.op==="modify-shield-source"&&
      effect.target==="source"&&Number(effect.amount)===15000&&effect.duration==="battle";
  }

  function interceptShieldTriggerMatches(state, ability, source, located, event, actorPlayerId) {
    const attack = state?.pendingAttack, side = located?.side, player = state?.players?.[side];
    return isAnyInterceptShieldAbility(ability) && Boolean(attack?.battleId) &&
      event?.type === "card.placed" && Boolean(event.eventId) && event.cardInstanceId === source?.uid &&
      event.subjectCardInstanceId === source?.uid && event.sourceCardInstanceId === source?.uid &&
      event.actingPlayerId === actorPlayerId && event.subjectControllerPlayerId === actorPlayerId &&
      (/^(?:rear-|accel-)/i.test(String(event.previousLocation || "")) ||
        ((isExactLowerVanguardGradeGuardianShieldAbility(ability)||isExactQualifyingCriticalGcShieldAbility(ability)) && event.previousLocation === "hand")) &&
      event.currentLocation === "guardian" && event.circle === "guardian" &&
      Boolean(event.battleId) && event.battleId === attack.battleId && attack.defenderSide === side &&
      (!isExactAttackedVanguardInterceptShieldAbility(ability) || (attack.targetZone === "vanguard" && attack.targetUid === player?.vanguard?.uid)) &&
      located?.zone === "guardian" && located.controllerPlayerId === actorPlayerId && player?.playerId === actorPlayerId &&
      Array.isArray(attack.guardCards) && attack.guardCards.some(card => card?.uid === source.uid) &&
      Array.isArray(player.guardCircle) && player.guardCircle.some(card => card?.uid === source.uid) &&
      (!isExactQualifyingCriticalGcShieldAbility(ability) || qualifyingCriticalShieldCondition(state,attack));
  }

  function qualifyingCriticalShieldCondition(state,attack){
    const player=state?.players?.[attack?.attackerSide],candidates=[player?.vanguard,...(player?.rear||[])].filter(card=>card?.uid===attack?.attackerUid);
    if(candidates.length!==1||Number(attack.critical)<2)return false;
    const attacker=candidates[0],originalCritical=Number(attacker.originalCritical??attacker.card?.critical??attacker.critical??1);
    return Number(attack.abilityCriticalBoost||attacker.turnCriticalAbilityBoost||0)>0||originalCritical>=2;
  }

  const ACT_RC_GRADE_THREE_SEARCH_CARD_IDS = new Set([
    "cfa-83", "cfa-178", "cfa-235", "cfa-265", "cfa-323", "cfa-381", "cfa-444", "cfa-707", "cfa-733", "cfa-781",
    "cfa-834", "cfa-899", "cfa-953", "cfa-989", "cfa-1068", "cfa-1229", "cfa-1599", "cfa-2405", "cfa-2439",
    "cfa-2474", "cfa-3505", "cfa-3519", "cfa-5531"
  ]);
  const ACT_RC_GRADE_THREE_SEARCH_GENERIC_IDS = new Set(["cfa-2405", "cfa-2439", "cfa-2474", "cfa-3505", "cfa-3519"]);

  const AUTO_VANGUARD_TOP_FIVE_SEARCH_CARD_IDS = new Set([
    "cfa-3002", "cfa-3483", "cfa-3501", "cfa-3544", "cfa-3550", "cfa-3552", "cfa-3610", "cfa-3629",
    "cfa-3781", "cfa-3792", "cfa-3799", "cfa-3808", "cfa-3947", "cfa-3967", "cfa-3985", "cfa-4298",
    "cfa-4333", "cfa-4352", "cfa-4369", "cfa-5495", "cfa-6135"
  ]);
  const ATTACKED_SELF_BATTLE_POWER_CARD_IDS = new Set(["cfa-2526", "cfa-2538", "cfa-2678", "cfa-2691", "cfa-3033"]);

  function isExactAttackedSelfBattlePowerAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const match = printed.match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit is attacked, this unit gets power \+(\d+) until the end of that battle\.$/i);
    const circles = match?.[1]?.toUpperCase() === "VC" ? ["vanguard"] : match?.[1]?.toUpperCase() === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"];
    const effect = definition?.effects?.[0];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && ATTACKED_SELF_BATTLE_POWER_CARD_IDS.has(cardId) &&
      definition?.source?.patternId === "auto-attacked-source-battle-power-v1" && String(ability.cardId) === cardId && Boolean(match) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "attack.declared" && ability.trigger.subject === "event-subject" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(circles) && !ability.costs?.length && !ability.conditions?.length &&
      definition.effects?.length === 1 && effect?.op === "modify-defending-source-power" && effect.target === "source" &&
      Number(effect.amount) === Number(match[2]) && effect.duration === "battle";
  }

  const ACT_SAME_NAME_SEARCH_CARD_IDS = new Set(["cfa-12250", "cfa-12263", "cfa-12273", "cfa-12350", "cfa-12361", "cfa-12371"]);
  const RIDE_PHASE_DISCARD_CALL_CARD_IDS = new Set(["cfa-12252", "cfa-12264", "cfa-12275", "cfa-12351", "cfa-12355", "cfa-12374"]);
  const DISCARD_GRADE_CALL_CARD_IDS = new Set(["cfa-12806", "cfa-12807", "cfa-12808", "cfa-12817", "cfa-12818", "cfa-13028"]);
  const ACT_VANGUARD_UNLOCK_CARD_IDS = new Set(["cfa-1777", "cfa-1778", "cfa-1779", "cfa-1780", "cfa-1781"]);
  const BOOST_DRAW_DISCARD_CARD_IDS = new Set(["cfa-8839", "cfa-3077"]);
  const ATTACKED_UNBOOSTED_PROTECT_CARD_IDS = new Set(["cfa-6703"]);
  const AUTO_NAMED_VANGUARD_SEARCH_CARD_NAMES = Object.freeze({
    "cfa-2025": "Seeker, Sacred Wingal",
    "cfa-2027": "Brawler, Skybeat Dragon",
    "cfa-2213": "Star-vader, Garnet Star Dragon",
    "cfa-2214": "Bluish Flame Liberator, Percival"
  });

  function isExactActSameNameSearchPowerAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const effects = definition?.effects || [], search = effects[0], power = effects[1];
    return ability?.kind === "ACT" && definition?.kind === "ACT" && ACT_SAME_NAME_SEARCH_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:0` && definition.source?.patternId === "act-counter-blast-same-name-search-power-v1" &&
      /^ACT \[VC\] 1\/Turn: COST \[Counter Blast 1\], search your deck for up to one card with the same card name as this unit, reveal it and put it into hand, shuffle the deck, and this unit gets power \+10000 until end of turn\.$/i.test(printed) &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard"]) && !ability.trigger && !(ability.conditions || []).length &&
      ability.costs?.length === 1 && ability.costs[0]?.type === "counter-blast" && Number(ability.costs[0]?.count) === 1 &&
      ability.usageRestriction?.type === "once-per-turn" && ability.usageRestriction.scope === "ability-instance" && ability.usageRestriction.reset === "turn" &&
      effects.length === 2 && search?.op === "search-deck-same-name-to-hand" && search.target === "controller" && search.maximum === 1 && !search.cardName &&
      power?.op === "modify-power" && power.target === "source" && Number(power.amount) === 10000 && power.duration === "turn";
  }

  function isExactRidePhaseDiscardCallAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\\s+/g, " ").trim();
    const trigger = ability?.trigger, effect = definition?.effects?.[0];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && RIDE_PHASE_DISCARD_CALL_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:0` &&
      definition.source?.patternId === "auto-ride-phase-discard-source-call-rested-v1" &&
      printed === "AUTO: When this card is discarded from hand during your ride phase, you may call this card to RC as rest." &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.discarded" && trigger.subject === "source" &&
      trigger.sourceLocation === "hand" && trigger.destinationLocation === "drop" && trigger.requiredPhase === "ride" &&
      !(ability.costs || []).length && !(ability.conditions || []).length && !ability.usageRestriction &&
      ability.canDecline === true && definition.effects?.length === 1 &&
      effect?.op === "call-source-from-drop-rested" && effect.target === "source" && effect.position === "rest";
  }
  function isExactDiscardGradeCallAbility(ability) {
    const definition=ability?.definition,cardId=String(definition?.cardId||""),trigger=ability?.trigger,effect=definition?.effects?.[0];
    const printed=String(definition?.printedText||ability?.printedText||"").replace(/\s+/g," ").trim();
    return ability?.kind==="AUTO"&&definition?.kind==="AUTO"&&DISCARD_GRADE_CALL_CARD_IDS.has(cardId)&&String(ability.cardId)===cardId&&ability.id===`${cardId}:0`&&
      definition.source?.patternId==="auto-turn-discard-grade-two-soul-blast-call-rested-v1"&&
      printed==="AUTO: When this card is discarded from hand during your turn, if your vanguard is grade 2 or greater, COST [Soul Blast 1], and call this card to RC. If it is your battle phase, this unit cannot attack until end of turn."&&
      trigger?.status==="recognized-trigger"&&trigger.eventType==="card.discarded"&&trigger.subject==="event-subject"&&trigger.sourceLocation==="hand"&&trigger.destinationLocation==="drop"&&trigger.turnRelation==="controller"&&
      JSON.stringify(ability.requiredLocation||[])===JSON.stringify(["hand"])&&JSON.stringify(ability.conditions||[])===JSON.stringify([{type:"controller-turn"},{type:"controller-vanguard-grade-at-least",count:2}])&&
      ability.costs?.length===1&&ability.costs[0]?.type==="soul-blast"&&Number(ability.costs[0]?.count)===1&&ability.canDecline===true&&definition.effects?.length===1&&
      effect?.op==="call-source-from-drop-rested"&&effect.target==="source"&&effect.position==="rest"&&effect.cannotAttackTurnKeyWhenBattlePhase===true;
  }
  function discardGradeCallEventMatches(ability,source,located,event,actorPlayerId,state) {
    const player=located&&state?.players?.[located.side];
    return isExactDiscardGradeCallAbility(ability)&&event?.type==="card.discarded"&&Boolean(event.eventId)&&event.cardInstanceId===source?.uid&&event.subjectCardInstanceId===source?.uid&&event.sourceCardInstanceId===source?.uid&&
      event.previousLocation==="hand"&&event.currentLocation==="drop"&&event.actingPlayerId===actorPlayerId&&event.turnPlayerId===actorPlayerId&&event.subjectOwnerPlayerId===source.ownerPlayerId&&event.subjectControllerPlayerId===actorPlayerId&&
      located?.zone==="drop"&&located.controllerPlayerId===actorPlayerId&&player?.playerId===actorPlayerId&&player.drop?.some(card=>card?.uid===source.uid);
  }

  function isExactVanguardUnlockAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\\s+/g, " ").trim();
    const effect = definition?.effects?.[0];
    return ability?.kind === "ACT" && definition?.kind === "ACT" && ACT_VANGUARD_UNLOCK_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:1` &&
      definition.source?.patternId === "act-vanguard-counter-blast-unlock-friendly-locked-v1" &&
      printed === "ACT [VC]: [Counter Blast 1] Choose one of your locked cards, and unlock it." &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard"]) && !ability.trigger &&
      !(ability.conditions || []).length && ability.costs?.length === 1 && ability.costs[0]?.type === "counter-blast" && Number(ability.costs[0]?.count) === 1 &&
      definition.effects?.length === 1 && effect?.op === "unlock-target" && effect.target === "chosen" &&
      effect.targetFilter?.controller === "source-controller" && effect.targetFilter?.locked === true;
  }

  function isExactBoostDrawDiscardAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\\s+/g, " ").trim();
    const paid = cardId === "cfa-3077";
    const expected = paid
      ? "AUTO [RC]: [Soul Blast 1] When this unit boosts a vanguard, you may pay the cost. If you do, draw a card, choose a card from your hand, and discard it."
      : "AUTO [RC]: When this unit boosts a vanguard, draw a card, choose a card from your hand, and discard it.";
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && BOOST_DRAW_DISCARD_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:0` &&
      definition.source?.patternId === (paid ? "auto-rc-vanguard-boost-soul-blast-draw-discard-v1" : "auto-rc-vanguard-boost-draw-discard-v1") &&
      printed === expected && JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "unit.boosted" && ability.trigger.subject === "source" &&
      ability.trigger.targetLocation === "vanguard" && !(ability.conditions || []).length && !ability.usageRestriction && ability.once !== true &&
      (paid ? ability.costs?.length === 1 && ability.costs[0]?.type === "soul-blast" && Number(ability.costs[0]?.count) === 1 && ability.canDecline === true : !(ability.costs || []).length && ability.canDecline !== true) &&
      definition.effects?.length === 1 && definition.effects[0]?.op === "draw-then-discard" && definition.effects[0].target === "controller" &&
      Number(definition.effects[0].drawCount) === 1 && Number(definition.effects[0].discardCount) === 1;
  }

  function isExactAttackedUnboostedProtectAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\\s+/g, " ").trim();
    const effect = definition?.effects?.[0];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" && ATTACKED_UNBOOSTED_PROTECT_CARD_IDS.has(cardId) &&
      String(ability.cardId) === cardId && ability.id === `${cardId}:1` &&
      printed === "AUTO [RC]: When this unit is attacked without being boosted, this unit cannot be hit until the end of that battle." &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "attack.declared" &&
      ability.trigger.subject === "event-subject" && ability.trigger.requiresUnboostedAttacker === true &&
      !(ability.conditions || []).length && !(ability.costs || []).length && !ability.usageRestriction &&
      definition.effects?.length === 1 && effect?.op === "protect-attacked-source" && effect.target === "source" && effect.duration === "battle";
  }

  function attackedUnboostedProtectEventMatches(state, ability, source, located, event) {
    const attack = state.pendingAttack;
    return isExactAttackedUnboostedProtectAbility(ability) && Boolean(source?.uid) &&
      event?.type === "attack.declared" && event.subjectCardInstanceId === source.uid &&
      event.cardInstanceId === source.uid && event.targetCardInstanceIds?.includes(source.uid) &&
      event.subjectOwnerPlayerId === source.ownerPlayerId && event.subjectControllerPlayerId === located.controllerPlayerId &&
      event.currentLocation === located.circle && event.targetLocation === located.circle &&
      event.sourceControllerPlayerId && event.sourceControllerPlayerId !== located.controllerPlayerId &&
      event.actingPlayerId === event.sourceControllerPlayerId && event.turnPlayerId === event.sourceControllerPlayerId &&
      event.phase === "battle" && event.timingWindow === "attack-declared" && Boolean(event.battleId) &&
      attack?.battleId === event.battleId && attack.targetUid === source.uid && attack.defenderSide === located.side &&
      attack.attackerSide !== located.side && attack.boostUid == null && event.boosterCardInstanceId == null &&
      located.zone === "rear-guard" && located.instance.uid === source.uid;
  }

  function boostDrawDiscardEventMatches(state, ability, source, located, event, engine) {
    if (!isExactBoostDrawDiscardAbility(ability) || event?.type !== "unit.boosted" || !source?.uid || !located?.controllerPlayerId) return false;
    const targetUid = event.boostedCardInstanceId;
    const target = targetUid ? engine.locateCardInstance(state, targetUid) : null;
    const attack = state.pendingAttack;
    return event.sourceCardInstanceId === source.uid && event.subjectCardInstanceId === source.uid &&
      event.boosterCardInstanceId === source.uid && event.boosterCardInstanceId === event.sourceCardInstanceId &&
      event.sourceOwnerPlayerId === source.ownerPlayerId && event.sourceControllerPlayerId === located.controllerPlayerId &&
      event.subjectOwnerPlayerId === source.ownerPlayerId && event.subjectControllerPlayerId === located.controllerPlayerId &&
      event.actingPlayerId === located.controllerPlayerId && event.turnPlayerId === located.controllerPlayerId &&
      event.phase === "battle" && event.timingWindow === "boost-step" && event.targetLocation === "vanguard" &&
      Array.isArray(event.targetCardInstanceIds) && event.targetCardInstanceIds.includes(targetUid) &&
      located.zone === "rear-guard" && located.instance.uid === source.uid && source.rested === true &&
      target && !target.ambiguous && target.zone === "vanguard" && target.side === located.side &&
      target.controllerPlayerId === located.controllerPlayerId && attack?.battleId === event.battleId &&
      attack.attackerUid === targetUid && attack.attackerZone === "vanguard" && attack.attackerSide === located.side && attack.boostUid === source.uid;
  }

  function ridePhaseDiscardEventMatches(ability, source, located, event) {
    return isExactRidePhaseDiscardCallAbility(ability) && Boolean(source?.uid) &&
      event?.type === "card.discarded" && event.cardInstanceId === source.uid &&
      event.subjectCardInstanceId === source.uid && event.sourceCardInstanceId === source.uid &&
      event.previousLocation === "hand" && event.currentLocation === "drop" && event.phase === "ride" &&
      event.actingPlayerId === located.controllerPlayerId && event.turnPlayerId === located.controllerPlayerId &&
      event.subjectOwnerPlayerId === source.ownerPlayerId && event.subjectControllerPlayerId === located.controllerPlayerId;
  }
  function ridePhaseDiscardHasLegalCircle(player) {
    const count = 5 + Math.max(0, Number(player?.accelZones) || 0);
    return Array.isArray(player?.rear) && player.rear.some((circle, index) => index < count && circle?.locked !== true);
  }

  function isExactAutoNamedVanguardSearchAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || ""), targetName = AUTO_NAMED_VANGUARD_SEARCH_CARD_NAMES[cardId];
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const effect = definition?.effects?.[0];
    const expectedText = `AUTO: [Counter Blast 1 & Soul Blast 1] When this unit is placed on VC, you may pay the cost. If you do, search your deck for up to one card named "${targetName}", reveal it to your opponent, put it into your hand, and shuffle your deck.`;
    return Boolean(targetName) && ability?.kind === "AUTO" && definition?.kind === "AUTO" && String(ability.cardId) === cardId &&
      ability.id === `${cardId}:0` && definition.source?.patternId === "auto-vanguard-placement-counter-soul-named-search-v1" &&
      printed.toLowerCase() === expectedText.toLowerCase() && ability.trigger?.status === "recognized-trigger" &&
      ability.trigger.eventType === "card.placed" && ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(["vanguard"]) && !(ability.conditions || []).length &&
      ability.costs?.length === 2 && ability.costs[0]?.type === "counter-blast" && Number(ability.costs[0]?.count) === 1 &&
      ability.costs[1]?.type === "soul-blast" && Number(ability.costs[1]?.count) === 1 && ability.canDecline === true &&
      !ability.usageRestriction && definition.effects?.length === 1 && effect?.op === "search-deck-same-name-to-hand" &&
      effect.target === "controller" && effect.maximum === 1 && effect.cardName === targetName;
  }

  function isExactAutoVanguardTopFiveSearchAbility(ability) {
    const definition = ability?.definition, cardId = String(definition?.cardId || "");
    const printed = definition?.printedText || ability?.printedText || "";
    const engine = globalThis.VanguardAbilityEngine;
    if (!engine?.compileVanguardTopFiveKeywordSearchDefinition || !AUTO_VANGUARD_TOP_FIVE_SEARCH_CARD_IDS.has(cardId)) return false;
    const expected = engine.compileVanguardTopFiveKeywordSearchDefinition(cardId, definition.id, "AUTO", printed);
    const effect = definition?.effects?.[0], trigger = ability?.trigger;
    const circles = /placed on VC\s+or\s+RC/i.test(String(printed)) || /placed on VC\/RC/i.test(String(printed)) ? ["vanguard", "rear-guard"] : ["vanguard"];
    const costText = String(printed).match(/(?:COST\s*)?\[Counter Blast (\d+)(?: & Soul Blast (\d+))?\]/i);
    const costs = ability?.costs || definition?.costs || [];
    const expectedCosts = costText ? [{ type: "counter-blast", count: Number(costText[1]) }, ...(costText[2] ? [{ type: "soul-blast", count: Number(costText[2]) }] : [])] : [];
    const costsMatch = costs.length === expectedCosts.length && expectedCosts.every((cost, index) => costs[index]?.type === cost.type && Number(costs[index]?.count) === cost.count);
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-vanguard-placement-top-five-filtered-search-hand-v1" &&
      String(ability.cardId) === cardId && Boolean(expected) && definition.effects?.length === 1 &&
      JSON.stringify(effect) === JSON.stringify(expected.effects[0]) && trigger?.status === "recognized-trigger" &&
      trigger.eventType === "card.placed" && trigger.subject === "source" &&
      JSON.stringify(trigger.circles || []) === JSON.stringify(circles) && costsMatch && ability.canDecline === true;
  }

  function isExactActRcGradeThreeSearchAbility(ability) {
    const definition = ability?.definition, effect = definition?.effects?.[0], filter = effect?.filter;
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const match = printed.match(/^ACT \[RC\]: \[Counter Blast 1 & Put this unit into your soul\] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater (?:«([^»]+)»|card) from among them, reveal it(?: to your opponent)?, put it (?:to|into) your hand, and shuffle your deck\.$/i);
    const generic = ACT_RC_GRADE_THREE_SEARCH_GENERIC_IDS.has(cardId);
    const filterMatches = generic
      ? Boolean(filter && Object.keys(filter).length === 1 && Number(filter.minGrade) === 3)
      : Boolean(match?.[1] && filter && Object.keys(filter).length === 3 && Number(filter.minGrade) === 3 &&
        filter.cardType === "unit" && String(filter.clan) === match[1]);
    return ability?.kind === "ACT" && definition?.kind === "ACT" &&
      definition?.source?.patternId === "act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1" &&
      ACT_RC_GRADE_THREE_SEARCH_CARD_IDS.has(cardId) && String(ability.cardId) === cardId && Boolean(match) && filterMatches &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["rear-guard"]) &&
      (ability.costs || []).length === 2 && ability.costs[0]?.type === "counter-blast" && Number(ability.costs[0].count) === 1 &&
      ability.costs[1]?.type === "source-to-soul" && Number(ability.costs[1].count) === 1 &&
      !definition.once && !definition.usageRestriction && definition.effects?.length === 1 && effect?.op === "search-top-up-to-one-filtered-to-hand" &&
      effect.target === "controller" && Number(effect.lookCount) === 5 && Number(effect.maximum) === 1;
  }

  const HAND_RIDE_PHASE_SEARCH_CARD_IDS = new Set([
    "cfa-10635", "cfa-10636", "cfa-10758", "cfa-10760", "cfa-10863", "cfa-10864", "cfa-10926", "cfa-10927",
    "cfa-11050", "cfa-11051", "cfa-11264", "cfa-11265", "cfa-11584", "cfa-11585", "cfa-11902", "cfa-11903",
    "cfa-12024", "cfa-12025", "cfa-12170", "cfa-12171", "cfa-12209", "cfa-12210"
  ]);
  const HAND_RIDE_PHASE_BASE_TEXT = "AUTO [Hand]: At the beginning of your ride phase, if your vanguard is grade 1 or less, COST [discard this card], look at the top five cards of your deck, choose up to one grade 2 or less card from among them, reveal it and put it into your hand, and shuffle your deck.";
  const HAND_RIDE_PHASE_ALTERNATE_TEXT = "AUTO [Hand]: At the beginning of your ride phase, if your vanguard is grade 1 or less, COST [discard this card], look at the top five cards of your deck, choose up to one grade 2 or less card from among them, reveal it and put it into hand, and shuffle the deck.";

  function isExactHandRidePhaseSearchAbility(ability) {
    const definition = ability?.definition, effect = definition?.effects?.[0];
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\r/g, "").trim();
    const [mainText, ...suffixLines] = printed.split("\n\n");
    const suffix = suffixLines.join("\n\n");
    const suffixMatches = cardId === "cfa-10636"
      ? suffix === "(SHIFT + left click to count up attacks.)\n(SHIFT + right click to count down attacks.)\n(Middle click or hover and press SPACE to set number of attacks.)"
      : cardId === "cfa-10760"
      ? suffix === "(SHIFT + left click to call plant token.)"
      : suffix === "";
    const textMatches = mainText === HAND_RIDE_PHASE_BASE_TEXT ||
      (HAND_RIDE_PHASE_ALTERNATE_TEXT === mainText && ["cfa-11050", "cfa-11051", "cfa-11902", "cfa-11903"].includes(cardId));
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1" &&
      HAND_RIDE_PHASE_SEARCH_CARD_IDS.has(cardId) && String(ability.cardId) === cardId && textMatches && suffixMatches &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["hand"]) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "phase.changed" &&
      ability.trigger.subject === "controller" && ability.trigger.requiredPhase === "ride" && ability.trigger.turnRelation === "controller" &&
      (ability.costs || []).length === 1 && ability.costs[0]?.type === "source-discard" && Number(ability.costs[0].count) === 1 &&
      (ability.conditions || []).length === 1 && ability.conditions[0]?.type === "controller-vanguard-grade-at-most" && Number(ability.conditions[0].count) === 1 &&
      !definition.once && !definition.usageRestriction && definition.effects?.length === 1 &&
      effect?.op === "search-top-up-to-one-grade-to-hand" && effect.target === "controller" &&
      Number(effect.lookCount) === 5 && Number(effect.maximumGrade) === 2;
  }

  function isExactRcGradeThreeNameSearchAbility(ability) {
    const definition = ability?.definition, effect = definition?.effects?.[0];
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "")
      .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const match = printed.match(/^AUTO:\s*When this unit is placed on RC from hand, COST \[reveal a grade 3 card from hand\], search your deck for up to one grade 3 card with "([^"]+)" in its card name, reveal it and put it into your hand, shuffle your deck, choose a card from your hand, and discard it\.$/i);
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-rc-from-hand-reveal-grade-three-search-name-discard-v1" &&
      RC_GRADE_THREE_NAME_SEARCH_CARD_IDS.has(cardId) && String(ability.cardId) === cardId && Boolean(match) &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify([]) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "source" && (ability.trigger.circles || []).length === 1 && ability.trigger.circles[0] === "rear-guard" &&
      ability.trigger.sourceLocation === "hand" && (ability.costs || []).length === 1 &&
      ability.costs[0]?.type === "reveal-grade-from-hand" && Number(ability.costs[0].count) === 1 && Number(ability.costs[0].grade) === 3 &&
      (ability.conditions || []).length === 1 && ability.conditions[0]?.type === "source-placed-from-hand" &&
      definition.effects?.length === 1 && effect?.op === "search-deck-named-grade-three-then-discard" &&
      effect.target === "controller" && Number(effect.grade) === 3 && effect.nameContains === match[1] && Number(effect.discardCount) === 1;
  }

  const HARMONY_ASSOCIATION_CARD_IDS = new Set([
    "cfa-3002", "cfa-3003", "cfa-3004", "cfa-3005", "cfa-3006", "cfa-3007", "cfa-3013", "cfa-3016",
    "cfa-3017", "cfa-3018", "cfa-3022", "cfa-3770", "cfa-3772", "cfa-3819", "cfa-3883", "cfa-3884",
    "cfa-3891", "cfa-3893", "cfa-3894", "cfa-3895", "cfa-3898", "cfa-3900", "cfa-3902", "cfa-3906",
    "cfa-3907", "cfa-3908", "cfa-3909", "cfa-3912", "cfa-3917", "cfa-3919", "cfa-3921", "cfa-3930",
    "cfa-4921", "cfa-4939", "cfa-4940", "cfa-4942", "cfa-4950", "cfa-4951", "cfa-4964", "cfa-4971",
    "cfa-5626", "cfa-5634", "cfa-5645", "cfa-5665", "cfa-5668", "cfa-6624", "cfa-12509"
  ]);

  function isExactHarmonyAssociationAbility(ability) {
    const definition = ability?.definition, effect = definition?.effects?.[0];
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const match = printed.match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*Harmony(?:\s*\(When (?:another of your units is placed on the same column as this unit, both units are in Harmony state until end of turn\.|your other unit is placed in the same column as this unit, both units become in harmony until end of turn\.?))?\)?\.?$/i);
    const expectedLocations = match?.[1]?.toUpperCase() === "VC" ? ["vanguard"]
      : match?.[1]?.toUpperCase() === "RC" ? ["rear-guard"]
      : ["vanguard", "rear-guard"];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-harmony-same-column-association-v1" &&
      HARMONY_ASSOCIATION_CARD_IDS.has(cardId) && String(ability.cardId) === cardId && Boolean(match) &&
      JSON.stringify(definition.requiredLocation || ability.requiredLocation || []) === JSON.stringify(expectedLocations) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "any" && !(ability.trigger.circles || []).length &&
      !(ability.costs || []).length && !(ability.conditions || []).length && definition.effects?.length === 1 &&
      effect?.op === "associate-harmony-units" && effect.target === "source-and-event-subject" && effect.duration === "turn";
  }

  function harmonyColumn(zone) {
    if (zone === "vanguard" || zone === "rear-back-center" || zone === "rear-3") return "center";
    if (["rear-left", "rear-back-left", "rear-0", "rear-2"].includes(zone)) return "left";
    if (["rear-right", "rear-back-right", "rear-1", "rear-4"].includes(zone)) return "right";
    if (String(zone || "").startsWith("accel-")) return String(zone);
    return null;
  }

  function isHarmonyFieldLocation(zone) { return zone === "vanguard" || Boolean(harmonyColumn(zone)); }

  function harmonyAssociationAtTrigger(state, event, source, sourceSide, engine) {
    if (event?.type !== "card.placed" || !event.eventId || !source?.uid) return null;
    const subjectUid = event.subjectCardInstanceId;
    if (typeof subjectUid !== "string" || event.cardInstanceId !== subjectUid || subjectUid === source.uid) return null;
    const subject = engine.locateCardInstance(state, subjectUid);
    const locatedSource = engine.locateCardInstance(state, source.uid);
    if (!subject || subject.ambiguous || !locatedSource || locatedSource.ambiguous || !["vanguard", "rear-guard"].includes(subject.zone) || !["vanguard", "rear-guard"].includes(locatedSource.zone)) return null;
    const sourceZone = locatedSource.circle || locatedSource.zone, subjectZone = subject.circle || subject.zone;
    const eventZone = event.currentLocation || event.circle;
    const sourceColumn = harmonyColumn(sourceZone), subjectColumn = harmonyColumn(subjectZone);
    if (!isHarmonyFieldLocation(eventZone) || harmonyColumn(eventZone) !== subjectColumn || !sourceColumn || sourceColumn !== subjectColumn ||
        locatedSource.side !== sourceSide || subject.side !== sourceSide || subject.controllerPlayerId !== locatedSource.controllerPlayerId ||
        locatedSource.controllerPlayerId !== source.controllerPlayerId ||
        (event.subjectControllerPlayerId && event.subjectControllerPlayerId !== locatedSource.controllerPlayerId)) return null;
    return { subjectUid, turnKey: `${state.turn}:${state.side}` };
  }

  function removeHarmonyAssociationsForEvent(state, event, engine) {
    if (typeof engine.removeHarmonyAssociationsForInstance !== "function") return;
    const leaving = new Set();
    if (event?.type === "card.ridden") for (const uid of event.targetCardInstanceIds || []) leaving.add(uid);
    const subjectUid = event?.subjectCardInstanceId || event?.cardInstanceId;
    const previous = event?.previousLocation || event?.targetPreviousLocation;
    if (subjectUid && isHarmonyFieldLocation(previous) && !isHarmonyFieldLocation(event?.currentLocation)) leaving.add(subjectUid);
    for (const uid of leaving) if (typeof uid === "string") engine.removeHarmonyAssociationsForInstance(state, uid);
  }

  function isExactConditionalDiscardGuardianAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [];
    const cardId = String(definition?.cardId || "");
    const printed = String(definition?.printedText || ability?.printedText || "")
      .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const protect = effects[0], discard = effects[1];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-gc-protect-then-conditional-discard-v1" &&
      CONDITIONAL_DISCARD_GUARDIAN_CARD_IDS.has(cardId) && String(ability.cardId) === cardId &&
      /^AUTO:\s*When this unit is put on GC, choose one of your units, and it cannot be hit until end of that battle\. If your hand has two or more cards, choose a card from (?:your )?hand, and discard it\.$/i.test(printed) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "source" && (ability.trigger.circles || []).length === 1 && ability.trigger.circles[0] === "guardian" &&
      (ability.costs || []).length === 0 && (ability.conditions || []).length === 0 && effects.length === 2 &&
      protect?.op === "protect-target" && protect.target === "chosen" && protect.duration === "battle" &&
      protect.requiresAttackedTarget === true && protect.targetFilter?.controller === "source-controller" &&
      protect.targetFilter?.cardType === "unit" && protect.targetFilter?.mustBeAttacked === true &&
      discard?.op === "discard-from-hand" && discard.target === "controller" && discard.count === 1 &&
      discard.condition?.op === "hand-count-at-least" && discard.condition.count === 2;
  }

  const NAMED_DROP_GUARDIAN_CARD_IDS = new Set([
    "cfa-2549", "cfa-2564", "cfa-2578", "cfa-2590", "cfa-2597", "cfa-2605", "cfa-2629", "cfa-2633",
    "cfa-2646", "cfa-2774", "cfa-2926", "cfa-2939", "cfa-2947", "cfa-2959", "cfa-2973", "cfa-3014",
    "cfa-3131", "cfa-3137", "cfa-3145", "cfa-3325", "cfa-3491", "cfa-3514", "cfa-3525", "cfa-3585"
  ]);

  const HOLLOW_PLACEMENT_CARD_IDS = new Set([
    "cfa-3552", "cfa-3553", "cfa-3554", "cfa-3556", "cfa-3579", "cfa-3583", "cfa-3584", "cfa-3587",
    "cfa-3591", "cfa-3657", "cfa-3679", "cfa-3937", "cfa-4027", "cfa-4028", "cfa-4070", "cfa-4250",
    "cfa-4487", "cfa-4647", "cfa-4656", "cfa-4658", "cfa-4659", "cfa-4671", "cfa-4680", "cfa-4725",
    "cfa-4726", "cfa-4727", "cfa-4763", "cfa-13175", "cfa-13178", "cfa-13179", "cfa-13208", "cfa-13233"
  ]);

  const VANGUARD_PLACEMENT_DRAW_DISCARD_CARD_IDS = new Set([
    "cfa-6496", "cfa-6743", "cfa-6744", "cfa-6745", "cfa-6799", "cfa-6805", "cfa-6810",
    "cfa-6870", "cfa-6874", "cfa-6875", "cfa-6972", "cfa-6973", "cfa-6974", "cfa-6975",
    "cfa-7018", "cfa-7022", "cfa-7029", "cfa-7121", "cfa-7131", "cfa-7140", "cfa-7182",
    "cfa-7190", "cfa-7197", "cfa-7217", "cfa-7359", "cfa-11338", "cfa-11356", "cfa-11489"
  ]);

  const G_GUARDIAN_GRADE_THREE_CHOICE_CARD_IDS = new Set([
    "cfa-8698", "cfa-8963", "cfa-8964", "cfa-8971", "cfa-8975", "cfa-8979", "cfa-8983",
    "cfa-8987", "cfa-8995", "cfa-9006", "cfa-9013", "cfa-9020", "cfa-9027", "cfa-9034",
    "cfa-9048", "cfa-9049", "cfa-9050", "cfa-9051", "cfa-9052", "cfa-9053", "cfa-9069",
    "cfa-9072", "cfa-9079", "cfa-9080", "cfa-12550", "cfa-12724", "cfa-12786"
  ]);

  const G_GUARDIAN_GRADE_THREE_CHOICE_TEXT = "AUTO: When this unit is put on GC from hand, if you did not ride a grade 3 or greater unit this fight, perform one of the following.\n• Choose one of your vanguards, and it gets power +10000 until end of turn.\n• Choose one of your opponent’s units, and it gets critical -2 until end of that battle.";

  const BLAZE_CARD_IDS = new Set([
    "cfa-3669", "cfa-3687", "cfa-3786", "cfa-3797", "cfa-3798", "cfa-3799", "cfa-3800",
    "cfa-3844", "cfa-3847", "cfa-3848", "cfa-3851", "cfa-3852", "cfa-3854", "cfa-4817",
    "cfa-4818", "cfa-4819", "cfa-4820", "cfa-4821", "cfa-4851", "cfa-4857", "cfa-4897",
    "cfa-4906", "cfa-4907", "cfa-5275", "cfa-5276", "cfa-5304", "cfa-6665"
  ]);

  const EMPTY_DAMAGE_DECK_TO_DAMAGE_CARD_IDS = new Set([
    "cfa-8698", "cfa-8963", "cfa-8964", "cfa-8971", "cfa-8975", "cfa-8979", "cfa-8983",
    "cfa-8987", "cfa-8995", "cfa-9006", "cfa-9013", "cfa-9020", "cfa-9027", "cfa-9034",
    "cfa-9048", "cfa-9049", "cfa-9050", "cfa-9051", "cfa-9052", "cfa-9053", "cfa-9069",
    "cfa-9072", "cfa-9079", "cfa-9080", "cfa-12550", "cfa-12724", "cfa-12786"
  ]);

  const PLACEMENT_TOP_FIVE_SEARCH_DISCARD_CARD_IDS = new Set([
    "cfa-7289", "cfa-7290", "cfa-7306", "cfa-7431", "cfa-7471", "cfa-7476", "cfa-7568",
    "cfa-7634", "cfa-7658", "cfa-7676", "cfa-7702", "cfa-7714", "cfa-7751", "cfa-7783",
    "cfa-7829", "cfa-7850", "cfa-7870", "cfa-7912", "cfa-7923", "cfa-7945", "cfa-7973",
    "cfa-8000", "cfa-8013", "cfa-8037", "cfa-11568"
  ]);

  const PLACEMENT_TOP_FIVE_SEARCH_DISCARD_TEXTS = new Set([
    "AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 from among them and put it into your hand, shuffle your deck, and if you put a card, discard a card from your hand.",
    "AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 card from among them and put it into your hand, shuffle your deck, and if you put a card into your hand, discard a card from your hand.",
    "AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 from among them, put it into your hand, and shuffle your deck. If you put a card into your hand, discard a card from your hand.",
    "AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 card from among them, put it into your hand, shuffle your deck, and if you put a card, discard a card from your hand.",
    "AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 from among them and put it into your hand, shuffle your deck, and if you put a card into your hand, discard a card from your hand.",
    "AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 or greater from among them and put it into your hand, shuffle your deck, and if you put a card, discard a card from your hand."
  ]);

  function isExactPlacementTopFiveSearchDiscardAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-placement-top-five-grade-three-search-discard-v1" &&
      PLACEMENT_TOP_FIVE_SEARCH_DISCARD_CARD_IDS.has(String(definition.cardId)) &&
      String(ability.cardId) === String(definition.cardId) && String(ability.id).startsWith(`${String(definition.cardId)}:`) &&
      PLACEMENT_TOP_FIVE_SEARCH_DISCARD_TEXTS.has(printed) &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.placed" && trigger.subject === "source" &&
      JSON.stringify(trigger.circles || []) === JSON.stringify(["vanguard", "rear-guard"]) && trigger.sourceLocation === "hand" &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(["vanguard", "rear-guard"]) &&
      (ability.costs || []).length === 0 && (ability.conditions || []).length === 0 && effects.length === 1 &&
      effects[0]?.op === "search-top-grade-three-to-hand-then-discard" && effects[0].target === "controller" &&
      effects[0].lookCount === 5 && effects[0].minGrade === 3 && effects[0].discardCount === 1;
  }

  function isExactEmptyDamageDeckToDamageAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-rc-from-hand-empty-damage-deck-to-damage-v1" &&
      EMPTY_DAMAGE_DECK_TO_DAMAGE_CARD_IDS.has(String(definition.cardId)) &&
      String(ability.cardId) === String(definition.cardId) && String(ability.id).startsWith(`${String(definition.cardId)}:`) &&
      printed === "AUTO: When this unit is placed on RC from hand, if your damage zone has no cards, put the top card of your deck into the damage zone." &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.placed" && trigger.subject === "source" &&
      JSON.stringify(trigger.circles || []) === JSON.stringify(["rear-guard"]) && trigger.sourceLocation === "hand" &&
      ability.conditions?.length === 2 && ability.conditions[0]?.type === "damage-zone-empty" && ability.conditions[1]?.type === "source-placed-from-hand" &&
      (ability.costs || []).length === 0 && effects.length === 1 && effects[0]?.op === "deck-to-damage" &&
      effects[0].target === "controller" && effects[0].count === 1;
  }

  function isExactBlazeAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], printed = String(definition?.printedText || ability?.printedText || "").replace(/\s+/g, " ").trim();
    const match = printed.match(/^AUTO \[(VC\/RC|VC|RC)\]: Blaze(?: \(At the beginning of (your first|your each|each of your) attack, if the number of rear-guards you have is greater than your opponent[’']s, your vanguard becomes blazing until end of turn\.\))?\.?$/i);
    if (!match) return false;
    const circles = match[1].toUpperCase() === "VC" ? ["vanguard"] : match[1].toUpperCase() === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"];
    const firstAttack = /your first/i.test(match[2] || "");
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-blaze-own-attack-more-rearguards-v1" &&
      BLAZE_CARD_IDS.has(String(definition.cardId)) && String(ability.cardId) === String(definition.cardId) &&
      String(ability.id).startsWith(`${String(definition.cardId)}:`) &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "attack.step-started" &&
      ability.trigger.subject === "controller" && ability.trigger.turnRelation === "controller" &&
      Boolean(ability.trigger.firstAttackOnly) === firstAttack &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(circles) &&
      ability.conditions?.length === 1 && ability.conditions[0]?.type === "controller-has-more-rear-guards-than-opponent" &&
      (ability.costs || []).length === 0 && effects.length === 1 && effects[0]?.op === "set-blazing" && effects[0].target === "vanguard";
  }

  function isExactGGuardianGradeThreeChoiceAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [], trigger = ability?.trigger;
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-gc-no-grade-three-ride-choice-v1" &&
      G_GUARDIAN_GRADE_THREE_CHOICE_CARD_IDS.has(String(definition.cardId)) &&
      String(ability.cardId) === String(definition.cardId) && String(ability.id).startsWith(`${String(definition.cardId)}:`) &&
      definition.printedText === G_GUARDIAN_GRADE_THREE_CHOICE_TEXT &&
      trigger?.status === "recognized-trigger" && trigger.eventType === "card.placed" && trigger.subject === "source" &&
      JSON.stringify(trigger.circles || []) === JSON.stringify(["guardian"]) && trigger.sourceLocation === "hand" &&
      ability.conditions?.length === 1 && ability.conditions[0]?.type === "controller-has-not-ridden-grade-three-plus-this-fight" &&
      (ability.costs || []).length === 0 && effects.length === 1 &&
      effects[0]?.op === "g-guardian-grade-three-replacement-choice" && effects[0].target === "controller" &&
      JSON.stringify(effects[0].choices) === JSON.stringify([
        { id: "vanguard-power", amount: 10000, targetFilter: { controller: "source-controller", cardType: "unit", zone: "vanguard" } },
        { id: "opponent-critical", amount: -2, targetFilter: { controller: "opponent", cardType: "unit" } }
      ]);
  }

  function isExactVanguardPlacementDrawDiscardAbility(ability) {
    const definition = ability?.definition;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const sameNameOncePerTurn = /This ability may only be used by a card with the same card name once a turn\.$/i.test(printed);
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-vanguard-placement-draw-discard-v1" &&
      VANGUARD_PLACEMENT_DRAW_DISCARD_CARD_IDS.has(String(definition.cardId)) &&
      String(ability.id) === `${String(definition.cardId)}:${String(ability.id).split(":").at(-1)}` &&
      String(ability.cardId) === String(definition.cardId) &&
      /^AUTO \[(?:VC|VC\/RC)\]: When placed, draw a card, and discard a card(?: from your hand)?\.(?: This ability may only be used by a card with the same card name once a turn\.)?$/i.test(printed) &&
      sameNameOncePerTurn === (String(definition.cardId) === "cfa-6496") &&
      ability.trigger?.status === "recognized-trigger" && ability.trigger.eventType === "card.placed" &&
      ability.trigger.subject === "source" &&
      JSON.stringify(ability.trigger.circles || []) === JSON.stringify(String(definition.cardId) === "cfa-6496" ? ["vanguard", "rear-guard"] : ["vanguard"]) &&
      JSON.stringify(ability.requiredLocation || []) === JSON.stringify(String(definition.cardId) === "cfa-6496" ? ["vanguard", "rear-guard"] : ["vanguard"]) &&
      (ability.costs || []).length === 0 && (ability.conditions || []).length === 0 && definition.effects?.length === 1 &&
      definition.effects[0]?.op === "draw-then-discard" && definition.effects[0].target === "controller" &&
      definition.effects[0].drawCount === 1 && definition.effects[0].discardCount === 1 &&
      (sameNameOncePerTurn
        ? ability.usageRestriction?.type === "once-per-turn" && ability.usageRestriction.scope === "card-name-and-ability" && ability.usageRestriction.reset === "turn"
        : !ability.usageRestriction && ability.once !== true);
  }

  function isExactHollowPlacementAbility(ability) {
    const definition = ability?.definition;
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-hollow-placement-retire-turn-end-v1" &&
      HOLLOW_PLACEMENT_CARD_IDS.has(String(definition.cardId)) && String(ability.cardId) === String(definition.cardId) &&
      /^AUTO:\s*Hollow(?:\s*\(When this unit is placed on\s*\(?RC\)?, you may have (?:this unit|it) become hollowed\. If you do, retire it at the end of turn\.?\))?\.?$/i.test(printed) &&
      ability.trigger?.eventType === "card.placed" && ability.trigger?.subject === "source" &&
      (ability.trigger?.circles || []).length === 1 && ability.trigger.circles[0] === "rear-guard" &&
      (!ability.costs || ability.costs.length === 0) && Array.isArray(definition.effects) && definition.effects.length === 1 &&
      definition.effects[0]?.op === "set-hollowed" && definition.effects[0]?.target === "source";
  }

  // This conditional effect is deliberately supported only for the reviewed,
  // exact named-Drop G-Guardian family. It is not a general operation allowlist.
  function isExactNamedDropGuardianAbility(ability) {
    const definition = ability?.definition, effects = definition?.effects || [];
    const printed = String(definition?.printedText || ability?.printedText || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    const match = printed.match(/^AUTO:\s*When this unit is placed on GC from hand, COST \[discard a card from hand\], choose one of your vanguards being attacked, and it cannot be hit until end of that battle\. If your drop has a \"([^\"]+)\", Counter Charge 1\.$/i);
    const protect = effects[0], charge = effects[1];
    return ability?.kind === "AUTO" && definition?.kind === "AUTO" &&
      definition?.source?.patternId === "auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1" &&
      NAMED_DROP_GUARDIAN_CARD_IDS.has(String(definition.cardId)) && String(ability.cardId) === String(definition.cardId) &&
      Boolean(match) && ability.trigger?.eventType === "card.placed" && ability.trigger?.sourceLocation === "hand" &&
      (ability.trigger?.circles || []).includes("guardian") && ability.costs?.length === 1 &&
      ability.costs[0]?.type === "discard" && Number(ability.costs[0]?.count) === 1 &&
      effects.length === 2 && protect?.op === "protect-target" && protect.target === "chosen" && protect.duration === "battle" &&
      protect.requiresAttackedTarget === true && protect.targetFilter?.controller === "source-controller" &&
      protect.targetFilter?.cardType === "unit" && protect.targetFilter?.zone === "vanguard" && protect.targetFilter?.mustBeAttacked === true &&
      charge?.op === "conditional-counter-charge" && charge.target === "controller" && Number(charge.count) === 1 &&
      charge.condition?.type === "controller-drop-has-card-name" && charge.condition.cardName === match[1];
  }

  function supportsServerAbilityEffects(ability) {
    const effects = ability?.definition?.effects;
    if (!Array.isArray(effects) || !effects.length) return false;
    const hasConditionalCharge = effects.some(step => step?.op === "conditional-counter-charge");
    const hasConditionalGuardianDiscard = effects.some(step => step?.op === "discard-from-hand");
    const hasTokenCreation = effects.some(step => step?.op === "create-token");
    const hasSecondPlayerRideDraw = ability?.definition?.source?.patternId === "auto-rode-upon-second-player-draw-v1";
    const hasHarmonyAssociation = effects.some(step => step?.op === "associate-harmony-units");
    const hasHollow = effects.some(step => step?.op === "set-hollowed");
    const hasDrawThenDiscard = effects.some(step => step?.op === "draw-then-discard");
    const hasGGuardianGradeThreeChoice = effects.some(step => step?.op === "g-guardian-grade-three-replacement-choice");
    const hasBlazing = effects.some(step => step?.op === "set-blazing");
    const hasDeckToDamage = effects.some(step => step?.op === "deck-to-damage");
    const hasPlacementTopFiveSearchDiscard = effects.some(step => step?.op === "search-top-grade-three-to-hand-then-discard");
    const hasRcGradeThreeNameSearch = effects.some(step => step?.op === "search-deck-named-grade-three-then-discard");
    const hasInterceptShield = effects.some(step => step?.op === "modify-shield-source");
    const hasActRcGradeThreeSearch = effects.some(step => step?.op === "search-top-up-to-one-filtered-to-hand");
    const hasHandRidePhaseSearch = effects.some(step => step?.op === "search-top-up-to-one-grade-to-hand");
    const hasSameNameDeckSearch = effects.some(step => step?.op === "search-deck-same-name-to-hand");
    const hasCharging = effects.some(step => step?.op === "set-charging");
    const hasGuardianTopFiveCall = effects.some(step => step?.op === "call-top-to-guardian");
    const hasAttackedSelfBattlePower = effects.some(step => step?.op === "modify-defending-source-power");
    const hasRidePhaseDiscardCall = effects.some(step => step?.op === "call-source-from-drop-rested");
    const hasUnlockTarget = effects.some(step => step?.op === "unlock-target");
    const hasAttackedUnboostedProtect = effects.some(step => step?.op === "protect-attacked-source");
    const hasReorderDeckCard = effects.some(step => step?.op === "reorder-deck-card");
    const hasModifyDriveTarget = effects.some(step => step?.op === "modify-drive-target");
    const hasCallCheckedCardLocked = effects.some(step => step?.op === "call-checked-card-locked");
    const hasModifyDrive = effects.some(step => step?.op === "modify-drive");
    const hasSuccess = effects.some(step => step?.op === "set-successful");
    const isVanguardHitClanStand = ability?.definition?.source?.patternId === "auto-vanguard-own-attack-hit-clan-counter-blast-stand-v1";
    if (ability?.definition?.source?.patternId === "auto-rc-drive-check-trigger-unit-power-turn-v1" && !isExactTriggerUnitDrivePowerAbility(ability)) return false;
    if (ability?.definition?.source?.patternId === "auto-rc-placement-soul-charge-one-v1" && !isExactRcPlacementSoulChargeOneAbility(ability)) return false;
    if (ability?.definition?.source?.patternId === "auto-vanguard-or-rearguard-placement-optional-soul-charge-one-v1" && !isExactVanguardOrRearGuardOptionalSoulChargeAbility(ability)) return false;
    if (ability?.definition?.source?.patternId === "auto-rc-return-to-hand-counter-soul-blast-draw-v1" && !isExactRcReturnToHandCostDrawAbility(ability)) return false;
    if (ability?.definition?.source?.patternId === "auto-hand-discard-self-optional-to-soul-v1" && !isExactDiscardSelfOptionalSoulAbility(ability)) return false;
    if (ability?.definition?.source?.patternId === "auto-vanguard-own-attack-soul-charge-power-battle-v1" && !isExactVanguardAttackSoulChargePowerAbility(ability)) return false;
    const isBoostedClosePattern = ability?.definition?.source?.patternId === "auto-boosted-battle-close-source-to-soul-power-v1";
    if (isBoostedClosePattern && !isExactBoostedCloseTypoAbility(ability)) return false;
    const hasClanCounterBlastFilter = (ability?.costs || []).some(cost => cost?.type === "counter-blast" && cost.filter?.clan);
    if (hasClanCounterBlastFilter && !isExactClanCounterBlastAttackPowerAbility(ability)) return false;
    if (ability?.definition?.source?.patternId === "auto-own-attack-clan-soul-blast-power-battle-v1" && !isExactClanSoulBlastAttackPowerAbility(ability)) return false;
    if (isVanguardHitClanStand && !isExactVanguardHitClanStandAbility(ability)) return false;
    if (hasSuccess && !isExactSuccessAbility(ability)) return false;
    if (hasConditionalCharge && !isExactNamedDropGuardianAbility(ability)) return false;
    if (hasConditionalGuardianDiscard && !isExactConditionalDiscardGuardianAbility(ability)) return false;
    if (hasTokenCreation && !isExactQuickShieldRideAbility(ability)) return false;
    if (hasSecondPlayerRideDraw && !isExactSecondPlayerRideDrawAbility(ability)) return false;
    if (hasHarmonyAssociation && !isExactHarmonyAssociationAbility(ability)) return false;
    if (hasHollow && !isExactHollowPlacementAbility(ability)) return false;
    if (hasDrawThenDiscard && !isExactVanguardPlacementDrawDiscardAbility(ability) && !isExactBoostDrawDiscardAbility(ability)) return false;
    if (hasGGuardianGradeThreeChoice && !isExactGGuardianGradeThreeChoiceAbility(ability)) return false;
    if (hasBlazing && !isExactBlazeAbility(ability)) return false;
    if (hasDeckToDamage && !isExactEmptyDamageDeckToDamageAbility(ability)) return false;
    if (hasPlacementTopFiveSearchDiscard && !isExactPlacementTopFiveSearchDiscardAbility(ability)) return false;
    if (hasRcGradeThreeNameSearch && !isExactRcGradeThreeNameSearchAbility(ability)) return false;
    if (hasInterceptShield && !isAnyInterceptShieldAbility(ability)) return false;
    if (hasActRcGradeThreeSearch && !isExactActRcGradeThreeSearchAbility(ability) && !isExactAutoVanguardTopFiveSearchAbility(ability)) return false;
    if (hasHandRidePhaseSearch && !isExactHandRidePhaseSearchAbility(ability)) return false;
    if (hasSameNameDeckSearch && !isExactActSameNameSearchPowerAbility(ability) && !isExactAutoNamedVanguardSearchAbility(ability)) return false;
    if (hasCharging && !isExactChargeAbility(ability)) return false;
    if (hasGuardianTopFiveCall && !isExactGuardianTopFiveCallAbility(ability)) return false;
    if (hasAttackedSelfBattlePower && !isExactAttackedSelfBattlePowerAbility(ability)) return false;
    if (hasRidePhaseDiscardCall && !(isExactRidePhaseDiscardCallAbility(ability) || isExactDiscardGradeCallAbility(ability))) return false;
    if (hasUnlockTarget && !isExactVanguardUnlockAbility(ability)) return false;
    if (hasAttackedUnboostedProtect && !isExactAttackedUnboostedProtectAbility(ability)) return false;
    if (hasReorderDeckCard && !isExactOracleTopDeckOrderAbility(ability)) return false;
    if (hasModifyDriveTarget && !isExactGodHandDriveAbility(ability)) return false;
    if (hasCallCheckedCardLocked && !isExactDauntlessDriveAbility(ability)) return false;
    if (hasModifyDrive && !isExactDauntlessDriveAbility(ability)) return false;
    return effects.every(step => SERVER_EFFECT_OPS.has(step?.op) ||
      (hasConditionalCharge && step?.op === "conditional-counter-charge") ||
      (hasConditionalGuardianDiscard && step?.op === "discard-from-hand") ||
      (hasTokenCreation && step?.op === "create-token") ||
      (hasHarmonyAssociation && step?.op === "associate-harmony-units") ||
      (hasHollow && step?.op === "set-hollowed") ||
      (hasDrawThenDiscard && step?.op === "draw-then-discard" && (isExactVanguardPlacementDrawDiscardAbility(ability) || isExactBoostDrawDiscardAbility(ability))) ||
      (hasGGuardianGradeThreeChoice && step?.op === "g-guardian-grade-three-replacement-choice") ||
      (hasBlazing && step?.op === "set-blazing") ||
      (hasDeckToDamage && step?.op === "deck-to-damage") ||
      (hasPlacementTopFiveSearchDiscard && step?.op === "search-top-grade-three-to-hand-then-discard") ||
      (hasRcGradeThreeNameSearch && step?.op === "search-deck-named-grade-three-then-discard") ||
      (hasInterceptShield && step?.op === "modify-shield-source" && isAnyInterceptShieldAbility(ability)) ||
      (hasActRcGradeThreeSearch && step?.op === "search-top-up-to-one-filtered-to-hand" && (isExactActRcGradeThreeSearchAbility(ability) || isExactAutoVanguardTopFiveSearchAbility(ability))) ||
      (hasHandRidePhaseSearch && step?.op === "search-top-up-to-one-grade-to-hand") ||
      (hasSameNameDeckSearch && step?.op === "search-deck-same-name-to-hand" && (isExactActSameNameSearchPowerAbility(ability) || isExactAutoNamedVanguardSearchAbility(ability))) ||
      (hasCharging && step?.op === "set-charging") ||
      (hasGuardianTopFiveCall && step?.op === "call-top-to-guardian") ||
      (hasRidePhaseDiscardCall && step?.op === "call-source-from-drop-rested" && (isExactRidePhaseDiscardCallAbility(ability) || isExactDiscardGradeCallAbility(ability))) ||
      (hasUnlockTarget && step?.op === "unlock-target" && isExactVanguardUnlockAbility(ability)) ||
      (hasAttackedUnboostedProtect && step?.op === "protect-attacked-source" && isExactAttackedUnboostedProtectAbility(ability)) ||
      (hasReorderDeckCard && step?.op === "reorder-deck-card" && isExactOracleTopDeckOrderAbility(ability)) ||
      (hasModifyDriveTarget && step?.op === "modify-drive-target" && isExactGodHandDriveAbility(ability)) ||
      (hasCallCheckedCardLocked && step?.op === "call-checked-card-locked" && isExactDauntlessDriveAbility(ability)) ||
      (hasModifyDrive && step?.op === "modify-drive" && isExactDauntlessDriveAbility(ability)));
  }

  function serverCardDefinition(instance) {
    if (!instance) return null;
    return {
      id: String(instance.cardId || ""), name: instance.cardName || instance.name || "",
      type: instance.type || (instance.unitCard ? "Unit" : ""),
      grade: instance.grade, clan: instance.clan, clans: instance.clans,
      nation: instance.nation, nations: instance.nations, race: instance.race, races: instance.races, shield: instance.shield,
      trigger: instance.triggerType || instance.trigger || null
    };
  }

  function reviewedAbilityKeywords(instance, engine) {
    if (!instance?.cardId || !engine?.getReviewedAbilityDefinitionsForCard) return [];
    return [...new Set(engine.getReviewedAbilityDefinitionsForCard(String(instance.cardId))
      .flatMap(definition => definition.keywords || [])
      .map(keyword => typeof keyword === "string" ? keyword : keyword?.name)
      .filter(keyword => typeof keyword === "string" && keyword.trim())
      .map(keyword => keyword.trim().toLowerCase()))];
  }

  function authoritativeAttackRestrictions(state, locatedAttacker, engine) {
    const attacker = locatedAttacker?.instance, player = locatedAttacker && state.players?.[locatedAttacker.side];
    if (!attacker || !player || !engine?.getReviewedAbilityDefinitionsForCard || !engine?.evaluateContinuousRestrictions) {
      return { legal: false, restrictions: [{ type: "unknown", reason: "continuous-attack-rules-unavailable" }] };
    }
    const exactRestrictions = engine.getReviewedAbilityDefinitionsForCard(String(attacker.cardId)).filter(definition => {
      if (definition.kind !== "CONT" || definition.cardId !== String(attacker.cardId) || !Array.isArray(definition.continuousRestrictions)) return false;
      const pattern = definition.source?.patternId, text = String(definition.printedText || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
      if (pattern === "cont-lord-attack-restriction-v1") return /^CONT \[VC\/RC\]: Lord(?: \(If you have a unit without a same clan as this unit, this unit cannot attack\))?\.?$/i.test(text) &&
        definition.continuousRestrictions.length === 1 && definition.continuousRestrictions[0]?.type === "lord";
      if (pattern === "cont-vc-rc-restraint-cannot-attack-v1") return text === "CONT [VC/RC]: Restraint (This unit cannot attack.)" &&
        definition.continuousRestrictions.length === 1 && definition.continuousRestrictions[0]?.type === "restraint";
      return false;
    });
    const abilities = exactRestrictions.map(definition => ({
      id: definition.id, kind: definition.kind, definition,
      requiredLocation: ["cont-lord-attack-restriction-v1", "cont-vc-rc-restraint-cannot-attack-v1"].includes(definition.source?.patternId)
        ? ["vanguard", "rear-guard"] : []
    }));
    const ruleCard = instance => ({ ...serverCardDefinition(instance), abilityKeywords: reviewedAbilityKeywords(instance, engine) });
    const controlledUnits = [player.vanguard, ...(player.rear || [])].filter(Boolean)
      .map(instance => ({ uid: instance.uid, card: ruleCard(instance) }));
    return engine.evaluateContinuousRestrictions(abilities, {
      sourceInstanceId: attacker.uid, sourceCard: ruleCard(attacker),
      location: locatedAttacker.zone === "vanguard" ? "vanguard" : "rear-guard", controlledUnits
    });
  }

  function serverGuardianShieldValue(state, side, instance, engine) {
    const player = state?.players?.[side], attack = state?.pendingAttack, base = Number(serverCardDefinition(instance)?.shield);
    if (!player || !attack || !Number.isFinite(base)) return null;
    const opponent = state.players[attack.attackerSide];
    const continuous = engine.evaluateContinuousShieldEffects?.(serverReviewedAbilities(instance, engine), {
      location: "guardian", opponentVanguardGrade: Number(opponent?.vanguard?.grade ?? -1),
      controllerVanguardGrade: Number(player.vanguard?.grade ?? -1),
      controllerVanguardCardNames: engine.getCardNames?.({ id: String(player.vanguard?.cardId || ""), name: String(player.vanguard?.cardName || "") }) || [],
      controllerDamageCount: (player.damage || []).length,
      generationBreakCount: engine.countGenerationBreakUnits?.(player, card => card?.gDeckCard === true) || 0,
      opponentTriggerRevealedThisTurn: player.opponentTriggerRevealedThisTurn === true
    })?.shield || 0;
    const battle = instance?.battleShieldExpiryBattleId === attack.battleId ? Number(instance.battleShieldBoost || 0) : 0;
    return base + Number(continuous) + battle;
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
        if (step?.op === "stand-target" && step.allowAlreadyStanding !== true && candidate?.rested !== true) continue;
        const located = engine.locateCardInstance(state, candidate.uid);
        if (!located || located.ambiguous || !["vanguard", "rear-guard"].includes(located.zone)) continue;
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
      controllerFieldCards: [...(player.vanguard ? [player.vanguard] : []), ...(player.rear || [])].filter(Boolean).map(card => { const definition = serverCardDefinition(card); return { uid: card.uid, zone: card.uid === player.vanguard?.uid ? "vanguard" : "rear-guard", names: engine.getCardNames?.(definition) || [card.cardName].filter(Boolean), clans: [definition.clan, ...(definition.clans || [])].filter(Boolean) }; }),
      generationBreakCount: engine.countGenerationBreakUnits?.(player, card => card?.gDeckCard === true) || 0,
      attackingVanguard: attackContext?.attackTargetZone === "vanguard" || (attackContext?.attackerUid === instance.uid && attackContext?.attackerZone === "vanguard"), sourceWasBooster: attackContext?.boosterCardInstanceId === instance.uid && Boolean(attackContext?.boostedUnitInstanceId)
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

  function successPower(state, located, engine, baseValue = null) {
    const instance = located?.instance, side = located?.side;
    const attack = state?.pendingAttack;
    if (baseValue == null && attack?.attackerUid === instance?.uid && attack.attackerZone === "rear-guard" && Number.isFinite(Number(attack.power))) return Number(attack.power);
    const staticPower = baseValue != null && Number.isFinite(Number(baseValue)) ? Number(baseValue) :
      Number(instance?.power || 0) + Number(instance?.powerBoost || 0) + Number(instance?.turnPowerBoost || 0);
    return staticPower + serverContinuousPower(state, side, instance, "rear-guard", null, engine);
  }

  function successThresholdEventMatches(state, ability, source, located, event, engine) {
    if (!isExactSuccessAbility(ability) || event?.type !== "characteristic.changed" || event.reason !== "power-modified" ||
        !event.eventId || !event.cardInstanceId || event.subjectCardInstanceId !== event.cardInstanceId ||
        event.actingPlayerId !== located.controllerPlayerId || event.turnPlayerId !== located.controllerPlayerId ||
        event.subjectControllerPlayerId !== located.controllerPlayerId || state.players?.[state.side]?.playerId !== located.controllerPlayerId ||
        source?.successfulTurnKey === `${state.turn}:${state.side}`) return false;
    const target = engine.locateCardInstance(state, event.cardInstanceId);
    if (!target || target.ambiguous || target.zone !== "rear-guard" || target.controllerPlayerId !== located.controllerPlayerId) return false;
    const threshold = Number(ability.definition.successThreshold);
    const before = Number(event.before?.power), after = Number(event.after?.power);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
    const continuous = event.powerIncludesContinuous ? 0 : serverContinuousPower(state, target.side, target.instance, "rear-guard", null, engine);
    return before + continuous < threshold && after + continuous >= threshold && successPower(state, target, engine) >= threshold;
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
      (["retire-target", "rest-target", "stand-target", "unlock-target", "protect-target"].includes(effect?.op) && effect.target === "chosen") ||
      effect?.op === "g-guardian-grade-three-replacement-choice");
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
    let targetUid = step.target === "boosted-unit" ? event?.boostedCardInstanceId : selection?.targetUid;
    const selectedChoice = step.op === "g-guardian-grade-three-replacement-choice"
      ? step.choices?.find(choice => choice.id === selection?.effectChoice)
      : null;
    if (step.op === "g-guardian-grade-three-replacement-choice" && !selectedChoice) return { ok: false, reason: "invalid-ability-choice" };
    if (step.op === "protect-target") {
      const attack = state.pendingAttack;
      // Protection is a battle-duration effect. The existing effect handler
      // resolves it through this battle's exact attacked instance, so never
      // accept a different target (or a target from a stale/other battle).
      const actorSide = Object.keys(state.players || {}).find(key => state.players[key]?.playerId === actorPlayerId);
      if (!attack?.battleId || !actorSide || attack.defenderSide !== actorSide) {
        return { ok: false, reason: "protection-battle-not-defending-controller" };
      }
      if (step.requiresAttackedTarget === true || step.targetFilter?.mustBeAttacked === true) {
        if (typeof attack.targetUid !== "string" || (selection?.targetUid != null && selection.targetUid !== attack.targetUid)) {
          return { ok: false, reason: "stale-or-invalid-protection-target" };
        }
        targetUid = attack.targetUid;
      } else if (typeof targetUid !== "string") {
        return { ok: false, reason: "missing-ability-target" };
      }
      if (targetUid !== attack.targetUid) return { ok: false, reason: "protection-target-is-not-being-attacked" };
    }
    if (step.target === "chosen" && typeof targetUid !== "string") return { ok: false, reason: "missing-ability-target" };
    if (step.target === "boosted-unit" && (!targetUid || event?.boosterCardInstanceId !== source.uid || event?.sourceCardInstanceId !== source.uid)) return { ok: false, reason: "boost-event-source-mismatch" };
    if (step.target === "boosted-unit" && selection?.targetUid != null && selection.targetUid !== targetUid) return { ok: false, reason: "boosted-target-is-event-bound" };
    const located = targetUid ? engine.locateCardInstance(state, targetUid) : null;
    if (!located || located.ambiguous || !["vanguard", "rear-guard"].includes(located.zone)) return { ok: false, reason: "invalid-ability-target" };
    const opponentPlayerId = Object.values(state.players || {}).find(player => player && player.playerId !== actorPlayerId)?.playerId || null;
    const targetZone = located.circle || located.zone;
    const targetCard = serverCardDefinition(located.instance);
    const matches = engine.matchesTargetFilter(selectedChoice?.targetFilter || step.targetFilter || {}, {
      source, target: located.instance, targetCard, targetZone,
      sourceControllerPlayerId: actorPlayerId, targetControllerPlayerId: located.controllerPlayerId,
      opponentPlayerId, isBeingAttacked: state.pendingAttack?.targetUid === targetUid
    });
    if (!matches) return { ok: false, reason: "ability-target-filter-not-met" };
    return {
      ok: true,
      context: {
        target: located.instance, targetInPlay: true, targetSide: located.side,
        targetPlayer: state.players[located.side], targetCard, targetZone,
        sourceControllerPlayerId: actorPlayerId, targetControllerPlayerId: located.controllerPlayerId, opponentPlayerId,
        isBeingAttacked: state.pendingAttack?.targetUid === targetUid
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
    "unit.became_engorged": "engorge", "unit.became_successful": "success", "unit.legioned": "legion", "phase.changed": "phase", "turn.started": "start", "turn.ended": "end"
  });
  const SUPPORTED_CONDITION_TYPES = new Set([
    "damage-at-least", "limit-break-active", "damage-zone-empty", "opponent-attacking-unit-attacked-at-least",
    "source-placed-from-hand", "generation-break", "controller-went-second", "controller-turn", "source-face-up",
    "opponent-turn", "opponent-vanguard-grade-at-least", "controller-vanguard-grade-lower-than-opponent",
    "controller-vanguard-grade-at-most", "controller-vanguard-grade-at-least", "controller-has-no-rear-guards", "source-is-hollowed", "source-is-in-harmony",
    "controller-vanguard-is-blazing", "controller-vanguard-is-legion", "controller-has-empty-soul", "opponent-has-no-rear-guards",
    "controller-has-center-column-rear-guard", "controller-has-not-ridden-grade-three-plus-this-fight",
    "controller-back-row-rear-guards-at-most", "controller-back-row-grade-rear-guards-at-least", "source-never-legioned", "controller-drop-count-at-least",
    "controller-vanguard-is-attacked-unit", "controller-soul-count-at-least", "controller-damage-count-at-least",
    "controller-damage-count-more-than-opponent", "all-order-zones-count-at-least", "any-field-card-is-locked",
    "controller-other-rear-guards-of-clan-at-least", "controller-field-has-clan-limit-break", "controller-has-more-rear-guards-than-opponent", "controller-has-more-cards-in-hand-than-opponent",
    "controller-has-fewer-cards-in-hand-than-opponent", "controller-hand-size-at-least", "controller-hand-size-at-most",
    "opponent-rear-guards-at-most", "attack-target-grade-at-least", "controller-vanguard-name-contains",
    "controller-soul-has-card-name", "controller-vanguard-has-clan", "source-was-boosted", "source-is-legion", "attack-target-location",
    "event-subject-grade-equals", "event-subject-has-clan"
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
    const eventSubjectLocation = event.subjectCardInstanceId ? engine.locateCardInstance(state, event.subjectCardInstanceId) : null;
    const eventSubject = eventSubjectLocation && !eventSubjectLocation.ambiguous ? eventSubjectLocation.instance : null;
    const faceUpGUnits = (controller.gZone || []).filter(card => card?.faceUp === true).length + (vanguard?.isGUnit === true ? 1 : 0);
    const center = controller.rear?.[3];
    const backRow = controller.rear?.slice(2) || [];
    const backRowGradeRearGuards = {};
    for (const card of backRow.filter(Boolean)) {
      const grade = Number(card.grade);
      if (Number.isInteger(grade)) backRowGradeRearGuards[grade] = Number(backRowGradeRearGuards[grade] || 0) + 1;
    }
    const thisTurnKey = `${state.turn}:${state.side}`;
    const sourceInHarmony = engine.isCardInHarmony?.(state, located.instance.uid, thisTurnKey) === true;
    const activeAttack = state.pendingAttack;
    const activeAttackerPlayerId = state.players?.[activeAttack?.attackerSide]?.playerId;
    const activeBattleAttackCount = activeAttack?.battleId && activeAttack.battleId === event?.battleId && activeAttack.defenderSide === controllerSide &&
      activeAttack.attackerSide !== controllerSide && activeAttackerPlayerId
      ? engine.getAttackCount(state, activeAttackerPlayerId, activeAttack.attackerUid) : 0;
    return {
      generationBreakCount: faceUpGUnits,
      damageCount: (controller.damage || []).length,
      controllerDamageCount: (controller.damage || []).length,
      opponentDamageCount: (opponent.damage || []).length,
      controllerRearGuards: rearGuards.length,
      controllerRearGuardClans: rearGuards.map(card => ({ uid: card.uid, clan: card.clan, clans: Array.isArray(card.clans) && card.clans.length ? card.clans : card.clan ? [card.clan] : [] })),
      controllerFieldCards: [...(vanguard ? [vanguard] : []), ...rearGuards].map(card => ({ uid: card.uid, clan: card.clan, clans: Array.isArray(card.clans) && card.clans.length ? [...card.clans] : card.clan ? [card.clan] : [], hasLimitBreak4: card.hasLimitBreak4 === true })),
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
      sourceEverLegioned: located.instance.everLegioned === true,
      sourceInLegion: located.zone === "vanguard" && Boolean(located.instance.legionMate || located.instance.legionMateInstanceId),
      controllerDropCount: (controller.drop || []).length,
      sourceHollowed: located.instance.hollowed === true,
      sourceInHarmony,
      controllerVanguardIsBlazing: vanguard?.blazing === true,
      controllerVanguardIsLegion: typeof vanguard?.legionMateInstanceId === "string" && vanguard.legionMateInstanceId.length > 0,
      rodeGradeThreePlusThisFight: controller.rodeGradeThreePlusThisFight,
      controllerVanguardGrade: Number.isInteger(Number(vanguard?.grade)) ? Number(vanguard.grade) : undefined,
      opponentVanguardGrade: Number.isInteger(Number(opposingVanguard?.grade)) ? Number(opposingVanguard.grade) : undefined,
      vanguardName: engine.getCardNames?.(vanguard,{location:"vanguard"})?.[0] || vanguard?.cardName || vanguard?.name,
      vanguardNames: engine.getCardNames?.(vanguard,{location:"vanguard"}) || [vanguard?.cardName, vanguard?.name].filter(Boolean),
      vanguardClan: vanguard?.clan,
      vanguardClans: vanguard?.clans || [],
      vanguardText: vanguard?.text,
      controllerSoulCardNames: (controller.soul || []).map(card => card?.cardName || card?.name).filter(Boolean),
      attackTargetGrade: Number.isInteger(Number(event.targetGrade ?? targetDefinition?.grade)) ? Number(event.targetGrade ?? targetDefinition.grade) : undefined,
      eventSubjectGrade: Number.isInteger(Number(event.subjectCardGrade ?? eventSubject?.grade)) ? Number(event.subjectCardGrade ?? eventSubject.grade) : undefined,
      eventSubjectClans: [...new Set([...(Array.isArray(event.subjectCardClans) && event.subjectCardClans.length ? event.subjectCardClans : Array.isArray(eventSubject?.clans) ? eventSubject.clans : []), ...(event.subjectCardClan || eventSubject?.clan ? [event.subjectCardClan || eventSubject.clan] : [])])],
      eventTargetLocation: event.targetLocation || null,
      eventPreviousLocation: event.previousLocation || null,
      sourceInstanceId: located.instance.uid,
      boosterInstanceId: event.boosterCardInstanceId || null,
      boostedInstanceId: event.boostedCardInstanceId || null,
      eventSubjectInstanceId: event.subjectCardInstanceId || null,
      controllerVanguardIsAttackedUnit: Boolean(vanguard?.uid && (event.targetCardInstanceIds || []).includes(vanguard.uid)),
      opponentAttackingUnitAttackCount: activeBattleAttackCount || (event.sourceControllerPlayerId === opponent.playerId
        ? engine.getAttackCount(state, opponent.playerId, event.sourceCardInstanceId) : 0)
    };
  }

  function discoverAutoTriggers(state, events, engine) {
    if (!state || !Array.isArray(events) || !engine?.getReviewedAbilityDefinitionsForCard) return { queued: [], skipped: [] };
    const queued = [], skipped = [], queue = state.pendingAbilities ||= [];
    const pendingKeys = new Set([state.pendingAbility, ...queue].filter(Boolean).map(item => `${item.side}:${item.instance?.uid}:${item.ability?.id}:${item.eventContext?.eventId}`));
    for (const event of events) {
      const eventName = EVENT_NAME_BY_TYPE[event?.type];
      if (!eventName || !event?.eventId) continue;
      removeHarmonyAssociationsForEvent(state, event, engine);
      for (const [side, player] of Object.entries(state.players || {})) {
        const instances = [player?.vanguard, player?.vanguard?.legionMate, ...(player?.rear || []), ...(player?.guardCircle || []), ...(player?.triggerZone || []), ...(player?.orders || []), ...(player?.drop || []), ...(player?.hand || []), ...(player?.soul || []), ...(player?.bind || [])].filter(card => card?.uid && card?.cardId != null);
        for (const instance of instances) {
          const located = engine.locateCardInstance(state, instance.uid);
          if (!located || located.ambiguous) continue;
          const definitions = engine.getReviewedAbilityDefinitionsForCard(instance.cardId);
          for (const definition of definitions) {
            if (definition.kind !== "AUTO") continue;
            const parsed = engine.parseCardAbilities({ id: String(instance.cardId), text: definition.printedText }).find(item => item.kind === "AUTO");
            if (!parsed) continue;
            const ability = { ...parsed, ...(isExactHollowPlacementAbility({ ...parsed, definition, cardId: String(definition.cardId) }) ? { canDecline: true } : {}), ...(isExactAttackedUnboostedProtectAbility({ ...parsed, definition, cardId: String(definition.cardId) }) ? { canDecline: false } : {}), id: definition.id, cardId: String(definition.cardId), definition, requiredLocation: definition.requiredLocation || parsed.requiredLocation, requiredCircle: definition.requiredCircle || parsed.requiredCircle || [], trigger: definition.trigger ? { ...parsed.trigger, ...definition.trigger, circles: definition.trigger.circles || parsed.trigger?.circles || [] } : parsed.trigger, conditions: definition.conditions || parsed.conditions, conditionStatus: definition.conditions?.length ? "modeled" : definition.conditionsReviewed === true ? "no-explicit-condition-detected" : parsed.conditionStatus, costs: definition.costs || parsed.costs, costStatus: definition.costs?.length ? "supported-cost" : definition.costsReviewed === true ? "no-cost" : definition.costs ? "supported-cost" : parsed.costStatus, choiceStatus: definition.choicesReviewed === true ? "modeled" : parsed.choiceStatus, effects: definition.effects, once: definition.once === true || parsed.once, usageRestriction: resolveUsageRestriction(definition, parsed) };
            const readiness = engine.autoAbilityReadiness(ability);
            if (!readiness.ok || ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review" || ability.conditions?.some(condition => !SUPPORTED_CONDITION_TYPES.has(condition?.type)) || !supportsServerAbilityEffects(ability)) continue;
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
            const exactHandRideSearch = isExactHandRidePhaseSearchAbility(ability);
            if (exactHandRideSearch) {
              const controllerId = located.controllerPlayerId;
              const phaseStartEvent = event.type === "phase.changed" && event.phase === "ride" && event.timingWindow === "phase-start" &&
                event.after?.phase === "ride" && event.turnPlayerId === controllerId && event.actingPlayerId === controllerId &&
                state.players?.[state.side]?.playerId === controllerId && state.players?.[side]?.playerId === controllerId;
              if (!phaseStartEvent) continue;
              if (located.zone !== "hand" || !player.hand?.some(card => card?.uid === instance.uid) ||
                  instance.controllerPlayerId !== controllerId) {
                if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) {
                  skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "source-not-in-hand" });
                }
                continue;
              }
            }
            const harmonyTrigger = isExactHarmonyAssociationAbility(ability)
              ? harmonyAssociationAtTrigger(state, event, located.instance, side, engine)
              : null;
            if (isExactHarmonyAssociationAbility(ability) && !harmonyTrigger) continue;
            if (isExactForerunnerAbility(ability) && !forerunnerRideMatches(state, ability, located.instance, located, event, engine)) continue;
            if (isExactRidePhaseDiscardCallAbility(ability) && !ridePhaseDiscardEventMatches(ability, located.instance, located, event)) continue;
            if (isExactDiscardGradeCallAbility(ability) && !discardGradeCallEventMatches(ability, located.instance, located, event, located.controllerPlayerId, state)) continue;
            if (isExactBoostDrawDiscardAbility(ability) && !boostDrawDiscardEventMatches(state, ability, located.instance, located, event, engine)) continue;
            if (isExactAttackedUnboostedProtectAbility(ability) && !attackedUnboostedProtectEventMatches(state, ability, located.instance, located, event)) continue;
            if (isExactSecondPlayerRideDrawAbility(ability) && !secondPlayerRideDrawTriggerMatches(state, ability, located.instance, located, event, located.controllerPlayerId, engine)) continue;
            if ((isExactGodHandDriveAbility(ability) || isExactDauntlessDriveAbility(ability)) &&
                !exactNormalDriveCheckContext(state, ability, located.instance, located, event, located.controllerPlayerId)) continue;
            if (isExactTriggerUnitDrivePowerAbility(ability) && !exactTriggerUnitDriveCheckContext(state, ability, located.instance, located, event, located.controllerPlayerId)) continue;
            if (isExactRcPlacementSoulChargeOneAbility(ability) && !exactRcPlacementSoulChargeEventMatches(ability, located.instance, located, event, located.controllerPlayerId, state)) continue;
            if (isExactVanguardOrRearGuardOptionalSoulChargeAbility(ability) && !exactVanguardOrRearGuardOptionalSoulChargeEventMatches(ability, located.instance, located, event, located.controllerPlayerId, state)) continue;
            if (isExactRcReturnToHandCostDrawAbility(ability) && !exactRcReturnToHandCostDrawEventMatches(ability, located.instance, located, event, located.controllerPlayerId, state)) continue;
            if (isExactDiscardSelfOptionalSoulAbility(ability) && !exactDiscardSelfOptionalSoulEventMatches(ability, located.instance, located, event, located.controllerPlayerId, state)) continue;
            if (isExactVanguardAttackSoulChargePowerAbility(ability) && !exactVanguardAttackSoulChargePowerEventMatches(state, ability, located.instance, located, event, located.controllerPlayerId)) continue;
            if (isAnyInterceptShieldAbility(ability) &&
                !interceptShieldTriggerMatches(state, ability, instance, located, event, located.controllerPlayerId)) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "intercept-battle-context-mismatch" });
              continue;
            }
            if (isExactGuardianTopFiveCallAbility(ability) &&
                !guardianTopFiveCallTriggerMatches(state, ability, located.instance, located, event, located.controllerPlayerId)) continue;
            if (isExactAutoVanguardTopFiveSearchAbility(ability) && event.type === "card.placed") {
              const claimedLocation = String(event.currentLocation || event.circle || "");
              const sourceAtClaimedLocation = claimedLocation === "vanguard"
                ? located.zone === "vanguard"
                : claimedLocation === "rear-guard"
                  ? located.zone === "rear-guard"
                  : claimedLocation === String(located.circle || "");
              if (!sourceAtClaimedLocation) continue;
            }
            const eventMatch = engine.eventMatchesAbilityTrigger(ability, eventName, event, instance.uid, triggerSourceZone, subjectZone, located.controllerPlayerId);
            if (!eventMatch) continue;
            if (isExactVanguardHitClanStandAbility(ability) &&
                !vanguardHitClanStandEventMatches(state, ability, located.instance, located, event, located.controllerPlayerId, engine)) continue;
            if (isExactSuccessAbility(ability) && !successThresholdEventMatches(state, ability, instance, located, event, engine)) continue;
            const conditionContext = buildConditionContext(state, event, located, engine);
            if (!conditionContext || !engine.evaluateAbilityConditions(ability, conditionContext)) {
              if ((exactHandRideSearch || isExactClanInterceptShieldAbility(ability) || isExactStructuredInterceptShieldAbility(ability) || isExactSecondAttackInterceptShieldAbility(ability) || isExactLowerVanguardGradeGuardianShieldAbility(ability) || isExactSecondPlayerRideDrawAbility(ability)) && engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) {
                skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "condition-not-met" });
              }
              continue;
            }
            const noTargetSteps = definition.effects.filter(step => step?.target === "chosen" && step.noOpIfNoLegalTargets === true && step.op === "stand-target");
            if (!isExactVanguardHitClanStandAbility(ability) && noTargetSteps.length === definition.effects.length && noTargetSteps.length > 0 && noTargetSteps.every(step => !hasLegalReviewedTarget(state, located.instance, located.controllerPlayerId, step, engine))) {
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
            if (isExactVanguardHitClanStandAbility(ability) &&
                !engine.canPayAbilityCosts(ability, { faceUpDamage: (controller.damage || []).filter(card => !card.faceDown).length })) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "unpayable-cost" });
              continue;
            }
            if (isExactClanCounterBlastAttackPowerAbility(ability) &&
                !engine.canPayAbilityCosts(ability, {
                  faceUpDamage: (controller.damage || []).filter(card => !card.faceDown).length,
                  faceUpDamageCards: (controller.damage || []).filter(card => !card.faceDown),
                  cardDefinitionForInstance: serverCardDefinition
                })) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "unpayable-cost" });
              continue;
            }
            if (isExactClanSoulBlastAttackPowerAbility(ability) &&
                !engine.canPayAbilityCosts(ability, { soulCount: (controller.soul || []).length })) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "unpayable-cost" });
              continue;
            }
            if (isExactDiscardGradeCallAbility(ability) && !engine.canPayAbilityCosts(ability, { soulCount: (controller.soul || []).length })) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "unpayable-cost" });
              continue;
            }
            if ((isExactGodHandDriveAbility(ability) || isExactDauntlessDriveAbility(ability)) &&
                !engine.canPayAbilityCosts(ability, {
                  faceUpDamage: (controller.damage || []).filter(card => !card.faceDown).length,
                  sourceCanRetire: located.zone === "rear-guard"
                })) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "unpayable-cost" });
              continue;
            }
            if ((isExactRidePhaseDiscardCallAbility(ability) || isExactDiscardGradeCallAbility(ability)) && !ridePhaseDiscardHasLegalCircle(controller)) {
              if (engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "no-legal-call-circle" });
              continue;
            }
            if (isExactRcGradeThreeNameSearchAbility(ability) &&
                !engine.canPayAbilityCosts(ability, {
                  revealableGradeThreeHand: (controller.hand || []).filter(card => Number(serverCardDefinition(card)?.grade) === 3).length
                })) {
              const unavailableKey = `${side}:${instance.uid}:${ability.id}:${event.eventId}`;
              if (!pendingKeys.has(unavailableKey) && engine.claimAbilityTrigger(state, event.eventId, instance.uid, ability.id)) {
                pendingKeys.add(unavailableKey);
                skipped.push({ eventId: event.eventId, cardInstanceId: instance.uid, abilityId: ability.id, reason: "unpayable-cost" });
              }
              continue;
            }
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
                simultaneousWindowId: event.eventId,
                ...(harmonyTrigger ? { eventSubjectUid: harmonyTrigger.subjectUid, harmonySameColumnAtTrigger: true, harmonyTurnKey: harmonyTrigger.turnKey } : {})
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
        type: "card.moved", actingPlayerId: actorPlayerId,
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
    const zones = [{ zone: "vanguard", instance: nextPlayer.vanguard }, ...(nextPlayer.vanguard?.legionMate ? [{ zone: "vanguard", instance: nextPlayer.vanguard.legionMate }] : []), ...(nextPlayer.rear || []).map((instance, index) => ({ zone: index, instance }))];
    const stood = [];
    for (const { zone, instance } of zones) {
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
              attackingUnitInstanceId: attack.attackerUid,
              boosterCardInstanceId: attack.boostUid,
              boosterCardName: attack.boosterCardName,
              boosterCardClan: attack.boosterCardClan,
              boosterCardClans: attack.boosterCardClans,
              boosterCardRace: attack.boosterCardRace,
              boosterCardRaces: attack.boosterCardRaces,
              boosterPower: attack.boostPower,
              boostedCardInstanceId: attack.boostUid ? attack.attackerUid : null,
              boostedCardName: attack.boostedCardName,
              boostedCardClan: attack.boostedCardClan,
              boostedCardClans: attack.boostedCardClans,
              boostedCardLimitBreaks: attack.boostedCardLimitBreaks,
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
          checkedCardInstanceId: checked.uid, checkedCardTriggerType: kind, revealedTrigger: kind || null,
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
              attackingUnitInstanceId: attack.attackerUid,
              boosterCardInstanceId: attack.boostUid,
              boosterCardName: attack.boosterCardName,
              boosterCardClan: attack.boosterCardClan,
              boosterCardClans: attack.boosterCardClans,
              boostedCardInstanceId: attack.boostUid ? attack.attackerUid : null,
              boostedCardName: attack.boostedCardName,
              boostedCardClan: attack.boostedCardClan,
              boostedCardClans: attack.boostedCardClans,
              boostedCardLimitBreaks: attack.boostedCardLimitBreaks,
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
      if (attacker.unitCard !== true || attacker.rested || attacker.locked || attacker.cannotAttackTurnKey === `${state.turn}:${side}`) return reject("attacker-cannot-attack");
      const attackRestrictions = authoritativeAttackRestrictions(state, attackerLocation, engine);
      if (!attackRestrictions.legal) return reject(attackRestrictions.restrictions[0]?.reason || "continuous-attack-restriction");
      const isFrontRow = attackerLocation.zone === "vanguard" || attackerLocation.circle === "rear-left" || attackerLocation.circle === "rear-right" || String(attackerLocation.circle || "").startsWith("accel-");
      if (!isFrontRow && attacker.canAttackBackRow !== true) return reject("back-row-attacker-not-permitted");
      if (!Number.isFinite(attacker.power) || !Number.isFinite(target.power)) return reject("combat-power-metadata-missing");
      if (!Number.isInteger(Number(attacker.critical)) || Number(attacker.critical) < 1) return reject("attacker-critical-metadata-invalid");
      const defenderSide = targetLocation.side, defender = state.players[defenderSide];
      if (!defender || defender.playerId !== targetLocation.controllerPlayerId) return reject("invalid-defender-seat");
      let booster = null, boosterCircle = null, boostEvent = null, boostPowerEvent = null;
      const boosterUid = command.payload?.boosterCardInstanceId;
      if (boosterUid != null) {
        const boosterLocation = typeof boosterUid === "string" ? engine.locateCardInstance(state, boosterUid) : null;
        if (!boosterLocation || boosterLocation.ambiguous || boosterLocation.controllerPlayerId !== actorPlayerId || boosterLocation.zone !== "rear-guard" || boosterLocation.instance.rested || boosterLocation.instance.locked || boosterLocation.instance.boostAbility !== true) return reject("invalid-booster");
        const expectedBoosterIndex = attackerLocation.zone === "vanguard" ? 3 : attackerLocation.circle === "rear-left" ? 2 : attackerLocation.circle === "rear-right" ? 4 : -1;
        if (expectedBoosterIndex < 0 || boosterLocation.side !== side || boosterLocation.index !== expectedBoosterIndex || !Number.isFinite(boosterLocation.instance.power)) return reject("booster-not-behind-attacker");
        const boostRestriction = engine.evaluateContinuousRestrictions?.(serverReviewedAbilities(attacker, engine), {
          sourceInstanceId: attacker.uid, sourceCard: serverCardDefinition(attacker),
          location: attackerLocation.zone === "vanguard" ? "vanguard" : "rear-guard", action: "boost"
        });
        if (!boostRestriction?.legal) return reject(boostRestriction?.restrictions?.[0]?.reason || "attacker-cannot-be-boosted");
        booster = boosterLocation.instance; boosterCircle = boosterLocation.circle;
      }
      const battleId = `${state.matchId || "match"}:${command.actionId}`;
      const attackerZone = attackerLocation.circle || attackerLocation.zone;
      const targetZone = targetLocation.circle || targetLocation.zone;
      const powerOf = (instance, instanceSide, location) => Number(instance.power) + Number(instance.powerBoost || 0) + Number(instance.turnPowerBoost || 0) + serverContinuousPower(state, instanceSide, instance, location === "vanguard" ? "vanguard" : "rear-guard", { attackTargetZone: targetZone, attackerUid: attacker.uid, attackerZone, boosterCardInstanceId: instance.uid === booster?.uid ? booster.uid : null, boostedUnitInstanceId: instance.uid === booster?.uid ? attacker.uid : null }, engine);
      const legionMate = attackerLocation.zone === "vanguard" && attacker.legionMate?.uid && attacker.legionMateInstanceId === attacker.legionMate.uid && attacker.legionMate.legionLeaderInstanceId === attacker.uid ? attacker.legionMate : null;
      const attackerPlayerCount = engine.recordAttackCount(state, actorPlayerId, attacker.uid);
      attacker.rested = true;
      if (legionMate) { legionMate.rested = true; legionMate.position = "rest"; }
      let boostPower = 0;
      if (booster) {
        booster.rested = true; boostPower = powerOf(booster, side, boosterCircle);
        if (attackerLocation.zone === "rear-guard") {
          const beforePower = powerOf(attacker, side, attackerZone);
          boostPowerEvent = engine.createGameEvent(state, {
            type: "characteristic.changed", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
            sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId,
            sourceControllerPlayerId: attacker.controllerPlayerId, cardInstanceId: attacker.uid,
            subjectCardInstanceId: attacker.uid, subjectOwnerPlayerId: attacker.ownerPlayerId,
            subjectControllerPlayerId: attacker.controllerPlayerId, targetLocation: attackerZone,
            reason: "power-modified", phase: "battle", timingWindow: "boost-step", battleId,
            before: { power: beforePower }, after: { power: beforePower + boostPower }, powerIncludesContinuous: true
          });
        }
        boostEvent = engine.createGameEvent(state, {
          type: "unit.boosted", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
          sourceCardInstanceId: booster.uid, sourceOwnerPlayerId: booster.ownerPlayerId,
          sourceControllerPlayerId: booster.controllerPlayerId,
          cardInstanceId: booster.uid, subjectCardInstanceId: booster.uid,
          subjectOwnerPlayerId: booster.ownerPlayerId, subjectControllerPlayerId: booster.controllerPlayerId,
          boosterCardInstanceId: booster.uid, boostedCardInstanceId: attacker.uid,
          boosterCardName: booster.cardName || null, boostedCardName: attacker.cardName || null,
          boosterCardClan: booster.clan || null, boosterCardClans: Array.isArray(booster.clans) ? booster.clans : [],
          boosterCardRace: booster.race || null, boosterCardRaces: Array.isArray(booster.races) ? booster.races : [],
          boosterPower: boostPower,
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
      const attackingCardInstanceIds = [attacker.uid, ...(legionMate ? [legionMate.uid] : [])];
      state.pendingAttack = {
        battleId, attackerUid: attacker.uid, attackerSide: side, attackerZone, attackerPlayerId: actorPlayerId, attackingCardInstanceIds,
        defenderSide, targetUid: target.uid, targetZone, targetRearIndex: targetLocation.zone === "rear-guard" ? targetLocation.index : null,
        power: powerOf(attacker, side, attackerZone) + (legionMate ? powerOf(legionMate, side, attackerZone) : 0) + boostPower, targetPower: powerOf(target, defenderSide, targetZone), critical: Number(attacker.critical) + Number(attacker.turnCriticalBoost||0) + serverContinuousCritical(state, side, attacker, attackerLocation.zone === "vanguard" ? "vanguard" : "rear-guard", engine), abilityCriticalBoost:Number(attacker.turnCriticalAbilityBoost||0) + serverContinuousCritical(state, side, attacker, attackerLocation.zone === "vanguard" ? "vanguard" : "rear-guard", engine),
        boostUid: booster?.uid || null,
        boosterCardName: booster?.cardName || null, boosterCardClan: booster?.clan || null, boosterCardClans: Array.isArray(booster?.clans) ? [...booster.clans] : [],
        boosterCardRace: booster?.race || null, boosterCardRaces: Array.isArray(booster?.races) ? [...booster.races] : [],
        boostedCardName: attacker.cardName || null, boostedCardClan: attacker.clan || null, boostedCardClans: Array.isArray(attacker.clans) ? [...attacker.clans] : [],
        boostedCardLimitBreaks: attacker.hasLimitBreak4 === true ? [4] : [],
        boostPower, guardCards: [], defenderDone: false, perfectGuard: false,
        driveChecksRemaining: 0, driveChecksPerformed: 0, maxDriveChecks: isVanguardAttack ? 10 : 0,
        driveCountPrompt: false, driveCountChosen: !isVanguardAttack, awaitingDrive: false
      };
      events.push(engine.createGameEvent(state, {
        type: "attack.step-started", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId,
        sourceControllerPlayerId: attacker.controllerPlayerId,
        cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid,
        attackingCardInstanceIds,
        subjectOwnerPlayerId: attacker.ownerPlayerId, subjectControllerPlayerId: attacker.controllerPlayerId,
        previousLocation: attackerZone, currentLocation: attackerZone,
        phase: "battle", timingWindow: "attack-step-start", battleId,
        playerAttackCount: attackerPlayerCount, before: { rested: false }, after: { rested: true }
      }));
      if (boostEvent) events.push(boostEvent);
      if (boostPowerEvent) events.push(boostPowerEvent);
      events.push(engine.createGameEvent(state, {
        type: "unit.attacked", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: attacker.uid, sourceOwnerPlayerId: attacker.ownerPlayerId,
        sourceControllerPlayerId: attacker.controllerPlayerId,
        cardInstanceId: attacker.uid, subjectCardInstanceId: attacker.uid,
        attackingCardInstanceIds,
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
        attackingCardInstanceIds,
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
      if (typeof engine.canRideCard === "function" && !engine.canRideCard({ id: String(rider.cardId), name: rider.cardName || rider.name || "" }, { vanguardCard: serverCardDefinition(previousVanguard) })) return reject("ride-restriction");
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
      events.push(engine.createGameEvent(state, {
        type: "card.placed", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: rider.uid, sourceCardName: rider.cardName || rider.name || null,
        sourceOwnerPlayerId: rider.ownerPlayerId, sourceControllerPlayerId: rider.controllerPlayerId,
        sourceCardClan: rider.clan || null, sourceCardClans: rider.clans || [],
        cardInstanceId: rider.uid, subjectCardInstanceId: rider.uid,
        subjectOwnerPlayerId: rider.ownerPlayerId, subjectControllerPlayerId: rider.controllerPlayerId,
        previousLocation: "hand", currentLocation: "vanguard", circle: "vanguard",
        phase: "ride", timingWindow: "normal-ride"
      }));
    } else if (action === "stride") {
      if (Number(state.phase) !== 3) return reject("wrong-timing-window");
      if (state.stridePerformed === true) return reject("stride-already-performed");
      if (!Array.isArray(player.gDeck) || !Array.isArray(player.gZone) || !Array.isArray(player.hand) || !Array.isArray(player.drop) || !player.vanguard) return reject("invalid-stride-zones");
      const opposing = Object.values(state.players || {}).find(candidate => candidate && candidate !== player);
      const ownGrade = Number(player.vanguard.grade), opposingGrade = Number(opposing?.vanguard?.grade);
      const turnStartGrade = Number(state.turnStartGrades?.[side]);
      if (!((ownGrade >= 3 && opposingGrade >= 3) || turnStartGrade >= 3)) return reject("stride-grade-requirement-not-met");
      const strideUid = command.payload?.strideCardInstanceId, submittedCosts = command.payload?.costCardInstanceIds;
      if (typeof strideUid !== "string" || !Array.isArray(submittedCosts) || submittedCosts.some(uid => typeof uid !== "string") || new Set(submittedCosts).size !== submittedCosts.length) return reject("invalid-stride-payment");
      const deckStrideIndex = player.gDeck.findIndex(card => card?.uid === strideUid);
      const zoneStrideIndex = player.gZone.findIndex(card => card?.uid === strideUid);
      if ((deckStrideIndex >= 0) === (zoneStrideIndex >= 0)) return reject(deckStrideIndex < 0 ? "stride-card-not-in-g-deck" : "ambiguous-stride-card");
      const fromGZone = zoneStrideIndex >= 0;
      const strideCard = fromGZone ? player.gZone[zoneStrideIndex] : player.gDeck[deckStrideIndex];
      if (strideCard.gGuardian === true || strideCard.ownerPlayerId !== actorPlayerId || strideCard.controllerPlayerId !== actorPlayerId) return reject("card-cannot-stride");
      const grantsFreeStride = fromGZone && strideCard.faceUp === true && serverReviewedAbilities(strideCard, engine).some(ability => ability.kind === "CONT" && ability.definition?.source?.patternId === "cont-gzone-unflip-free-stride-v1" && ability.requiredLocation?.includes("g-zone"));
      if (fromGZone && !grantsFreeStride) return reject("face-up-g-zone-card-cannot-stride");
      if (!fromGZone && (strideCard.faceUp !== false || strideCard.gDeckCard !== true)) return reject("card-cannot-stride");
      if (grantsFreeStride && submittedCosts.length !== 0) return reject("free-stride-does-not-accept-cost");
      const selectedCosts = submittedCosts.map(uid => player.hand.find(card => card?.uid === uid));
      if (selectedCosts.some(card => !card || card.ownerPlayerId !== actorPlayerId || card.controllerPlayerId !== actorPlayerId)) return reject("stride-cost-card-not-in-own-hand");
      let costLegal;
      if (grantsFreeStride) {
        costLegal = true;
      } else if (strideCard.ultimateStride === true) {
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
          phase: "stride", timingWindow: "stride-cost", discardReason: "stride-cost"
        }));
      }
      if (fromGZone) player.gZone.splice(zoneStrideIndex, 1);
      else player.gDeck.splice(deckStrideIndex, 1);
      const stridden = { ...strideCard, faceUp: true, rested: Boolean(previousVanguard.rested), circle: "vanguard", strideHeart: heart, strideHearts: hearts };
      player.vanguard = stridden;
      state.stridePerformed = true;
      events.push(engine.createGameEvent(state, {
        type: "card.placed", actingPlayerId: actorPlayerId, turnPlayerId: actorPlayerId,
        sourceCardInstanceId: stridden.uid, sourceOwnerPlayerId: stridden.ownerPlayerId,
        sourceControllerPlayerId: stridden.controllerPlayerId, cardInstanceId: stridden.uid,
        subjectCardInstanceId: stridden.uid, subjectOwnerPlayerId: stridden.ownerPlayerId,
        subjectControllerPlayerId: stridden.controllerPlayerId, previousLocation: fromGZone ? "g-zone" : "g-deck",
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
    const ability = { ...parsedAbility, id: definition.id, cardId: String(definition.cardId), definition, requiredLocation: definition.requiredLocation || parsedAbility.requiredLocation, requiredCircle: definition.requiredCircle || parsedAbility.requiredCircle || [], conditions: definition.conditions || parsedAbility.conditions, conditionStatus: definition.conditions?.length ? "modeled" : parsedAbility.conditionStatus, costs: definition.costs || parsedAbility.costs, costStatus: definition.costs ? "supported-cost" : parsedAbility.costStatus, choiceStatus: definition.choicesReviewed === true ? "modeled" : parsedAbility.choiceStatus, effects: definition.effects, once: definition.once === true || parsedAbility.once, usageRestriction: resolveUsageRestriction(definition, parsedAbility) };
    if (!supportsServerAbilityEffects(ability)) return reject("unsupported-server-ability");
    if (ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review" || ability.conditions?.some(condition => !SUPPORTED_CONDITION_TYPES.has(condition?.type))) return reject("unmodeled-activation-requirement");
    const sourceZone = located.circle || located.zone;
    const inPermittedZone = (!ability.requiredLocation?.length || ability.requiredLocation.includes(sourceZone) || (sourceZone.startsWith("rear-") && ability.requiredLocation.includes("rear-guard"))) && (!ability.requiredCircle?.length || ability.requiredCircle.includes(located.circle));
    const selection = payload.selection || {}, costs = selection.costSelections || {};
    if (!costs || typeof costs !== "object" || Array.isArray(costs) || Object.keys(costs).some(key => !["cb", "sb", "discard", "reveal"].includes(key))) return reject("invalid-cost-selection");
    let usageKey;
    try { usageKey = engine.abilityUsageKey(state.turn, actorPlayerId, sourceUid, ability.id, ability.usageRestriction, definition.cardName, ability.printedText); }
    catch { return reject("missing-usage-identity"); }
    const used = Boolean((player.usedAbilities || []).includes(usageKey));
    const conditionContext = buildConditionContext(state, {}, located, engine);
    const permitted = engine.canActivateManualAbility(ability, {
      cardInstanceId: sourceUid, controllerPlayerId: located.controllerPlayerId, actorPlayerId,
      turnPlayerId: state.players[state.side]?.playerId, phase: "main", inPermittedZone,
      resolutionBlocked: false, alreadyUsed: used,
      conditions: conditionContext || {},
      resources: {
        faceUpDamage: (player.damage || []).filter(card => !card.faceDown).length,
        soulCount: (player.soul || []).length,
        discardableHand: (player.hand || []).filter(card => card.uid !== sourceUid).length,
        sourceRested: Boolean(located.instance.rested),
        sourceCanMoveToSoul: located.side === side,
        sourceCanRetire: located.side === side && located.zone === "rear-guard",
        sourceHasEverLegioned: located.instance.everLegioned === true,
        sourceIsLegioned: located.zone === "vanguard" && Boolean(located.instance.legionMate || located.instance.legionMateInstanceId),
        controllerDropCount: (player.drop || []).length
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
      effectUid: selection.effectUid || null, legionDropUids: selection.legionDropUids || [],
      opponentVanguardGrade: Number(Object.values(state.players).find(candidate => candidate !== player)?.vanguard?.grade ?? -1),
      cardDefinitionForInstance: serverCardDefinition, shuffleDeck: secureShuffle,
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
    if (ability?.kind !== "AUTO" || ability.conditionStatus === "needs-review" || ability.costStatus === "needs-review" || ability.choiceStatus === "needs-review" || !supportsServerAbilityEffects(ability)) return reject("unsupported-server-ability");
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
    const eventSourceZone = ability.trigger?.subject === "event-target" && triggerEvent.type === "card.ridden"
      ? triggerEvent.targetPreviousLocation || triggerEvent.previousLocation || pending.field || sourceZone
      : ability.trigger?.subject === "event-subject" && ability.trigger?.sourceLocation && triggerEvent.previousLocation
      ? triggerEvent.previousLocation
      : pending.field || sourceZone;
    if (!engine.eventMatchesAbilityTrigger(ability, triggerContext.event, triggerEvent, located.instance.uid, eventSourceZone, triggerContext.subjectZone || triggerEvent.currentLocation, actorPlayerId)) return reject("trigger-event-mismatch");
    if (isExactVanguardHitClanStandAbility(ability)) {
      if (!vanguardHitClanStandEventMatches(state, ability, located.instance, located, triggerEvent, actorPlayerId, engine)) return reject("vanguard-hit-stand-battle-context-invalid");
      const controller = state.players?.[side];
      if (!engine.canPayAbilityCosts(ability, { faceUpDamage: (controller?.damage || []).filter(card => !card.faceDown).length })) return reject("unpayable-cost");
    }
    const successTriggerValidated = isExactSuccessAbility(ability) && successThresholdEventMatches(state, ability, located.instance, located, triggerEvent, engine);
    if (isExactSuccessAbility(ability) && !successTriggerValidated) return reject("success-threshold-condition-no-longer-met");
    if (isExactClanSoulBlastAttackPowerAbility(ability)) {
      if (!exactClanSoulBlastAttackEventMatches(state, ability, located.instance, located, triggerEvent, actorPlayerId)) return reject("clan-soul-blast-attack-context-invalid");
      const currentConditions = buildConditionContext(state, triggerEvent, located, engine);
      if (!currentConditions || !engine.evaluateAbilityConditions(ability, currentConditions)) return reject("clan-soul-blast-vanguard-condition-no-longer-met");
      const controller = state.players?.[side];
      if (!engine.canPayAbilityCosts(ability, { soulCount: (controller?.soul || []).length })) return reject("unpayable-cost");
    }
    if (isAnyInterceptShieldAbility(ability)) {
      if (!interceptShieldTriggerMatches(state, ability, located.instance, located, triggerEvent, actorPlayerId)) return reject("intercept-shield-battle-context-invalid");
      const currentConditions = buildConditionContext(state, triggerEvent, located, engine);
      if (!currentConditions || !engine.evaluateAbilityConditions(ability, currentConditions)) return reject("intercept-shield-condition-no-longer-met");
    }
    if (isExactGodHandDriveAbility(ability) || isExactDauntlessDriveAbility(ability)) {
      if (!exactNormalDriveCheckContext(state, ability, located.instance, located, triggerEvent, actorPlayerId)) return reject("normal-drive-check-context-invalid");
      if (isExactTriggerUnitDrivePowerAbility(ability) && !exactTriggerUnitDriveCheckContext(state, ability, located.instance, located, triggerEvent, actorPlayerId)) return reject("trigger-unit-drive-check-context-invalid");
      if (isExactRcPlacementSoulChargeOneAbility(ability) && !exactRcPlacementSoulChargeEventMatches(ability, located.instance, located, triggerEvent, actorPlayerId, state)) return reject("rear-guard-placement-soul-charge-context-invalid");
      if (isExactDiscardSelfOptionalSoulAbility(ability) && !exactDiscardSelfOptionalSoulEventMatches(ability, located.instance, located, triggerEvent, actorPlayerId, state)) return reject("discarded-source-to-soul-context-invalid");
      if (isExactVanguardAttackSoulChargePowerAbility(ability) && !exactVanguardAttackSoulChargePowerEventMatches(state, ability, located.instance, located, triggerEvent, actorPlayerId)) return reject("vanguard-attack-soul-charge-context-invalid");
      const currentConditions = buildConditionContext(state, triggerEvent, located, engine);
      if (!currentConditions || !engine.evaluateAbilityConditions(ability, currentConditions)) return reject("normal-drive-check-condition-no-longer-met");
    }
    if (isExactGuardianTopFiveCallAbility(ability) &&
        !guardianTopFiveCallTriggerMatches(state, ability, located.instance, located, triggerEvent, actorPlayerId)) return reject("guardian-top-five-battle-context-invalid");
    if (isExactForerunnerAbility(ability) && !forerunnerRideMatches(state, ability, located.instance, located, triggerEvent, engine)) return reject("forerunner-ride-context-invalid");
    if (isExactRidePhaseDiscardCallAbility(ability) && !ridePhaseDiscardEventMatches(ability, located.instance, located, triggerEvent)) return reject("ride-phase-discard-context-invalid");
    if (isExactVanguardOrRearGuardOptionalSoulChargeAbility(ability) && !exactVanguardOrRearGuardOptionalSoulChargeEventMatches(ability, located.instance, located, triggerEvent, actorPlayerId, state)) return reject("placement-soul-charge-context-invalid");
    if (isExactRcReturnToHandCostDrawAbility(ability) && !exactRcReturnToHandCostDrawEventMatches(ability, located.instance, located, triggerEvent, actorPlayerId, state)) return reject("rc-return-to-hand-cost-draw-context-invalid");
    if (isExactDiscardGradeCallAbility(ability)) {
      if (!discardGradeCallEventMatches(ability, located.instance, located, triggerEvent, actorPlayerId, state)) return reject("discarded-grade-call-context-invalid");
      const currentConditions=buildConditionContext(state,triggerEvent,located,engine);
      if (!currentConditions||!engine.evaluateAbilityConditions(ability,currentConditions)) return reject("discarded-grade-call-condition-no-longer-met");
      if (!engine.canPayAbilityCosts(ability,{soulCount:(state.players?.[side]?.soul||[]).length})) return reject("unpayable-cost");
    }
    if (isExactBoostDrawDiscardAbility(ability) && !boostDrawDiscardEventMatches(state, ability, located.instance, located, triggerEvent, engine)) return reject("boost-draw-discard-context-invalid");
    if (isExactAttackedUnboostedProtectAbility(ability) && !attackedUnboostedProtectEventMatches(state, ability, located.instance, located, triggerEvent)) return reject("attacked-unboosted-protect-context-invalid");
    if (command.payload.accept && isExactRidePhaseDiscardCallAbility(ability) && (!ridePhaseDiscardHasLegalCircle(state.players[side]) || !selection.callZone || state.players[side].rear?.[(["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: state.players[side].accelZones || 0 }, (_, i) => `accel-${i + 1}`)].indexOf(selection.callZone))]?.locked === true)) return reject("no-legal-call-circle");
    if (command.payload.accept && isExactDiscardGradeCallAbility(ability) && (!ridePhaseDiscardHasLegalCircle(state.players[side]) || !selection.callZone || state.players[side].rear?.[( ["rear-left", "rear-right", "rear-back-left", "rear-back-center", "rear-back-right", ...Array.from({ length: state.players[side].accelZones || 0 }, (_, i) => `accel-${i + 1}`)].indexOf(selection.callZone) )]?.locked === true)) return reject("no-legal-call-circle");
    if (isExactSecondPlayerRideDrawAbility(ability)) {
      if (!secondPlayerRideDrawTriggerMatches(state, ability, located.instance, located, triggerEvent, actorPlayerId, engine)) return reject("ride-draw-event-context-invalid");
      const currentConditions = buildConditionContext(state, triggerEvent, located, engine);
      if (!currentConditions || !engine.evaluateAbilityConditions(ability, currentConditions)) return reject("ride-draw-condition-no-longer-met");
    }
    if (isExactHandRidePhaseSearchAbility(ability)) {
      const controller = state.players?.[side];
      if (located.zone !== "hand" || !controller?.hand?.some(card => card?.uid === located.instance.uid) ||
          triggerEvent.type !== "phase.changed" || triggerEvent.phase !== "ride" || triggerEvent.timingWindow !== "phase-start" ||
          triggerEvent.turnPlayerId !== actorPlayerId || triggerEvent.actingPlayerId !== actorPlayerId ||
          state.players?.[state.side]?.playerId !== actorPlayerId) return reject("ride-phase-source-or-event-invalid");
      const currentConditions = buildConditionContext(state, triggerEvent, located, engine);
      if (!currentConditions || !engine.evaluateAbilityConditions(ability, currentConditions)) return reject("ride-phase-condition-no-longer-met");
    }
    if (!engine.canResolveAbilitySource(ability, pending, actorPlayerId, located.instance, sourceInPlay)) return reject("ability-source-no-longer-resolvable");
    const exactHarmonyAbility = isExactHarmonyAssociationAbility(ability);
    if (exactHarmonyAbility && (triggerEvent.type !== "card.placed" ||
        typeof triggerContext.eventSubjectUid !== "string" || triggerContext.eventSubjectUid !== triggerEvent.subjectCardInstanceId ||
        triggerEvent.cardInstanceId !== triggerContext.eventSubjectUid || triggerContext.eventSubjectUid === located.instance.uid ||
        triggerContext.harmonySameColumnAtTrigger !== true || triggerContext.harmonyTurnKey !== `${state.turn}:${state.side}` ||
        (triggerEvent.subjectControllerPlayerId && triggerEvent.subjectControllerPlayerId !== actorPlayerId))) {
      return reject("harmony-trigger-context-invalid");
    }
    const player = state.players[side];
    if (isExactConditionalDiscardGuardianAbility(ability)) {
      const discardStep = program[1];
      if (player.hand.length >= discardStep.condition.count &&
          (typeof selection.effectDiscardUid !== "string" || !player.hand.some(card => card?.uid === selection.effectDiscardUid))) {
        return reject("conditional-discard-selection-required");
      }
    }
    const targetIds = command.payload.selection.engorgeTargetUids || [];
    if (program.some(step => step.op === "engorge") && command.payload.accept && (!Array.isArray(targetIds) || !targetIds.length)) return reject("invalid-engorge-selection");
    const selectedEffectTarget = command.payload.accept
      ? locateReviewedEffectTarget(state, pending, located.instance, actorPlayerId, selection, engine)
      : { ok: true, context: { target: located.instance, targetInPlay: sourceInPlay } };
    if (!selectedEffectTarget.ok) return reject(selectedEffectTarget.reason);
    if (command.payload.accept && isExactGuardianTopFiveCallAbility(ability)) {
      const deck = player.deck || [];
      const cardsToCall = deck.slice(-Math.min(5, deck.length));
      if (!cardsToCall.length || cardsToCall.some(card => {
        const definition = serverCardDefinition(card);
        return !definition || !/\bunit\b/i.test(String(definition.type || "")) ||
          !Number.isFinite(Number(definition.shield)) || !Number.isFinite(serverGuardianShieldValue(state, side, card, engine));
      })) return reject("guardian-top-five-contains-uncallable-card");
    }
    const engorgeTargetZones = Object.fromEntries(targetIds.map(uid => {
      const target = engine.locateCardInstance(state, uid);
      return [uid, target?.side === side && target.zone === "rear-guard" ? target.circle : null];
    }));

    const eventLog = [];
    const exactQuickShieldAbility = isExactQuickShieldRideAbility(ability);
    const opponent = Object.values(state.players || {}).find(candidate => candidate && candidate !== player);
    const opponentVanguardGrade = Number(opponent?.vanguard?.grade ?? -1);
    const createQuickShield = Boolean(command.payload.accept && exactQuickShieldAbility && opponentVanguardGrade >= 1);
    const quickShieldUid = createQuickShield
      ? stableQuickShieldUid(state.matchId, command.actionId, triggerContext.eventId, located.instance.uid)
      : null;
    if (createQuickShield) {
      if (!Array.isArray(player.hand) || !actorPlayerId || engine.locateCardInstance(state, quickShieldUid)) return reject("quick-shield-token-state-invalid");
    }
    const costSelections = selection.costSelections || {};
    const context = {
      source: located.instance,
      sourceInPlay,
      sourceZone,
      sourceCircle: located.circle,
      side,
      turnSide: state.side,
      player,
      match: state,
      turnId: state.turn,
      turnKey: `${state.turn}:${side}`,
      actorPlayerId,
      sidePlayerId: actorPlayerId,
      costSelections,
      selectedDamageUids: selection.damageUids || [],
      engorgeTargetUids: targetIds,
      engorgeTargetZones,
      effectUid: selection.effectUid,
      effectDiscardUid: selection.effectDiscardUid || null,
      checkedCard: isExactDauntlessDriveAbility(ability) ? player.triggerZone?.find(card => card?.uid === triggerEvent.checkedCardInstanceId) || null : null,
      checkedCardInstanceId: isExactDauntlessDriveAbility(ability) ? triggerEvent.checkedCardInstanceId : null,
      checkedCardInTrigger: isExactDauntlessDriveAbility(ability) && player.triggerZone?.some(card => card?.uid === triggerEvent.checkedCardInstanceId) === true,
      callZone: selection.callZone || null,
      selectedCard: isExactOracleTopDeckOrderAbility(ability) ? player.deck?.at(-1) || null : null,
      deckDestination: selection.deckDestination || null,
      effectChoice: selection.effectChoice,
      battleId: triggerEvent.battleId || null,
      chargeChoice: selection.chargeChoice,
      callZone: selection.callZone,
      eventSubjectUid: exactHarmonyAbility ? triggerContext.eventSubjectUid : null,
      harmonySameColumnAtTrigger: exactHarmonyAbility && triggerContext.harmonySameColumnAtTrigger === true,
      harmonyTurnKey: exactHarmonyAbility ? triggerContext.harmonyTurnKey : null,
      cardDefinitionForInstance: serverCardDefinition,
      shuffleDeck: secureShuffle,
      shieldValueForInstance: card => serverGuardianShieldValue(state, side, card, engine),
      revelationTopUid: selection.revelationTopUid,
      ...selectedEffectTarget.context,
      sourceControllerPlayerId: actorPlayerId,
      successTriggerValidated,
      opponentVanguardGrade,
      controllerRearGuards: (player.rear || []).filter(Boolean).length,
      opponentRearGuards: (opponent?.rear || []).filter(Boolean).length,
      ...(exactQuickShieldAbility ? {
        cardDefinitionForId: id => id === "token-quick-shield" ? { id, name: "Quick Shield", type: "Quick Shield Token", grade: 0, power: 0, shield: 5000, nation: "Token" } : null,
        createTokenUid: (step, index) => step.tokenId === "token-quick-shield" && index === 0 ? quickShieldUid : null,
        createTokenInstance: (step, uid, ownerPlayerId) => step.tokenId === "token-quick-shield" && uid === quickShieldUid
          ? engine.createCardInstance("token-quick-shield", ownerPlayerId, uid, { zone: "hand", cardName: "Quick Shield", type: "Quick Shield Token", nation: "Token", grade: 0, power: 0, shield: 5000 })
          : null,
        onTokenCreated: (_token, _step, resolutionContext) => { resolutionContext.player.quickShields = Number(resolutionContext.player.quickShields || 0) + 1; }
      } : {}),
      emitEvent: event => eventLog.push(event)
    };

    if (command.payload.accept && selection.payCost !== false) {
      const result = engine.resolveEffectProgram(program, engine.EFFECT_HANDLERS, context, draft => {
        const paid = engine.payAbilityCosts(ability, {
          ...draft,
          turnId: state.turn,
          actorPlayerId,
          cardDefinitionForInstance: serverCardDefinition
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

  return Object.freeze({ playerSideForSeat, buildConditionContext, discoverAutoTriggers, returnStriddenVanguard, continueTurnEnd, applyGameAction, applyAbilityDecision, applyManualAbilityActivation, applyEngorgeDecision: applyAbilityDecision, supportsServerEffectOperation, supportsServerAbilityEffects });
});
