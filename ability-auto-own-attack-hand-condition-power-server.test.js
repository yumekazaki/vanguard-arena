'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const PATTERN='auto-own-attack-hand-condition-power-battle-v1';
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const family=catalog.flatMap(card=>Engine.parseCardAbilitiesCached(card).filter(ability=>ability.definition?.source?.patternId===PATTERN));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function fixture(ability,side='human'){
  const card=cards.get(ability.cardId),zone=ability.requiredLocation[0],ownerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest';
  const source={uid:`hand-source-${ability.id}-${side}`,cardId:ability.cardId,cardName:card.name,grade:card.grade,ownerPlayerId:ownerId,controllerPlayerId:ownerId,unitCard:true,power:10000};
  const target={uid:`hand-target-${ability.id}-${side}`,cardId:'cfa-3',ownerPlayerId:otherId,controllerPlayerId:otherId,grade:3,unitCard:true,power:10000};
  const minimumHand=ability.conditions[0].type==='controller-hand-size-at-least';
  const handCount=minimumHand?4:ability.cardId==='cfa-5417'?4:1,opponentHandCount=ability.cardId==='cfa-5417'?2:minimumHand?2:3;
  const makePlayer=(playerId,handSize)=>({playerId,vanguard:null,rear:Array(5).fill(null),soul:[],deck:[],hand:Array.from({length:handSize},(_,i)=>({uid:`hand-${playerId}-${i}`,cardId:'cfa-3',ownerPlayerId:playerId,controllerPlayerId:playerId,grade:0})),drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]});
  const own=makePlayer(ownerId,handCount),opponent=makePlayer(otherId,opponentHandCount);
  if(zone==='vanguard')own.vanguard=source;else own.rear[0]=source;
  opponent.vanguard=target;
  for(let i=0;i<Number(ability.gb||0);i++)own.gZone.push({uid:`gb-${ability.id}-${side}-${i}`,cardId:'g-unit',gDeckCard:true,faceUp:true,ownerPlayerId:ownerId,controllerPlayerId:ownerId});
  const state={matchId:`hand-attack-${ability.id}-${side}`,stateVersion:1,turn:4,phase:5,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbility:null,pendingAbilities:[],players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own},pendingAttack:{battleId:`hand-battle-${ability.id}-${side}`,attackerUid:source.uid,attackerSide:side,attackerZone:zone,attackerPlayerId:ownerId,defenderSide:otherSide,targetUid:target.uid,targetZone:'vanguard',power:10000,targetPower:10000,critical:1}};
  const event=Engine.createGameEvent(state,{type:'unit.attacked',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:zone,currentLocation:zone,targetCardInstanceIds:[target.uid],targetLocation:'vanguard',battleId:state.pendingAttack.battleId,phase:'battle',timingWindow:'attack-declared'});
  return{state,event,source,own,opponent,side,ownerId,zone};
}
function decide(f,ability,actorAuthUid=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid,actionId:`resolve-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:ability.id}}},seats,Engine);}

test('all six exact catalog hand-condition attack abilities retain circle, threshold, hand comparison, and ordered battle effects',()=>{
  assert.equal(family.length,6);
  for(const ability of family){
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(definition=>definition.id===ability.id),ability.id);
    assert.equal(ability.definition.source.patternId,PATTERN);
    assert.equal(ability.trigger.eventType,'unit.attacked');assert.equal(ability.trigger.subject,'source');
    assert.ok(ability.conditions.length===1,ability.id);
    assert.ok(ability.definition.effects.every(effect=>effect.target==='source'&&effect.duration==='battle'),ability.id);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);
  }
});
test('each exact source activates only on its own legal attack and resolves for host and joining player',()=>{
  for(const ability of family)for(const side of ['human','bot']){
    const f=fixture(ability,side),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);
    assert.equal(found.queued.length,1,`${ability.id}/${side}`);assert.equal(f.state.pendingAbility.side,side);
    const result=decide(f,ability);assert.equal(result.ok,true,`${ability.id}/${side}: ${result.reason}`);
    assert.equal(f.state.pendingAttack.power,10000+(ability.definition.effects.find(effect=>effect.op==='modify-power')?.amount||0));
    assert.equal(f.state.pendingAttack.critical,1+(ability.definition.effects.find(effect=>effect.op==='modify-critical')?.amount||0));
  }
});
test('hand count, Generation Break, exact attacker, circle, and target are checked again at resolution',()=>{
  const fewer=family.find(ability=>ability.cardId==='cfa-348'),f=fixture(fewer,'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  f.opponent.hand.length=1;const snapshot=JSON.stringify(f.state);assert.equal(decide(f,fewer,seats.hostAuthUid).ok,false);assert.equal(JSON.stringify(f.state),snapshot);
  const gb=family.find(ability=>ability.cardId==='cfa-3428'),low=fixture(gb);low.own.gZone=[];assert.equal(Reducer.discoverAutoTriggers(low.state,[low.event],Engine).queued.length,0);
  const rc=family.find(ability=>ability.cardId==='cfa-5417'),wrongTarget=fixture(rc);const bad=Engine.createGameEvent(wrongTarget.state,{...wrongTarget.event,eventId:undefined,sequence:undefined,targetLocation:'rear-guard'});assert.equal(Reducer.discoverAutoTriggers(wrongTarget.state,[bad],Engine).queued.length,0);
  const wrongSource=fixture(fewer);const forged=Engine.createGameEvent(wrongSource.state,{...wrongSource.event,eventId:undefined,sequence:undefined,sourceCardInstanceId:'other-copy',subjectCardInstanceId:'other-copy',cardInstanceId:'other-copy'});assert.equal(Reducer.discoverAutoTriggers(wrongSource.state,[forged],Engine).queued.length,0);
});
