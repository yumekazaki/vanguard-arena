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
  const cardAbilityKeywordIndex = new Map();
  const searchableAbilityKeywords = Object.freeze(["harmony", "engorge", "charge", "bloom", "brave", "hollow", "magia", "rush", "burst", "blaze", "darkness", "success", "shadowstitch", "dark device", "wave", "thunderstrike", "ritual", "oracle", "contest", "vote"]);
  let abilityDefinitionRevision = 0;
  const parsedCardAbilityCache = new WeakMap();
  function createCardInstance(cardId, ownerPlayerId, uid = null, state = {}) {
    if (cardId === undefined || cardId === null || !ownerPlayerId) throw new TypeError("Card instances require a definition ID and owner player ID.");
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("Card instance state must be an object.");
    const instanceUid = uid || `${cardId}-${Math.random().toString(36).slice(2, 11)}`;
    if (state.legionMateInstanceId !== undefined && (typeof state.legionMateInstanceId !== "string" || !state.legionMateInstanceId || state.legionMateInstanceId === instanceUid || state.legionMateInstanceId.length > 180)) throw new TypeError("Legion state requires a distinct, stable mate instance ID.");
    return {
      uid: instanceUid,
      cardId, ownerPlayerId, controllerPlayerId: state.controllerPlayerId || ownerPlayerId,
      ...(typeof state.legionMateInstanceId === "string" ? { legionMateInstanceId: state.legionMateInstanceId } : {}),
      ...(typeof state.legionLeaderInstanceId === "string" ? { legionLeaderInstanceId: state.legionLeaderInstanceId } : {}),
      ...(state.everLegioned === true ? { everLegioned: true } : {}),
      ...(state.grade != null && Number.isInteger(Number(state.grade)) && Number(state.grade) >= 0 ? { grade: Number(state.grade) } : {}),
      ...(state.gDeckCard === true ? { gDeckCard: true } : {}),
      ...(state.gGuardian === true ? { gGuardian: true } : {}),
      ...(state.ultimateStride === true ? { ultimateStride: true } : {}),
      ...(typeof state.cardName === "string" ? { cardName: state.cardName } : {}),
      ...(typeof state.hasAbilities === "boolean" ? { hasAbilities: state.hasAbilities } : {}),
      ...(typeof state.hasLimitBreak4 === "boolean" ? { hasLimitBreak4: state.hasLimitBreak4 } : {}),
      ...(typeof state.type === "string" ? { type: state.type } : {}),
      ...(typeof state.clan === "string" ? { clan: state.clan } : {}),
      ...(Array.isArray(state.clans) && state.clans.every(value => typeof value === "string") ? { clans: [...state.clans] } : {}),
      ...(typeof state.nation === "string" ? { nation: state.nation } : {}),
      ...(Array.isArray(state.nations) && state.nations.every(value => typeof value === "string") ? { nations: [...state.nations] } : {}),
      ...(typeof state.race === "string" ? { race: state.race } : {}),
      ...(Array.isArray(state.races) && state.races.every(value => typeof value === "string") ? { races: [...state.races] } : {}),
      ...(typeof state.triggerType === "string" && ["critical", "draw", "stand", "heal", "front", "over"].includes(state.triggerType.toLowerCase()) ? { triggerType: state.triggerType.toLowerCase() } : {}),
      ...(state.unitCard === true ? { unitCard: true } : {}),
      ...(state.cannotBeRidden === true ? { cannotBeRidden: true } : {}),
      ...(state.sameNameRideRestriction === true ? { sameNameRideRestriction: true } : {}),
      ...(state.power != null && Number.isFinite(Number(state.power)) ? { power: Number(state.power) } : {}),
      ...(state.shield != null && Number.isFinite(Number(state.shield)) ? { shield: Number(state.shield) } : {}),
      ...(state.critical != null && Number.isFinite(Number(state.critical)) ? { critical: Number(state.critical) } : {}),
      ...(state.drive != null && Number.isInteger(Number(state.drive)) ? { drive: Number(state.drive) } : {}),
      ...(state.triggerPower != null && Number.isFinite(Number(state.triggerPower)) && Number(state.triggerPower) >= 0 ? { triggerPower: Number(state.triggerPower) } : {}),
      ...(state.boostAbility === true ? { boostAbility: true } : {}),
      ...(state.sentinel === true ? { sentinel: true } : {}),
      ...(state.canAttackBackRow === true ? { canAttackBackRow: true } : {}),
      ...(state.cannotDriveChecksThisTurn === true ? { cannotDriveChecksThisTurn: true, cannotDriveChecksExpiry: state.cannotDriveChecksExpiry || null } : {}),
      zone: state.zone || null, circle: state.circle || null, position: state.position || "stand",
      faceUp: state.faceUp !== false, rested: state.rested === true,
      modifiers: { ...(state.modifiers || {}) }, statuses: [...(state.statuses || [])], abilityUses: { ...(state.abilityUses || {}) }
    };
  }
  function recordFightRide(player, cardDefinition) {
    if (!player || !cardDefinition || !Number.isFinite(Number(cardDefinition.grade)) || Number(cardDefinition.grade) < 3) return false;
    player.rodeGradeThreePlusThisFight = true;
    return true;
  }
  function recordOpponentTriggerCheck(players,checkerPlayerId,revealedTrigger,checkType){if(!players||!checkerPlayerId||!revealedTrigger||!(["drive","damage"].includes(String(checkType).toLowerCase())))return false;const checker=Object.values(players).find(player=>player?.playerId===checkerPlayerId);if(!checker)return false;const opponent=Object.values(players).find(player=>player&&player!==checker);if(!opponent)return false;opponent.opponentTriggerRevealedThisTurn=true;return true}
  function clearOpponentTriggerFacts(players){if(!players||typeof players!=="object")return false;for(const player of Object.values(players))if(player&&typeof player==="object")player.opponentTriggerRevealedThisTurn=false;return true}
  function locateCardInstance(state,uid){
    if(!state||typeof uid!=="string"||!uid)return null;
    const matches=[],zones=["deck","hand","damage","drop","soul","bind","rear","orders","crests","guardCircle","triggerZone","extra","gDeck","gZone","removed"];
    const descriptors={deck:{zone:"deck"},hand:{zone:"hand"},damage:{zone:"damage"},drop:{zone:"drop"},soul:{zone:"soul"},bind:{zone:"bind"},orders:{zone:"order"},crests:{zone:"crest"},guardCircle:{zone:"guardian",circle:"guardian"},triggerZone:{zone:"trigger"},extra:{zone:"extra"},gDeck:{zone:"g-deck"},gZone:{zone:"g-zone"},removed:{zone:"removed"}};
    for(const[side,player]of Object.entries(state.players||{})){
      const playerId=player?.playerId||side;
      if(player?.vanguard?.uid===uid)matches.push({instance:player.vanguard,side,playerId,ownerPlayerId:player.vanguard.ownerPlayerId||playerId,controllerPlayerId:player.vanguard.controllerPlayerId||playerId,zone:"vanguard",circle:"vanguard",index:null});
      if(player?.vanguard?.legionMate?.uid===uid)matches.push({instance:player.vanguard.legionMate,side,playerId,ownerPlayerId:player.vanguard.legionMate.ownerPlayerId||playerId,controllerPlayerId:player.vanguard.legionMate.controllerPlayerId||playerId,zone:"vanguard",circle:"vanguard",index:null,legionRole:"mate",legionLeaderInstanceId:player.vanguard.uid});
      for(const zone of zones){const list=player?.[zone];if(!Array.isArray(list))continue;for(let index=0;index<list.length;index++){const instance=list[index];if(instance?.uid!==uid)continue;let descriptor=descriptors[zone];if(zone==="rear"){const circles=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right"];descriptor=index<circles.length?{zone:"rear-guard",circle:circles[index]}:{zone:"rear-guard",circle:`accel-${index-circles.length+1}`}}matches.push({instance,side,playerId,ownerPlayerId:instance.ownerPlayerId||playerId,controllerPlayerId:instance.controllerPlayerId||playerId,zone:descriptor.zone,circle:descriptor.circle||null,index});}}
    }
    if(Array.isArray(state.revealed?.cards))for(let index=0;index<state.revealed.cards.length;index++){const instance=state.revealed.cards[index];if(instance?.uid===uid)matches.push({instance,side:state.revealed.owner||null,playerId:null,ownerPlayerId:instance.ownerPlayerId||null,controllerPlayerId:instance.controllerPlayerId||null,zone:"revealed",circle:null,index})}
    if(matches.length!==1)return matches.length?{ambiguous:true,matches}:null;
    return matches[0];
  }
  function harmonyColumn(zone){if(zone==="vanguard"||zone==="rear-back-center"||zone==="rear-3")return"center";if(["rear-left","rear-back-left","rear-0","rear-2"].includes(zone))return"left";if(["rear-right","rear-back-right","rear-1","rear-4"].includes(zone))return"right";if(String(zone||"").startsWith("accel-"))return String(zone);return null}
  function harmonyFieldPair(state,pair){const first=locateCardInstance(state,pair?.firstUid),second=locateCardInstance(state,pair?.secondUid);return Boolean(first&&second&&!first.ambiguous&&!second.ambiguous&&["vanguard","rear-guard"].includes(first.zone)&&["vanguard","rear-guard"].includes(second.zone)&&first.side===second.side&&first.controllerPlayerId===second.controllerPlayerId)}
  function removeHarmonyAssociationsForInstance(state,uid){if(!Array.isArray(state?.harmonyAssociations))return 0;const before=state.harmonyAssociations.length;state.harmonyAssociations=state.harmonyAssociations.filter(pair=>pair?.firstUid!==uid&&pair?.secondUid!==uid);return before-state.harmonyAssociations.length}
  function createHarmonyAssociation(state,firstUid,secondUid,turnKey,allowMovedSinceTrigger=false){if(!state||!firstUid||!secondUid||firstUid===secondUid||!turnKey)return false;const first=locateCardInstance(state,firstUid),second=locateCardInstance(state,secondUid);if(!first||!second||first.ambiguous||second.ambiguous||!["vanguard","rear-guard"].includes(first.zone)||!["vanguard","rear-guard"].includes(second.zone)||first.side!==second.side||first.controllerPlayerId!==second.controllerPlayerId||!allowMovedSinceTrigger&&(!harmonyColumn(first.circle||first.zone)||harmonyColumn(first.circle||first.zone)!==harmonyColumn(second.circle||second.zone)))return false;const active=(state.harmonyAssociations||[]).filter(pair=>pair?.turnKey===turnKey&&harmonyFieldPair(state,pair));state.harmonyAssociations=active;if(active.some(pair=>pair.firstUid===firstUid&&pair.secondUid===secondUid||pair.firstUid===secondUid&&pair.secondUid===firstUid))return true;state.harmonyAssociations.push({firstUid,secondUid,controllerPlayerId:first.controllerPlayerId,turnKey});return true}
  function isCardInHarmony(state,uid,turnKey){if(!state||!uid||!turnKey)return false;let found=false;for(const pair of state.harmonyAssociations||[]){if(pair?.turnKey!==turnKey||!harmonyFieldPair(state,pair))continue;if(pair.firstUid===uid||pair.secondUid===uid)found=true}return found}
  function expireHarmonyAssociations(state,endingTurnKey){if(!Array.isArray(state?.harmonyAssociations))return 0;const before=state.harmonyAssociations.length;state.harmonyAssociations=state.harmonyAssociations.filter(pair=>pair?.turnKey!==endingTurnKey&&harmonyFieldPair(state,pair));return before-state.harmonyAssociations.length}
  const effectOperations = new Set(["draw", "modify-power", "modify-power-target", "modify-critical", "grant-temporary-boost", "continuous-power", "continuous-power-adjustment", "continuous-power-per-soul-card", "continuous-power-per-clan-rearguard", "continuous-power-per-dragontree-marker", "continuous-power-per-controller-rearguard", "continuous-power-per-named-face-up-damage-card", "continuous-critical", "continuous-shield", "continuous-grade", "modify-drive", "modify-drive-target", "counter-charge", "conditional-counter-charge", "soul-charge", "revelation-choice", "rest-target", "engorge", "g-guardian-discard-charge-choice", "g-guardian-grade-three-replacement-choice", "set-blazing", "set-hollowed", "set-charging", "set-successful", "deck-to-damage", "schedule-damage-return-at-turn-end", "schedule-source-return-to-deck-at-turn-end", "return-chosen-damage-to-deck", "return-trigger-discard-to-hand", "reorder-deck-card", "retire-target", "stand-target", "unlock-target", "protect-target", "protect-attacked-source", "move-source-to-soul", "move-filtered-hand-card-to-soul", "move-source-to-hand", "modify-defending-source-power", "rest-source", "stand-source", "create-token", "discard-from-hand", "draw-then-discard", "search-top-grade-three-to-hand-then-discard", "search-top-up-to-one-grade-to-hand", "search-top-up-to-one-filtered-to-hand", "search-deck-named-grade-three-then-discard", "search-deck-same-name-to-hand", "search-deck-or-drop-named-to-hand", "search-deck-named-call-to-rearguard", "ride-top-five-named-card", "ride-revoldress-source-from-soul-rested", "call-top-to-guardian", "call-filtered-top-to-guardian-drop", "call-checked-card-locked", "call-source-from-drop-rested", "call-source-from-soul", "associate-harmony-units", "modify-shield-source", "seek-mate", "place-circle-marker"]);
  const positiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0;
  function validTopSearchFilter(filter) {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) return false;
    const keys = Object.keys(filter).sort().join(",");
    if (keys === "minGrade") return Number.isInteger(Number(filter.minGrade)) && Number(filter.minGrade) >= 0;
    if (keys === "cardType,clan,minGrade") return Number.isInteger(Number(filter.minGrade)) && Number(filter.minGrade) >= 0 && filter.cardType === "unit" && typeof filter.clan === "string" && Boolean(filter.clan.trim());
    if (keys === "abilityKeyword") return typeof filter.abilityKeyword === "string" && Boolean(filter.abilityKeyword.trim());
    if (keys === "abilityKeywordsAny") return Array.isArray(filter.abilityKeywordsAny) && filter.abilityKeywordsAny.length > 0 && filter.abilityKeywordsAny.length <= 8 && filter.abilityKeywordsAny.every(keyword => typeof keyword === "string" && Boolean(keyword.trim()));
    if (keys === "cardNamesAny") return Array.isArray(filter.cardNamesAny) && filter.cardNamesAny.length >= 2 && filter.cardNamesAny.length <= 8 && filter.cardNamesAny.every(name => typeof name === "string" && Boolean(name.trim()));
    if (keys === "race") return typeof filter.race === "string" && Boolean(filter.race.trim());
    return false;
  }
  function continuousConditionSupported(condition,depth=0){if(!condition||typeof condition!=="object"||Array.isArray(condition)||depth>4)return false;if(["any","all"].includes(condition.op))return Array.isArray(condition.conditions)&&condition.conditions.length>=1&&condition.conditions.length<=8&&condition.conditions.every(child=>continuousConditionSupported(child,depth+1));if(condition.op==="always"||condition.op==="source-attacked-this-battle"||condition.op==="source-boosted-this-battle"||condition.op==="opponent-g-zone-has-card-and-no-face-up-card"||condition.op==="opponent-g-zone-has-card"||condition.op==="opponent-g-zone-has-face-up-card")return true;if(condition.op==="controller-vanguard-card-name-equals"||condition.op==="controller-vanguard-card-name-contains"||condition.op==="controller-field-lacks-other-card-name"||condition.op==="controller-rearguard-has-card-name"||condition.op==="controller-rearguard-card-name-contains")return typeof condition.name==="string"&&condition.name.trim().length>0;if(condition.op==="controller-field-has-non-clan")return typeof condition.clan==="string"&&condition.clan.trim().length>0;if(condition.op==="controller-rearguard-clan-count-at-least")return typeof condition.clan==="string"&&condition.clan.trim().length>0&&positiveInteger(condition.count);if(condition.op==="soul-has-card-name")return typeof condition.name==="string"&&condition.name.trim().length>0;if(condition.op==="soul-card-name-contains-count-at-least")return typeof condition.name==="string"&&condition.name.trim().length>0&&positiveInteger(condition.count);if(["controller-turn","normal-order-played-this-turn","order-played-this-turn","attacking-vanguard","opponent-trigger-revealed-this-turn"].includes(condition.op))return true;if(["opponent-vanguard-grade-at-least","controller-vanguard-grade-at-least","controller-vanguard-grade-less-than-opponent"].includes(condition.op))return condition.op==="controller-vanguard-grade-less-than-opponent"||Number.isInteger(Number(condition.grade))&&Number(condition.grade)>=0;if(condition.op==="generation-break"||condition.op==="controller-damage-at-least")return positiveInteger(condition.count);return false}
  function continuousConditionMatches(condition,context={}){if(!continuousConditionSupported(condition))return false;if(condition.op==="always")return true;if(condition.op==="source-attacked-this-battle")return context.sourceAttackedThisBattle===true;if(condition.op==="any")return condition.conditions.some(child=>continuousConditionMatches(child,context));if(condition.op==="all")return condition.conditions.every(child=>continuousConditionMatches(child,context));if(condition.op==="controller-vanguard-card-name-equals")return(context.controllerVanguardCardNames||[]).some(name=>String(name).toLocaleLowerCase()===String(condition.name).toLocaleLowerCase());if(condition.op==="controller-vanguard-card-name-contains")return(context.controllerVanguardCardNames||[]).some(name=>String(name).toLocaleLowerCase().includes(String(condition.name).toLocaleLowerCase()));if(condition.op==="controller-rearguard-has-card-name"||condition.op==="controller-rearguard-card-name-contains"){if(!Array.isArray(context.controllerFieldCards))return false;const phrase=String(condition.name).toLocaleLowerCase();return context.controllerFieldCards.some(card=>card?.zone==="rear-guard"&&(card?.names||[]).some(name=>condition.op==="controller-rearguard-has-card-name"?String(name).toLocaleLowerCase()===phrase:String(name).toLocaleLowerCase().includes(phrase)))}if(condition.op==="controller-rearguard-clan-count-at-least"){if(!Array.isArray(context.controllerFieldCards))return false;const expected=String(condition.clan).trim().toLocaleLowerCase(),matchingIds=new Set();for(const card of context.controllerFieldCards){if(card?.zone!=="rear-guard"||typeof card.uid!=="string")continue;const values=Array.isArray(card.clans)?card.clans:card.clan?[card.clan]:[];if(card.allClansAndNations===true||values.some(value=>String(value||"").trim().toLocaleLowerCase()===expected))matchingIds.add(card.uid)}return matchingIds.size>=Number(condition.count)}if(condition.op==="controller-field-lacks-other-card-name"){if(!context.sourceInstanceId||!Array.isArray(context.controllerFieldCards))return false;const phrase=String(condition.name).toLocaleLowerCase();return context.controllerFieldCards.every(card=>card?.uid===context.sourceInstanceId||!(card?.names||[]).some(name=>String(name).toLocaleLowerCase().includes(phrase)))}if(condition.op==="controller-field-has-non-clan"){const expected=String(condition.clan).trim().toLowerCase();if(!Array.isArray(context.controllerFieldCards))return false;return context.controllerFieldCards.some(card=>{const values=Array.isArray(card?.clans)?card.clans:card?.clan?[card.clan]:[],clans=[...new Set(values.map(value=>String(value||"").trim().toLowerCase()).filter(Boolean))];return clans.length===1&&clans[0]!==expected})}if(condition.op==="soul-has-card-name")return(condition.controllerTurn!==true||context.isControllerTurn===true)&&(context.soulCardNames||[]).some(name=>String(name).toLowerCase()===String(condition.name).toLowerCase());if(condition.op==="soul-card-name-contains-count-at-least")return(context.soulCardNames||[]).filter(name=>String(name).toLowerCase().includes(String(condition.name).toLowerCase())).length>=Number(condition.count);if(condition.op==="controller-turn")return context.isControllerTurn===true;if(condition.op==="normal-order-played-this-turn")return context.normalOrderPlayedThisTurn===true;if(condition.op==="order-played-this-turn")return context.isControllerTurn===true&&context.orderPlayedThisTurn===true;if(condition.op==="attacking-vanguard")return context.attackingVanguard===true;if(condition.op==="source-boosted-this-battle")return context.sourceWasBooster===true;if(condition.op==="opponent-g-zone-has-card-and-no-face-up-card")return Number(context.opponentGZoneCardCount||0)>0&&Number(context.opponentFaceUpGZoneCardCount||0)===0;if(condition.op==="opponent-g-zone-has-card")return Number(context.opponentGZoneCardCount||0)>0;if(condition.op==="opponent-g-zone-has-face-up-card")return Number(context.opponentFaceUpGZoneCardCount||0)>0;if(condition.op==="opponent-trigger-revealed-this-turn")return context.opponentTriggerRevealedThisTurn===true;if(condition.op==="opponent-vanguard-grade-at-least")return Number(context.opponentVanguardGrade??-1)>=Number(condition.grade)&&(condition.controllerTurn!==true||context.isControllerTurn===true);if(condition.op==="controller-vanguard-grade-at-least")return Number(context.controllerVanguardGrade??-1)>=Number(condition.grade);if(condition.op==="controller-vanguard-grade-less-than-opponent")return Number.isFinite(Number(context.controllerVanguardGrade))&&Number.isFinite(Number(context.opponentVanguardGrade))&&Number(context.controllerVanguardGrade)<Number(context.opponentVanguardGrade);if(condition.op==="generation-break")return Number(context.generationBreakCount||0)>=Number(condition.count);if(condition.op==="controller-damage-at-least")return Number(context.controllerDamageCount||context.damageCount||0)>=Number(condition.count);return false}
  const sourceModifierHandler = (property, expiryProperty, attackProperty = null) => Object.freeze({
    validate(step, context) { const attack=context?.match?.pendingAttack,source=context?.source;return step.target === "source" && positiveInteger(step.amount) && ["turn", "battle"].includes(step.duration) && context?.sourceInPlay === true && Boolean(source) && (step.duration !== "battle" || attack?.attackerUid === source.uid || (property === "turnPowerBoost" && attack?.boostUid === source.uid)); },
    apply(step, context) {
      const amount = Number(step.amount), attack=context.match?.pendingAttack;
      const beforePower=property==="turnPowerBoost"?Number(context.source.power||0)+Number(context.source.powerBoost||0)+Number(context.source.turnPowerBoost||0):null;
      if(step.duration === "battle") { if(attackProperty&&attack?.attackerUid===context.source.uid){attack[attackProperty]=Number(attack[attackProperty]||0)+amount;if(attackProperty==="critical")attack.abilityCriticalBoost=Number(attack.abilityCriticalBoost||0)+amount;if(attackProperty==="driveChecksRemaining"){attack.maxDriveChecks=Number(attack.maxDriveChecks||0)+amount;attack.awaitingDrive=true;attack.driveChecksComplete=false;}}else if(attackProperty==="power"&&attack?.boostUid===context.source.uid){attack.boostPower=Number(attack.boostPower||0)+amount;attack.power=Number(attack.power||0)+amount;}if(property==="turnPowerBoost")context.emitEvent?.({type:"characteristic.changed",cardInstanceId:context.source.uid,targetLocation:context.sourceCircle||context.sourceZone,reason:"power-modified",before:{power:beforePower},after:{power:beforePower+amount},battleId:attack?.battleId||null});return true; }
      context.source[property] = Number(context.source[property] || 0) + amount;
      context.source[expiryProperty] = context.actorPlayerId || context.player?.playerId || context.side;
      if (property === "turnCriticalBoost") {
        context.source.turnCriticalAbilityBoost = Number(context.source.turnCriticalAbilityBoost || 0) + amount;
        context.source.turnCriticalAbilityExpiry = context.actorPlayerId || context.player?.playerId || context.side;
      }
      if (attackProperty && attack?.attackerUid === context.source.uid) { attack[attackProperty] += amount; if(attackProperty==="critical")attack.abilityCriticalBoost=Number(attack.abilityCriticalBoost||0)+amount; if (attackProperty === "driveChecksRemaining") { attack.maxDriveChecks = Number(attack.maxDriveChecks || 0) + amount; attack.awaitingDrive = true; attack.driveChecksComplete = false; } } else if(attackProperty==="power"&&attack?.boostUid===context.source.uid){attack.boostPower=Number(attack.boostPower||0)+amount;attack.power=Number(attack.power||0)+amount;}
      if(property==="turnPowerBoost")context.emitEvent?.({type:"characteristic.changed",cardInstanceId:context.source.uid,targetLocation:context.sourceCircle||context.sourceZone,reason:"power-modified",before:{power:beforePower},after:{power:Number(context.source.power||0)+Number(context.source.powerBoost||0)+Number(context.source.turnPowerBoost||0)},battleId:attack?.battleId||null});
      return true;
    }
  });
  const EFFECT_HANDLERS = Object.freeze({
    "place-circle-marker": Object.freeze({
      validate(step, context) { const zone = String(context.circleZone || ""), rearIndex = ({ "rear-left": 0, "rear-right": 1, "rear-back-left": 2, "rear-back-center": 3, "rear-back-right": 4 })[zone], accel = zone.match(/^accel-(\d+)$/), validConfiguration = step.markerType === "Treasures" && JSON.stringify(step.circleTypes) === JSON.stringify(["vanguard","rear-guard"]) || step.markerType === "Dragontree" && JSON.stringify(step.circleTypes) === JSON.stringify(["rear-guard"]), circleType = zone === "vanguard" ? "vanguard" : rearIndex != null || accel ? "rear-guard" : null, zoneExists = zone === "vanguard" ? Boolean(context.player?.vanguard) : rearIndex != null ? rearIndex < (context.player?.rear || []).length : Boolean(accel && Number(accel[1]) <= Number(context.player?.accelZones || 0)); return step.target === "chosen-controller-circle" && validConfiguration && step.circleTypes.includes(circleType) && zoneExists && context.player?.playerId === context.actorPlayerId && !(context.player.giftZones || []).some(marker => marker?.zone === zone && marker?.type === step.markerType); },
      apply(step, context) { context.player.giftZones ||= []; context.player.giftZones.push({ type: step.markerType, zone: context.circleZone }); context.emitEvent?.({ type: "circle.marker_placed", controllerSide: context.side, controllerPlayerId: context.actorPlayerId, targetLocation: context.circleZone, markerType: step.markerType }); return true; }
    }),
    "set-successful": Object.freeze({
      validate(step) { return step.target === "source" && positiveInteger(step.threshold); },
      apply(step, context) { context.source.successfulTurnKey = `${context.match.turn}:${context.match.side}`; context.emitEvent?.({ type: "unit.became_successful", cardInstanceId: context.source.uid, targetLocation: context.sourceCircle || context.sourceZone }); return true; }
    }),
    "associate-harmony-units": Object.freeze({
      validate(step,context){const source=context?.source,other=context?.eventSubjectUid?locateCardInstance(context.match,context.eventSubjectUid):null,located=source?.uid?locateCardInstance(context.match,source.uid):null;return step.target==="source-and-event-subject"&&step.duration==="turn"&&context.sourceInPlay===true&&context.harmonySameColumnAtTrigger===true&&Boolean(source?.uid)&&Boolean(other)&&Boolean(located)&&!other.ambiguous&&!located.ambiguous&&source.uid!==context.eventSubjectUid&&["vanguard","rear-guard"].includes(other.zone)&&["vanguard","rear-guard"].includes(located.zone)&&other.side===located.side&&other.controllerPlayerId===located.controllerPlayerId&&Boolean(context.harmonyTurnKey)},
      apply(step,context){const sourceWasInHarmony=isCardInHarmony(context.match,context.source.uid,context.harmonyTurnKey),otherWasInHarmony=isCardInHarmony(context.match,context.eventSubjectUid,context.harmonyTurnKey);if(!createHarmonyAssociation(context.match,context.source.uid,context.eventSubjectUid,context.harmonyTurnKey,true))return false;if(!sourceWasInHarmony)context.emitEvent?.({type:"unit.became_harmony",cardInstanceId:context.source.uid,controllerSide:context.side});if(!otherWasInHarmony)context.emitEvent?.({type:"unit.became_harmony",cardInstanceId:context.eventSubjectUid,controllerSide:context.side});return true}
    }),
    "modify-power": sourceModifierHandler("turnPowerBoost", "turnPowerExpiry", "power"),
    "grant-temporary-boost": Object.freeze({
      validate(step,context){const circle=String(context.sourceCircle||context.sourceZone||"");return step.target==="source"&&step.duration==="turn"&&context.sourceInPlay===true&&(/^(?:rear-(?:left|right|back-left|back-center|back-right)|accel-\d+)$/i.test(circle))&&typeof context.actorPlayerId==="string"&&context.source?.controllerPlayerId===context.actorPlayerId;},
      apply(_step,context){const source=context.source;source.temporaryBoostAbilityPrevious=source.boostAbility===true;source.boostAbility=true;source.temporaryBoostAbility=true;source.temporaryBoostAbilityExpiry=context.actorPlayerId;return true;}
    }),
      "modify-power-target": Object.freeze({
      validate(step, context) { if(step.optionalTarget===true&&context?.optionalNoTarget===true)return step.target==="chosen"&&positiveInteger(step.amount)&&step.duration==="turn"&&!context.target;if(step.noOpIfNoLegalTargets&&context?.noLegalTarget===true)return ["chosen","boosted-unit"].includes(step.target)&&positiveInteger(step.amount)&&step.duration==="turn";return ["chosen","boosted-unit"].includes(step.target) && positiveInteger(step.amount) && ["turn","battle"].includes(step.duration) && Boolean(context?.target) && context.targetInPlay === true && matchesTargetFilter(step.targetFilter || {}, context) && (step.duration !== "battle" || context.match?.pendingAttack?.attackerUid === context.target.uid); },
      apply(step, context) { if(step.optionalTarget===true&&context?.optionalNoTarget===true)return 0;if(step.noOpIfNoLegalTargets&&context?.noLegalTarget===true)return 0;const attack=context.match?.pendingAttack,battleTarget=attack?.attackerUid===context.target.uid,beforePower=step.duration==="battle"&&battleTarget?Number(attack.power||0):Number(context.target.power||0)+Number(context.target.powerBoost||0)+Number(context.target.turnPowerBoost||0);if(step.duration==="battle"){attack.power=Number(attack.power||0)+Number(step.amount);}else{context.target.turnPowerBoost=Number(context.target.turnPowerBoost||0)+Number(step.amount);context.target.turnPowerExpiry=context.actorPlayerId||context.player?.playerId||context.side;if(battleTarget)attack.power=Number(attack.power||0)+Number(step.amount);}const afterPower=step.duration==="battle"||battleTarget?Number(attack?.power||beforePower):Number(context.target.power||0)+Number(context.target.powerBoost||0)+Number(context.target.turnPowerBoost||0);context.emitEvent?.({type:"characteristic.changed",cardInstanceId:context.target.uid,targetLocation:context.targetZone||context.target.circle||null,reason:"power-modified",before:{power:beforePower},after:{power:afterPower},battleId:attack?.battleId||null});return true; }
    }),
    "modify-critical": sourceModifierHandler("turnCriticalBoost", "turnCriticalExpiry", "critical"),
    "g-guardian-grade-three-replacement-choice": Object.freeze({
      validate(step,context){const choice=step.choices?.find(item=>item.id===context.effectChoice);return step.target==="controller"&&Array.isArray(step.choices)&&step.choices.length===2&&Boolean(choice)&&Boolean(context.match?.pendingAttack?.battleId)&&context.match.pendingAttack.defenderSide===context.side&&context.match.pendingAttack.battleId===context.battleId&&Boolean(context.target?.uid)&&context.targetInPlay===true&&matchesTargetFilter(choice.targetFilter||{},context)},
      apply(step,context){const choice=step.choices.find(item=>item.id===context.effectChoice),target=context.target;if(!choice||!target)return false;if(choice.id==="vanguard-power"){target.turnPowerBoost=Number(target.turnPowerBoost||0)+Number(choice.amount);target.turnPowerExpiry=context.actorPlayerId||context.player?.playerId||context.side;if(context.match.pendingAttack?.attackerUid===target.uid)context.match.pendingAttack.power=Number(context.match.pendingAttack.power||0)+Number(choice.amount);return true}if(choice.id==="opponent-critical"){target.battleCriticalBoost=Number(target.battleCriticalBoost||0)+Number(choice.amount);target.battleCriticalExpiryBattleId=context.battleId;if(context.match.pendingAttack?.attackerUid===target.uid)context.match.pendingAttack.critical=Math.max(1,Number(context.match.pendingAttack.critical||1)+Number(choice.amount));return true}return false}
    }),
    "modify-drive": sourceModifierHandler("turnDriveBoost", "turnDriveExpiry", "driveChecksRemaining"),
    "modify-drive-target": Object.freeze({
      validate(step,context){const attack=context?.match?.pendingAttack;return step.target==="attacking-vanguard"&&positiveInteger(step.amount)&&step.duration==="battle"&&Boolean(attack)&&context.player?.vanguard?.uid===attack.attackerUid&&attack.attackerZone==="vanguard";},
      apply(step,context){const attack=context.match.pendingAttack;attack.driveChecksRemaining=Number(attack.driveChecksRemaining||0)+Number(step.amount);attack.maxDriveChecks=Number(attack.maxDriveChecks||0)+Number(step.amount);attack.awaitingDrive=true;attack.driveChecksComplete=false;return true;}
    }),
    draw: Object.freeze({
      validate(step, context) { return positiveInteger(step.count) && Array.isArray(context?.player?.deck) && Array.isArray(context?.player?.hand); },
      apply(step, context) { const drawn=[];for(let i=0;i<Number(step.count)&&context.player.deck.length;i++)drawn.push(context.player.deck.pop());context.player.hand.push(...drawn);for(const card of drawn)context.emitEvent?.({type:"card.drawn",cardInstanceId:card.uid});if(drawn.length<Number(step.count))context.effectDeckOut={side:context.side||null,playerId:context.player?.playerId||context.actorPlayerId||null,requested:Number(step.count),drawn:drawn.length};return drawn.length; }
    }),
    "counter-charge": Object.freeze({
      validate(step, context) { const ids=context.selectedDamageUids||[],damage=context.player?.damage||[],available=damage.filter(card=>card?.faceDown),expected=Math.min(Number(step.count),available.length);return positiveInteger(step.count)&&Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.length===expected&&ids.every(uid=>available.some(card=>card.uid===uid)); },
      apply(step, context) { const ids=new Set(context.selectedDamageUids);for(const card of context.player.damage)if(ids.has(card.uid))card.faceDown=false;return ids.size; }
    }),
    "conditional-counter-charge": Object.freeze({
      validate(step,context){return step.target==="controller"&&positiveInteger(step.count)&&step.condition?.type==="controller-drop-has-card-name"&&typeof step.condition.cardName==="string"&&step.condition.cardName.trim().length>0&&Array.isArray(context.player?.drop)&&Array.isArray(context.player?.damage)&&typeof context.cardDefinitionForInstance==="function"},
      apply(step,context){const present=context.player.drop.some(card=>cardHasName(context.cardDefinitionForInstance(card),step.condition.cardName));if(!present)return 0;let charged=0;for(const card of context.player.damage){if(charged>=Number(step.count))break;if(card?.faceDown){card.faceDown=false;charged++}}return charged}
    }),
    "soul-charge": Object.freeze({
      validate(step, context) { return positiveInteger(step.count)&&Array.isArray(context.player?.deck)&&Array.isArray(context.player?.soul)&&context.player.deck.length>=Number(step.count); },
      apply(step, context) { const cards=[];for(let i=0;i<Number(step.count);i++)cards.push(context.player.deck.pop());context.player.soul.push(...cards);for(const card of cards)context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,previousLocation:"deck",currentLocation:"soul"});return cards.length; }
    }),
    "g-guardian-discard-charge-choice": Object.freeze({
      validate(step, context) {
        const player=context.player,source=context.source,targetUid=context.effectUid,choice=context.chargeChoice,drop=player?.drop||[],bound=player?.bind||[];
        if(step.target!=="controller"||!["counter-charge","soul-charge"].includes(choice)||!Array.isArray(player?.deck)||!Array.isArray(player?.damage)||!Array.isArray(player?.soul)||!Array.isArray(player?.bind))return false;
        const sourceInDrop=drop.some(card=>card?.uid===source?.uid),targetInDrop=drop.some(card=>card?.uid===targetUid&&card.uid!==source?.uid),sourceBound=bound.some(card=>card?.uid===source?.uid),targetBound=bound.some(card=>card?.uid===targetUid&&card.uid!==source?.uid);
        if(!(sourceInDrop&&targetInDrop)&&!(sourceBound&&targetBound))return false;
        const target=(sourceInDrop?drop:bound).find(card=>card?.uid===targetUid);
        if(!target||typeof context.cardDefinitionForInstance!=="function"||String(context.cardDefinitionForInstance(target)?.trigger||"").toLowerCase()!=="heal")return false;
        const ids=context.selectedDamageUids||[],faceDown=player.damage.filter(card=>card?.faceDown),needed=choice==="counter-charge"?Math.min(1,faceDown.length):0;
        return Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.length===needed&&ids.every(uid=>faceDown.some(card=>card.uid===uid));
      },
      apply(_step,context) {
        if(context.chargeChoice==="counter-charge"){const ids=new Set(context.selectedDamageUids||[]);for(const card of context.player.damage)if(ids.has(card.uid))card.faceDown=false;return ids.size}
        const card=context.player.deck.pop();if(!card)return 0;context.player.soul.push(card);context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"soul"});return 1;
      }
    }),
    "set-blazing": Object.freeze({validate(step,context){return step.target==="vanguard"&&context.turnSide===context.side&&Number(context.controllerRearGuards)>Number(context.opponentRearGuards)&&Boolean(context.player?.vanguard?.uid)},apply(step,context){context.player.vanguard.blazing=true;context.player.vanguard.blazingExpiry=context.player.playerId||context.side;return true}}),
    "set-hollowed": Object.freeze({validate(step,context){return step.target==="source"&&context.sourceInPlay===true&&/^(?:rear-|accel-)/i.test(String(context.sourceZone||""))&&Boolean(context.source?.uid)&&context.player?.playerId===context.sidePlayerId},apply(step,context){context.source.hollowed=true;context.source.hollowedExpiry=context.player.playerId;return true}}),
    "set-charging": Object.freeze({validate(step,context){return step.target==="source"&&context.sourceInPlay===true&&/^(?:rear-|accel-)/i.test(String(context.sourceZone||""))&&Boolean(context.source?.uid)&&context.player?.playerId===context.sidePlayerId},apply(step,context){context.source.charging=true;context.source.chargingExpiry=context.player.playerId;return true}}),
    "deck-to-damage": Object.freeze({
      validate(step, context) { return step.target === "controller" && positiveInteger(step.count) && Array.isArray(context?.player?.deck) && Array.isArray(context?.player?.damage); },
      apply(step, context) { const cards=[];for(let i=0;i<Number(step.count)&&context.player.deck.length;i++){const card=context.player.deck.pop();card.faceDown=false;context.player.damage.push(card);cards.push(card);}for(const card of cards)context.emitEvent?.({type:"card.damage_moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"damage"});return cards.length; }
    }),
    "schedule-damage-return-at-turn-end": Object.freeze({
      validate(step, context) { return step.target === "controller" && step.due === "end-phase-start" && Boolean(context.match) && typeof context.eventId === "string" && Boolean(context.eventId) && typeof context.sourceAbilityId === "string" && Boolean(context.source?.uid) && Boolean(context.player?.playerId); },
      apply(_step, context) { context.match.scheduledEffects ||= []; const id = `${context.eventId}:${context.source.uid}:${context.sourceAbilityId}`; if (context.match.scheduledEffects.some(item => item?.id === id)) return false; context.match.scheduledEffects.push({ id, kind: "return-chosen-damage-to-deck", sourceCardInstanceId: context.source.uid, sourceCardId: String(context.source.cardId), sourceOwnerPlayerId: context.source.ownerPlayerId || context.player.playerId, sourceAbilityId: context.sourceAbilityId, controllerPlayerId: context.player.playerId, turn: Number(context.turnId), status: "scheduled" }); return id; }
    }),
    "schedule-source-return-to-deck-at-turn-end": Object.freeze({
      validate(step, context) {
        const attack = context.match?.pendingAttack, source = context.source;
        return step.target === "source" && step.due === "end-phase-start" && step.shuffle === true && context.sourceInPlay === true &&
          /^(?:rear-(?:left|right|back-left|back-center|back-right)|accel-\d+)$/.test(String(context.sourceCircle || "")) &&
          Boolean(context.match) && typeof context.eventId === "string" && Boolean(context.eventId) && typeof context.sourceAbilityId === "string" &&
          Boolean(source?.uid && source.cardId && source.controllerPlayerId === context.actorPlayerId && context.player?.playerId === context.actorPlayerId) &&
          Boolean(attack?.battleId && attack.battleId === context.battleId && attack.boostUid === source.uid && attack.attackerSide === context.side);
      },
      apply(_step, context) {
        context.match.scheduledEffects ||= [];
        const id = `${context.eventId}:${context.source.uid}:${context.sourceAbilityId}`;
        const prior = context.match.scheduledEffects.find(item => item?.id === id);
        if (prior) return prior.kind === "return-boosting-source-to-deck" ? id : false;
        context.match.scheduledEffects.push({
          id, kind: "return-boosting-source-to-deck", sourceCardInstanceId: context.source.uid,
          sourceCardId: String(context.source.cardId), sourceOwnerPlayerId: context.source.ownerPlayerId || context.player.playerId,
          controllerPlayerId: context.player.playerId, sourceCircle: context.sourceCircle, sourceAbilityId: context.sourceAbilityId,
          battleId: context.battleId, turn: Number(context.turnId), status: "scheduled"
        });
        return id;
      }
    }),
    "return-chosen-damage-to-deck": Object.freeze({
      validate(step, context) { return step.target === "controller" && step.shuffle === true && typeof context.effectUid === "string" && Boolean(context.match?.players?.[context.side]?.damage?.some(card => card?.uid === context.effectUid)) && Array.isArray(context.player?.damage) && Array.isArray(context.player?.deck) && typeof context.shuffleDeck === "function"; },
      apply(_step, context) { const index = context.player.damage.findIndex(card => card?.uid === context.effectUid); if (index < 0) return false; const [card] = context.player.damage.splice(index, 1); context.player.deck.push(card); context.shuffleDeck(context.player.deck); context.emitEvent?.({ type: "card.moved", cardInstanceId: card.uid, controllerSide: context.side, previousLocation: "damage", currentLocation: "deck", reason: "delayed-damage-return" }); return card.uid; }
    }),
    "return-trigger-discard-to-hand": Object.freeze({
      validate(step,context) {
        const event=context.triggerEvent,source=context.source,player=context.player,uid=event?.subjectCardInstanceId||event?.cardInstanceId;
        const sourceInLegalZone=Boolean(source?.uid&&(player?.rear||[]).some(card=>card?.uid===source.uid)||(player?.drop||[]).some(card=>card?.uid===source?.uid));
        const sourceBound=Boolean(context.sourceBindCostPaid===true&&(player?.bind||[]).some(card=>card?.uid===source?.uid));
        return step.target==="event-discarded-card"&&Boolean(context.eventId)&&event?.eventId===context.eventId&&event?.type==="card.discarded"&&
          event.previousLocation==="hand"&&event.currentLocation==="drop"&&event.actingPlayerId===context.actorPlayerId&&event.turnPlayerId===context.actorPlayerId&&
          event.sourceControllerPlayerId===context.actorPlayerId&&event.subjectControllerPlayerId===context.actorPlayerId&&event.sourceOwnerPlayerId===context.actorPlayerId&&event.subjectOwnerPlayerId===context.actorPlayerId&&
          typeof uid==="string"&&uid!==source?.uid&&context.effectUid===uid&&Array.isArray(player?.drop)&&player.drop.some(card=>card?.uid===uid&&card?.ownerPlayerId===context.actorPlayerId&&card?.controllerPlayerId===context.actorPlayerId)&&
          Boolean(sourceBound||(!context.sourceBindCostPaid&&sourceInLegalZone&&context.source?.controllerPlayerId===context.actorPlayerId&&context.source?.ownerPlayerId===context.actorPlayerId));
      },
      apply(_step,context) {
        if(context.sourceBindCostPaid!==true)return false;
        const uid=context.triggerEvent?.subjectCardInstanceId||context.triggerEvent?.cardInstanceId,index=context.player.drop.findIndex(card=>card?.uid===uid);
        if(index<0)return false;const [card]=context.player.drop.splice(index,1);context.player.hand.push(card);
        context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:"hand",reason:"discard-trigger-return"});return card.uid;
      }
    }),
    "modify-shield-source": Object.freeze({
      validate(step,context) { const attack=context.match?.pendingAttack;return step.target==="source"&&step.duration==="battle"&&positiveInteger(step.amount)&&context.player?.guardCircle?.some(card=>card?.uid===context.source?.uid)&&attack?.defenderSide===context.side&&attack?.battleId===context.battleId&&Array.isArray(attack.guardCards)&&attack.guardCards.some(card=>card?.uid===context.source.uid); },
      apply(step,context) { const attack=context.match.pendingAttack;context.source.battleShieldBoost=Number(context.source.battleShieldBoost||0)+Number(step.amount);context.source.battleShieldExpiryBattleId=attack.battleId;attack.targetPower+=Number(step.amount);return true; }
    }),
    "call-top-to-guardian": Object.freeze({
      validate(step, context) { const attack=context.match?.pendingAttack;if(step.target!=="controller"||step.destination!=="guardian"||step.position!=="rest"||!Number.isInteger(Number(step.count))||Number(step.count)<1||Number(step.count)>10||!Array.isArray(context.player?.deck)||!Array.isArray(context.player?.guardCircle)||!Array.isArray(attack?.guardCards)||attack.defenderSide!==context.side||context.match?.players?.[context.side]!==context.player||typeof context.shieldValueForInstance!=="function"||typeof context.cardDefinitionForInstance!=="function")return false;const cards=context.player.deck.slice(-Math.min(Number(step.count),context.player.deck.length));return cards.every(card=>{const definition=context.cardDefinitionForInstance(card),shield=context.shieldValueForInstance(card);return Boolean(definition)&&/\bunit\b/i.test(String(definition.type||""))&&Number.isFinite(Number(definition.shield))&&Number.isFinite(Number(shield))}); },
      apply(step, context) { const attack=context.match.pendingAttack,cards=context.player.deck.splice(-Math.min(Number(step.count),context.player.deck.length)).reverse();for(const card of cards){card.zone="guardian";card.circle="guardian";card.position="rest";card.rested=true;card.faceUp=true;context.player.guardCircle.push(card);attack.guardCards.push(card);attack.targetPower+=Number(context.shieldValueForInstance(card)||0);context.emitEvent?.({type:"card.placed",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"guardian",position:"rest"});}return cards.length; }
    }),
    "call-filtered-top-to-guardian-drop": Object.freeze({
      validate(step,context){const attack=context.match?.pendingAttack;if(step.target!=="controller"||step.count!==5||step.destination!=="guardian"||step.position!=="rest"||step.remainder!=="drop"||typeof step.filter?.clan!=="string"||!step.filter.clan.trim()||!Array.isArray(context.player?.deck)||!Array.isArray(context.player?.guardCircle)||!Array.isArray(context.player?.drop)||!Array.isArray(attack?.guardCards)||attack.defenderSide!==context.side||context.match?.players?.[context.side]!==context.player||typeof context.shieldValueForInstance!=="function"||typeof context.cardDefinitionForInstance!=="function")return false;const cards=context.player.deck.slice(-Math.min(5,context.player.deck.length));return cards.filter(card=>{const def=context.cardDefinitionForInstance(card),clans=[def?.clan,...(def?.clans||[])].filter(Boolean).map(value=>String(value).toLocaleLowerCase());return clans.includes(step.filter.clan.toLocaleLowerCase())}).every(card=>{const def=context.cardDefinitionForInstance(card),shield=context.shieldValueForInstance(card);return Boolean(def&&/\bunit\b/i.test(String(def.type||""))&&Number.isFinite(Number(def.shield))&&Number.isFinite(Number(shield)))});},
      apply(step,context){const attack=context.match.pendingAttack,cards=context.player.deck.splice(-Math.min(5,context.player.deck.length)).reverse();for(const card of cards){const def=context.cardDefinitionForInstance(card),clans=[def?.clan,...(def?.clans||[])].filter(Boolean).map(value=>String(value).toLocaleLowerCase()),matches=clans.includes(step.filter.clan.toLocaleLowerCase());if(matches){card.zone="guardian";card.circle="guardian";card.position="rest";card.rested=true;card.faceUp=true;context.player.guardCircle.push(card);attack.guardCards.push(card);attack.targetPower+=Number(context.shieldValueForInstance(card)||0);context.emitEvent?.({type:"card.placed",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"guardian",position:"rest"})}else{context.player.drop.push(card);context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"drop",reason:"guardian-clan-reveal"})}}return cards.length}
    }),
    "reorder-deck-card": Object.freeze({
      validate(step, context) { return step.target === "chosen" && step.destination === "player-choice" && Boolean(context.selectedCard) && context.player?.deck?.some(card => card.uid === context.selectedCard.uid) && ["top", "bottom"].includes(context.deckDestination); },
      apply(_step, context) { const index=context.player.deck.findIndex(card=>card.uid===context.selectedCard.uid);if(index<0)return false;const [card]=context.player.deck.splice(index,1);if(context.deckDestination==="top")context.player.deck.push(card);else context.player.deck.unshift(card);context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,previousLocation:"deck",currentLocation:"deck"});return true; }
    }),
    "call-checked-card-locked": Object.freeze({
      validate(step, context) {
        const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:context.player?.accelZones||0},(_,i)=>`accel-${i+1}`)];
        const hasUsableCircle=zones.some((_,i)=>context.player?.rear?.[i]?.locked!==true);
        const card=context.checkedCard;
        if(step.target!=="checked-card"||step.position!=="locked"||!card?.uid||card.uid!==context.checkedCardInstanceId||!Array.isArray(context.player?.hand)||!Array.isArray(context.player?.rear)||!Array.isArray(context.player?.drop)||!context.player.hand.some(item=>item?.uid===card.uid))return false;
        if(!hasUsableCircle)return true;
        const index=zones.indexOf(context.callZone);
        return index>=0&&index<context.player.rear.length&&context.player.rear[index]?.locked!==true;
      },
      apply(_step, context) {
        const player=context.player,card=context.checkedCard;
        const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)];
        if(!zones.some((_,i)=>player.rear[i]?.locked!==true))return 0;
        const index=zones.indexOf(context.callZone),handIndex=player.hand.findIndex(item=>item?.uid===card.uid);
        if(index<0||index>=player.rear.length||player.rear[index]?.locked===true||handIndex<0)return false;
        player.hand.splice(handIndex,1);
        const displaced=player.rear[index];
        if(displaced){player.rear[index]=null;player.drop.push(displaced);context.emitEvent?.({type:"card.retired",cardInstanceId:displaced.uid,controllerSide:context.side,previousLocation:context.callZone,currentLocation:"drop"});}
        player.rear[index]={...card,rested:false,locked:true,zone:"rear-guard",circle:context.callZone};
        context.emitEvent?.({type:"card.placed",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:context.callZone,position:"locked"});
        return true;
      }
    }),
    "call-source-from-drop-rested": Object.freeze({
      validate(step,context){
        const player=context.player,zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player?.accelZones||0},(_,i)=>`accel-${i+1}`)],source=context.source,definition=source&&context.cardDefinitionForInstance?.(source);
        if(step.target!=="source"||step.position!=="rest"||!source?.uid||!Array.isArray(player?.drop)||!Array.isArray(player?.rear)||!player.drop.some(card=>card?.uid===source.uid)||!definition||!/\b(?:unit|trigger)\b/i.test(String(definition.type||"")))return false;
        if(!zones.some((_,i)=>player.rear[i]?.locked!==true))return true;
        const index=zones.indexOf(context.callZone);return index>=0&&index<player.rear.length&&player.rear[index]?.locked!==true;
      },
      apply(_step,context){
        const player=context.player,source=context.source,zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)];
        if(!zones.some((_,i)=>player.rear[i]?.locked!==true))return 0;
        const index=zones.indexOf(context.callZone),dropIndex=player.drop.findIndex(card=>card?.uid===source.uid);if(index<0||index>=player.rear.length||player.rear[index]?.locked===true||dropIndex<0)return false;
        player.drop.splice(dropIndex,1);const displaced=player.rear[index];if(displaced){player.rear[index]=null;player.drop.push(displaced);context.emitEvent?.({type:"card.retired",cardInstanceId:displaced.uid,controllerSide:context.side,previousLocation:context.callZone,currentLocation:"drop"})}
        const called={...source,rested:true,locked:false,zone:"rear-guard",circle:context.callZone};if(_step.cannotAttackTurnKeyWhenBattlePhase===true&&Number(context.match?.phase)===5)called.cannotAttackTurnKey=context.turnKey;player.rear[index]=called;context.emitEvent?.({type:"card.placed",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:context.callZone,position:"rest"});return true;
      }
    }),
    "call-source-from-soul": Object.freeze({
      validate(step,context){const player=context.player,zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player?.accelZones||0},(_,i)=>`accel-${i+1}`)],source=context.source,definition=source&&context.cardDefinitionForInstance?.(source),index=zones.indexOf(context.callZone);return step.target==="source"&&step.position==="stand"&&Boolean(source?.uid)&&Array.isArray(player?.soul)&&Array.isArray(player?.rear)&&player.soul.some(card=>card?.uid===source.uid)&&Boolean(definition)&&/\b(?:unit|trigger)\b/i.test(String(definition.type||""))&&index>=0&&index<player.rear.length&&player.rear[index]?.locked!==true&&!player.rear[index]},
      apply(_step,context){const player=context.player,source=context.source,zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)],index=zones.indexOf(context.callZone),soulIndex=player.soul.findIndex(card=>card?.uid===source.uid);if(index<0||index>=player.rear.length||player.rear[index]?.locked===true||player.rear[index]||soulIndex<0)return false;player.soul.splice(soulIndex,1);player.rear[index]={...source,rested:false,locked:false,zone:"rear-guard",circle:context.callZone};context.emitEvent?.({type:"card.placed",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:"soul",currentLocation:context.callZone,position:"stand"});return true}
    }),
    "ride-revoldress-source-from-soul-rested": Object.freeze({
      validate(step, context) {
        const player=context.player, source=context.source, uid=context.effectUid;
        const target=(player?.soul||[]).find(card=>card?.uid===uid);
        const definition=target&&context.cardDefinitionForInstance?.(target);
        return step.target==="controller"&&step.rested===true&&Boolean(target&&source?.uid)&&
          player?.vanguard?.uid===source.uid&&Array.isArray(player.soul)&&Array.isArray(player.deck)&&
          typeof context.cardDefinitionForInstance==="function"&&definition?.hasRevolDress===true&&
          /\bunit\b/i.test(String(definition?.type||""))&&target.cannotBeRidden!==true&&
          (typeof context.canRideCard!=="function"||context.canRideCard(target,player.vanguard));
      },
      apply(_step,context) {
        const player=context.player, source=context.source, index=player.soul.findIndex(card=>card?.uid===context.effectUid);
        if(index<0||player.vanguard?.uid!==source.uid)return false;
        const rider=player.soul.splice(index,1)[0], previous=player.vanguard, riderDefinition=context.cardDefinitionForInstance?.(rider)||{};
        previous.zone="soul";previous.circle=null;delete previous.position;
        player.soul.push(previous);
        player.vanguard={...rider,controllerPlayerId:player.playerId||context.actorPlayerId,rested:true,zone:"vanguard",circle:"vanguard"};
        if(Number(rider.grade)>=3)context.recordFightRide?.(player,{grade:Number(rider.grade)});
        context.emitEvent?.({type:"card.moved",cardInstanceId:previous.uid,previousLocation:"vanguard",currentLocation:"soul",reason:"revoldress-ride"});
        context.emitEvent?.({type:"card.ridden",cardInstanceId:rider.uid,subjectCardInstanceId:rider.uid,sourceCardName:riderDefinition.name||rider.cardName||null,sourceCardGrade:Number(riderDefinition.grade??rider.grade??-1),sourceCardClan:riderDefinition.clan||null,sourceCardClans:riderDefinition.clans||[],sourceCardText:riderDefinition.text||"",targetCardInstanceIds:[previous.uid],previousLocation:"soul",currentLocation:"vanguard",targetPreviousLocation:"vanguard",targetCurrentLocation:"soul",targetLocation:"vanguard",reason:"revoldress-ride"});
        context.emitEvent?.({type:"card.placed",cardInstanceId:rider.uid,subjectCardInstanceId:rider.uid,previousLocation:"soul",currentLocation:"vanguard",circle:"vanguard",position:"rest",reason:"revoldress-ride"});
        return true;
      }
    }),
    "call-checked-card-locked": Object.freeze({
      validate(step, context) {
        const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:context.player?.accelZones||0},(_,i)=>`accel-${i+1}`)];
        const checked=context.checkedCard, index=zones.indexOf(context.callZone), hasOpenCircle=zones.some((_,i)=>!context.player?.rear?.[i]||context.player.rear[i]?.locked!==true);
        const inHand=Array.isArray(context.player?.hand)&&context.player.hand.some(card=>card?.uid===checked?.uid);
        const inPendingCheck=Boolean(context.checkedCardInTrigger===true&&context.match?.pendingCheckCard?.uid===checked?.uid&&context.match?.pendingCheckCard?.side===context.side&&context.player?.triggerZone?.some(card=>card?.uid===checked?.uid));
        if(step.target!=="checked-card"||step.position!=="locked"||!checked?.uid||checked.uid!==context.checkedCardInstanceId||!Array.isArray(context.player?.rear)||(!inHand&&!inPendingCheck))return false;
        if(!hasOpenCircle)return true;
        return index>=0&&index<context.player.rear.length&&context.player.rear[index]?.locked!==true;
      },
      apply(step, context) {
        const player=context.player,checked=context.checkedCard;
        if(!player.rear.some((_,i)=>i<(5+(player.accelZones||0))&&(!player.rear[i]||player.rear[i]?.locked!==true)))return 0;
        const zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:player.accelZones||0},(_,i)=>`accel-${i+1}`)],index=zones.indexOf(context.callZone);
        if(index<0||index>=player.rear.length||player.rear[index]?.locked===true)return false;
        const triggerIndex=context.checkedCardInTrigger===true?player.triggerZone?.findIndex(card=>card?.uid===checked.uid)??-1:-1;
        const handIndex=player.hand.findIndex(card=>card?.uid===checked.uid);
        if(triggerIndex>=0){player.triggerZone.splice(triggerIndex,1);if(context.match?.pendingCheckCard?.uid===checked.uid)context.match.pendingCheckCard=null}
        else {if(handIndex<0)return false;player.hand.splice(handIndex,1)}
        const displaced=player.rear[index];if(displaced){player.rear[index]=null;player.drop.push(displaced);context.emitEvent?.({type:"card.retired",cardInstanceId:displaced.uid,controllerSide:context.side,previousLocation:context.callZone,currentLocation:"drop"});}
        player.rear[index]={...checked,rested:false,locked:true,zone:"rear-guard",circle:context.callZone};
        context.emitEvent?.({type:"card.placed",cardInstanceId:checked.uid,controllerSide:context.side,previousLocation:triggerIndex>=0?"trigger":"hand",currentLocation:context.callZone,position:"locked"});
        return true;
      }
    }),
    "revelation-choice": Object.freeze({
      validate(step,context){return step.target==="controller"&&["soul","keep-top"].includes(context.effectChoice)&&Array.isArray(context.player?.deck)&&Array.isArray(context.player?.soul)&&(context.player.deck.at(-1)?.uid??null)===(context.revelationTopUid??null)&&(context.effectChoice!=="soul"||context.player.deck.length>0);},
      apply(_step,context){if(context.effectChoice!=="soul")return true;const card=context.player.deck.pop();if(!card)return false;context.player.soul.push(card);context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"soul",reason:"revelation"});return true;}
    }),
    "rest-target": Object.freeze({
      validate(step,context){if(step.target!=="chosen"||step.targetFilter?.controller!=="source-controller"||step.targetFilter?.zone!=="rear-guard")return false;if(context.effectChoice!=="soul")return true;if(context.noLegalTarget===true&&!context.target)return step.noOpIfNoLegalTargets===true;return Boolean(context.target&&context.target.rested!==true&&context.targetInPlay&&matchesTargetFilter(step.targetFilter,context)&&Array.isArray(context.targetPlayer?.rear)&&context.targetPlayer.rear.some(card=>card?.uid===context.target.uid));},
      apply(_step,context){if(context.effectChoice!=="soul"||context.noLegalTarget===true&&!context.target)return true;if(!context.target||context.target.rested)return false;context.target.rested=true;context.emitEvent?.({type:"unit.rested",cardInstanceId:context.target.uid,controllerSide:context.targetSide,zone:context.targetZone});return true;}
    }),
    "engorge": Object.freeze({
      validate(step,context){const ids=context.engorgeTargetUids,player=context.player,attack=context.match?.pendingAttack;if(step.target!=="source"||!context.source?.uid||context.sourceInPlay!==true||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||!Array.isArray(player?.rear)||!attack||attack.attackerUid!==context.source.uid||attack.attackerSide!==context.side)return false;return ids.every(uid=>uid!==context.source.uid&&player.rear.some(card=>card?.uid===uid));},
      apply(_step,context){const player=context.player,ids=new Set(context.engorgeTargetUids),turnOwner=player.playerId||context.side;let retired=0;for(let index=0;index<player.rear.length;index++){const card=player.rear[index];if(!card||!ids.has(card.uid))continue;player.rear[index]=null;player.drop.push(card);retired++;context.emitEvent?.({type:"card.retired",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:context.engorgeTargetZones?.[card.uid]||`rear-${index}`,currentLocation:"drop",reason:"engorge",abilitySourceInstanceId:context.source.uid});}if(!retired)return false;context.source.engorged=true;context.source.engorgedExpiry=turnOwner;context.source.engorgeRetiredCount=Number(context.source.engorgeRetiredCount||0)+retired;context.source.engorgeRetiredCountExpiry=turnOwner;context.emitEvent?.({type:"unit.became_engorged",cardInstanceId:context.source.uid,controllerSide:context.side,retiredCount:retired,totalRetiredCount:context.source.engorgeRetiredCount});return true;}
    }),
    "stand-target": Object.freeze({
      validate(step, context) { if(context.noLegalTarget===true&&!context.target)return step.target==="chosen"&&step.noOpIfNoLegalTargets===true;return step.target === "chosen" && Boolean(context.target && context.targetInPlay && (context.target.rested === true || step.allowAlreadyStanding === true)) && matchesTargetFilter(step.targetFilter || {}, context); },
      apply(step, context) { if(context.noLegalTarget===true&&!context.target)return true;if(!context.target)return false;if(context.target.rested!==true)return step.allowAlreadyStanding===true;context.target.rested=false;context.emitEvent?.({type:"unit.stood",cardInstanceId:context.target.uid,controllerSide:context.targetSide,zone:context.targetZone});return true; }
    }),
    "unlock-target": Object.freeze({
      validate(step,context){const player=context.targetPlayer,uid=context.target?.uid;return step.target==="chosen"&&Boolean(uid&&context.targetInPlay&&context.target?.locked===true&&matchesTargetFilter(step.targetFilter||{},context))&&Boolean(player?.vanguard?.uid===uid||(player?.rear||[]).some(card=>card?.uid===uid));},
      apply(_step,context){if(context.target?.locked!==true)return false;context.target.locked=false;context.emitEvent?.({type:"unit.unlocked",cardInstanceId:context.target.uid,controllerSide:context.targetSide,zone:context.targetZone});return true;}
    }),
    "retire-target": Object.freeze({
      validate(step, context) { return step.target === "chosen" && step.targetFilter?.controller === "opponent" && step.targetFilter?.zone === "rear-guard" && Boolean(context.target && context.targetSide && context.targetInPlay) && matchesTargetFilter(step.targetFilter, context) && Array.isArray(context.targetPlayer?.rear) && context.targetPlayer.rear.some(card => card?.uid === context.target.uid); },
      apply(_step, context) { const player=context.targetPlayer,index=player.rear.findIndex(card=>card?.uid===context.target.uid);if(index<0)return false;const [card]=player.rear.splice(index,1,null);player.drop.push(card);context.emitEvent?.({type:"card.retired",cardInstanceId:card.uid,controllerSide:context.targetSide,previousLocation:context.targetZone,currentLocation:"drop"});return true; }
    }),    "protect-target": Object.freeze({
      validate(step, context) { return step.target === "chosen" && step.duration === "battle" && Boolean(context.target && context.targetInPlay && context.match?.pendingAttack) && (!step.requiresAttackedTarget || context.match.pendingAttack.targetUid===context.target.uid) && matchesTargetFilter(step.targetFilter || {}, context); },
      apply(_step, context) { if(_step.requiresAttackedTarget&&context.match.pendingAttack.targetUid!==context.target.uid)return false;if(context.match.pendingAttack.targetUid!==context.target.uid)return true;context.match.pendingAttack.perfectGuard=true;context.match.pendingAttack.blocked=true;return true; }
    }),    "protect-attacked-source": Object.freeze({
      validate(step, context) { const attack=context?.match?.pendingAttack;return step.target === "source" && step.duration === "battle" && Boolean(context.source?.uid && attack && attack.targetUid === context.source.uid && !attack.boostUid); },
      apply(_step, context) { context.match.pendingAttack.perfectGuard=true;context.match.pendingAttack.blocked=true;return true; }
    }),    "move-filtered-hand-card-to-soul": Object.freeze({
      validate(step,context){const player=context.player,filter=step.filter;if(step.target!=="controller"||step.maximum!==1||!filter||Object.keys(filter).length!==1||typeof filter.clan!=="string"||!filter.clan.trim()||!Array.isArray(player?.hand)||!Array.isArray(player?.soul)||typeof context.cardDefinitionForInstance!=="function")return false;if(!context.effectUid)return true;const card=player.hand.find(item=>item?.uid===context.effectUid);return Boolean(card&&matchesTargetFilter(filter,{targetCard:context.cardDefinitionForInstance(card)}));},
      apply(_step,context){if(!context.effectUid)return true;const index=context.player.hand.findIndex(card=>card?.uid===context.effectUid);if(index<0)return false;const [card]=context.player.hand.splice(index,1);context.player.soul.push(card);context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"soul",reason:"ability"});return true;}
    }), "move-source-to-soul": Object.freeze({
      validate(step, context) { return step.target === "source" && step.from === "drop" && Boolean(context?.source?.uid && context.player?.drop?.some(card=>card?.uid===context.source.uid) && Array.isArray(context.player.soul)); },
      apply(_step, context) { const index=context.player.drop.findIndex(card=>card?.uid===context.source.uid);if(index<0)return false;const [card]=context.player.drop.splice(index,1);context.player.soul.push(card);context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:"soul"});return true; }
    }), "move-source-to-hand": Object.freeze({
      validate(step,context){return step.target==="source"&&step.from==="rear-guard"&&context.sourceInPlay===true&&context.sourceZone!=="vanguard"&&Boolean(context.source?.uid)&&Array.isArray(context.player?.rear)&&Array.isArray(context.player?.hand)&&context.player.rear.some(card=>card?.uid===context.source.uid);},
      apply(_step,context){const index=context.player.rear.findIndex(card=>card?.uid===context.source.uid);if(index<0)return false;const [card]=context.player.rear.splice(index,1,null);context.player.hand.push(card);const playerId=context.player.playerId||context.sidePlayerId||null,circle=context.sourceCircle||context.sourceZone,ownerPlayerId=card.ownerPlayerId||playerId,controllerPlayerId=card.controllerPlayerId||playerId;context.emitEvent?.({type:"card.moved",actingPlayerId:playerId,turnPlayerId:context.match?.players?.[context.match?.side]?.playerId||null,sourceCardInstanceId:card.uid,sourceOwnerPlayerId:ownerPlayerId,sourceControllerPlayerId:controllerPlayerId,cardInstanceId:card.uid,subjectCardInstanceId:card.uid,subjectOwnerPlayerId:ownerPlayerId,subjectControllerPlayerId:controllerPlayerId,controllerSide:context.side,previousLocation:context.sourceZone,currentLocation:"hand",circle,phase:context.phase,timingWindow:"effect-return-to-hand"});return true;}
    }),    "modify-defending-source-power": Object.freeze({
      validate(step, context) { const attack=context?.match?.pendingAttack;return step.target === "source" && step.duration === "battle" && positiveInteger(step.amount) && Boolean(context.source?.uid && attack && attack.targetUid === context.source.uid); },
      apply(step, context) { context.match.pendingAttack.targetPower=Number(context.match.pendingAttack.targetPower||0)+Number(step.amount);return true; }
    }),    "rest-source": Object.freeze({
      validate(step, context) { return step.target === "source"&&context.sourceInPlay===true&&Boolean(context.source)&&!context.source.rested; },
      apply(step, context) { context.source.rested=true;return true; }
    }),
    "stand-source": Object.freeze({
      validate(step, context) { return step.target === "source"&&context.sourceInPlay===true&&Boolean(context.source); },
      apply(step, context) { if(!context.source.rested)return true;context.source.rested=false;context.emitEvent?.({type:"unit.stood",cardInstanceId:context.source.uid,controllerSide:context.source.controllerPlayerId||context.player?.playerId||context.side,zone:context.sourceZone});return true; }
    }),
    "draw-then-discard": Object.freeze({
      validate(step,context){const hand=context.player?.hand,deck=context.player?.deck,drop=context.player?.drop;if(step.target!=="controller"||step.drawCount!==1||step.discardCount!==1||!Array.isArray(hand)||!Array.isArray(deck)||!Array.isArray(drop)||!deck.length||typeof context.effectDiscardUid!=="string")return false;return hand.some(card=>card?.uid===context.effectDiscardUid)||deck.at(-1)?.uid===context.effectDiscardUid;},
      apply(_step,context){const drawn=context.player.deck.pop();if(!drawn)return false;context.player.hand.push(drawn);context.emitEvent?.({type:"card.drawn",cardInstanceId:drawn.uid});const index=context.player.hand.findIndex(card=>card?.uid===context.effectDiscardUid);if(index<0)return false;const [discarded]=context.player.hand.splice(index,1);context.player.drop.push(discarded);context.emitEvent?.({type:"card.discarded",cardInstanceId:discarded.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"drop"});return{drawn:drawn.uid,discarded:discarded.uid};}
    }),
    "search-top-grade-three-to-hand-then-discard": Object.freeze({
      validate(step,context){const p=context.player,deck=p?.deck,hand=p?.hand;if(step.target!=="controller"||step.lookCount!==5||step.minGrade!==3||step.discardCount!==1||!Array.isArray(deck)||!Array.isArray(hand)||!Array.isArray(p?.drop)||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const top=deck.slice(-Math.min(step.lookCount,deck.length)),chosen=top.find(card=>card?.uid===context.effectUid);if(context.effectUid&&(!chosen||Number(context.cardDefinitionForInstance(chosen)?.grade)<step.minGrade))return false;if(chosen){const discard=hand.find(card=>card?.uid===context.effectDiscardUid)||chosen;if(!context.effectDiscardUid||discard.uid!==chosen.uid&&!hand.some(card=>card?.uid===context.effectDiscardUid))return false;}else if(context.effectDiscardUid)return false;return true;},
      apply(step,context){const deck=context.player.deck,topCount=Math.min(step.lookCount,deck.length),top=deck.splice(deck.length-topCount,topCount),chosen=top.find(card=>card.uid===context.effectUid)||null;if(chosen){context.player.hand.push(chosen);const revealed=context.cardDefinitionForInstance?.(chosen)||{};context.emitEvent?.({type:"card.revealed",cardInstanceId:chosen.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"hand",reason:"search",revealedCardId:String(chosen.cardId||""),revealedCardName:revealed.name||chosen.cardName||chosen.name||null,revealedCardGrade:Number.isInteger(Number(revealed.grade))?Number(revealed.grade):null});}deck.push(...top.filter(card=>card.uid!==chosen?.uid));context.shuffleDeck(deck);let discardedUid=null;if(chosen){const index=context.player.hand.findIndex(card=>card.uid===context.effectDiscardUid);if(index<0)return false;const [discarded]=context.player.hand.splice(index,1);context.player.drop.push(discarded);discardedUid=discarded.uid;context.emitEvent?.({type:"card.discarded",cardInstanceId:discarded.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"drop"});}return{revealedCardId:chosen?.cardId||null,revealedCardUid:chosen?.uid||null,discardedUid,lookedCount:topCount};}
    }),
    "search-top-up-to-one-grade-to-hand": Object.freeze({
      validate(step,context){const p=context.player,deck=p?.deck;if(step.target!=="controller"||!positiveInteger(step.lookCount)||!Number.isInteger(Number(step.maximumGrade))||Number(step.maximumGrade)<0||!Array.isArray(deck)||!Array.isArray(p.hand)||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const top=deck.slice(-Math.min(step.lookCount,deck.length)),chosen=top.find(card=>card?.uid===context.effectUid);return !context.effectUid||Boolean(chosen&&Number(context.cardDefinitionForInstance(chosen)?.grade)<=Number(step.maximumGrade));},
      apply(step,context){const deck=context.player.deck,looked=deck.splice(deck.length-Math.min(step.lookCount,deck.length)),chosen=looked.find(card=>card.uid===context.effectUid)||null;if(chosen){context.player.hand.push(chosen);const revealed=context.cardDefinitionForInstance?.(chosen)||{};context.emitEvent?.({type:"card.revealed",cardInstanceId:chosen.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"hand",reason:"search",revealedCardId:String(chosen.cardId||""),revealedCardName:revealed.name||chosen.cardName||chosen.name||null,revealedCardGrade:Number.isInteger(Number(revealed.grade))?Number(revealed.grade):null});}deck.push(...looked.filter(card=>card.uid!==chosen?.uid));context.shuffleDeck(deck);return{revealedCardId:chosen?.cardId||null,revealedCardUid:chosen?.uid||null,lookedCount:looked.length};}
    }),
    "search-top-up-to-one-filtered-to-hand": Object.freeze({
      validate(step,context){const p=context.player,deck=p?.deck,filter=step.filter;if(step.target!=="controller"||!positiveInteger(step.lookCount)||step.maximum!==1||!filter||typeof filter!=="object"||!Array.isArray(deck)||!Array.isArray(p.hand)||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const top=deck.slice(-Math.min(step.lookCount,deck.length)),chosen=top.find(card=>card?.uid===context.effectUid);return !context.effectUid||Boolean(chosen&&matchesTargetFilter(filter,{targetCard:context.cardDefinitionForInstance(chosen)}));},
      apply(step,context){const deck=context.player.deck,looked=deck.splice(deck.length-Math.min(step.lookCount,deck.length)),chosen=looked.find(card=>card.uid===context.effectUid)||null;if(chosen){context.player.hand.push(chosen);const revealed=context.cardDefinitionForInstance?.(chosen)||{};context.emitEvent?.({type:"card.revealed",cardInstanceId:chosen.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"hand",reason:"search",revealedCardId:String(chosen.cardId||""),revealedCardName:revealed.name||chosen.cardName||chosen.name||null,revealedCardGrade:Number.isInteger(Number(revealed.grade))?Number(revealed.grade):null});}deck.push(...looked.filter(card=>card.uid!==chosen?.uid));context.shuffleDeck(deck);return{revealedCardId:chosen?.cardId||null,revealedCardUid:chosen?.uid||null,lookedCount:looked.length};}
    }),
    "search-deck-same-name-to-hand": Object.freeze({
      validate(step,context){const player=context.player,source=context.source,deck=player?.deck;if(step.target!=="controller"||step.maximum!==1||(!source&&!step.cardName)||!Array.isArray(deck)||!Array.isArray(player.hand)||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const selected=deck.find(card=>card?.uid===context.effectUid);if(!context.effectUid)return true;if(!selected)return false;const selectedCard=context.cardDefinitionForInstance(selected);return Boolean(step.cardName?cardHasName(selectedCard,step.cardName):cardsShareName(context.cardDefinitionForInstance(source),selectedCard));},
      apply(_step,context){const deck=context.player.deck;let chosen=null;if(context.effectUid){const index=deck.findIndex(card=>card?.uid===context.effectUid);if(index<0)return false;[chosen]=deck.splice(index,1);context.player.hand.push(chosen);context.emitEvent?.({type:"card.revealed",cardInstanceId:chosen.uid,controllerSide:context.side,reason:"search"});}context.shuffleDeck(deck);return{revealedCardId:chosen?.cardId||null,revealedCardUid:chosen?.uid||null};}
    }),
    "search-deck-or-drop-named-to-hand": Object.freeze({
      validate(step,context){const p=context.player,zone=context.effectSourceZone,list=zone==="deck"?p?.deck:zone==="drop"?p?.drop:null;if(step.target!=="controller"||step.maximum!==1||typeof step.cardName!=="string"||!step.cardName.trim()||step.reveal!==true||step.shuffleIfDeckSearched!==true||!Array.isArray(list)||!Array.isArray(p?.hand)||typeof context.cardDefinitionForInstance!=="function"||zone==="deck"&&typeof context.shuffleDeck!=="function")return false;if(!context.effectUid)return true;const selected=list.find(card=>card?.uid===context.effectUid);return Boolean(selected&&cardHasName(context.cardDefinitionForInstance(selected),step.cardName));},
      apply(step,context){const p=context.player,zone=context.effectSourceZone,list=zone==="deck"?p.deck:p.drop;let chosen=null;if(context.effectUid){const index=list.findIndex(card=>card?.uid===context.effectUid);if(index<0)return false;[chosen]=list.splice(index,1);p.hand.push(chosen);const definition=context.cardDefinitionForInstance?.(chosen)||{};context.emitEvent?.({type:"card.revealed",cardInstanceId:chosen.uid,controllerSide:context.side,previousLocation:zone,currentLocation:"hand",reason:"search",revealedCardId:String(chosen.cardId||""),revealedCardName:definition.name||null});context.emitEvent?.({type:"card.moved",cardInstanceId:chosen.uid,controllerSide:context.side,previousLocation:zone,currentLocation:"hand",reason:"search"});}if(zone==="deck")context.shuffleDeck(p.deck);return{searchedZone:zone,revealedCardId:chosen?.cardId||null,revealedCardUid:chosen?.uid||null};}
    }),
    "ride-top-five-named-card": Object.freeze({
      validate(step,context){const p=context.player,m=context.match,source=context.source,deck=p?.deck;if(step.target!=="controller"||step.lookCount!==5||typeof step.cardName!=="string"||!step.cardName.trim()||step.bottomOrder!=="chosen-rest"||!Array.isArray(deck)||!Array.isArray(p?.soul)||!source?.uid||p.vanguard?.uid!==source.uid||context.sourceZone!=="vanguard"||context.sourceInPlay!==true||m?.side!==context.side||Number(m.phase)!==2||!Array.isArray(context.deckBottomUids)||typeof context.cardDefinitionForInstance!=="function")return false;const looked=deck.slice(-Math.min(step.lookCount,deck.length)),selected=context.effectUid?looked.find(card=>card?.uid===context.effectUid):null;if(context.effectUid&&!selected)return false;if(selected){const definition=context.cardDefinitionForInstance(selected)||{},oldDefinition=context.cardDefinitionForInstance(source)||{},grade=Number(definition.grade),oldGrade=Number(oldDefinition.grade);if(!/unit/i.test(String(definition.type||""))||definition.gDeckCard===true||selected.gDeckCard===true||selected.cannotBeRidden===true||!Number.isInteger(grade)||!Number.isInteger(oldGrade)||grade<oldGrade||grade>oldGrade+1||!cardHasName(definition,step.cardName)||!canRideCard(definition,{vanguardCard:oldDefinition,crests:p.crests||[]}))return false;const sameNameRestricted=(p.crests||[]).some(card=>card?.sameNameRideRestriction===true);if(sameNameRestricted&&(!cardsShareName(definition,oldDefinition)))return false;}const remaining=looked.filter(card=>card?.uid!==selected?.uid),order=context.deckBottomUids;if(order.length!==remaining.length||new Set(order).size!==order.length||order.some(uid=>!remaining.some(card=>card?.uid===uid)))return false;return true;},
      apply(step,context){const p=context.player,deck=p.deck,looked=deck.slice(-Math.min(step.lookCount,deck.length)),selected=context.effectUid?looked.find(card=>card?.uid===context.effectUid):null,remaining=looked.filter(card=>card?.uid!==selected?.uid),order=context.deckBottomUids;if(order.length!==remaining.length||new Set(order).size!==order.length||order.some(uid=>!remaining.some(card=>card?.uid===uid)))return false;deck.splice(deck.length-looked.length,looked.length);if(selected){const previous=p.vanguard,grade=Number(context.cardDefinitionForInstance(selected)?.grade);if(grade>=3)recordFightRide(p,{grade});p.soul.push(previous);p.vanguard={...selected,rested:false,circle:"vanguard"};if(context.match)context.match.ridePerformed=true;const oldDefinition=context.cardDefinitionForInstance(previous)||{},newDefinition=context.cardDefinitionForInstance(selected)||{};context.emitEvent?.({type:"card.moved",cardInstanceId:previous.uid,sourceCardInstanceId:previous.uid,subjectCardInstanceId:previous.uid,previousLocation:"vanguard",currentLocation:"soul",controllerSide:context.side,reason:"ride"});context.emitEvent?.({type:"card.ridden",cardInstanceId:selected.uid,sourceCardInstanceId:selected.uid,subjectCardInstanceId:selected.uid,sourceCardName:newDefinition.name||null,sourceOwnerPlayerId:selected.ownerPlayerId||p.playerId,sourceControllerPlayerId:selected.controllerPlayerId||p.playerId,previousLocation:"deck",currentLocation:"vanguard",targetCardInstanceIds:[previous.uid],targetPreviousLocation:"vanguard",targetCurrentLocation:"soul",targetLocation:"vanguard",controllerSide:context.side,phase:"ride",timingWindow:"ability-ride"});context.emitEvent?.({type:"card.placed",cardInstanceId:selected.uid,sourceCardInstanceId:selected.uid,subjectCardInstanceId:selected.uid,sourceCardName:newDefinition.name||null,sourceOwnerPlayerId:selected.ownerPlayerId||p.playerId,sourceControllerPlayerId:selected.controllerPlayerId||p.playerId,previousLocation:"deck",currentLocation:"vanguard",circle:"vanguard",controllerSide:context.side,phase:"ride",timingWindow:"ability-ride"});}const byUid=new Map(remaining.map(card=>[card.uid,card])),bottom=order.map(uid=>byUid.get(uid));deck.unshift(...bottom);for(const card of bottom)context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,sourceCardInstanceId:card.uid,subjectCardInstanceId:card.uid,previousLocation:"deck",currentLocation:"deck",destinationPosition:"bottom",reason:"put-on-bottom",controllerSide:context.side,phase:"ride",timingWindow:"ability-ride-bottom"});return{rode:Boolean(selected),riddenCardUid:selected?.uid||null,bottomCardUids:order.slice()};}
    }),
    "search-deck-named-call-to-rearguard": Object.freeze({
      validate(step,context){const p=context.player,deck=p?.deck,rear=p?.rear,zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p?.accelZones||0},(_,i)=>`accel-${i+1}`)];if(step.target!=="controller"||step.maximum!==1||step.destination!=="rear-guard"||step.position!=="stand"||typeof step.cardName!=="string"||!step.cardName.trim()||step.opensSourceCircle!==true||!Array.isArray(deck)||!Array.isArray(rear)||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const selected=deck.find(card=>card?.uid===context.effectUid);if(!context.effectUid)return !context.callZone;if(!selected||typeof context.callZone!=="string")return false;const zoneIndex=zones.indexOf(context.callZone),sourceIndex=rear.findIndex(card=>card?.uid===context.source?.uid),opensSourceCircle=sourceIndex>=0&&sourceIndex===zoneIndex&&context.sourceInPlay===true;if(zoneIndex<0||zoneIndex>=rear.length||rear[zoneIndex]&&!(step.opensSourceCircle&&opensSourceCircle))return false;const definition=context.cardDefinitionForInstance(selected);return cardHasName(definition,step.cardName,{location:"deck"})&&/\bunit\b/i.test(String(definition?.type||""));},
      apply(step,context){const p=context.player,deck=p.deck,zones=["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:p.accelZones||0},(_,i)=>`accel-${i+1}`)];let called=null;if(context.effectUid){const index=deck.findIndex(card=>card?.uid===context.effectUid),zoneIndex=zones.indexOf(context.callZone);if(index<0||zoneIndex<0||zoneIndex>=p.rear.length)return false;const sourceIndex=p.rear.findIndex(card=>card?.uid===context.source?.uid);if(p.rear[zoneIndex]&&!(step.opensSourceCircle&&zoneIndex===sourceIndex&&context.sourceInPlay===true))return false;[called]=deck.splice(index,1);const definition=context.cardDefinitionForInstance(called)||{};called.zone="rear-guard";called.circle=context.callZone;called.position="stand";called.rested=false;called.locked=false;called.faceUp=true;called.controllerPlayerId=called.controllerPlayerId||p.playerId;p.rear[zoneIndex]=called;context.emitEvent?.({type:"card.revealed",cardInstanceId:called.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"rear-guard",reason:"search",revealedCardId:String(called.cardId||""),revealedCardName:definition.name||called.cardName||called.name||null});context.emitEvent?.({type:"card.moved",cardInstanceId:called.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"rear-guard",circle:context.callZone});context.emitEvent?.({type:"card.placed",cardInstanceId:called.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"rear-guard",circle:context.callZone,position:"stand"});}context.shuffleDeck(deck);return{calledCardId:called?.cardId||null,calledCardInstanceId:called?.uid||null,callZone:called?context.callZone:null};}
    }),
    "seek-mate": Object.freeze({
      validate(step,context){const player=context.player,leader=context.source,dropUids=context.legionDropUids,opponentGrade=Number(context.opponentVanguardGrade??-1);if(step.target!=="controller"||Number(step.dropCount)!==4||!positiveInteger(step.power)||typeof step.mateName!=="string"||!step.mateName.trim()||!leader?.uid||context.sourceZone!=="vanguard"||player?.vanguard?.uid!==leader.uid||leader.legionMate||leader.legionMateInstanceId||leader.everLegioned===true||context.sourceInPlay!==true||opponentGrade<3||!Array.isArray(player.drop)||!Array.isArray(player.deck)||!Array.isArray(dropUids)||dropUids.length!==4||new Set(dropUids).size!==4||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const selected=dropUids.map(uid=>player.drop.find(card=>card?.uid===uid));if(selected.some(card=>!card||card.ownerPlayerId&&card.ownerPlayerId!==player.playerId))return false;if(!context.effectUid)return true;const mate=player.deck.find(card=>card?.uid===context.effectUid)||selected.find(card=>card?.uid===context.effectUid);return Boolean(mate&&mate.uid!==leader.uid&&cardHasName(context.cardDefinitionForInstance(mate),step.mateName));},
      apply(step,context){const player=context.player,leader=context.source,selected=context.legionDropUids.map(uid=>player.drop.find(card=>card?.uid===uid));if(selected.length!==4||selected.some(card=>!card||card.ownerPlayerId&&card.ownerPlayerId!==player.playerId))return false;const indices=selected.map(card=>player.drop.findIndex(item=>item?.uid===card.uid));if(indices.some(index=>index<0))return false;let mate=null;const mateIndex=context.effectUid?player.deck.findIndex(card=>card?.uid===context.effectUid):-1;if(context.effectUid&&mateIndex>=0)[mate]=player.deck.splice(mateIndex,1);else if(context.effectUid&&!selected.some(card=>card.uid===context.effectUid))return false;for(const index of indices.sort((a,b)=>b-a))player.drop.splice(index,1);player.deck.push(...selected.slice().reverse());if(context.effectUid&&!mate){const returnedMateIndex=player.deck.findIndex(card=>card?.uid===context.effectUid);if(returnedMateIndex<0)return false;[mate]=player.deck.splice(returnedMateIndex,1)}if(mate){mate.rested=leader.rested===true;mate.position=leader.position||(mate.rested?"rest":"stand");mate.faceUp=leader.faceUp!==false;mate.controllerPlayerId=leader.controllerPlayerId||player.playerId;mate.legionLeaderInstanceId=leader.uid;leader.legionMate=mate;leader.legionMateInstanceId=mate.uid;leader.everLegioned=true}context.shuffleDeck(player.deck);for(const card of selected)context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:"deck",reason:"seek-mate-cost",abilitySourceInstanceId:leader.uid});if(mate)context.emitEvent?.({type:"unit.legioned",cardInstanceId:leader.uid,subjectCardInstanceId:leader.uid,legionLeaderInstanceId:leader.uid,legionMateInstanceId:mate.uid,controllerSide:context.side,previousLocation:"vanguard",currentLocation:"vanguard",timingWindow:"seek-mate-resolution"});return{legioned:Boolean(mate),mateInstanceId:mate?.uid||null,returnedInstanceIds:selected.map(card=>card.uid)};}
    }),
    "search-deck-named-grade-three-then-discard": Object.freeze({
      validate(step,context){const p=context.player,deck=p?.deck;if(step.target!=="controller"||Number(step.grade)!==3||typeof step.nameContains!=="string"||!step.nameContains||step.discardCount!==1||!Array.isArray(deck)||!Array.isArray(p.hand)||!Array.isArray(p.drop)||typeof context.cardDefinitionForInstance!=="function"||typeof context.shuffleDeck!=="function")return false;const selected=deck.find(card=>card?.uid===context.effectUid);if(context.effectUid&&(!selected||Number(context.cardDefinitionForInstance(selected)?.grade)!==3||!String(context.cardDefinitionForInstance(selected)?.name||"").toLowerCase().includes(step.nameContains.toLowerCase())))return false;const discard=context.effectDiscardUid?(p.hand.find(card=>card?.uid===context.effectDiscardUid)|| (selected?.uid===context.effectDiscardUid?selected:null)):null;return Boolean(discard&&((p.hand||[]).some(card=>card?.uid===discard.uid)||selected?.uid===discard.uid));},
      apply(step,context){const deck=context.player.deck;let chosen=null;if(context.effectUid){const index=deck.findIndex(card=>card?.uid===context.effectUid);if(index<0)return false;[chosen]=deck.splice(index,1);context.player.hand.push(chosen);const revealed=context.cardDefinitionForInstance?.(chosen)||{};context.emitEvent?.({type:"card.revealed",cardInstanceId:chosen.uid,controllerSide:context.side,previousLocation:"deck",currentLocation:"hand",reason:"search",revealedCardId:String(chosen.cardId||""),revealedCardName:revealed.name||chosen.cardName||chosen.name||null,revealedCardGrade:Number.isInteger(Number(revealed.grade))?Number(revealed.grade):null})}context.shuffleDeck(deck);const discardUid=context.effectDiscardUid,index=context.player.hand.findIndex(card=>card?.uid===discardUid);if(index<0)return false;const [discarded]=context.player.hand.splice(index,1);context.player.drop.push(discarded);context.emitEvent?.({type:"card.discarded",cardInstanceId:discarded.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"drop"});return{revealedCardId:chosen?.cardId||null,revealedCardUid:chosen?.uid||null,discardedUid:discarded.uid};}
    }),    "discard-from-hand": Object.freeze({
      validate(step,context){const threshold=step.condition?.op==="hand-count-at-least"?Number(step.condition.count):0;if(step.target!=="controller"||step.count!==1||!Array.isArray(context.player?.hand)||!Array.isArray(context.player?.drop)||!Number.isInteger(threshold)||threshold<0)return false;if(context.player.hand.length<threshold)return true;return typeof context.effectDiscardUid==="string"&&context.player.hand.some(card=>card?.uid===context.effectDiscardUid)&&(!step.cardFilter||matchesTargetFilter(step.cardFilter,{targetCard:context.cardDefinitionForInstance?.(context.player.hand.find(card=>card.uid===context.effectDiscardUid))}));},
      apply(step,context){const threshold=Number(step.condition?.count||0);if(step.condition?.op==="hand-count-at-least"&&context.player.hand.length<threshold)return true;const index=context.player.hand.findIndex(card=>card?.uid===context.effectDiscardUid);if(index<0)return false;const [card]=context.player.hand.splice(index,1);context.player.drop.push(card);context.emitEvent?.({type:"card.discarded",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"drop"});return true;}
    }),
    "create-token": Object.freeze({
      validate(step,context){return step.target==="controller"&&typeof step.tokenId==="string"&&positiveInteger(step.count)&&step.count<=10&&Array.isArray(context.player?.hand)&&typeof context.cardDefinitionForId==="function"&&Boolean(context.cardDefinitionForId(step.tokenId))&&(!step.condition||(step.condition.op==="opponent-vanguard-grade-at-least"&&Number.isInteger(Number(step.condition.grade))&&Number(step.condition.grade)>=0));},
      apply(step,context){if(step.condition?.op==="opponent-vanguard-grade-at-least"&&Number(context.opponentVanguardGrade??-1)<Number(step.condition.grade))return 0;const playerId=context.player.playerId;if(!playerId)return false;const cards=[];for(let i=0;i<Number(step.count);i++){const uid=typeof context.createTokenUid==="function"?context.createTokenUid(step,i):`${step.tokenId}-${Date.now()}-${Math.random().toString(36).slice(2,10)}-${i}`,instance=typeof context.createTokenInstance==="function"?context.createTokenInstance(step,uid,playerId):{...createCardInstance(step.tokenId,playerId,uid,{zone:"hand"}),isToken:true};if(!instance||instance.uid!==uid||instance.cardId!==step.tokenId||instance.ownerPlayerId!==playerId||instance.controllerPlayerId!==playerId)return false;instance.isToken=true;cards.push(instance);}context.player.hand.push(...cards);for(const card of cards){context.onTokenCreated?.(card,step,context);context.emitEvent?.({type:"card.created",cardInstanceId:card.uid,controllerPlayerId:playerId,previousLocation:"outside",currentLocation:"hand"});}return cards.length;}
    })
  });
  function hasActiveAbilityKeyword(card,keyword,location){
    const expected=String(keyword||"").trim().toLowerCase();if(!card||!expected)return false;
    const zone=String(location||"").toLowerCase(),circle=zone==="vanguard"?"vanguard":zone==="guardian"||zone==="guardian circle"?"guardian":/^(?:rear-|accel-)/.test(zone)?"rear-guard":zone==="hand"?"hand":zone==="soul"?"soul":zone==="drop"?"drop":zone==="bind"?"bind":zone==="damage"?"damage":null;
    return parseCardAbilities(card).some(ability=>ability.kind==="CONT"&&(ability.definition?.keywords||[]).some(value=>String(typeof value==="string"?value:value?.name||"").trim().toLowerCase()===expected)&&(!ability.requiredLocation?.length||!circle||ability.requiredLocation.includes(circle)));
  }
  function matchesTargetFilter(filter = {}, context = {}) {
    if(hasActiveAbilityKeyword(context.targetCard,"resist",context.targetZone)&&(!context.sourceControllerPlayerId||!context.targetControllerPlayerId||context.sourceControllerPlayerId!==context.targetControllerPlayerId))return false;
    if (filter.controller === "source-controller" && (!context.targetControllerPlayerId || !context.sourceControllerPlayerId || context.targetControllerPlayerId !== context.sourceControllerPlayerId)) return false;
    if (filter.excludeSource && context.target?.uid === context.source?.uid) return false;
    if (filter.locked === true && context.target?.locked !== true) return false;
    if (filter.locked === false && context.target?.locked === true) return false;
    if (filter.cardType === "unit" && !/\b(?:unit|trigger)\b/i.test(String(context.targetCard?.type||""))) return false;
    if (filter.trigger && String(context.targetCard?.trigger||"").toLowerCase() !== String(filter.trigger).toLowerCase()) return false;
    if (filter.controller === "opponent" && (!context.targetControllerPlayerId || !context.opponentPlayerId || context.targetControllerPlayerId !== context.opponentPlayerId)) return false;
    if (filter.maxGrade !== undefined && (!Number.isFinite(Number(context.targetCard?.grade)) || Number(context.targetCard.grade) > Number(filter.maxGrade))) return false;
    if (filter.minGrade !== undefined && (!Number.isFinite(Number(context.targetCard?.grade)) || Number(context.targetCard.grade) < Number(filter.minGrade))) return false;
    const targetLocation=context.targetZone==="vanguard"?"vanguard":/^(?:rear-(?:left|right|back-(?:left|center|right))|accel-\d+)$/.test(String(context.targetZone||""))?"rear-guard":undefined;
    if (filter.cardName && !cardHasName(context.targetCard, filter.cardName,{location:targetLocation})) return false;
    if (Array.isArray(filter.cardNamesAny) && !filter.cardNamesAny.some(name => cardHasName(context.targetCard, name, { location: targetLocation }))) return false;
    if (filter.cardNameContains && !cardHasName(context.targetCard, filter.cardNameContains, { contains: true,location:targetLocation })) return false;
    if(filter.abilityKeyword&&!cardHasAbilityKeyword(context.targetCard,filter.abilityKeyword))return false;
    if(Array.isArray(filter.abilityKeywordsAny)&&!filter.abilityKeywordsAny.some(keyword=>cardHasAbilityKeyword(context.targetCard,keyword)))return false;
    if (filter.clan) {
      if (!hasAbilityKeyword(context.targetCard,"all-clans-and-nations")) {
      const normalizeClan=value=>String(value||"").trim().toLocaleLowerCase().replace(/^the\s+/,""),clan=normalizeClan(filter.clan), declared=[context.targetCard?.clan,...(context.targetCard?.clans||[])].filter(Boolean).map(normalizeClan);
      const fallback=String(context.targetCard?.text||"").split(/\r?\n/)[0].split("/")[0].trim().toLowerCase();
      if(declared.length?!declared.includes(clan):fallback!==clan)return false; }
    }
    if(filter.nation){const nation=String(filter.nation).trim().toLowerCase(),declared=[context.targetCard?.nation,...(context.targetCard?.nations||[])].filter(Boolean).map(value=>String(value).trim().toLowerCase());if(!hasAbilityKeyword(context.targetCard,"all-clans-and-nations")&&!declared.includes(nation))return false}
    if(filter.race){const race=String(filter.race).trim().toLowerCase(),declared=[context.targetCard?.race,...(context.targetCard?.races||[])].filter(Boolean).map(value=>String(value).trim().toLowerCase()),printed=String(context.targetCard?.text||"").split(/\r?\n/)[0].split("/").slice(1).map(value=>value.trim().toLowerCase());if(!declared.includes(race)&&!printed.includes(race))return false}
    if (filter.mustBeAttacked && context.isBeingAttacked !== true) return false;
    if (filter.zone === "rear-guard" && !/^(?:rear-(?:left|right|back-(?:left|center|right))|accel-\d+)$/.test(String(context.targetZone || ""))) return false;
    if (filter.zone === "vanguard" && context.targetZone !== "vanguard") return false;
    if (filter.row === "front" && !["vanguard","rear-left","rear-right"].includes(String(context.targetZone||""))) return false;
    if (filter.row === "back" && !["rear-back-left","rear-back-center","rear-back-right"].includes(String(context.targetZone||""))) return false;
    return true;
  }
  function normalizePrintedText(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function compileContinuousCardNameAliasDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^(?:CONT:\s*)?This (?:card|unit) is (?:also )?regarded as ["“]([^"”]+)["”]\.?(?![\s\S])/i);
    if(kind!=="CONT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-card-name-alias-v1",review:"Exact zone-unspecified CONT name-alias wording. Comprehensive Rules 4.52 section 2.1.2 says this ability is active in all zones."},keywords:[{name:"card-name-alias",value:match[1]}]};
  }
  function compileContinuousVanguardCardNameAliasDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\]: This (?:unit|card) is (?:also )?regarded as ["“]([^"”]+)["”]\.?(?![\s\S])/i);
    if(kind!=="CONT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-vanguard-card-name-alias-v1",review:"Exact VC-only CONT alias wording. The alias is active only while this exact source is on a Vanguard Circle; it is not a general card-name property in hand, deck, or other circles."},keywords:[{name:"card-name-alias",value:match[1]}]};
  }
  function compileContinuousVanguardRearGuardCardNameAliasDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\/RC\]: This (?:unit|card) is (?:also )?regarded as ["“]([^"”]+)["”]\.?(?![\s\S])/i);
    if(kind!=="CONT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-vc-rc-card-name-alias-v1",review:"Exact VC/RC-only CONT name alias. It is active only while this exact source instance is on a Vanguard or Rear-Guard Circle; it does not change the name in hand, deck, soul, drop, or other zones."},keywords:[{name:"card-name-alias",value:match[1]}]};
  }
  function compileContinuousNamedDeckLimitDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT:\s*You may (?:only )?have up to (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (?:(?:cards?\s+named)\s+)?["“]([^"”]+)["”] in a deck\.?$/i);
    if(!match)return null;
    const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12},maximum=Number.isInteger(Number(match[1]))?Number(match[1]):words[match[1].toLowerCase()],cardName=match[2].trim();
    if(!Number.isSafeInteger(maximum)||maximum<1||maximum>50||!cardName)return null;
    return{id:abilityId,cardId,kind,printedText,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-named-deck-copy-limit-v1",review:"Exact named deck construction restriction. Applies across same-name prints in the main deck and is evaluated by trusted deck validation; this CONT ability is never manually activated."},continuousRestrictions:[{type:"named-deck-copy-limit",cardName,maximum}]};
  }
  function compileAutoVanguardGradeClanPlacementPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO\s*\[RC\]:\s*When (?:(?:a grade (\d+) [«<]([^»>]+)[»>] is placed on your VC)|(?:your grade (\d+) [«<]([^»>]+)[»>] is placed on VC)), this unit gets power \+(\d+) until (?:the )?end of turn\.$/i);
    if(!match)return null;
    const grade=Number(match[1]||match[3]),clan=(match[2]||match[4]).trim(),amount=Number(match[5]);
    if(!Number.isSafeInteger(grade)||grade<0||!clan||!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"vanguard",circles:["vanguard"]},conditions:[{type:"event-subject-grade-equals",count:grade},{type:"event-subject-has-clan",value:clan}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-own-vanguard-grade-clan-placement-power-v1",review:"Exact cross-unit AUTO template: the source must already be the controller's Rear-Guard when that controller's exact Vanguard instance is placed on VC; the placed Vanguard's printed grade and clan are matched from the event subject before granting only the source the printed end-of-turn power."},effects:[{op:"modify-power",target:"source",amount,duration:"turn"}]};
  }
  function compileOtherRearGuardPlacementPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO \[VC\/RC\]: When your other rear-guard is placed, this unit gets power \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    const amount=Number(match[1]);if(!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"any",circles:["rear-guard"],excludeSourceAsSubject:true,subjectControllerRelation:"source-controller"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-other-friendly-rearguard-placement-source-power-turn-v1",review:"Exact cross-unit placement AUTO. The exact source remains on its VC or RC; a different card instance controlled by the same player must actually enter an RC. Only that source receives the printed power until turn end."},effects:[{op:"modify-power",target:"source",amount,duration:"turn"}]};
  }
  function compileSameNameVanguardRideRestrictionDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT:\s*You cannot ride a unit with a different card name from your vanguard\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-crest-ride-same-name-vanguard-v1",review:"Exact Crest CONT wording. The restriction is active for its controller while this card is in their Crest zone and compares the candidate ride with the current Vanguard, including structured card-name aliases."},continuousRestrictions:[{type:"ride-same-name-as-vanguard"}]};
  }
  function compileRestraintRestrictionDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText);
    if(/^CONT \[RC\]: Restraint\.$/i.test(text))return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-restraint-cannot-attack-v1",review:"Exact RC Restraint keyword ability. The source cannot attack only while it is on a Rear-Guard Circle; moving it to another zone ends this location-scoped restriction. It is continuous, not manually activated."},keywords:["restraint"],continuousRestrictions:[{type:"restraint"}]};
    if(!/^CONT \[VC\/RC\]: Restraint \(This unit cannot attack\.\)$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vc-rc-restraint-cannot-attack-v1",review:"Exact Restraint keyword reminder text. This continuous restriction prevents this exact unit from attacking while it is on VC or RC; it is not a manual activation."},keywords:["restraint"],continuousRestrictions:[{type:"restraint"}]};
  }
  function compileContinuousVanguardCannotBeBoostedDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT \[VC\]: Your units cannot boost this unit\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vanguard-cannot-be-boosted-v1",review:"Exact VC restriction wording. It prevents a controlled back-row unit from boosting this specific Vanguard; it does not prohibit the Vanguard from attacking."},continuousRestrictions:[{type:"cannot-be-boosted"}]};
  }
  function compileContinuousRearGuardCannotBeBoostedDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT \[RC\]: This unit cannot be boosted\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rear-guard-cannot-be-boosted-v1",review:"Exact RC continuous restriction wording. It prevents another unit from boosting this exact source while it is on a Rear-Guard Circle; it does not restrict the unit from attacking."},continuousRestrictions:[{type:"cannot-be-boosted"}]};
  }
  function compileContinuousInterceptKeywordDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\/GC\]: This unit gets ["“]Intercept["”], and it gets shield \+(\d+)\.$/i);
    if(!match)return null;
    const amount=Number(match[1]);if(!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard","guardian"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-rc-gc-grant-intercept-shield-v1",review:"Exact dual-circle CONT wording. Grants Intercept while on RC and shield while on RC or GC; intercept timing and front-row/untargeted restrictions are checked by the shared intercept legality path."},keywords:["intercept"],effects:[{op:"continuous-shield",target:"source",amount,duration:"continuous",condition:{op:"always"}}]};
  }
  function getCardNames(card,{location}={}){
    const names=new Set();const printed=String(card?.name||card?.cardName||"").trim();if(printed)names.add(printed);
    if(!card)return[];
    const reviewed=getReviewedAbilityDefinitionsForCard(card.cardId||card.id);
    for(const ability of [...reviewed,...parseCardAbilities(card).map(item=>item.definition).filter(Boolean)])if(ability.kind==="CONT"&&(!ability.requiredLocation?.length||location&&ability.requiredLocation.includes(location)))for(const keyword of ability.keywords||[])if(keyword?.name==="card-name-alias"&&typeof keyword.value==="string"&&keyword.value.trim())names.add(keyword.value.trim());
    return [...names];
  }
  function cardHasName(card,name,{contains=false,location}={}){const expected=String(name||"").trim().toLocaleLowerCase();if(!expected)return false;return getCardNames(card,{location}).some(value=>contains?value.toLocaleLowerCase().includes(expected):value.toLocaleLowerCase()===expected)}
  function cardsShareName(left,right,{leftLocation,rightLocation}={}){const names=new Set(getCardNames(right,{location:rightLocation}).map(name=>name.toLocaleLowerCase()));return getCardNames(left,{location:leftLocation}).some(name=>names.has(name.toLocaleLowerCase()))}
  function cardHasAbilityKeyword(card,keyword){
    const expected=String(keyword||"").trim().toLocaleLowerCase();if(!card||!expected)return false;
    if (getCardAbilityKeywords(card).includes(expected)) return true;
    const direct=String(card.text||"").split(/\r?\n/).some(line=>line.trim().toLocaleLowerCase().startsWith(expected+" - ")&&/\b(?:AUTO|ACT|CONT)\b/i.test(line));if(direct)return true;
    return parseCardAbilities(card).some(ability=>{const raw=String(ability.raw||"").trim().replace(/^\s*\[[^\]]+\]\s*:?\s*/,""),prefix=raw.split(/:\s*/)[0].trim().toLocaleLowerCase(),normalized=prefix.replace(/[^a-z0-9]+/g," ").trim();return normalized===expected||normalized.startsWith(expected+" ")||(/^generation break\b/.test(normalized)&&(" "+normalized+" ").includes(" "+expected+" "));});
  }  function registerAbilityDefinitions(definitions) {
    if (!Array.isArray(definitions)) throw new TypeError("Ability definitions must be an array.");
    for (const definition of definitions) {
      const keywordOnly=definition?.kind==="CONT"&&(Array.isArray(definition.keywords)&&definition.keywords.length>0||Array.isArray(definition.continuousRestrictions)&&definition.continuousRestrictions.length>0);
      if (!definition?.id || !definition.cardId || !definition.kind || !definition.printedText || ((!Array.isArray(definition.effects) || !definition.effects.length) && !keywordOnly)) throw new TypeError("A reviewed ability definition is incomplete.");
      if ((definition.effects||[]).some(effect => {
        if (!effectOperations.has(effect.op)) return true;
        if (effect.op === "continuous-power") return !["source","all-controller-units"].includes(effect.target) || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition) || (effect.target==="all-controller-units"&&(effect.condition?.op!=="controller-turn"||effect.condition.sourceFaceUp!==true||effect.condition.targetHasNoAbilities!==true));
        if (effect.op === "continuous-power-adjustment") return effect.target !== "source" || !Number.isSafeInteger(Number(effect.amount)) || Number(effect.amount) === 0 || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition);
        if (effect.op === "continuous-power-per-soul-card") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition) || effect.cardNameContains != null && (typeof effect.cardNameContains !== "string" || !effect.cardNameContains.trim());
        if (effect.op === "continuous-power-per-clan-rearguard") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition) || typeof effect.clan !== "string" || !effect.clan.trim();
        if (effect.op === "continuous-power-per-dragontree-marker") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition);
        if (effect.op === "continuous-power-per-controller-rearguard") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition);
        if (effect.op === "continuous-power-per-named-face-up-damage-card") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || typeof effect.cardName !== "string" || !effect.cardName.trim() || !continuousConditionSupported(effect.condition);
        if (effect.op === "continuous-critical") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition);
        if (effect.op === "continuous-shield") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "continuous" || !continuousConditionSupported(effect.condition);
        if (effect.op === "continuous-grade") {
          const strideCost = effect.duration === "stride-payment" && effect.condition?.op === "paying-stride-cost" && !effect.location && [undefined,"add","treat-as-grade-three"].includes(effect.mode) && (effect.mode !== "treat-as-grade-three" || Number(effect.amount) === 3);
          const triggerZoneGrade = effect.duration === "continuous" && effect.location === "trigger" && effect.condition?.op === "generation-break" && positiveInteger(effect.condition.count) && effect.mode == null;
          return effect.target !== "source" || !positiveInteger(effect.amount) || !(strideCost || triggerZoneGrade);
        }
        if (effect.op === "modify-shield-source") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "battle";
        if (effect.op === "conditional-counter-charge") return effect.target !== "controller" || !positiveInteger(effect.count) || effect.condition?.type !== "controller-drop-has-card-name" || typeof effect.condition.cardName !== "string" || !effect.condition.cardName.trim();
        if (effect.op === "modify-drive-target") return effect.target !== "attacking-vanguard" || !positiveInteger(effect.amount) || effect.duration !== "battle";
        if (effect.op === "grant-temporary-boost") return effect.target !== "source" || effect.duration !== "turn";
        if (effect.op === "call-top-to-guardian") return effect.target !== "controller" || !Number.isInteger(Number(effect.count)) || Number(effect.count)<1 || Number(effect.count)>10 || effect.destination !== "guardian" || effect.position !== "rest";
        if (effect.op === "call-filtered-top-to-guardian-drop") return effect.target !== "controller" || effect.count !== 5 || effect.destination !== "guardian" || effect.position !== "rest" || effect.remainder !== "drop" || typeof effect.filter?.clan !== "string" || !effect.filter.clan.trim();
        if (effect.op === "call-checked-card-locked") return effect.target !== "checked-card" || effect.position !== "locked";
        if (effect.op === "call-source-from-drop-rested") return effect.target !== "source" || effect.position !== "rest" || effect.cannotAttackTurnKeyWhenBattlePhase !== undefined && effect.cannotAttackTurnKeyWhenBattlePhase !== true;
        if (effect.op === "ride-revoldress-source-from-soul-rested") return effect.target !== "controller" || effect.rested !== true;
        if (effect.op === "search-top-up-to-one-filtered-to-hand") return effect.target !== "controller" || !positiveInteger(effect.lookCount) || effect.maximum !== 1 || !validTopSearchFilter(effect.filter);
        if (effect.op === "move-filtered-hand-card-to-soul") return effect.target !== "controller" || effect.maximum !== 1 || !effect.filter || Object.keys(effect.filter).length !== 1 || typeof effect.filter.clan !== "string" || !effect.filter.clan.trim();
        if (effect.op === "search-top-up-to-one-grade-to-hand") return effect.target !== "controller" || !positiveInteger(effect.lookCount) || !Number.isInteger(Number(effect.maximumGrade)) || Number(effect.maximumGrade) < 0;
        if (effect.op === "search-deck-named-call-to-rearguard") return effect.target !== "controller" || effect.maximum !== 1 || typeof effect.cardName !== "string" || !effect.cardName.trim() || effect.destination !== "rear-guard" || effect.position !== "stand" || effect.opensSourceCircle !== true;
        if (effect.op === "search-deck-or-drop-named-to-hand") return effect.target !== "controller" || effect.maximum !== 1 || typeof effect.cardName !== "string" || !effect.cardName.trim() || effect.reveal !== true || effect.shuffleIfDeckSearched !== true;
        if (effect.op === "ride-top-five-named-card") return effect.target !== "controller" || effect.lookCount !== 5 || typeof effect.cardName !== "string" || !effect.cardName.trim() || effect.bottomOrder !== "chosen-rest";
        if (effect.op === "schedule-damage-return-at-turn-end") return effect.target !== "controller" || effect.due !== "end-phase-start";
        if (effect.op === "schedule-source-return-to-deck-at-turn-end") return effect.target !== "source" || effect.due !== "end-phase-start" || effect.shuffle !== true;
        if (effect.op === "return-chosen-damage-to-deck") return effect.target !== "controller" || effect.shuffle !== true;
        if (effect.op === "reorder-deck-card") return effect.target !== "chosen" || effect.destination !== "player-choice";
        if (effect.op === "seek-mate") return effect.target !== "controller" || !positiveInteger(effect.power) || Number(effect.dropCount) !== 4 || typeof effect.mateName !== "string" || !effect.mateName.trim();
        if (effect.op === "retire-target") return effect.target !== "chosen" || effect.targetFilter?.controller !== "opponent" || effect.targetFilter?.zone !== "rear-guard";
        if (effect.op === "revelation-choice") return effect.target !== "controller";
        if (effect.op === "engorge") return effect.target !== "source";
        if (effect.op === "rest-target") return effect.target !== "chosen" || effect.targetFilter?.controller !== "source-controller" || effect.targetFilter?.zone !== "rear-guard" || effect.noOpIfNoLegalTargets !== true;
        if (effect.op === "stand-target") return effect.target !== "chosen" || !effect.targetFilter || typeof effect.targetFilter !== "object" || effect.noOpIfNoLegalTargets !== true;
        if (effect.op === "unlock-target") return effect.target !== "chosen" || effect.targetFilter?.controller !== "source-controller" || effect.targetFilter?.locked !== true;
        if (effect.op === "protect-target") return effect.target !== "chosen" || effect.duration !== "battle" || !effect.targetFilter || effect.targetFilter.controller !== "source-controller" || effect.targetFilter.cardType !== "unit";
        if (effect.op === "g-guardian-grade-three-replacement-choice") return effect.target !== "controller" || !Array.isArray(effect.choices) || effect.choices.length !== 2 || JSON.stringify(effect.choices.map(choice=>choice.id))!==JSON.stringify(["vanguard-power","opponent-critical"]) || effect.choices[0].amount!==10000 || JSON.stringify(effect.choices[0].targetFilter)!==JSON.stringify({controller:"source-controller",cardType:"unit",zone:"vanguard"}) || effect.choices[1].amount!==-2 || JSON.stringify(effect.choices[1].targetFilter)!==JSON.stringify({controller:"opponent",cardType:"unit"});
        if (effect.op === "place-circle-marker") return effect.target !== "chosen-controller-circle" || !(effect.markerType === "Treasures" && JSON.stringify(effect.circleTypes) === JSON.stringify(["vanguard","rear-guard"]) || effect.markerType === "Dragontree" && JSON.stringify(effect.circleTypes) === JSON.stringify(["rear-guard"]));
        if (effect.op === "protect-attacked-source") return effect.target !== "source" || effect.duration !== "battle";
        if (effect.op === "move-source-to-soul") return effect.target !== "source" || effect.from !== "drop";
        if (effect.op === "modify-defending-source-power") return effect.target !== "source" || !positiveInteger(effect.amount) || effect.duration !== "battle";
        if (effect.op === "modify-power-target") return !["chosen","boosted-unit"].includes(effect.target) || !positiveInteger(effect.amount) || !["turn","battle"].includes(effect.duration) || !effect.targetFilter || typeof effect.targetFilter !== "object" || effect.optionalTarget != null && (typeof effect.optionalTarget !== "boolean" || effect.target !== "chosen" || effect.duration !== "turn");
        if (effect.op.startsWith("modify-")) return effect.target !== "source" || !positiveInteger(effect.amount) || !["turn","battle"].includes(effect.duration);
        if (["draw", "counter-charge", "soul-charge"].includes(effect.op)) return !positiveInteger(effect.count);
        if (["rest-source", "stand-source"].includes(effect.op)) return effect.target !== "source";
        return false;
      })) throw new TypeError("An ability definition contains an unsupported or invalid effect operation.");
      const prior = abilityDefinitions.get(definition.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(definition)) throw new Error("Conflicting ability definition: " + definition.id);
      if (!prior) abilityDefinitionRevision++;
      abilityDefinitions.set(definition.id, Object.freeze(JSON.parse(JSON.stringify(definition))));
    }
    abilityKeywordCache = new WeakMap();
    return abilityDefinitions.size;
  }
  function getAbilityDefinition(id, printedText) {
    const definition = abilityDefinitions.get(id);
    return definition && normalizePrintedText(definition.printedText) === normalizePrintedText(printedText) ? definition : null;
  }
  function getReviewedAbilityDefinitionsForCard(cardId) {
    const expected = String(cardId || "");
    if (!expected) return [];
    return [...abilityDefinitions.values()].filter(definition => String(definition.cardId) === expected).map(definition => JSON.parse(JSON.stringify(definition)));
  }
  function compileActSelfPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    const text=normalizePrintedText(printedText).replace(/[’‘]/g,"'");
    const match = text.match(/^ACT\s*\[(VC\/RC|VC|RC)\]:\s*\[Counter Blast (\d+)\]\s*This unit gets power \+(\d+) until end of turn\.$/i)||text.match(/^ACT\s*\[(VC\/RC|VC|RC)\]:\s*\[Counter Blast (\d+)\]\s*During this turn, this unit gets power \+(\d+)\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: /During this turn,/i.test(text)?"act-counter-blast-source-power-during-turn-v1":"act-counter-blast-source-power-turn-v1", review: "Exact ACT template: circle, Counter Blast amount, source target, modifier amount, and turn duration are parsed from printed text." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "turn" }] };
  }
  function compileActFilteredCounterBlastSourcePowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    const text = normalizePrintedText(printedText).replace(/[’‘]/g, "'");
    const match = text.match(/^ACT \[VC\]: \[Counter Blast (\d+)-card with ["“]([^"”]+)["”] in its card name\] This unit gets power \+(\d+) until end of turn\.$/i);
    if (!match || !match[2].trim()) return null;
    return {
      id: abilityId, cardId, kind, printedText, requiredLocation: ["vanguard"],
      costs: [{ type: "counter-blast", count: Number(match[1]), filter: { cardNameContains: match[2].trim() } }],
      costsReviewed: true,
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "act-vanguard-filtered-counter-blast-source-power-turn-v1", review: "Exact VC ACT pattern. The source must be the controller's Vanguard; each paid face-up damage card must have the printed name fragment, then only the source gets the printed power through turn end." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "turn" }]
    };
  }
  function compileSeekMateDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT")return null;
    const text=normalizePrintedText(printedText);
    const match=text.match(/^ACT \[VC\]: Legion (\d{5}) \"(.+)\"(?: \(If your opponent[’']s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion\.?\))?\.?$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,once:true,usageRestriction:{type:"once-per-game",scope:"ability-instance",reset:"game"},requiredLocation:["vanguard"],conditions:[{type:"source-never-legioned"},{type:"opponent-vanguard-grade-at-least",count:3},{type:"controller-drop-count-at-least",count:4}],choicesReviewed:true,costs:[],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.48.pdf",patternId:"act-seek-mate-legion-v1",review:"Exact ACT Seek Mate icon family. Comprehensive Rules 4.48 sections 14.11.2–14.11.2.1 supply the once-per-game restriction, opponent Grade 3 condition, four-card Drop cost and chosen top-deck order, up-to-one named mate search, Legion association, and shuffle."},effects:[{op:"seek-mate",target:"controller",power:Number(match[1]),mateName:match[2].trim(),dropCount:4}]};
  }
  function compileActNamedSoulPowerCriticalDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT")return null;
    const match=normalizePrintedText(printedText).match(/^ACT \[(VC\/RC|VC|RC)\]: \[Counter Blast (\d+)\] If you have a card named ["“]([^"”]+)["”] in your soul, this unit gets power \+(\d+) \/ critical \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-counter-blast-named-soul-power-critical-turn-v1",review:"Exact ACT wording: the named-card-in-controller-Soul condition gates visibility and activation; printed circle, Counter-Blast, power, critical, and turn duration are preserved."},effects:[{op:"modify-power",target:"source",amount:Number(match[4]),duration:"turn"},{op:"modify-critical",target:"source",amount:Number(match[5]),duration:"turn"}]};
  }
  function compileActSoulBlastSelfPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    const match = String(printedText || "").match(/^ACT\s*\[(VC\/RC|VC|RC)\]:\s*(?:COST\s*)?\[Soul Blast (\d+)\],?\s*(?:and\s+)?This unit gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "act-soul-blast-source-power-turn-v1", review: "Exact ACT template: circle, Soul Blast amount, source target, modifier amount, and duration are parsed from printed text." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "turn" }] };
  }
  function compileActRestDiscardDrawDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    if (!/^ACT\s*\[(VC\/RC|VC|RC)\]:\s*\[Rest this unit & Choose a card from your hand, and discard it\] Draw a card\.$/i.test(String(printedText || ""))) return null;
    return { id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "act-rest-discard-draw-v1", review: "Exact ACT template: circle restriction, rest cost, one-card hand discard, and draw effect are parsed from printed text." },
      effects: [{ op: "draw", count: 1 }] };
  }
  function compileActSoulCostDrawDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    if (!/^ACT\s*\[RC\]:\s*(?:COST\s*)?\[Put this unit into your soul\],?\s*draw a card\.$/i.test(String(printedText || ""))) return null;
    return { id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "act-source-to-soul-draw-v1", review: "Exact ACT template: RC source-to-Soul cost and one-card draw are parsed from printed text." },
      effects: [{ op: "draw", count: 1 }] };
  }
  function compileActSoulCounterChargeDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    const match = String(printedText || "").match(/^ACT\s*\[RC\]:\s*\[Put this unit into your soul\]\s*Counter Charge (\d+)\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "act-source-to-soul-counter-charge-v1", review: "Exact ACT template: RC placement, source-to-Soul cost, and Counter Charge amount are parsed from printed text." },
      effects: [{ op: "counter-charge", count: Number(match[1]) }] };
  }
  function compileActSoulCostBuffDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    const match = String(printedText || "").match(/^ACT\s*\[RC\]:\s*(?:COST\s*)?\[Put this unit into your soul\],?\s*Choose one of your units, and (?:it|that unit) gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText,
      requiredLocation: ["rear-guard"],choicesReviewed: true,
      source: { dataset: "Cardfight Area snapshot", patternId: "act-source-to-soul-choose-friendly-power-turn-v1", review: "Exact ACT template: RC source pays by moving to Soul, then chooses a different friendly unit for the printed turn power modifier; accepts optional COST keyword and comma as printed." },
      effects: [{ op: "modify-power-target", target: "chosen", amount: Number(match[1]), duration: "turn", targetFilter: { controller: "source-controller", cardType: "unit", excludeSource: true } }] };
  }
  function compileActSourceToSoulDiscardDrawClanDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT")return null;
    const match=normalizePrintedText(printedText).match(/^(?:ACT\s*)?\[RC\]:\s*\[Put this unit into your soul\s*&\s*Choose a card from your hand, and discard it\]\s*If you have a [«<]([^»>]+)[»>] vanguard, draw a card\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditionsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"act-rc-source-to-soul-discard-draw-clan-v1",review:"Exact ACT template. The source must be on RC and its controller must have the printed clan's Vanguard; activation pays both printed costs by moving this exact source to Soul and discarding one chosen hand card, then draws one card."},effects:[{op:"draw",count:1}]};
  }
  function compileActSourceToSoulOptionalFriendlyPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "ACT") return null;
    const match = normalizePrintedText(printedText).match(/^ACT\s*\[RC\]:\s*\[Put this unit into your soul\]\s*Choose up to one of your (?:[«<]([^»>]+)[»>](?: units?)?|units?), and (?:that unit|it) gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    const clan = match[1] || null;
    return { id: abilityId, cardId, kind, printedText,
      requiredLocation: ["rear-guard"],choicesReviewed: true,
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "act-source-to-soul-optional-up-to-one-friendly-power-v1", review: "Exact ACT family: pay by moving this Rear-Guard into Soul, then optionally choose zero or one legal friendly field unit matching the printed clan filter and give it the printed turn power." },
      effects: [{ op: "modify-power-target", target: "chosen", amount: Number(match[2]), duration: "turn", optionalTarget: true, targetFilter: { controller: "source-controller", cardType: "unit", excludeSource: true, ...(clan ? { clan } : {}) } }] };
  }
  function compileRevoldressEndTurnRideDefinition(cardId,abilityId,kind,printedText) {
    const exact="AUTO [VC]: At the end of your turn, choose a card with the RevolDress ability from your soul, and ride it as rest.";
    if(kind!=="AUTO"||normalizePrintedText(printedText)!==exact)return null;
    return {id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],choicesReviewed:true,
      trigger:{status:"recognized-trigger",eventType:"turn.ended",subject:"controller",turnRelation:"controller"},
      source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/cardlist/?cardno=D-BT07%2F011EN",patternId:"auto-vc-end-turn-revoldress-ride-from-soul-rest-v1",review:"Exact AUTO [VC] end-of-controller-turn text. The controller chooses a card in their Soul whose printed card text grants RevolDress, rides that exact instance to VC rested, and emits normal card.moved/card.ridden/card.placed events so ride-trigger processing continues."},
      effects:[{op:"ride-revoldress-source-from-soul-rested",target:"controller",rested:true}]};
  }
  function compileOwnAttackHitCounterBlastDrawWithClanDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO\s*\[(VC\/RC|VC|RC)\]:\s*\[Counter Blast (\d+)\]\s*When this unit(?:’|'|’)s attack hits, if you have a [«<]([^»>]+)[»>] vanguard, you may pay the cost\. If you do, draw a card\.$/i);
    if (!match) return null;
    const circle = match[1].toUpperCase();
    return { id: abilityId, cardId, kind, printedText, optional: true,
      requiredLocation: circle === "VC" ? ["vanguard"] : circle === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", ...(circle === "VC" ? { circles: ["vanguard"] } : circle === "RC" ? { circles: ["rear-guard"] } : {}) },
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-own-attack-hit-counter-blast-draw-v1", review: "Exact AUTO family: this exact source unit's attack must hit; printed VC/RC restriction, Counter Blast amount, optional payment, printed Vanguard-clan condition, and one-card draw are preserved." },
      effects: [{ op: "draw", count: 1 }] };
  }
  function compilePlacedVanguardOrRearGuardClanSoulChargeDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO:\s*When this unit is placed on VC or RC, if you have a [«<]([^»>]+)[»>] vanguard, you may Soul Charge (\d+)\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, optional: true,
      requiredLocation: ["vanguard", "rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["vanguard", "rear-guard"] },
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-vanguard-or-rearguard-placement-clan-soul-charge-v1", review: "Exact placement AUTO family: only this source instance entering VC or RC may trigger it; the printed Vanguard clan is a live condition, and Soul Charge count is parsed from the optional effect." },
      choicesReviewed: true,
      effects: [{ op: "soul-charge", count: Number(match[2]) }] };
  }
  function compileRcPlacementSoulChargeOneDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO" || !/^AUTO:\s*When this unit is placed on RC, Soul Charge 1\.$/i.test(normalizePrintedText(printedText))) return null;
    return { id: abilityId, cardId, kind, printedText, requiredLocation: ["rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
      choicesReviewed: true,
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-placement-soul-charge-one-v1", review: "Exact mandatory Rear-Guard placement AUTO. Only the same card instance entering an RC can queue this ability; its controller Soul Charges one." },
      effects: [{ op: "soul-charge", count: 1 }] };
  }
  function compileRcPlacementSoulBlastCounterChargeTwoDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO: \[Soul Blast 2\] When this unit is placed on RC, you may pay the cost\. If you do, Counter Charge 2\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,requiredLocation:["rear-guard"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["rear-guard"]},costs:[{type:"soul-blast",count:2}],costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-placement-soul-blast-counter-charge-two-v1",review:"Exact optional RC placement AUTO. The exact source Rear-Guard controller may pay Soul Blast 2; if paid, Counter Charge 2 flips up to two face-down cards in that controller's damage zone."},effects:[{op:"counter-charge",count:2}]};
  }
  function compileVanguardOrRearGuardPlacementOptionalSoulChargeOneDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[VC\/RC\]: When placed, you may Soul Charge 1\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,requiredLocation:["vanguard","rear-guard"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["vanguard","rear-guard"]},choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-or-rearguard-placement-optional-soul-charge-one-v1",review:"Exact optional placement AUTO. The ability is eligible only when this exact source instance is placed on its Vanguard or Rear-Guard circle; its controller may decline or Soul Charge exactly one."},effects:[{op:"soul-charge",count:1}]};
  }
  function compileAutoRcReturnToHandCounterSoulBlastDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO: \[Counter Blast 1 & Soul Blast 1\] When this unit is returned to your hand from RC, you may pay the cost\. If you do, draw a card\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,requiredLocation:[],trigger:{status:"recognized-trigger",eventType:"card.moved",subject:"source",sourceLocation:"rear-guard",destinationLocation:"hand"},costs:[{type:"counter-blast",count:1},{type:"soul-blast",count:1}],costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-return-to-hand-counter-soul-blast-draw-v1",review:"Exact AUTO wording. This ability triggers only from the exact source instance moving from an RC to its controller's hand; the controller may pay Counter Blast 1 and Soul Blast 1 to draw one card. The ability resolves from hand, so it has no current-location requirement."},effects:[{op:"draw",count:1}]};
  }
  function compileRcPlacementNamedVanguardSoulChargeDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO:\s*When this unit is placed on RC, if you have a vanguard with ["“]([^"”]+)["”] in its card name, you may Soul Charge (\d+)\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, optional: true, requiredLocation: ["rear-guard"], choicesReviewed: true,
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
      conditions: [{ type: "controller-vanguard-name-contains", value: match[1] }],
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-placement-named-vanguard-soul-charge-v1", review: "Exact three-record family. Only this source instance entering an RC is eligible; the live controller Vanguard must contain the printed name phrase, and only that controller may accept the optional Soul Charge." },
      effects: [{ op: "soul-charge", count: Number(match[2]) }] };
  }
  function compileRcPlacementNamedVanguardSoulChargePowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO:\s*When this unit is placed on RC, if you have a vanguard with ["“]([^"”]+)["”] in its card name, Soul Charge (\d+), and this unit gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, requiredLocation: ["rear-guard"], choicesReviewed: true,
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"] },
      conditions: [{ type: "controller-vanguard-name-contains", value: match[1] }],
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-placement-named-vanguard-soul-charge-power-v1", review: "Exact four-record AUTO family. The exact source must enter RC, its live controller Vanguard must contain the printed name phrase, then Soul Charge resolves before the source receives the printed end-of-turn power modifier." },
      effects: [{ op: "soul-charge", count: Number(match[2]) }, { op: "modify-power", target: "source", amount: Number(match[3]), duration: "turn" }] };
  }
  function compileDiscardSelfOptionalSoulDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO" || !/^AUTO:\s*When this card is discarded from hand during your turn, you may put this card into your soul\.$/i.test(normalizePrintedText(printedText))) return null;
    return { id: abilityId, cardId, kind, printedText, optional: true, choicesReviewed: true, requiredLocation: ["hand"],
      trigger: { status: "recognized-trigger", eventType: "card.discarded", subject: "event-subject", sourceLocation: "hand", destinationLocation: "drop", turnRelation: "controller" },
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-hand-discard-self-optional-to-soul-v1", review: "Exact optional discard AUTO. The exact card must leave its controller's hand for Drop during that controller's turn; if accepted, only that instance moves from Drop to Soul." },
      effects: [{ op: "move-source-to-soul", target: "source", from: "drop" }] };
  }
  function compileVanguardAttackSoulChargePowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO" || !/^AUTO \[VC\]: When this unit attacks a vanguard, Soul Charge 1, and this unit gets power \+1000 until end of that battle\.$/i.test(normalizePrintedText(printedText))) return null;
    return { id: abilityId, cardId, kind, printedText, requiredLocation: ["vanguard"], choicesReviewed: true,
      trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", circles: ["vanguard"], targetLocation: "vanguard" },
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-vanguard-own-attack-soul-charge-power-battle-v1", review: "Exact VC AUTO: the source Vanguard must be the exact declared attacker and must attack a Vanguard. Resolve Soul Charge before adding +1000 to that battle." },
      effects: [{ op: "soul-charge", count: 1 }, { op: "modify-power", target: "source", amount: 1000, duration: "battle" }] };
  }
  function compileActRestSourceFrontRowPowerDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    if(kind!=="ACT"||!/^ACT\s*\[RC\]:\s*\[Rest this unit\]\s*Choose one of your other units in the front row, and it gets power \+\d+ until end of turn\.$/i.test(text))return null;
    const amount=Number(text.match(/power \+(\d+) until end of turn\.$/i)?.[1]);
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",patternId:"act-rest-source-front-row-ally-power-v1",review:"Exact ACT template: RC source rests as cost, excludes itself from target selection, restricts the target to the front row, and applies the printed turn modifier."},effects:[{op:"modify-power-target",target:"chosen",amount,duration:"turn",targetFilter:{controller:"source-controller",cardType:"unit",excludeSource:true,row:"front"}}]};
  }
  function compileActRestSourceClanUnitPowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^ACT\s*\[RC\]:\s*\[Rest this unit\]\s*Choose another of your [«<]([^»>]+)[»>], and that unit gets power \+(\d+) until end of turn\.$/i);
    if(kind!=="ACT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-rest-source-other-clan-unit-power-v1",review:"Exact ACT wording. The source must be on RC and rest as cost; target must be a different friendly Unit of the printed clan anywhere on the field (including VC), and only the printed turn power is applied."},effects:[{op:"modify-power-target",target:"chosen",amount:Number(match[2]),duration:"turn",targetFilter:{controller:"source-controller",cardType:"unit",excludeSource:true,clan:match[1].trim()}}]};
  }
  function compileActCounterBlastUnlockLockedDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT"||!/^ACT\s*\[VC\]:\s*\[Counter Blast 1\]\s*Choose one of your locked cards, and unlock it\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-vanguard-counter-blast-unlock-friendly-locked-v1",review:"Exact VC ACT template: pay Counter-Blast 1, then choose an exact friendly locked field instance and unlock it."},effects:[{op:"unlock-target",target:"chosen",targetFilter:{controller:"source-controller",locked:true}}]};
  }
  function compileActCounterBlastSameNameSearchPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT"||!/^ACT\s*\[VC\]\s*1\/Turn:\s*COST\s*\[Counter Blast 1\],\s*search your deck for up to one card with the same card name as this unit, reveal it and put it into hand, shuffle the deck, and this unit gets power \+10000 until end of turn\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,once:true,usageRestriction:{scope:"ability",reset:"turn"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-counter-blast-same-name-search-power-v1",review:"Exact ACT template: once per turn on VC; pay Counter Blast 1, optionally search a same-name card, reveal and add it, shuffle, then grant the source +10000 for the turn."},effects:[{op:"search-deck-same-name-to-hand",target:"controller",maximum:1},{op:"modify-power",target:"source",amount:10000,duration:"turn"}]};
  }
  function compileActCounterBlastVanguardPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT")return null;
    const match=normalizePrintedText(printedText).match(/^ACT\s*\[RC\]\s*1\/Turn:\s*COST\s*\[Counter Blast (\d+)\],\s*choose one of your vanguards, and it gets power \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],once:true,usageRestriction:{type:"once-per-turn",scope:"ability-instance",reset:"turn"},costs:[{type:"counter-blast",count:Number(match[1])}],costsReviewed:true,conditions:[],conditionsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-rc-counter-blast-choose-vanguard-power-turn-v1",review:"Exact Rear-Guard ACT template. Its controller pays the printed Counter Blast once per turn, chooses their own Vanguard, and grants only that Vanguard the printed power until turn end."},effects:[{op:"modify-power-target",target:"chosen",amount:Number(match[2]),duration:"turn",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]};
  }
  function compileMainPhaseSoulChargePowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[VC\]:\s*At the beginning of your main phase, Soul Charge (\d+), and this unit gets power \+(\d+) until (?:the )?end of (?:this )?turn\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-main-phase-soul-charge-power-v1",review:"Exact Vanguard-circle AUTO. It is queued only on this controller entering Main, then Soul Charges before applying the source power modifier through turn end."},effects:[{op:"soul-charge",count:Number(match[1])},{op:"modify-power",target:"source",amount:Number(match[2]),duration:"turn"}]};
  }
  function compileMainPhaseSourceSoulNamedCallDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: At the beginning of your main phase, COST \[put this unit into your soul\], search your deck for up to one ["“]([^"”]+)["”], call it to RC, and shuffle your deck\.$/i);
    if(!match||!match[1].trim())return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,requiredLocation:["rear-guard"],costs:[{type:"source-to-soul",count:1}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-main-phase-source-to-soul-search-named-call-v1",review:"Exact RC AUTO template. The controller is prompted only when their Main Phase begins and this exact source is on RC; paying moves this source to Soul, then the controller may search for up to one Unit with the exact printed name, call it standing to a legal open RC, and shuffle."},effects:[{op:"search-deck-named-call-to-rearguard",target:"controller",cardName:match[1].trim(),maximum:1,destination:"rear-guard",position:"stand",opensSourceCircle:true}]};
  }
  function compileLordAttackRestrictionDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;const text=normalizePrintedText(printedText);if(!/^CONT\s*\[VC\/RC\]:\s*Lord(?:\s*\(If you have a unit without a same clan as this unit, this unit cannot attack\))?\.?$/i.test(text))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-lord-attack-restriction-v1",review:"Exact Lord keyword variants on VC/RC compile as a continuous attack restriction; no activation prompt is created."},keywords:["lord"],continuousRestrictions:[{type:"lord"}]};
  }  function compileAllClansNationsDefinition(cardId,abilityId,kind,printedText){if(kind!=="CONT"||!/^CONT:\s*This card is from all clans and nations\.$/i.test(normalizePrintedText(printedText)))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-all-clans-and-nations-v1",review:"Exact CONT identity wording. This is a continuous clan/nation identity property, not a manually activated skill."},keywords:["all-clans-and-nations"]};
  }  function compileMissedAttackHitEffectsDefinition(cardId,abilityId,kind,printedText){if(kind!=="CONT"||!/^CONT\s*\[VC\]:\s*This unit\u2019s "when attack hits" effects activate even if the attack did not hit\.$/i.test(normalizePrintedText(printedText)))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vanguard-missed-attack-hit-effects-v1",review:"Exact VC CONT template. On a missed attack by this exact Vanguard, only that Vanguard\x27s own AUTO effects with hit triggers are considered; no damage, hit-to-retire, or opponent hit effects are synthesized."},keywords:["missed-attack-hit-effects"]};
  }  function compileMissedAttackVanguardRetireDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText).replace(/\s*\(SHIFT \+ left click to create (?:Force|Accel|Protect) gifts\.\)$/i,"");
    if(kind!=="AUTO"||!/^AUTO\s*\[VC\]:\s*When this unit(?:'|’|’)s attack hits a vanguard, choose one of your opponent(?:'|’|’)s rear-guards, and retire it\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],trigger:{status:"recognized-trigger",eventType:"attack.hit",subject:"source",targetLocation:"vanguard",circles:[]},conditions:[],conditionsReviewed:true,costs:[],costsReviewed:true,choicesReviewed:true,optional:false,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-vanguard-own-attack-hit-opponent-rear-retire-v1",review:"Exact Vanguard AUTO wording. The exact Vanguard must attack and hit the opposing Vanguard; its controller chooses one opposing Rear-Guard to retire. When paired with the exact missed-attack CONT on that same Vanguard, the AUTO may resolve only for that source's missed Vanguard attack."},effects:[{op:"retire-target",target:"chosen",targetFilter:{controller:"opponent",zone:"rear-guard"}}]};
  }
  function compilePlacementGradeThreeSearchDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText),prefix=text.match(/^AUTO \[VC\/RC\]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade (3)(?: or greater)?(?: card)? from among them\b/i);
    if(kind!=="AUTO"||!prefix)return null;const rest=text.slice(prefix[0].length);if(!/\bput it into your hand\b/i.test(rest)||!/\bshuffle your deck\b/i.test(rest)||!/\bif you put a card(?: into your hand)?, discard a card(?: from your hand)?\.$/i.test(rest)&&!/\bif you put a card into your hand, discard a card(?: from your hand)?\.$/i.test(rest))return null;
    if(rest.search(/\bput it into your hand\b/i)>rest.search(/\bshuffle your deck\b/i)||rest.search(/\bshuffle your deck\b/i)>rest.search(/\bif you put a card/i))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-placement-top-five-grade-three-search-discard-v1",review:"Exact VC/RC placement-from-hand templates across the catalog wording variants. Source must enter its listed circle from hand; up to one qualifying Grade 3 (or greater where printed) is revealed, put into hand, then the deck is shuffled and a discard is required only if a card was added."},effects:[{op:"search-top-grade-three-to-hand-then-discard",target:"controller",lookCount:5,minGrade:Number(prefix[1]),discardCount:1}]};
  }
  function compileVanguardBoostDrawDiscardDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[RC\]: When this unit boosts a vanguard, draw a card, choose a card from your hand, and discard it\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-vanguard-boost-draw-discard-v1",review:"Exact booster source event, Vanguard target, and ordered draw-then-discard effect. The controller chooses privately after drawing; other boost actions cannot satisfy the Vanguard target restriction."},effects:[{op:"draw-then-discard",target:"controller",drawCount:1,discardCount:1}]};
  }
  function compileVanguardBoostSoulBlastDrawDiscardDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[RC\]: \[Soul Blast 1\] When this unit boosts a vanguard, you may pay the cost\. If you do, draw a card, choose a card from your hand, and discard it\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-vanguard-boost-soul-blast-draw-discard-v1",review:"Exact RC AUTO template. The exact source must boost a Vanguard; its controller may pay Soul Blast 1, then privately chooses and discards after drawing."},effects:[{op:"draw-then-discard",target:"controller",drawCount:1,discardCount:1}]};
  }
  function compileVanguardPlacedNamedSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*\[Counter Blast 1 & Soul Blast 1\] When this unit is placed on VC, you may pay the cost\. If you do, search your deck for up to one card named ["“]([^"”]+)["”], reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-placement-counter-soul-named-search-v1",review:"Exact VC placement AUTO. The exact source must enter VC; the controller may pay Counter Blast 1 and Soul Blast 1, then may search for up to one exact-name card, reveal it, add it, and shuffle."},effects:[{op:"search-deck-same-name-to-hand",target:"controller",maximum:1,cardName:match[1]}]};
  }
  function compileRcPlacementGradeThreeClanNamedSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:\s*\[Choose a grade 3 [«<]([^»>]+)[»>] from your hand, and discard it\] When this unit is placed on RC, you may pay the cost\. If you do, search your deck for up to one card named ["“]([^"”]+)["”], reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i);
    if(!match||!match[1].trim()||!match[2].trim())return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,requiredLocation:["rear-guard"],conditionsReviewed:true,choicesReviewed:true,costs:[{type:"discard",count:1,filter:{clan:match[1].trim(),minGrade:3,maxGrade:3}}],costsReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["rear-guard"]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-grade-three-clan-discard-named-search-v1",review:"Exact AUTO template: this source must be placed on RC. Its controller may discard a Grade 3 card of the printed clan from hand, then may search the controller's Deck for up to one exact-name card, reveal it, add it to hand, and shuffle. The shared filtered-discard and exact-name Deck-search handlers enforce costs and choices."},effects:[{op:"search-deck-same-name-to-hand",target:"controller",maximum:1,cardName:match[2].trim()}]};
  }
  function compileRcPlacementDeckOrDropNamedSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO: When this unit is placed on RC, COST \[Counter Blast 1\], search your deck or drop for up to one ["“]([^"”]+)["”], reveal it and put it into hand, and if you searched the deck, shuffle the deck\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,requiredLocation:["rear-guard"],conditionsReviewed:true,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["rear-guard"]},costs:[{type:"counter-blast",count:1}],costsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-placement-counter-blast-deck-or-drop-named-search-v1",review:"Exact RC placement AUTO. The controller may pay Counter Blast 1, choose their deck or Drop as the search zone, take up to one card with the exact printed name, reveal it and put it into hand; shuffle only when the deck was searched."},effects:[{op:"search-deck-or-drop-named-to-hand",target:"controller",maximum:1,cardName:match[1],reveal:true,shuffleIfDeckSearched:true}]};
  }
  function compileRidePhaseTopFiveNamedRideDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[VC\]: At the beginning of your ride phase, look at five cards from the top of your deck, search for up to one card named ["“]([^"”]+)["”] from among them, ride it, and put the rest on the bottom of your deck in any order\. If you rode, you cannot normal ride during that ride phase\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],conditionsReviewed:true,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"phase.changed",subject:"controller",circles:[],requiredPhase:"ride",turnRelation:"controller"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ride-phase-top-five-named-ride-bottom-deck-v1",review:"Exact VC AUTO template. At this controller's Ride Phase start, inspect up to five deck-top cards; optionally ride one exact-name card subject to ride restrictions, then put every remaining looked-at card on the bottom in the controller's chosen order. Consume the Ride Phase normal-ride permission only if a card was actually ridden."},effects:[{op:"ride-top-five-named-card",target:"controller",lookCount:5,cardName:match[1],bottomOrder:"chosen-rest"}]};
  }
  function compileDriveTriggerUnitPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO \[RC\]: When your drive check reveals a trigger unit, this unit gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, requiredLocation: ["rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "drive.checked", subject: "controller", checkKind: "drive", checkedCardHasTriggerUnit: true },
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-drive-check-trigger-unit-power-turn-v1", review: "Exact trigger-unit drive-check AUTO. It matches the controller's actual drive-check event only when the checked card has a trigger type, then grants this exact source Rear-Guard the printed turn power." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[1]), duration: "turn" }] };
  }
  function compileBoostSetOrderCounterChargeDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const ids={"cfa-11833":1,"cfa-12552":1,"cfa-13453":1,"cfa-8353":0};if(ids[cardId]!==Number(String(abilityId).split(":").at(-1)))return null;const text=normalizePrintedText(printedText);if(text!=="AUTO [RC]: At the end of the battle this unit boosted, if your Order Zone has a Set Order, COST [put this unit into your soul], and Counter Charge 1.")return null;return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditions:[{type:"controller-has-set-order"}],conditionsReviewed:true,costs:[{type:"source-to-soul",count:1}],costsReviewed:true,choicesReviewed:true,optional:true,trigger:{status:"recognized-trigger",eventType:"battle.close-step",subject:"booster",circles:[]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-boosted-close-set-order-counter-charge-v1",review:"Exact four-record AUTO [RC] family. At the end of the battle this exact Rear-Guard boosted, and only if its controller's Order Zone contains a Set Order, its controller may decline the [COST]; paying moves that exact booster into Soul before Counter Charge 1. This uses the rules permission to decline paying an AUTO ability's [COST]."},effects:[{op:"counter-charge",count:1}]};}
  function compileBoostedBattleEndSourceToSoulPowerDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: At the end of the batt?le this unit boosted, COST \[put this unit into (?:your )?soul\], choose one of your units, and it gets power \+(\d+) until end of turn\.$/i);if(!match)return null;return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],choicesReviewed:true,costs:[{type:"source-to-soul",count:1}],trigger:{status:"recognized-trigger",eventType:"battle.close-step",subject:"booster",circles:[]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosted-battle-close-source-to-soul-power-v1",review:"Exact RC AUTO wording, including the five source records' printed 'batle' typo. A close-step event must name this exact booster; its Soul cost is paid before choosing a friendly unit for the printed turn modifier."},effects:[{op:"modify-power-target",target:"chosen",amount:Number(match[1]),duration:"turn",targetFilter:{controller:"source-controller",cardType:"unit"}}]};
  }  function compileRidePhaseHandSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);if(!/^AUTO \[Hand\]: At the beginning of your ride phase, if your vanguard is grade 1 or less, COST \[discard this card\], look at the top five cards of your deck, choose up to one grade 2 or less card from among them, reveal it and put it into (?:your )?hand, and shuffle (?:(?:your|the) )?deck\.(?:\s*\(SHIFT[^\n]*\))*$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1",review:"Exact Hand AUTO: controller Ride Phase start, controller Vanguard grade 1 or less, exact source discarded from hand as cost, then optional top-five grade-2-or-less search and shuffle."},effects:[{op:"search-top-up-to-one-grade-to-hand",target:"controller",lookCount:5,maximumGrade:2}]};
  }  function compilePlacedCounterBlastTwoRetireLowGradeDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText),match=text.match(/^AUTO\s*:?\s*\[Counter Blast 2\] When this unit is placed on (VC|RC|VC or RC), (?:if you have an? [«<]([^»>]+)[»>] vanguard, )?you may pay the cost\. If you do, choose one of your opponent’s grade 2 or less rear-guards, and retire it\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1",review:"Exact VC, RC, or VC/RC placement AUTO with optional Counter-Blast 2 and an opponent Grade 2-or-lower Rear-Guard target. Existing structured target validation enforces controller, zone, grade, and exact selected target."},effects:[{op:"retire-target",target:"chosen",targetFilter:{controller:"opponent",zone:"rear-guard",maxGrade:2}}]};
  }  function compilePlacedRcRevealGradeThreeSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText),match=text.match(/^AUTO\s*:?\s*When this unit is placed on RC from hand, COST \[reveal a grade 3 card from hand\], search your deck for up to one grade 3 card with ["“]([^"”]+)["”] in its card name, reveal it and put it into your hand, shuffle your deck, choose a card from your hand, and discard it\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-from-hand-reveal-grade-three-search-name-discard-v1",review:"Exact RC-from-hand AUTO: source-specific placement, reveal an exact Grade 3 hand card as cost, optionally search the full deck for a Grade 3 card matching the printed name fragment, shuffle, then choose and discard from hand."},effects:[{op:"search-deck-named-grade-three-then-discard",target:"controller",grade:3,nameContains:match[1],discardCount:1}]};
  }  function compilePlacedVcPaidDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText),match=text.match(/^AUTO\s*:?[ ]*\[([^\]]+)\] When this unit is placed on (VC|RC|VC or RC), you may pay the cost\. If you do, draw (?:a|one|(\d+)) cards?\.$/i);if(!match)return null;
    const costs=parseAbilityCosts(`[${match[1]}]`);if(costs.status!=="supported-cost"||!costs.costs.some(cost=>cost.type==="counter-blast")||!costs.costs.some(cost=>cost.type==="soul-blast")||costs.costs.some(cost=>!["counter-blast","soul-blast"].includes(cost.type)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-placed-circle-counter-soul-draw-v1",review:"Structured exact placement AUTO with parsed Counter-Blast/Soul-Blast costs and a draw effect. The trigger parser retains the printed circle and exact source instance; costs are optional as written and are validated before drawing."},effects:[{op:"draw",count:match[3]?Number(match[3]):1}]};
  }  function compileVanguardPlacementDiscardDrawDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    if(kind!=="AUTO"||!/^AUTO\s+\[VC\]\s*:\s*When placed, COST \[discard a card from your hand\], and draw a card\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-placement-discard-draw-v1",review:"Exact [VC] AUTO. Only this source's Vanguard placement triggers; the required one-card hand discard is validated and paid before one card is drawn."},effects:[{op:"draw",count:1}]};
  }
  function compileVanguardPlacementDrawDiscardDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);if(!/^AUTO \[(?:VC|VC\/RC)\]: When placed, draw a card, and discard a card(?: from your hand)?\.(?: This ability may only be used by a card with the same card name once a turn\.)?$/i.test(text))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-placement-draw-discard-v1",review:"Exact AUTO text in 28 catalog records, including the concise discard wording. The source must actually enter its printed VC or VC/RC circle; the controller privately chooses a card after the draw, and draw then discard resolve in order. Same-name once-per-turn wording uses a shared name-and-ability usage key across all copies."},effects:[{op:"draw-then-discard",target:"controller",drawCount:1,discardCount:1}]};
  }  function compileContinuousLimitBreakAtThreeOrLessDefinition(cardId,abilityId,kind,printedText){if(kind!=="CONT"||!/^CONT \[RC\]: Your vanguard\u2019s "Limit Break 4" is active even when you have three or less damage\.$/i.test(normalizePrintedText(printedText)))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vanguard-limit-break-4-active-at-three-or-less-v1",review:"Exact RC CONT wording; this keyword enables the actual Vanguard's Limit Break 4 condition at three or less damage, without prompting or altering other damage thresholds."},keywords:["vanguard-limit-break-4-active-at-three-or-less"]};
  }  function compileSentinelKeywordDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText);
    if(!/^CONT:\s*Sentinel(?:\s*\((?:You may only have|You can only have) up to four cards with ["“]?(?:CONT:\s*)?Sentinel["”]? in (?:a|your) deck\.?\))?\.?$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-sentinel-keyword-v1",review:"Exact standalone Sentinel keyword and four-copy reminder variants compile as a CONT keyword; no manual activation or effect prompt is created."},keywords:["sentinel"]};
  }  function compileRideFromGradeNamedVanguardDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT:\s*This card can only be ridden from a grade (\d+) with ["“]([^"”]+)["”] in its card name\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-ride-from-grade-and-named-vanguard-v1",review:"Exact CONT ride restriction. This card is a legal ride candidate only when the current Vanguard has the printed grade and its card name contains the printed name fragment."},continuousRestrictions:[{type:"ride-from-grade-and-name",grade:Number(match[1]),name:match[2]}]};
  }  function compileCannotBeRiddenDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT:\s*This card cannot be ridden\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-card-cannot-be-ridden-v1",review:"Exact standalone CONT restriction in six catalog records. This card is not a legal ride candidate from any zone; it remains usable for calls or other non-ride movements."},keywords:["cannot-be-ridden"]};
  }
  function compileDragontreeRestrictedCallDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT:\s*This card cannot be ridden, and cannot be normal called to RC without any Dragontree markers\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-no-ride-normal-call-requires-dragontree-marker-v1",review:"Exact CONT restriction across five catalog records. This card cannot be ridden; its normal call from hand to RC is legal only while its controller already has a Dragontree marker on a Rear-Guard Circle. Superior calls are not restricted by this wording."},keywords:["cannot-be-ridden"],continuousRestrictions:[{type:"normal-call-requires-dragontree-marker"}]};
  }
  function compileHarmonyDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO\s*\[(?:VC|RC|VC\/RC)\]:\s*Harmony(?:\s*\(When (?:another of your units is placed on the same column as this unit, both units are in Harmony state until end of turn\.|your other unit is placed in the same column as this unit, both units become in harmony until end of turn\.?))?\)?\.?$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,trigger:{eventType:"card.placed",subject:"any"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-harmony-same-column-association-v1",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.45.pdf",review:"Exact Harmony keyword and reminder templates. The AUTO source must be a different unit controlled by the same player as the exact unit placed on the same column. The association lasts to turn end while both units remain on the field; it persists if they later move columns."},effects:[{op:"associate-harmony-units",target:"source-and-event-subject",duration:"turn"}]};
  }  function compileForerunnerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    if(!/^AUTO:\s*Forerunner(?:\s*\(When (?:(?:another|a) )?(?:unit|card) (?:(?:of|from) the same clan|with the same clan) rides this unit, you may (?:call (?:this unit|this card|it)|it) to (?:a )?\(?RC\)?\.?\))?\.?$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,trigger:{eventType:"card.ridden",subject:"ridden-unit",circles:["vanguard"]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-forerunner-same-clan-ride-call-source-v1",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",review:"Comprehensive Rules 4.52 §14.8 defines Forerunner as an optional AUTO when a unit of the same clan rides this exact unit. Rider clan and source instance are checked before queuing; accepting calls this source from Soul to an open Rear-Guard circle standing."},effects:[{op:"call-source-from-soul",target:"source",position:"stand"}]};
  }  function compileRideUponCallSoulDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO:\s*When rode upon, you may call this card to RC\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,trigger:{eventType:"card.ridden",subject:"event-subject",circles:["vanguard"]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rode-upon-optional-source-call-v1",review:"Exact optional ride-trigger wording in seven catalog abilities. The exact prior Vanguard instance is called from Soul to an open Rear-Guard circle standing; no Forerunner same-clan condition is inferred."},effects:[{op:"call-source-from-soul",target:"source",position:"stand"}]};
  }  function compileRideClanCallSourceDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    const match=text.match(/^(?:AUTO:\s*)?When another [<«]([^>»]+)[>»] rides this unit, you may call this card to RC\.$/i);
    const excluding=text.match(/^(?:AUTO:\s*)?When a [<«]([^>»]+)[>»] other than a card named ["“]([^"”]+)["”] rides this unit, you may call this card to RC\.$/i);
    if(!match&&!excluding)return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.ridden",subject:"ridden-unit",riderClan:(match||excluding)[1],...(excluding?{excludedRiderName:excluding[2]}:{})},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ridden-unit-clan-optional-source-call-v1",review:excluding?"Exact clan-and-excluded-name ride wording. Matches the ridden-upon source instance, rider clan, and excluded card name; accepting calls this source from Soul to an open Rear-Guard circle standing.":"Exact 14-card catalog family. Matches the ridden-upon source instance and the rider's printed clan separately; accepting calls this exact source from Soul to an open Rear-Guard circle standing."},effects:[{op:"call-source-from-soul",target:"source",position:"stand"}]};
  }
  function compileRideNamedGradeCallSourceDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    const exact=text.match(/^AUTO:\s*When this unit is rode upon by ["“]([^"”]+)["”], call this card to RC\.$/i);
    const grade=text.match(/^AUTO:\s*When this unit is rode upon by a grade (\d+) card with ["“]([^"”]+)["”] in its card name, call this card to RC\.$/i);
    if(!exact&&!grade)return null;
    const riderCondition=exact?{riderCardNameEquals:exact[1].trim()}:{riderGrade:Number(grade[1]),riderCardNameContains:grade[2].trim()};
    return{id:abilityId,cardId,kind,printedText,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.ridden",subject:"ridden-unit",circles:["vanguard"],...riderCondition},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rode-upon-named-grade-source-call-v1",review:exact?"Exact mandatory exact-name ride trigger. The ridden source must be the exact prior Vanguard instance now in Soul; the actual rider must be controlled by the same player and have the exact printed card name. The source is called standing to a legal Rear-Guard circle.":"Exact mandatory ride-trigger wording. The ridden source must be the exact prior Vanguard instance now in Soul; the actual rider must be controlled by the same player, have the exact printed grade, and contain the printed phrase in its card name. The source is called standing to a legal Rear-Guard circle."},effects:[{op:"call-source-from-soul",target:"source",position:"stand"}]};
  }
  function compileNamedRideDeckSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*When a card named ["“]([^"”]+)["”] rides this unit, search your deck for up to one card named ["“]([^"”]+)["”], reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.ridden",subject:"ridden-unit",circles:["vanguard"],riderCardNameEquals:match[1].trim()},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-named-rider-ride-source-search-v1",review:"Exact named-rider ride AUTO. Matches the exact previous Vanguard instance and exact named rider controlled by the same player, then permits a private choice of zero or one exact-name card from Deck, reveals any selected card, adds it to hand, and shuffles."},effects:[{op:"search-deck-same-name-to-hand",target:"controller",maximum:1,cardName:match[2].trim()}]};
  }
  function compileRideSourceTopSevenTwoNameSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*When a card named ["“]([^"”]+)["”] rides this unit, look at up to seven cards from the top of your deck, search for up to one card named ["“]([^"”]+)["”] or ["“]([^"”]+)["”] from among them, reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i);
    if(!match)return null;
    const rider=match[1].trim(),names=[match[2].trim(),match[3].trim()];
    return{id:abilityId,cardId,kind,printedText,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.ridden",subject:"ridden-unit",circles:["vanguard"],riderCardNameEquals:rider},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ridden-source-top-seven-two-name-search-v1",review:"Exact ride-trigger search template. The exact previous Vanguard instance and exact named rider are matched; the controller may choose zero or one of the two exact-name cards among the top seven, reveal it, add it to hand, and shuffle the deck."},effects:[{op:"search-top-up-to-one-filtered-to-hand",target:"controller",lookCount:7,maximum:1,filter:{cardNamesAny:names}}]};
  }
  function compileResistKeywordDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText);
    const exact=/^CONT\s*\[(?:VC|RC|GC)(?:\/(?:VC|RC|GC))*\]:\s*Resist(?:\s*\(This unit cannot be chosen by the effects? of your opponent[’']s cards?\.\))?\.?$/i;
    if(!exact.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-resist-keyword-v1",review:"Exact standalone Resist CONT keyword variants. Opponent effect target legality rejects this unit; this does not prevent non-targeting effects or targeting by its controller."},keywords:["resist"]};
  }  function compileRcCannotBeChosenDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT\s*\[RC\]:\s*This unit cannot be chosen by your opponent[’']s card effects?\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-cannot-be-chosen-by-opponent-v1",review:"Exact RC CONT text in seven catalog abilities. Compiled as the same targeting restriction expressed by Resist; it blocks only opponent effect choices and applies only while the source is on RC."},keywords:["resist"]};
  }  function compileGGuardianHealCostSubstituteDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT\s*\[Hand\]:\s*You may discard this card as a ["“]HEAL["”] for the cost of calling a G guardian\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-hand-g-guardian-heal-cost-substitute-v1",review:"Exact Hand CONT substitution. It makes only this card instance an eligible G-Guardian Heal cost while it is in hand; it creates no activation prompt."},keywords:["g-guardian-heal-cost-substitute"]};
  }
  function compileLegacyLimitBreakAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=String(printedText||""),reminder=text.match(/^(?:AUTO\s*)?(?:\[(VC|RC|VC\/RC)\]\s*)?Limit Break\s+(\d+)\s*\(This ability is active if you have\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+or more damage\):\s*When this unit attacks a vanguard, this unit gets power \+(\d+) until end of that battle\.$/i);
    const shorthand=text.match(/^AUTO\s*\[(VC|RC|VC\/RC)\]\s*Limit Break\s+(\d+)\s*:\s*When this unit attacks a vanguard, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(reminder&&printedNumberValue(reminder[2])===printedNumberValue(reminder[3])){return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-legacy-limit-break-vanguard-attack-power-v1",review:"Exact legacy reminder Limit Break attack template; source circle, damage threshold, target circle, and source instance are separately enforced."},effects:[{op:"modify-power",target:"source",amount:Number(reminder[4]),duration:"battle"}]}}
    if(!shorthand)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-legacy-limit-break-vanguard-attack-power-v1",review:"Exact shorthand Limit Break template; threshold comes from the printed shorthand and uses the rules damage count, with exact source circle, Vanguard target, and instance checks."},effects:[{op:"modify-power",target:"source",amount:Number(shorthand[3]),duration:"battle"}]};
  }
  function compileEmptyDamageZonePlacementDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    if(!/^AUTO\s*(?:\[RC\])?:\s*When this unit is placed on RC from hand, if your damage zone has no cards, put the top card of your deck into the damage zone\.$/i.test(String(printedText||"")))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-from-hand-empty-damage-deck-to-damage-v1",review:"Exact catalog wording checked across matching records; source-only RC placement from hand, empty damage-zone condition, and face-up movement are modeled. This does not create a damage-check event."},effects:[{op:"deck-to-damage",target:"controller",count:1}]};
  }
  function compileAutoRcPlacementChooseFriendlyPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO\s*(?:\[RC\])?:\s*(?:\[Counter Blast (\d+)\]\s*)?When this unit is placed on RC( from your deck)?, (?:you may pay the cost\. If you do, )?choose another of your (?:(?:grade (\d+) )?(?:[«<]([^»>]+)[»>]|units? with ["“]([^"”]+)["”] in its card name))(?: units?)?(?: [<]([^>]+)>)?, and that unit gets power \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    const targetFilter={controller:"source-controller",cardType:"unit",excludeSource:true};
    if(match[3]){targetFilter.minGrade=Number(match[3]);targetFilter.maxGrade=Number(match[3]);}
    if(match[4])targetFilter.clan=match[4];if(match[5])targetFilter.cardNameContains=match[5];if(match[6])targetFilter.race=match[6];
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-placement-choose-friendly-clan-power-turn-v1",review:"Exact RC placement AUTO: source instance must be placed on RC (and from deck where printed); optional Counter-Blast, source-excluding friendly unit target, clan/name/grade/race filters, and turn power are structured."},effects:[{op:"modify-power-target",target:"chosen",amount:Number(match[7]),duration:"turn",targetFilter,noOpIfNoLegalTargets:true}]};
  }
  function compileExactTemplateDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = String(printedText || "").match(/^(?:AUTO\s*)?(?:\[(VC|RC|VC\/RC)\])?:\s*When this unit attacks, this unit gets power \+(\d+) until (?:the )?end of (?:that|the) battle\.$/i);
    if (!match) return null;
    return {
      id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "auto-own-attack-power-battle-v1", review: "Exact own-attack text, including legacy lines without an AUTO label and the printed 'the end of the battle' variant; source identity, optional circle restriction, and battle-duration power are validated." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[2]), duration: "battle" }]
    };
  }
  function compileAutoLegionOwnAttackHitDrawDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const text = normalizePrintedText(printedText);
    if (!/^AUTO \[RC\]: When this unit(?:'|’)s attack hits a vanguard, if your vanguard is Legion, draw a card\.$/i.test(text)) return null;
    return {
      id: abilityId, cardId, kind, printedText, requiredLocation: ["rear-guard"],
      optional: false, choicesReviewed: true,
      trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", targetLocation: "vanguard", circles: [] },
      conditions: [{ type: "controller-vanguard-is-legion" }],
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-own-attack-hit-legion-draw-v1", review: "Exact five-card AUTO family. Only this exact Rear-Guard's attack hitting the opposing Vanguard qualifies; the controller's current Vanguard must be Legioned at eligibility and resolution. Draw resolves for the source controller." },
      effects: [{ op: "draw", target: "controller", count: 1 }]
    };
  }
  function compileAutoOwnAttackHitClanPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^(?:AUTO\s*)?\[RC\]:\s*When this unit(?:'|’|’)s attack hits a vanguard, choose one of your [«<]([^»>]+)[»>]\s*,?\s*and that unit gets power \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    const clan=match[1].trim(),amount=Number(match[2]);
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"attack.hit",subject:"source",targetLocation:"vanguard",circles:[]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-rc-own-attack-hit-clan-power-turn-v1",review:"Exact Rear-Guard AUTO wording. The exact source must attack and hit the opposing Vanguard; its controller then chooses a friendly unit of the printed clan and applies the printed power until end of turn."},effects:[{op:"modify-power-target",target:"chosen",amount,duration:"turn",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",cardType:"unit",clan}}]};
  }
  function compileOpponentAbilityRetirementSoulBlastDrawDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const text = normalizePrintedText(printedText).replace(/[’‘]/g, "'");
    const match = text.match(/^AUTO:\s*When this unit is retired from RC by your opponent's card's ability, COST \[Soul Blast (\d+)\], and draw a card\.$/i);
    if (!match) return null;
    return {
      id: abilityId, cardId, kind, printedText, requiredLocation: ["rear-guard"],optional: true, choicesReviewed: true,
      trigger: { status: "recognized-trigger", eventType: "card.retired", subject: "event-subject", sourceLocation: "rear-guard", destinationLocation: "drop", abilitySourceControllerRelation: "opponent", circles: [] },
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-retired-by-opponent-ability-soul-blast-draw-v1", review: "Exact four-card AUTO family. The exact source must leave RC by retirement into Drop, and structured event provenance must identify a different controller's card ability as the cause. Soul Blast is paid by the retired card's controller before that player draws." },
      effects: [{ op: "draw", target: "controller", count: 1 }]
    };
  }
  function compileAutoAttackSoulBlastPowerDefinition(cardId, abilityId, kind, printedText) {
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[(VC\/RC|VC|RC)\]:\s*\[Soul Blast (\d+)\]\s*When this unit attacks a vanguard, you may pay the cost\. If you do, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-soul-blast-power-battle-v1",review:"Exact own-source Vanguard attack, printed Soul Blast cost, optional decision, and battle-only power modifier."},effects:[{op:"modify-power",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileMandatoryAttackCounterBlastPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[(VC\/RC|VC|RC)\]:\s*When this unit attacks, COST \[Counter Blast (\d+)\],\s*this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-counter-blast-power-mandatory-battle-v1",review:"Exact source attack and circle are required. The printed Counter Blast is mandatory, checked before queueing, and paid before the battle-only power modifier."},effects:[{op:"modify-power",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileAutoOwnAttackEmptySoulPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[(VC\/RC|VC|RC)\]: When this unit attacks, (?:if you have an? [<«]([^>»]+)[>»] vanguard, )?if you do not have any cards in your soul, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-empty-soul-power-battle-v1",review:"Exact AUTO text: the exact source instance must attack; the controller's Soul must be empty, and the optional printed Vanguard clan condition is parsed separately before resolution."},effects:[{op:"modify-power",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileAutoOwnAttackHandConditionPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[(VC\/RC|VC|RC)\](?: Generation Break (\d+))?: When this unit attacks(?: a vanguard)?, if (the number of cards in your hand is (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten) or (?:more|greater)|the number of cards in your hand is (?:less than|greater than) your opponent[’']s), this unit gets power \+(\d+)(?: \/ critical \+(\d+))? until end of that battle\.$/i);
    if(!match)return null;
    const effects=[{op:"modify-power",target:"source",amount:Number(match[4]),duration:"battle"}];if(match[5])effects.push({op:"modify-critical",target:"source",amount:Number(match[5]),duration:"battle"});
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-hand-condition-power-battle-v1",review:"Exact AUTO attack template: source identity, printed attack target/circle, GB threshold, hand-size condition, and battle-scoped power/critical effects are modeled independently."},effects};
  }
  function compileAutoAttackCounterBlastPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = String(printedText || "").match(/^AUTO\s*\[(VC\/RC|VC|RC)\]:\s*\[Counter Blast (\d+)\]\s*When this unit attacks, you may pay the cost\. If you do, this unit gets power \+(\d+) until (?:the )?end of (that battle|this turn)\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "auto-own-attack-counter-blast-power-battle-v1", review: "Exact AUTO template: source circle, Counter Blast amount, optional payment, exact attacking source, and battle power modifier are parsed from printed text." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: match[4].toLowerCase() === "this turn" ? "turn" : "battle" }] };
  }
  function compileClanCounterBlastAttackPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const text = normalizePrintedText(printedText);
    const match = text.match(/^AUTO\s*\[VC\/RC\]:\s*\[Counter Blast (\d+)-«([^»]+)»\]\s*When this unit attacks, if you have an? «([^»]+)» vanguard, you may pay the cost\. If you do, this unit gets power \+(\d+) until (?:the )?end of that battle\.$/i);
    if (!match || match[2].trim().toLowerCase() !== match[3].trim().toLowerCase()) return null;
    const clan = match[2].trim();
    return { id: abilityId, cardId, kind, printedText, optional: true, choicesReviewed: true,
      requiredLocation: ["vanguard", "rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", turnRelation: "any", circles: ["vanguard", "rear-guard"] },
      conditions: [{ type: "controller-vanguard-has-clan", value: clan }],
      costs: [{ type: "counter-blast", count: Number(match[1]), filter: { clan } }],
      source: { dataset: "Cardfight Area snapshot", patternId: "auto-own-attack-clan-counter-blast-power-battle-v1", review: "Exact printed clan cost and Vanguard condition are preserved. The source instance must attack from VC/RC; a distinct face-up Damage card of the printed clan must be paid before applying battle-only power." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[4]), duration: "battle" }] };
  }
  function compileBoostedAttackHitDiscardDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    if(!/^AUTO\s*\[RC\]:\s*\[Choose a card from your hand, and discard it\]\s*When an attack hits during the battle that this unit boosted, you may pay the cost\. If you do, draw a card\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosting-unit-attack-hit-discard-draw-v1",review:"Exact booster instance and battle-hit event are matched; the optional one-card hand discard is paid before drawing one card."},effects:[{op:"draw",count:1}]};
  }
  function compileBoostedVanguardAttackCounterBlastDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const pattern=/^AUTO\s*\[RC\]\s*Generation Break (\d+) \(This ability is active if you have one or more face up G units(?: in total)? (?:on your VC and\/or G Zone|in total on your VC or G zone)\): \[Counter Blast 1\] When this unit attacks a vanguard, if this unit is boosted, you may pay the cost\. If you do, draw a card\.$/i;
    const match=String(printedText||"").match(pattern);
    if(!match||Number(match[1])!==1)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gb-boosted-vanguard-attack-counter-blast-draw-v1",review:"Exact Diviner, Kuroikazuchi catalog text. Own attack to Vanguard, exact booster evidence, GB1, Counter Blast 1, optional cost, and one-card draw are modeled."},effects:[{op:"draw",count:1}]};
  }
  function compilePlacedOnRearGuardSoulBlastDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO:\s*\[Soul Blast (\d+)\] When this unit is placed on RC, you may pay the cost\. If you do, draw a card\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-place-rc-soul-blast-draw-v1",review:"Exact AUTO template checked against six matching card records. Placement must be on RC, this unit must be the event source, Soul Blast cost must be payable, and the optional resolution draws one card."},effects:[{op:"draw",count:1}]};
  }
  function compilePlacedOnRearGuardSoulBlastClanDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*\[Soul Blast (\d+)\] When this unit is placed on RC, if you have a [«<]([^»>]+)[»>] vanguard, you may pay the cost\. If you do, draw a card\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-place-rc-soul-blast-clan-draw-v1",review:"Exact RC placement AUTO with a printed controller-Vanguard clan gate, optional Soul Blast cost, and one-card draw. The trigger must be the exact source instance entering RC; the clan condition is evaluated against the controller's current Vanguard."},effects:[{op:"draw",count:1}]};
  }
  function compileRearGuardAdvantageAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^(?:AUTO\s*)?\[(VC|RC|VC\/RC)\]:\s*When this unit attacks, (?:if the number of rear-guards (?:you have is more than your opponent[’']s|you have is greater than your opponent[’']s)|(?:if|and) you have more rear-guards than your opponent), this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-rear-guard-advantage-power-battle-v1",review:"Exact own-attack wording, including legacy lines without an AUTO label; source attack, VC/RC header, parsed live Rear-Guard comparison, and battle-duration power are separately validated."},effects:[{op:"modify-power",target:"source",amount:Number(match[2]),duration:"battle"}]};
  }
  function compileBoostSelfPowerOnBoostDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[RC\]:\s*When this unit boosts, this unit gets power \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-boost-turn-power-v1",review:"Exact RC source-boost event and own-source turn power. Battle aggregation includes the exact booster when the boost trigger resolves."},effects:[{op:"modify-power",target:"source",amount:Number(match[1]),duration:"turn"}]};
  }
  function compileBoostThenDeckReturnDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO \[RC\]: When this unit boosts, the boosted unit gets power \+(\d+) until end of that battle, and at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck\.$/i);
    if(!match)return null;
    const amount=Number(match[1]);
    if(!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],trigger:{status:"recognized-trigger",eventType:"unit.boosted",subject:"source",circles:[]},conditions:[],costs:[],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,optional:false,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boost-power-battle-then-return-self-end-phase-v1",review:"Exact AUTO [RC] source-boost wording. The exact booster grants the attack target +the printed power until battle end, then schedules this same instance to return to its owner's deck at the beginning of this turn's End Phase and shuffle."},effects:[{op:"modify-power-target",target:"boosted-unit",amount,duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit"}},{op:"schedule-source-return-to-deck-at-turn-end",target:"source",due:"end-phase-start",shuffle:true}]};
  }
  function compileLegionVanguardBoostPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When this unit boosts a vanguard, if your vanguard is Legion, the boosted unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,conditions:[{type:"controller-vanguard-is-legion"}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-boost-vanguard-legion-power-battle-v1",review:"Exact 14-record boost AUTO family. Requires this exact RC instance to be the booster, the actual boosted target to be the controller's Vanguard, and the live Vanguard instance to carry a Legion mate link; the power increase lasts only for that battle."},effects:[{op:"modify-power-target",target:"boosted-unit",amount:Number(match[1]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]};
  }
  function compileLegionOwnVanguardAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[VC\]: When this unit attacks a vanguard, if this unit is Legion, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],conditions:[{type:"source-is-legion"}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vc-own-attack-legion-power-battle-v1",review:"Exact VC AUTO family. The exact Vanguard instance must attack a Vanguard and currently have a Legion mate association; the printed power applies only for that battle."},effects:[{op:"modify-power",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileRearGuardOnLegionTurnPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When your vanguard Legion, this unit gets power \+(\d+) until end of turn\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-vanguard-legions-source-turn-power-v1",review:"Exact RC AUTO template. The event must identify the controller's exact Vanguard becoming Legioned; only this Rear-Guard source receives the printed power through turn end."},effects:[{op:"modify-power",target:"source",amount:Number(match[1]),duration:"turn"}]};
  }
  function compileRearGuardOwnAttackLegionPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When this unit attacks, if your vanguard is Legion, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditions:[{type:"controller-vanguard-is-legion"}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-own-attack-legion-power-battle-v1",review:"Exact RC AUTO family. This exact Rear-Guard must attack, its controller's current Vanguard must be Legioned, and the printed power applies only for that attack's battle."},effects:[{op:"modify-power",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileAutoBoostedByQualifiedUnitPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO(?: \[(VC\/RC|VC|RC)\])?:\s*When this unit is boosted by (?:a |an )?(?:[«<]([^»>]+)[»>]|a unit with ["“]([^"”]+)["”] in its card name), this unit gets power \+(\d+) until end of (?:that )?(battle|turn)\.$/i);
    if(!match)return null;
    const qualifier=match[2]||null,nameFragment=match[3]||null,amount=Number(match[4]),duration=match[5].toLowerCase()==="turn"?"turn":"battle";
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosted-by-qualified-unit-power-v1",review:"Exact AUTO belongs to the boosted source instance. The boost event must identify that exact target, while the separate booster instance is checked against the printed clan/race/name qualifier; power duration is parsed from the text."},effects:[{op:"modify-power",target:"source",amount,duration}]};
  }
  function compileBoostedByPowerThresholdCriticalDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\] Generation Break (\d+): When this unit is boosted by a unit with power of (\d+) or greater, this unit gets critical \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosted-by-power-threshold-critical-battle-v1",review:"Exact catalog wording ties the source to Rear-Guard, checks Generation Break, compares the actual booster instance power captured at the boost event, and applies critical only for that battle."},effects:[{op:"modify-critical",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileBoostedLimitBreakClanCounterBlastPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: \[Counter Blast (\d+)\] When this unit boosts a [«]([^»]+)[»] with Limit Break (\d+), you may pay the cost\. If you do, the boosted unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-boosts-clan-limit-break-counter-blast-power-v1",review:"Exact 15-card clan-specific AUTO family. The exact booster instance and boosted unit are bound by the boost event; the target must have the printed clan and an actual Limit Break ability of the printed threshold. Counter Blast is optional and the target receives battle-only power."},effects:[{op:"modify-power-target",target:"boosted-unit",amount:Number(match[4]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit"}}]};
  }
  function compileBoostedLimitBreakHitSoulDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^(?:AUTO\s*)?\[RC\]: \[Put this unit into your soul\] When an attack hits a vanguard during the battle that this unit boosted a [«<]([^»]+)[»>] with Limit Break (\d+), you may pay the cost\. If you do, draw a card\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],optional:true,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"attack.hit",subject:"booster",targetLocation:"vanguard",boostedUnitClan:match[1],boostedUnitLimitBreak:Number(match[2]),requiresBoostedBattle:true},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosted-limit-break-vanguard-hit-source-soul-draw-v1",review:"Exact RC AUTO family across 14 clan variants. The exact source must be the booster from the same battle; its boosted attacker must have the printed clan and Limit Break threshold, and that attack must hit a Vanguard. The optional cost moves only the source from RC to Soul before drawing one card."},effects:[{op:"draw",count:1}]};
  }
  function compileOwnAttackLimitBreakClanFieldPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^(?:AUTO\s*)?\[(VC\/RC|VC|RC)\]: When this unit attacks, if you have a [«<]([^»>]+)[»>] vanguard or rear-guard with Limit Break (\d+), this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    const circle=match[1].toUpperCase(),clan=match[2],threshold=Number(match[3]);
    return{id:abilityId,cardId,kind,printedText,requiredLocation:circle==="VC"?["vanguard"]:circle==="RC"?["rear-guard"]:["vanguard","rear-guard"],conditions:[{type:"controller-field-has-clan-limit-break",clan,count:threshold}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-clan-limit-break-field-power-battle-v1",review:"Exact 13-record own-attack AUTO family. The exact source instance must attack from its printed VC/RC circle; another field unit controlled by that player must have the printed clan and Limit Break threshold. The printed source power lasts only for this battle."},effects:[{op:"modify-power",target:"source",amount:Number(match[4]),duration:"battle"}]};
  }
  function compileBoostedClanVanguardHitReturnHandDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^(?:AUTO\s*)?\[RC\]: When an attack hits a vanguard during the battle that this unit boosted a [«<]([^»>]+)[»>], you may return this unit to your hand\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],optional:true,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"attack.hit",subject:"booster",targetLocation:"vanguard",boostedUnitClan:match[1],requiresBoostedBattle:true},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosted-clan-vanguard-hit-return-source-hand-v1",review:"Exact nine-card clan-variant AUTO family. The exact source must be the booster in the same battle, its attacker must match the printed clan, and that attack must hit a Vanguard. Accepting returns only this Rear-Guard source to its controller's hand."},effects:[{op:"move-source-to-hand",target:"source",from:"rear-guard"}]};
  }
  function compileAttackHitClanVanguardCounterChargeDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^(?:AUTO\s*)?\[(VC\/RC|VC|RC)\]: When this unit[’']s attack hits a vanguard, if you have a [«<]([^»>]+)[»>] vanguard, choose a card from your damage zone, and turn it face up\. \(Counter Charge (\d+)\)$/i);
    if(!match)return null;
    const circle=match[1].toUpperCase();
    return{id:abilityId,cardId,kind,printedText,requiredLocation:circle==="VC"?["vanguard"]:circle==="RC"?["rear-guard"]:["vanguard","rear-guard"],choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"attack.hit",subject:"source",targetLocation:"vanguard",circles:[]},conditions:[{type:"controller-vanguard-has-clan",value:match[2]}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-hit-clan-vanguard-counter-charge-v1",review:"Exact eight-record clan-gated AUTO family. The ability source's own attack must hit the opposing Vanguard, its controller's current Vanguard must match the printed clan, and the controller chooses a face-down Damage card for the printed Counter Charge amount."},effects:[{op:"counter-charge",count:Number(match[3])}]};
  }
  function compileUnboostedAttackSelfProtectionDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    if(kind!=="AUTO"||!/^AUTO\s*\[RC\]:\s*When this unit is attacked without being boosted, this unit cannot be hit until (?:the end of )?that battle\.?$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-attacked-unboosted-cannot-be-hit-v1",review:"Exact RC source as attacked target, unboosted-attacker event requirement, and current battle only."},effects:[{op:"protect-attacked-source",target:"source",duration:"battle"}]};
  }
  function compileRearGuardVanguardAttackSacrificeDrawPowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\] Generation Break 1: When your vanguard attacks, COST \[put this unit into your soul\], draw a card, and one of your vanguards gets power \+(\d+) until end of that battle\.$/i);if(kind!=="AUTO"||!match)return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-gb-vanguard-attack-sacrifice-draw-power-v1",review:"Exact RC/GB1 AUTO in 24 catalog records. The player's Vanguard attack is the trigger, the exact Rear-Guard pays by moving into Soul, then draw resolves before power is applied to the attacking friendly Vanguard."},effects:[{op:"draw",count:1},{op:"modify-power-target",target:"chosen",amount:Number(match[1]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]};
  }
  function compileNamedGradeVanguardAttackSacrificeDrawPowerDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    const match=text.match(/^AUTO \[RC\]: \[Put this unit into your soul\] When your vanguard attacks, if you have a grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name, you may pay the cost\. If you do, draw a card, choose one of your vanguards, and it gets power \+(\d+) until end of that battle\.$/i);
    if(kind!=="AUTO"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,conditions:[{type:"controller-vanguard-grade-at-least",count:Number(match[1])},{type:"controller-vanguard-name-contains",value:match[2]}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-named-grade-vanguard-attack-source-soul-draw-power-v1",review:"Exact Rear-Guard AUTO in 17 catalog records. The controller's Vanguard attack triggers it; current Vanguard grade and name are checked from live state, and only the exact source Rear-Guard may pay its optional source-to-Soul cost before draw and chosen Vanguard battle power."},effects:[{op:"draw",count:1},{op:"modify-power-target",target:"chosen",amount:Number(match[3]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]};
  }
  function compileGradeNamedVanguardAttackSacrificeDrawPowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When your grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name attacks, COST \[put this unit into (?:your )?soul\], draw a card, choose one of your vanguards, and it gets power \+(\d+) until end of that battle\.$/i);
    if(kind!=="AUTO"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,conditions:[{type:"controller-vanguard-grade-at-least",count:Number(match[1])},{type:"controller-vanguard-name-contains",value:match[2]}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-grade-named-vanguard-attack-sacrifice-draw-power-v1",review:"Exact 24-record family. The controller's exact Vanguard attack is the trigger; the live Vanguard must meet the printed minimum grade and name substring. The source RC pays its optional Soul cost before drawing and selecting a friendly Vanguard for battle-only power."},effects:[{op:"draw",count:1},{op:"modify-power-target",target:"chosen",amount:Number(match[3]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]};
  }
  function compileOwnAttackHitClanRearGuardDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[VC\/RC\]: When this unit[’']s attack hits a vanguard, if you have four or more other [«<]([^»>]+)[»>] rear-guards, draw a card\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,choicesReviewed:true,conditions:[{type:"controller-other-rear-guards-of-clan-at-least",count:4,clan:match[1]}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-vanguard-hit-clan-rear-guards-draw-v1",review:"Exact nine-card AUTO family. The exact source instance must be the attacker, the attack must hit a Vanguard, and four other current controller Rear-Guards must each match the printed clan before the mandatory draw."},effects:[{op:"draw",count:1}]};
  }
  function compileGuardianConditionalHandDiscardProtectionDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO:\s*When this unit is put on GC, choose one of your units, and it cannot be hit until end of that battle\. If your hand has two or more cards, choose a card from (?:your )?hand, and discard it\.$/i.test(normalizePrintedText(printedText)))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-protect-then-conditional-discard-v1",review:"Exact AUTO variants in 63 catalog records. The GC source's protection resolves first; a separate hand-discard effect occurs only if the controller has at least two cards when that effect resolves."},effects:[{op:"protect-target",target:"chosen",duration:"battle",requiresAttackedTarget:true,targetFilter:{controller:"source-controller",cardType:"unit",mustBeAttacked:true}},{op:"discard-from-hand",target:"controller",count:1,condition:{op:"hand-count-at-least",count:2}}]};
  }
  function compileGuardianPlacedDiscardProtectionDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO\s*\[GC\]:\s*When placed, COST \[discard a card from your hand\], and one of your units cannot be hit until end of that battle\.$/i.test(normalizePrintedText(printedText)))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-when-placed-discard-protect-unit-v1",review:"Exact [GC] shorthand template in 92 catalog records. Trigger requires this source instance to enter Guardian Circle; the controller pays one discard and selects a friendly unit for battle-duration protection."},effects:[{op:"protect-target",target:"chosen",duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit"}}]};
  }
  function compileGuardianNoGradeThreeRideChoiceDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);if(!/^AUTO:\s*When this unit is put on GC from hand, if you did not ride a grade 3 or greater unit this fight, perform one of the following\. • Choose one of your vanguards, and it gets power \+10000 until end of turn\. • Choose one of your opponent[’']s units, and it gets critical -2 until end of that battle\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,conditions:[{type:"controller-has-not-ridden-grade-three-plus-this-fight"}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-no-grade-three-ride-choice-v1",review:"Exact 27-card GC AUTO wording. Requires the exact source to be placed on GC from hand and the controller's fight-level ride history to explicitly show no Grade 3+ ride. The controller chooses exactly one effect: +10000 to a friendly Vanguard until end of turn, or -2 critical to one opponent unit for this battle."},effects:[{op:"g-guardian-grade-three-replacement-choice",target:"controller",choices:[{id:"vanguard-power",amount:10000,targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}},{id:"opponent-critical",amount:-2,targetFilter:{controller:"opponent",cardType:"unit"}}]}]};
  }
  function compileGuardianAttackedUnitProtectionDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText),match=text.match(/^AUTO(?:\s*\[GC\])?:\s*\[([^\]]+)\]\s*When this unit is placed on GC(?: from hand)?,\s*you may pay the cost\. If you do, choose (?:one|up to one) of your (.+?) that (?:is|are) being attacked, and (?:that unit|it) cannot be hit until end of that battle\.$/i);if(!match)return null;const cost=parseAbilityCosts(`[${match[1]}]`);if(cost.status!=="supported-cost"||cost.costs.reduce((sum,item)=>sum+item.count,0)!==1)return null;const description=match[2].trim(),clan=description.match(/^[«<]([^»>]+)[»>]$/)?.[1]?.trim()||null,vanguard=/^vanguards?$/i.test(description);if(!clan&&!/^(?:units?|vanguards?)$/i.test(description))return null;const targetFilter={controller:"source-controller",cardType:"unit",...(clan?{clan}:{}),...(vanguard?{zone:"vanguard"}:{}),mustBeAttacked:true};return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-discard-protect-attacked-unit-v1",review:"Exact Guardian Circle variant. The source must be placed on GC, its printed discard cost is validated (including any clan filter), and target selection is restricted to the actual attacked friendly unit for this battle."},effects:[{op:"protect-target",target:"chosen",duration:"battle",requiresAttackedTarget:true,targetFilter}]};
  }
  // Recompile the same exact template with the source card's printed type line
  // available. A bracketed trait is a clan when it matches the card's clan;
  // otherwise a trait printed after the clan/nation is a race (for example,
  // Zodiac Time Beast). Keep the typed filter in both its payment and target.
  function compileGuardianAttackedUnitProtectionDefinition(cardId,abilityId,kind,printedText,cardContext){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO(?:\s*\[GC\])?:\s*\[([^\]]+)\]\s*When this unit is placed on GC(?: from hand)?,\s*you may pay the cost\. If you do, choose (?:one|up to one) of your (.+?) that (?:is|are) being attacked, and (?:that unit|it) cannot be hit until end of that battle\.$/i);
    if(!match)return null;
    const parsedCost=parseAbilityCosts(`[${match[1]}]`);
    if(parsedCost.status!=="supported-cost"||parsedCost.costs.reduce((sum,item)=>sum+item.count,0)!==1)return null;
    const trait=match[2].trim().match(/^[«<]([^»>]+)[»>]$/)?.[1]?.trim()||null,vanguard=/^vanguards?$/i.test(match[2].trim());
    if(!trait&&!/^(?:units?|vanguards?)$/i.test(match[2].trim()))return null;
    const header=(String(cardContext?.text||"").split(/\r?\n/).map(item=>item.trim()).find(Boolean)||"").split("/").map(item=>item.trim().toLocaleLowerCase());
    const clans=[cardContext?.clan,...(cardContext?.clans||[])].filter(Boolean).map(item=>String(item).trim().toLocaleLowerCase());
    const traitKey=value=>clans.includes(value.toLocaleLowerCase())||header[0]===value.toLocaleLowerCase()?"clan":header.slice(1).includes(value.toLocaleLowerCase())?"race":"clan";
    const costs=parsedCost.costs.map(cost=>cost.filter?.clan?{...cost,filter:{[traitKey(cost.filter.clan)]:cost.filter.clan}}:cost);
    const targetFilter={controller:"source-controller",cardType:"unit",...(trait?{[traitKey(trait)]:trait}:{}),...(vanguard?{zone:"vanguard"}:{}),mustBeAttacked:true};
    return{id:abilityId,cardId,kind,printedText,costs,costsReviewed:true,optional:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-discard-protect-attacked-unit-v1",review:"Exact Guardian Circle variant. The source must be placed on GC, its printed clan or race discard cost is validated, and target selection is restricted to the actual attacked friendly unit for this battle."},effects:[{op:"protect-target",target:"chosen",duration:"battle",requiresAttackedTarget:true,targetFilter}]};
  }
  function compileGuardianNamedDropCounterChargeDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText),match=text.match(/^AUTO:\s*When this unit is placed on GC from hand, COST \[discard a card from hand\], choose one of your vanguards being attacked, and it cannot be hit until end of that battle\. If your drop has (?:a card named\s*|a\s*)["“]([^"”]+)["”], Counter Charge 1\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1",review:"Exact named-drop GC family. Requires this source to enter GC from hand, pays the printed discard, protects only the controller's Vanguard currently being attacked, and resolves Counter Charge afterward only when the named card is in the Drop."},requiredLocation:["guardian"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["guardian"],sourceLocation:"hand"},effects:[{op:"protect-target",target:"chosen",duration:"battle",requiresAttackedTarget:true,targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard",mustBeAttacked:true}},{op:"conditional-counter-charge",target:"controller",count:1,condition:{type:"controller-drop-has-card-name",cardName:match[1]}}]};
  }
  function compileGuardianSentinelProtectionDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    if(kind!=="AUTO"||!/^AUTO\b/i.test(text)||!/\bwhen this unit (?:is )?(?:placed on|put (?:on|into)) (?:your )?(?:GC|guardian circle)\b/i.test(text))return null;
    const costClan=text.match(/\[choose (?:a|one) [«<]([^»>]+)[»>] from (?:your )?hand, and discard it\]/i)?.[1]?.trim()||null;
    const costAllowed=/\[(?:discard a card from (?:your )?hand|choose a card from (?:your )?hand, and discard it)\]/i.test(text)||Boolean(costClan);
    const target=text.match(/choose one of your (?:[«<]([^»>]+)[»>]|units?), and (?:(?:that unit|it) )?cannot be hit until end of (?:that )?battle\.?$/i);
    const namedTarget=text.match(/choose one of your units with ["“]([^"”]+)["”] in its card name, and (?:that unit|it) cannot be hit until end of that battle\.?$/i);
    if(!costAllowed||(!target&&!namedTarget))return null;
    const targetClan=target?.[1]?.trim()||null,targetNameContains=namedTarget?.[1]?.trim()||null;
    if(targetNameContains&&!/^AUTO:\s*\[choose a card from your hand, and discard it\]\s*When this unit is placed on GC from hand, you may pay the cost\. If you do, choose one of your units with ["“][^"”]+["”] in its card name, and it cannot be hit until end of that battle\.$/i.test(text))return null;
    const targetFilter={controller:"source-controller",cardType:"unit",...(targetClan?{clan:targetClan}:{}),...(targetNameContains?{cardNameContains:targetNameContains}:{})};
    if(!targetNameContains)return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-sentinel-protect-friendly-unit-v1",review:"Exact self-placement on Guardian Circle, validated one-card discard and target clan filters, and chosen friendly unit protected for this battle."},effects:[{op:"protect-target",target:"chosen",duration:"battle",targetFilter}]};
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,requiredLocation:["guardian"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["guardian"],sourceLocation:"hand"},costs:[{type:"discard",count:1}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-sentinel-protect-friendly-unit-name-filter-v1",review:"Exact Guardian Circle sentinel protection. The exact source must be placed on GC from hand, its optional one-card hand discard is paid by its controller, and the chosen friendly target must contain the printed card-name substring before it is protected for the battle."},effects:[{op:"protect-target",target:"chosen",duration:"battle",targetFilter}]};
  }
  function compileAttackedSelfBattlePowerDefinition(cardId,abilityId,kind,printedText){
    const match=String(printedText||"").match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit is attacked, this unit gets power \+(\d+) until the end of that battle\.$/i);
    if(kind!=="AUTO"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-attacked-source-battle-power-v1",review:"Exact attacked unit, its printed VC/RC scope, and a battle-only increase to the active attack's defending target power."},effects:[{op:"modify-defending-source-power",target:"source",amount:Number(match[2]),duration:"battle"}]};
  }
  function compileAttackGradeThresholdPowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit attacks a grade (\d+) or greater unit, this unit gets power \+(\d+) until end of that battle\.(?: \(SHIFT \+ left click to get a Persona Shield ticket\))?$/i);
    if(kind!=="AUTO"||!match)return null;
    const circle=match[1].toUpperCase(),requiredLocation=circle==="VC"?["vanguard"]:circle==="RC"?["rear-guard"]:["vanguard","rear-guard"];
    return{id:abilityId,cardId,kind,printedText,requiredLocation,trigger:{status:"recognized-trigger",eventType:"unit.attacked",subject:"source",circles:requiredLocation},conditions:[{type:"attack-target-grade-at-least",count:Number(match[2])}],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-target-grade-power-battle-v1",review:"Exact own attacker and target-unit grade threshold are checked at trigger time; UI-only Persona Shield reminder text is retained and ignored mechanically."},effects:[{op:"modify-power",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileOwnAttackOpponentRearGuardCapPowerDefinition(cardId,abilityId,kind,printedText){
    const match=String(printedText||"").match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(kind!=="AUTO"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-opponent-rearguard-cap-power-battle-v1",review:"Exact own-source attack text; the opponent's live Rear-Guard count is checked and only this attacker receives the battle power."},effects:[{op:"modify-power",target:"source",amount:Number(match[2]),duration:"battle"}]};
  }
  function compileOwnAttackHandAdvantagePowerDefinition(cardId,abilityId,kind,printedText){
    const match=String(printedText||"").match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit attacks, if the number of cards in your hand is greater than your opponent[’']s, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(kind!=="AUTO"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-own-attack-hand-advantage-power-battle-v1",review:"Exact own-source attack template; live hand counts are compared at trigger time and the battle modifier is applied to the attacking source."},effects:[{op:"modify-power",target:"source",amount:Number(match[2]),duration:"battle"}]};
  }
  function compileRidePhaseDiscardSoulBlastDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO:\s*When this card is discarded from hand during your ride phase, COST \[Soul Blast 2\], and draw a card\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ride-phase-discard-soul-blast-draw-v1",review:"Exact discarded card, hand source, Ride phase, Soul Blast 2, and one draw."},effects:[{op:"draw",count:1}]};
  }
  function compileRidePhaseDiscardBottomDeckDrawDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:?\s*When this card is discarded from hand during your ride phase, COST \[Soul Blast (\d+)\s*&\s*put this card on the bottom of (?:your )?deck\], and draw a card\.$/i);
    if(kind!=="AUTO"||!match||Number(match[1])<1)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1",review:"Exact Ride Phase discard trigger. Requires this exact instance discarded from hand during its controller's Ride Phase, pays Soul Blast and returns that source from Drop to deck bottom as costs before drawing one card."},effects:[{op:"draw",count:1}]};
  }
  function compileGuardianSecondAttackShieldDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:?\s*When this unit is put on GC, if your opponent.{0,2}s attacking unit has attacked two or more times this turn, this unit gets shield \+(\d+) until end of that battle\. \(Active if this battle is its second attack this turn or more\)$/i);
    if(kind!=="AUTO"||!match||!positiveInteger(match[1]))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-opponent-second-attack-shield-v1",review:"Exact AUTO trigger on Guardian Circle placement. Eligibility checks the current opposing attacker’s per-turn count before resolving; the shield modifier applies only to the current battle."},effects:[{op:"modify-shield-source",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileGuardianCallTopFiveDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:?\s*(?:\[GC\]\s*)?(?:\[Counter Blast (\d+)\]\s*)?When this unit is placed on GC from (?:your )?hand, you may pay the cost\. If you do, call (\d+|one|two|three|four|five|six|seven|eight|nine|ten) cards from the top of your deck to GC at rest\.$/i);
    if(kind!=="AUTO"||!match||printedNumberValue(match[2])<1||printedNumberValue(match[2])>10||Number(match[1]||1)!==1)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-counter-blast-call-top-to-guardian-v1",review:"Exact GC placement-from-hand trigger and optional Counter Blast 1; calls up to the printed number of top deck cards at rest, adds their shield to the current defense, and emits an exact placement event for each called card."},effects:[{op:"call-top-to-guardian",target:"controller",count:printedNumberValue(match[2]),destination:"guardian",position:"rest"}]};
  }
  function compileGuardianClanTopFiveDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:?\s*\[Counter Blast (\d+)\]\s*When this unit is placed on GC from (?:your )?hand, if you have (?:a|an) [«<]([^»>]+)[»>] vanguard, you may pay the cost\. If you do, reveal five cards from the top of your deck(?:,|\.)\s*call all [«<]([^»>]+)[»>] (?:from among them )?to GC (?:at rest|as rest),? and put the rest into (?:(?:your|the) )?drop zone\.$/i);
    if(!match||Number(match[1])<1||match[2].trim().toLocaleLowerCase()!==match[3].trim().toLocaleLowerCase())return null;
    const clan=match[2].trim();
    return{id:abilityId,cardId,kind,printedText,optional:true,requiredLocation:["guardian"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["guardian"],sourceLocation:"hand"},conditions:[{type:"controller-vanguard-has-clan",value:clan}],costs:[{type:"counter-blast",count:Number(match[1])}],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-clan-top-five-to-guardian-rest-drop-v1",review:"Exact optional Counter-Blast AUTO on the exact source card placed from hand on GC. It checks the controller's Vanguard clan, reveals up to five cards, calls every Unit of that exact clan to Guardian at rest, and puts the remaining revealed cards into Drop; clan wording must match between condition and effect."},effects:[{op:"call-filtered-top-to-guardian-drop",target:"controller",count:5,destination:"guardian",position:"rest",filter:{clan},remainder:"drop"}]};
  }
  function compileGuardianDropToSoulDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    if(kind!=="AUTO"||!/^AUTO:\s*When this unit is put into the drop zone from GC, put this card into your soul\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-drop-self-to-soul-v1",review:"Exact source instance moves from GC to Drop; the effect only moves that same card from its controller's Drop to Soul."},effects:[{op:"move-source-to-soul",target:"source",from:"drop"}]};
  }
  function compileOptionalGuardianRetireToSoulDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^(?:AUTO:\s*)?When (?:this unit is )?retired from GC, you may put this card into (?:your )?soul\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-retire-optional-source-to-soul-v1",review:"Exact optional AUTO wording in six catalog records. It requires this exact unit to move from Guardian Circle to Drop by retirement; declining leaves it in Drop, while accepting moves only that instance to Soul."},effects:[{op:"move-source-to-soul",target:"source",from:"drop"}]};
  }
  function compileDamageCheckRevealDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO:\s*When this card is revealed during your damage check, draw a card\.$/i.test(String(printedText||"")))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-self-revealed-damage-check-draw-v1",review:"Exact real-card trigger/effect text. The revealed card is the event subject, so other cards and copies do not trigger from the same check."},effects:[{op:"draw",count:1}]};
  }
  function compileHandStrideCostTreatedGradeThreeDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText),match=/^CONT \[Hand\]: While (?:you are )?paying the cost for \[?Stride\]?, this card may be discarded as a grade 3\.$/i.test(text)||/^CONT \[Hand\]: When this card would be discarded, it may be discarded as a grade 3\.$/i.test(text);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-hand-stride-cost-treated-grade-three-v1",review:"Exact Hand CONT replacement variants; the card may count as grade 3 only when selected as a Stride cost, not for ordinary grade checks."},effects:[{op:"continuous-grade",target:"source",amount:3,duration:"stride-payment",condition:{op:"paying-stride-cost"},mode:"treat-as-grade-three"}]};
  }
  function compileHandStrideCostGradeBoostDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=String(printedText||"").match(/^CONT \[Hand\]: While (?:you are )?paying the cost for Stride, this card gets grade \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-hand-stride-cost-grade-boost-v1",review:"Exact Hand CONT ability applies only during the player's Stride cost payment; the modifier does not affect ordinary grade checks."},effects:[{op:"continuous-grade",target:"source",amount:Number(match[1]),duration:"stride-payment",condition:{op:"paying-stride-cost"}}]};
  }
  function compileRideDeckStrideDiscardDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO: When this card is discarded from hand while riding a grade 3 from the ride deck or paying the cost for Stride, draw a card\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:false,conditions:[],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,costs:[],trigger:{status:"recognized-trigger",eventType:"card.discarded",subject:"source",sourceLocation:"hand",destinationLocation:"drop",discardReasons:["ride-deck-grade-three-cost","stride-cost"],turnRelation:"controller"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ride-deck-or-stride-cost-discard-draw-v1",review:"Exact six-record AUTO wording. Requires this exact hand card to be discarded for one of the two printed costs by its controller; the trigger effect draws one card. Ride Deck cost event generation is not implemented by the current authoritative server and remains an explicit coverage gap."},effects:[{op:"draw",count:1}]};
  }
  function compileStrideCostDiscardDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO: When this card is discarded from hand while paying the cost for Stride, draw a card\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,optional:false,conditions:[],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,costs:[],trigger:{status:"recognized-trigger",eventType:"card.discarded",subject:"source",sourceLocation:"hand",destinationLocation:"drop",discardReason:"stride-cost",requiredPhase:"stride",turnRelation:"controller"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-stride-cost-discard-draw-v1",review:"Exact Stride-cost AUTO. The exact source instance must move from its controller's hand to Drop because it was discarded while paying Stride; it resolves for that same controller and draws one card. Other discard causes, phases, copies, and players do not qualify."},effects:[{op:"draw",count:1}]};
  }
  function compileGZoneUnflipFreeStrideDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT \[G Zone\]: This card cannot be turned face up by abilities\. If this card is face up, you can Stride without paying the Stride cost\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["g-zone"],choicesReviewed:true,freeStrideWhenFaceUp:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-gzone-unflip-free-stride-v1",review:"Exact CONT G Zone wording. Ability-originated face-up changes are prohibited and this exact face-up G-zone instance permits its controller to Stride without a cost."},continuousRestrictions:[{type:"g-zone-cannot-turn-face-up-by-abilities"}]};
  }
  function compileGuardianCircleOpponentGradeShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=String(printedText||"").match(/^CONT \[GC\]: If your opponent[’']s vanguard is grade (\d+) or greater, this unit gets shield \+(\d+)\.$/i);
    if(!match)return null;
    const grade=Number(match[1]),amount=Number(match[2]);
    if(!Number.isInteger(grade)||grade<0||!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-gc-opponent-grade-shield-v1",review:"Exact GC continuous text; only the defending player's opponent Vanguard grade is checked while the exact card is on GC."},effects:[{op:"continuous-shield",target:"source",amount,duration:"continuous",condition:{op:"opponent-vanguard-grade-at-least",grade}}]};
  }
  function compileGuardianCircleLowerGradeShieldAutoDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*When this unit is put on GC, if your vanguard[’']s grade is less than your opponent[’']s vanguard[’']s grade, this unit gets shield \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["guardian"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-controller-vanguard-lower-grade-shield-v1",review:"Exact GC placement AUTO in six catalog records. The source instance must enter Guardian Circle; eligibility compares the controller and opponent Vanguard grades and the shield applies only to the current battle."},trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["guardian"]},conditions:[{type:"controller-vanguard-grade-lower-than-opponent"}],effects:[{op:"modify-shield-source",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileGuardianQualifyingCriticalShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText).replace(/[’‘]/g,"'");
    if(!/^AUTO:\s*When this unit is put on GC, if the attacking unit's critical is 2 or greater, and its critical is increased by an ability other than trigger effect or its original critical is 2 or greater, this unit gets shield \+15000 until end of that battle\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["guardian"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-gc-qualifying-critical-shield-battle-v1",review:"Exact Guardian Circle AUTO template. The current attacker must have critical at least two and that value must come from a non-trigger ability modifier or original critical of two or more."},trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["guardian"]},effects:[{op:"modify-shield-source",target:"source",amount:15000,duration:"battle"}]};
  }
  function compileContinuousGcGenerationBreakShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[GC\] Generation Break (\d+): This unit gets shield \+(\d+)\.$/i);
    if(!match)return null;
    const generationBreak=Number(match[1]),amount=Number(match[2]);if(!positiveInteger(generationBreak)||!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-gc-generation-break-shield-v1",review:"Exact Guardian Circle Generation Break shield template in four catalog records. The printed GB threshold is checked against the controller's current face-up G units, and the modifier applies only while the exact card is a guardian."},effects:[{op:"continuous-shield",target:"source",amount,duration:"continuous",condition:{op:"generation-break",count:generationBreak}}]};
  }
  function compileOpponentCheckTriggerPowerShieldDefinition(cardId,abilityId,kind,printedText){if(kind!=="CONT")return null;const text=normalizePrintedText(printedText);if(!/^CONT \[RC\/GC\]: If your opponent[’']s drive check or damage check revealed a trigger unit this turn, this unit gets power \+10000 \/ shield \+10000\.$/i.test(text))return null;const condition={op:"opponent-trigger-revealed-this-turn"};return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard","guardian"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-gc-opponent-check-trigger-power-shield-v1",review:"Exact dual-circle CONT wording in seven catalog ability blocks. A structured drive- or damage-check event marks only the checking player's opponent for the active turn; power applies only on RC, shield only on GC, and the fact expires at turn transition."},effects:[{op:"continuous-power",target:"source",amount:10000,duration:"continuous",location:"rear-guard",condition},{op:"continuous-shield",target:"source",amount:10000,duration:"continuous",location:"guardian",condition}]};}
  function compileContinuousOpponentGradeOrDamagePowerShieldDefinition(cardId,abilityId,kind,printedText){if(kind!=="CONT")return null;const text=normalizePrintedText(printedText),match=text.match(/^CONT \[RC\/GC\]: If your vanguard[’']s grade is less than your opponent[’']s vanguard[’']s grade, or your damage zone has four or more cards, this unit gets power \+(\d+) \/ shield \+(\d+)\. \(Active on opponent[’']s turn too\)$/i);if(!match)return null;const condition={op:"any",conditions:[{op:"controller-vanguard-grade-less-than-opponent"},{op:"controller-damage-at-least",count:4}]};return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard","guardian"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-gc-vanguard-grade-or-damage-power-shield-v1",review:"Exact OR-condition dual-circle CONT template in six catalog abilities. A reusable condition tree checks controller-versus-opponent Vanguard grade or damage count independently; power and shield effects are separately scoped to RC and GC."},effects:[{op:"continuous-power",target:"source",amount:Number(match[1]),duration:"continuous",location:"rear-guard",condition},{op:"continuous-shield",target:"source",amount:Number(match[2]),duration:"continuous",location:"guardian",condition}]};}
  function compileContinuousOpponentGradePowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: During your turn, if your opponent[’']s vanguard is grade (\d+) or greater, this unit gets power \+(\d+)\.$/i);
    if(kind!=="CONT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-opponent-vanguard-grade-power-v1",review:"Exact RC CONT requirement; opponent Vanguard grade threshold and controller-turn restriction are checked independently."},effects:[{op:"continuous-power",target:"source",amount:Number(match[2]),duration:"continuous",condition:{op:"opponent-vanguard-grade-at-least",grade:Number(match[1]),controllerTurn:true}}]};
  }
  function compileContinuousControllerGradePowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: If your vanguard is grade (\d+) or greater, this unit gets power \+(\d+)\.$/i);
    if(kind!=="CONT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-controller-vanguard-grade-power-v1",review:"Exact RC CONT requirement; uses controller Vanguard grade continuously on either player's turn, without an added turn restriction."},effects:[{op:"continuous-power",target:"source",amount:Number(match[2]),duration:"continuous",condition:{op:"controller-vanguard-grade-at-least",grade:Number(match[1])}}]};
  }
  function compileContinuousOwnTurnNamedGradeVanguardPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: During your turn, if you have a (?:grade (\d+) or greater )?vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    const conditions=[{op:"controller-turn"}];if(match[1])conditions.push({op:"controller-vanguard-grade-at-least",grade:Number(match[1])});conditions.push({op:"controller-vanguard-card-name-contains",name:match[2]});const condition={op:"all",conditions};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-own-turn-named-grade-vanguard-power-v1",review:"Exact RC CONT template. Requires the controller's turn and printed Vanguard name substring, plus the printed grade threshold where stated; the source receives only the printed continuous power."},effects:[{op:"continuous-power",target:"source",amount:Number(match[3]),duration:"continuous",condition}]};
  }
  function compileContinuousNamedVanguardPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: If you have a vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-rc-named-vanguard-power-v1",review:"Exact RC CONT template. The modifier applies on either player's turn only while the source remains on RC and its controller's Vanguard name contains the exact printed phrase; no grade or turn restriction is added."},effects:[{op:"continuous-power",target:"source",amount:Number(match[2]),duration:"continuous",condition:{op:"controller-vanguard-card-name-contains",name:match[1]}}]};
  }
  function compileContinuousNamedGradeThreeVanguardPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText).replace(/[’‘]/g,"'");
    const match=text.match(/^CONT \[RC\]: If you have a grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+)\. \(Active on opponent's turn too\)$/i);
    if(!match||!match[2].trim())return null;
    const grade=Number(match[1]),amount=Number(match[3]);
    if(!Number.isInteger(grade)||grade<0||!positiveInteger(amount))return null;
    const condition={op:"all",conditions:[{op:"controller-vanguard-grade-at-least",grade},{op:"controller-vanguard-card-name-contains",name:match[2].trim()}]};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-rc-named-grade-vanguard-power-both-turns-v1",review:"Exact RC CONT condition tree. Both the printed minimum Vanguard grade and quoted name substring must hold continuously; the explicit opponent-turn reminder means no controller-turn restriction is added."},effects:[{op:"continuous-power",target:"source",amount,duration:"continuous",condition}]};
  }
  function compileContinuousBoostedNamedVanguardPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: During the battle this unit boosted, if you have a grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    const condition={op:"all",conditions:[{op:"source-boosted-this-battle"},{op:"controller-vanguard-grade-at-least",grade:Number(match[1])},{op:"controller-vanguard-card-name-contains",name:match[2]}]};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-boosted-named-grade-vanguard-power-battle-v1",review:"Exact RC CONT text. The power applies only to this exact booster during the battle in which it boosted; controller Vanguard name substring and minimum grade are both checked from current match state."},effects:[{op:"continuous-power",target:"source",amount:Number(match[3]),duration:"continuous",condition}]};
  }
  function compileContinuousBoostedSourcePowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: During the battle it boosted, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-rc-boosted-source-power-battle-v1",review:"Exact RC CONT template. This exact Rear-Guard gains the printed power only when it is the booster in the current battle; its power bonus contributes to the boosted unit's attack."},effects:[{op:"continuous-power",target:"source",amount:Number(match[1]),duration:"continuous",condition:{op:"source-boosted-this-battle"}}]};
  }
  function compileContinuousNamedVanguardGuardianShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[GC\]: If you have a vanguard with ["“]([^"”]+)["”] in its card name, this unit gets shield \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["guardian"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-gc-named-vanguard-shield-v1",review:"Exact Guardian Circle CONT template. The shield modifier applies only while this exact card is on GC and the defending player's Vanguard name contains the printed phrase; it has no extra grade or turn restriction."},effects:[{op:"continuous-shield",target:"source",amount:Number(match[2]),duration:"continuous",condition:{op:"controller-vanguard-card-name-contains",name:match[1]}}]};
  }
  function compileContinuousNamedGradeVanguardPowerShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\/GC\]: If you have a grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+) \/ shield \+\s*(\d+)\. \(Active on opponent[’']s turn too\)$/i);
    if(!match)return null;
    const grade=Number(match[1]),power=Number(match[3]),shield=Number(match[4]);if(!Number.isInteger(grade)||grade<0||!positiveInteger(power)||!positiveInteger(shield))return null;
    const condition={op:"all",conditions:[{op:"controller-vanguard-grade-at-least",grade},{op:"controller-vanguard-card-name-contains",name:match[2]}]};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard","guardian"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-gc-named-grade-vanguard-power-shield-v1",review:"Exact dual-circle CONT family. Preserves the printed grade threshold, Vanguard name substring, distinct RC power and GC shield values, and opponent-turn activity."},effects:[{op:"continuous-power",target:"source",amount:power,duration:"continuous",location:"rear-guard",condition},{op:"continuous-shield",target:"source",amount:shield,duration:"continuous",location:"guardian",condition}]};
  }
  function compileContinuousOpponentGZonePowerShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText).replace(/[’‘]/g,String.fromCharCode(39));
    const match=text.match(/^CONT \[RC\/GC\]: If your opponent's G zone has a card, this unit gets power \+(\d+) \/ shield \+(\d+)\. If your opponent's G zone has a face up card, this unit gets power \+(\d+) \/ shield \+(\d+) instead of power \+\d+ \/ shield \+\d+\. \(Active on opponent's turn too\)$/i);
    if(!match)return null;
    const [basePower,baseShield,faceUpPower,faceUpShield]=match.slice(1,5).map(Number);
    if(![basePower,baseShield,faceUpPower,faceUpShield].every(positiveInteger))return null;
    const shared={op:"opponent-g-zone-has-card-and-no-face-up-card"},faceUp={op:"opponent-g-zone-has-face-up-card"};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard","guardian"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-rc-gc-opponent-g-zone-power-shield-v1",review:"Exact dual-circle CONT template. On RC, power is +5000-equivalent when the opponent G zone is nonempty, upgraded to the printed face-up amount instead when any face-up card exists; on GC the same mutually exclusive state check grants shield. The text explicitly applies during both turns."},effects:[{op:"continuous-power",target:"source",amount:basePower,duration:"continuous",location:"rear-guard",condition:shared},{op:"continuous-power",target:"source",amount:faceUpPower,duration:"continuous",location:"rear-guard",condition:faceUp},{op:"continuous-shield",target:"source",amount:baseShield,duration:"continuous",location:"guardian",condition:shared},{op:"continuous-shield",target:"source",amount:faceUpShield,duration:"continuous",location:"guardian",condition:faceUp}]};
  }
  function compileAutoVanguardClanPlacementHandToSoulDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    const match=text.match(/^AUTO:\s*When this unit is placed on VC or RC, if you have an? [«<]([^»>]+)[»>] vanguard, choose up to one [«<]([^»>]+)[»>] from your hand, and put it into your soul\.$/i);
    if(!match)return null;
    const vanguardClan=match[1].trim(),handClan=match[2].trim();
    if(!vanguardClan||!handClan||vanguardClan.toLocaleLowerCase()!==handClan.toLocaleLowerCase())return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],conditions:[{type:"controller-vanguard-has-clan",value:vanguardClan}],conditionsReviewed:true,choicesReviewed:true,optional:false,trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["vanguard","rear-guard"]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-vc-rc-clan-vanguard-placement-hand-to-soul-v1",review:"Exact six-record placement AUTO. The exact source instance must be placed on VC or RC, the controller's Vanguard must have the printed clan, and the controller may choose zero or one matching-clan card from their own hand to move into Soul. The selected instance and hand zone are revalidated at resolution."},effects:[{op:"move-filtered-hand-card-to-soul",target:"controller",maximum:1,filter:{clan:handClan}}]};
  }
  function compileContinuousNamedSoulPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[(VC|RC|VC\/RC)\]: (?:During your turn, )?If you have a card named ["“]([^"”]+)["”] in your soul, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-named-soul-card-power-v1",review:"Exact CONT wording: checks the controller's Soul for the exact printed card name, any printed own-turn restriction, and only the printed Vanguard or Rear-guard circle."},effects:[{op:"continuous-power",target:"source",amount:Number(match[3]),duration:"continuous",condition:{op:"soul-has-card-name",name:match[2],controllerTurn:/During your turn/i.test(normalizePrintedText(printedText))}}]};
  }
  function compileGreatDaiyushaLimitBreakDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||String(cardId)!=="cfa-264")return null;
    const text=normalizePrintedText(printedText);
    if(!/^CONT \[VC\] Limit Break 4 \(This ability is active if you have four or more damage\): During your turn, if the number of cards named "Dimensional Robo" in your soul is three or more, this unit gets power \+2000 \/ critical \+1\.$/i.test(text))return null;
    const condition={op:"all",conditions:[{op:"controller-turn"},{op:"controller-damage-at-least",count:4},{op:"soul-card-name-contains-count-at-least",name:"Dimensional Robo",count:3}]};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",cardNumber:"cfa-264",patternId:"cont-great-daiyusha-limit-break-critical-v1",review:"Exact Great Daiyusha Limit Break 4 ability. Applies only on VC during its controller's turn with four damage and at least three matching Dimensional Robo cards in Soul; power and critical are evaluated together."},effects:[{op:"continuous-power",target:"source",amount:2000,duration:"continuous",condition},{op:"continuous-critical",target:"source",amount:1,duration:"continuous",condition}]};
  }
  function compileContinuousSoulCountPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[(VC|RC|VC\/RC)\]: (?:During your turn, )?this unit gets power \+(\d+) for each card in your soul(?: with ["“]([^"”]+)["”] in its card name)?\.$/i);
    if(!match)return null;
    const condition=/During your turn/i.test(normalizePrintedText(printedText))?{op:"controller-turn"}:{op:"always"};
    return{id:abilityId,cardId,kind,printedText,requiredLocation:parseAbilityLocation(printedText),source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-soul-card-count-power-v1",review:"Exact CONT power-per-Soul-card template. The shared effect counts current controller Soul cards, optionally by the printed card-name substring, and preserves the printed circle and turn condition."},effects:[{op:"continuous-power-per-soul-card",target:"source",amount:Number(match[2]),duration:"continuous",...(match[3]?{cardNameContains:match[3]}:{}),condition}]};
  }
  function compileContinuousDragontreeMarkerPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: During your turn, this unit gets power \+(\d+) for each Dragontree marker on your RC\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-during-turn-power-per-dragontree-marker-v1",review:"Exact Rear-Guard CONT template confirmed across five catalog records. During its controller's turn, this source gets the printed power for each Dragontree marker on that controller's Rear-Guard Circles; markers on Vanguard Circles are excluded."},effects:[{op:"continuous-power-per-dragontree-marker",target:"source",amount:Number(match[1]),duration:"continuous",condition:{op:"controller-turn"}}]};
  }
  function compileContinuousPowerPerControllerRearGuardDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[(VC|RC)\]: During your turn, this unit gets power \+(\d+) for each of your rear-guards\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:[match[1]==="VC"?"vanguard":"rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vc-rc-during-turn-power-per-rearguard-v1",review:"Exact own-turn power-per-Rear-Guard CONT template. Count distinct Rear-Guard card instances controlled by this ability's controller, including the source when it is itself on RC; preserve the printed source circle."},effects:[{op:"continuous-power-per-controller-rearguard",target:"source",amount:Number(match[2]),duration:"continuous",condition:{op:"controller-turn"}}]};
  }
  function compileContinuousOwnAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\/RC\]: During the battle this unit attacked, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vc-rc-own-attack-battle-power-v1",review:"Exact CONT battle power template. This exact source instance gains its printed power only while it is the attacking unit in the current battle; attacks by another unit do not satisfy it."},effects:[{op:"continuous-power",target:"source",amount:Number(match[1]),duration:"continuous",condition:{op:"source-attacked-this-battle"}}]};
  }
  function compileContinuousNamedFaceUpDamagePowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\/RC\]: During your turn, this unit gets power \+(\d+) for each card named ["“]([^"”]+)["”] face up in your damage zone\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vc-rc-own-turn-named-face-up-damage-power-v1",review:"Exact own-turn CONT power template. Counts distinct face-up cards with the exact printed name in this controller's Damage Zone; preserves source VC/RC scope and excludes face-down cards and the opponent's Damage Zone."},effects:[{op:"continuous-power-per-named-face-up-damage-card",target:"source",amount:Number(match[1]),cardName:match[2].trim(),duration:"continuous",condition:{op:"controller-turn"}}]};
  }
  function compileContinuousMissingOtherNamePowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[(VC|RC|VC\/RC)\]: If you do not have another card with ["“]([^"”]+)["”] in its card name on your VC or RC, this unit gets power -(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:parseAbilityLocation(printedText),source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-no-other-field-card-name-power-v1",review:"Exact CONT wording; evaluates the controller's Vanguard and Rear-Guard instances and excludes this source by stable instance ID."},effects:[{op:"continuous-power-adjustment",target:"source",amount:-Number(match[3]),duration:"continuous",condition:{op:"controller-field-lacks-other-card-name",name:match[2]}}]};
  }
  function compileContinuousNonClanFieldPowerPenaltyDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\/RC\]: If you have a non-[<«]([^>»]+)[>»] vanguard or rear-guard, this unit gets power -(\d+)\.$/i);
    if(!match)return null;
    const amount=Number(match[2]);if(!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vc-rc-non-clan-field-power-penalty-v1",review:"Exact VC/RC CONT wording across 11 catalog records. Checks the controller's Vanguard and Rear-Guards only; a field card qualifies only when its structured single-clan identity is known and differs from the printed clan. Unavailable or ambiguous clan data fails closed."},effects:[{op:"continuous-power-adjustment",target:"source",amount:-amount,duration:"continuous",condition:{op:"controller-field-has-non-clan",clan:match[1]}}]};
  }
  function compileVanguardSoulNameThresholdCriticalDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\]: During your turn, if the number of cards in your soul with ["“]([^"”]+)["”] in its card name is (\d+) or more, this unit gets critical \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vanguard-soul-name-threshold-critical-v1",review:"Exact VC CONT template: checks controller turn and counts Soul cards whose card names contain the printed phrase, then applies the printed critical amount."},effects:[{op:"continuous-critical",target:"source",amount:Number(match[3]),duration:"continuous",condition:{op:"all",conditions:[{op:"controller-turn"},{op:"soul-card-name-contains-count-at-least",name:match[1],count:Number(match[2])}]}}]};
  }
  function compileContinuousAttackedVanguardPowerDefinition(cardId,abilityId,kind,printedText){
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: During the battle it attacked a vanguard, this unit gets power \+(\d+)\.$/i);
    if(kind!=="CONT"||!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-attacks-vanguard-battle-power-v1",review:"Exact RC CONT text in five records. The condition is battle-scoped and applies only while this exact source is attacking a Vanguard; the target circle is passed before attack power is locked."},effects:[{op:"continuous-power",target:"source",amount:Number(match[1]),duration:"continuous",condition:{op:"attacking-vanguard"}}]};
  }
  function compileContinuousNormalOrderPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT \[RC\]: If you played a normal order this turn, this unit gets power \+5000\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-normal-order-power-v1",review:"Exact RC CONT template. It grants 5000 while the controller's normal-order-played counter is nonzero; order count resets at the controller's turn end."},effects:[{op:"continuous-power",target:"source",amount:5000,duration:"continuous",condition:{op:"normal-order-played-this-turn"}}]};
  }
  function compileContinuousOrderPlayedPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: If you played an order this turn, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    const amount=Number(match[1]);if(!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-order-played-power-v1",review:"Exact RC CONT wording across five real records. The bonus is active only during the controller's turn after an order has been played in that turn; it retains the printed per-card amount and does not treat the ability as manually activatable."},effects:[{op:"continuous-power",target:"source",amount,duration:"continuous",condition:{op:"order-played-this-turn"}}]};
  }
  function compileContinuousExactVanguardNamePowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[RC\]: If your vanguard is ["“]([^"”]+)["”], this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-exact-vanguard-name-power-v1",review:"Exact RC CONT text: compares the controller's current Vanguard card name for exact equality, including official card-name aliases, then grants the printed power continuously while the source remains on RC."},effects:[{op:"continuous-power",target:"source",amount:Number(match[2]),duration:"continuous",condition:{op:"controller-vanguard-card-name-equals",name:match[1]}}]};
  }
  function compileContinuousOwnTurnRearGuardPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=String(printedText||"").match(/^CONT \[RC\]: During your turn, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-rc-own-turn-power-v1",review:"Exact RC continuous text; the source contributes power only while its controller turn is active and the instance remains on RC."},effects:[{op:"continuous-power",target:"source",amount:Number(match[1]),duration:"continuous",condition:{op:"controller-turn"}}]};
  }
  function compileTriggerZoneGenerationBreakGradeDefinition(cardId,abilityId,kind,printedText){
    const eligibleIds=new Set(["cfa-11592","cfa-11593","cfa-11594","cfa-5501","cfa-5513","cfa-5567"]);
    if(kind!=="CONT"||!eligibleIds.has(String(cardId))||abilityId!==`${cardId}:0`)return null;
    const text=normalizePrintedText(printedText).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g," ").trim();
    if(text!=="CONT [Trigger Zone] Generation Break 1: This card gets grade +1.")return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["trigger"],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-trigger-zone-generation-break-grade-plus-one-v1",review:"Exact text and six-record family match the local catalog snapshot only; official English card text was not independently located because these Mask Collection cards are Thai-exclusive. This is a passive continuous +1 grade modifier for this exact card instance only while it is in the Trigger Zone and its controller has Generation Break 1."},effects:[{op:"continuous-grade",target:"source",amount:1,duration:"continuous",location:"trigger",condition:{op:"generation-break",count:1}}]};
  }
  function compileContinuousVanguardOwnTurnRearGuardClanCountPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\]: During your turn, if the number of [«<]([^»>]+)[»>] rear-guards you have is (one|two|three|four|five|six|seven|eight|nine|ten|\d+) or more, this unit gets power \+(\d+)\.$/i);
    if(!match)return null;
    const clan=match[1].trim(),count=printedNumberValue(match[2]),amount=Number(match[3]);
    if(!clan||!positiveInteger(count)||!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vanguard-own-turn-rearguard-clan-count-power-v1",review:"Exact VC CONT template. The controller-turn condition and distinct friendly Rear-Guard instances of the exact printed clan are checked continuously; the Vanguard is not counted, and the source receives only the printed power."},effects:[{op:"continuous-power",target:"source",amount,duration:"continuous",condition:{op:"all",conditions:[{op:"controller-turn"},{op:"controller-rearguard-clan-count-at-least",clan,count}]}}]};
  }
  function compileContinuousVanguardOwnTurnPowerPerClanRearGuardDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const match=normalizePrintedText(printedText).match(/^CONT \[VC\]: During your turn, this unit gets power \+(\d+) for each of your [«<]([^»>]+)[»>] rear-guards\.$/i);
    if(!match)return null;
    const amount=Number(match[1]),clan=match[2].trim();
    if(!positiveInteger(amount)||!clan)return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],conditionsReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vanguard-own-turn-power-per-clan-rearguard-v1",review:"Exact VC CONT scaling template. While its controller's turn is active, count each distinct friendly Rear-Guard instance whose current clan information includes the exact printed clan; do not count Vanguard or opponent units."},effects:[{op:"continuous-power-per-clan-rearguard",target:"source",amount,clan,duration:"continuous",condition:{op:"controller-turn"}}]};
  }
  function compileContinuousRearGuardNamedUnitPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT")return null;
    const text=normalizePrintedText(printedText);
    const withName=text.match(/^CONT \[RC\]: (?:During your turn, )?If you(?:r)? have a unit with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+)\.$/i);
    const onCircle=text.match(/^CONT \[RC\]: (?:During your turn, )?If you(?:r)? have a ["“]([^"”]+)["”] on (?:a|your) RC, this unit gets power \+(\d+)\.$/i);
    const match=withName||onCircle;
    if(!match)return null;
    const name=match[1].trim(),amount=Number(match[2]);
    if(!name||!positiveInteger(amount))return null;
    const nameCondition=withName?{op:"controller-rearguard-card-name-contains",name}:{op:"controller-rearguard-has-card-name",name};
    const condition=/During your turn/i.test(text)?{op:"all",conditions:[{op:"controller-turn"},nameCondition]}:nameCondition;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"cont-rc-controlled-rearguard-named-unit-power-v1",review:"Exact rear-guard CONT wording. The named unit must be on the controller's RC; exact quoted-name wording uses equality, while 'in its card name' wording uses a substring match. Controller-turn scope is retained only where printed."},effects:[{op:"continuous-power",target:"source",amount,duration:"continuous",condition}]};
  }
  function compileCenterColumnAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[VC\]:\s*When this unit attacks a vanguard, if you have another unit in (?:the )?(?:center|middle) column, this unit gets power \+(\d+) until end of (?:that )?battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-attack-center-column-power-battle-v1",review:"Exact VC attack template. The condition checks the rear back-center slot, not any rear unit, and source/target identity remains tied to the declared attack."},effects:[{op:"modify-power",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileGenerationBreakVanguardAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[(VC\/RC|VC|RC)\]\s*Generation Break\s+(\d+)(?:\s*\(([^)]*)\))?:\s*When this unit attacks a vanguard, (?:this unit|it) gets power \+(\d+) until end of (?:that )?battle\.$/i);
    if(!match)return null;
    const required=Number(match[2]),parsed=parseAbilityConditions(printedText),reminder=parsed.conditions.find(condition=>condition.type==="generation-break");
    if(!Number.isInteger(required)||required<1||parsed.status==="needs-review"||(match[3]&&(!reminder||reminder.count!==required)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-generation-break-own-vanguard-attack-power-battle-v1",review:"Exact own-source attack wording and circle are matched; GB thresholds and printed reminder thresholds are cross-checked before compilation."},effects:[{op:"modify-power",target:"source",amount:Number(match[4]),duration:"battle"}]};
  }
  function compileGenerationBreakRearGuardAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\] Generation Break (\d+)(?: \(([^)]*)\))?: When this unit attacks, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    const required=Number(match[1]),parsed=parseAbilityConditions(printedText),reminder=parsed.conditions.find(condition=>condition.type==="generation-break");
    if(!Number.isInteger(required)||required<1||parsed.status==="needs-review"||(match[2]&&(!reminder||reminder.count!==required)))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditions:[{type:"generation-break",count:required}],conditionsReviewed:true,trigger:{status:"recognized-trigger",eventType:"unit.attacked",subject:"source",circles:[]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-generation-break-rearguard-own-attack-power-battle-v1",review:"Exact RC own-attack AUTO. The exact Rear-Guard source must attack; its controller must meet the printed face-up G-unit threshold, and only that battle receives the printed power."},effects:[{op:"modify-power",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileGenerationBreakVanguardBoostPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[RC\]\s*Generation Break\s+(\d+)(?:\s*\(([^)]*)\))?:\s*When this unit boosts a vanguard, the boosted unit gets power \+(\d+) until end of (?:that )?battle\.$/i);
    if(!match)return null;
    const required=Number(match[1]),parsed=parseAbilityConditions(printedText),reminder=parsed.conditions.find(condition=>condition.type==="generation-break");
    if(!Number.isInteger(required)||required<1||parsed.status==="needs-review"||(match[2]&&(!reminder||reminder.count!==required)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-generation-break-own-vanguard-boost-power-battle-v1",review:"Exact RC booster, exact Vanguard target, and exact GB/reminder threshold are validated; the effect targets the Vanguard instance boosted in this battle."},effects:[{op:"modify-power-target",target:"boosted-unit",amount:Number(match[3]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]};
  }
  function compileGenerationBreakBoostPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=String(printedText||"").match(/^AUTO\s*\[RC\]\s*Generation Break\s+(\d+):\s*When this unit boosts, the boosted unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    const required=Number(match[1]),parsed=parseAbilityConditions(printedText);
    if(!Number.isInteger(required)||required<1||parsed.status==="needs-review")return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-generation-break-boost-unit-power-battle-v1",review:"Exact Rear-Guard boost AUTO without a target-circle restriction. The source must be the actual booster, its controller must meet the printed Generation Break threshold, and only the exact unit boosted by this source receives battle-duration power."},effects:[{op:"modify-power-target",target:"boosted-unit",amount:Number(match[2]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit"}}]};
  }
  function compileBoostGradeThresholdSoulBlastPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO\s*\[RC\]:\s*When this unit boosts a grade (\d+) or greater unit, if your opponent[’']s vanguard is grade (\d+) or greater, COST \[Soul Blast (\d+)\], and this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boost-grade-opponent-vanguard-grade-soul-blast-power-battle-v1",review:"Exact booster and boosted-unit grade are matched from the boost event; opponent Vanguard grade is evaluated live; Soul Blast is required before the battle-only booster power modifier."},effects:[{op:"modify-power",target:"source",amount:Number(match[4]),duration:"battle"}]};
  }
  function compileNamedBoostPowerTemplateDefinition(cardId, abilityId, kind, printedText) {
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    const match=text.match(/^AUTO\s*\[RC\]:\s*When this unit boosts (?:a|an) (?:unit|card) named ["“]([^"”]+)["”], the boosted unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-boosts-named-unit-power-battle-v1",review:"Exact named boost target checked against the battle's boosted instance; exact name, source circle, and duration are validated."},effects:[{op:"modify-power-target",target:"boosted-unit",amount:Number(match[2]),duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",cardName:match[1]}}]};
  }
  function compileSoulBlastNamedBoostPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    const exact=text.match(/^AUTO\s*\[RC\]:\s*\[Soul Blast (\d+)\]\s*When this unit boosts (?:(?:a|an) )?(?:unit|card) named ["“]([^"”]+)["”], you may pay the cost\. If you do, the boosted unit gets power \+(\d+) until end of that battle\.$/i)
      ||text.match(/^AUTO\s*\[RC\]:\s*\[Soul Blast (\d+)\]\s*When this unit boosts ["“]([^"”]+)["”], you may pay the cost\. If you do, the boosted unit gets power \+(\d+) until end of that battle\.$/i);
    const contains=text.match(/^AUTO\s*\[RC\]:\s*\[Soul Blast (\d+)\]\s*When this unit boosts (?:a|an) (?:unit|card) with ["“]([^"”]+)["”] in its card name, you may pay the cost\. If you do, the boosted unit gets power \+(\d+) until end of that battle\.$/i);
    const chosen=exact||contains;if(!chosen)return null;
    const cardIdText=String(cardId),overlordCorrection=cardIdText==="cfa-513"&&String(chosen[2]).toLowerCase()==="overlord",prismCorrection=cardIdText==="cfa-1239"&&String(chosen[2]).toLowerCase()==="pr<3ism-p labrador";
    const correctedTarget=overlordCorrection?{cardNameContains:"Overlord"}:prismCorrection?{cardName:"PR<3ISM-Promise, Labrador"}:null;
    const filter={controller:"source-controller",cardType:"unit",...(contains?{cardNameContains:chosen[2]}:correctedTarget||{cardName:chosen[2]})};
    const sourceReview=overlordCorrection?{officialReference:"https://en.cf-vanguard.com/cardlist/?cardno=BT05%2F039EN",review:"The local catalog snapshot omits 'in its card name'; the official card text specifies a unit with Overlord in its card name. Use substring matching per the official card list while preserving the source snapshot text."}:prismCorrection?{officialReference:"https://en.cf-vanguard.com/cardlist/?cardno=EB06%2F023EN",review:"The local snapshot abbreviates the boosted card name. The official card text requires PR♥ISM-Promise, Labrador; match its exact canonical catalog name PR<3ISM-Promise, Labrador."}:{review:"Exact booster, Soul Blast cost, optional payment, exact or substring card-name target, and boosted battle target are represented separately."};
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",...sourceReview,patternId:"auto-soul-blast-named-boost-power-battle-v1"},effects:[{op:"modify-power-target",target:"boosted-unit",amount:Number(chosen[3]),duration:"battle",targetFilter:filter}]};
  }
  function compileVanguardAttackPowerTemplateDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = String(printedText || "").match(/^(?:AUTO\s*)?(?:\[(VC|RC|VC\/RC)\])?:\s*When this unit attacks a vanguard, (?:this unit|it) gets power \+(\d+) until (?:the )?end of (?:(?:that|the) )?battle\.$/i);
    if (!match) return null;
    return {
      id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "auto-own-attack-vanguard-power-battle-v1", review: "Exact own-attack-to-Vanguard wording, including legacy omitted AUTO labels and common end-of-battle phrasing; source identity, printed circle, Vanguard target, and battle duration are validated." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[2]), duration: "battle" }]
    };
  }
  function compileClanVanguardAttackPowerTemplateDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = String(printedText || "").match(/^AUTO\s*(?:\[(VC|RC|VC\/RC)\])?:\s*When this unit attacks(?: a vanguard)?, if you have (?:a|an)\s+[<«]([^>»]+)[>»] vanguard, this unit gets power \+(\d+) until end of that battle\.$/i);
    if (!match) return null;
    return {
      id: abilityId, cardId, kind, printedText,
      source: { dataset: "Cardfight Area snapshot", patternId: "auto-own-attack-vanguard-clan-power-battle-v1", review: "Exact text template validated against real catalog samples; source, target circle, clan condition, and duration have regression coverage." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "battle" }]
    };
  }
  function compileRcNarukamiVanguardOwnAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    if(!/^AUTO \[RC\]: When this unit attacks, if you have a [«<]Narukami[»>] vanguard, this unit gets power \+2000 until the end of the battle\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],conditionsReviewed:true,trigger:{status:"recognized-trigger",eventType:"unit.attacked",subject:"source",circles:["rear-guard"]},conditions:[{type:"controller-vanguard-has-clan",value:"Narukami"}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-narukami-own-attack-power-battle-v1",review:"Exact RC own-attack AUTO for the three Djinn of the Lightning cards. The source itself must attack from RC while its controller has a Narukami Vanguard; power lasts only for that attack's battle."},effects:[{op:"modify-power",target:"source",amount:2000,duration:"battle"}]};
  }
  function compileOwnAttackAgainstVanguardNamedVanguardPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit attacks a vanguard, if you have a vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+) until end of that battle\.$/i);
    if (!match) return null;
    const circle = match[1].toUpperCase();
    const requiredLocation = circle === "VC" ? ["vanguard"] : circle === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"];
    return {
      id: abilityId, cardId, kind, printedText, requiredLocation,
      trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", targetLocation: "vanguard", circles: requiredLocation },
      conditions: [{ type: "controller-vanguard-name-contains", value: match[2] }],
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-own-attack-vanguard-named-vanguard-power-battle-v1", review: "Exact AUTO family: only this source instance attacking a Vanguard qualifies; its printed circle and named-Vanguard condition are required, and power lasts only for that battle." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "battle" }]
    };
  }
  function compileAutoRcGradeNamedVanguardAttackPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When this unit attacks, if you have a grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+) until end of that battle\.$/i);
    if(!match||!match[2].trim())return null;
    const grade=Number(match[1]),name=match[2].trim(),amount=Number(match[3]);
    if(!Number.isInteger(grade)||grade<0||!positiveInteger(amount))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],trigger:{status:"recognized-trigger",eventType:"unit.attacked",subject:"source",circles:["rear-guard"]},conditions:[{type:"controller-vanguard-grade-at-least",count:grade},{type:"controller-vanguard-name-contains",value:name}],conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-own-attack-grade-named-vanguard-power-battle-v1",review:"Exact Rear-Guard AUTO template. This exact source must attack; its controller's Vanguard must satisfy both the printed minimum grade and name fragment at eligibility and resolution; the printed power applies only during that battle."},effects:[{op:"modify-power",target:"source",amount,duration:"battle"}]};
  }
  function compileNamedVanguardAttackPowerTemplateDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = String(printedText || "").match(/^AUTO\s*(?:\[(VC|RC|VC\/RC)\])?:\s*When this unit attacks, if you have a vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+) until end of that battle\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, source: { dataset: "Cardfight Area snapshot", patternId: "auto-own-attack-named-vanguard-power-battle-v1", review: "Exact sentence template validated against 83 catalog records; source identity, name condition, target timing, and battle duration have regression coverage." }, effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "battle" }] };
  }
  function compileRcDeckPlacementPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO:\s*When this unit is placed on RC from deck, this unit gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return {
      id: abilityId, cardId, kind, printedText, requiredLocation: ["rear-guard"],
      trigger: { status: "recognized-trigger", eventType: "card.placed", subject: "source", circles: ["rear-guard"], sourceLocation: "deck" },
      conditionsReviewed: true, costsReviewed: true, choicesReviewed: true,
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rc-deck-placement-power-turn-v1", review: "Exact four-record AUTO template. Only the exact source instance entering an RC from the Deck qualifies; placement from hand or another zone and placement on other circles do not. The source receives the printed power until end of turn." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[1]), duration: "turn" }]
    };
  }
  function compileNamedVanguardAttackPowerEndOfBattleDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = normalizePrintedText(printedText).match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When this unit attacks, if you have a vanguard with ["“]([^"”]+)["”] in its card name, this unit gets power \+(\d+) until end of battle\.$/i);
    if (!match) return null;
    const circle = match[1].toUpperCase();
    const requiredLocation = circle === "VC" ? ["vanguard"] : circle === "RC" ? ["rear-guard"] : ["vanguard", "rear-guard"];
    return { id: abilityId, cardId, kind, printedText, requiredLocation,
      trigger: { status: "recognized-trigger", eventType: "unit.attacked", subject: "source", circles: requiredLocation },
      conditions: [{ type: "controller-vanguard-name-contains", value: match[2] }],
      source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-own-attack-named-vanguard-power-battle-v2", review: "Exact own-attack AUTO family with the printed 'until end of battle' duration. The exact source attack and circle are required; this unit's controller must have the named Vanguard, and the printed power expires with that battle." },
      effects: [{ op: "modify-power", target: "source", amount: Number(match[3]), duration: "battle" }] };
  }
  function compileDrawTurnSoulBlastPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    const match = String(printedText || "").match(/^AUTO\s*\[RC\]\s*1\s*\/\s*Turn:\s*When you draw a card during your turn, COST \[Soul Blast 1\], this unit gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, source: { dataset: "Cardfight Area snapshot", patternId: "auto-draw-during-turn-soul-blast-power-v1", review: "Exact text matches Weather Girl, Saft (cfa-5759); controller-turn condition, Soul Blast cost, once-per-turn restriction, RC location, and turn modifier have regression coverage." }, effects: [{ op: "modify-power", target: "source", amount: Number(match[1]), duration: "turn" }] };
  }
  function compileDrawPowerDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO") return null;
    if (/^AUTO\s*\[VC\]:\s*When its attack hits, draw a card\.$/i.test(String(printedText || ""))) return { id: abilityId, cardId, kind, printedText, source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-vanguard-own-attack-hit-draw-v1", review: "Exact Vanguard-only wording; the attack-hit event must identify this source instance as attacker, and the source must still be on VC. No other unit's hit can trigger this ability." }, effects: [{ op: "draw", count: 1 }] };
    const match = String(printedText || "").match(/^AUTO\s*\[(VC|RC|VC\/RC)\]:\s*When you draw a card, this unit gets power \+(\d+) until end of turn\.$/i);
    if (!match) return null;
    return { id: abilityId, cardId, kind, printedText, source: { dataset: "Cardfight Area snapshot", patternId: "auto-when-you-draw-power-turn-v1", review: "Exact text matches the catalog record for Sword Dancer Angel (cfa-425); draw-event identity, VC/RC restriction, and turn modifier are regression-tested." }, effects: [{ op: "modify-power", target: "source", amount: Number(match[2]), duration: "turn" }] };
  }
  function compileOrderZonePlacementDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^(?:AUTO:\s*)?When this card is put into (?:(?:your|the) )?Order Zone, draw a card\.$/i.test(String(printedText||"")))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-order-zone-placement-draw-v1",review:"Exact Order Zone placement wording, including legacy 'your Order Zone' variants. A structured placement event must identify this same card instance entering the Order Zone; draw uses the normal draw effect handler."},effects:[{op:"draw",count:1}]};
  }
  function compileInterceptShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),generationBreak=text.match(/^AUTO Generation Break (\d+): When this unit intercepts, this (?:unit|card) gets shield \+(\d+) until end of that battle\.$/i);
    if(generationBreak)return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-intercept-generation-break-shield-battle-v1",review:"Exact Generation Break Intercept shield text. The trigger must be this exact Rear-Guard moved to Guardian Circle; the existing live Generation Break count gates eligibility, and the shield applies only for that battle."},effects:[{op:"modify-shield-source",target:"source",amount:Number(generationBreak[2]),duration:"battle"}]};
    const match=text.match(/^AUTO:\s*When this unit intercepts, this (?:unit|card) gets shield \+(\d+) until end of (?:that )?battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-intercept-shield-battle-v1",review:"Exact unconditional intercept shield wording across nine catalog cards. The source must be the exact card moved from a Rear-Guard Circle to Guardian Circle for the current battle."},effects:[{op:"modify-shield-source",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileClanInterceptShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*When this unit intercepts, if you have an? [«<]([^»>]+)[»>] vanguard, this (?:unit|card) gets shield \+(\d+) until (?:the )?end of (?:that )battle\.$/i);
    if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-intercept-clan-vanguard-shield-battle-v1",review:"Exact conditional intercept shield template across 18 catalog abilities. Clan identity is represented by the shared structured controller-vanguard condition and checked from live card definition data before the AUTO is queued."},effects:[{op:"modify-shield-source",target:"source",amount:Number(match[2]),duration:"battle"}]};
  }
  function compileConditionedInterceptShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const match=normalizePrintedText(printedText).match(/^AUTO:\s*When this unit intercepts, if .+?, this (?:unit|card) gets shield \+(\d+) until (?:the )?end of (?:that )battle\.(?:\s*\(Includes your opponent[’']s cards\))?$/i);
    if(!match)return null;
    const conditionInfo=parseAbilityConditions(printedText),supported=new Set(["controller-back-row-rear-guards-at-most","controller-back-row-grade-rear-guards-at-least","controller-soul-count-at-least","controller-damage-count-at-least","controller-damage-count-more-than-opponent","all-order-zones-count-at-least","any-field-card-is-locked","opponent-rear-guards-at-most","opponent-vanguard-grade-at-least"]);
    if(conditionInfo.status!=="modeled"||conditionInfo.conditions.length!==1||!supported.has(conditionInfo.conditions[0].type))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-intercept-shield-structured-condition-battle-v1",review:"Exact shield-effect template with one of nine structured, regression-tested live-state conditions. Unknown or additional conditions remain unsupported and fail closed."},effects:[{op:"modify-shield-source",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileVanguardAttackedInterceptShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const match=normalizePrintedText(printedText).match(/^AUTO:\s*When this unit intercepts during the battle that your vanguard was attacked, this unit gets shield \+(\d+) until end of that battle\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-intercept-controller-vanguard-attacked-shield-battle-v1",review:"Exact intercept timing text. The attacking battle target must be this controller's exact Vanguard instance; a Rear-Guard attack cannot satisfy the condition."},effects:[{op:"modify-shield-source",target:"source",amount:Number(match[1]),duration:"battle"}]};
  }
  function compileDriveCheckFrontTriggerCriticalDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[(VC\/RC|VC|RC)\] 1\/Turn: When your drive check reveals a front trigger, you may have this unit get critical \+1 until end of turn\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-drive-check-front-trigger-critical-turn-v1",review:"Exact once-per-turn AUTO. Only the controller's own drive-check event revealing a Front trigger qualifies; a damage check, another player's check, or another trigger type does not."},effects:[{op:"modify-critical",target:"source",amount:1,duration:"turn"}]};
  }
  function compileVanguardDriveCheckClanPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const match=normalizePrintedText(printedText).match(/^AUTO \[VC\]: When this unit[’']s drive check reveals (?:a )?(?:grade (\d+) )?[«<]([^»>]+)[»>], this unit gets power \+(\d+) until end of (?:that )battle\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-drive-check-revealed-clan-power-battle-v1",review:"Exact Vanguard source-drive-check AUTO. It checks the revealed instance's exact grade when printed and its declared clan, and applies power only to this same Vanguard's current battle."},effects:[{op:"modify-power",target:"source",amount:Number(match[3]),duration:"battle"}]};
  }
  function compileVanguardGradeClanDriveCheckStandDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[RC\]: When your vanguards? drive check reveals a grade (\d+) [«<]([^»>]+)[»>], stand this unit\.$/i.test(normalizePrintedText(printedText)))return null;const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When your vanguards? drive check reveals a grade (\d+) [«<]([^»>]+)[»>], stand this unit\.$/i);
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-vanguard-drive-check-grade-clan-stand-source-v1",review:"Exact Rear-Guard AUTO wording. Only a drive check by the controller's Vanguard, revealing the printed Grade and clan, matches; standing the source is idempotent when it is already standing."},effects:[{op:"stand-source",target:"source"}]};
  }
  function compileNormalUnitDriveCheckSourcePowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const match=normalizePrintedText(printedText).match(/^AUTO \[(VC\/RC|VC|RC)\]: When your drive check reveals a normal unit, this unit gets power \+(\d+) until end of turn\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-drive-check-normal-unit-source-power-turn-v1",review:"Exact AUTO wording. Only the controller's drive check qualifies, and the checked-card metadata must explicitly identify a normal unit before the source receives its turn power modifier."},effects:[{op:"modify-power",target:"source",amount:Number(match[2]),duration:"turn"}]};
  }
  function compileNormalUnitDriveCheckSoulCostDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[RC\] Generation Break 1: \[Put this unit into your soul\] When your drive check reveals a normal unit, you may pay the cost\. If you do, draw a card\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-drive-check-normal-unit-source-soul-draw-v1",review:"Exact GB1 AUTO wording. The controller's drive check must reveal a normal unit; paying the optional source-to-Soul cost moves this exact RC instance before drawing one card."},effects:[{op:"draw",count:1}]};
  }
  function compileNormalUnitDriveCheckSoulCostPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[RC\]: When your drive check reveals a normal unit, COST \[put this card into your soul\], and one of your rear-guards gets power \+(\d+) until end of turn\.$/i.test(normalizePrintedText(printedText)))return null;
    const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When your drive check reveals a normal unit, COST \[put this card into your soul\], and one of your rear-guards gets power \+(\d+) until end of turn\.$/i);
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-drive-check-normal-unit-source-soul-rearguard-power-v1",review:"Exact RC AUTO wording. Only the controller's drive check revealing a normal unit qualifies; pay by moving this exact source to Soul, then choose a currently legal friendly Rear-Guard other than this source, which is no longer on RC after paying the cost."},effects:[{op:"modify-power-target",target:"chosen",amount:Number(match[1]),duration:"turn",targetFilter:{controller:"source-controller",zone:"rear-guard",cardType:"unit",excludeSource:true}}]};
  }
  function compileNormalDriveCheckNamedVanguardDriveDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const match=normalizePrintedText(printedText).match(/^AUTO \[RC\]: When your drive check reveals a normal unit, if your vanguard is ["“]([^"”]+)["”], COST \[Counter Blast 1 & retire this unit\], and your vanguard gets drive \+(\d+) until end of that battle\.$/i);if(!match)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rc-normal-drive-check-named-vanguard-retire-source-drive-v1",review:"Exact RC AUTO wording. It requires the controller's exact drive-check event revealing a normal unit, the named Vanguard, and a pending battle by that Vanguard. Counter-Blast and retiring this exact source are atomic costs; the drive increase applies to that battle's attack."},effects:[{op:"modify-drive-target",target:"attacking-vanguard",amount:Number(match[2]),duration:"battle"}]};
  }
  function compileAbilitylessNormalDriveCheckVanguardStandDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO \[VC\]: When your drive check reveals a normal unit with no CONT, ACT, or AUTO abilities during the battle this unit attacked, stand one of your rear-guards\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-drive-check-abilityless-normal-stand-rearguard-v1",review:"Exact VC AUTO. Matches only this exact Vanguard's active attack and its controller's normal drive check; checked-card ability text is parsed before the skill becomes eligible. The controller chooses a rested friendly Rear-Guard to stand."},effects:[{op:"stand-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard",cardType:"unit"}}]};
  }
  function compileAbilitylessUnitContinuousPowerDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="CONT"||!/^CONT \[VC\/G zone\]: During your turn, if this card is face up, all of your units with no CONT, ACT, or AUTO abilities get power \+5000\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"cont-vc-gzone-abilityless-controller-units-power-v1",review:"Exact VC/G-zone CONT wording. The source must remain in VC or G zone face up, during its controller's turn; the continuous bonus is evaluated on each friendly field unit only while that target has no parsed AUTO, ACT, or CONT abilities."},effects:[{op:"continuous-power",target:"all-controller-units",amount:5000,duration:"continuous",condition:{op:"controller-turn",sourceFaceUp:true,targetHasNoAbilities:true}}]};
  }
  function compileBlazeDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);const match=text.match(/^AUTO \[(VC\/RC|VC|RC)\]: Blaze(?: \(At the beginning of (?:your (?:first|each)|each of your) attack, if the number of rear-guards you have is greater than your opponent[’']s, your vanguard becomes blazing until end of turn\.\))?\.?$/i);if(!match)return null;const circle=match[1].toUpperCase(),firstAttack=/beginning of your first attack/i.test(text);return{id:abilityId,cardId,kind,printedText,conditions:[{type:"controller-has-more-rear-guards-than-opponent"}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-blaze-own-attack-more-rearguards-v1",review:"Exact Blaze reminder-text family; checked against Comprehensive Rules 4.52 section 14.23. Fires only in its printed circle at a structured attack-step-start timing, requires strictly more controlled Rear-Guards, and marks the exact controller Vanguard blazing until that controller's turn ends. Legion Mate propagation is unsupported because the match model has no Legion mate instance."},requiredLocation:circle==="VC"?["vanguard"]:circle==="RC"?["rear-guard"]:["vanguard","rear-guard"],trigger:{status:"recognized-trigger",eventType:"attack.step-started",subject:"controller",...(firstAttack?{firstAttackOnly:true}:{})},effects:[{op:"set-blazing",target:"vanguard"}]};}
  function compileHollowKeywordDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);if(!/^AUTO:\s*Hollow(?:\s*\(When this unit is placed on\s*\(?RC\)?, you may have (?:this unit|it) become hollowed\. If you do, retire it at the end of turn\.?\))?\.?$/i.test(text))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.45.pdf",patternId:"auto-hollow-placement-retire-turn-end-v1",review:"Exact Hollow keyword and reminder-text variants. The source must enter an RC; accepting the optional AUTO marks that exact unit hollowed for its controller's turn, and turn cleanup retires only marked rear-guards through the normal retirement event path."},trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["rear-guard"]},effects:[{op:"set-hollowed",target:"source"}],keywords:["hollow"]};}
  function compileAfterimageKeywordDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);if(!/^AUTO \[RC\]: Afterimage(?: \(When your opponent puts a bound card into (?:his or her|their) hand, if your hand has six or less cards, you may return this unit to your hand\.?\))?\.?$/i.test(text))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-afterimage-opponent-bound-card-to-hand-return-source-v1",review:"Exact Afterimage keyword/reminder, whose official definition is AUTO: when a card is put into your opponent's hand from bind, if your hand has six or less cards, you may return this unit to your hand (Comprehensive Rules 4.52 §14.24). Requires an exact bind-to-hand movement event owned by the opponent, this source on RC, and rechecks hand size when resolving."},trigger:{status:"recognized-trigger",eventType:"card.moved",subject:"any",sourceLocation:"bind",destinationLocation:"hand",movedCardOwnerRelation:"opponent"},conditions:[{type:"controller-hand-size-at-most",count:6}],effects:[{op:"move-source-to-hand",target:"source",from:"rear-guard"}],keywords:["afterimage"]};}
  function compileChargeKeywordDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);const concise=/^AUTO \[RC\]: Charge\.?$/i.test(text),keywordOnly=/^AUTO:\s*Charge\.?$/i.test(text);const mandatory=/^AUTO: Charge \(During the turn that this unit is placed on RC by an effect, it becomes in Charge, and put it on the bottom of you deck at the end of the battle in which it participated\.\)$/i.test(text);const optionalDuring=/^AUTO: Charge \(During the turn that this unit is placed on RC by an effect, you may have this unit become in Charge\. If you do, put it on the bottom of your deck at the end of a battle in which it participated\.\)$/i.test(text);const optionalWhen=/^AUTO: Charge \(When this unit is placed on RC due to an effect, you may have (?:this unit|it) become charging for that turn\. If you do, put it on the bottom of your deck at the end of its battle\.\)$/i.test(text);if(!concise&&!keywordOnly&&!mandatory&&!optionalDuring&&!optionalWhen)return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.45.pdf",patternId:"auto-charge-effect-placement-bottom-deck-after-battle-v1",review:"Exact Charge keyword and reminder variants. The keyword rules define its trigger as this exact unit entering RC by an effect; optional variants may decline, and accepting marks it charging until turn end. Comprehensive Rules 4.45 §11.21 states a charging unit is put on the bottom of the deck at the end of a battle it participated in."},requiredLocation:["rear-guard"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["rear-guard"],effectPlacementOnly:true},effects:[{op:"set-charging",target:"source"}],keywords:["charge"],optional:!mandatory};}
  function compileEngorgeDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText);if(!/^AUTO \[(?:VC\/RC|VC|RC)\]: Engorge(?:\.|$| \(When this unit attacks, you may retire one or more of your other rear-guards\. If you do, it is engorged until end of turn\.\))$/i.test(text))return null;return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.45.pdf",patternId:"auto-engorge-retire-other-rearguards-v1",review:"Exact Engorge keyword/reminder variants. Comprehensive Rules 4.45 §14.26 defines the exact-source attack trigger, optional retirement of one or more other friendly Rear-Guards as an effect, and engorged status until end of turn."},trigger:{status:"recognized-trigger",eventType:"unit.attacked",subject:"source"},effects:[{op:"engorge",target:"source"}],optional:true};}
  function compileRevelationDefinition(cardId,abilityId,kind,printedText){if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText).replace(/^AUTO:\s*/i,"");const match=text.match(/^Revelation - (VC\/RC|VC|RC)(?:\s*\(When this unit is placed on the specified circle, look at the top card of your deck, and you may put that card into your soul\. If you do, rest one of your rear-guards\.\))?\.?$/i);if(!match)return null;const circles=match[1].toUpperCase()==="VC"?["vanguard"]:match[1].toUpperCase()==="RC"?["rear-guard"]:["vanguard","rear-guard"];return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.45.pdf",patternId:"auto-revelation-keyword-v1",review:"Exact Revelation keyword/reminder templates. Placement circle is exact; the AUTO is mandatory while putting the top card into Soul is optional. If moved into Soul, its controller rests one standing friendly Rear-Guard when available."},trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles},effects:[{op:"revelation-choice",target:"controller"},{op:"rest-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard"}}],optional:false};}
  function compileRodeUponDrawQuickShieldDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO:\s*When rode upon, draw a card\. Then, if your opponent[’\x27]s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand\.$/i.test(normalizePrintedText(printedText)))return null;return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],trigger:{status:"recognized-trigger",eventType:"card.ridden",subject:"event-target",circles:["vanguard"]},choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-rode-upon-draw-quick-shield-v1",review:"Exact AUTO wording on the 115 matching catalog records. The exact ridden Vanguard instance is matched from the ride event target; draw resolves first, and a Quick Shield token is generated only when the opponent Vanguard grade is at least one."},effects:[{op:"draw",count:1},{op:"create-token",target:"controller",tokenId:"token-quick-shield",count:1,condition:{op:"opponent-vanguard-grade-at-least",grade:1}}]};
  }
  function compileRodeUponSecondPlayerDrawDefinition(cardId, abilityId, kind, printedText) {
    if (kind !== "AUTO" || !/^AUTO:\s*When this unit is rode upon, if you went second, draw a card\.(?:\s*\((?:You will be prompted to get the "Energy Generator" crest upon ride\.|Hold TAB to view the related card\.)\))*$/i.test(String(printedText || ""))) return null;
    return { id: abilityId, cardId, kind, printedText, requiredLocation: ["vanguard"], trigger: { status: "recognized-trigger", eventType: "card.ridden", subject: "event-target", circles: ["vanguard"] }, conditions: [{ type: "controller-went-second" }], source: { dataset: "Cardfight Area snapshot", snapshotDate: "2025-05-09", patternId: "auto-rode-upon-second-player-draw-v1", review: "Exact sentence plus the catalog’s exact Energy Generator reminder are accepted. The prior Vanguard is the ride event target; only an actual Ride from hand into Vanguard, controlled by the same player, enables the draw when that controller went second." }, effects: [{ op: "draw", count: 1 }] };
  }
  function compileRidePhaseDiscardCallRestDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO"||!/^AUTO\s*:?\s*When this card is discarded from hand during your ride phase, you may call this card to RC as rest\.$/i.test(String(printedText||"")))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-ride-phase-discard-source-call-rested-v1",officialReference:"https://en.cf-vanguard.com/cardlist/cardsearch/?expansion=220&s_param=d-Dark+States&sort=no&view=text",review:"The source itself must be the exact card discarded from hand during its controller's Ride Phase. It calls from Drop to a legal RC rested; a locked RC is invalid and a replaced unit is retired."},effects:[{op:"call-source-from-drop-rested",target:"source",position:"rest"}]};
  }
  function compileDiscardGradeCallRestDefinition(cardId,abilityId,kind,printedText){
    const ids=new Set(["cfa-12806","cfa-12807","cfa-12808","cfa-12817","cfa-12818","cfa-13028"]);
    const text=normalizePrintedText(printedText);
    if(kind!=="AUTO"||!ids.has(String(cardId))||abilityId!==`${cardId}:0`||!/^AUTO: When this card is discarded from hand during your turn, if your vanguard is grade 2 or greater, COST \[Soul Blast 1\], and call this card to RC\. If it is your battle phase, this unit cannot attack until end of turn\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,choicesReviewed:true,requiredLocation:["hand"],trigger:{status:"recognized-trigger",eventType:"card.discarded",subject:"event-subject",sourceLocation:"hand",destinationLocation:"drop",turnRelation:"controller"},conditions:[{type:"controller-turn"},{type:"controller-vanguard-grade-at-least",count:2}],costs:[{type:"soul-blast",count:1}],source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-turn-discard-grade-two-soul-blast-call-rested-v1",review:"Exact six-card family. The source is the exact card discarded from its controller's hand during that controller's turn; the live Vanguard must be grade 2 or greater when offered and resolved. Soul Blast 1 pays the cost, then the exact source is called rested from Drop to RC. When resolving during the battle phase, a turn-key restriction prevents the called unit from attacking even if it is later stood. No general discard or another copy can satisfy this trigger."},effects:[{op:"call-source-from-drop-rested",target:"source",position:"rest",cannotAttackTurnKeyWhenBattlePhase:true}]};
  }
  function compileGGuardianDiscardChargeChoiceDefinition(cardId,abilityId,kind,printedText){
    const text=normalizePrintedText(printedText);
    if(kind!=="AUTO"||!/^AUTO\s*:/i.test(text)||!/\bwhen (?:this card )?(?:is )?discarded(?: from hand)? for the cost of calling a G guardian\b/i.test(text)||!/\bCounter Charge 1 or Soul Charge 1\.$/i.test(text)||!/\bbind this card\b/i.test(text)||!/\banother[\s\S]{0,80}heal[\s\S]{0,55}drop/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-g-guardian-discard-bind-heal-charge-choice-v1",review:"Exact 48-record wording family. The source must be the exact Heal discarded from hand as a G-Guardian cost. Paying binds that source and a different Heal trigger from Drop face up, then the controller chooses Counter Charge 1 or Soul Charge 1; all selected instances and costs are revalidated."},costs:[{type:"source-bind",count:1},{type:"bind-heal-from-drop",count:1,filter:{trigger:"Heal"}}],effects:[{op:"g-guardian-discard-charge-choice",target:"controller"}]};
  }
  function compileGGuardianNamedCallDiscardDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:\s*\[Choose a grade (\d+) or less card from your hand, and discard it\]\s*When this card is discarded from your hand for a cost to call ["“]([^"”]+)["”] from your G zone, you may pay the cost\. If you do, draw a card\.$/i);
    if(!match)return null;
    const maximumGrade=Number(match[1]),calledGUnitName=match[2].trim();
    return{id:abilityId,cardId,kind,printedText,optional:true,calledGUnitName,conditionsReviewed:true,costsReviewed:true,choicesReviewed:true,costs:[{type:"discard",count:1,filter:{maxGrade:maximumGrade}}],trigger:{status:"recognized-trigger",eventType:"card.discarded",subject:"source",sourceLocation:"hand",destinationLocation:"drop",discardReason:"g-guardian-cost",actingPlayerRelation:"source-controller",calledGUnitName,calledGUnitPreviousLocation:"g-deck"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-g-guardian-named-call-discard-grade-one-draw-v1",review:"Exact optional G-Guardian cost ability. It triggers only when this exact instance is discarded from hand as the controller's cost to call the exact named card from G zone. The controller may then discard a distinct Grade 1 or lower card from hand to draw one card."},effects:[{op:"draw",count:1}]};
  }
  function compileGGuardianNamedCallSoulBlastCounterChargeDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO: \[Soul Blast (\d+)\] When this card is discarded from your hand for a cost to call ["“]([^"”]+)["”] from your G zone, if the number of face up cards in your damage zone is one or less, you may pay the cost\. If you do, Counter Charge (\d+)\.$/i);
    if(!match)return null;
    const soul=Number(match[1]),calledGUnitName=match[2].trim(),counterCharge=Number(match[3]);
    if(!positiveInteger(soul)||!calledGUnitName||!positiveInteger(counterCharge))return null;
    return{id:abilityId,cardId,kind,printedText,optional:true,calledGUnitName,conditions:[{type:"controller-face-up-damage-at-most",count:1}],conditionsReviewed:true,costs:[{type:"soul-blast",count:soul}],costsReviewed:true,choicesReviewed:true,trigger:{status:"recognized-trigger",eventType:"card.discarded",subject:"source",sourceLocation:"hand",destinationLocation:"drop",discardReason:"g-guardian-cost",actingPlayerRelation:"source-controller",calledGUnitName,calledGUnitPreviousLocation:"g-deck"},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"auto-g-guardian-named-call-soul-blast-counter-charge-v1",review:"Exact G-Guardian cost AUTO. The exact source must be discarded from its controller's hand to call the printed G Guardian from G zone; at trigger and resolution, the controller must have at most one face-up Damage card. The controller may pay the printed Soul Blast, then Counter Charge the printed amount."},effects:[{op:"counter-charge",count:counterCharge}]};
  }
  function compileVanguardTopFiveKeywordSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;const text=normalizePrintedText(printedText).replace(/\s*\(SHIFT \+ left click to count up attacks\.\)\s*\(SHIFT \+ right click to count down attacks\.\)\s*\(Middle click or hover and press SPACE to set number of attacks\.\)/i,"");
    const match=text.match(/^AUTO:\s*(?:COST\s*)?\[Counter Blast (\d+)(?: & Soul Blast (\d+))?\]\s*When this unit is placed on (VC(?:\/RC| or RC)?), you may pay the cost\. If you do, look at five cards from the top of your deck, (?:search for|reveal) up to one (?:card with (?:the )?(.+?) ability|<([^>]+)>)(?: from among them)?,?\s*(?:(?:reveal it to your opponent|show it to your opponent|reveal it),\s*)?put it into your hand, and shuffle your deck\.$/i);
    if(!match)return null;const keyword=String(match[4]||"").trim(),filter=match[5]?{race:match[5].trim()}:keyword.toLowerCase().includes(" or ")?{abilityKeywordsAny:keyword.split(/\s+or\s+/i).map(value=>value.trim().toLowerCase())}:{abilityKeyword:keyword.toLowerCase()};if(!filter.race&&!filter.abilityKeyword&&!filter.abilityKeywordsAny?.length)return null;
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-placement-top-five-filtered-search-hand-v1",review:"Exact AUTO: pay printed Counter-Blast/Soul-Blast after this source is placed on VC; inspect the top five; optionally select up to one matching ability-keyword or race card; reveal/add it and shuffle. The typed filter is validated against the exact top-five instances."},effects:[{op:"search-top-up-to-one-filtered-to-hand",target:"controller",lookCount:5,maximum:1,filter}]};
  }
  function compileAutoVanguardPlacementTopSevenTwoNameSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText);
    const match=text.match(/^AUTO\s*\[VC\]:\s*When placed, look at seven cards from the top of your deck, reveal up to one ["“]([^"”]+)["”] or ["“]([^"”]+)["”] from among them and put it into your hand, and shuffle your deck\.$/i);
    if(!match)return null;
    const names=[match[1].trim(),match[2].trim()];
    if(names.some(name=>!name)||names[0].toLowerCase()===names[1].toLowerCase())return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard"],choicesReviewed:true,optional:false,trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["vanguard"]},source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vanguard-placement-top-seven-two-name-search-v1",review:"Exact two-name top-seven AUTO. Only this source instance's successful placement on VC triggers it. The controller must resolve the triggered search and may reveal zero or one exact-name card among the top seven, add it to hand, and shuffle."},effects:[{op:"search-top-up-to-one-filtered-to-hand",target:"controller",lookCount:7,maximum:1,filter:{cardNamesAny:names}}]};
  }
  function compileActRearGuardTopFiveGradeThreeSearchDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT")return null;
    const text=normalizePrintedText(printedText);
    const match=text.match(/^ACT\s*\[RC\]:\s*\[Counter Blast 1\s*&\s*put this unit into your soul\]\s*Look at up to five cards from the top of your deck, search for up to one grade 3 or greater (?:«([^»]+)»|<([^>]+)>|card) from among them, reveal it(?: to your opponent)?, put it (?:to|into) your hand, and shuffle your deck\.$/i);
    if(!match)return null;
    const clan=String(match[1]||match[2]||"").trim();
    return{id:abilityId,cardId,kind,printedText,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1",review:"Exact Rear-Guard ACT family. The controller must legally activate this ACT during their turn, pay Counter Blast 1 and move this exact source from RC to Soul, then may select up to one Grade 3+ card from the top five. Printed clan qualifiers are enforced; unqualified 'card' wording adds no Unit restriction."},effects:[{op:"search-top-up-to-one-filtered-to-hand",target:"controller",lookCount:5,maximum:1,filter:{minGrade:3,...(clan?{cardType:"unit",clan}:{})}}]};
  }
  function compileActRcSoulBlastThreeDrawDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT")return null;
    const text=normalizePrintedText(printedText);
    if(!/^ACT\s*\[RC\]\s*1\/Turn:\s*COST\s*\[Soul Blast 3\],\s*and draw a card\.$/i.test(text))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],once:true,usageRestriction:{type:"once-per-turn",scope:"ability-instance",reset:"turn"},conditionsReviewed:true,costs:[{type:"soul-blast",count:3}],costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",officialReference:"https://en.cf-vanguard.com/wordpress/wp-content/uploads/Cardfight-Vanguard-Comprehensive-Rules-4.52.pdf",patternId:"act-rc-soul-blast-three-draw-v1",review:"Exact ACT wording on the two catalog records. This source must be controlled on RC during its controller's Main Phase; Soul Blast 3 is paid atomically, one card is drawn, and this exact ability instance is once per turn."},effects:[{op:"draw",count:1}]};
  }
  function compileActEnergyBlastTemporaryBoostDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="ACT"||!/^ACT \[RC\] 1\/Turn: COST \[Energy Blast 3\], until end of turn, this unit gets "Boost" and power \+5000\.$/i.test(normalizePrintedText(printedText)))return null;
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["rear-guard"],once:true,usageRestriction:{type:"once-per-turn",scope:"ability-instance",reset:"turn"},conditionsReviewed:true,costs:[{type:"energy-blast",count:3}],costsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"act-energy-blast-temporary-boost-power-v1",review:"Exact ACT family on five Grade 2 Rear-Guards. During its controller's Main Phase, pay Energy Blast 3 once per ability per turn; the source gains Boost and +5000 only through that turn. The granted Boost is removed by authoritative turn cleanup."},effects:[{op:"modify-power",target:"source",amount:5000,duration:"turn"},{op:"grant-temporary-boost",target:"source",duration:"turn"}]};
  }
  function expireTurnModifiers(state, endingPlayerId) {
    const seen=new Set(),walk=value=>{
      if(!value||typeof value!=="object"||seen.has(value))return;seen.add(value);
      for(const [property,expiry] of [["turnPowerBoost","turnPowerExpiry"],["turnCriticalBoost","turnCriticalExpiry"],["turnCriticalAbilityBoost","turnCriticalAbilityExpiry"],["turnDriveBoost","turnDriveExpiry"]]){
        if(value[expiry]===endingPlayerId||value[expiry]==null){if(Object.hasOwn(value,property))value[property]=0;delete value[expiry];}
      }
      if(value.temporaryBoostAbilityExpiry===endingPlayerId){if(value.temporaryBoostAbilityPrevious!==true)delete value.boostAbility;delete value.temporaryBoostAbility;delete value.temporaryBoostAbilityExpiry;delete value.temporaryBoostAbilityPrevious;}
      if(value.cannotDriveChecksExpiry===endingPlayerId||value.cannotDriveChecksExpiry==null){delete value.cannotDriveChecksThisTurn;delete value.cannotDriveChecksExpiry;}
      if(value.blazingExpiry===endingPlayerId||value.blazingExpiry==null){if(Object.hasOwn(value,"blazing"))delete value.blazing;delete value.blazingExpiry;}
      if(value.hollowedExpiry===endingPlayerId||value.hollowedExpiry==null){if(Object.hasOwn(value,"hollowed"))delete value.hollowed;delete value.hollowedExpiry;}
      if(value.chargingExpiry===endingPlayerId||value.chargingExpiry==null){if(Object.hasOwn(value,"charging"))delete value.charging;delete value.chargingExpiry;}
      if(value.engorgedExpiry===endingPlayerId||value.engorgedExpiry==null){if(Object.hasOwn(value,"engorged"))delete value.engorged;delete value.engorgedExpiry;}
      if(value.engorgeRetiredCountExpiry===endingPlayerId||value.engorgeRetiredCountExpiry==null){if(Object.hasOwn(value,"engorgeRetiredCount"))delete value.engorgeRetiredCount;delete value.engorgeRetiredCountExpiry;}
      Object.values(value).forEach(walk);
    };
    walk(state);return state;
  }  function evaluateContinuousEffects(abilities, context = {}) {
    const result={power:0,critical:0,drive:0};
    for(const ability of abilities||[]){
      if(ability?.kind!=="CONT"||!ability.definition)continue;
      const abilityLocation=context.sourceLocation||context.location;if(ability.requiredLocation?.length&&(!abilityLocation||!ability.requiredLocation.includes(abilityLocation)))continue;
      for(const effect of ability.definition.effects||[]){
        const sourceTargetMismatch=Boolean(context.sourceInstanceId&&context.targetInstanceId&&context.sourceInstanceId!==context.targetInstanceId);
        if(effect.target==="source"&&sourceTargetMismatch)continue;
        if(effect.op==="continuous-power-adjustment"&&effect.duration==="continuous"&&effect.target==="source"&&Number.isSafeInteger(Number(effect.amount))&&Number(effect.amount)!==0){
          if(effect.location&&effect.location!==abilityLocation)continue;
          if(continuousConditionMatches(effect.condition,context))result.power+=Number(effect.amount);continue;
        }
        if(effect.op==="continuous-power-per-soul-card"&&effect.duration==="continuous"&&effect.target==="source"&&positiveInteger(effect.amount)){
          if(effect.location&&effect.location!==abilityLocation)continue;
          if(!continuousConditionMatches(effect.condition,context))continue;
          const phrase=String(effect.cardNameContains||"").toLowerCase(),count=(context.soulCardNames||[]).filter(name=>!phrase||String(name).toLowerCase().includes(phrase)).length;
          result.power+=Number(effect.amount)*count;continue;
        }
        if(effect.op==="continuous-power-per-clan-rearguard"&&effect.duration==="continuous"&&effect.target==="source"&&positiveInteger(effect.amount)&&typeof effect.clan==="string"){
          if(effect.location&&effect.location!==abilityLocation)continue;
          if(!continuousConditionMatches(effect.condition,context)||!Array.isArray(context.controllerFieldCards))continue;
          const clan=effect.clan.trim().toLocaleLowerCase(),matchingIds=new Set();
          for(const card of context.controllerFieldCards){if(card?.zone!=="rear-guard"||typeof card.uid!=="string")continue;const clans=Array.isArray(card.clans)?card.clans:card.clan?[card.clan]:[];if(card.allClansAndNations===true||clans.some(value=>String(value||"").trim().toLocaleLowerCase()===clan))matchingIds.add(card.uid);}
          result.power+=Number(effect.amount)*matchingIds.size;continue;
        }
        if(effect.op==="continuous-power-per-dragontree-marker"&&effect.duration==="continuous"&&effect.target==="source"&&positiveInteger(effect.amount)){
          if(effect.location&&effect.location!==abilityLocation)continue;
          if(!continuousConditionMatches(effect.condition,context))continue;
          const count=Number(context.dragontreeMarkerCount);
          if(Number.isInteger(count)&&count>0)result.power+=Number(effect.amount)*count;continue;
        }
        if(effect.op==="continuous-power-per-controller-rearguard"&&effect.duration==="continuous"&&effect.target==="source"&&positiveInteger(effect.amount)){
          if(effect.location&&effect.location!==abilityLocation)continue;
          if(!continuousConditionMatches(effect.condition,context)||!Array.isArray(context.controllerFieldCards))continue;
          const ids=new Set(context.controllerFieldCards.filter(card=>card?.zone==="rear-guard"&&typeof card.uid==="string").map(card=>card.uid));
          result.power+=Number(effect.amount)*ids.size;continue;
        }
        if(effect.op==="continuous-power-per-named-face-up-damage-card"&&effect.duration==="continuous"&&effect.target==="source"&&positiveInteger(effect.amount)&&typeof effect.cardName==="string"){
          if(effect.location&&effect.location!==abilityLocation)continue;
          if(!continuousConditionMatches(effect.condition,context)||!Array.isArray(context.controllerDamageCards))continue;
          const expected=effect.cardName.trim().toLocaleLowerCase(),ids=new Set(context.controllerDamageCards.filter(card=>typeof card?.uid==="string"&&card.faceDown!==true&&(card.names||[]).some(name=>String(name).trim().toLocaleLowerCase()===expected)).map(card=>card.uid));
          result.power+=Number(effect.amount)*ids.size;continue;
        }
        if(!["continuous-power","continuous-critical"].includes(effect.op)||effect.duration!=="continuous"||!positiveInteger(effect.amount))continue;
        if(effect.location&&effect.location!==(context.sourceLocation||context.location))continue;
        if(effect.target==="all-controller-units"){if(effect.op==="continuous-power"&&effect.condition?.op==="controller-turn"&&effect.condition.sourceFaceUp===true&&effect.condition.targetHasNoAbilities===true&&context.isControllerTurn===true&&context.sourceFaceUp===true&&context.targetHasNoAbilities===true)result.power+=Number(effect.amount);continue}
        if(effect.target!=="source")continue;
        if(continuousConditionMatches(effect.condition,context))result[effect.op==="continuous-critical"?"critical":"power"]+=Number(effect.amount);
      }
    }
    return result;
  }
  function evaluateStrideCostGrade(abilities,context={}){
    let grade=0,treatedAsGradeThree=false;if(context.isPayingStrideCost!==true||context.location!=="hand")return{grade};
    for(const ability of abilities||[]){if(ability?.kind!=="CONT"||!ability.definition||!ability.requiredLocation?.includes("hand"))continue;for(const effect of ability.definition.effects||[])if(effect.op==="continuous-grade"&&effect.target==="source"&&effect.duration==="stride-payment"&&effect.condition?.op==="paying-stride-cost"&&positiveInteger(effect.amount)){if(effect.mode==="treat-as-grade-three")treatedAsGradeThree=true;else grade+=Number(effect.amount)}}
    return treatedAsGradeThree?{grade,treatedAsGradeThree}: {grade};
  }
  function evaluateContinuousGrade(abilities,context={}){
    let grade=0;const location=context.sourceLocation||context.location;
    if(location!=="trigger"||!context.sourceInstanceId||!context.targetInstanceId||context.sourceInstanceId!==context.targetInstanceId)return grade;
    for(const ability of abilities||[]){
      if(ability?.kind!=="CONT"||!ability.definition||!ability.requiredLocation?.includes(location))continue;
      for(const effect of ability.definition.effects||[]){
        if(effect.op!=="continuous-grade"||effect.target!=="source"||effect.duration!=="continuous"||effect.location!==location||!positiveInteger(effect.amount))continue;
        if(continuousConditionMatches(effect.condition,context))grade+=Number(effect.amount);
      }
    }
    return grade;
  }
  function evaluateContinuousRestrictions(abilities,context={}){
    const restrictions=[];for(const ability of abilities||[]){if(ability?.kind!=="CONT"||!ability.definition)continue;if(ability.requiredLocation?.length&&(!context.location||!ability.requiredLocation.includes(context.location)))continue;for(const restriction of ability.definition.continuousRestrictions||[]){if(restriction.type==="restraint"){restrictions.push({type:"restraint",abilityId:ability.id,legal:false,reason:"unit-with-restraint-cannot-attack"});continue}if(restriction.type==="cannot-be-boosted"){if(context.action==="boost")restrictions.push({type:restriction.type,abilityId:ability.id,legal:false,reason:"unit-cannot-be-boosted"});continue}if(restriction.type==="g-zone-cannot-turn-face-up-by-abilities"){if(context.action==="turn-face-up-by-ability"&&context.location==="g-zone")restrictions.push({type:restriction.type,abilityId:ability.id,legal:false,reason:"g-zone-card-cannot-be-turned-face-up-by-ability"});continue}if(restriction.type!=="lord")continue;const sourceHasAllClans=hasAbilityKeyword(context.sourceCard,"all-clans-and-nations"),clans=Array.isArray(context.sourceCard?.clans)?context.sourceCard.clans:context.sourceCard?.clan?[context.sourceCard.clan]:[];if(!sourceHasAllClans&&!clans.length)continue;const foreign=(context.controlledUnits||[]).filter(unit=>unit?.uid!==context.sourceInstanceId&&unit?.card).some(unit=>{if(sourceHasAllClans||hasAbilityKeyword(unit.card,"all-clans-and-nations"))return false;const other=Array.isArray(unit.card.clans)?unit.card.clans:unit.card.clan?[unit.card.clan]:[];return !other.length||!other.some(clan=>clans.includes(clan))});if(foreign)restrictions.push({type:"lord",abilityId:ability.id,legal:false,reason:"lord-requires-all-other-units-to-share-a-clan"});}}return{legal:restrictions.length===0,restrictions};
  }
  function evaluateContinuousShieldEffects(abilities,context={}){
    let shield=0;
    for(const ability of abilities||[]){
      if(ability?.kind!=="CONT"||!ability.definition)continue;
      if(ability.requiredLocation?.length&&(!context.location||!ability.requiredLocation.includes(context.location)))continue;
      for(const effect of ability.definition.effects||[]){
        if(effect.op!=="continuous-shield"||effect.target!=="source"||effect.duration!=="continuous"||!positiveInteger(effect.amount))continue;
        if(effect.location&&effect.location!==context.location)continue;
        if(continuousConditionMatches(effect.condition,context))shield+=Number(effect.amount);
      }
    }
    return{shield};
  }
  function validateEffectProgram(program, handlers, context = {}) {
    if (!Array.isArray(program) || !program.length) return { ok: false, reason: "empty-effect-program" };
    for (let index = 0; index < program.length; index++) {
      const step = program[index], handler = handlers?.[step?.op];
      if (!step || !effectOperations.has(step.op) || !handler || typeof handler.validate !== "function" || typeof handler.apply !== "function") return { ok: false, reason: "unsupported-effect", index };
      if (step.ifPreviousEffectSucceeded !== undefined && (!Number.isInteger(step.ifPreviousEffectSucceeded) || step.ifPreviousEffectSucceeded < 0 || step.ifPreviousEffectSucceeded >= index)) return { ok: false, reason: "invalid-effect-dependency", index };
      if (step.ifPreviousEffectSucceeded !== undefined && (!Number.isInteger(step.ifPreviousEffectSucceeded) || step.ifPreviousEffectSucceeded < 0 || step.ifPreviousEffectSucceeded >= index)) return { ok: false, reason: "invalid-effect-dependency", index };
      let valid = false;
      try { valid = handler.validate(step, context) === true; } catch { valid = false; }
      if (!valid) return { ok: false, reason: "invalid-effect", index };
    }
    return { ok: true };
  }
  function cloneEffectState(value, forward = new WeakMap(), reverse = new WeakMap(), trackMutable = true) {
    if (!value || typeof value !== "object") return value;
    if (forward.has(value)) return forward.get(value);
    const trackOriginal = trackMutable && !Object.isFrozen(value);
    const copy = Array.isArray(value) ? [] : {};
    forward.set(value, copy);
    if (trackOriginal) reverse.set(copy, value);
    for (const key of Object.keys(value)) copy[key] = cloneEffectState(value[key], forward, reverse, trackOriginal);
    return copy;
  }
  function commitEffectState(target, draft, reverse, seen = new WeakSet()) {
    if (!target || !draft || typeof target !== "object" || typeof draft !== "object" || seen.has(target)) return;
    seen.add(target);
    if (Array.isArray(target) && Array.isArray(draft)) {
      const values = draft.map(value => {
        if (!value || typeof value !== "object") return value;
        const original = reverse.get(value);
        if (!original) return cloneEffectState(value);
        commitEffectState(original, value, reverse, seen); return original;
      });
      target.splice(0, target.length, ...values); return;
    }
    for (const key of Object.keys(target)) if (!Object.hasOwn(draft, key)) delete target[key];
    for (const key of Object.keys(draft)) {
      const value = draft[key], original = value && typeof value === "object" ? reverse.get(value) : null;
      if (original) { commitEffectState(original, value, reverse, seen); target[key] = original; }
      else target[key] = value && typeof value === "object" ? cloneEffectState(value) : value;
    }
  }
  function resolveEffectProgram(program, handlers, context = {}, beforeEffects = null) {
    const validation = validateEffectProgram(program, handlers, context);
    if (!validation.ok) return { ...validation, applied: 0 };
    const reverse = new WeakMap(), events = [], emitEvent = context.emitEvent, draft = cloneEffectState(context, new WeakMap(), reverse);
    if (typeof emitEvent === "function") draft.emitEvent = event => events.push(event);
    if (beforeEffects) {
      try { if (beforeEffects(draft) === false) return { ok: false, reason: "cost-payment-rejected", applied: 0 }; } catch { return { ok: false, reason: "cost-payment-failed", applied: 0 }; }
      const postCostValidation = validateEffectProgram(program, handlers, draft);
      if (!postCostValidation.ok) return { ...postCostValidation, applied: 0 };
    }
    const results = [];
    try {
      for (const step of program) {
        if (step.ifPreviousEffectSucceeded !== undefined && !results[step.ifPreviousEffectSucceeded]) { results.push(null); continue; }
        if (step.ifPreviousEffectSucceeded !== undefined && !results[step.ifPreviousEffectSucceeded]) { results.push(null); continue; }
        const result = handlers[step.op].apply(step, draft);
        if (result === false) return { ok: false, reason: "effect-handler-rejected", applied: 0, results };
        results.push(result);
        if (draft.effectDeckOut) break;
      }
    } catch {
      return { ok: false, reason: "effect-handler-failed", applied: 0, results };
    }
    commitEffectState(context, draft, reverse);
    if (typeof emitEvent === "function") { context.emitEvent = emitEvent; for (const event of events) context.emitEvent(event); }
    const deckOut = draft.effectDeckOut ? { ...draft.effectDeckOut } : null;
    if (deckOut && typeof context.onEffectDeckOut === "function") context.onEffectDeckOut(deckOut);
    return { ok: true, applied: results.length, results, ...(deckOut ? { deckOut } : {}) };
  }
  function parseAbilityLocation(raw) {
    const header=String(raw||"").match(/^(?:\(([^)]*)\)|\[([^\]]*)\])\s*:?\s*/);
    if(!header)return [];
    const text=(header[1]||header[2]).trim().toUpperCase(),locations=[];
    if(!/^(?:VC\/RC|VC|RC|GC|SC|DROP|SOUL|HAND|BIND|DAMAGE(?: ZONE)?|VC\/G ZONE|G ZONE)$/.test(text))return locations;
    if(text==="VC"||text==="VC/RC")locations.push("vanguard");
    if(text==="VC/G ZONE")locations.push("vanguard","g-zone");if(text==="G ZONE")locations.push("g-zone");
    if(text==="RC"||text==="VC/RC")locations.push("rear-guard");
    if(text==="GC")locations.push("guardian");
    if(text==="HAND")locations.push("hand");
    if(text==="SC"||text==="SOUL")locations.push("soul");
    return locations;
  }
  function compileAutoTrigger(raw) {
    const text=String(raw||"").replace(/^(?:\([^)]*\)|\[[^\]]*\])\s*:?\s*/,"").replace(/^(?:\[[^\]]+\]\s*)+/,"");
    const result=(eventType,subject,circles=[])=>({status:"recognized-trigger",eventType,subject,circles});
    if(/^when (?:this card )?(?:is )?discarded(?: from hand)? for the cost of calling a G guardian\b/i.test(text))return {...result("card.discarded","source"),sourceLocation:"hand",destinationLocation:"drop",discardReason:"g-guardian-cost"};
    if(/^Blaze\.?$/i.test(text))return{...result("attack.step-started","controller"),turnRelation:"controller"};const blaze=text.match(/^Blaze \(At the beginning of (?:your (?:first|each)|each of your) attack, if the number of rear-guards you have is greater than your opponent[’']s, your vanguard becomes blazing until end of turn\.\)$/i);if(blaze)return{...result("attack.step-started","controller"),turnRelation:"controller",...(/beginning of your first attack/i.test(text)?{firstAttackOnly:true}:{})};
    if(/^Engorge\.?$/i.test(text)||/^Engorge \(When this unit attacks, you may retire one or more of your other rear-guards\. If you do, it is engorged until end of turn\.\)$/i.test(text))return result("unit.attacked","source");
    if(/^when(?:ever)? this unit becomes engorged\b/i.test(text))return result("unit.became_engorged","source");
    if(/^when(?:ever)? this unit (?:becomes? )?legion\b/i.test(text))return result("unit.legioned","source");
    if(/^when(?:ever)? your vanguard (?:becomes? )?legion\b/i.test(text))return result("unit.legioned","vanguard");
    const revelation=text.match(/^Revelation - (VC\/RC|VC|RC)(?:\s*\(When this unit is placed on the specified circle, look at the top card of your deck, and you may put that card into your soul\. If you do, rest one of your rear-guards\.\))?\.?$/i);if(revelation){const circles=revelation[1].toUpperCase()==="VC"?["vanguard"]:revelation[1].toUpperCase()==="RC"?["rear-guard"]:["vanguard","rear-guard"];return result("card.placed","source",circles)}
    if(/^Hollow\.?$/i.test(text))return result("card.placed","source",["rear-guard"]);const hollow=text.match(/^Hollow \(When this unit is placed on RC, you may have (?:this unit|it) become hollowed\. If you do, retire it at the end of turn\.?\)$/i);if(hollow)return result("card.placed","source",["rear-guard"]);
    if(/^Afterimage\.?$/i.test(text))return{...result("card.moved","any"),sourceLocation:"bind",destinationLocation:"hand",movedCardOwnerRelation:"opponent"};const afterimage=text.match(/^Afterimage \(When your opponent puts a bound card into (?:his or her|their) hand, if your hand has six or less cards, you may return this unit to your hand\.?\)$/i);if(afterimage)return{...result("card.moved","any"),sourceLocation:"bind",destinationLocation:"hand",movedCardOwnerRelation:"opponent"};
    if(/^Charge\.?$/i.test(text))return{...result("card.placed","source",["rear-guard"]),effectPlacementOnly:true};if(/^Charge \((?:During the turn that this unit is placed on RC by an effect, (?:it becomes in Charge, and put it on the bottom of you deck at the end of the battle in which it participated\.|you may have this unit become in Charge\. If you do, put it on the bottom of your deck at the end of a battle in which it participated\.)|When this unit is placed on RC due to an effect, you may have (?:this unit|it) become charging for that turn\. If you do, put it on the bottom of your deck at the end of its battle\.)\)$/i.test(text))return{...result("card.placed","source",["rear-guard"]),effectPlacementOnly:true};
    const placedHeader=String(raw||"").match(/^\[(VC|RC|VC\/RC)\]\s*:?\s*When placed\b/i);if(placedHeader){const circles=placedHeader[1].toUpperCase()==="VC"?["vanguard"]:placedHeader[1].toUpperCase()==="RC"?["rear-guard"]:["vanguard","rear-guard"];return {...result("card.placed","source",circles),...( /\bwhen placed from hand\b/i.test(String(raw||""))?{sourceLocation:"hand"}:{})}}
    if(/^\[GC\]\s*:?[\s]*When placed\b/i.test(String(raw||"")))return result("card.placed","source",["guardian"]);
    if(/^at the end of the battle this unit boosted\b/i.test(text))return result("battle.close-step","booster");
    const ridePhase=text.match(/\bat the beginning of your ride phase\b/i);if(ridePhase)return {...result("phase.changed","controller"),requiredPhase:"ride",turnRelation:"controller"};const mainPhase=text.match(/\bat the beginning of your main phase\b/i);if(mainPhase)return {...result("phase.changed","controller"),requiredPhase:"main",turnRelation:"controller"};if(/\bwhen this card is revealed during your damage check\b/i.test(text))return result("damage.checked","event-subject");
    const normalUnitDriveCheck=text.match(/^(?:Generation Break \d+(?:\s*\([^)]*\))?:\s*)?(?:\[[^\]]+\]\s*)*when your drive check reveals a normal unit\b/i);if(normalUnitDriveCheck){const abilityless=/\bwith no (?:CONT,?\s*)?ACT,?\s*or AUTO abilities\b/i.test(text),sourceAttack=/\bduring the battle this unit attacked\b/i.test(text);return{...result("drive.checked",sourceAttack?"source":"controller"),checkKind:"drive",checkedCardTriggerType:"",...(abilityless?{checkedCardHasNoAbilities:true}:{}),...(sourceAttack?{requiresBattleSourceMatch:true}:{})}}
    const controllerVanguardDriveCheck=text.match(/^when your vanguards? drive check reveals a grade (\d+) [«<]([^»>]+)[»>]/i);if(controllerVanguardDriveCheck)return{...result("drive.checked","controller"),checkKind:"drive",checkSourceLocation:"vanguard",revealedGrade:Number(controllerVanguardDriveCheck[1]),revealedClan:controllerVanguardDriveCheck[2]};
    const vanguardDriveCheck=text.match(/^when this unit[’']s drive check reveals (?:a )?(?:grade (\d+) )?[«<]([^»>]+)[»>]/i);if(vanguardDriveCheck)return{...result("drive.checked","source"),checkKind:"drive",revealedGrade:vanguardDriveCheck[1]?Number(vanguardDriveCheck[1]):null,revealedClan:vanguardDriveCheck[2]};
    const driveCheckFront=text.match(/^(?:\d+\/turn:\s*)?when your drive check reveals a front trigger\b/i);if(driveCheckFront)return{...result("drive.checked","controller"),checkKind:"drive",revealedTrigger:"front"};
    const driveCheckHeal=text.match(/^(?:\d+\/turn:\s*)?when your drive check reveals a heal trigger\b/i);if(driveCheckHeal)return{...result("drive.checked","controller"),checkKind:"drive",revealedTrigger:"heal",turnRelation:"controller"};
    if(/^Success\s+\d+\s*(?:\(When your rear-guards power becomes \d+ or greater, this unit becomes successful until end of turn\.\))?\.?$/i.test(text))return{...result("characteristic.changed","controller"),turnRelation:"controller"};
    const turnEnd=text.match(/\bat the end of (your|your opponent.{0,2}s) turn\b/i)||text.match(/\bwhen (your|your opponent.{0,2}s) turn ends\b/i);if(turnEnd){const relation=/opponent/i.test(turnEnd[1])?"opponent":"controller";return {...result("turn.ended",relation==="opponent"?"any":"controller"),turnRelation:relation}}
    const turnStart=text.match(/\bat the beginning of (your|your opponent.{0,2}s) turn\b/i)||text.match(/\bwhen (your|your opponent.{0,2}s) turn begins\b/i);if(turnStart){const relation=/opponent/i.test(turnStart[1])?"opponent":"controller";return {...result("turn.started",relation==="opponent"?"any":"controller"),turnRelation:relation}}
    const attacked=text.match(/\bwhen(?:ever)?\s+(this unit|this card|your vanguard|another unit|a unit|any unit)\s+(?:is\s+)?attacked\b/i);if(attacked){const phrase=attacked[1].toLowerCase(),subject=/^this (?:unit|card)$/.test(phrase)?"event-subject":phrase==="your vanguard"?"vanguard":/^another unit$/.test(phrase)?"any":"any";return {...result("attack.declared",subject),excludeSourceAsSubject:/^another unit$/.test(phrase),requiresUnboostedAttacker:/^this (?:unit|card)$/.test(phrase)&&/\bwithout being boosted\b/i.test(text)}}
    const standSelf=text.match(/\bwhen(?:ever)?\s+(this unit|this card)\s+(?:is\s+)?(?:stood|stands?)\b/i);if(standSelf)return result("unit.stood","event-subject");    const drawSelf=text.match(/\bwhen(?:ever)?\s+(this unit|this card)\s+(?:is\s+)?drawn\b/i);if(drawSelf)return result("card.drawn","event-subject");if(/\bwhen(?:ever)?\s+you\s+draws?\s+(?:a|one|\d+)?\s*cards?\b/i.test(text))return result("card.drawn","controller");if(/\bwhen(?:ever)?\s+a player\s+draws?\s+(?:a|one|\d+)?\s*cards?\b/i.test(text))return result("card.drawn","any");
    if(/^(?:Generation Break \d+(?:\s*\([^)]*\))?:\s*)?when this unit intercepts\b/i.test(text))return {...result("card.placed","source",["guardian"]),sourceLocation:"rear-guard"};
    if(/\bwhen(?:ever)?\s+your grade \d+ or greater vanguard with ["“][^"”]+["”] in its card name attacks?\b/i.test(text))return result("unit.attacked","vanguard");
    if(/\bwhen(?:ever)?\s+your vanguard\s+attacks?\b/i.test(text))return result("unit.attacked","vanguard");
    if(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+attacks?\b/i.test(text)){const target=text.match(/\battacks?\s+(?:a|an|the)\s+(vanguard|rear[- ]guard)\b/i)?.[1];return {...result("unit.attacked","source"),targetLocation:target?/rear/i.test(target)?"rear-guard":"vanguard":null};}
    const boostedBy=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+(?:is\s+)?boosted by (?:a |an )?[«]([^»]+)[»]/i);if(boostedBy)return {...result("unit.boosted","boosted-unit"),boosterClan:boostedBy[1]};const boostedByRace=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+(?:is\s+)?boosted by (?:a |an )?[<]([^>]+)[>]/i);if(boostedByRace)return {...result("unit.boosted","boosted-unit"),boosterRace:boostedByRace[1]};const boostedByName=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+(?:is\s+)?boosted by (?:a |an )?unit with ["“]([^"”]+)["”] in its card name/i);if(boostedByName)return {...result("unit.boosted","boosted-unit"),boosterCardNameContains:boostedByName[1]};const boostedByPower=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+(?:is\s+)?boosted by (?:a |an )?unit with power of (\d+) or greater/i);if(boostedByPower)return {...result("unit.boosted","boosted-unit"),boosterPowerAtLeast:Number(boostedByPower[1])};
    const namedBoost=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\s+(?:(?:a|an)\s+)?(?:unit|card) named ["“]([^"”]+)["”]/i)||text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\s+["“]([^"”]+)["”]/i);
    if(namedBoost)return {...result("unit.boosted","source"),boostedUnitName:namedBoost[1]};
    const limitBreakBoost=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\s+(?:a|an)\s+[«]([^»]+)[»]\s+with Limit Break\s+(\d+)\b/i);
    if(limitBreakBoost)return {...result("unit.boosted","source"),boostedUnitClan:limitBreakBoost[1],boostedUnitLimitBreak:Number(limitBreakBoost[2])};
    const namedSubstringBoost=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\s+(?:a|an)\s+(?:unit|card) with ["“]([^"”]+)["”] in its card name/i);
    if(namedSubstringBoost)return {...result("unit.boosted","source"),boostedUnitNameContains:namedSubstringBoost[1]};
    const boostGrade=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\s+a grade (\d+) or greater unit\b/i);
    if(boostGrade)return {...result("unit.boosted","source"),boostedUnitGradeAtLeast:Number(boostGrade[1])};
    if(/\bwhen(?:ever)?\s+(?:this unit|this card)\s+boosts?\b/i.test(text)){const target=text.match(/\bboosts?\s+(?:a|an|the)\s+(vanguard|rear[- ]guard)\b/i)?.[1];return {...result("unit.boosted","source"),targetLocation:target?/rear/i.test(target)?"rear-guard":"vanguard":null}}
    if(/^Harmony(?:\s*\(When (?:another of your units is placed on the same column as this unit, both units are in Harmony state until end of turn\.|your other unit is placed in the same column as this unit, both units become in harmony until end of turn\.?))?\)?\.?$/i.test(text))return result("card.placed","any");
    if(/\bwhen(?:ever)?\s+this unit becomes in harmony(?: state)?\b/i.test(text))return result("unit.became_harmony","source");
    const rideByClan=text.match(/^when another [<«]([^>»]+)[>»] rides this unit, you may call this card to RC\.$/i);if(rideByClan)return {...result("card.ridden","ridden-unit"),riderClan:rideByClan[1]};
    const rideExceptNamed=text.match(/^when a [<«]([^>»]+)[>»] other than a card named ["“]([^"”]+)["”] rides this unit, you may call this card to RC\.$/i);if(rideExceptNamed)return {...result("card.ridden","ridden-unit"),riderClan:rideExceptNamed[1],excludedRiderName:rideExceptNamed[2]};
    if(/^forerunner\b/i.test(text))return result("card.ridden","event-subject");
    if(/\bwhen(?:ever)?\s+(?:an|the) attack hits?[^.]*\bthis unit boosted\b/i.test(text))return result("attack.hit","booster");
    if(/\bwhen(?:ever)?\s+its attack hits?\b/i.test(text))return result("attack.hit","source");
    const sourceHitTarget=text.match(/\bwhen(?:ever)?\s+(?:this unit|this card)(?:\x27s|\u2019s) attack hits?\s+(?:a |an |the )?(vanguard|rear[- ]guard)\b/i);if(sourceHitTarget)return {...result("attack.hit","source"),targetLocation:/rear/i.test(sourceHitTarget[1])?"rear-guard":"vanguard"};
    if(/\bwhen(?:ever)?\s+this card\s+(?:is\s+)?put into (?:(?:your|the) )?Order Zone\b/i.test(text))return result("card.placed","source",["order"]);
    if(/\bwhen(?:ever)?\s+(?:this unit|this card)(?:\x27s|\u2019s)? attack hits?\b|\bwhen(?:ever)?\s+(?:this unit|this card) hits?\b/i.test(text))return result("attack.hit","source");
    if(/\bwhen(?:ever)?\s+(?:another unit|a unit)\s+(?:is\s+)?placed\s+on\s+\(?\s*VC\b[^.]*\bby riding this unit\b/i.test(text))return result("card.ridden","event-target",["vanguard"]);
    if(/\bwhen(?:ever)?\s+rode upon\b/i.test(text)||/\bwhen(?:ever)?\s+(?:this unit|this card)\s+(?:is\s+)?(?:rode|ridden) upon\b/i.test(text))return result("card.ridden","event-subject",["vanguard"]);
    const guardianPut=text.match(/\bwhen(?:ever)?\s+(this unit|this card)\s+(?:is\s+)?put\s+(?:on|into)\s+(?:your\s+)?(?:GC|guardian circle)(?:\s+(from hand))?\b/i);if(guardianPut)return {...result("card.placed","source",["guardian"]),sourceLocation:guardianPut[2]?"hand":null};
    if(/^when retired from GC\b/i.test(text))return {...result("card.retired","source"),sourceLocation:"guardian",destinationLocation:"drop"};
    const placement=text.match(/\bwhen(?:ever)?\s+(this unit|this card|your vanguard|another unit|a unit|any unit)\s+(?:is\s+)?(?:placed|called)\s+(?:on|onto)\s+([^,.;]+)/i);
    if(placement){const place=placement[2],circles=[];if(/\bVC\b|vanguard circle/i.test(place))circles.push("vanguard");if(/\bRC\b|rear[- ]guard circle/i.test(place))circles.push("rear-guard");if(/\bGC\b|guardian circle/i.test(place))circles.push("guardian");const sameSourceCircle=/\b(?:this unit|this card)(?:\x27|’)?s (?:circle|VC|RC)\b|\b(?:the )?same circle as this (?:unit|card)\b/i.test(place),subject=/^this (?:unit|card)$/i.test(placement[1])?"source":/^your vanguard$/i.test(placement[1])?"vanguard":"any";if(circles.length||sameSourceCircle)return {...result("card.placed",subject,circles),sameSourceCircle,excludeSourceAsSubject:/^another unit$/i.test(placement[1]),sourceLocation:/\bfrom (?:your )?hand\b/i.test(place)?"hand":/\bfrom (?:your )?deck\b/i.test(place)?"deck":null}}
    if(/^when retired from GC\b/i.test(text))return {...result("card.retired","source"),sourceLocation:"guardian",destinationLocation:"drop"};
    const movementRules = [
      [/\bwhen(?:ever)?\s+(this unit|this card|another unit|another card|a unit|a card|another rear-guard|a rear-guard)\s+(?:is\s+)?retired\b/i, "card.retired", "drop"],
      [/\bwhen(?:ever)?\s+(this unit|this card|another unit|another card|a unit|a card|another rear-guard|a rear-guard)\s+(?:is\s+)?bound\b/i, "card.bound", "bind"],
      [/\bwhen(?:ever)?\s+(this unit|this card|another unit|another card|a unit|a card|another rear-guard|a rear-guard)\s+(?:is\s+)?discarded\b/i, "card.discarded", "drop"],
      [/\bwhen(?:ever)?\s+this (?:unit|card)\s+(?:is\s+)?(?:put|moved|placed)\s+(?:into|to)\s+(?:the )?drop zone\b/i, "card.moved", "drop"],
      [/\bwhen(?:ever)?\s+this (?:unit|card)\s+(?:is\s+)?(?:put|moved|placed)\s+(?:into|to)\s+(?:your )?soul\b/i, "card.moved", "soul"],
      [/\bwhen(?:ever)?\s+this (?:unit|card)\s+(?:is\s+)?returned\s+to\s+(?:your )?hand\b/i, "card.moved", "hand"],
      [/\bwhen(?:ever)?\s+this (?:unit|card)\s+(?:is\s+)?returned\s+to\s+(?:your )?(?:the )?(?:top of the |bottom of the )?deck\b/i, "card.moved", "deck"],
      [/\bwhen(?:ever)?\s+this (?:unit|card)\s+(?:is\s+)?(?:put|moved|placed)\s+(?:into|to)\s+(?:your )?(?:the )?deck\b/i, "card.moved", "deck"],
    ];
    for (const [pattern, eventType, destinationLocation] of movementRules) {
      const movementMatch=text.match(pattern);if(!movementMatch)continue;
      const from = text.match(/\bfrom\s+(?:(?:your|the|a|an) )?(hand|soul|deck|damage zone|bind zone|drop zone|guardian circle|GC|rear-guard circle|RC|vanguard circle|VC)\b/i)?.[1];
      const sourceLocation = from ? (/rear-guard circle|\bRC\b/i.test(from) ? "rear-guard" : /vanguard circle|\bVC\b/i.test(from) ? "vanguard" : /guardian circle|\bGC\b/i.test(from) ? "guardian" : from.toLowerCase().replace(/ zone$/, "")) : null;
      const phrase=String(movementMatch[1]||"this unit").toLowerCase(),subject=phrase==="this unit"||phrase==="this card"?"source":"any";
      const discardReason=/discarded(?: from hand)? for the cost of calling a g guardian/i.test(text)?"g-guardian-cost":null;
      if(discardReason)return { ...result(eventType, subject), destinationLocation, sourceLocation, excludeSourceAsSubject:/^another /.test(phrase), requiredPhase:/during your ride phase/i.test(text)?"ride":null, discardReason };
      return { ...result(eventType, subject), destinationLocation, sourceLocation, excludeSourceAsSubject:/^another /.test(phrase), requiredPhase:/\bduring your ride phase\b/i.test(text)?"ride":null };
    }
    return {status:"needs-review",eventType:null,subject:null,circles:[]};
  }
  function parseAbilityCosts(raw) {
    // This phrase is a condition about Energy Blast already paid for card
    // abilities during the turn, not a cost paid to activate this AUTO.
    const text = String(raw || ""), costText=text
      .replace(/\bwhile (?:you are )?paying the cost for \[?Stride\]?/gi," ")
      .replace(/\bif you Energy Blast \d+ or more at the same time for the cost of your card[’']s ability this turn\b/gi," ");
    const explicit = [...costText.matchAll(/\bCOST\s*\[([^\]]+)\]|\[((?:CB|SB|E\s*BLAST|Counter[- ]Blast|Soul[- ]Blast|Energy[- ]Blast|discard|choose (?:a|one) (?:card|«[^»]+»|<[^>]+>) from (?:your )?hand[^\]]*discard it|rest this unit|put this (?:unit|card) into (?:your )?soul)[^\]]*)\]/gi)];
    const mentionsCost = /\bCOST\b|\b(?:CB|SB|E\s*BLAST|Counter[- ]Blast|Soul[- ]Blast|Energy[- ]Blast|discard|retire this unit|rest this unit|put this unit into your soul)\b/i.test(costText);
    if (!explicit.length) return { status: mentionsCost ? "needs-review" : "no-cost", costs: [] };
    const clause = explicit.map(match => match[1] || match[2]).join(" & ");
    // Preserve explicit alternative cost branches. Only split top-level `or`
    // clauses here; each branch must independently parse as a complete cost.
    if (/\b(?:or|either)\b/i.test(clause)) {
      const branches = clause.split(/\s+or\s+/i).map(value => value.trim());
      if (branches.length < 2 || branches.some(value => /\beither\b/i.test(value))) return { status: "needs-review", costs: [] };
      const costAlternatives = branches.map(branch => {
        const parsed = [];
        let rest = branch;
        for (const [type, pattern] of [
          ["counter-blast", /(?:CB|Counter[- ]Blast)\s*\(?\s*(\d+)/gi],
          ["energy-blast", /(?:E\s*Blast|Energy[- ]Blast)\s*\(?\s*(\d+)/gi],
          ["soul-blast", /(?:SB|Soul[- ]Blast)\s*\(?\s*(\d+)/gi]
        ]) {
          for (const match of branch.matchAll(pattern)) parsed.push({ type, count: Number(match[1]) });
          rest = rest.replace(pattern, " ");
        }
        const residue = rest.replace(/[\s&+(),.;:[\]0-9-]/g, "").toLowerCase();
        return residue || !parsed.length ? null : parsed;
      });
      if (costAlternatives.some(branch => !branch)) return { status: "needs-review", costs: [] };
      return { status: "supported-cost-alternatives", costs: [], costAlternatives };
    }
    const costs = [];
    const patterns = [
      ["counter-blast", /(?:CB|Counter[- ]Blast)\s*\(?\s*(\d+)/gi],
      ["soul-blast", /(?:SB|Soul[- ]Blast)\s*\(?\s*(\d+)/gi],
      ["energy-blast", /(?:E\s*Blast|Energy[- ]Blast)\s*\(?\s*(\d+)/gi],
      ["source-retire", /retire\s+this\s+(?:unit|card)/gi],
      ["source-discard", /discard\s+this\s+(?:unit|card)/gi],
      ["discard", /discard(?:ing)?\s+(?:a|one|(\d+))\s+cards?(?:\s+from\s+(?:your\s+)?hand)?/gi],
      ["discard", /choose\s+(?:a|one)\s+card\s+from\s+(?:your\s+)?hand,?\s+and\s+discard\s+it/gi],
      ["source-to-soul", /put\s+this\s+(?:unit|card)\s+into\s+(?:your\s+)?soul/gi],
      ["source-to-bottom-deck", /put\s+this\s+(?:unit|card)\s+on\s+(?:the\s+)?bottom\s+of\s+(?:your\s+)?deck/gi]
    ];
    let remainder = clause;
    const clanCounterBlast = /(?:CB|Counter[- ]Blast)\s*\(?\s*(\d+)\s*-\s*(?:«([^»]+)»|<([^>]+)>)/gi;
    for (const match of clause.matchAll(clanCounterBlast)) costs.push({ type: "counter-blast", count: Number(match[1]), filter: { clan: String(match[2] || match[3]).trim() } });
    remainder = remainder.replace(clanCounterBlast, " ");
    for (const match of clause.matchAll(/reveal\s+a\s+grade\s+(\d+)\s+card\s+from\s+(?:your\s+)?hand/gi)) costs.push({type:"reveal-grade-from-hand",count:1,grade:Number(match[1])});
    remainder=remainder.replace(/reveal\s+a\s+grade\s+\d+\s+card\s+from\s+(?:your\s+)?hand/gi," ");
    const clanDiscard=/choose\s+(?:a|one)\s+(?:«([^»]+)»|<([^>]+)>)\s+from\s+(?:your\s+)?hand,?\s+and\s+discard\s+it/gi;
    for(const match of clause.matchAll(clanDiscard)){costs.push({type:"discard",count:1,filter:{clan:String(match[1]||match[2]).trim()}})}
    remainder=remainder.replace(clanDiscard," ");
    for (const [type, pattern] of patterns) {
      for (const match of remainder.matchAll(pattern)) costs.push({ type, count: Number(match[1] || 1) });
      remainder = remainder.replace(pattern, " ");
    }
    if (/rest this unit/i.test(remainder)) { costs.push({ type: "rest-source", count: 1 }); remainder = remainder.replace(/rest this unit/i, " "); }
    const residue = remainder.replace(/[\s&+(),.;:[\]0-9-]/g, "").toLowerCase();
    if (residue || !costs.length) return { status: "needs-review", costs: [] };
    return { status: "supported-cost", costs };
  }
  function canPayAbilityCosts(ability, resources = {}) {
    if (!ability || ability.costStatus === "needs-review") return false;
    if (Array.isArray(ability.costAlternatives)) return ability.costAlternatives.some(costs => canPayAbilityCosts({ ...ability, costs, costAlternatives: undefined }, resources));
    const costs = ability.costs || [];
    for (const cost of costs) {
      if (cost.type === "counter-blast" && Number(resources.faceUpDamage || 0) < cost.count) return false;
      if (cost.type === "counter-blast" && cost.filter) {
        const cards = resources.faceUpDamageCards;
        if (!Array.isArray(cards) || typeof resources.cardDefinitionForInstance !== "function") return false;
        const matches = cards.filter(card => !card.faceDown && matchesTargetFilter(cost.filter, { targetCard: resources.cardDefinitionForInstance(card) }));
        if (matches.length < Number(cost.count)) return false;
      }
      if (cost.type === "soul-blast" && Number(resources.soulCount || 0) < cost.count) return false;
      if (cost.type === "energy-blast" && (resources.hasEnergyGenerator !== true || Number(resources.energy ?? 0) < Number(cost.count))) return false;
      if (cost.type === "discard") {
        if (Number(resources.discardableHand ?? resources.discardableHandCards?.length ?? 0) < cost.count) return false;
        if (cost.filter) {
          const cards = resources.discardableHandCards;
          if (!Array.isArray(cards) || typeof resources.cardDefinitionForInstance !== "function") return false;
          const matches = cards.filter(card => matchesTargetFilter(cost.filter, { targetCard: resources.cardDefinitionForInstance(card) }));
          if (matches.length < Number(cost.count)) return false;
        }
      }
      if (cost.type === "reveal-grade-from-hand" && Number(resources.revealableHandByGrade?.[cost.grade] || (cost.grade===3?resources.revealableGradeThreeHand:0) || 0) < cost.count) return false;
      if (cost.type === "source-discard" && resources.sourceCanDiscard !== true) return false;
      if (cost.type === "rest-source" && resources.sourceRested) return false;
      if (cost.type === "source-to-soul" && resources.sourceCanMoveToSoul !== true) return false;
      if (cost.type === "source-to-bottom-deck" && resources.sourceCanMoveToBottomDeck !== true) return false;
      if (cost.type === "source-retire" && resources.sourceCanRetire !== true) return false;
      if (cost.type === "source-bind" && resources.sourceCanBind !== true) return false;
      if (cost.type === "source-bind-from-field-or-drop" && resources.sourceCanBindFromFieldOrDrop !== true) return false;
      if (cost.type === "bind-heal-from-drop" && Number(resources.bindableHealInDrop || 0) < cost.count) return false;
    }
    return true;
  }
  function evaluateAutoCostPayment(ability,resources={},decision=null){
    if(!ability||ability.kind!=="AUTO")return{ok:false,reason:"not-auto-ability"};
    if(!Array.isArray(ability.costs))return{ok:false,reason:"invalid-cost-definition"};
    if(Array.isArray(ability.costAlternatives)){
      if(decision!==null&&typeof decision!=="boolean")return{ok:false,reason:"invalid-cost-decision"};
      if(decision===false)return{ok:true,payCost:false,applyEffects:false,reason:"cost-not-paid"};
      if(!canPayAbilityCosts(ability,resources))return{ok:true,payCost:false,applyEffects:false,reason:"unpayable-cost"};
      return{ok:true,payCost:true,applyEffects:true};
    }
    if(!ability.costs.length)return{ok:true,payCost:true,applyEffects:true};
    if(decision!==null&&typeof decision!=="boolean")return{ok:false,reason:"invalid-cost-decision"};
    if(decision===false)return{ok:true,payCost:false,applyEffects:false,reason:"cost-not-paid"};
    if(!canPayAbilityCosts(ability,resources))return{ok:true,payCost:false,applyEffects:false,reason:"unpayable-cost"};
    return{ok:true,payCost:true,applyEffects:true};
  }
  function printedNumberValue(value){const text=String(value||"").toLowerCase();if(/^\d+$/.test(text))return Number(text);return({one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10})[text]||0}
  function parseAbilityConditions(raw) {
    let remaining = String(raw || "").replace(/\bif you do\b(?!\s+not)/gi, " ").replace(/\bif you put (?:(?:that|a) )?card\b/gi," ").replace(/\bwhile (?:you are )?paying the cost for \[?Stride\]?\b/gi," ");
    const conditions = [];
    const interceptVanguardAttack=/\bwhen this unit intercepts during the battle that your vanguard was attacked\b/i;if(interceptVanguardAttack.test(remaining)){conditions.push({type:"controller-vanguard-is-attacked-unit"});remaining=remaining.replace(interceptVanguardAttack," ")}
    const backRowRearGuards=remaining.match(/\bif the number of rear-guards you have in your back row is (one|\d+) or less\b/i);if(backRowRearGuards){conditions.push({type:"controller-back-row-rear-guards-at-most",count:printedNumberValue(backRowRearGuards[1])});remaining=remaining.replace(backRowRearGuards[0]," ")}
    const backRowGradeRearGuards=remaining.match(/\bif you have (two|\d+) or more grade (one|\d+) or less back row rear-guards\b/i);if(backRowGradeRearGuards){conditions.push({type:"controller-back-row-grade-rear-guards-at-least",count:printedNumberValue(backRowGradeRearGuards[1]),maxGrade:printedNumberValue(backRowGradeRearGuards[2])});remaining=remaining.replace(backRowGradeRearGuards[0]," ")}
    const opponentRearGuards=remaining.match(/\bif your opponent has (two|\d+) or less rear-guards?\b/i);if(opponentRearGuards){conditions.push({type:"opponent-rear-guards-at-most",count:printedNumberValue(opponentRearGuards[1])});remaining=remaining.replace(opponentRearGuards[0]," ")}
    const clanRearGuards=remaining.match(/\bif you have (four|\d+) or more other [«<]([^»>]+)[»>] rear-guards?\b/i);if(clanRearGuards){conditions.push({type:"controller-other-rear-guards-of-clan-at-least",count:printedNumberValue(clanRearGuards[1]),clan:clanRearGuards[2]});remaining=remaining.replace(clanRearGuards[0]," ")}
    const soulCount=remaining.match(/\bif your soul has (five|\d+) or more cards\b/i);if(soulCount){conditions.push({type:"controller-soul-count-at-least",count:printedNumberValue(soulCount[1])});remaining=remaining.replace(soulCount[0]," ")}
    const damageCount=remaining.match(/\bif your damage zone has (three|\d+) or more cards\b/i);if(damageCount){conditions.push({type:"controller-damage-count-at-least",count:printedNumberValue(damageCount[1])});remaining=remaining.replace(damageCount[0]," ")}
    if(/\bif your damage zone has more cards than your opponent\b/i.test(remaining)){conditions.push({type:"controller-damage-count-more-than-opponent"});remaining=remaining.replace(/\bif your damage zone has more cards than your opponent\b/i," ")}
    const orderCount=remaining.match(/\bif your order zone has (two|\d+) or more cards\b/i);if(orderCount){conditions.push({type:"all-order-zones-count-at-least",count:printedNumberValue(orderCount[1])});remaining=remaining.replace(orderCount[0]," ")}
    if(/\bif there is a locked card\b/i.test(remaining)){conditions.push({type:"any-field-card-is-locked"});remaining=remaining.replace(/\bif there is a locked card\b/i," ")}
    const namedGradeVanguard=remaining.match(/\bif you have a grade (\d+) or greater vanguard with ["“]([^"”]+)["”] in its card name(?=\s|,|\.)/i);if(namedGradeVanguard){conditions.push({type:"controller-vanguard-grade-at-least",count:Number(namedGradeVanguard[1])},{type:"controller-vanguard-name-contains",value:namedGradeVanguard[2]});remaining=remaining.replace(namedGradeVanguard[0]," ")}
    const limitBreak=remaining.match(/\bLimit Break\s+(\d+)\s*\(This ability is active if you have\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+or more damage\)/i);
    if(limitBreak){const required=printedNumberValue(limitBreak[1]),threshold=printedNumberValue(limitBreak[2]);if(required>0&&required===threshold){conditions.push({type:"limit-break-active",count:required});remaining=remaining.replace(limitBreak[0]," ")}}
    else {const shorthandLimitBreak=remaining.match(/\bLimit Break\s+(\d+)\s*:/i);if(shorthandLimitBreak){const threshold=Number(shorthandLimitBreak[1]);if(threshold>0){conditions.push({type:"limit-break-active",count:threshold});remaining=remaining.replace(shorthandLimitBreak[0]," ")}}}
    if(/\bif your damage zone has no cards\b/i.test(remaining)){conditions.push({type:"damage-zone-empty"});remaining=remaining.replace(/\bif your damage zone has no cards\b/i," ")}
    remaining=remaining.replace(/\(Active if this battle is its second attack this turn or more\)/gi," ");const opponentAttacks=remaining.match(/\bif your opponent.{0,2}s attacking unit has attacked (\d+|one|two|three|four|five|six|seven|eight|nine|ten) or more times this turn\b/i);if(opponentAttacks){conditions.push({type:"opponent-attacking-unit-attacked-at-least",count:printedNumberValue(opponentAttacks[1])});remaining=remaining.replace(opponentAttacks[0]," ")}
    if(/\bplaced on RC from hand\b/i.test(remaining)){conditions.push({type:"source-placed-from-hand"});remaining=remaining.replace(/\bplaced on RC from hand\b/i," ")}
    const generationBreak=remaining.match(/\bGeneration Break\s+(\d+)\s+\(((?:This ability is )?active if you have\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+or more\s+(?:face up G units|G units face up)(?:\s+in total)?\s+(?:on your (?:V?C|V)\s+(?:and\/or|or)\s+G zone|in total on your V?C\s+or G zone))\)/i);
    if(generationBreak){const threshold=Number(generationBreak[1]),stated=printedNumberValue(generationBreak[3]);if(threshold===stated){conditions.push({type:"generation-break",count:threshold});remaining=remaining.replace(generationBreak[0]," ")}}
    const controllerVanguardGrade=remaining.match(/\bif your vanguard is grade (\d+) or less\b/i);if(controllerVanguardGrade){conditions.push({type:"controller-vanguard-grade-at-most",count:Number(controllerVanguardGrade[1])});remaining=remaining.replace(controllerVanguardGrade[0]," ")}
    const controllerVanguardGradeAtLeast=remaining.match(/\bif your vanguard is grade (\d+) or greater\b/i);if(controllerVanguardGradeAtLeast){conditions.push({type:"controller-vanguard-grade-at-least",count:Number(controllerVanguardGradeAtLeast[1])});remaining=remaining.replace(controllerVanguardGradeAtLeast[0]," ")}
    if(/\bif your vanguard is Legion\b/i.test(remaining)){conditions.push({type:"controller-vanguard-is-legion"});remaining=remaining.replace(/\bif your vanguard is Legion\b/i," ")}
    const exactControllerVanguard=remaining.match(/\bif your vanguard is ["“]([^"”]+)["”]/i);if(exactControllerVanguard){conditions.push({type:"controller-vanguard-name-contains",value:exactControllerVanguard[1],exact:true});remaining=remaining.replace(exactControllerVanguard[0]," ")}
    const opponentVanguardGrade=remaining.match(/\bif your opponent[’']s vanguard is grade (\d+) or greater\b/i);
    const attackTargetGrade=remaining.match(/\bwhen this unit attacks a grade (\d+) or greater unit\b/i);if(attackTargetGrade){conditions.push({type:"attack-target-grade-at-least",count:Number(attackTargetGrade[1])});remaining=remaining.replace(attackTargetGrade[0]," ")}
    if(opponentVanguardGrade){conditions.push({type:"opponent-vanguard-grade-at-least",count:Number(opponentVanguardGrade[1])});remaining=remaining.replace(opponentVanguardGrade[0]," ")}
    const patterns = [
      [/\bif you went second\b/i, { type: "controller-went-second" }],
      [/\bif the number of rear-guards you have is (?:more|greater) than your opponent[’']s\b/i, { type: "controller-has-more-rear-guards-than-opponent" }],
      [/\b(?:if|and) you have more rear-guards than your opponent\b/i, { type: "controller-has-more-rear-guards-than-opponent" }],
      [/\bif the number of cards in your hand is greater than your opponent[’']s\b/i, { type: "controller-has-more-cards-in-hand-than-opponent" }],
      [/\bif the number of cards in your hand is less than your opponent[’']s\b/i, { type: "controller-has-fewer-cards-in-hand-than-opponent" }],
      [/\bif the number of cards in your hand is (\d+|one|two|three|four|five|six|seven|eight|nine|ten) or (?:more|greater)\b/i, { type: "controller-hand-size-at-least" }],
      [/\bif (?:the number of cards in your hand is|your hand has) (\d+|one|two|three|four|five|six|seven|eight|nine|ten) or less cards?\b/i, { type: "controller-hand-size-at-most" }],
      [/\bif the number of rear-guards your opponent has is two or less\b/i, { type: "opponent-rear-guards-at-most", count: 2 }],
      [/\b(?:during|on) your turn\b/i, { type: "controller-turn" }],
      [/\b(?:during|on) your opponent.{0,2}s turn\b/i, { type: "opponent-turn" }],
      [/\bif you have another unit in (?:the )?(?:center|middle) column\b/i, { type: "controller-has-center-column-rear-guard" }],
      [/\bif your opponent has no rear[- ]guards?\b/i, { type: "opponent-has-no-rear-guards" }],
      [/\bif you have no rear[- ]guards?\b/i, { type: "controller-has-no-rear-guards" }],
      [/\bif this (?:unit|card) is hollowed\b/i, { type: "source-is-hollowed" }],
      [/\bif this (?:unit|card) is in harmony(?: state)?\b/i, { type: "source-is-in-harmony" }],
      [/\bif your vanguard is blazing\b/i, { type: "controller-vanguard-is-blazing" }],
      [/\bif this (?:card|unit) is face up\b/i, { type: "source-face-up" }],
      [/\bif you do not have any cards in your soul\b/i, { type: "controller-has-empty-soul" }],
      [/\bif you have a vanguard with ["“]([^"”]+)["”] in its card name\b/i, { type: "controller-vanguard-name-contains" }],
      [/\bif you have a card named ["“]([^"”]+)["”] in your soul\b/i, { type: "controller-soul-has-card-name" }],
      [/\bif you have an? [<«]([^>»]+)[>»] vanguard\b/i, null],
      [/\bif (?:this unit|this card) (?:was|is) boosted\b/i, { type: "source-was-boosted" }],
      [/\bif (?:this unit|it) attacks? a vanguard\b/i, { type: "attack-target-location", location: "vanguard" }]
    ];
    for (const [pattern, definition] of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      for (const match of [...remaining.matchAll(regex)]) {
        conditions.push(definition ? { ...definition, ...(definition.type === "controller-vanguard-name-contains" ? { value: match[1] } : {}) } : { type: "controller-vanguard-has-clan", value: match[1] });
        if(definition?.type==="controller-hand-size-at-least")conditions.at(-1).count=printedNumberValue(match[1]);
        if(definition?.type==="controller-hand-size-at-most")conditions.at(-1).count=printedNumberValue(match[1]);
        if(definition?.type==="controller-soul-has-card-name")conditions.at(-1).value=match[1];
        remaining = remaining.replace(match[0], " ");
      }
    }
    return { conditions, status: /\b(?:if|unless|while)\b/i.test(remaining) ? "needs-review" : "modeled" };
  }
  function evaluateAbilityConditions(ability, context = {}) {

    if (!ability || ability.conditionStatus === "needs-review") return false;
    if (Number(ability.gb || 0) > Number(context.generationBreakCount || 0)) return false;
    for (const condition of ability.conditions || []) {
      if (condition.type === "damage-at-least" && Number(context.damageCount || 0) < condition.count) return false;
      if (condition.type === "limit-break-active" && Number(context.damageCount || 0) < condition.count && context.vanguardLimitBreakActive !== true) return false;
      if (condition.type === "damage-zone-empty" && Number(context.damageCount || 0) !== 0) return false;
      if (condition.type === "opponent-attacking-unit-attacked-at-least" && Number(context.opponentAttackingUnitAttackCount || 0) < condition.count) return false;
      if (condition.type === "source-placed-from-hand" && context.eventPreviousLocation !== "hand") return false;
      if (condition.type === "generation-break" && Number(context.generationBreakCount || 0) < condition.count) return false;
      if (condition.type === "controller-went-second" && context.controllerWentSecond !== true) return false;
      if (condition.type === "controller-turn" && context.isControllerTurn !== true) return false;
      if (condition.type === "source-face-up" && context.sourceFaceUp !== true) return false;
      if (condition.type === "opponent-turn" && context.isOpponentTurn !== true) return false;
      if (condition.type === "opponent-vanguard-grade-at-least" && Number(context.opponentVanguardGrade ?? -1) < condition.count) return false;
      if (condition.type === "controller-vanguard-grade-lower-than-opponent" && !(Number.isFinite(Number(context.controllerVanguardGrade)) && Number.isFinite(Number(context.opponentVanguardGrade)) && Number(context.controllerVanguardGrade) < Number(context.opponentVanguardGrade))) return false;
      if (condition.type === "controller-vanguard-grade-at-most" && (Number(context.controllerVanguardGrade ?? Infinity) > condition.count || Number(context.controllerVanguardGrade ?? -1) < 0)) return false;
      if (condition.type === "controller-vanguard-grade-at-least" && Number(context.controllerVanguardGrade ?? -1) < condition.count) return false;
      if (condition.type === "controller-has-no-rear-guards" && Number(context.controllerRearGuards || 0) !== 0) return false;
      if (condition.type === "controller-other-rear-guards-of-clan-at-least") {
        const clan=String(condition.clan||"").trim().toLowerCase();
        if(!clan||!Array.isArray(context.controllerRearGuardClans))return false;
        const count=context.controllerRearGuardClans.filter(card=>card?.uid!==context.sourceInstanceId&&(Array.isArray(card?.clans)?card.clans:card?.clan?[card.clan]:[]).some(value=>String(value||"").trim().toLowerCase()===clan)).length;
        if(count<Number(condition.count||0))return false;
      }
      if (condition.type === "source-is-hollowed" && context.sourceHollowed !== true) return false;
      if (condition.type === "source-is-in-harmony" && context.sourceInHarmony !== true) return false;
      if (condition.type === "controller-vanguard-is-blazing" && context.controllerVanguardIsBlazing !== true) return false;
      if (condition.type === "controller-vanguard-is-legion" && context.controllerVanguardIsLegion !== true) return false;
      if (condition.type === "controller-field-has-clan-limit-break" && !(context.controllerFieldCards || []).some(card => card?.hasLimitBreak4 === true && [card.clan, ...(card.clans || [])].some(clan => String(clan || "").trim().toLowerCase() === String(condition.clan || "").trim().toLowerCase()) && Number(card.limitBreak || 4) >= Number(condition.count || 0))) return false;
      if (condition.type === "source-is-legion" && context.sourceInLegion !== true) return false;
      if (condition.type === "source-never-legioned" && (context.sourceEverLegioned !== false || context.sourceInLegion !== false)) return false;
      if (condition.type === "controller-drop-count-at-least" && Number(context.controllerDropCount ?? -1) < Number(condition.count || 0)) return false;
      if (condition.type === "controller-has-empty-soul" && Number(context.controllerSoulCount ?? Infinity) !== 0) return false;
      if (condition.type === "opponent-has-no-rear-guards" && Number(context.opponentRearGuards || 0) !== 0) return false;
      if (condition.type === "controller-has-center-column-rear-guard" && context.controllerCenterColumnRearGuard !== true) return false;
      if (condition.type === "controller-has-not-ridden-grade-three-plus-this-fight" && context.rodeGradeThreePlusThisFight !== false) return false;
      if (condition.type === "controller-back-row-rear-guards-at-most" && Number(context.controllerBackRowRearGuards ?? Infinity) > condition.count) return false;
      if (condition.type === "controller-back-row-grade-rear-guards-at-least" && Number(context.controllerBackRowGradeRearGuards?.[condition.maxGrade] ?? 0) < condition.count) return false;
      if (condition.type === "controller-vanguard-is-attacked-unit" && context.controllerVanguardIsAttackedUnit !== true) return false;
      if (condition.type === "controller-soul-count-at-least" && Number(context.controllerSoulCount ?? -1) < condition.count) return false;
      if (condition.type === "controller-damage-count-at-least" && Number(context.controllerDamageCount ?? -1) < condition.count) return false;
      if (condition.type === "controller-face-up-damage-at-most" && Number(context.controllerFaceUpDamageCount ?? Infinity) > condition.count) return false;
      if (condition.type === "controller-damage-count-more-than-opponent" && Number(context.controllerDamageCount ?? -1) <= Number(context.opponentDamageCount ?? Infinity)) return false;
      if (condition.type === "all-order-zones-count-at-least" && Number(context.allOrderZonesCount ?? -1) < condition.count) return false;
      if (condition.type === "controller-has-set-order" && context.controllerHasSetOrder !== true) return false;
      if (condition.type === "any-field-card-is-locked" && context.anyFieldCardIsLocked !== true) return false;
      if (condition.type === "controller-has-more-rear-guards-than-opponent" && Number(context.controllerRearGuards || 0) <= Number(context.opponentRearGuards || 0)) return false;
      if (condition.type === "controller-has-more-cards-in-hand-than-opponent" && Number(context.controllerHandCount || 0) <= Number(context.opponentHandCount || 0)) return false;
      if (condition.type === "controller-has-fewer-cards-in-hand-than-opponent" && Number(context.controllerHandCount || 0) >= Number(context.opponentHandCount || 0)) return false;
      if (condition.type === "controller-hand-size-at-least" && Number(context.controllerHandCount || 0) < Number(condition.count || 0)) return false;
      if (condition.type === "controller-hand-size-at-most" && Number(context.controllerHandCount ?? Infinity) > Number(condition.count)) return false;
      if (condition.type === "opponent-rear-guards-at-most" && Number(context.opponentRearGuards ?? Infinity) > condition.count) return false;
      if (condition.type === "attack-target-grade-at-least" && Number(context.attackTargetGrade ?? -1) < condition.count) return false;
      if (condition.type === "controller-vanguard-name-contains" && !(context.vanguardNames||[context.vanguardName]).filter(Boolean).some(name=>condition.exact?String(name).toLowerCase()===String(condition.value||"").toLowerCase():String(name).toLowerCase().includes(String(condition.value || ability.raw.match(/vanguard with ["“]([^"”]+)["”] in its card name/i)?.[1] || "").toLowerCase()))) return false;
      if (condition.type === "controller-soul-has-card-name" && !(context.controllerSoulCardNames||[]).some(name=>String(name).toLowerCase()===String(condition.value||"").toLowerCase())) return false;
      if (condition.type === "controller-vanguard-has-clan") {
        const clan = String(condition.value || "").toLowerCase();
        const names = [context.vanguardClan, ...(context.vanguardClans || []), context.vanguardText].filter(Boolean).map(value => String(value).toLowerCase());
        if (!names.some(value => value.includes(clan))) return false;
      }
      if (condition.type === "event-subject-grade-equals" && Number(context.eventSubjectGrade ?? -1) !== Number(condition.count)) return false;
      if (condition.type === "event-subject-has-clan" && !(context.eventSubjectClans || []).some(value => String(value || "").trim().toLowerCase() === String(condition.value || "").trim().toLowerCase())) return false;
      if (condition.type === "source-was-boosted" && !(context.boosterInstanceId && (context.boostedInstanceId === context.sourceInstanceId || context.eventSubjectInstanceId === context.sourceInstanceId))) return false;
      if (condition.type === "attack-target-location" && context.eventTargetLocation !== condition.location) return false;
    }
    return true;
  }
  function parseAbilityUsageRestriction(raw){const text=String(raw||"");if(thisAbilityHasSeekMateIcon(text))return{type:"once-per-game",scope:"ability-instance",reset:"game"};if(/this ability may only be used by a card with the same card name once a turn/i.test(text))return{type:"once-per-turn",scope:"card-name-and-ability",reset:"turn"};if(/\b(?:once per game|once per match|once (?:during|this) (?:the )?(?:game|match)|only once (?:during|for) (?:the )?(?:rest of )?(?:this )?(?:game|match)|cannot be used again (?:for|during) (?:the )?(?:rest of )?(?:this )?(?:game|match))\b/i.test(text))return{type:"once-per-game",scope:"ability-instance",reset:"game"};if(/\b1\s*\/\s*turn\b|\bonce per turn\b/i.test(text))return{type:"once-per-turn",scope:"ability-instance",reset:"turn"};return null}
  function thisAbilityHasSeekMateIcon(text){return /^ACT\s*\[VC\]:\s*Legion\s+\d{5}\s+["“]/i.test(String(text||""))}
  // Keep the exact-text compilers in one auditable list. First match wins, preserving legacy precedence.
  const abilityDefinitionCompilers = Object.freeze([
    compileContinuousOrderPlayedPowerDefinition,
    compileClanPlacementDamageReturnDefinition,
    compileSeekMateDefinition,
    compileBlazeDefinition,
    compileHollowKeywordDefinition,
    compileAfterimageKeywordDefinition,
    compileChargeKeywordDefinition,
    compileEngorgeDefinition,
    compileRevelationDefinition,
    compileUnboostedAttackSelfProtectionDefinition,
    compileGuardianSentinelProtectionDefinition,
    compileGuardianAttackedUnitProtectionDefinition,
    compileGuardianNamedDropCounterChargeDefinition,
    compileGuardianConditionalHandDiscardProtectionDefinition,
    compileGuardianPlacedDiscardProtectionDefinition,
    compileGuardianCallTopFiveDefinition,
    compileGuardianClanTopFiveDefinition,
    compileGuardianSecondAttackShieldDefinition,
    compileGuardianNoGradeThreeRideChoiceDefinition,
    compileRidePhaseDiscardBottomDeckDrawDefinition,
    compileRearGuardVanguardAttackSacrificeDrawPowerDefinition,
    compileNamedGradeVanguardAttackSacrificeDrawPowerDefinition,
    compileGradeNamedVanguardAttackSacrificeDrawPowerDefinition,
    compileOwnAttackHitClanRearGuardDrawDefinition,
    compileContinuousOpponentGradePowerDefinition,
    compileContinuousControllerGradePowerDefinition,
    compileContinuousOwnTurnNamedGradeVanguardPowerDefinition,
    compileContinuousNamedVanguardPowerDefinition,
    compileContinuousNamedGradeThreeVanguardPowerDefinition,
    compileContinuousBoostedNamedVanguardPowerDefinition,
    compileContinuousBoostedSourcePowerDefinition,
    compileContinuousNamedVanguardGuardianShieldDefinition,
    compileContinuousNamedGradeVanguardPowerShieldDefinition,
    compileAutoVanguardClanPlacementHandToSoulDefinition,
    compileContinuousNamedSoulPowerDefinition,
    compileContinuousOpponentGZonePowerShieldDefinition,
    compileGreatDaiyushaLimitBreakDefinition,
    compileContinuousSoulCountPowerDefinition,
    compileContinuousDragontreeMarkerPowerDefinition,
    compileContinuousPowerPerControllerRearGuardDefinition,
    compileContinuousOwnAttackPowerDefinition,
    compileContinuousNamedFaceUpDamagePowerDefinition,
    compileContinuousMissingOtherNamePowerDefinition,
    compileContinuousNonClanFieldPowerPenaltyDefinition,
    compileVanguardSoulNameThresholdCriticalDefinition,
    compileContinuousAttackedVanguardPowerDefinition,
    compileContinuousNormalOrderPowerDefinition,
    compileContinuousExactVanguardNamePowerDefinition,
    compileContinuousOwnTurnRearGuardPowerDefinition,
    compileTriggerZoneGenerationBreakGradeDefinition,
    compileContinuousVanguardOwnTurnRearGuardClanCountPowerDefinition,
    compileContinuousVanguardOwnTurnPowerPerClanRearGuardDefinition,
    compileContinuousRearGuardNamedUnitPowerDefinition,
    compileGuardianCircleOpponentGradeShieldDefinition,
    compileGuardianCircleLowerGradeShieldAutoDefinition,
    compileGuardianQualifyingCriticalShieldDefinition,
    compileContinuousGcGenerationBreakShieldDefinition,
    compileOpponentCheckTriggerPowerShieldDefinition,
    compileContinuousOpponentGradeOrDamagePowerShieldDefinition,
    compileHandStrideCostGradeBoostDefinition,
    compileHandStrideCostTreatedGradeThreeDefinition,
    compileRideDeckStrideDiscardDrawDefinition,
    compileStrideCostDiscardDrawDefinition,
    compileGZoneUnflipFreeStrideDefinition,
    compileAttackGradeThresholdPowerDefinition,
    compileAttackedSelfBattlePowerDefinition,
    compileOwnAttackOpponentRearGuardCapPowerDefinition,
    compileOwnAttackHandAdvantagePowerDefinition,
    compileRidePhaseDiscardSoulBlastDrawDefinition,
    compileOptionalGuardianRetireToSoulDefinition,
    compileGuardianDropToSoulDefinition,
    compileDamageCheckRevealDrawDefinition,
    compileContinuousLimitBreakAtThreeOrLessDefinition,
    compileGGuardianHealCostSubstituteDefinition,
    compileSentinelKeywordDefinition,
    compileCannotBeRiddenDefinition,
    compileDragontreeRestrictedCallDefinition,
    compileRideFromGradeNamedVanguardDefinition,
    compileHarmonyDefinition,
    compileForerunnerDefinition,
    compileRideUponCallSoulDefinition,
    compileRideNamedGradeCallSourceDefinition,
    compileNamedRideDeckSearchDefinition,
    compileRideSourceTopSevenTwoNameSearchDefinition,
    compileRideClanCallSourceDefinition,
    compileResistKeywordDefinition,
    compileRcCannotBeChosenDefinition,
    compileLordAttackRestrictionDefinition,
    compileAllClansNationsDefinition,
    compilePlacementGradeThreeSearchDefinition,
    compileVanguardBoostSoulBlastDrawDiscardDefinition,
    compileVanguardBoostDrawDiscardDefinition,
    compileBoostedBattleEndSourceToSoulPowerDefinition,
    compileBoostSetOrderCounterChargeDefinition,
    compileDriveTriggerUnitPowerDefinition,
    compileRidePhaseHandSearchDefinition,
    compilePlacedCounterBlastTwoRetireLowGradeDefinition,
    compilePlacedRcRevealGradeThreeSearchDefinition,
    compilePlacedVcPaidDrawDefinition,
    compileVanguardPlacementDiscardDrawDefinition,
    compileVanguardPlacedNamedSearchDefinition,
    compileRcPlacementGradeThreeClanNamedSearchDefinition,
    compileRcPlacementDeckOrDropNamedSearchDefinition,
    compileRidePhaseTopFiveNamedRideDefinition,
    compileVanguardPlacementDrawDiscardDefinition,
    compileMissedAttackHitEffectsDefinition,
    compileMissedAttackVanguardRetireDefinition,
    compileRodeUponDrawQuickShieldDefinition,
    compileMainPhaseSoulChargePowerDefinition,
    compileMainPhaseSourceSoulNamedCallDefinition,
    compileLegacyLimitBreakAttackPowerDefinition,
    compileAutoRcPlacementChooseFriendlyPowerDefinition,
    compileEmptyDamageZonePlacementDefinition,
    compileBoostedAttackHitDiscardDrawDefinition,
    compileBoostedVanguardAttackCounterBlastDrawDefinition,
    compilePlacedOnRearGuardSoulBlastDrawDefinition,
    compilePlacedOnRearGuardSoulBlastClanDrawDefinition,
    compileActNamedSoulPowerCriticalDefinition,
    compileActSelfPowerDefinition,
    compileActFilteredCounterBlastSourcePowerDefinition,
    compileActSoulBlastSelfPowerDefinition,
    compileActCounterBlastUnlockLockedDefinition,
    compileActCounterBlastSameNameSearchPowerDefinition,
    compileActCounterBlastVanguardPowerDefinition,
    compileActRestSourceFrontRowPowerDefinition,
    compileActRestSourceClanUnitPowerDefinition,
    compileActSoulCostBuffDefinition,
    compileActSourceToSoulDiscardDrawClanDefinition,
    compileActSourceToSoulOptionalFriendlyPowerDefinition,
    compileRevoldressEndTurnRideDefinition,
    compileOwnAttackHitCounterBlastDrawWithClanDefinition,
    compileAutoLegionOwnAttackHitDrawDefinition,
    compileAutoOwnAttackHitClanPowerDefinition,
    compileOpponentAbilityRetirementSoulBlastDrawDefinition,
    compileOpponentAbilityRetirementSoulBlastDrawDefinition,
    compilePlacedVanguardOrRearGuardClanSoulChargeDefinition,
    compileRcPlacementSoulChargeOneDefinition,
    compileRcPlacementSoulBlastCounterChargeTwoDefinition,
    compileVanguardOrRearGuardPlacementOptionalSoulChargeOneDefinition,
    compileAutoRcReturnToHandCounterSoulBlastDrawDefinition,
    compileRcPlacementNamedVanguardSoulChargeDefinition,
    compileRcPlacementNamedVanguardSoulChargePowerDefinition,
    compileDiscardSelfOptionalSoulDefinition,
    compileVanguardAttackSoulChargePowerDefinition,
    compileActSoulCounterChargeDefinition,
    compileActRestDiscardDrawDefinition,
    compileActSoulCostDrawDefinition,
    compileExactTemplateDefinition,
    compileVanguardAttackPowerTemplateDefinition,
    compileClanVanguardAttackPowerTemplateDefinition,
    compileRcNarukamiVanguardOwnAttackPowerDefinition,
    compileOwnAttackAgainstVanguardNamedVanguardPowerDefinition,
    compileAutoRcGradeNamedVanguardAttackPowerDefinition,
    compileRearGuardAdvantageAttackPowerDefinition,
    compileCenterColumnAttackPowerDefinition,
    compileAutoBoostedByQualifiedUnitPowerDefinition,
    compileBoostedByPowerThresholdCriticalDefinition,
    compileBoostedLimitBreakClanCounterBlastPowerDefinition,
    compileBoostedLimitBreakHitSoulDrawDefinition,
    compileOwnAttackLimitBreakClanFieldPowerDefinition,
    compileBoostedClanVanguardHitReturnHandDefinition,
    compileAttackHitClanVanguardCounterChargeDefinition,
    compileBoostSelfPowerOnBoostDefinition,
    compileBoostThenDeckReturnDefinition,
    compileLegionVanguardBoostPowerDefinition,
    compileLegionOwnVanguardAttackPowerDefinition,
    compileRearGuardOnLegionTurnPowerDefinition,
    compileRearGuardOwnAttackLegionPowerDefinition,
    compileGenerationBreakVanguardAttackPowerDefinition,
    compileGenerationBreakRearGuardAttackPowerDefinition,
    compileGenerationBreakVanguardBoostPowerDefinition,
    compileGenerationBreakBoostPowerDefinition,
    compileNamedVanguardAttackPowerTemplateDefinition,
    compileRcDeckPlacementPowerDefinition,
    compileNamedVanguardAttackPowerEndOfBattleDefinition,
    compileDrawTurnSoulBlastPowerDefinition,
    compileDrawPowerDefinition,
    compileOrderZonePlacementDrawDefinition,
    compileInterceptShieldDefinition,
    compileClanInterceptShieldDefinition,
    compileConditionedInterceptShieldDefinition,
    compileVanguardAttackedInterceptShieldDefinition,
    compileDriveCheckFrontTriggerCriticalDefinition,
    compileVanguardDriveCheckClanPowerDefinition,
    compileVanguardGradeClanDriveCheckStandDefinition,
    compileNormalUnitDriveCheckSourcePowerDefinition,
    compileNormalUnitDriveCheckSoulCostDrawDefinition,
    compileNormalUnitDriveCheckSoulCostPowerDefinition,
    compileNormalDriveCheckNamedVanguardDriveDefinition,
    compileAbilitylessNormalDriveCheckVanguardStandDefinition,
    compileAbilitylessUnitContinuousPowerDefinition,
    compileRidePhaseDiscardCallRestDefinition,
    compileDiscardGradeCallRestDefinition,
    compileGGuardianDiscardChargeChoiceDefinition,
    compileGGuardianNamedCallDiscardDrawDefinition,
    compileGGuardianNamedCallSoulBlastCounterChargeDefinition,
    compileVanguardTopFiveKeywordSearchDefinition,
    compileAutoVanguardPlacementTopSevenTwoNameSearchDefinition,
    compileActRearGuardTopFiveGradeThreeSearchDefinition,
    compileActRcSoulBlastThreeDrawDefinition,
    compileActEnergyBlastTemporaryBoostDefinition,
    compileRodeUponSecondPlayerDrawDefinition,
    compileContinuousCardNameAliasDefinition,
    compileContinuousVanguardCardNameAliasDefinition,
    compileContinuousVanguardRearGuardCardNameAliasDefinition,
    compileContinuousNamedDeckLimitDefinition,
    compileAutoVanguardGradeClanPlacementPowerDefinition,
    compileOtherRearGuardPlacementPowerDefinition,
    compileSameNameVanguardRideRestrictionDefinition,
    compileRestraintRestrictionDefinition,
    compileContinuousVanguardCannotBeBoostedDefinition,
    compileContinuousRearGuardCannotBeBoostedDefinition,
    compileContinuousInterceptKeywordDefinition,
    compileAutoOwnAttackHandConditionPowerDefinition,
    compileAutoOwnAttackEmptySoulPowerDefinition,
    compileMandatoryAttackCounterBlastPowerDefinition,
    compileAutoAttackSoulBlastPowerDefinition,
    compileAutoAttackCounterBlastPowerDefinition,
    compileClanCounterBlastAttackPowerDefinition,
    compileBoostGradeThresholdSoulBlastPowerDefinition,
    compileSoulBlastNamedBoostPowerDefinition,
    compileNamedBoostPowerTemplateDefinition
  ]);
  function compileClanPlacementDamageReturnDefinition(cardId,abilityId,kind,printedText){
    if(kind!=="AUTO")return null;
    const text=normalizePrintedText(printedText),match=text.match(/^AUTO:\s*\[Counter Blast 1\]\s*When this unit is placed on VC or RC, if you have an? [«<]([^»>]+)[»>] vanguard, you may pay the cost\. If you do, put the top card of your deck into your damage zone,?\s*(?:and )?(?:at the beginning of (?:the end phase of that turn|your end phase)|at the end of that turn), choose a card from your damage zone, return it to your deck, and shuffle your deck\.$/i);
    if(!match)return null;
    const clan=match[1].trim();
    return{id:abilityId,cardId,kind,printedText,requiredLocation:["vanguard","rear-guard"],trigger:{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["vanguard","rear-guard"]},conditions:[{type:"controller-vanguard-has-clan",value:clan}],costs:[{type:"counter-blast",count:1}],optional:true,conditionsReviewed:true,choicesReviewed:true,source:{dataset:"Cardfight Area snapshot",snapshotDate:"2025-05-09",patternId:"auto-vc-rc-clan-placement-delayed-damage-return-v1",review:"Exact clan-gated VC/RC source-placement template. The exact source instance must be placed on VC or RC while its controller has a Vanguard of the printed clan. It offers Counter Blast 1; after payment it puts the deck top into Damage (without a damage check), then at that turn's End Phase start the controller chooses any Damage card, returns it to Deck, and shuffles. The delayed schedule is created only if the AUTO cost is accepted."},effects:[{op:"deck-to-damage",target:"controller",count:1},{op:"schedule-damage-return-at-turn-end",target:"controller",due:"end-phase-start"}]};
  }
  function compileAbilityDefinition(cardId, abilityId, kind, printedText, cardContext) {
    const treasureHitIds = new Set(["cfa-7622", "cfa-7623", "cfa-7624", "cfa-7625", "cfa-7626", "cfa-7627"]);
    const treasureHitText = "AUTO [VC/RC]: When its attack hits, choose one of your VC or RC without any Treasures markers, and put a Treasures marker.";
    const normalizedTreasureText = normalizePrintedText(printedText).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    if (treasureHitIds.has(String(cardId)) && kind === "AUTO" && normalizedTreasureText === treasureHitText && abilityId === `${cardId}:0`) {
      return { id: abilityId, cardId, kind, printedText, requiredLocation: ["vanguard", "rear-guard"],
        trigger: { status: "recognized-trigger", eventType: "attack.hit", subject: "source", circles: [] },
        conditionsReviewed: true, costsReviewed: true, choicesReviewed: true,
        source: { dataset: "Bushiroad official card list", patternId: "auto-own-attack-hit-place-treasures-marker-v1", review: "Exact six-card AUTO family. Requires this exact source's attack to hit; the controller privately chooses one of their VC/RC circles without a Treasures marker." },
        effects: [{ op: "place-circle-marker", target: "chosen-controller-circle", markerType: "Treasures", circleTypes: ["vanguard", "rear-guard"] }] };
    }
    for (const compiler of abilityDefinitionCompilers) {
      const definition = compiler(cardId, abilityId, kind, printedText, cardContext);
      if (definition) return definition;
    }
    return null;
  }
  function parseCardAbilities(card) {
    const text=String(card?.text||"");
    const starts=[...text.matchAll(/(?:^|\n)\s*(?:\[(AUTO|ACT|CONT)\]|(AUTO|ACT|CONT))\s*:?/gi)].map(match=>{const labelOffset=match[0].search(/(?:\[(?:AUTO|ACT|CONT)\]|AUTO|ACT|CONT)/i);return{index:match.index,rawStart:match.index+match[0].length,printedStart:match.index+Math.max(labelOffset,0),kind:String(match[1]||match[2]).toUpperCase(),inferred:false}});
    const legacyLimitBreak=/(?:^|\n)\s*((?:\[(?:VC|RC|VC\/RC)\]\s*)?Limit Break\s+\d+\s*\(This ability is active if you have\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+or more damage\)\s*:\s*)/gi;
    for(const match of text.matchAll(legacyLimitBreak)){
      const prefix=match[1],offset=match[0].lastIndexOf(prefix),index=match.index+offset;
      if(starts.some(item=>index>=item.index&&index<item.rawStart))continue;
      starts.push({index,rawStart:index,printedStart:index,kind:"AUTO",inferred:true});
    }
    starts.sort((a,b)=>a.index-b.index);
    const parsed = starts.map((item,index)=>{
      const end=starts[index+1]?.index??text.length,raw=text.slice(item.rawStart,end).trim(),printedText=text.slice(item.printedStart,end).trim(),kind=item.kind,abilityId=String(card.id||"")+":"+index;
      const trigger=kind==="AUTO"?compileAutoTrigger(raw):null,costInfo=parseAbilityCosts(raw),conditionInfo=parseAbilityConditions(raw),definition=getAbilityDefinition(String(card.id||"")+":"+index,printedText)||compileAbilityDefinition(String(card.id||""),abilityId,kind,printedText,card),usageRestriction=parseAbilityUsageRestriction(raw)||definition?.usageRestriction||null,hasUnparsedConditions=conditionInfo.status==="needs-review"&&!definition?.conditionsReviewed&&!definition?.conditions?.length&&! ["cont-rc-normal-order-power-v1","cont-rc-order-played-power-v1","cont-rc-opponent-vanguard-grade-power-v1","cont-rc-controller-vanguard-grade-power-v1","cont-rc-own-turn-named-grade-vanguard-power-v1","cont-named-soul-card-power-v1","cont-rc-gc-opponent-check-trigger-power-shield-v1","cont-rc-vanguard-grade-or-damage-power-shield-v1","cont-great-daiyusha-limit-break-critical-v1","cont-vanguard-soul-name-threshold-critical-v1","auto-ride-deck-or-stride-cost-discard-draw-v1"].includes(definition?.source?.patternId),hasUnparsedChoices=definition?.choicesReviewed!==true&&(/\b(?:choose|select|target)\b/i.test(raw)||(/\bmay\b/i.test(raw)&&!/\bmay pay the cost\b/i.test(raw))||Boolean(definition?.effects?.some(step=>step.op==="draw-then-discard"||step.op==="discard-from-hand"))||definition?.source?.patternId==="auto-placement-top-five-grade-three-search-discard-v1")&&definition?.source?.patternId!=="act-source-to-soul-choose-friendly-power-turn-v1"&&definition?.source?.patternId!=="auto-rc-placement-choose-friendly-clan-power-turn-v1"&&definition?.source?.patternId!=="auto-hollow-placement-retire-turn-end-v1"&&definition?.source?.patternId!=="auto-afterimage-opponent-bound-card-to-hand-return-source-v1"&&definition?.source?.patternId!=="auto-charge-effect-placement-bottom-deck-after-battle-v1"&&definition?.source?.patternId!=="auto-gc-retire-optional-source-to-soul-v1"&&definition?.source?.patternId!=="auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1"&&![ "auto-forerunner-same-clan-ride-call-source-v1","auto-gc-discard-protect-attacked-unit-v1","auto-gc-protect-then-conditional-discard-v1","auto-gc-sentinel-protect-friendly-unit-v1","auto-vanguard-placement-draw-discard-v1","auto-placement-top-five-grade-three-search-discard-v1","auto-boosted-battle-close-source-to-soul-power-v1","auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1","auto-boosting-unit-attack-hit-discard-draw-v1","auto-rode-upon-optional-source-call-v1","auto-drive-check-front-trigger-critical-turn-v1","auto-revelation-keyword-v1","auto-ride-phase-discard-source-call-rested-v1","auto-rc-vanguard-boost-soul-blast-draw-discard-v1","auto-rc-vanguard-boost-draw-discard-v1","act-rest-discard-draw-v1","act-vanguard-counter-blast-unlock-friendly-locked-v1","act-rest-source-front-row-ally-power-v1" ].includes(definition?.source?.patternId),hasUnparsedCosts=costInfo.status==="needs-review"&&!definition?.keywords?.includes("g-guardian-heal-cost-substitute")&&definition?.source?.patternId!=="auto-rc-vanguard-boost-draw-discard-v1"&&definition?.source?.patternId!=="auto-placement-top-five-grade-three-search-discard-v1"&&definition?.source?.patternId!=="auto-g-guardian-discard-bind-heal-charge-choice-v1"&&definition?.source?.patternId!=="auto-g-guardian-named-call-discard-grade-one-draw-v1";
      return {id:abilityId,cardId:String(card.id||""),kind,raw,printedText,definition,effects:definition?.effects||null,gb:Number(raw.match(/(?:Generation\s*Break|GB)\s*[-( ]?\s*(\d+)/i)?.[1]||0),once:Boolean(usageRestriction||definition?.once),usageRestriction,requiredLocation:definition?.requiredLocation||parseAbilityLocation(raw),requiredCircle:definition?.requiredCircle||[],costAlternatives:definition?.costAlternatives||costInfo.costAlternatives,trigger:definition?.trigger?{...trigger,...definition.trigger,circles:definition.trigger.circles||trigger?.circles||[]}:definition?.source?.patternId==="auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1"?{...trigger,turnRelation:"controller"}:trigger,costs:["auto-g-guardian-discard-bind-heal-charge-choice-v1","auto-g-guardian-named-call-discard-grade-one-draw-v1"].includes(definition?.source?.patternId)?definition.costs:["auto-gc-protect-then-conditional-discard-v1","auto-vanguard-placement-draw-discard-v1","auto-placement-top-five-grade-three-search-discard-v1"].includes(definition?.source?.patternId)?[]:costInfo.costs,conditions:["cont-rc-opponent-vanguard-grade-power-v1","cont-rc-controller-vanguard-grade-power-v1","auto-rode-upon-draw-quick-shield-v1","auto-gc-protect-then-conditional-discard-v1","cont-vanguard-missed-attack-hit-effects-v1","cont-vanguard-limit-break-4-active-at-three-or-less-v1","auto-placement-top-five-grade-three-search-discard-v1","auto-hollow-placement-retire-turn-end-v1","auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1","cont-rc-gc-opponent-check-trigger-power-shield-v1"].includes(definition?.source?.patternId)?[]:definition?.source?.patternId==="auto-afterimage-opponent-bound-card-to-hand-return-source-v1"?(definition.conditions||[]):(definition?.conditions||conditionInfo.conditions),conditionStatus:definition?.conditions?.length?"modeled":["cont-rc-order-played-power-v1","cont-rc-opponent-vanguard-grade-power-v1","cont-rc-controller-vanguard-grade-power-v1","auto-g-guardian-discard-bind-heal-charge-choice-v1","auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1","cont-no-other-field-card-name-power-v1","cont-rc-controlled-rearguard-named-unit-power-v1","cont-gc-named-grade-vanguard-shield-v1","cont-vc-rc-non-clan-field-power-penalty-v1","cont-rc-gc-named-grade-vanguard-power-shield-v1"].includes(definition?.source?.patternId)?"modeled":["auto-rode-upon-draw-quick-shield-v1","auto-gc-protect-then-conditional-discard-v1","cont-vanguard-missed-attack-hit-effects-v1","cont-vanguard-limit-break-4-active-at-three-or-less-v1","auto-placement-top-five-grade-three-search-discard-v1","auto-hollow-placement-retire-turn-end-v1","cont-rc-gc-opponent-check-trigger-power-shield-v1","cont-rc-gc-vanguard-grade-or-damage-power-shield-v1","auto-ride-deck-or-stride-cost-discard-draw-v1"].includes(definition?.source?.patternId)?"no-explicit-condition-detected":definition?.source?.patternId==="auto-afterimage-opponent-bound-card-to-hand-return-source-v1"?"modeled":hasUnparsedConditions?(definition?.continuousRestrictions?.length?"modeled":"needs-review"):conditionInfo.conditions.length?"modeled":"no-explicit-condition-detected",choiceStatus:definition?.choicesReviewed===true||["auto-engorge-retire-other-rearguards-v1","auto-g-guardian-discard-bind-heal-charge-choice-v1","auto-hollow-placement-retire-turn-end-v1","auto-rc-from-hand-reveal-grade-three-search-name-discard-v1","auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1","act-counter-blast-same-name-search-power-v1","auto-rc-placement-choose-friendly-clan-power-turn-v1","auto-vanguard-placement-counter-soul-named-search-v1","auto-rc-drive-check-normal-unit-source-soul-draw-v1","auto-rc-drive-check-normal-unit-source-soul-rearguard-power-v1","auto-vanguard-placement-top-five-filtered-search-hand-v1","auto-gc-no-grade-three-ride-choice-v1","act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1","auto-afterimage-opponent-bound-card-to-hand-return-source-v1","auto-charge-effect-placement-bottom-deck-after-battle-v1","auto-gc-retire-optional-source-to-soul-v1","auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1","auto-forerunner-same-clan-ride-call-source-v1","auto-gc-discard-protect-attacked-unit-v1","auto-gc-protect-then-conditional-discard-v1","auto-gc-sentinel-protect-friendly-unit-v1","auto-vanguard-placement-draw-discard-v1","auto-placement-top-five-grade-three-search-discard-v1","auto-boosted-battle-close-source-to-soul-power-v1","auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1","auto-boosting-unit-attack-hit-discard-draw-v1","auto-rode-upon-optional-source-call-v1","auto-drive-check-front-trigger-critical-turn-v1","auto-revelation-keyword-v1","auto-ride-phase-discard-source-call-rested-v1","auto-rc-vanguard-boost-soul-blast-draw-discard-v1","auto-rc-vanguard-boost-draw-discard-v1","act-rest-discard-draw-v1","act-vanguard-counter-blast-unlock-friendly-locked-v1","act-rest-source-front-row-ally-power-v1"].includes(definition?.source?.patternId)?"modeled":hasUnparsedChoices?"needs-review":"no-explicit-choice-detected",costStatus:["auto-g-guardian-discard-bind-heal-charge-choice-v1","auto-g-guardian-named-call-discard-grade-one-draw-v1"].includes(definition?.source?.patternId)?"supported-cost":["auto-gc-protect-then-conditional-discard-v1","auto-vanguard-placement-draw-discard-v1","auto-placement-top-five-grade-three-search-discard-v1","cont-hand-g-guardian-heal-cost-substitute-v1","auto-rc-vanguard-boost-draw-discard-v1","auto-placement-top-five-grade-three-search-discard-v1","cont-gzone-unflip-free-stride-v1","auto-ride-deck-or-stride-cost-discard-draw-v1"].includes(definition?.source?.patternId)?"no-cost":hasUnparsedCosts?"needs-review":costInfo.status,canDecline:kind!=="AUTO"||definition?.optional===true||definition?.keywords?.includes("afterimage")||definition?.source?.patternId!=="auto-revelation-keyword-v1"&&/\bmay\b|\boptional\b/i.test(raw.replace(/\bmay only be used\b/gi,"")),implementationStatus:definition?"structured-effect-definition":kind==="AUTO"?(trigger.status==="needs-review"||hasUnparsedConditions||hasUnparsedCosts?"needs-review":"trigger-definition-pending-validation"):kind==="ACT"?"manual-definition-pending-validation":"continuous-definition-pending-validation"};
    });
    return parsed.map(ability => Array.isArray(ability.definition?.costAlternatives) && ability.definition.costAlternatives.length > 1
      ? { ...ability, costs: [], costAlternatives: ability.definition.costAlternatives, costStatus: "supported-cost", implementationStatus: "structured-effect-definition" }
      : ability.definition?.costsReviewed === true && Array.isArray(ability.definition.costs) && ability.definition.costs.length > 0
      ? { ...ability, costs: ability.definition.costs || [], costStatus: "supported-cost", implementationStatus: "structured-effect-definition" }
      : ability);
  }  function countGenerationBreakUnits(player, isGUnit = () => false) { return (player?.gZone || []).filter(card => card?.faceUp === true && isGUnit(card)).length + (player?.vanguard && isGUnit(player.vanguard) ? 1 : 0); }
  function freezeParsedValue(value){if(!value||typeof value!=="object")return value;for(const child of Object.values(value))freezeParsedValue(child);return Object.isFrozen(value)?value:Object.freeze(value)}
  function parseCardAbilitiesCached(card){if(!card||typeof card!=="object")return parseCardAbilities(card);const id=String(card.id||""),text=String(card.text||""),cached=parsedCardAbilityCache.get(card);if(cached&&cached.id===id&&cached.text===text&&cached.revision===abilityDefinitionRevision)return cached.abilities;const abilities=freezeParsedValue(JSON.parse(JSON.stringify(parseCardAbilities(card))));parsedCardAbilityCache.set(card,{id,text,revision:abilityDefinitionRevision,abilities});return abilities}
  function prunePendingAbilitiesWithConsumedUsage(state,isUsed){if(!state||typeof isUsed!=="function")return 0;const queue=state.pendingAbilities||[],remaining=[];let removed=0;for(const pending of queue){if((pending?.ability?.once||pending?.ability?.usageRestriction)&&isUsed(pending)){removed++;continue}remaining.push(pending)}state.pendingAbilities=remaining;return removed}
  function abilityUsageKey(turnId,playerId,cardInstanceId,abilityId,restriction=null,cardName=null,abilityText=null){if(turnId==null||!playerId||!cardInstanceId||!abilityId)throw new TypeError("Ability usage records require turn, player, card, and ability identities.");if(restriction?.scope==="card-name-and-ability"){const name=String(cardName||"").trim().toLocaleLowerCase(),text=String(abilityText||"").replace(/\s+/g," ").trim().toLocaleLowerCase();if(!name||!text)throw new TypeError("Shared-name usage records require the card name and ability text.");return restriction.reset==="game"?`${playerId}:shared-name:${name}:${text}:game`:`${turnId}:${playerId}:shared-name:${name}:${text}`}if(restriction?.reset==="game")return `${playerId}:${cardInstanceId}:${abilityId}:game`;return `${turnId}:${playerId}:${cardInstanceId}:${abilityId}`;}
  function canDeclineAbility(ability) { return Boolean(ability) && (ability.kind === "AUTO" ? ability.canDecline === true : ability.kind === "ACT"); }
  function isManuallyActivatable(ability) { return ability?.kind === "ACT"; }
  function autoAbilityReadiness(ability) {
    if (ability?.kind !== "AUTO") return { ok: false, reason: "not-automatic" };
    if (ability.trigger?.status !== "recognized-trigger") return { ok: false, reason: "unrecognized-trigger" };
    if (!ability.definition || ability.definition.kind !== "AUTO" || !Array.isArray(ability.definition.effects) || !ability.definition.effects.length) return { ok: false, reason: "unsupported-effect" };
    if (ability.conditionStatus === "needs-review") return { ok: false, reason: "unmodeled-condition" };
    if (ability.costStatus === "needs-review") return { ok: false, reason: "unmodeled-cost" };
    if (ability.choiceStatus === "needs-review") return { ok: false, reason: "unmodeled-choice" };
    return { ok: true };
  }
  function canActivateManualAbility(ability, context = {}) {
    if (!isManuallyActivatable(ability)) return { ok: false, reason: "not-manual" };
    if (!ability.definition || ability.definition.kind !== "ACT" || !Array.isArray(ability.definition.effects) || !ability.definition.effects.length) return { ok: false, reason: "unsupported-effect" };
    if (ability.conditionStatus === "needs-review") return { ok: false, reason: "unmodeled-condition" };
    if (ability.costStatus === "needs-review") return { ok: false, reason: "unmodeled-cost" };
    if (ability.choiceStatus === "needs-review") return { ok: false, reason: "unmodeled-choice" };
    if ((ability.conditions || []).length && !context.conditions) return { ok: false, reason: "conditions-not-verified" };
    if (!context.cardInstanceId || !context.controllerPlayerId || context.actorPlayerId !== context.controllerPlayerId) return { ok: false, reason: "not-controller" };
    if (context.turnPlayerId !== context.actorPlayerId) return { ok: false, reason: "not-turn-player" };
    if (context.resolutionBlocked) return { ok: false, reason: "resolution-in-progress" };
    const activationWindow = ability.definition.activationWindow || "main";
    if (context.phase !== activationWindow) return { ok: false, reason: "wrong-timing-window" };
    if (context.inPermittedZone !== true) return { ok: false, reason: "wrong-zone" };
    if ((ability.once || ability.usageRestriction) && context.alreadyUsed) return { ok: false, reason: "usage-restriction" };
    if (!canPayAbilityCosts(ability, context.resources || {})) return { ok: false, reason: "unpayable-cost" };
    if (!evaluateAbilityConditions(ability, context.conditions || {})) return { ok: false, reason: "condition-not-met" };
    return { ok: true };
  }
  function hasLegalAbilityTargets(ability, targetCount) {
    if (typeof targetCount !== "function") return false;
    const targetEffects=(ability?.definition?.effects||[]).filter(step=>step?.target==="chosen"&&["modify-power-target","retire-target","stand-target","rest-target","unlock-target","protect-target"].includes(step.op));
    return targetEffects.every(step=>step.noOpIfNoLegalTargets===true||step.optionalTarget===true||Number(targetCount(step))>0);
  }
  function validateAbilityChoices(abilityText, selection = {}, context = {}) {
    const text = String(abilityText || "");
    const poolIds = context.choicePoolCardIds || [];
    if (context.choiceRequired && !selection.effectUid) return { ok: false, reason: "missing-card-choice" };
    if (selection.effectUid && !poolIds.includes(selection.effectUid)) return { ok: false, reason: "invalid-card-choice" };
    if (context.callEffect) {
      if (!selection.callZone || !(context.allowedCallZones || []).includes(selection.callZone)) return { ok: false, reason: "invalid-call-zone" };
      if (/\bforerunner\b/i.test(text) && context.callZoneOccupied) return { ok: false, reason: "occupied-forerunner-circle" };
      if (context.selectedCallCardLegal === false) return { ok: false, reason: "illegal-call-card" };
    }
    if (context.targetRequired && !selection.targetUid && !context.optionalNoTarget) return { ok: false, reason: "missing-target" };
    if (selection.targetUid && context.targetRequired) {
      const target = context.target;
      if (!target || target.side !== context.expectedTargetSide) return { ok: false, reason: "invalid-target-owner" };
      if (/\brear-guards?\b/i.test(text) && target.zone === "vanguard") return { ok: false, reason: "invalid-target-zone" };
      if (/\bvanguard\b/i.test(text) && target.zone !== "vanguard") return { ok: false, reason: "invalid-target-zone" };
      if (/\bsame column\b/i.test(text) && context.sameColumnMatches === false) return { ok: false, reason: "invalid-target-column" };
    }
    return { ok: true };
  }
  function eventMatchesAbilityTrigger(ability,eventName,event,sourceUid,sourceZone,subjectZone,sourceControllerPlayerId=null) {
    const trigger=ability?.trigger;
    if (Array.isArray(trigger?.anyOf)) return trigger.anyOf.some(branch => eventMatchesAbilityTrigger({ ...ability, trigger: { ...trigger, ...branch, anyOf: undefined } }, eventName, event, sourceUid, sourceZone, subjectZone, sourceControllerPlayerId));
    const expectedEventType=({ride:"card.ridden",place:"card.placed",attack:"unit.attacked",attackStep:"attack.step-started",attacked:"attack.declared",draw:"card.drawn",boost:"unit.boosted",hit:"attack.hit",drop:"card.moved",retire:"card.retired",rest:"unit.rested",stand:"unit.stood",bind:"card.bound",discard:"card.discarded",move:"card.moved",soulMove:"card.moved",damagePlace:"card.damage_moved",damageLeave:"card.moved",battleEnd:"battle.close-step",driveCheck:"drive.checked",damageCheck:"damage.checked",triggerCheck:"trigger.checked",characteristic:"characteristic.changed",success:"unit.became_successful",harmony:"unit.became_harmony",engorge:"unit.became_engorged",legion:"unit.legioned",phase:"phase.changed",start:"turn.started",end:"turn.ended"})[eventName];
    if(ability?.kind!=="AUTO"||trigger?.status!=="recognized-trigger"||trigger.eventType!==expectedEventType||event?.type!==expectedEventType)return false;
    if(["drive.checked","damage.checked","trigger.checked"].includes(expectedEventType)&&(!event.checkedCardInstanceId||event.subjectCardInstanceId!==event.checkedCardInstanceId))return false;
    if(ability.conditionStatus==="needs-review"||ability.costStatus==="needs-review")return false;
    const normalizeLocation=value=>value==="vanguard"?"vanguard":value==="soul"?"soul":value==="drop"?"drop":value==="damage"?"damage":value==="bind"?"bind":value==="hand"?"hand":value==="deck"?"deck":value==="guardian"?"guardian":/^(?:order|orders|order-zone)$/i.test(String(value||""))?"order":/^(?:rear-|accel-|rear\d)/.test(String(value||""))?"rear-guard":null;
    if(ability.requiredLocation.length&&!ability.requiredLocation.includes(normalizeLocation(sourceZone)))return false;
    if(trigger.circles.length&&!trigger.circles.includes(normalizeLocation(subjectZone)))return false;
    if(trigger.requiresUnboostedAttacker&&event?.boosterCardInstanceId)return false;
    if(trigger.targetLocation&&normalizeLocation(event?.targetLocation)!==trigger.targetLocation)return false;
    if(trigger.checkKind&&event?.checkKind!==trigger.checkKind)return false;
    if(trigger.checkSourceLocation&&event?.checkSourceLocation!==trigger.checkSourceLocation)return false;
    if(Object.hasOwn(trigger,"checkedCardTriggerType")&&event?.checkedCardTriggerType!==trigger.checkedCardTriggerType)return false;
    if(trigger.checkedCardHasTriggerUnit===true&&!String(event?.checkedCardTriggerType||"").trim())return false;
    if(trigger.requiresBattleSourceMatch&&(!event?.battleId||event?.sourceCardInstanceId!==sourceUid))return false;
    if(trigger.checkedCardHasNoAbilities&&(!String(event?.checkedCardText||"").trim()||parseCardAbilities({id:"checked-event-card",text:event.checkedCardText}).length>0))return false;
    if(trigger.revealedTrigger&&String(event?.revealedTrigger||"").toLowerCase()!==trigger.revealedTrigger)return false;
    if(trigger.revealedGrade!=null&&Number(event?.checkedCardGrade??-1)!==Number(trigger.revealedGrade))return false;
    if(trigger.revealedClan){const clans=[event?.checkedCardClan,...(event?.checkedCardClans||[])].filter(Boolean).map(value=>String(value).toLowerCase()),fallback=String(event?.checkedCardText||"").split(/\r?\n/)[0].split("/")[0].trim().toLowerCase();if(!clans.includes(String(trigger.revealedClan).toLowerCase())&&fallback!==String(trigger.revealedClan).toLowerCase())return false}
    if(trigger.boosterClan){const declared=[event?.boosterCardClan,...(event?.boosterCardClans||[])].filter(Boolean).map(value=>String(value).toLowerCase()),fallback=String(event?.boosterCardText||"").split(/\r?\n/)[0].split("/")[0].trim().toLowerCase();if(!declared.includes(String(trigger.boosterClan).toLowerCase())&&fallback!==String(trigger.boosterClan).toLowerCase())return false}
    if(trigger.riderClan){const clans=[event?.sourceCardClan,...(event?.sourceCardClans||[])].filter(Boolean).map(value=>String(value).trim().toLowerCase());if(!clans.includes(String(trigger.riderClan).trim().toLowerCase()))return false}
    if(trigger.riderGrade!=null&&Number(event?.sourceCardGrade)!==Number(trigger.riderGrade))return false;
    if(trigger.riderCardNameContains&&!String(event?.sourceCardName||"").toLocaleLowerCase().includes(String(trigger.riderCardNameContains).toLocaleLowerCase()))return false;
    if(trigger.riderCardNameEquals&&String(event?.sourceCardName||"")!==String(trigger.riderCardNameEquals))return false;
    if(trigger.excludedRiderName){const normalizeName=value=>String(value||"").normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9]/g,"");if(!event?.sourceCardName||normalizeName(event.sourceCardName)===normalizeName(trigger.excludedRiderName))return false}
    if(trigger.boosterRace){const declared=[event?.boosterCardRace,...(event?.boosterCardRaces||[])].filter(Boolean).map(value=>String(value).toLowerCase()),fallback=String(event?.boosterCardText||"").split(/\r?\n/)[0].split("/").slice(1).map(value=>value.trim().toLowerCase());if(!declared.includes(String(trigger.boosterRace).toLowerCase())&&!fallback.includes(String(trigger.boosterRace).toLowerCase()))return false}
    if(trigger.boosterCardNameContains&&!String(event?.boosterCardName||"").toLowerCase().includes(String(trigger.boosterCardNameContains).toLowerCase()))return false;
    if(trigger.boosterPowerAtLeast&&Number(event?.boosterPower??-1)<trigger.boosterPowerAtLeast)return false;
    if(trigger.boostedUnitName&&String(event?.boostedCardName||"").toLowerCase()!==trigger.boostedUnitName.toLowerCase())return false;
    if(trigger.boostedUnitClan||trigger.boostedUnitLimitBreak){const boostMatchesEvent=expectedEventType==="unit.boosted"&&event?.boostedCardInstanceId&&(event.targetCardInstanceIds||[]).includes(event.boostedCardInstanceId)&&normalizeLocation(event.targetLocation)==="vanguard",hitMatchesEvent=expectedEventType==="attack.hit"&&event?.boostedCardInstanceId&&event.boostedCardInstanceId===event.attackingUnitInstanceId&&event.boosterCardInstanceId&&normalizeLocation(event.targetLocation)==="vanguard"&&(!trigger.requiresBoostedBattle||Boolean(event.battleId));if(!boostMatchesEvent&&!hitMatchesEvent)return false}
    if(trigger.boostedUnitClan){const clans=[event?.boostedCardClan,...(event?.boostedCardClans||[])].filter(Boolean).map(value=>String(value).trim().toLowerCase());if(!clans.includes(String(trigger.boostedUnitClan).trim().toLowerCase()))return false}
    if(trigger.boostedUnitLimitBreak&&(!Array.isArray(event?.boostedCardLimitBreaks)||!event.boostedCardLimitBreaks.includes(Number(trigger.boostedUnitLimitBreak))))return false;
    if(trigger.boostedUnitNameContains&&!String(event?.boostedCardName||"").toLowerCase().includes(trigger.boostedUnitNameContains.toLowerCase()))return false;
    if(trigger.boostedUnitGradeAtLeast&&Number(event?.boostedCardGrade??-1)<trigger.boostedUnitGradeAtLeast)return false;
    if(trigger.sourceLocation&&normalizeLocation(event?.previousLocation)!==trigger.sourceLocation)return false;
    if(trigger.requiredPhase&&String(event?.phase||"").toLowerCase()!==trigger.requiredPhase)return false;
    if(trigger.discardReason&&event?.discardReason!==trigger.discardReason)return false;
    if(Array.isArray(trigger.discardReasons)&&!trigger.discardReasons.includes(event?.discardReason))return false;
    if(trigger.actingPlayerRelation==="source-controller"&&(!sourceControllerPlayerId||event?.actingPlayerId!==sourceControllerPlayerId||event?.sourceControllerPlayerId!==sourceControllerPlayerId))return false;
    if(trigger.calledGUnitName&&String(event?.calledGUnitCardName||"").trim().toLocaleLowerCase()!==String(trigger.calledGUnitName).trim().toLocaleLowerCase())return false;
    if(trigger.calledGUnitPreviousLocation&&String(event?.calledGUnitPreviousLocation||"").toLowerCase()!==String(trigger.calledGUnitPreviousLocation).toLowerCase())return false;
    if(trigger.destinationLocation&&normalizeLocation(event?.currentLocation)!==trigger.destinationLocation)return false;
    if(trigger.abilitySourceControllerRelation==="opponent"&&(!sourceControllerPlayerId||!event?.abilitySourceInstanceId||!event?.abilitySourceControllerPlayerId||event.abilitySourceControllerPlayerId===sourceControllerPlayerId))return false;
    if(trigger.movedCardOwnerRelation==="opponent"&&(!sourceControllerPlayerId||event?.subjectOwnerPlayerId===sourceControllerPlayerId||!event?.subjectOwnerPlayerId))return false;
    if(trigger.effectPlacementOnly&&!String(event?.timingWindow||"").startsWith("effect-"))return false;
    if(trigger.sameSourceCircle&&(!sourceZone||!subjectZone||String(sourceZone)!==String(subjectZone)))return false;
    if(expectedEventType==="card.placed"){
      const enteredCircle=normalizeLocation(event?.currentLocation);
      if(!enteredCircle||trigger.subject==="source"&&trigger.circles.length&&!trigger.circles.includes(enteredCircle))return false;
      if(subjectZone&&normalizeLocation(subjectZone)!==enteredCircle)return false;
    }
    if(trigger.turnRelation==="controller"&&event?.turnPlayerId!==sourceControllerPlayerId)return false;
    if(trigger.firstAttackOnly&&Number(event?.playerAttackCount)!==1)return false;
    if(trigger.turnRelation==="opponent"&&(!sourceControllerPlayerId||event?.turnPlayerId===sourceControllerPlayerId))return false;
    if(trigger.excludeSourceAsSubject&&event?.subjectCardInstanceId===sourceUid)return false;
    if(trigger.subject==="source"&&!eventSubjectMatches(event,sourceUid,"source"))return false;
    if(trigger.subject==="source"&&expectedEventType==="unit.attacked"&&event?.subjectCardInstanceId!=null&&event.subjectCardInstanceId!==sourceUid&&!(event.attackingCardInstanceIds||[]).includes(sourceUid))return false;
    if(trigger.subject==="source"&&expectedEventType==="attack.hit"&&event?.attackHitOverride===true&&event?.subjectCardInstanceId!=null&&event.subjectCardInstanceId!==sourceUid)return false;
    if(trigger.eventType==="card.placed"&&trigger.subject==="source"&&event?.subjectCardInstanceId!=null&&event.subjectCardInstanceId!==sourceUid)return false;
    if(trigger.subject==="event-subject"&&!eventSubjectMatches(event,sourceUid,"event-subject"))return false;
    if(trigger.subjectControllerRelation==="source-controller"&&(!sourceControllerPlayerId||event?.subjectControllerPlayerId!==sourceControllerPlayerId))return false;
    if(trigger.subject==="event-target"&&!(event?.targetCardInstanceIds||[]).includes(sourceUid))return false;
    if(trigger.subject==="ridden-unit"&&!eventSubjectMatches(event,sourceUid,"ridden-unit"))return false;
    if(trigger.subject==="booster"&&!eventSubjectMatches(event,sourceUid,"booster"))return false;
    if(trigger.subject==="boosted-unit"&&!eventSubjectMatches(event,sourceUid,"boosted-unit"))return false;
    if(trigger.subject==="controller"&&(!sourceControllerPlayerId||(expectedEventType==="card.drawn"?event?.subjectControllerPlayerId!==sourceControllerPlayerId:event?.actingPlayerId!==sourceControllerPlayerId)))return false;
    if(trigger.subject==="vanguard"&&(normalizeLocation(subjectZone)!=="vanguard"||!sourceControllerPlayerId||event?.subjectControllerPlayerId!==sourceControllerPlayerId))return false;
    return true;
  }


  const GAME_EVENT_TYPES = Object.freeze([
    "card.placed", "card.ridden", "unit.attacked", "attack.step-started", "attack.declared", "unit.boosted", "attack.hit", "attack.defended", "unit.became_harmony", "unit.became_engorged", "unit.legioned",
    "card.retired", "card.moved", "card.bound", "card.discarded", "card.drawn", "card.created", "card.damage_moved", "unit.rested", "unit.unlocked",
    "drive.checked", "damage.checked", "trigger.checked", "card.revealed", "unit.stood", "unit.became_successful", "battle.close-step", "turn.started", "turn.ended", "phase.changed", "characteristic.changed", "game.ended"
  ]);

  function snapshotEventValue(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return Object.freeze(value.map(snapshotEventValue));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Game event snapshots must contain only serializable plain data.");
    const copy = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || typeof item === "function" || typeof item === "symbol") continue;
      copy[key] = snapshotEventValue(item);
    }
    return Object.freeze(copy);
  }

  /** Create an immutable serializable event envelope; player sides are temporary fallbacks until player IDs exist. */
  function createGameEvent(state, input) {
    if (!state || !input?.type || !input?.actingPlayerId) throw new TypeError("Game events require match state, type, and acting player.");
    state.eventSequence = Number(state.eventSequence || 0) + 1;
    const eventId = input.eventId || `${state.matchId || "match"}:${state.eventSequence}`;
    const subjectUid = input.subjectCardInstanceId || input.cardInstanceId;
    const subjectLocation = subjectUid ? locateCardInstance(state, subjectUid) : null;
    const subjectInstance = subjectLocation && !subjectLocation.ambiguous ? subjectLocation.instance : null;
    const subjectClans = Array.isArray(subjectInstance?.clans) && subjectInstance.clans.length ? subjectInstance.clans : subjectInstance?.clan ? [subjectInstance.clan] : [];
    return Object.freeze({
      eventId,
      type: String(input.type),
      actingPlayerId: String(input.actingPlayerId),
      turnPlayerId: String(input.turnPlayerId || ""),
      sourceCardInstanceId: input.sourceCardInstanceId || null,
      sourceCardName: input.sourceCardName || null,
      sourceCardGrade: input.sourceCardGrade != null && Number.isInteger(Number(input.sourceCardGrade)) ? Number(input.sourceCardGrade) : null,
      sourceOwnerPlayerId: input.sourceOwnerPlayerId || null,
      sourceControllerPlayerId: input.sourceControllerPlayerId || null,
      sourceCardClan: input.sourceCardClan || null,
      sourceCardClans: Object.freeze(Array.isArray(input.sourceCardClans) ? [...input.sourceCardClans] : []),
      cardInstanceId: input.cardInstanceId || null,
      abilitySourceInstanceId: input.abilitySourceInstanceId || null,
      abilitySourceOwnerPlayerId: input.abilitySourceOwnerPlayerId || null,
      abilitySourceControllerPlayerId: input.abilitySourceControllerPlayerId || null,
      reason: input.reason || input.discardReason || null,
      winnerPlayerId: input.winnerPlayerId || null,
      loserPlayerId: input.loserPlayerId || null,
      winnerSide: input.winnerSide || null,
      loserSide: input.loserSide || null,
      powerIncludesContinuous: input.powerIncludesContinuous === true,
      position: input.position || null,
      subjectCardInstanceId: input.subjectCardInstanceId || null,
      subjectOwnerPlayerId: input.subjectOwnerPlayerId || null,
      subjectControllerPlayerId: input.subjectControllerPlayerId || null,
      subjectCardName: input.subjectCardName || subjectInstance?.cardName || subjectInstance?.name || null,
      subjectCardGrade: Number.isInteger(Number(input.subjectCardGrade ?? subjectInstance?.grade)) ? Number(input.subjectCardGrade ?? subjectInstance?.grade) : null,
      subjectCardClan: input.subjectCardClan || subjectInstance?.clan || null,
      subjectCardClans: Object.freeze(Array.isArray(input.subjectCardClans) ? [...input.subjectCardClans] : [...subjectClans]),
      boosterCardInstanceId: input.boosterCardInstanceId || null,
      boosterCardName: input.boosterCardName || null,
      boosterCardClan: input.boosterCardClan || null,
      boosterCardClans: Object.freeze(Array.isArray(input.boosterCardClans) ? [...input.boosterCardClans] : []),
      boosterCardRace: input.boosterCardRace || null,
      boosterCardRaces: Object.freeze(Array.isArray(input.boosterCardRaces) ? [...input.boosterCardRaces] : []),
      boosterPower: Number.isFinite(Number(input.boosterPower)) ? Number(input.boosterPower) : null,
      boosterCardText: input.boosterCardText || null,
      boostedCardInstanceId: input.boostedCardInstanceId || null,
      boostedCardName: input.boostedCardName || null,
      boostedCardGrade: Number.isInteger(Number(input.boostedCardGrade)) ? Number(input.boostedCardGrade) : null,
      boostedCardClan: input.boostedCardClan || null,
      boostedCardClans: Object.freeze(Array.isArray(input.boostedCardClans) ? [...input.boostedCardClans] : []),
      boostedCardLimitBreaks: Object.freeze(Array.isArray(input.boostedCardLimitBreaks) ? input.boostedCardLimitBreaks.filter(Number.isInteger) : []),
      targetCardInstanceIds: Object.freeze(Array.isArray(input.targetCardInstanceIds) ? [...input.targetCardInstanceIds] : []),
      targetLocation: input.targetLocation || null,
      targetPreviousLocation: input.targetPreviousLocation || null,
      targetCurrentLocation: input.targetCurrentLocation || null,
      previousLocation: input.previousLocation || null,
      currentLocation: input.currentLocation || null,
      discardReason: input.discardReason || input.reason || null,
      calledGUnitCardId: input.calledGUnitCardId || null,
      calledGUnitInstanceId: input.calledGUnitInstanceId || null,
      calledGUnitCardName: input.calledGUnitCardName || null,
      calledGUnitPreviousLocation: input.calledGUnitPreviousLocation || null,
      circle: input.circle || null,
      battleId: input.battleId || null,
      attackingUnitInstanceId: input.attackingUnitInstanceId || null,
      attackingCardInstanceIds: Object.freeze(Array.isArray(input.attackingCardInstanceIds) ? [...new Set(input.attackingCardInstanceIds.filter(id => typeof id === "string" && id))] : []),
      attackingUnitAttackCount: Number.isInteger(Number(input.attackingUnitAttackCount)) ? Number(input.attackingUnitAttackCount) : null,
      playerAttackCount: Number.isInteger(Number(input.playerAttackCount)) ? Number(input.playerAttackCount) : null,
      phase: input.phase ?? null,
      timingWindow: input.timingWindow || null,
      attackHitOverride: input.attackHitOverride === true,
      didNotHit: input.didNotHit === true,
      checkKind: input.checkKind || null,
      checkSourceLocation: input.checkSourceLocation || null,
      checkIndex: Number.isInteger(input.checkIndex) ? input.checkIndex : null,
      checkedCardInstanceId: input.checkedCardInstanceId || null,
      checkedCardOwnerPlayerId: input.checkedCardOwnerPlayerId || null,
      checkedCardControllerPlayerId: input.checkedCardControllerPlayerId || null,
      checkedCardName: input.checkedCardName || null,
      checkedCardGrade: input.checkedCardGrade != null && Number.isInteger(Number(input.checkedCardGrade)) ? Number(input.checkedCardGrade) : null,
      checkedCardClan: input.checkedCardClan || null,
      checkedCardClans: Object.freeze(Array.isArray(input.checkedCardClans) ? [...input.checkedCardClans] : []),
      checkedCardText: input.checkedCardText || null,
      checkedCardTriggerType: typeof input.checkedCardTriggerType === "string" ? input.checkedCardTriggerType.toLowerCase() : null,
      revealedTrigger: input.revealedTrigger || null,
      ...(input.revealedCardId ? {
        revealedCardId: String(input.revealedCardId),
        revealedCardName: input.revealedCardName || null,
        revealedCardGrade: Number.isInteger(Number(input.revealedCardGrade)) ? Number(input.revealedCardGrade) : null
      } : {}),
      before: input.before == null ? null : snapshotEventValue(input.before),
      after: input.after == null ? null : snapshotEventValue(input.after)
    });
  }

  function createRideGameEvent(state, { rider, ridden, actingPlayerId, turnPlayerId, previousLocation = "hand", timingWindow = "normal-ride", eventId } = {}) {
    if (!rider?.uid || !ridden?.uid || !actingPlayerId) throw new TypeError("Ride events require the exact rider, ridden Vanguard, and acting player.");
    return createGameEvent(state, {
      eventId,
      type: "card.ridden",
      actingPlayerId,
      turnPlayerId: turnPlayerId || actingPlayerId,
      sourceCardInstanceId: rider.uid,
      sourceCardName: rider.cardName || rider.name || null,
      sourceCardGrade: rider.grade,
      sourceOwnerPlayerId: rider.ownerPlayerId || actingPlayerId,
      sourceControllerPlayerId: rider.controllerPlayerId || actingPlayerId,
      sourceCardClan: rider.clan || null,
      sourceCardClans: rider.clans || [],
      subjectCardInstanceId: rider.uid,
      subjectOwnerPlayerId: rider.ownerPlayerId || actingPlayerId,
      subjectControllerPlayerId: rider.controllerPlayerId || actingPlayerId,
      subjectCardName: rider.cardName || rider.name || null,
      subjectCardGrade: rider.grade,
      subjectCardClan: rider.clan || null,
      subjectCardClans: rider.clans || [],
      targetCardInstanceIds: [ridden.uid],
      targetLocation: "vanguard",
      targetPreviousLocation: "vanguard",
      targetCurrentLocation: "soul",
      previousLocation,
      currentLocation: "vanguard",
      phase: "ride",
      timingWindow
    });
  }

  /** Return false for event IDs already consumed by this match. */
  function attackCountKey(state,playerId,cardInstanceId){if(!state||!playerId||!cardInstanceId)throw new TypeError("Attack counts require match, controller, and card instance identities.");return `${Number(state.turn||0)}:${playerId}:${cardInstanceId}`}
  function recordAttackCount(state,playerId,cardInstanceId){const key=attackCountKey(state,playerId,cardInstanceId),counts=state.attacksByUnitTurn||=(Object.create(null));counts[key]=Number(counts[key]||0)+1;const playerKey=`${Number(state.turn||0)}:${playerId}`,playerCounts=state.attacksByPlayerTurn||=(Object.create(null));playerCounts[playerKey]=Number(playerCounts[playerKey]||0)+1;return counts[key]}
  function getAttackCount(state,playerId,cardInstanceId){if(!state||!playerId||!cardInstanceId)return 0;return Number(state.attacksByUnitTurn?.[attackCountKey(state,playerId,cardInstanceId)]||0)}
  function getPlayerAttackCount(state,playerId){return Number(state?.attacksByPlayerTurn?.[`${Number(state.turn||0)}:${playerId}`]||0)}
  function retireHollowedUnitsAtTurnEnd(players,endingPlayerId){if(!players||!endingPlayerId)return[];const retired=[];for(const[side,player]of Object.entries(players)){if(!Array.isArray(player?.rear))continue;for(let index=0;index<player.rear.length;index++){const instance=player.rear[index];if(!instance?.uid||instance.hollowed!==true||instance.hollowedExpiry!==endingPlayerId)continue;player.rear[index]=null;(player.drop||=([])).push(instance);delete instance.hollowed;delete instance.hollowedExpiry;retired.push({side,instance,zone:index<5?["rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right"][index]:`accel-${index-4}`,index})}}return retired}

  function retireChargingUnitsAtBattleEnd(players,battleId,participantInstanceIds){if(!players||!battleId||!Array.isArray(participantInstanceIds))return[];const state={players},ids=new Set(participantInstanceIds.filter(Boolean)),retired=[],zoneArrays={deck:"deck",hand:"hand",damage:"damage",drop:"drop",soul:"soul",bind:"bind","rear-guard":"rear","g-deck":"gDeck","g-zone":"gZone",guardian:"guardCircle",extra:"extra",order:"orders",crest:"crests",removed:"removed"};for(const uid of ids){const location=locateCardInstance(state,uid);if(!location||location.ambiguous||location.instance.charging!==true)continue;const ownerEntry=Object.entries(players).find(([,candidate])=>candidate?.playerId&&candidate.playerId===location.instance.ownerPlayerId),ownerSide=ownerEntry?.[0]||location.side,owner=ownerEntry?.[1]||players[ownerSide];if(!owner)continue;const source=players[location.side],arrayName=zoneArrays[location.zone],previousLocation=location.circle||location.zone;if(location.zone==="vanguard"){if(source.vanguard?.uid!==uid)continue;source.vanguard=null}else if(arrayName&&Array.isArray(source[arrayName])){if(location.zone==="rear-guard")source.rear[location.index]=null;else source[arrayName].splice(location.index,1)}else continue;(owner.deck||=[]).push(location.instance);delete location.instance.charging;delete location.instance.chargingExpiry;retired.push({side:location.side,ownerSide,instance:location.instance,zone:previousLocation,battleId,previousLocation})}return retired}

  function claimGameEvent(state, eventId) {
    if (!state || !eventId) return false;
    const processed = state.processedEventIds ||= [];
    if (processed.includes(eventId)) return false;
    processed.push(eventId);
    return true;
  }

  /** Claim one ability for one event exactly once, including after a prompt is declined. */
  function claimAbilityTrigger(state, eventId, cardInstanceId, abilityId, limit = 2048) {
    if (!state || !eventId || !cardInstanceId || !abilityId) return false;
    const claimed = state.processedAbilityTriggers ||= [];
    const key = `${eventId}:${cardInstanceId}:${abilityId}`;
    if (claimed.includes(key)) return false;
    claimed.push(key);
    if (claimed.length > limit) claimed.splice(0, claimed.length - limit);
    return true;
  }  function validateRemoteRequest(state, request, expectedActorPlayerId = null) {
    if (!state || !request || typeof request.actionId !== "string" || !request.actionId.trim()) return { ok: false, reason: "missing-action-id" };
    if (expectedActorPlayerId && (!request.matchId || request.matchId !== state.matchId)) return { ok: false, reason: "wrong-match" };
    if (expectedActorPlayerId && request.actorPlayerId !== expectedActorPlayerId) return { ok: false, reason: "wrong-actor" };
    if ((state.processedActionIds || []).includes(request.actionId)) return { ok: false, reason: "duplicate-action" };
    const expected = Number(request.expectedStateVersion);
    const current = Number(state.stateVersion || 0);
    if (!Number.isInteger(expected) || expected !== current) return { ok: false, reason: "stale-state-version", expected, current };
    return { ok: true };
  }
  function playerContainsInstance(player,uid){if(!player||typeof uid!=="string")return false;const seen=new WeakSet(),stack=[player];while(stack.length){const value=stack.pop();if(!value||typeof value!=="object"||seen.has(value))continue;seen.add(value);if(value.uid===uid)return true;for(const child of Object.values(value))if(child&&typeof child==="object")stack.push(child)}return false}
  function stateContainsInstance(state,uid){const located=locateCardInstance(state,uid);return Boolean(located&&!located.ambiguous)}
  const remoteGameActions = new Set(["draw","ride","call","attack","guard","noGuard","finishAttack","endTurn","advance"]);
  const remoteManualActions = new Set("ability activate-skill add-critical add-damage alter-power attack-choice bind crest-add crest-place crest-skip counter-blast counter-charge damage-action damage-check deck-action deck-view draw-card drop-action drive-check field-to-g flip-g-unit g-assist g-assist-discard g-assist-finish g-assist-none g-assist-pick g-guard gdeck-flip-up gdeck-reveal gdeck-to-g gzone-flip-up gift-accel gift-force guard-perfect guardian-shield hand-to-bottom hand-to-damage hand-to-order hand-to-top heal-damage intercept lock mill minus move-rear-to move-select open-skills order-to-bottom order-to-drop order-to-hand order-to-top place play-order protect-to-hand public-reveal public-reveal-close quick-shield rest-selected reveal-action reveal-done reveal-top reveal-top-cards selected-to-bottom selected-to-drop selected-to-hand selected-to-soul selected-to-top set-power shuffle soul-blast soul-charge stand-selected stride stride-confirm stride-cost stride-cancel superior-ride top-to-drop trigger-check trigger-pick trigger-skip view-gdeck view-selected-soul zone-move".split(" "));
  function validateRemoteActionRequest(state, request, expectedActorPlayerId = null) {
    const replay=validateRemoteRequest(state,request,expectedActorPlayerId);if(!replay.ok)return replay;const requestActorSide=Object.keys(state.players||{}).find(side=>state.players[side]?.playerId===request.actorPlayerId),triggerDecision=state.pendingTrigger?.side===requestActorSide&&/^manual:trigger-(?:pick|skip)(?::|$)/.test(request.action||"");if(state.pendingTurnEnd||state.pendingAbility||(state.pendingAbilities||[]).length||state.pendingTrigger&&!triggerDecision||state.pendingHitResolution||state.pendingBattleEnd||(state.pendingDamageQueue||[]).length)return{ok:false,reason:"resolution-in-progress"};
    if(request.type==="setup-roll")return state.preMatch?.stage==="roll"&&state.preMatch.rolls?.bot===null?{ok:true}:{ok:false,reason:"setup-window-closed"};
    if(request.type==="setup-choice")return state.preMatch?.stage==="roll"&&state.preMatch.winner==="bot"&&["human","bot"].includes(request.firstSide)?{ok:true}:{ok:false,reason:"invalid-first-player-choice"};
    if(request.type==="setup-mulligan"){const hand=state.players?.bot?.hand||[],uids=request.handUids;if(state.preMatch?.stage!=="mulligan"||state.preMatch.mulliganDone?.bot||!Array.isArray(uids)||new Set(uids).size!==uids.length||uids.some(uid=>typeof uid!=="string"||!hand.some(card=>card?.uid===uid)))return{ok:false,reason:"invalid-mulligan-selection"};return{ok:true}}
    if(request.type==="select"){if(request.selected!==null&&(typeof request.selected!=="string"||request.selected.length>180))return{ok:false,reason:"invalid-selection"};if(request.selected!==null){const actorSide=Object.keys(state.players||{}).find(side=>state.players[side]?.playerId===request.actorPlayerId);if(!actorSide||!playerContainsInstance(state.players[actorSide],request.selected))return{ok:false,reason:"selected-card-not-controlled"}}return{ok:true}}
    if(request.type!=="action"||typeof request.action!=="string")return{ok:false,reason:"invalid-action-type"};
    if(request.selected!==undefined&&request.selected!==null&&(typeof request.selected!=="string"||request.selected.length>180))return{ok:false,reason:"invalid-selection"};
    if(typeof request.selected==="string"&&!stateContainsInstance(state,request.selected))return{ok:false,reason:"selected-card-not-found"};
    if(remoteGameActions.has(request.action)){
      const actorSide=Object.keys(state.players||{}).find(side=>state.players[side]?.playerId===request.actorPlayerId);
      if(!actorSide)return{ok:false,reason:"actor-not-in-match"};
      const actor=state.players[actorSide],isActorTurn=state.side===actorSide;
      const requiredPhase={draw:1,ride:2,call:4,attack:5,endTurn:6}[request.action];
      if(requiredPhase!==undefined&&(!isActorTurn||Number(state.phase)!==requiredPhase))return{ok:false,reason:!isActorTurn?"not-actor-turn":"wrong-phase"};
      if(request.action==="advance"&&!isActorTurn)return{ok:false,reason:"not-actor-turn"};
      const inHand=uid=>typeof uid==="string"&&(actor.hand||[]).some(card=>card?.uid===uid);
      const onField=uid=>typeof uid==="string"&&(actor.vanguard?.uid===uid||(actor.rear||[]).some(card=>card?.uid===uid));
      if((request.action==="ride"||request.action==="call")&&!inHand(request.selected))return{ok:false,reason:"selected-card-not-in-hand"};
      if(request.action==="attack"&&!onField(request.selected))return{ok:false,reason:"attacker-not-on-field"};
      if((request.action==="guard"||request.action==="noGuard")&&state.pendingAttack?.defenderSide!==actorSide)return{ok:false,reason:"not-defending-player"};
      if(request.action==="guard"&&!inHand(request.selected))return{ok:false,reason:"guard-card-not-in-hand"};
      if(request.action==="finishAttack"){
        const attack=state.pendingAttack;
        if(attack?.attackerSide!==actorSide)return{ok:false,reason:"not-attacking-player"};
        if(!attack.defenderDone||attack.driveCountPrompt||Number(attack.driveChecksRemaining||0)>0)return{ok:false,reason:"attack-resolution-incomplete"};
      }
      return{ok:true};
    }
    if(/^manual:[A-Za-z0-9:_ -]{1,180}$/.test(request.action)&&remoteManualActions.has(request.action.slice(7).split(":")[0])){
      const [command,...args]=request.action.slice(7).split(":"),actorSide=Object.keys(state.players||{}).find(side=>state.players[side]?.playerId===request.actorPlayerId),actor=state.players?.[actorSide];
      if(!actorSide)return{ok:false,reason:"actor-not-in-match"};
      if(command==="gift-force"){const[type,zone]=args,zones=["vanguard","rear-left","rear-right","rear-back-left","rear-back-center","rear-back-right",...Array.from({length:Number(actor.accelZones)||0},(_,i)=>`accel-${i+1}`)];if(!["Force I","Force II"].includes(type)||!zones.includes(zone))return{ok:false,reason:"invalid-force-marker-placement"};}
      if(command==="trigger-pick"){
        const pending=state.pendingTrigger,uid=args[0];
        if(!pending||pending.side!==actorSide||typeof uid!=="string")return{ok:false,reason:"no-owned-trigger-choice"};
        if(pending.stage==="heal-target"){
          if(!(actor.damage||[]).some(card=>card?.uid===uid))return{ok:false,reason:"invalid-heal-target"};
        }else{
          const target=locateCardInstance(state,uid);
          if(!target||target.ambiguous||target.side!==actorSide||!["vanguard","rear-guard"].includes(target.zone))return{ok:false,reason:"invalid-trigger-unit-target"};
          if(pending.stage==="stand-target"&&(target.zone==="vanguard"||!target.instance.rested))return{ok:false,reason:"invalid-stand-target"};
        }
      }
      if(command==="trigger-skip"&&(state.pendingTrigger?.side!==actorSide||state.pendingTrigger?.stage!=="heal-target"))return{ok:false,reason:"no-skippable-heal-choice"};
      if(command==="gdeck-reveal"||command==="gdeck-flip-up"){
        const item=(actor.gDeck||[]).find(card=>card?.uid===args[0]);
        if(!item)return{ok:false,reason:"gdeck-card-not-owned"};
        if(command==="gdeck-flip-up"&&item.faceUp)return{ok:false,reason:"gdeck-card-already-face-up"};
      }
      if(["stride","stride-cost","stride-confirm","stride-cancel"].includes(command)){
        if(state.side!==actorSide)return{ok:false,reason:"not-actor-turn"};
        if(command==="stride"&&(Number(state.phase)!==3||state.stridePerformed||state.pendingStride||typeof args[0]!=="string"||!(actor.gDeck||[]).some(card=>card?.uid===args[0]&&!card.faceUp)))return{ok:false,reason:"invalid-stride-selection"};
        if(command==="stride-cost"&&(!state.pendingStride||state.pendingStride.ownerSide!==actorSide||typeof args[0]!=="string"||!(actor.hand||[]).some(card=>card?.uid===args[0])))return{ok:false,reason:"invalid-stride-cost-selection"};
        if(command==="stride-confirm"){
          const pending=state.pendingStride,costUids=pending?.costUids;
          if(!pending||pending.ownerSide!==actorSide||state.stridePerformed||!(actor.gDeck||[]).some(card=>card?.uid===pending.unitUid&&!card.faceUp)||!Array.isArray(costUids)||!costUids.length||new Set(costUids).size!==costUids.length||costUids.some(uid=>!(actor.hand||[]).some(card=>card?.uid===uid)))return{ok:false,reason:"invalid-stride-payment"};
        }
        if(command==="stride-cancel"&&state.pendingStride?.ownerSide!==actorSide)return{ok:false,reason:"no-owned-stride-pending"};
      }
      if(command==="activate-skill"){
        const [sourceUid]=args,source=typeof sourceUid==="string"?locateCardInstance(state,sourceUid):null,abilityId=args.slice(1).join(":"),separator=abilityId.lastIndexOf(":"),cardId=separator>0?abilityId.slice(0,separator):"",rawIndex=separator>0?abilityId.slice(separator+1):"";
        if(state.side!==actorSide)return{ok:false,reason:"not-actor-turn"};
        if(!source||source.ambiguous||source.side!==actorSide||!(source.zone==="vanguard"||source.zone==="rear-guard"||source.zone==="g-deck"||source.zone==="g-zone"))return{ok:false,reason:"skill-source-not-controlled-on-field"};
        const isGZoneSource=source.zone==="g-deck"||source.zone==="g-zone";
        if(isGZoneSource&&(source.instance.faceUp!==false||(source.zone==="g-deck"&&source.instance.gDeckCard!==true)))return{ok:false,reason:"g-zone-act-source-must-be-face-down"};
        const expectedPhase=isGZoneSource?3:4;
        if(Number(state.phase)!==expectedPhase)return{ok:false,reason:"wrong-phase"};
        if(request.selected!==sourceUid)return{ok:false,reason:"skill-source-selection-mismatch"};
        if(!source||cardId!==String(source.instance.cardId)||!/^\d{1,2}$/.test(rawIndex)||Number(rawIndex)>63)return{ok:false,reason:"invalid-skill-selection"};
        if(state.pendingAbility||state.pendingTrigger||state.pendingAttack||state.pendingTurnEnd||(state.pendingAbilities||[]).length)return{ok:false,reason:"resolution-in-progress"};
      }
      if(command==="guard-perfect"){
        const [markerUid,costUid]=args,attack=state.pendingAttack;
        if(attack?.defenderSide!==actorSide||attack.defenderDone||typeof markerUid!=="string"||typeof costUid!=="string"||markerUid===costUid||!(actor.hand||[]).some(card=>card?.uid===markerUid)||!(actor.hand||[]).some(card=>card?.uid===costUid))return{ok:false,reason:"invalid-perfect-guard-payment"};
      }
      if(command==="g-guard"){
        const [guardianUid,healUid]=args,attack=state.pendingAttack;
        if(attack?.defenderSide!==actorSide||attack.defenderDone||typeof guardianUid!=="string"||typeof healUid!=="string"||!(actor.gDeck||[]).some(card=>card?.uid===guardianUid&&!card.faceUp)||!(actor.hand||[]).some(card=>card?.uid===healUid))return{ok:false,reason:"invalid-g-guard-payment"};
      }
      return{ok:true};
    }
    return{ok:false,reason:"unsupported-action"};
  }
  function payAbilityCosts(ability,context={},selection={}) {
    if (Array.isArray(ability?.costAlternatives)) {
      const index = selection.costAlternativeIndex;
      if (!Number.isInteger(index) || index < 0 || index >= ability.costAlternatives.length) return { ok: false, reason: "invalid-cost-alternative" };
      return payAbilityCosts({ ...ability, costs: ability.costAlternatives[index], costAlternatives: undefined }, context, selection);
    }
    const player=context.player,source=context.source,costs={"counter-blast":0,"soul-blast":0,"energy-blast":0,discard:0,"reveal-grade-from-hand":0,"source-discard":0,"source-retire":0,"source-to-soul":0,"source-to-bottom-deck":0,"rest-source":0,"source-bind":0,"source-bind-from-field-or-drop":0,"bind-heal-from-drop":0};
    if(!ability||!player||!source||ability.costStatus==="needs-review"||!Array.isArray(player.damage)||!Array.isArray(player.soul)||!Array.isArray(player.hand)||!Array.isArray(player.drop)||!Array.isArray(player.rear))return{ok:false,reason:"invalid-cost-context"};
    for(const cost of ability.costs||[]){if(!Object.hasOwn(costs,cost.type))return{ok:false,reason:"unsupported-cost"};if(!Number.isInteger(Number(cost.count))||Number(cost.count)<1)return{ok:false,reason:"invalid-cost-definition"};costs[cost.type]+=Number(cost.count)}
    if(costs["energy-blast"]&&(context.hasEnergyGenerator!==true||!Number.isInteger(Number(player.energy))||Number(player.energy)<costs["energy-blast"]))return{ok:false,reason:"insufficient-energy"};
    const selected={"counter-blast":selection.cb||[],"soul-blast":selection.sb||[],discard:selection.discard||[]},chosen={};
    for(const type of Object.keys(selected)){
      const ids=selected[type];if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length!==costs[type])return{ok:false,reason:"invalid-cost-selection"};
      const zone=type==="counter-blast"?player.damage:type==="soul-blast"?player.soul:player.hand;
      chosen[type]=ids.map(uid=>zone.find(card=>card?.uid===uid)).filter(Boolean);
      if(chosen[type].length!==ids.length)return{ok:false,reason:"cost-card-unavailable"};
      if(type==="counter-blast"&&chosen[type].some(card=>card.faceDown))return{ok:false,reason:"damage-not-face-up"};
      if(type==="counter-blast")for(const cost of ability.costs||[])if(cost.type==="counter-blast"&&cost.filter){const matching=chosen[type].filter(card=>typeof context.cardDefinitionForInstance==="function"&&matchesTargetFilter(cost.filter,{targetCard:context.cardDefinitionForInstance(card)}));if(matching.length<Number(cost.count||0))return{ok:false,reason:"counter-blast-filter-not-met"}}
      if(type==="discard"&&chosen[type].some(card=>card.uid===source.uid))return{ok:false,reason:"cannot-discard-source"};
      if(type==="discard")for(const cost of ability.costs||[])if(cost.type==="discard"&&cost.filter){const matching=chosen[type].filter(card=>typeof context.cardDefinitionForInstance==="function"&&matchesTargetFilter(cost.filter,{targetCard:context.cardDefinitionForInstance(card)}));if(matching.length<Number(cost.count||0))return{ok:false,reason:"discard-filter-not-met"}}
    }
    if(costs["source-discard"]&&(costs["source-discard"]!==1||!player.hand.some(card=>card?.uid===source.uid)))return{ok:false,reason:"source-not-in-hand"};
    const revealedCostUids=selection.reveal||[],revealCosts=(ability.costs||[]).filter(cost=>cost.type==="reveal-grade-from-hand");if(!Array.isArray(revealedCostUids)||new Set(revealedCostUids).size!==revealedCostUids.length||revealedCostUids.length!==costs["reveal-grade-from-hand"])return{ok:false,reason:"invalid-reveal-cost-selection"};const revealedCostCards=revealedCostUids.map(uid=>player.hand.find(card=>card?.uid===uid)).filter(Boolean);if(revealedCostCards.length!==revealedCostUids.length||revealCosts.some((cost,index)=>Number(context.cardDefinitionForInstance?.(revealedCostCards[index])?.grade)!==Number(cost.grade)))return{ok:false,reason:"reveal-cost-filter-not-met"};
    const sourceZone=context.sourceZone,sourceIndex=sourceZone==="vanguard"?(player.vanguard?.uid===source.uid?-2:-1):player.rear.findIndex(card=>card?.uid===source.uid),rearCircle=/^(?:rear-(?:left|right|back-(?:left|center|right))|accel-\d+)$/.test(String(sourceZone||"")),sourceInPlay=sourceZone==="vanguard"?sourceIndex===-2:rearCircle&&sourceIndex>=0;
    if((costs["source-to-soul"]||costs["rest-source"])&&!sourceInPlay)return{ok:false,reason:"source-not-in-play"};
    if(costs["source-retire"]&&(costs["source-retire"]!==1||!sourceInPlay||sourceZone==="vanguard"))return{ok:false,reason:"source-not-retirable"};
    if(costs["source-to-bottom-deck"]&&(!player.drop.some(card=>card?.uid===source.uid)||costs["source-to-soul"]||costs["rest-source"]))return{ok:false,reason:"source-not-in-drop"};
    if(costs["source-bind"]&&(costs["source-bind"]!==1||!player.drop.some(card=>card?.uid===source.uid)))return{ok:false,reason:"source-not-in-drop"};
    const bindAnyZoneCount=costs["source-bind-from-field-or-drop"],sourceOnRear=rearCircle&&sourceIndex>=0,sourceInDrop=player.drop.some(card=>card?.uid===source.uid);
    if(bindAnyZoneCount&&(bindAnyZoneCount!==1||!(sourceOnRear||sourceZone==="drop"&&sourceInDrop)||source.ownerPlayerId!==player.playerId&&source.ownerPlayerId!==context.actorPlayerId||source.controllerPlayerId!==player.playerId&&source.controllerPlayerId!==context.actorPlayerId))return{ok:false,reason:"source-not-in-field-or-drop"};
    const bindHealCosts=(ability.costs||[]).filter(cost=>cost.type==="bind-heal-from-drop"),bindHealUid=selection.effectUid,bindHeal=player.drop.find(card=>card?.uid===bindHealUid&&card.uid!==source.uid);
    if(costs["bind-heal-from-drop"]&&(costs["bind-heal-from-drop"]!==1||!bindHeal||bindHealCosts.some(cost=>String(context.cardDefinitionForInstance?.(bindHeal)?.trigger||"").toLowerCase()!==String(cost.filter?.trigger||"heal").toLowerCase())))return{ok:false,reason:"invalid-bind-heal-target"};
    if(costs["rest-source"]&&source.rested)return{ok:false,reason:"source-already-rested"};
    let usageKey=null;
    if(ability.once||ability.usageRestriction){try{const cardName=context.cardDefinitionForInstance?.(source)?.name;usageKey=abilityUsageKey(context.turnId,player.playerId||context.actorPlayerId,source.uid,ability.id,ability.usageRestriction,cardName,ability.printedText||ability.raw)}catch{return{ok:false,reason:"missing-usage-identity"}};player.usedAbilities||=[];if(player.usedAbilities.includes(usageKey))return{ok:false,reason:"usage-restriction"}}
    if(usageKey)player.usedAbilities.push(usageKey);
    for(const card of revealedCostCards)context.emitEvent?.({type:"card.revealed",cardInstanceId:card.uid,controllerSide:context.side,reason:"ability-cost"});
    if(costs["source-discard"]){player.hand=player.hand.filter(card=>card.uid!==source.uid);player.drop.push(source);context.emitEvent?.({type:"card.discarded",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"drop"})}
    chosen["counter-blast"].forEach(card=>{card.faceDown=true});
    if(costs["energy-blast"]){player.energy-=costs["energy-blast"];player.energySpentThisTurn=Number(player.energySpentThisTurn||0)+costs["energy-blast"]}
    if(chosen["soul-blast"].length){const ids=new Set(chosen["soul-blast"].map(card=>card.uid));player.soul=player.soul.filter(card=>!ids.has(card.uid));player.drop.push(...chosen["soul-blast"]);for(const card of chosen["soul-blast"])context.emitEvent?.({type:"card.moved",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"soul",currentLocation:"drop"})}
    if(chosen.discard.length){const ids=new Set(chosen.discard.map(card=>card.uid));player.hand=player.hand.filter(card=>!ids.has(card.uid));player.drop.push(...chosen.discard);for(const card of chosen.discard)context.emitEvent?.({type:"card.discarded",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"hand",currentLocation:"drop"})}
    if(costs["source-to-soul"]){if(sourceZone==="vanguard")player.vanguard=null;else player.rear[sourceIndex]=null;player.soul.push(source);context.emitEvent?.({type:"card.moved",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:sourceZone,currentLocation:"soul"})}
    if(costs["source-retire"]){player.rear[sourceIndex]=null;player.drop.push(source);context.emitEvent?.({type:"card.retired",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:sourceZone,currentLocation:"drop"})}
    if(costs["source-to-bottom-deck"]){const index=player.drop.findIndex(card=>card?.uid===source.uid);if(index<0)return{ok:false,reason:"source-not-in-drop"};player.drop.splice(index,1);player.deck.unshift(source);context.emitEvent?.({type:"card.moved",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:"deck"})}
    if(costs["source-bind"]){const index=player.drop.findIndex(card=>card?.uid===source.uid);if(index<0)return{ok:false,reason:"source-not-in-drop"};player.drop.splice(index,1);source.faceUp=true;player.bind||=[];player.bind.push(source);context.emitEvent?.({type:"card.bound",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:"bind"})}
    if(bindAnyZoneCount){const oldLocation=sourceZone;let removed=false;if(sourceOnRear){player.rear[sourceIndex]=null;removed=true}else if(sourceZone==="drop"){const index=player.drop.findIndex(card=>card?.uid===source.uid);if(index>=0){player.drop.splice(index,1);removed=true}}if(!removed)return{ok:false,reason:"source-not-in-field-or-drop"};source.faceUp=true;player.bind||=[];player.bind.push(source);context.sourceBindCostPaid=true;context.emitEvent?.({type:"card.bound",cardInstanceId:source.uid,controllerSide:context.side,previousLocation:oldLocation,currentLocation:"bind"})}
    if(costs["bind-heal-from-drop"]){const index=player.drop.findIndex(card=>card?.uid===bindHealUid);if(index<0)return{ok:false,reason:"invalid-bind-heal-target"};const [card]=player.drop.splice(index,1);card.faceUp=true;player.bind||=[];player.bind.push(card);context.emitEvent?.({type:"card.bound",cardInstanceId:card.uid,controllerSide:context.side,previousLocation:"drop",currentLocation:"bind"})}
    if(costs["rest-source"])source.rested=true;
    return{ok:true,usageKey,paid:{counterBlast:chosen["counter-blast"].length,soulBlast:chosen["soul-blast"].length,discard:chosen.discard.length,sourceToSoul:costs["source-to-soul"],sourceToBottomDeck:costs["source-to-bottom-deck"],restSource:costs["rest-source"],sourceBind:costs["source-bind"],bindHealFromDrop:costs["bind-heal-from-drop"]}};
  }  function abilitySourceZoneAtResolution(ability, pending, currentLocation) {
    if (ability?.kind === "AUTO" && pending?.eventContext?.eventId && pending?.field) return pending.field;
    return currentLocation || pending?.field || null;
  }

  function canResolveAbilitySource(ability, pending, actorPlayerId, sourceInstance, sourceIsInPlay) {
    if (!ability || !pending || !actorPlayerId || !sourceInstance) return false;
    const triggerOwner = pending.triggerControllerPlayerId || sourceInstance.controllerPlayerId;
    if (triggerOwner !== actorPlayerId) return false;
    if (sourceIsInPlay) return true;
    return ability.kind === "AUTO" && Boolean(pending.eventContext?.eventId);
  }
  function validateAbilityDecision(state, request, expectedPlayerId, pending, resourceContext = {}) {
    const replay = validateRemoteRequest(state, request, expectedPlayerId);
    if (!replay.ok) return replay;
    if (!request.matchId || request.matchId !== state.matchId) return { ok: false, reason: "wrong-match" };
    if (!expectedPlayerId || request.actorPlayerId !== expectedPlayerId) return { ok: false, reason: "wrong-actor" };
    const selection=request.selection;
    if (!pending || !selection || typeof selection !== "object" || Array.isArray(selection) || pending.instance?.uid !== selection.instanceUid || pending.ability?.id !== selection.abilityId) return { ok: false, reason: "wrong-ability" };
    if ((pending.triggerControllerPlayerId || pending.instance?.controllerPlayerId) !== expectedPlayerId) return { ok: false, reason: "source-not-controlled" };
    if (typeof request.accept !== "boolean") return { ok: false, reason: "invalid-decision" };
    if (!request.accept) return canDeclineAbility(pending.ability) ? { ok: true } : { ok: false, reason: "mandatory-ability" };
    if(selection.payCost!==undefined&&typeof selection.payCost!=="boolean")return{ok:false,reason:"invalid-cost-decision"};
    if(selection.payCost===false){const selectedCosts=selection.costSelections??{};if(pending.ability.kind!=="AUTO"||pending.ability.costStatus==="needs-review"||!((Array.isArray(pending.ability.costs)&&pending.ability.costs.length)||(Array.isArray(pending.ability.costAlternatives)&&pending.ability.costAlternatives.length))||selection.costAlternativeIndex!==undefined||!selectedCosts||typeof selectedCosts!=="object"||Array.isArray(selectedCosts)||Object.keys(selectedCosts).some(key=>!(["cb","sb","discard","reveal"].includes(key)))||Object.values(selectedCosts).some(ids=>!Array.isArray(ids)||ids.length))return{ok:false,reason:"cost-not-skipped"};return{ok:true}}
    const costs=selection.costSelections ?? {};
    const alternatives=pending.ability.costAlternatives;
    if(alternatives!==undefined&&!Array.isArray(alternatives))return{ok:false,reason:"invalid-cost-definition"};
    if(Array.isArray(alternatives)&&(!Number.isInteger(selection.costAlternativeIndex)||selection.costAlternativeIndex<0||selection.costAlternativeIndex>=alternatives.length))return{ok:false,reason:"invalid-cost-alternative"};
    if(!Array.isArray(alternatives)&&selection.costAlternativeIndex!==undefined)return{ok:false,reason:"unexpected-cost-alternative"};
    const selectedAbilityCosts=Array.isArray(alternatives)?alternatives[selection.costAlternativeIndex]:pending.ability.costs||[];
    if (!costs || typeof costs !== "object" || Array.isArray(costs) || Object.keys(costs).some(key=>!(["cb","sb","discard","reveal"].includes(key)))) return { ok: false, reason: "invalid-cost-selection" };
    const expected={cb:0,sb:0,discard:0,reveal:0},automaticCosts=new Set(["source-discard","source-retire","source-to-soul","source-to-bottom-deck","rest-source","source-bind","source-bind-from-field-or-drop","bind-heal-from-drop"]);
    for(const cost of selectedAbilityCosts){if(!Number.isInteger(Number(cost.count))||Number(cost.count)<1)return{ok:false,reason:"invalid-cost-definition"};const key=cost.type==="counter-blast"?"cb":cost.type==="soul-blast"?"sb":cost.type==="discard"?"discard":cost.type==="reveal-grade-from-hand"?"reveal":null;if(key)expected[key]+=Number(cost.count);else if(cost.type==="energy-blast")continue;else if(!automaticCosts.has(cost.type))return{ok:false,reason:"unsupported-cost"};else if(Number(cost.count)!==1)return{ok:false,reason:"invalid-cost-definition"}}
    const revealSelections=costs.reveal??[];if(!Array.isArray(revealSelections)||revealSelections.some(uid=>typeof uid!=="string"||!uid||uid.length>180)||new Set(revealSelections).size!==revealSelections.length||revealSelections.length!==expected.reveal)return{ok:false,reason:"invalid-cost-selection"};
    for(const key of Object.keys(expected)){
      const ids=costs[key]??[];
      if(!Array.isArray(ids)||ids.some(uid=>typeof uid!=="string"||!uid||uid.length>180)||new Set(ids).size!==ids.length||ids.length!==expected[key])return{ok:false,reason:"invalid-cost-selection"};
    }
    if(Array.isArray(alternatives)){const optionActor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId);if(!optionActor)return{ok:false,reason:"actor-not-in-match"};if(!canPayAbilityCosts({...pending.ability,costs:selectedAbilityCosts,costAlternatives:undefined},{faceUpDamage:(optionActor.damage||[]).filter(card=>!card.faceDown).length,energy:optionActor.energy,hasEnergyGenerator:resourceContext.hasEnergyGenerator===true||(optionActor.crests||[]).some(card=>/energy generator/i.test(String(card?.cardName||card?.crestName||card?.name||"")))}))return{ok:false,reason:"unpayable-cost"};}
    if(Object.values(expected).some(count=>count>0)){
      const actor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId);
      if(!actor)return{ok:false,reason:"actor-not-in-match"};
      const inZone=(zone,uid)=>(actor[zone]||[]).some(card=>card?.uid===uid);
      if((costs.cb||[]).some(uid=>!inZone("damage",uid)))return{ok:false,reason:"cost-card-unavailable"};
      if((costs.cb||[]).some(uid=>actor.damage.find(card=>card?.uid===uid)?.faceDown))return{ok:false,reason:"damage-not-face-up"};
      if((costs.sb||[]).some(uid=>!inZone("soul",uid)))return{ok:false,reason:"cost-card-unavailable"};
      if((costs.discard||[]).some(uid=>!inZone("hand",uid)))return{ok:false,reason:"cost-card-unavailable"};
      if((costs.discard||[]).includes(pending.instance?.uid))return{ok:false,reason:"cannot-discard-source"};
      if((costs.reveal||[]).some(uid=>!inZone("hand",uid)))return{ok:false,reason:"cost-card-unavailable"};
      if(selectedAbilityCosts.some(cost=>cost.type==="source-retire")&&(!Array.isArray(actor.rear)||!actor.rear.some(card=>card?.uid===pending.instance?.uid)))return{ok:false,reason:"source-not-retirable"};
      if(selectedAbilityCosts.some(cost=>cost.type==="source-bind-from-field-or-drop")&&!([...((actor.rear)||[]).filter(Boolean),...(actor.drop||[])].some(card=>card?.uid===pending.instance?.uid)))return{ok:false,reason:"source-not-in-field-or-drop"};
    }
    for(const key of ["effectUid","targetUid","effectDiscardUid","callZone","circleZone","deckDestination","effectChoice","revelationTopUid"]){const value=selection[key];if(value!=null&&(typeof value!=="string"||value.length>180))return{ok:false,reason:"invalid-ability-selection"}}
    const circleMarkerStep=pending.ability.definition?.effects?.find(step=>step.op==="place-circle-marker");
    if(circleMarkerStep){const actor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId),zone=selection.circleZone,rearIndex=({"rear-left":0,"rear-right":1,"rear-back-left":2,"rear-back-center":3,"rear-back-right":4})[zone],accel=typeof zone==="string"?zone.match(/^accel-(\d+)$/):null,zoneType=zone==="vanguard"?"vanguard":rearIndex!=null||accel?"rear-guard":null,configuration=circleMarkerStep.markerType==="Treasures"&&JSON.stringify(circleMarkerStep.circleTypes)===JSON.stringify(["vanguard","rear-guard"])||circleMarkerStep.markerType==="Dragontree"&&JSON.stringify(circleMarkerStep.circleTypes)===JSON.stringify(["rear-guard"]),zoneExists=zone==="vanguard"?Boolean(actor?.vanguard):rearIndex!=null?rearIndex<(actor?.rear||[]).length:Boolean(accel&&Number(accel[1])<=Number(actor?.accelZones||0));if(selection.targetUid!==undefined||selection.effectChoice!==undefined||!actor||!configuration||!circleMarkerStep.circleTypes.includes(zoneType)||!zoneExists)return{ok:false,reason:"invalid-marker-circle"};if((actor.giftZones||[]).some(marker=>marker?.zone===zone&&marker?.type===circleMarkerStep.markerType))return{ok:false,reason:"marker-already-present"}}
    else if(selection.circleZone!=null)return{ok:false,reason:"invalid-ability-selection"};
    const revelationStep=pending.ability.definition?.effects?.find(step=>step.op==="revelation-choice");
    if(revelationStep){if(!["soul","keep-top"].includes(selection.effectChoice))return{ok:false,reason:"invalid-ability-choice"};const actor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId),target=selection.targetUid?locateCardInstance(state,selection.targetUid):null,standing=(actor?.rear||[]).filter(card=>card&&card.rested!==true);if(!Object.hasOwn(selection,"revelationTopUid")||(actor?.deck?.at(-1)?.uid??null)!==(selection.revelationTopUid??null))return{ok:false,reason:"stale-revelation-top-card"};if(selection.effectChoice==="keep-top"&&selection.targetUid)return{ok:false,reason:"unexpected-ability-target"};if(selection.effectChoice==="soul"&&!selection.targetUid&&standing.length)return{ok:false,reason:"missing-ability-target"};if(selection.effectChoice==="soul"&&selection.targetUid){const card=target?.instance,controller=target?.controllerPlayerId;if(!actor||!target||target.ambiguous||controller!==expectedPlayerId||target.zone!=="rear-guard"||card?.rested===true||!standing.some(unit=>unit.uid===card?.uid))return{ok:false,reason:"invalid-ability-target"}}}
    const engorgeStep=pending.ability.definition?.effects?.find(step=>step.op==="engorge");
    if(engorgeStep){const actor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId),ids=selection.engorgeTargetUids,attack=state.pendingAttack;if(!actor||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(uid=>typeof uid!=="string"||!uid||uid===pending.instance?.uid||!(actor.rear||[]).some(card=>card?.uid===uid))||attack?.attackerUid!==pending.instance?.uid||attack?.attackerSide!==pending.side)return{ok:false,reason:"invalid-engorge-selection"}}else if(selection.engorgeTargetUids!==undefined&&selection.engorgeTargetUids!==null&&(!Array.isArray(selection.engorgeTargetUids)||selection.engorgeTargetUids.length))return{ok:false,reason:"unexpected-engorge-selection"}
    const choiceStep=pending.ability.definition?.effects?.find(step=>step.op==="g-guardian-grade-three-replacement-choice");
    if(choiceStep){const choice=choiceStep.choices.find(item=>item.id===selection.effectChoice),actor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId),target=selection.targetUid?locateCardInstance(state,selection.targetUid):null,opponent=Object.values(state.players||{}).find(player=>player&&player!==actor);if(!choice||!actor||!target||target.ambiguous||!target.controllerPlayerId||!target.zone||!["vanguard","rear-guard"].includes(target.zone))return{ok:false,reason:"invalid-ability-target"};const wantedController=choice.targetFilter.controller==="opponent"?opponent?.playerId:actor.playerId;if(target.controllerPlayerId!==wantedController||(choice.targetFilter.zone==="vanguard"&&target.zone!=="vanguard"))return{ok:false,reason:"invalid-ability-target"}}
    else if(!revelationStep&&selection.effectChoice!=null)return{ok:false,reason:"invalid-ability-selection"};
    const gGuardianStep=pending.ability.definition?.effects?.find(step=>step.op==="g-guardian-discard-charge-choice");
    if(gGuardianStep){
      if(!["counter-charge","soul-charge"].includes(selection.chargeChoice))return{ok:false,reason:"invalid-charge-choice"};
      const actor=Object.values(state.players||{}).find(player=>player?.playerId===expectedPlayerId),sourceInDrop=(actor?.drop||[]).some(card=>card?.uid===pending.instance?.uid),sourceBound=(actor?.bind||[]).some(card=>card?.uid===pending.instance?.uid);
      if(!sourceInDrop&&!sourceBound)return{ok:false,reason:"source-not-in-drop"};
      const heal=(actor?.drop||[]).find(card=>card?.uid===selection.effectUid&&card.uid!==pending.instance?.uid);
      if(!heal||String(heal.triggerType||heal.trigger||"").toLowerCase()!=="heal")return{ok:false,reason:"invalid-bind-heal-target"};
      if(selection.chargeChoice==="counter-charge"){const down=(actor?.damage||[]).filter(card=>card?.faceDown),need=Math.min(1,down.length),ids=selection.damageUids??[];if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.length!==need||ids.some(uid=>!down.some(card=>card.uid===uid)))return{ok:false,reason:"invalid-counter-charge-selection"}}
    }
    if(selection.chargeChoice!=null&&(!gGuardianStep||!["counter-charge","soul-charge"].includes(selection.chargeChoice)))return{ok:false,reason:"invalid-charge-choice"};
    if(selection.damageUids!==undefined&&(!Array.isArray(selection.damageUids)||selection.damageUids.some(uid=>typeof uid!=="string"||!uid||uid.length>180)||new Set(selection.damageUids).size!==selection.damageUids.length))return{ok:false,reason:"invalid-ability-selection"};
    if(selection.optionalNoTarget!==undefined&&typeof selection.optionalNoTarget!=="boolean")return{ok:false,reason:"invalid-ability-selection"};
    return { ok: true };
  }
  /** Promote only a pending ability controlled by the local player. Sides are remapped
   * between host and guest snapshots, so player identity is the authorization key. */
  function promotePendingAbilityForPlayer(state, playerId, localSide = "human") {
    if (!state || !playerId) return null;
    const queue = state.pendingAbilities ||= [];
    const current = state.pendingAbility;
    const candidates=[current,...queue].filter(item=>item?.ability?.kind==="AUTO");
    const turnPlayerId=candidates.map(item=>item.eventContext?.turnPlayerId).find(Boolean)||state.players?.[state.side]?.playerId||null;
    if(turnPlayerId&&playerId!==turnPlayerId&&(state.pendingAbilityPriorityPlayerId===turnPlayerId||candidates.some(item=>(item.triggerControllerPlayerId||item.instance?.controllerPlayerId)===turnPlayerId)))return null;
    if (current?.side === localSide && (current.triggerControllerPlayerId || current.instance?.controllerPlayerId) === playerId) return current;
    if (current) {
      const duplicate = queue.some(item => item.side === current.side && item.instance?.uid === current.instance?.uid && item.ability?.id === current.ability?.id);
      if (!duplicate) queue.unshift(current);
      state.pendingAbility = null;
    }
    const index = queue.findIndex(item => item?.side === localSide && (item.triggerControllerPlayerId || item.instance?.controllerPlayerId) === playerId);
    if (index < 0) return null;
    state.pendingAbility = queue.splice(index, 1)[0];
    return state.pendingAbility;
  }
  /** Return only AUTO abilities that became standby for the same exact event and controller. */
  function simultaneousAbilityGroup(state, pending) {
    const eventId = pending?.eventContext?.eventId, windowId=pending?.eventContext?.simultaneousWindowId, controllerId = pending?.triggerControllerPlayerId || pending?.instance?.controllerPlayerId;
    if ((!eventId && !windowId) || !controllerId) return [pending].filter(Boolean);
    const candidates = [state?.pendingAbility, ...(state?.pendingAbilities || [])].filter(Boolean);
    const group = candidates.filter(item => item.ability?.kind === "AUTO" && (windowId ? item.eventContext?.simultaneousWindowId === windowId : item.eventContext?.eventId === eventId) && (item.triggerControllerPlayerId || item.instance?.controllerPlayerId) === controllerId);
    return group.includes(pending) ? group : [pending];
  }
  /** Project private ability decisions only to the player entitled to make them. */
  function projectPendingAbilitiesForSide(state, side) {
    const candidates=[state?.pendingAbility,...(state?.pendingAbilities||[])].filter(item=>item?.ability?.kind==="AUTO");
    const turnPlayerId=candidates.map(item=>item.eventContext?.turnPlayerId).find(Boolean)||state?.players?.[state?.side]?.playerId||null;
    const turnPlayerHasPending=Boolean(turnPlayerId&&candidates.some(item=>(item.triggerControllerPlayerId||item.instance?.controllerPlayerId)===turnPlayerId));
    const localPlayerId=state?.players?.[side]?.playerId||null,isOwnedByLocalPlayer=item=>item?.side===side&&(!localPlayerId||(item.triggerControllerPlayerId||item.instance?.controllerPlayerId)===localPlayerId);
    return { pendingAbility: isOwnedByLocalPlayer(state?.pendingAbility) ? state.pendingAbility : null, pendingAbilities: (state?.pendingAbilities || []).filter(isOwnedByLocalPlayer), ...(turnPlayerHasPending?{pendingAbilityPriorityPlayerId:turnPlayerId}:{}) };
  }
  function registerCardAbilityKeywordIndex(entries) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new TypeError("Card keyword index must be a card-ID map.");
    const staged = [];
    for (const [cardId, keywords] of Object.entries(entries)) {
      if (!cardId || !Array.isArray(keywords) || keywords.length > 64 || keywords.some(keyword => typeof keyword !== "string" || !keyword.trim() || keyword.length > 64)) throw new TypeError(`Invalid keyword metadata for card ${cardId}.`);
      staged.push([String(cardId), [...new Set(keywords.map(keyword => keyword.trim().toLowerCase()))].sort()]);
    }
    for (const [cardId, keywords] of staged) {
      const current = cardAbilityKeywordIndex.get(cardId);
      if (current && JSON.stringify(current) !== JSON.stringify(keywords)) throw new Error(`Conflicting card keyword metadata for ${cardId}.`);
    }
    for (const [cardId, keywords] of staged) cardAbilityKeywordIndex.set(cardId, keywords);
    return { cards: staged.length, keywords: staged.reduce((count, [, values]) => count + values.length, 0) };
  }
  function getCardAbilityKeywords(cardOrId) {
    const cardId = typeof cardOrId === "string" || typeof cardOrId === "number" ? String(cardOrId) : String(cardOrId?.id || cardOrId?.cardId || "");
    const keywords = new Set(cardAbilityKeywordIndex.get(cardId) || []);
    if (Array.isArray(cardOrId?.abilityKeywords)) for (const keyword of cardOrId.abilityKeywords) if (typeof keyword === "string" && keyword.trim()) keywords.add(keyword.trim().toLowerCase());
    if (cardOrId && typeof cardOrId === "object" && typeof cardOrId.text === "string") {
      const cardText = cardOrId.text.toLowerCase();
      for (const keyword of searchableAbilityKeywords) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b\\s*(?:[-–—]\\s*(?:AUTO|ACT|CONT|\\d+(?:st|nd|rd|th)\\s+time\\s+only)|[:(])`, "i").test(cardText)) keywords.add(keyword);
      }
      for (const ability of parseCardAbilities(cardOrId)) {
        for (const value of ability.definition?.keywords || []) {
          const keyword = typeof value === "string" ? value : value?.name;
          if (typeof keyword === "string" && keyword.trim()) keywords.add(keyword.trim().toLowerCase());
        }
        const body = String(ability.raw || "").replace(/^\s*\[[^\]]+\]\s*:\s*/, "").replace(/^\s*(?:AUTO|ACT|CONT)\s*:\s*/i, "").trim().toLowerCase();
        for (const keyword of searchableAbilityKeywords) if (body.startsWith(keyword) && (!body[keyword.length] || /[\s.(\d]/.test(body[keyword.length]))) keywords.add(keyword);
      }
    }
    return [...keywords].sort();
  }
  let abilityKeywordCache = new WeakMap();
  function hasAbilityKeyword(cardOrAbilities, keyword) {
    const expected=String(keyword||"").trim().toLowerCase();if(!expected)return false;
    if (typeof cardOrAbilities === "string" || typeof cardOrAbilities === "number") return (cardAbilityKeywordIndex.get(String(cardOrAbilities)) || []).includes(expected);
    if(!Array.isArray(cardOrAbilities)&&cardOrAbilities&&typeof cardOrAbilities==="object"){if(getCardAbilityKeywords(cardOrAbilities).includes(expected))return true;let cached=abilityKeywordCache.get(cardOrAbilities);if(!cached){cached=new Map();abilityKeywordCache.set(cardOrAbilities,cached)}if(cached.has(expected))return cached.get(expected);const result=parseCardAbilities(cardOrAbilities).some(ability=>(ability.definition?.keywords||[]).some(value=>String(typeof value==="string"?value:value?.name||"").trim().toLowerCase()===expected));cached.set(expected,result);return result}
    return Array.isArray(cardOrAbilities)&&cardOrAbilities.some(ability=>(ability.definition?.keywords||[]).some(value=>String(typeof value==="string"?value:value?.name||"").trim().toLowerCase()===expected));
  }
  function rideCandidateDefinitions(cardOrAbilities){const parsed=Array.isArray(cardOrAbilities)?cardOrAbilities:parseCardAbilities(cardOrAbilities),definitions=parsed.map(ability=>ability.definition).filter(Boolean),cardId=String(cardOrAbilities?.id||cardOrAbilities?.cardId||"");if(cardId)definitions.push(...getReviewedAbilityDefinitionsForCard(cardId));return definitions}
  function canRideCard(cardOrAbilities,context={}){const currentVanguard=context.vanguardCard,definitions=rideCandidateDefinitions(cardOrAbilities);if(hasAbilityKeyword(cardOrAbilities,"cannot-be-ridden")||definitions.some(definition=>(definition.keywords||[]).includes("cannot-be-ridden")))return false;for(const restriction of definitions.flatMap(definition=>definition.continuousRestrictions||[])){if(restriction.type==="ride-from-grade-and-name"){if(!currentVanguard||Number(currentVanguard.grade)!==Number(restriction.grade)||!cardHasName(currentVanguard,restriction.name,{contains:true,location:"vanguard"}))return false}}const activeRestriction=(context.crests||[]).some(card=>parseCardAbilities(card).some(ability=>ability.kind==="CONT"&&ability.definition?.continuousRestrictions?.some(restriction=>restriction.type==="ride-same-name-as-vanguard")));return !activeRestriction||cardsShareName(context.vanguardCard,cardOrAbilities,{leftLocation:"vanguard",rightLocation:"hand"})}
  function canCallCard(cardOrAbilities,context={}){const definitions=rideCandidateDefinitions(cardOrAbilities);for(const restriction of definitions.flatMap(definition=>definition.continuousRestrictions||[])){if(restriction.type==="normal-call-requires-dragontree-marker"&&(!Number.isInteger(Number(context.dragontreeMarkerCount))||Number(context.dragontreeMarkerCount)<1))return false}return true}
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
    if (subject === "source") return event.sourceCardInstanceId === abilitySourceInstanceId || (event.type === "unit.attacked" && (event.attackingCardInstanceIds || []).includes(abilitySourceInstanceId));
    if (subject === "event-subject") return event.subjectCardInstanceId === abilitySourceInstanceId;
    if (subject === "event-target") return (event.targetCardInstanceIds || []).includes(abilitySourceInstanceId);
    if (subject === "ridden-unit") return event.subjectCardInstanceId === abilitySourceInstanceId || (event.targetCardInstanceIds || []).includes(abilitySourceInstanceId);
    if (subject === "booster") return event.boosterCardInstanceId === abilitySourceInstanceId;
    if (subject === "boosted-unit") return event.boostedCardInstanceId === abilitySourceInstanceId;
    if (subject === "any") return true;
    return false;
  }
  return Object.freeze({ createCardInstance, recordFightRide, recordOpponentTriggerCheck, clearOpponentTriggerFacts, locateCardInstance, countGenerationBreakUnits, parseCardAbilities, parseCardAbilitiesCached, getCardNames, cardHasName, cardsShareName, cardHasAbilityKeyword, parseAbilityCosts, parseAbilityConditions, evaluateAbilityConditions, canPayAbilityCosts, evaluateAutoCostPayment, registerAbilityDefinitions, getReviewedAbilityDefinitionsForCard, registerCardAbilityKeywordIndex, getCardAbilityKeywords, compileVanguardTopFiveKeywordSearchDefinition, compileAutoVanguardPlacementTopSevenTwoNameSearchDefinition, compileActRcSoulBlastThreeDrawDefinition, compileAutoRcPlacementChooseFriendlyPowerDefinition, compileRearGuardVanguardAttackSacrificeDrawPowerDefinition, EFFECT_HANDLERS, validateEffectProgram, resolveEffectProgram, evaluateContinuousEffects, evaluateContinuousRestrictions, evaluateContinuousShieldEffects, evaluateStrideCostGrade, evaluateContinuousGrade, expireTurnModifiers, compileAutoTrigger, isManuallyActivatable, autoAbilityReadiness, canActivateManualAbility, abilityUsageKey, validateAbilityChoices, canDeclineAbility, matchesTargetFilter, eventMatchesAbilityTrigger, GAME_EVENT_TYPES, createGameEvent, createRideGameEvent, claimGameEvent, claimAbilityTrigger, validateRemoteRequest, validateRemoteActionRequest, canResolveAbilitySource, abilitySourceZoneAtResolution, payAbilityCosts, validateAbilityDecision, promotePendingAbilityForPlayer, simultaneousAbilityGroup, projectPendingAbilitiesForSide, claimRemoteRequest, eventSubjectMatches, recordAttackCount, getAttackCount, getPlayerAttackCount, retireHollowedUnitsAtTurnEnd, retireChargingUnitsAtBattleEnd, hasLegalAbilityTargets, hasAbilityKeyword, canRideCard, canCallCard, createHarmonyAssociation, isCardInHarmony, expireHarmonyAssociations, removeHarmonyAssociationsForInstance, prunePendingAbilitiesWithConsumedUsage });
});
