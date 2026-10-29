"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog();
const PATTERN="cont-vanguard-own-turn-rearguard-clan-count-power-v1";
const FAMILY=new Map([
  ["cfa-1232",{clan:"Bermuda Triangle",amount:2000,index:1}],
  ["cfa-1645",{clan:"Granblue",amount:3000,index:1}],
  ["cfa-1945",{clan:"Bermuda Triangle",amount:2000,index:1}],
  ["cfa-588",{clan:"Bermuda Triangle",amount:3000,index:0}],
  ["cfa-592",{clan:"Bermuda Triangle",amount:3000,index:0}],
]);
const SEATS={hostAuthUid:"host-auth",guestAuthUid:"guest-auth",hostSide:"human",guestSide:"bot"};
function fixture({cardId="cfa-1232",side="human",clanCount=4,opponentClanCount=0,defendingOwnerTurn=false,duplicateUid=false}={}){
  const card=catalog.find(value=>value.id===cardId),entry=FAMILY.get(cardId),ability=Engine.parseCardAbilitiesCached(card).find(value=>value.id===`${cardId}:${entry.index}`),ownerId=side==="human"?"player-host":"player-guest",opponentSide=side==="human"?"bot":"human",opponentId=side==="human"?"player-guest":"player-host";
  assert.ok(ability,`${cardId} definition exists`);
  const source={uid:`source-${cardId}-${side}`,cardId,cardName:card.name,type:"Unit",unitCard:true,grade:Number(card.grade),power:Number(card.power),critical:1,clan:entry.clan,clans:[entry.clan],ownerPlayerId:ownerId,controllerPlayerId:ownerId};
  const makeRear=(controllerId,prefix,count,clan)=>Array.from({length:5},(_,index)=>index<count?{uid:duplicateUid&&index===1?`${prefix}-rg-0`:`${prefix}-rg-${index}`,cardId:`${prefix}-card-${index}`,cardName:`${clan} Rear ${index}`,type:"Unit",unitCard:true,grade:1,power:8000,clan,clans:[clan],ownerPlayerId:controllerId,controllerPlayerId:controllerId}:null);
  const ownRear=makeRear(ownerId,`own-${cardId}-${side}`,clanCount,entry.clan),opponentRear=makeRear(opponentId,`opp-${cardId}-${side}`,opponentClanCount,entry.clan);
  const otherVanguard={uid:`other-vg-${cardId}-${side}`,cardId:"other-vg",cardName:"Other Vanguard",type:"Unit",unitCard:true,grade:3,power:13000,critical:1,clan:"Kagero",clans:["Kagero"],ownerPlayerId:opponentId,controllerPlayerId:opponentId};
  const makePlayer=(id,vanguard,rear)=>({playerId:id,vanguard,rear,hand:[],soul:[],drop:[],damage:[],deck:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[],removed:[],crests:[],extra:[]});
  const owner=makePlayer(ownerId,source,ownRear),opponent=makePlayer(opponentId,otherVanguard,opponentRear);
  const activeSide=defendingOwnerTurn?opponentSide:side,attackerSide=activeSide===side?side:opponentSide,attackerPlayer=activeSide===side?owner:opponent,defenderPlayer=activeSide===side?opponent:owner;
  const attacker=attackerPlayer.vanguard;
  const state={matchId:`cont-clan-count-${cardId}-${side}`,stateVersion:1,turn:4,side:activeSide,phase:5,firstTurnComplete:true,eventSequence:0,processedActionIds:[],processedAbilityTriggers:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,pendingAttack:null,players:{[side]:owner,[opponentSide]:opponent}};
  const command={actorAuthUid:attackerSide==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,actionId:`attack-${state.matchId}`,expectedStateVersion:state.stateVersion,payload:{type:"game-action",action:"attack",attackerCardInstanceId:attacker.uid,targetCardInstanceId:defenderPlayer.vanguard.uid}};
  return{card,ability,entry,state,command,source,owner,opponent,side,ownerId,opponentId,defendingOwnerTurn,ownRear,opponentRear};
}
function attack(f){return Reducer.applyGameAction(f.state,f.command,SEATS,Engine);}

test("five real Vanguard CONT abilities compile exact clan count, turn, circle, and printed power",()=>{
  for(const [cardId,expected] of FAMILY){const card=catalog.find(value=>value.id===cardId),ability=Engine.parseCardAbilitiesCached(card).find(value=>value.definition?.source?.patternId===PATTERN);assert.ok(ability,cardId);assert.equal(ability.id,`${cardId}:${expected.index}`);assert.equal(ability.kind,"CONT");assert.deepEqual(ability.requiredLocation,["vanguard"]);assert.equal(ability.definition.effects[0].amount,expected.amount);assert.deepEqual(ability.definition.effects[0].condition,{op:"all",conditions:[{op:"controller-turn"},{op:"controller-rearguard-clan-count-at-least",clan:expected.clan,count:4}]});assert.equal(ability.conditionStatus,"modeled");}
});

test("both players get exact continuous power at four friendly clan Rear-Guards",()=>{
  for(const [cardId] of FAMILY)for(const side of ["human","bot"]){const f=fixture({cardId,side}),result=attack(f);assert.equal(result.ok,true,`${cardId}/${side}: ${result.reason}`);assert.equal(f.state.pendingAttack.power,Number(f.state.players[side].vanguard.power)+f.entry.amount,`${cardId}/${side}`);}
});

test("fewer than four, wrong-clan, duplicate, and opposing Rear-Guards do not satisfy the CONT",()=>{
  const evaluate=f=>Engine.evaluateContinuousEffects([f.ability],{sourceLocation:"vanguard",location:"vanguard",sourceInstanceId:f.source.uid,targetInstanceId:f.source.uid,isControllerTurn:true,controllerFieldCards:[{uid:f.source.uid,zone:"vanguard"},...f.ownRear.filter(Boolean).map(card=>({uid:card.uid,zone:"rear-guard",clan:card.clan,clans:card.clans}))]});
  for(const [cardId] of FAMILY){const base=fixture({cardId,clanCount:3,opponentClanCount:5}),three=attack(base);assert.equal(three.ok,true,three.reason);assert.equal(base.state.pendingAttack.power,Number(base.source.power));
    const offClan=fixture({cardId,clanCount:3});offClan.ownRear[3]={uid:`off-${cardId}`,cardId:"off-clan",cardName:"Wrong Clan",type:"Unit",grade:1,power:8000,clan:"Kagero",clans:["Kagero"],ownerPlayerId:offClan.ownerId,controllerPlayerId:offClan.ownerId};assert.equal(evaluate(offClan).power,0,cardId);
    const duplicate=fixture({cardId,clanCount:4,duplicateUid:true});assert.equal(evaluate(duplicate).power,0,cardId);}
});

test("Vanguard requirement and controller-turn condition remain continuous",()=>{
  const f=fixture({cardId:"cfa-1232",clanCount:4}),context={location:"rear-guard",sourceInstanceId:f.source.uid,targetInstanceId:f.source.uid,isControllerTurn:true,controllerFieldCards:[{uid:f.source.uid,zone:"vanguard"},...f.ownRear.filter(Boolean).map(card=>({uid:card.uid,zone:"rear-guard",clan:card.clan,clans:card.clans}))]};assert.deepEqual(Engine.evaluateContinuousEffects([f.ability],context),{power:0,critical:0,drive:0});context.location="vanguard";context.isControllerTurn=false;assert.deepEqual(Engine.evaluateContinuousEffects([f.ability],context),{power:0,critical:0,drive:0});
  const defending=fixture({cardId:"cfa-1232",side:"human",clanCount:4,defendingOwnerTurn:true}),result=attack(defending);assert.equal(result.ok,true,result.reason);assert.equal(defending.state.pendingAttack.targetPower,Number(defending.source.power));
});
