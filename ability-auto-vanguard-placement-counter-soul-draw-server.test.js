'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const card=loadCatalog().find(x=>x.id==='cfa-2491'),ability=Engine.parseCardAbilitiesCached(card).find(x=>x.id==='cfa-2491:1');
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
function unit(uid,owner,extra={}){return{uid,cardId:extra.cardId||'cfa-3',cardName:extra.cardName||'Card',ownerPlayerId:owner,controllerPlayerId:owner,unitCard:true,grade:1,power:8000,...extra};}
function fixture(side='human',{faceUpDamage=1,soulCount=1,circle='vanguard'}={}){
 const playerId=side==='human'?'player-host':'player-guest',source=unit(`source-${side}`,playerId,{cardId:'cfa-2491',cardName:card.name}),damage=Array.from({length:faceUpDamage},(_,i)=>unit(`damage-${side}-${i}`,playerId,{zone:'damage',faceDown:false})),soul=Array.from({length:soulCount},(_,i)=>unit(`soul-${side}-${i}`,playerId,{zone:'soul'})),deck=[unit(`draw-${side}`,playerId,{zone:'deck'})];
 const mk=id=>({playerId:id,vanguard:null,rear:Array(5).fill(null),hand:[],soul:[],deck:[],drop:[],bind:[],damage:[],orders:[],crests:[],extra:[],guardCircle:[],gDeck:[],gZone:[],removed:[]});
 const players={human:mk('player-host'),bot:mk('player-guest')};players[side].vanguard=source;players[side].damage=damage;players[side].soul=soul;players[side].deck=deck;
 const state={matchId:`vanguard-placement-cb-sb-draw-${side}`,stateVersion:1,eventSequence:0,processedActionIds:[],processedEventIds:[],processedAbilityTriggers:[],pendingAbility:null,pendingAbilities:[],turn:5,phase:4,side,players};
 const event=Engine.createGameEvent(state,{type:'card.placed',actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:'hand',currentLocation:circle,circle,phase:'main',timingWindow:'ride-resolution'});
 return{state,event,source,side,playerId};
}
function discover(f){return Reducer.discoverAutoTriggers(f.state,[f.event],Engine);}
function respond(f,{accept=true,actor=f.side,actionId='resolve'}={}){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor==='human'?seats.hostAuthUid:seats.guestAuthUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:'ability-response',accept,selection:{instanceUid:f.source.uid,abilityId:ability.id,costSelections:{cb:[f.state.players[f.side].damage[0]?.uid].filter(Boolean),sb:[f.state.players[f.side].soul[0]?.uid].filter(Boolean)}}}},seats,Engine);}

test('Battle Sister, Mille-feuille has an exact trusted optional VC placement AUTO with both printed costs',()=>{
 assert.equal(ability.printedText,'AUTO: [Counter Blast 1 & Soul Blast 1] When this unit is placed on VC, you may pay the cost. If you do, draw a card.');
 assert.equal(Engine.getReviewedAbilityDefinitionsForCard('cfa-2491').some(x=>x.id==='cfa-2491:1'),true);
 assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
 assert.deepEqual(ability.trigger.circles,['vanguard']);
 assert.deepEqual(ability.costs,[{type:'counter-blast',count:1},{type:'soul-blast',count:1}]);
});
test('host and joining player independently pay Counter Blast and Soul Blast for their own Vanguard placement',()=>{
 for(const side of ['human','bot']){const f=fixture(side),found=discover(f),located=Engine.locateCardInstance(f.state,f.source.uid);assert.equal(found.queued.length,1,JSON.stringify({found,located,abilityReady:Engine.autoAbilityReadiness(ability),event:f.event,match:Engine.eventMatchesAbilityTrigger(ability,'place',f.event,f.source.uid,'vanguard','vanguard',f.playerId),canPay:Engine.canPayAbilityCosts(ability,{faceUpDamage:1,soulCount:1})}));assert.equal(f.state.pendingAbility.side,side);assert.equal(respond(f,{actor:side==='human'?'bot':'human'}).ok,false);assert.equal(respond(f).ok,true);assert.equal(f.state.players[side].damage[0].faceDown,true);assert.equal(f.state.players[side].soul.length,0);assert.equal(f.state.players[side].hand[0].uid,`draw-${side}`);}
});
test('rear placement and either unavailable cost reject without prompting or partial payment',()=>{
 for(const options of [{circle:'rear-left'},{faceUpDamage:0},{soulCount:0}]){const f=fixture('human',options);assert.equal(discover(f).queued.length,0);if(f.state.players.human.damage[0])assert.equal(f.state.players.human.damage[0].faceDown,false);}
});
test('resolution rechecks both costs and decline pays nothing',()=>{
 const f=fixture();assert.equal(discover(f).queued.length,1);f.state.players.human.soul.length=0;const before=f.state.players.human.damage[0].faceDown;assert.equal(respond(f).ok,false);assert.equal(f.state.players.human.damage[0].faceDown,before);
 const declined=fixture();assert.equal(discover(declined).queued.length,1);assert.equal(respond(declined,{accept:false}).ok,true);assert.equal(declined.state.players.human.damage[0].faceDown,false);assert.equal(declined.state.players.human.soul.length,1);assert.equal(declined.state.players.human.hand.length,0);
});
