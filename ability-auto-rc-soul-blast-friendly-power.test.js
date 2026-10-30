"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog(),IDS=["cfa-2121","cfa-2134","cfa-2144","cfa-2148","cfa-2358"],PATTERN="auto-rc-placement-soul-blast-choose-friendly-power-turn-v1";
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
function card(id,uid,playerId,{power=8000,grade=1,name=null}={}){const def=catalog.find(item=>item.id===id);return{uid,cardId:id,cardName:name||def?.name||id,name:name||def?.name||id,type:"Normal Unit",unitCard:true,grade,power,critical:1,ownerPlayerId:playerId,controllerPlayerId:playerId};}
function fixture(id=IDS[0],side="human",soulCount=1){
  const definition=catalog.find(item=>item.id===id),ability=Engine.parseCardAbilitiesCached(definition).find(item=>item.id===`${id}:0`),playerId=side==="human"?"player-host":"player-guest",opponentId=side==="human"?"player-guest":"player-host",opponentSide=side==="human"?"bot":"human";
  const source=card(id,`source-${id}-${side}`,playerId),target=card("cfa-3",`ally-${id}-${side}`,playerId,{power:8000}),enemy=card("cfa-3",`enemy-${id}-${side}`,opponentId,{power:13000,grade:3}),soul=Array.from({length:soulCount},(_,i)=>card("cfa-3",`soul-${id}-${side}-${i}`,playerId));
  const player=(pid,vg,rear,soulCards)=>({playerId:pid,vanguard:vg,rear,hand:[],soul:soulCards,deck:[],drop:[],bind:[],damage:[],orders:[],crests:[],giftZones:[],extra:[],guardCircle:[],gDeck:[],gZone:[],removed:[],triggerZone:[]});
  const players=side==="human"?{human:player(playerId,card("cfa-3",`vg-${side}`,playerId,{grade:3,power:13000}),[source,target,null,null,null],soul),bot:player(opponentId,enemy,[null,null,null,null,null],[])}:{human:player(opponentId,enemy,[null,null,null,null,null],[]),bot:player(playerId,card("cfa-3",`vg-${side}`,playerId,{grade:3,power:13000}),[source,target,null,null,null],soul)};
  const state={matchId:`auto-sb-friendly-${id}-${side}`,stateVersion:1,eventSequence:0,processedActionIds:[],processedEventIds:[],processedAbilityTriggers:[],pendingAbility:null,pendingAbilities:[],turn:3,phase:4,side,players};
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:"hand",currentLocation:"rear-left",circle:"rear-left",targetLocation:"rear-left",phase:"main",timingWindow:"call-resolution"});
  return{state,event,ability,side,playerId,opponentId,opponentSide,source,target,enemy,soul};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function respond(f,{accept=true,actor=f.side,targetUid=f.target.uid,actionId=`resolve-${f.state.matchId}`,soulUids:fSoulUids=f.soul.map(item=>item.uid)}={}){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,targetUid,costSelections:{sb:fSoulUids}}}},seats,Engine);}

test("all five exact RC-placement abilities preserve source, Soul Blast, optionality, target, and power",()=>{
  for(const id of IDS){const f=fixture(id);assert.equal(f.ability.definition.source.patternId,PATTERN,id);assert.equal(f.ability.kind,"AUTO",id);assert.deepEqual(f.ability.requiredLocation,["rear-guard"],id);assert.deepEqual(f.ability.costs,[{type:"soul-blast",count:1}],id);assert.equal(f.ability.canDecline,true,id);assert.equal(Reducer.supportsServerAbilityEffects(f.ability),true,id);}
});
test("each seat privately resolves its own source, pays one Soul, and powers only a friendly other Unit",()=>{
  for(const id of IDS)for(const side of ["human","bot"]){const f=fixture(id,side),queued=discover(f);assert.equal(queued.queued.length,1,`${id}/${side}`);assert.equal(f.state.pendingAbility.side,side);const done=respond(f);assert.equal(done.ok,true,`${id}/${side}: ${done.reason}`);assert.equal(f.state.players[side].soul.length,0);assert.equal(f.target.turnPowerBoost,5000);assert.equal(f.source.turnPowerBoost||0,0);}
});
test("insufficient Soul, wrong circle, or another instance never creates the prompt",()=>{
  const broke=fixture(IDS[0],"human",0);assert.equal(discover(broke).queued.length,0);
  const wrongCircle=fixture(IDS[0]);wrongCircle.state.players.human.rear[0]=null;wrongCircle.state.players.human.vanguard=wrongCircle.source;wrongCircle.event=Engine.createGameEvent(wrongCircle.state,{...wrongCircle.event,eventId:undefined,sequence:undefined,currentLocation:"vanguard",circle:"vanguard",targetLocation:"vanguard"});assert.equal(discover(wrongCircle).queued.length,0);
  const wrongSource=fixture(IDS[0]);wrongSource.event=Engine.createGameEvent(wrongSource.state,{...wrongSource.event,eventId:undefined,sequence:undefined,sourceCardInstanceId:"other-copy",cardInstanceId:"other-copy",subjectCardInstanceId:"other-copy"});assert.equal(discover(wrongSource).queued.length,0);
});
test("declining is free and only the prompted player can accept the cost",()=>{
  const declined=fixture();assert.equal(discover(declined).queued.length,1);assert.equal(respond(declined,{accept:false}).ok,true);assert.equal(declined.state.players.human.soul.length,1);assert.equal(declined.target.turnPowerBoost||0,0);
  const joining=fixture(IDS[1],"bot");assert.equal(discover(joining).queued.length,1);const before=JSON.stringify(joining.state);assert.equal(respond(joining,{actor:"human"}).ok,false);assert.equal(JSON.stringify(joining.state),before);
});
test("foreign or source targets and duplicate resolutions reject without a second effect",()=>{
  const f=fixture();assert.equal(discover(f).queued.length,1);const before=JSON.stringify(f.state);assert.equal(respond(f,{targetUid:f.enemy.uid}).ok,false);assert.equal(JSON.stringify(f.state),before);assert.equal(respond(f,{targetUid:f.source.uid}).ok,false);assert.equal(JSON.stringify(f.state),before);
  assert.equal(respond(f).ok,true);const after=JSON.stringify(f.state);assert.equal(respond(f).ok,false);assert.equal(JSON.stringify(f.state),after);assert.equal(f.target.turnPowerBoost,5000);
});
