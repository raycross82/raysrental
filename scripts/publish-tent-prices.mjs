// Render the public catalog and quote controls from the same published rates.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const { tentRates, rates } = JSON.parse(readFileSync('pricing.json', 'utf8'));
const use = {
  '10x20': '200 sq ft for a buffet, check-in or backyard gathering.',
  '20x20': '400 sq ft for a seated lunch, shower or graduation.',
  '20x40': '800 sq ft for a reception with separate dining and serving areas.'
};
const tents = Object.entries(tentRates).map(([key, rate]) => ({
  key, rate, size: key.replace('x', ' × '), url: '/tent-rentals/' + key + '/',
  quote: '/quote/?tent=' + key + '#rental-tents', description: use[key],
}));
const root = 'https://raysrental.com';
const setup = 'Tent setup is included. Delivery is priced by location.';
const prices = tents.map(t => `<a href="${t.url}">${t.size} ft · $${t.rate}</a>`).join(' &nbsp;|&nbsp; ');
const plainPrices = tents.map(t => t.size + ' ft for $' + t.rate).join(', ');
const question = 'How much does a party tent cost with setup?';
const answer = `Choose from ${plainPrices}. ${setup} Tables and chairs can be added to the same quote.`;

function withSchema(html, update) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (tag, json) => {
    const doc = JSON.parse(json);
    for (const node of doc['@graph'] || [doc]) update(node);
    return '<script type="application/ld+json">' + JSON.stringify(doc) + '</script>';
  });
}

function offer(tent) {
  return {
    '@type':'Offer', '@id':root + tent.url + '#offer', name:tent.size + ' ft tent with setup',
    price:tent.rate, priceCurrency:'USD', url:root + tent.url,
    description:setup, seller:{'@id':root + '/#business'},
    businessFunction:'http://purl.org/goodrelations/v1#LeaseOut'
  };
}

function edit(rel, change) {
  const path = join('out', rel);
  const old = readFileSync(path, 'utf8');
  const next = change(old);
  assert.notEqual(next, old, 'Missing price integration on ' + rel);
  writeFileSync(path, next);
}

const amount = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const units = {...rates, ...tentRates};
for (const tent of [null, ...tents]) {
  const route = tent ? tent.url : '/tent-rentals/';
  edit(route.slice(1) + 'index.html', html => {
    html = html.replace(/\{\{price:([a-z0-9]+)\}\}/g, (_, key) => {
      assert(Object.hasOwn(units,key), 'Unknown rental ' + key);
      return amount(units[key]);
    });
    if (tent) {
      const [tables, chairs] = {'10x20':[2,0], '20x20':[4,24], '20x40':[8,48]}[tent.key];
      const estimate = tent.rate + tables * rates.tables + chairs * rates.chairs;
      const furniture = tables + ' six-foot tables' + (chairs ? ' and ' + chairs + ' chairs' : '');
      const example = `<p class="tent-small"><strong>Example rental total · ${amount(estimate)}</strong><br>One ${tent.size} tent with setup, plus ${furniture}. Delivery and optional furniture setup are extra.</p>`;
      html = html.replace('</ul></aside>', '</ul>' + example + '</aside>');
    }
    return withSchema(html, node => {
      if (node['@type'] === 'Service') node.offers = tent ? offer(tent) : tents.map(offer);
    });
  });
}

const cards = tents.map(t => `<article class="card rr-tent-card">
  <h3><a href="${t.url}">${t.size} ft Party Tent</a></h3>
  <p class="desc">${t.description}</p>
  <p class="price">$${t.rate} <small>with tent setup</small></p>
  <a class="btn btn-outline btn-block" href="${t.quote}">Add ${t.size} to quote</a>
</article>`).join('\n');
for (const page of ['index.html', 'inventory/index.html']) {
  edit(page, html => {
    // Insert the tent row directly after the other individual rental cards.
    const gridEnd = /(<h2>Rent by the Item<\/h2>[\s\S]*?<h3>JBL PartyBox 110<\/h3>[\s\S]*?<\/div>\s*<\/div>)/;
    assert(gridEnd.test(html), 'Missing item grid on ' + page);
    return html.replace(gridEnd, match => match + '\n<div class="grid grid-3 rr-tent-cards">' + cards + '</div>');
  });
}

edit('inventory/index.html', html => {
  const rows = tents.map(t => `<tr><th scope="row"><a href="${t.url}">${t.size} ft Party Tent</a></th><td>Tent setup included · delivery by location</td><td class="rr-price">$${t.rate}</td></tr>`).join('\n');
  html = html.replace(/(<h2>Full Price List<\/h2>[\s\S]*?)(<\/tbody>)/, (_, body, end) => body + rows + end)
    .replace('<li><b>Cheapest package:', '<li><b>Party tents with setup included</b> · ' + prices + '.</li>\n<li><b>Cheapest package:')
    .replace('per-day pricing, Dallas-Fort Worth, updated October 2026','rental pricing, Dallas-Fort Worth, updated November 2026')
    .replace('Updated October 2026', 'Updated November 2026');
  return withSchema(html, node => {
    if (node['@type'] !== 'ItemList') return;
    for (const t of tents) node.itemListElement.push({
      '@type':'ListItem', position:node.itemListElement.length + 1,
      item:{'@type':'Service','@id':root + t.url + '#service', name:t.size + ' ft Party Tent Rental',
        url:root + t.url, provider:{'@id':root + '/#business'}, offers:offer(t)}
    });
    node.numberOfItems = node.itemListElement.length;
  });
});

const controls = tents.map(t => `<div class="qty-row">
  <div class="info" style="flex:1"><b>${t.size} ft Party Tent</b><span>$${t.rate} each · tent setup included</span></div>
  <div class="qty-ctl">
    <button type="button" data-q="${t.key}" data-d="-1" aria-label="Fewer ${t.size} tents">−</button>
    <input type="number" id="q-${t.key}" aria-label="${t.size} tent quantity" inputmode="numeric" step="1" data-price="${t.rate}" data-name="${t.size} ft tent (setup included)" min="0" max="9999" value="0">
    <button type="button" data-q="${t.key}" data-d="1" aria-label="More ${t.size} tents">+</button>
  </div>
</div>`).join('\n');
edit('quote/index.html', html => {
  const boundary = /(<\/fieldset>\s*<fieldset>\s*<legend>3 &middot; Delivery<\/legend>)/;
  assert(boundary.test(html), 'Missing item section on quote');
  return html.replace(boundary, match => '<h3 id="rental-tents">Party tents</h3>\n' + controls + '\n' + match)
    .replace('We deliver &amp; set up, priced by your location.', 'Delivery is priced by your location. Every tent includes setup.')
    .replace('Delivery and/or setup, priced by your location.', 'Delivery and optional furniture setup are quoted separately.')
    .replace('Delivery and optional setup are quoted separately by location.', 'Tent setup is included in the tent price. Delivery and optional furniture setup are quoted separately.');
});

for (const page of ['quote/index.html','agreement/index.html']) {
  edit(page, html => html.replace('var TENT_RATES = {};', 'var TENT_RATES = ' + JSON.stringify(tentRates) + ';'));
}

for (const city of readdirSync('out/party-rentals', {withFileTypes:true}).filter(d => d.isDirectory())) {
  edit('party-rentals/' + city.name + '/index.html', html => {
    const gridEnd = /(<h3>JBL PartyBox 110(?: Speaker)?<\/h3>[\s\S]*?<\/div>\s*<\/div>)/;
    assert(gridEnd.test(html), 'Could not locate local item list on ' + city.name);
    return html.replace(gridEnd, match => match + '<p class="rr-local-tents"><b>Party tents with setup included</b><br>' + prices + '</p>')
      .replaceAll('Delivery and setup anywhere in', 'Tent setup is included. Delivery anywhere in')
      .replace('<h2>Four Items, Four Prices</h2>', '<h2>Rental prices in Red Oak</h2>');
  });
}

edit('faq/index.html', html => {
  const first = '<details class="faq-item"';
  html = html.replace(first, '<details class="faq-item"><summary>' + question + '</summary><div class="a">' + answer + '</div></details>\n' + first);
  return withSchema(html, node => {
    if (node['@type'] === 'FAQPage') node.mainEntity.unshift({'@type':'Question',name:question,
      acceptedAnswer:{'@type':'Answer',text:answer}});
  });
});
edit('check-availability/index.html', html => html.replace('<p>Already know what you need?', '<p><a href="/tent-rentals/">Party tents from $' + tents[0].rate + ' with setup included</a></p><p>Already know what you need?'));

edit('service-areas/index.html', html => html.replace(
  'We bring everything and set it up. Delivery and/or setup is priced by your location.',
  'We deliver to your event. Tent setup is included in the rental price. Delivery and optional furniture setup are quoted by location.'
));
edit('event-rentals/index.html', html => html.replaceAll(
  'Delivery and setup are priced by your location anywhere in the metroplex',
  'Tent setup is included. Delivery and optional furniture setup are priced by location anywhere in the metroplex'
));
