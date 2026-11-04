"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const FAMILY=[
  {cardId:"cfa-12235",abilityId:"cfa-12235:0",name:"Leuhan",amount:5000},
  {cardId:"cfa-12698",abilityId:"cfa-12698:1",name:"Rotovisor",amount:5000},
  {cardId:"cfa-12988",abilityId:"cfa-12988:0",name:"Coral",amount:5000},
  {cardId:"cfa-13019",abilityId:"cfa-13019:2",name:"Absolute Zero",amount:10000},
  {cardId:"cfa-12828",abilityId:"cfa-12828:0",name:"Kotihblaze",amount:5000,duration:"turn"},
  {cardId:"cfa-13472",abilityId:"cfa-13472:1",name:"Black",amount:5000,duration:"turn"},
  {cardId:"cfa-13902",abilityId:"cfa-13902:1",name:"Youthberk",amount:5000,duration:"turn"}
];
const PATTERN_BATTLE="auto-rc-own-attack-grade-named-vanguard-power-battle-v1",PATTERN_TURN="auto-rc-own-attack-grade-named-vanguard-power-turn-v1";
const CATALOG=loadCatalog(),SEATS={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const cardFor=id=>CATALOG.find(card=>String(card.id)===String(id));

function fixture({side="human",entry=FAMILY[0],vanguardGrade=3,vanguardName=null,sourceZone="rear-left",attacker="source",targetZone="vanguard"}={}){
  const card=cardFor(entry.cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===entry.abilityId);
  assert.ok(card);assert.ok(ability,`${entry.abilityId}`);
  const ownId=side==="human"?"host-player":"guest-player",otherId=side==="human"?"guest-player":"host-player",otherSide=side==="human"?"bot":"human";
  const source={uid:`source-${side}-${entry.cardId}`,cardId:entry.cardId,cardName:card.name,ownerPlayerId:ownId,controllerPlayerId:ownId,zone:sourceZone,circle:sourceZone,power:Number(card.power||10000),unitCard:true};
  const vg={uid:`vg-${side}`,cardId:"synthetic-vanguard",name:vanguardName||`A grade ${vanguardGrade} ${entry.name} Vanguard`,cardName:vanguardName||`A grade ${vanguardGrade} ${entry.name} Vanguard`,grade:vanguardGrade,ownerPlayerId:ownId,controllerPlayerId:ownId};
  const opposingVg={uid:`op-vg-${side}`,cardId:"cfa-3",name:"Opponent Vanguard",grade:3,ownerPlayerId:otherId,controllerPlayerId:otherId};
  const player=(playerId,vanguard,rear)=>({playerId,vanguard,rear,hand:[],soul:[],drop:[],damage:[],deck:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],usedAbilities:[]});
  const players=side==="human"?{human:player(ownId,vg,[source,null,null,null,null]),bot:player(otherId,opposingVg,Array(5).fill(null))}:{human:player(otherId,opposingVg,Array(5).fill(null)),bot:player(ownId,vg,[source,null,null,null,null])};
  if(sourceZone==="vanguard"){players[side].vanguard=source;players[side].rear[0]=null;}
  const target=targetZone==="vanguard"?players[otherSide].vanguard:{uid:`target-rear-${side}`,cardId:"cfa-4",ownerPlayerId:otherId,controllerPlayerId:otherId,grade:2};
  if(targetZone!=="vanguard")players[otherSide].rear[0]=target;
  const battleId=`grade-name-battle-${side}-${entry.cardId}`;
  const state={matchId:`grade-name-${side}-${entry.cardId}`,stateVersion:1,turn:4,side,phase:5,eventSequence:0,processedActionIds:[],processedEventIds:[],processedAbilityTriggers:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,players,pendingAttack:{battleId,attackerSide:side,attackerUid:attacker==="source"?source.uid:"other-attacker",attackerZone:sourceZone,defenderSide:otherSide,targetUid:target.uid,targetZone,power:10000,critical:1}};
  const event=Engine.createGameEvent(state,{type:"unit.attacked",actingPlayerId:ownId,turnPlayerId:ownId,sourceCardInstanceId:attacker==="source"?source.uid:"other-attacker",sourceOwnerPlayerId:ownId,sourceControllerPlayerId:ownId,subjectCardInstanceId:attacker==="source"?source.uid:"other-attacker",subjectOwnerPlayerId:ownId,subjectControllerPlayerId:ownId,attackingCardInstanceIds:[attacker==="source"?source.uid:"other-attacker"],targetCardInstanceIds:[target.uid],targetLocation:targetZone,currentLocation:sourceZone,battleId,phase:"battle",timingWindow:"attack-declared"});
  return{state,event,source,ability,side,ownId,amount:entry.amount};
}

function resolve(f,actionId=`resolve-${f.side}-${f.ability.id}`){const auth=f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid;return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId,expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},SEATS,Engine)}

test("seven exact catalog records preserve grade, name, RC source, attack event, amount, and printed duration",()=>{
  for(const entry of FAMILY){const duration=entry.duration||"battle",card=cardFor(entry.cardId),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===entry.abilityId);assert.ok(ability);assert.equal(ability.definition.source.patternId,duration==="turn"?PATTERN_TURN:PATTERN_BATTLE);assert.deepEqual(ability.requiredLocation,["rear-guard"]);assert.deepEqual(ability.trigger,{status:"recognized-trigger",eventType:"unit.attacked",subject:"source",circles:["rear-guard"],targetLocation:null});assert.deepEqual(ability.conditions,[{type:"controller-vanguard-grade-at-least",count:3},{type:"controller-vanguard-name-contains",value:entry.name}]);assert.deepEqual(ability.effects,[{op:"modify-power",target:"source",amount:entry.amount,duration}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true)}
});

test("host and joining player independently receive and resolve their own matching attack AUTO",()=>{
  for(const side of ["human","bot"])for(const entry of FAMILY){const duration=entry.duration||"battle",f=fixture({side,entry}),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,`${side}/${entry.cardId}: ${JSON.stringify(found.skipped)}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.ownId);assert.equal(resolve(f).ok,true);assert.equal(f.state.pendingAttack.power,10000+entry.amount);if(duration==="turn"){assert.equal(f.source.turnPowerBoost,entry.amount);assert.equal(f.source.turnPowerExpiry,f.ownId)}else assert.equal(f.source.turnPowerBoost||0,0,"battle modifier is stored on this battle only")}
});

test("wrong source, wrong grade, wrong Vanguard name, or non-RC source never qualifies",()=>{
  for(const options of [{attacker:"other"},{vanguardGrade:2},{vanguardName:"Completely unrelated"},{sourceZone:"vanguard"}]){const f=fixture(options),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,0,JSON.stringify(options));assert.equal(f.state.pendingAbility,null)}
  const rearTarget=fixture({targetZone:"rear-left"});assert.equal(Reducer.discoverAutoTriggers(rearTarget.state,[rearTarget.event],Engine).queued.length,1,"the card text does not restrict the attack target");
});

test("duplicate attack event and resolution cannot add battle power twice",()=>{
  const f=fixture({side:"bot",entry:FAMILY[3]});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);assert.equal(resolve(f).ok,true);assert.equal(f.state.pendingAttack.power,20000);assert.equal(resolve(f).ok,false);assert.equal(f.state.pendingAttack.power,20000);
});

test("an end-of-turn attack AUTO can trigger again on a distinct later attack",()=>{
  const f=fixture({side:"bot",entry:FAMILY[4]});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);assert.equal(resolve(f).ok,true);assert.equal(f.source.turnPowerBoost,5000);
  const battleId="grade-name-second-battle";f.state.pendingAttack={battleId,attackerSide:"bot",attackerUid:f.source.uid,attackerZone:"rear-left",defenderSide:"human",targetUid:"op-vg-bot",targetZone:"vanguard",power:15000,critical:1};
  const second=Engine.createGameEvent(f.state,{type:"unit.attacked",actingPlayerId:f.ownId,turnPlayerId:f.ownId,sourceCardInstanceId:f.source.uid,sourceOwnerPlayerId:f.ownId,sourceControllerPlayerId:f.ownId,subjectCardInstanceId:f.source.uid,subjectOwnerPlayerId:f.ownId,attackingCardInstanceIds:[f.source.uid],targetCardInstanceIds:["op-vg-bot"],targetLocation:"vanguard",currentLocation:"rear-left",battleId,phase:"battle",timingWindow:"attack-declared"});
  assert.equal(Reducer.discoverAutoTriggers(f.state,[second],Engine).queued.length,1,"no once-per-turn clause is printed");assert.equal(resolve(f,"resolve-second-own-attack").ok,true);assert.equal(f.source.turnPowerBoost,10000);assert.equal(f.state.pendingAttack.power,20000);
});
