// Build-time patch for the JSON-LD on /inventory/.
//
// The page is owned by raysrental-deploy.zip, so its schema is patched here rather than
// by shipping a frozen copy in site-overlay/ -- this page carries the live per-day prices
// and an overlay copy would silently mask a re-uploaded archive's price updates. A parser
// is used instead of the sed patches elsewhere in netlify.toml because a mis-escaped sed
// replacement inside a one-line JSON-LD block produces invalid structured data that still
// looks fine in the HTML.
//
// Two things happen here. The CollectionPage in inventory-schema-nodes.json is prepended to
// the @graph, and the archive's own "Ray's Rentals Inventory" ItemList is upgraded IN PLACE:
// product names are aligned with the visible page text, and brand / seller / per-DAY unit
// pricing are filled in. Upgrading the archive's list rather than adding a second one keeps
// exactly one ItemList in the graph -- two lists describing the same seven products is a
// duplicate-entity signal that search engines read as conflicting rather than corroborating.
//
// Everything below is re-parsed and asserted, so an archive re-upload that renames a product,
// changes a price or adds another ItemList fails the build instead of shipping broken data.

import { readFileSync, writeFileSync } from 'node:fs';

const PAGE = 'out/inventory/index.html';
const LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const LIST_NAME = "Ray's Rentals Inventory";
const BUSINESS = 'https://raysrental.com/#business';
const BRAND = { '@type': 'Brand', name: "Ray's Rentals" };
const PER_DAY = { '@type': 'QuantitativeValue', value: 1, unitCode: 'DAY' };
const SELF = 'https://raysrental.com/inventory/';

// Keyed by the name the archive ships. `name` is the visible page text; `url` is the
// booking link for packages, which deep-link into the quote builder.
const UPGRADES = {
  'Folding Table (6 ft)': { name: '6 ft Folding Table', url: SELF, price: '8' },
  'Folding Chair': { name: 'Folding Chair', url: SELF, price: '2' },
  'Drink Cooler': { name: 'Cooler', url: SELF, price: '12' },
  'JBL PartyBox 110 Speaker': { name: 'JBL PartyBox 110', url: SELF, price: '30' },
  'Party for 60 Package': { name: 'Party for 60', url: 'https://raysrental.com/quote/?package=party60', price: '180' },
  'Cookout for 60 Package': { name: 'Cookout for 60', url: 'https://raysrental.com/quote/?package=cookout60', price: '200' },
  'The Whole Party Package': { name: 'The Whole Party', url: 'https://raysrental.com/quote/?package=wholeparty', price: '225' },
};

const fail = (msg) => {
  console.error(`patch-inventory-schema: ${msg}`);
  process.exit(1);
};

const html = readFileSync(PAGE, 'utf8');
const blocks = [...html.matchAll(LD_RE)];
if (blocks.length !== 1) fail(`expected exactly 1 JSON-LD block in ${PAGE}, found ${blocks.length}`);

let doc;
try {
  doc = JSON.parse(blocks[0][1]);
} catch (err) {
  fail(`existing JSON-LD did not parse: ${err.message}`);
}
if (!Array.isArray(doc['@graph'])) fail('existing JSON-LD has no @graph array');

const added = JSON.parse(readFileSync('inventory-schema-nodes.json', 'utf8'));
const before = doc['@graph'].length;
doc['@graph'] = [...added, ...doc['@graph']];

// --- upgrade the archive's ItemList in place ---
const lists = doc['@graph'].filter((n) => n['@type'] === 'ItemList');
if (lists.length !== 1) fail(`expected exactly 1 ItemList to upgrade, found ${lists.length}`);
const list = lists[0];
if (list.name !== LIST_NAME) fail(`ItemList is named "${list.name}", expected "${LIST_NAME}"`);
if (list.itemListElement.length !== 7) fail(`ItemList holds ${list.itemListElement.length} entries, expected 7`);

list.numberOfItems = 7;
list.itemListOrder = 'https://schema.org/ItemListOrderAscending';

for (const entry of list.itemListElement) {
  const product = entry.item;
  const upgrade = UPGRADES[product.name];
  if (!upgrade) fail(`archive shipped an unrecognised product: "${product.name}"`);
  product.name = upgrade.name;
  product.brand = BRAND;

  const offer = product.offers;
  offer.url = upgrade.url;
  offer.seller = { '@id': BUSINESS };

  const spec = offer.priceSpecification;
  if (spec?.['@type'] !== 'UnitPriceSpecification') fail(`${upgrade.name} has no UnitPriceSpecification`);
  spec.unitCode = 'DAY';
  spec.referenceQuantity = { ...PER_DAY };
}

const patched = html.replace(LD_RE, () => `<script type="application/ld+json">${JSON.stringify(doc)}</script>`);
writeFileSync(PAGE, patched);

// --- re-parse what was just written and assert it ---
const graph = JSON.parse([...readFileSync(PAGE, 'utf8').matchAll(LD_RE)][0][1])['@graph'];
if (graph.length !== before + added.length) fail('graph length changed unexpectedly');
if (!graph.some((n) => n['@type'] === 'BreadcrumbList')) fail('existing BreadcrumbList went missing');

const page = graph.find((n) => n['@type'] === 'CollectionPage');
if (page?.dateModified !== '2026-08-10') fail('page-level dateModified is missing');

const final = graph.filter((n) => n['@type'] === 'ItemList');
if (final.length !== 1) fail(`@graph must hold exactly 1 ItemList, found ${final.length}`);
if (final[0].numberOfItems !== 7 || final[0].itemListElement.length !== 7) fail('ItemList is not 7 items');
if (final[0].itemListOrder !== 'https://schema.org/ItemListOrderAscending') fail('itemListOrder is missing');

const expected = new Map(Object.values(UPGRADES).map((u) => [u.name, u]));
for (const entry of final[0].itemListElement) {
  const product = entry.item;
  const offer = product.offers;
  const spec = offer?.priceSpecification;
  const want = expected.get(product.name);
  if (!want) fail(`unexpected product "${product.name}" after upgrade`);
  if (product['@type'] !== 'Product') fail(`${product.name} is not a Product`);
  if (product.brand?.name !== BRAND.name) fail(`${product.name} has no brand`);
  if (offer.url !== want.url) fail(`${product.name} offer url is ${offer.url}, expected ${want.url}`);
  if (offer.availability !== 'https://schema.org/InStock') fail(`${product.name} offer is not InStock`);
  if (offer.seller?.['@id'] !== BUSINESS) fail(`${product.name} offer does not reference the LocalBusiness node`);
  if (spec?.['@type'] !== 'UnitPriceSpecification') fail(`${product.name} lost its UnitPriceSpecification`);
  if (spec.price !== want.price || spec.priceCurrency !== 'USD') fail(`${product.name} is not ${want.price} USD`);
  if (spec.unitText !== 'per day') fail(`${product.name} lost its "per day" unitText`);
  if (spec.unitCode !== 'DAY') fail(`${product.name} is not priced per DAY`);
  if (spec.referenceQuantity?.value !== 1 || spec.referenceQuantity?.unitCode !== 'DAY') {
    fail(`${product.name} has no referenceQuantity of 1 DAY`);
  }
  expected.delete(product.name);
}
if (expected.size) fail(`missing products after upgrade: ${[...expected.keys()].join(', ')}`);

console.log(`patch-inventory-schema: ok, @graph holds ${graph.length} nodes and 1 ItemList of 7 products`);
