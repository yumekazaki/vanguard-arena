"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog();
const entries=[["cfa-7110",0],["cfa-7812",1],["cfa-7813",1],["cfa-7814",1],["cfa-7815",1],["cfa-7816",1],["cfa-7817",1]];
const text="AUTO [VC/RC] 1/Turn: When your drive check reveals a front trigger, you may have this unit get critical +1 until end of turn.";
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
let sequence=0;

function makeFixture(cardId="cfa-7110",side="human",trigger="front"){
  const card=catalog.find(item=>item.id===cardId), ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${cardId}:${cardId==="cfa-7110"?0:1}`);
  assert.ok(ability);
  const pid=side==="human"?"host-player":"guest-player", oid=side==="human"?"guest-player":"host-player";
  const source={uid:`source-${cardId}-${side}`,cardId,cardName:card.name,ownerPlayerId:pid,controllerPlayerId:pid,unitCard:true,grade:1,critical:1};
  const attacker=cardId==="cfa-7110"?source:{uid:`attacker-${side}`,cardId:"drive-vanguard",ownerPlayerId:pid,controllerPlayerId:pid,unitCard:true,grade:3};
  const target={uid:`target-${side}`,cardId:"target-vanguard",ownerPlayerId:oid,controllerPlayerId:oid,unitCard:true,grade:3};
  const checked={uid:`checked-${side}-${++sequence}`,cardId:"checked-trigger",ownerPlayerId:pid,controllerPlayerId:pid,type:"Trigger Unit",triggerType:trigger};
  const players={
    human:{playerId:"host-player",vanguard:side==="human"?attacker:target,rear:Array(5).fill(null),triggerZone:side==="human"?[checked]:[],hand:[],soul:[],drop:[],deck:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],usedAbilities:[]},
    bot:{playerId:"guest-player",vanguard:side==="bot"?attacker:target,rear:Array(5).fill(null),triggerZone:side==="bot"?[checked]:[],hand:[],soul:[],drop:[],deck:[],damage:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[],usedAbilities:[]}
  };
  if(cardId==="cfa-7110")players[side].vanguard=source;else players[side].rear[0]=source;
  const battleId=`battle-${side}-${sequence}`;
  const state={matchId:"front-critical-test",stateVersion:1,turn:3,side,phase:5,eventSequence:0,processedEventIds:[],processedAbilityTriggers:[],pendingAbilities:[],players,
    pendingAttack:{battleId,attackerSide:side,attackerUid:attacker.uid,attackerZone:"vanguard",attackerPlayerId:pid,defenderSide:side==="human"?"bot":"human",targetUid:target.uid,targetZone:"vanguard",awaitingDrive:true},
    pendingCheckCard:{side,uid:checked.uid,destination:"hand",checkKind:"drive",battleId}};
  const event=Engine.createGameEvent(state,{type:"drive.checked",actingPlayerId:pid,turnPlayerId:pid,sourceCardInstanceId:attacker.uid,sourceControllerPlayerId:pid,cardInstanceId:checked.uid,subjectCardInstanceId:checked.uid,subjectOwnerPlayerId:pid,subjectControllerPlayerId:pid,checkedCardInstanceId:checked.uid,checkedCardTriggerType:trigger,revealedTrigger:trigger,checkedCardControllerPlayerId:pid,checkedCardOwnerPlayerId:pid,previousLocation:"deck",currentLocation:"trigger",checkKind:"drive",battleId,phase:"battle",timingWindow:"drive-check"});
  return{state,event,ability,source,checked,side,pid};
}
function auth(side){return side==="human"?"auth-host":"auth-guest";}
function resolve(f,accept=true,actionId=`resolve-${f.event.eventId}`){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth(f.side),actionId,expectedStateVersion:f.state.stateVersion,payload:{accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[],sb:[],discard:[],reveal:[]}}}},seats,Engine);}

test("all seven catalog abilities have the exact trusted optional once-per-turn definition",()=>{
  for(const [id,index] of entries){const card=catalog.find(item=>item.id===id),ability=Engine.parseCardAbilitiesCached(card).find(item=>item.id===`${id}:${index}`);assert.equal(ability.printedText,text,id);assert.equal(ability.definition.source.patternId,"auto-drive-check-front-trigger-critical-turn-v1",id);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,id);}
});

test("both seats resolve only their own authentic front drive-check AUTO",()=>{
  for(const side of ["human","bot"]){const f=makeFixture("cfa-7110",side),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,JSON.stringify(found));assert.equal(f.state.pendingAbility.side,side);const result=resolve(f);assert.equal(result.ok,true,result.reason);assert.equal(f.source.turnCriticalAbilityBoost,1);assert.equal(f.source.turnCriticalExpiry,f.state.players[side].playerId);}
});

test("authoritative driveCheck action creates and queues the real Front trigger event for either seat",()=>{
  for(const side of ["human","bot"]){const f=makeFixture("cfa-7812",side);f.state.players[side].triggerZone=[];f.state.players[side].deck=[f.checked];f.state.pendingCheckCard=null;Object.assign(f.state.pendingAttack,{driveChecksRemaining:1,maxDriveChecks:1,awaitingDrive:true});
    const result=Reducer.applyGameAction(f.state,{actorAuthUid:auth(side),actionId:`actual-drive-${side}`,expectedStateVersion:f.state.stateVersion,payload:{type:"game-action",action:"driveCheck"}},seats,Engine);
    assert.equal(result.ok,true,result.reason);const generated=result.events.find(event=>event.type==="drive.checked");assert.ok(generated);assert.equal(generated.battleId,f.state.pendingAttack.battleId);assert.equal(generated.checkedCardTriggerType,"front");assert.equal(f.state.pendingAbility?.instance?.uid,f.source.uid);assert.equal(f.state.pendingAbility?.side,side);
  }
});

test("rear-guard copy may activate its own source ability, while non-front and damage checks do not queue",()=>{
  const rc=makeFixture("cfa-7812","bot"),found=Reducer.discoverAutoTriggers(rc.state,[rc.event],Engine);assert.equal(found.queued.length,1,JSON.stringify(found));assert.equal(rc.state.pendingAbility.instance.uid,rc.source.uid);
  for(const [trigger,kind] of [["critical","drive"],["front","damage"]]){const f=makeFixture("cfa-7110","human",trigger);f.event=Engine.createGameEvent(f.state,{...f.event,eventId:undefined,checkKind:kind,checkedCardTriggerType:trigger,revealedTrigger:trigger});f.state.pendingCheckCard.checkKind=kind;assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);}
});

test("wrong actor, wrong Vanguard source, and source leaving its permitted circle are rejected",()=>{
  for(const mutate of [f=>{f.event=Engine.createGameEvent(f.state,{...f.event,eventId:undefined,actingPlayerId:"guest-player"});},f=>{f.event=Engine.createGameEvent(f.state,{...f.event,eventId:undefined,sourceCardInstanceId:"other-vanguard"});},f=>{f.state.players[f.side].vanguard=null;f.state.players[f.side].rear[0]=null;f.state.players[f.side].hand.push(f.source);}]){const f=makeFixture();mutate(f);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);}
});

test("duplicate event and once-per-turn restriction prevent repeat, then reset on a new turn",()=>{
  const f=makeFixture("cfa-7812","human"),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,JSON.stringify(found));assert.equal(resolve(f).ok,true);assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,0);
  const next=makeFixture("cfa-7812","human");next.state.turn=f.state.turn+1;next.state.players.human.usedAbilities=[...f.state.players.human.usedAbilities];assert.equal(Reducer.discoverAutoTriggers(next.state,[next.event],Engine).queued.length,1);
});

test("forged definition variants are not trusted",()=>{
  const f=makeFixture();let bad=structuredClone(f.ability);bad.definition.effects[0].amount=2;assert.equal(Reducer.supportsServerAbilityEffects(bad),false);
  bad=structuredClone(f.ability);bad.definition.printedText=bad.definition.printedText.replace("front trigger","critical trigger");assert.equal(Reducer.supportsServerAbilityEffects(bad),false);
  bad=structuredClone(f.ability);bad.trigger.revealedTrigger="critical";assert.equal(Reducer.supportsServerAbilityEffects(bad),false);
});
