"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog(),PATTERN="auto-gc-counter-blast-call-trigger-from-drop-v1";
const IDS=["cfa-13854","cfa-13875","cfa-13894","cfa-13913","cfa-13997"];
const SEATS={hostAuthUid:"host-auth",guestAuthUid:"guest-auth",hostSide:"human",guestSide:"bot"};
const def=id=>{const card=catalog.find(item=>String(item.id)===String(id));assert.ok(card,`catalog card ${id}`);return card};
const make=(definition,uid,playerId,extra={})=>({uid,cardId:String(definition.id),cardName:definition.name,type:definition.type,grade:Number(definition.grade),shield:Number(definition.shield||0),triggerType:definition.trigger||null,ownerPlayerId:playerId,controllerPlayerId:playerId,...extra});
const triggerDefinitions=catalog.filter(card=>/\btrigger\b/i.test(String(card.type||""))&&["Draw","Critical","Heal","Front","Stand"].includes(card.trigger));
const overTrigger=catalog.find(card=>/\btrigger\b/i.test(String(card.type||""))&&/^Over(?: Trigger)?$/i.test(String(card.trigger||"")));
function fixture(cardId="cfa-13854",side="bot",{withTriggers=true,faceUpDamage=true}={}){
  const ownerId=side==="human"?"player-host":"player-guest",opponentSide=side==="human"?"bot":"human",opponentId=opponentSide==="human"?"player-host":"player-guest";
  const source=make(def(cardId),`guard-source-${side}`,ownerId),vanguard=make(def("cfa-3"),`vanguard-${side}`,ownerId,{grade:3}),attackingVanguard=make(def("cfa-3"),`attacker-${opponentSide}`,opponentId,{grade:3});
  const called=withTriggers?make(triggerDefinitions[0],`trigger-${side}`,ownerId):null,over=withTriggers&&overTrigger?make(overTrigger,`over-${side}`,ownerId):null;
  const payment={uid:`cb-${side}`,cardId:"cfa-3",ownerPlayerId:ownerId,controllerPlayerId:ownerId,faceDown:!faceUpDamage};
  const player=(id,vg,guard,damage,drop)=>({playerId:id,vanguard:vg,rear:Array(5).fill(null),hand:[],deck:[],damage,drop,soul:[],bind:[],guardCircle:guard,triggerZone:[],orders:[],crests:[],extra:[],gDeck:[],gZone:[],removed:[]});
  const state={matchId:"gc-drop-trigger-call",stateVersion:7,processedActionIds:[],processedAbilityTriggers:[],turn:4,phase:5,side:opponentSide,players:{human:player("player-host",side==="human"?vanguard:attackingVanguard,side==="human"?[source]:[],side==="human"?[payment]:[],side==="human"?[...(called?[called]:[]),...(over?[over]:[])]:[]),bot:player("player-guest",side==="bot"?vanguard:attackingVanguard,side==="bot"?[source]:[],side==="bot"?[payment]:[],side==="bot"?[...(called?[called]:[]),...(over?[over]:[])]:[])},pendingAttack:{battleId:"battle-gc-trigger-call",attackerSide:opponentSide,attackerPlayerId:opponentId,attackerUid:attackingVanguard.uid,attackerZone:"vanguard",defenderSide:side,defenderPlayerId:ownerId,targetUid:vanguard.uid,targetZone:"vanguard",power:24000,targetPower:13000,critical:1,guardCards:[source],defenderDone:false,driveChecksRemaining:0,driveCountPrompt:false}};
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:ownerId,turnPlayerId:opponentId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:"hand",currentLocation:"guardian",circle:"guardian",battleId:state.pendingAttack.battleId,phase:"battle",timingWindow:"guard-placement"});
  const ability=Engine.parseCardAbilitiesCached(def(cardId)).find(item=>item.id===`${cardId}:0`);
  return{state,event,ability,source,called,over,payment,side,ownerId};
}
function discover(f,event){return Reducer.discoverAutoTriggers(f.state,[event||f.event],Engine)}
function resolve(f,{authUid=f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,accept=true,effectUid=f.called?.uid,actionId=`resolve-${f.side}`}={}){const pending=f.state.pendingAbility;return Reducer.applyAbilityDecision(f.state,{actorAuthUid:authUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept,selection:{instanceUid:f.source.uid,abilityId:pending?.ability?.id||f.ability.id,costSelections:{cb:[f.payment.uid]},effectUid}}},SEATS,Engine)}

test("the five exact GC abilities preserve the own-card placement, Counter Blast, and Trigger-only Drop choice",()=>{
  const abilities=IDS.map(cardId=>{const ability=Engine.parseCardAbilitiesCached(def(cardId)).find(item=>item.id===`${cardId}:0`);assert.ok(ability);assert.equal(ability.definition.source.patternId,PATTERN);assert.deepEqual(ability.requiredLocation,["guardian"]);assert.equal(ability.trigger.eventType,"card.placed");assert.equal(ability.trigger.sourceLocation,"hand");assert.deepEqual(ability.costs,[{type:"counter-blast",count:1}]);assert.deepEqual(ability.definition.effects,[{op:"call-drop-trigger-to-guardian",target:"controller",destination:"guardian",position:"rest",filter:{cardType:"unit",triggerUnit:true,excludeOverTrigger:true}}]);assert.equal(Reducer.supportsServerAbilityEffects(ability),true);return ability});assert.equal(abilities.length,5);
});

test("host and joining defender independently pay and call their selected Trigger from Drop to GC rested",()=>{
  for(const side of ["human","bot"]){const f=fixture("cfa-13854",side);assert.ok(f.called);assert.ok(f.over);assert.equal(discover(f).queued.length,1);assert.equal(f.state.pendingAbility.side,side);const result=resolve(f);assert.equal(result.ok,true,`${side}: ${result.reason}`);const player=f.state.players[side];assert.equal(player.damage[0].faceDown,true);assert.equal(player.drop.some(card=>card.uid===f.called.uid),false);assert.equal(player.drop.some(card=>card.uid===f.over.uid),true);assert.equal(player.guardCircle.at(-1).uid,f.called.uid);assert.equal(player.guardCircle.at(-1).rested,true);assert.equal(player.guardCircle.at(-1).position,"rest");assert.equal(f.state.pendingAttack.guardCards.at(-1).uid,f.called.uid);assert.equal(f.state.pendingAttack.targetPower,13000+Number(def(f.called.cardId).shield));assert.ok(result.events.some(event=>event.type==="card.placed"&&event.cardInstanceId===f.called.uid&&event.previousLocation==="drop"&&event.currentLocation==="guardian"));}
});

test("the exact source, hand-to-GC move, battle, defender, and cost are required before a prompt",()=>{
  const valid=fixture();assert.equal(discover(valid).queued.length,1);
  for(const change of [{previousLocation:"rear-left"},{currentLocation:"rear-left",circle:"rear-left"},{sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other"},{battleId:"stale"},{timingWindow:"attack-declared"}]){const f=fixture(),event=Engine.createGameEvent(f.state,{...f.event,...change,eventId:undefined});assert.equal(discover(f,event).queued.length,0,JSON.stringify(change));}
  const noCost=fixture("cfa-13854","bot",{faceUpDamage:false});const skipped=discover(noCost);assert.equal(skipped.queued.length,0);assert.ok(skipped.skipped.some(item=>item.reason==="unpayable-cost"));
  const proxy=fixture("cfa-13854","bot");assert.equal(discover(proxy).queued.length,1);assert.equal(resolve(proxy,{authUid:SEATS.hostAuthUid}).reason,"source-not-controlled");
});

test("Over Triggers, non-Triggers, opponent cards, forged selections, and stale targets cannot be called",()=>{
  const f=fixture();assert.equal(discover(f).queued.length,1);const wrong=resolve(f,{effectUid:f.over.uid});assert.equal(wrong.ok,false);assert.equal(wrong.reason,"invalid-guardian-trigger-choice");assert.equal(f.state.players.bot.damage[0].faceDown,false);assert.ok(f.state.players.bot.drop.some(card=>card.uid===f.called.uid));
  const foreign=fixture();const opponentTrigger=make(triggerDefinitions[1],"opponent-owned-trigger","player-host");foreign.state.players[foreign.side].drop.push(opponentTrigger);assert.equal(discover(foreign).queued.length,1);assert.equal(resolve(foreign,{effectUid:opponentTrigger.uid}).reason,"invalid-guardian-trigger-choice");assert.equal(foreign.state.players.bot.damage[0].faceDown,false);
  const noTargets=fixture("cfa-13854","bot",{withTriggers:false});const skipped=discover(noTargets);assert.equal(skipped.queued.length,0);assert.ok(skipped.skipped.some(item=>item.reason==="no-legal-guardian-trigger"));assert.equal(noTargets.state.players.bot.damage[0].faceDown,false);
  const wrongSource=fixture();assert.equal(discover(wrongSource).queued.length,1);assert.equal(resolve(wrongSource,{effectUid:"unowned-trigger"}).ok,false);assert.equal(wrongSource.state.players.bot.damage[0].faceDown,false);
});

test("a Drop Trigger must also be controlled by the defending player in client validation and authoritative resolution",()=>{
  const client=fixture();assert.equal(discover(client).queued.length,1);client.called.controllerPlayerId=client.side==="human"?"player-guest":"player-host";
  const player=client.state.players[client.side],context={selectedCard:client.called,player,side:client.side,match:client.state,cardDefinitionForInstance:card=>def(card.cardId),shieldValueForInstance:card=>Number(def(card.cardId).shield)};
  const beforeClient=JSON.stringify(client.state),result=Engine.resolveEffectProgram(client.ability.definition.effects,Engine.EFFECT_HANDLERS,context);
  assert.equal(result.ok,false);assert.equal(result.reason,"invalid-effect");assert.equal(JSON.stringify(client.state),beforeClient,"client effect validation mutated state");

  const authority=fixture();assert.equal(discover(authority).queued.length,1);authority.called.controllerPlayerId=authority.side==="human"?"player-guest":"player-host";
  const beforeAuthority=JSON.stringify(authority.state),rejected=resolve(authority,{effectUid:authority.called.uid});
  assert.equal(rejected.ok,false);assert.equal(rejected.reason,"invalid-guardian-trigger-choice");assert.equal(JSON.stringify(authority.state),beforeAuthority,"authoritative rejection mutated state");
});

test("a trigger target removed after the prompt rejects resolution without paying Counter Blast",()=>{
  const f=fixture();assert.equal(discover(f).queued.length,1);f.state.players[f.side].drop=f.state.players[f.side].drop.filter(card=>card.uid!==f.called.uid);const result=resolve(f);assert.equal(result.ok,false);assert.equal(result.reason,"invalid-guardian-trigger-choice");assert.equal(f.state.players[f.side].damage[0].faceDown,false);
});

test("a source placed from the field or on a different circle cannot borrow the trigger",()=>{
  const f=fixture(),notHand=Engine.createGameEvent(f.state,{...f.event,previousLocation:"drop",eventId:undefined});assert.equal(discover(f,notHand).queued.length,0);
  const wrongCircle=fixture(),notGuardian=Engine.createGameEvent(wrongCircle.state,{...wrongCircle.event,currentLocation:"rear-guard",circle:"rear-guard",eventId:undefined});assert.equal(discover(wrongCircle,notGuardian).queued.length,0);
});
