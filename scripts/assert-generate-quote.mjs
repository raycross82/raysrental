// Build-time checks for Generate Quote.
//
// The branded quote lives only on Rentals HQ (hq/, published by the
// rays-rentals-hq Netlify site). The public marketing build (out/) must not
// contain the staff page, its script, its artwork, or the quote-number function.
//
// The LaToya sample (4 tables, 25 chairs, 1 speaker, free cooler, $20 delivery,
// $25 setup) is priced by the same module the HQ page uses and checked to the
// cent. Quote numbers are RR-MMDD-## inside one Chicago calendar day.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chdir } from 'node:process';
import { fileURLToPath } from 'node:url';

chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));
import {
  CATALOG,
  SAMPLE_ORDER,
  addDays,
  allocateSeq,
  appendQuoteBooking,
  bookingMatchesQuote,
  bookingWindow,
  chicagoDateParts,
  formatMoney,
  formatQuoteNumber,
  migrateTrackerStore,
  priceOrder,
  quoteBookingDraft,
  quoteEmailDraft,
  quoteMailtoHref,
  quoteShareSummary,
  quoteSmsHref,
  renderQuoteDocument,
  sanitizePaymentUrl,
} from '../hq/public/assets/js/quote-doc.js';
import { assignQuoteNumber } from '../hq/netlify/functions/quote-number.mjs';

const problems = [];
const fail = (msg) => problems.push(msg);

if (existsSync('out/admin') || existsSync('site-overlay/admin')) fail('public site still has /admin');
if (existsSync('out/assets/js/quote-doc.js') || existsSync('out/assets/js/admin-quote.js')) {
  fail('public site still publishes the quote generator scripts');
}
if (existsSync('out/assets/img/quote') || existsSync('netlify/functions')) {
  fail('public site still publishes quote artwork or the quote-number function');
}
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const rel = join(dir, name);
    if (statSync(rel).isDirectory()) walk(rel);
    else if (name.endsWith('.html') || name.endsWith('.js') || name.endsWith('.mjs')) {
      const text = readFileSync(rel, 'utf8');
      if (text.includes('id="generate-quote"') || text.includes('Pay deposit here') || text.includes('admin-quote.js')) {
        fail(`public publish still contains Generate Quote (${rel})`);
      }
    }
  }
}
if (existsSync('out')) {
  walk('out');
  const sitemap = readFileSync('out/sitemap.xml', 'utf8');
  if (sitemap.includes('/admin')) fail('sitemap.xml: /admin/ must not be listed');
}

const page = readFileSync('hq/public/quote/index.html', 'utf8');
const tracker = readFileSync('hq/public/index.html', 'utf8');
if (!page.includes('<meta name="robots" content="noindex,nofollow">')) fail('hq quote: missing noindex,nofollow');
if (!page.includes('id="generate-quote"')) fail('hq quote: Generate Quote button is missing');
if (!page.includes('>Generate Quote<')) fail('hq quote: button is not labeled Generate Quote');
if (!page.includes('src="/assets/js/admin-quote.js?v=5"')) fail('hq quote: page script is missing');
if (!page.includes('id="save-booking"') || !page.includes('>Save as booking<')) fail('hq quote: Save as booking is missing');
if (!page.includes('id="email-quote"') || !page.includes('>Email<')) fail('hq quote: Email is missing');
if (!page.includes('id="text-quote"') || !page.includes('>Text<')) fail('hq quote: Text is missing');
if (!page.includes('id="open-hq"') || !page.includes('id="share-hint"')) fail('hq quote: Open HQ link is missing');
for (const id of ['save-booking', 'email-quote', 'text-quote']) {
  const tag = page.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
  if (!tag || !tag[0].includes('disabled')) fail(`hq quote: ${id} should start disabled`);
}
if (!page.includes('.btn:disabled') || !page.includes('min-height:48px')) {
  fail('hq quote: share buttons need a disabled state and 48px tap targets');
}
if (!page.includes('id="catalog-lines"')) fail('hq quote: catalog picker is missing');
if (!page.includes('Free Delivery &amp; Pickup')) fail('hq quote: Free Delivery & Pickup service is missing');
if (!page.includes('Pay deposit here')) fail('hq quote: payment helper still uses the old Square label');
if (page.includes('id="add-line"') || page.includes('Add a line')) fail('hq quote: free-typed item lines are still offered');
if (!page.includes('id="i-include-square"')) fail('hq quote: Square payment checkbox is missing');
if (!page.includes('Include Square payment link')) fail('hq quote: Square payment label is missing');
if (!page.includes('id="i-square-url"')) fail('hq quote: Square payment URL field is missing');
if (!page.includes('id="square-fields"')) fail('hq quote: Square payment field wrap is missing');
if (!page.includes('href="/"')) fail('hq quote: missing link back to the tracker');
if (page.includes('rr-qbar') || page.includes('rr-agreement-handoff')) {
  fail('hq quote: the public quote bar or agreement handoff leaked onto the staff page');
}
if (!tracker.includes('href="/quote/"')) fail('hq tracker: Generate Quote link is missing');

for (const rel of [
  'hq/public/assets/img/quote/mark.png',
  'hq/public/assets/img/quote/item-table.jpg',
  'hq/public/assets/img/quote/item-tablecloth.jpg',
  'hq/public/assets/img/quote/item-runner.jpg',
  'hq/public/assets/img/quote/item-chair.jpg',
  'hq/public/assets/img/quote/item-cooler.jpg',
  'hq/public/assets/img/quote/item-speaker.jpg',
  'hq/public/assets/img/quote/item-ice.jpg',
  'hq/public/assets/js/vendor/html2canvas.min.js',
  'hq/public/assets/js/vendor/jspdf.umd.min.js',
]) {
  const size = statSync(rel).size;
  if (size < 1000) fail(`${rel} is too small (${size} bytes)`);
}

const priced = priceOrder(SAMPLE_ORDER);
const expectCents = {
  subtotalCents: 11200,
  deliveryCents: 2000,
  setupCents: 2500,
  discountCents: 0,
  totalCents: 15700,
  depositCents: 3140,
  balanceCents: 12560,
};
for (const [key, want] of Object.entries(expectCents)) {
  if (priced[key] !== want) fail(`LaToya ${key} is ${priced[key]}, expected ${want}`);
}
if (!priced.showPromo) fail('LaToya order should include the free cooler');
if (priced.paymentUrl) fail('LaToya sample must not include a Square payment link by default');
if (priced.lines.filter((line) => line.name === 'Cooler' && line.free).length !== 1) {
  fail('LaToya order should have exactly one free cooler line');
}

const html = renderQuoteDocument(priced, {
  quoteNumber: 'RR-0917-01',
  quoteDate: '2026-09-17',
  assets: {
    mark: 'mark.png',
    table: 'item-table.jpg',
    chair: 'item-chair.jpg',
    cooler: 'item-cooler.jpg',
    speaker: 'item-speaker.jpg',
  },
});
for (const needle of [
  'LaToya Tucker',
  '(601) 506-1088',
  '1716 La Caya Drive, Mansfield, TX',
  'September 19, 2026',
  'Evening before the event',
  'Morning after the event',
  'Delivery &amp; Setup',
  'Folding Table',
  '6 ft rectangular',
  '$32.00',
  'Folding Chair',
  '$50.00',
  'JBL PartyBox 110',
  '$30.00',
  'FREE',
  'Included with orders $50+',
  '1 FREE COOLER INCLUDED!',
  'Setup / Teardown',
  '$25.00',
  '$157.00',
  '20% Deposit to Reserve',
  '$31.40',
  '$125.60',
  'RR-0917-01',
  'September 17, 2026',
  'September 24, 2026',
  '469-571-8720',
  'raysrentals1@gmail.com',
  'data-quote-number="RR-0917-01"',
]) {
  if (!html.includes(needle)) fail(`quote document is missing "${needle}"`);
}
if (/945/.test(html)) fail('quote document still contains the retired 945 phone number');
if (html.includes('Pay deposit here') || html.includes('Pay deposit with Square') || html.includes('class="pay-cta"')) {
  fail('sample quote without Square still shows a payment CTA');
}
if (!html.includes('>—<') && !html.includes('>— </')) {
  // Email is empty on the sample, so the field shows an em dash.
  if (!html.includes('Email</div><div class="field-value">—</div>')) fail('blank email should render an em dash');
}

const squareUrl = 'https://square.link/u/exampleDeposit';
const withPay = priceOrder({
  ...SAMPLE_ORDER,
  includeSquareLink: true,
  squarePaymentUrl: squareUrl,
});
if (withPay.paymentUrl !== squareUrl) fail(`Square URL was not kept (got ${withPay.paymentUrl})`);
const payHtml = renderQuoteDocument(withPay, { quoteNumber: 'RR-0917-03', quoteDate: '2026-09-17' });
if (!payHtml.includes('class="pay-cta"')) fail('quote with Square is missing the pay CTA');
if (!payHtml.includes(`href="${squareUrl}"`)) fail('Square CTA does not link to the pasted URL');
if (!payHtml.includes('>Pay deposit here<')) fail('Square CTA label is missing');
if (payHtml.includes('Pay deposit with Square')) fail('Square CTA still uses the old label');
if (!payHtml.includes('target="_blank"') || !payHtml.includes('rel="noopener noreferrer"')) {
  fail('Square CTA must open in a new tab with noopener');
}
if (!payHtml.includes('Opens Square to pay the 20% deposit of $31.40.')) {
  fail('Square CTA note should mention the deposit amount');
}

const offWithUrl = priceOrder({
  ...SAMPLE_ORDER,
  includeSquareLink: false,
  squarePaymentUrl: squareUrl,
});
if (offWithUrl.paymentUrl) fail('Square URL must be ignored when the checkbox is off');
const emptyOn = priceOrder({
  ...SAMPLE_ORDER,
  includeSquareLink: true,
  squarePaymentUrl: '   ',
});
if (emptyOn.paymentUrl) fail('an empty Square URL must not create a payment CTA');
if (sanitizePaymentUrl('javascript:alert(1)')) fail('javascript: URLs must be rejected');
if (sanitizePaymentUrl('not-a-url')) fail('non-URLs must be rejected');
if (sanitizePaymentUrl('https://square.link/u/ok') !== 'https://square.link/u/ok') {
  fail('https Square links must pass through');
}

const hostile = priceOrder({ ...SAMPLE_ORDER, customerName: '<img src=x onerror=alert(1)>' });
const hostileHtml = renderQuoteDocument(hostile, { quoteNumber: 'RR-0917-02', quoteDate: '2026-09-17' });
if (hostileHtml.includes('<img src=x')) fail('customer name was not escaped');
if (!hostileHtml.includes('&lt;img src=x onerror=alert(1)&gt;')) fail('customer name escape changed shape');

const small = priceOrder({ tables: 2, coolers: 1, delivery: 0, setup: 0 });
if (small.showPromo) fail('a $16 order must not include a free cooler');
if (small.subtotalCents !== 2800) fail(`paid cooler subtotal is ${small.subtotalCents}, expected 2800`);
const smallHtml = renderQuoteDocument(small, { quoteNumber: 'RR-0102-01', quoteDate: '2026-01-02' });
if (smallHtml.includes('1 FREE COOLER INCLUDED!')) fail('under-$50 quote still shows the free-cooler promo');

const edge = priceOrder({ chairs: 25 });
if (!edge.showPromo || edge.subtotalCents !== 5000) fail('a $50 item subtotal should include one free cooler and stay $50');
const optedOut = priceOrder({ chairs: 25, coolers: 1, includeFreeCooler: false });
if (optedOut.showPromo || optedOut.subtotalCents !== 6200) fail('opting out of the free cooler should charge $12');

const catalog = Object.fromEntries(CATALOG.map((item) => [item.id, item]));
const expectCatalog = {
  'table-set': { name: "6' Table Set", rateCents: 2000, altRateCents: 1800, image: 'table', qtyUnit: 'Sets' },
  tablecloth: { name: 'White Table Cloths', rateCents: 300, image: 'tablecloth' },
  runner: { name: 'Table Runners', rateCents: 200, image: 'runner' },
  table: { name: 'Folding Table', rateCents: 800, image: 'table' },
  chair: { name: 'Folding Chair', rateCents: 200, image: 'chair' },
  speaker: { name: 'JBL PartyBox 110', rateCents: 3000, image: 'speaker' },
  cooler: { name: 'Cooler', rateCents: 1200, image: 'cooler' },
  ice: { name: 'Bags of Ice', rateCents: 300, image: 'ice' },
};
for (const [id, want] of Object.entries(expectCatalog)) {
  const item = catalog[id];
  if (!item) {
    fail(`catalog is missing ${id}`);
    continue;
  }
  for (const [key, value] of Object.entries(want)) {
    if (item[key] !== value) fail(`catalog ${id}.${key} is ${item[key]}, expected ${value}`);
  }
}

const oneSet = priceOrder({ items: [{ id: 'table-set', qty: 1 }] });
if (oneSet.subtotalCents !== 2000 || oneSet.showPromo) fail('one table set should default to $20 and not include a free cooler');
if (oneSet.lines[0].name !== "6' Table Set" || oneSet.lines[0].rateText !== '$20.00' || oneSet.lines[0].qtyUnit !== 'Sets') {
  fail('table set line did not keep the saved name, rate, and Sets unit');
}

const alejandra = priceOrder({
  items: [
    { id: 'table-set', qty: 6, rate: 20 },
    { id: 'cooler', qty: 1 },
    { id: 'ice', qty: 6 },
  ],
  delivery: 10,
  setup: 20,
  serviceType: 'Setup Requested',
});
if (alejandra.subtotalCents !== 13800 || alejandra.totalCents !== 16800 || alejandra.depositCents !== 3360 || alejandra.balanceCents !== 13440) {
  fail(`catalog order priced ${alejandra.subtotalCents}/${alejandra.totalCents}/${alejandra.depositCents}/${alejandra.balanceCents}`);
}
if (!alejandra.showPromo) fail('catalog order at $138 should include the free cooler');
if (alejandra.lines.map((line) => line.name).join('|') !== "6' Table Set|Cooler|Bags of Ice") {
  fail(`catalog line order changed: ${alejandra.lines.map((line) => line.name).join('|')}`);
}

const clothOrder = priceOrder({
  items: [
    { id: 'table-set', qty: 15, rate: 18 },
    { id: 'tablecloth', qty: 30 },
    { id: 'runner', qty: 30 },
    { id: 'cooler', qty: 1 },
  ],
  serviceType: 'Free Delivery & Pickup',
  delivery: 0,
});
if (clothOrder.subtotalCents !== 42000 || !clothOrder.deliveryIncluded || !clothOrder.showPromo) {
  fail(`cloth order priced ${clothOrder.subtotalCents}, included=${clothOrder.deliveryIncluded}, promo=${clothOrder.showPromo}`);
}
const clothHtml = renderQuoteDocument(clothOrder, { quoteNumber: 'RR-0925-03', quoteDate: '2026-09-22' });
for (const needle of [
  '6&#39; Table Set',
  '1 Table + 6 Chairs',
  'Sets',
  '$18.00',
  'White Table Cloths',
  'Table Runners',
  '$3.00',
  '$2.00',
  'FREE DELIVERY &amp; PICKUP',
  'INCLUDED',
  '>Included<',
]) {
  if (!clothHtml.includes(needle)) fail(`catalog quote is missing "${needle}"`);
}
if (clothHtml.includes('DELIVERY &amp; PICKUP</div><div class="price">$0.00')) {
  fail('free delivery still prints a $0 delivery bar');
}

const discounted = priceOrder({ ...SAMPLE_ORDER, discount: 10 });
if (discounted.totalCents !== 14700 || discounted.depositCents !== 2940) {
  fail(`discounted total ${discounted.totalCents} deposit ${discounted.depositCents}`);
}

if (formatQuoteNumber(9, 17, 1) !== 'RR-0917-01') fail('RR-0917-01 format');
if (formatQuoteNumber(9, 17, 2) !== 'RR-0917-02') fail('RR-0917-02 format');
if (formatQuoteNumber(1, 2, 12) !== 'RR-0102-12') fail('RR-0102-12 format');
if (allocateSeq(0, 0) !== 1 || allocateSeq(1, 0) !== 2) fail('sequence does not increment');
if (allocateSeq(1, 5) !== 6) fail('a higher local sequence did not win');
if (allocateSeq(5, 1) !== 6) fail('a higher stored sequence did not win');
let threw = false;
try { allocateSeq(99, 0); } catch (err) { threw = err.code === 'EXHAUSTED'; }
if (!threw) fail('sequence 99 should refuse another number');
if (addDays('2026-09-17', 7) !== '2026-09-24') fail('valid-until is not 7 days');
if (chicagoDateParts(new Date('2026-09-22T03:30:00Z')).key !== '2026-09-21') fail('Chicago date before midnight');
if (chicagoDateParts(new Date('2026-09-22T05:30:00Z')).key !== '2026-09-22') fail('Chicago date after midnight');
if (formatMoney(3140) !== '$31.40' || formatMoney(-500) !== '-$5.00') fail('money format');

const mem = new Map();
const blob = {
  async get(key) { return mem.has(key) ? mem.get(key) : null; },
  async set(key, value) { mem.set(key, String(value)); },
};
const noon = new Date('2026-09-17T17:00:00Z');
const first = await assignQuoteNumber(blob, {}, noon);
const second = await assignQuoteNumber(blob, { date: '2026-09-17', minSeq: 1 }, noon);
const bumped = await assignQuoteNumber(blob, { date: '2026-09-17', minSeq: 7 }, noon);
const nextDay = await assignQuoteNumber(blob, {}, new Date('2026-09-18T17:00:00Z'));
const ignored = await assignQuoteNumber(blob, { date: '1999-01-01', minSeq: 50 }, noon);
if (first.number !== 'RR-0917-01' || second.number !== 'RR-0917-02') {
  fail(`blob sequence issued ${first.number} then ${second.number}`);
}
if (bumped.number !== 'RR-0917-08') fail(`minSeq did not skip ahead (got ${bumped.number})`);
if (nextDay.number !== 'RR-0918-01') fail(`next day did not reset (got ${nextDay.number})`);
if (ignored.number !== 'RR-0917-09') fail(`a mismatched date was allowed to move the counter (got ${ignored.number})`);

const quoteJs = readFileSync('hq/public/assets/js/admin-quote.js', 'utf8');
const syncUrl = tracker.match(/url:'([^']+)'/);
const syncKey = tracker.match(/key:'([^']+)'/);
const syncId = tracker.match(/\n {2}id:'([^']+)'/);
if (!syncUrl || !quoteJs.includes(syncUrl[1])) fail('quote save does not reuse the HQ Supabase url');
if (!syncKey || !quoteJs.includes(syncKey[1])) fail('quote save does not reuse the HQ Supabase key');
if (!syncId || !quoteJs.includes(syncId[1])) fail('quote save does not reuse the HQ Supabase id');
if (!quoteJs.includes("TRACKER_KEY = 'raysRentalsTracker_v1'")) fail('quote save uses a different bookings store');
if (!quoteJs.includes('quoteSmsHref') || !quoteJs.includes('quoteMailtoHref')) fail('quote email/text is not device mailto/sms');
if (quoteJs.includes('twilio') || quoteJs.includes('gmail.googleapis')) fail('quote send must stay on the device');

const latoya = quoteBookingDraft(priced, 'RR-0917-01');
if (latoya.status !== 'Deposit Due' || latoya.paid !== 0 || latoya.price !== 157) {
  fail(`LaToya booking is ${latoya.status} paid ${latoya.paid} price ${latoya.price}`);
}
if (latoya.items.tables !== 4 || latoya.items.chairs !== 25 || latoya.items.speakers !== 1 || latoya.items.coolers !== 1) {
  fail(`LaToya desk counts ${JSON.stringify(latoya.items)}`);
}
if (latoya.start !== '2026-09-18T16:00' || latoya.end !== '2026-09-20T08:00') {
  fail(`LaToya window ${latoya.start} → ${latoya.end}`);
}
if (!latoya.notes.startsWith('From RR-0917-01.')) fail(`LaToya notes missing quote number: ${latoya.notes}`);
if (!latoya.notes.includes('Drop-off: Evening before the event.') || !latoya.notes.includes('Pick-up: Morning after the event.')) {
  fail(`LaToya notes missing timing: ${latoya.notes}`);
}
if (latoya.notes.includes('Also on quote')) fail('mapped LaToya lines should not be repeated in notes');
if (latoya.customer !== 'LaToya Tucker' || latoya.phone !== '(601) 506-1088') fail('LaToya booking dropped the customer');

const morning = bookingWindow('2026-10-02', 'Morning of the event', 'Same night after the event');
if (morning.start !== '2026-10-02T09:00' || morning.end !== '2026-10-02T21:00') {
  fail(`morning/same-night window ${morning.start} → ${morning.end}`);
}
const typed = bookingWindow('2026-09-19', 'Evening before the event, 5:30 PM', 'Next evening');
if (typed.start !== '2026-09-18T17:30' || typed.end !== '2026-09-20T17:00') {
  fail(`typed clock window ${typed.start} → ${typed.end}`);
}
const beforeNoon = bookingWindow('2026-09-19', 'Before Noon', 'TBD');
if (beforeNoon.start !== '2026-09-19T11:00' || beforeNoon.end !== '2026-09-20T08:00') {
  fail(`noon/TBD window ${beforeNoon.start} → ${beforeNoon.end}`);
}
if (bookingWindow('', 'Evening before the event', 'Morning after the event').start !== '') {
  fail('a missing rental date should leave the booking window blank');
}

const mixed = quoteBookingDraft(priceOrder({
  customerName: 'Mina Cole',
  phone: '469-555-0100',
  email: 'mina@example.com',
  address: '10 Oak St',
  rentalDate: '2026-10-02',
  dropoff: 'Morning of the event',
  pickup: 'Same night after the event',
  items: [
    { id: 'table-set', qty: 2, rate: 20 },
    { id: 'table', qty: 1 },
    { id: 'chair', qty: 3 },
    { id: 'tablecloth', qty: 4 },
    { id: 'runner', qty: 2 },
    { id: 'ice', qty: 5 },
    { id: 'speaker', qty: 1 },
  ],
}), 'RR-1002-04');
if (mixed.items.tables !== 3 || mixed.items.chairs !== 15 || mixed.items.speakers !== 1 || mixed.items.coolers !== 1) {
  fail(`mixed desk counts ${JSON.stringify(mixed.items)}`);
}
if (!mixed.notes.includes('4 White Table Cloths') || !mixed.notes.includes('2 Table Runners') || !mixed.notes.includes('5 Bags of Ice')) {
  fail(`unmapped lines missing from notes: ${mixed.notes}`);
}
if (mixed.notes.includes('Table Set') || mixed.notes.includes('JBL')) fail('mapped lines leaked into notes');

const bare = { bookings: [], rev: 2 };
migrateTrackerStore(bare);
if (!Array.isArray(bare.subs) || bare.nextSubId !== 1 || !Array.isArray(bare.quotes) || bare.nextQuoteId !== 1001 || bare.rev !== 2) {
  fail('migrateTrackerStore changed rev or skipped subs/quotes');
}

const desk = {
  rev: 3,
  nextId: 4,
  bookings: [{ id: 1, customer: 'A', notes: '', quoteNumber: '' }],
  inventory: [
    { id: 'tables', name: 'Tables', qty: 15, price: 8 },
    { id: 'chairs', name: 'Chairs', qty: 90, price: 2 },
    { id: 'coolers', name: 'Coolers', qty: 3, price: 12 },
    { id: 'speakers', name: 'Speakers', qty: 1, price: 30 },
    { id: 'tent', name: 'Tent', qty: 1, price: 40 },
  ],
};
const firstSave = appendQuoteBooking(desk, latoya);
if (!firstSave.created || firstSave.booking.id !== 4 || firstSave.store.nextId !== 5 || firstSave.store.rev !== 4) {
  fail(`first save id ${firstSave.booking && firstSave.booking.id} rev ${firstSave.store.rev}`);
}
if (firstSave.booking.items.tent !== 0 || firstSave.booking.items.tables !== 4 || firstSave.booking.paid !== 0) {
  fail(`saved items ${JSON.stringify(firstSave.booking.items)}`);
}
const secondSave = appendQuoteBooking(firstSave.store, latoya);
if (secondSave.created || secondSave.booking.id !== 4 || secondSave.store.rev !== 4 || secondSave.store.bookings.length !== 2) {
  fail('saving the same quote number created a second booking');
}
const byNote = appendQuoteBooking({
  bookings: [{ id: 9, notes: 'Call first. From RR-0917-01.', customer: 'LaToya Tucker' }],
  nextId: 10,
  rev: 1,
}, latoya);
if (byNote.created || byNote.booking.id !== 9) fail('a From RR- note should count as already saved');
if (!bookingMatchesQuote({ quoteNumber: 'RR-0917-01' }, 'RR-0917-01')) fail('quoteNumber match failed');
if (bookingMatchesQuote({ notes: 'From RR-0917-01' }, 'RR-0917-012')) fail('quote number match was not exact');

const sharePriced = priceOrder({ ...SAMPLE_ORDER, email: 'latoya@example.com' });
const summary = quoteShareSummary(sharePriced, 'RR-0917-01');
for (const bit of ['Hi LaToya', 'RR-0917-01', '$157.00', '$31.40', '(20%)', 'September 19, 2026']) {
  if (!summary.includes(bit)) fail(`share text missing "${bit}"`);
}
if (/agreement|https?:\/\//i.test(summary)) fail('share text invented an agreement link');
const emailed = quoteEmailDraft(sharePriced, 'RR-0917-01');
if (emailed.subject !== "Ray's Rentals quote RR-0917-01") fail(`email subject ${emailed.subject}`);
if (!emailed.body.includes('Downloads') || !emailed.body.includes('Rays-Rentals-Quote-RR-0917-01.pdf')) {
  fail('email body should tell staff to attach the downloaded PDF');
}
const sms = quoteSmsHref('(601) 506-1088', summary);
if (!sms.startsWith('sms:6015061088?&body=') || !sms.includes('%27')) fail(`sms href ${sms.slice(0, 80)}`);
const mailto = quoteMailtoHref('latoya@example.com', emailed.subject, emailed.body);
if (!mailto.startsWith('mailto:latoya@example.com?subject=') || !mailto.includes('body=')) fail('mailto href is wrong');

if (problems.length) {
  console.error('assert-generate-quote: Generate Quote is inconsistent:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('assert-generate-quote: ok, public publish has no Generate Quote, HQ /quote/ prices LaToya to $157.00 with a $31.40 deposit, Pay deposit here stays off unless a Square URL is pasted');
