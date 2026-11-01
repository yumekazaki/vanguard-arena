const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('./app.js'),'utf8');
class Node {
  constructor(){this.dataset={};this.children=[];this.classes=new Set();this.classList={add:x=>this.classes.add(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};this.props={};this.style={setProperty:(k,v)=>this.props[k]=v};this.parts={};this.open=false;}
  querySelector(s){return this.parts[s]||=(new Node());}
  append(...items){for(const item of items){this.children.push(item);item.parentElement=this;}}
  before(){} setAttribute(){} addEventListener(){} close(){this.open=false} showModal(){this.open=true}
}
function harness(){
  const down={human:new Node(),bot:new Node()},up={},lines={},nodes={};
  const document={createElement:()=>new Node(),body:new Node(),querySelector:s=>{
    if(s.startsWith('.gdeck-button'))return down[s.includes('human')?'human':'bot'];
    return lines[s.includes('human')?'human':'bot'];
  }};
  const c={window:{},document};vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('./arena-zone-piles.js'),'utf8'),c);
  for(const side of ['human','bot']){up[side]=down[side].parentElement.children[1];lines[side]=new Node();Object.assign(lines[side].parts,{'.deck-zone':new Node(),'.drop-zone':new Node(),'[data-gdeck-side]':down[side],'[data-faceup-side]':up[side]});}
  c.$=s=>nodes[s]||=(new Node());c.cardMap=new Map([['g',{id:'g',name:'G Unit',type:'G Unit'}],['guard',{id:'guard',name:'G Guardian',type:'G Guardian'}]]);
  c.isGGuardian=card=>card.type==='G Guardian';c.escapeHtml=x=>x;c.cardImage=card=>card.name;c.online={role:null};
  const player=()=>({gDeck:[{uid:'down',cardId:'g',faceUp:false},{uid:'old',cardId:'g',faceUp:true}],gZone:[{uid:'guardian',cardId:'guard',faceUp:true}],drop:[{uid:'drop1',cardId:'g'}]});
  c.match={matchId:'test',players:{human:player(),bot:player()}};
  vm.runInContext(app.slice(app.indexOf('  function openFaceUpGDeck('),app.indexOf('  function openGDeckDialog(')),c);
  return {c,down,up,lines};
}
test('piles combine public face-up G zones while keeping face-down cards separate',()=>{
  const {c,down,up}=harness(),before=JSON.stringify(c.match);
  c.window.VanguardZonePiles.render(c.match,id=>id+'.jpg');
  assert.equal(down.human.querySelector('b').textContent,1);assert.equal(up.human.querySelector('b').textContent,2);
  assert.match(down.human.props['--zone-art'],/vanguard-card-back/);
  assert.equal(JSON.stringify(c.match),before,'rendering never changes game state');
});
test('Drop and face-up G-deck artwork track the latest added card',()=>{
  const {c,up,lines}=harness(),render=()=>c.window.VanguardZonePiles.render(c.match,id=>id+'.jpg');render();
  c.match.players.human.drop.push({uid:'drop2',cardId:'guard'});
  c.match.players.human.gZone.push({uid:'new',cardId:'guard',faceUp:true});render();
  assert.match(lines.human.querySelector('.drop-zone').props['--zone-art'],/guard.jpg/);
  assert.match(up.human.props['--zone-art'],/guard.jpg/);
  c.match.players.human.gDeck.push({uid:'newer',cardId:'g',faceUp:true});render();assert.match(up.human.props['--zone-art'],/g.jpg/);
});
test('Standard retains its single Ride Deck control',()=>{
  const {c,down,up}=harness();Object.assign(c.match.players.human,{format:'standard',rideDeck:[{}, {}, {}]});
  c.window.VanguardZonePiles.render(c.match,()=>null);
  assert.equal(up.human.hidden,true);assert.equal(down.human.querySelector('b').textContent,3);assert.equal(down.human.querySelector('small').textContent,'RIDE DECK');
});
test('face-up G Units have only three actions; G Guardians only Bind; zoom stays separate',()=>{
  const {c}=harness();c.openFaceUpGDeck('human');const html=c.$('#faceup-gdeck-list').innerHTML;
  const articles=html.split('<article').slice(1);
  const guardian=articles.find(x=>x.includes('G Guardian')),unit=articles.find(x=>x.includes('G Unit'));
  assert.match(guardian,/data-zone-card-zoom|zone-card-zoom/);assert.match(guardian,/>Bind</);assert.doesNotMatch(guardian,/Superior Ride|Superior Call/);
  assert.match(unit,/Superior Ride/);assert.match(unit,/Superior Call/);assert.match(unit,/>Bind</);
  assert.equal((unit.match(/class="button"/g)||[]).length,3);assert.equal((guardian.match(/class="button"/g)||[]).length,1);
  c.openFaceUpGDeck('bot');assert.doesNotMatch(c.$('#faceup-gdeck-list').innerHTML,/data-superior-|data-zone-move/);
});
