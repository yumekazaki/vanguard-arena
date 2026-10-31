'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');

const IDS=['cfa-8541','cfa-8571','cfa-8577','cfa-8585'];
const TARGETS={'cfa-8541':'Honebami Toushirou','cfa-8571':'Chiganemaru','cfa-8577':'Chiyoganemaru','cfa-8585':'Namazuo Toushirou'};
const CATALOG=new Map(loadCatalog().map(card=>[String(card.id),card]));
const ABILITIES=IDS.map(id=>{const card=CATALOG.get(id);assert.ok(card,id);const abilities=Engine.parseCardAbilitiesCached(card);assert.equal(abilities.length,1,id);return abilities[0]});
const SEATS={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const SOURCE_TO_TARGET={'cfa-8541':'cfa-8585','cfa-8571':'cfa-8577','cfa-8577':'cfa-8571','cfa-8585':'cfa-8541'};
const RC=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right'];

function instance(cardId,uid,playerId,extra={}){const def=CATALOG.get(cardId);return{uid,cardId,cardName:def?.name,grade:Number(def?.grade||0),type:def?.type,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,...extra}}
function fixture(ability,side='human'){
  const ownId=side==='human'?'player-host':'player-guest',enemyId=side==='human'?'player-guest':'player-host';
  const source=instance(ability.cardId,`source-${side}`,ownId,{zone:'rear-guard',circle:'rear-left'}),target=instance(SOURCE_TO_TARGET[ability.cardId],`target-${side}`,ownId,{zone:'drop'});
  const own={playerId:ownId,vanguard:instance('cfa-20',`vanguard-${side}`,ownId,{zone:'vanguard',circle:'vanguard'}),rear:Array(5).fill(null),accelZones:0,damage:[instance('cfa-20',`damage-${side}`,ownId,{faceDown:false})],deck:[],hand:[],soul:[],drop:[target],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],crests:[],usedAbilities:[]};own.rear[0]=source;
  const enemy={playerId:enemyId,vanguard:instance('cfa-20',`enemy-vanguard-${side}`,enemyId,{zone:'vanguard',circle:'vanguard'}),rear:Array(5).fill(null),accelZones:0,damage:[],deck:[],hand:[],soul:[],drop:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],crests:[],usedAbilities:[]};
  const state={matchId:`same-name-drop-call-${side}`,stateVersion:1,turn:2,side,phase:4,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,players:side==='human'?{human:own,bot:enemy}:{human:enemy,bot:own}};
  const event=Engine.createGameEvent(state,{type:'card.placed',actingPlayerId:ownId,turnPlayerId:ownId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownId,sourceControllerPlayerId:ownId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownId,subjectControllerPlayerId:ownId,previousLocation:'hand',currentLocation:'rear-left',circle:'rear-left',timingWindow:'placement'});
  return{ability,side,ownId,enemyId,source,target,own,enemy,state,event,player:state.players[side]};
}
function decision(f,selection={},auth=f.side==='human'?SEATS.hostAuthUid:SEATS.guestAuthUid,actionId=`resolve-${f.side}`){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId,expectedStateVersion:f.state.stateVersion,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[`damage-${f.side}`]},effectUid:f.target.uid,callZone:'rear-right',...selection}}},SEATS,Engine)}

test('exact four-card AUTO records preserve their printed target names, source-from-hand RC trigger, and Counter Blast cost',()=>{
  for(const ability of ABILITIES){assert.equal(ability.definition?.source?.patternId,'auto-rc-placement-counter-blast-call-named-drop-to-open-rearguard-v1');assert.equal(ability.definition.printedText,ability.printedText);assert.deepEqual(ability.requiredLocation,['rear-guard']);assert.equal(ability.trigger?.eventType,'card.placed');assert.deepEqual(ability.trigger?.circles,['rear-guard']);assert.equal(ability.trigger?.sourceLocation,'hand');assert.deepEqual(ability.costs,[{type:'counter-blast',count:1}]);assert.equal(ability.canDecline,false);assert.equal(ability.definition.optional,false);assert.deepEqual(ability.definition.effects,[{op:'call-named-drop-card-to-rearguard',target:'controller',cardName:TARGETS[ability.cardId],destination:'rear-guard',position:'stand',requireOpenCircle:true}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true)}
});

test('host and joining player resolve the exact Drop card to their own open Rear-Guard circle',()=>{
  for(const ability of ABILITIES)for(const side of ['human','bot']){const f=fixture(ability,side),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,`${ability.id}/${side}: ${JSON.stringify(found.skipped)}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);assert.equal(Engine.projectPendingAbilitiesForSide(f.state,side).pendingAbility.instance.uid,f.source.uid);assert.equal(Engine.projectPendingAbilitiesForSide(f.state,side==='human'?'bot':'human').pendingAbility,null);const result=decision(f);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(f.own.drop.some(card=>card.uid===f.target.uid),false);assert.equal(f.own.rear[1].uid,f.target.uid);assert.equal(f.own.rear[1].circle,'rear-right');assert.equal(f.own.rear[1].rested,false);assert.equal(f.own.rear[1].ownerPlayerId,f.ownId);assert.equal(f.own.rear[1].controllerPlayerId,f.ownId);assert.equal(f.own.damage[0].faceDown,true);assert.equal(f.enemy.rear.some(Boolean),false);assert.equal(f.enemy.damage.length,0)}
});

test('does not offer the AUTO for a different source, non-RC circle, or mismatched actor/controller',()=>{
  const mutations=[
    f=>({...f.event,sourceCardInstanceId:'other-source'}),
    f=>({...f.event,currentLocation:'vanguard',circle:'vanguard'}),
    f=>({...f.event,circle:'rear-right'}),
    f=>({...f.event,previousLocation:'drop'}),
    f=>({...f.event,actingPlayerId:f.enemyId,sourceControllerPlayerId:f.enemyId,subjectControllerPlayerId:f.enemyId}),
    f=>{f.source.controllerPlayerId=f.enemyId;return f.event;}
  ];
  for(const mutate of mutations){const f=fixture(ABILITIES[0]);const event=mutate(f);assert.equal(Reducer.discoverAutoTriggers(f.state,[event],Engine).queued.length,0)}
  const stale=fixture(ABILITIES[0]);stale.own.rear[0]=null;stale.own.drop.push(stale.source);assert.equal(Reducer.discoverAutoTriggers(stale.state,[stale.event],Engine).queued.length,0);
});

test('an empty Accel Circle is a legal open RC destination and preserves the called instance',()=>{
  const f=fixture(ABILITIES[0]);f.own.accelZones=1;f.own.rear.push(null);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);const result=decision(f,{callZone:'accel-1'},undefined,'call-to-accel');assert.equal(result.ok,true,JSON.stringify(result));assert.equal(f.own.rear[5].uid,f.target.uid);assert.equal(f.own.rear[5].circle,'accel-1');assert.equal(f.own.rear[5].rested,false);
});

test('missing Counter Blast, named Drop target, or open circle prevents eligibility and claims the event once',()=>{
  for(const mode of ['cost','target','circle']){const f=fixture(ABILITIES[0]);if(mode==='cost')f.own.damage[0].faceDown=true;if(mode==='target')f.own.drop[0]=instance('cfa-20',`wrong-name-${mode}`,f.ownId,{zone:'drop'});if(mode==='circle')for(let i=1;i<5;i++)f.own.rear[i]=instance('cfa-20',`occupied-${i}`,f.ownId,{zone:'rear-guard',circle:RC[i]});const first=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(first.queued.length,0,mode);assert.equal(first.skipped[0]?.reason,mode==='cost'?'unpayable-cost':mode==='target'?'no-named-drop-target':'no-open-rearguard-circle');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0,`duplicate ${mode} event`)}
});

test('stale and duplicate placement events cannot create duplicate pending resolutions',()=>{
  const duplicate=fixture(ABILITIES[0]);const first=Reducer.discoverAutoTriggers(duplicate.state,[duplicate.event],Engine);assert.equal(first.queued.length,1);assert.equal(Reducer.discoverAutoTriggers(duplicate.state,[duplicate.event],Engine).queued.length,0);assert.equal(duplicate.state.pendingAbilities.length,0);
  const stale=fixture(ABILITIES[0]);const event={...stale.event,eventId:'stale-event',previousLocation:'drop'};assert.equal(Reducer.discoverAutoTriggers(stale.state,[event],Engine).queued.length,0);
});

test('rejects wrong named target, occupied circle, and an unpaid Counter Blast without partial state changes',()=>{
  for(const failure of ['target','circle','cost']){const f=fixture(ABILITIES[0]);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);const beforeDrop=f.own.drop.map(card=>card.uid);if(failure==='target')f.own.drop[0]=instance('cfa-20','wrong-target',f.ownId,{zone:'drop'});if(failure==='circle')f.own.rear[1]=instance('cfa-20','late-occupant',f.ownId,{zone:'rear-guard',circle:'rear-right'});if(failure==='cost')f.own.damage[0].faceDown=true;const result=decision(f,{},undefined,`reject-${failure}`);assert.equal(result.ok,false,failure);assert.deepEqual(f.own.drop.map(card=>card.uid),failure==='target'?['wrong-target']:beforeDrop);assert.equal(f.own.damage[0].faceDown,failure==='cost');assert.equal(f.own.rear[1]?.uid,failure==='circle'?'late-occupant':undefined);assert.equal(f.own.rear[0].uid,f.source.uid)}
  const missingPayment=fixture(ABILITIES[0]);assert.equal(Reducer.discoverAutoTriggers(missingPayment.state,[missingPayment.event],Engine).queued.length,1);const noCost=decision(missingPayment,{costSelections:{cb:[]}},undefined,'no-cost-selected');assert.equal(noCost.ok,false);assert.equal(missingPayment.own.damage[0].faceDown,false);assert.equal(missingPayment.own.drop[0].uid,missingPayment.target.uid);assert.equal(missingPayment.own.rear[1],null);
});

test('rejects a request by the opponent for the source controller’s pending ability',()=>{
  const f=fixture(ABILITIES[0],'bot');assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);const result=decision(f,{},SEATS.hostAuthUid,'foreign-seat');assert.equal(result.ok,false);assert.equal(f.own.damage[0].faceDown,false);assert.equal(f.own.drop[0].uid,f.target.uid);
});
