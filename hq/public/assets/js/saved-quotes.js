// One editable record shared by the PDF desk and the HQ Quotes list.
import { CATALOG, priceOrder, quoteBookingDraft, migrateTrackerStore, chicagoDateParts } from './quote-doc.js';

export function newQuoteUid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
const text = value => String(value ?? '').slice(0, 4000);
const money = value => Math.max(0, Math.min(1000000, Number(value) || 0));

export function normalizeOrder(input = {}) {
  const result = {};
  for (const key of ['customerName', 'phone', 'email', 'address', 'rentalDate', 'dropoff', 'pickup', 'serviceType', 'squarePaymentUrl', 'bookingStart', 'bookingEnd']) result[key] = text(input[key]);
  result.items = CATALOG.map(item => {
    const row = (Array.isArray(input.items) ? input.items : []).find(row => row?.id === item.id);
    return { id: item.id, qty: Math.min(item.max || 999, Math.max(0, Math.round(Number(row?.qty) || 0))), rate: row?.rate == null || row.rate === '' ? item.rateCents / 100 : money(row.rate) };
  });
  for (const key of ['delivery', 'setup', 'discount']) result[key] = money(input[key]);
  result.includeFreeCooler = input.includeFreeCooler !== false;
  result.includeSquareLink = !!input.includeSquareLink;
  result.depositPercent = input.depositPercent === 25 ? 25 : 20;
  result.depositWholeDollars = input.depositWholeDollars === true;
  return result;
}

export function orderForQuote(quote) {
  if (quote.document?.version === 1) return normalizeOrder(quote.document.order);
  // The old HQ editor charges per inclusive rental day. Freeze its rates and
  // deposit rule, including its historical whole-dollar deposit rounding.
  const start = String(quote.start || ''), end = String(quote.end || '');
  const delta = (Date.parse(end.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 864e5;
  const days = Number.isFinite(delta) ? Math.max(1, Math.round(delta) + 1) : 1;
  const mapping = { table: ['tables', 8], chair: ['chairs', 2], cooler: ['coolers', 12], speaker: ['speakers', 30] };
  return normalizeOrder({
    customerName: quote.customer, phone: quote.phone, email: quote.email, address: quote.address,
    rentalDate: start.slice(0, 10), dropoff: start.replace('T', ' '), pickup: end.replace('T', ' '),
    bookingStart: start, bookingEnd: end,
    items: Object.entries(mapping).map(([id, [key, rate]]) => ({ id, qty: quote.items?.[key] || 0, rate: rate * days })),
    delivery: quote.delivery, discount: quote.discount, setup: 0,
    includeFreeCooler: false, depositPercent: 25, depositWholeDollars: true,
  });
}

export function savedQuoteTotals(priced) {
  return {
    subtotal: priced.subtotalCents / 100, delivery: priced.deliveryCents / 100,
    setup: priced.setupCents / 100, discount: priced.discountCents / 100,
    total: priced.totalCents / 100, deposit: priced.depositCents / 100, balance: priced.balanceCents / 100,
  };
}

export function upsertSavedQuote(store, draft, now = new Date().toISOString()) {
  migrateTrackerStore(store);
  let existing = draft.uid ? store.quotes.find(q => q.document?.uid === draft.uid) : null;
  if (!existing && draft.id != null) {
    existing = store.quotes.find(q => q.id === draft.id && q.number === draft.number);
    if (!existing) throw new Error('This saved quote was removed or changed. Open Saved quotes before saving again.');
  }
  const order = normalizeOrder(draft.order);
  const priced = priceOrder(order);
  const booking = quoteBookingDraft(priced, draft.number);
  const record = existing || { id: store.nextQuoteId++, status: 'Draft', created: now, sentAt: null, signedAt: null, bookingId: null };
  Object.assign(record, {
    number: text(draft.number), customer: priced.customerName, phone: priced.phone, email: priced.email, address: priced.address,
    start: order.bookingStart || booking.start, end: order.bookingEnd || booking.end,
    items: booking.items, delivery: priced.deliveryCents / 100, discount: priced.discountCents / 100,
    notes: existing?.notes ?? booking.notes,
    updatedAt: now,
    document: { version: 1, uid: text(draft.uid || existing?.document?.uid || newQuoteUid()), date: draft.date || chicagoDateParts(new Date()).key, order, totals: savedQuoteTotals(priced) },
  });
  if (!existing) store.quotes.push(record);
  store.rev = (Number(store.rev) || 0) + 1;
  return { store, quote: record, created: !existing, priced };
}

// PDF metadata contains only quote details, never the HQ store or staff notes.
// ASCII base64 survives jsPDF metadata without PDF-string escaping ambiguity.
export function encodeQuotePdf(quote) {
  const payload = { type: 'rays-rentals-quote', version: 1, uid: quote.document.uid, number: quote.number, date: quote.document.date, order: quote.document.order };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return 'RRHQ1:' + btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')) + ':RRHQEND';
}

export function decodeQuotePdf(bytes) {
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Choose a PDF smaller than 25 MB.');
  const raw = new TextDecoder('latin1').decode(bytes);
  if (!raw.startsWith('%PDF-')) throw new Error('Choose a PDF quote.');
  const encoded = /RRHQ1:([A-Za-z0-9+/=]{1,100000}):RRHQEND/.exec(raw)?.[1];
  if (!encoded) throw new Error('This PDF does not contain editable quote details. Open its saved quote, or enter the details once in New quote. Older PDFs and scanned PDFs cannot be restored automatically.');
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)))); }
  catch { throw new Error('The editable details in this PDF could not be read.'); }
  if (value?.type !== 'rays-rentals-quote' || value.version !== 1 || !/^[A-Za-z0-9-]{1,80}$/.test(value.number) || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !value.uid || !value.order || typeof value.order !== 'object') throw new Error('This PDF has invalid quote details.');
  return { uid: text(value.uid), number: value.number, date: value.date, order: normalizeOrder(value.order) };
}
