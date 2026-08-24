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
const PAGES = [
  { rel: 'seating-calculator/index.html', url: 'https://raysrental.com/seating-calculator/' },
  { rel: 'quinceanera-rentals/index.html', url: 'https://raysrental.com/quinceanera-rentals/' },
];

for (const { rel, url } of PAGES) {
  const html = read(rel);
  if (!html.includes(`<link rel="canonical" href="${url}">`)) fail(`${rel}: canonical is not ${url}`);
  if (!html.includes(`<meta property="og:url" content="${url}">`)) fail(`${rel}: og:url is not ${url}`);
  for (const tag of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    const attr = tag.startsWith('og:') ? 'property' : 'name';
    if (!html.includes(`<meta ${attr}="${tag}"`)) fail(`${rel}: missing ${tag}`);
  }
  if (!/<p class="rr-updated">Updated August 2026<\/p>/.test(html)) fail(`${rel}: no "Updated August 2026" line`);
  if (!/<h1>[\s\S]*?<\/h1>[\s\S]{0,200}?<p class="rr-updated">/.test(html)) fail(`${rel}: the updated line is not under the H1`);

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

if (problems.length) {
  console.error('assert-new-pages: the new pages are inconsistent with themselves:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `assert-new-pages: ok, 2 pages, ${rows.length} seating rows agree with the calculator, ${plans.length} package rows agree with /inventory/ pricing, ${visible.length} FAQs agree with their schema, 1 ItemList site-wide`,
);
