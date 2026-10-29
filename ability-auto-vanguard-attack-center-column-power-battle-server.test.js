'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer = require('./ability-server-reducer.js');
const { loadCatalog } = require('./scripts/audit-ability-catalog.js');
const PATTERN = 'auto-vanguard-attack-center-column-power-battle-v1';
const catalog = loadCatalog(), cards = new Map(catalog.map(card => [String(card.id), card]));
const family = catalog.flatMap(card => Engine.parseCardAbilitiesCached(card).filter(ability => ability.definition?.source?.patternId === PATTERN));
const seats = { hostAuthUid: 'auth-host', guestAuthUid: 'auth-guest', hostSide: 'human', guestSide: 'bot' };
function instance(cardId, uid, playerId) { const c=cards.get(String(cardId));return{uid,cardId:String(cardId),cardName:c?.name,type:c?.type||'Unit',grade:Number(c?.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,power:10000}; }
function fixture(ability, side='human', { center=true }={}) {
  const ownerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest';
  const source=instance(ability.cardId,`center-vg-${ability.id}-${side}`,ownerId),target=instance('cfa-3',`opponent-vg-${ability.id}-${side}`,otherId),rear=Array(5).fill(null);if(center)rear[3]=instance('cfa-4',`center-rg-${ability.id}-${side}`,ownerId);
  const own={playerId:ownerId,vanguard:source,rear,soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  const opponent={playerId:otherId,vanguard:target,rear:Array(5).fill(null),soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  const state={matchId:`center-vg-${ability.id}-${side}`,stateVersion:1,turn:4,side,phase:4,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbility:null,pendingAbilities:[],players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own}};
  const attack={battleId:`battle-${ability.id}-${side}`,attackerUid:source.uid,attackerSide:side,attackerZone:'vanguard',attackerPlayerId:ownerId,defenderSide:otherSide,targetUid:target.uid,targetZone:'vanguard',power:10000,targetPower:10000,critical:1,boostUid:null};state.pendingAttack=attack;
  const event=Engine.createGameEvent(state,{type:'unit.attacked',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:'vanguard',currentLocation:'vanguard',targetCardInstanceIds:[target.uid],targetLocation:'vanguard',battleId:attack.battleId,phase:'battle',timingWindow:'attack-declared'});
  return{state,event,source,target,own,opponent,side,ownerId};
}
function decide(f,abilityId,actorAuthUid=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid,actionId:`center-power-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId}}},seats,Engine);}

test('all fifteen catalog Vanguard AUTO abilities retain exact center-column or middle-column and attack conditions',()=>{
  assert.equal(family.length,15);
  for(const ability of family){assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(d=>d.id===ability.id),ability.id);assert.equal(ability.definition.source.patternId,PATTERN);assert.deepEqual(ability.requiredLocation,['vanguard']);assert.deepEqual(ability.conditions,[{type:'controller-has-center-column-rear-guard'}]);assert.equal(ability.trigger.eventType,'unit.attacked');assert.equal(ability.trigger.targetLocation,'vanguard');assert.equal(ability.definition.effects[0].amount,3000);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);}
});
test('both seats resolve only the exact Vanguard attack with their own center Rear-Guard',()=>{
  for(const ability of family)for(const side of ['human','bot']){const f=fixture(ability,side),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,`${ability.id}/${side}: ${JSON.stringify(found.skipped)}`);assert.equal(f.state.pendingAbility.side,side);const resolved=decide(f,ability.id);assert.equal(resolved.ok,true,`${ability.id}/${side}: ${resolved.reason}`);assert.equal(f.state.pendingAttack.power,13000);assert.equal(f.own.rear[3].uid.startsWith('center-rg-'),true);}
});
test('no prompt for non-Vanguard attacks, no center Rear-Guard, unrelated source, or wrong turn',()=>{
  const ability=family[0];for(const patch of [{targetLocation:'rear-guard'},{sourceCardInstanceId:'unrelated'},{actingPlayerId:'player-guest',turnPlayerId:'player-guest'}]){const f=fixture(ability);const event=Engine.createGameEvent(f.state,{...f.event,...patch,eventId:undefined,sequence:undefined});assert.equal(Reducer.discoverAutoTriggers(f.state,[event],Engine).queued.length,0,JSON.stringify(patch));}const noCenter=fixture(ability,'human',{center:false});assert.equal(Reducer.discoverAutoTriggers(noCenter.state,[noCenter.event],Engine).queued.length,0);
});
test('center column removed before resolution invalidates the prompt without changing power',()=>{
  const ability=family[0],f=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);f.own.rear[3]=null;const before=f.source.turnPowerBoost;assert.equal(decide(f,ability.id).ok,false);assert.equal(f.source.turnPowerBoost,before);
});
