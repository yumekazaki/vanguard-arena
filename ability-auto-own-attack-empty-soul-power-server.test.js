"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js"),{loadCatalog}=require("./scripts/audit-ability-catalog.js"),catalog=loadCatalog();
const cards=new Map(catalog.map(card=>[String(card.id),card])),seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const family={"cfa-396":{location:"rear-left",clan:"Oracle Think Tank",text:"AUTO [RC]: When this unit attacks, if you have an «Oracle Think Tank» vanguard, if you do not have any cards in your soul, this unit gets power +3000 until end of that battle."},"cfa-412":{location:"vanguard",clan:null,text:"AUTO [VC/RC]: When this unit attacks, if you do not have any cards in your soul, this unit gets power +3000 until end of that battle."}};
function card(cardId,uid,playerId,extra={}){const def=cards.get(cardId);return{uid,cardId,cardName:def?.name||cardId,grade:Number(def?.grade||0),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,...extra};}
function fixture(cardId="cfa-396",side="human",changes={}){
 const spec=family[cardId],parsed=Engine.parseCardAbilities(cards.get(cardId))[0],ability=parsed,playerId=side==="human"?"player-host":"player-guest",opponentId=side==="human"?"player-guest":"player-host",zone=spec.location;
 const source=card(cardId,`source-${cardId}-${side}`,playerId,{power:10000}),opponentVanguard=card("cfa-14",`opp-vg-${side}`,opponentId,{zone:"vanguard",circle:"vanguard"});
 const ownVanguard=zone==="vanguard"?source:card(changes.wrongClan?"cfa-14":"cfa-381",`own-vg-${side}`,playerId,{zone:"vanguard",circle:"vanguard"});
 const soul=Array.from({length:changes.soulCount??0},(_,i)=>card("cfa-14",`soul-${side}-${i}`,playerId,{zone:"soul"}));
 const players={human:{playerId:"player-host",vanguard:side==="human"?ownVanguard:opponentVanguard,rear:side==="human"&&zone!=="vanguard"?[source,null,null,null,null]:Array(5).fill(null),soul:side==="human"?soul:[],damage:[],hand:[],deck:[],drop:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]},bot:{playerId:"player-guest",vanguard:side==="bot"?ownVanguard:opponentVanguard,rear:side==="bot"&&zone!=="vanguard"?[source,null,null,null,null]:Array(5).fill(null),soul:side==="bot"?soul:[],damage:[],hand:[],deck:[],drop:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]}};
 const state={matchId:"empty-soul-own-attack",stateVersion:1,turn:2,phase:5,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],pendingAbilities:[],players,pendingAttack:{battleId:`battle-${side}`,attackerSide:side,attackerUid:source.uid,attackerPlayerId:playerId,attackerZone:zone,defenderSide:side==="human"?"bot":"human",targetUid:opponentVanguard.uid,targetZone:"vanguard",power:10000,critical:1}};
 let event=Engine.createGameEvent(state,{eventId:`attack-${side}`,type:"unit.attacked",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,attackingCardInstanceIds:[source.uid],currentLocation:zone,previousLocation:zone,targetCardInstanceIds:[opponentVanguard.uid],targetLocation:"vanguard",battleId:`battle-${side}`,phase:"battle",timingWindow:"attack-declared"});
 if(changes.otherSource){event={...event,sourceCardInstanceId:"other-copy",cardInstanceId:"other-copy",subjectCardInstanceId:"other-copy",attackingCardInstanceIds:["other-copy"]};}
 if(changes.wrongBattle)event={...event,battleId:"stale-battle"};
 return{state,event,ability,source,side,playerId};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function resolve(f){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId:`resolve-${f.event.eventId}`,expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine);}

test("both exact empty-Soul attack definitions preserve their text, controller conditions, circles, and battle bonus",()=>{
 for(const [cardId,spec]of Object.entries(family)){const f=fixture(cardId);assert.equal(f.ability.id,`${cardId}:0`);assert.equal(f.ability.definition.source.patternId,"auto-own-attack-empty-soul-power-battle-v1");assert.equal(f.ability.printedText,spec.text);assert.deepEqual(f.ability.requiredLocation,cardId==="cfa-396"?["rear-guard"]:["vanguard","rear-guard"]);assert.deepEqual(f.ability.definition.effects,[{op:"modify-power",target:"source",amount:3000,duration:"battle"}]);assert.equal(Reducer.supportsServerAbilityEffects(f.ability),true);assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(def=>def.id===f.ability.id));}
});
test("host and joining player resolve only their exact attacking source when their Soul is empty",()=>{
 for(const cardId of Object.keys(family))for(const side of ["human","bot"]){const f=fixture(cardId,side);const found=discover(f);assert.equal(found.queued.length,1);assert.equal(f.state.pendingAbility.side,side);assert.equal(resolve(f).ok,true);assert.equal(f.state.pendingAttack.power,13000);}
});
test("non-empty Soul, wrong Oracle Think Tank Vanguard, another attacker, and stale battles cannot trigger",()=>{
 for(const cardId of Object.keys(family)){assert.equal(discover(fixture(cardId,"human",{soulCount:1})).queued.length,0,`${cardId} Soul`);}
 assert.equal(discover(fixture("cfa-396","human",{wrongClan:true})).queued.length,0,"Oracle Think Tank condition");
 assert.equal(discover(fixture("cfa-412","human",{otherSource:true})).queued.length,0,"source instance");
 assert.equal(discover(fixture("cfa-412","human",{wrongBattle:true})).queued.length,0,"battle identity");
});
test("resolution rechecks the source and empty-Soul condition without applying power twice",()=>{
 const f=fixture("cfa-396","bot");assert.equal(discover(f).queued.length,1);f.state.players.bot.soul.push(card("cfa-14","late-soul","player-guest",{zone:"soul"}));const before=f.state.pendingAttack.power;assert.equal(resolve(f).ok,false);assert.equal(f.state.pendingAttack.power,before);
});
