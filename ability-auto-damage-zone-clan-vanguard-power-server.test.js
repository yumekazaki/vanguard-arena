"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const FAMILY=["cfa-717","cfa-725","cfa-732"];
const PATTERN="auto-vc-rc-own-damage-zone-angel-feather-vanguard-power-turn-v1";
const TEXT="AUTO [VC/RC]: When a card is put into your damage zone, if you have an «Angel Feather» vanguard, this unit gets power +2000 until end of turn.";
const SEATS={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const CATALOG=loadCatalog(),byId=id=>CATALOG.find(card=>String(card.id)===String(id));
const player=playerId=>({playerId,vanguard:null,rear:Array(5).fill(null),hand:[],deck:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],usedAbilities:[]});

function fixture({cardId=FAMILY[0],side="human",sourceCircle="rear-left",vanguardCardId="cfa-726",damageSide=side,eventLocation="damage",subjectController,sourcePresent=true}={}){
  const card=byId(cardId);assert.ok(card,`catalog card ${cardId}`);
  const ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:0`);assert.ok(ability,`${cardId}:0`);
  const playerId=side==="human"?"host-player":"guest-player",opponentSide=side==="human"?"bot":"human",opponentId=side==="human"?"guest-player":"host-player";
  const own=player(playerId),other=player(opponentId);
  const source={uid:`source-${side}-${cardId}`,cardId,cardName:card.name,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,zone:sourceCircle,circle:sourceCircle};
  if(sourcePresent){if(sourceCircle==="vanguard")own.vanguard=source;else if(sourceCircle==="rear-left")own.rear[0]=source;else if(sourceCircle==="hand")own.hand.push(source);else if(sourceCircle==="guardian")own.guardCircle.push(source);}
  if(sourceCircle!=="vanguard")own.vanguard={uid:`vanguard-${side}`,cardId:vanguardCardId,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,zone:"vanguard",circle:"vanguard"};
  const damagePlayer=damageSide===side?own:other,damageController=subjectController||(damageSide===side?playerId:opponentId);
  const damage={uid:`damage-${side}-${cardId}`,cardId:"cfa-703",ownerPlayerId:damagePlayer.playerId,controllerPlayerId:damageController,unitCard:true,zone:"damage"};damagePlayer.damage.push(damage);
  const players=side==="human"?{human:own,bot:other}:{human:other,bot:own};
  const activeSide=opponentSide,activePlayerId=players[activeSide].playerId;
  const state={matchId:`damage-power-${side}-${cardId}`,stateVersion:1,turn:3,side:activeSide,phase:5,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,players};
  const event=Engine.createGameEvent(state,{type:"card.damage_moved",eventId:`damage-${side}-${cardId}-${damageSide}-${eventLocation}`,actingPlayerId:activePlayerId,turnPlayerId:activePlayerId,sourceCardInstanceId:damage.uid,sourceOwnerPlayerId:damage.ownerPlayerId,sourceControllerPlayerId:damage.controllerPlayerId,cardInstanceId:damage.uid,subjectCardInstanceId:damage.uid,subjectOwnerPlayerId:damage.ownerPlayerId,subjectControllerPlayerId:damage.controllerPlayerId,previousLocation:"trigger",currentLocation:eventLocation,phase:"battle",timingWindow:"damage-check-resolution"});
  return{state,event,ability,source,damage,own,other,side,playerId,activePlayerId,activeSide,opponentSide,cardId};
}
function decide(f,auth=f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,actionId=`resolve-${f.ability.id}`){
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},SEATS,Engine);
}

test("the three exact catalog abilities compile as mandatory source-local AUTO effects",()=>{
  for(const cardId of FAMILY){
    const card=byId(cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:0`),definition=ability?.definition;
    assert.ok(ability,`${cardId}:0`);assert.equal(ability.kind,"AUTO");assert.equal(ability.printedText,TEXT);
    assert.equal(definition.source.patternId,PATTERN);assert.deepEqual(ability.requiredLocation,["vanguard","rear-guard"]);
    assert.equal(ability.trigger.status,"recognized-trigger");assert.equal(ability.trigger.eventType,"card.damage_moved");assert.equal(ability.trigger.subject,"any");
    assert.equal(ability.trigger.destinationLocation,"damage");assert.equal(ability.trigger.subjectControllerRelation,"source-controller");
    assert.deepEqual(ability.conditions,[{type:"controller-vanguard-has-clan",value:"Angel Feather"}]);
    assert.deepEqual(ability.costs,[]);assert.equal(ability.canDecline,false);assert.equal(ability.choiceStatus,"no-explicit-choice-detected");
    assert.deepEqual(definition.effects,[{op:"modify-power",target:"source",amount:2000,duration:"turn",expiry:"active-turn"}]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
  }
});

test("host and joiner each resolve only their exact VC or RC source for their own Damage Zone",()=>{
  for(const side of ["human","bot"])for(const cardId of FAMILY)for(const sourceCircle of ["vanguard","rear-left"]){
    const f=fixture({cardId,side,sourceCircle});
    const discovery=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);
    assert.equal(discovery.queued.length,1,`${side}/${cardId}/${sourceCircle}; skipped=${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);assert.equal(f.state.pendingAbility.ability.canDecline,false);
    const wrongAuth=side==="human"?SEATS.guestAuthUid:SEATS.hostAuthUid;
    assert.equal(decide(f,wrongAuth).ok,false,"the other seat cannot resolve this source");
    assert.equal(decide(f).ok,true);
    assert.equal(f.source.turnPowerBoost,2000);assert.equal(f.source.turnPowerExpiry,f.activePlayerId,"until end of the active turn, including opponent-turn damage");
    assert.equal(f.damage.turnPowerBoost,undefined);assert.equal(f.other.damage.length,0);
    Engine.expireTurnModifiers(f.state.players,f.playerId);assert.equal(f.source.turnPowerBoost,2000,"the source controller's later end step is not the duration boundary");
    Engine.expireTurnModifiers(f.state.players,f.activeSide);assert.equal(f.source.turnPowerBoost,0,"the offline/client cleanup path may identify the ending player by seat");
  }
});

test("opponent Damage Zone, forged zone metadata, wrong circle, or non-Angel Feather Vanguard cannot qualify on either seat",()=>{
  for(const side of ["human","bot"]){
    const sourcePlayerId=side==="human"?"host-player":"guest-player",opponentSide=side==="human"?"bot":"human";
    const opponentDamage=fixture({side,damageSide:opponentSide});
    assert.equal(Reducer.discoverAutoTriggers(opponentDamage.state,[opponentDamage.event],Engine).queued.length,0,`${side} cannot trigger from the opponent Damage Zone`);
    const forgedSide=fixture({side,damageSide:opponentSide,subjectController:sourcePlayerId});
    assert.equal(Reducer.discoverAutoTriggers(forgedSide.state,[forgedSide.event],Engine).queued.length,0,"event controller cannot override the actual zone owner");
    const wrongDestination=fixture({side,eventLocation:"drop"});
    assert.equal(Reducer.discoverAutoTriggers(wrongDestination.state,[wrongDestination.event],Engine).queued.length,0);
    const wrongVanguard=fixture({side,vanguardCardId:"cfa-31"});
    assert.equal(Reducer.discoverAutoTriggers(wrongVanguard.state,[wrongVanguard.event],Engine).queued.length,0,`${side} needs its own Angel Feather Vanguard`);
    const handSource=fixture({side,sourceCircle:"hand"});
    assert.equal(Reducer.discoverAutoTriggers(handSource.state,[handSource.event],Engine).queued.length,0);
    const guardianSource=fixture({side,sourceCircle:"guardian"});
    assert.equal(Reducer.discoverAutoTriggers(guardianSource.state,[guardianSource.event],Engine).queued.length,0);
    const absentSource=fixture({side,sourcePresent:false});
    assert.equal(Reducer.discoverAutoTriggers(absentSource.state,[absentSource.event],Engine).queued.length,0);
  }
});

test("duplicate damage events cannot grant power twice, and the controller condition is revalidated before resolution",()=>{
  const f=fixture({side:"bot",cardId:"cfa-725",sourceCircle:"rear-left"});
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);
  f.own.vanguard.cardId="cfa-31";
  const rejected=decide(f);assert.equal(rejected.ok,false);assert.equal(rejected.reason,"damage-zone-power-vanguard-condition-no-longer-met");
  assert.equal(f.source.turnPowerBoost,undefined);
});
