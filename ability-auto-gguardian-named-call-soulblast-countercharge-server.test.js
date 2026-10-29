"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const FAMILY=[["cfa-4699","Meteokaiser, Gundreed"],["cfa-4703","Sheltered Heiress, Spangled"],["cfa-4732","Oceanic Conversion, Atlantis Dolphin"],["cfa-4736","Sky Guardian Supreme Dragon, Impede Dragon"],["cfa-4742","Darkness that Lights Up Demise, Lacus Carina"],["cfa-4748","Supreme Heavenly Emperor Dragon, Advance Guard Dragon"]];
const PATTERN="auto-g-guardian-named-call-soul-blast-counter-charge-v1",SEATS={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"},CATALOG=loadCatalog(),byId=id=>CATALOG.find(card=>String(card.id)===String(id));
const player=playerId=>({playerId,vanguard:null,rear:Array(5).fill(null),hand:[],deck:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],usedAbilities:[]});

function fixture({family=FAMILY[0],side="human",faceUpDamage=1,faceDownDamage=1,soulCount=1}={}){
  const[cardId,calledName]=family,card=byId(cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:0`),guardianCard=CATALOG.find(item=>item.name===calledName);
  assert.ok(card);assert.ok(ability,`${cardId}:0`);assert.ok(guardianCard,`G Guardian definition ${calledName}`);
  const ownId=side==="human"?"host-player":"guest-player",opponentId=side==="human"?"guest-player":"host-player",own=player(ownId),other=player(opponentId),source={uid:`source-${cardId}-${side}`,cardId,ownerPlayerId:ownId,controllerPlayerId:ownId,cardName:card.name,zone:"drop"};
  own.drop.push(source);
  const guardian={uid:`guardian-${cardId}-${side}`,cardId:guardianCard.id,ownerPlayerId:ownId,controllerPlayerId:ownId,zone:"guardian",circle:"guardian",faceUp:true};own.guardCircle.push(guardian);
  for(let i=0;i<faceUpDamage;i++)own.damage.push({uid:`damage-up-${i}`,cardId:"test-damage",ownerPlayerId:ownId,controllerPlayerId:ownId,faceDown:false});
  for(let i=0;i<faceDownDamage;i++)own.damage.push({uid:`damage-down-${i}`,cardId:"test-damage",ownerPlayerId:ownId,controllerPlayerId:ownId,faceDown:true});
  for(let i=0;i<soulCount;i++)own.soul.push({uid:`soul-${i}`,cardId:"test-soul",ownerPlayerId:ownId,controllerPlayerId:ownId});
  const players=side==="human"?{human:own,bot:other}:{human:other,bot:own};
  const state={matchId:`gguardian-soulblast-${cardId}-${side}`,stateVersion:1,turn:3,side:side==="human"?"bot":"human",phase:5,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,players};
  const event=Engine.createGameEvent(state,{type:"card.discarded",eventId:`discard-${cardId}-${side}`,actingPlayerId:ownId,turnPlayerId:opponentId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownId,sourceControllerPlayerId:ownId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownId,subjectControllerPlayerId:ownId,previousLocation:"hand",currentLocation:"drop",discardReason:"g-guardian-cost",calledGUnitCardId:guardian.cardId,calledGUnitInstanceId:guardian.uid,calledGUnitCardName:calledName,calledGUnitPreviousLocation:"g-deck",phase:"battle",timingWindow:"g-guardian-cost"});
  return{state,event,ability,source,guardian,own,other,side,ownId,opponentId};
}
function decide(f,{accept=true,auth=f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,selection={}}={}){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId:`resolve-${f.side}-${f.ability.id}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,...selection}}},SEATS,Engine)}

test("six exact G-Guardian cost abilities compile their called-card, Damage, optional Soul Blast, and Counter-Charge rules",()=>{
  for(const[cardId,name]of FAMILY){const f=fixture({family:[cardId,name]});assert.equal(f.ability.kind,"AUTO");assert.equal(f.ability.definition.source.patternId,PATTERN);assert.equal(f.ability.definition.calledGUnitName,name);assert.deepEqual(f.ability.conditions,[{type:"controller-face-up-damage-at-most",count:1}]);assert.deepEqual(f.ability.costs,[{type:"soul-blast",count:1}]);assert.equal(f.ability.canDecline,true);assert.deepEqual(f.ability.effects,[{op:"counter-charge",count:1}]);assert.equal(Reducer.supportsServerAbilityEffects(f.ability),true)}
});

test("host and joining player privately resolve the optional Soul Blast and Counter-Charge for their own called G Guardian",()=>{
  for(const side of ["human","bot"])for(const family of FAMILY){const f=fixture({side,family});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1,`${side}/${family[0]}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.ownId);const wrong=side==="human"?SEATS.guestAuthUid:SEATS.hostAuthUid;assert.equal(decide(f,{auth:wrong,selection:{costSelections:{sb:[f.own.soul[0].uid]},damageUids:[f.own.damage[1].uid]}}).ok,false);assert.equal(f.own.soul.length,1);assert.equal(f.own.damage[1].faceDown,true);const result=decide(f,{selection:{costSelections:{sb:[f.own.soul[0].uid]},damageUids:[f.own.damage[1].uid]}});assert.equal(result.ok,true,result.reason);assert.equal(f.own.soul.length,0);assert.equal(f.own.damage[1].faceDown,false);assert.equal(f.other.damage.length,0);assert.equal(decide(f).reason,"duplicate-action")}
});

test("the optional AUTO can be declined without paying Soul Blast or altering Damage",()=>{
  const f=fixture();assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);const result=decide(f,{accept:false});assert.equal(result.ok,true,result.reason);assert.equal(f.own.soul.length,1);assert.equal(f.own.damage[1].faceDown,true);
});

test("wrong called G Guardian, discarded copy, cause, owner, Damage threshold, and unpayable Soul Blast are rejected",()=>{
  for(const change of [{calledGUnitCardName:"other G Guardian"},{sourceCardInstanceId:"different-copy",cardInstanceId:"different-copy",subjectCardInstanceId:"different-copy"},{discardReason:"ordinary-cost"},{sourceOwnerPlayerId:"guest-player",subjectOwnerPlayerId:"guest-player",sourceControllerPlayerId:"guest-player",subjectControllerPlayerId:"guest-player",actingPlayerId:"guest-player"},{calledGUnitPreviousLocation:"hand"}]){const f=fixture();const event=Engine.createGameEvent(f.state,{...f.event,...change,eventId:undefined});assert.equal(Reducer.discoverAutoTriggers(f.state,[event],Engine).queued.length,0,JSON.stringify(change))}
  const tooMuch=fixture({faceUpDamage:2});assert.equal(Reducer.discoverAutoTriggers(tooMuch.state,[tooMuch.event],Engine).queued.length,0);
  const noSoul=fixture({soulCount:0});assert.equal(Reducer.discoverAutoTriggers(noSoul.state,[noSoul.event],Engine).queued.length,0);assert.equal(noSoul.state.pendingAbility,null);
});

test("condition and Soul Blast are revalidated before resolution and duplicate events cannot pay twice",()=>{
  const f=fixture({side:"bot"});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);f.own.damage.push({uid:"damage-up-extra",cardId:"test-damage",ownerPlayerId:f.ownId,controllerPlayerId:f.ownId,faceDown:false});const snapshot=JSON.stringify(f.state);assert.equal(decide(f,{selection:{costSelections:{sb:[f.own.soul[0].uid]},damageUids:[f.own.damage[1].uid]}}).ok,false);assert.equal(f.own.soul.length,1);assert.equal(JSON.stringify(f.state),snapshot);
  f.own.damage.pop();f.own.soul=[];assert.equal(decide(f,{selection:{costSelections:{sb:[]},damageUids:[f.own.damage[1].uid]}}).ok,false);assert.equal(f.own.damage[1].faceDown,true);
});
