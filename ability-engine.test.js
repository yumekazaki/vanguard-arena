const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const curatedDefinitions = require("./ability-definitions.js");
const VanguardAbilityEngine = require("./ability-engine.js");
const { createCardInstance, recordFightRide, recordOpponentTriggerCheck, clearOpponentTriggerFacts, locateCardInstance, canResolveAbilitySource, abilitySourceZoneAtResolution, canActivateManualAbility, autoAbilityReadiness, abilityUsageKey, validateAbilityChoices, evaluateContinuousEffects, evaluateContinuousRestrictions, evaluateContinuousShieldEffects, evaluateStrideCostGrade, expireTurnModifiers, parseCardAbilities, getCardNames, cardHasName, cardsShareName, cardHasAbilityKeyword, createGameEvent, claimGameEvent, claimAbilityTrigger, eventSubjectMatches, isManuallyActivatable, eventMatchesAbilityTrigger, canPayAbilityCosts, evaluateAutoCostPayment, evaluateAbilityConditions, validateRemoteRequest, validateRemoteActionRequest, validateAbilityDecision, payAbilityCosts, promotePendingAbilityForPlayer, simultaneousAbilityGroup, projectPendingAbilitiesForSide, matchesTargetFilter, claimRemoteRequest, GAME_EVENT_TYPES, registerAbilityDefinitions, canDeclineAbility, validateEffectProgram, resolveEffectProgram, EFFECT_HANDLERS, hasLegalAbilityTargets, hasAbilityKeyword, canRideCard, createHarmonyAssociation, isCardInHarmony, expireHarmonyAssociations, removeHarmonyAssociationsForInstance } = require("./ability-engine.js");
registerAbilityDefinitions(curatedDefinitions);
test("Perfect Raizer continuous field restriction is per instance and only applies to its own source",()=>{
 const ability=parseCardAbilities({id:"cfa-165",text:"CONT [VC/RC]: If you do not have another card with \"Raizer\" in its card name on your VC or RC, this unit gets power -2000."})[0];
 assert.equal(ability.definition?.effects?.[0]?.op,"continuous-power-adjustment");
 const base={location:"vanguard",sourceInstanceId:"perfect-raizer-1",targetInstanceId:"perfect-raizer-1",controllerFieldCards:[{uid:"perfect-raizer-1",names:["Perfect Raizer"]}]};
 assert.equal(evaluateContinuousEffects([ability],base).power,-2000);
 assert.equal(evaluateContinuousEffects([ability],{...base,controllerFieldCards:[...base.controllerFieldCards,{uid:"raizer-other",names:["Raizer Unit"]}]}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{...base,controllerFieldCards:[...base.controllerFieldCards,{uid:"other",names:["Other Unit"]}]}).power,-2000);
 assert.equal(evaluateContinuousEffects([ability],{...base,location:"rear-guard"}).power,-2000);
 assert.equal(evaluateContinuousEffects([ability],{...base,location:"guardian"}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{...base,targetInstanceId:"different-unit"}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{location:"vanguard",sourceInstanceId:"perfect-raizer-1",targetInstanceId:"perfect-raizer-1"}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{location:"vanguard",controllerFieldCards:base.controllerFieldCards}).power,0);
});
test("boosted Vanguard-name CONT power applies only to its exact booster during that battle",()=>{
 const text='CONT [RC]: During the battle this unit boosted, if you have a grade 3 or greater vanguard with "Welstra" in its card name, this unit gets power +5000.',ability=parseCardAbilities({id:"boosted-named-vanguard-cont",text})[0];
 assert.equal(ability.kind,"CONT");assert.equal(ability.definition?.source?.patternId,"cont-rc-boosted-named-grade-vanguard-power-battle-v1");assert.deepEqual(ability.requiredLocation,["rear-guard"]);
 const base={location:"rear-guard",sourceInstanceId:"booster-a",targetInstanceId:"booster-a",sourceWasBooster:true,controllerVanguardGrade:3,controllerVanguardCardNames:["Welstra"]};
 assert.equal(evaluateContinuousEffects([ability],base).power,5000);
 assert.equal(evaluateContinuousEffects([ability],{...base,sourceWasBooster:false}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{...base,controllerVanguardGrade:2}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{...base,controllerVanguardCardNames:["Rezael"]}).power,0);
 assert.equal(evaluateContinuousEffects([ability],{...base,location:"vanguard"}).power,0);
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),matches=[];for(const card of loadCatalog())for(const item of parseCardAbilities(card))if(item.definition?.source?.patternId==="cont-rc-boosted-named-grade-vanguard-power-battle-v1")matches.push(item);assert.equal(matches.length,13);assert.ok(matches.every(item=>VanguardAbilityEngine.getReviewedAbilityDefinitionsForCard(item.cardId).some(definition=>definition.id===item.id)));
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("boosterCardInstanceId:uid,boostedUnitInstanceId:setup.attackerUid"));assert.ok(app.includes("boosterCardInstanceId:booster.unit.uid,boostedUnitInstanceId:uid"));
});
test("immutable card-parse snapshots are reused and invalidated when reviewed definitions change",()=>{
 const card={id:"immutable-parse-cache-fixture",text:"AUTO [RC]: When this unit attacks, draw a card."};
 const first=VanguardAbilityEngine.parseCardAbilitiesCached(card);assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(first[0]),true);assert.equal(VanguardAbilityEngine.parseCardAbilitiesCached(card),first);first[0].raw="changed";assert.notEqual(first[0].raw,"changed");
 registerAbilityDefinitions([{id:"immutable-parse-cache-fixture:0",cardId:card.id,kind:"AUTO",printedText:card.text,source:{dataset:"regression",review:"cache revision"},effects:[{op:"draw",count:1}]}]);
 const refreshed=VanguardAbilityEngine.parseCardAbilitiesCached(card);assert.notEqual(refreshed,first);assert.equal(refreshed[0].definition?.id,"immutable-parse-cache-fixture:0");
});
test("Great Daiyusha's reviewed Limit Break grants power and critical only on its Vanguard under every printed condition",()=>{
 const card=require("./scripts/audit-ability-catalog.js").loadCatalog().find(item=>item.id==="cfa-264"),ability=parseCardAbilities(card)[0];
 assert.equal(ability.definition?.source?.patternId,"cont-great-daiyusha-limit-break-critical-v1");
 const base={location:"vanguard",isControllerTurn:true,controllerDamageCount:4,soulCardNames:["Dimensional Robo, Dailander","Dimensional Robo, Daibattles","Dimensional Robo, Dailady"]};
 assert.deepEqual(evaluateContinuousEffects([ability],base),{power:2000,critical:1,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,location:"rear-guard"}),{power:0,critical:0,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,controllerDamageCount:3}),{power:0,critical:0,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,isControllerTurn:false}),{power:0,critical:0,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,soulCardNames:base.soulCardNames.slice(0,2)}),{power:0,critical:0,drive:0});
});
test("the scalable VC Soul-name threshold compiler handles Perfect Raizer critical at the exact four-card boundary",()=>{
 const card=require("./scripts/audit-ability-catalog.js").loadCatalog().find(item=>item.id==="cfa-165"),ability=parseCardAbilities(card)[2];
 assert.equal(ability.definition?.source?.patternId,"cont-vanguard-soul-name-threshold-critical-v1");assert.equal(ability.conditionStatus,"modeled");
 const base={location:"vanguard",isControllerTurn:true,soulCardNames:["Perfect Raizer","Raizer Custom","Raizer Custom","Raizer Custom"]};
 assert.deepEqual(evaluateContinuousEffects([ability],base),{power:0,critical:1,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,soulCardNames:base.soulCardNames.slice(0,3)}),{power:0,critical:0,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,isControllerTurn:false}),{power:0,critical:0,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,location:"rear-guard"}),{power:0,critical:0,drive:0});
 assert.deepEqual(evaluateContinuousEffects([ability],{...base,soulCardNames:["Perfect Raizer","Other Unit","Other Unit","Other Unit"]}),{power:0,critical:0,drive:0});
});
test("shared Soul-count CONT power handler preserves card-name filters, circles, turn requirements, and per-card amounts",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),catalog=loadCatalog(),byId=id=>catalog.find(card=>card.id===id),get=(id,index)=>parseCardAbilities(byId(id))[index],soul=["Raizer Custom","Raizer Custom","Raizer Unit","Other"],raizer=get("cfa-165",1),allDuring=get("cfa-6042",0),allAlways=get("cfa-6820",0),baro=get("cfa-13064",0);
 for(const ability of [raizer,allDuring,allAlways,baro])assert.equal(ability.definition?.source?.patternId,"cont-soul-card-count-power-v1");
 assert.equal(evaluateContinuousEffects([raizer],{location:"vanguard",isControllerTurn:true,soulCardNames:soul}).power,9000);
 assert.equal(evaluateContinuousEffects([raizer],{location:"rear-guard",isControllerTurn:true,soulCardNames:soul}).power,0);
 assert.equal(evaluateContinuousEffects([allDuring],{location:"rear-guard",isControllerTurn:true,soulCardNames:soul}).power,12000);
 assert.equal(evaluateContinuousEffects([allDuring],{location:"vanguard",isControllerTurn:false,soulCardNames:soul}).power,0);
 assert.equal(evaluateContinuousEffects([allAlways],{location:"rear-guard",isControllerTurn:false,soulCardNames:soul}).power,4000);
 assert.equal(evaluateContinuousEffects([baro],{location:"vanguard",isControllerTurn:true,soulCardNames:["Baromagnes","Baromagnes","Other"]}).power,10000);
 assert.equal(evaluateContinuousEffects([baro],{location:"rear-guard",isControllerTurn:true,soulCardNames:["Baromagnes","Baromagnes"]}).power,0);
});
test("creates distinct card copies with owner and initial controller identity", () => {
  const first = createCardInstance("card-1", "player-a", "copy-a");
  const second = createCardInstance("card-1", "player-a", "copy-b");
  assert.equal(first.uid, "copy-a");
  assert.equal(first.ownerPlayerId, "player-a");
  assert.equal(first.controllerPlayerId, "player-a");
  assert.notEqual(first.uid, second.uid);
  assert.throws(() => createCardInstance("card-1", null), /owner player ID/);
});

test("fight ride fact is monotonic and records only Grade 3 or greater rides",()=>{
 const player={rodeGradeThreePlusThisFight:false};assert.equal(recordFightRide(player,{grade:2}),false);assert.equal(player.rodeGradeThreePlusThisFight,false);assert.equal(recordFightRide(player,{grade:3}),true);assert.equal(player.rodeGradeThreePlusThisFight,true);assert.equal(recordFightRide(player,{grade:4}),true);assert.equal(player.rodeGradeThreePlusThisFight,true);assert.equal(recordFightRide(player,{grade:null}),false);assert.equal(player.rodeGradeThreePlusThisFight,true);
});

test("fight ride eligibility fails closed until the player has not ridden Grade 3+",()=>{
 const ability={gb:0,conditionStatus:"modeled",conditions:[{type:"controller-has-not-ridden-grade-three-plus-this-fight"}]};assert.equal(evaluateAbilityConditions(ability,{rodeGradeThreePlusThisFight:false}),true);assert.equal(evaluateAbilityConditions(ability,{rodeGradeThreePlusThisFight:true}),false);assert.equal(evaluateAbilityConditions(ability,{}),false);
});
test("opponent trigger checks activate dual-circle power and shield continuously only for the opponent and expire at turn end",()=>{
 const ability=parseCardAbilities(require("./scripts/audit-ability-catalog.js").loadCatalog().find(card=>card.id==="cfa-10888"))[0];assert.equal(ability.definition?.source?.patternId,"cont-rc-gc-opponent-check-trigger-power-shield-v1");const players={host:{playerId:"host",opponentTriggerRevealedThisTurn:false},guest:{playerId:"guest",opponentTriggerRevealedThisTurn:false}};assert.equal(recordOpponentTriggerCheck(players,"host","critical","drive"),true);assert.equal(players.host.opponentTriggerRevealedThisTurn,false);assert.equal(players.guest.opponentTriggerRevealedThisTurn,true);assert.equal(recordOpponentTriggerCheck(players,"host","heal","trigger"),false);assert.equal(recordOpponentTriggerCheck(players,"unknown","heal","damage"),false);
 const powers=abilities=>evaluateContinuousEffects(abilities,{location:"rear-guard",opponentTriggerRevealedThisTurn:true});assert.equal(powers([ability]).power,10000);assert.equal(evaluateContinuousEffects([ability],{location:"rear-guard",opponentTriggerRevealedThisTurn:false}).power,0);assert.equal(evaluateContinuousEffects([ability],{location:"vanguard",opponentTriggerRevealedThisTurn:true}).power,0);assert.equal(evaluateContinuousShieldEffects([ability],{location:"guardian",opponentTriggerRevealedThisTurn:true}).shield,10000);assert.equal(evaluateContinuousShieldEffects([ability],{location:"guardian",opponentTriggerRevealedThisTurn:false}).shield,0);assert.equal(evaluateContinuousShieldEffects([ability],{location:"rear-guard",opponentTriggerRevealedThisTurn:true}).shield,0);assert.equal(clearOpponentTriggerFacts(players),true);assert.equal(players.guest.opponentTriggerRevealedThisTurn,false);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes('recordOpponentCheckTrigger(driveSide,top,"drive")'));assert.ok(app.includes('recordOpponentCheckTrigger(side,top,"damage")'));assert.ok(app.includes('recordOpponentCheckTrigger("human",top,checkName)'));assert.ok(app.includes("clearOpponentTriggerFacts(match.players)"));assert.ok(app.includes("opponentTriggerRevealedThisTurn:player?.opponentTriggerRevealedThisTurn===true"));
});
test("continuous condition trees apply either true OR branch and keep dual-circle power and shield separate",()=>{
 const ability=parseCardAbilities(require("./scripts/audit-ability-catalog.js").loadCatalog().find(card=>card.id==="cfa-12787"))[0],effects=ability.definition.effects;assert.equal(ability.conditionStatus,"no-explicit-condition-detected");const copy={...ability.definition,id:"condition-tree-review",cardId:"condition-tree-card"};assert.doesNotThrow(()=>registerAbilityDefinitions([copy]));const evaluate=(controllerGrade,opponentGrade,damage)=>({location:"rear-guard",controllerVanguardGrade:controllerGrade,opponentVanguardGrade:opponentGrade,controllerDamageCount:damage});assert.equal(evaluateContinuousEffects([ability],evaluate(2,3,0)).power,5000);assert.equal(evaluateContinuousEffects([ability],evaluate(3,3,3)).power,0);assert.equal(evaluateContinuousEffects([ability],evaluate(3,3,4)).power,5000);assert.equal(evaluateContinuousEffects([ability],{...evaluate(2,3,4),location:"vanguard"}).power,0);assert.equal(evaluateContinuousShieldEffects([ability],{...evaluate(2,3,0),location:"guardian"}).shield,5000);assert.equal(evaluateContinuousShieldEffects([ability],{...evaluate(3,3,4),location:"guardian"}).shield,5000);assert.equal(evaluateContinuousShieldEffects([ability],{...evaluate(3,3,3),location:"guardian"}).shield,0);assert.equal(evaluateContinuousShieldEffects([ability],{...evaluate(2,3,4),location:"rear-guard"}).shield,0);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("controllerDamageCount:(player.damage||[]).length"));assert.ok(app.includes("controllerDamageCount:(player?.damage||[]).length"));
});
test("all catalog G-Guardian grade-three replacement AUTO abilities require the exact hand-to-GC source and expose both validated choices",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),matches=[];for(const card of loadCatalog())for(const ability of parseCardAbilities(card))if(ability.definition?.source?.patternId==="auto-gc-no-grade-three-ride-choice-v1")matches.push({card,ability});assert.equal(matches.length,27);
 for(const {ability} of matches){assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"hand");assert.equal(ability.conditionStatus,"modeled");assert.equal(ability.choiceStatus,"modeled");assert.equal(evaluateAbilityConditions(ability,{rodeGradeThreePlusThisFight:false}),true);assert.equal(evaluateAbilityConditions(ability,{rodeGradeThreePlusThisFight:true}),false)}
 const ability=matches[0].ability,entry=createGameEvent({matchId:"g-guard-grade-choice"},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p2",sourceCardInstanceId:"guard-copy",sourceControllerPlayerId:"p1",subjectCardInstanceId:"guard-copy",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"guardian",battleId:"battle-1"});assert.equal(eventMatchesAbilityTrigger(ability,"place",entry,"guard-copy","guardian","guardian","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",entry,"other-copy","guardian","guardian","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...entry,currentLocation:"rear-left"},"guard-copy","rear-left","rear-left","p1"),false);
 const vanguard={uid:"p1-vg",controllerPlayerId:"p1"},enemy={uid:"p2-unit",controllerPlayerId:"p2"},attack={battleId:"battle-1",defenderSide:"human",attackerUid:"p2-unit",critical:3,power:10000},match={pendingAttack:attack},base={match,side:"human",source:{uid:"guard-copy"},sourceInPlay:true,battleId:"battle-1",targetInPlay:true,target:vanguard,targetCard:{type:"Unit"},targetZone:"vanguard",targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",opponentPlayerId:"p2"};let resolved=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...base,effectChoice:"vanguard-power"});assert.equal(resolved.ok,true);assert.equal(vanguard.turnPowerBoost,10000);assert.equal(vanguard.turnPowerExpiry,"human");resolved=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...base,effectChoice:"opponent-critical",target:enemy,targetCard:{type:"Unit"},targetZone:"rear-left",targetControllerPlayerId:"p2"});assert.equal(resolved.ok,true);assert.equal(attack.critical,1);assert.equal(enemy.battleCriticalBoost,-2);assert.equal(enemy.battleCriticalExpiryBattleId,"battle-1");const wrong=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...base,effectChoice:"opponent-critical",target:vanguard,targetCard:{type:"Unit"},targetZone:"vanguard",targetControllerPlayerId:"p1"});assert.equal(wrong.ok,false);
 const source={uid:"guard-copy",cardId:ability.cardId,ownerPlayerId:"p1",controllerPlayerId:"p1"},state={matchId:"online-guard",stateVersion:9,players:{human:{playerId:"p1",guardCircle:[source],vanguard:{uid:"p1-vg",cardId:"vg",controllerPlayerId:"p1"},rear:[]},bot:{playerId:"p2",guardCircle:[],vanguard:{uid:"p2-vg",cardId:"vg",controllerPlayerId:"p2"},rear:[{uid:"p2-unit",cardId:"unit",controllerPlayerId:"p2"}]}}},pending={instance:source,ability,triggerControllerPlayerId:"p1"},request={type:"ability-response",actionId:"decision-1",matchId:"online-guard",actorPlayerId:"p1",expectedStateVersion:9,accept:true,selection:{instanceUid:"guard-copy",abilityId:ability.id,costSelections:{cb:[],sb:[],discard:[],reveal:[]},effectChoice:"vanguard-power",targetUid:"p1-vg"}};assert.equal(validateAbilityDecision(state,request,"p1",pending).ok,true);assert.equal(validateAbilityDecision(state,{...request,actorPlayerId:"p2"},"p1",pending).reason,"wrong-actor");assert.equal(validateAbilityDecision(state,{...request,selection:{...request.selection,effectChoice:"opponent-critical",targetUid:"p1-vg"}},"p1",pending).reason,"invalid-ability-target");assert.equal(validateAbilityDecision(state,{...request,selection:{...request.selection,effectChoice:"opponent-critical",targetUid:"p2-unit"}},"p1",pending).ok,true);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("renderGuardianReplacementChoice(x)"));assert.ok(app.includes("data-ability-choice="));assert.ok(app.includes("effectChoice:pending.effectChoice||null"));assert.ok(app.includes("pending.effectChoice=selection.effectChoice||null"));assert.ok(app.includes("rodeGradeThreePlusThisFight:player.rodeGradeThreePlusThisFight===true"));
});
test("named-drop Guardian AUTO protects only the attacked Vanguard, then Counter-Charges only when its named Drop condition is true",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),records=[];for(const card of loadCatalog())for(const ability of parseCardAbilities(card))if(ability.definition?.source?.patternId==="auto-gc-protect-attacked-vanguard-named-drop-counter-charge-v1")records.push({card,ability});assert.equal(records.length,24);
 for(const {ability} of records){assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"hand");assert.deepEqual(ability.conditions,[]);assert.equal(ability.conditionStatus,"modeled");assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.costs.reduce((n,c)=>n+c.count,0),1)}
 const ability=records[0].ability,source={uid:"guard",controllerPlayerId:"p1"},vanguard={uid:"vg",controllerPlayerId:"p1"},damage={uid:"damage",faceDown:true},dropCard={uid:"named",cardId:"named-definition"},definitions={"named-definition":{name:ability.definition.effects[1].condition.cardName}},attack={battleId:"battle",defenderSide:"human",targetUid:"vg",perfectGuard:false},context={source,sourceInPlay:true,sourceControllerPlayerId:"p1",side:"human",player:{playerId:"p1",drop:[],damage:[damage]},match:{pendingAttack:attack},battleId:"battle",target:vanguard,targetInPlay:true,targetControllerPlayerId:"p1",targetZone:"vanguard",targetCard:{type:"Unit"},opponentPlayerId:"p2",isBeingAttacked:true,cardDefinitionForInstance:card=>definitions[card.cardId]};
 let result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context);assert.equal(result.ok,true);assert.equal(attack.perfectGuard,true);assert.equal(damage.faceDown,true);attack.perfectGuard=false;context.player.drop.push(dropCard);result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context);assert.equal(result.ok,true);assert.equal(attack.perfectGuard,true);assert.equal(damage.faceDown,false);
 attack.perfectGuard=false;context.player.drop=[];context.isBeingAttacked=false;result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context);assert.equal(result.ok,false);assert.equal(attack.perfectGuard,false);
});
test("card instances preserve separate ownership, control, location, state, and usage records", () => {
  const state = { controllerPlayerId: "player-b", zone: "rear-left", circle: "rear-guard", position: "rest", faceUp: false, rested: true, modifiers: { power: 5000 }, statuses: ["locked"], abilityUses: { "skill-a": 4 } };
  const card = createCardInstance("card-1", "player-a", "controlled-copy", state);
  assert.equal(card.ownerPlayerId, "player-a");
  assert.equal(card.controllerPlayerId, "player-b");
  assert.equal(card.zone, "rear-left");
  assert.equal(card.circle, "rear-guard");
  assert.equal(card.position, "rest");
  assert.equal(card.faceUp, false);
  assert.equal(card.rested, true);
  assert.deepEqual(card.modifiers, { power: 5000 });
  assert.deepEqual(card.statuses, ["locked"]);
  assert.deepEqual(card.abilityUses, { "skill-a": 4 });
  state.statuses.push("mutated");
  state.modifiers.power = 9000;
  assert.deepEqual(card.statuses, ["locked"]);
  assert.deepEqual(card.modifiers, { power: 5000 });
});

test("Order Zone placement AUTO draws only when its exact source enters the Order Zone",()=>{
 const ability=parseCardAbilities({id:"order-zone-draw",text:"AUTO: When this card is put into the Order Zone, draw a card."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-order-zone-placement-draw-v1");
 assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["order"]);
 const event=createGameEvent({matchId:"order-placement"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"order-a",subjectCardInstanceId:"order-a",previousLocation:"hand",currentLocation:"order"});
 assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"order-a","order","order","p1"),true);
 assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"order-b","order","order","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"rear-left"},"order-a","rear-left","rear-left","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:null},"order-a","order","order","p1"),false);
 const legacy=parseCardAbilities(require("./scripts/audit-ability-catalog.js").loadCatalog().find(card=>card.id==="cfa-10288"))[0];
 assert.equal(legacy.definition?.source?.patternId,"auto-order-zone-placement-draw-v1");assert.equal(legacy.trigger?.status,"recognized-trigger");
 assert.equal(eventMatchesAbilityTrigger(legacy,"place",event,"order-a","order","order","p1"),true);assert.equal(eventMatchesAbilityTrigger(legacy,"place",event,"order-b","order","order","p1"),false);
});

test("intercept shield AUTO matches the exact rear-guard entering GC and changes only that battle",()=>{
 const ability=parseCardAbilities({id:"intercept-shield",text:"AUTO: When this unit intercepts, this unit gets shield +5000 until end of that battle."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-intercept-shield-battle-v1");assert.equal(ability.trigger?.eventType,"card.placed");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.equal(ability.canDecline,false);
 const event=createGameEvent({matchId:"intercept-shield"},{type:"card.placed",actingPlayerId:"p2",sourceCardInstanceId:"guard-a",sourceControllerPlayerId:"p2",subjectCardInstanceId:"guard-a",previousLocation:"rear-left",currentLocation:"guardian",battleId:"battle-1"});
 assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"guard-a","guardian","guardian","p2"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"guard-b","guardian","guardian","p2"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,previousLocation:"hand"},"guard-a","guardian","guardian","p2"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"rear-right"},"guard-a","rear-guard","rear-guard","p2"),false);
 const source={uid:"guard-a",battleShieldBoost:0},player={guardCircle:[source]},match={pendingAttack:{defenderSide:"p2",battleId:"battle-1",guardCards:[source],targetPower:10000}};const context={source,player,side:"p2",match,battleId:"battle-1"};
 const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context);assert.equal(result.ok,true);assert.equal(source.battleShieldBoost,5000);assert.equal(source.battleShieldExpiryBattleId,"battle-1");assert.equal(match.pendingAttack.targetPower,15000);
 assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,battleId:"battle-2"}).ok,false);
});

test("Generation Break Intercept shield preserves its threshold and exact battle target",()=>{
 const ability=parseCardAbilities({id:"gb-intercept-shield",text:"AUTO Generation Break 1: When this unit intercepts, this unit gets shield +10000 until end of that battle."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-intercept-generation-break-shield-battle-v1");assert.equal(ability.gb,1);assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.sourceLocation,"rear-guard");assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:10000,duration:"battle"}]);
 const event=createGameEvent({matchId:"gb-intercept"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"guard",sourceControllerPlayerId:"p1",subjectCardInstanceId:"guard",previousLocation:"rear-left",currentLocation:"guardian",battleId:"battle-gb"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"guard","guardian","guardian","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,previousLocation:"hand"},"guard","guardian","guardian","p1"),false);
 const source={uid:"guard",battleShieldBoost:0},match={pendingAttack:{defenderSide:"p1",battleId:"battle-gb",guardCards:[source],targetPower:10000}},result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,player:{guardCircle:[source]},side:"p1",match,battleId:"battle-gb"});assert.equal(result.ok,true);assert.equal(source.battleShieldBoost,10000);assert.equal(match.pendingAttack.targetPower,20000);
});

test("Front-trigger critical AUTO matches only its controller's drive check once per turn",()=>{
 const ability=parseCardAbilities({id:"front-check-critical",text:"AUTO [VC/RC] 1/Turn: When your drive check reveals a front trigger, you may have this unit get critical +1 until end of turn."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-drive-check-front-trigger-critical-turn-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",revealedTrigger:"front"});assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);assert.equal(ability.once,true);assert.equal(ability.canDecline,true);assert.deepEqual(ability.effects,[{op:"modify-critical",target:"source",amount:1,duration:"turn"}]);
 const event=createGameEvent({matchId:"front-check"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"checked-front",checkedCardInstanceId:"checked-front",checkKind:"drive",revealedTrigger:"front",timingWindow:"drive-check"});const matches=(change={})=>eventMatchesAbilityTrigger(ability,"driveCheck",{...event,...change},"skill-copy","rear-left","rear-left","p1");
 assert.equal(matches(),true);assert.equal(matches({actingPlayerId:"p2"}),false);assert.equal(matches({checkKind:"damage"}),false);assert.equal(matches({revealedTrigger:"critical"}),false);assert.equal(matches({revealedTrigger:null}),false);assert.equal(matches({checkedCardInstanceId:null}),false);assert.equal(matches({subjectCardInstanceId:"different-card"}),false);
 const source={uid:"skill-copy",turnCriticalBoost:0},match={pendingAttack:{attackerUid:"attacker",critical:1}};const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,player:{},side:"p1",match});assert.equal(result.ok,true);assert.equal(source.turnCriticalBoost,1);assert.equal(source.turnCriticalExpiry,"p1");assert.equal(match.pendingAttack.critical,1);
});

test("human drive-check events carry the checking player and revealed trigger identity",()=>{
 const app=fs.readFileSync("app.js","utf8");assert.match(app,/queueAbilityPrompts\("driveCheck",driveSide,top\.uid,\{sourceCardInstanceId:attack\.attackerUid,actingPlayerId:player\.playerId,[^}]*checkKind:"drive"[^}]*revealedTrigger:triggerKind\(top\)/);assert.match(app,/checkedCardGrade:eventContext\.subjectInstance\?Number\(cardMap\.get\(eventContext\.subjectInstance\.cardId\)\?\.grade\?\?-1\):null/);assert.match(app,/checkedCardClans:eventContext\.subjectInstance\?cardMap\.get\(eventContext\.subjectInstance\.cardId\)\?\.clans\|\|\[\]:\[\]/);
});

test("Vanguard drive-check clan abilities match the checked card, exact source and grade",()=>{
 const ability=parseCardAbilities({id:"vanguard-clan-check",text:"AUTO [VC]: When this unit’s drive check reveals a grade 3 «Great Nature», this unit gets power +5000 until end of that battle."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-vanguard-drive-check-revealed-clan-power-battle-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"source",circles:[],checkKind:"drive",revealedGrade:3,revealedClan:"Great Nature"});assert.equal(ability.conditionStatus,"no-explicit-condition-detected");
 const event=createGameEvent({matchId:"vanguard-drive-clan"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"attacking-vg",sourceControllerPlayerId:"p1",subjectCardInstanceId:"checked-card",checkedCardInstanceId:"checked-card",checkedCardName:"Nature Unit",checkedCardGrade:3,checkedCardClan:"Great Nature",checkKind:"drive",checkIndex:1,battleId:"battle-1"});const matches=(change={})=>eventMatchesAbilityTrigger(ability,"driveCheck",{...event,...change},"attacking-vg","vanguard","vanguard","p1");
 assert.equal(matches(),true);assert.equal(matches({sourceCardInstanceId:"other-vg"}),false);assert.equal(matches({checkedCardGrade:2}),false);assert.equal(matches({checkedCardClan:"Kagero"}),false);assert.equal(matches({checkKind:"damage"}),false);assert.equal(matches({checkedCardGrade:null}),false);
 const source={uid:"attacking-vg",turnPowerBoost:0},match={pendingAttack:{attackerUid:source.uid,power:10000}};const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,player:{},side:"p1",match});assert.equal(result.ok,true);assert.equal(source.turnPowerBoost,0);assert.equal(match.pendingAttack.power,15000);
});

test("structured check events preserve checked card grade and clan metadata",()=>{
 const event=createGameEvent({matchId:"check-data"},{type:"drive.checked",actingPlayerId:"p1",checkedCardInstanceId:"copy-1",checkedCardName:"Test",checkedCardGrade:3,checkedCardClan:"Great Nature",checkedCardClans:["Great Nature"],checkedCardText:"Great Nature/High Beast",checkedCardTriggerType:"",checkKind:"drive"});assert.equal(event.checkedCardInstanceId,"copy-1");assert.equal(event.checkedCardGrade,3);assert.equal(event.checkedCardClan,"Great Nature");assert.deepEqual(event.checkedCardClans,["Great Nature"]);assert.equal(event.checkedCardText,"Great Nature/High Beast");assert.equal(event.checkedCardTriggerType,"");
});

test("normal-unit drive-check AUTO requires explicit normal-card metadata",()=>{
 const ability=parseCardAbilities({id:"normal-check-power",text:"AUTO [VC/RC]: When your drive check reveals a normal unit, this unit gets power +3000 until end of turn."})[0];assert.equal(ability.definition?.source?.patternId,"auto-drive-check-normal-unit-source-power-turn-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkedCardTriggerType:""});
 const event=createGameEvent({matchId:"normal-check"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"normal-card",checkedCardInstanceId:"normal-card",checkedCardTriggerType:"",checkKind:"drive"}),matches=(change={})=>eventMatchesAbilityTrigger(ability,"driveCheck",{...event,...change},"unit-copy","rear-left","rear-left","p1");assert.equal(matches(),true);assert.equal(matches({checkedCardTriggerType:"front"}),false);assert.equal(matches({checkedCardTriggerType:null}),false);assert.equal(matches({checkedCardInstanceId:null}),false);assert.equal(matches({actingPlayerId:"p2"}),false);
 const source={uid:"unit-copy",turnPowerBoost:0},match={};const applied=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,player:{},side:"p1",match});assert.equal(applied.ok,true);assert.equal(source.turnPowerBoost,3000);assert.equal(source.turnPowerExpiry,"p1");
 const app=fs.readFileSync("app.js","utf8");assert.match(app,/checkedCardTriggerType:eventContext\.subjectInstance&&typeof cardMap\.get\(eventContext\.subjectInstance\.cardId\)\?\.trigger==="string"\?cardMap\.get\(eventContext\.subjectInstance\.cardId\)\.trigger:null/);
});

test("Fetter Creator Van pays its exact optional source-to-Soul cost before drawing",()=>{
 const card=require("./scripts/audit-ability-catalog").loadCatalog().find(item=>item.id==="cfa-4080"),ability=parseCardAbilities(card).find(item=>item.printedText.includes("drive check reveals a normal unit"));assert.equal(ability.definition?.source?.patternId,"auto-rc-drive-check-normal-unit-source-soul-draw-v1");assert.equal(ability.gb,1);assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.choiceStatus,"modeled");assert.equal(ability.canDecline,true);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkedCardTriggerType:""});
 const source={uid:"fetter-copy",cardId:card.id,controllerPlayerId:"p1"},drawn={uid:"drawn-copy",cardId:"normal-card"},player={playerId:"p1",vanguard:null,rear:[source,null,null,null,null],damage:[],soul:[],hand:[],drop:[],deck:[drawn],usedAbilities:[]},events=[];const payment=payAbilityCosts(ability,{source,player,side:"p1",actorPlayerId:"p1",sourceZone:"rear-left",sourceInPlay:true,turnId:1,cardDefinitionForInstance:instance=>instance.uid===source.uid?card:{name:"Normal"},emitEvent:event=>events.push(event)},{});assert.equal(payment.ok,true);assert.equal(player.rear[0],null);assert.equal(player.soul[0],source);assert.equal(events[0].type,"card.moved");assert.equal(events[0].cardInstanceId,source.uid);
 const resolution=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,player,side:"p1",match:{},emitEvent:event=>events.push(event)});assert.equal(resolution.ok,true);assert.deepEqual(player.hand,[drawn]);assert.equal(events.some(event=>event.type==="card.drawn"&&event.cardInstanceId===drawn.uid),true);
 assert.deepEqual(evaluateAutoCostPayment(ability,{sourceCanMoveToSoul:false},false),{ok:true,payCost:false,applyEffects:false,reason:"cost-not-paid"});
});

test("Rear-Guard stand AUTO requires the controller's Vanguard drive check and matching grade clan",()=>{
 const ability=parseCardAbilities({id:"death-army-stand",text:"AUTO [RC]: When your vanguard drive check reveals a grade 3 «Nova Grappler», stand this unit."})[0];assert.equal(ability.definition?.source?.patternId,"auto-rc-vanguard-drive-check-grade-clan-stand-source-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"drive.checked",subject:"controller",circles:[],checkKind:"drive",checkSourceLocation:"vanguard",revealedGrade:3,revealedClan:"Nova Grappler"});assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.equal(ability.canDecline,false);
 const event=createGameEvent({matchId:"death-army"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"vanguard",subjectCardInstanceId:"revealed",checkedCardInstanceId:"revealed",checkedCardGrade:3,checkedCardClan:"Nova Grappler",checkKind:"drive",checkSourceLocation:"vanguard"});const matches=(change={})=>eventMatchesAbilityTrigger(ability,"driveCheck",{...event,...change},"death-army-copy","rear-left","rear-left","p1");assert.equal(matches(),true);assert.equal(matches({checkSourceLocation:"rear-left"}),false);assert.equal(matches({checkedCardGrade:2}),false);assert.equal(matches({checkedCardClan:"Kagero"}),false);assert.equal(matches({actingPlayerId:"p2"}),false);
 let emitted=0;const resting={uid:"death-army-copy",rested:true},match={};const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source:resting,sourceInPlay:true,sourceZone:"rear-left",side:"p1",match,emitEvent:()=>emitted++});assert.equal(result.ok,true);assert.equal(resting.rested,false);assert.equal(emitted,1);
 const alreadyStanding={uid:"standing-copy",rested:false},noop=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source:alreadyStanding,sourceInPlay:true,sourceZone:"rear-left",side:"p1",match:{},emitEvent:()=>emitted++});assert.equal(noop.ok,true);assert.equal(emitted,1);
});

test("practice and human drive checks include the attacker's circle",()=>{
 const app=fs.readFileSync("app.js","utf8");assert.match(app,/checkKind:"drive",checkSourceLocation:attack\.attackerZone/);assert.match(app,/checkKind:checkName,checkSourceLocation:match\.pendingAttack\?\.attackerZone\|\|null/);
});

test("clan-gated intercept shield checks the controller's current Vanguard clan before activation",()=>{
 const ability=parseCardAbilities({id:"clan-intercept-shield",text:"AUTO: When this unit intercepts, if you have a «Shadow Paladin» vanguard, this unit gets shield +5000 until end of that battle."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-intercept-clan-vanguard-shield-battle-v1");assert.deepEqual(ability.conditions,[{type:"controller-vanguard-has-clan",value:"Shadow Paladin"}]);assert.equal(ability.conditionStatus,"modeled");
 assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Shadow Paladin"}),true);assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Kagero"}),false);assert.equal(evaluateAbilityConditions(ability,{}),false);
 const event=createGameEvent({matchId:"clan-intercept"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"guard",sourceControllerPlayerId:"p1",subjectCardInstanceId:"guard",previousLocation:"rear-right",currentLocation:"guardian",battleId:"battle-3"});
 assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"guard","guardian","guardian","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,subjectCardInstanceId:"other"},"guard","guardian","guardian","p1"),false);
});

test("structured Intercept conditions enforce live zone counts, grades, lock state, and opponent state",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const cards=loadCatalog(),abilityFor=id=>parseCardAbilities(cards.find(card=>card.id===id))[0];
 const backRow=abilityFor("cfa-2840"),locked=abilityFor("cfa-5165"),soul=abilityFor("cfa-9585"),orders=abilityFor("cfa-9604"),oppGrade=abilityFor("cfa-9626"),damage=abilityFor("cfa-9738"),backGrade=abilityFor("cfa-10101"),damageAdvantage=abilityFor("cfa-10182"),opponentRear=abilityFor("cfa-8453");
 assert.equal(backRow.conditionStatus,"modeled");assert.equal(evaluateAbilityConditions(backRow,{controllerBackRowRearGuards:1}),true);assert.equal(evaluateAbilityConditions(backRow,{controllerBackRowRearGuards:2}),false);
 assert.equal(evaluateAbilityConditions(locked,{anyFieldCardIsLocked:true}),true);assert.equal(evaluateAbilityConditions(locked,{anyFieldCardIsLocked:false}),false);
 assert.equal(evaluateAbilityConditions(soul,{controllerSoulCount:4}),false);assert.equal(evaluateAbilityConditions(soul,{controllerSoulCount:5}),true);
 assert.equal(evaluateAbilityConditions(orders,{allOrderZonesCount:1}),false);assert.equal(evaluateAbilityConditions(orders,{allOrderZonesCount:2}),true);
 assert.equal(evaluateAbilityConditions(oppGrade,{opponentVanguardGrade:2}),false);assert.equal(evaluateAbilityConditions(oppGrade,{opponentVanguardGrade:3}),true);
 assert.equal(evaluateAbilityConditions(damage,{controllerDamageCount:2}),false);assert.equal(evaluateAbilityConditions(damage,{controllerDamageCount:3}),true);
 assert.equal(evaluateAbilityConditions(backGrade,{controllerBackRowGradeRearGuards:{1:1}}),false);assert.equal(evaluateAbilityConditions(backGrade,{controllerBackRowGradeRearGuards:{1:2}}),true);
 assert.equal(evaluateAbilityConditions(damageAdvantage,{controllerDamageCount:3,opponentDamageCount:3}),false);assert.equal(evaluateAbilityConditions(damageAdvantage,{controllerDamageCount:4,opponentDamageCount:3}),true);
 assert.equal(opponentRear.conditionStatus,"modeled");assert.equal(evaluateAbilityConditions(opponentRear,{opponentRearGuards:3}),false);assert.equal(evaluateAbilityConditions(opponentRear,{opponentRearGuards:2}),true);
 for(const ability of [backRow,locked,soul,orders,oppGrade,damage,backGrade,damageAdvantage,opponentRear])assert.equal(ability.definition?.source?.patternId,"auto-intercept-shield-structured-condition-battle-v1");
});

test("Vanguard-attacked Intercept AUTO requires the exact controller Vanguard as battle target",()=>{
 const ability=parseCardAbilities({id:"vanguard-attacked-intercept",text:"AUTO: When this unit intercepts during the battle that your vanguard was attacked, this unit gets shield +5000 until end of that battle."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-intercept-controller-vanguard-attacked-shield-battle-v1");assert.deepEqual(ability.conditions,[{type:"controller-vanguard-is-attacked-unit"}]);assert.equal(ability.conditionStatus,"modeled");
 assert.equal(evaluateAbilityConditions(ability,{controllerVanguardIsAttackedUnit:true}),true);assert.equal(evaluateAbilityConditions(ability,{controllerVanguardIsAttackedUnit:false}),false);assert.equal(evaluateAbilityConditions(ability,{}),false);
 const event=createGameEvent({matchId:"intercept-vanguard-target"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"guard",sourceControllerPlayerId:"p1",subjectCardInstanceId:"guard",previousLocation:"rear-left",currentLocation:"guardian",targetCardInstanceIds:["vg-p1"],targetLocation:"vanguard",battleId:"b1"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"guard","guardian","guardian","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"rear-right"},"guard","rear-guard","rear-guard","p1"),false);
});

test("application condition snapshots include both players and exact Rear-Guard row state",()=>{
 const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function abilityConditionContext("),end=app.indexOf("function abilityRequirementsMet(",start),source=app.slice(start,end);
 assert.match(source,/controllerBackRowRearGuards:\(player\.rear\|\|\[\]\)\.slice\(2,5\)/);assert.match(source,/controllerBackRowGradeRearGuards:/);assert.match(source,/controllerDamageCount:/);assert.match(source,/opponentDamageCount:/);assert.match(source,/allOrderZonesCount:\(match\.players\.human\.orders\|\|\[\]\)\.length\+\(match\.players\.bot\.orders\|\|\[\]\)\.length/);assert.match(source,/anyFieldCardIsLocked:/);assert.match(source,/controllerVanguardIsAttackedUnit:eventContext\.event==="place"&&eventContext\.targetZone==="vanguard"&&eventContext\.targetUid===player\.vanguard\?\.uid/);
});

test("both Order Zone hand actions emit placement events for the moved instance",()=>{
 const app=fs.readFileSync("app.js","utf8");
 for(const action of ["hand-to-order","play-order"]){
  const start=app.indexOf(`action === "${action}"`),end=app.indexOf("} else if (action ===",start+10),branch=app.slice(start,end<0?app.length:end);
  assert.ok(start>=0,`${action} action exists`);assert.match(branch,/player\.orders\.push\(instance\)/);assert.match(branch,/queueAbilityPrompts\("place","human",instance\.uid,\{[^}]*currentLocation:"order"/);
 }
});

test("intercept placement carries the source circle and current battle into its AUTO event",()=>{
 const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function interceptWith(uid)"),end=app.indexOf("function moveRearCardToZone",start),branch=app.slice(start,end);
 assert.ok(start>=0);assert.match(branch,/previousLocation:rearZones\[index\]/);assert.match(branch,/currentLocation:"guardian"/);assert.match(branch,/battleId:match\.pendingAttack\?\.battleId/);assert.match(branch,/targetUid:match\.pendingAttack\?\.targetUid/);assert.match(branch,/targetZone:match\.pendingAttack\?\.targetZone/);
 assert.match(app,/function placeAbilityMatchesSubject\(raw,source,context\)\{if\(\/\\\\bwhen this unit intercepts/);
});

test("instance location is derived from the owning match zone and duplicate placement is surfaced",()=>{
 const borrowed=createCardInstance("card-1","owner-a","borrowed-copy",{controllerPlayerId:"player-b",zone:"stale-zone"}),match={players:{host:{playerId:"player-a",vanguard:null,rear:[null,null,null,null,null],hand:[],damage:[],drop:[],soul:[],bind:[],orders:[],crests:[],guardCircle:[],extra:[],gDeck:[],gZone:[],removed:[]},joiner:{playerId:"player-b",vanguard:null,rear:[null,borrowed,null,null,null],hand:[],damage:[],drop:[],soul:[],bind:[],orders:[],crests:[],guardCircle:[],extra:[],gDeck:[],gZone:[],removed:[]}}};
 assert.deepEqual(locateCardInstance(match,"borrowed-copy"),{instance:borrowed,side:"joiner",playerId:"player-b",ownerPlayerId:"owner-a",controllerPlayerId:"player-b",zone:"rear-guard",circle:"rear-right",index:1});assert.equal(locateCardInstance(match,"missing"),null);match.players.joiner.hand.push(borrowed);const duplicate=locateCardInstance(match,"borrowed-copy");assert.equal(duplicate.ambiguous,true);assert.equal(duplicate.matches.length,2);
 const request={type:"action",action:"manual:open-skills",selected:"borrowed-copy",matchId:"lookup-room",actorPlayerId:"player-b",actionId:"lookup-card",expectedStateVersion:1},requestState={...match,matchId:"lookup-room",stateVersion:1,processedActionIds:[],side:"joiner"};assert.equal(validateRemoteActionRequest(requestState,request,"player-b").reason,"selected-card-not-found");requestState.players.joiner.hand=[];assert.equal(validateRemoteActionRequest(requestState,request,"player-b").ok,true);const app=fs.readFileSync("app.js","utf8");assert.match(app,/function findFieldCard\(uid\)\s*\{[^}]*locateCardInstance/);assert.match(app,/function findMatchInstance\(uid\)\{const located=window\.VanguardAbilityEngine\.locateCardInstance/);
});

test("player setup creates its identity before stamping deck instances", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const playerSetup = source.match(/function makePlayer\(deck, name, human = false\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(playerSetup, /const playerId\s*=\s*crypto\.randomUUID/);
  assert.match(playerSetup, /cardInstances\(deck, playerId\)/);
  assert.match(playerSetup, /return \{ playerId,/);
});

test("online player and spectator snapshots omit unrelated private skill decisions", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /projectPendingAbilitiesForSide\(snapshot,"human"\)/);
  assert.match(source, /publicMatch\.pendingAbility = null; publicMatch\.pendingAbilities = \[\]/);
});
test("application offers an explicit order choice for simultaneous AUTO abilities", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /simultaneousAbilityGroup\(match,selectedPrompt\)/);
  assert.match(source, /data-ability-order-index/);
  assert.match(source, /queue\[index\]=current;match\.pendingAbility=chosen/);
  assert.match(source, /flushCollectedAbilityTriggers\(immediate\)/);
  assert.match(source, /group\.length>1&&pending\.side==="bot"&&!online\.role/);
  assert.match(source, /triggerControllerPlayerId:source\.instance\.controllerPlayerId\|\|match\.players\[side\]\?\.playerId/);
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /id="ability-order-panel"/);
  assert.match(html, /id="ability-order-options"/);
});
test("simultaneous AUTO ordering groups only the same event and controller", () => {
  const make = (uid, id, eventId, controllerPlayerId = "p1") => ({ instance: { uid, controllerPlayerId }, ability: { kind: "AUTO", id }, eventContext: { eventId } });
  const first = make("a", "a:0", "m:e1"), sameEvent = make("b", "b:0", "m:e1"), otherOwner = make("c", "c:0", "m:e1", "p2"), otherEvent = make("d", "d:0", "m:e2");
  assert.deepEqual(simultaneousAbilityGroup({ pendingAbility: first, pendingAbilities: [sameEvent, otherOwner, otherEvent] }, first), [first, sameEvent]);
});
test("AUTO check timing gives the turn player priority before the opponent's queued skills", () => {
  const make=(side,playerId)=>({side,instance:{uid:playerId+"-card",controllerPlayerId:playerId},triggerControllerPlayerId:playerId,ability:{kind:"AUTO",id:playerId+"-skill"},eventContext:{eventId:"same-check",turnPlayerId:"turn-player"}});
  const turn=make("bot","turn-player"),nonTurn=make("human","other-player"),state={side:"bot",players:{bot:{playerId:"turn-player"},human:{playerId:"other-player"}},pendingAbility:null,pendingAbilities:[nonTurn,turn]};
  assert.equal(promotePendingAbilityForPlayer(state,"other-player","human"),null);
  assert.equal(promotePendingAbilityForPlayer(state,"turn-player","bot").triggerControllerPlayerId,"turn-player");
  state.pendingAbility=null;
  assert.equal(promotePendingAbilityForPlayer(state,"other-player","human").triggerControllerPlayerId,"other-player");
});test("private snapshots preserve AUTO priority without revealing the opponent ability", () => {
  const host={side:"human",triggerControllerPlayerId:"host-id",instance:{uid:"host-private",controllerPlayerId:"host-id"},ability:{kind:"AUTO",id:"secret",printedText:"secret text"},eventContext:{turnPlayerId:"host-id",eventId:"window"}};
  const guest={side:"bot",triggerControllerPlayerId:"guest-id",instance:{uid:"guest-card",controllerPlayerId:"guest-id"},ability:{kind:"AUTO",id:"guest-skill"},eventContext:{turnPlayerId:"host-id",eventId:"window"}};
  const shared={pendingAbility:host,pendingAbilities:[guest],players:{human:{playerId:"host-id"},bot:{playerId:"guest-id"}},side:"human"};
  const projected={...shared,...projectPendingAbilitiesForSide(shared,"bot")};
  assert.equal(projected.pendingAbilityPriorityPlayerId,"host-id");
  assert.equal(projected.pendingAbility,null);
  assert.deepEqual(projected.pendingAbilities,[guest]);
  assert.equal(promotePendingAbilityForPlayer(projected,"guest-id","bot"),null);
  assert.equal(JSON.stringify(projected).includes("secret text"),false);
  const afterHostResolution={...shared,pendingAbility:null,pendingAbilities:[guest]};
  const nextGuestState={...afterHostResolution,...projectPendingAbilitiesForSide(afterHostResolution,"bot")};
  assert.equal(nextGuestState.pendingAbilityPriorityPlayerId,undefined);
  assert.equal(promotePendingAbilityForPlayer(nextGuestState,"guest-id","bot").triggerControllerPlayerId,"guest-id");
});test("private skill decisions are projected only to their owner", () => {
  const host = { side: "human", instance: { uid: "host-card" }, ability: { id: "host-skill" } };
  const guest = { side: "bot", instance: { uid: "guest-card" }, ability: { id: "guest-skill" } };
  const state = { pendingAbility: host, pendingAbilities: [guest] };
  assert.deepEqual(projectPendingAbilitiesForSide(state, "human"), { pendingAbility: host, pendingAbilities: [] });
  assert.deepEqual(projectPendingAbilitiesForSide(state, "bot"), { pendingAbility: null, pendingAbilities: [guest] });
});
test("private AUTO prompts require both the local side and the controller player ID",()=>{
 const hostPrompt={side:"human",triggerControllerPlayerId:"guest-id",instance:{uid:"guest-card",controllerPlayerId:"guest-id"},ability:{kind:"AUTO",id:"guest-private",printedText:"private guest effect"}},guestPrompt={side:"bot",triggerControllerPlayerId:"host-id",instance:{uid:"host-card",controllerPlayerId:"host-id"},ability:{kind:"AUTO",id:"host-private",printedText:"private host effect"}};
 const state={pendingAbility:hostPrompt,pendingAbilities:[guestPrompt],players:{human:{playerId:"host-id"},bot:{playerId:"guest-id"}}};
 const host=projectPendingAbilitiesForSide(state,"human"),guest=projectPendingAbilitiesForSide(state,"bot");
 assert.equal(host.pendingAbility,null);assert.deepEqual(host.pendingAbilities,[]);assert.equal(guest.pendingAbility,null);assert.deepEqual(guest.pendingAbilities,[]);
 assert.equal(JSON.stringify(host).includes("private"),false);assert.equal(JSON.stringify(guest).includes("private"),false);
});
test("once-per-turn usage is scoped to exact card instance and ability", () => {
  const firstCopy = abilityUsageKey(7, "player-a", "copy-a", "card:0");
  const secondCopy = abilityUsageKey(7, "player-a", "copy-b", "card:0");
  const secondAbility = abilityUsageKey(7, "player-a", "copy-a", "card:1");
  assert.notEqual(firstCopy, secondCopy);
  assert.notEqual(firstCopy, secondAbility);
  assert.equal(firstCopy, abilityUsageKey(7, "player-a", "copy-a", "card:0"));
});

test("once-per-game restrictions persist across turns and reject reused ACT abilities", () => {
  const text = "ACT [VC]: Once per game, draw a card.";
  const parsed = parseCardAbilities({ id: "once-game", text })[0];
  assert.deepEqual(parsed.usageRestriction, { type: "once-per-game", scope: "ability-instance", reset: "game" });
  assert.equal(parsed.once, true);
  const restriction = parsed.usageRestriction;
  const firstTurnKey = abilityUsageKey(1, "player-a", "copy-a", "once-game:0", restriction);
  assert.equal(firstTurnKey, abilityUsageKey(18, "player-a", "copy-a", "once-game:0", restriction));
  assert.notEqual(firstTurnKey, abilityUsageKey(18, "player-a", "copy-b", "once-game:0", restriction));
  assert.notEqual(firstTurnKey, abilityUsageKey(18, "player-a", "copy-a", "once-game:1", restriction));
  const ability = { ...parsed, definition: { kind: "ACT", effects: [{ op: "draw", count: 1 }] }, costs: [], conditions: [] };
  const legal = { cardInstanceId: "copy-a", controllerPlayerId: "player-a", actorPlayerId: "player-a", turnPlayerId: "player-a", phase: "main", inPermittedZone: true, alreadyUsed: false, resources: {} };
  assert.deepEqual(canActivateManualAbility(ability, legal), { ok: true });
  assert.equal(canActivateManualAbility(ability, { ...legal, alreadyUsed: true }).reason, "usage-restriction");
  const source = { uid: "copy-a" }, player = { playerId: "player-a", vanguard: source, rear: [], hand: [], soul: [], damage: [], drop: [], usedAbilities: [] };
  const paymentContext = { player, source, sourceZone: "vanguard", actorPlayerId: "player-a", turnId: 1 };
  assert.equal(payAbilityCosts(ability, paymentContext, {}).ok, true);
  assert.equal(payAbilityCosts(ability, { ...paymentContext, turnId: 18 }, {}).reason, "usage-restriction");
});

test("rejects stale cards, illegal call circles, and invalid ability targets before costs", () => {
  const available = { choicePoolCardIds: ["deck-copy"], choiceRequired: true };
  assert.deepEqual(validateAbilityChoices("AUTO: Choose a unit.", { effectUid: "deck-copy" }, available), { ok: true });
  assert.equal(validateAbilityChoices("AUTO: Choose a unit.", { effectUid: "other-copy" }, available).reason, "invalid-card-choice");
  assert.equal(validateAbilityChoices("ACT: Call this card.", { effectUid: "deck-copy", callZone: "vanguard" }, { ...available, callEffect: true, allowedCallZones: ["rear-left"], selectedCallCardLegal: true }).reason, "invalid-call-zone");
  assert.equal(validateAbilityChoices("AUTO: Choose an opponent's rear-guard.", { targetUid: "vg-copy" }, { targetRequired: true, expectedTargetSide: "opponent", target: { side: "opponent", zone: "vanguard" } }).reason, "invalid-target-zone");
  assert.equal(validateAbilityChoices("AUTO: Choose an opponent's unit.", { targetUid: "own-copy" }, { targetRequired: true, expectedTargetSide: "opponent", target: { side: "you", zone: "rear-left" } }).reason, "invalid-target-owner");
});

test("application checks a source card's current controller before evaluating its skill", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const start = source.indexOf("function abilityRequirementsMet(");
  const body = source.slice(start, source.indexOf("function abilityTriggerMatches", start));
  assert.match(body, /abilityController&&abilityController!==player\.playerId/);
});

test("application defers movement-trigger processing until a reviewed effect transaction commits", () => {
  const source = fs.readFileSync("app.js", "utf8");
  assert.match(source, /if\(Number\(match\.effectResolutionDepth\|\|0\)>0\)\{\(match\.deferredAbilityEvents\|\|=\[\]\)\.push/);
  assert.match(source, /effectResolutionDepth=\(match\.effectResolutionDepth\|\|0\)\+1;let result;try\{/);
  assert.match(source, /finally\{match\.effectResolutionDepth=Math\.max/);
});
test("application validates selected cards and targets before applying ability costs", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const start=source.indexOf("function resolveReviewedAbility("),end=source.indexOf("function resolveAbility(x)",start),resolver=source.slice(start,end);
  assert.match(resolver, /payAbilityCosts\(ability,/);
  assert.match(resolver, /turnId:match\.turn/);
  assert.match(resolver, /sourceZone:field\.zone/);
  assert.equal(resolver.includes("player.usedAbilities.push("),false);  const preflight=resolver.indexOf("validateEffectProgram(definition.effects,handlers,context)");
  const payment=resolver.indexOf("resolveEffectProgram(definition.effects,handlers,context,draft=>");
  assert.ok(preflight >= 0);
  assert.ok(payment > preflight);
});

test("ability cost payment validates atomically, records usage, and emits exact movement events", () => {
  const source={uid:"source",rested:false},discard={uid:"discard"},soulBlast={uid:"soul-blast"},damage={uid:"damage",faceDown:false};
  const player={playerId:"p1",vanguard:{uid:"vg"},rear:[source],hand:[discard],soul:[soulBlast],damage:[damage],drop:[],usedAbilities:[]};
  const ability={id:"paid-skill",once:true,costs:[{type:"counter-blast",count:1},{type:"soul-blast",count:1},{type:"discard",count:1},{type:"source-to-soul",count:1},{type:"rest-source",count:1}]};
  const events=[],selection={cb:["damage"],sb:["soul-blast"],discard:["discard"]};
  assert.deepEqual(payAbilityCosts(ability,{player,source,sourceZone:"rear-left",turnId:3,actorPlayerId:"p1",side:"human",emitEvent:event=>events.push(event)},selection),{ok:true,usageKey:"3:p1:source:paid-skill",paid:{counterBlast:1,soulBlast:1,discard:1,sourceToSoul:1,sourceToBottomDeck:0,restSource:1,sourceBind:0,bindHealFromDrop:0}});
  assert.equal(damage.faceDown,true);
  assert.deepEqual(player.soul.map(card=>card.uid),["source"]);
  assert.deepEqual(player.drop.map(card=>card.uid),["soul-blast","discard"]);
  assert.equal(player.rear[0],null);
  assert.equal(source.rested,true);
  assert.deepEqual(events.map(event=>[event.type,event.cardInstanceId,event.previousLocation,event.currentLocation]),[["card.moved","soul-blast","soul","drop"],["card.discarded","discard","hand","drop"],["card.moved","source","rear-left","soul"]]);
  assert.deepEqual(player.usedAbilities,["3:p1:source:paid-skill"]);
});
test("illegal or repeated ability cost payments leave game state unchanged", () => {
  const source={uid:"source",rested:false},damage={uid:"damage",faceDown:true},player={playerId:"p1",vanguard:null,rear:[source],hand:[],soul:[],damage:[damage],drop:[],usedAbilities:[]};
  const ability={id:"once",once:true,costs:[{type:"counter-blast",count:1}]},ctx={player,source,sourceZone:"rear-left",turnId:1,actorPlayerId:"p1"};
  assert.equal(payAbilityCosts(ability,ctx,{cb:["damage"]}).reason,"damage-not-face-up");
  assert.equal(damage.faceDown,true);
  assert.deepEqual(player.usedAbilities,[]);
  damage.faceDown=false;
  assert.equal(payAbilityCosts(ability,ctx,{cb:["damage"]}).ok,true);
  player.damage.push({uid:"damage-2",faceDown:false});
  assert.equal(payAbilityCosts(ability,ctx,{cb:["damage-2"]}).reason,"usage-restriction");
  assert.equal(player.drop.length,0);
  assert.equal(player.usedAbilities.length,1);
});test("manual activation legality requires the controller, Main timing, legal zone, costs, conditions, and unused restriction", () => {
  registerAbilityDefinitions([{ id: "manual-legal:0", cardId: "manual-legal", kind: "ACT", printedText: "ACT (RC) 1/Turn: COST [CB1] Draw a card.", effects: [{ op: "draw", count: 1 }] }]);
  const ability = parseCardAbilities({ id: "manual-legal", text: "ACT (RC) 1/Turn: COST [CB1] Draw a card." })[0];
  const context = { cardInstanceId: "copy-a", controllerPlayerId: "player-a", actorPlayerId: "player-a", turnPlayerId: "player-a", phase: "main", inPermittedZone: true, alreadyUsed: false, resources: { faceUpDamage: 1 } };
  assert.deepEqual(canActivateManualAbility(ability, context), { ok: true });
  assert.equal(canActivateManualAbility(ability, { ...context, actorPlayerId: "player-b" }).reason, "not-controller");
  assert.equal(canActivateManualAbility(ability, { ...context, phase: "battle" }).reason, "wrong-timing-window");
  assert.equal(canActivateManualAbility(ability, { ...context, inPermittedZone: false }).reason, "wrong-zone");
  assert.equal(canActivateManualAbility(ability, { ...context, alreadyUsed: true }).reason, "usage-restriction");
  assert.equal(canActivateManualAbility(ability, { ...context, resources: { faceUpDamage: 0 } }).reason, "unpayable-cost");
  assert.equal(canActivateManualAbility(ability, { ...context, resolutionBlocked: true }).reason, "resolution-in-progress");
  const unreviewed = parseCardAbilities({ id: "manual-unreviewed", text: "ACT (RC): Draw a card." })[0];
  assert.equal(canActivateManualAbility(unreviewed, context).reason, "unsupported-effect");
  registerAbilityDefinitions([{ id: "manual-conditional:0", cardId: "manual-conditional", kind: "ACT", printedText: "ACT (RC): If you have a vanguard with \"Blaster\" in its card name, draw a card.", effects: [{ op: "draw", count: 1 }] }]);
  const conditional = parseCardAbilities({ id: "manual-conditional", text: "ACT (RC): If you have a vanguard with \"Blaster\" in its card name, draw a card." })[0];
  assert.equal(canActivateManualAbility(conditional, context).reason, "conditions-not-verified");
  assert.equal(canActivateManualAbility(conditional, { ...context, conditions: { vanguardName: "Dragonic Overlord" } }).reason, "condition-not-met");
  assert.equal(canActivateManualAbility(conditional, { ...context, conditions: { vanguardName: "Blaster Dark" } }).ok, true);
  registerAbilityDefinitions([{ id: "manual-unmodeled-condition:0", cardId: "manual-unmodeled-condition", kind: "ACT", printedText: "ACT (RC): If you have more damage than your opponent, draw a card.", effects: [{ op: "draw", count: 1 }] }]);
  const unmodeledCondition = parseCardAbilities({ id: "manual-unmodeled-condition", text: "ACT (RC): If you have more damage than your opponent, draw a card." })[0];
  assert.equal(canActivateManualAbility(unmodeledCondition, context).reason, "unmodeled-condition");
  registerAbilityDefinitions([{ id: "manual-unmodeled-cost:0", cardId: "manual-unmodeled-cost", kind: "ACT", printedText: "ACT (RC): COST [retire one of your rear-guards] Draw a card.", effects: [{ op: "draw", count: 1 }] }]);
  const unmodeledCost = parseCardAbilities({ id: "manual-unmodeled-cost", text: "ACT (RC): COST [retire one of your rear-guards] Draw a card." })[0];
  assert.equal(canActivateManualAbility(unmodeledCost, context).reason, "unmodeled-cost");
  assert.equal(canActivateManualAbility({ ...ability, choiceStatus: "needs-review" }, context).reason, "unmodeled-choice");
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /conditions:abilityConditionContext\(f\.side,f/);
});

test("splits a card's printed AUTO, ACT, and CONT abilities independently", () => {
  const abilities = parseCardAbilities({
    id: "test-card",
    text: "[AUTO](RC): When this unit attacks, draw a card.\n[ACT](VC) 1/Turn: COST [CB1] Draw a card.\n[CONT](VC): This unit gets +5000 power."
  });
  assert.deepEqual(abilities.map(({ kind }) => kind), ["AUTO", "ACT", "CONT"]);
  assert.deepEqual(abilities.map(({ id }) => id), ["test-card:0", "test-card:1", "test-card:2"]);
  assert.match(abilities[0].raw, /When this unit attacks, draw a card\./);
  assert.match(abilities[0].printedText, /\[AUTO\]/);
  assert.equal(abilities[1].once, true);
  assert.equal(abilities[1].gb, 0);
  assert.match(abilities[2].raw, /This unit gets \+5000 power\./);
});

test("preserves Generation Break and once-per-turn markers", () => {
  const card = { id: "gb-card", text: "AUTO: GB3 When placed, draw one card.\nACT: Once per turn, Soul-Blast 1." };
  const abilities = parseCardAbilities(card);
  assert.equal(abilities[0].gb, 3);
  assert.equal(abilities[1].once, true);
  assert.equal(abilities[0].cardId, "gb-card");
  assert.equal(abilities[0].implementationStatus, "needs-review");
  assert.deepEqual(parseCardAbilities({ id: "plain-card", text: "Flavor text only." }), []);
});
test("creates structured, serializable events with explicit instance identities and deduplicates IDs", () => {
  const match = { matchId: "match-7", eventSequence: 0 };
  const first = createGameEvent(match, {
    type: "unit.attacked", actingPlayerId: "joiner", turnPlayerId: "joiner",
    sourceCardInstanceId: "copy-a", sourceOwnerPlayerId: "p1", sourceControllerPlayerId: "p1",
    subjectCardInstanceId: "copy-a", subjectOwnerPlayerId: "p1", subjectControllerPlayerId: "p1",
    targetCardInstanceIds: ["opponent-vanguard"], currentLocation: "rear-left",
    circle: "rear-left", phase: 5, timingWindow: "attack-declared"
  });
  const second = createGameEvent(match, { type: "unit.attacked", actingPlayerId: "joiner" });

  assert.equal(first.eventId, "match-7:1");
  assert.equal(first.sourceCardInstanceId, "copy-a");
  assert.equal(first.sourceOwnerPlayerId, "p1");
  assert.equal(first.subjectControllerPlayerId, "p1");
  assert.equal(first.targetCardInstanceIds[0], "opponent-vanguard");
  assert.equal(second.eventId, "match-7:2");
  assert.equal(claimGameEvent(match, first.eventId), true);
  assert.equal(claimGameEvent(match, first.eventId), false);
});

test("structured discard events retain their cause for exact trigger matching", () => {
  const eventCard = { sourceCardInstanceId: "discarded", subjectCardInstanceId: "discarded", sourceControllerPlayerId: "p1", previousLocation: "hand", currentLocation: "drop" };
  const byReason = createGameEvent({ matchId: "discard-cause" }, { type: "card.discarded", actingPlayerId: "p1", ...eventCard, reason: "stride-cost" });
  const byDiscardReason = createGameEvent({ matchId: "discard-cause" }, { type: "card.discarded", actingPlayerId: "p1", ...eventCard, discardReason: "g-guardian-cost" });
  assert.equal(byReason.reason, "stride-cost");
  assert.equal(byReason.discardReason, "stride-cost");
  assert.equal(byDiscardReason.reason, "g-guardian-cost");
  assert.equal(byDiscardReason.discardReason, "g-guardian-cost");
  const parsed = parseCardAbilities({ id: "g-guard-cause", text: "AUTO: When this card is discarded for the cost of calling a G guardian, draw a card." })[0];
  const gGuard = { ...parsed, costStatus: "no-cost" };
  assert.equal(eventMatchesAbilityTrigger(gGuard, "discard", byReason, "discarded", "hand", "hand", "p1"), false);
  assert.equal(eventMatchesAbilityTrigger(gGuard, "discard", byDiscardReason, "discarded", "hand", "hand", "p1"), true);
});

test("game events retain immutable snapshots of action details", () => {
  const before = { rested: true, nested: { power: 8000 } }, after = { rested: false }, targets = ["target-a"];
  const event = createGameEvent({ matchId: "snapshot" }, { type: "unit.stood", actingPlayerId: "p1", before, after, targetCardInstanceIds: targets });
  before.rested = false; before.nested.power = 9000; after.rested = true; targets.push("target-b");
  assert.equal(event.before.rested, true);
  assert.equal(event.before.nested.power, 8000);
  assert.equal(event.after.rested, false);
  assert.deepEqual(event.targetCardInstanceIds, ["target-a"]);
  assert.equal(Object.isFrozen(event.before.nested), true);
  assert.equal(Object.isFrozen(event.targetCardInstanceIds), true);
  assert.doesNotThrow(() => JSON.stringify(event));
});
test("turn-start AUTO timing distinguishes the controller turn from the opponent turn", () => {
  const own = parseCardAbilities({ id: "turn-own", text: "AUTO: At the beginning of your turn, draw a card." })[0];
  const opponent = parseCardAbilities({ id: "turn-opponent", text: "AUTO: At the beginning of your opponent's turn, draw a card." })[0];
  assert.deepEqual(own.trigger, { status: "recognized-trigger", eventType: "turn.started", subject: "controller", circles: [], turnRelation: "controller" });
  assert.equal(opponent.trigger.turnRelation, "opponent");
  const ownTurn = createGameEvent({ matchId: "turn-window" }, { type: "turn.started", actingPlayerId: "player-a", turnPlayerId: "player-a" });
  const opponentTurn = createGameEvent({ matchId: "turn-window" }, { type: "turn.started", actingPlayerId: "player-b", turnPlayerId: "player-b" });
  assert.equal(eventMatchesAbilityTrigger(own, "start", ownTurn, "own-card", "rear-left", null, "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(own, "start", opponentTurn, "own-card", "rear-left", null, "player-a"), false);
  assert.equal(eventMatchesAbilityTrigger(opponent, "start", opponentTurn, "opponent-card", "rear-left", null, "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(opponent, "start", ownTurn, "opponent-card", "rear-left", null, "player-a"), false);
});
test("turn-start events dispatch at local, online, and practice turn transitions", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const event = createGameEvent({ matchId: "turn-start" }, { type: "turn.started", actingPlayerId: "player-b", turnPlayerId: "player-b", timingWindow: "turn-start" });
  assert.equal(GAME_EVENT_TYPES.includes("turn.started"), true);
  assert.equal(event.turnPlayerId, "player-b");
  assert.equal(event.subjectCardInstanceId, null);
  assert.equal(app.includes('start:"turn.started"'), true);
  assert.match(app, /function queueTurnStartEvent\(side\)[\s\S]{0,240}queueAbilityPrompts\("start",side,null/);
  assert.match(app, /!onlineSetup&&firstSide==="human"[\s\S]{0,160}queueTurnStartEvent\("human"\)/);
  assert.match(app, /match\.turnStartGrades\[firstSide\][\s\S]{0,120}queueTurnStartEvent\(firstSide\)/);
  const botTurnStart = app.indexOf("function botTurn()");
  const botTurnEnd = app.indexOf("function nextBotAttack", botTurnStart);
  const botTurn = app.slice(botTurnStart, botTurnEnd);
  assert.ok(botTurnStart >= 0 && botTurnEnd > botTurnStart);
  assert.ok(botTurn.indexOf("botTimer = setTimeout(") < botTurn.indexOf('queueTurnStartEvent("bot")'));
  assert.ok(botTurn.indexOf('queueTurnStartEvent("bot")') < botTurn.indexOf('advanceBotPhase("Draw")'));
  assert.match(app, /function completeTurnTransition\(endingPlayerId\)[\s\S]{0,2200}queueTurnStartEvent\("human"\)/);
  assert.ok(app.includes("match.turnStartGrades[nextSide]=Number(cardMap.get(match.players[nextSide].vanguard?.cardId)?.grade??-1);match.drewThisTurn=false;queueTurnStartEvent(nextSide)"));
});
test("turn-end AUTO timing distinguishes the controller turn from the opponent turn", () => {
  const own = parseCardAbilities({ id: "turn-end-own", text: "AUTO: At the end of your turn, draw a card." })[0];
  const opponent = parseCardAbilities({ id: "turn-end-opponent", text: "AUTO: At the end of your opponent's turn, draw a card." })[0];
  assert.equal(own.trigger.eventType, "turn.ended");
  assert.equal(own.trigger.turnRelation, "controller");
  assert.equal(opponent.trigger.turnRelation, "opponent");
  const ownEnd = createGameEvent({ matchId: "turn-end" }, { type: "turn.ended", actingPlayerId: "player-a", turnPlayerId: "player-a" });
  const opposingEnd = createGameEvent({ matchId: "turn-end" }, { type: "turn.ended", actingPlayerId: "player-b", turnPlayerId: "player-b" });
  assert.equal(eventMatchesAbilityTrigger(own, "end", ownEnd, "own-card", "rear-left", null, "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(own, "end", opposingEnd, "own-card", "rear-left", null, "player-a"), false);
  assert.equal(eventMatchesAbilityTrigger(opponent, "end", opposingEnd, "opponent-card", "rear-left", null, "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(opponent, "end", ownEnd, "opponent-card", "rear-left", null, "player-a"), false);
});
test("turn-end events hold the transition until private skill decisions resolve", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /function queueTurnEndEvent\(side,endPhaseRescan=false\)[\s\S]{0,300}pending\.endPhaseRescanInProgress=true/);
  assert.match(app, /queueAbilityPrompts\("end",side,null,\{eventId:pending\?\.turnEndEventId/);
  assert.match(app, /function beginTurnEnd\(side\)[\s\S]{0,420}pendingTurnEnd=\{playerId:player\.playerId,side,turn:match\.turn,turnEndEventId:/);
  assert.match(app, /function resumeAbilityQueue\(\)[\s\S]{0,400}endPhaseRescanPending[\s\S]{0,260}queueTurnEndEvent\(pending\.side,true\)/);
  assert.match(app, /endPhaseRescanInProgress===true/);
  assert.match(app, /if\(match\.pendingTurnEnd\)[\s\S]{0,180}completeTurnTransition\(playerId\)/);
  assert.match(app, /message\.type === "ability-response"[\s\S]{0,4000}resumeAbilityQueue\(\);renderMatch\(\)/);
  assert.match(app, /if\(match\?\.pendingTurnEnd\)\{toast\("Resolve the pending end-of-turn abilities first\."\)/);
});
test("remote game actions are rejected while end-of-turn abilities resolve", () => {
  const request = { type: "action", action: "attack", actionId: "during-end", matchId: "m", actorPlayerId: "joiner", expectedStateVersion: 3 };
  assert.deepEqual(validateRemoteActionRequest({ matchId: "m", stateVersion: 3, pendingTurnEnd: { playerId: "host" } }, request, "joiner"), { ok: false, reason: "resolution-in-progress" });
});test("drive, damage, and trigger check events preserve the checked card and battle context", () => {
  const state = { matchId: "check-events" };
  const event = createGameEvent(state, { type: "drive.checked", actingPlayerId: "player-a", turnPlayerId: "player-a", sourceCardInstanceId: "vanguard-copy", sourceControllerPlayerId: "player-a", subjectCardInstanceId: "revealed-copy", checkedCardInstanceId: "revealed-copy", battleId: "battle-7", checkKind: "drive", checkIndex: 2, revealedTrigger: "critical" });
  assert.equal(GAME_EVENT_TYPES.includes("drive.checked"), true);
  assert.equal(GAME_EVENT_TYPES.includes("damage.checked"), true);
  assert.equal(GAME_EVENT_TYPES.includes("trigger.checked"), true);
  assert.equal(event.sourceCardInstanceId, "vanguard-copy");
  assert.equal(event.subjectCardInstanceId, "revealed-copy");
  assert.equal(event.checkedCardInstanceId, "revealed-copy");
  assert.equal(event.battleId, "battle-7");
  assert.equal(event.checkKind, "drive");
  assert.equal(event.checkIndex, 2);
  assert.equal(event.revealedTrigger, "critical");
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /queueAbilityPrompts\("driveCheck",driveSide,top\.uid/);
  assert.match(app, /queueAbilityPrompts\(checkEventName,"human",top\.uid/);
  assert.match(app, /battleEnd:"battle\.close-step",damageCheck:"damage\.checked",triggerCheck:"trigger\.checked"/);
  assert.match(app, /driveCheck","damageCheck","triggerCheck"\]\.includes\(eventName\)\?null:subjectUid/);
  assert.match(app, /driveChecksPerformed=Number\(attack\.driveChecksPerformed\|\|0\)\+1/);
  assert.match(app, /checkIndex:Math\.max\(1,Number\(attack\.driveChecksPerformed\|\|1\)\)/);
});
test("matches ability subjects to exact source, event, booster, or boosted-unit instance IDs", () => {
  const event = createGameEvent({ matchId: "m" }, {
    eventId: "m:b1", type: "unit.boosted", actingPlayerId: "p1",
    sourceCardInstanceId: "booster-copy", subjectCardInstanceId: "booster-copy",
    boosterCardInstanceId: "booster-copy", boostedCardInstanceId: "attacker-copy"
  });
  assert.equal(eventSubjectMatches(event, "booster-copy", "source"), true);
  assert.equal(eventSubjectMatches(event, "attacker-copy", "boosted-unit"), true);
  assert.equal(eventSubjectMatches(event, "booster-copy", "event-subject"), true);
  assert.equal(eventSubjectMatches({ type: "card.ridden", targetCardInstanceIds: ["ridden-copy"] }, "ridden-copy", "event-target"), true);
  assert.equal(eventSubjectMatches({ type: "card.ridden", targetCardInstanceIds: ["ridden-copy"] }, "other-ridden-copy", "event-target"), false);
  assert.equal(eventSubjectMatches(event, "same-name-other-copy", "source"), false);
  assert.equal(eventSubjectMatches(event, "same-name-other-copy", "booster"), false);
});
test("compiles exact attack, boost, and circle-specific placement triggers", () => {
  const card = { id: "real-example", text: "[AUTO](RC): When this unit attacks, if you have an Ancient Dragon vanguard, this unit gets +3000 power.\n[AUTO](VC): When this unit is placed on VC or RC, draw a card.\n[AUTO](RC): When this unit boosts, draw a card." };
  const [attack, placed, boost] = parseCardAbilities(card);
  assert.equal(attack.trigger.eventType, "unit.attacked");
  assert.equal(attack.trigger.subject, "source");
  assert.deepEqual(attack.requiredLocation, ["rear-guard"]);
  assert.equal(attack.conditionStatus, "needs-review");
  assert.equal(placed.trigger.eventType, "card.placed");
  assert.deepEqual(placed.trigger.circles, ["vanguard", "rear-guard"]);
  assert.deepEqual(placed.requiredLocation, ["vanguard"]);
  assert.equal(boost.trigger.eventType, "unit.boosted");
  assert.equal(boost.trigger.subject, "source");
});

test("legacy Limit Break attack AUTO parses its exact source, circle, damage threshold, and battle effect", () => {
  const card={id:"cfa-218",name:"Great Silver Wolf, Garmore",text:"AUTO [VC] Limit Break 4 (This ability is active if you have four or more damage): When this unit attacks a vanguard, this unit gets power +5000 until end of that battle.\n\nAUTO [VC]: When this unit is placed on VC, draw a card."};
  const abilities=parseCardAbilities(card),ability=abilities[0];
  assert.equal(abilities.length,2);
  assert.equal(ability.kind,"AUTO");
  assert.equal(ability.definition.source.patternId,"auto-legacy-limit-break-vanguard-attack-power-v1");
  assert.deepEqual(ability.requiredLocation,["vanguard"]);
  assert.deepEqual(ability.conditions,[{type:"limit-break-active",count:4}]);
  assert.equal(ability.conditionStatus,"modeled");
  assert.equal(evaluateAbilityConditions(ability,{damageCount:3}),false);
  assert.equal(evaluateAbilityConditions(ability,{damageCount:4}),true);
  const event=createGameEvent({matchId:"limit-break"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"garmore",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"garmore","vanguard","vanguard"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"different-copy","vanguard","vanguard"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...event,targetLocation:"rear-guard"},"garmore","vanguard","vanguard"),false);
  const source={uid:"garmore",turnPowerBoost:0},match={pendingAttack:{attackerUid:"garmore",power:13000}};
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"p1",match}).ok,true);
  assert.equal(match.pendingAttack.power,18000);
});
test("legacy Limit Break text with conflicting thresholds stays unsupported", () => {
  const ability=parseCardAbilities({id:"bad-limit-break",text:"[VC] Limit Break 4 (This ability is active if you have three or more damage): When this unit attacks a vanguard, this unit gets power +5000 until end of that battle."})[0];
  assert.equal(ability.definition,null);
  assert.equal(ability.conditionStatus,"needs-review");
  assert.equal(evaluateAbilityConditions(ability,{damageCount:6}),false);
});test("real ACT draw abilities preserve their printed costs and source circles", () => {
  const restDiscard = parseCardAbilities({ id: "cfa-19", name: "Witch of Nostrum, Arianrhod", text: "ACT [VC/RC]: [Rest this unit & Choose a card from your hand, and discard it] Draw a card." })[0];
  assert.equal(restDiscard.definition.source.patternId, "act-rest-discard-draw-v1");
  assert.equal(restDiscard.costStatus, "supported-cost");
  assert.deepEqual(restDiscard.costs, [{ type: "discard", count: 1 }, { type: "rest-source", count: 1 }]);
  assert.deepEqual(restDiscard.definition.effects, [{ op: "draw", count: 1 }]);
  assert.deepEqual(restDiscard.requiredLocation, ["vanguard", "rear-guard"]);

  const soulDraw = parseCardAbilities({ id: "cfa-11646", name: "YONA \"Route\"", text: "ACT [RC]: COST [Put this unit into your soul], draw a card." })[0];
  assert.equal(soulDraw.definition.source.patternId, "act-source-to-soul-draw-v1");
  assert.deepEqual(soulDraw.costs, [{ type: "source-to-soul", count: 1 }]);
  assert.deepEqual(soulDraw.definition.effects, [{ op: "draw", count: 1 }]);
  assert.deepEqual(soulDraw.requiredLocation, ["rear-guard"]);
});

test("real Soul Blast ACT power ability is offered only when its cost is payable", () => {
  const ability = parseCardAbilities({ id: "cfa-1983", name: "Wild Blade Seeker, Pellam", text: "ACT [RC]: [Soul Blast 1] This unit gets power +1000 until end of turn." })[0];
  assert.equal(ability.definition.source.patternId, "act-soul-blast-source-power-turn-v1");
  assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 1 }]);
  assert.deepEqual(ability.definition.effects, [{ op: "modify-power", target: "source", amount: 1000, duration: "turn" }]);
  const context = { cardInstanceId: "pellam-copy", controllerPlayerId: "p1", actorPlayerId: "p1", turnPlayerId: "p1", phase: "main", inPermittedZone: true, conditions: {}, resolutionBlocked: false };
  assert.equal(canActivateManualAbility(ability, { ...context, resources: { soulCount: 0 } }).reason, "unpayable-cost");
  assert.equal(canActivateManualAbility(ability, { ...context, resources: { soulCount: 1 } }).ok, true);
  assert.deepEqual(ability.requiredLocation, ["rear-guard"]);
});

test("real source-to-Soul Counter Charge ACT selects only legal face-down damage", () => {
  const ability = parseCardAbilities({ id: "cfa-5383", name: "Megacolony Battler G", text: "ACT [RC]: [Put this unit into your soul] Counter Charge 1." })[0];
  assert.equal(ability.definition.source.patternId, "act-source-to-soul-counter-charge-v1");
  assert.deepEqual(ability.costs, [{ type: "source-to-soul", count: 1 }]);
  assert.deepEqual(ability.definition.effects, [{ op: "counter-charge", count: 1 }]);
  const handler = EFFECT_HANDLERS["counter-charge"], cardA = { uid: "damage-a", faceDown: true }, cardB = { uid: "damage-b", faceDown: false };
  const context = { player: { damage: [cardA, cardB] }, selectedDamageUids: ["damage-a"] };
  assert.equal(handler.validate(ability.definition.effects[0], context), true);
  assert.equal(handler.apply(ability.definition.effects[0], context), 1);
  assert.equal(cardA.faceDown, false);
  assert.equal(cardB.faceDown, false);
  const noDamage = { player: { damage: [] }, selectedDamageUids: [] };
  assert.equal(handler.validate({ op: "counter-charge", count: 1 }, noDamage), true);
  assert.equal(handler.apply({ op: "counter-charge", count: 1 }, noDamage), 0);
  const partial = { player: { damage: [{ uid: "only", faceDown: true }] }, selectedDamageUids: [] };
  assert.equal(handler.validate({ op: "counter-charge", count: 2 }, partial), false);
  partial.selectedDamageUids = ["only"];
  assert.equal(handler.validate({ op: "counter-charge", count: 2 }, partial), true);
  partial.selectedDamageUids = ["only", "only"];
  assert.equal(handler.validate({ op: "counter-charge", count: 2 }, partial), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.ok(app.includes("selectedDamageUids:x.damageUids||[]"));
  assert.ok(app.includes("damageUids:pending.damageUids||[]"));
  assert.ok(app.includes("pending.damageUids=Array.isArray(selection.damageUids)"));
  assert.ok(app.includes("data-ability-damage"));
});

test("manual ability target eligibility fails closed when required choices are unavailable", () => {
  const definition = { definition: { effects: [{ op: "modify-power-target", target: "chosen", targetFilter: {} }] } };
  assert.equal(hasLegalAbilityTargets(definition, () => 0), false);
  assert.equal(hasLegalAbilityTargets(definition, () => 1), true);
  assert.equal(hasLegalAbilityTargets({ definition: { effects: [{ op: "stand-target", target: "chosen", noOpIfNoLegalTargets: true }] } }, () => 0), true);
  assert.equal(hasLegalAbilityTargets(definition), false);
  const app=fs.readFileSync("app.js","utf8");
  assert.ok(app.includes("hasLegalAbilityTargets(a,step=>abilityTargetChoices(f.side,f,a"));
});

test("real ACT card text compiles to strict costs and typed effects", () => {
  const child = parseCardAbilities({ id: "cfa-245", name: "Land Battle Support Type, Enigship", text: "ACT [VC/RC]: [Counter Blast 1] This unit gets power +1000 until end of turn." })[0];
  assert.equal(child.kind, "ACT");
  assert.equal(child.definition.source.patternId, "act-counter-blast-source-power-turn-v1");
  assert.deepEqual(child.costs, [{ type: "counter-blast", count: 1 }]);
  assert.deepEqual(child.definition.effects, [{ op: "modify-power", target: "source", amount: 1000, duration: "turn" }]);
  assert.equal(child.requiredLocation.includes("vanguard"), true);
  assert.equal(child.requiredLocation.includes("rear-guard"), true);

  const soulCost = parseCardAbilities({ id: "cfa-2997", name: "Beloved Child of Superstring Theory", text: "ACT [RC]: [Put this unit into your soul] Choose one of your units, and it gets power +3000 until end of turn." })[0];
  assert.equal(soulCost.definition.source.patternId, "act-source-to-soul-choose-friendly-power-turn-v1");
  assert.deepEqual(soulCost.costs, [{ type: "source-to-soul", count: 1 }]);
  assert.deepEqual(soulCost.definition.effects[0].targetFilter, { controller: "source-controller", cardType: "unit", excludeSource: true });
  assert.equal(canActivateManualAbility(soulCost, { cardInstanceId: "source-1", controllerPlayerId: "p1", actorPlayerId: "p1", turnPlayerId: "p1", phase: "main", inPermittedZone: true, conditions: {}, resources: { sourceCanMoveToSoul: true }, resolutionBlocked: false }).ok, true);
  assert.equal(canActivateManualAbility(soulCost, { cardInstanceId: "source-1", controllerPlayerId: "p1", actorPlayerId: "p1", turnPlayerId: "p1", phase: "main", inPermittedZone: false, conditions: {}, resources: { sourceCanMoveToSoul: true }, resolutionBlocked: false }).reason, "wrong-zone");
});

test("real Weather Girl, Saft enforces draw timing, RC, Soul Blast, and once-per-turn text", () => {
  const ability = parseCardAbilities({ id: "cfa-5759", text: "AUTO [RC] 1/Turn: When you draw a card during your turn, COST [Soul Blast 1], this unit gets power +6000 until end of turn." })[0];
  assert.equal(ability.definition.source.patternId, "auto-draw-during-turn-soul-blast-power-v1");
  assert.equal(ability.once, true);
  assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 1 }]);
  assert.deepEqual(ability.conditions, [{ type: "controller-turn" }]);
  assert.equal(evaluateAbilityConditions(ability, { isControllerTurn: true }), true);
  assert.equal(evaluateAbilityConditions(ability, { isControllerTurn: false }), false);
  const draw = createGameEvent({ matchId: "saft-draw" }, { type: "card.drawn", actingPlayerId: "p1", sourceCardInstanceId: "drawn-card", subjectCardInstanceId: "drawn-card", subjectOwnerPlayerId: "p1", subjectControllerPlayerId: "p1", previousLocation: "deck", currentLocation: "hand" });
  assert.equal(eventMatchesAbilityTrigger(ability, "draw", draw, "saft-copy", "rear-left", "rear-left", "p1"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "draw", draw, "saft-copy", "vanguard", "rear-left"), false);
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 6000, duration: "turn" }]);
  const app = fs.readFileSync("app.js", "utf8"), resolver = app.slice(app.indexOf("function resolveReviewedAbility("), app.indexOf("function resolveAbility(x)"));
  assert.match(resolver, /payAbilityCosts\(ability,/);
  assert.match(resolver, /turnId:match\.turn/);
});

test("real Sword Dancer Angel resolves its exact draw-trigger power effect", () => {
  const ability = parseCardAbilities({ id: "cfa-425", text: "Oracle Think Tank/Angel\n\nAUTO [VC/RC]: When you draw a card, this unit gets power +1000 until end of turn." })[0];
  assert.equal(ability.definition.source.patternId, "auto-when-you-draw-power-turn-v1");
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 1000, duration: "turn" }]);
  const event = createGameEvent({ matchId: "sword-dancer-draw" }, { type: "card.drawn", actingPlayerId: "p1", sourceCardInstanceId: "drawn-copy", subjectCardInstanceId: "drawn-copy", subjectOwnerPlayerId: "p1", subjectControllerPlayerId: "p1", previousLocation: "deck", currentLocation: "hand" });
  assert.equal(eventMatchesAbilityTrigger(ability, "draw", event, "sword-dancer-copy", "rear-left", "rear-left", "p1"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "sword-dancer-copy", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "draw", event, "sword-dancer-copy", "guardian", "rear-left"), false);
  const source = { uid: "sword-dancer-copy", turnPowerBoost: 0 }, match = {};
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { source, sourceInPlay: true, side: "p1", match }).ok, true);
  assert.equal(source.turnPowerBoost, 1000);
  assert.equal(source.turnPowerExpiry, "p1");
});

test("draw AUTO triggers use the drawn card event and preserve exact drawn-card identity", () => {
  const youDraw = parseCardAbilities({ id: "draw-observer", text: "AUTO [RC]: When you draw a card, this unit gets power +1000 until end of turn." })[0];
  assert.equal(youDraw.trigger.eventType, "card.drawn");
  assert.equal(youDraw.trigger.subject, "controller");
  const event = createGameEvent({ matchId: "draw-event" }, { type: "card.drawn", actingPlayerId: "p1", sourceCardInstanceId: "drawn-copy", subjectCardInstanceId: "drawn-copy", subjectOwnerPlayerId: "p1", subjectControllerPlayerId: "p1", previousLocation: "deck", currentLocation: "hand" });
  assert.equal(eventMatchesAbilityTrigger(youDraw, "draw", event, "draw-observer-copy", "rear-left", "rear-left", "p1"), true);
  assert.equal(eventMatchesAbilityTrigger(youDraw, "attack", event, "draw-observer-copy", "rear-left", "rear-left", "p1"), false);
  const thisDrawn = parseCardAbilities({ id: "self-drawn", text: "AUTO: When this card is drawn, draw a card." })[0];
  assert.equal(thisDrawn.trigger.subject, "event-subject");
  assert.equal(eventMatchesAbilityTrigger(thisDrawn, "draw", event, "drawn-copy", "hand", "hand"), true);
  assert.equal(eventMatchesAbilityTrigger(thisDrawn, "draw", event, "different-copy", "hand", "hand"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /queueAbilityPrompts\(\"draw\",side,card\.uid/);
  assert.match(app, /event\?\.type===\"card\.drawn\"/);
});

test("attack-declared triggers belong to the exact unit being attacked", () => {
  const self = parseCardAbilities({ id: "attacked-unit", text: "AUTO [RC]: When this unit is attacked, draw a card." })[0];
  assert.equal(self.trigger.eventType, "attack.declared");
  assert.equal(self.trigger.subject, "event-subject");
  const event = createGameEvent({ matchId: "attack-target" }, { type: "attack.declared", actingPlayerId: "attacker-player", sourceCardInstanceId: "attacker-copy", subjectCardInstanceId: "defender-copy", currentLocation: "rear-left", targetLocation: "rear-left", battleId: "battle-a" });
  assert.equal(eventMatchesAbilityTrigger(self, "attacked", event, "defender-copy", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(self, "attacked", event, "other-defender", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(self, "attacked", event, "defender-copy", "vanguard", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(self, "attack", event, "defender-copy", "rear-left", "rear-left"), false);
  const another = parseCardAbilities({ id: "another-attacked", text: "AUTO [RC]: When another unit is attacked, draw a card." })[0];
  assert.equal(eventMatchesAbilityTrigger(another, "attacked", event, "another-attacked-copy", "rear-right", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(another, "attacked", event, "defender-copy", "rear-left", "rear-left"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /queueAbilityPrompts\("attacked",defenderSide,target\.uid/);
  assert.match(app, /queueAbilityPrompts\("attacked","human",target\.uid/);
});

test("same-circle placement abilities match the exact source circle and exclude the source card", () => {
  const ability=parseCardAbilities({id:"circle-watch",text:"AUTO [RC]: When another unit is placed on this unit's circle, draw a card."})[0];
  assert.equal(ability.trigger.status,"recognized-trigger");
  assert.equal(ability.trigger.sameSourceCircle,true);
  assert.equal(ability.trigger.excludeSourceAsSubject,true);
  const event=createGameEvent({matchId:"same-circle"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"placed-card",subjectCardInstanceId:"placed-card",currentLocation:"rear-left"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"watcher-card","rear-left","rear-left"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"watcher-card","rear-right","rear-left"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"vanguard"},"watcher-card","rear-left","rear-left"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:null},"watcher-card","rear-left","rear-left"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,subjectCardInstanceId:"watcher-card"},"watcher-card","rear-left","rear-left"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"watcher-card","vanguard","rear-left"),false);
});

test("attack triggers preserve target-circle requirements", () => {
  const ability = parseCardAbilities({ id: "attack-target", text: "AUTO [RC]: When this unit attacks a vanguard, this unit gets power +2000 until end of battle." })[0];
  assert.equal(ability.trigger.targetLocation, "vanguard");
  const sourceAttack = createGameEvent({ matchId: "target-test" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "attacker", targetLocation: "vanguard" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", sourceAttack, "attacker", "rear-left", "rear-left"), true);
  const rearAttack = createGameEvent({ matchId: "target-test" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "attacker", targetLocation: "rear-guard" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", rearAttack, "attacker", "rear-left", "rear-left"), false);
});

test("recognizes ride-over triggers by the ridden card instance and flags unknown AUTO text", () => {
  const [forerunner, unknown] = parseCardAbilities({ id: "ride-examples", text: "[AUTO](RC): When another unit is placed on (VC) by riding this unit, you may call this card to (RC).\n[AUTO](RC): When this unit is retired, draw a card." });
  assert.equal(forerunner.trigger.eventType, "card.ridden");
  assert.equal(forerunner.trigger.subject, "event-target");
  const rideEvent = createGameEvent({ matchId: "ride-target-test" }, {
    type: "card.ridden", actingPlayerId: "p1", subjectCardInstanceId: "rider", targetCardInstanceIds: ["ridden-source"],
    targetPreviousLocation: "vanguard", targetCurrentLocation: "soul"
  });
  assert.equal(eventMatchesAbilityTrigger(forerunner, "ride", rideEvent, "ridden-source", "rear-left", "vanguard"), true);
  assert.equal(eventMatchesAbilityTrigger(forerunner, "ride", rideEvent, "unrelated-unit", "rear-left", "vanguard"), false);
  assert.equal(forerunner.implementationStatus, "trigger-definition-pending-validation");
  assert.equal(unknown.trigger.status, "recognized-trigger");
  assert.equal(unknown.implementationStatus, "trigger-definition-pending-validation");
});

test("only optional AUTO abilities can be declined; ACT activations can be canceled", () => {
  assert.equal(canDeclineAbility({ kind: "AUTO", canDecline: false }), false);
  assert.equal(canDeclineAbility({ kind: "AUTO", canDecline: true }), true);
  assert.equal(canDeclineAbility({ kind: "ACT", canDecline: true }), true);
  assert.equal(canDeclineAbility(null), false);
});

test("only printed ACT abilities may be manually activated", () => {
  assert.equal(isManuallyActivatable({ kind: "ACT" }), true);
  assert.equal(isManuallyActivatable({ kind: "AUTO", once: true }), false);
  assert.equal(isManuallyActivatable({ kind: "CONT", once: true }), false);
  assert.equal(isManuallyActivatable(null), false);
});

test("a compiled Cannot Be Ridden CONT blocks ride candidates without misclassifying other cards",()=>{
  const card={id:"cannot-ride",text:"CONT: This card cannot be ridden."},ability=parseCardAbilities(card)[0];
  assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition?.keywords,["cannot-be-ridden"]);assert.equal(isManuallyActivatable(ability),false);
  assert.equal(canRideCard(card),false);assert.equal(canRideCard({id:"ordinary-unit",text:"AUTO: When placed, draw a card."}),true);assert.equal(canRideCard({id:"no-skills",text:""}),true);
  const app=fs.readFileSync("app.js","utf8");
  assert.match(app,/function rideHuman\(\)[\s\S]{0,400}canRideCard\(cardMap\.get\(instance\.cardId\),\{vanguardCard:/);
  assert.match(app,/function performSuperiorRide\([\s\S]{0,1500}canRideCard\(cardMap\.get\(instance\.cardId\),\{vanguardCard:/);
  assert.ok(app.includes("nextRide&&window.VanguardAbilityEngine.canRideCard(nextRide.c,rideContext)"));
});

test("Crest ride restriction compares the candidate against its controller's current Vanguard",()=>{
  const crest={id:"kiwame-crest",type:"Crest",text:"CONT: You cannot ride a unit with a different card name from your vanguard."};
  const vanguard={id:"vanguard-a",name:"Alpha Vanguard",text:""},sameName={id:"alpha-ride",name:"Alpha Vanguard",text:""},differentName={id:"beta-ride",name:"Beta Vanguard",text:""};
  assert.equal(canRideCard(sameName,{vanguardCard:vanguard,crests:[crest]}),true);
  assert.equal(canRideCard(differentName,{vanguardCard:vanguard,crests:[crest]}),false);
  assert.equal(canRideCard(differentName,{vanguardCard:vanguard,crests:[]}),true);
  const aliasVanguard={id:"alias-vanguard",name:"Current Vanguard",text:"CONT: This card is also regarded as \"Legacy Vanguard\"."},aliasRide={id:"alias-ride",name:"Legacy Vanguard",text:""};
  assert.equal(canRideCard(aliasRide,{vanguardCard:aliasVanguard,crests:[crest]}),true);
  const app=fs.readFileSync("app.js","utf8");
  assert.match(app,/canRideCard\(cardMap\.get\(instance\.cardId\),\{vanguardCard:cardMap\.get\(p\.vanguard\?\.cardId\),crests:/);
  assert.match(app,/canRideCard\(cardMap\.get\(instance\.cardId\),\{vanguardCard:cardMap\.get\(player\.vanguard\?\.cardId\),crests:/);
  assert.match(app,/const rideContext=\{vanguardCard:cardMap\.get\(bot\.vanguard\?\.cardId\),crests:/);
});

test("named grade CONT ride restrictions compile and reject illegal source Vanguard grade or name",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),ids=["cfa-10425","cfa-10825","cfa-10847","cfa-10860","cfa-10892","cfa-11016","cfa-11611","cfa-11679","cfa-11851"],catalog=loadCatalog();
 for(const id of ids){const card=catalog.find(item=>item.id===id);assert.ok(card,id);const ability=parseCardAbilities(card).find(item=>item.definition?.source?.patternId==="cont-ride-from-grade-and-named-vanguard-v1");assert.ok(ability,id);assert.equal(ability.kind,"CONT",id);assert.deepEqual(ability.definition.effects,undefined,id);assert.equal(ability.definition.continuousRestrictions.length,1,id);const restriction=ability.definition.continuousRestrictions[0],legalVanguard={id:`${id}-vg`,name:`Grade ${restriction.grade} ${restriction.name} Vanguard`,grade:restriction.grade,text:""};assert.equal(canRideCard(card,{vanguardCard:legalVanguard}),true,id);assert.equal(canRideCard(card,{vanguardCard:{...legalVanguard,grade:restriction.grade-1}}),false,id);assert.equal(canRideCard(card,{vanguardCard:{...legalVanguard,name:"Different Vanguard"}}),false,id);assert.equal(canRideCard(card,{}),false,id);}
});

test("Restraint is a passive attack restriction only while this unit is on VC or RC",()=>{
  const card={id:"restraint-unit",text:"CONT [VC/RC]: Restraint (This unit cannot attack.)"},ability=parseCardAbilities(card)[0];
  assert.equal(ability.kind,"CONT");assert.equal(ability.definition?.source?.patternId,"cont-vc-rc-restraint-cannot-attack-v1");assert.deepEqual(ability.definition?.keywords,["restraint"]);assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);assert.equal(isManuallyActivatable(ability),false);
  const source={uid:"restrained-copy"};
  for(const location of ["vanguard","rear-guard"]){const result=evaluateContinuousRestrictions([ability],{location,sourceInstanceId:source.uid,sourceCard:card});assert.equal(result.legal,false);assert.equal(result.restrictions[0].type,"restraint")}
  assert.equal(evaluateContinuousRestrictions([ability],{location:"guardian",sourceInstanceId:source.uid,sourceCard:card}).legal,true);
  assert.equal(evaluateContinuousRestrictions([ability],{location:"hand",sourceInstanceId:source.uid,sourceCard:card}).legal,true);
  const app=fs.readFileSync("app.js","utf8");assert.match(app,/const restriction=continuousAttackRestriction\(field\);if\(!restriction\.legal\)/);assert.match(app,/return field&&continuousAttackRestriction\(field\)\.legal/);
});

test("dual-circle Intercept CONT grants the keyword and continuous shield on RC and GC",()=>{
  const card={id:"intercept-grant",text:"CONT [RC/GC]: This unit gets \"Intercept\", and it gets shield +5000."},ability=parseCardAbilities(card)[0];
  assert.equal(ability.kind,"CONT");assert.equal(ability.definition?.source?.patternId,"cont-rc-gc-grant-intercept-shield-v1");assert.deepEqual(ability.requiredLocation,["rear-guard","guardian"]);assert.deepEqual(ability.definition?.keywords,["intercept"]);assert.equal(isManuallyActivatable(ability),false);assert.equal(hasAbilityKeyword(card,"intercept"),true);
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"rear-guard"}),{shield:5000});assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian"}),{shield:5000});assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"vanguard"}),{shield:0});assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"hand"}),{shield:0});
  const app=fs.readFileSync("app.js","utf8");assert.match(app,/function hasIntercept\(card\)[\s\S]{0,260}definition\?\.keywords\?\.includes\("intercept"\)/);assert.match(app,/function eligibleInterceptors\(\)[\s\S]{0,700}hasIntercept\(cardMap\.get\(unit\.cardId\)\)/);assert.doesNotMatch(app,/eligibleInterceptors\(\)[\s\S]{0,500}Number\(cardMap\.get\(unit\.cardId\)\?\.grade\) === 2/);
});

test("the app initializes and records the Grade 3+ ride fact on every ride path",()=>{
 const app=fs.readFileSync("app.js","utf8"),ride=app.slice(app.indexOf("function rideHuman()"),app.indexOf("function callUnitToRear(",app.indexOf("function rideHuman()"))),superior=app.slice(app.indexOf("function performSuperiorRide("),app.indexOf("function manualGameAction(",app.indexOf("function performSuperiorRide(")));assert.match(app,/rodeGradeThreePlusThisFight:\s*false/);assert.equal((app.match(/VanguardAbilityEngine\.recordFightRide\(/g)||[]).length,4);assert.match(ride,/recordFightRide\(p,/);assert.match(superior,/recordFightRide\(player,/);assert.ok(app.includes("window.VanguardAbilityEngine.recordFightRide(bot,ride.c)"));assert.ok(app.includes("window.VanguardAbilityEngine.recordFightRide(player,cardMap.get(instance.cardId))"));
});
test("models Battle Sister, Cocoa clan condition while keeping it subject to validation", () => {
  const cocoa = parseCardAbilities({
    id: "cfa-2",
    text: "AUTO: When this unit is placed on VC or RC, if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on the top or the bottom of your deck."
  })[0];
  assert.equal(cocoa.trigger.eventType, "card.placed");
  assert.deepEqual(cocoa.trigger.circles, ["vanguard", "rear-guard"]);
  assert.equal(cocoa.conditionStatus, "modeled");
  assert.deepEqual(cocoa.conditions, [{ type: "controller-vanguard-has-clan", value: "Oracle Think Tank" }]);
  assert.equal(evaluateAbilityConditions(cocoa, { vanguardClans: ["Oracle Think Tank"] }), true);
  assert.equal(evaluateAbilityConditions(cocoa, { vanguardClans: ["Shadow Paladin"] }), false);
  assert.equal(cocoa.implementationStatus, "structured-effect-definition");
});
test("requires the exact source instance, declared event, and legal circle before an AUTO is eligible", () => {
  const attack = parseCardAbilities({ id: "attacker-skill", text: "[AUTO](RC): When this unit attacks, draw a card." })[0];
  const event = createGameEvent({ matchId: "m" }, { eventId: "m:a1", type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "copy-1", subjectCardInstanceId: "copy-1" });
  assert.equal(eventMatchesAbilityTrigger(attack, "attack", event, "copy-1", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(attack, "attack", event, "copy-2", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(attack, "place", event, "copy-1", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(attack, "attack", event, "copy-1", "vanguard", "vanguard"), false);
});

test("rejects a recognized trigger until an unparsed mandatory condition is modeled", () => {
  const ability = parseCardAbilities({ id: "conditional", text: "AUTO: When this unit is placed on VC or RC, if you have an Oracle Think Tank vanguard, draw a card." })[0];
  const event = createGameEvent({ matchId: "m" }, { eventId: "m:p1", type: "card.placed", actingPlayerId: "p1", sourceCardInstanceId: "copy-1", subjectCardInstanceId: "copy-1" });
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "copy-1", "rear-left", "rear-left"), false);
});
test("supports the two real Megacolony Battler C AUTO windows with exact ride and booster identities", () => {
  const abilities = parseCardAbilities({
    id: "cfa-megacolony-battler-c",
    text: "AUTO: Forerunner (When another unit from the same clan rides this unit, you may call this card to RC.)\nAUTO [RC]: [Counter Blast 1 & Put this unit into your soul] When an attack hits during the battle that this unit boosted, you may pay the cost. If you do, choose one of your opponent’s rear-guards, and that unit cannot stand during your opponent’s next stand phase."
  });
  const ride = abilities[0], hit = abilities[1];
  const rideEvent = createGameEvent({ matchId: "m" }, { eventId: "m:r1", type: "card.ridden", actingPlayerId: "p1", sourceCardInstanceId: "rider", subjectCardInstanceId: "starter" });
  const hitEvent = createGameEvent({ matchId: "m" }, { eventId: "m:h1", type: "attack.hit", actingPlayerId: "p1", sourceCardInstanceId: "attacker", subjectCardInstanceId: "attacker", boosterCardInstanceId: "booster" });
  assert.equal(ride.trigger.eventType, "card.ridden");
  assert.equal(eventMatchesAbilityTrigger(ride, "ride", rideEvent, "starter", "soul", "vanguard"), true);
  assert.equal(hit.trigger.eventType, "attack.hit");
  assert.deepEqual(hit.requiredLocation, ["rear-guard"]);
  assert.equal(hit.costStatus, "supported-cost");
  assert.deepEqual(hit.costs, [{type:"counter-blast",count:1},{type:"source-to-soul",count:1}]);
  assert.equal(eventMatchesAbilityTrigger(hit, "hit", hitEvent, "booster", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(hit, "hit", hitEvent, "different-copy", "rear-left", "rear-left"), false);
});
test("matches a cost-free boosted-attack hit trigger only to that battle's booster", () => {
  const ability=parseCardAbilities({id:"booster-hit",text:"[AUTO](RC): When an attack hits during the battle that this unit boosted, draw a card."})[0];
  const event=createGameEvent({matchId:"m"},{eventId:"m:h2",type:"attack.hit",actingPlayerId:"p1",sourceCardInstanceId:"attacker",boosterCardInstanceId:"booster"});
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"booster","rear-left","rear-left"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"other-booster","rear-left","rear-left"),false);
});
test("Vanguard attack-hit draw AUTO belongs only to its exact attacking Vanguard",()=>{
  const ability=parseCardAbilities({id:"cfa-6634",name:"Sabel Dragonewt",text:"AUTO [VC]: When its attack hits, draw a card."})[0];
  assert.equal(ability.definition?.source?.patternId,"auto-vanguard-own-attack-hit-draw-v1");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"attack.hit",subject:"source",circles:[]});
  const event=createGameEvent({matchId:"vg-hit"},{type:"attack.hit",actingPlayerId:"p1",sourceCardInstanceId:"vg-copy",sourceControllerPlayerId:"p1",subjectCardInstanceId:"vg-copy",subjectControllerPlayerId:"p1",targetCardInstanceIds:["opp-vg"],targetLocation:"vanguard",battleId:"battle-1"});
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"vg-copy","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"other-vg","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"vg-copy","rear-left","vanguard","p1"),false);
  const drawn=[],deck=[{uid:"top-card",cardId:"drawn"}],hand=[],effect=ability.definition.effects[0],player={deck,hand};assert.equal(EFFECT_HANDLERS.draw.validate(effect,{player}),true);assert.equal(EFFECT_HANDLERS.draw.apply(effect,{player,emitEvent:event=>drawn.push(event)}),1);assert.equal(hand[0].uid,"top-card");assert.deepEqual(drawn,[{type:"card.drawn",cardInstanceId:"top-card"}]);
});

test("collects every eligible ability from one event before resolving mandatory no-choice AUTO effects", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const scanStart = source.indexOf("match.collectingAbilityTriggers=true;", source.indexOf("function queueAbilityPrompts("));
  const scanEnd = source.indexOf("match.collectingAbilityTriggers=false;", scanStart);
  const resolve = source.indexOf("flushCollectedAbilityTriggers(immediate)", scanEnd);
  assert.ok(scanStart >= 0);
  assert.ok(scanEnd > scanStart);
  assert.ok(resolve > scanEnd);
});
test("mandatory no-choice AUTO resolution is independent of online mode", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const start = source.indexOf("function queueOneAbility(");
  const end = source.indexOf("function queueAbilityPrompts(", start);
  const queue = source.slice(start, end);
  assert.ok(queue.includes('if(ability.definition&&ability.kind==="AUTO"&&!ability.canDecline'));
  assert.ok(queue.includes('ability.choiceStatus==="no-explicit-choice-detected"'));
  assert.ok(queue.includes("immediate.resolveAfterEventScan=true"));
  assert.equal(queue.includes('online.role&&ability.definition'), false);
});

test("application routes AUTO eligibility through the exact-instance engine matcher", () => {
  const source = fs.readFileSync(require.resolve("./app.js"), "utf8");
  const movementStart=source.indexOf("function queueMovedCardAbility("), movementEnd=source.indexOf("function flushCollectedAbilityTriggers(",movementStart), movementQueue=source.slice(movementStart,movementEnd);
  const declarations = [...source.matchAll(/function abilityTriggerMatches\(/g)];
  assert.equal(declarations.length, 1);
  assert.match(declarations[0][0] + source.slice(declarations[0].index, declarations[0].index + 240), /eventMatchesAbilityTrigger/);
  assert.ok(source.includes('sourceToSoul:abilityCostCount(ability,"source-to-soul",ability.costAlternatives?.[x.costAlternativeIndex])'));
  assert.ok(source.includes('costs={cb:abilityCostCount(ability,"counter-blast",ability.costAlternatives?.[x.costAlternativeIndex])'));
  assert.match(source, /resolveEffectProgram\(definition\.effects,handlers,context,draft=>/);
  assert.ok(source.includes("function abilityUsed(side,instanceUid,abilityOrId)"));
  assert.ok(source.includes("abilityUsageKey(match.turn,player.playerId||side,instanceUid,id,ability?.usageRestriction,name,ability?.printedText||ability?.raw)"));
  assert.match(movementQueue, /createGameEvent\(match/);
  assert.match(movementQueue, /card\.retired/);
  assert.match(movementQueue, /previousLocation,currentLocation/);
  assert.match(fs.readFileSync("ability-engine.js", "utf8"), /type:"card\.discarded"/);
  assert.match(source, /queueMovedCardAbility\(cost,"human","discard","hand",\{discardReason:"g-guardian-cost",calledGUnitCardId:instance\.cardId,calledGUnitInstanceId:instance\.uid,calledGUnitCardName:guardian\.name\|\|null,calledGUnitPreviousLocation:"g-deck"\}\)/);
  assert.match(source, /payment\.forEach\(cost=>queueMovedCardAbility\(cost,"human","discard","hand",\{discardReason:"stride-cost",timingWindow:"stride-cost"\}\)\)/);
  assert.match(source, /queueMovedCardAbility\(discardCost,"bot","discard","hand"\)/);
  assert.match(source, /queueMovedCardAbility\(heal,"bot","discard","hand",\{discardReason:"g-guardian-cost",calledGUnitCardId:gGuardian\.cardId,calledGUnitInstanceId:gGuardian\.uid,calledGUnitCardName:cardMap\.get\(gGuardian\.cardId\)\?\.name\|\|null,calledGUnitPreviousLocation:"g-deck"\}\)/);
  assert.doesNotMatch(source, /queueAbilityPrompts\("damageLeave",x.side,card.uid/);
  assert.match(source, /targetZone:zone,boostUid:setup\.boostUid/);
  assert.match(source, /evaluateAbilityConditions\(a,/);
  assert.match(source, /validateRemoteRequest\(match,message,match\.players\.bot\.playerId\)/);
  assert.equal([...source.matchAll(/validateRemoteActionRequest\(match,message,match\.players\.bot\.playerId\)/g)].length, 2);
  assert.match(source, /claimRemoteRequest\(match,message\.actionId\)/);
  assert.match(source, /expectedStateVersion/);
  assert.match(source, /resolveReviewedAbility\(x,x\.ability\.definition\)/);
  assert.match(source, /resolveEffectProgram\(definition\.effects/);
  assert.ok(source.includes("canDeclineAbility(pending.ability)"));
  assert.ok(source.includes("sourceToSoul:abilityCostCount(ability,\"source-to-soul\",ability.costAlternatives?.[x.costAlternativeIndex])"));
  assert.ok(source.includes("met an AUTO trigger, but its effect is not reviewed and supported yet"));
  assert.ok(source.includes("!a.definition?.effects"));
  assert.ok(source.includes("This ability effect is not reviewed and supported yet; no cost was paid."));
  assert.ok(source.includes("#ability-decline"));
  assert.equal([...source.matchAll(/connection\.send\(\{\s*type:\s*"action"/g)].length, 0);
});

test("parses common explicit AUTO costs into structured requirements and checks affordability", () => {
  const ability = parseCardAbilities({ id: "costed-attack", text: "[AUTO](RC): COST [CB1 & SB1 & discard a card from your hand & rest this unit] When this unit attacks, draw a card." })[0];
  assert.equal(ability.costStatus, "supported-cost");
  const event = createGameEvent({ matchId: "m" }, { type: "unit.attacked", actingPlayerId: "p", sourceCardInstanceId: "source" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "source", "rear-left", "rear-left"), true);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }, { type: "soul-blast", count: 1 }, { type: "discard", count: 1 }, { type: "rest-source", count: 1 }]);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1, soulCount: 1, discardableHand: 1, sourceRested: false }), true);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1, soulCount: 1, discardableHand: 1, sourceRested: true }), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 0, soulCount: 1, discardableHand: 1, sourceRested: false }), false);
});

test("parses and enforces a source-to-soul ability cost", () => {
  const ability = parseCardAbilities({ id: "source-cost", text: "[AUTO](RC): COST [CB1 & put this unit into your soul] When an attack hits, draw a card." })[0];
  assert.equal(ability.costStatus, "supported-cost");
  assert.deepEqual(ability.costs, [{type:"counter-blast",count:1},{type:"source-to-soul",count:1}]);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1, sourceCanMoveToSoul: true }), true);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1, sourceCanMoveToSoul: false }), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 0, sourceCanMoveToSoul: true }), false);
});

test("parses a real Blaster Dark AUTO cost and requires its printed Vanguard placement", () => {
  const ability = parseCardAbilities({ id: "cfa-20", text: "AUTO: [Counter Blast 2] When this unit is placed on VC, you may pay the cost. If you do, choose one of your opponent’s rear-guards, and retire it." })[0];
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.deepEqual(ability.trigger.circles, ["vanguard"]);
  assert.equal(ability.costStatus, "supported-cost");
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 2 }]);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 2 }), true);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1 }), false);
});

test("evaluates modeled field, boost, and attack-target conditions from exact state", () => {
  const [emptyField, boosted, target] = parseCardAbilities({ id: "conditions", text: "AUTO: When this unit attacks, if you have no rear-guards, draw a card.\nAUTO: When this unit attacks, if this unit was boosted, draw a card.\nAUTO: When this unit attacks, if this unit attacks a vanguard, draw a card." });
  assert.equal(evaluateAbilityConditions(emptyField, { controllerRearGuards: 0 }), true);
  assert.equal(evaluateAbilityConditions(emptyField, { controllerRearGuards: 1 }), false);
  assert.equal(evaluateAbilityConditions(boosted, { sourceInstanceId: "attacker", eventSubjectInstanceId: "attacker", boosterInstanceId: "booster" }), true);
  assert.equal(evaluateAbilityConditions(boosted, { sourceInstanceId: "attacker", eventSubjectInstanceId: "other", boosterInstanceId: "booster" }), false);
  assert.equal(evaluateAbilityConditions(target, { eventTargetLocation: "vanguard" }), true);
  assert.equal(evaluateAbilityConditions(target, { eventTargetLocation: "rear-guard" }), false);
});

test("remote requests require a fresh ID and the current state version", () => {
  const state = { matchId: "room-1", stateVersion: 4, processedActionIds: [] };
  const request = { actionId: "guest-action-1", matchId: "room-1", actorPlayerId: "joiner", expectedStateVersion: 4 };
  assert.deepEqual(validateRemoteRequest(state, request), { ok: true });
  assert.equal(claimRemoteRequest(state, request.actionId), true);
  assert.equal(claimRemoteRequest(state, request.actionId), false);
  assert.deepEqual(validateRemoteRequest(state, request), { ok: false, reason: "duplicate-action" });
  assert.deepEqual(validateRemoteRequest(state, { actionId: "guest-action-2", expectedStateVersion: 3 }), { ok: false, reason: "stale-state-version", expected: 3, current: 4 });
  assert.equal(validateRemoteRequest(state, { expectedStateVersion: 4 }).reason, "missing-action-id");  assert.equal(validateRemoteRequest(state, { ...request, actionId: "guest-action-3" }, "host").reason, "wrong-actor");
  assert.equal(validateRemoteRequest(state, { ...request, actionId: "guest-action-4", matchId: "other-room" }, "joiner").reason, "wrong-match");
  assert.deepEqual(validateRemoteRequest(state, { ...request, actionId: "guest-action-5" }, "joiner"), { ok: true });
});

test("ability decisions validate match, joining-player identity, and exact controlled source", () => {
  const state = { matchId: "room-1", stateVersion: 3, processedActionIds: [] };
  const pending = { side: "bot", instance: { uid: "joiner-card", controllerPlayerId: "joiner" }, ability: { id: "card:0" } };
  const request = { matchId: "room-1", actorPlayerId: "joiner", actionId: "decision-1", expectedStateVersion: 3, accept: true, selection: { instanceUid: "joiner-card", abilityId: "card:0" } };
  assert.deepEqual(validateAbilityDecision(state, request, "joiner", pending), { ok: true });
  assert.equal(validateAbilityDecision(state, { ...request, matchId: "other-room" }, "joiner", pending).reason, "wrong-match");
  assert.equal(validateAbilityDecision(state, { ...request, actorPlayerId: "host" }, "joiner", pending).reason, "wrong-actor");
  assert.equal(validateAbilityDecision(state, { ...request, selection: { ...request.selection, instanceUid: "host-card" } }, "joiner", pending).reason, "wrong-ability");
  assert.equal(validateAbilityDecision(state, { ...request, actorPlayerId: "joiner" }, "joiner", { ...pending, instance: { ...pending.instance, controllerPlayerId: "host" } }).reason, "source-not-controlled");
});

test("remote ability decisions validate explicit choices and exact unique payment selections", () => {
  const state = { matchId: "decision-room", stateVersion: 2, processedActionIds: [], players: { guest: { playerId: "joiner", damage: [{ uid: "damage-1", faceDown: false }], soul: [], hand: [{ uid: "hand-1" }] } } };
  const pending = { instance: { uid: "owned-card", controllerPlayerId: "joiner" }, ability: { id: "owned-card:0", kind: "ACT", costs: [{ type: "counter-blast", count: 1 }, { type: "discard", count: 1 }] } };
  const request = { matchId: "decision-room", actorPlayerId: "joiner", actionId: "decision-costs", expectedStateVersion: 2, accept: true, selection: { instanceUid: "owned-card", abilityId: "owned-card:0", costSelections: { cb: ["damage-1"], discard: ["hand-1"] } } };
  assert.deepEqual(validateAbilityDecision(state, request, "joiner", pending), { ok: true });
  assert.equal(validateAbilityDecision(state, { ...request, accept: "yes" }, "joiner", pending).reason, "invalid-decision");
  assert.equal(validateAbilityDecision(state, { ...request, actionId: "missing-cost", selection: { ...request.selection, costSelections: { cb: [], discard: ["hand-1"] } } }, "joiner", pending).reason, "invalid-cost-selection");
  assert.equal(validateAbilityDecision(state, { ...request, actionId: "duplicate-cost", selection: { ...request.selection, costSelections: { cb: ["damage-1"], discard: ["hand-1", "hand-1"] } } }, "joiner", pending).reason, "invalid-cost-selection");
  assert.equal(validateAbilityDecision(state, { ...request, actionId: "extra-cost", selection: { ...request.selection, costSelections: { cb: ["damage-1"], sb: ["soul-1"], discard: ["hand-1"] } } }, "joiner", pending).reason, "invalid-cost-selection");
  assert.equal(validateAbilityDecision(state, { ...request, actionId: "opponent-hand-cost", selection: { ...request.selection, costSelections: { cb: ["damage-1"], discard: ["host-hand-card"] } } }, "joiner", pending).reason, "cost-card-unavailable");
  assert.equal(validateAbilityDecision({ ...state, players: { ...state.players, guest: { ...state.players.guest, damage: [{ uid: "damage-1", faceDown: true }] } } }, { ...request, actionId: "face-down-cost", selection: { ...request.selection, costSelections: { cb: ["damage-1"], discard: ["hand-1"] } } }, "joiner", pending).reason, "damage-not-face-up");
  assert.equal(validateAbilityDecision(state, { ...request, actionId: "unsupported-cost", selection: request.selection }, "joiner", { ...pending, ability: { ...pending.ability, costs: [{ type: "unknown-cost", count: 1 }] } }).reason, "unsupported-cost");
  assert.equal(validateAbilityDecision(state, { ...request, actionId: "malformed-cost-count", selection: request.selection }, "joiner", { ...pending, ability: { ...pending.ability, costs: [{ type: "source-to-soul", count: 2 }] } }).reason, "invalid-cost-definition");
  const decline = { ...request, actionId: "decline-choice", accept: false, selection: { instanceUid: "owned-card", abilityId: "owned-card:0" } };
  assert.deepEqual(validateAbilityDecision(state, decline, "joiner", pending), { ok: true });
  const mandatory = { ...pending, ability: { ...pending.ability, kind: "AUTO", canDecline: false } };
  assert.equal(validateAbilityDecision(state, { ...decline, actionId: "decline-mandatory" }, "joiner", mandatory).reason, "mandatory-ability");
  const optionalTextAuto={...pending,ability:{...pending.ability,kind:"AUTO",canDecline:true}};
  assert.deepEqual(validateAbilityDecision(state,{...decline,actionId:"decline-auto-whole"},"joiner",optionalTextAuto),{ok:true});
});

test("AUTO cost decisions may skip the entire post-cost effect without paying partial costs",()=>{
 const state={matchId:"auto-cost-room",stateVersion:4,processedActionIds:[]},pending={instance:{uid:"auto-card",controllerPlayerId:"guest"},ability:{id:"auto-card:0",kind:"AUTO",canDecline:true,costs:[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]}};
 const request={matchId:"auto-cost-room",actorPlayerId:"guest",actionId:"skip-cost",expectedStateVersion:4,accept:true,selection:{instanceUid:"auto-card",abilityId:"auto-card:0",payCost:false,costSelections:{cb:[],sb:[],discard:[],reveal:[]}}};
 assert.deepEqual(validateAbilityDecision(state,request,"guest",pending),{ok:true});
 assert.equal(validateAbilityDecision(state,{...request,actionId:"partial-cost",selection:{...request.selection,costSelections:{cb:["damage-a"],sb:[],discard:[],reveal:[]}}},"guest",pending).reason,"cost-not-skipped");
 assert.equal(validateAbilityDecision(state,{...request,actionId:"act-skip",selection:{...request.selection,payCost:false}},"guest",{...pending,ability:{...pending.ability,kind:"ACT"}}).reason,"cost-not-skipped");
 assert.equal(validateAbilityDecision(state,{...request,actionId:"malformed-skip",selection:{...request.selection,payCost:"no"}},"guest",pending).reason,"invalid-cost-decision");
});

test("AUTO cost planning is all-or-nothing and separates trigger resolution from post-cost effects",()=>{
 const ability={kind:"AUTO",costStatus:"supported-cost",costs:[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]};
 assert.deepEqual(evaluateAutoCostPayment(ability,{faceUpDamage:1,soulCount:1}),{ok:true,payCost:true,applyEffects:true});
 assert.deepEqual(evaluateAutoCostPayment(ability,{faceUpDamage:1,soulCount:0}),{ok:true,payCost:false,applyEffects:false,reason:"unpayable-cost"});
 assert.deepEqual(evaluateAutoCostPayment(ability,{faceUpDamage:1,soulCount:1},false),{ok:true,payCost:false,applyEffects:false,reason:"cost-not-paid"});
 assert.equal(evaluateAutoCostPayment({...ability,kind:"ACT"},{faceUpDamage:1,soulCount:1}).reason,"not-auto-ability");
 assert.deepEqual(evaluateAutoCostPayment({...ability,costs:[]}),{ok:true,payCost:true,applyEffects:true});
});

test("the app queues eligible AUTO abilities independently from cost payment and offers the owner a skip-cost choice",()=>{
 const app=fs.readFileSync("app.js","utf8"),requirements=app.slice(app.indexOf("function abilityRequirementsMet("),app.indexOf("function abilityTriggerMatches("));
 assert.match(requirements,/a\.kind!=="AUTO"&&!window\.VanguardAbilityEngine\.canPayAbilityCosts/);
 assert.match(app,/abilityCostPaymentAvailable\(ability,side,source\)\){const unpaid={side,field:source\.zone,instance:source\.instance,ability,eventContext,[\s\S]{0,250}skipCostPayment:true/);
 assert.match(app,/if\(x\.skipCostPayment&&ability\.kind==="AUTO"&&\(\(ability\.costs\|\|\[\]\)\.length\|\|\(ability\.costAlternatives\|\|\[\]\)\.length\)\)/);
 assert.match(app,/#ability-skip-cost/);
 assert.match(app,/pending\.skipCostPayment=selection\.payCost===false/);
});

test("remote mandatory ability declines are rejected before the pending queue changes", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const start = app.indexOf('if (online.role === "host" && message.type === "ability-response"');
  const end = app.indexOf('if (online.role === "watcher"', start);
  const handler = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(handler.indexOf("validateAbilityDecision") < handler.indexOf("queue.splice(queueIndex,1)"));
  const validator = fs.readFileSync("ability-engine.js", "utf8");
  assert.match(validator, /if \(!request\.accept\) return canDeclineAbility\(pending\.ability\) \? \{ ok: true \} : \{ ok: false, reason: "mandatory-ability" \}/);
});
test("AUTO decisions retain the controller who owned the ability when it became pending", () => {
  const state = { matchId: "room-1", stateVersion: 1, processedActionIds: [] };
  const pending = { side: "bot", triggerControllerPlayerId: "joiner", instance: { uid: "taken-card", controllerPlayerId: "host" }, ability: { id: "card:0" }, eventContext: { eventId: "room-1:e1" } };
  const request = { matchId: "room-1", actorPlayerId: "joiner", actionId: "decision-control-change", expectedStateVersion: 1, accept: true, selection: { instanceUid: "taken-card", abilityId: "card:0" } };
  assert.deepEqual(validateAbilityDecision(state, request, "joiner", pending), { ok: true });
  assert.equal(promotePendingAbilityForPlayer({ pendingAbility: null, pendingAbilities: [pending] }, "joiner", "bot"), pending);
});
test("online skill prompts are selected by controller identity for each local player", () => {
  const hostAbility = { side: "human", instance: { uid: "host-card", controllerPlayerId: "host" }, ability: { id: "host:0" } };
  const joinerAbility = { side: "bot", instance: { uid: "joiner-card", controllerPlayerId: "joiner" }, ability: { id: "joiner:0" } };
  const hostState = { pendingAbility: joinerAbility, pendingAbilities: [hostAbility] };
  assert.equal(promotePendingAbilityForPlayer(hostState, "host", "human"), hostAbility);
  assert.equal(hostState.pendingAbilities[0], joinerAbility);
  assert.equal(promotePendingAbilityForPlayer(hostState, "host", "human"), hostAbility);

  const guestState = { pendingAbility: null, pendingAbilities: [{ ...joinerAbility, side: "human" }, { ...hostAbility, side: "bot" }] };
  assert.equal(promotePendingAbilityForPlayer(guestState, "joiner", "human").instance.uid, "joiner-card");
  assert.equal(guestState.pendingAbilities[0].instance.uid, "host-card");
  assert.equal(promotePendingAbilityForPlayer(guestState, "host", "human"), null);

  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /promotePendingAbilityForPlayer\(match, localPlayerId, "human"\)/);
});

test("binds a reviewed real Key Anchor, Dabid ability to its original text and typed power effect", () => {
  const ability = parseCardAbilities({ id: "cfa-103", text: "Aqua Force/Aquaroid\n\nAUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.canDecline, true);
  assert.equal(ability.definition.source.snapshotDate, "2025-05-09");
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }]);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
});

test("Battle Sister, Cocoa uses a real reviewed trigger and a player-selected deck position", () => {
  const text="AUTO: When this unit is placed on VC or RC, if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on the top or the bottom of your deck.";
  const ability=parseCardAbilities({id:"cfa-2",text})[0];
  assert.equal(ability.implementationStatus,"structured-effect-definition");
  assert.deepEqual(ability.trigger.circles,["vanguard","rear-guard"]);
  assert.equal(ability.trigger.subject,"source");
  assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Oracle Think Tank"}),true);
  assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Shadow Paladin"}),false);
  const event=createGameEvent({matchId:"cocoa"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"cocoa-copy",subjectCardInstanceId:"cocoa-copy",currentLocation:"rear-left"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"cocoa-copy","rear-left","rear-left"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,subjectCardInstanceId:"different-copy"},"cocoa-copy","rear-left","rear-left"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other-copy","rear-left","rear-left"),false);
  const player={deck:[{uid:"bottom"},{uid:"revealed-top"}],hand:[]},source={uid:"cocoa-copy"},context={source,sourceInPlay:true,player,side:"p1",selectedCard:player.deck[1],deckDestination:"bottom",events:[],emitEvent(event){this.events.push(event)}};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.deepEqual(player.deck.map(card=>card.uid),["revealed-top","bottom"]);
  const invalidPlayer={deck:[{uid:"top"},{uid:"bottom"}],hand:[]},invalidContext={...context,player:invalidPlayer,selectedCard:invalidPlayer.deck[1],deckDestination:"hand"};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,invalidContext).ok,false);
  assert.deepEqual(invalidPlayer.deck.map(card=>card.uid),["top","bottom"]);
});

test("typed draw, Soul Charge, Counter-Charge, and temporary modifier handlers mutate only validated state", () => {
  const player = { deck: [{ uid: "bottom" }, { uid: "top" }], hand: [], soul: [], damage: [{ uid: "damage-a", faceDown: true }, { uid: "damage-b", faceDown: true }] };
  const emitted = []; const context = { player, side: "p1", source: { uid: "source", turnDriveBoost: 0 }, sourceInPlay: true, match: { pendingAttack: { attackerUid: "source", driveChecksRemaining: 1, maxDriveChecks: 1 } }, selectedDamageUids: ["damage-b"], emitEvent(event) { emitted.push(event); } };
  const result = resolveEffectProgram([{ op: "draw", count: 1 }, { op: "soul-charge", count: 1 }, { op: "counter-charge", count: 1 }, { op: "modify-drive", target: "source", amount: 1, duration: "turn" }], EFFECT_HANDLERS, context);
  assert.equal(result.ok, true);
  assert.deepEqual(player.hand.map(card => card.uid), ["top"]);
  assert.deepEqual(player.soul.map(card => card.uid), ["bottom"]);
  assert.equal(player.damage[0].faceDown, true);
  assert.equal(player.damage[1].faceDown, false);
  assert.equal(context.source.turnDriveBoost, 1);
  assert.equal(context.match.pendingAttack.driveChecksRemaining, 2);
  assert.equal(context.match.pendingAttack.maxDriveChecks, 2);
  assert.deepEqual(emitted.map(event => event.type), ["card.drawn", "card.moved"]);
  context.emitEvent({ type: "after-commit" }); assert.equal(emitted.length, 3);
  const invalid = resolveEffectProgram([{ op: "counter-charge", count: 2 }], EFFECT_HANDLERS, { ...context, selectedDamageUids: ["missing"] });
  assert.equal(invalid.ok, false);
});

test("loads a reviewed real Darkside Pegasus target effect and restricts it to another friendly Shadow Paladin", () => {
  const ability = parseCardAbilities({ id: "cfa-14", text: "Shadow Paladin/High Beast\n\nAUTO [RC]: When this unit is placed on RC, choose another of your «Shadow Paladin», and that unit gets power +2000 until end of turn." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.canDecline, false);
  assert.deepEqual(ability.effects[0].targetFilter, { controller: "source-controller", excludeSource: true, cardType: "unit", clan: "Shadow Paladin" });
  const source = { uid: "pegasus", controllerPlayerId: "p1" }, target = { uid: "ally", turnPowerBoost: 0 };
  const context = { source, sourceInPlay: true, side: "p1", match: {}, target, targetInPlay: true, sourceControllerPlayerId: "p1", targetControllerPlayerId: "p1", targetCard: { type: "Unit", clan: "Shadow Paladin" }, targetZone: "rear-left" };
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, context).ok, true);
  assert.equal(target.turnPowerBoost, 2000);
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { ...context, targetControllerPlayerId: "p2" }).ok, false);
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { ...context, target: source }).ok, false);
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { ...context, targetCard: { type: "Unit", clan: "Kagero" } }).ok, false);
});

test("strict real-card text template compiles unconditional own-attack battle power abilities", () => {
  const ironcutter = parseCardAbilities({ id: "cfa-63", text: "Megacolony/Insect\n\nAUTO [VC/RC]: When this unit attacks, this unit gets power +2000 until end of that battle." })[0];
  assert.equal(ironcutter.implementationStatus, "structured-effect-definition");
  assert.equal(ironcutter.definition.source.patternId, "auto-own-attack-power-battle-v1");
  assert.equal(ironcutter.id, "cfa-63:0");
  assert.deepEqual(ironcutter.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]);
  const ironEvent = createGameEvent({ matchId: "catalog-match" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "iron-copy" });
  assert.equal(eventMatchesAbilityTrigger(ironcutter, "attack", ironEvent, "iron-copy", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ironcutter, "attack", ironEvent, "different-copy", "rear-left", "rear-left"), false);

  const vanguard = parseCardAbilities({ id: "cfa-773", text: "AUTO [VC]: When this unit attacks, this unit gets power +5000 until end of that battle." })[0];
  assert.deepEqual(vanguard.effects, [{ op: "modify-power", target: "source", amount: 5000, duration: "battle" }]);

  const conditional = parseCardAbilities({ id: "cfa-27", text: "AUTO [RC]: When this unit attacks, if you have a vanguard with \"Blaster\" in its card name, this unit gets power +3000 until end of that battle." })[0];
  assert.equal(conditional.definition.source.patternId, "auto-own-attack-named-vanguard-power-battle-v1");
  assert.deepEqual(conditional.conditions, [{ type: "controller-vanguard-name-contains", value: "Blaster" }]);
  const otherUnit = parseCardAbilities({ id: "example", text: "AUTO [RC]: When another unit attacks, this unit gets power +3000 until end of that battle." })[0];
  assert.equal(otherUnit.definition, null);
});

test("legacy Vanguard attack power text retains source identity and battle duration",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
 for(const cardId of ["cfa-839","cfa-856","cfa-868"]){
  const card=loadCatalog().find(item=>item.id===cardId),ability=parseCardAbilities(card).find(item=>item.id===`${cardId}:1`);
  assert.ok(ability);assert.equal(ability.kind,"AUTO");assert.equal(ability.definition?.source?.patternId,"auto-own-attack-power-battle-v1");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.effects,[{op:"modify-power",target:"source",amount:4000,duration:"battle"}]);
  const event=createGameEvent({matchId:`${cardId}-attack`},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"source-copy"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"source-copy","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other-copy","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"source-copy","rear-left","rear-left","p1"),false);
 }
});

test("real Battering Minotaur AUTO requires its own attack and a payable Counter Blast", () => {
  const ability = parseCardAbilities({ id: "cfa-122", name: "Battering Minotaur", text: "Nova Grappler/Warbeast\n\nAUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until end of that battle." })[0];
  assert.equal(ability.definition.source.patternId, "auto-own-attack-counter-blast-power-battle-v1");
  assert.equal(ability.canDecline, true);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
  assert.deepEqual(ability.requiredLocation, ["vanguard", "rear-guard"]);
  const attack = createGameEvent({ matchId: "minotaur" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "minotaur-copy", subjectCardInstanceId: "minotaur-copy", targetLocation: "vanguard" });
  const unrelated = createGameEvent({ matchId: "minotaur" }, { type: "card.drawn", actingPlayerId: "p1", sourceCardInstanceId: "minotaur-copy", subjectCardInstanceId: "minotaur-copy" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", attack, "minotaur-copy", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", attack, "other-copy", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "draw", unrelated, "minotaur-copy", "rear-left", "rear-left"), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 0 }), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1 }), true);
  const turnDuration = parseCardAbilities({ id: "attack-turn-template", text: "AUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn." })[0];
  assert.equal(turnDuration.definition.source.patternId, "auto-own-attack-counter-blast-power-battle-v1");
  assert.equal(turnDuration.effects[0].duration, "turn");
  const source = { uid: "minotaur-copy", turnPowerBoost: 0 }, match = { pendingAttack: { attackerUid: "minotaur-copy", power: 9000 } };
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { source, sourceInPlay: true, side: "p1", match }).ok, true);
  assert.equal(match.pendingAttack.power, 12000);
});

test("supports the real rode-upon draw AUTO only for the exact ridden starter and second player", () => {
  const ability = parseCardAbilities({ id: "cfa-12282", text: "AUTO: When this unit is rode upon, if you went second, draw a card.\n\n(You will be prompted to get the \"Energy Generator\" crest upon ride.)\n\n(Hold TAB to view the related card.)" })[0];
  assert.equal(ability.definition.source.patternId, "auto-rode-upon-second-player-draw-v1");
  assert.deepEqual(ability.conditions, [{ type: "controller-went-second" }]);
  assert.equal(evaluateAbilityConditions(ability, { controllerWentSecond: true }), true);
  assert.equal(evaluateAbilityConditions(ability, { controllerWentSecond: false }), false);
  const event = createGameEvent({ matchId: "ride-draw" }, { type: "card.ridden", actingPlayerId: "p1", sourceCardInstanceId: "rider", subjectCardInstanceId: "rider", targetCardInstanceIds: ["starter"], targetPreviousLocation: "vanguard", targetCurrentLocation: "soul", targetLocation: "vanguard", previousLocation: "hand", currentLocation: "vanguard" });
  assert.equal(eventMatchesAbilityTrigger(ability, "ride", event, "starter", "vanguard", "vanguard"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "ride", event, "another-starter", "vanguard", "vanguard"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "ride", event, "starter", "rear-left", "rear-left"), false);
  const pending = { triggerControllerPlayerId: "p1", eventContext: { eventId: event.eventId } }, starter = { uid: "starter", controllerPlayerId: "p1" };
  assert.equal(canResolveAbilitySource(ability, pending, "p1", starter, false), true);
  assert.equal(canResolveAbilitySource(ability, pending, "p2", starter, false), false);
  assert.equal(canResolveAbilitySource({ kind: "ACT" }, pending, "p1", starter, false), false);
  assert.equal(canResolveAbilitySource(ability, { triggerControllerPlayerId: "p1", eventContext: {} }, "p1", starter, false), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /createRideGameEvent\(match,/);
  assert.match(app, /subjectZone:eventName==="ride"\?structuredEvent\.targetLocation/);
  assert.match(app, /findMatchInstance\(x\.instance\?\.uid\)/);
});
test("compiles common named-Vanguard attack boosts with exact attacker and card-name requirements", () => {
  const ability = parseCardAbilities({ id: "cfa-27", text: "AUTO [RC]: When this unit attacks, if you have a vanguard with \"Blaster\" in its card name, this unit gets power +3000 until end of that battle." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.definition.source.patternId, "auto-own-attack-named-vanguard-power-battle-v1");
  assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-name-contains", value: "Blaster" }]);
  assert.equal(evaluateAbilityConditions(ability, { vanguardName: "Blaster Dark" }), true);
  assert.equal(evaluateAbilityConditions(ability, { vanguardName: "Dragonic Overlord" }), false);
  const event = createGameEvent({ matchId: "named-vg" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "masquerade" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "masquerade", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "other-unit", "rear-left", "rear-left"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /vanguardName:vanguard\?\.name/);
});
test("own-Vanguard attack power template requires this exact attacker and Vanguard target", () => {
  const ability = parseCardAbilities({ id: "cfa-523", text: "AUTO [VC]: When this unit attacks a vanguard, this unit gets power +2000 until end of that battle." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.definition.source.patternId, "auto-own-attack-vanguard-power-battle-v1");
  assert.equal(ability.trigger.targetLocation, "vanguard");
  assert.deepEqual(ability.effects, [{ op: "modify-power", target: "source", amount: 2000, duration: "battle" }]);
  const event = createGameEvent({ matchId: "vg-attack-template" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "attacker", targetLocation: "vanguard" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "attacker", "vanguard", "vanguard"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "other-unit", "rear-left", "vanguard"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", { ...event, targetLocation: "rear-guard" }, "attacker", "vanguard", "vanguard"), false);
  const source = { uid: "attacker", turnPowerBoost: 0 }, match = { pendingAttack: { attackerUid: "attacker", targetZone: "vanguard", power: 9000 } };
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { source, sourceInPlay: true, side: "p1", match }).ok, true);
  assert.equal(match.pendingAttack.power, 11000);

  const rearAttack = parseCardAbilities({ id: "different", text: "AUTO [RC]: When this unit attacks a rear-guard, this unit gets power +3000 until end of that battle." })[0];
  assert.equal(rearAttack.definition, null);
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  for(const cardId of ["cfa-918","cfa-1027","cfa-2028","cfa-2233","cfa-2465","cfa-2598","cfa-2900"]){
    const card=loadCatalog().find(item=>item.id===cardId),actual=parseCardAbilities(card).find(item=>item.definition?.source?.patternId==="auto-own-attack-vanguard-power-battle-v1");
    assert.ok(actual,cardId);assert.equal(actual.trigger?.targetLocation,"vanguard");assert.deepEqual(actual.requiredLocation,cardId==="cfa-2028"||cardId==="cfa-2598"?["rear-guard"]:["vanguard"]);
    const realEvent=createGameEvent({matchId:`${cardId}-own-vanguard-attack`},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"source-copy",targetLocation:"vanguard"});
    assert.equal(eventMatchesAbilityTrigger(actual,"attack",realEvent,"source-copy",actual.requiredLocation[0],actual.requiredLocation[0],"p1"),true);
    assert.equal(eventMatchesAbilityTrigger(actual,"attack",realEvent,"other-copy",actual.requiredLocation[0],actual.requiredLocation[0],"p1"),false);
  }
});

test("clan-vanguard attack-power template enforces source, Vanguard target, and clan condition", () => {
  const ability = parseCardAbilities({ id: "cfa-71", text: "Megacolony/Insect\n\nAUTO [VC/RC]: When this unit attacks a vanguard, if you have a «Megacolony» vanguard, this unit gets power +2000 until end of that battle." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.definition.source.patternId, "auto-own-attack-vanguard-clan-power-battle-v1");
  assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: "Megacolony" }]);
  assert.equal(ability.trigger.targetLocation, "vanguard");
  assert.equal(ability.conditionStatus, "modeled");
  assert.equal(evaluateAbilityConditions(ability, { vanguardClan: "Megacolony" }), true);
  assert.equal(evaluateAbilityConditions(ability, { vanguardClan: "Kagero" }), false);

  const event = createGameEvent({ matchId: "clan-template" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "lady-butterfly", targetLocation: "vanguard" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "lady-butterfly", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", { ...event, sourceCardInstanceId: "other-unit" }, "lady-butterfly", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", { ...event, targetLocation: "rear-guard" }, "lady-butterfly", "rear-left", "rear-left"), false);
  const source = { uid: "lady-butterfly", turnPowerBoost: 0 };
  const match = { pendingAttack: { attackerUid: source.uid, power: 8000 } };
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { source, sourceInPlay: true, side: "p1", match }).ok, true);
  assert.equal(match.pendingAttack.power, 10000);
});

test("real Demon World Castle, DonnerSchlag attack AUTO is limited to its own VC or RC battle", () => {
  const ability = parseCardAbilities({ id: "cfa-24", text: "Shadow Paladin/Golem\n\nCONT [VC/RC]: If you do not have a unit named \"Phantom Blaster Dragon\" or a unit named \"Blaster Dark\" on your VC, this unit gets power -5000.\n\nAUTO [VC/RC]: When this unit attacks, this unit gets power +2000 until end of that battle." })[1];
  assert.equal(ability.id, "cfa-24:1");
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.trigger.eventType, "unit.attacked");
  const event = createGameEvent({ matchId: "battle-room" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "donner-schlag", sourceControllerPlayerId: "p1" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "donner-schlag", "vanguard", "vanguard"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", event, "other-unit", "rear-left", "rear-left"), false);
  const source = { uid: "donner-schlag", turnPowerBoost: 0 };
  const match = { pendingAttack: { attackerUid: source.uid, power: 9000 } };
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { source, sourceInPlay: true, side: "p1", match }).ok, true);
  assert.equal(match.pendingAttack.power, 11000);
  assert.equal(source.turnPowerBoost, 0);
});

test("real Blaster Javelin CONT power is continuously derived from Soul state without activation", () => {
  const ability = parseCardAbilities({ id: "cfa-12", text: "Shadow Paladin/Human\n\nCONT [VC]: If you have a card named \"Fullbau\" in your soul, this unit gets power +2000.\n\nAUTO: [Choose a grade 3 «Shadow Paladin» from your hand, and discard it] When this unit is placed on RC, you may pay the cost." })[0];
  assert.equal(ability.kind, "CONT");
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(isManuallyActivatable(ability), false);
  assert.deepEqual(evaluateContinuousEffects([ability], { soulCardNames: [], location: "vanguard" }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(evaluateContinuousEffects([ability], { soulCardNames: ["Fullbau"], location: "vanguard" }), { power: 2000, critical: 0, drive: 0 });
  assert.deepEqual(evaluateContinuousEffects([ability], { soulCardNames: ["Blaster Javelin"], location: "vanguard" }), { power: 0, critical: 0, drive: 0 });  assert.deepEqual(evaluateContinuousEffects([ability], { soulCardNames: ["Fullbau"], location: "rear-guard" }), { power: 0, critical: 0, drive: 0 });
  assert.deepEqual(evaluateContinuousEffects([ability], { soulCardNames: ["Fullbau"] }), { power: 0, critical: 0, drive: 0 });
});

test("unit target filters accept real Trigger unit types and reject non-units", () => {
  assert.equal(matchesTargetFilter({ cardType: "unit" }, { targetCard: { type: "Trigger" } }), true);
  assert.equal(matchesTargetFilter({ cardType: "unit" }, { targetCard: { type: "G Unit" } }), true);
  assert.equal(matchesTargetFilter({ cardType: "unit" }, { targetCard: { type: "Set Order" } }), false);
  const friendly = { controller: "source-controller" };
  assert.equal(matchesTargetFilter(friendly, { targetControllerPlayerId: undefined, sourceControllerPlayerId: undefined }), false);
  assert.equal(matchesTargetFilter(friendly, { targetControllerPlayerId: "p1", sourceControllerPlayerId: "p1" }), true);
  assert.equal(matchesTargetFilter(friendly, { targetControllerPlayerId: "p2", sourceControllerPlayerId: "p1" }), false);
  assert.equal(matchesTargetFilter({ controller: "opponent" }, { targetControllerPlayerId: "p2", opponentPlayerId: undefined }), false);
  assert.equal(matchesTargetFilter({ controller: "opponent" }, { targetControllerPlayerId: "p2", opponentPlayerId: "p2" }), true);
  const rear = { zone: "rear-guard" };
  assert.equal(matchesTargetFilter(rear, { targetZone: "rear-back-center" }), true);
  assert.equal(matchesTargetFilter(rear, { targetZone: "accel-2" }), true);
  for (const targetZone of ["vanguard", "guardian", "soul", null]) assert.equal(matchesTargetFilter(rear, { targetZone }), false);
  assert.equal(matchesTargetFilter({ zone: "vanguard" }, { targetZone: "rear-left" }), false);
});

test("named-unit boost template requires the exact boosted card and only modifies that battle", () => {
  const ability = parseCardAbilities({ id: "cfa-514", text: "Shadow Paladin/Human\n\nAUTO [RC]: When this unit boosts a unit named \"Chain-attack Sutherland\", the boosted unit gets power +4000 until end of that battle." })[0];
  assert.equal(ability.implementationStatus, "structured-effect-definition");
  assert.equal(ability.definition.source.patternId, "auto-boosts-named-unit-power-battle-v1");
  assert.deepEqual(ability.effects, [{ op: "modify-power-target", target: "boosted-unit", amount: 4000, duration: "battle", targetFilter: { controller: "source-controller", cardType: "unit", cardName: "Chain-attack Sutherland" } }]);
  const event = createGameEvent({ matchId: "boost-template" }, { type: "unit.boosted", actingPlayerId: "p1", sourceCardInstanceId: "booster", boosterCardInstanceId: "booster", boostedCardInstanceId: "named-unit", boostedCardName: "Chain-attack Sutherland" });
  assert.equal(eventMatchesAbilityTrigger(ability, "boost", event, "booster", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "boost", { ...event, sourceCardInstanceId: "other-booster" }, "booster", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "boost", { ...event, boostedCardName: "Other Unit" }, "booster", "rear-left", "rear-left"), false);

  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /boostedCardName:eventContext\.boostedCardName/);
  assert.match(app, /targetCard\?\.name\|\|""\)\.toLowerCase\(\)!==named\.trim\(\)\.toLowerCase\(\)/);
  const source = { uid: "booster", turnPowerBoost: 0 }, target = { uid: "named-unit", turnPowerBoost: 0 };
  const match = { pendingAttack: { attackerUid: target.uid, power: 9000 } };
  const context = { source, sourceInPlay: true, target, targetInPlay: true, sourceControllerPlayerId: "p1", targetControllerPlayerId: "p1", targetCard: { type: "Unit", name: "Chain-attack Sutherland" }, targetZone: "rear-left", match, side: "p1" };
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, context).ok, true);
  assert.equal(match.pendingAttack.power, 13000);
  assert.equal(resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { ...context, targetCard: { type: "Unit", name: "Chain-attack Sutherland SP" } }).ok, false);

  const extraEffect = parseCardAbilities({ id: "cfa-104", text: "AUTO [RC]: When this unit boosts, the boosted unit gets power +3000 until end of that battle, and at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck." })[0];
  assert.equal(extraEffect.implementationStatus, "structured-effect-definition");
  assert.equal(extraEffect.definition.source.patternId, "auto-boost-power-battle-then-return-self-end-phase-v1");
  assert.deepEqual(extraEffect.effects, [
    { op: "modify-power-target", target: "boosted-unit", amount: 3000, duration: "battle", targetFilter: { controller: "source-controller", cardType: "unit" } },
    { op: "schedule-source-return-to-deck-at-turn-end", target: "source", due: "end-phase-start", shuffle: true }
  ]);
});

test("real Doranbau and Gururubau abilities bind boost and attack effects to the current battle", () => {
  const doranbau = parseCardAbilities({ id: "cfa-16", text: "Shadow Paladin/High Beast\n\nAUTO [RC]: When this unit boosts a unit named \"Blaster Dark\", the boosted unit gets power +4000 until end of that battle." })[0];
  assert.equal(doranbau.implementationStatus, "structured-effect-definition");
  assert.equal(doranbau.trigger.eventType, "unit.boosted");
  const boosted = { uid: "blaster-dark", turnPowerBoost: 0 };
  const battle = { pendingAttack: { attackerUid: boosted.uid, battleId: "battle-1", power: 10000 } };
  const boostResult = resolveEffectProgram(doranbau.effects, EFFECT_HANDLERS, { source: { uid: "doranbau" }, sourceInPlay: true, side: "p1", match: battle, target: boosted, targetInPlay: true, sourceControllerPlayerId: "p1", targetControllerPlayerId: "p1", targetCard: { type: "Unit", name: "Blaster Dark" }, targetZone: "rear-left" });
  assert.equal(boostResult.ok, true);
  assert.equal(battle.pendingAttack.power, 14000);
  const gururubau = parseCardAbilities({ id: "cfa-17", text: "Shadow Paladin/High Beast\n\nAUTO [RC]: When this unit attacks a vanguard, if you have a «Shadow Paladin» vanguard, this unit gets power +2000 until end of that battle." })[0];
  assert.equal(gururubau.implementationStatus, "structured-effect-definition");
  assert.equal(gururubau.trigger.targetLocation, "vanguard");
  assert.equal(gururubau.conditionStatus, "modeled");
  const attackSource = { uid: "gururubau", turnPowerBoost: 0 };
  const attack = { pendingAttack: { attackerUid: attackSource.uid, battleId: "battle-2", power: 7000 } };
  assert.equal(resolveEffectProgram(gururubau.effects, EFFECT_HANDLERS, { source: attackSource, sourceInPlay: true, side: "p1", match: attack }).ok, true);
  assert.equal(attack.pendingAttack.power, 9000);
  assert.equal(attackSource.turnPowerBoost, 0);
  assert.equal(resolveEffectProgram(gururubau.effects, EFFECT_HANDLERS, { source: attackSource, sourceInPlay: true, side: "p1", match: { pendingAttack: { attackerUid: "other", power: 7000 } } }).ok, false);
});

test("validates every effect step before applying the ordered program", () => {
  const effects = [{ op: "modify-power", target: "source", amount: 3000, duration: "turn" }, { op: "draw", count: 1 }];
  const applied = [];
  const handlers = {
    "modify-power": { validate: () => true, apply: () => { applied.push("power"); } },
    draw: { validate: () => false, apply: () => { applied.push("draw"); } }
  };
  assert.deepEqual(validateEffectProgram(effects, handlers), { ok: false, reason: "invalid-effect", index: 1 });
  assert.equal(resolveEffectProgram(effects, handlers).ok, false);
  assert.deepEqual(applied, []);
  handlers.draw.validate = () => true;
  assert.deepEqual(resolveEffectProgram(effects, handlers), { ok: true, applied: 2, results: [undefined, undefined] });
  assert.deepEqual(applied, ["power", "draw"]);
});

test("resolves the reviewed source power effect and updates the current battle power", () => {
  const ability = parseCardAbilities({ id: "cfa-103", text: "Aqua Force/Aquaroid\n\nAUTO [VC/RC]: [Counter Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets power +3000 until the end of this turn." })[0];
  const source = { uid: "key-anchor", turnPowerBoost: 0 };
  const match = { pendingAttack: { attackerUid: source.uid, power: 10000 } };
  const context = { source, sourceInPlay: true, side: "p1", match };
  const result = resolveEffectProgram(ability.effects, EFFECT_HANDLERS, context);
  assert.equal(result.ok, true);
  assert.equal(source.turnPowerBoost, 3000);
  assert.equal(source.turnPowerExpiry, "p1");
  assert.equal(match.pendingAttack.power, 13000);
  const rejected = resolveEffectProgram(ability.effects, EFFECT_HANDLERS, { ...context, sourceInPlay: false });
  assert.equal(rejected.ok, false);
  assert.equal(source.turnPowerBoost, 3000);
});

test("claims each automatic ability once for a triggering event, even after decline", () => {
  const state = {};
  assert.equal(claimAbilityTrigger(state, "match:1", "copy-a", "card:0"), true);
  assert.equal(claimAbilityTrigger(state, "match:1", "copy-a", "card:0"), false);
  assert.equal(claimAbilityTrigger(state, "match:1", "copy-b", "card:0"), true);
  assert.equal(claimAbilityTrigger(state, "match:2", "copy-a", "card:0"), true);
});
test("effect programs roll back all state and defer events when a later handler rejects", () => {
  const source = { uid: "source", turnPowerBoost: 0 };
  const player = { hand: [{ uid: "card-a" }, { uid: "card-b" }], drop: [], deck: [] };
  const context = { source, sourceInPlay: true, player, side: "p1", events: [], emitEvent(event) { this.events.push(event); } };
  const handlers = {
    "modify-power": { validate: () => true, apply(step, draft) { draft.source.turnPowerBoost += step.amount; draft.emitEvent({ type: "power.changed" }); return true; } },
    "modify-critical": { validate: () => true, apply(_step, draft) { draft.player.hand.pop(); return false; } }
  };
  const result = resolveEffectProgram([
    { op: "modify-power", target: "source", amount: 3000, duration: "turn" },
    { op: "modify-critical", target: "source", amount: 1, duration: "turn" }
  ], handlers, context, draft => { const paid = draft.player.hand.shift(); draft.player.drop.push(paid); return true; });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "effect-handler-rejected");
  assert.equal(source.turnPowerBoost, 0);
  assert.deepEqual(player.hand.map(card => card.uid), ["card-a", "card-b"]);
  assert.deepEqual(player.drop, []);
  assert.deepEqual(context.events, []);
});
test("manual Soul Charge, damage placement, and Superior Ride preserve movement sources", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /queueMovedCardAbility\(top,\"human\",\"soulMove\",\"deck\",\{currentLocation:\"soul\"\}\)/);
  assert.match(app, /queueAbilityPrompts\(\"damagePlace\",side,top\.uid,\{zone:\"damage\",sourceZone:\"deck\",currentLocation:\"damage\"\}\)/);
  assert.match(app, /queueAbilityPrompts\(\"damagePlace\",\"human\",card\.uid,\{zone:\"damage\",sourceZone:\"hand\",currentLocation:\"damage\"\}\)/);
  assert.match(app, /source===\"damage\"\)queueAbilityPrompts\(\"damageLeave\",\"human\",instance\.uid,\{zone:\"damage\",currentLocation:\"vanguard\"/);
  assert.ok(app.includes('sourceZone:field?.zone||source,source,zone:"vanguard",currentLocation:"vanguard"'));
});

test("manual zone transfers and Guardian Circle departure emit non-discard movement events", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.ok(app.includes('queueMovedCardAbility(field.instance,"human","soulMove",field.zone,{currentLocation:"soul"})'));
  assert.ok(app.includes('queueMovedCardAbility(instance,"human","bind",hand?"hand":field?.zone||"hand",{currentLocation:"bind"})'));
  assert.ok(app.includes('queueMovedCardAbility(guard,attack.defenderSide,"move","guardian",{currentLocation:"drop",battleId:attack.battleId})'));
  assert.ok(app.includes('queueMovedCardAbility(guard,attack.defenderSide,"retire","guardian",{currentLocation:"drop",battleId:attack.battleId})'));
  assert.ok(app.includes('currentLocation:targetZone==="vanguard"?"vanguard":"rear-guard",subjectInstance:instance'));
  assert.ok(app.includes('eventName=choice==="soul"?"soulMove":choice==="bind"?"bind":"move"'));
  assert.ok(app.includes('queueMovedCardAbility(hand,"human","move","hand",{currentLocation:"drop"})'));
  assert.ok(app.includes('queueMovedCardAbility(field.instance,"human","move",field.zone,{currentLocation:"deck"})'));
  assert.ok(app.includes('queueMovedCardAbility(field.instance,"human","move",field.zone,{currentLocation:"hand"})'));
  assert.ok(app.includes('queueMovedCardAbility(field.instance,"human","move",field.zone,{currentLocation:"g-zone"})'));
  assert.ok(app.includes('queueMovedCardAbility(instance,"human","move","order",{currentLocation:"hand"})'));
  assert.ok(app.includes('queueMovedCardAbility(moved,"human","move",rearZones[from],{currentLocation:zone})'));
});

test("Guardian Circle placement skills match only the exact card placed on GC", () => {
  const ability = parseCardAbilities({ id: "guardian-place", text: "AUTO [GC]: When this unit is placed on GC, draw a card." })[0];
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.deepEqual(ability.requiredLocation, ["guardian"]);
  assert.deepEqual(ability.trigger.circles, ["guardian"]);
  const event = createGameEvent({ matchId: "guardian-place" }, { type: "card.placed", actingPlayerId: "p1", sourceCardInstanceId: "guard-copy", subjectCardInstanceId: "guard-copy", previousLocation: "hand", currentLocation: "guardian", circle: "guardian" });
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "guard-copy", "guardian", "guardian"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "other-copy", "guardian", "guardian"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "guard-copy", "rear-left", "rear-left"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.ok(app.includes('queueAbilityPrompts("place","human",instance.uid,{sourceZone:"guardian",previousLocation:"hand",zone:"guardian"'));
  assert.ok(app.includes('queueAbilityPrompts("place","human",unit.uid,{sourceZone:"guardian",previousLocation:rearZones[index]'));
  assert.ok(app.includes('queueAbilityPrompts("place","human",marker.uid,{sourceZone:"guardian",previousLocation:"hand"'));
  assert.ok(app.includes('queueAbilityPrompts("place","human",instance.uid,{sourceZone:"guardian",previousLocation:"g-deck"'));
  assert.ok(app.includes('f.zone==="guardian"?"GC"'));
  assert.ok(app.includes('queueAbilityPrompts("place","bot",sentinel.uid,{sourceZone:"guardian",previousLocation:"hand"'));
  assert.ok(app.includes('queueAbilityPrompts("place","bot",gGuardian.uid,{sourceZone:"guardian",previousLocation:"g-deck"'));
  assert.ok(app.includes('queueAbilityPrompts("place","bot",entry.item.uid,{sourceZone:"guardian",previousLocation:"hand"'));
  assert.ok(app.includes('queueMovedCardAbility(guard,attack.defenderSide,"move","guardian",{currentLocation:"g-deck",battleId:attack.battleId})'));
});

test("movement triggers require the exact moved instance and verified source and destination zones", () => {
  const retired = parseCardAbilities({ id: "retire-trigger", text: "AUTO [RC]: When this unit is retired, draw a card." })[0];
  assert.equal(retired.trigger.eventType, "card.retired");
  const retiredEvent = createGameEvent({ matchId: "m" }, { type: "card.retired", actingPlayerId: "p1", sourceCardInstanceId: "copy-a", subjectCardInstanceId: "copy-a", previousLocation: "rear-left", currentLocation: "drop" });
  assert.equal(eventMatchesAbilityTrigger(retired, "retire", retiredEvent, "copy-a", "rear-left", "drop"), true);
  assert.equal(eventMatchesAbilityTrigger(retired, "retire", retiredEvent, "copy-b", "rear-left", "drop"), false);
  assert.equal(eventMatchesAbilityTrigger(retired, "retire", retiredEvent, "copy-a", "vanguard", "drop"), false);
  const guardianMove = parseCardAbilities({ id: "guardian-move-trigger", text: "AUTO [GC]: When this card is put into the drop zone from a Guardian Circle, draw a card." })[0];
  assert.equal(guardianMove.trigger.eventType, "card.moved");
  assert.equal(guardianMove.trigger.sourceLocation, "guardian");
  const guardianEvent = createGameEvent({ matchId: "m" }, { type: "card.moved", actingPlayerId: "p1", sourceCardInstanceId: "guard-copy", previousLocation: "guardian", currentLocation: "drop" });
  assert.equal(eventMatchesAbilityTrigger(guardianMove, "move", guardianEvent, "guard-copy", "guardian", "drop"), true);
  assert.equal(eventMatchesAbilityTrigger(guardianMove, "move", { ...guardianEvent, previousLocation: "rear-left" }, "guard-copy", "rear-left", "drop"), false);
  const discarded = parseCardAbilities({ id: "discard-trigger", text: "AUTO: When this card is discarded from your hand, draw a card." })[0];
  assert.equal(discarded.trigger.eventType, "card.discarded");
  const discardEvent = createGameEvent({ matchId: "m" }, { type: "card.discarded", actingPlayerId: "p1", sourceCardInstanceId: "hand-copy", previousLocation: "hand", currentLocation: "drop" });
  assert.equal(eventMatchesAbilityTrigger(discarded, "discard", discardEvent, "hand-copy", "hand", "drop"), true);
  assert.equal(eventMatchesAbilityTrigger(discarded, "discard", { ...discardEvent, previousLocation: "soul" }, "hand-copy", "soul", "drop"), false);
  const returned = parseCardAbilities({ id: "return-trigger", text: "AUTO: When this card is returned to your hand, draw a card." })[0];
  const handEvent = createGameEvent({ matchId: "m" }, { type: "card.moved", actingPlayerId: "p1", sourceCardInstanceId: "return-copy", previousLocation: "rear-left", currentLocation: "hand" });
  assert.equal(returned.trigger.destinationLocation, "hand");
  assert.equal(eventMatchesAbilityTrigger(returned, "move", handEvent, "return-copy", "rear-left", "hand"), true);
  assert.equal(eventMatchesAbilityTrigger(returned, "move", handEvent, "other-copy", "rear-left", "hand"), false);
  const returnedDeck = parseCardAbilities({ id: "return-deck-trigger", text: "AUTO: When this unit is returned to the top of the deck, draw a card." })[0];
  const deckEvent = createGameEvent({ matchId: "m" }, { type: "card.moved", actingPlayerId: "p1", sourceCardInstanceId: "deck-copy", previousLocation: "rear-left", currentLocation: "deck" });
  assert.equal(returnedDeck.trigger.destinationLocation, "deck");
  assert.equal(eventMatchesAbilityTrigger(returnedDeck, "move", deckEvent, "deck-copy", "rear-left", "deck"), true);
  const soulMove = parseCardAbilities({ id: "soul-move-trigger", text: "AUTO: When this card is put into your soul from your deck, draw a card." })[0];
  assert.equal(soulMove.trigger.eventType, "card.moved");
  assert.equal(soulMove.trigger.sourceLocation, "deck");
  assert.equal(soulMove.trigger.destinationLocation, "soul");
  const soulEvent = createGameEvent({ matchId: "m" }, { type: "card.moved", actingPlayerId: "p1", sourceCardInstanceId: "soul-copy", previousLocation: "deck", currentLocation: "soul" });
  assert.equal(eventMatchesAbilityTrigger(soulMove, "soulMove", soulEvent, "soul-copy", "deck", "soul"), true);
  assert.equal(eventMatchesAbilityTrigger(soulMove, "soulMove", soulEvent, "other-copy", "deck", "soul"), false);
  assert.equal(eventMatchesAbilityTrigger(soulMove, "soulMove", { ...soulEvent, previousLocation: "hand" }, "soul-copy", "hand", "soul"), false);

});test("real Blaster Dark retires only its chosen opposing Rear-Guard through the reviewed effect", () => {
  const definition = curatedDefinitions.find(item => item.id === "cfa-20:1");
  assert.ok(definition);
  assert.equal(definition.printedText, "AUTO: [Counter Blast 2] When this unit is placed on VC, you may pay the cost. If you do, choose one of your opponent’s rear-guards, and retire it.");
  const source = createCardInstance("cfa-20", "player-a", "blaster-dark");
  const target = createCardInstance("target-unit", "player-b", "target-copy");
  const state = { players: { a: { rear: [], drop: [] }, b: { rear: [target], drop: [] } } };
  const emitted = [];
  const context = { source, player: state.players.a, side: "a", target, targetInPlay: true, targetSide: "b", targetPlayer: state.players.b, targetControllerPlayerId: "player-b", sourceControllerPlayerId: "player-a", opponentPlayerId: "player-b", targetZone: "rear-left", match: state, emitEvent: event => emitted.push(event) };
  assert.equal(validateEffectProgram(definition.effects, EFFECT_HANDLERS, context).ok, true);
  assert.equal(resolveEffectProgram(definition.effects, EFFECT_HANDLERS, context).ok, true);
  assert.equal(state.players.b.rear[0], null);
  assert.equal(state.players.b.drop[0].uid, "target-copy");
  assert.deepEqual(emitted, [{ type: "card.retired", cardInstanceId: "target-copy", controllerSide: "b", previousLocation: "rear-left", currentLocation: "drop" }]);
});
test("retirement target handler rejects a friendly, Vanguard, or stale target", () => {
  const effect = [{ op: "retire-target", target: "chosen", targetFilter: { controller: "opponent", zone: "rear-guard" } }];
  const target = createCardInstance("unit", "player-b", "target-copy");
  const context = { source: createCardInstance("source", "player-a"), target, targetInPlay: true, targetSide: "b", targetPlayer: { rear: [target], drop: [] }, targetControllerPlayerId: "player-b", sourceControllerPlayerId: "player-a", opponentPlayerId: "player-b", targetZone: "vanguard" };
  assert.equal(validateEffectProgram(effect, EFFECT_HANDLERS, context).ok, false);
  context.targetZone = "rear-left";
  context.targetControllerPlayerId = "player-a";
  assert.equal(validateEffectProgram(effect, EFFECT_HANDLERS, context).ok, false);
  context.targetControllerPlayerId = "player-b";
  context.targetPlayer.rear = [];
  assert.equal(validateEffectProgram(effect, EFFECT_HANDLERS, context).ok, false);
});
test("reviewed opposing-target effects use opponent fields and emit retirement triggers", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.equal(app.includes("targetField.side!==x.side"), false);
  assert.match(app, /targetPlayer:targetField\?match\.players\[targetField\.side\]:null/);
  assert.match(app, /event\?\.type!=="card\.retired"/);
  assert.match(app, /eventContext\.actingPlayerId\|\|player\.playerId\|\|side/);
});
test("real Bloody Calf and Gwynn the Ripper definitions preserve their clan, circle, cost, and target-grade restrictions", () => {
  const samples = [
    { id: "cfa-453", grade: 1, targetGrade: 1 },
    { id: "cfa-474", grade: 2, targetGrade: 2 }
  ];
  for (const sample of samples) {
    const definition = curatedDefinitions.find(item => item.cardId === sample.id);
    const ability = parseCardAbilities({ id: sample.id, text: definition.printedText })[0];
    assert.ok(definition);
    assert.equal(ability.trigger.eventType, "card.placed");
    assert.deepEqual(ability.trigger.circles, ["vanguard", "rear-guard"]);
    assert.deepEqual(ability.conditions, [{ type: "controller-vanguard-has-clan", value: "Dark Irregulars" }]);
    assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 2 }]);
    assert.equal(definition.effects[0].targetFilter.maxGrade, sample.targetGrade);
    const target = createCardInstance("target", "player-b", `grade-${sample.grade}`);
    const context = { target, targetInPlay: true, targetSide: "b", targetPlayer: { rear: [target], drop: [] }, targetControllerPlayerId: "player-b", sourceControllerPlayerId: "player-a", opponentPlayerId: "player-b", targetCard: { grade: sample.grade, type: "Normal Unit" }, targetZone: "rear-left" };
    assert.equal(validateEffectProgram(definition.effects, EFFECT_HANDLERS, context).ok, true);
    context.targetCard.grade = sample.grade + 1;
    assert.equal(validateEffectProgram(definition.effects, EFFECT_HANDLERS, context).ok, false);
  }
});
test("retirement trigger subjects distinguish the retired source from another unit", () => {
  const [self, other] = parseCardAbilities({ id: "retire-subjects", text: "AUTO [RC]: When this unit is retired, draw a card.\nAUTO [RC]: When another unit is retired, draw a card." });
  assert.equal(self.trigger.eventType, "card.retired");
  assert.equal(self.trigger.subject, "source");
  assert.equal(other.trigger.eventType, "card.retired");
  assert.equal(other.trigger.subject, "any");
  assert.equal(other.trigger.excludeSourceAsSubject, true);
  const event = createGameEvent({ matchId: "retirement-subjects" }, { type: "card.retired", actingPlayerId: "p1", sourceCardInstanceId: "retired-a", subjectCardInstanceId: "retired-a", previousLocation: "rear-left", currentLocation: "drop" });
  assert.equal(eventMatchesAbilityTrigger(self, "retire", event, "retired-a", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(self, "retire", event, "source-b", "rear-right", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(other, "retire", event, "source-b", "rear-right", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(other, "retire", event, "retired-a", "rear-left", "rear-left"), false);
});
test("movement events dispatch against sources on both players’ fields using each source controller", () => {
  const app = fs.readFileSync("app.js", "utf8"), start = app.indexOf("function queueMovedCardAbility("), end = app.indexOf("function flushCollectedAbilityTriggers(", start), dispatcher = app.slice(start, end);
  assert.match(dispatcher, /\["human","bot"\]\.flatMap\(fieldSide=>abilityFieldUnits\(fieldSide\)/);
  assert.match(dispatcher, /triggerControllerPlayerId:source\.instance\.controllerPlayerId/);
  assert.match(dispatcher, /abilityTriggerMatches\(ability,eventName,gameEvent,source\.instance\.uid,source\.zone,previousLocation,context\.triggerControllerPlayerId\)/);
  assert.match(dispatcher, /queueOneAbility\(triggerSide,source,ability,context\)/);
});
test("cross-player trigger scans keep you, any player, and your vanguard distinct", () => {
  const youDraw = parseCardAbilities({ id: "you-draw", text: "AUTO [RC]: When you draw a card, this unit gets power +1000 until end of turn." })[0];
  const anyoneDraws = parseCardAbilities({ id: "any-player-draw", text: "AUTO [RC]: When a player draws a card, this unit gets power +1000 until end of turn." })[0];
  const vanguardAttacked = parseCardAbilities({ id: "your-vanguard-attacked", text: "AUTO [RC]: When your vanguard is attacked, this unit gets power +1000 until end of turn." })[0];
  assert.equal(youDraw.trigger.subject, "controller");
  assert.equal(anyoneDraws.trigger.subject, "any");
  const draw = createGameEvent({ matchId: "player-scoped-draw" }, { type: "card.drawn", actingPlayerId: "player-a", sourceCardInstanceId: "drawn", subjectCardInstanceId: "drawn", subjectControllerPlayerId: "player-a" });
  assert.equal(eventMatchesAbilityTrigger(youDraw, "draw", draw, "source-a", "rear-left", "rear-left", "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(youDraw, "draw", draw, "source-b", "rear-left", "rear-left", "player-b"), false);
  assert.equal(eventMatchesAbilityTrigger(anyoneDraws, "draw", draw, "source-b", "rear-left", "rear-left", "player-b"), true);
  const attack = createGameEvent({ matchId: "player-scoped-vanguard" }, { type: "attack.declared", actingPlayerId: "player-b", sourceCardInstanceId: "attacker", subjectCardInstanceId: "vanguard-a", subjectControllerPlayerId: "player-a", targetLocation: "vanguard" });
  assert.equal(eventMatchesAbilityTrigger(vanguardAttacked, "attacked", attack, "source-a", "rear-left", "vanguard", "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(vanguardAttacked, "attacked", attack, "source-b", "rear-left", "vanguard", "player-b"), false);
});
test("ordinary ability events scan both fields and route pending skills to each source controller", () => {
  const app = fs.readFileSync("app.js", "utf8"), start = app.indexOf("function queueAbilityPrompts("), end = app.indexOf("function queueMovedCardAbility(", start), dispatcher = app.slice(start, end);
  assert.match(dispatcher, /\["human","bot"\]\.flatMap\(fieldSide=>abilityFieldUnits\(fieldSide\)/);
  assert.match(dispatcher, /triggerControllerPlayerId:source\.instance\.controllerPlayerId/);
  assert.match(dispatcher, /queueOneAbility\(sourceSide,source,ability,sourceContext\)/);
  assert.match(dispatcher, /sourceContext\.triggerControllerPlayerId\)/);
});
test("discard and bind movement triggers retain moved-card identity for self and other text", () => {
  const samples = [
    { eventName: "retire", type: "card.retired", verb: "retired" },
    { eventName: "discard", type: "card.discarded", verb: "discarded" },
    { eventName: "bind", type: "card.bound", verb: "bound" }
  ];
  for (const sample of samples) {
    const [self, other] = parseCardAbilities({ id: `movement-${sample.verb}`, text: `AUTO [RC]: When this unit is ${sample.verb}, draw a card.\nAUTO [RC]: When another card is ${sample.verb}, draw a card.` });
    assert.equal(self.trigger.eventType, sample.type);
    assert.equal(self.trigger.subject, "source");
    assert.equal(other.trigger.eventType, sample.type);
    assert.equal(other.trigger.subject, "any");
    assert.equal(other.trigger.excludeSourceAsSubject, true);
    const event = createGameEvent({ matchId: sample.verb }, { type: sample.type, actingPlayerId: "player-a", sourceCardInstanceId: "moved-card", subjectCardInstanceId: "moved-card", previousLocation: sample.verb === "discarded" ? "hand" : "rear-left", currentLocation: sample.verb === "bound" ? "bind" : "drop" });
    assert.equal(eventMatchesAbilityTrigger(self, sample.eventName, event, "moved-card", "rear-left", "rear-left"), true);
    assert.equal(eventMatchesAbilityTrigger(other, sample.eventName, event, "watcher-card", "rear-right", "rear-left"), true);
    assert.equal(eventMatchesAbilityTrigger(other, sample.eventName, event, "moved-card", "rear-left", "rear-left"), false);
  }
});
test("temporary Drive effects update the current battle and expire only at their controller’s turn end", () => {
  const source = { uid: "drive-unit", turnDriveBoost: 0 };
  const match = { pendingAttack: { attackerUid: "drive-unit", driveChecksRemaining: 2, maxDriveChecks: 2 } };
  assert.equal(resolveEffectProgram([{ op: "modify-drive", target: "source", amount: 1, duration: "turn" }], EFFECT_HANDLERS, { source, sourceInPlay: true, side: "player-a", match }).ok, true);
  assert.equal(match.pendingAttack.driveChecksRemaining, 3);
  assert.equal(match.pendingAttack.maxDriveChecks, 3);
  assert.equal(source.turnDriveBoost, 1);
  assert.equal(source.turnDriveExpiry, "player-a");
  const opponent = { turnDriveBoost: 2, turnDriveExpiry: "player-b", turnPowerBoost: 4000, turnPowerExpiry: "player-b" };
  const players = { a: { rear: [source] }, b: { vanguard: opponent } };
  players.self = players;
  expireTurnModifiers(players, "player-a");
  assert.equal(source.turnDriveBoost, 0);
  assert.equal(source.turnDriveExpiry, undefined);
  assert.equal(opponent.turnDriveBoost, 2);
  assert.equal(opponent.turnPowerBoost, 4000);
  expireTurnModifiers(players, "player-b");
  assert.equal(opponent.turnDriveBoost, 0);
  assert.equal(opponent.turnPowerBoost, 0);
});
test("application turn-end cleanup uses the shared temporary modifier expiry helper", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /function clearTurnBonuses\(side\) \{ window\.VanguardAbilityEngine\.expireTurnModifiers\(match\?\.players,side\); \}/);
  assert.match(app, /turnDriveExpiry\)value\.turnDriveExpiry=flipSide\(value\.turnDriveExpiry\)/);
});

test("Machining Worker Ant stands only an eligible rested Megacolony Machining rear-guard", () => {
  const definition = curatedDefinitions.find(item => item.cardId === "cfa-41");
  const ability = parseCardAbilities({ id: "cfa-41", text: definition.printedText })[0];
  const source = createCardInstance("cfa-41", "player-a", "ant-source");
  const target = createCardInstance("machining-target", "player-a", "machining-target");
  target.rested = true;
  const events = [];
  const context = { source, sourceInPlay: true, sourceControllerPlayerId: "player-a", target, targetInPlay: true, targetControllerPlayerId: "player-a", targetSide: "player-a", targetCard: { type: "Unit", clan: "Megacolony", name: "Machining Stag Beetle" }, targetZone: "rear-left", emitEvent: event => events.push(event) };
  assert.ok(definition);
  assert.equal(ability.trigger.eventType, "card.placed");
  assert.deepEqual(ability.trigger.circles, ["rear-guard"]);
  const placed = createGameEvent({ matchId: "machining" }, { type: "card.placed", actingPlayerId: "player-a", sourceCardInstanceId: "ant-source", subjectCardInstanceId: "ant-source", currentLocation: "rear-left" });
  assert.equal(eventMatchesAbilityTrigger(ability, "place", placed, "ant-source", "rear-left", "rear-left", "player-a"), true);
  assert.equal(validateEffectProgram(definition.effects, EFFECT_HANDLERS, context).ok, true);
  const resolved = resolveEffectProgram(definition.effects, EFFECT_HANDLERS, context);
  assert.equal(resolved.ok, true);
  assert.equal(target.rested, false);
  assert.deepEqual(events.map(event => [event.type, event.cardInstanceId]), [["unit.stood", "machining-target"]]);
});
test("stand target rejects a wrong controller, circle, clan, name, or a unit that is already standing", () => {
  const definition = curatedDefinitions.find(item => item.cardId === "cfa-41");
  const source = createCardInstance("cfa-41", "player-a", "ant-source-filter");
  const target = createCardInstance("target", "player-a", "target-filter");
  const context = { source, sourceInPlay: true, sourceControllerPlayerId: "player-a", target, targetInPlay: true, targetControllerPlayerId: "player-a", targetSide: "player-a", targetCard: { type: "Unit", clan: "Megacolony", name: "Machining Worker" }, targetZone: "rear-left" };
  for (const invalid of [
    { targetControllerPlayerId: "player-b" },
    { targetZone: "vanguard" },
    { targetCard: { type: "Unit", clan: "Kagero", name: "Machining Worker" } },
    { targetCard: { type: "Unit", clan: "Megacolony", name: "Hell Spider" } }
  ]) {
    target.rested = true;
    assert.equal(validateEffectProgram(definition.effects, EFFECT_HANDLERS, { ...context, ...invalid }).ok, false);
  }
  target.rested = false;
  assert.equal(validateEffectProgram(definition.effects, EFFECT_HANDLERS, context).ok, false);
});
test("a stand ability with no legal rested target resolves without opening a target prompt", () => {
  const definition = curatedDefinitions.find(item => item.cardId === "cfa-41");
  const source = createCardInstance("cfa-41", "player-a", "ant-source-no-target");
  let stood = false;
  const result = resolveEffectProgram(definition.effects, EFFECT_HANDLERS, { source, sourceInPlay: true, noLegalTarget: true, emitEvent: () => { stood = true; } });
  assert.equal(result.ok, true);
  assert.equal(result.applied, 1);
  assert.equal(stood, false);
});
test("stood event prompts and resolves only through the per-player trigger queue", () => {
  const ability = parseCardAbilities({ id: "stand-trigger", text: "AUTO [RC]: When this unit stands, draw a card." })[0];
  const event = createGameEvent({ matchId: "stand-trigger" }, { type: "unit.stood", actingPlayerId: "player-a", sourceCardInstanceId: "standing-unit", subjectCardInstanceId: "standing-unit", currentLocation: "rear-left" });
  assert.equal(ability.trigger.eventType, "unit.stood");
  assert.equal(eventMatchesAbilityTrigger(ability, "stand", event, "standing-unit", "rear-left", "rear-left", "player-a"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "stand", event, "different-unit", "rear-right", "rear-left", "player-a"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /event\?\.type==="unit\.stood"[\s\S]{0,250}queueAbilityPrompts\("stand",stood\.side,event\.cardInstanceId/);
});

test("ordinary stand phases and manual stand choices dispatch exact-instance stand events", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /function standUnitAndQueue\(side, field\)[\s\S]{0,420}field\.instance\.rested=false[\s\S]{0,220}queueAbilityPrompts\("stand",side,field\.instance\.uid/);
  assert.match(app, /function standAllUnits\(side\)[\s\S]{0,1000}fields\.forEach\(field=>field\.instance\.rested=false\)/);
  const botTurnStart = app.indexOf("function botTurn()");
  const botTurnEnd = app.indexOf("function nextBotAttack", botTurnStart);
  const botTurn = app.slice(botTurnStart, botTurnEnd);
  assert.match(botTurn, /match\.side = "bot"; match\.phase = 0;/);
  assert.ok(botTurn.indexOf("botTimer = setTimeout(") < botTurn.indexOf('queueTurnStartEvent("bot")'));
  assert.ok(botTurn.indexOf('queueTurnStartEvent("bot")') < botTurn.indexOf('standAllUnits("bot")'));
  assert.match(app, /function completeTurnTransition\(endingPlayerId\)[\s\S]{0,2200}queueTurnStartEvent\("human"\);standAllUnits\("human"\)/);
  assert.match(app, /else if \(pending\.stage === "stand-target"\) \{ standUnitAndQueue\("human",unit\)/);
  assert.match(app, /if \(pending\.stage === "stand-target"\)[\s\S]{0,220}standUnitAndQueue\(side,target\)/);
});

test("stand phase batch effects finish standing before resolution and share a controller-specific ordering window", () => {
  const first = { side: "human", instance: { uid: "stand-a", controllerPlayerId: "player-a" }, ability: { kind: "AUTO" }, triggerControllerPlayerId: "player-a", eventContext: { eventId: "stand-event-a", simultaneousWindowId: "match:stand:2:player-a" } };
  const second = { side: "human", instance: { uid: "stand-b", controllerPlayerId: "player-a" }, ability: { kind: "AUTO" }, triggerControllerPlayerId: "player-a", eventContext: { eventId: "stand-event-b", simultaneousWindowId: "match:stand:2:player-a" } };
  const opponent = { side: "bot", instance: { uid: "stand-c", controllerPlayerId: "player-b" }, ability: { kind: "AUTO" }, triggerControllerPlayerId: "player-b", eventContext: { eventId: "stand-event-c", simultaneousWindowId: "match:stand:2:player-a" } };
  const state = { pendingAbility: first, pendingAbilities: [second, opponent] };
  assert.deepEqual(simultaneousAbilityGroup(state, first), [first, second]);
  assert.deepEqual(simultaneousAbilityGroup(state, opponent), [opponent]);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /function standAllUnits\(side\)[\s\S]{0,1000}fields\.forEach\(field=>field\.instance\.rested=false\)/);
});

test("trigger eligibility does not contain stray executable tokens after condition validation", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const start = app.indexOf("function abilityRequirementsMet(");
  const end = app.indexOf("function abilityTriggerMatches(", start);
  const requirementGate = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(requirementGate, /evaluateAbilityConditions\(a,abilityConditionContext\(side,source,eventContext\)\)\)return false;if\(\(a\.once\|\|a\.usageRestriction\)\&\&abilityUsed\(side,source\.instance\.uid,a\)\)/);
  assert.doesNotMatch(requirementGate, /return false;e;/);
});

test("online turn changes advance the turn-scoped skill key and capture the next player's starting Vanguard grade", () => {
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /function completeTurnTransition\(endingPlayerId\)[\s\S]{0,1800}match\.side=nextSide;match\.phase=0;match\.turn\+=1;match\.turnStartGrades\|\|=\{\};match\.turnStartGrades\[nextSide\]=Number\(cardMap\.get\(match\.players\[nextSide\]\.vanguard\?\.cardId\)\?\.grade\?\?-1\)/);
  assert.ok(app.includes("function abilityUsed(side,instanceUid,abilityOrId)"));assert.ok(app.includes("abilityUsageKey(match.turn,player.playerId||side,instanceUid,id,ability?.usageRestriction,name,ability?.printedText||ability?.raw)"));
});

test("remote action envelopes require the current player, version, and an allowlisted game command", () => {
  const state = { matchId: "remote-room", stateVersion: 9, processedActionIds: [], side: "bot", phase: 5, players: { human: { playerId: "host" }, bot: { playerId: "joiner", vanguard: { uid: "attacker" }, rear: [], hand: [{ uid: "hand-card" }] } } };
  const base = { type: "action", action: "attack", selected: "attacker", actionId: "act-1", matchId: "remote-room", actorPlayerId: "joiner", expectedStateVersion: 9 };
  assert.deepEqual(validateRemoteActionRequest(state, base, "joiner"), { ok: true });
  assert.equal(validateRemoteActionRequest({ ...state, side: "human" }, { ...base, actionId: "off-turn" }, "joiner").reason, "not-actor-turn");
  assert.equal(validateRemoteActionRequest({ ...state, phase: 4 }, { ...base, actionId: "wrong-phase" }, "joiner").reason, "wrong-phase");  assert.equal(validateRemoteActionRequest(state, { ...base, actionId: "forged-attacker", selected: "hand-card" }, "joiner").reason, "attacker-not-on-field");
  assert.equal(validateRemoteActionRequest({ ...state, phase: 2 }, { ...base, actionId: "legal-ride", action: "ride", selected: "hand-card" }, "joiner").ok, true);
  assert.equal(validateRemoteActionRequest({ ...state, phase: 2 }, { ...base, actionId: "forged-ride", action: "ride", selected: "attacker" }, "joiner").reason, "selected-card-not-in-hand");
  assert.equal(validateRemoteActionRequest({ ...state, pendingAttack: { defenderSide: "bot" } }, { ...base, actionId: "legal-guard-card", action: "guard", selected: "hand-card" }, "joiner").ok, true);
  assert.equal(validateRemoteActionRequest({ ...state, pendingAttack: { attackerSide: "bot", defenderDone: true, driveChecksRemaining: 1 } }, { ...base, actionId: "early-finish", action: "finishAttack" }, "joiner").reason, "attack-resolution-incomplete");
  assert.equal(validateRemoteActionRequest({ ...state, players: { ...state.players, bot: { playerId: "other" } } }, { ...base, actionId: "unknown-player", action: "draw", selected: null }, "joiner").reason, "actor-not-in-match");
  assert.deepEqual(validateRemoteActionRequest({ ...state, pendingAttack: { defenderSide: "bot" } }, { ...base, actionId: "legal-guard", action: "guard", selected: "hand-card" }, "joiner"), { ok: true });
  assert.equal(validateRemoteActionRequest({ ...state, pendingAttack: { defenderSide: "human" } }, { ...base, actionId: "wrong-guard", action: "guard" }, "joiner").reason, "not-defending-player");
  assert.equal(validateRemoteActionRequest(state, { ...base, action: "manual:stride:unit-1:cost-card-2" }, "joiner").reason, "invalid-stride-selection");
  assert.equal(validateRemoteActionRequest(state, { ...base, action: "manual:guard-perfect:marker-1:discard-1" }, "joiner").reason, "invalid-perfect-guard-payment");
  assert.deepEqual(validateRemoteActionRequest(state, { ...base, action: "manual:order-to-drop:order-1" }, "joiner"), { ok: true });
  assert.equal(validateRemoteActionRequest(state, { ...base, action: "erase-match" }, "joiner").reason, "unsupported-action");
  assert.equal(validateRemoteActionRequest(state, { ...base, action: "manual:erase-match" }, "joiner").reason, "unsupported-action");
  assert.equal(validateRemoteActionRequest(state, { ...base, action: "manual:bad action" }, "joiner").reason, "unsupported-action");
  assert.equal(validateRemoteActionRequest(state, { ...base, actorPlayerId: "host" }, "joiner").reason, "wrong-actor");
  assert.equal(validateRemoteActionRequest(state, { ...base, expectedStateVersion: 8 }, "joiner").reason, "stale-state-version");
  assert.equal(validateRemoteActionRequest(state, { ...base, actionId: "act-2", type: "unknown" }, "joiner").reason, "invalid-action-type");
  assert.equal(validateRemoteActionRequest({...state,pendingAbility:{side:"bot"}}, {...base,actionId:"act-pending"}, "joiner").reason,"resolution-in-progress");
  assert.equal(validateRemoteActionRequest({...state,pendingAbilities:[{side:"bot"}]}, {...base,actionId:"act-queued"}, "joiner").reason,"resolution-in-progress");
  const playerState={...state,players:{human:{playerId:"host",vanguard:{uid:"host-vg"}},bot:{playerId:"joiner",hand:[{uid:"joiner-card"}]}}};
  assert.equal(validateRemoteActionRequest(playerState,{...base,action:"manual:open-skills",selected:"joiner-card"},"joiner").ok,true);
  assert.equal(validateRemoteActionRequest(playerState,{...base,action:"manual:open-skills",actionId:"act-forged",selected:"not-a-card"},"joiner").reason,"selected-card-not-found");
  assert.equal(validateRemoteActionRequest(playerState,{...base,action:"manual:open-skills",actionId:"act-shaped",selected:{uid:"host-vg"}},"joiner").reason,"invalid-selection");
});
test("remote ACT requests require the joining player's own field source, Main phase, and turn",()=>{
  const source=createCardInstance("act-card","joiner","joiner-unit"),other=createCardInstance("other-card","joiner","other-unit"),state={matchId:"act-room",stateVersion:4,processedActionIds:[],side:"bot",phase:4,players:{human:{playerId:"host",vanguard:null,rear:[null,null,null,null,null],hand:[],damage:[],soul:[],drop:[]},bot:{playerId:"joiner",vanguard:null,rear:[source,other,null,null,null],hand:[],damage:[],soul:[],drop:[]}}};
  const request={type:"action",action:"manual:activate-skill:joiner-unit:act-card:0",selected:"joiner-unit",actionId:"joiner-act",matchId:"act-room",actorPlayerId:"joiner",expectedStateVersion:4};
  assert.deepEqual(validateRemoteActionRequest(state,request,"joiner"),{ok:true});
  assert.equal(validateRemoteActionRequest(state,{...request,actionId:"off-turn-act"},"host").reason,"wrong-actor");
  assert.equal(validateRemoteActionRequest({...state,side:"human"},{...request,actionId:"off-turn"},"joiner").reason,"not-actor-turn");
  assert.equal(validateRemoteActionRequest({...state,phase:5},{...request,actionId:"wrong-window"},"joiner").reason,"wrong-phase");
  assert.equal(validateRemoteActionRequest(state,{...request,actionId:"wrong-selected-source",selected:"other-unit"},"joiner").reason,"skill-source-selection-mismatch");
  assert.equal(validateRemoteActionRequest({...state,players:{...state.players,bot:{...state.players.bot,rear:[]}}},{...request,actionId:"off-field"},"joiner").reason,"selected-card-not-found");
  assert.equal(validateRemoteActionRequest(state,{...request,actionId:"bad-index",action:"manual:activate-skill:joiner-unit:other-card:0"},"joiner").reason,"invalid-skill-selection");
  assert.equal(validateRemoteActionRequest({...state,pendingAbility:{side:"bot"}},{...request,actionId:"resolving"},"joiner").reason,"resolution-in-progress");
  const app=fs.readFileSync("app.js","utf8");assert.match(app,/find\(candidate=>candidate\.id===abilityId\)/);assert.match(app,/encodeURIComponent\(x\.id\)/);
});
test("card selection uses the versioned remote request protocol without advancing the local version", () => {
  const state = { matchId: "selection-room", stateVersion: 3, processedActionIds: [], players: { bot: { playerId: "joiner", hand: [{ uid: "owned-card" }] }, human: { playerId: "host", vanguard: { uid: "host-card" } } } };
  const select = { type: "select", selected: "owned-card", actionId: "select-1", matchId: "selection-room", actorPlayerId: "joiner", expectedStateVersion: 3 };
  assert.deepEqual(validateRemoteActionRequest(state, select, "joiner"), { ok: true });
  assert.equal(validateRemoteActionRequest(state, { ...select, selected: 12 }, "joiner").reason, "invalid-selection");
  assert.equal(validateRemoteActionRequest(state,{...select,actionId:"select-host-card",selected:"host-card"},"joiner").reason,"selected-card-not-controlled");
  const app = fs.readFileSync("app.js", "utf8");
  const requestStart=app.indexOf("function sendGuestRequest("),requestEnd=app.indexOf("function versionMatchSnapshot(",requestStart),requestSource=app.slice(requestStart,requestEnd);
  assert.match(requestSource,/online\.remoteRequestPending=actionId/);assert.doesNotMatch(requestSource,/match\.stateVersion\s*=\s*expectedStateVersion\s*\+/);assert.match(requestSource,/type !== "select" && online\.remoteRequestPending/);
  assert.match(app, /validateRemoteActionRequest\(match,message,match\.players\.bot\.playerId\)/);
  assert.match(app, /message\.type==="select"&&message\.selected!==null[\s\S]{0,260}match\.players\.bot/);
  assert.match(app, /sendGuestRequest\("select",\{selected:match\.selected\}\)/);
});

test("online setup requests authenticate the joiner and validate roll, first-player, and mulligan windows", () => {
  const state = { matchId: "setup-room", stateVersion: 2, processedActionIds: [], players: { bot: { hand: [{ uid: "guest-card-a" }, { uid: "guest-card-b" }] } }, preMatch: { stage: "roll", rolls: { human: 4, bot: null }, winner: "bot", mulliganDone: { human: false, bot: false } } };
  const base = { matchId: "setup-room", actorPlayerId: "joiner", expectedStateVersion: 2 };
  assert.equal(validateRemoteActionRequest(state, { ...base, type: "setup-roll", actionId: "setup-roll-1" }, "joiner").ok, true);
  assert.equal(validateRemoteActionRequest(state, { ...base, type: "setup-choice", actionId: "setup-choice-1", firstSide: "human" }, "joiner").ok, true);
  assert.equal(validateRemoteActionRequest(state, { ...base, type: "setup-choice", actionId: "setup-choice-2", firstSide: "host" }, "joiner").reason, "invalid-first-player-choice");
  assert.equal(validateRemoteActionRequest(state, { ...base, type: "setup-roll", actionId: "setup-roll-2", actorPlayerId: "host" }, "joiner").reason, "wrong-actor");
  state.preMatch.stage = "mulligan";
  const mulligan = { ...base, type: "setup-mulligan", actionId: "mulligan-1", handUids: ["guest-card-a"] };
  assert.equal(validateRemoteActionRequest(state, mulligan, "joiner").ok, true);
  assert.equal(validateRemoteActionRequest(state, { ...mulligan, actionId: "mulligan-2", handUids: ["host-card"] }, "joiner").reason, "invalid-mulligan-selection");
  assert.equal(validateRemoteActionRequest(state, { ...mulligan, actionId: "mulligan-3", handUids: ["guest-card-a", "guest-card-a"] }, "joiner").reason, "invalid-mulligan-selection");
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /sendGuestRequest\("setup-roll"\)/);
  assert.match(app, /sendGuestRequest\("setup-mulligan",\{handUids:online\.mulliganSelection\|\|\[\]\}\)/);
  assert.match(app, /validateRemoteActionRequest\(match,message,match\.players\.bot\.playerId\);if\(!setupRequest\.ok\)/);
});

test("remote Perfect Guard and Stride cost prompts are projected to the joining player", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const humanGuard = app.slice(app.indexOf("function humanGuard()"), app.indexOf("function renderRemotePaymentPrompt()"));
  assert.ok(humanGuard.includes('if(online.applyingRemote){match.pendingProtectGuard={ownerSide:"human",markerUid:instance.uid};return;}'));
  const prompt = app.slice(app.indexOf("function renderRemotePaymentPrompt()"), app.indexOf("function resolveProtectGuard("));
  assert.ok(prompt.includes('if(online.role!=="guest")return;'));
  assert.ok(prompt.includes("pendingProtectGuard"));
  assert.ok(prompt.includes("match.players.human.hand.find"));
  assert.ok(app.includes("snapshot.pendingProtectGuard.ownerSide = flipSide(snapshot.pendingProtectGuard.ownerSide)"));
  assert.ok(app.includes('if(snapshot.pendingStride.ownerSide!=="human")snapshot.pendingStride=null'));
  assert.ok(app.includes('if(snapshot.pendingProtectGuard.ownerSide!=="human")snapshot.pendingProtectGuard=null'));
  assert.ok(app.includes("publicMatch.pendingStride = null; publicMatch.pendingProtectGuard = null"));
  assert.ok(app.includes("match.pendingProtectGuard.ownerSide=flipSide(match.pendingProtectGuard.ownerSide)"));
  assert.ok(app.includes("renderGAssistDialog(); renderRemotePaymentPrompt()"));
  assert.ok(app.includes('performManualAction("stride-cancel")'));
  assert.ok(app.includes('action === "stride-cancel"'));
});
test("spectator and player relays use separate topics and private decisions are not sent to watcher clients", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const relay = fs.readFileSync("match-relay.js", "utf8");
  assert.ok(app.includes("vanguard-room:") && app.includes("guest-host") && app.includes("host-guest"));
  assert.ok(app.includes("window.VanguardMatchRelay.createConnection"));
  assert.ok(app.includes("const outgoingEvent=role==="));
  assert.ok(relay.includes("private: isPrivate"));
  assert.ok(relay.includes("incoming.subscribe(onStatus(\"in\"))"));
  assert.ok(app.includes('if(role==="host-watcher")'));


  assert.ok(app.includes('if(!["player","guest"].includes(envelope.senderRole))return'));
  assert.ok(app.includes("publicMatch.pendingStride = null; publicMatch.pendingProtectGuard = null"));
  assert.ok(app.includes('bindOnlineConnection(createRelayConnection(secret, "host-watcher"), "host-watcher")'));
  assert.ok(app.includes('createRelayConnection(secret, watching ? "watcher" : "guest")'));
});
test("real empty-damage-zone placement AUTO matches only its source placed from hand on RC and moves top deck card without a damage check", () => {
  const ability = parseCardAbilities({ id: "cfa-8963", text: "Oracle Think Tank/Noble/Heal Trigger\n\nAUTO: When this unit is placed on RC from hand, if your damage zone has no cards, put the top card of your deck into the damage zone." })[0];
  assert.equal(ability.definition.effects[0].op, "deck-to-damage");
  assert.equal(ability.trigger.eventType, "card.placed");
  const event = createGameEvent({ matchId: "empty-damage" }, { type: "card.placed", actingPlayerId: "p1", sourceCardInstanceId: "heal-copy", subjectCardInstanceId: "heal-copy", previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left" });
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "heal-copy", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "another-copy", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "place", { ...event, currentLocation: "vanguard", circle: "vanguard" }, "heal-copy", "vanguard", "vanguard"), false);
  assert.equal(evaluateAbilityConditions(ability, { damageCount: 0, eventPreviousLocation: "hand" }), true);
  assert.equal(evaluateAbilityConditions(ability, { damageCount: 1, eventPreviousLocation: "hand" }), false);
  assert.equal(evaluateAbilityConditions(ability, { damageCount: 0, eventPreviousLocation: "deck" }), false);
  const player = { deck: [{ uid: "lower-card" }, { uid: "top-card", faceDown: true }], damage: [] };
  const emitted = [];
  const result = resolveEffectProgram(ability.definition.effects, EFFECT_HANDLERS, { player, side: "p1", emitEvent: event => emitted.push(event) });
  assert.equal(result.ok, true);
  assert.deepEqual(player.deck.map(card => card.uid), ["lower-card"]);
  assert.deepEqual(player.damage.map(card => card.uid), ["top-card"]);
  assert.equal(player.damage[0].faceDown, false);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, "card.damage_moved");
  assert.equal(GAME_EVENT_TYPES.includes("damage.checked"), true);
  assert.equal(emitted.some(item => item.type === "damage.checked"), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /eventPreviousLocation:eventContext\.gameEvent\?\.previousLocation/);
  assert.match(app, /event\?\.type==="card\.damage_moved"[\s\S]{0,300}queueAbilityPrompts\("damagePlace"/);
});
test("Generation Break counts only face-up G units on Vanguard and in the G zone", () => {
  const player = { vanguard: { cardId: "stride" }, gZone: [{ uid: "zone-up", cardId: "g-unit", faceUp: true }, { uid: "zone-down", cardId: "g-unit", faceUp: false }, { uid: "zone-non-g", cardId: "normal", faceUp: true }], gDeck: [{ uid: "deck-up", cardId: "g-unit", faceUp: true }], rear: [{ uid: "rear-g", cardId: "g-unit" }] };
  const isGUnit = instance => instance.cardId === "stride" || instance.cardId === "g-unit";
  assert.equal(require("./ability-engine.js").countGenerationBreakUnits(player, isGUnit), 2);
  assert.equal(require("./ability-engine.js").countGenerationBreakUnits({ gZone: [{ cardId: "g-unit", faceUp: true }, { cardId: "normal", faceUp: true }], vanguard: { cardId: "normal" }, rear: [{ cardId: "g-unit" }] }, isGUnit), 1);
  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /countGenerationBreakUnits\(p,instance=>isGDeckCard/);
});

test("Diviner, Kuroikazuchi draws only after its own boosted Vanguard attack meets GB and Counter-Blast conditions", () => {
  const ability = parseCardAbilities({ id: "cfa-2560", text: "Oracle Think Tank/Human\n\nAUTO [RC] Generation Break 1 (This ability is active if you have one or more face up G units on your VC and/or G Zone): [Counter Blast 1] When this unit attacks a vanguard, if this unit is boosted, you may pay the cost. If you do, draw a card." })[0];
  assert.equal(ability.definition.source.patternId, "auto-gb-boosted-vanguard-attack-counter-blast-draw-v1");
  assert.equal(ability.trigger.eventType, "unit.attacked");
  assert.equal(ability.trigger.targetLocation, "vanguard");
  assert.equal(ability.gb, 1);
  assert.deepEqual(ability.costs, [{ type: "counter-blast", count: 1 }]);
  assert.equal(ability.conditionStatus, "modeled");
  const ownAttack = createGameEvent({ matchId: "kuroikazuchi" }, { type: "unit.attacked", actingPlayerId: "p1", sourceCardInstanceId: "attacker-a", subjectCardInstanceId: "attacker-a", sourceControllerPlayerId: "p1", subjectControllerPlayerId: "p1", targetLocation: "vanguard" });
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", ownAttack, "attacker-a", "rear-left", "rear-left", "p1"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", ownAttack, "attacker-b", "rear-left", "rear-left", "p1"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "attack", { ...ownAttack, targetLocation: "rear-guard" }, "attacker-a", "rear-left", "rear-left", "p1"), false);
  const noBoost = { generationBreakCount: 1, sourceInstanceId: "attacker-a", eventSubjectInstanceId: "attacker-a" };
  assert.equal(evaluateAbilityConditions(ability, noBoost), false);
  const boosted = { ...noBoost, boosterInstanceId: "booster-a" };
  assert.equal(evaluateAbilityConditions(ability, boosted), true);
  assert.equal(evaluateAbilityConditions(ability, { ...boosted, generationBreakCount: 0 }), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 0 }), false);
  assert.equal(canPayAbilityCosts(ability, { faceUpDamage: 1 }), true);
  assert.equal(ability.canDecline, true);
});
test("Generation Break reminder parser handles reviewed wording variants and rejects mismatched thresholds", () => {
  const valid = [
    "AUTO [RC] Generation Break 1 (This ability is active if you have one or more face up G units in total on your VC or G zone): When this unit attacks, draw a card.",
    "AUTO [RC] Generation Break 1 (This ability is active if you have one or more G units face up on your VC and/or G zone): When this unit attacks, draw a card.",
    "AUTO [RC] Generation Break 2 (Active if you have two or more face up G units in total on your VC or G zone): When this unit attacks, draw a card."
  ];
  for (const [index, text] of valid.entries()) {
    const ability = parseCardAbilities({ id: `gb-wording-${index}`, text })[0];
    assert.equal(ability.conditionStatus, "modeled");
    assert.deepEqual(ability.conditions, [{ type: "generation-break", count: index === 2 ? 2 : 1 }]);
  }
  const mismatched = parseCardAbilities({ id: "gb-mismatch", text: "CONT [RC] Generation Break 1 (Active if you have two or more face up G units in total on your VC or G zone): This unit gets Intercept." })[0];
  assert.equal(mismatched.conditionStatus, "needs-review");
  assert.deepEqual(mismatched.conditions, []);
});
test("real AUTO placement Soul Blast draw is limited to its exact unit on RC and an affordable optional cost", () => {
  const ability = parseCardAbilities({ id: "cfa-2406", text: "Royal Paladin/Human\n\nAUTO: [Soul Blast 2] When this unit is placed on RC, you may pay the cost. If you do, draw a card." })[0];
  assert.equal(ability.definition.source.patternId, "auto-place-rc-soul-blast-draw-v1");
  assert.deepEqual(ability.costs, [{ type: "soul-blast", count: 2 }]);
  assert.deepEqual(ability.requiredLocation, ["rear-guard"], "the ability is restricted to its printed Rear-Guard Circle");
  assert.equal(ability.trigger.eventType, "card.placed");
  const event = createGameEvent({ matchId: "ladinas" }, { type: "card.placed", actingPlayerId: "p1", sourceCardInstanceId: "ladinas-copy", subjectCardInstanceId: "ladinas-copy", previousLocation: "hand", currentLocation: "rear-left", circle: "rear-left" });
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "ladinas-copy", "rear-left", "rear-left"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "place", event, "other-copy", "rear-left", "rear-left"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "place", { ...event, currentLocation: "vanguard", circle: "vanguard" }, "ladinas-copy", "vanguard", "vanguard"), false);
  assert.equal(canPayAbilityCosts(ability, { soulCount: 1 }), false);
  assert.equal(canPayAbilityCosts(ability, { soulCount: 2 }), true);
  assert.equal(ability.canDecline, true);
  const player = { deck: [{ uid: "drawn" }], hand: [], soul: [] };
  const result = resolveEffectProgram(ability.definition.effects, EFFECT_HANDLERS, { player });
  assert.equal(result.ok, true);
  assert.deepEqual(player.hand.map(card => card.uid), ["drawn"]);
});

test("clan-gated RC placement Soul Blast draw checks the source, circle, Vanguard clan, and optional cost",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const records=["cfa-196","cfa-560","cfa-847","cfa-1607","cfa-1662","cfa-1820","cfa-1970"].map(id=>loadCatalog().find(card=>card.id===id));
  assert.ok(records.every(Boolean));
  for(const card of records){
    const ability=parseCardAbilities(card)[0];
    assert.equal(ability.definition?.source?.patternId,"auto-place-rc-soul-blast-clan-draw-v1",card.id);
    assert.deepEqual(ability.costs,[{type:"soul-blast",count:2}],card.id);
    assert.equal(ability.conditionStatus,"modeled",card.id);
    assert.equal(ability.canDecline,true,card.id);
    assert.deepEqual(ability.requiredLocation,[],card.id);
    assert.equal(ability.trigger?.eventType,"card.placed",card.id);
    const clan=ability.conditions.find(condition=>condition.type==="controller-vanguard-has-clan")?.value;
    assert.ok(clan,card.id);
    assert.equal(evaluateAbilityConditions(ability,{vanguardClan:clan}),true,card.id);
    assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Different Clan"}),false,card.id);
    const event=createGameEvent({matchId:`${card.id}-match`},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"exact-source",subjectCardInstanceId:"exact-source",previousLocation:"hand",currentLocation:"rear-left",circle:"rear-left"});
    assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"exact-source","rear-left","rear-left","p1"),true,card.id);
    assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other-copy","rear-left","rear-left","p1"),false,card.id);
    assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"vanguard",circle:"vanguard"},"exact-source","vanguard","vanguard","p1"),false,card.id);
    assert.equal(canPayAbilityCosts(ability,{soulCount:1}),false,card.id);
    assert.equal(canPayAbilityCosts(ability,{soulCount:2}),true,card.id);
  }
});

test("Vanguard hit AUTO events wait until all damage checks resolve and retain exact battle identity",()=>{
  const source=fs.readFileSync("app.js","utf8");
  const finishAttack=source.match(/function finishAttack\(blocked\) \{([\s\S]*?)\n  function dealDamage/)?.[1]||"";
  assert.match(finishAttack,/pendingHitResolution=\{attackerSide:attack\.attackerSide,attackerUid:attack\.attackerUid,targetZone:attack\.targetZone,targetUid:attack\.targetUid,boostUid:attack\.boostUid,battleId:attack\.battleId\}/);
  assert.doesNotMatch(finishAttack,/queueAbilityPrompts\("hit",attack\.attackerSide,attack\.attackerUid,\{targetZone:attack\.targetZone,boostUid:attack\.boostUid\}\)/);
  const damageQueue=source.match(/function resolveDamageQueue\(\) \{([\s\S]*?)\n  \}/)?.[1]||"";
  const dispatch=damageQueue.indexOf("if(match&&!match.pendingTrigger&&!match.pendingDamageQueue?.length&&match.pendingHitResolution)");
  assert.ok(dispatch>damageQueue.indexOf("while ("),"hit event dispatch occurs after the damage-check loop");
  assert.match(damageQueue,/pendingHitResolution=null;queueAbilityPrompts\("hit",hit\.attackerSide,hit\.attackerUid,\{targetZone:hit\.targetZone,targetUid:hit\.targetUid,boostUid:hit\.boostUid,battleId:hit\.battleId,timingWindow:"vanguard-hit-after-damage-checks"\}\)/);
  assert.match(finishAttack,/queueAbilityPrompts\("hit",attack\.attackerSide,attack\.attackerUid,\{targetZone:attack\.targetZone,targetUid:attack\.targetUid,boostUid:attack\.boostUid,battleId:attack\.battleId,timingWindow:"rear-guard-hit"\}\)/);
});
test("real Kungfu Kid, Bolta AUTO requires its own attack and a strict Rear-Guard advantage",()=>{
  const card={id:"cfa-148",name:"Kungfu Kid, Bolta",clan:"Nova Grappler",text:"Nova Grappler/Battleroid\n\nAUTO [VC/RC]: When this unit attacks, if the number of rear-guards you have is more than your opponent’s, this unit gets power +3000 until end of that battle."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition.source.patternId,"auto-own-attack-rear-guard-advantage-power-battle-v1");
  assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);
  assert.equal(ability.conditionStatus,"modeled");
  assert.deepEqual(ability.conditions,[{type:"controller-has-more-rear-guards-than-opponent"}]);
  assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:3,opponentRearGuards:2}),true);
  assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:2,opponentRearGuards:2}),false);
  assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:1,opponentRearGuards:2}),false);
  const event=createGameEvent({matchId:"bolta"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"bolta-copy",subjectCardInstanceId:"bolta-copy",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"bolta-copy","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"different-copy","rear-left","rear-left","p1"),false);
  const source={uid:"bolta-copy",controllerPlayerId:"p1",turnPowerBoost:0},match={pendingAttack:{attackerUid:source.uid,power:8000}};
  assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"p1",match}).ok,true);
  assert.equal(match.pendingAttack.power,11000);
  const app=fs.readFileSync("app.js","utf8");
  assert.match(app,/controllerRearGuards:\(player\.rear\|\|\[\]\)\.filter\(Boolean\)\.length,opponentRearGuards:\(opponent\?\.rear\|\|\[\]\)\.filter\(Boolean\)\.length/);
});

test("rear-Guard advantage attack wording variants preserve the same exact condition",()=>{
  for(const wording of ["if you have more rear-guards than your opponent","and you have more rear-guards than your opponent"]){
    const ability=parseCardAbilities({id:"rear-guard-advantage-variant",text:`AUTO [VC/RC]: When this unit attacks, ${wording}, this unit gets power +3000 until end of that battle.`})[0];
    assert.equal(ability.definition?.source?.patternId,"auto-own-attack-rear-guard-advantage-power-battle-v1");assert.deepEqual(ability.conditions,[{type:"controller-has-more-rear-guards-than-opponent"}]);assert.equal(ability.conditionStatus,"modeled");
    assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:3,opponentRearGuards:2}),true);assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:2,opponentRearGuards:2}),false);
  }
});
test("legacy attack abilities without an AUTO label keep the exact source and battle context",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
 for(const cardId of ["cfa-667","cfa-690","cfa-1461"]){
  const card=loadCatalog().find(item=>item.id===cardId),ability=parseCardAbilities(card).find(item=>item.raw.includes("the number of rear-guards you have is greater than your opponent"));
  assert.ok(ability);assert.equal(ability.kind,"AUTO");assert.equal(ability.definition?.source?.patternId,"auto-own-attack-rear-guard-advantage-power-battle-v1");assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);assert.equal(ability.conditionStatus,"modeled");
  const event=createGameEvent({matchId:"legacy-rear-guard-attack"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"copy-a",subjectCardInstanceId:"copy-a"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"copy-a","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"copy-b","rear-left","rear-left","p1"),false);
 }
});

test("RC placement power AUTO matches exact source, circle, origin, controller, and target filters",()=>{
  const ability=parseCardAbilities({id:"cfa-923",text:"AUTO: When this unit is placed on RC, choose another of your grade 3 «Gold Paladin», and that unit gets power +3000 until end of turn."})[0];
  assert.equal(ability.definition?.source?.patternId,"auto-rc-placement-choose-friendly-clan-power-turn-v1");assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"source-controller",cardType:"unit",excludeSource:true,minGrade:3,maxGrade:3,clan:"Gold Paladin"});
  const placement={type:"card.placed",sourceCardInstanceId:"source",subjectCardInstanceId:"source",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"rear-guard"};
  assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"source","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"other","rear-right","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...placement,currentLocation:"vanguard"},"source","vanguard","vanguard","p1"),false);
  const fromDeck=parseCardAbilities({id:"cfa-173",text:"AUTO: When this unit is placed on RC from your deck, choose another of your «Gold Paladin» units, and that unit gets power +2000 until end of turn."})[0];
  assert.equal(fromDeck.trigger.sourceLocation,"deck");assert.equal(eventMatchesAbilityTrigger(fromDeck,"place",placement,"source","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(fromDeck,"place",{...placement,previousLocation:"deck"},"source","rear-left","rear-left","p1"),true);
  const source={uid:"source",turnPowerBoost:0},target={uid:"ally",turnPowerBoost:0},enemy={uid:"enemy"},base={source,sourceInPlay:true,side:"human",match:{},target,targetInPlay:true,sourceControllerPlayerId:"p1",targetControllerPlayerId:"p1",targetCard:{type:"Unit",grade:3,clan:"Gold Paladin"},targetZone:"rear-left"},filter=ability.definition.effects[0].targetFilter;
  assert.equal(matchesTargetFilter(filter,base),true);assert.equal(matchesTargetFilter(filter,{...base,target:source}),false);assert.equal(matchesTargetFilter(filter,{...base,targetControllerPlayerId:"p2"}),false);assert.equal(matchesTargetFilter(filter,{...base,targetCard:{type:"Unit",grade:2,clan:"Gold Paladin"}}),false);assert.equal(matchesTargetFilter(filter,{...base,targetCard:{type:"Unit",grade:3,clan:"Royal Paladin"}}),false);
  const highBeast=parseCardAbilities({id:"cfa-671",text:'AUTO: [Counter Blast 1] When this unit is placed on RC, you may pay the cost. If you do, choose another of your «Royal Paladin» <High Beast>, and that unit gets power +4000 until end of turn.'})[0],highBeastFilter=highBeast.definition.effects[0].targetFilter;
  assert.equal(matchesTargetFilter(highBeastFilter,{...base,targetCard:{type:"Unit",grade:2,clan:"Royal Paladin",text:"Royal Paladin/Human/High Beast"}}),true);assert.equal(matchesTargetFilter(highBeastFilter,{...base,targetCard:{type:"Unit",grade:2,clan:"Royal Paladin",text:"Royal Paladin/Human"}}),false);
  const named=parseCardAbilities({id:"cfa-1557",text:'AUTO: [Counter Blast 1] When this unit is placed on RC, you may pay the cost. If you do, choose another of your units with "Dimensional Robo" in its card name, and that unit gets power +4000 until end of turn.'})[0],nameFilter=named.definition.effects[0].targetFilter;
  assert.equal(matchesTargetFilter(nameFilter,{...base,targetCard:{type:"Unit",name:"Dimensional Robo, Daidragon"}}),true);assert.equal(matchesTargetFilter(nameFilter,{...base,targetCard:{type:"Unit",name:"Other Mecha"}}),false);
  const resolved=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,base);assert.equal(resolved.ok,true);assert.equal(target.turnPowerBoost,3000);
  const noTarget=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...base,target:null,targetInPlay:false,targetCard:null,targetZone:null,noLegalTarget:true});assert.equal(noTarget.ok,true);assert.deepEqual(noTarget.results,[0]);
  const paidAbility=highBeast,paidSource={uid:"paid-source"},paidTarget={uid:"paid-target"},damage=[{uid:"cb1",faceDown:false}],paidPlayer={playerId:"p1",vanguard:null,rear:[],damage,soul:[],hand:[],drop:[]};const payment=payAbilityCosts(paidAbility,{player:paidPlayer,source:paidSource,side:"human",sourceZone:"rear-left"},{cb:["cb1"],sb:[],discard:[],reveal:[]});assert.equal(payment.ok,true);const noTargetPaid=resolveEffectProgram(paidAbility.definition.effects,EFFECT_HANDLERS,{source:paidSource,sourceInPlay:true,side:"human",player:paidPlayer,match:{},target:null,targetInPlay:false,targetControllerPlayerId:null,targetPlayer:null,targetCard:null,targetZone:null,sourceControllerPlayerId:"p1",noLegalTarget:true});assert.equal(noTargetPaid.ok,true);assert.equal(damage[0].faceDown,true);
});
test("real Generation Break vanguard-attack power AUTO checks its GB reminder and exact attacker",()=>{
  const cards=[
    {id:"cfa-2680",name:"Coral Berry Squire",text:"AUTO [RC] Generation Break 1 (This ability is active if you have one or more face up G units in total on your VC or G zone): When this unit attacks a vanguard, this unit gets power +3000 until end of that battle."},
    {id:"cfa-2522",name:"Transmigration Knight, Brede",text:"AUTO [RC] Generation Break 1 (This ability is active if you have one or more face up G units on your VC and/or G Zone): When this unit attacks a vanguard, this unit gets power +3000 until end of battle."},
    {id:"cfa-4052",name:"Knight of Mastery, Glenus",text:"AUTO [VC/RC] Generation Break 1: When this unit attacks a vanguard, this unit gets power +4000 until end of that battle."},
    {id:"bad-gb-reminder",name:"Mismatched reminder",text:"AUTO [RC] Generation Break 1 (This ability is active if you have three or more face up G units in total on your VC or G zone): When this unit attacks a vanguard, this unit gets power +3000 until end of that battle."}
  ];
  const [reminder,alternateReminder,noReminder,mismatch]=cards.map(card=>parseCardAbilities(card)[0]);
  for(const ability of [reminder,alternateReminder,noReminder]){
    assert.equal(ability.definition.source.patternId,"auto-generation-break-own-vanguard-attack-power-battle-v1");
    assert.equal(ability.gb,1);
    assert.deepEqual(ability.requiredLocation,ability.cardId==="cfa-4052"?["vanguard","rear-guard"]:["rear-guard"]);
    assert.equal(ability.trigger.eventType,"unit.attacked");
    assert.equal(ability.conditionStatus,ability.cardId==="cfa-4052"?"no-explicit-condition-detected":"modeled");
  }
  assert.equal(mismatch.definition,null);
  assert.equal(mismatch.conditionStatus,"needs-review");
  const ability=reminder,event=createGameEvent({matchId:"gb-attack"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"source-copy",subjectCardInstanceId:"source-copy",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"source-copy","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other-copy","rear-left","rear-left","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...event,targetLocation:"rear-guard"},"source-copy","rear-left","rear-left","p1"),false);
  assert.equal(evaluateAbilityConditions(ability,{generationBreakCount:0}),false);
  assert.equal(evaluateAbilityConditions(ability,{generationBreakCount:1}),true);
  assert.match(fs.readFileSync("app.js","utf8"),/generationBreakCount\(side\)<a\.gb/);
  const source={uid:"source-copy",controllerPlayerId:"p1",turnPowerBoost:0},match={pendingAttack:{attackerUid:source.uid,power:11000}};
  assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"p1",match}).ok,true);
  assert.equal(match.pendingAttack.power,14000);
});
test("real Gardener Elf GB AUTO requires its exact booster, Vanguard target, and active Generation Break",()=>{
  const card={id:"cfa-2679",name:"Gardener Elf",clan:"Neo Nectar",text:"AUTO [RC] Generation Break 1 (This ability is active if you have one or more face up G units in total on your VC or G zone): When this unit boosts a vanguard, the boosted unit gets power +4000 until end of that battle."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition.source.patternId,"auto-generation-break-own-vanguard-boost-power-battle-v1");
  assert.deepEqual(ability.requiredLocation,["rear-guard"]);
  assert.equal(ability.gb,1);
  assert.equal(ability.conditionStatus,"modeled");
  assert.equal(evaluateAbilityConditions(ability,{generationBreakCount:0}),false);
  assert.equal(evaluateAbilityConditions(ability,{generationBreakCount:1}),true);
  const event=createGameEvent({matchId:"gardener"},{type:"unit.boosted",actingPlayerId:"p1",sourceCardInstanceId:"booster-copy",subjectCardInstanceId:"booster-copy",boosterCardInstanceId:"booster-copy",boostedCardInstanceId:"vanguard-copy",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"booster-copy","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"different-booster","rear-left","rear-left","p1"),false);
  const filter=ability.definition.effects[0].targetFilter,source={uid:"booster-copy",controllerPlayerId:"p1"},target={uid:"vanguard-copy",controllerPlayerId:"p1",turnPowerBoost:0},match={pendingAttack:{attackerUid:target.uid,power:10000}};
  const context={source,sourceControllerPlayerId:"p1",target,targetControllerPlayerId:"p1",targetCard:{type:"Unit"},targetZone:"vanguard",targetInPlay:true,match,side:"p1"};
  assert.equal(matchesTargetFilter(filter,context),true);
  assert.equal(matchesTargetFilter(filter,{...context,targetControllerPlayerId:"p2"}),false);
  assert.equal(matchesTargetFilter(filter,{...context,targetZone:"rear-left"}),false);
  assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(match.pendingAttack.power,14000);
});
test("real Metalborg Drion center-column AUTO checks the exact Vanguard attack and back-center slot",()=>{
  const card={id:"cfa-2090",name:"Metalborg Drion",clan:"Dimension Police",text:"Dimension Police/Battleroid\n\nACT [VC]: Legion 20000 \"Metalborg Lionetter\" (If your opponent’s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n\nAUTO [VC]: When this unit attacks a vanguard, if this unit is Legion, and this unit’s power is 30000 or greater, until end of that battle, this unit gets critical +1.\n\nAUTO [VC]: When this unit attacks a vanguard, if you have another unit in the center column, this unit gets power +3000 until end of that battle."};
  const abilities=parseCardAbilities(card);
  assert.equal(abilities.length,3,"all three printed abilities remain independent");
  const ability=abilities.find(item=>item.raw.includes("another unit in the center column"));
  assert.equal(abilities.filter(item=>item.definition?.source?.patternId==="auto-vanguard-attack-center-column-power-battle-v1").length,1);
  assert.equal(ability.definition.source.patternId,"auto-vanguard-attack-center-column-power-battle-v1");
  assert.deepEqual(ability.requiredLocation,["vanguard"]);
  assert.equal(ability.conditionStatus,"modeled");
  assert.deepEqual(ability.conditions,[{type:"controller-has-center-column-rear-guard"}]);
  assert.equal(evaluateAbilityConditions(ability,{controllerCenterColumnRearGuard:true}),true);
  assert.equal(evaluateAbilityConditions(ability,{controllerCenterColumnRearGuard:false}),false);
  const event=createGameEvent({matchId:"center-column"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"drion-copy",subjectCardInstanceId:"drion-copy",targetLocation:"vanguard",phase:"battle"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"drion-copy","vanguard","vanguard","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other-copy","vanguard","vanguard","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...event,targetLocation:"rear-guard"},"drion-copy","vanguard","vanguard","p1"),false);
  const source={uid:"drion-copy",controllerPlayerId:"p1",turnPowerBoost:0},match={pendingAttack:{attackerUid:source.uid,power:11000}};
  assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"p1",match}).ok,true);
  assert.equal(match.pendingAttack.power,14000);
  assert.match(fs.readFileSync("app.js","utf8"),/controllerCenterColumnRearGuard:Boolean\(player\.rear\?\.\[3\]\)/);
});
test("real boost AUTO raises its own booster and the current battle total exactly once",()=>{
  const card={id:"cfa-8378",name:"Extremist Dragon, Velocihazard",clan:"Dragon Empire",text:"Dragon Empire/Dinodragon\n\nAUTO [RC]: When this unit boosts, this unit gets power +2000 until end of turn."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition.source.patternId,"auto-own-boost-turn-power-v1");
  assert.deepEqual(ability.requiredLocation,["rear-guard"]);
  assert.equal(ability.trigger.eventType,"unit.boosted");
  const event=createGameEvent({matchId:"boost-power"},{type:"unit.boosted",actingPlayerId:"p1",sourceCardInstanceId:"booster-copy",subjectCardInstanceId:"booster-copy",boosterCardInstanceId:"booster-copy",boostedCardInstanceId:"attacker-copy"});
  assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"booster-copy","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"different-booster","rear-left","rear-left","p1"),false);
  const source={uid:"booster-copy",controllerPlayerId:"p1",turnPowerBoost:0},match={pendingAttack:{attackerUid:"attacker-copy",boostUid:source.uid,boostPower:5000,power:20000}};
  const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"p1",match});
  assert.equal(result.ok,true);
  assert.equal(source.turnPowerBoost,2000);
  assert.equal(match.pendingAttack.boostPower,7000);
  assert.equal(match.pendingAttack.power,22000);
  const battleProgram=[{op:"modify-power",target:"source",amount:1000,duration:"battle"}],battleContext={source,sourceInPlay:true,side:"p1",match};
  assert.equal(validateEffectProgram(battleProgram,EFFECT_HANDLERS,battleContext).ok,true);
  const battleBoost=resolveEffectProgram(battleProgram,EFFECT_HANDLERS,battleContext);
  assert.equal(battleBoost.ok,true);
  assert.equal(source.turnPowerBoost,2000,"battle-only modifier does not persist on the source");
  assert.equal(match.pendingAttack.boostPower,8000);
  assert.equal(match.pendingAttack.power,23000);
  const unrelated={pendingAttack:{attackerUid:"attacker-copy",boostUid:"other-booster",boostPower:5000,power:20000}},unrelatedContext={source,sourceInPlay:true,side:"p1",match:unrelated};
  assert.equal(validateEffectProgram(battleProgram,EFFECT_HANDLERS,unrelatedContext).ok,false);
  assert.equal(resolveEffectProgram(battleProgram,EFFECT_HANDLERS,unrelatedContext).ok,false);
  assert.equal(unrelated.pendingAttack.boostPower,5000);
  assert.equal(unrelated.pendingAttack.power,20000);
});

test("real own-turn Rear-Guard CONT power applies continuously only in its controller's timing and circle",()=>{
  const ability=parseCardAbilities({id:"cfa-8457",name:"Kashuu Kiyomitsu Sentou",text:"CONT [RC]: During your turn, this unit gets power +2000."})[0];
  assert.equal(ability.kind,"CONT");
  assert.equal(ability.definition.source.patternId,"cont-rc-own-turn-power-v1");
  assert.deepEqual(ability.requiredLocation,["rear-guard"]);
  assert.equal(isManuallyActivatable(ability),false);
  assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard",isControllerTurn:true}),{power:2000,critical:0,drive:0});
  assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard",isControllerTurn:false}),{power:0,critical:0,drive:0});
  assert.deepEqual(evaluateContinuousEffects([ability],{location:"vanguard",isControllerTurn:true}),{power:0,critical:0,drive:0});
  assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard"}),{power:0,critical:0,drive:0});
});


test("real GC CONT shield requires the opponent grade threshold and the exact Guardian Circle",()=>{
  const ability=parseCardAbilities({id:"cfa-8592",name:"Guard card",text:"CONT [GC]: If your opponent’s vanguard is grade 3 or greater, this unit gets shield +5000."})[0];
  assert.equal(ability.definition.source.patternId,"cont-gc-opponent-grade-shield-v1");
  assert.deepEqual(ability.requiredLocation,["guardian"]);
  assert.equal(ability.conditionStatus,"modeled");
  assert.deepEqual(ability.conditions,[{type:"opponent-vanguard-grade-at-least",count:3}]);
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian",opponentVanguardGrade:3}),{shield:5000});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian",opponentVanguardGrade:2}),{shield:0});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"rear-guard",opponentVanguardGrade:3}),{shield:0});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian",opponentVanguardGrade:-1}),{shield:0});
  const app=fs.readFileSync("app.js","utf8");
  assert.ok(app.includes('function effectiveShieldValue(instance,side,zone="guardian")'));
  assert.ok(app.includes('const shield=effectiveShieldValue(instance,"human");match.pendingAttack.targetPower+=shield'));
  assert.ok(app.includes('shield:effectiveShieldValue(item,"bot")'));
});

test("GC Generation Break shield CONT checks live face-up G count only on Guardian Circle",()=>{
  const ability=parseCardAbilities({id:"cfa-3509",name:"Stealth Rogue of the Mirrored Moon, Tsubakuro",text:"CONT [GC] Generation Break 1: This unit gets shield +5000."})[0];
  assert.equal(ability.definition?.source?.patternId,"cont-gc-generation-break-shield-v1");assert.equal(ability.gb,1);assert.deepEqual(ability.requiredLocation,["guardian"]);
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian",generationBreakCount:0}),{shield:0});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian",generationBreakCount:1}),{shield:5000});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"guardian",generationBreakCount:2}),{shield:5000});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{location:"rear-left",generationBreakCount:1}),{shield:0});
  assert.deepEqual(evaluateContinuousShieldEffects([ability],{generationBreakCount:1}),{shield:0});
  const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("generationBreakCount:generationBreakCount(side)"));
});


test("real Hand CONT Stride grade bonus applies only inside the exact cost-payment window",()=>{
  const ability=parseCardAbilities({id:"cfa-2471",name:"Gear Chronicle grade modifier",text:"CONT [Hand]: While you are paying the cost for Stride, this card gets grade +2."})[0];
  assert.equal(ability.definition.source.patternId,"cont-hand-stride-cost-grade-boost-v1");
  assert.deepEqual(ability.requiredLocation,["hand"]);
  assert.equal(ability.costStatus,"no-cost");
  assert.deepEqual(evaluateStrideCostGrade([ability],{location:"hand",isPayingStrideCost:true}),{grade:2});
  assert.deepEqual(evaluateStrideCostGrade([ability],{location:"hand",isPayingStrideCost:false}),{grade:0});
  assert.deepEqual(evaluateStrideCostGrade([ability],{location:"rear-guard",isPayingStrideCost:true}),{grade:0});
  const app=fs.readFileSync("app.js","utf8");
  assert.ok(app.includes("strideGrade(item,true)"));
  assert.ok(app.includes("strideGrade(item,true), 0)"));
});


test("real Hand CONT Stride replacement treats the selected card as grade 3 only during payment",()=>{
  const ability=parseCardAbilities({id:"cfa-502",name:"Stride cost support",text:"CONT [Hand]: While paying the cost for Stride, this card may be discarded as a grade 3."})[0];
  assert.equal(ability.definition.source.patternId,"cont-hand-stride-cost-treated-grade-three-v1");
  assert.deepEqual(ability.requiredLocation,["hand"]);
  assert.equal(ability.costStatus,"no-cost");
  assert.deepEqual(evaluateStrideCostGrade([ability],{location:"hand",isPayingStrideCost:true}),{grade:0,treatedAsGradeThree:true});
  assert.deepEqual(evaluateStrideCostGrade([ability],{location:"hand",isPayingStrideCost:false}),{grade:0});
  assert.deepEqual(evaluateStrideCostGrade([ability],{location:"rear-guard",isPayingStrideCost:true}),{grade:0});
  const app=fs.readFileSync("app.js","utf8");
  assert.ok(app.includes("modifier.treatedAsGradeThree?3:gradeOf(card)"));
});


test("real damage-check reveal AUTO matches only the exact revealed card instance and draws once",()=>{
  const ability=parseCardAbilities({id:"cfa-10781",name:"Heart Thump Worker",text:"Gear Chronicle/Workeroid/Critical Trigger\n\nAUTO: When this card is revealed during your damage check, draw a card."})[0];
  assert.equal(ability.definition.source.patternId,"auto-self-revealed-damage-check-draw-v1");
  assert.equal(ability.trigger.eventType,"damage.checked");
  assert.equal(ability.trigger.subject,"event-subject");
  const event=createGameEvent({matchId:"damage-reveal"},{type:"damage.checked",actingPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"revealed-copy",checkedCardInstanceId:"revealed-copy",checkKind:"damage",previousLocation:"deck",currentLocation:"damage"});
  assert.equal(eventMatchesAbilityTrigger(ability,"damageCheck",event,"revealed-copy","deck",null,"p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"damageCheck",{...event,checkedCardInstanceId:null},"revealed-copy","deck",null,"p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"damageCheck",{...event,checkedCardInstanceId:"other-copy"},"revealed-copy","deck",null,"p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"damageCheck",event,"different-copy","deck",null,"p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"damageCheck",event,"attacker","deck",null,"p1"),false);
  const drive=createGameEvent({matchId:"damage-reveal"},{type:"drive.checked",actingPlayerId:"p1",subjectCardInstanceId:"revealed-copy"});
  assert.equal(eventMatchesAbilityTrigger(ability,"damageCheck",drive,"revealed-copy","deck",null,"p1"),false);
  const drawn={uid:"drawn-card",cardId:"test"},player={deck:[drawn],hand:[]};
  assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,side:"p1"}).ok,true);
  assert.deepEqual(player.hand,[drawn]);
});

test("real Escort Stealth Dragon, Hayashi Kaze Sentinel protects a chosen unit after its own GC placement", () => {
  const ability=parseCardAbilities({id:"cfa-8234",name:"Escort Stealth Dragon, Hayashi Kaze",text:"Dragon Empire/Abyss Dragon\n\nCONT: Sentinel.\n\nAUTO: When this unit is put into your GC, COST [discard a card from your hand], choose one of your units, and it cannot be hit until end of that battle."}).find(item=>item.kind==="AUTO");
  assert.equal(ability.definition.source.patternId,"auto-gc-sentinel-protect-friendly-unit-v1");
  assert.deepEqual(ability.requiredLocation,[]);
  assert.deepEqual(ability.trigger.circles,["guardian"]);
  assert.deepEqual(ability.costs,[{type:"discard",count:1}]);
  assert.equal(ability.canDecline,false);
  const placement=createGameEvent({matchId:"hayashi-kaze"},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p2",sourceCardInstanceId:"hayashi-copy",subjectCardInstanceId:"hayashi-copy",sourceControllerPlayerId:"p1",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"guardian",circle:"guardian",battleId:"battle-1"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"hayashi-copy","guardian","guardian","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"other-copy","guardian","guardian","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"hayashi-copy","rear-left","rear-left","p1"),false);
  const target={uid:"attacked-vanguard",controllerPlayerId:"p1",rested:false},attack={targetUid:target.uid,perfectGuard:false,blocked:false};
  const context={source:{uid:"hayashi-copy"},player:{playerId:"p1"},side:"p1",match:{pendingAttack:attack},sourceInPlay:false,target,targetInPlay:true,targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",targetCard:{type:"Normal Unit"},targetZone:"vanguard"};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(attack.perfectGuard,true);
  const otherAttack={targetUid:"different-unit",perfectGuard:false,blocked:false};
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,match:{pendingAttack:otherAttack}}).ok,true);
  assert.equal(otherAttack.perfectGuard,false);
  const app=fs.readFileSync("app.js","utf8");
  assert.match(app,/eventContext\?\.perfectGuardPaid&&ability\.definition\?\.effects\?\.some\(effect=>effect\.op===\"protect-target\"\)\)return/);
  assert.match(app,/battleId:attack\.battleId,perfectGuardPaid:true/);
  assert.match(app,/eventName==="place"&&eventContext\.sourceZone==="guardian"\)movedInstance=\(player\.guardCircle\|\|\[\]\)\.find/);
});

test("real The Turbogust Type 1 only prevents a hit when its own RC is attacked without a booster",()=>{
  const ability=parseCardAbilities({id:"cfa-6703",name:"The Turbogust Type 1",text:"Nova Grappler/Battleroid\n\nCONT: Sentinel.\n\nACT [RC]: COST [Counter Blast 1], and this unit gets power +2000 until end of turn.\n\nAUTO [RC]: When this unit is attacked without being boosted, this unit cannot be hit until the end of that battle."}).find(item=>item.kind==="AUTO");
  assert.equal(ability.definition.source.patternId,"auto-rc-attacked-unboosted-cannot-be-hit-v1");
  assert.deepEqual(ability.requiredLocation,["rear-guard"]);
  assert.equal(ability.trigger.requiresUnboostedAttacker,true);
  const event=createGameEvent({matchId:"turbogust"},{type:"attack.declared",actingPlayerId:"p2",turnPlayerId:"p2",sourceCardInstanceId:"attacker",subjectCardInstanceId:"turbogust-copy",sourceControllerPlayerId:"p2",subjectControllerPlayerId:"p1",targetLocation:"rear-guard",battleId:"b-1"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attacked",event,"turbogust-copy","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attacked",{...event,boosterCardInstanceId:"booster"},"turbogust-copy","rear-left","rear-left","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"attacked",event,"other-copy","rear-left","rear-left","p1"),false);
  const attack={targetUid:"turbogust-copy",boostUid:null,perfectGuard:false},source={uid:"turbogust-copy"},context={source,sourceInPlay:true,match:{pendingAttack:attack}};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(attack.perfectGuard,true);
  const boostedAttack={targetUid:"turbogust-copy",boostUid:"booster",perfectGuard:false};
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,match:{pendingAttack:boostedAttack}}).ok,false);
  const app=fs.readFileSync("app.js","utf8");
  assert.equal((app.match(/boostUid:match\.pendingAttack\.boostUid,battleId:match\.pendingAttack\.battleId,timingWindow:\"attack-declared\"/g)||[]).length,2);
});

test("real Dark Shield, Mac Lir preserves its clan-filtered Sentinel discard and protection target",()=>{
  const ability=parseCardAbilities({id:"cfa-15",name:"Dark Shield, Mac Lir",text:"Shadow Paladin/Human\n\nCONT: Sentinel.\n\nAUTO: [Choose a «Shadow Paladin» from your hand, and discard it] When this unit is placed on GC, you may pay the cost. If you do, choose one of your «Shadow Paladin», and that unit cannot be hit until end of that battle."}).find(item=>item.kind==="AUTO");
  assert.equal(ability.definition.source.patternId,"auto-gc-sentinel-protect-friendly-unit-v1");
  assert.deepEqual(ability.costs,[{type:"discard",count:1,filter:{clan:"Shadow Paladin"}}]);
  assert.deepEqual(ability.effects[0].targetFilter,{controller:"source-controller",cardType:"unit",clan:"Shadow Paladin"});
  assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,{sourceControllerPlayerId:"p1",targetControllerPlayerId:"p1",targetCard:{clan:"Kagero",text:"Kagero/Dragon\nThis card mentions Shadow Paladin."}}),false);
  const hand=[{uid:"wrong-clan",cardId:"wrong"},{uid:"shadow-paladin",cardId:"shadow"}],player={playerId:"p1",damage:[],soul:[],hand,drop:[],rear:[],usedAbilities:[]},source={uid:"mac-lir",cardId:"cfa-15"},context={player,source,side:"p1",sourceZone:"guardian",cardDefinitionForInstance:card=>({wrong:{clan:"Kagero"},shadow:{clan:"Shadow Paladin"}}[card.cardId])};
  assert.equal(payAbilityCosts(ability,context,{discard:["wrong-clan"]}).reason,"discard-filter-not-met");
  assert.equal(player.hand.length,2);assert.equal(player.drop.length,0);
  assert.equal(payAbilityCosts(ability,context,{discard:["shadow-paladin"]}).ok,true);
  assert.deepEqual(player.hand,[hand[0]]);assert.equal(player.drop[0].uid,"shadow-paladin");
  const app=fs.readFileSync("app.js","utf8");assert.match(app,/function abilityDiscardCards[^{]+\{[\s\S]{0,450}matchesTargetFilter/);
});

test("from-hand Guardian Circle Sentinel variants reject the same source placed from another zone",()=>{
  const ability=parseCardAbilities({id:"cfa-5280",name:"Liberator, Improve Falcon",text:"Gold Paladin/High Beast\n\nCONT: Sentinel.\n\nAUTO: [Choose a card from your hand, and discard it] When this unit is placed on GC from hand, you may pay the cost. If you do, choose one of your units, and it cannot be hit until end of that battle."}).find(item=>item.kind==="AUTO");
  assert.equal(ability.definition.source.patternId,"auto-gc-sentinel-protect-friendly-unit-v1");
  assert.equal(ability.trigger.sourceLocation,"hand");
  const base={type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p2",sourceCardInstanceId:"falcon",subjectCardInstanceId:"falcon",sourceControllerPlayerId:"p1",subjectControllerPlayerId:"p1",currentLocation:"guardian",circle:"guardian"};
  const fromHand=createGameEvent({matchId:"falcon"},{...base,previousLocation:"hand"});
  const fromDrop=createGameEvent({matchId:"falcon"},{...base,previousLocation:"drop"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",fromHand,"falcon","guardian","guardian","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",fromDrop,"falcon","guardian","guardian","p1"),false);
});

test("real Rock The Wall moves only its exact GC-to-Drop source instance into Soul",()=>{
  const ability=parseCardAbilities({id:"cfa-449",name:"Rock The Wall",text:"Nova Grappler/Battleroid\n\nAUTO: When this unit is put into the drop zone from GC, put this card into your soul."})[0];
  assert.equal(ability.definition.source.patternId,"auto-gc-drop-self-to-soul-v1");
  assert.equal(ability.trigger.eventType,"card.moved");assert.equal(ability.trigger.sourceLocation,"guardian");assert.equal(ability.trigger.destinationLocation,"drop");
  const card={uid:"rock-the-wall-copy",cardId:"cfa-449"};
  const moved=createGameEvent({matchId:"rock-wall"},{type:"card.moved",actingPlayerId:"p1",sourceCardInstanceId:card.uid,subjectCardInstanceId:card.uid,previousLocation:"guardian",currentLocation:"drop"});
  assert.equal(eventMatchesAbilityTrigger(ability,"move",moved,card.uid,"guardian","guardian","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"move",{...moved,previousLocation:"hand"},card.uid,"hand","hand","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"move",{...moved,currentLocation:"soul"},card.uid,"guardian","guardian","p1"),false);
  const player={drop:[card],soul:[],hand:[],damage:[],rear:[]},context={source:card,player,side:"p1"},events=[];
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,emitEvent:event=>events.push(event)}).ok,true);
  assert.deepEqual(player.drop,[]);assert.deepEqual(player.soul,[card]);assert.equal(events[0].cardInstanceId,card.uid);
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,player:{...player,drop:[]}}).ok,false);
});

test("optional GC retirement AUTO can be declined or move only its exact retired source to Soul",()=>{
  const ability=parseCardAbilities({id:"cfa-13597",name:"Stealth Fiend, Futakuchiyo",text:"AUTO: When this unit is retired from GC, you may put this card into soul."})[0];
  assert.equal(ability.definition?.source?.patternId,"auto-gc-retire-optional-source-to-soul-v1");
  assert.equal(ability.trigger?.eventType,"card.retired");assert.equal(ability.trigger?.sourceLocation,"guardian");assert.equal(ability.trigger?.destinationLocation,"drop");
  assert.equal(ability.canDecline,true);assert.equal(ability.choiceStatus,"modeled");assert.equal(canDeclineAbility(ability),true);
  const card={uid:"futakuchiyo-copy",cardId:"cfa-13597"},event=createGameEvent({matchId:"futakuchiyo"},{type:"card.retired",actingPlayerId:"p1",sourceCardInstanceId:card.uid,sourceControllerPlayerId:"p1",subjectCardInstanceId:card.uid,subjectControllerPlayerId:"p1",previousLocation:"guardian",currentLocation:"drop"});
  assert.equal(eventMatchesAbilityTrigger(ability,"retire",event,card.uid,"guardian","guardian","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"retire",{...event,previousLocation:"rear-left"},card.uid,"rear-left","rear-left","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"retire",{...event,sourceCardInstanceId:"different-copy",subjectCardInstanceId:"different-copy"},card.uid,"guardian","guardian","p1"),false);
  const player={drop:[card],soul:[],hand:[],damage:[],rear:[]},context={source:card,player,side:"p1"};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);
  assert.deepEqual(player.drop,[]);assert.deepEqual(player.soul,[card]);
  const unrelated={uid:"unrelated-copy",cardId:"cfa-13598"};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,player:{...player,drop:[unrelated],soul:[]}}).ok,false);
});

test("implicit retired-from-GC wording binds the optional Soul effect to the exact retired source",()=>{
 const ability=parseCardAbilities({id:"implicit-gc-retire",text:"AUTO: When retired from GC, you may put this card into soul."})[0],source={uid:"gc-source",cardId:"implicit-gc-retire"};
 assert.equal(ability.kind,"AUTO");assert.equal(ability.definition?.source?.patternId,"auto-gc-retire-optional-source-to-soul-v1");assert.equal(ability.trigger?.eventType,"card.retired");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.sourceLocation,"guardian");assert.equal(ability.trigger?.destinationLocation,"drop");assert.deepEqual(autoAbilityReadiness(ability),{ok:true});
 const event=createGameEvent({matchId:"implicit-gc"},{type:"card.retired",actingPlayerId:"p1",sourceCardInstanceId:source.uid,sourceControllerPlayerId:"p1",subjectCardInstanceId:source.uid,subjectControllerPlayerId:"p1",previousLocation:"guardian",currentLocation:"drop"});
 assert.equal(eventMatchesAbilityTrigger(ability,"retire",event,source.uid,"guardian","guardian","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"retire",{...event,sourceCardInstanceId:"other",subjectCardInstanceId:"other"},source.uid,"guardian","guardian","p1"),false);
});

test("real Battle-hour Rupture Colossus checks discarded-card identity, hand source, Ride phase, Soul Blast, and draw",()=>{
  const ability=parseCardAbilities({id:"cfa-12267",name:"Battle-hour Rupture Colossus",text:"AUTO: When this card is discarded from hand during your ride phase, COST [Soul Blast 2], and draw a card."})[0];
  assert.equal(ability.definition.source.patternId,"auto-ride-phase-discard-soul-blast-draw-v1");
  assert.deepEqual(ability.costs,[{type:"soul-blast",count:2}]);assert.equal(ability.trigger.sourceLocation,"hand");assert.equal(ability.trigger.requiredPhase,"ride");
  const event=createGameEvent({matchId:"rupture-colossus"},{type:"card.discarded",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"rupture-copy",subjectCardInstanceId:"rupture-copy",previousLocation:"hand",currentLocation:"drop",phase:"ride"});
  assert.equal(eventMatchesAbilityTrigger(ability,"discard",event,"rupture-copy","drop","hand","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,phase:"main"},"rupture-copy","drop","hand","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,previousLocation:"soul"},"rupture-copy","drop","soul","p1"),false);
  const source={uid:"rupture-copy",cardId:"cfa-12267"},soul=[{uid:"soul-a"},{uid:"soul-b"}],drawn={uid:"draw-card"},player={playerId:"p1",damage:[],soul,hand:[],drop:[source],rear:[],deck:[drawn]},context={source,player,side:"p1",sourceInPlay:false,match:{},emitEvent:()=>{}};
  const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context,draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"p1",sourceZone:"drop"},{cb:[],sb:["soul-a","soul-b"],discard:[]}).ok);
  assert.equal(result.ok,true);assert.deepEqual(player.soul,[]);assert.deepEqual(player.drop,[source,...soul]);assert.deepEqual(player.hand,[drawn]);
  const app=fs.readFileSync("app.js","utf8");assert.equal((app.match(/phase:phases\[match\.phase\]\?\.toLowerCase\(\)\|\|null/g)||[]).length,1);assert.ok(app.includes("phase:eventContext.phase||phases[match.phase]?.toLowerCase()||null"));
});

test("real Circular Saw, Kiriel shorthand Limit Break 4 checks damage, exact attacker, VC, and Vanguard target",()=>{
  const ability=parseCardAbilities({id:"cfa-727",name:"Circular Saw, Kiriel",text:"AUTO [VC] Limit Break 4: When this unit attacks a vanguard, this unit gets power +5000 until end of that battle."})[0];
  assert.equal(ability.definition.source.patternId,"auto-legacy-limit-break-vanguard-attack-power-v1");
  assert.deepEqual(ability.conditions,[{type:"limit-break-active",count:4}]);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.requiredLocation,["vanguard"]);
  assert.equal(evaluateAbilityConditions(ability,{damageCount:4}),true);assert.equal(evaluateAbilityConditions(ability,{damageCount:3}),false);
  const source={uid:"kiriel-copy"},attack={attackerUid:source.uid,power:11000},context={source,sourceInPlay:true,side:"p1",match:{pendingAttack:attack}};
  const event=createGameEvent({matchId:"kiriel"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:source.uid,subjectCardInstanceId:source.uid,targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,source.uid,"vanguard","vanguard","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"different-copy","vanguard","vanguard","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...event,targetLocation:"rear-guard"},source.uid,"vanguard","vanguard","p1"),false);
  assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(attack.power,16000);
});

test("Limit Break enabler CONT is exact, rear-guard-only, and enables only Vanguard Limit Break",()=>{
  const card={id:"cfa-2316",name:"Seal Dragon Sprite, Mulciber",text:"Kagero/Salamander\n\nCONT [RC]: Your vanguard’s \"Limit Break 4\" is active even when you have three or less damage."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.kind,"CONT");assert.equal(ability.definition?.source?.patternId,"cont-vanguard-limit-break-4-active-at-three-or-less-v1");
  assert.deepEqual(ability.definition.keywords,["vanguard-limit-break-4-active-at-three-or-less"]);assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.equal(ability.conditionStatus,"no-explicit-condition-detected");assert.equal(isManuallyActivatable(ability),false);
  const lb=parseCardAbilities({id:"lb-test",text:"AUTO [VC] Limit Break 4: When this unit attacks a vanguard, this unit gets power +5000 until end of that battle."})[0];
  assert.equal(evaluateAbilityConditions(lb,{damageCount:3}),false);assert.equal(evaluateAbilityConditions(lb,{damageCount:3,vanguardLimitBreakActive:true}),true);assert.equal(evaluateAbilityConditions(lb,{damageCount:4}),true);assert.equal(evaluateAbilityConditions(lb,{damageCount:2,vanguardLimitBreakActive:false}),false);
});

test("real Knight of Steel Wing adds power to only its own defense for the current battle",()=>{
  const ability=parseCardAbilities({id:"cfa-2526",name:"Knight of Steel Wing",text:"AUTO [VC/RC]: When this unit is attacked, this unit gets power +5000 until the end of that battle."})[0];
  assert.equal(ability.definition.source.patternId,"auto-attacked-source-battle-power-v1");assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);
  const target={uid:"steel-wing-copy"},event=createGameEvent({matchId:"steel-wing"},{type:"attack.declared",actingPlayerId:"p2",sourceCardInstanceId:"attacker",subjectCardInstanceId:target.uid,targetLocation:"rear-guard",phase:"battle"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attacked",event,target.uid,"rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attacked",event,"other-copy","rear-left","rear-left","p1"),false);
  const attack={attackerUid:"attacker",targetUid:target.uid,power:12000,targetPower:8000},context={source:target,sourceInPlay:true,side:"p1",match:{pendingAttack:attack}};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(attack.targetPower,13000);
  const unrelated={attackerUid:"attacker",targetUid:"another-unit",power:12000,targetPower:8000};assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,match:{pendingAttack:unrelated}}).ok,false);assert.equal(unrelated.targetPower,8000);
});


test("own attack hand-advantage AUTO compiles with a live comparative condition",()=>{
  const card={id:"cfa-hand-advantage-test",text:"AUTO [VC/RC]: When this unit attacks, if the number of cards in your hand is greater than your opponent’s, this unit gets power +3000 until end of that battle."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition.source.patternId,"auto-own-attack-hand-advantage-power-battle-v1");
  assert.equal(ability.conditionStatus,"modeled");
  assert.equal(evaluateAbilityConditions(ability,{controllerHandCount:5,opponentHandCount:4}),true);
  assert.equal(evaluateAbilityConditions(ability,{controllerHandCount:4,opponentHandCount:4}),false);
  assert.equal(evaluateAbilityConditions(ability,{controllerHandCount:2,opponentHandCount:4}),false);
  const event=createGameEvent({matchId:"hand-advantage",eventSequence:1},{type:"unit.attacked",actingPlayerId:"player-a",sourceCardInstanceId:"unit-a",subjectCardInstanceId:"unit-a",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"unit-a","vanguard","vanguard","player-a"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"unit-b","vanguard","vanguard","player-a"),false);
});

test("own attack opponent Rear-Guard cap AUTO checks exact attacker and current opposing count",()=>{
  const card={id:"cfa-opponent-rearguard-cap-test",text:"AUTO [VC/RC]: When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets power +3000 until end of that battle."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition.source.patternId,"auto-own-attack-opponent-rearguard-cap-power-battle-v1");
  assert.equal(ability.conditionStatus,"modeled");
  assert.equal(evaluateAbilityConditions(ability,{opponentRearGuards:2}),true);
  assert.equal(evaluateAbilityConditions(ability,{opponentRearGuards:3}),false);
  assert.equal(evaluateAbilityConditions(ability,{}),false);
  const event=createGameEvent({matchId:"rearguard-cap"},{type:"unit.attacked",actingPlayerId:"player-a",sourceCardInstanceId:"unit-a",subjectCardInstanceId:"unit-a",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"unit-a","vanguard","vanguard","player-a"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"unit-b","vanguard","vanguard","player-a"),false);
});

test("Soul Blast attack AUTO requires its exact Vanguard attacker and payable optional cost",()=>{
  const ability=parseCardAbilities({id:"soul-blast-attack",text:"AUTO [VC/RC]: [Soul Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets power +3000 until end of that battle."})[0];
  assert.equal(ability.definition.source.patternId,"auto-own-attack-soul-blast-power-battle-v1");
  assert.equal(ability.canDecline,true);
  assert.deepEqual(ability.costs,[{type:"soul-blast",count:1}]);
  assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);
  assert.equal(ability.trigger.targetLocation,"vanguard");
  assert.equal(canPayAbilityCosts(ability,{soulCount:0}),false);
  assert.equal(canPayAbilityCosts(ability,{soulCount:1}),true);
  const event=createGameEvent({matchId:"soul-attack"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",targetLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"attacker","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other","rear-left","rear-left","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...event,targetLocation:"rear-guard"},"attacker","rear-left","rear-left","p1"),false);
});

test("attack-target grade condition requires the exact source attack and target grade threshold",()=>{
  const ability=parseCardAbilities({id:"attack-grade-test",text:"AUTO [RC]: When this unit attacks a grade 3 or greater unit, this unit gets power +5000 until end of that battle. (SHIFT + left click to get a Persona Shield ticket)"})[0];
  assert.equal(ability.definition.source.patternId,"auto-own-attack-target-grade-power-battle-v1");
  assert.equal(ability.conditionStatus,"modeled");
  assert.equal(evaluateAbilityConditions(ability,{attackTargetGrade:3}),true);
  assert.equal(evaluateAbilityConditions(ability,{attackTargetGrade:2}),false);
  assert.equal(evaluateAbilityConditions(ability,{}),false);
  const event=createGameEvent({matchId:"attack-grade"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"source","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other","rear-left","rear-left","p1"),false);
});

test("Soul-Blast named-boost AUTO requires its exact booster, optional cost, and matching target name",()=>{
  const exact=parseCardAbilities({id:"boost-named-exact",text:"AUTO [RC]: [Soul Blast 1] When this unit boosts a card named \"Iris Knight\", you may pay the cost. If you do, the boosted unit gets power +4000 until end of that battle."})[0];
  assert.equal(exact.definition.source.patternId,"auto-soul-blast-named-boost-power-battle-v1");
  assert.deepEqual(exact.costs,[{type:"soul-blast",count:1}]);
  assert.equal(exact.canDecline,true);
  assert.equal(canPayAbilityCosts(exact,{soulCount:0}),false);assert.equal(canPayAbilityCosts(exact,{soulCount:1}),true);
  const event=createGameEvent({matchId:"named-boost"},{type:"unit.boosted",actingPlayerId:"p1",sourceCardInstanceId:"booster",subjectCardInstanceId:"booster",boostedCardName:"Iris Knight"});
  assert.equal(eventMatchesAbilityTrigger(exact,"boost",event,"booster","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(exact,"boost",{...event,boostedCardName:"Other Unit"},"booster","rear-left","rear-left","p1"),false);
  const contains=parseCardAbilities({id:"boost-name-fragment",text:"AUTO [RC]: [Soul Blast 1] When this unit boosts a card with \"Blaster\" in its card name, you may pay the cost. If you do, the boosted unit gets power +6000 until end of that battle."})[0];
  assert.equal(contains.definition.source.patternId,"auto-soul-blast-named-boost-power-battle-v1");
  const blasterEvent={...event,boostedCardName:"Blaster Blade"};
  assert.equal(eventMatchesAbilityTrigger(contains,"boost",blasterEvent,"booster","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(contains,"boost",{...blasterEvent,boostedCardName:"Dragonic Overlord"},"booster","rear-left","rear-left","p1"),false);
});

test("boosted-attack hit AUTO belongs only to the exact booster and requires its optional discard",()=>{
  const ability=parseCardAbilities({id:"booster-hit-draw",text:"AUTO [RC]: [Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted, you may pay the cost. If you do, draw a card."})[0];
  assert.equal(ability.definition.source.patternId,"auto-boosting-unit-attack-hit-discard-draw-v1");
  assert.deepEqual(ability.costs,[{type:"discard",count:1}]);assert.equal(ability.canDecline,true);
  assert.equal(canPayAbilityCosts(ability,{discardableHand:0}),false);assert.equal(canPayAbilityCosts(ability,{discardableHand:1}),true);
  const event=createGameEvent({matchId:"boost-hit"},{type:"attack.hit",actingPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",boosterCardInstanceId:"booster",battleId:"battle-1"});
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"booster","rear-left","rear-left","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",event,"other-booster","rear-left","rear-left","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"hit",{...event,battleId:"battle-2"},"booster","rear-left","rear-left","p1"),true);
});

test("mandatory Counter-Blast attack AUTO cannot be declined and only applies to its exact attacker",()=>{
 const ability=parseCardAbilities({id:"mandatory-attack-cb",text:"AUTO [VC/RC]: When this unit attacks, COST [Counter Blast 1], this unit gets power +3000 until end of that battle."})[0];
 assert.equal(ability.definition.source.patternId,"auto-own-attack-counter-blast-power-mandatory-battle-v1");assert.equal(ability.canDecline,false);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);
 assert.equal(canPayAbilityCosts(ability,{faceUpDamage:0}),false);assert.equal(canPayAbilityCosts(ability,{faceUpDamage:1}),true);
 const event=createGameEvent({matchId:"mandatory-cb"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker"});
 assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"attacker","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other","rear-left","rear-left","p1"),false);
});

test("clan-vanguard attack power applies only with the named allied Vanguard clan",()=>{
 const ability=parseCardAbilities({id:"clan-attack-no-target-clause",text:"AUTO [VC/RC]: When this unit attacks, if you have a «Narukami» vanguard, this unit gets power +2000 until end of that battle."})[0];
 assert.equal(ability.definition.source.patternId,"auto-own-attack-vanguard-clan-power-battle-v1");assert.equal(ability.trigger.targetLocation,null);
 assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Narukami"}),true);assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Kagero"}),false);
 const attack=createGameEvent({matchId:"clan-attack"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",targetLocation:"rear-guard"});
 assert.equal(eventMatchesAbilityTrigger(ability,"attack",attack,"attacker","rear-left","rear-left","p1"),true);
 assert.equal(eventMatchesAbilityTrigger(ability,"attack",attack,"other","rear-left","rear-left","p1"),false);
 const vanguardOnly=parseCardAbilities({id:"clan-vanguard-only",text:"AUTO [VC/RC]: When this unit attacks a vanguard, if you have an «Etranger» vanguard, this unit gets power +2000 until end of that battle."})[0];
 assert.equal(vanguardOnly.trigger.targetLocation,"vanguard");
 assert.equal(eventMatchesAbilityTrigger(vanguardOnly,"attack",attack,"attacker","rear-left","rear-left","p1"),false);
});

test("grade-gated booster AUTO checks target grade, opposing Vanguard, Soul Blast, and exact booster",()=>{
 const ability=parseCardAbilities({id:"boost-grade-soul-blast",text:"AUTO [RC]: When this unit boosts a grade 3 or greater unit, if your opponent’s vanguard is grade 3 or greater, COST [Soul Blast 1], and this unit gets power +10000 until end of that battle."})[0];
 assert.equal(ability.definition.source.patternId,"auto-boost-grade-opponent-vanguard-grade-soul-blast-power-battle-v1");assert.equal(ability.trigger.boostedUnitGradeAtLeast,3);assert.deepEqual(ability.costs,[{type:"soul-blast",count:1}]);
 assert.equal(evaluateAbilityConditions(ability,{opponentVanguardGrade:3}),true);assert.equal(evaluateAbilityConditions(ability,{opponentVanguardGrade:2}),false);
 assert.equal(canPayAbilityCosts(ability,{soulCount:0}),false);assert.equal(canPayAbilityCosts(ability,{soulCount:1}),true);
 const event=createGameEvent({matchId:"boost-grade"},{type:"unit.boosted",actingPlayerId:"p1",sourceCardInstanceId:"booster",subjectCardInstanceId:"booster",boosterCardInstanceId:"booster",boostedCardInstanceId:"target",boostedCardGrade:3});
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"booster","rear-left","rear-left","p1"),true);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",{...event,boostedCardGrade:2},"booster","rear-left","rear-left","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"other-booster","rear-left","rear-left","p1"),false);
});

test("Main-phase Soul Charge AUTO matches only the controller entering Main and resolves in printed order", () => {
  const ability = parseCardAbilities({ id: "cfa-34", text: "AUTO [VC]: At the beginning of your main phase, Soul Charge 1, and this unit gets power +2000 until end of turn." })[0];
  assert.equal(ability.definition?.source?.patternId, "auto-vanguard-main-phase-soul-charge-power-v1");
  assert.equal(ability.trigger?.eventType, "phase.changed");
  assert.equal(ability.trigger?.requiredPhase, "main");
  const enteringMain = createGameEvent({ matchId: "main-window" }, { type: "phase.changed", actingPlayerId: "p1", turnPlayerId: "p1", phase: "main", before: { phase: "stride" }, after: { phase: "main" } });
  assert.equal(eventMatchesAbilityTrigger(ability, "phase", enteringMain, "vc-copy-1", "vanguard", null, "p1"), true);
  assert.equal(eventMatchesAbilityTrigger(ability, "phase", { ...enteringMain, phase: "battle" }, "vc-copy-1", "vanguard", null, "p1"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "phase", { ...enteringMain, actingPlayerId: "p2", turnPlayerId: "p2" }, "vc-copy-1", "vanguard", null, "p1"), false);
  assert.equal(eventMatchesAbilityTrigger(ability, "phase", enteringMain, "rg-copy-1", "rear-left", null, "p1"), false);
  const player = { deck: [{ uid: "soul-charge-top" }], soul: [], hand: [], damage: [], drop: [], rear: [], playerId: "p1" };
  const source = { uid: "vc-copy-1", turnPowerBoost: 0 };
  const match = { turn: 3, players: { human: player }, pendingAttack: null };
  const resolved = resolveEffectProgram(ability.definition.effects, EFFECT_HANDLERS, { source, player, side: "human", sourceInPlay: true, match }, () => true);
  assert.equal(resolved.ok, true);
  assert.deepEqual(player.soul.map(card => card.uid), ["soul-charge-top"]);
  assert.equal(source.turnPowerBoost, 2000);
  assert.equal(source.turnPowerExpiry, "p1");
  assert.equal(isManuallyActivatable(ability), false);
  const app = fs.readFileSync("app.js", "utf8");
  assert.ok(app.includes('phase:"phase.changed"'));
  assert.ok(app.includes('queuePhaseChangeEvent("human",previousPhase,phases[match.phase])'));
});

test("standalone Sentinel is represented as a CONT keyword and never as a manual skill",()=>{
  const variants=[
    "CONT: Sentinel.",
    "CONT: Sentinel (You may only have up to four cards with \"Sentinel\" in a deck.)",
    "CONT: Sentinel (You can only have up to four cards with \"Sentinel\" in a deck.)",
    "CONT: Sentinel (You may only have up to four cards with \"CONT: Sentinel\" in a deck)"
  ];
  for(const [index,text] of variants.entries()){
    const ability=parseCardAbilities({id:`sentinel-${index}`,text})[0];
    assert.equal(ability.kind,"CONT");
    assert.equal(ability.definition?.source?.patternId,"cont-sentinel-keyword-v1");
    assert.deepEqual(ability.definition.keywords,["sentinel"]);
    assert.equal(ability.definition.effects,undefined);
    assert.equal(isManuallyActivatable(ability),false);
    assert.equal(hasAbilityKeyword([ability],"Sentinel"),true);
  }
  const special=parseCardAbilities({id:"sentinel-special-limit",text:"CONT: Sentinel. But if all sentinels in your deck are \"Transcend Idol, Aqua\", you may include up to six."})[0];
  assert.ok(!special.definition);
  assert.equal(hasAbilityKeyword([special],"sentinel"),false);
  const app=fs.readFileSync("app.js","utf8");
  assert.ok(app.includes('window.VanguardAbilityEngine.hasAbilityKeyword(cardAbilities(card),"sentinel")'));
});


test("Lord continuous restriction only blocks its own attack when a friendly unit lacks a shared clan",()=>{
  const {parseCardAbilities}=require("./ability-engine.js");const ability=parseCardAbilities({id:"lord",text:"CONT [VC/RC]: Lord (If you have a unit without a same clan as this unit, this unit cannot attack)"})[0];
  assert.equal(ability.definition?.source?.patternId,"cont-lord-attack-restriction-v1");assert.deepEqual(ability.definition.keywords,["lord"]);assert.equal(isManuallyActivatable(ability),false);
  const source={uid:"lord-1",card:{clan:"Gold Paladin"}},same={uid:"same",card:{clan:"Gold Paladin"}},foreign={uid:"foreign",card:{clan:"Kagero"}};
  assert.deepEqual(evaluateContinuousRestrictions([ability],{sourceInstanceId:"lord-1",sourceCard:source.card,location:"rear-guard",controlledUnits:[source,same]}),{legal:true,restrictions:[]});
  assert.equal(evaluateContinuousRestrictions([ability],{sourceInstanceId:"lord-1",sourceCard:source.card,location:"rear-guard",controlledUnits:[source,foreign]}).legal,false);
  assert.equal(evaluateContinuousRestrictions([ability],{sourceInstanceId:"lord-1",sourceCard:source.card,location:"guardian",controlledUnits:[source,foreign]}).legal,true);
  assert.equal(evaluateContinuousRestrictions([ability],{sourceInstanceId:"lord-1",sourceCard:source.card,location:"guardian",controlledUnits:[source,foreign]}).legal,true);
});


test("triggered AUTO resolution uses the source circle from its triggering event after the source moves", () => {
  const ability = { kind: "AUTO" };
  const pending = { field: "vanguard", eventContext: { eventId: "ride-event-1", sourceZone: "soul" } };
  assert.equal(abilitySourceZoneAtResolution(ability, pending, "soul"), "vanguard");
  assert.equal(abilitySourceZoneAtResolution({ kind: "ACT" }, pending, "soul"), "soul");
});

test("ride draw and Quick Shield AUTO matches only the exact card that was ridden",()=>{
  const card={id:"cfa-5673",text:"AUTO: When rode upon, draw a card. Then, if your opponent’s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand."};const ability=parseCardAbilities(card)[0];assert.equal(ability.definition?.source?.patternId,"auto-rode-upon-draw-quick-shield-v1");assert.equal(ability.trigger?.eventType,"card.ridden");assert.equal(ability.trigger?.subject,"event-target");assert.deepEqual(ability.conditions,[]);
  const event={type:"card.ridden",sourceCardInstanceId:"rider-1",subjectCardInstanceId:"rider-1",targetCardInstanceIds:["ridden-1"],targetPreviousLocation:"vanguard",targetCurrentLocation:"soul"};
  assert.equal(eventMatchesAbilityTrigger(ability,"ride",event,"ridden-1","vanguard","vanguard","player-a"),true);assert.equal(eventMatchesAbilityTrigger(ability,"ride",event,"other-copy","vanguard","vanguard","player-a"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,type:"card.placed"},"ridden-1","vanguard","vanguard","player-a"),false);
});

test("ride Quick Shield effect draws first and only creates its token at the required opponent grade",()=>{
  const ability=parseCardAbilities({id:"cfa-5673",text:"AUTO: When rode upon, draw a card. Then, if your opponent’s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand."})[0];const def=ability.definition;
  const makeContext=grade=>({player:{playerId:"p1",deck:[{uid:"deck-1",cardId:"normal"}],hand:[]},opponentVanguardGrade:grade,cardDefinitionForId:id=>id==="token-quick-shield"?{id,name:"Quick Shield",type:"Quick Shield Token"}:null});
  const low=makeContext(0),lowResult=resolveEffectProgram(def.effects,EFFECT_HANDLERS,low);assert.equal(lowResult.ok,true);assert.deepEqual(lowResult.results,[1,0]);assert.equal(low.player.hand.length,1);assert.equal(low.player.hand[0].cardId,"normal");
  const eligible=makeContext(1),highResult=resolveEffectProgram(def.effects,EFFECT_HANDLERS,eligible);assert.equal(highResult.ok,true);assert.deepEqual(highResult.results,[1,1]);assert.equal(eligible.player.hand.length,2);assert.equal(eligible.player.hand[1].cardId,"token-quick-shield");assert.equal(eligible.player.hand[1].ownerPlayerId,"p1");assert.equal(eligible.player.hand[1].isToken,true);
  const unknown=makeContext(1);unknown.cardDefinitionForId=()=>null;assert.equal(resolveEffectProgram(def.effects,EFFECT_HANDLERS,unknown).ok,false);assert.equal(unknown.player.deck.length,1);assert.equal(unknown.player.hand.length,0);
});

test("normal ride events identify the rider and exact previous Vanguard for rode-upon AUTO abilities",()=>{
  const ability=parseCardAbilities({id:"cfa-5673",text:"AUTO: When rode upon, draw a card. Then, if your opponent’s vanguard is grade 1 or greater, put a Quick Shield ticket into your hand."})[0];
  const rider={uid:"rider-1",cardId:"rider-card",cardName:"Rider",grade:1,ownerPlayerId:"p1",controllerPlayerId:"p1"};
  const ridden={uid:"old-vanguard-1",cardId:"cfa-5673",cardName:"Lizard Runner, Undeux",grade:0,ownerPlayerId:"p1",controllerPlayerId:"p1"};
  const state={matchId:"ride-event-test",eventSequence:0,players:{human:{playerId:"p1",vanguard:rider,soul:[ridden]}}};
  const event=VanguardAbilityEngine.createRideGameEvent(state,{rider,ridden,actingPlayerId:"p1"});
  assert.equal(event.type,"card.ridden");
  assert.equal(event.sourceCardInstanceId,rider.uid);
  assert.equal(event.subjectCardInstanceId,rider.uid);
  assert.deepEqual(event.targetCardInstanceIds,[ridden.uid]);
  assert.equal(event.previousLocation,"hand");
  assert.equal(event.currentLocation,"vanguard");
  assert.equal(event.targetPreviousLocation,"vanguard");
  assert.equal(event.targetCurrentLocation,"soul");
  assert.equal(event.targetLocation,"vanguard");
  assert.equal(event.phase,"ride");
  assert.equal(event.timingWindow,"normal-ride");
  assert.equal(eventMatchesAbilityTrigger(ability,"ride",event,ridden.uid,"vanguard",event.targetLocation,"p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"ride",event,"another-copy","vanguard",event.targetLocation,"p1"),false);
});


test("Guardian Circle discard protection requires the exact placement and currently attacked target",()=>{
  const plain=parseCardAbilities({id:"gc-protect",text:"AUTO: [Choose a card from your hand, and discard it] When this unit is placed on GC, you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle."})[0];const fromHand=parseCardAbilities({id:"gc-protect-hand",text:"AUTO: [Choose a card from your hand, and discard it] When this unit is placed on GC from hand, you may pay the cost. If you do, choose up to one of your vanguards that is being attacked, and that unit cannot be hit until end of that battle."})[0];
  assert.equal(plain.definition?.source?.patternId,"auto-gc-discard-protect-attacked-unit-v1");assert.equal(fromHand.trigger?.sourceLocation,"hand");assert.equal(isManuallyActivatable(plain),false);
  const gcEvent={type:"card.placed",sourceCardInstanceId:"guard-1",subjectCardInstanceId:"guard-1",previousLocation:"hand",currentLocation:"guardian",circle:"guardian"};assert.equal(eventMatchesAbilityTrigger(fromHand,"place",gcEvent,"guard-1","guardian","guardian","player-a"),true);assert.equal(eventMatchesAbilityTrigger(fromHand,"place",{...gcEvent,previousLocation:"drop"},"guard-1","guardian","guardian","player-a"),false);assert.equal(eventMatchesAbilityTrigger(fromHand,"place",gcEvent,"another-copy","guardian","guardian","player-a"),false);
  const targetStep=plain.effects[0],attacked={uid:"attacked-vg"},other={uid:"other-vg"},source={uid:"guard-1"},base={source,sourceControllerPlayerId:"player-a",targetControllerPlayerId:"player-a",opponentPlayerId:"player-b",targetCard:{type:"Normal Unit"},targetZone:"vanguard",targetInPlay:true,match:{pendingAttack:{targetUid:attacked.uid}}};
  assert.equal(matchesTargetFilter(targetStep.targetFilter,{...base,target:attacked,isBeingAttacked:true}),true);assert.equal(matchesTargetFilter(targetStep.targetFilter,{...base,target:other,isBeingAttacked:false}),false);assert.equal(validateEffectProgram([targetStep],EFFECT_HANDLERS,{...base,target:attacked,isBeingAttacked:true}).ok,true);assert.equal(validateEffectProgram([targetStep],EFFECT_HANDLERS,{...base,target:other,isBeingAttacked:false}).ok,false);
});

test("Guardian Circle clan discard costs reject a different-clan payment",()=>{
 const ability=parseCardAbilities({id:"gc-clan",text:"AUTO: [Choose a «Gold Paladin» from your hand, and discard it] When this unit is placed on GC, you may pay the cost. If you do, choose one of your «Gold Paladin» that is being attacked, and that unit cannot be hit until end of that battle."})[0];assert.equal(ability.definition?.source?.patternId,"auto-gc-discard-protect-attacked-unit-v1");const player={playerId:"p1",damage:[],soul:[],hand:[{uid:"wrong",cardId:"kagero"}],drop:[],rear:[]};const result=payAbilityCosts(ability,{player,source:{uid:"sentinel"},sourceZone:"guardian",turnId:1,actorPlayerId:"p1",cardDefinitionForInstance:card=>card.cardId==="kagero"?{clan:"Kagero"}:null},{discard:["wrong"]});assert.equal(result.ok,false);assert.equal(result.reason,"discard-filter-not-met");assert.equal(player.hand.length,1);assert.equal(player.drop.length,0);
});


test("Guardian Circle when-placed discard protection uses exact source, zone, cost, and selected unit",()=>{
 const ability=parseCardAbilities({id:"gc-when-placed",text:"AUTO [GC]: When placed, COST [discard a card from your hand], and one of your units cannot be hit until end of that battle."})[0];assert.equal(ability.definition?.source?.patternId,"auto-gc-when-placed-discard-protect-unit-v1");assert.equal(ability.trigger?.eventType,"card.placed");assert.deepEqual(ability.trigger?.circles,["guardian"]);assert.equal(ability.costs[0]?.type,"discard");assert.equal(ability.costStatus,"supported-cost");assert.equal(isManuallyActivatable(ability),false);
 const placed={type:"card.placed",sourceCardInstanceId:"guard-1",subjectCardInstanceId:"guard-1",previousLocation:"hand",currentLocation:"guardian"};assert.equal(eventMatchesAbilityTrigger(ability,"place",placed,"guard-1","guardian","guardian","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...placed,currentLocation:"rear-guard"},"guard-1","rear-guard","rear-guard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",placed,"other-copy","guardian","guardian","p1"),false);
 const player={playerId:"p1",damage:[],soul:[],hand:[{uid:"discard-1",cardId:"cost"}],drop:[],rear:[]};const payment=payAbilityCosts(ability,{player,source:{uid:"guard-1"},sourceZone:"guardian",turnId:1,actorPlayerId:"p1"},{discard:["discard-1"]});assert.equal(payment.ok,true);assert.equal(player.hand.length,0);assert.equal(player.drop[0].uid,"discard-1");
 const target={uid:"attacked",rested:false},match={pendingAttack:{targetUid:"attacked",perfectGuard:false,blocked:false}},ctx={source:{uid:"guard-1"},player:{playerId:"p1"},target,targetInPlay:true,targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",opponentPlayerId:"p2",targetCard:{type:"Normal Unit"},targetZone:"vanguard",match};assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,ctx).ok,true);assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,ctx).ok,true);assert.equal(match.pendingAttack.perfectGuard,true);assert.equal(match.pendingAttack.blocked,true);
});


test("RC Generation Break AUTO on the exact friendly Vanguard attack pays its source, draws, and buffs only the attacking Vanguard",()=>{
 const ability=parseCardAbilities({id:"rc-support",text:"AUTO [RC] Generation Break 1: When your vanguard attacks, COST [put this unit into your soul], draw a card, and one of your vanguards gets power +10000 until end of that battle."})[0];assert.equal(ability.definition?.source?.patternId,"auto-rc-gb-vanguard-attack-sacrifice-draw-power-v1");assert.equal(ability.gb,1);assert.equal(ability.trigger?.eventType,"unit.attacked");assert.equal(ability.trigger?.subject,"vanguard");assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.effects[0]?.op,"draw");assert.deepEqual(ability.effects[1]?.targetFilter,{controller:"source-controller",cardType:"unit",zone:"vanguard"});
 const attack={type:"unit.attacked",sourceCardInstanceId:"vg-1",subjectCardInstanceId:"vg-1",subjectControllerPlayerId:"p1"};assert.equal(eventMatchesAbilityTrigger(ability,"attack",attack,"support-1","rear-left","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...attack,subjectControllerPlayerId:"p2"},"support-1","rear-left","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...attack,subjectZone:"rear-left"},"support-1","rear-left","rear-left","p1"),false);assert.equal(ability.gb,1);
 const source={uid:"support-1"},player={playerId:"p1",damage:[],soul:[],hand:[],drop:[],rear:[source]};const paid=payAbilityCosts(ability,{player,source,sourceZone:"rear-left",turnId:2,actorPlayerId:"p1"},{});assert.equal(paid.ok,true);assert.equal(player.rear[0],null);assert.equal(player.soul[0].uid,source.uid);
 const attacker={uid:"vg-1",turnPowerBoost:0},state={pendingAttack:{attackerUid:attacker.uid,power:18000}};const context={source,player:{playerId:"p1",deck:[{uid:"draw-1",cardId:"card"}],hand:[]},target:attacker,targetInPlay:true,targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",opponentPlayerId:"p2",targetCard:{type:"Normal Unit"},targetZone:"vanguard",match:state};assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context);assert.equal(result.ok,true);assert.deepEqual(result.results,[1,true]);assert.equal(context.player.hand[0].uid,"draw-1");assert.equal(state.pendingAttack.power,28000);
 const invalid={...context,target:{uid:"other-vg"},match:{pendingAttack:{attackerUid:attacker.uid,power:18000}},player:{playerId:"p1",deck:[{uid:"still-deck",cardId:"card"}],hand:[]}};assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,invalid).ok,false);assert.equal(invalid.player.deck.length,1);assert.equal(invalid.player.hand.length,0);
});

test("conditional Guardian Circle protection and hand discard resolve in order and only when affordable",()=>{
  const ability=parseCardAbilities({id:"gc-conditional",text:"AUTO: When this unit is put on GC, choose one of your units, and it cannot be hit until end of that battle. If your hand has two or more cards, choose a card from your hand, and discard it."})[0];
  assert.equal(ability.definition?.source?.patternId,"auto-gc-protect-then-conditional-discard-v1");
  assert.equal(ability.trigger?.eventType,"card.placed");
  assert.deepEqual(ability.trigger?.circles,["guardian"]);
  assert.equal(ability.effects[0].requiresAttackedTarget,true);
  assert.deepEqual(ability.effects.map(step=>step.op),["protect-target","discard-from-hand"]);
  const makeContext=(hand,discardUid)=>{const target={uid:"defending-vanguard",controllerPlayerId:"p1"};const match={pendingAttack:{attackerUid:"attacker",targetUid:target.uid}};return{source:{uid:"guard",controllerPlayerId:"p1"},player:{playerId:"p1",hand,drop:[]},side:"human",target,targetInPlay:true,targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",opponentPlayerId:"p2",targetCard:{type:"Normal Unit"},targetZone:"vanguard",isBeingAttacked:true,match,effectDiscardUid:discardUid,cardDefinitionForInstance:()=>null}};
  const invalid=makeContext([{uid:"a"},{uid:"b"}],null);assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,invalid).ok,false);assert.equal(invalid.match.pendingAttack.perfectGuard,undefined);assert.equal(invalid.player.hand.length,2);
  const valid=makeContext([{uid:"a"},{uid:"b"}],"b");const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,valid);assert.equal(result.ok,true);assert.deepEqual(result.results,[true,true]);assert.equal(valid.match.pendingAttack.perfectGuard,true);assert.deepEqual(valid.player.drop.map(card=>card.uid),["b"]);assert.deepEqual(valid.player.hand.map(card=>card.uid),["a"]);
  const oneCard=makeContext([{uid:"only"}],null);assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,oneCard).ok,true);assert.equal(oneCard.match.pendingAttack.perfectGuard,true);assert.deepEqual(oneCard.player.hand.map(card=>card.uid),["only"]);assert.equal(oneCard.player.drop.length,0);
});

test("joining player GC effect discard selection is validated and carried in the private ability decision",()=>{
  const source=fs.readFileSync("app.js","utf8");assert.match(source,/effectDiscardUid:pending\.effectDiscardUid\|\|null/);assert.match(source,/pending\.effectDiscardUid=selection\.effectDiscardUid\|\|null/);
  const state={matchId:"gc-room",stateVersion:1,processedActionIds:[]};const pending={instance:{uid:"guest-guard",controllerPlayerId:"joiner"},triggerControllerPlayerId:"joiner",ability:{id:"guest-guard:0",costs:[]}};const selection={instanceUid:"guest-guard",abilityId:"guest-guard:0",effectDiscardUid:"hand-1"};const request={matchId:"gc-room",actorPlayerId:"joiner",actionId:"gc-choice",expectedStateVersion:1,accept:true,selection};assert.equal(validateAbilityDecision(state,request,"joiner",pending).ok,true);assert.equal(validateAbilityDecision(state,{...request,actionId:"gc-choice-bad",selection:{...selection,effectDiscardUid:{uid:"host-card"}}},"joiner",pending).reason,"invalid-ability-selection");
});

test("CONT all-clans-and-nations is a continuous identity keyword, never a manual skill",()=>{
  const card={id:"elemental",clan:"Cray Elemental",nation:"Cray Elemental",text:"Cray Elemental/Elemental\n\nCONT: This card is from all clans and nations."};
  const ability=parseCardAbilities(card)[0];assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition?.keywords,["all-clans-and-nations"]);assert.equal(isManuallyActivatable(ability),false);
  assert.equal(matchesTargetFilter({clan:"Kagero",nation:"Dragon Empire"},{targetCard:card}),true);
  assert.equal(matchesTargetFilter({clan:"Kagero",mustBeAttacked:true,isBeingAttacked:false},{targetCard:card}),false);
  const lord=parseCardAbilities({id:"lord-with-identity",text:"CONT [VC/RC]: Lord.\nCONT: This card is from all clans and nations."})[0];
  const other={id:"other",text:"AUTO: Forerunner.",definition:null};
  assert.equal(evaluateContinuousRestrictions([lord],{location:"rear-guard",sourceCard:card,sourceInstanceId:"lord",controlledUnits:[{uid:"lord",card},{uid:"foreign",card:{clan:"Kagero"}}]}).legal,true);
  const normalLordCard={clan:"Kagero",text:"Kagero/Flame Dragon"};const filtered=evaluateContinuousRestrictions([lord],{location:"rear-guard",sourceCard:normalLordCard,sourceInstanceId:"lord",controlledUnits:[{uid:"lord",card:normalLordCard},{uid:"elemental",card}]});assert.equal(filtered.legal,true);assert.equal(hasAbilityKeyword(card,"all-clans-and-nations"),true);
});

test("keyword-only CONT definitions are registerable and invalidate cached identity",()=>{
  const card={id:"dynamic-keyword",text:"CONT: A newly reviewed keyword."};assert.equal(hasAbilityKeyword(card,"reviewed-keyword"),false);
  registerAbilityDefinitions([{id:"dynamic-keyword:0",cardId:"dynamic-keyword",kind:"CONT",printedText:"CONT: A newly reviewed keyword.",keywords:["reviewed-keyword"]}]);
  assert.equal(hasAbilityKeyword(card,"reviewed-keyword"),true);assert.equal(parseCardAbilities(card)[0].definition.keywords[0],"reviewed-keyword");
});

test("Vanguard missed-attack CONT keyword preserves a distinct hit-override event",()=>{
  const card={id:"missed-hit-vg",text:"Royal Paladin/Human\n\nCONT [VC]: This unit’s \"when attack hits\" effects activate even if the attack did not hit.\nAUTO [VC]: When this unit’s attack hits a vanguard, draw a card."};
  const [continuous,hit]=parseCardAbilities(card);assert.equal(continuous.kind,"CONT");assert.deepEqual(continuous.definition?.keywords,["missed-attack-hit-effects"]);assert.equal(continuous.conditionStatus,"no-explicit-condition-detected");assert.equal(isManuallyActivatable(continuous),false);assert.equal(hit.trigger?.eventType,"attack.hit");
  const event=createGameEvent({matchId:"missed-hit"},{type:"attack.hit",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"vg-copy",sourceControllerPlayerId:"p1",subjectCardInstanceId:"vg-copy",targetCardInstanceIds:["defender-vg"],targetLocation:"vanguard",battleId:"b-1",timingWindow:"vanguard-missed-attack-hit-override",attackHitOverride:true});
  assert.equal(event.attackHitOverride,true);assert.equal(event.subjectCardInstanceId,"vg-copy");assert.equal(event.targetLocation,"vanguard");assert.equal(event.battleId,"b-1");assert.equal(eventMatchesAbilityTrigger(hit,"hit",event,"vg-copy","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(hit,"hit",{...event,subjectCardInstanceId:"other-copy"},"vg-copy","vanguard","vanguard","p1"),false);
});

test("missed-attack override queues only the keyword Vanguard source after the battle closes",()=>{
  const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function finishAttack(blocked)"),end=app.indexOf("function dealDamage(",start),finish=app.slice(start,end),queueStart=app.indexOf("function queueAbilityPrompts("),queueEnd=app.indexOf("function queueMovedCardAbility(",queueStart),queue=app.slice(queueStart,queueEnd);
  assert.ok(start>=0&&end>start);assert.match(finish,/blocked&&attacker\?\.zone==="vanguard"&&window\.VanguardAbilityEngine\.hasAbilityKeyword\(cardMap\.get\(attacker\.instance\.cardId\),"missed-attack-hit-effects"\)/);assert.ok(finish.indexOf("match.pendingAttack=null")<finish.indexOf("if(missedHitOverride)queueAbilityPrompts(\"hit\""));assert.match(finish,/attackHitOverride:true/);assert.match(queue,/eventName==="hit"&&eventContext\.hitOverrideSourceUid&&source\.instance\.uid!==eventContext\.hitOverrideSourceUid\)continue/);assert.match(queue,/attackHitOverride:eventContext\.attackHitOverride===true/);
});


test("Vanguard placement draw-discard AUTO is source-specific and resolves draw before the private discard",()=>{
  const ability=parseCardAbilities({id:"cfa-6972",name:"Delude Dancer, Ethel",text:"AUTO [VC]: When placed, draw a card, and discard a card from your hand."})[0];
  assert.equal(ability.definition?.source?.patternId,"auto-vanguard-placement-draw-discard-v1");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["vanguard"]});assert.deepEqual(ability.definition.effects,[{op:"draw-then-discard",target:"controller",drawCount:1,discardCount:1}]);assert.equal(ability.canDecline,false);assert.equal(ability.choiceStatus,"modeled");
  const hand={uid:"hand-card",cardId:"hand"},drawn={uid:"drawn-card",cardId:"draw"},player={hand:[hand],deck:[drawn],drop:[]},events=[];
  const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{player,side:"p1",effectDiscardUid:drawn.uid,emitEvent:event=>events.push(event)});
  assert.equal(result.ok,true);assert.deepEqual(player.hand,[hand]);assert.deepEqual(player.deck,[]);assert.deepEqual(player.drop,[drawn]);assert.deepEqual(events.map(event=>event.type),["card.drawn","card.discarded"]);assert.equal(events[0].cardInstanceId,drawn.uid);assert.equal(events[1].cardInstanceId,drawn.uid);
  const emptyDeck=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{player:{hand:[hand],deck:[],drop:[]},side:"p1",effectDiscardUid:hand.uid});assert.equal(emptyDeck.ok,false);
});

test("shared-name once-per-turn AUTO compiles and is consumed across copies",()=>{
 const ability=parseCardAbilities({id:"cfa-6496",name:"Special Message, Ourora",text:"AUTO [VC/RC]: When placed, draw a card, and discard a card from your hand. This ability may only be used by a card with the same card name once a turn."})[0];assert.equal(ability.definition?.source?.patternId,"auto-vanguard-placement-draw-discard-v1");assert.deepEqual(ability.usageRestriction,{type:"once-per-turn",scope:"card-name-and-ability",reset:"turn"});assert.equal(ability.once,true);assert.equal(ability.canDecline,false);
 const player={playerId:"p1",damage:[],soul:[],hand:[],drop:[],rear:[],usedAbilities:[]},context={player,turnId:4,actorPlayerId:"p1",sourceZone:"vanguard",cardDefinitionForInstance:()=>({name:"Special Message, Ourora"})};const first=payAbilityCosts(ability,{...context,source:{uid:"ourora-copy-a"}},{ });assert.equal(first.ok,true);const used=[...player.usedAbilities],second=payAbilityCosts(ability,{...context,source:{uid:"ourora-copy-b"}},{ });assert.deepEqual(second,{ok:false,reason:"usage-restriction"});assert.deepEqual(player.usedAbilities,used);
 const changedName=abilityUsageKey(4,"p1","ourora-copy-c",ability.id,ability.usageRestriction,"Different Name",ability.printedText);assert.notEqual(changedName,used[0]);
});


test("placement draw-discard selection UI offers the drawn card only inside its owner prompt",()=>{
 const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function renderAbilityEffectChoices("),end=app.indexOf("function resolveReviewedAbility(",start),renderer=app.slice(start,end);assert.ok(renderer.includes("draw-then-discard"));assert.ok(renderer.includes("p.deck[p.deck.length-1]"));assert.ok(renderer.includes("data-ability-discard"));assert.ok(app.includes("effectDiscardUid:x.effectDiscardUid||null"));assert.ok(app.includes("localPlayerId"));assert.ok(app.includes('x.side !== "human"'));
});


test("boosted battle close-step AUTO matches the exact booster and retains the battle identity",()=>{
 const ability=parseCardAbilities({id:"cfa-9054",name:"Aspiring Maiden, Alana",text:"AUTO [RC]: At the end of the battle this unit boosted, COST [put this unit into your soul], choose one of your units, and it gets power +2000 until end of turn."})[0];assert.equal(ability.definition?.source?.patternId,"auto-boosted-battle-close-source-to-soul-power-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"battle.close-step",subject:"booster",circles:[]});assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.canDecline,false);
 const event=createGameEvent({matchId:"close-step"},{type:"battle.close-step",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",boosterCardInstanceId:"booster-a",boostedCardInstanceId:"attacker",battleId:"battle-7",timingWindow:"close-step"});assert.equal(eventMatchesAbilityTrigger(ability,"battleEnd",event,"booster-a","rear-left","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"battleEnd",event,"booster-b","rear-left","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"battleEnd",{...event,boosterCardInstanceId:null},"booster-a","rear-left","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"battleEnd",event,"booster-a","vanguard","vanguard","p1"),false);
 const real=parseCardAbilities(require("./scripts/audit-ability-catalog.js").loadCatalog().find(card=>card.id==="cfa-11230"))[0];assert.equal(real.definition?.source?.patternId,"auto-boosted-battle-close-source-to-soul-power-v1");assert.deepEqual(real.costs,[{type:"source-to-soul",count:1}]);assert.equal(eventMatchesAbilityTrigger(real,"battleEnd",event,"booster-a","rear-left","vanguard","p1"),true);
});

test("battle close-step scheduler waits until hit and damage check abilities finish",()=>{const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function resolvePendingBattleEnd("),end=app.indexOf("function finishAttack(",start),scheduler=app.slice(start,end);assert.ok(scheduler.includes("match.pendingHitResolution"));assert.ok(scheduler.includes("match.pendingTrigger"));assert.ok(scheduler.includes("match.pendingDamageQueue"));assert.ok(scheduler.includes("queueAbilityPrompts(\"battleEnd\""));assert.ok(app.includes("resolvePendingBattleEnd();if(match.pendingAbility||match.pendingAbilities?.length)"));});


test("remote actions are rejected during damage, hit, and battle-close resolution windows",()=>{const base={matchId:"close-step",stateVersion:3,players:{human:{playerId:"host"},bot:{playerId:"guest"}}},request={type:"action",action:"endTurn",actionId:"close-action",matchId:"close-step",actorPlayerId:"guest",expectedStateVersion:3};for(const window of [{pendingHitResolution:{battleId:"b1"}},{pendingBattleEnd:{battleId:"b1"}},{pendingTrigger:{type:"drive"}},{pendingDamageQueue:[{type:"damage-check"}]}])assert.deepEqual(validateRemoteActionRequest({...base,...window},request,"guest"),{ok:false,reason:"resolution-in-progress"})});


test("drawn-card AUTO matching retains the exact event subject after it leaves hand",()=>{
 const ability=parseCardAbilities({id:"drawn-auto",text:"AUTO [Hand]: When this card is drawn, draw a card."})[0];assert.equal(ability.trigger?.eventType,"card.drawn");assert.equal(ability.trigger?.subject,"event-subject");const event=createGameEvent({matchId:"drawn-source"},{type:"card.drawn",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"drawn-copy",sourceControllerPlayerId:"p1",subjectCardInstanceId:"drawn-copy",subjectControllerPlayerId:"p1",previousLocation:"deck",currentLocation:"hand"});assert.equal(eventMatchesAbilityTrigger(ability,"draw",event,"drawn-copy","hand","hand","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"draw",event,"another-copy","hand","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"draw",event,"drawn-copy","deck","hand","p1"),false);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("eventName===\"draw\")movedInstance=findMatchInstance(subjectUid)"));assert.ok(app.includes("eventName===\"draw\"?(eventContext.currentLocation||\"hand\")"));assert.ok(app.includes("const drawn=findMatchInstance(event.cardInstanceId)"));
});


test("pending shared-name AUTO copies are removed after that shared restriction is consumed",()=>{const ability=parseCardAbilities({id:"cfa-6496",name:"Special Message, Ourora",text:"AUTO [VC/RC]: When placed, draw a card, and discard a card from your hand. This ability may only be used by a card with the same card name once a turn."})[0],state={pendingAbilities:[{side:"human",instance:{uid:"copy-b"},ability},{side:"human",instance:{uid:"other"},ability:{id:"other",once:false}}]};const removed=VanguardAbilityEngine.prunePendingAbilitiesWithConsumedUsage(state,pending=>pending.instance.uid==="copy-b");assert.equal(removed,1);assert.deepEqual(state.pendingAbilities.map(item=>item.instance.uid),["other"]);});

test("Hand CONT Heal-cost ability is a non-activatable G-Guardian cost substitution",()=>{
 const card={id:"heal-cost",name:"Heal-cost unit",text:"CONT [Hand]: You may discard this card as a \"HEAL\" for the cost of calling a G guardian."};const ability=parseCardAbilities(card)[0];assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition?.keywords,["g-guardian-heal-cost-substitute"]);assert.equal(isManuallyActivatable(ability),false);assert.equal(hasAbilityKeyword(card,"g-guardian-heal-cost-substitute"),true);
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),matches=loadCatalog().filter(item=>/CONT \[Hand\]: You may discard this card as a [\"“]HEAL[\"”] for the cost of calling a G guardian\./i.test(item.text||""));assert.equal(matches.length,23);assert.ok(matches.every(item=>hasAbilityKeyword(item,"g-guardian-heal-cost-substitute")));
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("function isGGuardCostCard(instance)"));assert.match(app,/player\.hand\.filter\(isGGuardCostCard\)/);assert.match(app,/item\.uid===healUid&&isGGuardCostCard\(item\)/);assert.match(app,/heal=hand\.find\(isGGuardCostCard\)/);
});

test("Vanguard boost draw-discard AUTO requires its own exact boost event and a Vanguard target",()=>{
 const ability=parseCardAbilities({id:"cfa-8839",name:"Scramble Sprint, Selma",text:"AUTO [RC]: When this unit boosts a vanguard, draw a card, choose a card from your hand, and discard it."})[0];assert.equal(ability.definition?.source?.patternId,"auto-rc-vanguard-boost-draw-discard-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"unit.boosted",subject:"source",circles:[],targetLocation:"vanguard"});assert.deepEqual(ability.definition.effects,[{op:"draw-then-discard",target:"controller",drawCount:1,discardCount:1}]);
 const event=createGameEvent({matchId:"boost-discard"},{type:"unit.boosted",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"booster-a",sourceControllerPlayerId:"p1",subjectCardInstanceId:"booster-a",boosterCardInstanceId:"booster-a",boostedCardInstanceId:"vanguard-a",boostedCardName:"Vanguard",targetLocation:"vanguard",timingWindow:"boost"});assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"booster-a","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"boost",{...event,targetLocation:"rear-0"},"booster-a","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"another-booster","rear-right","rear-right","p1"),false);
 const app=fs.readFileSync("app.js","utf8");assert.match(app,/eventName==="boost"&&eventContext\.boostedUid\?findFieldCard\(eventContext\.boostedUid\)\?\.zone/);
});

test("Honebami Toushirou boost AUTO requires its exact Vanguard boost and optional Soul Blast",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const card=loadCatalog().find(item=>item.id==="cfa-3077"),ability=parseCardAbilities(card).find(item=>item.printedText.includes("When this unit boosts a vanguard"));
 assert.equal(card.name,"Honebami Toushirou");assert.equal(ability.definition?.source?.patternId,"auto-rc-vanguard-boost-soul-blast-draw-discard-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"unit.boosted",subject:"source",circles:[],targetLocation:"vanguard"});assert.deepEqual(ability.costs,[{type:"soul-blast",count:1}]);assert.equal(ability.canDecline,true);assert.deepEqual(ability.definition.effects,[{op:"draw-then-discard",target:"controller",drawCount:1,discardCount:1}]);
 const event=createGameEvent({matchId:"honebami-boost"},{type:"unit.boosted",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"honebami",sourceControllerPlayerId:"p1",subjectCardInstanceId:"honebami",boosterCardInstanceId:"honebami",boostedCardInstanceId:"vanguard-a",targetLocation:"vanguard",timingWindow:"boost"});assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"honebami","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"boost",{...event,targetLocation:"rear-0"},"honebami","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"other-booster","rear-right","rear-right","p1"),false);
});

test("VC placement named search AUTO preserves exact source, costs, optional choice, and atomic search",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");const card=loadCatalog().find(item=>item.id==="cfa-2025"),ability=parseCardAbilities(card)[0];
 assert.equal(ability.definition?.source?.patternId,"auto-vanguard-placement-counter-soul-named-search-v1");assert.deepEqual(ability.trigger.circles,["vanguard"]);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]);assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.effects,[{op:"search-deck-same-name-to-hand",target:"controller",maximum:1,cardName:"Seeker, Sacred Wingal"}]);
 const event=createGameEvent({matchId:"named-search"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source",previousLocation:"hand",currentLocation:"vanguard"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"source","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other-source","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"rear-left"},"source","rear-left","rear-left","p1"),false);
 const source={uid:"source",cardId:card.id},wanted={uid:"wanted",cardId:"wingal"},other={uid:"other",cardId:"other"},cb={uid:"cb",faceDown:false},soul={uid:"soul"},defs={[card.id]:card,wingal:{name:"Seeker, Sacred Wingal"},other:{name:"Other unit"}};const makePlayer=()=>({playerId:"p1",vanguard:source,rear:[],deck:[{...wanted},{...other}],hand:[],soul:[{...soul}],damage:[{...cb}],drop:[]});
 const player=makePlayer(),events=[],result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{player,source,side:"human",sourceZone:"vanguard",effectUid:wanted.uid,cardDefinitionForInstance:item=>defs[item.cardId],shuffleDeck:()=>{},emitEvent:entry=>events.push(entry)},draft=>payAbilityCosts(ability,{...draft,side:"human",sourceZone:"vanguard",turnId:1,actorPlayerId:"p1",cardDefinitionForInstance:item=>defs[item.cardId]},{cb:[cb.uid],sb:[soul.uid]}).ok);assert.equal(result.ok,true);assert.equal(player.hand[0].uid,wanted.uid);assert.deepEqual(player.drop.map(item=>item.uid),[soul.uid]);assert.equal(player.damage[0].faceDown,true);assert.ok(events.some(entry=>entry.type==="card.revealed"&&entry.cardInstanceId===wanted.uid));
 const invalid=makePlayer(),bad=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{player:invalid,source,side:"human",sourceZone:"vanguard",effectUid:other.uid,cardDefinitionForInstance:item=>defs[item.cardId],shuffleDeck:()=>{}},draft=>payAbilityCosts(ability,{...draft,side:"human",sourceZone:"vanguard",turnId:1,actorPlayerId:"p1",cardDefinitionForInstance:item=>defs[item.cardId]},{cb:[cb.uid],sb:[soul.uid]}).ok);assert.equal(bad.ok,false);assert.equal(invalid.damage[0].faceDown,false);assert.equal(invalid.soul[0].uid,soul.uid);assert.equal(invalid.hand.length,0);
});

test("boosted-unit AUTO belongs to the exact boosted card and checks the booster clan",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
 const card=loadCatalog().find(item=>item.id==="cfa-77"),ability=parseCardAbilities(card).find(item=>item.printedText.includes("When this unit is boosted by"));
 assert.equal(card.name,"Master Fraude");
 assert.equal(ability.definition?.source?.patternId,"auto-boosted-by-qualified-unit-power-v1");
 assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"unit.boosted",subject:"boosted-unit",circles:[],boosterClan:"Megacolony"});
 assert.equal(ability.requiredLocation[0],"vanguard");
 const event=createGameEvent({matchId:"boosted-unit"},{type:"unit.boosted",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"booster-a",subjectCardInstanceId:"booster-a",boosterCardInstanceId:"booster-a",boosterCardClan:"Megacolony",boostedCardInstanceId:"fraude-a",targetLocation:"vanguard",battleId:"battle-a"});
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"fraude-a","vanguard","vanguard","p1"),true);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"fraude-copy-b","vanguard","vanguard","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",{...event,boosterCardClan:"Nova Grappler"},"fraude-a","vanguard","vanguard","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",{...event,boostedCardInstanceId:"other-unit"},"fraude-a","vanguard","vanguard","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"fraude-a","rear-left","vanguard","p1"),false);
 const source={uid:"fraude-a",turnPowerBoost:0},match={pendingAttack:{attackerUid:"fraude-a",boostUid:"booster-a",power:10000}};
 const resolution=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,match,side:"p1"});
 assert.equal(resolution.ok,true);assert.equal(match.pendingAttack.power,13000);
 const unrelatedMatch={pendingAttack:{attackerUid:"another-attacker",boostUid:"booster-a",power:10000}};
 assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,match:unrelatedMatch,side:"p1"}).ok,false);
});

test("Pastel Deer critical AUTO checks the exact booster power threshold",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
 const card=loadCatalog().find(item=>item.id==="cfa-4539"),ability=parseCardAbilities(card)[0];
 assert.equal(ability.definition?.source?.patternId,"auto-boosted-by-power-threshold-critical-battle-v1");
 assert.equal(ability.gb,1);assert.equal(ability.trigger.boosterPowerAtLeast,20000);
 const event=createGameEvent({matchId:"pastel-deer"},{type:"unit.boosted",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"booster-a",subjectCardInstanceId:"booster-a",boosterCardInstanceId:"booster-a",boosterPower:20000,boostedCardInstanceId:"deer-a",targetLocation:"vanguard",battleId:"battle-a"});
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"deer-a","rear-left","rear-left","p1"),true);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",{...event,boosterPower:19999},"deer-a","rear-left","rear-left","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"another-deer","rear-left","rear-left","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"boost",event,"deer-a","vanguard","vanguard","p1"),false);
 const match={pendingAttack:{attackerUid:"deer-a",boostUid:"booster-a",critical:1}},source={uid:"deer-a"};
 const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,match,side:"p1"});
 assert.equal(result.ok,true);assert.equal(match.pendingAttack.critical,2);
 assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,match:{pendingAttack:{attackerUid:"other",critical:1}},side:"p1"}).ok,false);
 const app=fs.readFileSync("app.js","utf8");assert.match(app,/boosterPower=eventContext\.boosterPower\?\?\(eventName==="boost"&&boosterUid&&findFieldCard\(boosterUid\)\?attackerPower\(findFieldCard\(boosterUid\)\):null\)/);assert.match(app,/boosterCardRaces:eventContext\.boosterCardRaces\|\|boosterDefinition\?\.races\|\|\[\],boosterPower,boosterCardText/);
});

test("top-five grade search AUTO validates hand placement, private choice, reveal, shuffle, and conditional discard",()=>{
 const card={id:"search-grade-three",name:"Search unit",text:"AUTO [VC/RC]: When placed from hand, look at five cards from the top of your deck, reveal up to one grade 3 from among them and put it into your hand, shuffle your deck, and if you put a card, discard a card from your hand."},ability=parseCardAbilities(card)[0];assert.equal(ability.definition?.source?.patternId,"auto-placement-top-five-grade-three-search-discard-v1");assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"card.placed",subject:"source",circles:["vanguard","rear-guard"],sourceLocation:"hand"});assert.equal(ability.conditionStatus,"no-explicit-condition-detected");assert.equal(ability.costStatus,"no-cost");
 const event=createGameEvent({matchId:"search-placement"},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"search-source",sourceControllerPlayerId:"p1",subjectCardInstanceId:"search-source",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"rear-0"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"search-source","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,previousLocation:"deck"},"search-source","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other-copy","rear-left","rear-left","p1"),false);
 const defs=new Map([["g3",{grade:3}],["g2",{grade:2}]]),original={uid:"old-hand",cardId:"g2"},chosen={uid:"search-g3",cardId:"g3"},rest=[{uid:"a",cardId:"g2"},{uid:"b",cardId:"g2"},{uid:"c",cardId:"g2"},{uid:"d",cardId:"g2"}],player={playerId:"p1",hand:[original],deck:[...rest,chosen],drop:[]},events=[];let shuffled=false;const context={player,side:"p1",effectUid:chosen.uid,effectDiscardUid:original.uid,cardDefinitionForInstance:item=>defs.get(item.cardId),shuffleDeck:deck=>{shuffled=true;deck.reverse()},emitEvent:e=>events.push(e)};assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);const result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context);assert.equal(result.ok,true);assert.equal(shuffled,true);assert.equal(result.results[0].revealedCardId,"g3");assert.deepEqual(player.hand,[chosen]);assert.deepEqual(player.drop,[original]);assert.equal(player.deck.length,4);assert.deepEqual(events.map(e=>e.type),["card.revealed","card.discarded"]);assert.equal(events[0].revealedCardId,"g3");
 const noPick={player:{playerId:"p1",hand:[original],deck:[...rest,chosen],drop:[]},effectUid:null,effectDiscardUid:null,cardDefinitionForInstance:item=>defs.get(item.cardId),shuffleDeck:deck=>deck.reverse()};assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,noPick).ok,true);assert.deepEqual(noPick.player.hand,[original]);assert.deepEqual(noPick.player.drop,[]);assert.equal(noPick.player.deck.length,5);
 const invalid={player:{playerId:"p1",hand:[original],deck:[...rest,chosen],drop:[]},effectUid:chosen.uid,effectDiscardUid:null,cardDefinitionForInstance:item=>defs.get(item.cardId),shuffleDeck:deck=>deck.reverse()};assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,invalid).ok,false);assert.equal(invalid.player.hand.length,1);assert.equal(invalid.player.deck.length,5);
});

test("named Grade 3 search emits the revealed card identity before its later discard",()=>{
 const text='AUTO: When this unit is placed on RC from hand, COST [reveal a grade 3 card from hand], search your deck for up to one grade 3 card with "Chronojet" in its card name, reveal it and put it into your hand, shuffle your deck, choose a card from your hand, and discard it.';
 const ability=parseCardAbilities({id:"cfa-2471",text})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-rc-from-hand-reveal-grade-three-search-name-discard-v1");
 const cost={uid:"cost-grade-three",cardId:"cost-g3"},discard={uid:"discard-card",cardId:"ordinary"},chosen={uid:"chronojet-card",cardId:"chronojet-g3"};
 const player={playerId:"p1",hand:[cost,discard],deck:[chosen],drop:[]},events=[];
 const context={player,side:"p1",effectUid:chosen.uid,effectDiscardUid:discard.uid,cardDefinitionForInstance:card=>({"cost-g3":{grade:3},"chronojet-g3":{id:"chronojet-g3",name:"Chronojet Dragon",grade:3}}[card.cardId]||{}),shuffleDeck:deck=>deck.reverse(),emitEvent:event=>events.push(createGameEvent({matchId:"named-search"},{...event,actingPlayerId:"p1",turnPlayerId:"p1"}))};
 const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context);
 assert.equal(result.ok,true);
 assert.equal(events[0].type,"card.revealed");
 assert.equal(events[0].revealedCardId,"chronojet-g3");
 assert.equal(events[0].revealedCardName,"Chronojet Dragon");
 assert.equal(events[0].revealedCardGrade,3);
 assert.equal(events[1].type,"card.discarded");
});

test("from-hand placement events never infer a hand source for other placement actions",()=>{const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function queueAbilityPrompts("),queue=app.slice(start,app.indexOf("function queueMovedCardAbility(",start));assert.ok(!queue.includes("eventName==="+"place"+"?"+"hand"));assert.match(app,/callUnitToRear\(p,"human",instance,empty,\{source:"hand"\}\)/);assert.ok(app.includes('sourceZone:field?.zone||source,source,zone:"vanguard"'))});

test("Resist CONT is a passive keyword that rejects opponent targeting but allows its controller",()=>{
  const {parseCardAbilities,hasAbilityKeyword,matchesTargetFilter}=require("./ability-engine.js");
  const card={id:"test-resist",name:"Test Unit",type:"Normal Unit",text:"CONT [VC/RC/GC]: Resist (This unit cannot be chosen by the effects of your opponent’s cards.)"};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.kind,"CONT");assert.deepEqual(ability.definition?.keywords,["resist"]);assert.equal(hasAbilityKeyword(card,"resist"),true);
  const target={source:{uid:"source"},target:{uid:"target"},targetCard:card,targetControllerPlayerId:"defender",sourceControllerPlayerId:"attacker"};
  assert.equal(matchesTargetFilter({},target),false);assert.equal(matchesTargetFilter({}, {...target,sourceControllerPlayerId:"defender"}),true);assert.equal(matchesTargetFilter({}, {...target,sourceControllerPlayerId:undefined}),false);
  assert.equal(matchesTargetFilter({}, {...target,targetCard:{id:"plain",text:""}}),true);
});

test("exact RC cannot-be-chosen CONT protects only the Rear-Guard copy from opponent targets",()=>{
  const card={id:"test-rc-protection",name:"Protected Unit",type:"Normal Unit",text:"CONT [RC]: This unit cannot be chosen by your opponent’s card effects."};
  const ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition?.source?.patternId,"cont-rc-cannot-be-chosen-by-opponent-v1");
  assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.definition?.keywords,["resist"]);assert.equal(isManuallyActivatable(ability),false);
  const target={source:{uid:"attacker"},target:{uid:"protected"},targetCard:card,targetControllerPlayerId:"defender",sourceControllerPlayerId:"attacker"};
  assert.equal(matchesTargetFilter({},target),false);
  assert.equal(matchesTargetFilter({}, {...target,targetZone:"rear-left"}),false);
  assert.equal(matchesTargetFilter({}, {...target,targetZone:"vanguard"}),true);
  assert.equal(matchesTargetFilter({}, {...target,targetZone:"drop"}),true);
  assert.equal(matchesTargetFilter({}, {...target,sourceControllerPlayerId:"defender"}),true);
  assert.equal(matchesTargetFilter({}, {...target,targetCard:{...card,text:""}}),true);
});

test("remote Stride, Perfect Guard, and G-Guard commands validate the owning player's pending costs",()=>{
 const common={matchId:"payment-room",stateVersion:4,side:"bot",phase:3,players:{human:{playerId:"host",hand:[{uid:"host-hand"}],gDeck:[{uid:"host-g","faceUp":false}]},bot:{playerId:"joiner",hand:[{uid:"joiner-hand"},{uid:"joiner-cost"}],gDeck:[{uid:"joiner-g","faceUp":false}]}}};
 const req=action=>({type:"action",action,actionId:`cmd-${action}`,matchId:"payment-room",actorPlayerId:"joiner",expectedStateVersion:4});
 assert.deepEqual(validateRemoteActionRequest(common,req("manual:stride:joiner-g"),"joiner"),{ok:true});
 assert.equal(validateRemoteActionRequest(common,req("manual:stride:host-g"),"joiner").reason,"invalid-stride-selection");
 const pending={...common,pendingStride:{ownerSide:"bot",unitUid:"joiner-g",costUids:["joiner-hand"]}};
 assert.deepEqual(validateRemoteActionRequest(pending,req("manual:stride-confirm"),"joiner"),{ok:true});
 assert.equal(validateRemoteActionRequest({...pending,pendingStride:{...pending.pendingStride,costUids:["host-hand"]}},req("manual:stride-confirm"),"joiner").reason,"invalid-stride-payment");
 assert.equal(validateRemoteActionRequest(common,req("manual:stride-cost:host-hand"),"joiner").reason,"invalid-stride-cost-selection");
 const attack={...common,phase:5,pendingAttack:{defenderSide:"bot",defenderDone:false}};
 assert.deepEqual(validateRemoteActionRequest(attack,req("manual:guard-perfect:joiner-hand:joiner-cost"),"joiner"),{ok:true});
 assert.equal(validateRemoteActionRequest(attack,req("manual:guard-perfect:joiner-hand:host-hand"),"joiner").reason,"invalid-perfect-guard-payment");
 assert.deepEqual(validateRemoteActionRequest({...attack,pendingAttack:{...attack.pendingAttack,attackerSide:"human"}},req("manual:g-guard:joiner-g:joiner-hand"),"joiner"),{ok:true});
 assert.equal(validateRemoteActionRequest(attack,req("manual:g-guard:host-g:joiner-hand"),"joiner").reason,"invalid-g-guard-payment");
 assert.equal(validateRemoteActionRequest({...attack,pendingAttack:{...attack.pendingAttack,defenderSide:"human"}},req("manual:guard-perfect:joiner-hand:joiner-cost"),"joiner").reason,"invalid-perfect-guard-payment");
});

test("concise Vanguard placement draw-discard wording matches only its own VC placement",()=>{
 const ability=parseCardAbilities({id:"concise-placement",text:"AUTO [VC]: When placed, draw a card, and discard a card."})[0];assert.equal(ability.definition?.source?.patternId,"auto-vanguard-placement-draw-discard-v1");assert.deepEqual(ability.trigger.circles,["vanguard"]);
 const event=createGameEvent({matchId:"concise-placement"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"copy-a",subjectCardInstanceId:"copy-a",currentLocation:"vanguard"});
 assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"copy-a","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"copy-b","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"rear-left"},"copy-a","rear-left","rear-left","p1"),false);
});
test("Normal Order CONT power tracks the controller's order counter and only applies on RC",()=>{
 const ability=parseCardAbilities({id:"normal-order-cont",text:"CONT [RC]: If you played a normal order this turn, this unit gets power +5000."})[0];
 assert.equal(ability.kind,"CONT");assert.equal(ability.definition?.source?.patternId,"cont-rc-normal-order-power-v1");assert.deepEqual(ability.definition.effects,[{op:"continuous-power",target:"source",amount:5000,duration:"continuous",condition:{op:"normal-order-played-this-turn"}}]);assert.equal(ability.conditionStatus,"no-explicit-condition-detected");assert.equal(isManuallyActivatable(ability),false);
 assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard",normalOrderPlayedThisTurn:false}),{power:0,critical:0,drive:0});assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard",normalOrderPlayedThisTurn:true}),{power:5000,critical:0,drive:0});assert.deepEqual(evaluateContinuousEffects([ability],{location:"vanguard",normalOrderPlayedThisTurn:true}),{power:0,critical:0,drive:0});
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("normalOrderPlayedThisTurn:match.side===side&&orderCount>0"));assert.ok(app.includes("orderPlayedThisTurn:match.side===side&&orderCount>0"));
});

test("discard-replacement CONT counts as grade 3 only when this exact Hand instance pays Stride",()=>{
 const ability=parseCardAbilities({id:"discard-as-grade-three",text:"CONT [Hand]: When this card would be discarded, it may be discarded as a grade 3."})[0];
 assert.equal(ability.definition?.source?.patternId,"cont-hand-stride-cost-treated-grade-three-v1");assert.deepEqual(ability.requiredLocation,["hand"]);assert.equal(isManuallyActivatable(ability),false);
 assert.deepEqual(evaluateStrideCostGrade([ability],{location:"hand",isPayingStrideCost:true}),{grade:0,treatedAsGradeThree:true});assert.deepEqual(evaluateStrideCostGrade([ability],{location:"hand",isPayingStrideCost:false}),{grade:0});assert.deepEqual(evaluateStrideCostGrade([ability],{location:"rear-guard",isPayingStrideCost:true}),{grade:0});
});
test("attack-battle CONT power applies only to its exact RC source attacking a Vanguard",()=>{
 const ability=parseCardAbilities({id:"attacks-vanguard-cont",text:"CONT [RC]: During the battle it attacked a vanguard, this unit gets power +3000."})[0];
 assert.equal(ability.definition?.source?.patternId,"cont-rc-attacks-vanguard-battle-power-v1");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.equal(isManuallyActivatable(ability),false);
 assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard",attackingVanguard:false}),{power:0,critical:0,drive:0});assert.deepEqual(evaluateContinuousEffects([ability],{location:"rear-guard",attackingVanguard:true}),{power:3000,critical:0,drive:0});assert.deepEqual(evaluateContinuousEffects([ability],{location:"vanguard",attackingVanguard:true}),{power:0,critical:0,drive:0});
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("attackerPower(attacker,{targetZone:zone,boosterCardInstanceId:setup.boostUid||null"));assert.ok(app.includes("attackTargetZone:attackContext.targetZone"));
});

test("CONT power grade gates use the correct controller and opponent Vanguard",()=>{
 const opponent=parseCardAbilities({id:"opponent-grade-cont",text:"CONT [RC]: During your turn, if your opponent’s vanguard is grade 3 or greater, this unit gets power +5000."})[0];
 const controller=parseCardAbilities({id:"controller-grade-cont",text:"CONT [RC]: If your vanguard is grade 3 or greater, this unit gets power +3000."})[0];
 assert.deepEqual(opponent.definition?.effects[0].condition,{op:"opponent-vanguard-grade-at-least",grade:3,controllerTurn:true});assert.deepEqual(controller.definition?.effects[0].condition,{op:"controller-vanguard-grade-at-least",grade:3});
 const power=a=>evaluateContinuousEffects([a],{location:"rear-guard",opponentVanguardGrade:3,controllerVanguardGrade:3,isControllerTurn:true});
 assert.equal(power(opponent).power,5000);assert.equal(evaluateContinuousEffects([opponent],{location:"rear-guard",opponentVanguardGrade:2,isControllerTurn:true}).power,0);assert.equal(evaluateContinuousEffects([opponent],{location:"rear-guard",opponentVanguardGrade:3,isControllerTurn:false}).power,0);
 assert.equal(power(controller).power,3000);assert.equal(evaluateContinuousEffects([controller],{location:"rear-guard",controllerVanguardGrade:2,isControllerTurn:false}).power,0);assert.equal(evaluateContinuousEffects([controller],{location:"vanguard",controllerVanguardGrade:3,isControllerTurn:true}).power,0);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("opponentVanguardGrade=gradeOf(cardMap.get(match.players[flipSide(side)]?.vanguard?.cardId))"));assert.ok(app.includes("controllerVanguardGrade=gradeOf(cardMap.get(player.vanguard?.cardId)"));
});

test("GC call-top ability requires its exact source placed from hand and the Guardian Circle",()=>{
  const ability=parseCardAbilities({id:"gc-call-top",text:"AUTO [Counter Blast 1] When this unit is placed on GC from your hand, you may pay the cost. If you do, call five cards from the top of your deck to GC at rest."})[0];
  assert.equal(ability.definition.source.patternId,"auto-gc-counter-blast-call-top-to-guardian-v1");
  assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.equal(ability.canDecline,true);assert.equal(ability.trigger.sourceLocation,"hand");assert.deepEqual(ability.trigger.circles,["guardian"]);
  const event=createGameEvent({matchId:"gc-call-top",eventSequence:1},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source",previousLocation:"hand",currentLocation:"guardian",circle:"guardian"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"source","guardian","guardian","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other","guardian","guardian","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,previousLocation:"deck"},"source","guardian","guardian","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"rear-guard",circle:"rear-guard"},"source","rear-guard","rear-guard","p1"),false);
});

test("call-top-to-guardian effect moves only available top cards, rests them, adds shield, and emits placement events",()=>{
  const player={playerId:"p1",deck:[{uid:"bottom",shield:5000},{uid:"top",shield:10000}],guardCircle:[]};
  const attack={defenderSide:"p1",guardCards:[],targetPower:12000};const match={players:{p1:player},pendingAttack:attack};const events=[];
  const result=resolveEffectProgram([{op:"call-top-to-guardian",target:"controller",count:5,destination:"guardian",position:"rest"}],EFFECT_HANDLERS,{player,side:"p1",match,cardDefinitionForInstance:card=>({type:"Unit",shield:card.shield}),shieldValueForInstance:card=>card.shield,emitEvent:event=>events.push(event)});
  assert.equal(result.ok,true);assert.equal(result.results[0],2);assert.deepEqual(player.deck,[]);assert.deepEqual(player.guardCircle.map(card=>card.uid),["top","bottom"]);assert.ok(player.guardCircle.every(card=>card.rested&&card.position==="rest"&&card.zone==="guardian"&&card.faceUp));assert.deepEqual(attack.guardCards.map(card=>card.uid),["top","bottom"]);assert.equal(attack.targetPower,27000);assert.deepEqual(events.map(event=>[event.cardInstanceId,event.previousLocation,event.currentLocation]),[["top","deck","guardian"],["bottom","deck","guardian"]]);
  const wrongDefender=resolveEffectProgram([{op:"call-top-to-guardian",target:"controller",count:5,destination:"guardian",position:"rest"}],EFFECT_HANDLERS,{player,side:"p1",match:{players:{p1:player},pendingAttack:{defenderSide:"p2",guardCards:[],targetPower:0}},cardDefinitionForInstance:()=>({type:"Unit",shield:0}),shieldValueForInstance:()=>0});assert.equal(wrongDefender.ok,false);
});
test("Ride Phase discard trigger is tied to the exact discarded hand instance and Ride Phase",()=>{
  const ability=parseCardAbilities({id:"ride-bottom-draw",text:"AUTO: When this card is discarded from hand during your ride phase, COST [Soul Blast 1 & put this card on the bottom of deck], and draw a card."})[0];
  assert.equal(ability.definition.source.patternId,"auto-ride-phase-discard-soul-blast-bottom-deck-draw-v1");assert.deepEqual(ability.costs,[{type:"soul-blast",count:1},{type:"source-to-bottom-deck",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.trigger.requiredPhase,"ride");assert.equal(ability.trigger.sourceLocation,"hand");
  const event=createGameEvent({matchId:"ride-bottom-draw",eventSequence:1},{type:"card.discarded",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"source",sourceOwnerPlayerId:"p1",sourceControllerPlayerId:"p1",cardInstanceId:"source",subjectCardInstanceId:"source",subjectOwnerPlayerId:"p1",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"drop",phase:"ride"});
  assert.equal(eventMatchesAbilityTrigger(ability,"discard",event,"source","drop","hand","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"discard",event,"other","drop","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,previousLocation:"rear-left"},"source","drop","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,phase:"main"},"source","drop","hand","p1"),false);
});

test("Ride Phase source-to-bottom cost moves only the exact Drop card before drawing and rolls back when unpaid",()=>{
  const ability=parseCardAbilities({id:"ride-bottom-resolution",text:"AUTO: When this card is discarded from hand during your ride phase, COST [Soul Blast 1 & put this card on the bottom of deck], and draw a card."})[0];
  const source={uid:"discarded-source",cardId:"ride-bottom-resolution"},soulCost={uid:"soul-cost"},top={uid:"top-card"},player={playerId:"p1",deck:[{uid:"old-bottom"},top],hand:[],damage:[],soul:[soulCost],drop:[source],rear:[]},events=[];
  const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source,side:"human",sourceZone:"hand",turnId:2,actorPlayerId:"p1",emitEvent:event=>events.push(event)},draft=>payAbilityCosts(ability,{...draft,turnId:2,actorPlayerId:"p1",side:"human",sourceZone:"hand"},{sb:["soul-cost"]}).ok);
  assert.equal(result.ok,true);assert.deepEqual(player.drop.map(card=>card.uid),["soul-cost"]);assert.deepEqual(player.deck.map(card=>card.uid),["discarded-source","old-bottom"]);assert.deepEqual(player.hand.map(card=>card.uid),["top-card"]);assert.deepEqual(events.map(event=>event.type),["card.moved","card.moved","card.drawn"]);assert.deepEqual(events.slice(0,2).map(event=>[event.cardInstanceId,event.previousLocation,event.currentLocation]),[["soul-cost","soul","drop"],["discarded-source","drop","deck"]]);
  const unpaid={playerId:"p1",deck:[{uid:"untouched"}],hand:[],damage:[],soul:[],drop:[{uid:"source-2"}],rear:[]},unpaidSource=unpaid.drop[0];const rejected=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:unpaid,source:unpaidSource,side:"human",sourceZone:"hand",turnId:3,actorPlayerId:"p1"},draft=>payAbilityCosts(ability,{...draft,turnId:3,actorPlayerId:"p1",side:"human",sourceZone:"hand"},{sb:[]}).ok);assert.equal(rejected.ok,false);assert.deepEqual(unpaid.drop.map(card=>card.uid),["source-2"]);assert.deepEqual(unpaid.deck.map(card=>card.uid),["untouched"]);assert.equal(unpaid.hand.length,0);
});
test("attack counters are scoped to the exact attacker, controller, and turn",()=>{
  const state={turn:4};assert.equal(VanguardAbilityEngine.recordAttackCount(state,"p1","unit-a"),1);assert.equal(VanguardAbilityEngine.recordAttackCount(state,"p1","unit-a"),2);assert.equal(VanguardAbilityEngine.getAttackCount(state,"p1","unit-a"),2);assert.equal(VanguardAbilityEngine.getAttackCount(state,"p2","unit-a"),0);assert.equal(VanguardAbilityEngine.recordAttackCount(state,"p1","unit-b"),1);state.turn=5;assert.equal(VanguardAbilityEngine.getAttackCount(state,"p1","unit-a"),0);assert.equal(VanguardAbilityEngine.recordAttackCount(state,"p1","unit-a"),1);
});

test("second-attack GC shield AUTO requires its exact Guardian Circle placement and current battle count",()=>{
  const ability=parseCardAbilities({id:"second-attack-shield",text:"AUTO: When this unit is put on GC, if your opponent’s attacking unit has attacked two or more times this turn, this unit gets shield +15000 until end of that battle. (Active if this battle is its second attack this turn or more)"})[0];
  assert.equal(ability.definition.source.patternId,"auto-gc-opponent-second-attack-shield-v1");assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.conditions,[{type:"opponent-attacking-unit-attacked-at-least",count:2}]);assert.equal(ability.canDecline,false);
  assert.equal(evaluateAbilityConditions(ability,{opponentAttackingUnitAttackCount:1}),false);assert.equal(evaluateAbilityConditions(ability,{opponentAttackingUnitAttackCount:2}),true);
  const event=createGameEvent({matchId:"second-attack-shield"},{type:"card.placed",actingPlayerId:"defender",sourceCardInstanceId:"guard",subjectCardInstanceId:"guard",previousLocation:"hand",currentLocation:"guardian",circle:"guardian",battleId:"battle-2",attackingUnitInstanceId:"attacker",attackingUnitAttackCount:2});
  assert.equal(event.attackingUnitInstanceId,"attacker");assert.equal(event.attackingUnitAttackCount,2);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"guard","guardian","guardian","defender"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,circle:"rear-guard",currentLocation:"rear-guard"},"guard","rear-left","rear-left","defender"),false);
});

test("GC lower-grade shield AUTO requires its exact source placement and a strict controller grade comparison",()=>{
  const ability=parseCardAbilities({id:"gc-grade-shield",text:"AUTO: When this unit is put on GC, if your vanguard’s grade is less than your opponent’s vanguard’s grade, this unit gets shield +10000 until end of that battle."})[0];
  assert.equal(ability.definition?.source?.patternId,"auto-gc-controller-vanguard-lower-grade-shield-v1");
  assert.deepEqual(ability.requiredLocation,["guardian"]);
  assert.deepEqual(ability.conditions,[{type:"controller-vanguard-grade-lower-than-opponent"}]);
  const guard={uid:"guard-a",controllerPlayerId:"p1"};
  const event=createGameEvent({matchId:"grade-shield",eventSequence:0},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p2",sourceCardInstanceId:guard.uid,sourceControllerPlayerId:"p1",subjectCardInstanceId:guard.uid,subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"guardian"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,guard.uid,"guardian","guardian","p1"),true);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other-guard","guardian","guardian","p1"),false);
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,guard.uid,"rear-guard","rear-guard","p1"),false);
  assert.equal(evaluateAbilityConditions(ability,{controllerVanguardGrade:2,opponentVanguardGrade:3}),true);
  assert.equal(evaluateAbilityConditions(ability,{controllerVanguardGrade:3,opponentVanguardGrade:3}),false);
  assert.equal(evaluateAbilityConditions(ability,{controllerVanguardGrade:4,opponentVanguardGrade:3}),false);
  assert.equal(evaluateAbilityConditions(ability,{opponentVanguardGrade:3}),false);
  assert.deepEqual(ability.effects,[{op:"modify-shield-source",target:"source",amount:10000,duration:"battle"}]);
});

test("second-attack shield resolves only for the defending side and matching active battle",()=>{
  const ability=parseCardAbilities({id:"second-attack-shield-effect",text:"AUTO: When this unit is put on GC, if your opponent’s attacking unit has attacked two or more times this turn, this unit gets shield +15000 until end of that battle. (Active if this battle is its second attack this turn or more)"})[0],guard={uid:"guard",cardId:"second-attack-shield-effect"},player={playerId:"p1",guardCircle:[guard]},attack={battleId:"battle-2",defenderSide:"p1",guardCards:[guard],targetPower:12000},match={players:{p1:player},pendingAttack:attack};
  const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source:guard,side:"p1",match,battleId:"battle-2"});assert.equal(result.ok,true);assert.equal(guard.battleShieldBoost,15000);assert.equal(guard.battleShieldExpiryBattleId,"battle-2");assert.equal(attack.targetPower,27000);
  const wrongBattle=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source:guard,side:"p1",match,battleId:"old-battle"});assert.equal(wrongBattle.ok,false);
});
test("VC placement discard-draw AUTO matches only its own Vanguard placement and requires the hand cost",()=>{
  const ability=parseCardAbilities({id:"vc-discard-draw",text:"AUTO [VC]: When placed, COST [discard a card from your hand], and draw a card."})[0];
  assert.equal(ability.definition.source.patternId,"auto-vanguard-placement-discard-draw-v1");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.trigger.circles,["vanguard"]);assert.deepEqual(ability.costs,[{type:"discard",count:1}]);assert.equal(ability.canDecline,false);assert.equal(ability.costStatus,"supported-cost");
  const event=createGameEvent({matchId:"vc-discard-draw"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source",previousLocation:"hand",currentLocation:"vanguard",circle:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"source","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,circle:"rear-guard",currentLocation:"rear-guard"},"source","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,type:"unit.attacked"},"source","vanguard","vanguard","p1"),false);
  assert.equal(canPayAbilityCosts(ability,{discardableHand:0}),false);assert.equal(canPayAbilityCosts(ability,{discardableHand:1}),true);
});

test("VC placement discard-draw pays the discard before drawing and rejects missing payment atomically",()=>{
  const ability=parseCardAbilities({id:"vc-discard-draw-resolution",text:"AUTO [VC]: When placed, COST [discard a card from your hand], and draw a card."})[0],source={uid:"vanguard-source"},discard={uid:"discard"},top={uid:"top"},player={playerId:"p1",vanguard:source,rear:[],damage:[],soul:[],hand:[discard],drop:[],deck:[top]},events=[];
  const context={player,source,side:"human",sourceZone:"vanguard",turnId:1,actorPlayerId:"p1",emitEvent:event=>events.push(event)};
  const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context,draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"p1",side:"human",sourceZone:"vanguard"},{discard:["discard"]}).ok);assert.equal(result.ok,true);assert.deepEqual(player.hand.map(card=>card.uid),["top"]);assert.deepEqual(player.drop.map(card=>card.uid),["discard"]);assert.deepEqual(events.map(event=>event.type),["card.discarded","card.drawn"]);
  const unpaidCard={uid:"source-2"},unpaid={playerId:"p1",vanguard:unpaidCard,rear:[],damage:[],soul:[],hand:[],drop:[],deck:[{uid:"untouched"}]},rejected=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:unpaid,source:unpaidCard,side:"human",sourceZone:"vanguard",turnId:1,actorPlayerId:"p1"},draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"p1",side:"human",sourceZone:"vanguard"},{discard:[]}).ok);assert.equal(rejected.ok,false);assert.deepEqual(unpaid.deck.map(card=>card.uid),["untouched"]);assert.equal(unpaid.drop.length,0);assert.equal(unpaid.hand.length,0);
});test("Ride Phase Hand AUTO is tied to the controller's Ride Phase and its Vanguard grade",()=>{
 const ability=parseCardAbilities({id:"ride-hand-search",text:"AUTO [Hand]: At the beginning of your ride phase, if your vanguard is grade 1 or less, COST [discard this card], look at the top five cards of your deck, choose up to one grade 2 or less card from among them, reveal it and put it into your hand, and shuffle your deck."})[0];
 assert.equal(ability.definition.source.patternId,"auto-hand-ride-phase-discard-self-search-top-five-grade-two-v1");assert.deepEqual(ability.requiredLocation,["hand"]);assert.equal(ability.trigger.eventType,"phase.changed");assert.equal(ability.trigger.requiredPhase,"ride");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(ability.costs,[{type:"source-discard",count:1}]);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-grade-at-most",count:1}]);
 const event=createGameEvent({matchId:"ride-hand-search"},{type:"phase.changed",actingPlayerId:"p1",turnPlayerId:"p1",phase:"ride"});
 assert.equal(eventMatchesAbilityTrigger(ability,"phase",event,"source","hand",null,"p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"phase",{...event,phase:"main"},"source","hand",null,"p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"phase",{...event,turnPlayerId:"p2"},"source","hand",null,"p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"phase",event,"source","rear-left",null,"p1"),false);
 assert.equal(evaluateAbilityConditions(ability,{controllerVanguardGrade:1}),true);assert.equal(evaluateAbilityConditions(ability,{controllerVanguardGrade:2}),false);assert.equal(evaluateAbilityConditions(ability,{}),false);assert.equal(canPayAbilityCosts(ability,{sourceCanDiscard:true}),true);assert.equal(canPayAbilityCosts(ability,{sourceCanDiscard:false}),false);
});
test("Ride Phase Hand AUTO pays by discarding its exact source before optional top-five search",()=>{
 const ability=parseCardAbilities({id:"ride-hand-resolution",text:"AUTO [Hand]: At the beginning of your ride phase, if your vanguard is grade 1 or less, COST [discard this card], look at the top five cards of your deck, choose up to one grade 2 or less card from among them, reveal it and put it into your hand, and shuffle your deck."})[0],source={uid:"source",cardId:"ride-hand-resolution"},eligible={uid:"grade-2",cardId:"g2"},illegal={uid:"grade-3",cardId:"g3"},deck=[{uid:"bottom",cardId:"g1"},illegal,eligible],player={playerId:"p1",deck,hand:[source],damage:[],soul:[],drop:[],rear:[]},definitions={"g1":{grade:1},"g2":{grade:2},"g3":{grade:3}},events=[];
 const context={player,source,side:"human",sourceZone:"hand",turnId:1,actorPlayerId:"p1",effectUid:eligible.uid,cardDefinitionForInstance:card=>definitions[card.cardId],shuffleDeck:cards=>cards.reverse(),emitEvent:event=>events.push(event)};
 const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context,draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"p1",side:"human",sourceZone:"hand"},{}).ok);
 assert.equal(result.ok,true);assert.deepEqual(player.hand.map(card=>card.uid),[eligible.uid]);assert.deepEqual(player.drop.map(card=>card.uid),[source.uid]);assert.deepEqual(player.deck.map(card=>card.uid),[illegal.uid,"bottom"]);assert.deepEqual(events.map(event=>[event.type,event.cardInstanceId,event.previousLocation,event.currentLocation]),[["card.discarded",source.uid,"hand","drop"],["card.revealed",eligible.uid,"deck","hand"]]);
 const noPick={playerId:"p1",deck:[{uid:"top",cardId:"g2"}],hand:[{uid:"source-2",cardId:"ride-hand-resolution"}],damage:[],soul:[],drop:[],rear:[]};const noPickResult=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:noPick,source:noPick.hand[0],side:"human",sourceZone:"hand",effectUid:null,cardDefinitionForInstance:card=>definitions[card.cardId],shuffleDeck:cards=>cards,turnId:2,actorPlayerId:"p1"},draft=>payAbilityCosts(ability,{...draft,turnId:2,actorPlayerId:"p1",side:"human",sourceZone:"hand"},{}).ok);assert.equal(noPickResult.ok,true);assert.equal(noPick.hand.length,0);assert.equal(noPick.drop[0].uid,"source-2");assert.equal(noPick.deck[0].uid,"top");
 const illegalPick=validateEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,effectUid:illegal.uid});assert.equal(illegalPick.ok,false);
});
test("paid placement draw AUTO matches only its exact VC source and printed costs",()=>{
 const ability=parseCardAbilities({id:"paid-vc-draw",text:"AUTO [Counter Blast 1 & Soul Blast 1] When this unit is placed on VC, you may pay the cost. If you do, draw a card."})[0];assert.equal(ability.definition.source.patternId,"auto-placed-circle-counter-soul-draw-v1");assert.equal(ability.canDecline,true);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]);assert.deepEqual(ability.trigger.circles,["vanguard"]);
 const event=createGameEvent({matchId:"paid-vc-draw"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source",previousLocation:"hand",currentLocation:"vanguard",circle:"vanguard"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"source","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,circle:"rear-guard",currentLocation:"rear-guard"},"source","rear-left","rear-left","p1"),false);assert.equal(canPayAbilityCosts(ability,{faceUpDamage:1,soulCount:1}),true);assert.equal(canPayAbilityCosts(ability,{faceUpDamage:0,soulCount:1}),false);
});
test("paid placement draw pays both resources before drawing and rejects unpaid effects atomically",()=>{
 const ability=parseCardAbilities({id:"paid-vc-draw-resolution",text:"AUTO [Counter Blast 1 & Soul Blast 1] When this unit is placed on VC, you may pay the cost. If you do, draw a card."})[0],source={uid:"source"},damage={uid:"damage",faceDown:false},soul={uid:"soul"},top={uid:"top"},player={playerId:"p1",vanguard:source,rear:[],damage:[damage],soul:[soul],hand:[],drop:[],deck:[top]},events=[];const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source,side:"human",sourceZone:"vanguard",turnId:1,actorPlayerId:"p1",emitEvent:event=>events.push(event)},draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"p1",side:"human",sourceZone:"vanguard"},{cb:[damage.uid],sb:[soul.uid]}).ok);assert.equal(result.ok,true);assert.equal(damage.faceDown,true);assert.deepEqual(player.soul,[]);assert.deepEqual(player.drop.map(card=>card.uid),[soul.uid]);assert.deepEqual(player.hand.map(card=>card.uid),[top.uid]);assert.deepEqual(events.map(event=>event.type),["card.moved","card.drawn"]);
 const unpaid={playerId:"p1",vanguard:{uid:"source-2"},rear:[],damage:[],soul:[{uid:"soul-2"}],hand:[],drop:[],deck:[{uid:"untouched"}]},rejected=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:unpaid,source:unpaid.vanguard,side:"human",sourceZone:"vanguard",turnId:2,actorPlayerId:"p1"},draft=>payAbilityCosts(ability,{...draft,turnId:2,actorPlayerId:"p1",side:"human",sourceZone:"vanguard"},{cb:[],sb:["soul-2"]}).ok);assert.equal(rejected.ok,false);assert.deepEqual(unpaid.deck.map(card=>card.uid),["untouched"]);assert.equal(unpaid.damage.length,0);assert.equal(unpaid.soul.length,1);assert.equal(unpaid.hand.length,0);
});
test("RC-from-hand grade-three search ability matches its own placement, hand cost, and name-filtered deck choice",()=>{
 const ability=parseCardAbilities({id:"rc-grade-three-search",text:"AUTO: When this unit is placed on RC from hand, COST [reveal a grade 3 card from hand], search your deck for up to one grade 3 card with \"Chronojet\" in its card name, reveal it and put it into your hand, shuffle your deck, choose a card from your hand, and discard it."})[0];assert.equal(ability.definition.source.patternId,"auto-rc-from-hand-reveal-grade-three-search-name-discard-v1");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(ability.costs,[{type:"reveal-grade-from-hand",count:1,grade:3}]);assert.deepEqual(ability.trigger.circles,["rear-guard"]);assert.equal(ability.trigger.sourceLocation,"hand");assert.equal(ability.canDecline,false);assert.equal(canPayAbilityCosts(ability,{revealableGradeThreeHand:1}),true);assert.equal(canPayAbilityCosts(ability,{revealableGradeThreeHand:0}),false);
 const event=createGameEvent({matchId:"rc-grade-three-search"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source",previousLocation:"hand",currentLocation:"rear-left",circle:"rear-guard"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"source","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,currentLocation:"vanguard",circle:"vanguard"},"source","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,previousLocation:"deck"},"source","rear-left","rear-left","p1"),false);
});
test("RC-from-hand search pays its reveal, optionally searches by Grade and name, shuffles, then discards",()=>{
 const ability=parseCardAbilities({id:"rc-grade-three-search-resolution",text:"AUTO: When this unit is placed on RC from hand, COST [reveal a grade 3 card from hand], search your deck for up to one grade 3 card with \"Chronojet\" in its card name, reveal it and put it into your hand, shuffle your deck, choose a card from your hand, and discard it."})[0],source={uid:"source",cardId:"rc-grade-three-search-resolution"},reveal={uid:"reveal",cardId:"cost-grade-three"},searched={uid:"search",cardId:"chronojet-grade-three"},wrongName={uid:"wrong-name",cardId:"other-grade-three"},wrongGrade={uid:"wrong-grade",cardId:"chronojet-grade-two"},player={playerId:"p1",deck:[searched,wrongName,wrongGrade],hand:[reveal],damage:[],soul:[],drop:[],rear:[source]},definitions={"cost-grade-three":{grade:3,name:"Cost Grade 3"},"chronojet-grade-three":{grade:3,name:"Chronojet Dragon"},"other-grade-three":{grade:3,name:"Different Unit"},"chronojet-grade-two":{grade:2,name:"Chronojet Scout"}},events=[];const base={player,source,side:"human",sourceZone:"rear-left",turnId:1,actorPlayerId:"p1",effectUid:searched.uid,effectDiscardUid:searched.uid,cardDefinitionForInstance:card=>definitions[card.cardId],shuffleDeck:cards=>cards.reverse(),emitEvent:event=>events.push(event)};
 const resolvedPlayer={...player,deck:[...player.deck],hand:[...player.hand],drop:[],damage:[],soul:[],rear:[source]},result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...base,player:resolvedPlayer},draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"p1",side:"human",sourceZone:"rear-left",cardDefinitionForInstance:card=>definitions[card.cardId],emitEvent:event=>events.push(event)},{reveal:[reveal.uid]}).ok);assert.equal(result.ok,true);assert.deepEqual(resolvedPlayer.deck.map(card=>card.uid),[wrongGrade.uid,wrongName.uid]);assert.deepEqual(resolvedPlayer.hand.map(card=>card.uid),[reveal.uid]);assert.deepEqual(resolvedPlayer.drop.map(card=>card.uid),[searched.uid]);
 const p={playerId:"p1",deck:[{uid:"unrelated-deck",cardId:"other-grade-three"}],hand:[{uid:"revealed-cost",cardId:"cost-grade-three"},{uid:"keep",cardId:"cost-grade-three"}],damage:[],soul:[],drop:[],rear:[source]},eventsNoPick=[];const noPick=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:p,source,side:"human",sourceZone:"rear-left",turnId:2,actorPlayerId:"p1",effectUid:null,effectDiscardUid:"revealed-cost",cardDefinitionForInstance:card=>definitions[card.cardId],shuffleDeck:cards=>cards,emitEvent:event=>eventsNoPick.push(event)},draft=>payAbilityCosts(ability,{...draft,turnId:2,actorPlayerId:"p1",side:"human",sourceZone:"rear-left",cardDefinitionForInstance:card=>definitions[card.cardId],emitEvent:event=>eventsNoPick.push(event)},{reveal:["revealed-cost"]}).ok);assert.equal(noPick.ok,true);assert.deepEqual(p.hand.map(card=>card.uid),["keep"]);assert.deepEqual(p.drop.map(card=>card.uid),["revealed-cost"]);assert.deepEqual(p.deck.map(card=>card.uid),["unrelated-deck"]);
 const invalidDiscardPlayer={playerId:"p1",deck:[searched],hand:[reveal],damage:[],soul:[],drop:[],rear:[source]},invalidDiscard=validateEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:invalidDiscardPlayer,source,side:"human",sourceZone:"rear-left",effectUid:searched.uid,effectDiscardUid:"not-in-hand",cardDefinitionForInstance:card=>definitions[card.cardId],shuffleDeck:cards=>cards});assert.equal(invalidDiscard.ok,false);assert.deepEqual(invalidDiscardPlayer.deck.map(card=>card.uid),[searched.uid]);const illegal={playerId:"p1",deck:[{uid:"illegal",cardId:"chronojet-grade-two"}],hand:[reveal],damage:[],soul:[],drop:[],rear:[source]},rejected=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:illegal,source,side:"human",sourceZone:"rear-left",effectUid:"illegal",effectDiscardUid:reveal.uid,cardDefinitionForInstance:card=>definitions[card.cardId],shuffleDeck:cards=>cards},draft=>payAbilityCosts(ability,{...draft,side:"human",sourceZone:"rear-left",cardDefinitionForInstance:card=>definitions[card.cardId]},{reveal:[reveal.uid]}).ok);assert.equal(rejected.ok,false);assert.equal(illegal.deck[0].uid,"illegal");assert.equal(illegal.hand[0].uid,"reveal");assert.equal(illegal.drop.length,0);
 const wrongReveal={...player,deck:[searched],hand:[{uid:"not-grade-three",cardId:"chronojet-grade-two"}],damage:[],soul:[],drop:[],rear:[source]},badPayment=payAbilityCosts(ability,{player:wrongReveal,source,side:"human",sourceZone:"rear-left",cardDefinitionForInstance:card=>definitions[card.cardId]},{reveal:["not-grade-three"]});assert.equal(badPayment.ok,false);assert.equal(wrongReveal.deck[0].uid,searched.uid);assert.equal(wrongReveal.hand.length,1);
});
test("remote ability decisions accept one typed reveal-cost selection and reject missing or duplicate selections",()=>{
 const state={matchId:"reveal-decision-room",stateVersion:7,processedActionIds:[],players:{guest:{playerId:"joiner",hand:[{uid:"hand-grade3"}],damage:[],soul:[]}}},pending={instance:{uid:"joiner-source",controllerPlayerId:"joiner"},ability:{id:"joiner-source:0",costs:[{type:"reveal-grade-from-hand",count:1,grade:3}]}},base={matchId:"reveal-decision-room",actorPlayerId:"joiner",expectedStateVersion:7,accept:true,selection:{instanceUid:"joiner-source",abilityId:"joiner-source:0",costSelections:{reveal:["hand-grade3"]}}};assert.deepEqual(validateAbilityDecision(state,{...base,actionId:"valid-reveal"},"joiner",pending),{ok:true});assert.equal(validateAbilityDecision(state,{...base,actionId:"missing-reveal",selection:{...base.selection,costSelections:{}}},"joiner",pending).reason,"invalid-cost-selection");assert.equal(validateAbilityDecision(state,{...base,actionId:"duplicate-reveal",selection:{...base.selection,costSelections:{reveal:["hand-grade3","hand-grade3"]}}},"joiner",pending).reason,"invalid-cost-selection");assert.equal(validateAbilityDecision(state,{...base,actionId:"forged-reveal",selection:{...base.selection,costSelections:{reveal:["hand-grade3"],sb:["soul-card"]}}},"joiner",pending).reason,"invalid-cost-selection");assert.equal(validateAbilityDecision(state,{...base,actionId:"opponent-reveal",selection:{...base.selection,costSelections:{reveal:["host-hand-card"]}}},"joiner",pending).reason,"cost-card-unavailable");
});
test("paid placed-unit retire AUTO uses the exact VC or RC source, clan condition, and grade-filtered target",()=>{
 const text="AUTO: [Counter Blast 2] When this unit is placed on VC or RC, if you have a «Dark Irregulars» vanguard, you may pay the cost. If you do, choose one of your opponent’s grade 2 or less rear-guards, and retire it.",ability=parseCardAbilities({id:"paid-placement-retire",text})[0];assert.equal(ability.definition.source.patternId,"auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1");assert.equal(ability.canDecline,true);assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.costs,[{type:"counter-blast",count:2}]);assert.deepEqual(ability.trigger.circles,["vanguard","rear-guard"]);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-has-clan",value:"Dark Irregulars"}]);assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Dark Irregulars"}),true);assert.equal(evaluateAbilityConditions(ability,{vanguardClan:"Kagero"}),false);
 const event=createGameEvent({matchId:"paid-placement-retire"},{type:"card.placed",actingPlayerId:"p1",sourceCardInstanceId:"source",subjectCardInstanceId:"source",previousLocation:"hand",currentLocation:"rear-left",circle:"rear-guard"});assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"source","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event,"other","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",{...event,circle:"vanguard",currentLocation:"vanguard"},"source","vanguard","vanguard","p1"),true);
});
test("paid placement retire validates the selected opposing Rear-Guard and pays Counter-Blast atomically",()=>{
 const ability=parseCardAbilities({id:"paid-placement-retire-resolution",text:"AUTO: [Counter Blast 2] When this unit is placed on VC, you may pay the cost. If you do, choose one of your opponent’s grade 2 or less rear-guards, and retire it."})[0],source={uid:"source"},d1={uid:"d1",faceDown:false},d2={uid:"d2",faceDown:false},target={uid:"opponent-grade2"},player={playerId:"p1",vanguard:source,rear:[source],damage:[d1,d2],soul:[],hand:[],drop:[]},opponent={playerId:"p2",rear:[target],drop:[]},events=[],definitions={"target":{grade:2,type:"Unit"}};const context={player,source,side:"human",sourceZone:"vanguard",sourceInPlay:true,sourceControllerPlayerId:"p1",target,targetSide:"bot",targetPlayer:opponent,targetInPlay:true,targetZone:"rear-left",targetControllerPlayerId:"p2",opponentPlayerId:"p2",targetCard:definitions.target,match:{players:{human:player,bot:opponent}},cardDefinitionForInstance:card=>definitions[card.cardId]||card.cardId==="retired"?definitions.target:null,turnId:1,actorPlayerId:"p1",emitEvent:event=>events.push(event)};
 const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context,draft=>payAbilityCosts(ability,{...draft,sourceZone:"vanguard",side:"human",turnId:1,actorPlayerId:"p1"},{cb:[d1.uid,d2.uid]}).ok);assert.equal(result.ok,true);assert.equal(d1.faceDown,true);assert.equal(d2.faceDown,true);assert.deepEqual(opponent.rear,[null]);assert.deepEqual(opponent.drop.map(card=>card.uid),[target.uid]);assert.deepEqual(events.map(event=>event.type),["card.retired"]);
 const badTarget={uid:"grade3",cardId:"grade3"},badPlayer={playerId:"p1",vanguard:{uid:"source-bad"},rear:[],damage:[{uid:"bad-d1",faceDown:false},{uid:"bad-d2",faceDown:false}],soul:[],hand:[],drop:[]},badOpp={playerId:"p2",rear:[badTarget],drop:[]};const rejected=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,player:badPlayer,source:badPlayer.vanguard,target:badTarget,targetPlayer:badOpp,targetCard:{grade:3,type:"Unit"},match:{players:{human:badPlayer,bot:badOpp}},targetInPlay:true},draft=>payAbilityCosts(ability,{...draft,sourceZone:"vanguard",side:"human",turnId:2,actorPlayerId:"p1"},{cb:["bad-d1","bad-d2"]}).ok);assert.equal(rejected.ok,false);assert.deepEqual(badPlayer.damage.map(card=>card.faceDown),[false,false]);assert.equal(badOpp.rear[0].uid,badTarget.uid);assert.equal(badOpp.drop.length,0);
});

test("ACT Rest source front-row power targets only a different friendly front-row unit",()=>{
  const ability=parseCardAbilities({id:"front-row-rest-test",text:"ACT [RC]: [Rest this unit] Choose one of your other units in the front row, and it gets power +2000 until end of turn."})[0];
  assert.equal(ability.definition?.source?.patternId,"act-rest-source-front-row-ally-power-v1");
  assert.deepEqual(ability.costs,[{type:"rest-source",count:1}]);assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.equal(ability.costStatus,"supported-cost");
  const source={uid:"booster",rested:false,controllerPlayerId:"p1"},target={uid:"front-unit",controllerPlayerId:"p1",turnPowerBoost:0},player={playerId:"p1",damage:[],soul:[],hand:[],drop:[],rear:[source,target]};
  const payment=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"rear-left"});assert.equal(payment.ok,true);assert.equal(source.rested,true);
  const context={source,sourceInPlay:true,side:"human",player,match:{},target,targetInPlay:true,sourceControllerPlayerId:"p1",targetControllerPlayerId:"p1",targetCard:{type:"Normal Unit"},targetZone:"rear-left"};
  assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(target.turnPowerBoost,2000);
  const invalid={...context,target:{uid:"back-row",controllerPlayerId:"p1",turnPowerBoost:0},targetZone:"rear-back-center"};
  assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,{...invalid,targetCard:{type:"Normal Unit"}}),false);assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,invalid).ok,false);assert.equal(invalid.target.turnPowerBoost,0);
  assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,{...context,target:source,targetZone:"rear-left"}),false);
  assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,{...context,targetControllerPlayerId:"p2",targetZone:"rear-right"}),false);
});

test("ACT Rest source clan-unit power compiles the four real clan variants and enforces the chosen unit's clan",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
  const ids=new Set(["cfa-133:0","cfa-1535:0","cfa-1654:0","cfa-1748:0"]),abilities=[];
  for(const card of loadCatalog())for(const ability of parseCardAbilities(card))if(ids.has(ability.id))abilities.push(ability);
  assert.equal(abilities.length,4);
  const clans=new Map([["cfa-133:0","Nova Grappler"],["cfa-1535:0","Gold Paladin"],["cfa-1654:0","Aqua Force"],["cfa-1748:0","Narukami"]]);
  for(const ability of abilities){
    const clan=clans.get(ability.id);
    assert.equal(ability.definition?.source?.patternId,"act-rest-source-other-clan-unit-power-v1");
    assert.equal(ability.definition.effects[0].amount,2000);
    assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"source-controller",cardType:"unit",excludeSource:true,clan});
    assert.deepEqual(ability.costs,[{type:"rest-source",count:1}]);
    const source={uid:`source-${clan}`,rested:false,controllerPlayerId:"p1"};
    const sameClan={uid:`ally-${clan}`,controllerPlayerId:"p1",turnPowerBoost:0};
    const player={playerId:"p1",vanguard:sameClan,rear:[source],damage:[],soul:[],hand:[],drop:[]};
    const paid=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"rear-left"});
    assert.equal(paid.ok,true,ability.id);
    const context={source,sourceInPlay:true,side:"human",player,match:{},target:sameClan,targetInPlay:true,sourceControllerPlayerId:"p1",targetControllerPlayerId:"p1",targetCard:{type:"Normal Unit",clan},targetZone:"vanguard"};
    assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true,ability.id);
    assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,context).ok,true,ability.id);
    assert.equal(sameClan.turnPowerBoost,2000,ability.id);
    const wrongClan={...context,target:{uid:`wrong-${clan}`,controllerPlayerId:"p1",turnPowerBoost:0},targetCard:{type:"Normal Unit",clan:"Other Clan"}};
    assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,wrongClan),false,ability.id);
    assert.equal(validateEffectProgram(ability.effects,EFFECT_HANDLERS,wrongClan).ok,false,ability.id);
    assert.equal(wrongClan.target.turnPowerBoost,0,ability.id);
    assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,{...context,target:source}),false,ability.id);
    assert.equal(matchesTargetFilter(ability.effects[0].targetFilter,{...context,targetControllerPlayerId:"p2"}),false,ability.id);
  }
});

test("Counter-Blast ACT wording During this turn uses the same exact source-power effect",()=>{
  const ability=parseCardAbilities({id:"act-during-turn-test",text:"ACT [VC/RC]: [Counter Blast 1] During this turn, this unit gets power +1000."})[0];
  assert.equal(ability.definition?.source?.patternId,"act-counter-blast-source-power-during-turn-v1");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.deepEqual(ability.definition.effects,[{op:"modify-power",target:"source",amount:1000,duration:"turn"}]);
  const source={uid:"source",turnPowerBoost:0},damage=[{uid:"damage-1",faceDown:false}],player={playerId:"p1",damage,soul:[],hand:[],drop:[],rear:[source]};
  assert.equal(canPayAbilityCosts(ability,{faceUpDamage:0}),false);
  const unpaid=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"rear-left"},{cb:[]});assert.equal(unpaid.ok,false);assert.equal(damage[0].faceDown,false);assert.equal(source.turnPowerBoost,0);
  const paid=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"rear-left"},{cb:["damage-1"]});assert.equal(paid.ok,true);assert.equal(damage[0].faceDown,true);
  const context={source,sourceInPlay:true,side:"human",match:{}};assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(source.turnPowerBoost,1000);
});

test("source-to-Soul ACT with that unit wording pays its source and buffs only a legal friendly target",()=>{
  const ability=parseCardAbilities({id:"act-soul-buff-wording",text:"ACT [RC]: [Put this unit into your soul] Choose one of your units, and that unit gets power +3000 until end of turn."})[0];
  assert.equal(ability.definition?.source?.patternId,"act-source-to-soul-choose-friendly-power-turn-v1");assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);
  const source={uid:"source-copy",controllerPlayerId:"p1"},target={uid:"target-copy",controllerPlayerId:"p1",turnPowerBoost:0},player={playerId:"p1",vanguard:null,damage:[],soul:[],hand:[],drop:[],rear:[source,target]};
  const payment=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"rear-left"});assert.equal(payment.ok,true);assert.equal(player.rear[0],null);assert.deepEqual(player.soul,[source]);
  const context={source,sourceInPlay:false,side:"human",player,match:{},target,targetInPlay:true,sourceControllerPlayerId:"p1",targetControllerPlayerId:"p1",targetCard:{type:"Normal Unit"},targetZone:"rear-right"};
  assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(target.turnPowerBoost,3000);
  const illegal={...context,target:{uid:"other-source",turnPowerBoost:0},targetControllerPlayerId:"p2"};assert.equal(validateEffectProgram(ability.definition.effects,EFFECT_HANDLERS,illegal).ok,false);assert.equal(illegal.target.turnPowerBoost,0);
});

test("once-per-turn same-name search ACT validates CB, source name, reveal, optional search, and power order",()=>{
  const ability=parseCardAbilities({id:"same-name-search-test",text:"ACT [VC] 1/Turn: COST [Counter Blast 1], search your deck for up to one card with the same card name as this unit, reveal it and put it into hand, shuffle the deck, and this unit gets power +10000 until end of turn."})[0];
  assert.equal(ability.definition?.source?.patternId,"act-counter-blast-same-name-search-power-v1");assert.equal(ability.once,true);assert.equal(ability.choiceStatus,"modeled");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);
  const source={uid:"leader",cardId:"same",turnPowerBoost:0},copy={uid:"copy",cardId:"same"},wrong={uid:"other-name",cardId:"different"},damageCard={uid:"damage",faceDown:false};let shuffles=0;const revealed=[];
  const player={playerId:"p1",vanguard:source,rear:[],damage:[damageCard],soul:[],hand:[],drop:[],deck:[wrong,copy],usedAbilities:[]};
  const context={source,player,side:"human",sourceInPlay:true,match:{turn:4},cardDefinitionForInstance:card=>({same:{name:"Leader"},different:{name:"Other"}}[card.cardId]),shuffleDeck:deck=>{shuffles++;deck.reverse()},effectUid:copy.uid,emitEvent:event=>revealed.push(event)};
  const pay=(draft,turn,cb)=>payAbilityCosts(ability,{...draft,turnId:turn,actorPlayerId:"p1",side:"human",sourceZone:"vanguard",cardDefinitionForInstance:context.cardDefinitionForInstance},{cb,sb:[],discard:[],reveal:[]}).ok; const resolveWith=(effectUid,cb)=>resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,effectUid},draft=>pay(draft,4,cb));
  const result=resolveWith(copy.uid,[damageCard.uid]);assert.equal(result.ok,true);assert.equal(damageCard.faceDown,true);assert.ok(player.hand.some(card=>card.uid===copy.uid));assert.ok(player.deck.some(card=>card.uid===wrong.uid));assert.equal(source.turnPowerBoost,10000);assert.equal(shuffles,1);assert.equal(revealed.some(event=>event.type==="card.revealed"&&event.cardInstanceId===copy.uid),true);assert.equal(player.usedAbilities.length,1);
  const secondDamage={uid:"damage-2",faceDown:false};player.damage.push(secondDamage);const second=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"vanguard",turnId:4,actorPlayerId:"p1"},{cb:[secondDamage.uid],sb:[],discard:[],reveal:[]});assert.equal(second.ok,false);assert.equal(secondDamage.faceDown,false);
  const noSearchSource={uid:"leader-2",cardId:"same",turnPowerBoost:0},noSearchPlayer={...player,vanguard:noSearchSource,damage:[{uid:"damage-3",faceDown:false}],hand:[],deck:[wrong],usedAbilities:[]};const noSearch=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,source:noSearchSource,player:noSearchPlayer,effectUid:null},draft=>pay(draft,5,["damage-3"]));assert.equal(noSearch.ok,true);assert.equal(noSearchPlayer.hand.length,0);assert.equal(noSearchSource.turnPowerBoost,10000);
  const invalidSource={uid:"leader-3",cardId:"same",turnPowerBoost:0},invalidDamage={uid:"damage-4",faceDown:false},invalidPlayer={playerId:"p1",vanguard:invalidSource,rear:[],damage:[invalidDamage],soul:[],hand:[],drop:[],deck:[wrong],usedAbilities:[]};const invalid=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,source:invalidSource,player:invalidPlayer,effectUid:wrong.uid},draft=>pay(draft,6,[invalidDamage.uid]));assert.equal(invalid.ok,false);assert.equal(invalidDamage.faceDown,false);assert.equal(invalidSource.turnPowerBoost,0);assert.equal(invalidPlayer.usedAbilities.length,0);
});

test("named-Soul CONT power uses the exact card name, controller Soul, and printed circle",()=>{
  const ability=parseCardAbilities({id:"named-soul-cont-test",text:'CONT [VC]: If you have a card named "Fullbau" in your soul, this unit gets power +2000.'})[0];
  assert.equal(ability.definition?.source?.patternId,"cont-named-soul-card-power-v1");
  assert.deepEqual(ability.requiredLocation,["vanguard"]);
  assert.equal(isManuallyActivatable(ability),false);
  assert.equal(evaluateContinuousEffects([ability],{location:"vanguard",soulCardNames:["Fullbau"]}).power,2000);
  assert.equal(evaluateContinuousEffects([ability],{location:"vanguard",soulCardNames:["Blaster Javelin"]}).power,0);
  assert.equal(evaluateContinuousEffects([ability],{location:"rear-guard",soulCardNames:["Fullbau"]}).power,0);
  assert.equal(evaluateContinuousEffects([ability],{location:"vanguard",soulCardNames:[]}).power,0);
  const turnLimited=parseCardAbilities({id:"named-soul-cont-own-turn",text:'CONT [VC/RC]: During your turn, if you have a card named "Crimson Beast Tamer" in your soul, this unit gets power +3000.'})[0];
  assert.equal(turnLimited.definition?.effects[0].condition.controllerTurn,true);
  assert.equal(evaluateContinuousEffects([turnLimited],{location:"rear-guard",soulCardNames:["Crimson Beast Tamer"],isControllerTurn:false}).power,0);
  assert.equal(evaluateContinuousEffects([turnLimited],{location:"rear-guard",soulCardNames:["Crimson Beast Tamer"],isControllerTurn:true}).power,3000);
});

test("named-Soul ACT is unavailable without its exact Soul condition and resolves CB power plus critical",()=>{
  const ability=parseCardAbilities({id:"named-soul-act-test",text:'ACT [VC]: [Counter Blast 2] If you have a card named "Blaster Blade" in your soul, this unit gets power +5000 / critical +1 until end of turn.'})[0];
  assert.equal(ability.definition?.source?.patternId,"act-counter-blast-named-soul-power-critical-turn-v1");
  assert.deepEqual(ability.costs,[{type:"counter-blast",count:2}]);
  assert.equal(ability.conditionStatus,"modeled");
  const source={uid:"vanguard-copy",turnPowerBoost:0,turnCriticalBoost:0},damage=[{uid:"cb-1",faceDown:false},{uid:"cb-2",faceDown:false}],player={playerId:"p1",vanguard:source,damage,soul:[],hand:[],drop:[],rear:[]};
  assert.equal(evaluateAbilityConditions(ability,{controllerSoulCardNames:[]}),false);
  assert.equal(evaluateAbilityConditions(ability,{controllerSoulCardNames:["Blaster Javelin"]}),false);
  assert.equal(evaluateAbilityConditions(ability,{controllerSoulCardNames:["Blaster Blade"]}),true);
  const paid=payAbilityCosts(ability,{player,source,side:"human",sourceZone:"vanguard"},{cb:["cb-1","cb-2"],sb:[],discard:[],reveal:[]});assert.equal(paid.ok,true);
  const resolved=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"human",player,match:{}});assert.equal(resolved.ok,true);
  assert.equal(source.turnPowerBoost,5000);assert.equal(source.turnCriticalBoost,1);assert.equal(damage.every(card=>card.faceDown),true);
});

test("empty-Soul attack AUTO requires this exact attacker and every printed condition",()=>{
  const plain=parseCardAbilities({id:"empty-soul-attacker",text:"AUTO [VC/RC]: When this unit attacks, if you do not have any cards in your soul, this unit gets power +3000 until end of that battle."})[0];
  const clan=parseCardAbilities({id:"empty-soul-clan-attacker",text:"AUTO [RC]: When this unit attacks, if you have an «Oracle Think Tank» vanguard, if you do not have any cards in your soul, this unit gets power +3000 until end of that battle."})[0];
  const attack={type:"unit.attacked",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",subjectControllerPlayerId:"p1",subjectZone:"rear-left"};
  assert.equal(plain.definition?.source?.patternId,"auto-own-attack-empty-soul-power-battle-v1");assert.equal(eventMatchesAbilityTrigger(plain,"attack",attack,"attacker","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(plain,"attack",attack,"different-card","rear-right","rear-left","p1"),false);
  assert.equal(clan.conditionStatus,"modeled");assert.equal(evaluateAbilityConditions(clan,{controllerSoulCount:0,vanguardClan:"Oracle Think Tank"}),true);assert.equal(evaluateAbilityConditions(clan,{controllerSoulCount:1,vanguardClan:"Oracle Think Tank"}),false);assert.equal(evaluateAbilityConditions(clan,{controllerSoulCount:0,vanguardClan:"Kagero"}),false);
  const source={uid:"attacker",turnPowerBoost:0},match={pendingAttack:{attackerUid:"attacker",power:10000}};const resolved=resolveEffectProgram(plain.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"human",match});assert.equal(resolved.ok,true);assert.equal(match.pendingAttack.power,13000);
});

test("own-attack hand conditions enforce lower, minimum, higher, and printed Generation Break",()=>{
  const lower=parseCardAbilities({id:"hand-lower-attack",text:"AUTO [VC/RC]: When this unit attacks, if the number of cards in your hand is less than your opponent’s, this unit gets power +3000 until end of that battle."})[0];
  const minimum=parseCardAbilities({id:"hand-min-attack",text:"AUTO [VC/RC]: When this unit attacks, if the number of cards in your hand is four or greater, this unit gets power +3000 until end of that battle."})[0];
  const higher=parseCardAbilities({id:"hand-higher-attack",text:"AUTO [RC] Generation Break 1: When this unit attacks a vanguard, if the number of cards in your hand is greater than your opponent’s, this unit gets power +3000 until end of that battle."})[0];
  const crit=parseCardAbilities({id:"hand-lower-crit",text:"AUTO [VC] Generation Break 2: When this unit attacks, if the number of cards in your hand is less than your opponent’s, this unit gets power +5000 / critical +1 until end of that battle."})[0];
  assert.equal(lower.definition?.source?.patternId,"auto-own-attack-hand-condition-power-battle-v1");
  assert.equal(evaluateAbilityConditions(lower,{controllerHandCount:2,opponentHandCount:3}),true);assert.equal(evaluateAbilityConditions(lower,{controllerHandCount:3,opponentHandCount:3}),false);
  assert.equal(evaluateAbilityConditions(minimum,{controllerHandCount:3}),false);assert.equal(evaluateAbilityConditions(minimum,{controllerHandCount:4}),true);
  assert.equal(evaluateAbilityConditions(higher,{controllerHandCount:4,opponentHandCount:3,generationBreakCount:0}),false);assert.equal(evaluateAbilityConditions(higher,{controllerHandCount:4,opponentHandCount:3,generationBreakCount:1}),true);assert.equal(evaluateAbilityConditions(higher,{controllerHandCount:2,opponentHandCount:3,generationBreakCount:1}),false);
  assert.equal(evaluateAbilityConditions(crit,{controllerHandCount:1,opponentHandCount:2,generationBreakCount:1}),false);assert.equal(evaluateAbilityConditions(crit,{controllerHandCount:1,opponentHandCount:2,generationBreakCount:2}),true);
  const attack={type:"unit.attacked",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",subjectControllerPlayerId:"p1",subjectZone:"rear-left",targetLocation:"vanguard"};assert.equal(eventMatchesAbilityTrigger(higher,"attack",attack,"attacker","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(higher,"attack",{...attack,targetLocation:"rear-guard"},"attacker","rear-left","rear-left","p1"),false);
  const source={uid:"attacker",turnCriticalBoost:0},match={pendingAttack:{attackerUid:"attacker",power:12000,critical:1}};const resolved=resolveEffectProgram(crit.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,side:"human",match});assert.equal(resolved.ok,true);assert.equal(match.pendingAttack.power,17000);assert.equal(match.pendingAttack.critical,2);
});

test("Counter-Blast unlock ACT requires and unlocks one exact friendly locked field instance",()=>{
  const ability=parseCardAbilities({id:"unlock-ability-test",text:"ACT [VC]: [Counter Blast 1] Choose one of your locked cards, and unlock it."})[0];
  assert.equal(ability.definition?.source?.patternId,"act-vanguard-counter-blast-unlock-friendly-locked-v1");assert.equal(ability.costStatus,"supported-cost");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.deepEqual(ability.requiredLocation,["vanguard"]);
  const source={uid:"unlock-source",controllerPlayerId:"p1"},target={uid:"locked-copy",controllerPlayerId:"p1",locked:true},damage={uid:"cb",faceDown:false};const player={playerId:"p1",vanguard:source,rear:[target],damage:[damage],soul:[],hand:[],drop:[]},events=[];
  const context={source,player,side:"human",sourceInPlay:true,match:{},target,targetInPlay:true,targetPlayer:player,targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",targetSide:"human",targetZone:"rear-left",targetCard:{type:"Normal Unit"},emitEvent:event=>events.push(event)};
  assert.equal(matchesTargetFilter(ability.definition.effects[0].targetFilter,context),true);assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(target.locked,false);assert.deepEqual(events,[{type:"unit.unlocked",cardInstanceId:"locked-copy",controllerSide:"human",zone:"rear-left"}]);
  const alreadyOpen={...context,target:{uid:"open",locked:false}};assert.equal(validateEffectProgram(ability.definition.effects,EFFECT_HANDLERS,alreadyOpen).ok,false);
  const enemy={...context,target:{uid:"enemy-lock",locked:true},targetControllerPlayerId:"p2",targetSide:"bot"};assert.equal(validateEffectProgram(ability.definition.effects,EFFECT_HANDLERS,enemy).ok,false);assert.equal(enemy.target.locked,true);
  const staleSource={uid:"stale-source"},staleTarget={uid:"stale-target",locked:false},staleDamage={uid:"stale-cb",faceDown:false},stalePlayer={playerId:"p1",vanguard:staleSource,rear:[staleTarget],damage:[staleDamage],soul:[],hand:[],drop:[]},staleContext={...context,source:staleSource,player:stalePlayer,target:staleTarget,targetPlayer:stalePlayer,targetInPlay:true,targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",targetZone:"rear-left"};const staleResult=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,staleContext,draft=>payAbilityCosts(ability,{...draft,sourceZone:"vanguard",side:"human"},{cb:[staleDamage.uid],sb:[],discard:[],reveal:[]}).ok);assert.equal(staleResult.ok,false);assert.equal(staleDamage.faceDown,false);assert.equal(staleTarget.locked,false);
  assert.ok(GAME_EVENT_TYPES.includes("unit.unlocked"));
});

test("Waveflow Dragon drive-check AUTO requires its exact source and a friendly Rear-Guard target",()=>{
 const ability=parseCardAbilities({id:"cfa-7087",name:"Waveflow Dragon",text:"Aqua Force/Tear Dragon\n\nAUTO [RC]: When your drive check reveals a normal unit, COST [put this card into your soul], and one of your rear-guards gets power +5000 until end of turn."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-rc-drive-check-normal-unit-source-soul-rearguard-power-v1");assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"source-controller",zone:"rear-guard",cardType:"unit",excludeSource:true});
 const event=createGameEvent({matchId:"waveflow"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"vanguard",sourceControllerPlayerId:"p1",subjectCardInstanceId:"normal-check",subjectControllerPlayerId:"p1",checkedCardInstanceId:"normal-check",checkedCardTriggerType:"",checkKind:"drive",checkSourceLocation:"vanguard"});assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",event,"waveflow-copy","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...event,checkedCardTriggerType:"critical"},"waveflow-copy","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...event,actingPlayerId:"p2"},"waveflow-copy","rear-left","rear-left","p1"),false);
 const source={uid:"waveflow-copy",controllerPlayerId:"p1"},target={uid:"friendly-rear",controllerPlayerId:"p1",turnPowerBoost:0},opponent={uid:"enemy-rear",controllerPlayerId:"p2",turnPowerBoost:0},filter=ability.definition.effects[0].targetFilter,base={source,sourceControllerPlayerId:"p1",target,targetControllerPlayerId:"p1",targetCard:{type:"Normal Unit"},targetZone:"rear-left"};assert.equal(matchesTargetFilter(filter,base),true);assert.equal(matchesTargetFilter(filter,{...base,target:source}),false);assert.equal(matchesTargetFilter(filter,{...base,target:opponent,targetControllerPlayerId:"p2"}),false);assert.equal(matchesTargetFilter(filter,{...base,targetZone:"vanguard"}),false);
});

test("Gun Trooper Klephts retires its exact source and adds drive only to the named Vanguard battle",()=>{
 const card=require("./scripts/audit-ability-catalog.js").loadCatalog().find(item=>item.id==="cfa-7132"),ability=parseCardAbilities(card)[0];assert.equal(ability.definition?.source?.patternId,"auto-rc-normal-drive-check-named-vanguard-retire-source-drive-v1");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"source-retire",count:1}]);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-name-contains",value:"Fighting Fist Dragon, God Hand Dragon",exact:true}]);assert.equal(ability.conditionStatus,"modeled");
 assert.equal(evaluateAbilityConditions(ability,{vanguardName:"Fighting Fist Dragon, God Hand Dragon"}),true);assert.equal(evaluateAbilityConditions(ability,{vanguardName:"Fighting Fist Dragon, God Hand Dragon X"}),false);const event=createGameEvent({matchId:"klephts"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"god-hand",sourceControllerPlayerId:"p1",subjectCardInstanceId:"normal-check",subjectControllerPlayerId:"p1",checkedCardInstanceId:"normal-check",checkedCardTriggerType:"",checkKind:"drive",checkSourceLocation:"vanguard"});assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",event,"klephts-copy","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...event,checkedCardTriggerType:"draw"},"klephts-copy","rear-left","rear-left","p1"),false);
 const source={uid:"klephts-copy",controllerPlayerId:"p1"},cb={uid:"cb-card",faceDown:false},vanguard={uid:"god-hand",controllerPlayerId:"p1"},attack={attackerUid:vanguard.uid,attackerZone:"vanguard",driveChecksRemaining:3,maxDriveChecks:3},player={playerId:"p1",vanguard,rear:[source],damage:[cb],soul:[],hand:[],drop:[]},events=[],context={source,player,side:"p1",sourceZone:"rear-left",sourceInPlay:true,sourceControllerPlayerId:"p1",match:{pendingAttack:attack},emitEvent:event=>events.push(event)};assert.equal(payAbilityCosts(ability,context,{cb:[cb.uid]}).ok,true);assert.deepEqual(player.rear,[null]);assert.deepEqual(player.drop,[source]);assert.equal(cb.faceDown,true);assert.deepEqual(events,[{type:"card.retired",cardInstanceId:source.uid,controllerSide:"p1",previousLocation:"rear-left",currentLocation:"drop"}]);assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,sourceInPlay:false}).ok,true);assert.equal(attack.driveChecksRemaining,4);assert.equal(attack.maxDriveChecks,4);
 const wrongAttack={attackerUid:"other",attackerZone:"rear-left",driveChecksRemaining:3,maxDriveChecks:3};assert.equal(resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{...context,match:{pendingAttack:wrongAttack}}).ok,false);assert.equal(wrongAttack.driveChecksRemaining,3);const noSource=payAbilityCosts(ability,{...context,sourceZone:"vanguard",player:{...player,vanguard:source,rear:[]}}, {cb:[]});assert.equal(noSource.ok,false);
 cb.faceDown=false;const remotePlayer={...player,playerId:"p1",rear:[source],drop:[],damage:[cb]},remoteState={matchId:"klephts-room",stateVersion:1,players:{guest:remotePlayer}},pending={instance:source,triggerControllerPlayerId:"p1",ability},request={matchId:"klephts-room",actorPlayerId:"p1",actionId:"klephts-pay",expectedStateVersion:1,accept:true,selection:{instanceUid:source.uid,abilityId:ability.id,costSelections:{cb:[cb.uid]}}};assert.deepEqual(validateAbilityDecision(remoteState,request,"p1",pending),{ok:true});assert.equal(validateAbilityDecision({...remoteState,players:{guest:{...remotePlayer,rear:[]}}},{...request,actionId:"klephts-no-source"},"p1",pending).reason,"source-not-retirable");
});

test("Cycloned requires its own Vanguard battle and an abilityless normal drive check",()=>{
 const card=require("./scripts/audit-ability-catalog.js").loadCatalog().find(item=>item.id==="cfa-7474"),ability=parseCardAbilities(card).find(item=>item.kind==="AUTO");assert.equal(ability.definition?.source?.patternId,"auto-vanguard-drive-check-abilityless-normal-stand-rearguard-v1");assert.equal(ability.trigger?.subject,"source");assert.equal(ability.trigger?.requiresBattleSourceMatch,true);assert.equal(ability.trigger?.checkedCardHasNoAbilities,true);assert.deepEqual(ability.requiredLocation,["vanguard"]);
 const event=createGameEvent({matchId:"cycloned"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"cycloned-vg",sourceControllerPlayerId:"p1",subjectCardInstanceId:"normal-card",subjectControllerPlayerId:"p1",checkedCardInstanceId:"normal-card",checkedCardText:"Nova Grappler/Battleroid",checkedCardTriggerType:"",checkKind:"drive",checkSourceLocation:"vanguard",battleId:"attack-1"});assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",event,"cycloned-vg","vanguard","hand","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",event,"other-vanguard","vanguard","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...event,battleId:null},"cycloned-vg","vanguard","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...event,checkedCardText:"Nova Grappler/Battleroid\nAUTO [RC]: When placed, draw a card."},"cycloned-vg","vanguard","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...event,checkedCardTriggerType:"critical"},"cycloned-vg","vanguard","hand","p1"),false);
 const rested={uid:"rested-ally",rested:true,turnPowerBoost:0},source={uid:"cycloned-vg"},filter=ability.definition.effects[0].targetFilter,targetContext={source,sourceControllerPlayerId:"p1",target:rested,targetControllerPlayerId:"p1",targetCard:{type:"Normal Unit"},targetZone:"rear-left"};assert.equal(matchesTargetFilter(filter,targetContext),true);assert.equal(matchesTargetFilter(filter,{...targetContext,targetControllerPlayerId:"p2"}),false);const player={playerId:"p1",vanguard:source,rear:[rested],hand:[],deck:[],soul:[],drop:[]},result=resolveEffectProgram(ability.effects,EFFECT_HANDLERS,{source,player,side:"p1",target:rested,targetInPlay:true,targetSide:"human",targetZone:"rear-left",sourceControllerPlayerId:"p1",targetControllerPlayerId:"p1",targetCard:{type:"Normal Unit"},match:{},emitEvent:()=>{}});assert.equal(result.ok,true);assert.equal(rested.rested,false);
});

test("Cycloned CONT applies its face-up turn bonus only to friendly abilityless field units",()=>{
 const card=require("./scripts/audit-ability-catalog.js").loadCatalog().find(item=>item.id==="cfa-7474"),ability=parseCardAbilities(card)[0],engineContext={isControllerTurn:true,sourceFaceUp:true,targetHasNoAbilities:true};assert.equal(ability.definition?.source?.patternId,"cont-vc-gzone-abilityless-controller-units-power-v1");assert.deepEqual(ability.requiredLocation,["vanguard","g-zone"]);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.conditions,[{type:"controller-turn"},{type:"source-face-up"}]);
 assert.equal(evaluateContinuousEffects([ability],{...engineContext,sourceLocation:"vanguard"}).power,5000);assert.equal(evaluateContinuousEffects([ability],{...engineContext,sourceLocation:"g-zone"}).power,5000);assert.equal(evaluateContinuousEffects([ability],{...engineContext,sourceLocation:"g-zone",sourceFaceUp:false}).power,0);assert.equal(evaluateContinuousEffects([ability],{...engineContext,sourceLocation:"g-zone",isControllerTurn:false}).power,0);assert.equal(evaluateContinuousEffects([ability],{...engineContext,sourceLocation:"g-zone",targetHasNoAbilities:false}).power,0);assert.equal(evaluateContinuousEffects([ability],{...engineContext,sourceLocation:"hand"}).power,0);
 const app=fs.readFileSync("app.js","utf8"),start=app.indexOf("function continuousPowerBonus("),end=app.indexOf("function renderZone(",start),source=app.slice(start,end);assert.ok(source.includes("player.gZone"));assert.ok(source.includes("cardAbilities(cardMap.get(instance.cardId)).length===0"));assert.ok(source.includes("sourceLocation:source.location"));
});

test("Dauntless Dominate Dragon locks only its exact normal drive-check card and grants battle bonuses only after placement",()=>{
  const card=require("./scripts/audit-ability-catalog.js").loadCatalog().find(item=>item.id==="cfa-9421"),abilities=parseCardAbilities(card),ability=abilities[0];
  assert.equal(ability.definition?.source?.patternId,"auto-vanguard-drive-check-normal-unit-lock-reveal-and-battle-bonus-v1");
  assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.equal(abilities[1].definition,null);
  const driveEvent=createGameEvent({matchId:"ddr-room"},{type:"drive.checked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"dd-vanguard",sourceControllerPlayerId:"p1",subjectCardInstanceId:"checked-normal",subjectControllerPlayerId:"p1",checkedCardInstanceId:"checked-normal",checkedCardTriggerType:"",checkKind:"drive",checkSourceLocation:"vanguard"});
  assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",driveEvent,"dd-vanguard","vanguard","hand","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...driveEvent,actingPlayerId:"p2"},"dd-vanguard","vanguard","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",{...driveEvent,checkedCardInstanceId:"another-card"},"dd-vanguard","vanguard","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"driveCheck",driveEvent,"dd-vanguard","rear-left","hand","p1"),false);
  const checked={uid:"checked-normal",cardId:"normal",locked:false},displaced={uid:"old-rear",cardId:"unit"},source={uid:"dd-vanguard",cardId:"cfa-9421"},cb={uid:"cb",faceDown:false},attack={attackerUid:source.uid,attackerZone:"vanguard",driveChecksRemaining:1,maxDriveChecks:1,power:13000};
  const player={playerId:"p1",vanguard:source,rear:[displaced,null,null,null,null],hand:[checked],drop:[],damage:[cb],soul:[]},events=[];
  const context={source,player,side:"human",sourceZone:"vanguard",sourceInPlay:true,checkedCard:checked,checkedCardInstanceId:checked.uid,callZone:"rear-left",match:{pendingAttack:attack},emitEvent:event=>events.push(event)};
  const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context,draft=>payAbilityCosts(ability,{...draft,turnId:4,actorPlayerId:"p1",side:"human",sourceZone:"vanguard"},{cb:[cb.uid],sb:[],discard:[],reveal:[]}).ok);
  assert.equal(result.ok,true);assert.equal(player.hand.length,0);assert.equal(player.rear[0].uid,checked.uid);assert.equal(player.rear[0].locked,true);assert.equal(player.rear[1],null);assert.deepEqual(player.drop,[displaced]);
  assert.equal(cb.faceDown,true);assert.equal(attack.power,23000);assert.equal(attack.driveChecksRemaining,2);assert.equal(attack.maxDriveChecks,2);
  assert.deepEqual(events.map(event=>[event.type,event.cardInstanceId]),[["card.retired",displaced.uid],["card.placed",checked.uid],["characteristic.changed",source.uid]]);
  const cb2={uid:"cb-2",faceDown:false},noSpacePlayer={...player,rear:Array.from({length:5},(_,index)=>({uid:`lock-${index}`,locked:true})),hand:[{...checked}],damage:[cb2]},noSpaceAttack={attackerUid:source.uid,attackerZone:"vanguard",driveChecksRemaining:1,maxDriveChecks:1,power:13000};
  const noSpace=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,player:noSpacePlayer,checkedCard:noSpacePlayer.hand[0],checkedCardInstanceId:noSpacePlayer.hand[0].uid,callZone:null,match:{pendingAttack:noSpaceAttack}},draft=>payAbilityCosts(ability,{...draft,turnId:4,actorPlayerId:"p1",side:"human",sourceZone:"vanguard"},{cb:[cb2.uid],sb:[],discard:[],reveal:[]}).ok);
  assert.equal(noSpace.ok,true);assert.equal(noSpace.results[0],0);assert.equal(noSpaceAttack.power,13000);assert.equal(noSpaceAttack.driveChecksRemaining,1);
  const invalid=validateEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,checkedCardInstanceId:"different-card"});assert.equal(invalid.ok,false);
  const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("lockedCallStep=x.ability.definition"));assert.ok(app.includes("event.position!==\"locked\""));
});

test("the site cache-busts every changed engine script bundle",()=>{
  const html=fs.readFileSync("index.html","utf8");
  assert.match(html,/ability-engine\.js\?v=20261028-gc-race-protect-1/);assert.match(html,/app\.js\?v=20261028-bot-prompt-recovery-1/);assert.match(html,/ability-definitions\.js\?v=20261028-clan-hand-soul-1/);assert.match(html,/practice-bot\.js\?v=20261028-ability-batch-v1/);
});

test("ride-phase discard AUTO calls only its exact source from Drop to a legal rested circle",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),catalog=loadCatalog(),card=catalog.find(item=>item.id==="cfa-12264"),ability=parseCardAbilities(card)[0];
  assert.equal(ability.definition?.source?.patternId,"auto-ride-phase-discard-source-call-rested-v1");assert.equal(ability.canDecline,true);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"card.discarded",subject:"source",circles:[],destinationLocation:"drop",sourceLocation:"hand",excludeSourceAsSubject:false,requiredPhase:"ride"});
  const event=createGameEvent({matchId:"ride-discard-room"},{type:"card.discarded",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"ride-discard-source",sourceControllerPlayerId:"p1",subjectCardInstanceId:"ride-discard-source",previousLocation:"hand",currentLocation:"drop",phase:"ride"});
  assert.equal(eventMatchesAbilityTrigger(ability,"discard",event,"ride-discard-source","hand","hand","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,sourceCardInstanceId:"other-card",subjectCardInstanceId:"other-card"},"ride-discard-source","hand","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,phase:"main"},"ride-discard-source","hand","hand","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"discard",{...event,previousLocation:"soul"},"ride-discard-source","hand","hand","p1"),false);
  const source={uid:"ride-discard-source",cardId:card.id,rested:false},displaced={uid:"occupied-circle",cardId:"occupied"},player={playerId:"p1",drop:[source],rear:[displaced,null,null,null,null],hand:[]},events=[];
  const resolved=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,player,side:"human",sourceZone:"hand",sourceInPlay:false,callZone:"rear-left",cardDefinitionForInstance:instance=>({type:instance.cardId==="occupied"?"Normal Unit":"Normal Unit"}),emitEvent:event=>events.push(event)});
  assert.equal(resolved.ok,true);assert.deepEqual(player.drop,[displaced]);assert.equal(player.rear[0].uid,source.uid);assert.equal(player.rear[0].rested,true);assert.deepEqual(events.map(item=>[item.type,item.cardInstanceId]),[["card.retired",displaced.uid],["card.placed",source.uid]]);
  const lockedPlayer={playerId:"p1",drop:[{...source}],rear:Array.from({length:5},(_,index)=>({uid:`locked-${index}`,locked:true})),hand:[]},noCircle=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source:lockedPlayer.drop[0],player:lockedPlayer,side:"human",sourceZone:"hand",cardDefinitionForInstance:()=>({type:"Normal Unit"})});assert.equal(noCircle.ok,true);assert.equal(noCircle.results[0],0);assert.equal(lockedPlayer.drop[0].uid,source.uid);
  const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("dropRestCallStep="));assert.ok(app.includes("event.position!==\"locked\""));
});

test("zone-unspecified CONT card-name aliases apply in all zones and participate in name matching",()=>{
 const card={id:"alias-source",name:"New Unit",text:'CONT: This card is also regarded as "Legacy Unit".'},parsed=parseCardAbilities(card),ability=parsed[0],unit={type:"Normal Unit",name:"New Unit",text:card.text};
 assert.equal(ability.kind,"CONT");assert.equal(ability.definition.source.patternId,"cont-card-name-alias-v1");assert.deepEqual(ability.definition.keywords,[{name:"card-name-alias",value:"Legacy Unit"}]);assert.deepEqual(ability.requiredLocation,[]);assert.deepEqual(getCardNames(card),["New Unit","Legacy Unit"]);
 assert.equal(cardHasName(unit,"Legacy Unit"),true);assert.equal(cardHasName(unit,"legacy",{contains:true}),true);assert.equal(matchesTargetFilter({cardName:"Legacy Unit"},{targetCard:unit}),true);assert.equal(matchesTargetFilter({cardNameContains:"Legacy"},{targetCard:unit}),true);
 assert.equal(cardsShareName(card,{name:"Legacy Unit"}),true);assert.equal(cardsShareName(card,{name:"Different Unit"}),false);
 assert.equal(evaluateAbilityConditions({conditions:[{type:"controller-vanguard-name-contains",value:"Legacy Unit",exact:true}],raw:""},{vanguardNames:getCardNames(card)}),true);
 assert.equal(parseCardAbilities({id:"scoped-alias",text:'CONT [RC]: This card is also regarded as "Legacy Unit".'})[0].definition,null);
 const selected={uid:"selected",cardId:"legacy"},source={uid:"source",cardId:"new"},context={player:{deck:[selected],hand:[]},source,effectUid:selected.uid,cardDefinitionForInstance:instance=>instance.cardId==="new"?card:{name:"Legacy Unit"},shuffleDeck(){}};
 assert.equal(EFFECT_HANDLERS["search-deck-same-name-to-hand"].validate({target:"controller",maximum:1},context),true);
});

test("filtered top-five search validates keyword targets and resolves the exact selected card",()=>{
 const sourceCard={id:"filter-search-source",name:"Search Vanguard",text:"AUTO: [Counter Blast 1 & Soul Blast 1] When this unit is placed on VC, you may pay the cost. If you do, look at five cards from the top of your deck, search for up to one card with the darkness ability from among them, show it to your opponent, put it into your hand, and shuffle your deck."},ability=parseCardAbilities(sourceCard)[0];
 const targetDefinition={id:"darkness-target",name:"Darkness Unit",type:"Normal Unit",text:"Dark Irregulars/Human\n\nAUTO [VC] Generation Break 1 Darkness (This ability is active if a card was put into your soul during this turn): When this unit attacks a vanguard, it gets power +1000."},wrongDefinition={id:"ordinary-target",name:"Ordinary Unit",type:"Normal Unit",text:"Dark Irregulars/Human\n\nAUTO: When this unit is placed on RC, search for a card with the darkness ability."};
 assert.equal(ability.definition?.source?.patternId,"auto-vanguard-placement-top-five-filtered-search-hand-v1");assert.deepEqual(ability.trigger.circles,["vanguard"]);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"soul-blast",count:1}]);assert.equal(ability.choiceStatus,"modeled");assert.equal(cardHasAbilityKeyword(targetDefinition,"darkness"),true);assert.equal(cardHasAbilityKeyword(wrongDefinition,"darkness"),false);
 const source={uid:"source-instance",cardId:sourceCard.id},target={uid:"dark-target-instance",cardId:targetDefinition.id},wrong={uid:"wrong-target-instance",cardId:wrongDefinition.id},bottom={uid:"bottom-instance",cardId:wrongDefinition.id},player={playerId:"p1",hand:[],deck:[bottom,target,wrong]},definitions=new Map([[sourceCard.id,sourceCard],[target.cardId,targetDefinition],[wrong.cardId,wrongDefinition]]),events=[],context={source,player,side:"human",effectUid:target.uid,cardDefinitionForInstance:card=>definitions.get(card.cardId),shuffleDeck:deck=>deck.reverse(),emitEvent:event=>events.push(event)};
 assert.equal(matchesTargetFilter(ability.definition.effects[0].filter,{targetCard:targetDefinition}),true);assert.equal(matchesTargetFilter(ability.definition.effects[0].filter,{targetCard:wrongDefinition}),false);
 const illegal=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,effectUid:wrong.uid});assert.equal(illegal.ok,false);assert.deepEqual(player.deck.map(card=>card.uid),[bottom.uid,target.uid,wrong.uid]);assert.deepEqual(player.hand,[]);
 const paid=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context);assert.equal(paid.ok,true);assert.deepEqual(paid.results,[{revealedCardId:target.cardId,revealedCardUid:target.uid,lookedCount:3}]);assert.deepEqual(player.hand,[target]);assert.deepEqual(player.deck.map(card=>card.uid),[wrong.uid,bottom.uid]);assert.deepEqual(events,[{type:"card.revealed",cardInstanceId:target.uid,controllerSide:"human",previousLocation:"deck",currentLocation:"hand",reason:"search",revealedCardId:"darkness-target",revealedCardName:"Darkness Unit",revealedCardGrade:null}]);
 const optionalPlayer={playerId:"p1",hand:[],deck:[bottom,target,wrong]},optional=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,player:optionalPlayer,effectUid:null});assert.equal(optional.ok,true);assert.deepEqual(optionalPlayer.hand,[]);assert.deepEqual(optionalPlayer.deck.map(card=>card.uid),[wrong.uid,target.uid,bottom.uid]);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("filteredSearch=x.ability.definition"));assert.ok(app.includes("search-top-up-to-one-filtered-to-hand"));
});

test("Grade 3 search ACT requires its exact RC source, costs, and clan-filtered top-five choice",()=>{
 const card={id:"act-top-five-source",name:"Little Fighter, Cron",text:"Gold Paladin/Human\nACT [RC]: [Counter Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater «Gold Paladin» from among them, reveal it to your opponent, put it into your hand, and shuffle your deck."},ability=parseCardAbilities(card)[0];
 assert.equal(ability.definition?.source?.patternId,"act-rc-counter-blast-source-to-soul-top-five-grade-three-search-v1");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.costs,[{type:"counter-blast",count:1},{type:"source-to-soul",count:1}]);assert.equal(ability.costStatus,"supported-cost");assert.equal(ability.choiceStatus,"modeled");
 const source={uid:"source",cardId:card.id},chosen={uid:"gold-g3",cardId:"gold-g3"},wrongClan={uid:"kagero-g3",cardId:"kagero-g3"},lowGrade={uid:"gold-g2",cardId:"gold-g2"},player={playerId:"p1",vanguard:{uid:"vg"},rear:[source],damage:[{uid:"cb",faceDown:false}],soul:[],hand:[],drop:[],deck:[lowGrade,wrongClan,chosen]},definitions=new Map([[card.id,card],["gold-g3",{id:"gold-g3",type:"Normal Unit",grade:3,clan:"Gold Paladin"}],["kagero-g3",{id:"kagero-g3",type:"Normal Unit",grade:3,clan:"Kagero"}],["gold-g2",{id:"gold-g2",type:"Normal Unit",grade:2,clan:"Gold Paladin"}]]),events=[];
 const context={player,source,sourceZone:"rear-left",side:"human",turnId:5,actorPlayerId:"p1",cardDefinitionForInstance:instance=>definitions.get(instance.cardId),shuffleDeck:cards=>cards.reverse(),emitEvent:event=>events.push(event)};
 const legal=canActivateManualAbility(ability,{cardInstanceId:source.uid,controllerPlayerId:"p1",actorPlayerId:"p1",turnPlayerId:"p1",phase:"main",inPermittedZone:true,resources:{faceUpDamage:1,sourceCanMoveToSoul:true}});assert.equal(legal.ok,true);
 assert.equal(matchesTargetFilter(ability.definition.effects[0].filter,{targetCard:definitions.get(chosen.cardId)}),true);assert.equal(matchesTargetFilter(ability.definition.effects[0].filter,{targetCard:definitions.get(wrongClan.cardId)}),false);assert.equal(matchesTargetFilter(ability.definition.effects[0].filter,{targetCard:definitions.get(lowGrade.cardId)}),false);
 const rejected=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,effectUid:wrongClan.uid},draft=>payAbilityCosts(ability,{...draft,cardDefinitionForInstance:context.cardDefinitionForInstance,sourceZone:"rear-left",actorPlayerId:"p1"},{cb:["cb"]}).ok);assert.equal(rejected.ok,false);assert.equal(player.rear[0],source);assert.equal(player.damage[0].faceDown,false);assert.deepEqual(player.hand,[]);
 const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{...context,effectUid:chosen.uid},draft=>payAbilityCosts(ability,{...draft,cardDefinitionForInstance:context.cardDefinitionForInstance,sourceZone:"rear-left",actorPlayerId:"p1",emitEvent:context.emitEvent},{cb:["cb"]}).ok);assert.equal(result.ok,true);assert.equal(player.rear[0],null);assert.deepEqual(player.soul,[source]);assert.deepEqual(player.hand,[chosen]);assert.equal(player.damage[0].faceDown,true);assert.deepEqual(events.map(event=>event.type),["card.moved","card.revealed"]);
});


test("G-Guardian discard AUTO requires the exact recorded G-Guardian payment reason",()=>{
 const parsed=parseCardAbilities({id:"g-guardian-reason",text:"AUTO: When this card is discarded for the cost of calling a G guardian, draw a card."})[0];
 const ability={...parsed,conditionStatus:"modeled",costStatus:"no-cost"};
 assert.equal(ability.trigger?.eventType,"card.discarded");
 assert.equal(ability.trigger?.discardReason,"g-guardian-cost");
 const eventFor=reason=>createGameEvent({matchId:"g-guardian",eventSequence:0},{type:"card.discarded",actingPlayerId:"p1",sourceCardInstanceId:"heal-1",sourceOwnerPlayerId:"p1",sourceControllerPlayerId:"p1",subjectCardInstanceId:"heal-1",subjectOwnerPlayerId:"p1",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"drop",discardReason:reason});
 const matches=event=>eventMatchesAbilityTrigger(ability,"discard",event,"heal-1","hand","hand","p1");
 assert.equal(matches(eventFor(null)),false);
 assert.equal(matches(eventFor("stride-cost")),false);
 assert.equal(matches(eventFor("g-guardian-cost")),true);
 const app=fs.readFileSync("app.js","utf8");
 assert.match(app,/queueMovedCardAbility\(heal,"bot","discard","hand",\{discardReason:"g-guardian-cost",calledGUnitCardId:gGuardian\.cardId,calledGUnitInstanceId:gGuardian\.uid,calledGUnitCardName:cardMap\.get\(gGuardian\.cardId\)\?\.name\|\|null,calledGUnitPreviousLocation:"g-deck"\}\)/);
 assert.match(app,/queueMovedCardAbility\(cost,"human","discard","hand",\{discardReason:"g-guardian-cost",calledGUnitCardId:instance\.cardId,calledGUnitInstanceId:instance\.uid,calledGUnitCardName:guardian\.name\|\|null,calledGUnitPreviousLocation:"g-deck"\}\)/);
 assert.match(app,/discardReason:eventContext\.discardReason\|\|eventContext\.reason\|\|null/);
});


test("G-Guardian discard charge choice pays exact bind costs before Counter Charge or Soul Charge",()=>{
 const ability=parseCardAbilities({id:"g-guardian-charge",text:"AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1."})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-g-guardian-discard-bind-heal-charge-choice-v1");
 const source={uid:"source-heal",cardId:"source-def",faceUp:false},other={uid:"other-heal",cardId:"heal-def",faceUp:false},damage={uid:"damage-1",cardId:"normal",faceDown:true},top={uid:"top-card",cardId:"normal"};
 const definitions=new Map([["source-def",{trigger:"Heal"}],["heal-def",{trigger:"Heal"}],["normal",{trigger:"Critical"}]]),makePlayer=()=>({playerId:"player-a",drop:[{...source},{...other}],bind:[],damage:[{...damage}],soul:[],deck:[{...top}],hand:[],rear:[],usedAbilities:[]});
 const resolve=(player,chargeChoice,healUid="other-heal",damageUids=[])=>{const sourceInPlayer=player.drop.find(card=>card.uid==="source-heal");return resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source:sourceInPlayer,player,side:"human",effectUid:healUid,chargeChoice,selectedDamageUids:damageUids,cardDefinitionForInstance:card=>definitions.get(card.cardId),emitEvent:()=>{}},draft=>payAbilityCosts(ability,{...draft,turnId:1,actorPlayerId:"player-a",side:"human",sourceZone:"hand",cardDefinitionForInstance:card=>definitions.get(card.cardId)},{cb:[],sb:[],discard:[],reveal:[],effectUid:healUid}).ok)};
 const bad=makePlayer(),rejected=resolve(bad,"soul-charge","not-in-drop");assert.equal(rejected.ok,false);assert.deepEqual(bad.drop.map(card=>card.uid),["source-heal","other-heal"]);assert.equal(bad.bind.length,0);
 const counter=makePlayer(),counterResult=resolve(counter,"counter-charge","other-heal",["damage-1"]);assert.equal(counterResult.ok,true);assert.deepEqual(counter.bind.map(card=>card.uid),["source-heal","other-heal"]);assert.ok(counter.bind.every(card=>card.faceUp));assert.equal(counter.damage[0].faceDown,false);assert.equal(counter.deck.length,1);
 const soul=makePlayer(),soulResult=resolve(soul,"soul-charge");assert.equal(soulResult.ok,true);assert.deepEqual(soul.bind.map(card=>card.uid),["source-heal","other-heal"]);assert.deepEqual(soul.soul.map(card=>card.uid),["top-card"]);assert.equal(soul.damage[0].faceDown,true);
});


test("online G-Guardian AUTO choice validates the acting player's exact Heal and charge selection",()=>{
 const ability=parseCardAbilities({id:"online-g-guardian",text:"AUTO: When this card is discarded for the cost of calling a G guardian, COST [bind this card & bind another heal trigger from drop], and Counter Charge 1 or Soul Charge 1."})[0],source={uid:"source",cardId:"online-g-guardian"},heal={uid:"heal",cardId:"heal-def",trigger:"Heal"},state={matchId:"online-room",stateVersion:7,processedActionIds:[],players:{guest:{playerId:"guest",drop:[source,heal],bind:[],damage:[],soul:[],hand:[]},host:{playerId:"host",drop:[],bind:[],damage:[],soul:[],hand:[]}}};
 const pending={side:"bot",instance:source,ability,triggerControllerPlayerId:"guest",eventContext:{eventId:"g-guard-event"}},request={type:"ability-response",actionId:"g-guard-choice",matchId:"online-room",actorPlayerId:"guest",expectedStateVersion:7,accept:true,selection:{instanceUid:"source",abilityId:ability.id,costSelections:{cb:[],sb:[],discard:[],reveal:[]},effectUid:"heal",chargeChoice:"soul-charge",damageUids:[]}};
 assert.equal(validateAbilityDecision(state,request,"guest",pending).ok,true);assert.equal(validateAbilityDecision(state,{...request,actorPlayerId:"host"},"guest",pending).reason,"wrong-actor");assert.equal(validateAbilityDecision(state,{...request,selection:{...request.selection,effectUid:"source"}},"guest",pending).reason,"invalid-bind-heal-target");assert.equal(validateAbilityDecision(state,{...request,selection:{...request.selection,chargeChoice:"draw"}},"guest",pending).reason,"invalid-charge-choice");
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("data-ability-charge="));assert.ok(app.includes("chargeChoice:pending.chargeChoice||null"));
});

// Blaze regression coverage: a keyword AUTO is controller-event scoped, not an "attacking source" trigger.
test("Blaze AUTO respects source circle, controller attack count, Rear-Guard comparison, and turn expiry",()=>{
 const ability=parseCardAbilities({id:"blaze-first",text:"AUTO [VC/RC]: Blaze (At the beginning of your first attack, if the number of rear-guards you have is greater than your opponent’s, your vanguard becomes blazing until end of turn.)"})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-blaze-own-attack-more-rearguards-v1");assert.equal(ability.trigger?.subject,"controller");assert.equal(ability.trigger?.firstAttackOnly,true);assert.equal(ability.conditionStatus,"modeled");assert.deepEqual(ability.conditions,[{type:"controller-has-more-rear-guards-than-opponent"}]);assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);
 const event=count=>createGameEvent({matchId:"blaze-match"},{type:"attack.step-started",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"attacker",sourceControllerPlayerId:"p1",subjectCardInstanceId:"attacker",subjectControllerPlayerId:"p1",playerAttackCount:count});
 assert.equal(eventMatchesAbilityTrigger(ability,"attackStep",event(1),"blaze-source","rear-left",null,"p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"attackStep",event(2),"blaze-source","rear-left",null,"p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"attackStep",{...event(1),actingPlayerId:"p2"},"blaze-source","rear-left",null,"p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"attackStep",event(1),"blaze-source","vanguard",null,"p1"),true);
 const player={playerId:"p1",vanguard:{uid:"vg"}},context={player,side:"p1",turnSide:"p1",controllerRearGuards:3,opponentRearGuards:2};assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,context).ok,true);assert.equal(player.vanguard.blazing,true);assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:3,opponentRearGuards:2}),true);assert.equal(evaluateAbilityConditions(ability,{controllerRearGuards:2,opponentRearGuards:2}),false);assert.equal(evaluateAbilityConditions({conditionStatus:"modeled",conditions:[{type:"controller-vanguard-is-blazing"}]},{controllerVanguardIsBlazing:true}),true);assert.equal(evaluateAbilityConditions({conditionStatus:"modeled",conditions:[{type:"controller-vanguard-is-blazing"}]},{controllerVanguardIsBlazing:false}),false);
 expireTurnModifiers({player},"p2");assert.equal(player.vanguard.blazing,true);expireTurnModifiers({player},"p1");assert.equal(player.vanguard.blazing,undefined);
});

test("all real catalog Blaze reminder variants compile as controller-scoped AUTO abilities",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),cards=loadCatalog(),matches=[];for(const card of cards)for(const ability of parseCardAbilities(card))if(/\bBlaze \(/i.test(ability.raw))matches.push({card,ability});assert.equal(matches.length,10);for(const {ability} of matches){assert.equal(ability.definition?.source?.patternId,"auto-blaze-own-attack-more-rearguards-v1");assert.equal(ability.trigger?.subject,"controller");assert.equal(ability.trigger?.eventType,"attack.step-started");assert.equal(ability.conditionStatus,"modeled")}
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("ability.trigger?.subject!==\"controller\""));assert.ok(app.includes("getPlayerAttackCount(match"));assert.ok(app.includes("queueAbilityPrompts(\"attackStep\""));assert.ok(app.includes("controllerVanguardIsBlazing:Boolean(player.vanguard?.blazing)"));const humanAttack=app.slice(app.indexOf("function resolveHumanAttack()"),app.indexOf("function beginChosenAttack("));assert.ok(humanAttack.indexOf('queueAbilityPrompts("attackStep"')<humanAttack.indexOf("match.pendingAttackSetup="));const botAttack=app.slice(app.indexOf("function nextBotAttack()"),app.indexOf("function beginTurnEnd("));assert.ok(botAttack.indexOf('queueAbilityPrompts("attackStep"')<botAttack.indexOf("match.pendingAttack={"));
});

test("all catalog Blaze keyword records, including concise official keyword text, have recognized controller attack events",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),cards=loadCatalog(),matches=[];for(const card of cards)for(const ability of parseCardAbilities(card))if(ability.definition?.source?.patternId==="auto-blaze-own-attack-more-rearguards-v1")matches.push(ability);assert.equal(matches.length,27);for(const ability of matches){assert.equal(ability.trigger?.status,"recognized-trigger");assert.equal(ability.trigger?.eventType,"attack.step-started");assert.equal(ability.trigger?.subject,"controller");assert.ok(["modeled","no-explicit-condition-detected"].includes(ability.conditionStatus))}
});

test("Hollow AUTO is optional, binds to its own Rear-Guard placement, and expires by retiring that exact unit",()=>{
 const ability=parseCardAbilities({id:"hollow-instance",text:"AUTO: Hollow (When this unit is placed on RC, you may have it become hollowed. If you do, retire it at the end of turn.)"})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-hollow-placement-retire-turn-end-v1");assert.equal(ability.kind,"AUTO");assert.equal(ability.canDecline,true);assert.equal(ability.choiceStatus,"modeled");assert.equal(ability.trigger?.eventType,"card.placed");assert.equal(ability.trigger?.subject,"source");assert.deepEqual(ability.trigger?.circles,["rear-guard"]);
 const placement=createGameEvent({matchId:"hollow-match"},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"hollow-copy",subjectCardInstanceId:"hollow-copy",subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"rear-left"});
 assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"hollow-copy","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",placement,"other-copy","rear-left","rear-left","p1"),false);
 const vcPlacement=createGameEvent({matchId:"hollow-match"},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"hollow-copy",subjectCardInstanceId:"hollow-copy",subjectControllerPlayerId:"p1",currentLocation:"vanguard"});assert.equal(eventMatchesAbilityTrigger(ability,"place",vcPlacement,"hollow-copy","vanguard","vanguard","p1"),false);
 const hollow={uid:"hollow-copy",hollowed:false},player={playerId:"p1",rear:[hollow],drop:[]};const legal=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source:hollow,sourceInPlay:true,sourceZone:"rear-left",sidePlayerId:"p1"});assert.equal(legal.ok,true);assert.equal(hollow.hollowed,true);assert.equal(hollow.hollowedExpiry,"p1");
 const illegalSource={uid:"illegal-copy"};const illegal=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source:illegalSource,sourceInPlay:true,sourceZone:"vanguard",sidePlayerId:"p1"});assert.equal(illegal.ok,false);assert.equal(illegalSource.hollowed,undefined);
 const other={uid:"other",hollowed:true,hollowedExpiry:"p2"},players={human:player,bot:{playerId:"p2",rear:[other],drop:[]}};const retired=VanguardAbilityEngine.retireHollowedUnitsAtTurnEnd(players,"p1");assert.equal(retired.length,1);assert.equal(retired[0].instance,hollow);assert.equal(retired[0].zone,"rear-left");assert.equal(player.rear[0],null);assert.deepEqual(player.drop,[hollow]);assert.equal(hollow.hollowed,undefined);assert.equal(players.bot.rear[0],other);
});

test("all catalog Hollow keyword variants compile to exact source placement AUTO abilities",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),matches=[];for(const card of loadCatalog())for(const ability of parseCardAbilities(card))if(/\bHollow(?: \(|\.)/i.test(ability.raw))matches.push(ability);assert.equal(matches.length,32);assert.ok(matches.every(ability=>ability.definition?.source?.patternId==="auto-hollow-placement-retire-turn-end-v1"&&ability.trigger?.eventType==="card.placed"&&ability.trigger?.subject==="source"&&ability.trigger?.circles?.includes("rear-guard")&&ability.choiceStatus==="modeled"));
 const app=fs.readFileSync("app.js","utf8"),transition=app.slice(app.indexOf("function completeTurnTransition"),app.indexOf("function finishTurn"));assert.ok(transition.includes("retireHollowedUnitsAtTurnEnd(endingPlayerId)"));assert.ok(app.includes('timingWindow:"hollow-retirement"'));
});

test("Afterimage responds only to an opponent-owned bind-to-hand move and may return its exact Rear-Guard",()=>{
 const ability=parseCardAbilities({id:"afterimage-source",text:"AUTO [RC]: Afterimage (When your opponent puts a bound card into his or her hand, if your hand has six or less cards, you may return this unit to your hand)"})[0];
 assert.equal(ability.definition?.source?.patternId,"auto-afterimage-opponent-bound-card-to-hand-return-source-v1");assert.equal(ability.kind,"AUTO");assert.equal(ability.canDecline,true);assert.equal(ability.conditionStatus,"modeled");assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.conditions,[{type:"controller-hand-size-at-most",count:6}]);assert.deepEqual(ability.requiredLocation,["rear-guard"]);
 const moved=createGameEvent({matchId:"afterimage-match"},{type:"card.moved",actingPlayerId:"p2",turnPlayerId:"p2",sourceCardInstanceId:"opponent-bound",sourceOwnerPlayerId:"p2",sourceControllerPlayerId:"p2",subjectCardInstanceId:"opponent-bound",subjectOwnerPlayerId:"p2",subjectControllerPlayerId:"p2",previousLocation:"bind",currentLocation:"hand"});
 const matches=(change={})=>eventMatchesAbilityTrigger(ability,"move",{...moved,...change},"afterimage-copy","rear-left","bind","p1");assert.equal(matches(),true);assert.equal(matches({subjectOwnerPlayerId:"p1"}),false);assert.equal(matches({previousLocation:"drop"}),false);assert.equal(matches({currentLocation:"drop"}),false);
 assert.equal(evaluateAbilityConditions(ability,{controllerHandCount:6}),true);assert.equal(evaluateAbilityConditions(ability,{controllerHandCount:7}),false);
 const source={uid:"afterimage-copy"},other={uid:"other-rear"},player={playerId:"p1",rear:[source,other],hand:[]},events=[];const result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source,sourceInPlay:true,sourceZone:"rear-left",side:"human",emitEvent:event=>events.push(event)});assert.equal(result.ok,true);assert.deepEqual(player.rear,[null,other]);assert.deepEqual(player.hand,[source]);assert.equal(events[0].type,"card.moved");assert.equal(events[0].controllerSide,"human");assert.equal(events[0].currentLocation,"hand");
 const vanguard={uid:"vanguard-copy"},illegal=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:{playerId:"p1",vanguard,hand:[],rear:[]},source:vanguard,sourceInPlay:true,sourceZone:"vanguard",side:"human"});assert.equal(illegal.ok,false);assert.deepEqual(player.hand,[source]);
});

test("catalog Afterimage variants are supported as optional AUTO abilities with a modeled six-card condition",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),matches=[];for(const card of loadCatalog())for(const ability of parseCardAbilities(card))if(ability.raw.startsWith("[RC]: Afterimage"))matches.push(ability);assert.equal(matches.length,14);assert.ok(matches.every(ability=>ability.definition?.source?.patternId==="auto-afterimage-opponent-bound-card-to-hand-return-source-v1"&&ability.trigger?.eventType==="card.moved"&&ability.trigger?.sourceLocation==="bind"&&ability.trigger?.destinationLocation==="hand"&&ability.trigger?.movedCardOwnerRelation==="opponent"&&ability.canDecline&&ability.conditionStatus==="modeled"));
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes('["human","bot"].flatMap(fieldSide=>abilityFieldUnits(fieldSide)'));
});

test("Charge triggers only when its exact Rear-Guard is effect-placed and returns to deck after a participating battle",()=>{
 const ability=parseCardAbilities({id:"charge-source",text:"AUTO: Charge (When this unit is placed on RC due to an effect, you may have it become charging for that turn. If you do, put it on the bottom of your deck at the end of its battle.)"})[0];assert.equal(ability.definition?.source?.patternId,"auto-charge-effect-placement-bottom-deck-after-battle-v1");assert.equal(ability.canDecline,true);assert.equal(ability.choiceStatus,"modeled");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.trigger?.circles,["rear-guard"]);assert.equal(ability.trigger?.effectPlacementOnly,true);
 const event=(uid,window="effect-rear-placement",location="rear-left")=>createGameEvent({matchId:"charge-match"},{type:"card.placed",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:uid,subjectCardInstanceId:uid,subjectOwnerPlayerId:"p1",subjectControllerPlayerId:"p1",currentLocation:location,timingWindow:window});assert.equal(eventMatchesAbilityTrigger(ability,"place",event("charge-copy"),"charge-copy","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(ability,"place",event("other-copy"),"charge-copy","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",event("charge-copy","normal-call"),"charge-copy","rear-left","rear-left","p1"),false);assert.equal(eventMatchesAbilityTrigger(ability,"place",event("charge-copy","effect-rear-placement","vanguard"),"charge-copy","vanguard","vanguard","p1"),false);
 const source={uid:"charge-copy"},player={playerId:"p1",rear:[source],hand:[],deck:[]},applied=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source,sourceInPlay:true,sourceZone:"rear-left",sidePlayerId:"p1"});assert.equal(applied.ok,true);assert.equal(source.charging,true);assert.equal(source.chargingExpiry,"p1");
 const untouched={uid:"untouched",charging:true},chargedBooster={uid:"charged-booster",ownerPlayerId:"p1",charging:true,chargingExpiry:"p1"},retiredDuringBattle={uid:"charged-retired",ownerPlayerId:"p1",charging:true,chargingExpiry:"p1"},notCharging={uid:"non-charged"},players={human:{playerId:"p1",rear:[untouched,chargedBooster,notCharging],drop:[retiredDuringBattle],deck:[]},bot:{playerId:"p2",rear:[],deck:[]}};const moved=VanguardAbilityEngine.retireChargingUnitsAtBattleEnd(players,"battle-8",[chargedBooster.uid,retiredDuringBattle.uid,"nonexistent"]);assert.equal(moved.length,2);assert.equal(moved[0].instance,chargedBooster);assert.equal(moved[0].zone,"rear-right");assert.equal(moved[0].battleId,"battle-8");assert.equal(moved[1].instance,retiredDuringBattle);assert.equal(moved[1].zone,"drop");assert.deepEqual(players.human.rear,[untouched,null,notCharging]);assert.deepEqual(players.human.drop,[]);assert.deepEqual(players.human.deck,[chargedBooster,retiredDuringBattle]);assert.equal(chargedBooster.charging,undefined);assert.equal(untouched.charging,true);const expiring={charging:true,chargingExpiry:"p1"};expireTurnModifiers({expiring},"p1");assert.equal(expiring.charging,undefined);
 const mandatory=parseCardAbilities({id:"charge-mandatory",text:"AUTO: Charge (During the turn that this unit is placed on RC by an effect, it becomes in Charge, and put it on the bottom of you deck at the end of the battle in which it participated.)"})[0];assert.equal(mandatory.definition?.source?.patternId,"auto-charge-effect-placement-bottom-deck-after-battle-v1");assert.equal(mandatory.canDecline,false);
});

test("catalog Charge AUTO definitions include keyword-only records and remain effect-placement scoped",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),matches=[],keywordOnly=[];for(const card of loadCatalog())for(const ability of parseCardAbilities(card)){if(ability.definition?.source?.patternId==="auto-charge-effect-placement-bottom-deck-after-battle-v1")matches.push(ability);if(ability.raw==="Charge.")keywordOnly.push(ability)}assert.equal(matches.length,23);assert.equal(keywordOnly.length,12);assert.ok(keywordOnly.every(ability=>ability.definition?.source?.patternId==="auto-charge-effect-placement-bottom-deck-after-battle-v1"&&ability.canDecline&&ability.conditionStatus==="no-explicit-condition-detected"));assert.ok(matches.every(ability=>ability.trigger?.eventType==="card.placed"&&ability.trigger?.effectPlacementOnly===true&&ability.trigger?.circles?.includes("rear-guard")&&ability.definition.effects[0]?.op==="set-charging"));
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("match.pendingChargeCleanup={battleId:pending.battleId,participantInstanceIds}"));assert.ok(app.includes("retireChargingUnitsAtBattleEnd(match.players,pending.battleId,pending.participantInstanceIds)"));
});

test("Forerunner is an optional exact-source same-clan ride AUTO that calls from Soul standing",()=>{
 const ability=parseCardAbilities({id:"forerunner-test",text:"AUTO: Forerunner."})[0];assert.equal(ability.definition?.source?.patternId,"auto-forerunner-same-clan-ride-call-source-v1");assert.equal(ability.trigger?.eventType,"card.ridden");assert.equal(ability.trigger?.subject,"ridden-unit");assert.equal(ability.canDecline,true);assert.deepEqual(ability.definition.effects,[{op:"call-source-from-soul",target:"source",position:"stand"}]);
 const source={uid:"starter-copy",cardId:"forerunner-test"},player={playerId:"p1",soul:[source],rear:[null,null,null,null,null],accelZones:0},events=[];const apply=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player,source,side:"human",callZone:"rear-left",cardDefinitionForInstance:()=>({type:"Normal Unit"}),emitEvent:event=>events.push(event)});assert.equal(apply.ok,true);assert.equal(player.soul.length,0);assert.equal(player.rear[0].uid,"starter-copy");assert.equal(player.rear[0].rested,false);assert.equal(events[0].previousLocation,"soul");
 const occupiedSource={uid:"occupied-starter"},occupiedPlayer={soul:[occupiedSource],rear:[{uid:"occupant"},null,null,null,null]};assert.equal(resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{player:occupiedPlayer,source:occupiedSource,side:"human",callZone:"rear-left",cardDefinitionForInstance:()=>({type:"Normal Unit"})}).ok,false);assert.equal(occupiedPlayer.soul[0].uid,"occupied-starter");
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("auto-forerunner-same-clan-ride-call-source-v1"));assert.ok(app.includes("Choose an open Rear-Guard circle"));
});

test("Harmony associations require same controller and column, persist across movement, and break on leave or turn end",()=>{
 const match={turn:3,side:"human",harmonyAssociations:[],players:{human:{playerId:"p1",vanguard:{uid:"vg",controllerPlayerId:"p1"},rear:[{uid:"front",controllerPlayerId:"p1"},null,{uid:"back",controllerPlayerId:"p1"},null,null]},bot:{playerId:"p2",vanguard:{uid:"enemy-vg",controllerPlayerId:"p2"},rear:[null,null,null,null,null]}}},turnKey="3:human";
 assert.equal(createHarmonyAssociation(match,"front","back",turnKey),true);assert.equal(isCardInHarmony(match,"front",turnKey),true);assert.equal(isCardInHarmony(match,"back",turnKey),true);
 match.players.human.rear[0]=null;match.players.human.rear[1]={uid:"front",controllerPlayerId:"p1"};assert.equal(isCardInHarmony(match,"front",turnKey),true,"a lane change does not end an existing association");
 const leftField=structuredClone(match),backUnit=leftField.players.human.rear[2];leftField.players.human.rear[2]=null;leftField.players.human.soul=[backUnit];assert.equal(isCardInHarmony(leftField,"front",turnKey),false,"a unit that leaves the field breaks its association");
 assert.equal(createHarmonyAssociation(match,"vg","front",turnKey),false,"different columns cannot form a new association");assert.equal(createHarmonyAssociation(match,"vg","enemy-vg",turnKey),false,"opponent units cannot associate");
 assert.equal(removeHarmonyAssociationsForInstance(match,"back"),1);assert.equal(isCardInHarmony(match,"front",turnKey),false);match.players.human.rear[1]=null;match.players.human.rear[0]={uid:"front",controllerPlayerId:"p1"};assert.equal(createHarmonyAssociation(match,"front","back",turnKey),true);assert.equal(expireHarmonyAssociations(match,turnKey),1);assert.equal(isCardInHarmony(match,"front",turnKey),false,"associations expire at turn end");
 const requirement=parseCardAbilities({id:"harmony-condition",text:"AUTO [RC]: When this unit attacks, if this unit is in Harmony state, this unit gets power +3000 until end of that battle."})[0];assert.equal(requirement.conditionStatus,"modeled");assert.equal(evaluateAbilityConditions(requirement,{sourceInHarmony:true}),true);assert.equal(evaluateAbilityConditions(requirement,{sourceInHarmony:false}),false);
 const program=[{op:"associate-harmony-units",target:"source-and-event-subject",duration:"turn"}],placed=match.players.human.rear[2],events=[],sourceUnit=match.players.human.rear[0],effectContext={match,source:sourceUnit,sourceInPlay:true,eventSubjectUid:placed.uid,harmonySameColumnAtTrigger:true,harmonyTurnKey:turnKey,side:"human",emitEvent:event=>events.push(event)};assert.equal(resolveEffectProgram(program,EFFECT_HANDLERS,{...effectContext,harmonySameColumnAtTrigger:false}).ok,false);match.players.human.rear[0]=null;match.players.human.rear[1]=sourceUnit;assert.equal(resolveEffectProgram(program,EFFECT_HANDLERS,effectContext).ok,true,"the association still resolves after the source moves columns");assert.equal(isCardInHarmony(match,placed.uid,turnKey),true);assert.deepEqual(events.map(event=>event.cardInstanceId).sort(),["back","front"]);
 const becomes=parseCardAbilities({id:"harmony-becomes",text:"AUTO [RC]: When this unit becomes in Harmony state, draw a card."})[0],becameEvent=createGameEvent({matchId:"harmony-trigger"},{type:"unit.became_harmony",actingPlayerId:"p1",sourceCardInstanceId:"front",subjectCardInstanceId:"front",sourceControllerPlayerId:"p1",subjectControllerPlayerId:"p1",currentLocation:"rear-left"});assert.equal(becomes.trigger.eventType,"unit.became_harmony");assert.equal(eventMatchesAbilityTrigger(becomes,"harmony",becameEvent,"front","rear-left","rear-left","p1"),true);assert.equal(eventMatchesAbilityTrigger(becomes,"harmony",becameEvent,"other-copy","rear-left","rear-left","p1"),false);
 const app=fs.readFileSync("app.js","utf8");assert.ok(app.includes("auto-harmony-same-column-association-v1"));assert.ok(app.includes("sourceController!==placedController||rearColumn(source.zone)!==rearColumn(placed.zone)"));assert.ok(app.includes("removeHarmonyAssociationsForInstance(match,instance.uid)"));const turnEnd=app.slice(app.indexOf("function completeTurnTransition("),app.indexOf("function endTurn(",app.indexOf("function completeTurnTransition(")));assert.ok(turnEnd.indexOf("retireHollowedUnitsAtTurnEnd")<turnEnd.indexOf("expireHarmonyAssociations"));
});
test("checking Harmony eligibility is read-only when an activation is rejected",()=>{
 const state={turn:1,side:"human",players:{human:{playerId:"p1",vanguard:null,rear:[]},bot:{playerId:"p2",vanguard:null,rear:[]}}};
 const before=JSON.stringify(state);
 assert.equal(isCardInHarmony(state,"missing-source","1:human"),false);
 assert.equal(JSON.stringify(state),before,"a rejected legality check must not mutate canonical state");
});
test("Revelation keywords compile to exact circle triggers and ordered optional Soul/rest effects",()=>{
  const {loadCatalog}=require("./scripts/audit-ability-catalog");
  const trustedReducer=require("./ability-server-reducer.js");
  const catalog=loadCatalog();
  const records=[];
  for(const card of catalog)for(const ability of parseCardAbilities(card))if(ability.definition?.source?.patternId==="auto-revelation-keyword-v1")records.push({card,ability});
  assert.equal(records.length,23);
  for(const {card,ability} of records){
    assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger.eventType,"card.placed");assert.equal(ability.trigger.subject,"source");
    assert.ok(VanguardAbilityEngine.getReviewedAbilityDefinitionsForCard(card.id).some(item=>item.id===ability.id),"the exact Revelation ability is in the production registry");
    assert.equal(trustedReducer.supportsServerAbilityEffects(ability),true,"the authoritative reducer supports the exact Revelation ability");
    assert.equal(ability.trigger.circles.includes("rear-guard"),/Revelation - RC|VC\/RC/i.test(ability.raw));
    assert.equal(ability.trigger.circles.includes("vanguard"),/Revelation - VC|VC\/RC/i.test(ability.raw));
    assert.equal(ability.definition.effects[0].op,"revelation-choice");assert.equal(ability.definition.effects[1].op,"rest-target");
  }
});
test("Revelation moves only the deck top when chosen and rests the exact standing friendly Rear-Guard",()=>{
  const top={uid:"top",cardId:"top-card"},rested={uid:"target",rested:false},player={deck:[top],soul:[],rear:[rested]},events=[];
  const context={player,side:"human",revelationTopUid:"top",effectChoice:"soul",target:rested,targetInPlay:true,targetPlayer:player,targetSide:"human",targetZone:"rear-left",targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",emitEvent:event=>events.push(event)};
  const program=[{op:"revelation-choice",target:"controller"},{op:"rest-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard"}}];
  const result=resolveEffectProgram(program,EFFECT_HANDLERS,context);
  assert.equal(result.ok,true);assert.deepEqual(player.deck,[]);assert.deepEqual(player.soul,[top]);assert.equal(rested.rested,true);
  assert.equal(events[0].reason,"revelation");assert.equal(events[1].type,"unit.rested");
});
test("Revelation keep-top choice does not move the card or rest a unit",()=>{
  const top={uid:"top"},unit={uid:"target",rested:false},player={deck:[top],soul:[],rear:[unit]};
  const result=resolveEffectProgram([{op:"revelation-choice",target:"controller"},{op:"rest-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard"}}],EFFECT_HANDLERS,{player,revelationTopUid:"top",effectChoice:"keep-top",side:"human"});
  assert.equal(result.ok,true);assert.deepEqual(player.deck,[top]);assert.deepEqual(player.soul,[]);assert.equal(unit.rested,false);
});
test("Revelation rejects a rested target without partially moving the top card",()=>{
  const top={uid:"top"},unit={uid:"target",rested:true},player={deck:[top],soul:[],rear:[unit]};
  const result=resolveEffectProgram([{op:"revelation-choice",target:"controller"},{op:"rest-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard"}}],EFFECT_HANDLERS,{player,revelationTopUid:"top",effectChoice:"soul",target:unit,targetInPlay:true,targetPlayer:player,targetSide:"human",targetZone:"rear-left",targetControllerPlayerId:"p1",sourceControllerPlayerId:"p1",side:"human"});
  assert.equal(result.ok,false);assert.deepEqual(player.deck,[top]);assert.deepEqual(player.soul,[]);assert.equal(unit.rested,true);
});
test("Revelation revalidates the exact privately revealed top-card instance before resolving",()=>{
  const shown={uid:"shown"},replacement={uid:"replacement"},player={deck:[replacement],soul:[]};
  const result=resolveEffectProgram([{op:"revelation-choice",target:"controller"},{op:"rest-target",target:"chosen",noOpIfNoLegalTargets:true,targetFilter:{controller:"source-controller",zone:"rear-guard"}}],EFFECT_HANDLERS,{player,revelationTopUid:shown.uid,effectChoice:"soul",side:"human",noLegalTarget:true});
  assert.equal(result.ok,false);assert.deepEqual(player.deck,[replacement]);assert.deepEqual(player.soul,[]);
});

test("Engorge AUTO triggers only for the exact attacking source in its permitted circle",()=>{
 const vc=parseCardAbilities({id:"engorge-vc",text:"AUTO [VC]: Engorge."})[0],both=parseCardAbilities({id:"engorge-both",text:"AUTO [VC/RC]: Engorge."})[0],event=createGameEvent({matchId:"engorge-trigger"},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",sourceControllerPlayerId:"p1",subjectControllerPlayerId:"p1",currentLocation:"vanguard"});
 assert.equal(vc.definition?.source?.patternId,"auto-engorge-retire-other-rearguards-v1");assert.equal(vc.canDecline,true);assert.equal(eventMatchesAbilityTrigger(vc,"attack",event,"attacker","vanguard","vanguard","p1"),true);assert.equal(eventMatchesAbilityTrigger(vc,"attack",event,"different","vanguard","vanguard","p1"),false);assert.equal(eventMatchesAbilityTrigger(vc,"attack",{...event,currentLocation:"rear-left"},"attacker","rear-left","rear-left","p1"),false);assert.deepEqual(both.requiredLocation,["vanguard","rear-guard"]);
});
test("Engorge retires only selected other friendly Rear-Guards as an effect and marks its source until turn end",()=>{
 const source={uid:"attacker",controllerPlayerId:"p1"},a={uid:"a"},b={uid:"b"},other={uid:"other"},player={playerId:"p1",vanguard:source,rear:[a,b,other],drop:[]},attack={attackerUid:source.uid,attackerSide:"human"},events=[],context={source,player,side:"human",sourceInPlay:true,match:{pendingAttack:attack},engorgeTargetUids:[a.uid,b.uid],engorgeTargetZones:{a:"rear-left",b:"rear-right"},emitEvent:event=>events.push(event)};
 const result=resolveEffectProgram([{op:"engorge",target:"source"}],EFFECT_HANDLERS,context);assert.equal(result.ok,true);assert.deepEqual(player.rear,[null,null,other]);assert.deepEqual(player.drop,[a,b]);assert.equal(source.engorged,true);assert.equal(source.engorgeRetiredCount,2);assert.equal(source.engorgedExpiry,"p1");assert.deepEqual(events.slice(0,2).map(event=>[event.type,event.reason,event.abilitySourceInstanceId]),[["card.retired","engorge",source.uid],["card.retired","engorge",source.uid]]);assert.equal(events[2].type,"unit.became_engorged");expireTurnModifiers({source},"p1");assert.equal(source.engorged,undefined);assert.equal(source.engorgeRetiredCount,undefined);
});
test("Engorge refuses another unit's attack, a source target, and stale/duplicate selections atomically",()=>{
 const source={uid:"source"},ally={uid:"ally"},player={playerId:"p1",rear:[source,ally],drop:[]},base={source,player,side:"human",sourceInPlay:true,match:{pendingAttack:{attackerUid:"other",attackerSide:"human"}},engorgeTargetUids:[ally.uid]};assert.equal(resolveEffectProgram([{op:"engorge",target:"source"}],EFFECT_HANDLERS,base).ok,false);assert.deepEqual(player.rear,[source,ally]);assert.equal(player.drop.length,0);const attack={attackerUid:source.uid,attackerSide:"human"};for(const ids of [[source.uid],[ally.uid,ally.uid]])assert.equal(resolveEffectProgram([{op:"engorge",target:"source"}],EFFECT_HANDLERS,{...base,match:{pendingAttack:attack},engorgeTargetUids:ids}).ok,false);assert.deepEqual(player.rear,[source,ally]);
});
test("all real Engorge keyword records compile with exact attack trigger and effect",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),reducer=require("./ability-server-reducer.js"),rows=[];for(const card of loadCatalog())for(const ability of parseCardAbilities(card))if(ability.kind==="AUTO"&&ability.raw.startsWith("[VC")&&ability.raw.includes("Engorge"))rows.push({card,ability});assert.equal(rows.length,23);assert.ok(rows.every(({card,ability})=>ability.definition?.source?.patternId==="auto-engorge-retire-other-rearguards-v1"&&ability.trigger?.eventType==="unit.attacked"&&ability.trigger.subject==="source"&&ability.canDecline&&ability.choiceStatus==="modeled"&&VanguardAbilityEngine.getReviewedAbilityDefinitionsForCard(card.id).some(item=>item.id===ability.id)&&reducer.supportsServerAbilityEffects(ability)));
});
test("joining player Engorge choices require current attack source and exact own Rear-Guard targets",()=>{
 const ability=parseCardAbilities({id:"remote-engorge",text:"AUTO [VC]: Engorge."})[0],source={uid:"attacker",controllerPlayerId:"p-guest"},ally={uid:"ally"},opponent={uid:"opponent-ally"},player={playerId:"p-guest",vanguard:source,rear:[source,ally],drop:[]},other={playerId:"p-host",rear:[opponent],drop:[]},state={matchId:"engorge-room",stateVersion:3,players:{bot:player,human:other},pendingAttack:{attackerUid:source.uid,attackerSide:"bot"}},pending={side:"bot",instance:source,triggerControllerPlayerId:"p-guest",ability},base={matchId:"engorge-room",actorPlayerId:"p-guest",actionId:"engorge-choice",expectedStateVersion:3,accept:true,selection:{instanceUid:source.uid,abilityId:ability.id,costSelections:{},engorgeTargetUids:[ally.uid]}};
 assert.deepEqual(validateAbilityDecision(state,base,"p-guest",pending),{ok:true});assert.equal(validateAbilityDecision(state,{...base,actionId:"engorge-opponent",selection:{...base.selection,engorgeTargetUids:[opponent.uid]}},"p-guest",pending).reason,"invalid-engorge-selection");assert.equal(validateAbilityDecision({...state,pendingAttack:{attackerUid:"different",attackerSide:"bot"}},{...base,actionId:"engorge-stale"},"p-guest",pending).reason,"invalid-engorge-selection");
});

test("AUTO ability readiness requires reviewed trigger, conditions, costs, choices, and an effect",()=>{
 const valid={kind:"AUTO",trigger:{status:"recognized-trigger"},definition:{kind:"AUTO",effects:[{op:"draw",count:1}]},conditionStatus:"no-explicit-condition-detected",costStatus:"no-cost",choiceStatus:"no-explicit-choice-detected"};
 assert.deepEqual(autoAbilityReadiness(valid),{ok:true});
 for(const [field,value,reason] of [["trigger",{status:"needs-review"},"unrecognized-trigger"],["conditionStatus","needs-review","unmodeled-condition"],["costStatus","needs-review","unmodeled-cost"],["choiceStatus","needs-review","unmodeled-choice"],["definition",{kind:"AUTO",effects:[]},"unsupported-effect"]])assert.equal(autoAbilityReadiness({...valid,[field]:value}).reason,reason,field);
 assert.equal(autoAbilityReadiness({...valid,kind:"ACT"}).reason,"not-automatic");
});

test("Legion Vanguard own-attack AUTO requires this exact Vanguard instance to have a Legion mate",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),ids=["cfa-1939","cfa-2028","cfa-2115","cfa-2118","cfa-2128","cfa-2135","cfa-2191","cfa-2205","cfa-2215","cfa-2255","cfa-2308"],records=ids.map(id=>loadCatalog().find(card=>card.id===id));
 assert.ok(records.every(Boolean));
 for(const card of records){
  const ability=parseCardAbilities(card).find(item=>item.definition?.source?.patternId==="auto-vc-own-attack-legion-power-battle-v1");
  assert.equal(ability.definition?.source?.patternId,"auto-vc-own-attack-legion-power-battle-v1",card.id);
  assert.deepEqual(ability.requiredLocation,["vanguard"],card.id);
  assert.deepEqual(ability.conditions,[{type:"source-is-legion"}],card.id);
  assert.equal(ability.conditionStatus,"modeled",card.id);
  assert.equal(ability.trigger.eventType,"unit.attacked",card.id);
  assert.equal(evaluateAbilityConditions(ability,{sourceInLegion:true}),true,card.id);
  assert.equal(evaluateAbilityConditions(ability,{sourceInLegion:false}),false,card.id);
  const event=createGameEvent({matchId:`${card.id}-legion-attack`},{type:"unit.attacked",actingPlayerId:"p1",sourceCardInstanceId:"legion-vanguard",subjectCardInstanceId:"legion-vanguard",targetLocation:"vanguard",currentLocation:"vanguard",battleId:"battle-1"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"legion-vanguard","vanguard","vanguard","p1"),true,card.id);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other-vanguard-copy","vanguard","vanguard","p1"),false,card.id);
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",{...event,targetLocation:"rear-guard"},"legion-vanguard","vanguard","vanguard","p1"),false,card.id);
 }
});

test("Rear-Guard Legion power AUTO matches the exact Legion event and expires at turn end",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),ids=["cfa-2123","cfa-2131","cfa-2145","cfa-2147","cfa-2318","cfa-2348","cfa-2360","cfa-2396","cfa-2424","cfa-2434","cfa-11697"],catalog=loadCatalog(),matches=[];
 for(const id of ids){const card=catalog.find(item=>item.id===id);assert.ok(card,id);const ability=parseCardAbilities(card).find(item=>item.definition?.source?.patternId==="auto-rc-vanguard-legions-source-turn-power-v1");assert.ok(ability,id);matches.push(ability);}
 assert.equal(matches.length,11);assert.ok(matches.every(ability=>ability.trigger.eventType==="unit.legioned"&&ability.trigger.subject==="vanguard"&&ability.requiredLocation.includes("rear-guard")));
 const ability=matches[0],event=createGameEvent({matchId:"rear-legion"},{type:"unit.legioned",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"leader",subjectCardInstanceId:"leader",subjectControllerPlayerId:"p1",currentLocation:"vanguard",legionMateInstanceId:"mate",timingWindow:"seek-mate-resolution"});
 assert.equal(eventMatchesAbilityTrigger(ability,"legion",event,"rear-source","rear-left","vanguard","p1"),true);
 assert.equal(eventMatchesAbilityTrigger(ability,"legion",event,"rear-source","vanguard","vanguard","p1"),false);
 assert.equal(eventMatchesAbilityTrigger(ability,"legion",{...event,subjectControllerPlayerId:"p2"},"rear-source","rear-left","vanguard","p1"),false);
 const source={uid:"rear-source",controllerPlayerId:"p1",turnPowerBoost:0},player={playerId:"p1",rear:[source],vanguard:{uid:"leader"}},result=resolveEffectProgram(ability.definition.effects,EFFECT_HANDLERS,{source,sourceInPlay:true,sourceZone:"rear-left",sourceControllerPlayerId:"p1",player,side:"p1",turnId:7});
 assert.equal(result.ok,true);assert.equal(source.turnPowerBoost,5000);expireTurnModifiers({players:{p1:player},turn:7,side:"p1"},"p1");assert.equal(source.turnPowerBoost,0);
});

test("Rear-Guard own-attack Legion AUTO requires its exact attack and a Legioned controller Vanguard",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),ids=["cfa-2031","cfa-2045","cfa-2116","cfa-2120","cfa-2127","cfa-2133","cfa-2248","cfa-2258","cfa-2312","cfa-2363"],catalog=loadCatalog();
 for(const id of ids){
  const card=catalog.find(item=>item.id===id);assert.ok(card,id);
  const ability=parseCardAbilities(card).find(item=>item.definition?.source?.patternId==="auto-rc-own-attack-legion-power-battle-v1");assert.ok(ability,id);
  assert.deepEqual(ability.requiredLocation,["rear-guard"],id);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-is-legion"}],id);assert.equal(ability.conditionStatus,"modeled",id);assert.equal(ability.trigger.eventType,"unit.attacked",id);assert.equal(ability.trigger.subject,"source",id);
  assert.equal(evaluateAbilityConditions(ability,{controllerVanguardIsLegion:true}),true,id);assert.equal(evaluateAbilityConditions(ability,{controllerVanguardIsLegion:false}),false,id);
  const event=createGameEvent({matchId:`${id}-legion-attack`},{type:"unit.attacked",actingPlayerId:"p1",turnPlayerId:"p1",sourceCardInstanceId:"attacker",subjectCardInstanceId:"attacker",sourceControllerPlayerId:"p1",currentLocation:"rear-left",targetLocation:"vanguard",battleId:"battle-1"});
  assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"attacker","rear-left","vanguard","p1"),true,id);assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"other-copy","rear-left","vanguard","p1"),false,id);assert.equal(eventMatchesAbilityTrigger(ability,"attack",event,"attacker","vanguard","vanguard","p1"),false,id);
 }
});

test("G-zone CONT prevents ability-originated face-up changes but permits a player's free Stride rule",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),catalog=loadCatalog();
 const records=catalog.filter(card=>/This card cannot be turned face up by abilities\. If this card is face up, you can Stride without paying the Stride cost\./i.test(card.text));
 assert.equal(records.length,6);
 for(const card of records){
  const ability=parseCardAbilities(card)[0];assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["g-zone"]);assert.equal(ability.definition?.source?.patternId,"cont-gzone-unflip-free-stride-v1");assert.equal(ability.costStatus,"no-cost");assert.equal(isManuallyActivatable(ability),false);
  const lock=evaluateContinuousRestrictions([ability],{location:"g-zone",action:"turn-face-up-by-ability"});assert.equal(lock.legal,false,card.id);assert.equal(lock.restrictions[0].reason,"g-zone-card-cannot-be-turned-face-up-by-ability",card.id);
  assert.equal(evaluateContinuousRestrictions([ability],{location:"g-zone",action:"turn-face-up-manually"}).legal,true,card.id);
  assert.equal(evaluateContinuousRestrictions([ability],{location:"rear-guard",action:"turn-face-up-by-ability"}).legal,true,card.id);
 }
});

test("Stride/Ride Deck cost draw AUTO matches only its own card and one of the printed discard reasons",()=>{
 const {loadCatalog}=require("./scripts/audit-ability-catalog.js"),catalog=loadCatalog(),ids=["cfa-11908","cfa-11974","cfa-12012","cfa-12034","cfa-12064","cfa-12121"];
 const event=(reason,source="discarded-source",actor="p1")=>createGameEvent({matchId:`discard-reason-${reason}-${source}-${actor}`},{type:"card.discarded",actingPlayerId:actor,turnPlayerId:actor,sourceCardInstanceId:source,sourceControllerPlayerId:"p1",subjectCardInstanceId:source,subjectControllerPlayerId:"p1",previousLocation:"hand",currentLocation:"drop",discardReason:reason});
 for(const id of ids){const card=catalog.find(item=>item.id===id);assert.ok(card,id);const ability=parseCardAbilities(card).find(item=>item.definition?.source?.patternId==="auto-ride-deck-or-stride-cost-discard-draw-v1");assert.ok(ability,id);assert.equal(ability.id.endsWith(":1"),true,id);assert.equal(ability.conditionStatus,"no-explicit-condition-detected",id);assert.equal(ability.costStatus,"no-cost",id);assert.deepEqual(ability.conditions,[],id);
  for(const reason of ["ride-deck-grade-three-cost","stride-cost"])assert.equal(eventMatchesAbilityTrigger(ability,"discard",event(reason),"discarded-source","hand","drop","p1"),true,`${id}:${reason}`);
  assert.equal(eventMatchesAbilityTrigger(ability,"discard",event("ordinary-cost"),"discarded-source","hand","drop","p1"),false,id);assert.equal(eventMatchesAbilityTrigger(ability,"discard",event("stride-cost","different-copy"),"discarded-source","hand","drop","p1"),false,id);assert.equal(eventMatchesAbilityTrigger(ability,"discard",event("stride-cost","discarded-source","p2"),"discarded-source","hand","drop","p1"),false,id);
 }
});
