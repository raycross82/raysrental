// Fillable Rays Rentals customer-quote document.
//
// Shared by Rentals HQ (/quote/), the quote-number Netlify Function, and
// scripts/assert-generate-quote.mjs. No DOM, no network, no storage — callers
// pass the order in and get priced figures plus a self-contained HTML document
// back. Artwork is injected as URLs or data URIs so a downloaded quote still
// renders with the brand mark and item photos.

export const DEPOSIT_PERCENT = 20;
export const FREE_COOLER_CENTS = 5000;
export const VALID_DAYS = 7;
export const QUOTE_PHONE = '469-571-8720';
export const QUOTE_EMAIL = 'raysrentals1@gmail.com';
export const QUOTE_WEB = 'raysrental.com';

export const RATES = {
  tableSet: 2000,
  tableSetAlt: 1800,
  tablecloth: 300,
  runner: 200,
  table: 800,
  chair: 200,
  speaker: 3000,
  cooler: 1200,
  ice: 300,
};

export const QUOTE_ASSETS = {
  mark: '/assets/img/quote/mark.png',
  table: '/assets/img/quote/item-table.jpg',
  tablecloth: '/assets/img/quote/item-tablecloth.jpg',
  runner: '/assets/img/quote/item-runner.jpg',
  chair: '/assets/img/quote/item-chair.jpg',
  cooler: '/assets/img/quote/item-cooler.jpg',
  speaker: '/assets/img/quote/item-speaker.jpg',
  ice: '/assets/img/quote/item-ice.jpg',
};

// Saved rental catalog. Generated quotes use these names, photos, and default
// rates. Staff can change the rate on a quote (the 6' table set is $20 here;
// some earlier quotes used $18, kept as altRateCents). The cooler is free
// when the other items total $50 or more; extra coolers use rateCents.
export const CATALOG = [
  {
    id: 'table-set',
    name: "6' Table Set",
    detail: '1 Table + 6 Chairs',
    rateCents: RATES.tableSet,
    altRateCents: RATES.tableSetAlt,
    image: 'table',
    qtyUnit: 'Sets',
    max: 80,
  },
  {
    id: 'tablecloth',
    name: 'White Table Cloths',
    detail: '',
    rateCents: RATES.tablecloth,
    image: 'tablecloth',
    max: 300,
  },
  {
    id: 'runner',
    name: 'Table Runners',
    detail: '',
    rateCents: RATES.runner,
    image: 'runner',
    max: 300,
  },
  {
    id: 'table',
    name: 'Folding Table',
    detail: '6 ft rectangular',
    rateCents: RATES.table,
    image: 'table',
    max: 200,
  },
  {
    id: 'chair',
    name: 'Folding Chair',
    detail: 'White resin',
    rateCents: RATES.chair,
    image: 'chair',
    max: 600,
  },
  {
    id: 'speaker',
    name: 'JBL PartyBox 110',
    detail: '',
    rateCents: RATES.speaker,
    image: 'speaker',
    max: 6,
  },
  {
    id: 'cooler',
    name: 'Cooler',
    detail: 'Free on orders $50+',
    rateCents: RATES.cooler,
    image: 'cooler',
    max: 20,
    cooler: true,
  },
  {
    id: 'ice',
    name: 'Bags of Ice',
    detail: '',
    rateCents: RATES.ice,
    image: 'ice',
    max: 80,
  },
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((item) => [item.id, item]));

// The order used to check the document against the attached LaToya quote.
export const SAMPLE_ORDER = {
  customerName: 'LaToya Tucker',
  phone: '(601) 506-1088',
  email: '',
  address: '1716 La Caya Drive, Mansfield, TX',
  rentalDate: '2026-09-19',
  dropoff: 'Evening before the event',
  pickup: 'Morning after the event',
  serviceType: 'Delivery & Setup',
  tables: 4,
  chairs: 25,
  speakers: 1,
  coolers: 1,
  delivery: 20,
  setup: 25,
  discount: 0,
  includeSquareLink: false,
  squarePaymentUrl: '',
};

const CHICAGO = 'America/Chicago';

export function isIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return false;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() + 1 === mo && probe.getUTCDate() === d;
}

export function chicagoDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    key: `${bag.year}-${bag.month}-${bag.day}`,
  };
}

export function addDays(iso, days) {
  if (!isIsoDate(iso)) throw new Error(`Not a calendar date: ${iso}`);
  const [y, mo, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

export function formatLongDate(iso) {
  if (!isIsoDate(iso)) return '—';
  const [y, mo, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, mo - 1, d)));
}

export function formatQuoteNumber(month, day, seq) {
  const n = Math.floor(Number(seq));
  if (!Number.isFinite(n) || n < 1 || n > 99) throw new Error(`Quote sequence out of range: ${seq}`);
  return `RR-${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
}

export function quoteFilename(quoteNumber, ext) {
  const safe = String(quoteNumber || 'quote').replace(/[^A-Za-z0-9-]+/g, '') || 'quote';
  return `Rays-Rentals-Quote-${safe}.${ext}`;
}

// Last issued sequence for a Chicago calendar day, plus the highest sequence
// this caller has already used that day. Returns the next sequence (1–99).
export function allocateSeq(stored, minSeq) {
  const current = Number(stored);
  const have = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  const floorNum = Number(minSeq);
  const floor = Number.isFinite(floorNum) && floorNum > 0 ? Math.floor(floorNum) : 0;
  const seq = Math.max(have, floor) + 1;
  if (seq > 99) {
    const err = new Error('No quote numbers left for this date (RR-MMDD-01 through RR-MMDD-99).');
    err.code = 'EXHAUSTED';
    throw err;
  }
  return seq;
}

export function dollarsToCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatMoney(cents) {
  const n = Math.round(Number(cents) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function qtyOf(value, max = 999) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, max);
}

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

// Staff paste a Square Payment Link. Only http(s) URLs reach the document —
// javascript: and other schemes are rejected so a quote never becomes a script.
export function sanitizePaymentUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  return parsed.toString();
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function catalogLine(image, name, detail, qty, rateCents, qtyUnit, id) {
  return {
    id: id || '',
    image,
    name,
    subs: detail ? [{ text: detail, free: false }] : [],
    qty,
    qtyUnit: qtyUnit || '',
    rateText: formatMoney(rateCents),
    totalText: formatMoney(qty * rateCents),
    free: false,
  };
}

function lineRateCents(item, raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return item.rateCents;
  return Math.max(0, dollarsToCents(text));
}

function freeCoolerLine() {
  return {
    id: 'cooler',
    image: 'cooler',
    name: 'Cooler',
    subs: [
      { text: '(FREE)', free: true },
      { text: 'Included with orders $50+', free: false },
    ],
    qty: 1,
    qtyUnit: '',
    rateText: 'FREE',
    totalText: '$0.00',
    free: true,
  };
}

// Inserts the free cooler (and any paid extras) and returns cents charged for coolers.
function appendCoolers(lines, coolers, coolerRate, qualifyingCents, includeFree) {
  const wantFree = includeFree && qualifyingCents >= FREE_COOLER_CENTS;
  let paidCoolers = coolers;
  let showPromo = false;
  if (wantFree) {
    showPromo = true;
    paidCoolers = Math.max(coolers, 1) - 1;
    lines.push(freeCoolerLine());
  }
  if (paidCoolers) {
    lines.push(catalogLine('cooler', 'Cooler', 'Holds ice + drinks', paidCoolers, coolerRate, '', 'cooler'));
  }
  return { showPromo, coolerCents: paidCoolers * coolerRate };
}

export function priceOrder(input = {}) {
  const lines = [];
  let qualifyingCents = 0;
  let showPromo = false;
  let coolerCents = 0;
  const includeFree = input.includeFreeCooler !== false;

  if (Array.isArray(input.items)) {
    let coolers = 0;
    let coolerRate = RATES.cooler;
    const pending = [];
    for (const row of input.items) {
      const item = CATALOG_BY_ID[row && row.id];
      if (!item) continue;
      const q = qtyOf(row && row.qty, item.max || 999);
      if (item.cooler) {
        coolers = q;
        coolerRate = lineRateCents(item, row && row.rate);
        continue;
      }
      if (!q) continue;
      const rate = lineRateCents(item, row && row.rate);
      qualifyingCents += q * rate;
      pending.push(catalogLine(item.image, item.name, item.detail, q, rate, item.qtyUnit, item.id));
    }
    // Cooler sits where the catalog lists it: after the speaker, before ice.
    const coolerAt = pending.findIndex((line) => line.image === 'ice');
    const head = coolerAt === -1 ? pending : pending.slice(0, coolerAt);
    const tail = coolerAt === -1 ? [] : pending.slice(coolerAt);
    lines.push(...head);
    const cooler = appendCoolers(lines, coolers, coolerRate, qualifyingCents, includeFree);
    showPromo = cooler.showPromo;
    coolerCents = cooler.coolerCents;
    lines.push(...tail);
  } else {
    const tables = qtyOf(input.tables, 200);
    const chairs = qtyOf(input.chairs, 600);
    const speakers = qtyOf(input.speakers, 6);
    const coolers = qtyOf(input.coolers, 20);
    if (tables) lines.push(catalogLine('table', 'Folding Table', '6 ft rectangular', tables, RATES.table, '', 'table'));
    if (chairs) lines.push(catalogLine('chair', 'Folding Chair', 'White resin', chairs, RATES.chair, '', 'chair'));
    if (speakers) lines.push(catalogLine('speaker', 'JBL PartyBox 110', '', speakers, RATES.speaker, '', 'speaker'));
    qualifyingCents = tables * RATES.table + chairs * RATES.chair + speakers * RATES.speaker;
    const cooler = appendCoolers(lines, coolers, RATES.cooler, qualifyingCents, includeFree);
    showPromo = cooler.showPromo;
    coolerCents = cooler.coolerCents;
  }

  const subtotalCents = qualifyingCents + coolerCents;
  const deliveryCents = Math.max(0, dollarsToCents(input.delivery));
  const setupCents = Math.max(0, dollarsToCents(input.setup));
  const discountCents = Math.min(
    subtotalCents + deliveryCents + setupCents,
    Math.max(0, dollarsToCents(input.discount)),
  );
  const totalCents = subtotalCents + deliveryCents + setupCents - discountCents;
  const depositCents = Math.round(totalCents * DEPOSIT_PERCENT / 100);
  const balanceCents = totalCents - depositCents;
  const serviceType = cleanText(input.serviceType) || 'Delivery & Setup';
  const deliveryIncluded = serviceType === 'Free Delivery & Pickup' && deliveryCents === 0;

  const summaryRows = [
    { label: 'Subtotal', value: formatMoney(subtotalCents) },
    { label: 'Delivery', value: deliveryIncluded ? 'Included' : formatMoney(deliveryCents) },
    { label: 'Setup / Teardown', value: formatMoney(setupCents) },
  ];
  if (discountCents > 0) summaryRows.push({ label: 'Discount', value: formatMoney(-discountCents) });

  const rentalDate = isIsoDate(input.rentalDate) ? String(input.rentalDate).trim() : '';
  const paymentUrl = input.includeSquareLink ? sanitizePaymentUrl(input.squarePaymentUrl) : '';

  return {
    customerName: cleanText(input.customerName),
    phone: cleanText(input.phone),
    email: cleanText(input.email),
    address: cleanText(input.address),
    rentalDate,
    dropoff: cleanText(input.dropoff) || 'Evening before the event',
    pickup: cleanText(input.pickup) || 'Morning after the event',
    serviceType,
    lines,
    showPromo,
    deliveryIncluded,
    paymentUrl,
    summaryRows,
    subtotalCents,
    deliveryCents,
    setupCents,
    discountCents,
    totalCents,
    depositCents,
    balanceCents,
    qualifyingCents,
  };
}

function star() {
  return '<svg class="star4" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><polygon fill="#002060" points="12,0.8 14.8,8.2 22.8,8.4 16.6,13.2 19,20.8 12,16.6 5,20.8 7.4,13.2 1.2,8.4 9.2,8.2"/></svg>';
}

function diamond() {
  return '<svg class="diamond" viewBox="0 0 10 10" width="6" height="6" aria-hidden="true"><polygon fill="#002060" points="5,0 10,5 5,10 0,5"/></svg>';
}

function sectionHead(label) {
  return `<div class="section-head-wrap"><div class="section-head"><span>${esc(label)}</span></div><div class="section-head-line"></div></div>`;
}

function itemRows(lines, assets) {
  return lines.map((line) => {
    const src = line.image && assets[line.image] ? assets[line.image] : '';
    const thumb = src
      ? `<img class="item-thumb" src="${esc(src)}" alt="">`
      : '<span class="item-thumb item-thumb-empty" aria-hidden="true"></span>';
    const subs = line.subs.map((sub) => `<div class="item-sub${sub.free ? ' free-sub' : ''}">${esc(sub.text)}</div>`).join('');
    const free = line.free ? ' free' : '';
    const qty = line.qtyUnit
      ? `${esc(line.qty)}<div class="qty-unit">${esc(line.qtyUnit)}</div>`
      : esc(line.qty);
    return `<tr><td><div class="item-cell">${thumb}<div><div class="item-name">${esc(line.name)}</div>${subs}</div></div></td><td class="qty">${qty}</td><td class="rate${free}">${esc(line.rateText)}</td><td class="total${free}">${esc(line.totalText)}</td></tr>`;
  }).join('');
}

const PHONE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#002060" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const MAIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#002060" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
const WEB_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#002060" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
const TRUCK_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 7h11v8H3V7zm11 2h4l3 3v3h-7V9zM6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>';

const QUOTE_CSS = `
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 8.5in;
    background: #fff;
    color: #002060;
    font-family: 'Inter', Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 8.5in;
    min-height: 11in;
    padding: 0.32in 0.42in 0.26in;
    display: flex;
    flex-direction: column;
    position: relative;
    background: #fff;
  }
  .header { display: grid; grid-template-columns: 1.55fr 12px 1fr; align-items: start; gap: 0; }
  .header-left { min-width: 0; }
  .brand { display: flex; align-items: center; gap: 11px; }
  .brand-mark { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1.5px solid #002060; }
  .brand-text { display: flex; flex-direction: column; justify-content: center; }
  .brand-name { font-family: 'Cinzel', 'Libre Baskerville', Georgia, serif; font-weight: 700; font-size: 27px; letter-spacing: 0.06em; color: #002060; line-height: 1.05; }
  .brand-rule { display: flex; align-items: center; gap: 8px; margin: 5px 0 3px; }
  .brand-rule::before, .brand-rule::after { content: ''; flex: 1; height: 1px; background: #002060; }
  .brand-services { font-size: 9px; font-weight: 600; letter-spacing: 0.16em; color: #002060; text-transform: uppercase; text-align: center; }
  .diamond { display: block; flex-shrink: 0; }
  .star4 { display: block; flex-shrink: 0; }
  .contact-under { display: flex; align-items: center; gap: 0; margin-top: 14px; font-size: 9.5px; color: #002060; font-weight: 500; }
  .contact-item { display: flex; align-items: center; gap: 5px; padding: 0 10px; }
  .contact-item:first-child { padding-left: 0; }
  .contact-item + .contact-item { border-left: 1px solid #9bb0d0; }
  .contact-item svg { width: 11px; height: 11px; flex-shrink: 0; }
  .header-vrule { width: 1.5px; background: #002060; align-self: stretch; margin: 2px 0 0; justify-self: center; }
  .quote-meta { text-align: left; padding-left: 14px; }
  .quote-meta h1 { font-size: 16px; font-weight: 800; letter-spacing: 0.1em; color: #002060; margin-bottom: 5px; font-family: 'Inter', Arial, Helvetica, sans-serif; }
  .quote-meta .meta-rule { height: 1.5px; background: #002060; margin-bottom: 7px; }
  .meta-rows { display: grid; grid-template-columns: auto 1fr; column-gap: 16px; row-gap: 3px; }
  .meta-label { font-size: 10px; font-weight: 700; color: #002060; white-space: nowrap; }
  .meta-value { font-size: 10px; font-weight: 500; color: #1a1a1a; text-align: right; white-space: nowrap; }
  .section-block { margin-top: 12px; }
  .section-head-wrap { display: flex; align-items: stretch; margin-bottom: 8px; }
  .section-head { background: #002060; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 6px 20px 6px 12px; transform: skewX(-18deg); transform-origin: left center; flex-shrink: 0; }
  .section-head span { display: inline-block; transform: skewX(18deg); }
  .section-head-line { flex: 1; border-bottom: 1.5px solid #002060; margin-left: 8px; }
  .name-phone { display: grid; grid-template-columns: 1.35fr 1px 0.9fr; gap: 0 14px; align-items: start; margin-bottom: 6px; }
  .v-rule { background: #9bb0d0; width: 1px; align-self: stretch; margin-top: 12px; margin-bottom: 2px; }
  .field { margin-bottom: 6px; min-width: 0; }
  .field-label { font-size: 8.5px; font-weight: 600; color: #002060; letter-spacing: 0.03em; margin-bottom: 2px; }
  .field-value { font-family: 'Libre Baskerville', Georgia, serif; font-size: 11.5px; font-weight: 400; color: #002060; border-bottom: 1.2px solid #002060; padding: 1px 0 3px; min-height: 17px; overflow-wrap: anywhere; }
  .field.full { width: 100%; }
  .event-cols { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0; }
  .event-col { padding: 0 10px; border-right: 1px solid #9bb0d0; text-align: left; min-width: 0; }
  .event-col:first-child { padding-left: 0; }
  .event-col:last-child { border-right: none; padding-right: 0; }
  .event-col .field-value { font-size: 10.5px; border-bottom: 1.2px solid #002060; padding-bottom: 3px; }
  .svc-green { color: #008000; font-family: 'Inter', Arial, Helvetica, sans-serif; font-weight: 700; font-size: 10.5px; }
  .items-wrap { margin-top: 12px; }
  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.items thead th { background: #002060; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 7px 10px; text-align: left; }
  table.items thead th.qty, table.items thead th.rate { text-align: center; }
  table.items thead th.total { text-align: right; }
  table.items col.col-item { width: 52%; }
  table.items col.col-qty { width: 12%; }
  table.items col.col-rate { width: 18%; }
  table.items col.col-total { width: 18%; }
  table.items tbody td { padding: 5px 10px; border-bottom: 1px solid #d0d8e8; vertical-align: middle; font-size: 11px; color: #111; }
  .item-cell { display: flex; align-items: center; gap: 10px; }
  .item-thumb { width: 42px; height: 42px; object-fit: cover; border-radius: 3px; border: 1px solid #ddd; flex-shrink: 0; background: #f5f5f5; display: block; }
  .item-thumb-empty { display: inline-block; }
  .item-name { font-weight: 600; font-size: 11px; color: #002060; line-height: 1.25; overflow-wrap: anywhere; }
  .item-sub { font-size: 9px; font-weight: 400; color: #555; margin-top: 1px; }
  .item-sub.free-sub { font-style: italic; color: #002060; font-weight: 500; }
  .qty, .rate { text-align: center; font-weight: 500; }
  .qty-unit { display: block; font-size: 8px; font-weight: 700; letter-spacing: 0.04em; color: #002060; margin-top: 1px; }
  .total { text-align: right; font-weight: 600; }
  .free { color: #008000 !important; font-weight: 800 !important; }
  .delivery-row { display: flex; align-items: stretch; border: 1px solid #c8d0e0; border-top: none; }
  .delivery-row .left { flex: 1; background: #002060; color: #fff; display: flex; align-items: center; gap: 8px; padding: 7px 12px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; }
  .delivery-row .left svg { width: 16px; height: 16px; fill: #fff; }
  .delivery-row .price { width: 18%; display: flex; align-items: center; justify-content: flex-end; padding: 7px 10px; font-size: 11px; font-weight: 700; color: #002060; background: #fff; border-left: 1px solid #c8d0e0; }
  .bottom { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 14px; margin-top: 12px; }
  .thank-box { border: 1.5px solid #002060; border-radius: 5px; padding: 12px 12px 10px; position: relative; text-align: center; }
  .thank-box .star-top { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 6px; line-height: 0; }
  .thank-title { font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: #002060; margin-bottom: 2px; }
  .thank-sub { font-size: 11px; font-weight: 500; color: #002060; margin-bottom: 4px; }
  .thank-body { font-size: 9.5px; line-height: 1.45; color: #333; }
  .promo-box { margin-top: 10px; border: 1.5px solid #002060; border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; gap: 10px; }
  .promo-box img { width: 40px; height: 40px; object-fit: cover; border-radius: 3px; border: 1px solid #cce5cc; }
  .promo-text { font-size: 12px; font-weight: 800; color: #008000; letter-spacing: 0.04em; }
  .summary { border: 1.5px solid #002060; border-radius: 4px; overflow: hidden; }
  .summary-head { background: #002060; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-align: center; padding: 7px 10px; }
  .summary-body { padding: 8px 14px 10px; }
  .sum-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 0; color: #222; border-bottom: 1px solid #d0d8e8; }
  .sum-row .lbl { font-weight: 500; color: #002060; }
  .sum-row .val { font-weight: 600; color: #002060; }
  .sum-divider { height: 2.5px; background: #002060; margin: 6px 0 8px; }
  .sum-total { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #002060; }
  .sum-total .lbl { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: #002060; }
  .sum-total .val { font-size: 18px; font-weight: 800; color: #002060; }
  .deposit-box { border: 2px solid #008000; border-radius: 4px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .deposit-box .lbl { font-size: 11px; font-weight: 700; color: #008000; }
  .deposit-box .val { font-size: 13px; font-weight: 800; color: #008000; }
  .pay-cta {
    display: block;
    margin: 8px 0 6px;
    padding: 9px 12px;
    background: #002060;
    color: #fff !important;
    text-align: center;
    text-decoration: none;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    border-radius: 4px;
    border: 1.5px solid #002060;
  }
  .pay-cta-note {
    font-size: 9px;
    color: #555;
    text-align: center;
    margin-bottom: 6px;
    line-height: 1.35;
  }
  .balance-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #002060; padding: 2px 2px 0; }
  .doc-footer { margin-top: auto; padding-top: 10px; text-align: center; }
  .footer-rule { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .footer-rule::before, .footer-rule::after { content: ''; flex: 1; height: 1px; background: #002060; }
  .footer-text { font-family: 'Libre Baskerville', Georgia, serif; font-style: italic; font-size: 10.5px; color: #002060; }
  @media print {
    html, body { width: 8.5in; background: #fff; }
    .page { box-shadow: none; }
  }
`;

export function renderQuoteDocument(priced, options = {}) {
  const quoteNumber = cleanText(options.quoteNumber);
  const quoteDate = options.quoteDate;
  if (!quoteNumber) throw new Error('quoteNumber is required');
  if (!isIsoDate(quoteDate)) throw new Error('quoteDate must be YYYY-MM-DD');
  const assets = { ...QUOTE_ASSETS, ...(options.assets || {}) };
  const validUntil = addDays(quoteDate, VALID_DAYS);
  const email = priced.email || '—';
  const address = priced.address || '—';
  const rental = priced.rentalDate ? formatLongDate(priced.rentalDate) : '—';
  const rows = priced.summaryRows.map((row) => `<div class="sum-row"><span class="lbl">${esc(row.label)}</span><span class="val">${esc(row.value)}</span></div>`).join('');
  const promo = priced.showPromo
    ? `<div class="promo-box"><img src="${esc(assets.cooler)}" alt=""><div class="promo-text">1 FREE COOLER INCLUDED!</div></div>`
    : '';
  const payCta = priced.paymentUrl
    ? `<a class="pay-cta" href="${esc(priced.paymentUrl)}" target="_blank" rel="noopener noreferrer">Pay deposit here</a><div class="pay-cta-note">Opens Square to pay the ${DEPOSIT_PERCENT}% deposit of ${esc(formatMoney(priced.depositCents))}.</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Customer Quote — ${esc(quoteNumber)} | Rays Rentals</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&amp;family=Inter:wght@400;500;600;700;800&amp;family=Libre+Baskerville:ital@0;1&amp;display=swap" rel="stylesheet">
<style>${QUOTE_CSS}</style>
</head>
<body>
<div class="page" data-quote-number="${esc(quoteNumber)}">
  <header class="header">
    <div class="header-left">
      <div class="brand">
        <img class="brand-mark" src="${esc(assets.mark)}" alt="Rays Rentals">
        <div class="brand-text">
          <div class="brand-name">RAYS RENTALS</div>
          <div class="brand-rule">${diamond()}</div>
          <div class="brand-services">TABLES &bull; CHAIRS &bull; COOLERS</div>
        </div>
      </div>
      <div class="contact-under">
        <div class="contact-item">${PHONE_ICON}${esc(QUOTE_PHONE)}</div>
        <div class="contact-item">${MAIL_ICON}${esc(QUOTE_EMAIL)}</div>
        <div class="contact-item">${WEB_ICON}${esc(QUOTE_WEB)}</div>
      </div>
    </div>
    <div class="header-vrule" aria-hidden="true"></div>
    <div class="quote-meta">
      <h1>CUSTOMER QUOTE</h1>
      <div class="meta-rule"></div>
      <div class="meta-rows">
        <span class="meta-label">Quote #</span>
        <span class="meta-value">${esc(quoteNumber)}</span>
        <span class="meta-label">Quote Date</span>
        <span class="meta-value">${esc(formatLongDate(quoteDate))}</span>
        <span class="meta-label">Valid Until</span>
        <span class="meta-value">${esc(formatLongDate(validUntil))}</span>
      </div>
    </div>
  </header>
  <div class="section-block">
    ${sectionHead('Customer Information')}
    <div class="cust-fields">
      <div class="name-phone">
        <div class="field"><div class="field-label">Customer Name</div><div class="field-value">${esc(priced.customerName || '—')}</div></div>
        <div class="v-rule"></div>
        <div class="field"><div class="field-label">Phone</div><div class="field-value">${esc(priced.phone || '—')}</div></div>
      </div>
      <div class="field full"><div class="field-label">Email</div><div class="field-value">${esc(email)}</div></div>
      <div class="field full"><div class="field-label">Delivery / Pickup Address</div><div class="field-value">${esc(address)}</div></div>
    </div>
  </div>
  <div class="section-block">
    ${sectionHead('Event Details')}
    <div class="event-cols">
      <div class="event-col"><div class="field-label">Rental Date</div><div class="field-value">${esc(rental)}</div></div>
      <div class="event-col"><div class="field-label">Drop Off Time</div><div class="field-value">${esc(priced.dropoff)}</div></div>
      <div class="event-col"><div class="field-label">Pick Up Time</div><div class="field-value">${esc(priced.pickup)}</div></div>
      <div class="event-col"><div class="field-label">Service Type</div><div class="field-value svc-green">${esc(priced.serviceType)}</div></div>
    </div>
  </div>
  <div class="items-wrap">
    <table class="items">
      <colgroup><col class="col-item"><col class="col-qty"><col class="col-rate"><col class="col-total"></colgroup>
      <thead><tr><th>Item</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="total">Total</th></tr></thead>
      <tbody>${itemRows(priced.lines, assets)}</tbody>
    </table>
    <div class="delivery-row"><div class="left">${TRUCK_ICON}${priced.deliveryIncluded ? 'FREE DELIVERY &amp; PICKUP' : 'DELIVERY &amp; PICKUP'}</div><div class="price${priced.deliveryIncluded ? ' free' : ''}">${priced.deliveryIncluded ? 'INCLUDED' : esc(formatMoney(priced.deliveryCents))}</div></div>
  </div>
  <div class="bottom">
    <div class="left-col">
      <div class="thank-box">
        <div class="star-top">${star()}</div>
        <div class="thank-title">THANK YOU!</div>
        <div class="thank-sub">We appreciate your business!</div>
        <div class="thank-body">A 20% deposit secures your rental items and event date. Availability is first-come, first-served.</div>
      </div>
      ${promo}
    </div>
    <div class="summary">
      <div class="summary-head">QUOTE SUMMARY</div>
      <div class="summary-body">
        ${rows}
        <div class="sum-divider"></div>
        <div class="sum-total"><span class="lbl">TOTAL</span><span class="val">${esc(formatMoney(priced.totalCents))}</span></div>
        <div class="deposit-box"><span class="lbl">${DEPOSIT_PERCENT}% Deposit to Reserve</span><span class="val">${esc(formatMoney(priced.depositCents))}</span></div>
        ${payCta}
        <div class="balance-row"><span>Remaining Balance</span><span>${esc(formatMoney(priced.balanceCents))}</span></div>
      </div>
    </div>
  </div>
  <div class="doc-footer"><div class="footer-rule">${star()}</div><div class="footer-text">Thank you for choosing Rays Rentals.</div></div>
</div>
</body>
</html>`;
}

// --- HQ desk booking + device email/text ---------------------------------
// Pure helpers for /quote/. The page writes localStorage and posts the same
// Supabase app_state row the desk uses; nothing here touches the network.
//
// Drop-off / pick-up clocks match the choices on the Generate Quote form.
// "Evening before the event" is 4:00 PM the calendar day before the rental
// (16:00), the same hour the desk's sample bookings use for an evening drop.
// "Morning after the event" is 8:00 AM the day after (08:00).
// Other labeled choices:
//   Morning of the event     → 9:00 AM on the rental date
//   Afternoon of the event   → 2:00 PM on the rental date
//   Before Noon              → 11:00 AM on the rental date
//   Same night after the event → 9:00 PM on the rental date
//   Next evening             → 5:00 PM the day after
//   Not sure yet / TBD       → the form defaults (evening before, morning after)
// A typed clock ("5:30 PM", "16:00") replaces the label's hour and keeps its day.

const DESK_PER_UNIT = {
  // Catalog detail is "1 Table + 6 Chairs".
  'table-set': { tables: 1, chairs: 6 },
  table: { tables: 1 },
  chair: { chairs: 1 },
  speaker: { speakers: 1 },
  cooler: { coolers: 1 },
};

const NAME_TO_CATALOG = {
  "6' Table Set": 'table-set',
  'Folding Table': 'table',
  'Folding Chair': 'chair',
  'JBL PartyBox 110': 'speaker',
  Cooler: 'cooler',
};

function parseClock(text) {
  const s = String(text || '');
  const ampm = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i.exec(s);
  if (ampm) {
    let h = Number(ampm[1]);
    const min = ampm[2] ? Number(ampm[2]) : 0;
    const pm = /^p/i.test(ampm[3]);
    if (h < 1 || h > 12 || min > 59) return '';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const h24 = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/.exec(s);
  if (!h24) return '';
  return `${String(Number(h24[1])).padStart(2, '0')}:${h24[2]}`;
}

function dropoffPlan(text) {
  const t = String(text || '').toLowerCase();
  if (/evening before|night before/.test(t)) return { day: -1, time: '16:00' };
  if (/morning of/.test(t)) return { day: 0, time: '09:00' };
  if (/afternoon/.test(t)) return { day: 0, time: '14:00' };
  if (/before noon|by noon/.test(t)) return { day: 0, time: '11:00' };
  if (/not sure|\btbd\b/.test(t)) return { day: -1, time: '16:00' };
  if (/\bbefore\b/.test(t)) return { day: -1, time: '16:00' };
  return { day: 0, time: '16:00' };
}

function pickupPlan(text) {
  const t = String(text || '').toLowerCase();
  if (/morning after/.test(t)) return { day: 1, time: '08:00' };
  if (/same night/.test(t)) return { day: 0, time: '21:00' };
  if (/next evening/.test(t)) return { day: 1, time: '17:00' };
  if (/not sure|\btbd\b/.test(t)) return { day: 1, time: '08:00' };
  if (/\b(after|next)\b/.test(t)) return { day: 1, time: '08:00' };
  return { day: 0, time: '21:00' };
}

function atLocal(isoDate, hhmm) {
  return `${isoDate}T${hhmm}`;
}

export function bookingWindow(rentalDate, dropoff, pickup) {
  const date = isIsoDate(rentalDate) ? String(rentalDate).trim() : '';
  if (!date) return { start: '', end: '' };
  const drop = dropoffPlan(dropoff);
  const pick = pickupPlan(pickup);
  let endDate = addDays(date, pick.day);
  const start = atLocal(addDays(date, drop.day), parseClock(dropoff) || drop.time);
  const endTime = parseClock(pickup) || pick.time;
  let end = atLocal(endDate, endTime);
  // A typed pick-up clock can land before drop-off. Step the end date forward
  // until the window is real; three days is enough for any of these labels.
  for (let guard = 0; end <= start && guard < 3; guard += 1) {
    endDate = addDays(endDate, 1);
    end = atLocal(endDate, endTime);
  }
  return { start, end };
}

function extraLabel(line) {
  const qty = Math.round(Number(line.qty) || 0);
  const unit = line.qtyUnit ? ` ${line.qtyUnit}` : '';
  const free = line.free ? ' (free)' : '';
  return `${qty}${unit} ${line.name || 'Item'}${free}`.replace(/\s+/g, ' ').trim();
}

function centsToDollars(cents) {
  return Number((Math.round(Number(cents) || 0) / 100).toFixed(2));
}

export function quoteBookingDraft(priced, quoteNumber) {
  const order = priced || {};
  const items = { tables: 0, chairs: 0, coolers: 0, speakers: 0 };
  const extras = [];
  for (const line of order.lines || []) {
    const id = (line && line.id) || NAME_TO_CATALOG[line && line.name] || '';
    const per = DESK_PER_UNIT[id];
    const qty = Math.max(0, Math.round(Number(line && line.qty) || 0));
    if (!qty) continue;
    if (!per) {
      extras.push(extraLabel(line));
      continue;
    }
    for (const [key, mult] of Object.entries(per)) items[key] += qty * mult;
  }
  const timing = bookingWindow(order.rentalDate, order.dropoff, order.pickup);
  const number = String(quoteNumber || '').trim();
  const dropoff = order.dropoff || 'Evening before the event';
  const pickup = order.pickup || 'Morning after the event';
  const notes = [
    number ? `From ${number}.` : '',
    `Drop-off: ${dropoff}. Pick-up: ${pickup}.`,
    extras.length ? `Also on quote: ${extras.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  return {
    customer: order.customerName || '',
    phone: order.phone || '',
    address: order.address || '',
    start: timing.start,
    end: timing.end,
    items,
    price: centsToDollars(order.totalCents),
    paid: 0,
    status: 'Deposit Due',
    notes,
    quoteNumber: number,
  };
}

export function bookingMatchesQuote(booking, quoteNumber) {
  const number = String(quoteNumber || '').trim();
  if (!booking || !number) return false;
  if (String(booking.quoteNumber || '').trim() === number) return true;
  const notes = String(booking.notes || '');
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)From ${escaped}(?:\\b|[.\\s]|$)`).test(notes);
}

// Same additive rules as migrateStore() in hq/public/index.html. rev stays
// put — only a real save bumps it, or a stale device would look newer than
// the cloud and push over live bookings.
export function migrateTrackerStore(st) {
  if (!st || typeof st !== 'object') return st;
  if (!Array.isArray(st.subs)) st.subs = [];
  const maxId = st.subs.reduce((m, x) => Math.max(m, (+x?.id || 0)), 0);
  if (typeof st.nextSubId !== 'number' || !Number.isFinite(st.nextSubId) || st.nextSubId <= maxId) {
    st.nextSubId = maxId + 1;
  }
  if (!Array.isArray(st.quotes)) st.quotes = [];
  const maxQid = st.quotes.reduce((m, x) => Math.max(m, (+x?.id || 0)), 0);
  if (typeof st.nextQuoteId !== 'number' || !Number.isFinite(st.nextQuoteId) || st.nextQuoteId <= maxQid) {
    st.nextQuoteId = Math.max(1001, maxQid + 1);
  }
  return st;
}

// Mutates store. created is false when this quote number is already a booking
// (quoteNumber field or a "From RR-…" note). Inventory rows the quote does
// not use are stored as 0, matching saveBooking() on the desk.
export function appendQuoteBooking(store, draft) {
  const S = migrateTrackerStore(store);
  if (!S || typeof S !== 'object') return { store: S, booking: null, created: false };
  if (!Array.isArray(S.bookings)) S.bookings = [];
  const number = draft && draft.quoteNumber;
  if (!number) return { store: S, booking: null, created: false };
  const existing = S.bookings.find((b) => bookingMatchesQuote(b, number));
  if (existing) return { store: S, booking: existing, created: false };
  const inventory = Array.isArray(S.inventory) ? S.inventory : [];
  const items = {};
  for (const inv of inventory) {
    if (inv && inv.id) items[inv.id] = 0;
  }
  const missing = [];
  for (const [key, qty] of Object.entries((draft && draft.items) || {})) {
    const n = Math.max(0, Math.round(Number(qty) || 0));
    items[key] = (Number(items[key]) || 0) + n;
    if (n > 0 && inventory.length && !inventory.some((inv) => inv && inv.id === key)) {
      missing.push(`${n} ${key}`);
    }
  }
  let notes = String((draft && draft.notes) || '');
  if (missing.length) notes = `${notes} Not on the desk inventory list: ${missing.join(', ')}.`.trim();
  const maxId = S.bookings.reduce((m, b) => Math.max(m, +b?.id || 0), 0);
  if (typeof S.nextId !== 'number' || !Number.isFinite(S.nextId) || S.nextId <= maxId) S.nextId = maxId + 1;
  const booking = {
    id: S.nextId++,
    customer: (draft && draft.customer) || '',
    phone: (draft && draft.phone) || '',
    address: (draft && draft.address) || '',
    start: (draft && draft.start) || '',
    end: (draft && draft.end) || '',
    items,
    price: Number(draft && draft.price) || 0,
    paid: 0,
    status: 'Deposit Due',
    notes,
    quoteNumber: number,
  };
  S.bookings.push(booking);
  S.rev = (Number(S.rev) || 0) + 1;
  return { store: S, booking, created: true };
}

export function quoteShareSummary(priced, quoteNumber) {
  const order = priced || {};
  const first = String(order.customerName || '').trim().split(/\s+/)[0] || 'there';
  const when = isIsoDate(order.rentalDate) ? formatLongDate(order.rentalDate) : 'the date on the quote';
  return `Hi ${first}, here's your Ray's Rentals quote ${quoteNumber}: total ${formatMoney(order.totalCents)}, deposit ${formatMoney(order.depositCents)} (20%), rental date ${when}.`;
}

export function quoteEmailDraft(priced, quoteNumber) {
  const summary = quoteShareSummary(priced, quoteNumber);
  const file = quoteFilename(quoteNumber, 'pdf');
  return {
    subject: `Ray's Rentals quote ${quoteNumber}`,
    body: `${summary}\n\nThe PDF downloaded to your Downloads folder as ${file}. Attach that file — the mail app can't attach it from this page.`,
  };
}

function encodeBody(body) {
  return encodeURIComponent(body).replace(/'/g, '%27');
}

export function quoteSmsHref(phone, body) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return `sms:${digits}?&body=${encodeBody(body)}`;
}

export function quoteMailtoHref(email, subject, body) {
  const addr = String(email || '').replace(/\s+/g, '');
  return `mailto:${addr}?subject=${encodeBody(subject)}&body=${encodeBody(body)}`;
}
