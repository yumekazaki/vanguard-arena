"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const IDS=["cfa-839","cfa-856","cfa-868"],catalog=loadCatalog(),seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
function instance(cardId,uid,pid,extra={}){return{uid,cardId,ownerPlayerId:pid,controllerPlayerId:pid,...extra}}
function fixture({side="human",cardId=IDS[0],clan="Narukami"}={}){
 const card=catalog.find(c=>String(c.id)===cardId),ability=Engine.parseCardAbilitiesCached(card).find(a=>a.id===`${cardId}:2`),pid=side==="human"?"host-player":"guest-player",opp=side==="human"?"guest-player":"host-player";
 const source=instance(cardId,`source-${side}`,pid),vgId=clan==="Narukami"?"cfa-864":"cfa-3",vg=instance(vgId,`vg-${side}`,pid,vgId==="cfa-3"?{clan,clans:[clan]}:{}),target=instance("cfa-3",`target-${side}`,opp);
 const own={playerId:pid,vanguard:vg,rear:[source,null,null,null,null],hand:[],deck:[],drop:[],soul:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]},other={playerId:opp,vanguard:target,rear:Array(5).fill(null),hand:[],deck:[],drop:[],soul:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]};
 const battleId=`battle-${side}-${cardId}`,state={matchId:`narukami-own-attack-${side}-${cardId}`,stateVersion:1,turn:2,side,phase:5,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,players:side==="human"?{human:own,bot:other}:{human:other,bot:own},pendingAttack:{battleId,attackerSide:side,attackerUid:source.uid,attackerPlayerId:pid,attackerZone:"rear-left",defenderSide:side==="human"?"bot":"human",targetUid:target.uid,targetZone:"vanguard",power:8000,critical:1}};
 const event=Engine.createGameEvent(state,{type:"unit.attacked",actingPlayerId:pid,turnPlayerId:pid,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:pid,sourceControllerPlayerId:pid,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:pid,subjectControllerPlayerId:pid,attackingCardInstanceIds:[source.uid],currentLocation:"rear-left",previousLocation:"rear-left",targetCardInstanceIds:[target.uid],targetLocation:"vanguard",battleId,phase:"battle",timingWindow:"attack-declared"});
 return{state,event,ability,source,side,pid};
}
function resolve(f){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId:`resolve-${f.side}-${f.ability.cardId}`,expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine)}

test("three real Narukami autos compile as exact RC own-attack battle bonuses",()=>{
 for(const id of IDS){const card=catalog.find(c=>String(c.id)===id),ability=Engine.parseCardAbilitiesCached(card).find(a=>a.id===`${id}:2`);assert.equal(ability.definition.source.patternId,"auto-rc-narukami-own-attack-power-battle-v1");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.conditions,[{type:"controller-vanguard-has-clan",value:"Narukami"}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,id)}
});
test("the owner on either seat resolves only its own attack bonus",()=>{
 for(const side of ["human","bot"])for(const id of IDS){const f=fixture({side,cardId:id}),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,JSON.stringify({side,id,skipped:found.skipped,event:f.event,ability:f.ability}));assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);const denied=Reducer.applyAbilityDecision(f.state,{actorAuthUid:side==="human"?seats.guestAuthUid:seats.hostAuthUid,actionId:`denied-${side}-${id}`,expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine);assert.equal(denied.ok,false);const result=resolve(f);assert.equal(result.ok,true,result.reason);assert.equal(f.state.pendingAttack.power,10000)}
});
test("a different attacker and a non-Narukami Vanguard do not create a prompt",()=>{
 const wrongSource=fixture({side:"bot"}),unrelated={...wrongSource.event,sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other",attackingCardInstanceIds:["other"]};assert.equal(Reducer.discoverAutoTriggers(wrongSource.state,[unrelated],Engine).queued.length,0);
 const wrongClan=fixture({side:"human",clan:"Kagero"});assert.equal(Reducer.discoverAutoTriggers(wrongClan.state,[wrongClan.event],Engine).queued.length,0);
});
