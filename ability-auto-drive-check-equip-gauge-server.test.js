"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const catalog=loadCatalog();
const cards=new Map(catalog.map(card=>[String(card.id),card]));
const specs=[
  {cardId:"cfa-8980",abilityId:"cfa-8980:1"},
  {cardId:"cfa-8981",abilityId:"cfa-8981:1"},
  {cardId:"cfa-8982",abilityId:"cfa-8982:1"},
  {cardId:"cfa-10017",abilityId:"cfa-10017:1",textPending:true},
  {cardId:"cfa-10018",abilityId:"cfa-10018:2"}
];
const triggerDefinition=catalog.find(card=>String(card.trigger||"").toLowerCase()==="front");
assert.ok(triggerDefinition,"catalog must include a Front trigger card");
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};

function instance(cardId,uid,playerId,extra={}){
  const definition=cards.get(String(cardId));
  return{uid,cardId,cardName:definition?.name||String(cardId),type:definition?.type||"Unit",grade:Number(definition?.grade||0),
    ...(definition?.trigger?{triggerType:String(definition.trigger).toLowerCase()}:{}),ownerPlayerId:playerId,controllerPlayerId:playerId,...extra};
}

function fixture(spec,side="human",options={}){
  const playerId=side==="human"?"host-player":"guest-player",opponentId=side==="human"?"guest-player":"host-player",otherSide=side==="human"?"bot":"human";
  const source=instance(spec.cardId,`source-${side}`,playerId,{zone:"rear-guard",circle:"rear-left"});
  const attacker=instance("cfa-9421",`attacker-${side}`,playerId,{zone:"vanguard",circle:"vanguard"});
  const opponentVanguard=instance("cfa-3",`opponent-v-${side}`,opponentId,{zone:"vanguard",circle:"vanguard"});
  const checked=instance(triggerDefinition.id,`checked-${side}`,playerId,{zone:"trigger",triggerType:options.triggerType||"front"});
  const top=instance("cfa-3",`deck-top-${side}`,playerId,{zone:"deck"});
  const own={playerId,vanguard:attacker,rear:[source,null,null,null,null],hand:[],soul:[],drop:[],deck:options.emptyDeck?[]:[top],damage:[],bind:[],orders:[],
    guardCircle:[],triggerZone:[checked],gDeck:[],gZone:[],equipGauges:[]};
  const enemy={playerId:opponentId,vanguard:opponentVanguard,rear:[],hand:[],soul:[],drop:[],deck:[],damage:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],equipGauges:[]};
  const battleId=`gauge-${spec.cardId}-${side}`;
  const state={matchId:`gauge-${spec.cardId}`,stateVersion:1,eventSequence:0,processedEventIds:[],processedActionIds:[],processedAbilityTriggers:[],pendingAbilities:[],
    turn:4,side,phase:5,players:{[side]:own,[otherSide]:enemy},pendingCheckCard:{side,uid:checked.uid,destination:"hand",checkKind:"drive",battleId},
    pendingAttack:{battleId,attackerSide:side,attackerPlayerId:playerId,attackerUid:attacker.uid,attackerZone:"vanguard",defenderSide:otherSide,targetUid:opponentVanguard.uid,
      targetZone:"vanguard",driveChecksRemaining:0,maxDriveChecks:1,driveChecksPerformed:1,driveChecksComplete:true,awaitingDrive:false,power:13000,targetPower:10000,guardCards:[]}};
  const event=Engine.createGameEvent(state,{type:"drive.checked",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:attacker.uid,
    sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:checked.uid,subjectCardInstanceId:checked.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,
    checkedCardInstanceId:checked.uid,checkedCardOwnerPlayerId:playerId,checkedCardControllerPlayerId:playerId,checkedCardTriggerType:checked.triggerType,
    previousLocation:"deck",currentLocation:"trigger",checkKind:"drive",checkSourceLocation:"vanguard",checkIndex:1,battleId,phase:"battle",timingWindow:"drive-check"});
  const ability=Engine.parseCardAbilities(cards.get(spec.cardId)).find(item=>item.id===spec.abilityId);
  return{ability,attacker,checked,event,opponentVanguard,own,playerId,side,source,state,top};
}

function resolve(f,actionId=`resolve-${f.ability.id}-${f.side}`){
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId,expectedStateVersion:f.state.stateVersion,
    payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,costSelections:{cb:[],sb:[],discard:[],reveal:[]}}}},seats,Engine);
}

test("the five catalog cards parse their own once-per-turn trigger as the reusable Equip Gauge AUTO",()=>{
  for(const spec of specs){
    const card=cards.get(spec.cardId),ability=Engine.parseCardAbilities(card).find(item=>item.id===spec.abilityId);
    assert.ok(ability,`${spec.abilityId} exists in its real card text`);
    assert.equal(ability.definition?.source?.patternId,"auto-rc-drive-trigger-equip-gauge-v1");
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true);
    assert.equal(ability.kind,"AUTO");assert.equal(ability.requiredLocation[0],"rear-guard");
    assert.equal(ability.trigger.eventType,"drive.checked");assert.equal(ability.trigger.checkedCardHasTriggerUnit,true);
    assert.equal(ability.once,true);assert.equal(ability.canDecline,false);
    assert.equal(ability.definition.source.officialTextVerified,spec.textPending?false:true);
    assert.match(ability.printedText,/put the top card of your deck face down as an equip gauge for this unit/i);
  }
});

test("host and joining player independently resolve only their own exact trigger and attach the next deck card face down",()=>{
  for(const side of ["human","bot"])for(const spec of specs.filter(item=>!item.textPending)){
    const f=fixture(spec,side);
    const discovery=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);
    assert.equal(discovery.queued.length,1,`${side} ${spec.abilityId}: ${JSON.stringify(discovery.skipped)}`);
    assert.equal(f.state.pendingAbility.side,side);
    assert.equal(f.state.pendingAbility.instance.uid,f.source.uid);
    const result=resolve(f);
    assert.equal(result.ok,true,result.reason);
    assert.equal(f.own.deck.length,0);
    assert.equal(f.own.equipGauges.length,1);
    assert.equal(f.own.equipGauges[0].uid,f.top.uid);
    assert.equal(f.own.equipGauges[0].zone,"equip-gauge");
    assert.equal(f.own.equipGauges[0].faceDown,true);
    assert.equal(f.own.equipGauges[0].faceUp,false);
    assert.equal(f.own.equipGauges[0].attachedToInstanceId,f.source.uid);
    assert.equal(f.own.triggerZone.length,0);
    assert.equal(f.own.hand.some(card=>card.uid===f.checked.uid),true);
    assert.equal(f.state.players[side=== "human"?"bot":"human"].equipGauges.length,0);
    assert.ok(result.events.some(event=>event.type==="card.moved"&&event.cardInstanceId===f.top.uid&&event.previousLocation==="deck"&&event.currentLocation==="equip-gauge"));
    const usageKey=Engine.abilityUsageKey(f.state.turn,f.playerId,f.source.uid,f.ability.id,f.ability.usageRestriction,cards.get(spec.cardId).name,f.ability.printedText);
    assert.ok(f.own.usedAbilities.includes(usageKey));
  }
});

test("unrelated checks, a normal unit, mismatched trigger metadata, an opponent check, or a source off RC cannot activate the ability",()=>{
  const spec=specs[0];
  const wrongCheck=fixture(spec);wrongCheck.event=Engine.createGameEvent(wrongCheck.state,{...wrongCheck.event,eventId:"damage-check",type:"damage.checked",checkKind:"damage",timingWindow:"damage-check"});
  assert.equal(Reducer.discoverAutoTriggers(wrongCheck.state,[wrongCheck.event],Engine).queued.length,0);
  const normal=fixture(spec);const normalCard=instance("normal-unit","normal-check",normal.playerId,{zone:"trigger"});normal.own.triggerZone=[normalCard];normal.state.pendingCheckCard.uid=normalCard.uid;
  normal.event=Engine.createGameEvent(normal.state,{...normal.event,eventId:"normal-unit-check",checkedCardInstanceId:normalCard.uid,cardInstanceId:normalCard.uid,subjectCardInstanceId:normalCard.uid,checkedCardOwnerPlayerId:normal.playerId,checkedCardControllerPlayerId:normal.playerId,checkedCardTriggerType:"",previousLocation:"deck",currentLocation:"trigger"});
  assert.equal(Reducer.discoverAutoTriggers(normal.state,[normal.event],Engine).queued.length,0);
  const mismatch=fixture(spec);mismatch.event=Engine.createGameEvent(mismatch.state,{...mismatch.event,eventId:"mismatched-trigger",checkedCardTriggerType:"critical"});
  assert.equal(Reducer.discoverAutoTriggers(mismatch.state,[mismatch.event],Engine).queued.length,0);
  const opponent=fixture(spec);opponent.event=Engine.createGameEvent(opponent.state,{...opponent.event,eventId:"opponent-drive",actingPlayerId:"guest-player",turnPlayerId:"guest-player",sourceControllerPlayerId:"guest-player"});
  assert.equal(Reducer.discoverAutoTriggers(opponent.state,[opponent.event],Engine).queued.length,0);
  const moved=fixture(spec);moved.own.rear[0]=null;moved.own.vanguard=moved.source;moved.event=Engine.createGameEvent(moved.state,{...moved.event,eventId:"source-not-rc"});
  assert.equal(Reducer.discoverAutoTriggers(moved.state,[moved.event],Engine).queued.length,0);
});

test("the once-per-turn gate blocks a second qualifying drive check and empty deck resolution is a no-op",()=>{
  const f=fixture(specs[0]);
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  assert.equal(resolve(f).ok,true);
  const nextChecked=instance(triggerDefinition.id,"checked-second",f.playerId,{zone:"trigger",triggerType:"heal"});
  f.own.triggerZone=[nextChecked];f.state.pendingCheckCard={side:f.side,uid:nextChecked.uid,destination:"hand",checkKind:"drive",battleId:f.state.pendingAttack.battleId};
  const second=Engine.createGameEvent(f.state,{type:"drive.checked",actingPlayerId:f.playerId,turnPlayerId:f.playerId,sourceCardInstanceId:f.attacker.uid,
    sourceOwnerPlayerId:f.playerId,sourceControllerPlayerId:f.playerId,cardInstanceId:nextChecked.uid,subjectCardInstanceId:nextChecked.uid,subjectOwnerPlayerId:f.playerId,subjectControllerPlayerId:f.playerId,
    checkedCardInstanceId:nextChecked.uid,checkedCardOwnerPlayerId:f.playerId,checkedCardControllerPlayerId:f.playerId,checkedCardTriggerType:"heal",previousLocation:"deck",currentLocation:"trigger",
    checkKind:"drive",checkSourceLocation:"vanguard",checkIndex:2,battleId:f.state.pendingAttack.battleId,phase:"battle",timingWindow:"drive-check"});
  assert.equal(Reducer.discoverAutoTriggers(f.state,[second],Engine).queued.length,0);
  const empty=fixture(specs[0],"human",{emptyDeck:true});
  assert.equal(Reducer.discoverAutoTriggers(empty.state,[empty.event],Engine).queued.length,1);
  const resolved=resolve(empty);
  assert.equal(resolved.ok,true,resolved.reason);
  assert.equal(empty.own.equipGauges.length,0);
  assert.equal(empty.own.hand.some(card=>card.uid===empty.checked.uid),true);
});

function normalCall(f,rearIndex,actionId){
  const replacement=instance("cfa-3",`replacement-${actionId}`,f.playerId,{zone:"hand",unitCard:true});
  f.own.hand.push(replacement);f.state.phase=4;f.state.pendingAttack=null;f.state.pendingCheckCard=null;
  return Reducer.applyGameAction(f.state,{actorAuthUid:f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId,
    expectedStateVersion:f.state.stateVersion,payload:{action:"call",cardInstanceId:replacement.uid,rearIndex}},seats,Engine);
}

test("an equip gauge stays attached during unrelated field actions and moves to its owner's Drop when its host leaves the circle",()=>{
  const f=fixture(specs[0]);
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  assert.equal(resolve(f).ok,true);
  const gauge=f.own.equipGauges[0];
  const unrelatedCall=normalCall(f,1,"unrelated-call");
  assert.equal(unrelatedCall.ok,true,unrelatedCall.reason);
  assert.equal(f.own.equipGauges[0],gauge,"moving another card must not detach the gauge");
  assert.equal(gauge.attachedToInstanceId,f.source.uid);
  const replacementCall=normalCall(f,0,"replace-gauge-host");
  assert.equal(replacementCall.ok,true,replacementCall.reason);
  assert.equal(f.own.equipGauges.length,0);
  assert.equal(f.own.drop.some(card=>card.uid===gauge.uid),true);
  assert.equal(gauge.zone,"drop");assert.equal(gauge.faceUp,true);assert.equal(gauge.attachedToInstanceId,undefined);
});

test("a locked equip-gauge host sends its gauges to the owner's Drop",()=>{
  const f=fixture(specs[0]);
  assert.equal(Reducer.discoverAutoTriggers(f.state,[f.event],Engine).queued.length,1);
  assert.equal(resolve(f).ok,true);
  const gauge=f.own.equipGauges[0];f.source.locked=true;
  const action=normalCall(f,1,"action-while-gauge-host-locked");
  assert.equal(action.ok,true,action.reason);
  assert.equal(f.own.equipGauges.length,0);
  assert.equal(f.own.drop.some(card=>card.uid===gauge.uid),true);
});
