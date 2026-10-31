const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Engine = require('./ability-engine.js');
const app = fs.readFileSync(require.resolve('./app.js'), 'utf8');
function setup() {
  const cardMap = new Map([0,1,2,3].map(grade => [`g${grade}`, { id:`g${grade}`, grade, type:'Unit' }]));
  cardMap.set('other', { id:'other', grade:1, type:'Unit' });
  const c = { cardMap, isGDeckCard: card => /G Unit|G Guardian/.test(card?.type || ''), isUnitCard: card => card?.type === 'Unit', crypto: require('node:crypto'), profileAvatars: [], window:{ VanguardAbilityEngine:Engine } };
  vm.createContext(c);
  vm.runInContext(app.slice(app.indexOf('  function deckCount('), app.indexOf('  function rideDeckOptions(')), c);
  const playerEnd = app.indexOf('\n  }', app.indexOf('  function makePlayer(')) + 4;
  vm.runInContext(app.slice(app.indexOf('  function cardInstances('), playerEnd), c);
  return c;
}
function deck(total, format = 'standard') {
  return { format, cards:{ g0:1, g1:1, g2:1, g3:1, other:total-4 }, rideDeck:['g0','g1','g2','g3'], starterCardId:'g0' };
}
test('Standard requires 54 total cards and four valid selected ride cards', () => {
  const c=setup();
  assert.equal(c.deckReadyErrors(deck(54)).length,0);
  assert.ok(c.deckReadyErrors(deck(50)).some(error=>error.includes('50/54')));
  assert.ok(c.deckReadyErrors(deck(55)).some(error=>error.includes('55/54')));
  const missing=deck(54); missing.rideDeck.pop();
  assert.ok(c.deckReadyErrors(missing).some(error=>error.includes('Grade 3')));
});
test('Premium continues to require 50 cards', () => {
  const c=setup();
  assert.equal(c.deckReadyErrors(deck(50,'premium')).length,0);
  assert.ok(c.deckReadyErrors(deck(54,'premium')).some(error=>error.includes('54/50')));
});
test('Standard setup separates four ride cards, leaving a 50-card main deck', () => {
  const c=setup(), player=c.makePlayer(deck(54),'Player');
  assert.equal(player.deck.length+player.hand.length,50);
  assert.equal(player.hand.length,5);
  assert.equal(player.vanguard.cardId,'g0');
  assert.deepEqual(Array.from(player.rideDeck,card=>card.cardId).sort(),['g1','g2','g3']);
});
