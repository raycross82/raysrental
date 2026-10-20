// Mesquite is archive-owned. Patch only its search/share metadata after extraction,
// preserving future archive changes to prices, local copy, forms and structured data.
// Homepage and Plano metadata are intentionally unchanged for this first test.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'out/party-rentals/mesquite/index.html';
const before = readFileSync(path, 'utf8');
const canonical = 'https://raysrental.com/party-rentals/mesquite/';
assert.ok(before.includes(`<link rel="canonical" href="${canonical}">`),
  'Mesquite canonical changed; review the metadata patch before deploying.');

const oldTitle = "Party Rentals in Mesquite, TX | Tables, Chairs & More — Ray's Rentals";
const title = "Table & Chair Rentals in Mesquite, TX | Ray's Rentals";
const oldDescription = 'Table, chair, cooler and speaker rentals delivered in Mesquite, TX. Per-day prices from $2, packages for 60 guests from $180, and just a 25% deposit to book.';
const description = 'Rent tables and chairs for Mesquite birthdays, cookouts and church events. Local delivery and free DFW pickup available. Build a free quote for your date.';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const replacements = [
  [/<title\b[^>]*>[\s\S]*?<\/title>/gi, `<title>${oldTitle}</title>`, `<title>${escape(title)}</title>`],
  ...[
    ['name', 'description', oldDescription, description],
    ['property', 'og:title', oldTitle, title],
    ['property', 'og:description', oldDescription, description],
    ['name', 'twitter:title', oldTitle, title],
    ['name', 'twitter:description', oldDescription, description],
  ].map(([attribute, name, oldValue, value]) => [
    new RegExp(`<meta\\b(?=[^>]*\\s${attribute}\\s*=\\s*["']${name}["'])[^>]*>`, 'gi'),
    `<meta ${attribute}="${name}" content="${oldValue}">`,
    `<meta ${attribute}="${name}" content="${escape(value)}">`,
  ]),
];

let after = before;
for (const [selector, oldTag, newTag] of replacements) {
  const matches = after.match(selector) ?? [];
  assert.equal(matches.length, 1, `Expected one metadata tag matching ${selector}`);
  assert.ok(matches[0] === oldTag || matches[0] === newTag,
    `Archive metadata changed for ${selector}; review instead of overwriting it.`);
  after = after.replace(selector, () => newTag);
}

// Allow a repeat run, but never silently miss an archive change or duplicate a tag.
if (after !== before) writeFileSync(path, after);
console.log('patch-search-metadata: ok, Mesquite title/description and matching social tags; all other content preserved');
