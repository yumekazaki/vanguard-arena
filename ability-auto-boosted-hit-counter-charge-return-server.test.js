'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');

const IDS=['cfa-11783','cfa-11784','cfa-11785'];
const PATTERN='auto-boosted-attack-hit-counter-charge-return-source-v1';
const catalog=new Map(loadCatalog().map(card=>[String(card.id),card]));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function instance(cardId,uid,ownerPlayerId,controllerPlayerId=ownerPlayerId){
  const card=catalog.get(String(cardId));
  return{uid,cardId:String(cardId),cardName:card?.name,type:card?.type||'Unit',grade:Number(card?.grade),ownerPlayerId,controllerPlayerId,unitCard:true};
}
function fixture(ability,side='human',{noFaceDown=false,stolenSource=false,targetZone='vanguard'}={}){
  const controllerId=side==='human'?'host-player':'guest-player',opponentSide=side==='human'?'bot':'human',opponentId=opponentSide==='human'?'host-player':'guest-player';
  const source=instance(ability.cardId,`booster-${side}-${ability.cardId}`,stolenSource?opponentId:controllerId,controllerId);
  const attacker=instance('cfa-3',`attacker-${side}`,controllerId),defender=instance('cfa-3',`defender-${side}`,opponentId);
  const damage=noFaceDown?[]:[{uid:`face-down-${side}`,cardId:'cfa-4',ownerPlayerId:controllerId,controllerPlayerId:controllerId,faceDown:true}];
  const own={playerId:controllerId,vanguard:attacker,rear:[source,null,null,null,null],damage,soul:[],deck:[instance('cfa-4',`deck-${side}`,controllerId)],hand:[],drop:[],bind:[],orders:[],crests:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  const opponent={playerId:opponentId,vanguard:defender,rear:Array(5).fill(null),damage:[],soul:[],deck:[instance('cfa-4',`opp-deck-${side}`,opponentId)],hand:[],drop:[],bind:[],orders:[],crests:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  let target=defender;
  if(targetZone!=='vanguard'){target=instance('cfa-4',`target-${side}`,opponentId);opponent.rear[0]=target;}
  const state={matchId:`boost-counter-charge-return-${side}-${ability.cardId}`,stateVersion:1,turn:4,side,phase:5,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbility:null,pendingAbilities:[],pendingTrigger:null,
    pendingAttack:{battleId:`battle-${side}-${ability.cardId}`,attackerUid:attacker.uid,attackerSide:side,attackerPlayerId:controllerId,attackerZone:'vanguard',boostUid:source.uid,targetUid:target.uid,targetZone:targetZone==='vanguard'?'vanguard':'rear-left'},
    players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own}};
  const event=Engine.createGameEvent(state,{type:'attack.hit',actingPlayerId:controllerId,turnPlayerId:controllerId,sourceCardInstanceId:attacker.uid,sourceOwnerPlayerId:attacker.ownerPlayerId,sourceControllerPlayerId:controllerId,
    attackingUnitInstanceId:attacker.uid,boosterCardInstanceId:source.uid,boostedCardInstanceId:attacker.uid,cardInstanceId:target.uid,subjectCardInstanceId:target.uid,subjectOwnerPlayerId:target.ownerPlayerId,subjectControllerPlayerId:target.controllerPlayerId,
    targetCardInstanceIds:[target.uid],targetLocation:targetZone==='vanguard'?'vanguard':'rear-left',battleId:state.pendingAttack.battleId,phase:'battle',timingWindow:'attack-hit'});
  return{state,event,source,attacker,target,own,opponent,side,controllerId,opponentId};
}
function decide(f,ability,accept=true,auth=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid,damageUids=[`face-down-${f.side}`]){
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId:`resolve-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,
    payload:{type:'ability-response',accept,selection:{instanceUid:f.source.uid,abilityId:ability.id,damageUids}}},seats,Engine);
}
const abilities=IDS.flatMap(id=>Engine.parseCardAbilitiesCached(catalog.get(id)||{}).filter(ability=>ability.definition?.source?.patternId===PATTERN));

test('each copied AUTO retains its exact booster event, optional choice, and Counter-Charge then return sequence',()=>{
  assert.equal(abilities.length,3);
  for(const ability of abilities){
    assert.equal(ability.trigger.eventType,'attack.hit');assert.equal(ability.trigger.subject,'booster');assert.equal(ability.trigger.requiresBoostedBattle,true);
    assert.deepEqual(ability.requiredLocation,['rear-guard']);assert.equal(ability.canDecline,true);assert.equal(ability.definition.optional,true);
    assert.deepEqual(ability.effects,[{op:'counter-charge-and-return-source-to-deck',target:'source',count:1,shuffle:true}]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
  }
  assert.match(fs.readFileSync('./app.js','utf8'),/\["counter-charge","counter-charge-up-to","counter-charge-and-return-source-to-deck"\]\.includes\(step\.op\)/);
});

test('host and joining player resolve their own hit prompt and return the exact card to its owner deck',()=>{
  for(const ability of abilities)for(const side of ['human','bot']){
    const f=fixture(ability,side),discovery=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(discovery.queued.length,1,JSON.stringify(discovery));
    assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0,'the same event must not enqueue the same source ability twice');
    assert.equal(f.state.pendingAbility.side,side);
    const result=decide(f,ability);assert.equal(result.ok,true,`${ability.id}/${side}: ${result.reason}`);
    assert.equal(f.own.damage[0].faceDown,false);assert.equal(f.own.rear[0],null);assert.ok(f.own.deck.some(card=>card.uid===f.source.uid));
    assert.equal(f.source.controllerPlayerId,f.source.ownerPlayerId);assert.equal(f.opponent.damage.length,0);
  }
});

test('the boosted attack may hit either opposing circle, and a stolen booster returns to its owner deck',()=>{
  const ability=abilities[0],f=fixture(ability,'human',{targetZone:'rear-guard',stolenSource:true});
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  const result=decide(f,ability);assert.equal(result.ok,true,result.reason);
  assert.ok(f.own.rear[0]===null);assert.ok(f.opponent.deck.some(card=>card.uid===f.source.uid));assert.equal(f.source.controllerPlayerId,f.opponentId);
});

test('a different booster, unrelated attacker, non-hit event, or out-of-circle source cannot trigger',()=>{
  const ability=abilities[0];
  for(const patch of [{boosterCardInstanceId:'other'},{boostedCardInstanceId:'other'},{attackingUnitInstanceId:'other',sourceCardInstanceId:'other'},{didNotHit:true}]){
    const f=fixture(ability);const bad=Engine.createGameEvent(f.state,{...f.event,...patch,eventId:undefined,sequence:undefined});
    assert.equal(Reducer.discoverAutoTriggers(f.state,[bad],Engine).queued.length,0,JSON.stringify(patch));
  }
  const outOfCircle=fixture(ability);outOfCircle.own.rear[0]=null;outOfCircle.own.hand.push(outOfCircle.source);
  assert.equal(Reducer.discoverAutoTriggers(outOfCircle.state,[outOfCircle.event],Engine).queued.length,0);
});

test('declining consumes the optional ability without charging or moving the source; no damage cannot prompt',()=>{
  const ability=abilities[1],f=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  const result=decide(f,ability,false);assert.equal(result.ok,true,result.reason);assert.equal(f.own.damage[0].faceDown,true);assert.equal(f.own.rear[0].uid,f.source.uid);
  const noDamage=fixture(ability,'bot',{noFaceDown:true});const skipped=Reducer.discoverAutoTriggers(noDamage.state,[noDamage.event],Engine);
  assert.equal(skipped.queued.length,0);assert.ok(skipped.skipped.some(item=>item.reason==='no-face-down-damage'));
});

test('invalid damage choice and opponent-forged activation leave the match unchanged',()=>{
  const ability=abilities[2],f=fixture(ability,'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  const before=JSON.stringify(f.state);assert.equal(decide(f,ability,true,seats.hostAuthUid).ok,false);assert.equal(JSON.stringify(f.state),before);
  assert.equal(decide(f,ability,true,seats.guestAuthUid,['not-owned-damage']).ok,false);
  assert.equal(f.own.damage[0].faceDown,true);assert.equal(f.own.rear[0].uid,f.source.uid);
});
