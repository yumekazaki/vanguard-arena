'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Engine=require('./ability-engine.js');
Engine.registerAbilityDefinitions(require('./ability-definitions.js'));
const Reducer=require('./ability-server-reducer.js');
const {loadCatalog}=require('./scripts/audit-ability-catalog.js');
const PATTERN='act-soul-blast-source-power-turn-v1';
const catalog=loadCatalog(),cards=new Map(catalog.map(card=>[String(card.id),card]));
const family=catalog.flatMap(card=>Engine.parseCardAbilitiesCached(card).filter(ability=>ability.definition?.source?.patternId===PATTERN));
const seats={hostAuthUid:'auth-host',guestAuthUid:'auth-guest',hostSide:'human',guestSide:'bot'};
const expected={'cfa-1210':{index:1,zone:'vanguard',soul:3,power:5000},'cfa-1350':{index:1,zone:'vanguard',soul:3,power:5000},'cfa-1983':{index:0,zone:'rear-guard',soul:1,power:1000},'cfa-1994':{index:2,zone:'vanguard',soul:2,power:2000},'cfa-2450':{index:0,zone:'rear-guard',soul:1,power:1000},'cfa-3303':{index:0,zone:'rear-guard',soul:1,power:1000},'cfa-4214':{index:0,zone:'rear-guard',soul:2,power:3000},'cfa-4871':{index:0,zone:'rear-guard',soul:1,power:1000},'cfa-7100':{index:0,zone:'rear-guard',soul:2,power:10000,text:'ACT [RC]: COST [Soul Blast 2], and this unit gets power +10000 until end of turn.'},'cfa-8573':{index:0,zone:'rear-guard',soul:3,power:15000,text:'ACT [RC]: COST [Soul Blast 3], and this unit gets power +15000 until end of turn.'}};
function instance(cardId,uid,playerId){const c=cards.get(String(cardId));return{uid,cardId:String(cardId),cardName:c?.name,type:c?.type||'Unit',grade:Number(c?.grade),ownerPlayerId:playerId,controllerPlayerId:playerId,unitCard:true,power:10000};}
function fixture(ability,side='human',soulCount=8){const cardId=String(ability.cardId),rule=expected[cardId],ownerId=side==='human'?'player-host':'player-guest',otherSide=side==='human'?'bot':'human',otherId=otherSide==='human'?'player-host':'player-guest',source=instance(cardId,`act-source-${ability.id}-${side}`,ownerId),own={playerId:ownerId,vanguard:instance('cfa-3',`vg-${side}`,ownerId),rear:[null,null,null,null,null],soul:Array.from({length:soulCount},(_,i)=>instance('cfa-3',`soul-${ability.id}-${side}-${i}`,ownerId)),deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],gDeck:[],gZone:[]};if(rule.zone==='vanguard')own.vanguard=source;else own.rear[2]=source;const opponent={playerId:otherId,vanguard:instance('cfa-3',`opp-vg-${side}`,otherId),rear:Array(5).fill(null),soul:[],deck:[],hand:[],drop:[],bind:[],damage:[],orders:[],guardCircle:[],gDeck:[],gZone:[]};const state={matchId:`act-sb-${ability.id}-${side}`,stateVersion:1,processedActionIds:[],turn:4,phase:4,side,players:side==='human'?{human:own,bot:opponent}:{human:opponent,bot:own}};return{state,source,own,opponent,side,ownerId,otherSide,rule};}
function activate(f,abilityId,actorAuthUid=f.side==='human'?seats.hostAuthUid:seats.guestAuthUid,actionId=`activate-${f.source.uid}-${f.state.stateVersion}`){return Reducer.applyManualAbilityActivation(f.state,{actorAuthUid,actionId,expectedStateVersion:f.state.stateVersion,payload:{type:'manual-ability-activation',sourceCardInstanceId:f.source.uid,abilityId,selection:{costSelections:{cb:[],sb:f.own.soul.slice(0,f.rule.soul).map(card=>card.uid),discard:[],reveal:[]}}}},seats,Engine);}

test('all ten trusted ACT definitions preserve their exact circle, Soul Blast, and power amount',()=>{
  assert.equal(family.length,10);
  for(const ability of family){
    const x=expected[ability.cardId];
    assert.ok(Engine.getReviewedAbilityDefinitionsForCard(ability.cardId).some(d=>d.id===ability.id),ability.id);
    assert.equal(ability.definition.source.patternId,PATTERN);
    assert.equal(ability.kind,'ACT');
    if(x.text)assert.equal(ability.printedText,x.text,ability.id);
    assert.deepEqual(ability.requiredLocation,[x.zone]);
    assert.deepEqual(ability.costs,[{type:'soul-blast',count:x.soul}]);
    assert.deepEqual(ability.definition.effects,[{op:'modify-power',target:'source',amount:x.power,duration:'turn'}]);
    assert.equal(Reducer.supportsServerAbilityEffects(ability),true,ability.id);
  }
});
test('host and joining player independently pay Soul Blast and increase only their own source power',()=>{
  for(const ability of family)for(const side of ['human','bot']){
    const f=fixture(ability,side),before=f.source.turnPowerBoost||0,result=activate(f,ability.id);
    assert.equal(result.ok,true,`${ability.id}/${side}: ${result.reason}`);
    assert.equal(f.own.soul.length,8-f.rule.soul);
    assert.equal(f.source.turnPowerBoost,before+f.rule.power);
    assert.equal(f.opponent.soul.length,0);
  }
});
test('insufficient Soul, wrong circle, wrong turn, forged owner, and altered trusted text reject atomically',()=>{const ability=family.find(x=>x.cardId==='cfa-1994');let f=fixture(ability,'human',1),before=JSON.stringify(f.state);assert.equal(activate(f,ability.id).ok,false);assert.equal(JSON.stringify(f.state),before);f=fixture(ability);f.own.vanguard=instance('cfa-3','replacement-vg','player-host');f.own.rear[2]=f.source;before=JSON.stringify(f.state);assert.equal(activate(f,ability.id).ok,false);assert.equal(JSON.stringify(f.state),before);f=fixture(ability);f.state.side='bot';before=JSON.stringify(f.state);assert.equal(activate(f,ability.id).ok,false);assert.equal(JSON.stringify(f.state),before);f=fixture(ability,'bot');before=JSON.stringify(f.state);assert.equal(activate(f,ability.id,seats.hostAuthUid).ok,false);assert.equal(JSON.stringify(f.state),before);const forged={...ability,definition:{...ability.definition,printedText:ability.definition.printedText.replace('+2000','+5000')}};assert.equal(Reducer.supportsServerAbilityEffects(forged),false);});
test('this ACT has no once-per-turn restriction and may be activated again while Soul remains',()=>{const ability=family.find(x=>x.cardId==='cfa-2450'),f=fixture(ability,'human',2);assert.equal(activate(f,ability.id,seats.hostAuthUid,'first').ok,true);f.state.stateVersion++;assert.equal(activate(f,ability.id,seats.hostAuthUid,'second').ok,true);assert.equal(f.own.soul.length,0);assert.equal(f.source.turnPowerBoost,2000);});
