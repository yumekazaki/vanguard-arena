const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const Projection=require('./match-state-projection.js');
const Engine=require('./ability-engine.js');
const app=fs.readFileSync(require.resolve('./app.js'),'utf8');
const section=(a,b)=>app.slice(app.indexOf('  function '+a),app.indexOf('  function '+b));
function harness() {
  const nodes=new Map(), logs=[], requests=[];
  const cardMap=new Map([['unit',{id:'unit',name:'Secret Unit',grade:2,type:'Unit'}],['heart',{id:'heart',name:'Heart',grade:3,type:'Unit'}],['g',{id:'g',name:'G Unit',grade:4,type:'G Unit'}]]);
  const player=id=>({playerId:id,name:id,deck:[1,2,3,4,5].map(i=>({uid:id+'-'+i,cardId:'unit'})),hand:[],soul:[],bind:[],drop:[],rear:[null,null,null,null,null],gDeck:[],gZone:[],accelZones:0});
  const c={cardMap,match:{players:{human:player('host'),bot:player('guest')},phase:0,side:'bot'},online:{role:null},logs,requests,
    $:selector=>{if(!nodes.has(selector))nodes.set(selector,{open:false,innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},close(){this.open=false},showModal(){this.open=true},querySelector(){return {textContent:''}}});return nodes.get(selector)},
    document:{querySelectorAll:()=>[]},window:{VanguardHand:{close(){}}},isUnitCard:card=>/Unit/.test(card?.type||''),isGDeckCard:card=>card?.type==='G Unit',isGGuardian:()=>false,
    selectedHandCard:()=>null,queueMovedCardAbility(){},queueAbilityPrompts(){},renderMatch(){},renderSharedReveal(){},toast(){},addLog:message=>logs.push(message),escapeHtml:x=>String(x),cardImage:card=>card.name,
    sendGuestRequest:(type,payload)=>requests.push({type,payload})};
  vm.createContext(c);
  const returnStart=app.indexOf('function returnStriddenVanguard('),returnEnd=app.indexOf('\n  function ',returnStart);
  vm.runInContext(app.slice(returnStart,returnEnd)+section('beginSuperiorCall(','flipSide(')+section('callUnitToRear(','rearColumn(')+section('zoneMoveControls(','openMyDeck(')+section('performManualAction(','exportDeck('),c);
  return c;
}
test('private look hides identities from opponent and spectators and conserves deck order',()=>{
  const c=harness(), before=JSON.stringify(c.match.players.human.deck);
  c.manualGameAction('look-top:3');
  assert.deepEqual(Array.from(c.match.revealed.cards,x=>x.uid),['host-5','host-4','host-3']);
  assert.equal(Projection.projectForPlayer(c.match,'guest').revealed,null);
  assert.equal(Projection.projectForPlayer(c.match,'host').revealed.cards.length,3);
  const watch=JSON.parse(JSON.stringify(c.match));Projection.hidePrivateZones(watch,['human','bot']);assert.equal(watch.revealed,null);
  assert.ok(c.logs.every(log=>!log.includes('Secret Unit')));
  c.manualGameAction('reveal-done');assert.equal(JSON.stringify(c.match.players.human.deck),before);
});
test('public reveal remains visible and viewed cards can move to either end of the deck',()=>{
  const c=harness();c.manualGameAction('reveal-top:3');
  assert.equal(Projection.projectForPlayer(c.match,'guest').revealed.cards.length,3);
  c.manualGameAction('zone-move:reveal:deck-bottom:host-5');assert.equal(c.match.players.human.deck[0].uid,'host-5');
  c.manualGameAction('zone-move:reveal:deck-top:host-4');assert.equal(c.match.players.human.deck.at(-1).uid,'host-4');
  c.manualGameAction('reveal-done');assert.equal(c.match.players.human.deck.length,5);
});
test('deck top and bottom moves reorder cards without changing the deck size',()=>{
  const c=harness(),p=c.match.players.human;
  c.manualGameAction('zone-move:deck:deck-top:host-1');assert.equal(p.deck.at(-1).uid,'host-1');
  c.manualGameAction('zone-move:deck:deck-bottom:host-4');assert.equal(p.deck[0].uid,'host-4');assert.equal(p.deck.length,5);
});
test('Superior Call works from each requested zone outside Main phase and on the other turn',()=>{
  for(const source of ['hand','bind','deck','drop','reveal']) {
    const c=harness(),p=c.match.players.human,card={uid:'call',cardId:'unit'};
    if(source==='reveal')c.match.revealed={owner:'human',private:true,cards:[card]};else p[source].push(card);
    c.beginSuperiorCall('superior-call:'+source+':call');assert.equal(c.zoneFieldSelection.superior,true);
    c.manualGameAction('zone-move:'+source+':field:call:rear-left');
    assert.equal(p.rear[0].uid,'call');assert.equal(p.rear[0].rested,false);
  }
});
test('manual G return restores and stands the heart and returns the G Unit face up once',()=>{
  const c=harness(),p=c.match.players.human;
  p.vanguard={uid:'stride',cardId:'g',rested:true,strideHeart:{uid:'heart',cardId:'heart',rested:true}};
  c.manualGameAction('return-g-vanguard');
  assert.equal(p.vanguard.uid,'heart');assert.equal(p.vanguard.rested,false);
  assert.equal(p.gDeck.length,1);assert.equal(p.gDeck[0].faceUp,true);assert.equal(p.gDeck[0].strideHeart,undefined);
  assert.equal(Projection.projectForPlayer(c.match,'guest').players.human.gDeck[0].cardId,'g');
  c.manualGameAction('return-g-vanguard');assert.equal(p.gDeck.length,1);
});
test('guests route private look and manual G return through the existing host channel',()=>{
  const c=harness();c.online={role:'guest',connection:{open:true}};
  c.performManualAction('look-top:3');c.performManualAction('return-g-vanguard');
  assert.equal(c.requests[0].payload.action,'manual:look-top:3');assert.equal(c.requests[1].payload.action,'manual:return-g-vanguard');assert.equal(c.match.revealed,undefined);
});
test('card menus include top, bottom, and Superior Call without editing opponent cards',()=>{
  const c=harness();for(const source of ['deck','bind','drop','reveal']){
    const html=c.zoneMoveControls({uid:'one',cardId:'unit'},source);
    assert.match(html,/Superior Call/);assert.match(html,/Return to deck top/);assert.match(html,/Return to deck bottom/);
    assert.equal(c.zoneMoveControls({uid:'one',cardId:'unit'},source,false),'');
  }
});
test('opponent Bind inspection shows public cards without move controls or hidden identities',()=>{
  const c=harness();vm.runInContext(section('openBindDialog(','openDamageDialog('),c);
  c.match.players.bot.bind=[{uid:'public',cardId:'unit'},{uid:'hidden',cardId:'heart',faceDown:true}];
  c.openBindDialog('bot');
  const html=c.$('#bind-card-list').innerHTML;
  assert.match(html,/Secret Unit/);assert.match(html,/Face-down bound card/);
  assert.doesNotMatch(html,/Heart|data-zone-move|data-superior-call|data-superior-ride/);
  assert.equal(c.$('#bind-dialog').dataset.side,'bot');
});
test('online validator permits the new manual controls only for a current valid request',()=>{
  const state={matchId:'match',stateVersion:1,players:{human:{playerId:'host',hand:[]},bot:{playerId:'guest',hand:[]}},processedActionIds:[]};
  for(const action of ['manual:look-top:3','manual:return-g-vanguard']) {
    const request={type:'action',action,matchId:'match',actorPlayerId:'guest',actionId:action,expectedStateVersion:1,selected:null};
    assert.equal(Engine.validateRemoteActionRequest(state,request,'guest').ok,true);
    assert.equal(Engine.validateRemoteActionRequest(state,{...request,actorPlayerId:'outsider'},'guest').ok,false);
    assert.equal(Engine.validateRemoteActionRequest(state,{...request,expectedStateVersion:0},'guest').ok,false);
  }
});
test('viewed-card top/bottom buttons invoke their actual list handler',()=>{
  const c=harness();c.manualGameAction('look-top:2');
  let handler;
  const original=c.$;
  c.$=selector=>selector==='#reveal-card-list'?{addEventListener(type,callback){handler=callback}}:original(selector);
  vm.runInContext(app.split('\n').find(line=>line.includes('$("#reveal-card-list").addEventListener')),c);
  handler({target:{closest:selector=>selector==='[data-zone-move]'?{dataset:{zoneMove:'reveal:deck-bottom:host-5'}}:null}});
  assert.equal(c.match.players.human.deck[0].uid,'host-5');
  assert.equal(c.match.revealed.cards.length,1);
});
