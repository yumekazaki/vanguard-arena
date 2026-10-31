"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { createChat, MAX_MESSAGES } = require("./arena-chat.js");
let serial=0;
const make = () => createChat({makeId:()=>"message-"+(++serial),now:()=>1700000000000});
const session = (role, send = () => true) => ({ role,sessionId:"private-room",matchId:"match-1",connected:true,send,opponentName:"Opponent" });
test("only online host and guest sessions expose chat", async () => {
  const c=make();
  for(const role of [null,"watcher","host-watcher"]) {c.setSession(session(role));assert.equal(c.getState().visible,false);assert.equal(await c.send("hello"),false);}
  c.setSession(session("host")); assert.equal(c.getState().visible,true);
  c.setSession(session("guest")); assert.equal(c.getState().visible,true);
  c.setSession({...session("host"),matchId:""}); assert.equal(c.getState().visible,false);
});
test("two connected players can exchange messages without a match action envelope", async () => {
  const host=make(), guest=make(), packets=[];
  host.setSession(session("host",m=>{packets.push(m);guest.receive(m);return true}));
  guest.setSession(session("guest",m=>{packets.push(m);host.receive(m);return true}));
  assert.equal(await host.send("Hello from host"),true);
  assert.equal(await guest.send("Hello from guest"),true);
  assert.deepEqual(host.getState().messages.map(m=>[m.text,m.own]),[["Hello from host",true],["Hello from guest",false]]);
  assert.deepEqual(guest.getState().messages.map(m=>[m.text,m.own]),[["Hello from host",false],["Hello from guest",true]]);
  assert.ok(packets.every(m=>m.type==="table-chat"&&!m.action&&!m.match));
});
test("malformed, oversized, duplicate, and cross-match messages are ignored", () => {
  const c=make();c.setSession(session("host"));
  const valid={type:"table-chat",id:"valid",matchId:"match-1",text:"hello"};
  for(const m of [null,{}, {...valid,matchId:"old-match"},{...valid,text:""},{...valid,text:"x".repeat(501)},{...valid,id:"<script>"}]) assert.equal(c.receive(m),false);
  assert.equal(c.receive(valid),true);assert.equal(c.receive(valid),false);
  assert.equal(c.getState().messages.length,1);
});
test("failed sends retain an error and do not add a misleading delivered message", async () => {
  const c=make();c.setSession(session("guest",async()=>false));
  assert.equal(await c.send("retry me"),false);assert.equal(c.getState().messages.length,0);
  assert.match(c.getState().notice,/not sent/);
  c.setSession({...session("guest"),connected:false});
  assert.equal(await c.send("disconnected"),false);
});
test("reconnect preserves this match's history while changing rooms or going offline clears it", async () => {
  const c=make();c.setSession(session("host"));await c.send("history");
  c.setSession({...session("host"),connected:false});assert.equal(c.getState().messages.length,1);
  c.setSession(session("host"));assert.equal(c.getState().messages.length,1);
  c.setSession({...session("host"),sessionId:"new-room"});assert.equal(c.getState().messages.length,0);
  await c.send("new");c.setSession({});assert.equal(c.getState().messages.length,0);
});
test("late completion from an old match cannot add messages to a new room", async () => {
  let finish; const c=make();c.setSession(session("host",()=>new Promise(resolve=>{finish=resolve})));
  const pending=c.send("old");c.setSession({...session("host"),matchId:"new-match"});finish(true);
  assert.equal(await pending,false);assert.equal(c.getState().messages.length,0);
});
test("history is bounded and text is kept as plain data", () => {
  const c=make();c.setSession(session("guest"));
  for(let i=0;i<MAX_MESSAGES+5;i++)c.receive({type:"table-chat",matchId:"match-1",id:"item-"+i,text:i===MAX_MESSAGES+4?"<img src=x onerror=alert(1)>":"message "+i});
  assert.equal(c.getState().messages.length,MAX_MESSAGES);
  assert.equal(c.getState().messages[0].text,"message 5");
  assert.equal(c.getState().messages.at(-1).text,"<img src=x onerror=alert(1)>");
});
test("the app routes chat separately before any gameplay action handling", () => {
  const fs=require("node:fs"),vm=require("node:vm"),app=fs.readFileSync(require.resolve("./app.js"),"utf8");
  let received=null,updates=0;
  const c={updateOnlineChat:()=>updates++,window:{VanguardTableChat:{controller:{receive:m=>{received=m}}}},match:{stateVersion:42}};
  vm.createContext(c);
  vm.runInContext(app.slice(app.indexOf("  function handleRemoteMessage("),app.indexOf("  function bindOnlineConnection(")),c);
  const message={type:"table-chat",id:"test",text:"hello"};
  c.handleRemoteMessage(message);
  assert.equal(received,message);assert.equal(updates,1);assert.equal(c.match.stateVersion,42);
});
