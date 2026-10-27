"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog();
const ids=["cfa-10187","cfa-9686","cfa-9765","cfa-9766","cfa-9767","cfa-9768"];
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
function card(cardId,uid,playerId,extra={}){const def=catalog.find(item=>String(item.id)===cardId);assert.ok(def);return{uid,cardId,cardName:def.name,type:def.type||"Unit",grade:Number(def.grade||0),power:Number(def.power||0),critical:1,ownerPlayerId:playerId,controllerPlayerId:playerId,...extra}}
function fixture({side="bot",baseCritical=1,attackCritical=2,abilityCriticalBoost=0,previousLocation="hand"}={}){
  const other=side==="human"?"bot":"human",ownerId=side==="human"?"host":"guest",attackerId=side==="human"?"guest":"host";
  const cardId=ids[0],def=catalog.find(item=>String(item.id)===cardId),source=card(cardId,`guard-${side}`,ownerId,{zone:"guardian",circle:"guardian"});
  const attacker=card("cfa-3",`attacker-${side}`,attackerId,{critical:baseCritical,zone:"vanguard"});
  const player=(id,vg,guardCircle=[])=>({playerId:id,vanguard:vg,rear:[],hand:[],soul:[],drop:[],deck:[],damage:[],bind:[],orders:[],guardCircle,gDeck:[],gZone:[],triggerZone:[]});
  const players=side==="human"?{human:player(ownerId,card("cfa-3","vg-human",ownerId),[source]),bot:player(attackerId,attacker)}:{human:player(attackerId,attacker),bot:player(ownerId,card("cfa-3","vg-bot",ownerId),[source])};
  const attack={battleId:"critical-shield-battle",attackerSide:other,attackerUid:attacker.uid,attackerZone:"vanguard",defenderSide:side,targetUid:`vg-${side}`,targetZone:"vanguard",guardCards:[source],power:18000,targetPower:10000,critical:attackCritical,abilityCriticalBoost};
  const state={matchId:"qualifying-critical-shield",stateVersion:1,turn:4,side:other,phase:5,eventSequence:0,processedEventIds:[],processedActionIds:[],processedAbilityTriggers:[],pendingAbilities:[],players,pendingAttack:attack};
  const ability=Engine.parseCardAbilities(def).find(item=>item.definition?.source?.patternId==="auto-gc-qualifying-critical-shield-battle-v1");assert.ok(ability);Engine.registerAbilityDefinitions([ability.definition]);
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:ownerId,turnPlayerId:attackerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation,currentLocation:"guardian",circle:"guardian",phase:"battle",timingWindow:"guard-placement",battleId:attack.battleId});
  return{side,ownerId,source,attacker,ability,state,event};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine)}
function resolve(f,authUid=f.side==="human"?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:authUid,actionId:`resolve-${f.side}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[],sb:[],discard:[],reveal:[]}}}},seats,Engine)}

test("the six exact critical-based GC AUTO records compile and are server-supported",()=>{for(const cardId of ids){const def=catalog.find(item=>String(item.id)===cardId);const ability=Engine.parseCardAbilities(def).find(item=>item.definition?.source?.patternId==="auto-gc-qualifying-critical-shield-battle-v1");assert.ok(ability,cardId);assert.equal(ability.id,`${cardId}:0`);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,cardId)}});
test("the defending host or joining player privately receives and resolves the shield skill",()=>{for(const side of ["human","bot"]){const f=fixture({side,baseCritical:1,attackCritical:2,abilityCriticalBoost:1});assert.equal(discover(f).queued.length,1,JSON.stringify({ability:f.ability,attack:f.state.pendingAttack,source:f.source}));assert.equal(f.state.pendingAbility.side,side);const result=resolve(f);assert.equal(result.ok,true,result.reason);assert.equal(f.source.battleShieldBoost,15000);assert.equal(f.source.battleShieldExpiryBattleId,f.state.pendingAttack.battleId)}});
test("the AUTO does not trigger below critical two or for trigger-only critical increase",()=>{for(const values of [{baseCritical:1,attackCritical:1,abilityCriticalBoost:0},{baseCritical:1,attackCritical:2,abilityCriticalBoost:0}]){const f=fixture(values);assert.equal(discover(f).queued.length,0,JSON.stringify(values))}});
test("original critical two qualifies and unrelated battle or guard instance does not",()=>{const f=fixture({baseCritical:2,attackCritical:2});assert.equal(discover(f).queued.length,1,JSON.stringify({ability:f.ability,attack:f.state.pendingAttack,source:f.source}));const other=fixture({baseCritical:2,attackCritical:2});const bad=Engine.createGameEvent(other.state,{...other.event,eventId:"wrong-battle",battleId:"different-battle"});assert.equal(Reducer.discoverAutoTriggers(other.state,[bad],Engine).queued.length,0);const changed=fixture({baseCritical:2,attackCritical:2});const forged=Engine.createGameEvent(changed.state,{...changed.event,eventId:"wrong-source",cardInstanceId:"different-card",subjectCardInstanceId:"different-card",sourceCardInstanceId:"different-card"});assert.equal(Reducer.discoverAutoTriggers(changed.state,[forged],Engine).queued.length,0)});
test("an unauthorized host cannot resolve the joining player's GC ability",()=>{const f=fixture({side:"bot",baseCritical:2,attackCritical:2});assert.equal(discover(f).queued.length,1,JSON.stringify({ability:f.ability,attack:f.state.pendingAttack,source:f.source}));const result=resolve(f,seats.hostAuthUid);assert.equal(result.ok,false);assert.equal(f.source.battleShieldBoost,undefined)});
