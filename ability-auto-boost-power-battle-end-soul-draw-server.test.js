"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js"),{loadCatalog}=require("./scripts/audit-ability-catalog.js"),catalog=loadCatalog();
const ids=["cfa-12036","cfa-13328","cfa-13400"],abilityIndex=cardId=>cardId==="cfa-13400"?1:0,seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
function card(cardId,uid,playerId,extra={}){const def=catalog.find(item=>item.id===cardId);return{uid,cardId,cardName:def?.name||cardId,grade:Number(def?.grade||0),ownerPlayerId:playerId,controllerPlayerId:playerId,...extra};}
function fixture(side="human",cardId=ids[0],options={}){
  const playerId=side==="human"?"host-player":"guest-player",opSide=side==="human"?"bot":"human",opponentId=opSide==="human"?"host-player":"guest-player";
  const source=card(cardId,`source-${side}`,playerId,{zone:"rear-guard",circle:"rear-left",rested:true,faceUp:true,power:8000});
  const attacker=card("cfa-1",`attacker-${side}`,playerId,{zone:"vanguard",circle:"vanguard",power:15000,rested:true});
  const target=card("cfa-14",`target-${side}`,opponentId,{zone:"vanguard",circle:"vanguard",power:25000});
  const otherBooster=card("cfa-2",`other-booster-${side}`,playerId,{zone:"rear-guard",circle:"rear-right",rested:true,power:8000});
  const mk=id=>({playerId:id,vanguard:null,rear:Array(5).fill(null),hand:[],deck:[card("cfa-3",`deck-${side}-${id}`,id)],soul:[],damage:[],drop:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]});
  const players={human:mk("host-player"),bot:mk("guest-player")};players[side].vanguard=attacker;players[side].rear[0]=options.sourceInVanguard?null:source;
  if(options.sourceInVanguard)players[side].vanguard=source;
  if(options.includeOtherBooster)players[side].rear[1]=otherBooster;
  players[opSide].vanguard=target;
  for(let i=0;i<(options.opponentRearGuards??1);i++)players[opSide].rear[i]=card("cfa-4",`opponent-rear-${side}-${i}`,opponentId,{zone:"rear-guard",circle:i===0?"rear-left":"rear-right"});
  const battleId=`boost-battle-${side}-${cardId}`;
  const state={matchId:"boost-battle-end-soul-draw",stateVersion:1,turn:3,phase:5,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTrigger:null,pendingEffectChoice:null,scheduledEffects:[],ordersPlayedThisTurn:options.ordersPlayed?1:0,players,
    pendingAttack:{battleId,attackerUid:attacker.uid,attackerSide:side,attackerPlayerId:playerId,attackerZone:"vanguard",attackingCardInstanceIds:[attacker.uid],targetUid:target.uid,targetZone:"vanguard",defenderSide:opSide,power:20000,targetPower:25000,critical:1,boostUid:options.otherBoosted?otherBooster.uid:source.uid,boostPower:5000,blocked:true,defenderDone:true,driveChecksRemaining:0,awaitingDrive:false,driveChecksComplete:true,damageChecksStarted:false,closing:false}};
  const ability=Engine.parseCardAbilities(catalog.find(item=>item.id===cardId)).find(item=>item.id===`${cardId}:${abilityIndex(cardId)}`);
  const event=Engine.createGameEvent(state,{type:"unit.boosted",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:options.otherBoosted?otherBooster.uid:source.uid,
    sourceOwnerPlayerId:options.otherBoosted?otherBooster.ownerPlayerId:source.ownerPlayerId,sourceControllerPlayerId:playerId,
    cardInstanceId:options.otherBoosted?otherBooster.uid:source.uid,subjectCardInstanceId:options.otherBoosted?otherBooster.uid:source.uid,
    subjectOwnerPlayerId:options.otherBoosted?otherBooster.ownerPlayerId:source.ownerPlayerId,subjectControllerPlayerId:playerId,
    boosterCardInstanceId:options.otherBoosted?otherBooster.uid:source.uid,boostedCardInstanceId:attacker.uid,previousLocation:options.otherBoosted?"rear-right":"rear-left",currentLocation:options.otherBoosted?"rear-right":"rear-left",
    circle:options.otherBoosted?"rear-right":"rear-left",targetLocation:"vanguard",targetCardInstanceIds:[attacker.uid],phase:"battle",timingWindow:"boost-step",battleId});
  return{state,ability,source,attacker,target,otherBooster,event,side,playerId};
}
function auth(side){return side==="human"?seats.hostAuthUid:seats.guestAuthUid;}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function decide(f,ability,accept=true,actionId="resolve") {return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth(f.side),actionId:`${actionId}-${f.side}-${f.state.stateVersion}`,expectedStateVersion:f.state.stateVersion,payload:{accept,selection:{instanceUid:f.source.uid,abilityId:ability.id}}},seats,Engine);}
function closeBattle(f){return Reducer.applyGameAction(f.state,{actorAuthUid:auth(f.side),actionId:`close-${f.side}-${f.state.stateVersion}`,expectedStateVersion:f.state.stateVersion,payload:{action:"resolveBattle"}},seats,Engine);}

test("officially sourced exact boost family compiles for all three printings; OR condition preserves its independent branches",()=>{
  for(const cardId of ids){const a=Engine.parseCardAbilities(catalog.find(item=>item.id===cardId)).find(item=>item.id===`${cardId}:${abilityIndex(cardId)}`);assert.equal(a.id,`${cardId}:${abilityIndex(cardId)}`);assert.equal(a.definition.source.patternId,"auto-boost-power-and-battle-end-source-soul-draw-v1");assert.equal(a.trigger.eventType,"unit.boosted");assert.equal(a.trigger.subject,"source");assert.deepEqual(a.requiredLocation,["rear-guard"]);assert.deepEqual(a.conditions,[{type:"any-of",conditions:[{type:"opponent-rear-guards-at-most",count:1},{type:"order-played-this-turn"}]}]);assert.equal(a.canDecline,false);assert.equal(Reducer.supportsServerAbilityEffects(a),true);assert.equal(Reducer.hasTrustedServerAbilityDefinition(a,Engine),true);if(cardId==="cfa-13400"){assert.equal(a.id,"cfa-13400:1");assert.equal(a.definition.source.officialTextVerified,true);assert.equal(a.definition.source.officialCardNumber,"DZ-SS04/CR02");assert.equal(a.definition.source.officialLanguage,"ja");assert.equal(a.definition.source.officialReference,"https://cf-vanguard.com/cardlist/?cardno=DZ-SS04%2FCR02");assert.equal(a.definition.source.officialCrossReference,"https://en.cf-vanguard.com/cardlist/?cardno=DZ-SS09%2F010EN");}}
  assert.equal(Engine.evaluateAbilityConditions({conditions:[{type:"any-of",conditions:[{type:"opponent-rear-guards-at-most",count:1},{type:"order-played-this-turn"}]}]},{opponentRearGuards:1,orderPlayedThisTurn:false}),true);
  assert.equal(Engine.evaluateAbilityConditions({conditions:[{type:"any-of",conditions:[{type:"opponent-rear-guards-at-most",count:1},{type:"order-played-this-turn"}]}]},{opponentRearGuards:2,orderPlayedThisTurn:true}),true);
  assert.equal(Engine.evaluateAbilityConditions({conditions:[{type:"any-of",conditions:[{type:"opponent-rear-guards-at-most",count:1},{type:"order-played-this-turn"}]}]},{opponentRearGuards:2,orderPlayedThisTurn:false}),false);
});

test("the exact booster receives +5000 now, but the mandatory source-to-Soul and draw wait until this battle closes",()=>{
  const f=fixture("human",ids[0],{opponentRearGuards:2,ordersPlayed:true}),discovered=discover(f),located=Engine.locateCardInstance(f.state,f.source.uid),conditionContext=Reducer.buildConditionContext(f.state,f.event,located,Engine);assert.equal(Engine.eventMatchesAbilityTrigger(f.ability,"boost",f.event,f.source.uid,"rear-left","rear-left",f.playerId),true,JSON.stringify(f.event));assert.equal(Engine.evaluateAbilityConditions(f.ability,conditionContext),true,JSON.stringify(conditionContext));assert.equal(discovered.queued.length,1,JSON.stringify(discovered));assert.equal(f.state.pendingAbility.side,"human");assert.equal(f.state.pendingAbility.triggerControllerPlayerId,"host-player");
  const wrong=Reducer.applyAbilityDecision(f.state,{actorAuthUid:seats.guestAuthUid,actionId:"wrong-controller",expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine);assert.equal(wrong.ok,false);
  const activated=decide(f,f.ability,true,"activate");assert.equal(activated.ok,true,JSON.stringify(activated));assert.equal(f.state.pendingAttack.power,25000);assert.equal(f.state.pendingAttack.boostPower,10000);assert.equal(f.state.players.human.hand.length,0);assert.equal(f.state.players.human.soul.length,0);
  assert.equal(f.state.scheduledEffects.length,1);const schedule=f.state.scheduledEffects[0];assert.equal(schedule.kind,"boosted-battle-end-source-soul-draw");assert.equal(schedule.status,"scheduled");assert.equal(schedule.sourceCardInstanceId,f.source.uid);assert.equal(schedule.battleId,f.state.pendingAttack.battleId);
  const closed=closeBattle(f);assert.equal(closed.ok,true,JSON.stringify(closed));assert.equal(f.state.pendingAbility?.triggerControllerPlayerId,"host-player");assert.equal(f.state.pendingAbility?.ability?.syntheticScheduledEffect,true,JSON.stringify({pending:f.state.pendingAbility,queue:f.state.pendingAbilities,schedule,events:closed.events}));assert.equal(f.state.pendingAbility?.instance.uid,f.source.uid);
  const resolved=decide(f,f.state.pendingAbility.ability,true,"resolve-close");assert.equal(resolved.ok,true,JSON.stringify(resolved));assert.equal(f.state.players.human.rear[0],null);assert.ok(f.state.players.human.soul.some(card=>card.uid===f.source.uid));assert.equal(f.state.players.human.hand.length,1);assert.equal(schedule.status,"resolved");
});

test("host and joining controller independently receive and resolve their own boost effects",()=>{
  for(const side of ["human","bot"]){const f=fixture(side,ids[1],{opponentRearGuards:1});assert.equal(discover(f).queued.length,1);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);const first=decide(f,f.ability,true,"boost");assert.equal(first.ok,true,JSON.stringify(first));assert.equal(f.state.players[side].hand.length,0);const closed=closeBattle(f);assert.equal(closed.ok,true,JSON.stringify(closed));assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);const second=decide(f,f.state.pendingAbility.ability,true,"draw");assert.equal(second.ok,true,JSON.stringify(second));assert.equal(f.state.players[side].hand.length,1);assert.ok(f.state.players[side].soul.some(card=>card.uid===f.source.uid));}
});

test("no qualifying condition, another booster, or a non-Rear-Guard source cannot trigger it",()=>{
  const noCondition=fixture("human",ids[0],{opponentRearGuards:2});assert.equal(discover(noCondition).queued.length,0);assert.equal(noCondition.state.pendingAbility,null);
  const otherBoost=fixture("human",ids[0],{opponentRearGuards:2,includeOtherBooster:true,otherBoosted:true,ordersPlayed:true});assert.equal(discover(otherBoost).queued.length,0);assert.equal(otherBoost.state.pendingAbility,null);
  const vanguard=fixture("human",ids[0],{sourceInVanguard:true,ordersPlayed:true});assert.equal(discover(vanguard).queued.length,0);assert.equal(vanguard.state.pendingAbility,null);
});

test("a source that leaves its circle before battle close cannot pay the delayed cost or draw",()=>{
  const f=fixture("human",ids[0],{opponentRearGuards:1});assert.equal(discover(f).queued.length,1);assert.equal(decide(f,f.ability,true,"boost").ok,true);
  f.state.players.human.rear[0]=null;f.state.players.human.drop.push({...f.source,zone:"drop",circle:null});
  const closed=closeBattle(f);assert.equal(closed.ok,true,JSON.stringify(closed));assert.equal(f.state.pendingAbility,null);assert.equal(f.state.scheduledEffects[0].status,"resolved-no-source");assert.equal(f.state.players.human.hand.length,0);assert.equal(f.state.players.human.soul.length,0);
});
