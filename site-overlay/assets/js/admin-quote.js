// Staff "Generate Quote" behavior for /admin/.
// Prices the order, takes the next RR-MMDD-## number, fills the quote document,
// keeps an HTML preview on the page, and downloads a letter-size PDF.

import {
  QUOTE_ASSETS,
  SAMPLE_ORDER,
  allocateSeq,
  chicagoDateParts,
  formatMoney,
  formatQuoteNumber,
  priceOrder,
  quoteFilename,
  renderQuoteDocument,
} from './quote-doc.js';

const STORE_KEY = 'rr-quote-seq-v1';
const FORM_KEY = 'rr-quote-form-v1';

const $ = (id) => document.getElementById(id);

let assets = { ...QUOTE_ASSETS };
let memoryStore = { days: {}, issued: [] };
let lastHtml = '';
let lastNumber = '';
let busy = false;

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

function readCustom() {
  return [...document.querySelectorAll('.custom-line')].map((row) => ({
    name: row.querySelector('[data-field="name"]').value,
    detail: row.querySelector('[data-field="detail"]').value,
    qty: row.querySelector('[data-field="qty"]').value,
    rate: row.querySelector('[data-field="rate"]').value,
  }));
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
    tables: $('q-tables').value,
    chairs: $('q-chairs').value,
    speakers: $('q-speakers').value,
    coolers: $('q-coolers').value,
    custom: readCustom(),
    delivery: $('i-delivery').value,
    setup: $('i-setup').value,
    discount: $('i-discount').value,
    includeFreeCooler: $('i-free-cooler').checked,
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

function addCustomRow(row = { name: '', detail: '', qty: 1, rate: '' }) {
  const wrap = $('custom-lines');
  if (wrap.children.length >= 8) return;
  const div = document.createElement('div');
  div.className = 'custom-line';
  div.innerHTML = `
    <div class="custom-grid">
      <div><label>Item</label><input data-field="name" maxlength="80" placeholder="Bags of Ice"></div>
      <div><label>Detail</label><input data-field="detail" maxlength="80" placeholder="Optional"></div>
      <div><label>Qty</label><input data-field="qty" type="number" min="0" max="999" inputmode="numeric"></div>
      <div><label>Rate $</label><input data-field="rate" type="number" min="0" step="0.01" inputmode="decimal"></div>
    </div>
    <button type="button" class="gq-text remove-line">Remove line</button>`;
  div.querySelector('[data-field="name"]').value = row.name || '';
  div.querySelector('[data-field="detail"]').value = row.detail || '';
  div.querySelector('[data-field="qty"]').value = row.qty == null ? 1 : row.qty;
  div.querySelector('[data-field="rate"]').value = row.rate == null ? '' : row.rate;
  div.querySelector('.remove-line').addEventListener('click', () => {
    div.remove();
    refresh();
  });
  div.addEventListener('input', refresh);
  wrap.appendChild(div);
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
  $('q-tables').value = order.tables || 0;
  $('q-chairs').value = order.chairs || 0;
  $('q-speakers').value = order.speakers || 0;
  $('q-coolers').value = order.coolers || 0;
  $('i-delivery').value = order.delivery == null ? 0 : order.delivery;
  $('i-setup').value = order.setup == null ? 0 : order.setup;
  $('i-discount').value = order.discount == null ? 0 : order.discount;
  $('i-free-cooler').checked = order.includeFreeCooler !== false;
  $('custom-lines').replaceChildren();
  for (const row of order.custom || []) addCustomRow(row);
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

document.querySelectorAll('.qty-ctl button').forEach((button) => {
  button.addEventListener('click', () => {
    const el = $('q-' + button.dataset.q);
    setQty(el.id, (Number(el.value) || 0) + Number(button.dataset.d));
  });
});

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
$('add-line').addEventListener('click', () => {
  addCustomRow();
  refresh();
});
$('load-sample').addEventListener('click', () => {
  applyOrder(SAMPLE_ORDER);
  persistForm();
  status('Sample order loaded. Generate Quote assigns today’s next number.', '');
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
  });
  persistForm();
  status('', '');
});
$('generate-quote').addEventListener('click', generate);
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
  refresh();
  renderLog();
  if (!$('quote-status').textContent) status('Fill in the order, then Generate Quote.', '');
})();
