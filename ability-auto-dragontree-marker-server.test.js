'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const IDS=['cfa-10622','cfa-10639','cfa-10662','cfa-10717','cfa-10730'];
const TEXT='AUTO: When this unit is placed on RC, COST [Counter Blast 1], choose one of your RC without any Dragontree markers, and put a Dragontree marker.';
const CATALOG=new Map(loadCatalog().map(card=>[String(card.id),card]));
const ABILITIES=IDS.map(id=>{const card=CATALOG.get(id);assert.ok(card,id);const ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${id}:0`);assert.ok(ability,id);return ability;});
const SEATS={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const CIRCLES=['rear-left','rear-right','rear-back-left','rear-back-center','rear-back-right'];
function card(cardId,uid,playerId){const source=CATALOG.get(cardId);return{uid,cardId,cardName:source?.name,grade:Number(source?.grade||0),type:source?.type,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true}}
function fixture(ability,side='human'){
  const ownId=side==='human'?'player-host':'player-guest',enemyId=side==='human'?'player-guest':'player-host',source=card(ability.cardId,`src-${side}`,ownId);
  const own={playerId:ownId,vanguard:card('cfa-20',`vg-${side}`,ownId),rear:Array(5).fill(null),accelZones:1,accelTypes:[],giftZones:[],deck:[],hand:[],soul:[],drop:[],bind:[],damage:[{uid:`damage-${side}`,faceDown:false}],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  own.rear[0]=source;const enemy={playerId:enemyId,vanguard:card('cfa-20',`enemy-vg-${side}`,enemyId),rear:Array(5).fill(null),accelZones:0,accelTypes:[],giftZones:[],deck:[],hand:[],soul:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]};
  const state={matchId:`dragontree-${side}`,stateVersion:1,turn:2,side,phase:2,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,players:side==='human'?{human:own,bot:enemy}:{human:enemy,bot:own}};
  const player=state.players[side];const event=Engine.createGameEvent(state,{type:'card.placed',actingPlayerId:ownId,turnPlayerId:ownId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownId,sourceControllerPlayerId:ownId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownId,subjectControllerPlayerId:ownId,previousLocation:'hand',currentLocation:'rear-left',circle:'rear-left',timingWindow:'placement'});
  return{ability,side,ownId,enemyId,source,own,enemy,state,event,player};
}
function decide(f,zone,auth=f.side==='human'?SEATS.hostAuthUid:SEATS.guestAuthUid,id=`action-${f.side}`){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId:id,expectedStateVersion:1,payload:{accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,circleZone:zone,costSelections:{cb:[f.own.damage[0].uid]}}}},SEATS,Engine)}

test('five reviewed D-BT09 Dragontree abilities match exact card text and share only the supported marker effect',()=>{
  for(const ability of ABILITIES){assert.equal(ability.printedText,TEXT);assert.equal(ability.definition?.source?.patternId,'auto-rc-placement-counter-blast-place-dragontree-marker-v1');assert.equal(ability.definition?.optional,false);assert.deepEqual(ability.requiredLocation,['rear-guard']);assert.deepEqual(ability.trigger?.circles,['rear-guard']);assert.deepEqual(ability.costs,[{type:'counter-blast',count:1}]);assert.deepEqual(ability.definition.effects,[{op:'place-circle-marker',target:'chosen-controller-circle',markerType:'Dragontree',circleTypes:['rear-guard']}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true);}
});

test('host and joining player privately resolve their own marker choice and Counter Blast',()=>{
  for(const ability of ABILITIES)for(const side of ['human','bot']){const f=fixture(ability,side);const result=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(result.queued.length,1,`${ability.id}/${side}: ${JSON.stringify(result.skipped)}`);assert.equal(f.state.pendingAbility.side,side);assert.equal(Engine.projectPendingAbilitiesForSide(f.state,side).pendingAbility.instance.uid,f.source.uid);assert.equal(Engine.projectPendingAbilitiesForSide(f.state,side==='human'?'bot':'human').pendingAbility,null);const resolved=decide(f,'rear-right');assert.equal(resolved.ok,true,JSON.stringify(resolved));assert.deepEqual(f.own.giftZones,[{type:'Dragontree',zone:'rear-right'}]);assert.deepEqual(f.enemy.giftZones,[]);assert.equal(f.own.damage[0].faceDown,true);}
});

test('rejects other-card, VC, wrong-player, unpayable, no-circle, duplicate, and stale choices',()=>{
  const ability=ABILITIES[0];
  for(const mutate of [f=>({...f.event,sourceCardInstanceId:'other'}),f=>({...f.event,currentLocation:'vanguard',circle:'vanguard'}),f=>({...f.event,actingPlayerId:f.enemyId,sourceControllerPlayerId:f.enemyId,subjectControllerPlayerId:f.enemyId}),f=>{f.own.damage[0].faceDown=true;return f.event;}]){const f=fixture(ability);const event=mutate(f);assert.equal(Reducer.discoverAutoTriggers(f.state,[event],Engine).queued.length,0);}
  const none=fixture(ability);none.own.giftZones=[...CIRCLES.map(zone=>({type:'Dragontree',zone})),{type:'Dragontree',zone:'accel-1'}];assert.equal(Reducer.discoverAutoTriggers(none.state,[none.event],Engine).queued.length,0);
  const invalid=fixture(ability);Reducer.discoverAutoTriggers(invalid.state,[invalid.event],Engine);assert.equal(decide(invalid,'rear-right',invalid.side==='human'?SEATS.guestAuthUid:SEATS.hostAuthUid,'foreign-actor').ok,false);assert.equal(decide(invalid,'vanguard').reason,'invalid-marker-circle');assert.equal(decide(invalid,'rear-left').ok,true);const stale=fixture(ability);Reducer.discoverAutoTriggers(stale.state,[stale.event],Engine);stale.own.giftZones.push({type:'Dragontree',zone:'rear-right'});assert.equal(decide(stale,'rear-right').ok,false);
  const duplicate=fixture(ability);Reducer.discoverAutoTriggers(duplicate.state,[duplicate.event],Engine);assert.equal(decide(duplicate,'rear-right').ok,true);assert.equal(duplicate.state.pendingAbility,null);
});

test('empty Rear-Guard Circles and modeled Accel Circles are legal targets; an existing Dragontree marker blocks only its own circle',()=>{
  const f=fixture(ABILITIES[0]);f.own.giftZones.push({type:'Treasures',zone:'rear-left'});assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);assert.equal(decide(f,'rear-left').ok,true);const g=fixture(ABILITIES[0]);Reducer.discoverAutoTriggers(g.state,[g.event],Engine);assert.equal(decide(g,'accel-1').ok,true);
});
