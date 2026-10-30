import fs from 'node:fs';
import assert from 'node:assert/strict';
const pricing = JSON.parse(fs.readFileSync('pricing.json','utf8'));
const read = p => fs.readFileSync('out/'+p,'utf8');
const write = (p,s) => fs.writeFileSync('out/'+p,s);
let quote = read('quote/index.html');
quote = quote.replace(/var PROMO_RATES = \{[^}]+\};/, 'var PROMO_RATES = '+JSON.stringify(pricing.rates)+';')
  .replace(/var PROMO_MINIMUM = \d+;/, 'var PROMO_MINIMUM = '+pricing.freeCoolerMinimum+';');
quote = quote.replace('Adjust quantities &mdash; these stack on top of any package above.', 'Adjust quantities &mdash; these stack on top of any package above. <a href="#rr-cooler-offer">See the free cooler offer</a>.');
quote = quote.replace('<div id="cart-lines">', '<p class="rr-offer" id="rr-cooler-offer">One free cooler with $'+pricing.freeCoolerMinimum+'+ in table, chair and speaker rentals. Automatically included below. Packages with coolers already include the offer; extra coolers are $'+pricing.rates.coolers+' each. All rentals are subject to availability.</p><div id="cart-lines">');
quote = quote.replace('<span>Pickup</span><span id="s-fulfill">','<span>Pickup / delivery</span><span id="s-fulfill">');
quote = quote.replace('<div class="sline deposit">','<p class="note" id="delivery-note" hidden>Delivery and optional setup are quoted separately by location. Final total and deposit will be confirmed before payment.</p><div class="sline deposit">');
for (const [id,label] of Object.entries({tables:'Additional tables',chairs:'Additional chairs',coolers:'Coolers requested',speakers:'Additional speakers'})) {
  quote = quote.replace('id="q-'+id+'"', 'id="q-'+id+'" aria-label="'+label+'" inputmode="numeric" step="1"');
}
write('quote/index.html',quote);
write('contact/index.html',read('contact/index.html').replace('<body>', '<body class="rr-contact-page">'));
let cart = read('assets/js/quote.js');
assert(cart.includes("if(q>0){items.push"));
cart = cart.replace('var items=[],sub=pkgPrice;', "var items=[],sub=pkgPrice,values={package:pkg.value};\n    qtyIds.forEach(function(id){ values[id]=$('#q-'+id).value; });\n    var offer=window.rrQuoteHandoff.promotion(values);");
cart = cart.replace("if(q>0){items.push({name:el.dataset.name,qty:q,line:q*p});sub+=q*p;}", "if(id==='coolers' && offer.freeCooler){\n        items.push({name:'Complimentary cooler',qty:1,line:0});\n        q=Math.max(0,q-1);\n      }\n      if(q>0){items.push({name:el.dataset.name,qty:q,line:q*p});sub+=q*p;}");
cart = cart.replace('sub:sub,delivery:delivery,total:sub,deposit:Math.round(sub*25)/100', 'sub:offer.total,delivery:delivery,total:offer.total,deposit:Math.round(offer.total*25)/100');
cart = cart.replace("$('#s-deposit').textContent=fmt(s.deposit);", "$('#s-deposit').textContent=s.delivery?'Confirmed with delivery':fmt(s.deposit);\n    $('#delivery-note').hidden=!s.delivery;");
cart = cart.replace("$('#s-balance').textContent=fmt(s.total-s.deposit);", "$('#s-balance').textContent=s.delivery?'Confirmed with delivery':fmt(s.total-s.deposit);");
// Carry the same pending-delivery status into the request sent to Ray.
cart = cart.replace("$('#f-deposit').value=fmt(s.deposit);", "$('#f-deposit').value=s.delivery?'To be confirmed':fmt(s.deposit);");
cart = cart.replace("$('#clearAll').addEventListener", "qtyIds.forEach(function(id){ var input=$('#q-'+id); input.addEventListener('blur',function(){ input.value=Math.max(0,Math.min(+input.max,Math.floor(+input.value||0))); renderSummary(); }); });\n  $('#clearAll').addEventListener");
// Avoid interpreting arbitrary URL text as a CSS selector.
cart = cart.replace("if(m){var r=document.querySelector('input[name=package][data-id=\"'+m+'\"]');if(r)r.checked=true;}", "if(m && ['party60','cookout60','wholeparty'].includes(m)){var r=document.querySelector('input[name=package][data-id=\"'+m+'\"]');if(r)r.checked=true;}");
write('assets/js/quote.js',cart);
for(const path of fs.readdirSync('out',{recursive:true}).filter(p=>p.endsWith('.html'))){
  let html=read(path);
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/mobile-forms.css?v=1">\n</head>');
  // Never send preview/QA activity into the live GA4 property.
  html=html.replace(/<script async src="https:\/\/www.googletagmanager.com\/gtag\/js\?id=([^\"]+)"><\/script>/g,
    (_,id)=>`<script>if(/^(www\\.)?raysrental\\.com$/.test(location.hostname)){var ga=document.createElement('script');ga.async=true;ga.src='https://www.googletagmanager.com/gtag/js?id=${id}';document.head.appendChild(ga);}</script>`);
  write(path,html);
}
console.log('patch-mobile-forms: cooler offer, quote labels, mobile layout, preview analytics isolation');
