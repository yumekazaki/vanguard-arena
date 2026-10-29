'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');

const IDS=['cfa-12773','cfa-12774','cfa-12782','cfa-12783','cfa-12791','cfa-12792'];
const TEXT='AUTO [RC/Drop]: When your other card is discarded from hand during your turn, COST [Energy Blast 3 & remove this card], choose one of the discarded cards, and put it into hand.';
const CATALOG=new Map(loadCatalog().map(card=>[String(card.id),card]));
const ABILITIES=IDS.map(id=>{const card=CATALOG.get(id);assert.ok(card,`catalog card ${id}`);const ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${id}:1`);assert.ok(ability,`${id}:1`);return ability});
const SEATS={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const REAR=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right'];
function instance(cardId,uid,playerId){const card=CATALOG.get(cardId);return{uid,cardId,cardName:card.name,type:card.type,grade:Number(card.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true}}
function fixture(ability,side='human',sourceZone='rear-left'){
  const playerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest';
  const source=instance(ability.cardId,`source-${side}`,playerId),discarded=instance('cfa-20',`discarded-${side}`,playerId);
  const own={playerId,vanguard:null,rear:Array(5).fill(null),accelZones:0,accelTypes:[],giftZones:[],deck:[],hand:[],soul:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],energy:3,crests:[{crestName:'Energy Generator'}]};
  if(sourceZone==='drop')own.drop.push(source);else own.rear[REAR.indexOf(sourceZone)]=source;
  own.drop.push(discarded);
  const enemy={playerId:otherId,vanguard:null,rear:Array(5).fill(null),accelZones:0,accelTypes:[],giftZones:[],deck:[],hand:[],soul:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],energy:3,crests:[{crestName:'Energy Generator'}]};
  const state={matchId:`discard-return-${side}-${sourceZone}`,stateVersion:1,turn:3,side,phase:2,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,players:side==='human'?{human:own,bot:enemy}:{human:enemy,bot:own}};
  const event=Engine.createGameEvent(state,{type:'card.discarded',actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:discarded.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:discarded.uid,subjectCardInstanceId:discarded.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:'hand',currentLocation:'drop',reason:'ability-cost',discardReason:'ability-cost',phase:'main',timingWindow:'discard'});
  return{ability,side,playerId,otherSide,otherId,source,discarded,own,enemy,state,event};
}
function decide(f,authUid=f.side==='human'?SEATS.hostAuthUid:SEATS.guestAuthUid,actionId=`return-${f.side}`){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:authUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,effectUid:f.discarded.uid}}},SEATS,Engine)}

test('six exact :1 abilities use the reviewed RC/Drop event-discard return definition only',()=>{
  assert.equal(ABILITIES.length,6);
  for(const ability of ABILITIES){assert.equal(ability.printedText,TEXT,ability.id);assert.equal(ability.definition?.source?.patternId,'auto-other-hand-discard-energy-blast-remove-source-return-discard-v1');assert.deepEqual(ability.requiredLocation,['rear-guard','drop']);assert.equal(ability.trigger?.eventType,'card.discarded');assert.equal(ability.trigger?.subject,'any');assert.equal(Reducer.supportsServerAbilityEffects(ability),true);}
  for(const id of IDS){const others=Engine.parseCardAbilitiesCached(CATALOG.get(id)).filter(item=>item.id!==`${id}:1`);assert.ok(others.every(item=>!item.definition),`${id} other ability remains untouched`)}
});

test('host and joining player independently receive private prompts and pay/resolve their own ability',()=>{
  for(const ability of ABILITIES)for(const side of ['human','bot'])for(const zone of ['rear-left','drop']){
    const f=fixture(ability,side,zone),discovery=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);
    assert.equal(discovery.queued.length,1,`${ability.id}/${side}/${zone}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state,side).pendingAbility.instance.uid,f.source.uid);
    assert.equal(Engine.projectPendingAbilitiesForSide(f.state,f.otherSide).pendingAbility,null);
    const result=decide(f);assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(f.own.energy,0);assert.equal(f.own.bind.some(card=>card.uid===f.source.uid),true);
    assert.equal(f.own.hand.some(card=>card.uid===f.discarded.uid),true);assert.equal(f.own.drop.some(card=>card.uid===f.discarded.uid),false);
    assert.equal(f.enemy.hand.some(card=>card.uid===f.discarded.uid),false);
  }
});

test('rejects wrong seat, wrong event identity, source-as-subject, illegal location, and unpayable cost without partial effects',()=>{
  const illegal=()=>[
    f=>({...f.event,sourceCardInstanceId:'forged',subjectCardInstanceId:'forged',cardInstanceId:'forged'}),
    f=>({...f.event,turnPlayerId:f.otherId}),
    f=>({...f.event,actingPlayerId:f.otherId,sourceControllerPlayerId:f.otherId,subjectControllerPlayerId:f.otherId}),
    f=>({...f.event,previousLocation:'drop'}),
    f=>({...f.event,currentLocation:'hand'}),
    f=>({...f.event,subjectCardInstanceId:f.source.uid,cardInstanceId:f.source.uid,sourceCardInstanceId:f.source.uid})
  ];
  for(const ability of ABILITIES)for(const mutate of illegal()){
    const f=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(f.state,[mutate(f)],Engine).queued.length,0,`${ability.id}`);
  }
  const f=fixture(ABILITIES[0],'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  const before={energy:f.own.energy,sourceZone:f.own.rear[0]?.uid,drop:f.own.drop.map(card=>card.uid)};
  assert.equal(decide(f,SEATS.hostAuthUid).ok,false);
  f.own.energy=2;assert.equal(decide(f).ok,false);
  assert.deepEqual({energy:f.own.energy,sourceZone:f.own.rear[0]?.uid,drop:f.own.drop.map(card=>card.uid)},{energy:2,sourceZone:before.sourceZone,drop:before.drop});
});

test('revalidates the exact discarded card and suppresses duplicate events and decisions',()=>{
  const f=fixture(ABILITIES[0]);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);
  const extra=instance('cfa-21','other-drop-card',f.playerId);f.own.drop.push(extra);
  const bad=Reducer.applyAbilityDecision(f.state,{actorAuthUid:SEATS.hostAuthUid,actionId:'wrong-target',expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,effectUid:extra.uid}}},SEATS,Engine);
  assert.equal(bad.ok,false);assert.equal(f.own.energy,3);assert.equal(f.own.bind.length,0);
  const good=decide(f,f.side==='human'?SEATS.hostAuthUid:SEATS.guestAuthUid,'good-target');assert.equal(good.ok,true,JSON.stringify(good));
  const duplicate=Reducer.applyAbilityDecision(f.state,{actorAuthUid:SEATS.hostAuthUid,actionId:'good-target',expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,effectUid:f.discarded.uid}}},SEATS,Engine);
  assert.equal(duplicate.ok,false);
});

