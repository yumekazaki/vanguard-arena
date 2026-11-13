"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

function functionSource(source,startName,endName){
  const start=source.indexOf(startName),end=source.indexOf(endName,start);
  assert.ok(start>=0&&end>start,"expected function boundaries");
  return source.slice(start,end);
}
test("Guardian Circle shows each guardian plus the attack and defense comparison",()=>{
  const source=fs.readFileSync("app.js","utf8");
  const guardSource=functionSource(source,"function renderGuardCircle(player)","function renderCrests");
  const guard={uid:"guard-1",cardId:"shield-card"};
  const player={guardCircle:[guard]};
  const context={
    match:{players:{human:player},pendingAttack:{defenderSide:"human",power:30000,targetPower:13000,perfectGuard:false}},
    cardMap:new Map([["shield-card",{name:"Shield Unit"}]]),
    effectiveShieldValue:()=>5000,
    escapeHtml:value=>String(value),
  };
  vm.runInNewContext(guardSource+";globalThis.render=renderGuardCircle;",context);
  const html=context.render(player);
  assert.match(html,/5,000 shield · 1 card/);
  assert.match(html,/12,000 more needed/);
  assert.match(html,/Attack 30,000 vs unit 13,000 \+ shield 5,000 = 18,000 defense/);
  assert.match(html,/Shield Unit/);
  assert.match(html,/\+5,000/);
});
test("damage cards receive a larger readable size on both desktop and phone layouts",()=>{
  const css=fs.readFileSync("arena-battlefield.css","utf8");
  assert.match(css,/\.damage-track \.damage-card \{ width: clamp\(28px,3\.5vw,40px\); height: clamp\(40px,5vw,56px\)/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.damage-track \.damage-card \{ width: 28px; height: 40px; \}/);
});


test("damage viewer hides face-down card identities and offers resource actions only when available",()=>{
  const source=fs.readFileSync("app.js","utf8");
  const fn=functionSource(source,"function openDamageZone(","function renderDamageCards(");
  const nodes=new Map();
  const get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:"",innerHTML:"",open:false,showModal(){this.open=true}});return nodes.get(id)};
  const faceUp={uid:"face-up",cardId:"visible"};
  const faceDown={uid:"face-down",cardId:"secret",faceDown:true};
  const player={name:"Player",damage:[faceUp,faceDown]};
  const context={
    match:{players:{human:player},side:"human"},
    online:{role:null},
    cardMap:new Map([["visible",{id:"visible-id",name:"Visible Card"}],["secret",{id:"secret-id",name:"Hidden Card Name"}]]),
    cardImage:card=>"<img alt='"+card.name+"'>",
    escapeHtml:value=>String(value),
    toast(){},
    $:selector=>get(selector),
  };
  vm.runInNewContext(fn+";globalThis.open=openDamageZone;",context);
  context.open("human");
  assert.match(get("#damage-zone-help").textContent,/2\/6 damage · 1 face up · 1 face down/);
  assert.match(get("#damage-zone-card-list").innerHTML,/Visible Card/);
  assert.match(get("#damage-zone-card-list").innerHTML,/Face-down · identity hidden/);
  assert.doesNotMatch(get("#damage-zone-card-list").innerHTML,/Hidden Card Name|secret-id/);
  assert.match(get("#damage-zone-actions").innerHTML,/Counter-Blast · 1/);
  assert.match(get("#damage-zone-actions").innerHTML,/Counter-Charge · 1/);
});

test("phase feedback is a non-blocking banner and honors reduced motion",()=>{
  const source=fs.readFileSync("arena-visual-effects.js","utf8");
  const banner={hidden:true,text:"",style:{},classes:new Set(),classList:{add(name){banner.classes.add(name)},remove(name){banner.classes.delete(name)}},querySelector(){return{set textContent(value){banner.text=value}}}};
  const timers=[];
  const makeHarness=mode=>{
    const ctx={document:{querySelector:selector=>selector==="#phase-transition-flash"?banner:null,querySelectorAll:()=>[]},window:{VanguardAnimationSettings:{getMode:()=>mode,duration:value=>value}},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length},clearTimeout(){}};
    vm.runInNewContext(source,ctx);
    return ctx.window.VanguardArenaVisualEffects;
  };
  const match=(phase)=>({matchId:"match-1",phase,side:"human",players:{human:{name:"Player",rear:[]},bot:{name:"Opponent",rear:[]}}});
  let effects=makeHarness("normal");effects.afterRender(match(0));effects.afterRender(match(1));
  assert.equal(banner.hidden,false);assert.equal(banner.text,"Your Draw Phase");assert.equal(banner.classes.has("show"),true);
  assert.equal(timers.at(-1).delay,1050);
  banner.hidden=true;banner.classes.clear();effects=makeHarness("reduced");effects.afterRender(match(0));effects.afterRender(match(1));
  assert.equal(banner.hidden,false);assert.equal(banner.classes.has("show"),false);
});
