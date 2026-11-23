import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const fields={name:'Sample Request',phone:'2145550100',date:'2026-12-10',city:'Waxahachie',package:'20 × 40 ft tent inquiry',items:'Buffet on grass','form-name':'quote'};
const elements=Object.fromEntries(Object.entries(fields).map(([k,value])=>[k,{value,addEventListener(){},setCustomValidity(){}}]));
const counts=[{valueAsNumber:8,dataset:{item:'6-ft table'}},{valueAsNumber:48,dataset:{item:'folding chair'}},{valueAsNumber:0,dataset:{item:'drink cooler'}}];
const extras={hidden:true,addEventListener:(s,f)=>listeners['extra-'+s]=f,querySelectorAll:()=>counts},button={textContent:'Send my tent request'},listeners={},nodes={'availability-fallback':{},'availability-status':{},'availability-text':{},'availability-success':{focus(){}}};
const form={elements,querySelector:s=>s==='.tent-extras'?extras:button,reportValidity:()=>true,addEventListener:(s,f)=>listeners[s]=f};
const log=[],posted=[];
class TestFormData extends Map{constructor(){super(Object.entries(elements).map(([k,v])=>[k,v.value]));listeners.formdata({formData:this});}}
let fail=true;
const ctx={window:{FormDataEvent:class{},location:{search:''},gtag:(...a)=>log.push(a)},document:{querySelector:()=>form,getElementById:k=>k==='availabilityForm'?form:nodes[k]},URLSearchParams,FormData:TestFormData,AbortController,setTimeout:()=>0,clearTimeout(){},navigator:{userAgent:'iPhone'},fetch:async (url,opts)=>{posted.push(new URLSearchParams(opts.body));return {ok:!fail};}};
for(const file of ['tent-request.js','availability.js'])vm.runInNewContext(fs.readFileSync('out/assets/js/'+file,'utf8'),ctx);
const settle=()=>new Promise(r=>setImmediate(r));
assert.equal(extras.hidden,false);
listeners.submit({preventDefault(){}});await settle();assert.equal(posted.length,1);
let payload=posted[0];assert.equal(payload.get('form-name'),'quote');assert.equal(payload.get('package'),fields.package);
for(const token of [fields.package,'8 × 6-ft table','48 × folding chair',fields.items]){assert(payload.get('items').includes(token));assert(decodeURIComponent(nodes['availability-text'].href).includes(token));}
assert(!payload.get('items').includes('drink cooler'));
assert.equal(nodes['availability-fallback'].hidden,false);
fail=false;listeners.submit({preventDefault(){}});await settle();assert.equal(posted.length,2);assert.equal(posted[1].get('items'),payload.get('items'));assert(form.hidden);assert.equal(log.filter(e=>e[1]==='generate_lead').length,1);
console.log('Tent selection, quantities, submission payload, SMS fallback, retry and success event pass using a local simulated endpoint.');

assert.equal(extras.open,undefined);listeners['extra-invalid']();assert.equal(extras.open,true);
