// Staff "Generate Quote" behavior for Rentals HQ /quote/.
// Prices the order, takes the next RR-MMDD-## number, fills the quote document,
// keeps an HTML preview on the page, and downloads a letter-size PDF.
// After a quote exists, staff can save it into the HQ bookings store or open
// the device Mail and Messages apps. Nothing is sent through a server.

import {
  CATALOG,
  QUOTE_ASSETS,
  SAMPLE_ORDER,
  allocateSeq,
  appendQuoteBooking,
  chicagoDateParts,
  formatMoney,
  formatQuoteNumber,
  migrateTrackerStore,
  priceOrder,
  quoteBookingDraft,
  quoteEmailDraft,
  quoteFilename,
  quoteMailtoHref,
  quoteShareSummary,
  quoteSmsHref,
  renderQuoteDocument,
  sanitizePaymentUrl,
} from './quote-doc.js';

const STORE_KEY = 'rr-quote-seq-v1';
const FORM_KEY = 'rr-quote-form-v1';
const TRACKER_KEY = 'raysRentalsTracker_v1';
// Same row the desk posts from hq/public/index.html. Do not invent another.
const SYNC = {
  url: 'https://pwanlphumbpnmmcuwnup.supabase.co/rest/v1/app_state',
  key: 'sb_publishable_5Wd5bMXKnQ2PR5ZVpBJCug_Io5WdvG4',
  id: 'main',
};
// Used only when this browser has never opened Rentals HQ. Matches the desk
// seed so the first save does not wipe the sample bookings HQ would have created.
const TRACKER_SEED = {
  inventory: [
    { id: 'tables', name: '6-ft Folding Tables', qty: 15, price: 8 },
    { id: 'chairs', name: 'Folding Chairs', qty: 90, price: 2 },
    { id: 'coolers', name: 'Drink Coolers', qty: 3, price: 12 },
    { id: 'speakers', name: 'JBL PartyBox Speaker', qty: 1, price: 30 },
  ],
  bookings: [
    { id: 1, customer: 'Allie Voelkel', phone: '', address: '4571 Bonfire Dr', start: '2026-07-03T16:00', end: '2026-07-05T08:00', items: { tables: 10, chairs: 60, coolers: 2, speakers: 0 }, price: 195, paid: 195, status: 'Completed', notes: 'Drop off 4pm, pick up 8am' },
    { id: 2, customer: 'Emily Tully', phone: '', address: '431 Mayrant Dr', start: '2026-07-04T00:00', end: '2026-07-05T09:30', items: { tables: 5, chairs: 24, coolers: 0, speakers: 0 }, price: 90, paid: 90, status: 'Completed', notes: 'Drop off Friday night, pick up 9:30am' },
    { id: 3, customer: 'Lleana Salamanca', phone: '', address: '1326 Greenfield Dr', start: '2026-07-05T08:30', end: '2026-07-06T17:00', items: { tables: 5, chairs: 30, coolers: 0, speakers: 0 }, price: 115, paid: 115, status: 'Completed', notes: 'Drop off 8:30am, pick up 5–7pm' },
  ],
  leads: [],
  nextId: 4,
  nextLeadId: 1,
  subs: [],
  nextSubId: 1,
  settings: { orderUrl: '' },
};

const $ = (id) => document.getElementById(id);

let assets = { ...QUOTE_ASSETS };
let memoryStore = { days: {}, issued: [] };
let lastHtml = '';
let lastNumber = '';
let lastPriced = null;
let savedNumber = '';
let busy = false;
let saving = false;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { days: { ...memoryStore.days }, issued: memoryStore.issued.slice() };
    const data = JSON.parse(raw);
    const days = data && data.days && typeof data.days === 'object' ? data.days : {};
    const issued = data && Array.isArray(data.issued) ? data.issued.slice(0, 40) : [];
    return { days, issued };
  } catch {
    return { days: { ...memoryStore.days }, issued: memoryStore.issued.slice() };
  }
}

function saveStore(store) {
  memoryStore = {
    days: { ...store.days },
    issued: store.issued.slice(0, 40),
  };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(memoryStore));
  } catch {
    /* private mode: the in-memory copy still increments for this visit */
  }
}

function status(message, kind) {
  const el = $('quote-status');
  el.textContent = message;
  el.className = 'gq-status' + (kind ? ' is-' + kind : '');
}

function moneyInput(cents) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function catalogNote(item) {
  const price = moneyInput(item.rateCents);
  if (item.id === 'table-set') return `${item.detail} · default $${price} (also used at $18)`;
  if (item.cooler) return 'Free when the other items total $50 or more · extra coolers $' + price;
  if (item.detail) return `${item.detail} · $${price}`;
  return `$${price}`;
}

function buildCatalog() {
  const wrap = $('catalog-lines');
  wrap.replaceChildren();
  for (const item of CATALOG) {
    const row = document.createElement('div');
    row.className = 'catalog-row';
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = QUOTE_ASSETS[item.image];
    img.alt = '';
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('b');
    name.textContent = item.name;
    const note = document.createElement('span');
    note.textContent = catalogNote(item);
    info.append(name, note);
    const rateWrap = document.createElement('label');
    rateWrap.className = 'rate-field';
    rateWrap.append(document.createTextNode('Rate $'));
    const rate = document.createElement('input');
    rate.id = 'rate-' + item.id;
    rate.type = 'number';
    rate.min = '0';
    rate.step = '0.01';
    rate.inputMode = 'decimal';
    rate.value = moneyInput(item.rateCents);
    rate.setAttribute('aria-label', item.name + ' rate');
    rateWrap.append(rate);
    const qty = document.createElement('div');
    qty.className = 'qty-ctl';
    const down = document.createElement('button');
    down.type = 'button';
    down.dataset.q = item.id;
    down.dataset.d = '-1';
    down.setAttribute('aria-label', 'Fewer ' + item.name);
    down.textContent = '–';
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'q-' + item.id;
    input.min = '0';
    input.max = String(item.max);
    input.value = '0';
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', item.name + ' quantity');
    const up = document.createElement('button');
    up.type = 'button';
    up.dataset.q = item.id;
    up.dataset.d = '1';
    up.setAttribute('aria-label', 'More ' + item.name);
    up.textContent = '+';
    qty.append(down, input, up);
    row.append(img, info, rateWrap, qty);
    wrap.append(row);
    for (const button of [down, up]) {
      button.addEventListener('click', () => {
        const el = $('q-' + button.dataset.q);
        setQty(el.id, (Number(el.value) || 0) + Number(button.dataset.d));
      });
    }
  }
}

function syncSquareFields(opts = {}) {
  const on = $('i-include-square').checked;
  $('square-fields').hidden = !on;
  $('i-square-url').disabled = !on;
  if (on && opts.focus) $('i-square-url').focus({ preventScroll: true });
}

function readOrder() {
  return {
    customerName: $('i-name').value,
    phone: $('i-phone').value,
    email: $('i-email').value,
    address: $('i-address').value,
    rentalDate: $('i-date').value,
    dropoff: $('i-dropoff').value,
    pickup: $('i-pickup').value,
    serviceType: $('i-service').value,
    items: CATALOG.map((item) => ({
      id: item.id,
      qty: $('q-' + item.id).value,
      rate: $('rate-' + item.id).value,
    })),
    delivery: $('i-delivery').value,
    setup: $('i-setup').value,
    discount: $('i-discount').value,
    includeFreeCooler: $('i-free-cooler').checked,
    includeSquareLink: $('i-include-square').checked,
    squarePaymentUrl: $('i-square-url').value,
  };
}

function renderSidebar(priced) {
  const lines = $('cart-lines');
  lines.replaceChildren();
  if (!priced.lines.length) {
    const p = document.createElement('p');
    p.className = 'note';
    p.id = 'cart-empty';
    p.textContent = 'Add tables, chairs, or another item to price this order.';
    lines.appendChild(p);
  } else {
    for (const line of priced.lines) {
      const row = document.createElement('div');
      row.className = 'sline';
      const name = document.createElement('span');
      name.textContent = `${line.qty} × ${line.name}`;
      const val = document.createElement('span');
      val.textContent = line.free ? 'FREE' : line.totalText;
      row.append(name, val);
      lines.appendChild(row);
    }
  }
  $('s-subtotal').textContent = formatMoney(priced.subtotalCents);
  $('s-delivery').textContent = formatMoney(priced.deliveryCents);
  $('s-setup').textContent = formatMoney(priced.setupCents);
  const discountRow = $('s-discount-row');
  if (priced.discountCents > 0) {
    discountRow.hidden = false;
    $('s-discount').textContent = formatMoney(-priced.discountCents);
  } else {
    discountRow.hidden = true;
  }
  $('s-total').textContent = formatMoney(priced.totalCents);
  $('s-deposit').textContent = formatMoney(priced.depositCents);
  $('s-balance').textContent = formatMoney(priced.balanceCents);
  const note = $('s-cooler-note');
  if (priced.showPromo) {
    note.hidden = false;
    note.textContent = '1 free cooler included — item subtotal is $50 or more.';
  } else if (priced.qualifyingCents > 0 && priced.qualifyingCents < 5000) {
    note.hidden = false;
    note.textContent = `Item subtotal is ${formatMoney(priced.qualifyingCents)}. A cooler is free at $50.`;
  } else {
    note.hidden = true;
    note.textContent = '';
  }
}

function refresh() {
  renderSidebar(priceOrder(readOrder()));
}

function setQty(id, next) {
  const el = $(id);
  const max = Number(el.max) || 999;
  el.value = String(Math.max(0, Math.min(max, next)));
  refresh();
}

function applyOrder(order) {
  $('i-name').value = order.customerName || '';
  $('i-phone').value = order.phone || '';
  $('i-email').value = order.email || '';
  $('i-address').value = order.address || '';
  $('i-date').value = order.rentalDate || '';
  $('i-dropoff').value = order.dropoff || 'Evening before the event';
  $('i-pickup').value = order.pickup || 'Morning after the event';
  $('i-service').value = order.serviceType || 'Delivery & Setup';
  const chosen = new Map();
  if (Array.isArray(order.items)) {
    for (const row of order.items) chosen.set(row.id, row);
  } else {
    const legacy = {
      table: order.tables,
      chair: order.chairs,
      speaker: order.speakers,
      cooler: order.coolers,
    };
    for (const [id, qty] of Object.entries(legacy)) {
      if (qty) chosen.set(id, { id, qty });
    }
  }
  for (const item of CATALOG) {
    const row = chosen.get(item.id);
    $('q-' + item.id).value = row && row.qty ? row.qty : 0;
    const rate = row && row.rate != null && row.rate !== '' ? row.rate : moneyInput(item.rateCents);
    $('rate-' + item.id).value = rate;
  }
  $('i-delivery').value = order.delivery == null ? 0 : order.delivery;
  $('i-setup').value = order.setup == null ? 0 : order.setup;
  $('i-discount').value = order.discount == null ? 0 : order.discount;
  $('i-free-cooler').checked = order.includeFreeCooler !== false;
  $('i-include-square').checked = !!order.includeSquareLink;
  $('i-square-url').value = order.squarePaymentUrl || '';
  syncSquareFields();
  refresh();
}

function renderLog() {
  const list = $('quote-log');
  const store = loadStore();
  list.replaceChildren();
  if (!store.issued.length) {
    const li = document.createElement('li');
    li.className = 'note';
    li.textContent = 'No quotes from this browser yet.';
    list.appendChild(li);
    return;
  }
  for (const entry of store.issued) {
    const li = document.createElement('li');
    const num = document.createElement('b');
    num.textContent = entry.number;
    li.append(num, document.createTextNode(` · ${entry.customer || 'Customer'} · ${entry.total || ''}`));
    list.appendChild(li);
  }
}

function blobDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadAssets() {
  const next = { ...QUOTE_ASSETS };
  await Promise.all(Object.entries(QUOTE_ASSETS).map(async ([key, url]) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(url);
    next[key] = await blobToDataUrl(await res.blob());
  }));
  assets = next;
}

function validate(order, priced) {
  if (!order.customerName) return 'Enter the customer name.';
  if (!order.phone) return 'Enter a phone number.';
  if (!order.rentalDate) return 'Enter the rental date.';
  if (!priced.lines.length) return 'Add at least one rental item.';
  for (const id of ['i-delivery', 'i-setup', 'i-discount']) {
    const raw = $(id).value.trim();
    if (raw && !Number.isFinite(Number(raw))) return 'Delivery, setup, and discount need to be dollar amounts.';
    if (Number(raw) < 0) return 'Delivery, setup, and discount can’t be negative.';
  }
  for (const item of CATALOG) {
    const raw = $('rate-' + item.id).value.trim();
    if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      return item.name + ' needs a rate of $0 or more.';
    }
  }
  if (order.includeSquareLink) {
    const typed = String(order.squarePaymentUrl || '').trim();
    if (typed && !sanitizePaymentUrl(typed)) {
      return 'The Square link needs to be a full http:// or https:// URL.';
    }
  }
  return '';
}

async function requestNumber(parts, minSeq) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/.netlify/functions/quote-number', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: parts.key, minSeq }),
        signal: AbortSignal.timeout(4000),
      });
      // 404/405/501 means this host has no function. Retrying will not create one.
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        const missing = new Error('Quote number service is not available on this host');
        missing.permanent = true;
        throw missing;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !/^RR-\d{4}-\d{2}$/.test(data.number) || !data.date) throw new Error('Bad quote number');
      return { number: data.number, seq: data.seq, date: data.date, source: 'site' };
    } catch (err) {
      lastError = err;
      if (err && err.permanent) break;
    }
  }
  throw lastError || new Error('Quote number service unavailable');
}

async function takeNumber() {
  const parts = chicagoDateParts(new Date());
  const store = loadStore();
  const minSeq = Number(store.days[parts.key]) || 0;
  try {
    const assigned = await requestNumber(parts, minSeq);
    store.days[assigned.date] = Math.max(Number(store.days[assigned.date]) || 0, Number(assigned.seq) || 0);
    return { assigned, store };
  } catch {
    const seq = allocateSeq(store.days[parts.key], 0);
    store.days[parts.key] = seq;
    return {
      assigned: {
        number: formatQuoteNumber(parts.month, parts.day, seq),
        seq,
        date: parts.key,
        source: 'browser',
      },
      store,
    };
  }
}

function fitPreview() {
  const frame = $('quote-frame');
  const shell = $('preview-scale');
  if (!frame.srcdoc) return;
  const width = shell.clientWidth || 816;
  const scale = Math.min(1, width / 816);
  const height = parseInt(frame.style.height, 10) || 1056;
  frame.style.transform = `scale(${scale})`;
  shell.style.height = `${Math.ceil(height * scale)}px`;
}

function showPreview(html) {
  const frame = $('quote-frame');
  frame.onload = () => {
    const page = frame.contentDocument && frame.contentDocument.querySelector('.page');
    frame.style.height = `${page ? page.scrollHeight : 1056}px`;
    fitPreview();
  };
  frame.srcdoc = html;
  $('preview-wrap').hidden = false;
}

async function downloadPdf(html, filename) {
  if (typeof window.html2canvas !== 'function' || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('PDF library did not load');
  }
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:0;top:0;width:8.5in;height:11in;border:0;opacity:0;pointer-events:none;z-index:-1';
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Preview failed'));
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument;
    if (doc.fonts && doc.fonts.ready) {
      await Promise.race([doc.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2500))]);
    }
    const page = doc.querySelector('.page');
    const canvas = await window.html2canvas(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: page.scrollWidth,
      height: page.scrollHeight,
    });
    const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    const pageW = 612;
    const pageH = 792;
    const slicePx = Math.round(canvas.width * (pageH / pageW));
    let pages = Math.max(1, Math.ceil(canvas.height / slicePx));
    if (canvas.height / slicePx < 1.03) pages = 1;
    for (let i = 0; i < pages; i++) {
      if (i) pdf.addPage();
      const sy = i * slicePx;
      const sh = Math.min(slicePx, canvas.height - sy);
      const slice = doc.createElement('canvas');
      slice.width = canvas.width;
      slice.height = pages === 1 ? canvas.height : sh;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, pages === 1 ? 0 : sy, canvas.width, pages === 1 ? canvas.height : sh, 0, 0, canvas.width, pages === 1 ? canvas.height : sh);
      const drawH = pages === 1 ? pageH : (sh / canvas.width) * pageW;
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageW, drawH);
    }
    pdf.save(filename);
  } finally {
    iframe.remove();
  }
}

function downloadHtml() {
  if (!lastHtml) return;
  blobDownload(quoteFilename(lastNumber, 'html'), new Blob([lastHtml], { type: 'text/html;charset=utf-8' }));
}

function printQuote() {
  if (!lastHtml) return;
  const blob = new Blob([lastHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    status('Allow pop-ups to print, or use Download PDF.', 'err');
    return;
  }
  const kick = () => {
    win.focus();
    win.print();
  };
  win.addEventListener('load', () => setTimeout(kick, 250));
}

async function generate() {
  if (busy) return;
  const order = readOrder();
  const priced = priceOrder(order);
  const problem = validate(order, priced);
  if (problem) {
    status(problem, 'err');
    return;
  }
  busy = true;
  $('generate-quote').disabled = true;
  status('Assigning quote number…', '');
  try {
    const { assigned, store } = await takeNumber();
    const html = renderQuoteDocument(priced, {
      quoteNumber: assigned.number,
      quoteDate: assigned.date,
      assets,
    });
    lastHtml = html;
    lastNumber = assigned.number;
    lastPriced = priced;
    if (savedNumber !== assigned.number) savedNumber = '';
    syncShareButtons();
    store.issued = [{
      number: assigned.number,
      customer: priced.customerName,
      total: formatMoney(priced.totalCents),
      at: new Date().toISOString(),
      source: assigned.source,
    }, ...store.issued].slice(0, 40);
    saveStore(store);
    renderLog();
    showPreview(html);
    $('download-pdf').disabled = false;
    $('download-html').disabled = false;
    $('print-quote').disabled = false;
    const where = assigned.source === 'site'
      ? 'Saved for the whole site.'
      : 'Saved in this browser only — the shared site counter could not be reached.';
    status(`${assigned.number} is ready. ${where}`, 'ok');
    $('preview-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      await downloadPdf(html, quoteFilename(assigned.number, 'pdf'));
    } catch {
      status(`${assigned.number} is in the preview. The PDF download didn’t finish — use Print and choose Save as PDF.`, 'err');
    }
  } catch (err) {
    status(err && err.message ? err.message : 'Could not generate the quote.', 'err');
  } finally {
    busy = false;
    $('generate-quote').disabled = false;
  }
}

function persistForm() {
  try {
    sessionStorage.setItem(FORM_KEY, JSON.stringify(readOrder()));
  } catch {
    /* ignore */
  }
}

buildCatalog();

$('order-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  generate();
});
$('order-form').addEventListener('input', () => {
  refresh();
  persistForm();
});
$('order-form').addEventListener('change', () => {
  refresh();
  persistForm();
});
$('i-include-square').addEventListener('change', () => {
  syncSquareFields({ focus: true });
  persistForm();
});
$('load-sample').addEventListener('click', () => {
  applyOrder(SAMPLE_ORDER);
  persistForm();
  status('Sample order loaded. Generate Quote assigns today’s next number. Square stays off.', '');
});
$('clear-order').addEventListener('click', () => {
  applyOrder({
    dropoff: 'Evening before the event',
    pickup: 'Morning after the event',
    serviceType: 'Delivery & Setup',
    delivery: 0,
    setup: 0,
    discount: 0,
    includeFreeCooler: true,
    includeSquareLink: false,
    squarePaymentUrl: '',
  });
  persistForm();
  status('', '');
});
function phoneDigits(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function syncShareButtons() {
  const ready = !!(lastNumber && lastPriced);
  const email = ready && String(lastPriced.email || '').trim();
  const phone = ready && phoneDigits(lastPriced.phone);
  const saveBtn = $('save-booking');
  const emailBtn = $('email-quote');
  const textBtn = $('text-quote');
  if (!saveBtn || !emailBtn || !textBtn) return;
  saveBtn.disabled = !ready || saving;
  saveBtn.textContent = ready && savedNumber === lastNumber ? 'Saved as booking' : 'Save as booking';
  emailBtn.disabled = !email;
  textBtn.disabled = !phone;
  emailBtn.title = email ? `Email ${lastNumber}` : 'No email on this quote';
  textBtn.title = phone ? `Text ${lastNumber}` : 'No phone number on this quote';
  const hint = $('share-hint');
  if (!hint) return;
  if (!ready) {
    hint.textContent = 'Save, email, and text turn on after Generate Quote. Saved bookings show on Rentals HQ.';
  } else if (savedNumber === lastNumber) {
    hint.textContent = `${lastNumber} is already a Deposit Due booking. Open HQ to see it.`;
  } else if (!email && !phone) {
    hint.textContent = `${lastNumber} is ready. Add a phone or email and generate again to text or email it.`;
  } else if (!email) {
    hint.textContent = `${lastNumber} is ready to save or text. No email on this quote.`;
  } else if (!phone) {
    hint.textContent = `${lastNumber} is ready to save or email. No phone number on this quote.`;
  } else {
    hint.textContent = `${lastNumber} is ready. Save it as a booking, or email / text the summary. Attach the PDF from Downloads.`;
  }
}

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;top:76px;transform:translateX(-50%);background:#1b2a4a;color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:700;z-index:300;box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;max-width:min(92vw,440px);text-align:center';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
}

function syncHeaders() {
  return { apikey: SYNC.key, Authorization: 'Bearer ' + SYNC.key, 'Content-Type': 'application/json' };
}

function loadTracker() {
  let S = null;
  try {
    S = JSON.parse(localStorage.getItem(TRACKER_KEY) || 'null');
  } catch {
    S = null;
  }
  if (!S || typeof S !== 'object' || Array.isArray(S)) S = structuredClone(TRACKER_SEED);
  if (!S.settings || typeof S.settings !== 'object') S.settings = { orderUrl: '' };
  migrateTrackerStore(S);
  if (!Array.isArray(S.bookings)) S.bookings = [];
  if (!Array.isArray(S.inventory)) S.inventory = structuredClone(TRACKER_SEED.inventory);
  return S;
}

async function cloudPull() {
  if (location.protocol === 'file:') return undefined;
  const r = await fetch(`${SYNC.url}?id=eq.${SYNC.id}&select=data,updated_at`, {
    headers: syncHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) return undefined;
  const rows = await r.json();
  return rows[0] || null;
}

async function cloudPush(S) {
  if (location.protocol === 'file:') return false;
  const r = await fetch(`${SYNC.url}?on_conflict=id`, {
    method: 'POST',
    headers: { ...syncHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ id: SYNC.id, data: S, updated_at: new Date().toISOString() }]),
  });
  return r.ok;
}

async function freshestTracker() {
  const local = loadTracker();
  // canPush stays false when the pull fails. The desk does the same: an
  // unanswered cloud read must not POST a local copy over newer bookings.
  try {
    const remote = await cloudPull();
    if (remote === undefined) return { store: local, canPush: false };
    const remoteRev = remote && remote.data ? Number(remote.data.rev) || 0 : 0;
    if (remote && remote.data && typeof remote.data === 'object' && remoteRev > (Number(local.rev) || 0)) {
      const S = remote.data;
      if (!S.settings || typeof S.settings !== 'object') S.settings = { orderUrl: '' };
      migrateTrackerStore(S);
      if (!Array.isArray(S.bookings)) S.bookings = [];
      if (!Array.isArray(S.inventory)) S.inventory = structuredClone(TRACKER_SEED.inventory);
      return { store: S, canPush: true };
    }
    return { store: local, canPush: true };
  } catch {
    return { store: local, canPush: false };
  }
}

async function saveAsBooking() {
  if (saving || !lastPriced || !lastNumber) return;
  saving = true;
  syncShareButtons();
  const number = lastNumber;
  try {
    const draft = quoteBookingDraft(lastPriced, number);
    const { store, canPush } = await freshestTracker();
    const result = appendQuoteBooking(store, draft);
    if (!result.created) {
      savedNumber = number;
      try {
        localStorage.setItem(TRACKER_KEY, JSON.stringify(result.store));
      } catch {
        /* private mode */
      }
      toast(`${number} is already saved as a booking.`);
      status(`${number} is already on Rentals HQ. Open HQ to see it.`, 'ok');
      syncShareButtons();
      return;
    }
    try {
      localStorage.setItem(TRACKER_KEY, JSON.stringify(result.store));
    } catch {
      status('This browser blocked saving the booking. Turn private mode off and try again.', 'err');
      toast('Could not save the booking in this browser.');
      return;
    }
    savedNumber = number;
    let synced = false;
    if (canPush) {
      try {
        synced = await cloudPush(result.store);
      } catch {
        synced = false;
      }
    }
    toast(`${number} saved as a booking.`);
    status(
      synced
        ? `${number} saved as Deposit Due. Open HQ to see it.`
        : `${number} saved on this device. Cloud sync didn’t finish — it still shows on HQ here.`,
      'ok',
    );
  } catch (err) {
    status(err && err.message ? err.message : 'Could not save the booking.', 'err');
  } finally {
    saving = false;
    syncShareButtons();
  }
}

function emailQuote() {
  if (!lastPriced || !lastNumber) return;
  const email = String(lastPriced.email || '').trim();
  if (!email) {
    alert('No email on this quote.');
    status('No email on this quote.', 'err');
    return;
  }
  const draft = quoteEmailDraft(lastPriced, lastNumber);
  window.location.href = quoteMailtoHref(email, draft.subject, draft.body);
}

function textQuote() {
  if (!lastPriced || !lastNumber) return;
  const phone = String(lastPriced.phone || '').trim();
  if (!phoneDigits(phone)) {
    alert('No phone number entered.');
    status('No phone number entered.', 'err');
    return;
  }
  window.location.href = quoteSmsHref(phone, quoteShareSummary(lastPriced, lastNumber));
}

$('generate-quote').addEventListener('click', generate);
$('save-booking').addEventListener('click', saveAsBooking);
$('email-quote').addEventListener('click', emailQuote);
$('text-quote').addEventListener('click', textQuote);
$('download-pdf').addEventListener('click', async () => {
  if (!lastHtml) return;
  $('download-pdf').disabled = true;
  try {
    await downloadPdf(lastHtml, quoteFilename(lastNumber, 'pdf'));
  } catch {
    status('PDF download didn’t finish. Use Print and choose Save as PDF.', 'err');
  } finally {
    $('download-pdf').disabled = false;
  }
});
$('download-html').addEventListener('click', downloadHtml);
$('print-quote').addEventListener('click', printQuote);
window.addEventListener('resize', fitPreview);

(async function init() {
  status('Loading brand artwork…', '');
  try {
    await loadAssets();
  } catch {
    status('Brand artwork did not load. Quotes will still generate with image links.', 'err');
  }
  let restored = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(FORM_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      applyOrder(saved);
      restored = true;
    }
  } catch {
    restored = false;
  }
  if (!restored && new URLSearchParams(location.search).get('sample') === '1') {
    applyOrder(SAMPLE_ORDER);
  }
  syncSquareFields();
  refresh();
  renderLog();
  syncShareButtons();
  if (!$('quote-status').textContent) status('Fill in the order, then Generate Quote.', '');
})();
