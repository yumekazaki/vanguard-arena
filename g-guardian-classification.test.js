const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require.resolve('./app.js'), 'utf8');
const c = {window:{}};
vm.createContext(c);
for (const name of ['isGDeckCard', 'isGGuardian', 'isStrideUnit']) {
  const start = app.indexOf('function '+name+'(');
  vm.runInContext(app.slice(start, app.indexOf('\n', start)), c);
}
vm.runInContext(fs.readFileSync(require.resolve('./assets/cards/catalog-data.js'), 'utf8'), c);
const cards = c.window.CARD_CATALOG;

test('Ichikishima remains a stride unit despite mentioning G guardian', () => {
  const card = cards.find(x=>x.name==='Still Water Festival Deity, Ichikishima');
  assert.ok(card);
  assert.equal(c.isGGuardian(card), false);
  assert.equal(c.isStrideUnit(card), true);
});

test('every catalog grade 4 G unit is classified by printed power and shield', () => {
  const units = cards.filter(x=>c.isGDeckCard(x)&&Number(x.grade)===4);
  assert.ok(units.length>100);
  let guardians=0, mentionedStrides=0;
  for(const card of units) {
    const guardian=Number(card.power||0)===0&&Number(card.shield||0)>0;
    assert.equal(c.isGGuardian(card), guardian, card.name);
    if(guardian) guardians++;
    if(Number(card.power)>0&&/g.guardian/i.test(card.text)) {
      mentionedStrides++;
      assert.equal(c.isStrideUnit(card),true,card.name);
    }
  }
  assert.ok(guardians>0);
  assert.ok(mentionedStrides>0);
});

test('text references cannot override stats or turn ordinary units into G guardians', () => {
  const unit={type:'G Unit',grade:4,text:'Choose a G guardian',power:'15000+',shield:null};
  assert.equal(c.isGGuardian(unit),false);
  assert.equal(c.isGGuardian({...unit,power:null,shield:'15000'}),true);
  assert.equal(c.isGGuardian({...unit,power:0,shield:0}),false);
  assert.equal(c.isGGuardian({...unit,type:'Unit',power:0,shield:15000}),false);
  assert.equal(c.isGGuardian(null),false);
});
