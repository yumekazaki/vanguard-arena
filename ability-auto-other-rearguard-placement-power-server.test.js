"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const FAMILY=["cfa-5766","cfa-6856","cfa-7244"],PATTERN="auto-other-friendly-rearguard-placement-source-power-turn-v1";
const SEATS={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const CATALOG=loadCatalog(),byId=id=>CATALOG.find(card=>String(card.id)===String(id));
const player=playerId=>({playerId,vanguard:null,rear:Array(5).fill(null),hand:[],deck:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],usedAbilities:[]});

function fixture({cardId=FAMILY[0],side="human",sourceCircle="rear-guard",subjectCircle="rear-guard",subjectController="source",sourcePresent=true}={}){
  const card=byId(cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:0`);
  assert.ok(card);assert.ok(ability,`${cardId}:0`);
  const playerId=side==="human"?"host-player":"guest-player",opponentId=side==="human"?"guest-player":"host-player";
  const own=player(playerId),other=player(opponentId);
  const source={uid:`source-${side}-${cardId}`,cardId,cardName:card.name,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,zone:sourceCircle,circle:sourceCircle};
  if(sourcePresent){if(sourceCircle==="vanguard")own.vanguard=source;else own.rear[0]=source;}
  const subjectSide=subjectController==="source"?side:(side==="human"?"bot":"human");
  const subjectOwner=subjectSide===side?own:other,subjectPlayerId=subjectSide===side?playerId:opponentId,subjectInstance={uid:`placed-${side}-${cardId}`,cardId:"test-unit",ownerPlayerId:subjectPlayerId,controllerPlayerId:subjectPlayerId,unitCard:true,zone:"rear-guard",circle:"rear-left"};
  const subjectIndex=subjectSide===side&&sourcePresent&&sourceCircle==="rear-guard"?1:0;
  const actualSubjectCircle=subjectIndex===0?"rear-left":"rear-right";
  if(subjectCircle==="rear-guard")subjectOwner.rear[subjectIndex]=subjectInstance;
  else if(subjectCircle==="vanguard")subjectOwner.vanguard={...subjectInstance,zone:"vanguard",circle:"vanguard"};
  const players=side==="human"?{human:own,bot:other}:{human:other,bot:own};
  const state={matchId:`other-rc-placement-${side}-${cardId}`,stateVersion:1,turn:2,side,phase:4,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,players};
  const eventCircle=subjectCircle==="rear-guard"?actualSubjectCircle:"vanguard";
  const event=Engine.createGameEvent(state,{type:"card.placed",eventId:`placed-${side}-${cardId}-${subjectCircle}-${subjectSide}`,actingPlayerId:subjectPlayerId,turnPlayerId:playerId,sourceCardInstanceId:subjectInstance.uid,sourceOwnerPlayerId:subjectInstance.ownerPlayerId,sourceControllerPlayerId:subjectPlayerId,cardInstanceId:subjectInstance.uid,subjectCardInstanceId:subjectInstance.uid,subjectOwnerPlayerId:subjectInstance.ownerPlayerId,subjectControllerPlayerId:subjectPlayerId,previousLocation:"hand",currentLocation:eventCircle,circle:eventCircle,phase:"main",timingWindow:"call-from-hand"});
  return{state,event,ability,source,subjectInstance,own,other,side,playerId,subjectSide};
}
function decide(f,auth= f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId:`resolve-${f.ability.id}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},SEATS,Engine)}

test("the three exact cross-unit placement abilities compile with strict source and subject semantics",()=>{
  for(const cardId of FAMILY){const f=fixture({cardId});assert.equal(f.ability.kind,"AUTO");assert.equal(f.ability.definition.source.patternId,PATTERN);assert.deepEqual(f.ability.requiredLocation,["vanguard","rear-guard"]);assert.equal(f.ability.trigger.eventType,"card.placed");assert.equal(f.ability.trigger.subject,"any");assert.equal(f.ability.trigger.excludeSourceAsSubject,true);assert.equal(f.ability.trigger.subjectControllerRelation,"source-controller");assert.deepEqual(f.ability.trigger.circles,["rear-guard"]);assert.deepEqual(f.ability.effects,[{op:"modify-power",target:"source",amount:3000,duration:"turn"}]);assert.equal(Reducer.supportsServerAbilityEffects(f.ability),true)}
});

test("host and joining player each resolve only their own source's power increase",()=>{
  for(const side of ["human","bot"])for(const cardId of FAMILY)for(const sourceCircle of ["vanguard","rear-guard"]){const f=fixture({side,cardId,sourceCircle});const result=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(result.queued.length,1,`${side}/${cardId}/${sourceCircle} skipped=${JSON.stringify(result.skipped)}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);const wrong=side==="human"?SEATS.guestAuthUid:SEATS.hostAuthUid;assert.equal(decide(f,wrong).ok,false);assert.equal(decide(f).ok,true);assert.equal(f.source.turnPowerBoost,3000);assert.equal(f.source.turnPowerExpiry,f.playerId);assert.equal(f.subjectInstance.turnPowerBoost,undefined);assert.equal(f.other.rear.every(card=>card===null),true)}
});

test("placement by another controller, self-placement, wrong circle, or absent source cannot trigger",()=>{
  for(const options of [{subjectController:"opponent"},{subjectCircle:"vanguard"},{sourcePresent:false}]){const f=fixture(options);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0,JSON.stringify(options));assert.equal(f.state.pendingAbility,null)}
  const self=fixture();self.event=Engine.createGameEvent(self.state,{...self.event,eventId:"self-place",sourceCardInstanceId:self.source.uid,cardInstanceId:self.source.uid,subjectCardInstanceId:self.source.uid,subjectOwnerPlayerId:self.playerId,subjectControllerPlayerId:self.playerId});assert.equal(Reducer.discoverAutoTriggers(self.state,[self.event],Engine).queued.length,0);
});

test("duplicate placement events cannot resolve the modifier twice and turn cleanup expires it",()=>{
  const f=fixture({side:"bot"});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);assert.equal(decide(f).ok,true);assert.equal(f.source.turnPowerBoost,3000);assert.equal(decide(f).ok,false);assert.equal(f.source.turnPowerBoost,3000);Engine.expireTurnModifiers(f.state,f.playerId);assert.equal(f.source.turnPowerBoost,0);
});
