// Build-time assertions for /seating-calculator/ and /quinceanera-rentals/.
//
// These two pages are authored in site-overlay/, so unlike the archive-owned pages they
// cannot regress from an archive re-upload. What they can do is drift internally, and the
// two ways that matters are both invisible in a browser:
//
// 1. The reference table on /seating-calculator/ is hand-written HTML while the live
//    calculator is JavaScript. If either side is edited alone the page quietly starts
//    giving two different answers to the same question, which is worse than giving none.
//    So every row is recomputed here with the same formulas the script uses and compared.
//    The chair overage is ceil(guests * 11 / 10) rather than ceil(guests * 1.1) on both
//    sides: in IEEE 754, 20 * 1.1 is 22.000000000000004, so the float form would round a
//    20-guest party up to 23 chairs and silently disagree with the table.
//
// 2. /inventory/ owns the single ItemList for this site, upgraded in place by
//    scripts/patch-inventory-schema.mjs. A second ItemList describing the same products
//    anywhere else is a duplicate-entity signal that search engines read as conflicting
//    rather than corroborating, so the whole publish directory is swept for one here --
//    not just the two new pages -- and anything beyond /inventory/'s fails the build.
//
// The FAQPage on /quinceanera-rentals/ is also checked question-for-question against the
// <details> blocks a visitor actually sees, since schema that answers differently from the
// page is a manual-action risk rather than a rendering bug.
//
// /corporate-event-rentals/ is checked the same way and for one more thing. Its five
// room-setup tables are hand-written and quote a corporate buyer a delivered price, so all
// nineteen rows are recomputed from (tables x $8) + (chairs x $2) + $150 and compared, and
// the per-layout table and chair counts are pinned to the figures the page was signed off
// with -- a row whose arithmetic is internally consistent but whose table count drifted is
// still a wrong quote. Separately, the page must not claim insurance: there is no
// certificate of insurance yet, so the page carries an HTML comment where that block will
// go and the visible text is swept for the word. That is not a rendering bug either -- it
// renders perfectly and tells a venue something untrue -- so it fails the build.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'out';
const LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

const TABLE_SEATS = 6;
const TABLE_RATE = 8;
const CHAIR_RATE = 2;

const problems = [];
const fail = (msg) => problems.push(msg);

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const graphOf = (html, where) => {
  const blocks = [...html.matchAll(LD_RE)];
  if (blocks.length !== 1) {
    fail(`${where}: expected exactly 1 JSON-LD block, found ${blocks.length}`);
    return [];
  }
  try {
    const doc = JSON.parse(blocks[0][1]);
    if (!Array.isArray(doc['@graph'])) {
      fail(`${where}: JSON-LD has no @graph array`);
      return [];
    }
    return doc['@graph'];
  } catch (err) {
    fail(`${where}: JSON-LD did not parse (${err.message})`);
    return [];
  }
};

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', middot: '·', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', ntilde: 'ñ', Ntilde: 'Ñ',
  agrave: 'à', Agrave: 'À', eacute: 'é', hellip: '…',
};
const decode = (s) => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(Number(e[1] === 'x' || e[1] === 'X' ? `0${e.slice(1)}` : e.slice(1)));
  return e in ENTITIES ? ENTITIES[e] : m;
});

// --- shared head-tag checks -------------------------------------------------
// `updated` marks the two pages that carry a visible "Updated August 2026" line under the
// H1. The corporate page is dated through schema instead, so it opts out rather than the
// check being loosened for everyone.
const PAGES = [
  { rel: 'seating-calculator/index.html', url: 'https://raysrental.com/seating-calculator/', updated: true },
  { rel: 'quinceanera-rentals/index.html', url: 'https://raysrental.com/quinceanera-rentals/', updated: true },
  { rel: 'corporate-event-rentals/index.html', url: 'https://raysrental.com/corporate-event-rentals/' },
];

for (const { rel, url, updated } of PAGES) {
  const html = read(rel);
  if (!html.includes(`<link rel="canonical" href="${url}">`)) fail(`${rel}: canonical is not ${url}`);
  if (!html.includes(`<meta property="og:url" content="${url}">`)) fail(`${rel}: og:url is not ${url}`);
  for (const tag of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    const attr = tag.startsWith('og:') ? 'property' : 'name';
    if (!html.includes(`<meta ${attr}="${tag}"`)) fail(`${rel}: missing ${tag}`);
  }
  if (updated) {
    if (!/<p class="rr-updated">Updated August 2026<\/p>/.test(html)) fail(`${rel}: no "Updated August 2026" line`);
    if (!/<h1>[\s\S]*?<\/h1>[\s\S]{0,200}?<p class="rr-updated">/.test(html)) fail(`${rel}: the updated line is not under the H1`);
  }

  const graph = graphOf(html, rel);
  const crumbs = graph.filter((n) => n['@type'] === 'BreadcrumbList');
  if (crumbs.length !== 1) fail(`${rel}: expected 1 BreadcrumbList, found ${crumbs.length}`);
  else if (crumbs[0].itemListElement.at(-1)?.item !== url) fail(`${rel}: breadcrumb does not end on ${url}`);
  if (!graph.some((n) => n['@id'] === 'https://raysrental.com/#business')) {
    fail(`${rel}: no node references the LocalBusiness @id`);
  }
}

// --- exactly one ItemList in the whole site, and it is /inventory/'s --------
const listPages = readdirSync(ROOT, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html'))
  .map((e) => join(e.parentPath ?? e.path, e.name))
  .filter((path) => {
    const text = readFileSync(path, 'utf8');
    return [...text.matchAll(LD_RE)].some(([, block]) => {
      try {
        return (JSON.parse(block)['@graph'] ?? []).some((n) => n['@type'] === 'ItemList');
      } catch {
        return false;
      }
    });
  })
  .sort();

if (listPages.join() !== join(ROOT, 'inventory', 'index.html')) {
  fail(`ItemList must exist only on /inventory/, found on: ${listPages.join(', ') || 'nowhere'}`);
}

// --- calculator vs reference table -----------------------------------------
const calc = read('seating-calculator/index.html');

for (const [name, want] of [['TABLE_SEATS', TABLE_SEATS], ['TABLE_RATE', TABLE_RATE], ['CHAIR_RATE', CHAIR_RATE]]) {
  if (!calc.includes(`${name} = ${want}`)) fail(`seating-calculator: script does not set ${name} = ${want}`);
}
if (!calc.includes('Math.ceil(guests * 11 / 10)')) {
  fail('seating-calculator: chair overage is not the integer form ceil(guests * 11 / 10)');
}
if (!calc.includes('Math.ceil(guests / TABLE_SEATS)')) {
  fail('seating-calculator: table count is not ceil(guests / TABLE_SEATS)');
}

const rows = [...calc.matchAll(/<tr><th scope="row">(\d+)<\/th><td>(\d+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td><td class="rr-price">\$(\d+)<\/td><\/tr>/g)];
const EXPECTED_GUESTS = [20, 30, 40, 50, 60, 75, 100, 125, 150];
if (rows.length !== EXPECTED_GUESTS.length) {
  fail(`seating-calculator: reference table has ${rows.length} rows, expected ${EXPECTED_GUESTS.length}`);
}

rows.forEach(([, g, tables, chairs, plus, cost], i) => {
  const guests = Number(g);
  if (guests !== EXPECTED_GUESTS[i]) fail(`seating-calculator: row ${i + 1} is ${guests} guests, expected ${EXPECTED_GUESTS[i]}`);
  const wantTables = Math.ceil(guests / TABLE_SEATS);
  const wantPlus = Math.ceil((guests * 11) / 10);
  const wantCost = wantTables * TABLE_RATE + wantPlus * CHAIR_RATE;
  if (Number(tables) !== wantTables) fail(`seating-calculator: ${guests} guests shows ${tables} tables, expected ${wantTables}`);
  if (Number(chairs) !== guests) fail(`seating-calculator: ${guests} guests shows ${chairs} chairs, expected ${guests}`);
  if (Number(plus) !== wantPlus) fail(`seating-calculator: ${guests} guests shows ${plus} chairs with overage, expected ${wantPlus}`);
  if (Number(cost) !== wantCost) fail(`seating-calculator: ${guests} guests shows $${cost}, expected $${wantCost}`);
});

// The default state rendered in the HTML has to agree with what the script paints on load,
// or the page flashes one answer and settles on another.
const DEFAULT_GUESTS = 60;
if (!calc.includes(`id="rr-guests" type="number" inputmode="numeric" min="0" max="2000" step="1" value="${DEFAULT_GUESTS}"`)) {
  fail(`seating-calculator: guest input does not default to ${DEFAULT_GUESTS}`);
}
const defTables = Math.ceil(DEFAULT_GUESTS / TABLE_SEATS);
const defPlus = Math.ceil((DEFAULT_GUESTS * 11) / 10);
const defCost = defTables * TABLE_RATE + defPlus * CHAIR_RATE;
for (const [id, value] of [['rr-tables', defTables], ['rr-chairs', DEFAULT_GUESTS], ['rr-chairs-plus', defPlus], ['rr-cost', `$${defCost}`]]) {
  if (!calc.includes(`id="${id}">${value}<`)) fail(`seating-calculator: #${id} does not render ${value} before the script runs`);
}

// --- quinceanera FAQ schema vs the visible FAQ ------------------------------
const quince = read('quinceanera-rentals/index.html');

// --- quinceanera package table vs the same arithmetic ----------------------
// Same hazard as the seating table: these rows are hand-written, they scale a real package
// with a la carte items, and a wrong total here quotes a customer a price we would then have
// to walk back. Each row is recomputed from the package base plus the extras it lists, and
// the package prices themselves are checked against the live /inventory/ page so a price
// change in a re-uploaded archive cannot leave this table quoting last season's numbers.
const BASE = { 'Party for 60': 180, 'The Whole Party': 225 };
const PACKAGE_TABLES = 10;
const PACKAGE_CHAIRS = 60;

const inventory = read('inventory/index.html');
for (const [name, price] of Object.entries(BASE)) {
  if (!inventory.includes(`<h3>${name}</h3>`)) fail(`inventory: no "${name}" package to price against`);
  if (!inventory.includes(`<p class="price">$${price} <small>/ day</small></p>`)) {
    fail(`quinceanera-rentals: ${name} is quoted at $${price}, which /inventory/ no longer lists`);
  }
}

const plans = [...quince.matchAll(
  /<tr><th scope="row">(\d+)[^<]*<\/th><td>([^<]+?) &mdash; \$(\d+)<\/td><td>([^<]*)<\/td><td>(\d+) \/ (\d+)<\/td><td class="rr-price">\$(\d+)<\/td><\/tr>/g,
)];
if (plans.length !== 6) fail(`quinceanera-rentals: package table has ${plans.length} rows, expected 6`);

for (const [, g, pkg, base, extras, tables, chairs, cost] of plans) {
  const guests = Number(g);
  const where = `quinceanera-rentals: ${guests}-guest ${pkg} row`;

  if (!(pkg in BASE)) { fail(`${where} names an unknown package`); continue; }
  if (Number(base) !== BASE[pkg]) fail(`${where} prices ${pkg} at $${base}, expected $${BASE[pkg]}`);

  const wantTables = Math.ceil(guests / TABLE_SEATS);
  const wantChairs = Math.ceil((guests * 11) / 10);
  if (Number(tables) !== wantTables) fail(`${where} totals ${tables} tables, expected ${wantTables}`);
  if (Number(chairs) !== wantChairs) fail(`${where} totals ${chairs} chairs, expected ${wantChairs}`);

  // The "then add a la carte" cell has to be exactly the gap between the package and the total.
  const extraTables = wantTables - PACKAGE_TABLES;
  const extraChairs = wantChairs - PACKAGE_CHAIRS;
  const wantExtras = [
    extraTables ? `${extraTables} table${extraTables === 1 ? '' : 's'}` : '',
    extraChairs ? `${extraChairs} chair${extraChairs === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(', ');
  if (extras.trim() !== wantExtras) fail(`${where} adds "${extras.trim()}", expected "${wantExtras}"`);

  const wantCost = BASE[pkg] + extraTables * TABLE_RATE + extraChairs * CHAIR_RATE;
  if (Number(cost) !== wantCost) fail(`${where} totals $${cost}, expected $${wantCost}`);
}

const visible = [...quince.matchAll(/<details class="faq-item"[^>]*><summary>([\s\S]*?)<\/summary><div class="a">([\s\S]*?)<\/div><\/details>/g)]
  .map(([, q, a]) => [decode(q).trim(), decode(a).trim()]);

if (visible.length !== 5) fail(`quinceanera-rentals: expected 5 visible FAQ items, found ${visible.length}`);

const faq = graphOf(quince, 'quinceanera-rentals/index.html').filter((n) => n['@type'] === 'FAQPage');
if (faq.length !== 1) {
  fail(`quinceanera-rentals: expected 1 FAQPage, found ${faq.length}`);
} else {
  const schema = faq[0].mainEntity ?? [];
  if (schema.length !== visible.length) {
    fail(`quinceanera-rentals: FAQPage has ${schema.length} questions, page shows ${visible.length}`);
  }
  visible.forEach(([q, a], i) => {
    if (schema[i]?.name !== q) fail(`quinceanera-rentals: FAQ ${i + 1} schema question does not match the page`);
    if (schema[i]?.acceptedAnswer?.text !== a) fail(`quinceanera-rentals: FAQ ${i + 1} schema answer does not match the page`);
  });
}

// --- corporate: five room-setup tables, all nineteen rows -------------------
// Layout, table count and chair count are pinned rather than derived: the whole point of the
// page is that headcount alone does not tell you the table count, so there is no formula here
// to re-derive them from. The money is derived, because that is the number a buyer acts on.
const DELIVERY = 150;
const SETUPS = [
  { id: 'classroom',   unit: 'Attendees', rows: [[25, 13, 25], [50, 25, 50], [100, 50, 100], [200, 100, 200]] },
  { id: 'theater',     unit: 'Attendees', rows: [[25, 2, 25], [50, 2, 50], [100, 3, 100], [200, 4, 200]] },
  { id: 'seated-meal', unit: 'Attendees', rows: [[25, 5, 25], [50, 9, 50], [100, 17, 100], [200, 34, 200]] },
  { id: 'expo',        unit: 'Booths',    rows: [[10, 10, 20], [20, 20, 40], [30, 30, 60], [40, 40, 80]] },
  { id: 'u-shape',     unit: 'Attendees', rows: [[12, 6, 12], [20, 10, 20], [30, 15, 30]] },
];

const corp = read('corporate-event-rentals/index.html');
const ROW_RE = /<tr><th scope="row">(\d+)<\/th><td>(\d+)<\/td><td>(\d+)<\/td><td class="rr-price">\$([\d,]+)<\/td><\/tr>/g;

let checkedRows = 0;
for (const { id, unit, rows: want } of SETUPS) {
  const start = corp.indexOf(`<div class="rr-layout" id="${id}">`);
  if (start === -1) { fail(`corporate-event-rentals: no room-setup block with id="${id}"`); continue; }
  const end = corp.indexOf('<div class="rr-layout" id="', start + 1);
  const chunk = corp.slice(start, end === -1 ? undefined : end);

  if (!chunk.includes(`<th scope="col">${unit}</th>`)) {
    fail(`corporate-event-rentals: ${id} table does not lead with a "${unit}" column`);
  }
  // Without the scroll wrapper a table wider than a 320px phone widens the page itself
  // rather than scrolling inside its own box, which is the one layout bug the brief calls out.
  if (!/<div class="rr-scroll">\s*<table class="rr-table rr-setup">/.test(chunk)) {
    fail(`corporate-event-rentals: ${id} table is not inside a .rr-scroll container`);
  }

  const got = [...chunk.matchAll(ROW_RE)];
  if (got.length !== want.length) {
    fail(`corporate-event-rentals: ${id} has ${got.length} rows, expected ${want.length}`);
  }

  want.forEach(([unitCount, tables, chairs], i) => {
    const row = got[i];
    const where = `corporate-event-rentals: ${id} row ${i + 1} (${unitCount} ${unit.toLowerCase()})`;
    if (!row) { fail(`${where} is missing`); return; }
    checkedRows += 1;

    if (Number(row[1]) !== unitCount) fail(`${where} reads ${row[1]}, expected ${unitCount}`);
    if (Number(row[2]) !== tables) fail(`${where} shows ${row[2]} tables, expected ${tables}`);
    if (Number(row[3]) !== chairs) fail(`${where} shows ${row[3]} chairs, expected ${chairs}`);

    const wantTotal = tables * TABLE_RATE + chairs * CHAIR_RATE + DELIVERY;
    // Compared as the rendered string so "$1350" fails as loudly as a wrong sum would.
    const wantText = `$${wantTotal.toLocaleString('en-US')}`;
    if (`$${row[4]}` !== wantText) fail(`${where} totals $${row[4]}, expected ${wantText}`);
  });
}
if (checkedRows !== 19) fail(`corporate-event-rentals: recomputed ${checkedRows} table rows, expected 19`);

// The per-day rates and the delivery floor are quoted in prose too, and prose that disagrees
// with the tables sends a buyer to the phone with the wrong number in their head.
for (const phrase of [
  '6-ft folding tables $8 per day, folding chairs $2 per day, delivery and setup from $150',
  'Every total is tables at $8 per day, plus chairs at $2 per day, plus $150 delivery and setup.',
]) {
  if (!corp.includes(phrase)) fail(`corporate-event-rentals: missing the rate line "${phrase}"`);
}

// --- corporate: no product entity anywhere in the graph ---------------------
// The sweep above only reads top-level @graph members. Offer and Product nodes nest inside
// other nodes just as happily, so this walks the whole tree.
const corpGraph = graphOf(corp, 'corporate-event-rentals/index.html');
const BANNED = new Set(['ItemList', 'Product', 'Offer', 'AggregateOffer']);
const banned = new Set();
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== 'object') return;
  for (const type of [node['@type']].flat()) if (BANNED.has(type)) banned.add(type);
  Object.values(node).forEach(walk);
};
walk(corpGraph);
if (banned.size) {
  fail(`corporate-event-rentals: graph carries ${[...banned].join(', ')} -- /inventory/ owns the only product entity`);
}

const service = corpGraph.filter((n) => n['@type'] === 'Service');
if (service.length !== 1) fail(`corporate-event-rentals: expected 1 Service node, found ${service.length}`);
else {
  if (service[0].serviceType !== 'Event Equipment Rental') fail('corporate-event-rentals: Service.serviceType is not "Event Equipment Rental"');
  if (service[0].provider?.['@id'] !== 'https://raysrental.com/#business') fail('corporate-event-rentals: Service.provider does not reference the LocalBusiness @id');
  if (service[0].areaServed?.name !== 'Dallas-Fort Worth') fail('corporate-event-rentals: Service.areaServed is not Dallas-Fort Worth');
}
if (/<meta name="robots"[^>]*noindex/.test(corp)) fail('corporate-event-rentals: page is noindex, it is meant to be indexable');

// --- corporate: FAQ schema vs the visible FAQ ------------------------------
const corpVisible = [...corp.matchAll(/<details class="faq-item"[^>]*><summary>([\s\S]*?)<\/summary><div class="a">([\s\S]*?)<\/div><\/details>/g)]
  .map(([, q, a]) => [decode(q).trim(), decode(a).trim()]);

if (corpVisible.length !== 6) fail(`corporate-event-rentals: expected 6 visible FAQ items, found ${corpVisible.length}`);
if (corpVisible.some(([q]) => /capacity|how many (tables|chairs) do you (have|own)|inventory/i.test(q))) {
  fail('corporate-event-rentals: FAQ asks about maximum capacity or inventory on hand');
}

const corpFaq = corpGraph.filter((n) => n['@type'] === 'FAQPage');
if (corpFaq.length !== 1) {
  fail(`corporate-event-rentals: expected 1 FAQPage, found ${corpFaq.length}`);
} else {
  const schema = corpFaq[0].mainEntity ?? [];
  if (schema.length !== corpVisible.length) {
    fail(`corporate-event-rentals: FAQPage has ${schema.length} questions, page shows ${corpVisible.length}`);
  }
  corpVisible.forEach(([q, a], i) => {
    if (schema[i]?.name !== q) fail(`corporate-event-rentals: FAQ ${i + 1} schema question does not match the page`);
    if (schema[i]?.acceptedAnswer?.text !== a) fail(`corporate-event-rentals: FAQ ${i + 1} schema answer does not match the page`);
  });
}

// --- corporate: the page must not claim insurance --------------------------
// Comments are stripped first, because the one place the word is allowed is the placeholder
// marking where the block goes once a certificate actually exists.
const COI_COMMENT = '<!-- INSURANCE BLOCK: add "Insured - certificate of insurance available on request, venue named as additional insured" here once COI is in hand -->';
const coiCount = corp.split(COI_COMMENT).length - 1;
if (coiCount !== 1) fail(`corporate-event-rentals: the INSURANCE BLOCK placeholder appears ${coiCount} times, expected 1`);

const corpText = decode(
  corp
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).toLowerCase();
for (const word of ['insur', 'licensed', 'bonded', 'net-30', 'net 30']) {
  if (corpText.includes(word)) fail(`corporate-event-rentals: visible text contains "${word}"`);
}

// --- corporate: the nav link the netlify.toml sed is supposed to insert ----
// Asserted on this page and on an archive-owned one, since the sed runs over both and a
// missed anchor on either side leaves the page orphaned from the menu.
const NAV_LINK = '<a href="/corporate-event-rentals/">Corporate</a><a class="nav-cta" href="/quote/">Build a Quote</a>';
for (const rel of ['corporate-event-rentals/index.html', 'index.html', 'inventory/index.html']) {
  const html = read(rel);
  const hits = html.split(NAV_LINK).length - 1;
  if (hits !== 1) fail(`${rel}: the Corporate nav link appears ${hits} times, expected exactly 1`);
}

if (problems.length) {
  console.error('assert-new-pages: the new pages are inconsistent with themselves:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `assert-new-pages: ok, 3 pages, ${rows.length} seating rows agree with the calculator, ${plans.length} package rows agree with /inventory/ pricing, ${checkedRows} corporate setup rows agree with (tables x $${TABLE_RATE}) + (chairs x $${CHAIR_RATE}) + $${DELIVERY}, ${visible.length + corpVisible.length} FAQs agree with their schema, no insurance claim on /corporate-event-rentals/, 1 ItemList site-wide`,
);
