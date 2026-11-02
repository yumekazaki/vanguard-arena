const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync(require.resolve('./arena-mobile-interface.js'), 'utf8');

class Target {
  constructor() { this.events = new Map(); }
  addEventListener(type, handler) { if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(handler); }
  removeEventListener(type, handler) { this.events.get(type)?.delete(handler); }
  emit(type, event={}) { for(const handler of this.events.get(type)||[])handler({type,...event}); }
  listenerCount() { return [...this.events.values()].reduce((n,set)=>n+set.size,0); }
}
class Node extends Target {
  constructor(tag='div') { super();this.tag=tag;this.children=[];this.attributes={};this.open=false;this.classes=new Set();this.classList={contains:x=>this.classes.has(x)};this.props={};this.style={setProperty:(k,v)=>this.props[k]=v,removeProperty:k=>delete this.props[k]}; }
  append(...nodes) { for(const node of nodes){node.remove();node.parent=this;this.children.push(node);} }
  before(node) { node.remove();const i=this.parent.children.indexOf(this);node.parent=this.parent;this.parent.children.splice(i,0,node); }
  remove() { if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);this.parent=null;} }
  replaceWith(node) { const parent=this.parent;node.remove();const i=parent.children.indexOf(this);parent.children.splice(i,1,node);node.parent=parent;this.parent=null; }
  setAttribute(k,v) { this.attributes[k]=v; }
  removeAttribute(k) { delete this.attributes[k]; }
  replaceChildren(...nodes) { this.children.slice().forEach(node=>node.remove());this.append(...nodes); }
  querySelectorAll(selector) { return selector==='[id]'?this.children.filter(node=>node.attributes.id):[]; }
  cloneNode() { const node=new Node(this.tag);node.attributes={...this.attributes};node.textContent=this.textContent;node.append(...this.children.map(child=>child.cloneNode(true)));return node; }
  showModal() { this.open=true; }
  close() { this.open=false; }
  get childNodes() { return this.children; }
}
function harness(enabled=false) {
  const body=new Node('body'),bar=new Node('toolbar'),grid=new Node('grid'),search=new Node('aside'),inspector=new Node('content');
  grid.append(search);body.append(bar,grid);
  const field=new Node('input');field.value='unsaved filter';search.append(field);
  const copy=new Node('copy');copy.setAttribute('id','original-copy');copy.textContent='Long ability text';inspector.append(copy);
  if(enabled)body.classes.add('mobile-mode');
  const document=new Target();document.body=body;document.createElement=tag=>new Node(tag);
  document.querySelector=selector=>({'.topbar-right':bar,'.visual-workshop .card-browser':search,'.active-view .card-inspector .inspector-content':inspector}[selector]||null);
  document.querySelectorAll=selector=>selector==='.card-inspector .inspector-content'?[inspector]:[];
  const window=new Target();window.innerHeight=844;window.visualViewport=new Target();Object.assign(window.visualViewport,{height:844,offsetTop:0});
  const observers=[];
  class Observer { constructor(callback){this.callback=callback;observers.push(this);}observe(node){this.node=node;}disconnect(){this.disconnected=true;} }
  const state={view:'decks',deck:{cards:{one:4},name:'Unsaved'},selection:'selected-card',turn:5};
  const c={document,window,MutationObserver:Observer,Date,Math,gameState:state};vm.createContext(c);vm.runInContext(script,c);
  const sync=()=>observers.find(observer=>observer.node===body).callback();
  const mode=on=>{on?body.classes.add('mobile-mode'):body.classes.delete('mobile-mode');sync();};
  return {body,bar,grid,search,field,inspector,document,window,observers,state,mode,sync};
}
test('Mobile Mode OFF creates no controls or input listeners even on phone-sized viewports',()=>{
  const h=harness();
  assert.equal(h.bar.children.length,0);assert.equal(h.body.children.length,2);
  assert.equal(h.document.listenerCount(),0);assert.equal(h.window.listenerCount(),0);
  assert.deepEqual(h.body.props,{});assert.equal(h.grid.children[0],h.search);
});
test('toggle lifecycle is reversible and retains original search fields and values',()=>{
  const h=harness();h.mode(true);h.sync();
  assert.equal(h.bar.children.length,1);assert.equal(h.grid.children[0].tag,'details');
  assert.equal(h.field.value,'unsaved filter');
  h.mode(false);
  assert.equal(h.bar.children.length,0);assert.equal(h.body.children.length,2);
  assert.equal(h.grid.children[0],h.search);assert.equal(h.field.value,'unsaved filter');
  assert.equal(h.document.listenerCount(),0);assert.equal(h.window.visualViewport.listenerCount(),0);
  assert.deepEqual(h.body.props,{});
  h.mode(true);assert.equal(h.bar.children.length,1);
});
test('portrait, landscape and keyboard resizing only update viewport presentation',()=>{
  const h=harness(true),before=JSON.stringify(h.state),field=h.field;
  for(const [height,innerHeight,offsetTop] of [[667,667,0],[375,375,0],[390,390,0],[932,932,0],[412,412,0],[320,844,20]]){
    Object.assign(h.window.visualViewport,{height,offsetTop});h.window.innerHeight=innerHeight;
    h.window.visualViewport.emit('resize');
    assert.equal(h.body.props['--arena-mobile-height'],height+'px');
    assert.equal(h.body.props['--arena-mobile-top'],offsetTop+'px');
    assert.equal(h.field,field);assert.equal(h.field.value,'unsaved filter');
    assert.equal(JSON.stringify(h.state),before);
  }
  assert.equal(h.body.props['--arena-mobile-bottom'],'504px');
});
test('Card info is read-only, strips copied IDs, and its source remains untouched',()=>{
  const h=harness(true);h.bar.children[0].emit('click');
  const dialog=h.body.children.find(node=>node.tag==='dialog');assert.equal(dialog.open,true);
  const content=dialog.children[1];assert.equal(content.children[0].attributes.id,undefined);
  assert.equal(h.inspector.children[0].attributes.id,'original-copy');
  h.mode(false);assert.equal(dialog.open,false);assert.equal(dialog.parent,null);
});
function gesture(h,kind='touch',move=0,detail=1) {
  const card={},target={closest:()=>card},event={pointerType:kind,pointerId:1,target,clientX:10,clientY:10};
  h.document.emit('pointerdown',event);h.document.emit('pointermove',{...event,clientY:10+move});h.document.emit('pointerup',event);
  let prevented=false,stopped=false;
  h.document.emit('click',{target,detail,preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
  return {prevented,stopped};
}
test('a touch scroll cannot activate its card, while ordinary taps and mouse clicks pass through',()=>{
  assert.deepEqual(gesture(harness(true),'touch',50),{prevented:true,stopped:true});
  assert.equal(gesture(harness(true),'touch',0).prevented,false);
  assert.equal(gesture(harness(true),'mouse',50).prevented,false);
  assert.equal(gesture(harness(true),'touch',50,0).prevented,false);
  assert.equal(gesture(harness(false),'touch',50).prevented,false);
});
test('multi-touch is never prevented or converted into a single-card drag',()=>{
  const h=harness(true),card={},target={closest:()=>card};let prevented=false;
  const event={pointerType:'touch',target,clientX:0,clientY:0,preventDefault(){prevented=true}};
  h.document.emit('pointerdown',{...event,pointerId:1});h.document.emit('pointerdown',{...event,pointerId:2});
  h.document.emit('pointermove',{...event,pointerId:1,clientX:100});h.document.emit('pointerup',{...event,pointerId:1});h.document.emit('pointerup',{...event,pointerId:2});
  h.document.emit('click',{target,detail:1,preventDefault(){prevented=true},stopImmediatePropagation(){}});
  assert.equal(prevented,false);
});
test('every CSS selector, including inside orientation/size queries, requires Mobile Mode',()=>{
  const css=fs.readFileSync(require.resolve('./arena-mobile-interface.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const stack=[];let text='';let count=0;
  for(const token of css.split(/([{}])/)){
    if(token==='{'){
      const header=text.trim();text='';
      if(header.startsWith('@media'))stack.push('media');
      else{for(const selector of header.split(','))assert.ok(selector.trim().startsWith('body.mobile-mode'),selector);stack.push('rule');count++;}
    }else if(token==='}'){assert.ok(stack.pop());text='';}else text+=token;
  }
  assert.equal(stack.length,0);assert.ok(count>50);
  assert.doesNotMatch(css,/user-scalable|touch-action\s*:\s*none/);
});
