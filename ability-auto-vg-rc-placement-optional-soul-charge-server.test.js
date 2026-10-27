"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const IDS=[["cfa-11339",1],["cfa-6033",0],["cfa-8117",0]],catalog=loadCatalog();
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};

function fixture(cardId,side,location){
 const card=catalog.find(item=>item.id===cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:${IDS.find(row=>row[0]===cardId)[1]}`),playerId=side==="human"?"player-host":"player-guest";
 const source={uid:`source-${side}-${location}`,cardId,cardName:card.name,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,grade:1};
 const top={uid:`top-${side}-${location}`,cardId:"soul-charge-top",ownerPlayerId:playerId,controllerPlayerId:playerId};
 const player={playerId,rear:location==="vanguard"?[]:[source],vanguard:location==="vanguard"?source:null,deck:[top],hand:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[]};
 const opponentSide=side==="human"?"bot":"human",opponentId=side==="human"?"player-guest":"player-host";
 const players={human:side==="human"?player:{playerId:opponentId,rear:[],deck:[],hand:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[]},bot:side==="bot"?player:{playerId:opponentId,rear:[],deck:[],hand:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[]}};
 const circle=location==="vanguard"?"vanguard":"rear-left",state={matchId:"optional-placement-soul-charge",stateVersion:1,turn:2,side,phase:4,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],pendingAbilities:[],pendingAbility:null,players};
 const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:"hand",currentLocation:circle,circle,phase:"main",timingWindow:"normal-call"});
 return{state,event,ability,source,top,side,playerId,opponentSide};
}

test("three exact VC/RC optional placement abilities preserve their text, circles, and Soul Charge effect",()=>{
 for(const [cardId,index] of IDS){const card=catalog.find(item=>item.id===cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:${index}`);assert.equal(ability.definition?.source?.patternId,"auto-vanguard-or-rearguard-placement-optional-soul-charge-one-v1");assert.equal(ability.canDecline,true);assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);assert.deepEqual(ability.trigger.circles,["vanguard","rear-guard"]);assert.deepEqual(ability.definition.effects,[{op:"soul-charge",count:1}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true);}
});

test("exact VC and RC placement prompts the controlling host or joiner and resolves only their optional Soul Charge",()=>{
 for(const side of ["human","bot"])for(const location of ["vanguard","rear-guard"]){const f=fixture(IDS[0][0],side,location),queued=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(queued.queued.length,1,JSON.stringify(queued));assert.equal(f.state.pendingAbility.side,side);const decline=Reducer.applyAbilityDecision(f.state,{actorAuthUid:side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId:`decline-${side}-${location}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:false,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine);assert.equal(decline.ok,true,decline.reason);assert.equal(f.state.players[side].soul.length,0);}
 for(const side of ["human","bot"])for(const location of ["vanguard","rear-guard"]){const f=fixture(IDS[1][0],side,location);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);const result=Reducer.applyAbilityDecision(f.state,{actorAuthUid:side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId:`accept-${side}-${location}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine);assert.equal(result.ok,true,result.reason);assert.deepEqual(f.state.players[side].soul.map(card=>card.uid),[f.top.uid]);assert.equal(f.state.players[f.opponentSide].soul.length,0);}
});

test("wrong source, wrong circle, forged player, and duplicate placement events cannot create or steal a prompt",()=>{
 const wrongCircle=fixture(IDS[0][0],"bot","rear-guard"),bad=Engine.createGameEvent(wrongCircle.state,{...wrongCircle.event,eventId:"different-circle",currentLocation:"guardian",circle:"guardian"});assert.equal(Reducer.discoverAutoTriggers(wrongCircle.state,[bad],Engine).queued.length,0);
 const wrongSource=fixture(IDS[0][0],"bot","rear-guard"),other=Engine.createGameEvent(wrongSource.state,{...wrongSource.event,eventId:"different-source",sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other"});assert.equal(Reducer.discoverAutoTriggers(wrongSource.state,[other],Engine).queued.length,0);
 const guest=fixture(IDS[0][0],"bot","vanguard");assert.equal(Reducer.discoverAutoTriggers(guest.state,[guest.event],Engine).queued.length,1);const forged=Reducer.applyAbilityDecision(guest.state,{actorAuthUid:seats.hostAuthUid,actionId:"host-forges-guest-skill",expectedStateVersion:guest.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:guest.source.uid,abilityId:guest.ability.id}}},seats,Engine);assert.equal(forged.ok,false);assert.equal(guest.state.players.bot.soul.length,0);assert.equal(Reducer.discoverAutoTriggers(guest.state,[guest.event],Engine).queued.length,0);
});
