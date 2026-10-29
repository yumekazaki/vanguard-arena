'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const PATTERN='auto-own-attack-hand-advantage-power-battle-v1';
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const family=catalog.flatMap(card=>Engine.parseCardAbilitiesCached(card).filter(ability=>ability.definition?.source?.patternId===PATTERN));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const expected={'cfa-11746':{index:0,zones:['vanguard','rear-guard'],power:3000},'cfa-1197':{index:0,zones:['vanguard','rear-guard'],power:3000},'cfa-1204':{index:0,zones:['vanguard','rear-guard'],power:3000},'cfa-1205':{index:0,zones:['vanguard'],power:3000},'cfa-2004':{index:1,zones:['vanguard'],power:2000},'cfa-341':{index:0,zones:['vanguard','rear-guard'],power:3000},'cfa-418':{index:0,zones:['vanguard','rear-guard'],power:3000},'cfa-666':{index:0,zones:['vanguard','rear-guard'],power:3000}};
function instance(cardId,uid,playerId,extra={}){const c=cards.get(String(cardId));return{uid,cardId:String(cardId),cardName:c?.name,type:c?.type||'Unit',grade:Number(c?.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,power:10000,...extra};}
function fixture(ability,side='human',{ownHand=3,opponentHand=2,sourceZone=null,targetZone='vanguard'}={}){
  const x=expected[ability.cardId],ownerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest',zone=sourceZone||x.zones[0],source=instance(ability.cardId,`hand-attack-source-${ability.id}-${side}`,ownerId),attacker=source,target=instance('cfa-3',`hand-attack-target-${ability.id}-${side}`,otherId);
  const own={playerId:ownerId,vanguard:null,rear:Array(5).fill(null),soul:[],deck:[],hand:Array.from({length:ownHand},(_,i)=>instance('cfa-3',`hand-own-${ability.id}-${side}-${i}`,ownerId)),drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};if(zone==='vanguard')own.vanguard=source;else own.rear[0]=source;
  const opponent={playerId:otherId,vanguard:targetZone==='vanguard'?target:instance('cfa-3',`op-vg-${ability.id}-${side}`,otherId),rear:Array(5).fill(null),soul:[],deck:[],hand:Array.from({length:opponentHand},(_,i)=>instance('cfa-3',`hand-op-${ability.id}-${side}-${i}`,otherId)),drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};if(targetZone==='rear-guard')opponent.rear[0]=target;
  const state={matchId:`hand-attack-${ability.id}-${side}`,stateVersion:1,turn:4,phase:5,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbility:null,pendingAbilities:[],players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own},pendingAttack:{battleId:`hand-battle-${ability.id}-${side}`,attackerUid:attacker.uid,attackerSide:side,attackerZone:zone,attackerPlayerId:ownerId,defenderSide:otherSide,targetUid:target.uid,targetZone,power:10000,targetPower:10000,critical:1}};
  const event=Engine.createGameEvent(state,{type:'unit.attacked',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:zone,currentLocation:zone,targetCardInstanceIds:[target.uid],targetLocation:targetZone,battleId:state.pendingAttack.battleId,phase:'battle',timingWindow:'attack-declared'});
  return{state,event,source,target,own,opponent,side,ownerId,otherSide,x,zone};
}
function decide(f,abilityId,actorAuthUid=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid,actionId:`resolve-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId}}},seats,Engine);}

test('all eight definitions preserve their source circle, hand comparison, and battle power',()=>{
  assert.equal(family.length,8);
  for(const ability of family){const x=expected[ability.cardId];assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(d=>d.id===ability.id),ability.id);assert.equal(ability.definition.source.patternId,PATTERN);assert.deepEqual(ability.requiredLocation,x.zones);assert.deepEqual(ability.conditions,[{type:'controller-has-more-cards-in-hand-than-opponent'}]);assert.equal(ability.trigger.eventType,'unit.attacked');assert.equal(ability.trigger.subject,'source');assert.equal(ability.definition.effects[0].amount,x.power);assert.equal(ability.canDecline===true,false);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);}
});
test('both online players resolve only their own exact attack and gain the printed battle power',()=>{
  for(const ability of family)for(const side of ['human','bot'])for(const targetZone of ['vanguard','rear-guard']){const f=fixture(ability,side,{targetZone}),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,`${ability.id}/${side}/${targetZone}: ${JSON.stringify(found.skipped)}`);assert.equal(f.state.pendingAbility.side,side);const result=decide(f,ability.id);assert.equal(result.ok,true,`${ability.id}/${side}: ${result.reason}`);assert.equal(f.state.pendingAttack.power,10000+f.x.power);assert.equal(f.opponent.vanguard.turnPowerBoost||0,0);}
});
test('equal or lower hand count, another attacker, and an illegal circle never trigger',()=>{
  const ability=family[0];for(const sizes of [[2,2],[1,2]]){const f=fixture(ability,'human',{ownHand:sizes[0],opponentHand:sizes[1]});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0,JSON.stringify(sizes));}
  const wrongAttack=fixture(ability);const altered=Engine.createGameEvent(wrongAttack.state,{...wrongAttack.event,sourceCardInstanceId:'other',cardInstanceId:'other',subjectCardInstanceId:'other',eventId:undefined,sequence:undefined});assert.equal(Reducer.discoverAutoTriggers(wrongAttack.state,[altered],Engine).queued.length,0);
  const vcOnly=fixture(family.find(x=>x.cardId==='cfa-1205'),'human',{sourceZone:'rear-guard'});assert.equal(Reducer.discoverAutoTriggers(vcOnly.state,[vcOnly.event],Engine).queued.length,0);
});
test('hand advantage and exact source are rechecked when the mandatory trigger resolves',()=>{
  const ability=family[0],f=fixture(ability,'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);for(let i=0;i<2;i++)f.opponent.hand.push(instance('cfa-3',`late-hand-${i}`,f.otherSide==='human'?'player-host':'player-guest'));const before=JSON.stringify(f.state);assert.equal(decide(f,ability.id).ok,false);assert.equal(JSON.stringify(f.state),before);
  const stale=fixture(ability);assert.equal(Reducer.discoverAutoTriggers(stale.state,[stale.event],Engine).queued.length,1);stale.own.rear[0]=null;stale.own.drop.push(stale.source);const stateBefore=JSON.stringify(stale.state);assert.equal(decide(stale,ability.id).ok,false);assert.equal(JSON.stringify(stale.state),stateBefore);
});
