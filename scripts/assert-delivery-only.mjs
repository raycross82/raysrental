import fs from 'node:fs';
import assert from 'node:assert/strict';
const files=fs.readdirSync('out',{recursive:true}).filter(p=>p.endsWith('.html'));
for(const path of files){
 const html=fs.readFileSync('out/'+path,'utf8');
 // Keep internal collection field names and the owner's after-event collection
 // terms, but never advertise the former customer-pickup service again.
 for(const banned of [/free[\s-]+(?:lot[\s-]+)?pick[\s-]?up/i, /pick[\s-]?up.{0,50}(?:our (?:DFW )?lot|is free)/i, /pick[\s-]?up or deliver/i, /pick up free/i, /optional for pickup/i, /Swing by our lot/i, /Two Easy Ways/, /collect(?:ing)?(?: the order)? yourself/i, /lot if you are collecting/i, /picked up Friday/i, /Grab it.*lot/i]) assert(!banned.test(html), path+': customer pickup offer '+banned);
}
const quote=fs.readFileSync('out/quote/index.html','utf8');
const options=[...quote.matchAll(/<input[^>]*name="fulfillment"[^>]*>/g)].map(m=>m[0]);
assert.equal(options.length,1);
assert(options[0].includes('value="Delivery & Setup" checked'));
assert(quote.includes('After-event collection timing'));
assert(quote.includes('name="pickupTiming"'));
assert(quote.includes("var delivery = -1;"));
assert(quote.includes("if (!value('city').trim())"));
assert(!fs.readFileSync('out/assets/js/quote.js','utf8').includes('Free Pickup'));
assert(fs.readFileSync('out/agreement/index.html','utf8').includes('Renter is responsible for all equipment from delivery until pickup'));
console.log(`assert-delivery-only: ${files.length} pages checked; delivery-only form, pending charges and after-event collection retained`);
