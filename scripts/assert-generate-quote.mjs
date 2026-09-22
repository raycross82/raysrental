// Build-time checks for Generate Quote.
//
// The staff page at /admin/ prices an order and fills the customer-quote HTML.
// A wrong total here is a number Ray would hand a customer, so the LaToya sample
// (4 tables, 25 chairs, 1 speaker, free cooler, $20 delivery, $25 setup) is
// priced by the same module the page uses and checked to the cent. The quote
// number sequence is checked the same way: RR-MMDD-## increments inside one
// Chicago calendar day and starts over on the next day.
//
// /admin/ is unlisted. It must stay noindex and out of the sitemap, the way
// /agreement/ does, and it must not carry the public quote bar or the
// agreement handoff.

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  SAMPLE_ORDER,
  addDays,
  allocateSeq,
  chicagoDateParts,
  formatMoney,
  formatQuoteNumber,
  priceOrder,
  renderQuoteDocument,
} from '../out/assets/js/quote-doc.js';
import { assignQuoteNumber } from '../netlify/functions/quote-number.mjs';

const problems = [];
const fail = (msg) => problems.push(msg);

const page = readFileSync('out/admin/index.html', 'utf8');
if (!page.includes('<meta name="robots" content="noindex,nofollow">')) fail('admin: missing noindex,nofollow');
if (!page.includes('id="generate-quote"')) fail('admin: Generate Quote button is missing');
if (!page.includes('>Generate Quote<')) fail('admin: button is not labeled Generate Quote');
if (!page.includes('src="/assets/js/admin-quote.js?v=2"')) fail('admin: page script is missing');
if (page.includes('rr-qbar') || page.includes('rr-agreement-handoff')) {
  fail('admin: the public quote bar or agreement handoff leaked onto the staff page');
}
const sitemap = readFileSync('out/sitemap.xml', 'utf8');
if (sitemap.includes('/admin')) fail('sitemap.xml: /admin/ must not be listed');

for (const rel of [
  'out/assets/img/quote/mark.png',
  'out/assets/img/quote/item-table.jpg',
  'out/assets/img/quote/item-chair.jpg',
  'out/assets/img/quote/item-cooler.jpg',
  'out/assets/img/quote/item-speaker.jpg',
  'out/assets/js/vendor/html2canvas.min.js',
  'out/assets/js/vendor/jspdf.umd.min.js',
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
if (!html.includes('>—<') && !html.includes('>— </')) {
  // Email is empty on the sample, so the field shows an em dash.
  if (!html.includes('Email</div><div class="field-value">—</div>')) fail('blank email should render an em dash');
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

const custom = priceOrder({
  custom: [
    { name: "6' Table Set", detail: '1 Table + 6 Chairs', qty: 6, rate: 20 },
    { name: 'Bags of Ice', detail: '', qty: 6, rate: 3 },
  ],
  delivery: 10,
  setup: 20,
});
if (custom.subtotalCents !== 13800 || custom.totalCents !== 16800 || custom.depositCents !== 3360 || custom.balanceCents !== 13440) {
  fail(`custom order priced ${custom.subtotalCents}/${custom.totalCents}/${custom.depositCents}/${custom.balanceCents}`);
}
if (!custom.showPromo) fail('custom order at $138 should include the free cooler');

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

if (problems.length) {
  console.error('assert-generate-quote: Generate Quote is inconsistent:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('assert-generate-quote: ok, LaToya prices to $157.00 with a $31.40 deposit, RR-MMDD-## increments per Chicago day, /admin/ is unlisted');
