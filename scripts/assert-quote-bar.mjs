// Build-time assertions for the /quote/ mobile running-total bar.
//
// quote-mobile-bar.html is injected into the archive-owned /quote/ page, and it does not own
// any of the DOM it reads. It takes its total from input[name=total], its item list from
// input[name=items], the event date from input[name=date], and scrolls to the required fields
// inside #quoteForm -- all of which live in raysrental-deploy.zip and in assets/js/quote.js.
// If a re-uploaded archive renames any of them the bar does not throw: it sits at "$0 / day"
// forever, or it never appears at all, which looks identical to an empty cart. That is
// invisible in a browser and in a deploy preview, so every hook it depends on is asserted
// here instead.
//
// The subscription is asserted the hardest, because it is the part that failed once already.
// The bar does not watch the page for changes; renderSummary in assets/js/quote.js calls
// window.rrQuoteBar() as its last statement, appended by the build command in netlify.toml.
// If that call is missing the bar renders in full and never updates -- the one failure mode
// that looks like working software right up to the moment someone adds a chair -- so both
// halves are checked: the call is in the script, and it is inside renderSummary next to the
// hidden fields it follows.
//
// The two structural promises are checked as well. The bar is additive, so .summary-card must
// still be in place: if a future edit ever "moves" the total into the bar, the desktop layout
// loses it entirely. And the callbar takeover is scoped to this page, so the whole publish
// directory is swept -- the bar's markup on any other page would hide that page's Call Ray /
// Text Us bar with a rule nothing ever turns on, leaving it with no bottom bar at all.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'out';
const PAGE = 'quote/index.html';

const problems = [];
const fail = (msg) => problems.push(msg);

const html = readFileSync(join(ROOT, PAGE), 'utf8');

// Hooks the bar reads. Each is a string the injected script or CSS depends on by name.
const HOOKS = [
  ['id="quoteForm"', 'the form the Reserve button scrolls into'],
  ['name="total"', 'the posted total the bar mirrors'],
  ['name="items"', 'the posted item list the text message is built from'],
  ['name="date"', 'the event date the text message mentions'],
  ['id="s-total"', 'the visible total the bar falls back to'],
  ['class="summary-card"', 'the summary card the bar reads and must not replace'],
  ['class="callbar"', 'the sitewide call/text bar the quote bar takes over from'],
  ['type="submit"', 'the Reserve This Quote button the bar scrolls to'],
];

for (const [needle, what] of HOOKS) {
  if (!html.includes(needle)) fail(`${PAGE}: no ${needle} -- ${what} is gone`);
}

// The bar itself, injected exactly once.
const bars = html.split('<div id="rr-qbar"').length - 1;
if (bars !== 1) fail(`${PAGE}: expected 1 quote bar, found ${bars}`);

// Pieces of the bar whose absence would silently change behaviour rather than break it.
const PARTS = [
  ['href="sms:+14695718720"', 'the text-quote link lost the phone number'],
  ["'?&body='", 'the text-quote link no longer prefills the message'],
  ['id="rrQbAmount"', 'the live total has no target element'],
  ['id="rrQbReserve"', 'the Reserve button is missing'],
  ['>Your quote<', 'the "Your quote" label is missing'],
  ['body.rr-qbar-on .callbar{display:none}', 'the callbar takeover rule is missing'],
  ['env(safe-area-inset-bottom)', 'the home-indicator safe area is not respected'],
  ['body.rr-qbar-on{padding-bottom:', 'page content is not padded clear of the bar'],
  ['window.rrQuoteBar=update', 'the bar never publishes the hook the cart calls'],
];
for (const [needle, why] of PARTS) {
  if (!html.includes(needle)) fail(`${PAGE}: ${why} (missing "${needle}")`);
}

// The bar is a /quote/ page treatment only. Nothing else may carry it.
const pages = readdirSync(ROOT, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html'))
  .map((e) => join(e.parentPath ?? e.path, e.name).slice(ROOT.length + 1))
  .sort();

const carriers = pages.filter((p) => readFileSync(join(ROOT, p), 'utf8').includes('rr-qbar'));
if (carriers.length !== 1 || carriers[0] !== PAGE) {
  fail(`quote bar must appear on ${PAGE} only, found on: ${carriers.join(', ') || 'nothing'}`);
}

// The form still has to post exactly as it did: Netlify form handling and the /thank-you/
// redirect both depend on these, and the bar must never have touched them.
const FORM = [
  '<form name="quote" method="POST" action="/thank-you/"',
  '<input type="hidden" name="form-name" value="quote">',
  'name="bot-field"',
  'id="f-total"',
  'id="f-deposit"',
];
for (const needle of FORM) {
  if (!html.includes(needle)) fail(`${PAGE}: form no longer posts as before (missing "${needle}")`);
}

// The subscription itself: the cart has to call the bar on every recalculation, from inside
// renderSummary, immediately after the hidden fields the bar reads are written.
const CART = 'assets/js/quote.js';
const cart = readFileSync(join(ROOT, CART), 'utf8');
const HOOK = 'if(window.rrQuoteBar)window.rrQuoteBar();';
const calls = cart.split(HOOK).length - 1;

if (calls !== 1) {
  fail(`${CART}: expected 1 window.rrQuoteBar() call, found ${calls} -- the bar would render but never update`);
} else if (!cart.includes(`.value=fmt(s.deposit);${HOOK}`)) {
  fail(`${CART}: the window.rrQuoteBar() call is not at the end of renderSummary, so the bar can update from stale numbers`);
}

if (problems.length) {
  console.error('assert-quote-bar: the /quote/ mobile total bar is broken:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `assert-quote-bar: ok, bar present on ${PAGE} only, wired into renderSummary, ${pages.length} pages swept`,
);
