'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const IDS=['cfa-2406','cfa-2437','cfa-2472','cfa-4599','cfa-4612','cfa-4808'];
const PATTERN='auto-place-rc-soul-blast-draw-v1',TEXT='AUTO: [Soul Blast 2] When this unit is placed on RC, you may pay the cost. If you do, draw a card.';
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function inst(cardId,uid,playerId){const c=cards.get(String(cardId));return{uid,cardId:String(cardId),cardName:c?.name,ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,grade:Number(c?.grade),power:8000};}
function fixture(cardId=IDS[0],side='human',{soulCount=2,circle='rear-left'}={}){
  const card=cards.get(cardId),ability=Engine.parseCardAbilitiesCached(card).find(x=>x.id===`${cardId}:0`),playerId=side==='human'?'player-host':'player-guest',otherId=side==='human'?'player-guest':'player-host';
  const source=inst(cardId,`source-${cardId}-${side}`,playerId),soul=Array.from({length:soulCount},(_,i)=>inst('cfa-3',`soul-${side}-${i}`,playerId)),deck=[inst('cfa-3',`draw-${side}`,playerId)];
  const players={human:{playerId:'player-host',vanguard:null,rear:Array(5).fill(null),hand:[],soul:side==='human'?soul:[],deck:[],drop:[],bind:[],damage:[],orders:[],crests:[],extra:[],guardCircle:[],gDeck:[],gZone:[],removed:[]},bot:{playerId:'player-guest',vanguard:null,rear:Array(5).fill(null),hand:[],soul:side==='bot'?soul:[],deck:[],drop:[],bind:[],damage:[],orders:[],crests:[],extra:[],guardCircle:[],gDeck:[],gZone:[],removed:[]}};
  const rearIndex=circle==='rear-left'?0:circle==='rear-right'?1:2;if(circle.startsWith('rear-'))players[side].rear[rearIndex]=source;else if(circle==='vanguard')players[side].vanguard=source;else players[side].hand.push(source);
  players[side].deck=deck;
  const state={matchId:`rc-sb-draw-${cardId}-${side}`,stateVersion:1,eventSequence:0,processedActionIds:[],processedEventIds:[],processedAbilityTriggers:[],pendingAbility:null,pendingAbilities:[],turn:3,phase:4,side,players};
  const event=Engine.createGameEvent(state,{type:'card.placed',actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:'hand',currentLocation:circle,circle,phase:'main',timingWindow:'call-resolution'});
  return{state,event,ability,source,soul,deck,side,playerId,otherId};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function respond(f,{accept=true,actor=f.side,actionId=`resolve-${f.side}`,soulUids=f.soul.slice(0,2).map(x=>x.uid)}={}){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor==='human'?seats.hostAuthUid:seats.guestAuthUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{sb:soulUids}}}},seats,Engine);}

test('all six catalog abilities preserve their exact optional RC Soul Blast 2 draw definition',()=>{
  for(const id of IDS){const f=fixture(id);assert.equal(f.ability.printedText,TEXT,id);assert.equal(f.ability.definition.source.patternId,PATTERN,id);assert.deepEqual(f.ability.requiredLocation,['rear-guard'],id);assert.deepEqual(f.ability.trigger.circles,['rear-guard'],id);assert.deepEqual(f.ability.costs,[{type:'soul-blast',count:2}],id);assert.equal(f.ability.canDecline,true,id);assert.equal(Reducer.supportsServerAbilityEffects(f.ability),true,id);}
});
test('each online player independently pays their own Soul Blast and draws only on their exact placement',()=>{
  for(const id of IDS)for(const side of ['human','bot']){const f=fixture(id,side),result=discover(f);assert.equal(result.queued.length,1,`${id}/${side}`);assert.equal(f.state.pendingAbility.side,side);const done=respond(f);assert.equal(done.ok,true,`${id}/${side}: ${done.reason}`);assert.equal(f.state.players[side].soul.length,0);assert.equal(f.state.players[side].hand[0].uid,`draw-${side}`);assert.equal(f.state.players[side].deck.length,0);}
});
test('insufficient Soul, wrong circle, and a different placed instance never create the prompt',()=>{
  const broke=fixture(IDS[0],'human',{soulCount:1});assert.equal(discover(broke).queued.length,0);
  const vc=fixture(IDS[0],'bot',{circle:'vanguard'});assert.equal(discover(vc).queued.length,0);
  const wrong=fixture(IDS[0]);wrong.event=Engine.createGameEvent(wrong.state,{...wrong.event,eventId:undefined,sequence:undefined,sourceCardInstanceId:'other-copy',cardInstanceId:'other-copy',subjectCardInstanceId:'other-copy'});assert.equal(discover(wrong).queued.length,0);
});
test('decline is free, and the host cannot pay for or resolve the joining player\'s ability',()=>{
  const declined=fixture(IDS[0]);assert.equal(discover(declined).queued.length,1);assert.equal(respond(declined,{accept:false}).ok,true);assert.equal(declined.state.players.human.soul.length,2);assert.equal(declined.state.players.human.hand.length,0);
  const joiner=fixture(IDS[1],'bot');assert.equal(discover(joiner).queued.length,1);const before=JSON.stringify(joiner.state);assert.equal(respond(joiner,{actor:'human'}).ok,false);assert.equal(JSON.stringify(joiner.state),before);
});
