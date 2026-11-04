const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Engine=require('./ability-engine.js');
const app=fs.readFileSync(require.resolve('./app.js'),'utf8');
const section=(a,b)=>app.slice(app.indexOf('  function '+a),app.indexOf('  function '+b));
function harness(){
  const nodes=new Map(),requests=[];
  const player=id=>({playerId:id,name:id,deck:[{uid:id+'-deck',cardId:'unit'}],hand:[],orders:[{uid:id+'-order',cardId:'order',rested:false,faceDown:false}],soul:[],drop:[],rear:[null,null,null,null,null],vanguard:{uid:id+'-vg',cardId:'unit'}});
  const c={match:{matchId:'match',stateVersion:1,players:{human:player('guest'),bot:player('host')},phase:0,side:'bot'},online:{role:'guest',connection:{open:true}},requests,
    cardMap:new Map([['unit',{id:'unit',name:'Unit',type:'Unit',grade:1}],['order',{id:'order',name:'Order',type:'Order'}]]),
    $:s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',open:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn},close(){this.open=false},showModal(){this.open=true}});return nodes.get(s)},
    selectedHandCard:()=>c.match.players.human.hand.find(card=>card.uid===c.match.selected),findFieldCard:uid=>{const p=c.match.players.human;if(p.vanguard?.uid===uid)return{side:'human',zone:'vanguard',instance:p.vanguard};const index=p.rear.findIndex(card=>card?.uid===uid);return index<0?null:{side:'human',zone:'rear-left',index,instance:p.rear[index]};},
    window:{VanguardAbilityEngine:{canCallCard:()=>true}},isUnitCard:card=>card?.type==='Unit',isGDeckCard:()=>false,eligibleActivatedAbilities:()=>[],escapeHtml:x=>x,toast(){},addLog(){},queueMovedCardAbility(){},renderMatch(){},
    sendGuestRequest:(type,payload)=>requests.push({type,...payload}),draw:side=>{const p=c.match.players[side],card=p.deck.pop();if(card)p.hand.push(card);return card;}
  };
  vm.createContext(c);
  vm.runInContext(section('showOrderMenu(','updateActionAvailability(')+section('manualGameAction(','flipSide(')+section('performManualAction(','exportDeck('),c);
  const start=app.indexOf('  $("#context-menu-actions").addEventListener'),end=app.indexOf('  $("#crest-add-button")',start);
  vm.runInContext(app.slice(start,end),c);
  return c;
}
function validate(c,action,selected=null){
  const hostState={...c.match,players:{human:c.match.players.bot,bot:c.match.players.human},side:'human'};
  return Engine.validateRemoteActionRequest(hostState,{type:'action',action,selected,matchId:'match',actorPlayerId:'guest',expectedStateVersion:1,actionId:'request-'+action},'guest');
}
test('deck menu Draw uses the same manual draw channel as More game controls',()=>{
  const c=harness();c.showDeckMenu();
  assert.match(c.$('#context-menu-actions').innerHTML,/data-context-action="draw-card"/);
  c.$('#context-menu-actions').handlers.click({target:{closest:()=>({dataset:{contextAction:'draw-card'}})}});
  assert.equal(c.requests[0].action,'manual:draw-card');assert.equal(validate(c,c.requests[0].action).ok,true);
  assert.equal(validate(c,'draw').ok,false,'phase-restricted Draw action remains restricted');
  const p=c.match.players.human;c.manualGameAction('draw-card');assert.equal(p.deck.length,0);assert.equal(p.hand.length,1);
});
test('every Order menu action is accepted for the joined player and reaches its existing handler',()=>{
  const commands=['order-rest','order-flip','order-to-hand','order-to-soul','order-to-top','order-to-bottom','order-to-drop'];
  for(const command of commands){
    const c=harness(),p=c.match.players.human,action=command+':guest-order';
    c.showOrderMenu('guest-order');assert.ok(c.$('#context-menu-actions').innerHTML.includes(action));
    c.performManualAction(action);assert.equal(c.requests[0].action,'manual:'+action);
    assert.equal(validate(c,c.requests[0].action,'guest-order').ok,true,command);
    c.manualGameAction(action);
    if(command==='order-rest')assert.equal(p.orders[0].rested,true);
    else if(command==='order-flip')assert.equal(p.orders[0].faceDown,true);
    else {const zone={'order-to-hand':'hand','order-to-soul':'soul','order-to-top':'deck','order-to-bottom':'deck','order-to-drop':'drop'}[command];assert.equal(p.orders.length,0);assert.ok(p[zone].some(card=>card.uid==='guest-order'));}
  }
});
test('Order actions cannot move a card from the opponent Order zone',()=>{
  const c=harness(),before=JSON.stringify(c.match.players.bot.orders);
  c.manualGameAction('order-to-soul:host-order');
  assert.equal(JSON.stringify(c.match.players.bot.orders),before);assert.equal(c.match.players.human.soul.length,0);
});
test('Soul menu action is absent only for Vanguard; hand and Rear-Guard retain it',()=>{
  const c=harness(),p=c.match.players.human;c.match.selected=p.vanguard.uid;c.showContextMenu('field');
  assert.doesNotMatch(c.$('#context-menu-actions').innerHTML,/data-context-action="selected-to-soul"/);
  p.rear[0]={uid:'rear',cardId:'unit'};c.match.selected='rear';c.showContextMenu('field');assert.match(c.$('#context-menu-actions').innerHTML,/data-context-action="selected-to-soul"/);
  p.hand.push({uid:'hand',cardId:'unit'});c.match.selected='hand';c.showContextMenu('hand');assert.match(c.$('#context-menu-actions').innerHTML,/data-context-action="selected-to-soul"/);
});
test('manual Soul control rejects Vanguard while hand and Rear-Guard moves still work',()=>{
  const c=harness(),p=c.match.players.human;c.match.selected=p.vanguard.uid;c.manualGameAction('selected-to-soul');assert.equal(p.vanguard.uid,'guest-vg');assert.equal(p.soul.length,0);
  p.rear[0]={uid:'rear',cardId:'unit'};c.match.selected='rear';c.manualGameAction('selected-to-soul');assert.equal(p.rear[0],null);assert.equal(p.soul[0].uid,'rear');
  p.hand.push({uid:'hand',cardId:'unit'});c.match.selected='hand';c.manualGameAction('selected-to-soul');assert.equal(p.hand.length,0);assert.equal(p.soul[1].uid,'hand');
});
