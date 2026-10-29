"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
require("./ability-definitions.js");
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const PATTERN="auto-named-rider-ride-source-search-v1";
const FAMILY=Object.freeze({
  "cfa-7":{rider:"Blaster Javelin",target:"Blaster Dark"},
  "cfa-40":{rider:"Pupa Mutant, Giraffa",target:"Elite Mutant, Giraffa"},
  "cfa-106":{rider:"Blaupanzer",target:"Blaukluger"},
  "cfa-231":{rider:"Enigman Ripple",target:"Enigman Wave"},
  "cfa-491":{rider:"Amber Dragon, Daylight",target:"Amber Dragon, Dusk"},
});
const SEATS={hostAuthUid:"host-auth",guestAuthUid:"guest-auth",hostSide:"human",guestSide:"bot"};
const CATALOG=loadCatalog();
function abilityFor(cardId){const card=CATALOG.find(value=>String(value.id)===cardId);assert.ok(card);const ability=Engine.parseCardAbilitiesCached(card).find(value=>value.id===`${cardId}:0`);assert.ok(ability);return{card,ability};}
function fixture({cardId="cfa-7",side="bot",riderName=null,wrongSource=false,wrongTarget=false,emptyDeck=false}={}){
  const {card,ability}=abilityFor(cardId),entry=FAMILY[cardId],playerId=side==="human"?"player-host":"player-guest",opponentSide=side==="human"?"bot":"human",opponentId=side==="human"?"player-guest":"player-host";
  const source={uid:`source-${cardId}-${side}`,cardId,cardName:card.name,type:card.type,grade:Number(card.grade),ownerPlayerId:playerId,controllerPlayerId:playerId};
  const rider={uid:`rider-${side}`,cardId:`rider-card-${cardId}`,cardName:riderName||entry.rider,type:"Unit",unitCard:true,grade:2,ownerPlayerId:playerId,controllerPlayerId:playerId};
  const target={uid:`target-${side}`,cardId:`target-card-${cardId}`,cardName:entry.target,type:"Unit",unitCard:true,grade:2,ownerPlayerId:playerId,controllerPlayerId:playerId};
  const unrelated={uid:`unrelated-${side}`,cardId:`unrelated-card-${cardId}`,cardName:"Unrelated Vanguard",type:"Unit",grade:2,ownerPlayerId:playerId,controllerPlayerId:playerId};
  const foreign={...target,uid:`foreign-${side}`,ownerPlayerId:opponentId,controllerPlayerId:opponentId};
  const make=(id,vg,rear,soul,deck)=>({playerId:id,vanguard:vg,rear,soul,deck,drop:[],hand:[],damage:[],bind:[],guardCircle:[],orders:[],crests:[],extra:[],gDeck:[],gZone:[],removed:[],triggerZone:[]});
  const own=make(playerId,rider,Array(5).fill(null),[source],emptyDeck?[]:[...(wrongTarget?[unrelated]:[target]),unrelated]);
  const other=make(opponentId,null,Array(5).fill(null),[],[foreign]);
  const state={matchId:`named-ride-search-${cardId}-${side}`,stateVersion:4,eventSequence:0,processedActionIds:[],processedAbilityTriggers:[],turn:2,side,phase:2,players:{[side]:own,[opponentSide]:other},pendingAbility:null,pendingAbilities:[],pendingTrigger:null,pendingTurnEnd:null};
  const event=Engine.createGameEvent(state,{eventId:`ride-${cardId}-${side}`,type:"card.ridden",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:rider.uid,sourceCardName:rider.cardName,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:rider.uid,subjectCardInstanceId:rider.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:"hand",currentLocation:"vanguard",targetCardInstanceIds:[wrongSource?"different-previous-vanguard":source.uid],targetPreviousLocation:"vanguard",targetCurrentLocation:"soul",targetLocation:"vanguard",phase:"ride",timingWindow:"normal-ride"});
  return{state,event,ability,card,entry,side,playerId,opponentSide,source,rider,target,unrelated,foreign,own,other};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function resolve(f,actor= f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,effectUid=f.target.uid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor,actionId:`resolve-${f.side}-${f.card.id}-${effectUid||"none"}`,expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,effectUid}}},SEATS,Engine);}

test("five real catalog AUTO definitions preserve exact named rider, target, and ride timing",()=>{
  const ids=[];
  for(const [cardId,entry] of Object.entries(FAMILY)){const{ability}=abilityFor(cardId);assert.equal(ability.definition.source.patternId,PATTERN);assert.equal(ability.kind,"AUTO");assert.equal(ability.trigger.eventType,"card.ridden");assert.equal(ability.trigger.subject,"ridden-unit");assert.deepEqual(ability.trigger.circles,["vanguard"]);assert.equal(ability.trigger.riderCardNameEquals,entry.rider);assert.deepEqual(ability.effects,[{op:"search-deck-same-name-to-hand",target:"controller",maximum:1,cardName:entry.target}]);assert.equal(ability.canDecline,false);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,cardId);ids.push(ability.id);}
  assert.deepEqual(ids.sort(),Object.keys(FAMILY).map(id=>`${id}:0`).sort());
});

test("host and joining player receive and resolve only their own exact named-ride search",()=>{
  for(const cardId of Object.keys(FAMILY))for(const side of ["human","bot"]){const f=fixture({cardId,side}),queued=discover(f);assert.equal(queued.queued.length,1,`${cardId}/${side}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);const result=resolve(f);assert.equal(result.ok,true,`${cardId}/${side}: ${result.reason}`);assert.ok(f.own.hand.some(card=>card.uid===f.target.uid));assert.ok(!f.own.deck.some(card=>card.uid===f.target.uid));assert.ok(f.own.deck.some(card=>card.uid===f.unrelated.uid));assert.ok(f.other.deck.some(card=>card.uid===f.foreign.uid));}
});

test("wrong rider, wrong previous Vanguard, and opponent-owned ride do not trigger",()=>{
  for(const changes of [{riderName:"Different Unit"},{wrongSource:true}]){const f=fixture(changes);assert.equal(discover(f).queued.length,0);assert.equal(f.state.pendingAbility,null);assert.ok(f.own.soul.some(card=>card.uid===f.source.uid));}
  const f=fixture(),opponentRide=Engine.createGameEvent(f.state,{eventId:"opponent-ride",type:"card.ridden",actingPlayerId:"player-host",turnPlayerId:"player-host",sourceCardInstanceId:f.rider.uid,sourceCardName:f.rider.cardName,sourceOwnerPlayerId:"player-host",sourceControllerPlayerId:"player-host",subjectCardInstanceId:f.rider.uid,subjectOwnerPlayerId:"player-host",subjectControllerPlayerId:"player-host",previousLocation:"hand",currentLocation:"vanguard",targetCardInstanceIds:[f.source.uid],targetPreviousLocation:"vanguard",targetCurrentLocation:"soul",targetLocation:"vanguard",phase:"ride",timingWindow:"normal-ride"});assert.equal(Reducer.discoverAutoTriggers(f.state,[opponentRide],Engine).queued.length,0);
});

test("up-to-one allows no selection and shuffles without moving a card",()=>{
  for(const side of ["human","bot"]){const f=fixture({side}),queued=discover(f);assert.equal(queued.queued.length,1);const result=resolve(f,side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,null);assert.equal(result.ok,true,result.reason);assert.equal(f.own.hand.length,0);assert.ok(f.own.deck.some(card=>card.uid===f.target.uid));assert.ok(f.own.soul.some(card=>card.uid===f.source.uid));}
});

test("foreign target selection and opponent-forged activation are rejected atomically",()=>{
  const f=fixture();assert.equal(discover(f).queued.length,1);const before=JSON.stringify({own:f.own,other:f.other});assert.equal(resolve(f,SEATS.hostAuthUid,f.foreign.uid).ok,false);assert.equal(JSON.stringify({own:f.own,other:f.other}),before);
  const g=fixture();assert.equal(discover(g).queued.length,1);assert.equal(resolve(g,SEATS.hostAuthUid,g.target.uid).ok,false);assert.ok(g.own.deck.some(card=>card.uid===g.target.uid));
});
