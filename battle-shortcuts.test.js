"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const app=fs.readFileSync(require.resolve("./app.js"),"utf8");
function controls() {
  const calls=[],c={match:{side:"human",players:{human:{hand:[{uid:"hand1"}]}}},online:{role:null},window:{VanguardHand:{open:x=>calls.push(["open",x]),syncDefense:x=>calls.push(["sync",x])}},performOnlineAction:x=>calls.push(["action",x]),calls};
  vm.createContext(c);vm.runInContext(app.slice(app.indexOf("  function canUseCenterPhase("),app.indexOf("  function humanGuard(")),c);
  return c;
}
test("center phase shortcut is available only to the current player with no pending decisions",()=>{
  const c=controls();assert.equal(c.canUseCenterPhase(),true);
  c.match.side="bot";assert.equal(c.canUseCenterPhase(),false);c.match.side="human";
  c.online.role="watcher";assert.equal(c.canUseCenterPhase(),false);c.online.role="guest";assert.equal(c.canUseCenterPhase(),true);
  for(const key of ["ended","preMatch","pendingAttack","pendingTurnEnd","pendingAbility","pendingTrigger","practiceOpeningChoicePending"]){c.match[key]=true;assert.equal(c.canUseCenterPhase(),false,key);delete c.match[key];}
  c.match.pendingAbilities=[{}];assert.equal(c.canUseCenterPhase(),false);
  c.match.pendingAbilities=[];c.online.remoteRequestPending="request";assert.equal(c.canUseCenterPhase(),false);
});
test("Guard opens a defense-only hand without immediately guarding a stale selected card",()=>{
  const c=controls();c.match.pendingAttack={defenderSide:"human",defenderDone:false};c.match.selected="stale";
  c.openGuardHand();assert.equal(c.calls.at(-1)[0],"open");assert.equal(c.calls.at(-1)[1].guarding,true);
  assert.equal(c.calls.some(x=>x[0]==="action"),false);
  c.match.pendingAttack.defenderDone=true;const count=c.calls.length;c.openGuardHand();assert.equal(c.calls.length,count);
});
test("a card selected in guard mode uses the existing guard action and validates ownership",()=>{
  const c=controls();c.match.pendingAttack={defenderSide:"human",defenderDone:false};
  c.guardFromHand("other-player-card");assert.equal(c.calls.length,0);
  c.guardFromHand("hand1");assert.equal(c.match.selected,"hand1");assert.equal(c.calls[0][1],"guard");
  c.calls.length=0;c.online.remoteRequestPending="request";c.guardFromHand("hand1");assert.equal(c.calls.length,0);
});
test("defense hand mode cannot act for an attacker, spectator, completed defense, or pending skill",()=>{
  const c=controls();c.match.pendingAttack={defenderSide:"bot",defenderDone:false};assert.equal(c.handDefenseState().active,false);
  c.match.pendingAttack.defenderSide="human";c.online.role="watcher";assert.equal(c.handDefenseState().active,false);
  c.online.role="guest";c.match.pendingAbility={};assert.equal(c.handDefenseState().active,true);assert.equal(c.handDefenseState().canFinish,false);
});
test("supplied token images are registered with their correct shield values",()=>{
  const cardMap=new Map(),c={cardMap};vm.createContext(c);
  const lines=app.split("\n").filter(x=>x.includes('cardMap.set("token-'));
  vm.runInContext(lines.join("\n"),c);
  for(const [id,shield] of [["token-quick-shield",5000],["token-guardian-shield",20000],["token-protect",0]]){
    const card=cardMap.get(id);assert.equal(card.shield,shield);assert.ok(fs.existsSync(require("node:path").join(__dirname,card.image)));
  }
});
