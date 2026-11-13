"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("arena-attack-gesture.js", "utf8"), context);
const choose = context.window.VanguardAttackGesture.targetAction;

test("drag attack uses the exact same legal choice exposed by the attack prompt", () => {
  const setup = { stage: "target", attackerUid: "attacker-1" };
  const gesture = { attackerUid: "attacker-1", targetUid: "target-1", zone: "vanguard" };
  const choices = [{ value: "target:vanguard:target-1" }];
  assert.equal(choose(setup, gesture, choices), "attack-choice:target:vanguard:target-1");
});

test("attack gesture refuses wrong attackers, unresolved boost windows, and illegal targets", () => {
  const target = { attackerUid: "attacker-1", targetUid: "target-1", zone: "rear-left" };
  const legal = [{ value: "target:rear-left:target-1" }];
  assert.equal(choose({ stage: "boost", attackerUid: "attacker-1" }, target, legal), null);
  assert.equal(choose({ stage: "target", attackerUid: "attacker-2" }, target, legal), null);
  assert.equal(choose({ stage: "target", attackerUid: "attacker-1" }, target, []), null);
});
