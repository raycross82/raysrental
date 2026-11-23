// The archive owns these pages. Add contextual links as the site builds.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const hub = '/tent-rentals/';
const root = 'https://raysrental.com';
const { tentRates } = JSON.parse(readFileSync('pricing.json', 'utf8'));
const sizes = Object.keys(tentRates);
const routes = [hub, ...sizes.map(size => hub + size + '/')];
const link = (slug, label) => `<a href="${hub}${slug ? slug + '/' : ''}">${label}${slug ? ' · $' + tentRates[slug] : ''}</a>`;
const entries = [
  ['', '<h2>Rentals for Every Occasion</h2>', `Taking the party outdoors? Compare ${link('', 'DFW party tent rentals')} and ask for your tent, tables and chairs together.`],
  ['inventory', '<h2>Rent by the Item</h2>', `Delivery is priced by location. ${link('', 'Compare tent sizes and layouts')}.`],
  ['event-rentals', '<h2>Events of Every Size and Kind</h2>', `For an outdoor event, ${link('', 'compare party tents')} from $${tentRates['10x20']} to $${tentRates['20x40']} with tent setup included.`],
  ['event-rentals/wedding', '<h2>How It Works</h2>', `For a tented dinner, see the ${link('20x40', '20 × 40 wedding tent planning example')}. Include your head table and buffet in the request.`],
  ['event-rentals/graduation', '<h2>How It Works</h2>', `Hosting a come-and-go party? See the ${link('10x20', '10 × 20 graduation buffet setup')} or compare a ${link('20x20', '20 × 20 tent for seated guests')}.`],
  ['event-rentals/quinceanera', '<h2>How It Works</h2>', `Hosting the reception outside? The ${link('20x40', '20 × 40 ft party tent')} includes tent setup.`],
  ['event-rentals/church-events', '<h2>How It Works</h2>', `For outdoor check-in and fellowship meals, ${link('', 'compare tents')} from $${tentRates['10x20']} with setup included.`],
  ['quinceanera-rentals', '<h2>What to Rent for Your Guest Count</h2>', `For a backyard reception, ${link('20x40', 'plan a 20 × 40 tent layout')} around dinner seating, the head table and any covered dance space.`],
  ['corporate-event-rentals', '<h2>Events We Set Up</h2>', `Planning an outdoor lunch? See a ${link('20x40', '20 × 40 event tent layout')} and include the venue’s load-in window in your quote.`],
  ['party-rentals/dallas', '<h2>Party Rentals Built for Dallas</h2>', `For a backyard party or a seated reception, ${link('', 'compare tent rental sizes for your Dallas event')}.`],
  ['party-rentals/waxahachie', '<h2>Ten Pavilions, Six Parks, and a Working Outlet</h2>', `Hosting on private property or outside a covered pavilion? Compare ${link('', 'tent rental options for your Waxahachie event')}. Include your venue and setup surface for a delivery quote.`],
  ['quote', 'Your total updates as you go.</p>', `Add a tent below with your other rentals, or ${link('', 'compare tent sizes')}.`]
];
for (const route of routes) {
  const html = readFileSync(join('out', route, 'index.html'), 'utf8');
  assert(html.includes(`rel="canonical" href="${root + route}"`), 'Missing tent canonical at ' + route);
  assert(html.includes('id="tent-quote"'), 'Expected the new tent quote form at ' + route);
}
for (const [page, anchor, text] of entries) {
  const file = join('out', page, 'index.html');
  const html = readFileSync(file, 'utf8');
  if (html.includes('data-tent-planning-link')) continue;
  assert.equal(html.split(anchor).length, 2, 'Missing or ambiguous tent link location on /' + page);
  const style = page === 'quote' ? ' class="rr-quick-link"' : ' style="margin:12px 0 18px"';
  writeFileSync(file, html.replace(anchor, () => anchor + '\n<p data-tent-planning-link' + style + '>' + text + '</p>'));
}
const path = 'out/sitemap.xml';
let sitemap = readFileSync(path, 'utf8');
assert.equal(sitemap.split('</urlset>').length, 2, 'Missing sitemap closing tag');
for (const route of routes) {
  const loc = '<loc>' + root + route + '</loc>';
  if (!sitemap.includes(loc)) sitemap = sitemap.replace('</urlset>', '<url>' + loc + '</url>\n</urlset>');
  assert.equal(sitemap.split(loc).length, 2, 'Duplicate sitemap entry for ' + route);
}
writeFileSync(path, sitemap);
console.log('Tent pages linked from inventory, quote, event and city pages. All four canonical URLs verified in sitemap.');

// Give every public page a route into the tent hub, without changing SEO URLs.
for (const file of readdirSync('out', {recursive:true}).filter(p=>p.endsWith('.html'))) {
 const path=join('out',file);
 let html=readFileSync(path,'utf8');
 html=html.replace(/(<nav class="main-nav"[^>]*>[\s\S]*?<a[^>]*href="\/inventory\/"[^>]*>Inventory<\/a>)(?!<a href="\/tent-rentals\/")/, '$1<a href="/tent-rentals/">Tents</a>');
 html=html.replace('<li><a href="/inventory/">Inventory &amp; Pricing</a></li>', '<li><a href="/inventory/">Inventory &amp; Pricing</a></li><li><a href="/tent-rentals/">Tent Rentals</a></li>');
 if(file.startsWith('tent-rentals/'))html=html.replace('<a href="/tent-rentals/">Tents</a>','<a href="/tent-rentals/" aria-current="location">Tents</a>');
 writeFileSync(path,html);
}
