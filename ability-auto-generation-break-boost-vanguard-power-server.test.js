'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const PATTERN='auto-generation-break-own-vanguard-boost-power-battle-v1';
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const family=catalog.flatMap(card=>Engine.parseCardAbilitiesCached(card).filter(ability=>ability.definition?.source?.patternId===PATTERN));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function instance(cardId,uid,playerId,extra={}){const c=cards.get(String(cardId));return{uid,cardId:String(cardId),cardName:c?.name,type:c?.type||'Unit',grade:Number(c?.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,power:10000,...extra};}
function fixture(ability,side='human',{gb=true}={}){
  const ownerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest';
  const source=instance(ability.cardId,`gb-booster-${ability.id}-${side}`,ownerId,{rested:true});
  const attacker=instance('cfa-3',`gb-vg-${ability.id}-${side}`,ownerId,{power:10000}),target=instance('cfa-3',`gb-target-${ability.id}-${side}`,otherId,{power:10000});
  const own={playerId:ownerId,vanguard:attacker,rear:[source,null,null,null,null],soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:gb?[instance('cfa-4000',`g-unit-${ability.id}-${side}`,ownerId,{isGUnit:true,faceUp:true})]:[]};
  const opponent={playerId:otherId,vanguard:target,rear:Array(5).fill(null),soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  const state={matchId:`gb-boost-${ability.id}-${side}`,stateVersion:1,turn:4,side,phase:4,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbility:null,pendingAbilities:[],players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own}};
  const attack={battleId:`gb-battle-${ability.id}-${side}`,attackerUid:attacker.uid,attackerSide:side,attackerZone:'vanguard',attackerPlayerId:ownerId,defenderSide:otherSide,targetUid:target.uid,targetZone:'vanguard',power:10000,targetPower:10000,critical:1,boostUid:source.uid};state.pendingAttack=attack;
  const event=Engine.createGameEvent(state,{type:'unit.boosted',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,boosterCardInstanceId:source.uid,boostedCardInstanceId:attacker.uid,previousLocation:'rear-guard',currentLocation:'rear-guard',targetLocation:'vanguard',targetCardInstanceIds:[attacker.uid],phase:'battle',timingWindow:'boost-step',battleId:attack.battleId});
  return{state,event,source,attacker,target,own,opponent,side,ownerId};
}
function decide(f,abilityId,actorAuthUid=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid,actionId:`resolve-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId}}},seats,Engine);}

test('all eleven trusted definitions preserve exact Generation Break 1, source, battle target, and printed power',()=>{
  assert.equal(family.length,11);
  for(const ability of family){assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(d=>d.id===ability.id),ability.id);assert.equal(ability.definition.source.patternId,PATTERN);assert.deepEqual(ability.requiredLocation,['rear-guard']);assert.deepEqual(ability.conditions,[{type:'generation-break',count:1}]);assert.equal(ability.trigger.eventType,'unit.boosted');assert.equal(ability.trigger.subject,'source');assert.equal(ability.costs.length,0);assert.equal(ability.definition.effects[0].target,'boosted-unit');assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);}
});
test('both players boost their own Vanguard and resolve the printed battle power',()=>{
  for(const ability of family)for(const side of ['human','bot']){const f=fixture(ability,side),queued=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(queued.queued.length,1,`${ability.id}/${side}: ${JSON.stringify(queued.skipped)}`);assert.equal(f.state.pendingAbility.side,side);const result=decide(f,ability.id);assert.equal(result.ok,true,`${ability.id}/${side}: ${result.reason}`);assert.equal(f.state.pendingAttack.power,10000+(ability.cardId==='cfa-11696'?3000:4000));}
});
test('no trigger for another booster, non-Vanguard target, absent Generation Break, wrong turn, or stale source',()=>{
  const ability=family[0];for(const patch of [{boosterCardInstanceId:'other',sourceCardInstanceId:'other',subjectCardInstanceId:'other'},{targetLocation:'rear-guard'},{actingPlayerId:'player-guest',turnPlayerId:'player-guest'}]){const f=fixture(ability);const event=Engine.createGameEvent(f.state,{...f.event,...patch,eventId:undefined,sequence:undefined});assert.equal(Reducer.discoverAutoTriggers(f.state,[event],Engine).queued.length,0,JSON.stringify(patch));}
  const noGb=fixture(family[1],'human',{gb:false});assert.equal(Reducer.discoverAutoTriggers(noGb.state,[noGb.event],Engine).queued.length,0);
  const stale=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(stale.state,[stale.event],Engine).queued.length,1);stale.state.players.human.rear[0]=null;stale.state.players.human.drop.push(stale.source);assert.equal(decide(stale,ability.id).ok,false);assert.equal(stale.state.pendingAttack.power,10000);
});

test('the generic Generation Break boost family resolves only for its exact booster on either seat',()=>{
  const ability=Engine.parseCardAbilitiesCached(cards.get('cfa-4450')).find(item=>item.id==='cfa-4450:0');
  assert.ok(ability);
  assert.equal(ability.definition.source.patternId,'auto-generation-break-boost-unit-power-battle-v1');
  assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
  for(const side of ['human','bot']){
    const f=fixture(ability,side),queued=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);
    assert.equal(queued.queued.length,1,JSON.stringify(queued.skipped));
    assert.equal(f.state.pendingAbility.side,side);
    assert.equal(decide(f,ability.id).ok,true);
    assert.equal(f.state.pendingAttack.power,13000);
  }
  const noGb=fixture(ability,'human',{gb:false});
  assert.equal(Reducer.discoverAutoTriggers(noGb.state,[noGb.event],Engine).queued.length,0);
  const otherBooster=fixture(ability);
  const foreign=Engine.createGameEvent(otherBooster.state,{...otherBooster.event,eventId:undefined,sequence:undefined,sourceCardInstanceId:'different-booster',cardInstanceId:'different-booster',subjectCardInstanceId:'different-booster',boosterCardInstanceId:'different-booster'});
  assert.equal(Reducer.discoverAutoTriggers(otherBooster.state,[foreign],Engine).queued.length,0);
});
