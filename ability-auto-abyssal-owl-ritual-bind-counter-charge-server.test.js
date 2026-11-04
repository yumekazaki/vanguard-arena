"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog();
const owl=catalog.find(card=>card.id==="cfa-12202");
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const printed="AUTO [Drop] Ritual 3 (Active if there are three or more grade 1 cards in your drop): At the end of your turn, if you have a vanguard with \"Luard\" in its card name, COST [bind two cards with the same card name as this card from drop], and Counter Charge 1.";

function card(cardId,uid,playerId,extra={}){
  const definition=catalog.find(item=>item.id===cardId);
  return{uid,cardId,cardName:definition?.name||cardId,grade:Number(definition?.grade||0),unitCard:/\bunit\b/i.test(definition?.type||""),ownerPlayerId:playerId,controllerPlayerId:playerId,...extra};
}
function fixture(side="human",options={}){
  const playerId=side==="human"?"host-player":"guest-player",opponentSide=side==="human"?"bot":"human",opponentId=opponentSide==="human"?"host-player":"guest-player";
  const source=card("cfa-12202",`owl-${side}`,playerId,{zone:"drop"});
  const sameName=card("cfa-4238",`owl-copy-${side}`,playerId,{zone:"drop"});
  const filler=card("cfa-2",`grade-one-${side}`,playerId,{zone:"drop"});
  const secondFiller=card("cfa-2",`second-grade-one-${side}`,playerId,{zone:"drop"});
  const makePlayer=id=>({playerId:id,vanguard:card(options.vanguardCardId||"cfa-12187",`vg-${id}`,id,{zone:"vanguard",circle:"vanguard"}),rear:Array(5).fill(null),hand:[],deck:[],soul:[],damage:[card("cfa-1",`damage-down-${id}`,id,{faceDown:true}),card("cfa-1",`damage-up-${id}`,id,{faceDown:false})],drop:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[]});
  const players={human:makePlayer("host-player"),bot:makePlayer("guest-player")};
  players[side].drop=[source,...(options.withSameName===false?[]:[sameName]),...(options.gradeOneCount===false?[]:[filler,secondFiller])];
  if(options.sourceLocation&&options.sourceLocation!=="drop"){
    players[side].drop=players[side].drop.filter(item=>item.uid!==source.uid);
    if(options.sourceLocation==="hand")players[side].hand.push(source);
    else if(options.sourceLocation==="rear-guard")players[side].rear[0]=source;
  }
  const state={matchId:`abyssal-owl-${side}`,stateVersion:1,turn:4,phase:6,side,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],processedActionIds:[],pendingAbilities:[],pendingAbility:null,pendingTurnEnd:{side,playerId,turn:4,cleanupQueued:false},players};
  const ability=Engine.parseCardAbilities(owl).find(item=>item.id==="cfa-12202:1");
  return{state,ability,source,sameName,filler,secondFiller,side,playerId,opponentSide,opponentId};
}
function endEvent(f,overrides={}){
  const event=Engine.createGameEvent(f.state,{type:"turn.ended",actingPlayerId:f.playerId,turnPlayerId:f.playerId,phase:"end",timingWindow:"turn-end",...overrides});
  f.state.pendingTurnEnd.turnEndEvent=event;
  f.state.pendingTurnEnd.turnEndEventId=event.eventId;
  return event;
}
function discover(f,event=endEvent(f)){
  return Reducer.discoverAutoTriggers(f.state,[event],Engine);
}
function decide(f,{accept=true,actor=f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId=`resolve-${f.side}`,bindUids=[f.source.uid,f.sameName.uid]}={}){
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor,actionId,expectedStateVersion:f.state.stateVersion,payload:{accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{bindSameName:bindUids},damageUids:accept?[`damage-down-${f.playerId}`]:[]}}},seats,Engine);
}

test("Abyssal Owl compiles only its exact Drop Ritual 3 end-turn ability",()=>{
  assert.equal(owl.name,"Abyssal Owl");
  assert.equal(fixture().ability.printedText,printed);
  assert.equal(fixture().ability.definition.source.patternId,"auto-drop-ritual-three-end-turn-bind-same-name-counter-charge-v1");
  assert.deepEqual(fixture().ability.requiredLocation,["drop"]);
  assert.deepEqual(fixture().ability.conditions,[{type:"controller-drop-grade-count-at-least",grade:1,count:3},{type:"controller-vanguard-name-contains",value:"Luard"}]);
  assert.deepEqual(fixture().ability.costs,[{type:"bind-same-name-from-drop",count:2}]);
  assert.deepEqual(fixture().ability.effects,[{op:"counter-charge",count:1}]);
  assert.equal(fixture().ability.canDecline,false);
  assert.equal(fixture().ability.definition.optional,false);
  assert.equal(Reducer.supportsServerAbilityEffects(fixture().ability),true);
});

test("either online seat receives and resolves only its own eligible Ritual prompt",()=>{
  for(const side of ["human","bot"]){
    const f=fixture(side),result=discover(f);
    assert.equal(result.queued.length,1,JSON.stringify(result));
    assert.equal(f.state.pendingAbility.side,side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.playerId);
    const wrong=decide(f,{actor:side==="human"?seats.guestAuthUid:seats.hostAuthUid,actionId:`wrong-${side}`});
    assert.equal(wrong.ok,false);
    assert.equal(f.state.players[side].bind.length,0);
    const resolved=decide(f,{actionId:`right-${side}`});
    assert.equal(resolved.ok,true,JSON.stringify(resolved));
    assert.deepEqual(f.state.players[side].bind.map(item=>item.uid).sort(),[f.source.uid,f.sameName.uid].sort());
    assert.equal(f.state.players[side].drop.some(item=>item.uid===f.source.uid||item.uid===f.sameName.uid),false);
    assert.equal(f.state.players[side].damage.find(item=>item.uid===`damage-down-${f.playerId}`).faceDown,false);
    assert.equal(f.state.players[f.opponentSide].damage.find(item=>item.uid===`damage-down-${f.opponentId}`).faceDown,true);
    assert.equal(decide(f,{actionId:`right-${side}`}).reason,"duplicate-action");
  }
});

test("Ritual count, Luard Vanguard, source zone, and controller end-turn identity are all required",()=>{
  const tooFew=fixture("human",{gradeOneCount:false});
  assert.equal(discover(tooFew).queued.length,0);
  const wrongVanguard=fixture("human",{vanguardCardId:"cfa-14"});
  assert.equal(discover(wrongVanguard).queued.length,0);
  const wrongZone=fixture("human",{sourceLocation:"hand"});
  assert.equal(discover(wrongZone).queued.length,0);
  const wrongTurn=fixture("human");
  assert.equal(discover(wrongTurn,endEvent(wrongTurn,{actingPlayerId:"guest-player",turnPlayerId:"guest-player"})).queued.length,0);
});

test("an unavailable same-name bind cost prevents a prompt",()=>{
  const f=fixture("human",{withSameName:false});
  const result=discover(f);
  assert.equal(result.queued.length,0);
  assert.ok(result.skipped.some(item=>item.abilityId===f.ability.id&&item.reason==="unpayable-cost"),JSON.stringify(result));
  assert.equal(f.state.players.human.bind.length,0);
});

test("invalid bind selections and declining this mandatory AUTO reject without partial changes",()=>{
  const f=fixture();
  discover(f);
  const invalid=decide(f,{actionId:"wrong-name-cost",bindUids:[f.source.uid,f.filler.uid]});
  assert.equal(invalid.ok,false);
  assert.equal(f.state.players.human.bind.length,0);
  assert.equal(f.state.players.human.drop.length,4);
  assert.equal(f.state.players.human.damage[0].faceDown,true);
  const declined=decide(f,{accept:false,actionId:"decline-mandatory-cost"});
  assert.equal(declined.ok,false);
  assert.equal(f.state.players.human.bind.length,0);
  assert.equal(f.state.players.human.drop.length,4);
  assert.equal(f.state.players.human.damage[0].faceDown,true);
  const resolved=decide(f,{actionId:"valid-cost-after-rejections"});
  assert.equal(resolved.ok,true,JSON.stringify(resolved));
  assert.equal(f.state.players.human.bind.length,2);
  assert.equal(f.state.players.human.damage[0].faceDown,false);
});
