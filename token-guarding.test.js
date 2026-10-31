"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Engine = require('./ability-engine.js');
const app = fs.readFileSync(require.resolve('./app.js'), 'utf8');

function setup(tokenId, remote = false) {
  const cardMap = new Map();
  const dialog = { open: false, dataset: {}, showModal() { this.open = true; } };
  const list = { innerHTML: '' }, messages = [];
  const token = { uid: 'token', cardId: tokenId, isToken: true };
  const cost = { uid: 'cost', cardId: 'cost' };
  const c = {
    cardMap, online: { applyingRemote: remote }, window: { VanguardAbilityEngine: Engine },
    match: { selected: token.uid, players: { human: { name: 'Defender', hand: [token, cost], guardCircle: [], drop: [] }, bot: {} }, pendingAttack: { defenderSide: 'human', attackerSide: 'bot', attackerZone: 'rear-0', targetPower: 8000, attackPower: 999999, guardCards: [] } },
    cardAbilities: card => Engine.parseCardAbilitiesCached(card), flipSide: s => s === 'human' ? 'bot' : 'human', gradeOf: card => Number(card?.grade || 0), generationBreakCount: () => 0,
    $: selector => selector === '#protect-discard-dialog' ? dialog : list,
    selectedHandCard: () => c.match.players.human.hand.find(x => x.uid === c.match.selected),
    toast: text => messages.push(text), addLog: text => messages.push(text),
    escapeHtml: x => x, cardImage: () => '', queueMovedCardAbility() {}, queueAbilityPrompts() {}, renderMatch() {}, setMessage() {}, attackHits: () => true,
    dialog, list, messages, token, cost
  };
  vm.createContext(c);
  vm.runInContext(app.split('\n').filter(x => x.includes('cardMap.set("token-') || x.startsWith('  function isSentinel(') || x.startsWith('  function effectiveShieldValue(')).join('\n'), c);
  cardMap.set('cost', { id: 'cost', name: 'Discard cost', shield: 5000 });
  vm.runInContext(app.slice(app.indexOf('  function humanGuard('), app.indexOf('  function canStrideForSide(')), c);
  return c;
}

test('Protect opens the perfect-guard discard prompt without consuming cards first', () => {
  const c = setup('token-protect');
  c.humanGuard();
  assert.equal(c.dialog.open, true);
  assert.match(c.list.innerHTML, /data-protect-cost="cost"/);
  assert.doesNotMatch(c.list.innerHTML, /data-protect-cost="token"/);
  assert.equal(c.match.players.human.hand.length, 2);
  assert.equal(c.match.pendingAttack.perfectGuard, undefined);
});

test('Protect discards a different card and stops an attack regardless of power', () => {
  const c = setup('token-protect');
  c.resolveProtectGuard('token', 'cost');
  assert.equal(c.match.players.human.hand.length, 0);
  assert.equal(c.match.players.human.drop[0].uid, 'cost');
  assert.equal(c.match.players.human.guardCircle[0].uid, 'token');
  assert.equal(c.match.pendingAttack.perfectGuard, true);
  assert.equal(c.match.pendingAttack.blocked, true);
  assert.equal(c.match.pendingAttack.defenderDone, true);
});

test('Protect cannot pay its own discard cost or activate without another card', () => {
  const c = setup('token-protect');
  c.resolveProtectGuard('token', 'token');
  assert.equal(c.match.players.human.hand.length, 2);
  c.match.players.human.hand = [c.token];
  c.humanGuard();
  assert.equal(c.dialog.open, false);
  assert.equal(c.match.pendingAttack.perfectGuard, undefined);
});

test('remote Protect guard requests create the existing owner payment decision', () => {
  const c = setup('token-protect', true);
  c.humanGuard();
  assert.equal(c.match.pendingProtectGuard.ownerSide, 'human');
  assert.equal(c.match.pendingProtectGuard.markerUid, 'token');
  assert.equal(c.dialog.open, false);
  c.resolveProtectGuard('token', 'cost');
  assert.equal(c.match.pendingProtectGuard, null);
  assert.equal(c.match.pendingAttack.blocked, true);
});

test('Guardian Shield adds exactly 20,000 shield through the normal guard action', () => {
  const c = setup('token-guardian-shield');
  c.humanGuard();
  assert.equal(c.match.pendingAttack.targetPower, 28000);
  assert.equal(c.match.players.human.guardCircle[0].uid, 'token');
  assert.equal(c.match.players.human.hand.length, 1);
  assert.equal(c.dialog.open, false);
  assert.equal(c.match.pendingAttack.perfectGuard, undefined);
});
