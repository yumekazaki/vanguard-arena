"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
Engine.registerCardAbilityKeywordIndex(require("./card-ability-keywords.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog();
const IDS=["cfa-13823","cfa-13830","cfa-13844","cfa-13891","cfa-13921"];
const TEXT="AUTO: When this unit is placed on RC from hand, if you have a grade 3 or greater vanguard, choose up to one normal unit without sentinel from your drop, and put it on the bottom of the deck. If you chose a card, this unit gets power +2000 until end of turn.";
const SEATS={hostAuthUid:"host-auth",guestAuthUid:"guest-auth",hostSide:"human",guestSide:"bot"};
const def=id=>{const card=catalog.find(item=>String(item.id)===String(id));assert.ok(card,`catalog card ${id}`);return card};
const make=(definition,uid,playerId,extra={})=>({uid,cardId:String(definition.id),cardName:definition.name,type:definition.type,grade:Number(definition.grade),shield:Number(definition.shield||0),triggerType:definition.trigger||null,ownerPlayerId:playerId,controllerPlayerId:playerId,...extra});
const triggerDef=catalog.find(card=>/trigger/i.test(String(card.type||""))&&String(card.trigger||"").toLowerCase()==="draw");
function fixture(cardId=IDS[0],side="human"){
  const ownerId=side==="human"?"player-host":"player-guest",opponentSide=side==="human"?"bot":"human",opponentId=opponentSide==="human"?"player-host":"player-guest";
  const source=make(def(cardId),`source-${side}`,ownerId),vanguard=make(def("cfa-31"),`vanguard-${side}`,ownerId,{grade:3});
  const eligible=make(def("cfa-1"),`drop-unit-${side}`,ownerId),sentinel=make(def("cfa-15"),`drop-sentinel-${side}`,ownerId),trigger=make(triggerDef,`drop-trigger-${side}`,ownerId);
  const opponentVanguard=make(def("cfa-14"),`opponent-vanguard-${side}`,opponentId,{grade:2});
  const player=(id,vg,rear,drop)=>({playerId:id,vanguard:vg,rear,hand:[],deck:[],damage:[],drop,soul:[],bind:[],guardCircle:[],triggerZone:[],orders:[],crests:[],extra:[],gDeck:[],gZone:[],removed:[]});
  const rear=Array(5).fill(null);rear[0]=source;
  const state={matchId:"normal-drop-bottom",stateVersion:1,processedActionIds:[],processedAbilityTriggers:[],turn:2,phase:3,side,players:{human:player("player-host",side==="human"?vanguard:opponentVanguard,side==="human"?rear:Array(5).fill(null),side==="human"?[eligible,sentinel,trigger]:[]),bot:player("player-guest",side==="bot"?vanguard:opponentVanguard,side==="bot"?rear:Array(5).fill(null),side==="bot"?[eligible,sentinel,trigger]:[])}};
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:"hand",currentLocation:"rear-left",circle:"rear-left",phase:"main",timingWindow:"normal-call"});
  const ability=Engine.parseCardAbilitiesCached(def(cardId)).find(item=>item.id===`${cardId}:0`);
  return{state,event,ability,source,eligible,sentinel,trigger,side,ownerId};
}
function discover(f,event){return Reducer.discoverAutoTriggers(f.state,[event||f.event],Engine)}
function resolve(f,effectUid,authUid=f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid){const pending=f.state.pendingAbility;return Reducer.applyAbilityDecision(f.state,{actorAuthUid:authUid,actionId:`resolve-${f.side}-${effectUid||"none"}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:pending?.ability?.id||f.ability.id,effectUid:effectUid||null}}},SEATS,Engine)}

test("the five exact AUTO abilities preserve the from-hand RC trigger, Grade 3 gate, optional target, and conditional +2000",()=>{
  assert.equal(IDS.length,5);
  for(const cardId of IDS){const card=def(cardId),abilities=Engine.parseCardAbilitiesCached(card),ability=abilities[0];assert.equal(abilities.length,1,cardId);assert.equal(ability.printedText,TEXT,cardId);assert.equal(ability.raw,TEXT.replace(/^AUTO:\s*/,""),cardId);assert.equal(ability.definition.source.patternId,"auto-rc-placement-hand-normal-drop-bottom-power-v1");assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.equal(ability.trigger.status,"recognized-trigger");assert.equal(ability.trigger.eventType,"card.placed");assert.equal(ability.trigger.subject,"source");assert.deepEqual(ability.trigger.circles,["rear-guard"]);assert.equal(ability.trigger.sourceLocation,"hand");assert.deepEqual(ability.conditions,[{type:"controller-vanguard-grade-at-least",count:3}]);assert.equal(ability.canDecline,false);assert.deepEqual(ability.definition.effects,[{op:"put-chosen-normal-drop-to-deck-bottom",target:"chosen",destination:"deck-bottom",optionalTarget:true,filter:{cardType:"normal-unit",excludeSentinel:true}},{op:"modify-power",target:"source",amount:2000,duration:"turn",ifPreviousEffectSucceeded:0}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,cardId);}
});

test("host and joining player independently resolve the exact source placement and may put one eligible Drop unit on Deck bottom",()=>{
  for(const side of ["human","bot"]){const f=fixture(IDS[0],side);assert.equal(discover(f).queued.length,1);assert.equal(f.state.pendingAbility.side,side);const result=resolve(f,f.eligible.uid);assert.equal(result.ok,true,`${side}: ${result.reason}`);const player=f.state.players[side];assert.equal(player.drop.some(card=>card.uid===f.eligible.uid),false);assert.equal(player.deck[0].uid,f.eligible.uid);assert.equal(f.source.turnPowerBoost,2000);assert.equal(player.drop.some(card=>card.uid===f.sentinel.uid),true);assert.equal(player.drop.some(card=>card.uid===f.trigger.uid),true);assert.ok(result.events.some(event=>event.type==="card.moved"&&event.cardInstanceId===f.eligible.uid&&event.previousLocation==="drop"&&event.destinationPosition==="bottom"));}
});

test("no target is a legal up-to-one choice and does not grant power",()=>{const f=fixture();assert.equal(discover(f).queued.length,1);const result=resolve(f,null);assert.equal(result.ok,true,result.reason);assert.equal(f.source.turnPowerBoost,undefined);assert.equal(f.state.players.human.drop.length,3);});

test("another source, another circle, non-hand placement, or a Vanguard below Grade 3 cannot trigger",()=>{
  const changes=[{sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other"},{previousLocation:"drop"},{currentLocation:"vanguard",circle:"vanguard"}];
  for(const change of changes){const f=fixture(),event=Engine.createGameEvent(f.state,{...f.event,...change,eventId:undefined});assert.equal(discover(f,event).queued.length,0,JSON.stringify(change));}
  const wrongGrade=fixture();wrongGrade.state.players.human.vanguard=make(def("cfa-14"),"vanguard-human","player-host");assert.equal(discover(wrongGrade).queued.length,0,JSON.stringify(discover(wrongGrade)));
});

test("trigger and Sentinel cards, foreign-owned cards, stale selections, and forged owners are rejected atomically",()=>{
  const f=fixture();assert.equal(discover(f).queued.length,1);let before=JSON.stringify(f.state);let result=resolve(f,f.trigger.uid);assert.equal(result.ok,false);assert.equal(JSON.stringify(f.state),before);
  const sentinel=fixture();assert.equal(discover(sentinel).queued.length,1);before=JSON.stringify(sentinel.state);result=resolve(sentinel,sentinel.sentinel.uid);assert.equal(result.ok,false);assert.equal(JSON.stringify(sentinel.state),before);
  const foreign=fixture(),foreignCard=make(def("cfa-1"),"foreign-drop","player-guest");foreign.state.players.human.drop.push(foreignCard);assert.equal(discover(foreign).queued.length,1);before=JSON.stringify(foreign.state);result=resolve(foreign,foreignCard.uid);assert.equal(result.ok,false);assert.equal(JSON.stringify(foreign.state),before);
  const stale=fixture();assert.equal(discover(stale).queued.length,1);stale.state.players.human.drop=stale.state.players.human.drop.filter(card=>card.uid!==stale.eligible.uid);before=JSON.stringify(stale.state);result=resolve(stale,stale.eligible.uid);assert.equal(result.ok,false);assert.equal(JSON.stringify(stale.state),before);
  const source=fixture();assert.equal(discover(source).queued.length,1);result=resolve(source,source.eligible.uid,SEATS.guestAuthUid);assert.equal(result.ok,false);assert.equal(source.source.turnPowerBoost,undefined);
});

test("condition and target are revalidated immediately before resolution",()=>{
  const condition=fixture();assert.equal(discover(condition).queued.length,1);condition.state.players.human.vanguard=make(def("cfa-14"),"vanguard-human","player-host");const before=JSON.stringify(condition.state);const rejected=resolve(condition,condition.eligible.uid);assert.equal(rejected.ok,false,JSON.stringify(rejected));assert.equal(JSON.stringify(condition.state),before);
});
