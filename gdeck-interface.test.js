"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Engine = require("./ability-engine.js");
const Projection = require("./match-state-projection.js");
const app = fs.readFileSync(require.resolve("./app.js"), "utf8");
const section = (start, end) => app.slice(app.indexOf("  function " + start), app.indexOf("  function " + end));
function harness() {
  const cards = new Map([
    ["starter", { id:"starter", name:"Starter", grade:0, type:"Unit" }],
    ["main", { id:"main", name:"Main", grade:1, type:"Unit" }],
    ["g", { id:"g", name:"G Unit", grade:4, type:"G Unit", text:"Stride" }]
  ]);
  const requests = [];
  const context = {
    window:{ VanguardAbilityEngine:Engine }, crypto:{randomUUID:()=>"player"},
    cardMap:cards, isGDeckCard:c=>c?.type==="G Unit", isUnitCard:c=>c?.type==="Unit",
    match:null, online:{role:null}, selectedHandCard:()=>null, toast:()=>{}, addLog:()=>{},
    renderMatch:()=>{}, sendGuestRequest:(type,payload)=>requests.push({type,payload}),
    $:()=>({close(){}}), requests
  };
  vm.createContext(context);
  vm.runInContext(section("cardInstances(", "openPracticeSetup(") + section("manualGameAction(", "flipSide(") + section("performManualAction(", "exportDeck("), context);
  const deck = { cards:{starter:1,main:49,g:4}, starterCardId:"starter" };
  context.match = { players:{human:context.makePlayer(deck,"Player",true),bot:{playerId:"opponent",gDeck:[]}}, phase:0, side:"human" };
  return context;
}
test("practice and peer-host bootstrap start all G cards face down without mixing them into the main deck", () => {
  const c=harness(), p=c.match.players.human;
  assert.equal(p.gDeck.length,4); assert.ok(p.gDeck.every(x=>x.faceUp===false));
  assert.equal(p.deck.length,44); assert.equal(p.hand.length,5);
  assert.equal(p.vanguard.cardId,"starter");
});
test("temporary G reveal and closing it preserve every card and its face-down state", () => {
  const c=harness(),p=c.match.players.human,uid=p.gDeck[0].uid,before=JSON.stringify(p.gDeck);
  c.manualGameAction("gdeck-reveal:"+uid);
  assert.equal(c.match.publicReveal.instance.cardId,"g");
  assert.notEqual(c.match.publicReveal.instance,p.gDeck[0]);
  assert.equal(JSON.stringify(p.gDeck),before); assert.equal(p.gZone.length,0);
  const guest=Projection.projectForPlayer(c.match,"opponent");
  assert.equal(guest.publicReveal.instance.cardId,"g");
  assert.ok(guest.players.human.gDeck.every(x=>x.cardId===null));
  c.manualGameAction("public-reveal-close");
  assert.equal(c.match.publicReveal,null); assert.equal(JSON.stringify(p.gDeck),before);
});
test("explicit flip moves only the chosen G card face up into the public G zone", () => {
  const c=harness(),p=c.match.players.human,uid=p.gDeck[1].uid;
  c.manualGameAction("gdeck-flip-up:"+uid);
  assert.equal(p.gDeck.length,3); assert.ok(p.gDeck.every(x=>x.faceUp===false));
  assert.equal(p.gZone.length,1); assert.equal(p.gZone[0].uid,uid); assert.equal(p.gZone[0].faceUp,true);
  assert.equal(Projection.projectForPlayer(c.match,"opponent").players.human.gZone[0].cardId,"g");
  c.manualGameAction("gdeck-flip-up:"+uid);
  assert.equal(p.gZone.length,1);
});
test("online guests route G reveal, close, and flip through the existing host action channel", () => {
  const c=harness(),p=c.match.players.human,uid=p.gDeck[0].uid;
  c.online={role:"guest",connection:{open:true}};
  for(const action of ["gdeck-reveal:"+uid,"public-reveal-close","gdeck-flip-up:"+uid]) c.performManualAction(action);
  assert.equal(c.requests.length,3);
  assert.equal(c.requests[0].payload.action,"manual:gdeck-reveal:"+uid);
  assert.equal(c.requests[2].payload.action,"manual:gdeck-flip-up:"+uid);
  assert.equal(p.gDeck.length,4); assert.equal(p.gZone.length,0);
});
test("fresh face-down G Units can enter the existing Stride cost flow and face-up units cannot", () => {
  const c=harness(),p=c.match.players.human,uid=p.gDeck[0].uid;
  c.match.phase=3; c.canStrideForSide=()=>true; c.isStrideUnit=card=>card?.type==="G Unit";
  c.renderStrideCostDialog=()=>{};
  c.manualGameAction("stride:"+uid);
  assert.equal(c.match.pendingStride.unitUid,uid);
  assert.equal(c.match.pendingStride.ownerSide,"human");
  assert.equal(p.gDeck.length,4);
  c.match.pendingStride=null; p.gDeck[0].faceUp=true;
  c.manualGameAction("stride:"+uid);
  assert.equal(c.match.pendingStride,null);
});
