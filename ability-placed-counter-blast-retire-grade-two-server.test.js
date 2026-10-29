"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Engine=require("./ability-engine.js");Engine.registerAbilityDefinitions(require("./ability-definitions.js"));
const Reducer=require("./ability-server-reducer.js");const {loadCatalog}=require("./scripts/audit-ability-catalog.js");
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const entries=[["cfa-474",0,["vanguard","rear-guard"],"Dark Irregulars"],["cfa-859",0,["vanguard","rear-guard"],"Narukami"],["cfa-1201",1,["vanguard"],null],["cfa-1767",1,["vanguard"],null]];
const seats={hostAuthUid:"auth-host",guestAuthUid:"auth-guest",hostSide:"human",guestSide:"bot"};
function instance(cardId,uid,playerId,extra={}){const card=cards.get(cardId);return{uid,cardId,cardName:card?.name||cardId,type:card?.type||"Unit",grade:Number(card?.grade||0),ownerPlayerId:playerId,controllerPlayerId:playerId,...extra};}
function fixture(cardId,side="human",sourceZone="vanguard",options={}){
 const [entry]=entries.filter(item=>item[0]===cardId),index=entry[1],ability=Engine.parseCardAbilities(cards.get(cardId))[index],rule=entry[3];
 const playerId=side==="human"?"host-player":"guest-player",otherSide=side==="human"?"bot":"human",otherId=otherSide==="human"?"host-player":"guest-player";
 const source=instance(cardId,`retire-source-${cardId}-${side}-${sourceZone}`,playerId,{zone:sourceZone,circle:sourceZone==="vanguard"?"vanguard":"rear-left"});
 const vanguard=sourceZone==="vanguard"?source:instance(rule==="Narukami"?"cfa-859":rule==="Dark Irregulars"?"cfa-474":"cfa-14",`retire-vg-${cardId}-${side}`,playerId,{zone:"vanguard",circle:"vanguard"});
 const target=options.target===false?null:instance("cfa-14",`retire-target-${cardId}-${side}`,otherId,{zone:"rear-guard",circle:"rear-left"});
 const costA=instance("cfa-14",`retire-cb-a-${cardId}-${side}`,playerId,{zone:"damage",faceDown:false}),costB=instance("cfa-14",`retire-cb-b-${cardId}-${side}`,playerId,{zone:"damage",faceDown:false});
 const own={playerId,vanguard,rear:sourceZone==="rear-guard"?[source,null,null,null,null]:Array(5).fill(null),damage:options.affordable===false?[]:[costA,costB],deck:[],hand:[],soul:[],drop:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[]};
 const opponent={playerId:otherId,vanguard:instance("cfa-14",`retire-op-vg-${cardId}-${side}`,otherId,{zone:"vanguard",circle:"vanguard"}),rear:target?[target,null,null,null,null]:Array(5).fill(null),damage:[],deck:[],hand:[],soul:[],drop:[],bind:[],orders:[],guardCircle:[],gDeck:[],gZone:[]};
 const state={matchId:`placed-retire-${cardId}-${side}`,stateVersion:1,turn:2,phase:2,side,processedActionIds:[],processedEventIds:[],processedAbilityTriggers:[],pendingAbility:null,pendingAbilities:[],players:{[side]:own,[otherSide]:opponent}};
 const event=Engine.createGameEvent(state,{type:"card.placed",actingPlayerId:playerId,turnPlayerId:playerId,sourceCardInstanceId:source.uid,sourceOwnerPlayerId:playerId,sourceControllerPlayerId:playerId,cardInstanceId:source.uid,subjectCardInstanceId:source.uid,subjectOwnerPlayerId:playerId,subjectControllerPlayerId:playerId,previousLocation:"hand",currentLocation:sourceZone,circle:sourceZone==="vanguard"?"vanguard":"rear-left",phase:"main",timingWindow:"card-placement"});
 return{state,own,opponent,source,target,costA,costB,event,ability,side,playerId};
}
function decide(f,accept=true,auth=f.side==="human"?seats.hostAuthUid:seats.guestAuthUid){return Reducer.applyAbilityDecision(f.state,{actorAuthUid:auth,actionId:`retire-response-${f.source.uid}-${accept}`,expectedStateVersion:f.state.stateVersion,payload:{accept,selection:{instanceUid:f.source.uid,abilityId:f.ability.id,targetUid:f.target?.uid,costSelections:{cb:[f.costA.uid,f.costB.uid],sb:[],discard:[],reveal:[]}}}},seats,Engine);}

test("all four placed Counter-Blast retirement records are production trusted with their exact circle and clan rules",()=>{
 for(const [cardId,index,circles,clan] of entries){const ability=Engine.parseCardAbilities(cards.get(cardId))[index];assert.ok(Engine.getReviewedAbilityDefinitionsForCard(cardId).some(definition=>definition.id===ability.id),cardId);assert.equal(ability.definition.source.patternId,"auto-placed-vc-rc-counter-blast-two-retire-opponent-grade-two-v1");assert.equal(Reducer.supportsServerAbilityEffects(ability),true,cardId);assert.deepEqual(ability.trigger.circles,circles);assert.deepEqual(ability.costs,[{type:"counter-blast",count:2}]);assert.deepEqual(ability.conditions,clan?[{type:"controller-vanguard-has-clan",value:clan}]:[]);assert.deepEqual(ability.definition.effects[0].targetFilter,{controller:"opponent",zone:"rear-guard",maxGrade:2});}
});

test("host and joiner independently pay Counter-Blast 2 and retire only a legal opponent Grade 2 Rear-Guard",()=>{
 for(const [cardId,,circles] of entries)for(const side of ["human","bot"])for(const zone of circles){const f=fixture(cardId,side,zone),found=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(found.queued.length,1,`${cardId}/${side}/${zone}: ${JSON.stringify(found.skipped)}`);assert.equal(f.state.pendingAbility.side,side);const result=decide(f);assert.equal(result.ok,true,`${cardId}/${side}/${zone}: ${result.reason}`);assert.ok(f.opponent.drop.some(card=>card.uid===f.target.uid));assert.equal(f.own.damage.every(card=>card.faceDown===true),true);assert.equal(f.own.damage.length,2);}
});

test("wrong source, VC-only circle, wrong Vanguard clan, missing cost, missing target, and host proxy cannot prompt or resolve",()=>{
 const rearOnly=fixture("cfa-1201","human","rear-guard");assert.equal(Reducer.discoverAutoTriggers(rearOnly.state,[rearOnly.event],Engine).queued.length,0);
 const wrongClan=fixture("cfa-859","human","rear-guard");wrongClan.own.vanguard=instance("cfa-14","wrong-clan-vg","host-player",{zone:"vanguard",circle:"vanguard"});assert.equal(Reducer.discoverAutoTriggers(wrongClan.state,[wrongClan.event],Engine).queued.length,0);
 for(const [cardId,,circles,clan] of entries){const zone=circles.at(-1);const f=fixture(cardId,"human",zone,{affordable:false});const costResult=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(costResult.queued.length,0,`${cardId} cost ${JSON.stringify({queued:costResult.queued.map(x=>x.ability?.id),skipped:costResult.skipped})}`);const noTarget=fixture(cardId,"human",zone,{target:false});assert.equal(Reducer.discoverAutoTriggers(noTarget.state,[noTarget.event],Engine).queued.length,0,`${cardId} target`);}
 const joiner=fixture("cfa-859","bot","rear-guard"),found=Reducer.discoverAutoTriggers(joiner.state,[joiner.event],Engine);assert.equal(found.queued.length,1);assert.equal(joiner.state.pendingAbility.side,"bot");const before=JSON.stringify(joiner.state);assert.equal(decide(joiner,true,seats.hostAuthUid).ok,false);assert.equal(JSON.stringify(joiner.state),before);
 const wrongInstance=fixture("cfa-1201");const altered=Engine.createGameEvent(wrongInstance.state,{...wrongInstance.event,eventId:undefined,cardInstanceId:"different-copy",subjectCardInstanceId:"different-copy"});assert.equal(Reducer.discoverAutoTriggers(wrongInstance.state,[altered],Engine).queued.length,0);
});

test("declining the optional placement ability leaves its costs and target unchanged",()=>{const f=fixture("cfa-1201"),result=Reducer.discoverAutoTriggers(f.state,[f.event],Engine);assert.equal(result.queued.length,1);assert.equal(decide(f,false).ok,true);assert.ok(f.own.damage.every(card=>card.faceDown===false));assert.ok(f.opponent.rear.some(card=>card?.uid===f.target.uid));});
