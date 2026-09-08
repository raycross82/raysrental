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
// The /quote/ -> /agreement/ handoff is checked the same way, and it is the check with the
// most to lose. quote-agreement-handoff.html encodes a submitted quote into the URL hash and
// /agreement/ decodes it, prices it and puts a signature on it. The two files never call each
// other, so a change to either side alone does not throw: the agreement page simply renders
// "we couldn't open this quote", or worse, reads a payload it can parse and prices something
// the customer did not ask for. Neither is visible in a build log. So both scripts are pulled
// out of the rendered pages, run in a stub DOM here, and driven against each other: the
// encoder must reproduce the frozen v1 vector byte for byte, the decoder must read that same
// vector back to 15 fields, and every package mapping is built by the real encoder and priced
// by the real pricing function -- never by a copy of either -- with the resulting totals
// checked against both the figures the packages were signed off with and the prices on the
// /quote/ cards themselves. The two timing selects are pinned to the mapping tables as well,
// since a renamed option silently falls through to the "not sure yet" default and would ship
// an agreement with dates nobody picked.
//
// The delivery sentinel gets its own checks. Field 12 of -1 means "delivery quoted by
// location": the agreement shows an equipment subtotal and no final total or dollar deposit
// until Ray confirms the charge. A regression there does not look like a bug either -- it
// looks like a confident, wrong number on a document someone is about to sign -- so the
// quoted-by-location path is asserted to produce no numeric total and no numeric deposit,
// and the priced path is asserted to still produce both.
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
import { runInNewContext } from 'node:vm';

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

// --- /quote/ -> /agreement/ handoff ---------------------------------------
// Both scripts are lifted out of the rendered pages by the markers they carry and run here,
// so every figure below comes from the code that ships rather than from a second copy of it.
const QUOTE_PAGE = 'quote/index.html';
const AGREEMENT_PAGE = 'agreement/index.html';
const quotePage = read(QUOTE_PAGE);
const agreementPage = read(AGREEMENT_PAGE);

const scriptBetween = (html, marker, where) => {
  const hits = [...html.matchAll(new RegExp(`/\\* ${marker}:start \\*/([\\s\\S]*?)/\\* ${marker}:end \\*/`, 'g'))];
  if (hits.length !== 1) {
    fail(`${where}: expected 1 ${marker} block, found ${hits.length}`);
    return null;
  }
  return hits[0][1];
};

// Enough of a DOM for a page script to reach the end of its own body without throwing. Every
// unknown property of a canvas context answers with a no-op, and every element lookup answers
// with a node, so the scripts wire themselves up to nothing and expose their pure functions.
const runPageScript = (src, where) => {
  const ctxStub = () =>
    new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) });

  const node = () => {
    const el = {
      textContent: '', value: '', href: '', src: '', className: '', id: '',
      hidden: false, checked: false, disabled: false, width: 600, height: 180,
      style: {}, dataset: {}, elements: {},
      classList: { add() {}, remove() {}, contains: () => false },
      appendChild: () => el, removeChild: () => el, insertBefore: () => el,
      setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
      addEventListener() {}, removeEventListener() {},
      scrollIntoView() {}, focus() {}, submit() {},
      querySelector: () => node(), querySelectorAll: () => [],
      getContext: () => ctxStub(), toDataURL: () => '',
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 180 }),
    };
    return el;
  };

  const win = { location: { hash: '', search: '', href: '' }, addEventListener() {}, print() {}, dataLayer: [] };
  const sandbox = {
    window: win,
    self: win,
    navigator: { userAgent: 'assert-new-pages' },
    location: win.location,
    document: {
      getElementById: () => node(),
      querySelector: () => node(),
      querySelectorAll: () => [],
      createElement: () => node(),
      addEventListener() {},
      documentElement: node(),
      body: node(),
    },
    atob, btoa, TextDecoder, TextEncoder, URLSearchParams, console,
    FormData: class {},
    fetch: () => new Promise(() => {}),
  };

  try {
    runInNewContext(src, sandbox, { timeout: 5000 });
  } catch (err) {
    fail(`${where}: the page script threw before exposing its hooks (${err.message})`);
  }
  return win;
};

const handoffSrc = scriptBetween(quotePage, 'rr-agreement-handoff', QUOTE_PAGE);
const agreeSrc = scriptBetween(agreementPage, 'rr-agreement', AGREEMENT_PAGE);
const handoff = handoffSrc ? runPageScript(handoffSrc, QUOTE_PAGE).rrQuoteHandoff : null;
const agreement = agreeSrc ? runPageScript(agreeSrc, AGREEMENT_PAGE).rrAgreement : null;

if (!handoff) fail(`${QUOTE_PAGE}: the handoff script does not expose window.rrQuoteHandoff`);
if (!agreement) fail(`${AGREEMENT_PAGE}: the agreement script does not expose window.rrAgreement`);

// The frozen v1 wire format. Changing either side of the handoff without changing the other
// breaks this line first, which is the point of writing it out in full.
const VECTOR = [
  '1', 'Q-TEST', 'Maria Gonzalez', '214-555-0142', '', '1801 N Lamar St, Dallas TX',
  '2026-09-19T10:00', '2026-09-19T20:00', '10', '66', '1', '1', '150', '0',
  'Backyard, gate on the left side.',
];
const VECTOR_B64 =
  'MXxRLVRFU1R8TWFyaWEgR29uemFsZXp8MjE0LTU1NS0wMTQyfHwxODAxIE4gTGFtYXIgU3QsIERhbGxhcyBUWHwyMDI2LTA5LTE5VDEwOjAwfDIwMjYtMDktMTlUMjA6MDB8MTB8NjZ8MXwxfDE1MHwwfEJhY2t5YXJkLCBnYXRlIG9uIHRoZSBsZWZ0IHNpZGUu';
const VECTOR_TOTAL = 404;
const VECTOR_DEPOSIT = 101;
const VECTOR_SUBTOTAL = 254;

let handoffChecks = 0;

if (handoff) {
  const encoded = handoff.encode(VECTOR);
  handoffChecks++;
  if (encoded !== VECTOR_B64) fail(`quote handoff: the encoder no longer produces the v1 vector (got ${encoded})`);
}

if (agreement) {
  const raw = agreement.fromBase64Url(VECTOR_B64);
  const fields = raw.split('|');
  handoffChecks++;
  if (fields.length !== 15) fail(`agreement: the v1 vector decodes to ${fields.length} fields, expected 15`);
  if (fields[12] !== '150') fail(`agreement: field 12 of the v1 vector decodes to "${fields[12]}", expected "150"`);
  fields.forEach((value, i) => {
    if (value !== VECTOR[i]) fail(`agreement: field ${i} of the v1 vector decodes to "${value}", expected "${VECTOR[i]}"`);
  });

  const parsed = agreement.parsePayload(VECTOR_B64);
  if (!parsed) {
    fail('agreement: the v1 vector does not parse');
  } else {
    const sums = agreement.price(parsed);
    if (sums.deliveryUnknown) fail('agreement: a delivery of 150 is being treated as quoted-by-location');
    if (sums.total !== VECTOR_TOTAL) fail(`agreement: the v1 vector prices to $${sums.total}, expected $${VECTOR_TOTAL}`);
    if (sums.deposit !== VECTOR_DEPOSIT) fail(`agreement: the v1 vector deposit is $${sums.deposit}, expected $${VECTOR_DEPOSIT}`);
    if (sums.balance !== VECTOR_TOTAL - VECTOR_DEPOSIT) fail('agreement: total, deposit and balance do not add up');
  }

  // Same quote, delivery quoted by location: an itemized subtotal and nothing else.
  const encodeVector = handoff ? handoff.encode : (f) => Buffer.from(f.join('|'), 'utf8').toString('base64url');
  const unknown = agreement.parsePayload(encodeVector([...VECTOR.slice(0, 12), '-1', '0', VECTOR[14]]));
  handoffChecks++;
  if (!unknown) {
    fail('agreement: a delivery of -1 is rejected instead of read as quoted-by-location');
  } else {
    const sums = agreement.price(unknown);
    if (sums.deliveryUnknown !== true) fail('agreement: a delivery of -1 is not flagged as quoted-by-location');
    if (typeof sums.total === 'number') fail(`agreement: a delivery of -1 still produces a total ($${sums.total})`);
    if (typeof sums.deposit === 'number') fail(`agreement: a delivery of -1 still produces a deposit ($${sums.deposit})`);
    if (typeof sums.balance === 'number') fail(`agreement: a delivery of -1 still produces a balance ($${sums.balance})`);
    if (sums.subtotal !== VECTOR_SUBTOTAL) {
      fail(`agreement: the quoted-by-location subtotal is $${sums.subtotal}, expected $${VECTOR_SUBTOTAL}`);
    }
  }

  // Every negative other than the sentinel stays rejected.
  if (agreement.parsePayload(encodeVector([...VECTOR.slice(0, 12), '-2', '0', VECTOR[14]]))) {
    fail('agreement: a delivery of -2 parses, so the -1 sentinel is not the only negative accepted');
  }
}

// The three packages, built by the page's own encoder and priced by the page's own pricing
// function, for a one-day rental with free pickup. The expected totals are the prices the
// packages were signed off with, and they are checked against the /quote/ cards as well.
const PACKAGE_TOTALS = { 'Party for 60': 180, 'Cookout for 60': 200, 'The Whole Party': 225 };
const ONE_DAY = {
  name: 'Maria Gonzalez', phone: '214-555-0142', email: '', address: '1801 N Lamar St', city: 'Dallas TX',
  date: '2026-09-19', dropoffTiming: 'Morning of the event', pickupTiming: 'Same night after the event',
  fulfillment: 'Free Pickup',
};

let pkgChecked = 0;
if (handoff && agreement) {
  for (const [name, want] of Object.entries(PACKAGE_TOTALS)) {
    const hash = handoff.build({ ...ONE_DAY, package: name });
    const parsed = hash && agreement.parsePayload(hash);
    if (!parsed) {
      fail(`quote handoff: the "${name}" package does not build a payload /agreement/ can read`);
      continue;
    }
    const sums = agreement.price(parsed);
    if (sums.days !== 1) fail(`quote handoff: "${name}" with same-day timings prices ${sums.days} days, expected 1`);
    if (sums.total !== want) fail(`quote handoff: "${name}" prices to $${sums.total} for one day, expected $${want}`);

    const card = new RegExp(`value="${name}" data-price="(\\d+)"`).exec(quotePage);
    if (!card) fail(`${QUOTE_PAGE}: no package card for "${name}" to price against`);
    else if (Number(card[1]) !== want) {
      fail(`${QUOTE_PAGE}: the "${name}" card reads $${card[1]} but the mapping prices it at $${want}`);
    }
    pkgChecked++;
  }

  // A package plus a la carte items: the quantities stack, the package discount does not change.
  const stacked = agreement.parsePayload(
    handoff.build({ ...ONE_DAY, package: 'Party for 60', tables: '2', chairs: '10', coolers: '1', speakers: '0' }),
  );
  if (!stacked) fail('quote handoff: a package with extra cart items does not build a readable payload');
  else {
    if (stacked.qty.tables !== 12 || stacked.qty.chairs !== 70 || stacked.qty.coolers !== 1) {
      fail('quote handoff: cart quantities do not stack on top of the package');
    }
    if (stacked.discount !== PACKAGE_TOTALS['Party for 60'] && stacked.discount !== 20) {
      fail(`quote handoff: stacking cart items changed the package discount to ${stacked.discount}`);
    }
  }

  // Fulfillment -> the delivery field, including the sentinel.
  const deliveryOf = (values) => {
    const hash = handoff.build(values);
    return hash ? agreement.fromBase64Url(hash).split('|')[12] : null;
  };
  if (deliveryOf({ ...ONE_DAY, package: 'Party for 60' }) !== '0') {
    fail('quote handoff: Free Pickup does not encode a delivery of 0');
  }
  if (deliveryOf({ ...ONE_DAY, package: 'Party for 60', fulfillment: 'Delivery & Setup' }) !== '-1') {
    fail('quote handoff: Delivery & Setup does not encode the -1 quoted-by-location sentinel');
  }

  // Timings -> the rental window. Written out in full because these four pairs are the whole
  // contract between a date picker and a signed document.
  const DATE_CASES = [
    ['Evening before the event', 'Morning after the event', '2026-09-18T18:00', '2026-09-20T10:00'],
    ['Morning of the event', 'Same night after the event', '2026-09-19T09:00', '2026-09-19T23:00'],
    ['Afternoon of the event', 'Next evening', '2026-09-19T14:00', '2026-09-20T18:00'],
    ['Not sure yet - Ray will confirm', 'Not sure yet - Ray will confirm', '2026-09-19T09:00', '2026-09-20T10:00'],
  ];
  for (const [drop, pick, start, end] of DATE_CASES) {
    const when = handoff.dates('2026-09-19', drop, pick);
    if (!when) fail(`quote handoff: "${drop}" / "${pick}" builds no rental window`);
    else if (when.start !== start || when.end !== end) {
      fail(`quote handoff: "${drop}" / "${pick}" gives ${when.start} to ${when.end}, expected ${start} to ${end}`);
    }
  }

  // A date the customer never gave, or one that does not exist, has to fall back to
  // /thank-you/ rather than ship a link the agreement page cannot open.
  for (const date of ['', '   ', 'next Saturday', '2026-02-31', '2026-13-01']) {
    if (handoff.build({ ...ONE_DAY, package: 'Party for 60', date }) !== null) {
      fail(`quote handoff: the date "${date}" still builds an agreement link`);
    }
  }
  // Nor may a submission with nothing in it become a signable agreement.
  if (handoff.build({ ...ONE_DAY, package: 'none' }) !== null) {
    fail('quote handoff: an empty cart still builds an agreement link');
  }
  if (handoff.build({ ...ONE_DAY, package: 'Party for 60', name: '', phone: '' }) !== null) {
    fail('quote handoff: a submission with no name or phone still builds an agreement link');
  }

  // The quote number and the notes line, as they reach the document.
  const carried = agreement.fromBase64Url(
    handoff.build({ ...ONE_DAY, package: 'The Whole Party', fulfillment: 'Delivery & Setup' }),
  ).split('|');
  if (carried.length !== 15) {
    fail(`quote handoff: a built payload decodes to ${carried.length} fields, expected 15`);
  } else {
    if (!/^W-[0-9A-Z]{4,14}$/.test(carried[1])) fail(`quote handoff: quote number "${carried[1]}" is not W- plus a short id`);
    if (carried[14].length > 200) fail(`quote handoff: the notes line is ${carried[14].length} chars, expected under 200`);
    for (const piece of ['Morning of the event', 'Same night after the event', 'Delivery & Setup']) {
      if (!carried[14].includes(piece)) fail(`quote handoff: the notes line does not mention "${piece}"`);
    }
  }
  // No field may carry the separator, or the payload silently gains a field and stops parsing.
  const piped = handoff.build({ ...ONE_DAY, package: 'Party for 60', name: 'Maria | Gonzalez', city: 'Dallas | TX' });
  if (!piped || agreement.fromBase64Url(piped).split('|').length !== 15) {
    fail('quote handoff: a pipe typed into a form field survives into the payload');
  }
}

// The timing selects live in netlify.toml's sed, the mapping tables live in the fragment. A
// renamed option would fall through to the "not sure yet" default and quietly ship a rental
// window nobody picked, so the option values and the mapping keys must be the same set.
if (handoff) {
  for (const [name, table] of [['dropoffTiming', handoff.dropoff], ['pickupTiming', handoff.pickup]]) {
    const block = new RegExp(`<select id="[^"]+" name="${name}">([\\s\\S]*?)</select>`).exec(quotePage);
    if (!block) {
      fail(`${QUOTE_PAGE}: no ${name} select to check the timing mapping against`);
      continue;
    }
    const options = [...block[1].matchAll(/<option value="([^"]*)"/g)].map((m) => decode(m[1]));
    const keys = Object.keys(table);
    for (const option of options) if (!keys.includes(option)) fail(`quote handoff: ${name} option "${option}" has no mapping`);
    for (const key of keys) if (!options.includes(key)) fail(`quote handoff: ${name} maps "${key}", which the page no longer offers`);
  }
}

// The handoff is a /quote/ treatment only, and it must not have disturbed the Netlify form or
// the /thank-you/ fallback the failed-POST path depends on.
const handoffPages = readdirSync(ROOT, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html'))
  .map((e) => join(e.parentPath ?? e.path, e.name).slice(ROOT.length + 1))
  .filter((rel) => read(rel).includes('rr-agreement-handoff'))
  .sort();
if (handoffPages.length !== 1 || handoffPages[0] !== QUOTE_PAGE) {
  fail(`the agreement handoff must appear on ${QUOTE_PAGE} only, found on: ${handoffPages.join(', ') || 'nothing'}`);
}
for (const needle of [
  '<form name="quote" method="POST" action="/thank-you/"',
  '<input type="hidden" name="form-name" value="quote">',
  "window.location.href = hash ? '/agreement/#q=' + hash : '/thank-you/';",
  'form.submit();',
]) {
  if (!quotePage.includes(needle)) fail(`${QUOTE_PAGE}: the handoff no longer posts as before (missing "${needle}")`);
}

// --- /agreement/ stays private and makes no claim it cannot keep -----------
if (!agreementPage.includes('<meta name="robots" content="noindex,nofollow">')) {
  fail(`${AGREEMENT_PAGE}: no noindex,nofollow`);
}
const sitemap = read('sitemap.xml');
if (sitemap.includes('agreement')) fail('sitemap.xml: /agreement/ must not be listed');

// There is no certificate of insurance, so the document may not mention one -- the same rule
// the corporate page carries, and for the same reason: it renders perfectly and is untrue.
const agreementText = decode(
  agreementPage
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).toLowerCase();
if (agreementText.includes('insur')) fail(`${AGREEMENT_PAGE}: visible text contains "insur"`);
// Signing is a request to book, not a booking, and the copy has to keep saying so.
for (const clause of [
  'It becomes a confirmed booking only when Owner confirms availability and receives the deposit.',
  'A deposit of 25% of the confirmed total is then due to reserve the date.',
  'If Owner cannot fulfil the request, no deposit is taken and nothing is owed by either party.',
]) {
  if (!decode(agreementPage).includes(clause)) fail(`${AGREEMENT_PAGE}: the agreement no longer says "${clause}"`);
}

if (problems.length) {
  console.error('assert-new-pages: the new pages are inconsistent with themselves:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `assert-new-pages: ok, 3 pages, ${rows.length} seating rows agree with the calculator, ${plans.length} package rows agree with /inventory/ pricing, ${checkedRows} corporate setup rows agree with (tables x $${TABLE_RATE}) + (chairs x $${CHAIR_RATE}) + $${DELIVERY}, ${visible.length + corpVisible.length} FAQs agree with their schema, no insurance claim on /corporate-event-rentals/, 1 ItemList site-wide, ${handoffChecks} v1 payload checks and ${pkgChecked} package mappings agree between /quote/ and /agreement/`,
);
