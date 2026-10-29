'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const PATTERN='auto-own-attack-opponent-rearguard-cap-power-battle-v1';
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const family=catalog.flatMap(card=>Engine.parseCardAbilitiesCached(card).filter(ability=>ability.definition?.source?.patternId===PATTERN));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const expected={'cfa-1077':{index:0,zones:['vanguard','rear-guard']},'cfa-1386':{index:0,zones:['vanguard','rear-guard']},'cfa-1727':{index:0,zones:['vanguard','rear-guard']},'cfa-509':{index:0,zones:['vanguard','rear-guard']},'cfa-551':{index:0,zones:['vanguard','rear-guard']},'cfa-546':{index:1,zones:['vanguard']}};
function instance(cardId,uid,playerId,extra={}){const c=cards.get(String(cardId));return{uid,cardId:String(cardId),cardName:c?.name,type:c?.type||'Unit',grade:Number(c?.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,power:10000,...extra};}
function fixture(ability,side='human',{opponentRearCount=2,sourceZone=null}={}){
  const x=expected[ability.cardId],ownerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest',zone=sourceZone||x.zones[0],source=instance(ability.cardId,`cap-source-${ability.id}-${side}`,ownerId),target=instance('cfa-3',`cap-target-${ability.id}-${side}`,otherId);
  const own={playerId:ownerId,vanguard:null,rear:Array(5).fill(null),soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};if(zone==='vanguard')own.vanguard=source;else own.rear[0]=source;
  const opponent={playerId:otherId,vanguard:target,rear:Array(5).fill(null),soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};for(let i=0;i<opponentRearCount;i++)opponent.rear[i]=instance('cfa-3',`op-rear-${i}-${ability.id}-${side}`,otherId);
  const state={matchId:`cap-${ability.id}-${side}`,stateVersion:1,turn:4,phase:5,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbility:null,pendingAbilities:[],players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own},pendingAttack:{battleId:`cap-battle-${ability.id}-${side}`,attackerUid:source.uid,attackerSide:side,attackerZone:zone,attackerPlayerId:ownerId,defenderSide:otherSide,targetUid:target.uid,targetZone:'vanguard',power:10000,targetPower:10000,critical:1}};
  const event=Engine.createGameEvent(state,{type:'unit.attacked',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:zone,currentLocation:zone,targetCardInstanceIds:[target.uid],targetLocation:'vanguard',battleId:state.pendingAttack.battleId,phase:'battle',timingWindow:'attack-declared'});
  return{state,event,source,own,opponent,side,ownerId,otherSide,x,zone};
}
function decide(f,ability,actorAuthUid=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid,actionId:`resolve-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:ability.id}}},seats,Engine);}

test('six exact catalog definitions preserve source circle, opponent Rear-Guard cap, and battle-only power',()=>{
  assert.equal(family.length,6);
  for(const ability of family){const x=expected[ability.cardId];assert.ok(x,ability.id);assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(d=>d.id===ability.id),ability.id);assert.equal(ability.definition.source.patternId,PATTERN);assert.deepEqual(ability.requiredLocation,x.zones);assert.deepEqual(ability.conditions,[{type:'opponent-rear-guards-at-most',count:2}]);assert.equal(ability.trigger.eventType,'unit.attacked');assert.equal(ability.trigger.subject,'source');assert.equal(ability.definition.effects[0].amount,3000);assert.equal(ability.definition.effects[0].duration,'battle');assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);}
});
test('both online players resolve only their exact attacking source when the opponent has at most two Rear-Guards',()=>{
  for(const ability of family)for(const side of ['human','bot']){const f=fixture(ability,side),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,`${ability.id}/${side}`);assert.equal(f.state.pendingAbility.side,side);const result=decide(f,ability);assert.equal(result.ok,true,`${ability.id}/${side}: ${result.reason}`);assert.equal(f.state.pendingAttack.power,13000);}
});
test('three opposing Rear-Guards, a different attacker, and the VC-only circle restriction prevent the trigger',()=>{
  const ability=family[0],overLimit=fixture(ability,'human',{opponentRearCount:3});assert.equal(Reducer.discoverAutoTriggers(overLimit.state,[overLimit.event],Engine).queued.length,0);
  const other=fixture(ability),forged=Engine.createGameEvent(other.state,{...other.event,sourceCardInstanceId:'other',cardInstanceId:'other',subjectCardInstanceId:'other',eventId:undefined,sequence:undefined});assert.equal(Reducer.discoverAutoTriggers(other.state,[forged],Engine).queued.length,0);
  const vcOnly=family.find(x=>x.cardId==='cfa-546'),illegal=fixture(vcOnly,'human',{sourceZone:'rear-guard'});assert.equal(Reducer.discoverAutoTriggers(illegal.state,[illegal.event],Engine).queued.length,0);
});
test('condition and source location are rechecked at resolution, and the opponent cannot proxy the owner',()=>{
  const ability=family[0],f=fixture(ability,'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);f.opponent.rear[2]=instance('cfa-3','late-third-rearguard',f.otherSide==='human'?'player-host':'player-guest');const before=JSON.stringify(f.state);assert.equal(decide(f,ability,seats.hostAuthUid).ok,false);assert.equal(JSON.stringify(f.state),before);
  const stale=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(stale.state,[stale.event],Engine).queued.length,1);stale.own.rear[0]=null;stale.own.drop.push(stale.source);const snapshot=JSON.stringify(stale.state);assert.equal(decide(stale,ability).ok,false);assert.equal(JSON.stringify(stale.state),snapshot);
});
