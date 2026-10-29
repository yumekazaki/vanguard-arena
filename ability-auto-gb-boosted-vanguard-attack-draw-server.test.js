'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const card=loadCatalog().find(x=>x.id==='cfa-2560'),ability=Engine.parseCardAbilitiesCached(card).find(x=>x.id==='cfa-2560:0');
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function unit(uid,cardId,playerId,extra={}){const definition=loadCatalog().find(x=>x.id===cardId);return{uid,cardId,cardName:definition?.name||cardId,grade:Number(definition?.grade||0),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,power:10000,critical:1,...extra};}
function fixture(side='human',{boost=true,gb=true,faceUpDamage=1,target='vanguard'}={}){
 const ownerId=side==='human'?'player-host':'player-guest',enemyId=side==='human'?'player-guest':'player-host',source=unit('source-'+side,'cfa-2560',ownerId,{zone:'rear-guard',circle:'rear-left'}),booster=boost?unit('booster-'+side,'cfa-2',ownerId,{zone:'rear-guard',circle:'rear-back-left',boostAbility:true}):null,ownVg=unit('vg-'+side,'cfa-3',ownerId,{zone:'vanguard',circle:'vanguard'}),enemyVg=unit('enemy-vg-'+side,'cfa-3',enemyId,{zone:'vanguard',circle:'vanguard'}),damage=Array.from({length:faceUpDamage},(_,i)=>unit(`damage-${side}-${i}`,'cfa-2',ownerId,{zone:'damage',faceDown:false}));
 const makePlayer=id=>({playerId:id,vanguard:id===ownerId?ownVg:enemyVg,rear:Array(5).fill(null),hand:[],soul:[],damage:[],drop:[],deck:[unit('draw-'+side,'cfa-2',ownerId,{zone:'deck'})],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]});
 const players={human:makePlayer('player-host'),bot:makePlayer('player-guest')},rearIndex=0,boosterIndex=2;players[side].rear[rearIndex]=source;if(booster)players[side].rear[boosterIndex]=booster;players[side].damage=damage;players[side].gZone=gb?[unit('face-up-g-'+side,'cfa-3',ownerId,{faceUp:true})]:[];
 const battleId=`gb-boost-draw-${side}`,attackerZone='rear-left',targetUid=target==='vanguard'?enemyVg.uid:'other-target',state={matchId:'gb-boost-draw',stateVersion:1,turn:7,side,phase:5,eventSequence:0,processedEventIds:[],processedActionIds:[],processedAbilityTriggers:[],pendingAbilities:[],players,pendingAttack:{battleId,attackerSide:side,attackerUid:source.uid,attackerZone,attackerPlayerId:ownerId,defenderSide:side==='human'?'bot':'human',targetUid,targetZone:target,power:20000,targetPower:13000,critical:1,boostUid:booster?.uid||null,boostPower:5000}};
 const event=Engine.createGameEvent(state,{type:'unit.attacked',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,currentLocation:attackerZone,targetCardInstanceIds:[targetUid],targetLocation:target,boosterCardInstanceId:booster?.uid||null,battleId,phase:'battle',timingWindow:'attack-declared'});
 return{state,event,source,booster,damage,side,ownerId};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function respond(f,{actor=f.side,accept=true,actionId=`resolve-${f.side}`}={}){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor==='human'?seats.hostAuthUid:seats.guestAuthUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept,selection:{instanceUid:f.source.uid,abilityId:ability.id,costSelections:{cb:[f.damage[0]?.uid].filter(Boolean)}}}},seats,Engine);}

test('Diviner, Kuroikazuchi has its exact trusted GB1 boosted-Vanguard-attack Counter Blast draw AUTO',()=>{
 assert.equal(Engine.getReviewedAbilityDefinitionsForCard('cfa-2560').some(x=>x.id===ability.id),true);assert.equal(Reducer.supportsServerAbilityEffects(ability),true);assert.deepEqual(ability.conditions,[{type:'generation-break',count:1},{type:'source-was-boosted'}]);assert.deepEqual(ability.costs,[{type:'counter-blast',count:1}]);assert.deepEqual(ability.effects,[{op:'draw',count:1}]);
});
test('host and joining player each resolve their own boosted attack draw and pay their own Counter Blast',()=>{
 for(const side of ['human','bot']){const f=fixture(side);assert.equal(discover(f).queued.length,1);assert.equal(f.state.pendingAbility.side,side);assert.equal(respond(f,{actor:side==='human'?'bot':'human'}).ok,false);assert.equal(respond(f).ok,true);assert.equal(f.damage[0].faceDown,true);assert.equal(f.state.players[side].hand[0].uid,`draw-${side}`);}
});
test('an unboosted attack, non-Vanguard target, missing GB, or unavailable Counter Blast cannot trigger',()=>{
 for(const options of [{boost:false},{target:'rear-left'},{gb:false},{faceUpDamage:0}])assert.equal(discover(fixture('human',options)).queued.length,0,JSON.stringify(options));
 const f=fixture();f.event=Object.freeze({...f.event,sourceCardInstanceId:'other',cardInstanceId:'other',subjectCardInstanceId:'other'});assert.equal(discover(f).queued.length,0);
});
test('decline is free, and resolution rechecks GB and cost before drawing',()=>{
 const declined=fixture();assert.equal(discover(declined).queued.length,1);assert.equal(respond(declined,{accept:false}).ok,true);assert.equal(declined.damage[0].faceDown,false);assert.equal(declined.state.players.human.hand.length,0);
 const changed=fixture();assert.equal(discover(changed).queued.length,1);changed.state.players.human.gZone.length=0;assert.equal(respond(changed).ok,false);assert.equal(changed.damage[0].faceDown,false);assert.equal(changed.state.players.human.hand.length,0);
});
test('the authoritative attack action emits the boost identity used by the AUTO matcher',()=>{
 const f=fixture('human'),targetUid=f.state.players.bot.vanguard.uid;f.state.pendingAttack=null;const result=Reducer.applyGameAction(f.state,{actorAuthUid:seats.hostAuthUid,actionId:'real-boosted-attack',expectedStateVersion:f.state.stateVersion,payload:{type:'game-action',action:'attack',attackerCardInstanceId:f.source.uid,targetCardInstanceId:targetUid,boosterCardInstanceId:f.booster.uid}},seats,Engine);
 assert.equal(result.ok,true,result.reason);const attackEvent=result.events.find(event=>event.type==='unit.attacked');assert.equal(attackEvent.boosterCardInstanceId,f.booster.uid);assert.equal(result.state.pendingAbility.instance.uid,f.source.uid);assert.equal(result.state.pendingAbility.ability.id,ability.id);assert.equal(result.state.pendingAbility.side,'human');
});
