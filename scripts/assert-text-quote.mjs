import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {File} from 'node:buffer';
const source = readFileSync(new URL('../hq/public/assets/js/admin-quote.js', import.meta.url), 'utf8');
const part = source.slice(source.indexOf('const PAYMENT_PDF ='), source.indexOf("\n$('generate-quote').addEventListener"));
const elements = new Map();
const $ = id => {
  if (!elements.has(id)) elements.set(id, {value:'', disabled:false, hidden:false, handlers:{}, addEventListener(event, fn){this.handlers[event]=fn;}, showModal(){this.open=true;}, close(){this.open=false;this.handlers.close?.();}});
  return elements.get(id);
};
let shared;
const context = vm.createContext({$, File, Blob, AbortSignal, Date, console,
  lastPriced:{customerName:'Alex Example',phone:'2145550100',rentalDate:'2026-11-15',depositCents:3640},
  lastNumber:'TEST-01', lastHtml:'<html>test</html>', activeQuote:{}, dirty:false,busy:false,
  textFiles:[],textPreparation:0,quotePdfFile:new File(['%PDF-test'],'quote.pdf',{type:'application/pdf'}),pdfUrl:'blob:test',
  formatMoney:c => `$${(c/100).toFixed(2)}`,phoneDigits:p=>p.replace(/\D/g,''),quoteFilename:()=> 'quote.pdf',
  quoteSmsHref:(p,t)=>`sms:${p}?body=${encodeURIComponent(t)}`,window:{location:{href:''}},
  fetch:async()=>({ok:true,blob:async()=>new Blob(['%PDF-payment'])}),
  navigator:{share:async data=>{shared=data;},canShare:()=>true,clipboard:{writeText:async()=>{}}},
  downloadPdf:async()=>{throw new Error('Cached PDF should be reused');}
});
vm.runInContext(part,context);
await context.textQuote();
assert.equal(context.textFiles.length,2);
assert.equal(context.textFiles[0].name,'quote.pdf');
assert.equal(context.textFiles[1].name,'Rays-Rentals-Deposit-Payment-Information.pdf');
assert.match($('text-message').value,/Hi Alex!/);
assert.match($('text-message').value,/November 15, 2026/);
assert.match($('text-message').value,/\$36\.40/);
assert.equal($('text-recipient').value,'2145550100');
$('text-message').value='Edited message';
await $('share-pdfs').handlers.click();
assert.equal(shared.text,'Edited message');
assert.equal(shared.files.length,2);
assert.match($('text-feedback').textContent,/cannot confirm sending/);
context.dirty=true;shared=null;
await $('share-pdfs').handlers.click();assert.equal(shared,null,'Dirty quote cannot be shared');
context.dirty=false;
context.navigator.share=async()=>{throw Object.assign(new Error(),{name:'AbortError'});};
await $('share-pdfs').handlers.click();assert.match($('text-feedback').textContent,/canceled/);
context.navigator.canShare=()=>false;
await context.textQuote();assert.equal($('share-pdfs').disabled,true);assert.match($('text-feedback').textContent,/cannot share/);
context.fetch=async()=>({ok:true,blob:async()=>new Blob(['<html>missing PDF</html>'])});
await context.textQuote();assert.equal(context.textFiles.length,0);assert.match($('text-feedback').textContent,/could not be loaded/);
let release;
context.fetch=()=>new Promise(resolve=>{release=resolve;});
const pending=context.textQuote();$('text-dialog').close();
release({ok:true,blob:async()=>new Blob(['%PDF-payment'])});await pending;
assert.equal(context.textFiles.length,0,'Closed preparation cannot attach stale files');
assert.match(source,/html !== lastHtml \|\| record !== activeQuote \|\| dirty/);
const pdf=readFileSync(new URL('../hq/public/assets/docs/Rays-Rentals-Deposit-Payment-Information.pdf',import.meta.url));
assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
console.log('assert-text-quote: passed — personalized message, two PDFs, edited message, dirty guard, cancellation, unsupported browser, invalid PDF, closed preparation');
