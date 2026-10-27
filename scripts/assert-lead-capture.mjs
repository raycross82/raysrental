import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync('out/check-availability/index.html', 'utf8');
const quote = fs.readFileSync('out/quote/index.html', 'utf8');
const quickForm = html.match(/<form\b[\s\S]*?<\/form>/)[0];
const quoteForm = quote.match(/<form\b[\s\S]*?<\/form>/)[0];
const names = form => [...new Set([...form.matchAll(/<(?:input|textarea|select)\b[^>]*\sname="([^"]+)"/g)].map(m => m[1]))].sort();
assert.deepEqual(names(quickForm), names(quoteForm), 'Quick form must use the exact existing quote field contract');
assert(!quickForm.includes('data-netlify'), 'Do not re-register or narrow the existing quote schema');
assert(quickForm.includes('name="form-name" value="quote"'));
assert(quickForm.includes('action="/availability-requested/"'));
assert.equal((quickForm.match(/\brequired\b/g) || []).length, 4);
assert(html.includes('Free cooler with orders of $100 or more.'));
assert(html.includes('href="https://raysrental.com/check-availability/"'));
assert(fs.readFileSync('out/availability-requested/index.html', 'utf8').includes('content="noindex,follow"'));
assert(!fs.readFileSync('out/sitemap.xml', 'utf8').includes('availability-requested'));
assert(fs.readFileSync('out/index.html', 'utf8').includes('href="/check-availability/">Check My Date</a>'));
assert(fs.readFileSync('out/party-rentals/mesquite/index.html', 'utf8').includes('/check-availability/?city=Mesquite'));
const script = fs.readFileSync('out/assets/js/availability.js', 'utf8');

function harness(behavior = 'success') {
  const listeners = {}, phoneListeners = {}, events = [], requests = [];
  const elements = Object.fromEntries(names(quickForm).map(name => [name, { value: '', setCustomValidity(message) { this.error = message; }, addEventListener(event, fn) { phoneListeners[event] = fn; } }]));
  Object.assign(elements.name, { value: 'QA Visitor' });
  Object.assign(elements.phone, { value: '(214) 555-0100' });
  Object.assign(elements.date, { value: '2026-12-01' });
  Object.assign(elements['form-name'], { value: 'quote' });
  const button = { textContent: 'Send my availability request' };
  const form = { elements, hidden: false, reportValidity: () => !elements.phone.error, querySelector: () => button, addEventListener: (event, fn) => listeners[event] = fn };
  const nodes = { availabilityForm: form, 'availability-status': {}, 'availability-fallback': { hidden: true }, 'availability-text': {}, 'availability-success': { hidden: true, focus() { this.focused = true; } } };
  let resolvePending;
  const context = {
    document: { getElementById: id => nodes[id] },
    window: { location: { search: '?city=Mesquite' }, gtag: (...args) => events.push(args) },
    navigator: { userAgent: 'iPhone' }, Date, String, URLSearchParams, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    FormData: class extends Map { constructor() { super(Object.entries(elements).map(([name, el]) => [name, el.value])); } },
    fetch: (url, options) => {
      requests.push({ url, options });
      if (behavior === 'failure') return Promise.reject(new Error('offline'));
      if (behavior === 'http-error') return Promise.resolve({ ok: false });
      if (behavior === 'pending') return new Promise(resolve => resolvePending = resolve);
      return Promise.resolve({ ok: true });
    }
  };
  vm.runInNewContext(script, context);
  const submit = () => listeners.submit({ preventDefault() {} });
  const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  return { elements, button, form, nodes, events, requests, listeners, submit, settle, resolve: () => resolvePending({ ok: true }) };
}

const happy = harness();
assert.equal(happy.elements.city.value, 'Mesquite');
happy.listeners.input(); happy.listeners.input();
assert.equal(happy.events.filter(e => e[1] === 'availability_start').length, 1);
happy.submit(); await happy.settle();
assert.equal(happy.requests.length, 1);
const payload = new URLSearchParams(happy.requests[0].options.body);
assert.equal(payload.get('form-name'), 'quote');
assert(payload.get('items').includes('not a booking'));
assert.equal(payload.get('city'), 'Mesquite');
assert(happy.form.hidden && !happy.nodes['availability-success'].hidden && happy.nodes['availability-success'].focused);
assert.equal(happy.events.filter(e => e[1] === 'generate_lead').length, 1);
assert(!JSON.stringify(happy.events).includes('QA Visitor'));
assert(!JSON.stringify(happy.events).includes('555'));
happy.submit(); await happy.settle(); assert.equal(happy.requests.length, 1);

for (const behavior of ['failure', 'http-error']) {
  const fail = harness(behavior);
  fail.elements.items.value = '30 guests';
  fail.submit(); await fail.settle();
  assert(!fail.form.hidden && fail.nodes['availability-success'].hidden);
  assert(!fail.button.disabled && !fail.nodes['availability-fallback'].hidden);
  assert.equal(fail.elements.items.value, '30 guests', 'Failure must retain the entered details');
  assert(fail.nodes['availability-text'].href.startsWith('sms:+14696544110&body='));
  assert(!fail.events.some(e => e[1] === 'generate_lead'));
  fail.submit(); await fail.settle(); assert.equal(fail.requests.length, 2, 'Retry must work');
}
const invalid = harness(); invalid.elements.phone.value = '123'; invalid.submit();
assert.equal(invalid.requests.length, 0);
const pending = harness('pending'); pending.submit(); pending.submit();
assert.equal(pending.requests.length, 1, 'Double click must not duplicate requests');
assert(pending.button.disabled); pending.resolve(); await pending.settle();
console.log('assert-lead-capture: existing form contract, city prefill, valid/invalid phone, success, offline/HTTP failures, retry, double-submit protection and PII-free analytics pass');
