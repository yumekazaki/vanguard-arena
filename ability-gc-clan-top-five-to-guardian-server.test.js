"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");
Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");
const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog(),PATTERN="auto-gc-clan-top-five-to-guardian-rest-drop-v1";
const FAMILY={"cfa-1738":"Genesis","cfa-1741":"Gold Paladin","cfa-1752":"Murakumo","cfa-1803":"Royal Paladin","cfa-1873":"Shadow Paladin","cfa-1875":"Aqua Force","cfa-1878":"Megacolony","cfa-1964":"Bermuda Triangle"};
const SEATS={hostAuthUid:"host-auth",guestAuthUid:"guest-auth",hostSide:"human",guestSide:"bot"};
const def=id=>{const found=catalog.find(card=>String(card.id)===String(id));assert.ok(found,`catalog card ${id}`);return found};
const unitWithClan=(clan,exclude=[])=>{const found=catalog.find(card=>/unit/i.test(String(card.type||""))&&(card.clan===clan||(card.clans||[]).includes(clan))&&Number.isFinite(Number(card.shield))&&!exclude.includes(String(card.id)));assert.ok(found,`unit with ${clan} and shield`);return found};
const instance=(definition,uid,playerId,extra={})=>({uid,cardId:String(definition.id),cardName:definition.name,type:definition.type||"Unit",grade:Number(definition.grade),clan:definition.clan,clans:definition.clans,shield:Number(definition.shield||0),unitCard:true,ownerPlayerId:playerId,controllerPlayerId:playerId,...extra});
function fixture(cardId="cfa-1738",side="bot",{wrongClan=false,uncallable=false}={}){
  const clan=FAMILY[cardId],ownerId=side==="human"?"player-host":"player-guest",opponentSide=side==="human"?"bot":"human",opponentId=opponentSide==="human"?"player-host":"player-guest";
  const source=instance(def(cardId),`guard-source-${side}`,ownerId),vanguardDefinition=unitWithClan(wrongClan?"Shadow Paladin":clan);
  const vanguard=instance(vanguardDefinition,`vanguard-${side}`,ownerId,{grade:3});
  const clanUnits=[unitWithClan(clan,[cardId]),unitWithClan(clan,[cardId])],other=unitWithClan(clan==="Genesis"?"Kagero":"Genesis");
  const top=[instance(other,`top-1-${side}`,ownerId),instance(clanUnits[0],`top-2-${side}`,ownerId),instance(other,`top-3-${side}`,ownerId),instance(clanUnits[1],`top-4-${side}`,ownerId),instance(other,`top-5-${side}`,ownerId)];
  if(uncallable){top[3].cardId="uncallable-order";top[3].type="Order";top[3].unitCard=false;top[3].clan=clan;top[3].clans=[clan];}
  const payment={uid:`cb-${side}`,cardId:"damage-cost",ownerPlayerId:ownerId,controllerPlayerId:ownerId,faceDown:false};
  const makePlayer=(id,vg,guard,deck,damage,drop)=>({playerId:id,vanguard:vg,rear:[null,null,null,null,null],hand:[],deck,damage,drop,soul:[],bind:[],guardCircle:guard,triggerZone:[],orders:[],crests:[],extra:[],gDeck:[],gZone:[],removed:[]});
  const state={matchId:"guardian-clan-top-five",stateVersion:7,processedActionIds:[],processedAbilityTriggers:[],turn:5,phase:5,side:opponentSide,players:{human:makePlayer("player-host",side==="human"?vanguard:null,side==="human"?[source]:[],side==="human"?top:[],side==="human"?[payment]:[],[]),bot:makePlayer("player-guest",side==="bot"?vanguard:null,side==="bot"?[source]:[],side==="bot"?top:[],side==="bot"?[payment]:[],[])} ,pendingAttack:{battleId:"battle-clan-top-five",attackerSide:opponentSide,attackerPlayerId:opponentId,attackerUid:`attack-vg-${opponentSide}`,attackerZone:"vanguard",defenderSide:side,defenderPlayerId:ownerId,targetUid:`target-vg-${side}`,targetZone:"vanguard",power:24000,targetPower:13000,critical:1,guardCards:[source],defenderDone:false,driveChecksRemaining:0,driveCountPrompt:false}};
  const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:ownerId,turnPlayerId:opponentId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:ownerId,sourceControllerPlayerId:ownerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:ownerId,subjectControllerPlayerId:ownerId,previousLocation:"hand",currentLocation:"guardian",circle:"guardian",battleId:state.pendingAttack.battleId,phase:"battle",timingWindow:"guard-placement"});
  const ability=Engine.parseCardAbilitiesCached(def(cardId)).find(item=>item.id===`${cardId}:1`);
  return{state,event,ability,source,top,payment,side,ownerId,clan};
}
function discover(f,event){return Reducer.discoverAutoTriggers(f.state,[event||f.event],Engine)}
function resolve(f,actorAuthUid){const pending=f.state.pendingAbility;return Reducer.applyAbilityDecision(f.state,{actorAuthUid:actorAuthUid||(f.side==="human"?SEATS.hostAuthUid:SEATS.guestAuthUid),actionId:`resolve-clan-top-five-${f.side}`,expectedStateVersion:f.state.stateVersion,payload:{type:"ability-response",accept:true,selection:{instanceUid:f.source.uid,abilityId:pending.ability.id,costSelections:{cb:[f.payment.uid]}}}},SEATS,Engine)}

test("all eight clan GC reveal AUTO abilities compile to strict trusted programs",()=>{
  const found=[];for(const card of catalog)for(const ability of Engine.parseCardAbilitiesCached(card))if(ability.definition?.source?.patternId===PATTERN)found.push(ability);
  assert.equal(found.length,8);assert.deepEqual(found.map(ability=>ability.cardId).sort(),Object.keys(FAMILY).sort());
  for(const ability of found){const clan=FAMILY[ability.cardId];assert.equal(ability.id,`${ability.cardId}:1`);assert.equal(ability.definition.conditions[0].value,clan);assert.equal(ability.definition.effects[0].filter.clan,clan);assert.equal(ability.canDecline,true);assert.equal(Reducer.supportsServerAbilityEffects(ability),true);}
  const mismatched=Engine.parseCardAbilitiesCached(def("cfa-1885")).find(item=>item.id==="cfa-1885:1");assert.notEqual(mismatched?.definition?.source?.patternId,PATTERN,"condition/effect clan typo is held for review");
});

test("host and joining defender independently reveal five, call only their clan rested, and move the rest to Drop",()=>{
  for(const [cardId,clan] of Object.entries(FAMILY))for(const side of ["human","bot"]){const f=fixture(cardId,side),expected=f.top.map(item=>({uid:item?.uid,shield:item?.shield}));assert.equal(discover(f).queued.length,1,`${cardId}/${side}`);assert.equal(f.state.pendingAbility.side,side);const result=resolve(f);assert.equal(result.ok,true,`${cardId}/${side}: ${result.reason}`);const player=f.state.players[side];assert.equal(player.damage[0].faceDown,true);assert.equal(player.deck.length,0);assert.deepEqual(player.guardCircle.slice(1).map(item=>item?.uid),[expected[3].uid,expected[1].uid],`${cardId}/${side} guardian contents: ${JSON.stringify(player.guardCircle)}`);assert.ok(player.guardCircle.slice(1).every(item=>item?.rested&&item.position==="rest"&&item.circle==="guardian"));assert.deepEqual(player.drop.map(item=>item.uid),[expected[4].uid,expected[2].uid,expected[0].uid]);assert.equal(f.state.pendingAttack.guardCards.length,3);assert.equal(f.state.pendingAttack.targetPower,13000+expected[1].shield+expected[3].shield);const placed=result.events.filter(item=>item.type==="card.placed"&&item.previousLocation==="deck");assert.equal(placed.length,2);assert.ok(placed.every(item=>item.currentLocation==="guardian"&&item.battleId===f.state.pendingAttack.battleId));assert.equal(f.ability.definition.effects[0].filter.clan,clan);}
});

test("wrong clan Vanguard, wrong source/circle, and wrong player cannot receive a prompt",()=>{
  const wrong=fixture("cfa-1738","bot",{wrongClan:true});assert.equal(discover(wrong).queued.length,0);
  const valid=fixture("cfa-1738","bot");for(const change of [{previousLocation:"rear-left"},{currentLocation:"rear-left",circle:"rear-left"},{sourceCardInstanceId:"other",cardInstanceId:"other",subjectCardInstanceId:"other"},{battleId:"other"}]){const event=Engine.createGameEvent(valid.state,{...valid.event,...change,eventId:undefined});assert.equal(discover(fixture("cfa-1738","bot"),event).queued.length,0,JSON.stringify(change));}
  const joined=fixture("cfa-1738","bot");assert.equal(discover(joined).queued.length,1);const forged=resolve(joined,SEATS.hostAuthUid);assert.equal(forged.ok,false);assert.equal(forged.reason,"source-not-controlled");assert.equal(joined.state.players.bot.damage[0].faceDown,false);assert.equal(joined.state.players.bot.deck.length,5);
});

test("declining is free and an uncallable matching Clan card rejects atomically before CB payment",()=>{
  const declined=fixture();assert.equal(discover(declined).queued.length,1);const result=Reducer.applyAbilityDecision(declined.state,{actorAuthUid:SEATS.guestAuthUid,actionId:"decline-clan-top-five",expectedStateVersion:declined.state.stateVersion,payload:{type:"ability-response",accept:false,selection:{instanceUid:declined.source.uid,abilityId:declined.ability.id}}},SEATS,Engine);assert.equal(result.ok,true);assert.equal(declined.state.players.bot.damage[0].faceDown,false);assert.equal(declined.state.players.bot.deck.length,5);
  const invalid=fixture("cfa-1738","bot",{uncallable:true});assert.equal(discover(invalid).queued.length,1);const before=JSON.stringify({deck:invalid.state.players.bot.deck,guard:invalid.state.players.bot.guardCircle,damage:invalid.state.players.bot.damage});const rejected=resolve(invalid);assert.equal(rejected.ok,false);assert.match(rejected.reason,/guardian-clan-top-five|effect|callable/i);assert.equal(JSON.stringify({deck:invalid.state.players.bot.deck,guard:invalid.state.players.bot.guardCircle,damage:invalid.state.players.bot.damage}),before);
});
