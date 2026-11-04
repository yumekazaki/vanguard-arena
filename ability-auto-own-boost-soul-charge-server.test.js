"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js"),{loadCatalog}=require("./scripts/audit-ability-catalog.js");
const IDS=["cfa-3042","cfa-3392","cfa-4535","cfa-6022","cfa-1691","cfa-10081"],GENERATION_BREAK_IDS=new Set(["cfa-3042","cfa-3392","cfa-4535"]),catalog=loadCatalog(),seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
function definition(id){return catalog.find(card=>card.id===id)}
function instance(id,uid,owner,extra={}){const card=definition(id);return{uid,cardId:id,cardName:card?.name||id,type:card?.type||"Unit",grade:Number(card?.grade||0),ownerPlayerId:owner,controllerPlayerId:owner,...extra}}
function fixture(id,side="bot",generationBreak=true){
  const abilityId=id==="cfa-1691"?"cfa-1691:1":`${id}:0`,card=definition(id),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===abilityId),playerId=side==="human"?"player-host":"player-guest",other=side==="human"?"bot":"human",opponentId=side==="human"?"player-guest":"player-host",attackerId=id==="cfa-1691"?"cfa-1136":id==="cfa-10081"?"cfa-14":"cfa-1",attackerRules=definition(attackerId);
  const source=instance(id,`boost-source-${id}-${side}`,playerId,{zone:"rear-guard",circle:"rear-left",rested:true}),attacker=instance(attackerId,`boosted-unit-${id}-${side}`,playerId,{zone:"vanguard",circle:"vanguard",rested:true});
  const charged=instance("cfa-4",`top-card-${id}-${side}`,playerId,{zone:"deck"}),remaining=instance("cfa-5",`next-card-${id}-${side}`,playerId,{zone:"deck"});
  const own={playerId,vanguard:attacker,rear:[source,null,null,null,null],hand:[],drop:[],soul:[],damage:[],deck:[remaining,charged],bind:[],guardCircle:[],orders:[],gDeck:[],gZone:generationBreak&&id!=="cfa-6022"?[instance("cfa-6",`face-up-g-${id}-${side}`,playerId,{zone:"g-zone",faceUp:true})]:[],triggerZone:[]};
  const op={playerId:opponentId,vanguard:instance("cfa-1",`enemy-vanguard-${id}-${side}`,opponentId,{zone:"vanguard",circle:"vanguard"}),rear:Array(5).fill(null),hand:[],drop:[],soul:[],damage:[],deck:[],bind:[],guardCircle:[],orders:[],gDeck:[],gZone:[],triggerZone:[]};
  const battleId=`boost-battle-${id}-${side}`,state={matchId:"own-boost-soul-charge",stateVersion:1,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],turn:4,phase:"battle",side,players:{[side]:own,[other]:op},pendingAttack:{battleId,attackerUid:attacker.uid,attackerSide:side,attackerZone:"vanguard",attackerPlayerId:playerId,boostUid:source.uid,boostZone:"rear-left",defenderSide:other,defenderPlayerId:opponentId,targetUid:op.vanguard.uid,targetZone:"vanguard"}};
  const event=Engine.createGameEvent(state,{type:"unit.boosted",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,boosterCardInstanceId:source.uid,boostedCardInstanceId:attacker.uid,boostedCardGrade:Number(attackerRules?.grade||0),boostedCardClan:attackerRules?.clan||null,boostedCardClans:attackerRules?.clans||[],previousLocation:"rear-left",currentLocation:"rear-left",circle:"rear-left",targetLocation:"vanguard",targetCardInstanceIds:[attacker.uid],phase:"battle",timingWindow:"boost-step",battleId});
  return{state,own,op,source,attacker,charged,remaining,event,ability,side,playerId};
}
function resolve(f,actionId,accept=true){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:f.side==="human"?"auth-host":"auth-guest",actionId,expectedStateVersion:f.state.stateVersion,payload:{accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[],sb:[],discard:[],gradeSumDiscard:[],reveal:[],retireRearGuard:[]}}}},seats,Engine)}

test("six exact printed boost Soul Charge cards compile to one trusted mechanic with their printed filters",()=>{
  for(const id of IDS){const f=fixture(id),optional=["cfa-1691","cfa-10081"].includes(id);assert.ok(f.ability,id);assert.equal(f.ability.definition?.source?.patternId,"auto-own-boost-soul-charge-v1",id);assert.deepEqual(f.ability.requiredLocation,["rear-guard"],id);assert.equal(f.ability.trigger?.eventType,"unit.boosted",id);assert.equal(f.ability.trigger?.subject,"source",id);assert.equal(f.ability.canDecline,optional,id);assert.equal(Reducer.hasTrustedServerAbilityDefinition(f.ability,Engine),true,id);assert.equal(Reducer.supportsServerAbilityEffects(f.ability),true,id);const changed=structuredClone(f.ability);changed.definition.effects[0].count=2;assert.equal(Reducer.supportsServerAbilityEffects(changed),false,id)}
});

test("each controller's exact boosting instance Soul Charges one card in multiplayer",()=>{
  for(const id of IDS)for(const side of ["human","bot"]){const f=fixture(id,side),discovery=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(discovery.queued.length,1,`${id}/${side}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);const result=resolve(f,`resolve-${id}-${side}`);assert.equal(result.ok,true,result.reason);assert.equal(f.own.soul.some(card=>card.uid===f.charged.uid),true,`${id}/${side} charged card`);assert.equal(f.own.deck.some(card=>card.uid===f.charged.uid),false);assert.equal(f.op.soul.length,0);assert.equal(f.op.deck.length,0)}
});

test("wrong booster identity, mismatched battle, and missing Generation Break do not trigger",()=>{
  for(const id of IDS){const f=fixture(id),wrong=Object.freeze({...f.event,eventId:`wrong-source-${id}`,sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other",boosterCardInstanceId:"other"});assert.equal(Reducer.discoverAutoTriggers(f.state,[wrong],Engine).queued.length,0,id);const g=fixture(id),wrongBattle=Object.freeze({...g.event,eventId:`wrong-battle-${id}`,battleId:"different-battle"});assert.equal(Reducer.discoverAutoTriggers(g.state,[wrongBattle],Engine).queued.length,0,id);if(GENERATION_BREAK_IDS.has(id)){const noGb=fixture(id,"bot",false);assert.equal(Reducer.discoverAutoTriggers(noGb.state,[noGb.event],Engine).queued.length,0,id)}}
});

test("boosted-unit grade and clan filters are exact before optional Soul Charge prompts",()=>{
  const exactGrade=fixture("cfa-1691"),tooHigh=fixture("cfa-1691"),wrongClan=fixture("cfa-1691"),gradeAtLeast=fixture("cfa-10081"),tooLow=fixture("cfa-10081");
  assert.equal(Reducer.discoverAutoTriggers(exactGrade.state,[exactGrade.event],Engine).queued.length,1);
  assert.equal(Reducer.discoverAutoTriggers(tooHigh.state,[Object.freeze({...tooHigh.event,eventId:"boost-grade-four",boostedCardGrade:4})],Engine).queued.length,0);
  assert.equal(Reducer.discoverAutoTriggers(wrongClan.state,[Object.freeze({...wrongClan.event,eventId:"boost-non-genesis",boostedCardClan:"Shadow Paladin",boostedCardClans:["Shadow Paladin"]})],Engine).queued.length,0);
  assert.equal(Reducer.discoverAutoTriggers(gradeAtLeast.state,[gradeAtLeast.event],Engine).queued.length,1);
  assert.equal(Reducer.discoverAutoTriggers(tooLow.state,[Object.freeze({...tooLow.event,eventId:"boost-grade-one",boostedCardGrade:1})],Engine).queued.length,0);
  assert.equal(resolve(exactGrade,"accept-optional-soul-charge").ok,true);
  const decline=fixture("cfa-10081");assert.equal(Reducer.discoverAutoTriggers(decline.state,[decline.event],Engine).queued.length,1);assert.equal(resolve(decline,"decline-optional-soul-charge",false).ok,true);assert.equal(decline.own.soul.length,0);assert.equal(decline.own.deck.some(card=>card.uid===decline.charged.uid),true);
});

test("duplicate delivery of the same boost event cannot queue or resolve the ability twice",()=>{
  const f=fixture("cfa-3042");assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);assert.equal(resolve(f,"resolve-once").ok,true);assert.equal(f.own.soul.filter(card=>card.uid===f.charged.uid).length,1);assert.equal(Reducer.applyAbilityDecision(f.state,{actorAuthUid:"auth-guest",actionId:"resolve-once",expectedStateVersion:f.state.stateVersion-1,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine).ok,false);
});
