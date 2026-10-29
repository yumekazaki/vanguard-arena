"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const pattern='auto-own-attack-counter-blast-power-battle-v1';
const catalog=loadCatalog();
const batch=catalog.flatMap(card=>Engine.parseCardAbilitiesCached(card).filter(a=>a.definition?.source?.patternId===pattern).map(ability=>({card,ability})));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function fixture(item,side='human'){
 const {card,ability}=item,ownerId=side==='human'?'player-host':'player-guest',enemyId=side==='human'?'player-guest':'player-host';
 const zone=ability.requiredLocation.includes('vanguard')?'vanguard':'rear-left';
 const source={uid:`source-${card.id}-${side}`,cardId:String(card.id),cardName:card.name,ownerPlayerId:ownerId,controllerPlayerId:ownerId,unitCard:true,power:10000};
 const ownVg=zone==='vanguard'?source:{uid:`vg-${side}`,cardId:'cfa-3',cardName:'Test Vanguard',grade:3,ownerPlayerId:ownerId,controllerPlayerId:ownerId};
 const enemyVg={uid:`opp-vg-${side}`,cardId:'cfa-3',cardName:'Opponent Vanguard',grade:3,ownerPlayerId:enemyId,controllerPlayerId:enemyId};
 const damage=[{uid:`damage-${side}`,cardId:'cfa-2',ownerPlayerId:ownerId,controllerPlayerId:ownerId,faceDown:false}];
 const players={human:{playerId:'player-host',vanguard:side==='human'?ownVg:enemyVg,rear:side==='human'&&zone==='rear-left'?[source]:[],damage:side==='human'?damage:[],hand:[],soul:[],drop:[],deck:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]},bot:{playerId:'player-guest',vanguard:side==='bot'?ownVg:enemyVg,rear:side==='bot'&&zone==='rear-left'?[source]:[],damage:side==='bot'?damage:[],hand:[],soul:[],drop:[],deck:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],triggerZone:[]}};
 const state={matchId:'own-attack-cb-batch',stateVersion:1,turn:2,side,phase:5,eventSequence:0,processedEventIds:[],processedActionIds:[],processedAbilityTriggers:[],pendingAbilities:[],players,pendingAttack:{battleId:`battle-${side}`,attackerSide:side,attackerUid:source.uid,attackerZone:zone,attackerPlayerId:ownerId,defenderSide:side==='human'?'bot':'human',targetUid:enemyVg.uid,targetZone:'vanguard',power:10000,critical:1}};
 const event=Engine.createGameEvent(state,{type:'unit.attacked',actingPlayerId:ownerId,turnPlayerId:ownerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,attackingCardInstanceIds:[source.uid],currentLocation:zone,targetCardInstanceIds:[enemyVg.uid],targetLocation:'vanguard',battleId:state.pendingAttack.battleId,phase:'battle',timingWindow:'attack-declared'});
 return{state,event,card,ability,side,ownerId,source,damage};
}
test('all 24 own-attack Counter Blast abilities have trusted exact definitions and retain printed cost and battle power',()=>{
 assert.equal(batch.length,24);
 for(const item of batch){const {ability}=item;assert.ok(Engine.getReviewedAbilityDefinitionsForCard(item.card.id).some(d=>d.id===ability.id),ability.id);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);assert.equal(ability.trigger.eventType,'unit.attacked',ability.id);assert.equal(ability.trigger.subject,'source',ability.id);assert.equal(ability.canDecline,true,ability.id);assert.deepEqual(ability.costs,[{type:'counter-blast',count:1}],ability.id);assert.deepEqual(ability.effects,[{op:'modify-power',target:'source',amount:3000,duration:'battle'}],ability.id);}
});
test('the attacking source controller privately pays their own Counter Blast and gets battle power on both seats',()=>{
 for(const item of batch)for(const side of ['human','bot']){const f=fixture(item,side);const result=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(result.queued.length,1,`${f.ability.id}:${side}`);assert.equal(f.state.pendingAbility.side,side,`${f.ability.id}:${side}`);const resolved=Reducer.applyAbilityDecision(f.state,{actorAuthUid:side==='human'?seats.hostAuthUid:seats.guestAuthUid,actionId:`resolve-${f.ability.id}-${side}`,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[f.damage[0].uid]}}}},seats,Engine);assert.equal(resolved.ok,true,`${f.ability.id}:${side}:${resolved.reason}`);assert.equal(f.damage[0].faceDown,true,`${f.ability.id}:${side}`);assert.equal(f.state.pendingAttack.power,13000,`${f.ability.id}:${side}`);}
});
test('another unit attacking, an unavailable cost, or the opponent cannot claim or proxy this AUTO',()=>{
 const item=batch[0],wrong=fixture(item,'bot');wrong.event={...wrong.event,sourceCardInstanceId:'other',cardInstanceId:'other',subjectCardInstanceId:'other',attackingCardInstanceIds:['other']};assert.equal(Reducer.discoverAutoTriggers(wrong.state,[wrong.event],Engine).queued.length,0);
 const unaffordable=fixture(item,'bot');unaffordable.damage[0].faceDown=true;assert.equal(Reducer.discoverAutoTriggers(unaffordable.state,[unaffordable.event],Engine).queued.length,0);
 const f=fixture(item,'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);const before=JSON.stringify(f.state);const forged=Reducer.applyAbilityDecision(f.state,{actorAuthUid:seats.hostAuthUid,actionId:'forged',expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[f.damage[0].uid]}}}},seats,Engine);assert.equal(forged.ok,false);assert.equal(JSON.stringify(f.state),before);
});
