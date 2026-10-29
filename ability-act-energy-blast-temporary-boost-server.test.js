"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const IDS=["cfa-13476","cfa-13527","cfa-13579","cfa-13593","cfa-13614"];
const TEXT='ACT [RC] 1/Turn: COST [Energy Blast 3], until end of turn, this unit gets "Boost" and power +5000.';
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
const catalog=new Map(loadCatalog().map(card=>[String(card.id),card]));
let sequence=0;
function makeInstance(cardId,uid,playerId,extra={}){const card=catalog.get(String(cardId));return{uid,cardId:String(cardId),cardName:card?.name||"Unit",type:card?.type||"Unit",unitCard:true,grade:Number(card?.grade||0),power:Number(card?.power||0),critical:Number(card?.critical||1),ownerPlayerId:playerId,controllerPlayerId:playerId,...extra};}
function fixture(cardId=IDS[0],side="human",{energy=6,generator=true}={}){
  const n=++sequence,owner=side==="human"?"host-player":"guest-player",opponent=side==="human"?"guest-player":"host-player";
  const source=makeInstance(cardId,`source-${n}`,owner),attacker=makeInstance("cfa-3",`attacker-${n}`,owner,{rested:false}),defender=makeInstance("cfa-4",`defender-${n}`,opponent);
  const player=id=>({playerId:id,vanguard:null,rear:Array(5).fill(null),hand:[],deck:[],soul:[],drop:[],damage:[],bind:[],orders:[],guardCircle:[],triggerZone:[],gDeck:[],gZone:[],crests:[],energy:0,energySpentThisTurn:0});
  const players={human:player("host-player"),bot:player("guest-player")},own=players[side],other=players[side==="human"?"bot":"human"];
  own.rear[2]=source;own.rear[0]=attacker;own.energy=energy;if(generator)own.crests.push(makeInstance("cfa-12245",`generator-${n}`,owner));
  other.vanguard=defender;
  const state={matchId:`temporary-boost-${n}`,stateVersion:1,eventSequence:0,processedActionIds:[],processedAbilityTriggers:[],processedEventIds:[],turn:2,side,phase:4,pendingAbility:null,pendingAbilities:[],pendingTrigger:null,pendingAttack:null,players};
  const ability=Engine.parseCardAbilitiesCached(catalog.get(cardId)).find(item=>item.id===`${cardId}:0`);
  assert.ok(ability,`compiled ${cardId}:0`);
  return{ability,attacker,defender,opponent,other,owner,own,players,side,source,state};
}
function activate(f,auth=f.side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId=`activate-${f.source.uid}`){return Reducer.applyManualAbilityActivation(f.state,{actorAuthUid:auth,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:"manual-ability-activation",sourceCardInstanceId:f.source.uid,abilityId:f.ability.id,selection:{}}},seats,Engine);}

test("the five real Grade 2 ACT definitions preserve Energy Blast, once-per-turn, Boost, and power",()=>{
  for(const id of IDS){const ability=Engine.parseCardAbilitiesCached(catalog.get(id)).find(item=>item.id===`${id}:0`);assert.equal(ability.printedText,TEXT,id);assert.equal(ability.definition.source.patternId,"act-energy-blast-temporary-boost-power-v1",id);assert.equal(Reducer.supportsServerAbilityEffects(ability),true,id);assert.deepEqual(ability.requiredLocation,["rear-guard"],id);assert.deepEqual(ability.costs,[{type:"energy-blast",count:3}],id);assert.equal(ability.once,true,id);assert.deepEqual(ability.effects,[{op:"modify-power",target:"source",amount:5000,duration:"turn"},{op:"grant-temporary-boost",target:"source",duration:"turn"}],id);}
});

test("both players pay for their own ACT, gain usable Boost, and lose the temporary keyword and power at turn end",()=>{
  for(const id of IDS)for(const side of ["human","bot"]){
    const f=fixture(id,side),result=activate(f);assert.equal(result.ok,true,`${id}/${side}: ${result.reason}`);assert.equal(f.own.energy,3);assert.equal(f.own.energySpentThisTurn,3);assert.equal(f.other.energy,0);assert.equal(f.source.boostAbility,true);assert.equal(f.source.turnPowerBoost,5000);assert.equal(f.source.turnPowerExpiry,f.owner);
    const repeated=activate(f,undefined,`repeat-${f.source.uid}`);assert.equal(repeated.ok,false);assert.match(repeated.reason,/once|used|restriction/i);assert.equal(f.own.energy,3);
    f.state.phase=5;f.state.stateVersion++;
    const attack=Reducer.applyGameAction(f.state,{actorAuthUid:side==="human"?seats.hostAuthUid:seats.guestAuthUid,actionId:`attack-${f.source.uid}`,expectedStateVersion:f.state.stateVersion,payload:{type:"game-action",action:"attack",attackerCardInstanceId:f.attacker.uid,targetCardInstanceId:f.defender.uid,boosterCardInstanceId:f.source.uid}},seats,Engine);
    assert.equal(attack.ok,true,`${id}/${side} granted Boost attack: ${attack.reason}`);assert.equal(attack.events.find(event=>event.type==="unit.boosted")?.boosterCardInstanceId,f.source.uid);
    Engine.expireTurnModifiers(f.players,f.owner);assert.equal(f.source.boostAbility,undefined);assert.equal(f.source.turnPowerBoost,0);assert.equal(f.source.turnPowerExpiry,undefined);
  }
});

test("unavailable Energy Blast, absent Energy Generator, wrong timing, foreign actor, and tampered program reject without partial payment",()=>{
  for(const options of [{energy:2},{energy:6,generator:false}]){const f=fixture(IDS[0],"human",options),before=structuredClone(f.own);const result=activate(f);assert.equal(result.ok,false);assert.deepEqual(f.own,before);}
  const timing=fixture();timing.state.phase=3;assert.equal(activate(timing).ok,false);assert.equal(timing.own.energy,6);
  const foreign=fixture(IDS[0],"bot");assert.equal(activate(foreign,seats.hostAuthUid).ok,false);assert.equal(foreign.own.energy,6);
  const forged=fixture(),ability=structuredClone(forged.ability);ability.definition.effects[1].duration="battle";assert.equal(Reducer.supportsServerAbilityEffects(ability),false);
});
