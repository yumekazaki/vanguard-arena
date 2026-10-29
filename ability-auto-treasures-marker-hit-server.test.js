'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS=['cfa-7622','cfa-7623','cfa-7624','cfa-7625','cfa-7626','cfa-7627'];
const TEXT='AUTO [VC/RC]: When its attack hits, choose one of your VC or RC without any Treasures markers, and put a Treasures marker.';
const CATALOG=new Map(loadCatalog().map(card=>[String(card.id),card]));
const ABILITIES=IDS.map(id=>{
  const card=CATALOG.get(id);assert.ok(card,`catalog card ${id}`);
  const ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${id}:0`);
  assert.ok(ability,`${id}:0`);return ability;
});
const SEATS={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const REAR=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right'];

function instance(cardId,uid,playerId){const card=CATALOG.get(cardId);return{uid,cardId,cardName:card.name,type:card.type,grade:Number(card.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true}}
function fixture(ability,side='human',sourceCircle='vanguard'){
  const controllerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest';
  const source=instance(ability.cardId,`source-${side}`,controllerId),target=instance('cfa-20',`target-${side}`,otherId);
  const own={playerId:controllerId,vanguard:null,rear:Array(5).fill(null),accelZones:0,accelTypes:[],giftZones:[],deck:[],hand:[],soul:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  if(sourceCircle==='vanguard')own.vanguard=source;else own.rear[REAR.indexOf(sourceCircle)]=source;
  const enemy={playerId:otherId,vanguard:target,rear:Array(5).fill(null),accelZones:0,accelTypes:[],giftZones:[],deck:[],hand:[],soul:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  const battleId=`battle-${side}`,state={matchId:`treasures-${side}`,stateVersion:1,turn:3,side,phase:5,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,players:side==='human'?{human:own,bot:enemy}:{human:enemy,bot:own},pendingAttack:{battleId,attackerSide:side,attackerUid:source.uid,attackerPlayerId:controllerId,attackerZone:sourceCircle,defenderSide:otherSide,targetUid:target.uid,targetZone:'vanguard',power:20000,targetPower:10000,critical:1,blocked:false}};
  const event=Engine.createGameEvent(state,{type:'attack.hit',actingPlayerId:controllerId,turnPlayerId:controllerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:controllerId,sourceControllerPlayerId:controllerId,attackingUnitInstanceId:source.uid,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:controllerId,subjectControllerPlayerId:controllerId,attackerCardInstanceId:source.uid,targetCardInstanceIds:[target.uid],targetLocation:'vanguard',battleId,phase:'battle',timingWindow:'attack-hit'});
  return{ability,side,controllerId,otherSide,otherId,source,target,own,enemy,state,event};
}
function decide(f,zone,actorAuthUid=f.side==='human'?SEATS.hostAuthUid:SEATS.guestAuthUid,actionId=`choose-${f.side}`){return Reducer.applyAbilityDecision(f.state,{actorAuthUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,circleZone:zone}}},SEATS,Engine)}

test('the six supported AUTO definitions are exact, VC/RC-only, and leave other printed abilities unsupported',()=>{
  assert.equal(ABILITIES.length,6);
  for(const ability of ABILITIES){
    assert.equal(ability.printedText,TEXT,ability.id);assert.equal(ability.definition?.source?.patternId,'auto-own-attack-hit-place-treasures-marker-v1');
    assert.deepEqual(ability.requiredLocation,['vanguard','rear-guard']);assert.equal(ability.trigger?.eventType,'attack.hit');assert.equal(ability.trigger?.subject,'source');
    assert.deepEqual(ability.definition.effects,[{op:'place-circle-marker',target:'chosen-controller-circle',markerType:'Treasures',circleTypes:['vanguard','rear-guard']}]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
  }
  for(const id of IDS){const others=Engine.parseCardAbilitiesCached(CATALOG.get(id)).filter(item=>item.id!==`${id}:0`);assert.ok(others.every(item=>!item.definition),`${id} non-family abilities remain unreviewed`)}
});

test('host and joining player each get their own private choice and place the marker on their own selected circle',()=>{
  for(const ability of ABILITIES)for(const side of ['human','bot'])for(const sourceCircle of ['vanguard','rear-left']){
    const f=fixture(ability,side,sourceCircle),queued=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);
    assert.equal(queued.queued.length,1,`${ability.id}/${side}/${sourceCircle}: ${JSON.stringify(queued.skipped)}`);assert.equal(f.state.pendingAbility.side,side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.controllerId);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state,side).pendingAbility?.instance.uid,f.source.uid);assert.equal(Engine.projectPendingAbilitiesForSide(f.state,f.otherSide).pendingAbility,null);
    const result=decide(f,'rear-right');assert.equal(result.ok,true,JSON.stringify(result));
    assert.deepEqual(f.own.giftZones,[{type:'Treasures',zone:'rear-right'}]);assert.deepEqual(f.enemy.giftZones,[]);
  }
});

test('an unrelated attacker, a miss, a blocked attack, and a forged hit target cannot trigger',()=>{
  const ability=ABILITIES[0];
  for(const mutate of [
    f=>({ ...f.event,sourceCardInstanceId:'other',attackingUnitInstanceId:'other',subjectCardInstanceId:'other',cardInstanceId:'other' }),
    f=>({...f.event,didNotHit:true}),
    f=>({...f.event,attackHitOverride:true,didNotHit:true}),
    f=>({...f.event,targetCardInstanceIds:['wrong-target']}),
    f=>{f.state.pendingAttack.power=5000;return f.event;},
    f=>{f.state.pendingAttack.blocked=true;return f.event;}
  ]){const f=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(f.state,[mutate(f)],Engine).queued.length,0)}
});

test('marked circles are excluded and target selection is revalidated before resolution',()=>{
  const f=fixture(ABILITIES[0]);f.own.giftZones.push({type:'Treasures',zone:'rear-left'});
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  assert.equal(decide(f,'rear-left').ok,false,'cannot select a marker-present circle');
  const g=fixture(ABILITIES[0]);Reducer.discoverAutoTriggers(g.state,[g.event],Engine);g.own.giftZones.push({type:'Treasures',zone:'rear-right'});
  assert.equal(decide(g,'rear-right').reason,'marker-already-present');
  assert.equal(decide(f,'not-a-circle','auth-host','invalid-target').reason,'invalid-marker-circle');
});

test('duplicate hit events do not queue the ability twice and no legal circles means no prompt',()=>{
  const f=fixture(ABILITIES[0]),first=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(first.queued.length,1);
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);assert.equal(f.state.pendingAbilities.length,0);
  const g=fixture(ABILITIES[0]);g.own.giftZones=[{type:'Treasures',zone:'vanguard'},...REAR.map(zone=>({type:'Treasures',zone}))];
  assert.equal(Reducer.discoverAutoTriggers(g.state,[g.event],Engine).queued.length,0);assert.equal(g.state.pendingAbility,null);
});
