"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const CATALOG=loadCatalog();
const FAMILY={
  "cfa-4791":"Witch",
  "cfa-4903":"Amon",
  "cfa-4910":"Seal Dragon"
};
const PATTERN="auto-gc-named-counter-blast-call-top-five-v1";
const SEATS={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const card=id=>{const found=CATALOG.find(item=>String(item.id)===String(id));assert.ok(found,`catalog card ${id}`);return found};
const unit=(predicate=()=>true,exclude=[])=>{const found=CATALOG.find(item=>/\b(?:unit|trigger)\b/i.test(String(item.type||""))&&Number.isFinite(Number(item.shield))&&predicate(item)&&!exclude.includes(String(item.id)));assert.ok(found,"eligible unit card exists");return found};
const instance=(definition,uid,playerId,extra={})=>({uid,cardId:String(definition.id),cardName:definition.name,type:definition.type||"Unit",grade:Number(definition.grade),clan:definition.clan,clans:definition.clans,shield:Number(definition.shield||0),unitCard:true,ownerPlayerId:playerId,controllerPlayerId:playerId,...extra});
function fixture(cardId="cfa-4791",side="bot",{matchingCost=true,faceDownCost=false}={}){
  const fragment=FAMILY[cardId],ownId=side==="human"?"player-host":"player-guest",opponentSide=side==="human"?"bot":"human",opponentId=opponentSide==="human"?"player-host":"player-guest";
  const source=instance(card(cardId),`sentinel-${side}-${cardId}`,ownId,{zone:"guardian",circle:"guardian",position:"rest",rested:true});
  const vanguard=instance(card("cfa-3"),`defender-vg-${side}`,ownId,{grade:3});
  const attacker=instance(card("cfa-3"),`attacker-vg-${opponentSide}`,opponentId,{grade:3});
  const costDefinition=unit(item=>matchingCost?String(item.name||"").toLowerCase().includes(fragment.toLowerCase()):!String(item.name||"").toLowerCase().includes(fragment.toLowerCase()),[cardId]);
  const payment=instance(costDefinition,`counter-blast-${side}-${cardId}`,ownId,{faceDown:faceDownCost});
  const top=Array.from({length:5},(_,index)=>instance(unit(item=>true,[cardId]),`deck-top-${side}-${cardId}-${index+1}`,ownId));
  const makePlayer=(playerId,vg,guard,deck,damage)=>({playerId,vanguard:vg,rear:[null,null,null,null,null],hand:[],deck,damage,soul:[],drop:[],bind:[],guardCircle:guard,triggerZone:[],orders:[],crests:[],extra:[],gDeck:[],gZone:[],removed:[]});
  const own=makePlayer(ownId,vanguard,[source],top,[payment]),opponent=makePlayer(opponentId,attacker,[],[],[]);
  const state={matchId:`guardian-named-counter-blast-${cardId}-${side}`,stateVersion:4,processedActionIds:[],processedAbilityTriggers:[],processedEventIds:[],turn:6,phase:5,side:opponentSide,players:side==="human"?{human:own,bot:opponent}:{human:opponent,bot:own},pendingAttack:{battleId:`battle-${cardId}-${side}`,attackerSide:opponentSide,attackerPlayerId:opponentId,attackerUid:attacker.uid,attackerZone:"vanguard",defenderSide:side,defenderPlayerId:ownId,targetUid:vanguard.uid,targetZone:"vanguard",power:24000,targetPower:13000,critical:1,guardCards:[source],defenderDone:false,driveChecksRemaining:0,driveCountPrompt:false}};
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:ownId,turnPlayerId:opponentId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownId,sourceControllerPlayerId:ownId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownId,subjectControllerPlayerId:ownId,previousLocation:"hand",currentLocation:"guardian",circle:"guardian",battleId:state.pendingAttack.battleId,phase:"battle",timingWindow:"guard-placement"});
  const ability=Engine.parseCardAbilitiesCached(card(cardId)).find(item=>item.id===`${cardId}:1`);
  assert.ok(ability,`ability ${cardId}:1 parses`);
  return{state,event,ability,source,top,payment,side,ownId,opponentId,cardId,fragment};
}
function discover(f,event=f.event){return Reducer.discoverAutoTriggers(f.state,[event],Engine)}
function decide(f,{accept=true,actor=f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid,payment=f.payment,actionId=`resolve-${f.side}-${f.cardId}`}={}){
  const pending=f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept,selection:{instanceUid:f.source.uid,abilityId:pending?.ability?.id||f.ability.id,costSelections:{cb:accept&&payment?[payment.uid]:[]}}}},SEATS,Engine);
}

test("three official name-filtered Sentinel AUTOs compile with their own cost fragment and shared five-card effect",()=>{
  for(const [cardId,nameFragment] of Object.entries(FAMILY)){
    const ability=Engine.parseCardAbilitiesCached(card(cardId)).find(item=>item.id===`${cardId}:1`);
    assert.equal(ability.definition.source.patternId,PATTERN,cardId);
    assert.equal(ability.definition.source.officialTextVerified,true,cardId);
    assert.deepEqual(ability.costs,[{type:"counter-blast",count:1,filter:{cardNameContains:nameFragment}}],cardId);
    assert.deepEqual(ability.definition.effects,[{op:"call-top-to-guardian",target:"controller",count:5,destination:"guardian",position:"rest"}],cardId);
    assert.equal(ability.canDecline,true,cardId);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true,cardId);
  }
});

test("host and joining defender independently pay the matching named damage card and call five cards rested",()=>{
  for(const [cardId] of Object.entries(FAMILY))for(const side of ["human","bot"]){
    const f=fixture(cardId,side),expectedShield=f.top.reduce((sum,item)=>sum+item.shield,0),topUids=f.top.map(item=>item.uid).sort();
    assert.equal(discover(f).queued.length,1,`${cardId}/${side}`);
    assert.equal(f.state.pendingAbility.side,side);
    assert.equal(f.state.pendingAbility.triggerControllerPlayerId,f.ownId);
    const forged=decide(f,{actor:side==="human"?SEATS.guestAuthUid:SEATS.hostAuthUid,actionId:`forged-${side}-${cardId}`});
    assert.equal(forged.ok,false);
    assert.equal(f.state.players[side].damage[0].faceDown,false);
    const resolved=decide(f);
    assert.equal(resolved.ok,true,`${cardId}/${side}: ${resolved.reason}`);
    const player=f.state.players[side];
    assert.equal(player.damage[0].faceDown,true);
    assert.equal(player.deck.length,0);
    assert.deepEqual(player.guardCircle.slice(1).map(item=>item.uid).sort(),topUids);
    assert.ok(player.guardCircle.slice(1).every(item=>item.rested&&item.position==="rest"&&item.circle==="guardian"));
    assert.equal(f.state.pendingAttack.guardCards.length,6);
    assert.equal(f.state.pendingAttack.targetPower,13000+expectedShield);
    const called=resolved.events.filter(item=>item.type==="card.placed"&&item.previousLocation==="deck");
    assert.equal(called.length,5);
    assert.ok(called.every(item=>item.currentLocation==="guardian"&&item.battleId===f.state.pendingAttack.battleId));
    assert.equal(f.state.players[side==="human"?"bot":"human"].damage.length,0);
  }
});

test("the AUTO is not prompted outside exact hand-to-GC guard placement or when its named cost is unavailable",()=>{
  for(const [cardId] of Object.entries(FAMILY)){
    const unavailable=fixture(cardId,"bot",{matchingCost:false});
    assert.equal(discover(unavailable).queued.length,0,`${cardId}: wrong damage-card name`);
    const faceDown=fixture(cardId,"bot",{faceDownCost:true});
    assert.equal(discover(faceDown).queued.length,0,`${cardId}: face-down cost card`);
    for(const changes of [{previousLocation:"rear-left"},{currentLocation:"rear-left",circle:"rear-left"},{sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other"},{timingWindow:"normal-call"},{battleId:"other"}]){
      const f=fixture(cardId,"bot"),event=Engine.createGameEvent(f.state,{...f.event,...changes,eventId:undefined});
      assert.equal(discover(f,event).queued.length,0,`${cardId}: ${JSON.stringify(changes)}`);
    }
  }
});

test("a forged nonmatching Counter-Blast selection is rejected without paying or calling",()=>{
  for(const [cardId] of Object.entries(FAMILY)){
    const f=fixture(cardId,"bot");
    assert.equal(discover(f).queued.length,1);
    const wrong=unit(item=>!String(item.name||"").toLowerCase().includes(f.fragment.toLowerCase()),[cardId]);
    const forgedPayment=instance(wrong,`wrong-cost-${cardId}`,f.ownId,{faceDown:false});
    f.state.players.bot.damage.push(forgedPayment);
    const before=JSON.stringify({damage:f.state.players.bot.damage,deck:f.state.players.bot.deck,guardian:f.state.players.bot.guardCircle,targetPower:f.state.pendingAttack.targetPower});
    const result=decide(f,{payment:forgedPayment});
    assert.equal(result.ok,false,cardId);
    assert.match(result.reason,/counter-blast-filter-not-met|activation-counter-blast-filter-not-met|unpayable/i,cardId);
    assert.equal(JSON.stringify({damage:f.state.players.bot.damage,deck:f.state.players.bot.deck,guardian:f.state.players.bot.guardCircle,targetPower:f.state.pendingAttack.targetPower}),before,cardId);
  }
});

test("declining consumes the optional prompt without paying or moving deck cards; duplicate event does not reopen it",()=>{
  for(const [cardId] of Object.entries(FAMILY)){
    const f=fixture(cardId,"bot");
    assert.equal(discover(f).queued.length,1);
    const result=decide(f,{accept:false,actionId:`decline-${cardId}`});
    assert.equal(result.ok,true,cardId);
    assert.equal(f.state.players.bot.damage[0].faceDown,false);
    assert.equal(f.state.players.bot.deck.length,5);
    assert.equal(f.state.players.bot.guardCircle.length,1);
    assert.equal(discover(f).queued.length,0);
  }
});

test("server whitelist rejects altered name fragments, optionality, timing, or effect count",()=>{
  const f=fixture();
  for(const mutate of [
    ability=>({...ability,costs:[{type:"counter-blast",count:1,filter:{cardNameContains:"Amon"}}]}),
    ability=>({...ability,canDecline:false}),
    ability=>({...ability,definition:{...ability.definition,optional:false}}),
    ability=>({...ability,definition:{...ability.definition,effects:[{op:"call-top-to-guardian",target:"controller",count:4,destination:"guardian",position:"rest"}]}})
  ])assert.equal(Reducer.supportsServerAbilityEffects(mutate(f.ability)),false);
});
