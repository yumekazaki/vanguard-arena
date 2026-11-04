"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");

const catalog=loadCatalog();
const FAMILY={"cfa-3842":"Gavrail","cfa-3959":"Bigbelly","cfa-3980":"Yasuie","cfa-3998":"Darkface"};
const VANGUARDS={"Gavrail":"cfa-3141","Bigbelly":"cfa-2712","Yasuie":"cfa-2918","Darkface":"cfa-3126"};
const PATTERN="auto-vanguard-name-attack-source-soul-draw-power-battle-v1";
const SEATS={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const def=id=>{const card=catalog.find(item=>String(item.id)===String(id));assert.ok(card,`catalog card ${id}`);return card};
const make=(cardId,uid,owner,extra={})=>{const card=def(cardId);return{uid,cardId:String(card.id),cardName:card.name,type:card.type,grade:Number(card.grade),power:Number(card.power||0),ownerPlayerId:owner,controllerPlayerId:owner,...extra}};
const authFor=side=>side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid;

function fixture(cardId="cfa-3842",side="human",{wrongName=false}={}){
  const expectedName=FAMILY[cardId];assert.ok(expectedName,`family ID ${cardId}`);
  const ownId=side==="human"?"player-host":"player-guest",otherSide=side==="human"?"bot":"human",otherId=side==="human"?"player-guest":"player-host";
  const source=make(cardId,`source-${cardId}-${side}`,ownId,{zone:"rear-guard",circle:"rear-left"});
  const vanguard=make(wrongName?"cfa-14047":VANGUARDS[expectedName],`vg-${side}`,ownId,{zone:"vanguard",circle:"vanguard"});
  const opponentVanguard=make("cfa-14047",`opponent-vg-${side}`,otherId,{zone:"vanguard",circle:"vanguard"});
  const drawn=make("cfa-3",`draw-${side}`,ownId,{zone:"deck"});
  const player=(playerId,vg,rear,deck)=>({playerId,vanguard:vg,rear,hand:[],deck,damage:[],soul:[],drop:[],bind:[],orders:[],crests:[],extra:[],gDeck:[],gZone:[],triggerZone:[],guardCircle:[]});
  const own=player(ownId,vanguard,[source,null,null,null,null],[drawn]);
  const opponent=player(otherId,opponentVanguard,[null,null,null,null,null],[]);
  const battleId=`battle-name-soul-${side}`;
  const state={matchId:"vanguard-name-source-soul",stateVersion:9,processedActionIds:[],processedEventIds:[],processedAbilityTriggers:[],pendingAbilities:[],turn:7,phase:5,side,players:{human:side==="human"?own:opponent,bot:side==="bot"?own:opponent},pendingAttack:{battleId,attackerSide:side,attackerPlayerId:ownId,attackerUid:vanguard.uid,attackerZone:"vanguard",defenderSide:otherSide,defenderPlayerId:otherId,targetUid:opponentVanguard.uid,targetZone:"vanguard",power:13000,targetPower:13000,critical:1,guardCards:[],defenderDone:false,driveChecksRemaining:0,driveCountPrompt:false}};
  const event=Engine.createGameEvent(state,{type:"unit.attacked",actingPlayerId:ownId,turnPlayerId:ownId,sourceCardInstanceId:vanguard.uid,sourceOwnerPlayerId:ownId,sourceControllerPlayerId:ownId,cardInstanceId:vanguard.uid,subjectCardInstanceId:vanguard.uid,subjectOwnerPlayerId:ownId,subjectControllerPlayerId:ownId,attackingCardInstanceIds:[vanguard.uid],previousLocation:"vanguard",currentLocation:"vanguard",targetCardInstanceIds:[opponentVanguard.uid],targetLocation:"vanguard",battleId,phase:"battle",timingWindow:"attack-declared"});
  const ability=Engine.parseCardAbilitiesCached(def(cardId)).find(item=>item.id===`${cardId}:0`);
  assert.ok(ability,`${cardId} ability parsed`);
  return{state,event,source,vanguard,opponentVanguard,drawn,ability,side,own,otherSide,otherId,expectedName};
}
function discover(f,event=f.event){return Reducer.discoverAutoTriggers(f.state,[event],Engine)}
function resolve(f,{actor=authFor(f.side),accept=true,effectUid=f.vanguard.uid,actionId=`resolve-${f.side}`}={}){
  const pending=f.state.pendingAbility;
  return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actor,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept,selection:{instanceUid:f.source.uid,abilityId:pending?.ability?.id||f.ability.id,...(accept?{targetUid:effectUid}:{}),costSelections:{cb:[],sb:[],discard:[],reveal:[]}}}},SEATS,Engine);
}

test("only the four exact named-Vanguard texts compile and preserve each catalog string",()=>{
  const compiled=[];
  for(const cardId of Object.keys(FAMILY)){
    const ability=Engine.parseCardAbilitiesCached(def(cardId)).find(item=>item.id===`${cardId}:0`);
    assert.ok(ability.definition);assert.equal(ability.definition.source.patternId,PATTERN);assert.equal(ability.definition.printedText,`AUTO ${ability.raw}`);
    assert.equal(ability.definition.optional,true);assert.equal(ability.canDecline,true);assert.deepEqual(ability.requiredLocation,["rear-guard"]);
    assert.deepEqual(ability.conditions,[{type:"controller-vanguard-name-contains",value:FAMILY[cardId]}]);assert.deepEqual(ability.costs,[{type:"source-to-soul",count:1}]);
    assert.deepEqual(ability.definition.effects,[{op:"draw",count:1},{op:"modify-power-target",target:"chosen",amount:5000,duration:"battle",targetFilter:{controller:"source-controller",cardType:"unit",zone:"vanguard"}}]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true);compiled.push(ability.id);
  }
  assert.deepEqual(compiled.sort(),Object.keys(FAMILY).map(cardId=>`${cardId}:0`).sort());
  const altered=Engine.parseCardAbilities({id:"cfa-3842",text:def("cfa-3842").text.replace("Gavrail","Different Name")})[0];
  assert.equal(altered.definition,null,"a text variant outside the reviewed exact family stays unsupported");
});

test("all four abilities resolve for either seat: source to Soul, draw one, then give the attacking Vanguard +5000 for this battle",()=>{
  for(const cardId of Object.keys(FAMILY))for(const side of ["human","bot"]){
    const f=fixture(cardId,side),found=discover(f);assert.equal(found.queued.length,1,`${cardId}/${side}`);assert.equal(f.state.pendingAbility.side,side);
    const result=resolve(f);assert.equal(result.ok,true,`${cardId}/${side}: ${result.reason}`);
    assert.equal(f.own.rear.includes(f.source),false);assert.equal(f.own.soul.at(-1).uid,f.source.uid);assert.equal(f.own.hand.at(-1).uid,f.drawn.uid);assert.equal(f.own.deck.length,0);
    assert.equal(f.state.pendingAttack.power,18000);assert.equal(f.vanguard.turnPowerBoost||0,0,"battle power does not persist on the card");
    assert.deepEqual(result.events.filter(event=>event.type==="card.moved"&&event.cardInstanceId===f.source.uid).map(event=>[event.previousLocation,event.currentLocation]),[["rear-left","soul"]]);
    assert.ok(result.events.some(event=>event.type==="card.drawn"&&event.cardInstanceId===f.drawn.uid));
  }
});

test("declining is free, and wrong-name or wrong-attacker events cannot create a prompt",()=>{
  for(const side of ["human","bot"]){
    const f=fixture("cfa-3842",side);assert.equal(discover(f).queued.length,1);
    const result=resolve(f,{accept:false,actionId:`decline-${side}`});assert.equal(result.ok,true);assert.ok(f.own.rear.includes(f.source));assert.equal(f.own.soul.length,0);assert.equal(f.own.hand.length,0);assert.equal(f.state.pendingAttack.power,13000);
  }
  for(const cardId of Object.keys(FAMILY)){
    const wrongName=fixture(cardId,"human",{wrongName:true});assert.equal(discover(wrongName).queued.length,0,`${cardId}: wrong Vanguard name`);
    const wrongAttacker=fixture(cardId,"human"),attacker=make("cfa-14047","other-attacker","player-host",{zone:"rear-guard",circle:"rear-left"});wrongAttacker.own.rear[1]=attacker;
    wrongAttacker.state.pendingAttack.attackerUid=attacker.uid;wrongAttacker.state.pendingAttack.attackerZone="rear-left";
    const event=Engine.createGameEvent(wrongAttacker.state,{type:"unit.attacked",actingPlayerId:"player-host",turnPlayerId:"player-host",sourceCardInstanceId:attacker.uid,sourceOwnerPlayerId:attacker.ownerPlayerId,sourceControllerPlayerId:attacker.controllerPlayerId,cardInstanceId:attacker.uid,subjectCardInstanceId:attacker.uid,subjectOwnerPlayerId:attacker.ownerPlayerId,subjectControllerPlayerId:attacker.controllerPlayerId,attackingCardInstanceIds:[attacker.uid],previousLocation:"rear-left",currentLocation:"rear-left",targetCardInstanceIds:[wrongAttacker.opponentVanguard.uid],targetLocation:"vanguard",battleId:wrongAttacker.state.pendingAttack.battleId,phase:"battle",timingWindow:"attack-declared"});
    assert.equal(discover(wrongAttacker,event).queued.length,0,`${cardId}: a Rear-Guard attack does not qualify`);
    const missingSource=fixture(cardId,"human");missingSource.own.rear[0]=null;assert.equal(discover(missingSource).queued.length,0,`${cardId}: source off RC`);
  }
});

test("stale source, stale or foreign Vanguard target, and a forged resolving seat reject atomically",()=>{
  const staleSource=fixture();assert.equal(discover(staleSource).queued.length,1);staleSource.own.rear[0]=null;staleSource.own.hand.push(staleSource.source);const sourceBefore=JSON.stringify(staleSource.state);assert.equal(resolve(staleSource,{actionId:"stale-source"}).ok,false);assert.equal(JSON.stringify(staleSource.state),sourceBefore);
  for(const cardId of Object.keys(FAMILY)){
    for(const invalid of ["foreign-vanguard","missing-vanguard"]){
      const f=fixture(cardId,"bot");assert.equal(discover(f).queued.length,1);
      const target=invalid==="foreign-vanguard"?f.opponentVanguard.uid:null,before=JSON.stringify(f.state),result=resolve(f,{effectUid:target,actionId:`${cardId}-${invalid}`});
      assert.equal(result.ok,false,`${cardId}/${invalid}`);assert.equal(JSON.stringify(f.state),before,`${cardId}/${invalid} mutated state`);
    }
  }
  const forged=fixture("cfa-3959","bot");assert.equal(discover(forged).queued.length,1);const before=JSON.stringify(forged.state);assert.equal(resolve(forged,{actor:SEATS.hostAuthUid,actionId:"forged-host"}).ok,false);assert.equal(JSON.stringify(forged.state),before);
});

test("replay is rejected and the battle-only modifier stays tied to this battle",()=>{
  const f=fixture("cfa-3980","human");assert.equal(discover(f).queued.length,1);const result=resolve(f,{actionId:"resolve-once"});assert.equal(result.ok,true);const after=JSON.stringify(f.state);
  const replay=resolve(f,{actionId:"resolve-once"});assert.equal(replay.ok,false);assert.equal(replay.reason,"duplicate-action");assert.equal(JSON.stringify(f.state),after);
  assert.equal(f.vanguard.battlePowerBoost||0,0);assert.equal(f.state.pendingAttack.power,18000);
});
