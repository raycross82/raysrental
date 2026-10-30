import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('out/quote/index.html','utf8');
const source=html.split('/* rr-agreement-handoff:start */')[1].split('/* rr-agreement-handoff:end */')[0];
function harness(mode='success') {
  const events=[], requests=[], timers=[], listeners={};
  const node=(value='')=>({value,hidden:false,textContent:'Send request',listeners:{},parentNode:{insertBefore(){}},setAttribute(){},focus(){this.focused=true;},setCustomValidity(v){this.error=v;},addEventListener(k,fn){this.listeners[k]=fn;}});
  const elements=Object.fromEntries(Object.entries({name:' QA Test ',phone:'2145550100',email:'',address:'',city:'Dallas',date:'2026-12-01',dropoffTiming:'Morning of the event',pickupTiming:'Morning after the event',fulfillment:'Free Pickup',package:'none','form-name':'quote'}).map(([k,v])=>[k,node(v)]));
  const quantities=Object.fromEntries(['tables','chairs','coolers','speakers'].map(k=>['q-'+k,node(k==='tables'?'5':k==='chairs'?'30':'0')]));
  const button=node(), error=node();
  const form={elements,querySelector:()=>button,reportValidity:()=>!!elements.name.value&&!elements.phone.error,addEventListener:(k,fn)=>listeners[k]=fn};
  const window={location:{href:''}};
  const context={window,document:{getElementById:id=>id==='quoteForm'?form:quantities[id],createElement:()=>error},Date,String,URLSearchParams,TextEncoder,TextDecoder,btoa,atob,AbortController,
    setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},gtag:(...a)=>events.push(a),
    FormData:class extends Map{constructor(){super(Object.entries(elements).map(([k,v])=>[k,v.value]));}},
    fetch:(url,options)=>{requests.push({url,options}); if(mode==='offline')return Promise.reject(new Error('offline'));if(mode==='http')return Promise.resolve({ok:false,status:500});if(mode==='pending')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));return Promise.resolve({ok:true});}};
  vm.runInNewContext(source,context);
  return {elements,quantities,button,error,window,requests,events,timers,submit:()=>listeners.submit({preventDefault(){}}),settle:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
const promo=harness().window.rrQuoteHandoff.promotion;
for(const [input,total,coolers,free] of [
 [{tables:5,chairs:30},120,1,true], [{tables:5,chairs:30,coolers:1},120,1,true], [{tables:5,chairs:30,coolers:2},138,2,true],
 [{chairs:40},100,1,true], [{tables:11},99,0,false], [{coolers:6},108,6,false],
 [{package:'Party for 60'},200,1,true], [{package:'Cookout for 60'},225,2,false], [{package:'The Whole Party'},250,2,false],
 [{package:'The Whole Party',coolers:1},268,3,false]]) {
 const p=promo(input);assert.equal(p.total,total);assert.equal(p.qty.coolers,coolers);assert.equal(p.freeCooler,free);
}
const happy=harness();happy.submit();happy.submit();await happy.settle();
assert.equal(happy.requests.length,1);assert.equal(happy.elements.name.value,'QA Test');
assert(happy.window.location.href.startsWith('/agreement/#q='));assert.equal(happy.events.filter(e=>e[1]==='generate_lead').length,1);
for(const mode of ['offline','http','pending']) {
 const h=harness(mode);h.submit();h.submit();assert.equal(h.requests.length,1);
 if(mode==='pending')h.timers[0]();await h.settle();
 assert.equal(h.window.location.href,'');assert.equal(h.elements.phone.value,'2145550100');assert(!h.error.hidden);assert(!h.button.disabled);assert.equal(h.events.length,0);
 h.submit();assert.equal(h.requests.length,2);if(mode==='pending')h.timers[1]();await h.settle();
}
for(const invalid of ['empty','phone','city','name']) {
 const h=harness();if(invalid==='empty')Object.values(h.quantities).forEach(n=>n.value='0');
 if(invalid==='phone')h.elements.phone.value='123';if(invalid==='name')h.elements.name.value='   ';
 if(invalid==='city'){h.elements.fulfillment.value='Delivery';h.elements.city.value=' ';}
 h.submit();assert.equal(h.requests.length,0,invalid+' must not send');
}
assert(html.includes("/^(www\\.)?raysrental\\.com$/"));
assert(!html.includes('<script async src="https://www.googletagmanager.com'));
assert(html.includes('aria-label="Additional tables"'));
assert(html.includes("'&':'?')+'body='"));
console.log('assert-mobile-forms: promotion boundaries, package totals, empty/invalid requests, duplicate protection, offline/HTTP/timeout recovery, successful handoff and preview analytics isolation pass');

// Run the actual agreement script with a test-only canvas and in-memory POST.
// No contract or signature is transmitted to the live business.
const agreementHtml=fs.readFileSync('out/agreement/index.html','utf8');
const agreementSrc=agreementHtml.split('/* rr-agreement:start */')[1].split('/* rr-agreement:end */')[0];
function agreementHarness(mode='success') {
 const nodes=new Map(),events=[],requests=[],timers=[];
 const context2d=new Proxy({}, {get:()=>()=>{}});
 function node(id) {
  if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,checked:false,disabled:false,width:600,height:180,listeners:{},style:{},classList:{add(){},remove(){}},setAttribute(){},appendChild(){},focus(){this.focused=true;},scrollIntoView(){},addEventListener(k,fn){this.listeners[k]=fn;},getContext:()=>context2d,toDataURL:()=>'data:image/png;base64,TEST_ONLY',getBoundingClientRect:()=>({left:0,top:0,width:300,height:150})});return nodes.get(id);
 }
 const win={location:{hash:happy.window.location.href.split('#')[1]?'#'+happy.window.location.href.split('#')[1]:''},addEventListener(){}};
 vm.runInNewContext(agreementSrc,{window:win,document:{getElementById:node,createElement:()=>node(Symbol()),querySelectorAll:()=>[]},navigator:{userAgent:'QA'},Date,TextDecoder,TextEncoder,Uint8Array,atob,btoa,URLSearchParams,AbortController,
 setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},FormData:class extends Map{constructor(){super([...nodes].filter(([k])=>typeof k==='string'&&k.startsWith('f-')).map(([k,v])=>[k.slice(2),v.value]));}},
 gtag:(...a)=>events.push(a),fetch:(url,opts)=>{requests.push(opts);if(mode==='failure')return Promise.reject(new Error('offline'));if(mode==='pending')return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('timeout'))));return Promise.resolve({ok:true});}});
 const submit=()=>node('ag-form').listeners.submit({preventDefault(){}});
 const sign=()=>{node('ag-signer').value='QA TEST ONLY';node('ag-signer').listeners.input();node('ag-agree').checked=true;node('ag-agree').listeners.change();node('ag-canvas').listeners.touchstart({preventDefault(){},touches:[{clientX:30,clientY:30}]});node('ag-canvas').listeners.touchend({preventDefault(){}});};
 return {node,requests,events,timers,submit,sign,settle:happy.settle};
}
for(const mode of ['success','failure','pending']){
 const h=agreementHarness(mode);assert.equal(h.node('f-total').value,'120');assert.equal(h.node('f-deposit').value,'30');assert.equal(h.node('f-coolers').value,'1');assert(h.node('ag-submit').disabled);h.submit();assert.equal(h.requests.length,0);
 h.sign();assert(!h.node('ag-submit').disabled);h.node('ag-clear').listeners.click();assert(h.node('ag-submit').disabled);h.sign();h.submit();h.submit();assert.equal(h.requests.length,1);
 if(mode==='pending')h.timers[0]();await h.settle();
 if(mode==='success'){assert(h.node('ag-form').hidden);assert(!h.node('ag-done').hidden);assert(h.events.some(e=>e[1]==='agreement_signed'));}
 else {assert(!h.node('ag-form').hidden);assert(!h.node('ag-submit').disabled);assert(!h.node('ag-error').hidden);assert.equal(h.node('ag-signer').value,'QA TEST ONLY');assert.equal(h.events.length,0);}
}
console.log('assert-mobile-forms: agreement touch signature, clear, required consent/name/signature, duplicate protection, timeout/offline recovery, receipt and quote price parity pass');
