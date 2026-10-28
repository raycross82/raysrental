// Check the actual publish output: visible rates, JSON-LD, savings, examples,
// calculator inputs, promotion copy and FAQ answer parity across every page.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext, Script } from 'node:vm';
const config = JSON.parse(readFileSync('pricing.json', 'utf8'));
const { rates, packages } = config;
const read = p => readFileSync(join('out', p), 'utf8');
const amount = n => Number.isInteger(n) ? String(n) : n.toFixed(2);
const value = p => Object.entries(rates).reduce((n, [k, r]) => n + p[k] * r, 0);
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',middot:'·',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',ntilde:'ñ',Ntilde:'Ñ',agrave:'à',Agrave:'À',eacute:'é',hellip:'…'};
const clean = s => s.replace(/<[^>]*>/g, '').replace(/&(#x?[\da-fA-F]+|[A-Za-z]+);/g, (all, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e] ?? all).replace(/\s+/g, ' ').trim();
const walk = (o, fn) => { if (o && typeof o === 'object') { fn(o); Object.values(o).forEach(x => walk(x, fn)); } };
let blocks = 0, faqs = 0, offers = 0;
const pages = readdirSync('out', { recursive:true }).filter(p => p.endsWith('.html'));
for (const p of pages) {
  const html = read(p);
  for (const [, attrs, source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!attrs.includes('application/ld+json') && source.trim()) new Script(source, {filename:p});
  }
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const doc = JSON.parse(json); blocks++;
    assert.equal(doc['@context'], 'https://schema.org', p + ': schema context');
    walk(doc, node => {
      if (node['@type'] === 'FAQPage') {
        const visible = [...html.matchAll(/<details class="faq-item"[^>]*><summary>([\s\S]*?)<\/summary><div class="a">([\s\S]*?)<\/div><\/details>/g)].map(([, q, a]) => [clean(q), clean(a)]);
        assert.equal(node.mainEntity.length, visible.length, p + ': FAQ count');
        for (const question of node.mainEntity) {
          const answer = visible.find(([q]) => q === clean(question.name));
          assert.ok(answer, p + ': missing visible FAQ ' + question.name);
          assert.equal(clean(question.acceptedAnswer.text), answer[1], p + ': FAQ answer mismatch');
          faqs++;
        }
      }
      // A Product nested under Offer.itemOffered still needs its own rich-result
      // properties. City landing pages describe rental services, not product
      // detail pages; bare Product nodes caused Search Console critical errors.
      if ([node['@type']].flat().includes('Product')) {
        assert.ok(node.offers || node.review || node.aggregateRating,
          p + ': Product missing offers, review or aggregateRating: ' + node.name);
      }
      if (node['@type'] === 'Product' && node.offers) {
        offers++;
        const expected = {
          '6 ft Folding Table': rates.tables, 'Folding Chair': rates.chairs,
          'Cooler': rates.coolers, 'JBL PartyBox 110': rates.speakers,
          ...Object.fromEntries(Object.values(packages).map(p => [p.name, p.price])),
        }[node.name];
        assert.ok(expected, p + ': unknown product ' + node.name);
        assert.equal(Number(node.offers.price), expected, node.name + ': offer price');
        assert.equal(Number(node.offers.priceSpecification.price), expected, node.name + ': unit price');
        assert.equal(node.offers.priceCurrency, 'USD');
        assert.equal(node.offers.priceSpecification.unitCode, 'DAY');
      }
      if (node['@type'] === 'Offer' && node.itemOffered) {
        offers++;
        assert.equal(node.itemOffered['@type'], 'Service', p + ': city offer must describe a rental service');
        assert.equal(node.itemOffered.serviceType, node.name, p + ': rental service type');
        assert.equal(node.itemOffered.provider?.['@id'], 'https://raysrental.com/#business', p + ': rental provider');
        assert.equal(node.itemOffered.areaServed?.['@id'], node.areaServed?.['@id'], p + ': rental service area');
        const rate = {'6 ft Folding Table':9, 'White Resin Folding Chair':2.5, 'Drink Cooler':18, 'JBL PartyBox 110 Speaker':40}[node.itemOffered.name];
        assert.equal(Number(node.price), rate, p + ': city offer price');
        assert.equal(Number(node.priceSpecification.price), rate, p + ': city unit price');
        assert.equal(node.priceCurrency, 'USD');
        assert.equal(node.priceSpecification.unitCode, 'DAY');
      }
    });
  }
  if (p !== 'agreement/index.html') {
    // Strip executable JS/CSS; historical payload fixtures and replacement-cost
    // terms are not advertised rental prices.
    const publicText = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '');
    assert.ok(!/\$(?:8|2|12|30|180)(?![\d.])/.test(publicText), p + ': old advertised rental price');
    assert.ok(!publicText.includes('order $50+'), p + ': old promotion');
  }
}
assert.ok(blocks >= 43, 'JSON-LD blocks missing');
assert.equal(offers, 27, 'Seven inventory offers and twenty city-page offers');
for (const p of readdirSync('out/assets/js')) if (p.endsWith('.js')) new Script(read('assets/js/' + p), {filename:p});
const homepage = read('index.html');
assert.equal(homepage.split(`with any order $${config.freeCoolerMinimum}+`).length - 1, 2, 'Static and rotating promo agree');
for (const p of ['index.html', 'inventory/index.html']) {
  const prices = [...read(p).matchAll(/<p class="price">\$([\d.]+)/g)].map(m => Number(m[1])).sort((a,b) => a-b);
  assert.deepEqual(prices, [2.5,9,18,40,200,225,250], p + ': seven visible prices');
}
const quote = read('quote/index.html');
for (const [key, rate] of Object.entries(rates)) {
  assert.ok(quote.includes(`id="q-${key}" data-price="${rate}"`), key + ': quote calculation input');
}
for (const p of Object.values(packages)) {
  assert.ok(quote.includes(`value="${p.name}" data-price="${p.price}"`), p.name + ': quote card');
  const row = read('inventory/index.html').match(new RegExp(`<tr><th scope="row">${p.name}</th>([\\s\\S]*?)</tr>`))?.[1];
  assert.ok(row, p.name + ': comparison row');
  const prices = [...row.matchAll(/\$([\d.]+)/g)].map(m => Number(m[1]));
  assert.deepEqual(prices, [p.price, value(p), value(p) - p.price], p.name + ': savings math');
}
assert.ok(read('faq/index.html').includes('$225 Cookout for 60 package needs a $56.25 deposit'));
assert.ok(read('blog/graduation-party-rentals-dfw/index.html').includes("for a $200 package that's $50"));
assert.ok(read('seating-calculator/index.html').includes('six spare chairs on a 60-guest party costs $15'));
// Execute the shipped cart script against its rendered input prices. This catches
// rounding differences between the visible/hidden quote values and the agreement.
for (const [pkg, quantities, total] of [
  ['party60', {}, 200], ['cookout60', {}, 225], ['wholeparty', {}, 250],
  ['cookout60', {tables:1,chairs:1}, 236.5], ['none', {tables:1,chairs:1,coolers:1,speakers:1}, 69.5],
]) {
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, {value:'',textContent:'',dataset:{},addEventListener(){},appendChild(){}}); return nodes.get(id); };
  const selected = pkg === 'none' ? {value:'none',dataset:{price:'0'}} : {value:packages[pkg].name,dataset:{price:String(packages[pkg].price)}};
  for (const [key, rate] of Object.entries(rates)) {
    const el = node('#q-'+key);
    const input = new RegExp(`id="q-${key}" data-price="([\\d.]+)" data-name="([^"]+)"`).exec(quote);
    el.value = String(quantities[key] || 0); el.dataset = {price:input[1],name:input[2]};
  }
  let mobileUpdates = 0;
  runInNewContext(read('assets/js/quote.js'), {
    document:{
      querySelector:s => s === 'input[name=package]:checked' ? selected : s === 'input[name=fulfillment]:checked' ? {value:'Free Pickup'} : node(s),
      querySelectorAll:() => [], createElement:() => ({})
    },
    location:{search:''},window:{rrQuoteBar(){mobileUpdates++;}}
  });
  const number = s => Number(node(s).textContent.replace('$',''));
  const deposit = Math.round(total * 25) / 100;
  assert.equal(number('#s-total'), total);
  assert.equal(number('#s-deposit'), deposit);
  assert.equal(number('#s-balance'), Math.round((total-deposit)*100)/100);
  assert.equal(Math.round((number('#s-deposit') + number('#s-balance'))*100), Math.round(total*100));
  assert.equal(node('#f-total').value, node('#s-total').textContent);
  assert.equal(node('#f-deposit').value, node('#s-deposit').textContent);
  assert.equal(mobileUpdates, 1);
}
console.log(`assert-pricing: ${pages.length} pages checked, ${blocks} JSON-LD blocks parse, ${faqs} FAQ answers match, ${offers} offers agree; all prices, savings and $100 promo correct`);
