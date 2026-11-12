import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEW_DISPLAY, NEW_E164 } from './phone.mjs';
import { tentAddons } from './tent-addons.mjs';

const root = 'out';
const base = 'https://raysrental.com';
const catalog = JSON.parse(readFileSync('scripts/specialty-pages.json', 'utf8'));
const read = file => readFileSync(join(root, file), 'utf8');
const write = (file, data) => writeFileSync(join(root, file), data);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function replaceOnce(html, marker, replacement) {
  assert.equal(html.split(marker).length, 2, `Expected one build anchor: ${marker}`);
  return html.replace(marker, () => replacement);
}
const template = read('check-availability/index.html');
const formMarker = '<div class="rr-availability-card">';
const formStart = template.indexOf(formMarker);
const gridEnd = template.indexOf('\n  </div>\n</section>', formStart);
assert(formStart > 0 && gridEnd > formStart, 'Availability form layout changed');
const originalCard = template.slice(formStart, gridEnd);
const tentGallery = readFileSync('tent-gallery.html', 'utf8');
const links = entries => entries.map(item => `<a class="chip" href="/${item.slug}/">${escape(item.label)}</a>`).join(' ');
for (const item of catalog) {
  const isTent = item.slug === 'tent-rentals';
  const url = `${base}/${item.slug}/`;
  const title = `${item.title} | Ray's Rentals`;
  const crumbs = [
    {name:'Home', item:base + '/'},
    {name:'Inventory', item:base + '/inventory/'},
    {name:item.label, item:url}
  ];
  const graph = {
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'WebPage','@id':url+'#webpage',url,name:item.title,description:item.description,mainEntity:{'@id':url+'#service'},breadcrumb:{'@id':url+'#breadcrumb'},isPartOf:{'@id':base+'/#website'}},
      {'@type':'Service','@id':url+'#service',url,name:item.title,serviceType:item.label,description:item.description,provider:{'@id':base+'/#business'},areaServed:'Dallas–Fort Worth, Texas'},
      {'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:crumbs.map((crumb,index)=>({'@type':'ListItem',position:index+1,...crumb}))}
    ]
  };
  let head = template.slice(0, template.indexOf('<main>'))
    .replace(/<title>[^<]+<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"/g, `$1${escape(item.description)}"`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"/g, `$1${escape(title)}"`)
    .replaceAll(`${base}/check-availability/`, url);
  head = replaceOnce(head, '</head>', `<link rel="stylesheet" href="/assets/css/specialty.css"><script type="application/ld+json">${JSON.stringify(graph).replaceAll('<','\\u003c')}</script></head>`);
  let card = replaceOnce(originalCard, formMarker, '<div class="rr-availability-card" id="specialty-request">');
  card = replaceOnce(card, '<h2>Check my date</h2>', `<h2>${escape(item.cta)}</h2>`);
  card = replaceOnce(card, 'Four quick details. Guest count and rental items can come later.', escape(item.prompt));
  card = replaceOnce(card, 'value="Availability inquiry — not a reservation"', `value="${escape(item.label)} inquiry"`);
  if (isTent) {
    head = replaceOnce(head, '</head>', '<link rel="stylesheet" href="/assets/css/tent-gallery.css"><link rel="stylesheet" href="/assets/css/tent-addons.css"><script defer src="/assets/js/tent-addons.js"></script></head>');
    const notes = '<div class="rr-wide"><label for="a-items">';
    card = replaceOnce(card, notes, tentAddons + '\n' + notes);
    card = replaceOnce(card, 'id="availabilityForm"', 'id="availabilityForm" data-sms-subject="party tent availability"');
    card = replaceOnce(card, 'Guest count or rentals (optional)', escape(item.notesLabel));
    card = replaceOnce(card, 'placeholder="e.g. 30 guests, or 5 tables and 30 chairs"', `placeholder="${escape(item.notesExample)}"`);
    card = replaceOnce(card, 'Send my availability request', 'Send my tent request');
  } else {
    card = replaceOnce(card, 'placeholder="e.g. 30 guests, or 5 tables and 30 chairs"></textarea>', `placeholder="${escape(item.prompt)}">${escape(item.label)} — </textarea>`);
  }
  const cases = item.details.map(([heading, body]) => `<article class="card"><h3>${escape(heading)}</h3><p>${escape(body)}</p></article>`).join('\n');
  const related = item.related.map(slug => {
    const entry = catalog.find(candidate => candidate.slug === slug);
    assert(entry, 'Missing related item ' + slug);
    return entry;
  });
  const speaker = item.slug === 'dj-services' ? '<p>Bringing your own playlist? The <a href="/inventory/">JBL speaker rental</a> is a separate equipment-only option.</p>' : '';
  const moreRentals = isTent
    ? '<h2>Need tables, chairs or sound with your tent?</h2><div class="rr-specialty-links"><a class="btn btn-primary" href="#specialty-request" data-choose-tent-addons>Add rentals to my request</a><a class="chip" href="/inventory/">Browse all rental prices</a></div>'
    : `<h2>Also planning for ${item.slug === 'dj-services' ? 'seating or cover' : 'the rest of your event'}?</h2><div class="rr-specialty-links">${links(related)} <a class="chip" href="/inventory/">All rentals</a></div>`;
  const markup = `<main class="rr-specialty">
    <nav class="container rr-specialty-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/inventory/">Inventory</a> / <span aria-current="page">${escape(item.label)}</span></nav>
    <section class="rr-availability"><div class="container rr-availability-grid"><div class="rr-availability-intro">
    <h1>${escape(item.title)}</h1><p class="lead">${escape(item.intro)}</p>${isTent ? tentGallery : ''}
    <p>Send your event date and city. Ray will text you back with availability and pricing.</p>
    <p><a class="btn btn-primary" href="#specialty-request">${escape(item.cta)}</a></p>
    <p>Prefer to text? <a href="sms:${NEW_E164}">${NEW_DISPLAY}</a></p>${speaker}
    </div>${card}</div></section>
    <section class="rr-specialty-details"><div class="container"><h2>${escape(item.section)}</h2><div class="grid grid-3">${cases}</div></div></section>
    <section><div class="container">${moreRentals}</div></section></main>`;
  mkdirSync(join(root, item.slug), {recursive:true});
  write(item.slug+'/index.html', head + markup + template.slice(template.indexOf('</main>') + '</main>'.length));
}
const inventory = 'inventory/index.html';
const section = `<section id="event-options"><div class="container center"><h2>More options for your event</h2><p>Choose an option to check dates, discuss quantities and request a quote.</p><div class="rr-specialty-links">${links(catalog)}</div></div></section>`;
let inventoryHTML = replaceOnce(read(inventory), '<section class="cta-band">', section + '\n<section class="cta-band">');
inventoryHTML = replaceOnce(inventoryHTML, '</head>', '<link rel="stylesheet" href="/assets/css/specialty.css"></head>');
write(inventory, inventoryHTML);
const quote = 'quote/index.html';
const quoteMarker = 'Your total updates as you go.</p>';
write(quote, replaceOnce(read(quote), quoteMarker, quoteMarker + '<p class="rr-quick-link">Looking for a tent, DJ, round tables or resin chairs? <a href="/inventory/#event-options">Request these event options</a>.</p>'));
const sitemap = 'sitemap.xml';
write(sitemap, replaceOnce(read(sitemap), '</urlset>', catalog.map(item => `<url><loc>${base}/${item.slug}/</loc></url>`).join('\n')+'\n</urlset>'));
console.log('Built four event pages and their inventory, quote, sitemap and inquiry links.');
