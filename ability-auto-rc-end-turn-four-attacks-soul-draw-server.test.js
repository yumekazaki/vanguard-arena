"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog();
const familyMembers=[
  {cardId:"cfa-6764",abilityId:"cfa-6764:1",source:"Bushiroad official card list"},
  {cardId:"cfa-9379",abilityId:"cfa-9379:1",source:"Bushiroad official card list"},
  {cardId:"cfa-13771",abilityId:"cfa-13771:2",source:"Cardfight Area snapshot"}
];
const ids=familyMembers.map(item=>item.cardId);
const pattern="auto-rc-end-turn-four-attacks-source-to-soul-draw-v1";
const printed="AUTO [RC]: At the end of your turn, if the total number of attacks this turn is four or more, COST [put this unit into your soul], and draw a card.";
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};

function card(cardId,uid,playerId,extra={}){
  const definition=catalog.find(item=>item.id===cardId);
  return{uid,cardId,cardName:definition?.name||cardId,grade:Number(definition?.grade||0),unitCard:/\bunit\b/i.test(definition?.type||""),ownerPlayerId:playerId,controllerPlayerId:playerId,...extra};
}
function fixture(side="human",cardId=ids[0],attacks={human:4,bot:0}){
  const playerId=side==="human"?"host-player":"guest-player",opponentSide=side==="human"?"bot":"human",opponentId=opponentSide==="human"?"host-player":"guest-player";
  const source=card(cardId,`source-${side}`,playerId,{zone:"rear-guard",circle:"rear-left"});
  const makePlayer=id=>({playerId:id,vanguard:card("cfa-14",`vg-${id}`,id,{zone:"vanguard",circle:"vanguard"}),rear:Array(5).fill(null),hand:[],deck:[card("cfa-3",`deck-${id}-1`,id),card("cfa-6",`deck-${id}-2`,id)],soul:[],damage:[],drop:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]});
  const players={human:makePlayer("host-player"),bot:makePlayer("guest-player")};
  players[side].rear[0]=source;
  const state={matchId:`four-attacks-${side}`,stateVersion:1,turn:4,phase:6,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTurnEnd:{side,playerId,turn:4,cleanupQueued:false},players};
  for(const [attackSide,count] of Object.entries(attacks))for(let index=0;index<count;index++)Engine.recordAttackCount(state,players[attackSide].playerId,`attack-${attackSide}-${index}`);
  const abilityId=familyMembers.find(item=>item.cardId===cardId)?.abilityId;
  const ability=Engine.parseCardAbilities(catalog.find(item=>item.id===cardId)).find(item=>item.id===abilityId);
  return{state,ability,source,side,playerId,opponentSide};
}
function endEvent(f,overrides={}){
  const event=Engine.createGameEvent(f.state,{type:"turn.ended",actingPlayerId:f.playerId,turnPlayerId:f.playerId,phase:"end",timingWindow:"turn-end",...overrides});
  f.state.pendingTurnEnd.turnEndEvent=event;
  f.state.pendingTurnEnd.turnEndEventId=event.eventId;
  return event;
}
function decide(f,{accept=true,actor=f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId=`resolve-${f.side}`}={}){
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor,actionId,expectedStateVersion:f.state.stateVersion,payload:{accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id}}},seats,Engine);
}
function discover(f,event=endEvent(f)){
  return Reducer.discoverAutoTriggers(f.state,[event],Engine);
}

test("the exact three-card family compiles to one trusted RC end-turn draw definition",()=>{
  for(const member of familyMembers){
    const cardId=member.cardId;
    const ability=Engine.parseCardAbilities(catalog.find(item=>item.id===cardId)).find(item=>item.id===member.abilityId);
    assert.equal(ability.printedText,printed);
    assert.equal(ability.definition.source.patternId,pattern);
    assert.equal(ability.definition.source.dataset,member.source);
    assert.deepEqual(ability.requiredLocation,["rear-guard"]);
    assert.equal(ability.trigger.eventType,"turn.ended");
    assert.deepEqual(ability.conditions,[{type:"total-attack-count-this-turn-at-least",count:4}]);
    assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);
    assert.deepEqual(ability.effects,[{op:"draw",count:1}]);
    assert.equal(ability.canDecline,true);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
  }
  assert.equal(Engine.getTotalAttackCountThisTurn({turn:8,attacksByPlayerTurn:{"8:host":2,"8:guest":2,"7:host":5}}),4);
  const aliasCard=Engine.parseCardAbilities(catalog.find(item=>item.id==="cfa-13771"));
  assert.equal(aliasCard.find(item=>item.id==="cfa-13771:1").definition,null,"the separate Flagburg stand ability stays unsupported");
});

test("four attacks queue only the source controller's prompt and both seats resolve their own cost and draw for every family member",()=>{
  for(const side of ["human","bot"])for(const cardId of ids){
    const f=fixture(side,cardId,side==="human"?{human:4,bot:0}:{human:0,bot:4});
    const pending=discover(f);
    assert.equal(pending.queued.length,1,JSON.stringify(pending));
    assert.equal(f.state.pendingAbility.side,side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);
    const wrongActor=decide(f,{actor:side==="human"?seats.guestAuthUid:seats.hostAuthUid,actionId:`wrong-${side}-${cardId}`});
    assert.equal(wrongActor.ok,false);
    assert.equal(f.state.players[side].rear[0].uid,f.source.uid);
    const result=decide(f,{actionId:`right-${side}-${cardId}`});
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(f.state.players[side].rear[0],null);
    assert.ok(f.state.players[side].soul.some(item=>item.uid===f.source.uid));
    assert.equal(f.state.players[side].hand.length,1);
    assert.equal(f.state.players[side].deck.length,1);
    assert.equal(decide(f,{actionId:`right-${side}-${cardId}`}).reason,"duplicate-action");
  }
});

test("the condition uses the total current-turn attack count, not a single player's count",()=>{
  const f=fixture("human",ids[0],{human:2,bot:2});
  assert.equal(Engine.getPlayerAttackCount(f.state,f.playerId),2);
  assert.equal(Engine.getTotalAttackCountThisTurn(f.state),4);
  assert.equal(discover(f).queued.length,1);
});

test("fewer than four total attacks or a turn-end event from the wrong player never queues the ability",()=>{
  const short=fixture("human",ids[0],{human:3,bot:0});
  assert.equal(discover(short).queued.length,0);
  const wrongTurn=fixture("human",ids[0],{human:4,bot:0});
  assert.equal(discover(wrongTurn,endEvent(wrongTurn,{actingPlayerId:"guest-player",turnPlayerId:"guest-player"})).queued.length,0);
  const wrongTiming=fixture("human",ids[0],{human:4,bot:0});
  assert.equal(discover(wrongTiming,endEvent(wrongTiming,{timingWindow:"phase-start"})).queued.length,0);
});

test("declining the [COST] leaves the source and deck unchanged",()=>{
  const f=fixture("human",ids[0],{human:4,bot:0});
  discover(f);
  assert.equal(f.state.pendingAbility.ability.canDecline,true);
  const result=decide(f,{accept:false,actionId:"decline-cost"});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(f.state.players.human.rear[0].uid,f.source.uid);
  assert.equal(f.state.players.human.soul.length,0);
  assert.equal(f.state.players.human.deck.length,2);
  assert.equal(f.state.players.human.hand.length,0);
});

test("source identity and turn count are revalidated before paying, with no partial resolution",()=>{
  for(const mutate of [
    f=>{f.state.players.human.rear[0]=null;f.state.players.human.drop.push(f.source)},
    f=>{f.state.attacksByPlayerTurn[`${f.state.turn}:${f.playerId}`]=0}
  ]){
    const f=fixture("human",ids[0],{human:4,bot:0});
    discover(f);
    mutate(f);
    const result=decide(f,{actionId:`invalidated-${mutate.toString().length}`});
    assert.equal(result.ok,false);
    assert.equal(f.state.players.human.hand.length,0);
    assert.equal(f.state.players.human.deck.length,2);
  }
});

test("duplicate end-turn events cannot queue the same source ability twice",()=>{
  const f=fixture("human",ids[0],{human:4,bot:0});
  const event=endEvent(f);
  assert.equal(discover(f,event).queued.length,1);
  assert.equal(discover(f,event).queued.length,0);
  assert.equal(f.state.pendingAbilities.filter(item=>item.ability.id===f.ability.id).length,0);
});
