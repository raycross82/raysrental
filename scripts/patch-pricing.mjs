// The deploy archives are historical inputs. Apply the current price list AFTER
// unpacking and overlays, before all build assertions. Never replace the site's
// layout, assets, forms, phone numbers, delivery charges, or deposit percentage.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const config = JSON.parse(readFileSync('pricing.json', 'utf8'));
const { rates, packages, effectiveDate, updatedLabel, freeCoolerMinimum } = config;
const money = n => n.toLocaleString('en-US', {
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2,
});
const value = p => Object.entries(rates).reduce((sum, [key, rate]) => sum + p[key] * rate, 0);
const oldMoney = {
  8: rates.tables, 2: rates.chairs, 12: rates.coolers, 30: rates.speakers,
  180: packages.party60.price, 200: packages.cookout60.price, 225: packages.wholeparty.price,
};
const oldData = { 8: rates.tables, 2: rates.chairs, 12: rates.coolers, 30: rates.speakers,
  180: packages.party60.price, 200: packages.cookout60.price, 225: packages.wholeparty.price };
const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',middot:'·',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',ntilde:'ñ',Ntilde:'Ñ',agrave:'à',Agrave:'À',eacute:'é',hellip:'…'};
const text = s => s.replace(/<[^>]*>/g, '').replace(/&(#x?[\da-fA-F]+|[A-Za-z]+);/g, (all, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e] ?? all).replace(/\s+/g, ' ').trim();
const changed = [];
const pages = readdirSync('out', { recursive: true }).filter(p => p.endsWith('.html'));

for (const rel of pages) {
  const path = join('out', rel);
  const before = readFileSync(path, 'utf8');
  let html = before;
  // Legacy signed/issued agreement payloads retain their own rate version and
  // replacement-cost terms. Only the current-rate variable is generated here.
  if (rel === 'agreement/index.html') {
    html = html.replace(/var RATES\s*=\s*\{[^}]+\};/, `var RATES = ${JSON.stringify(rates)};`);
    if (html === before) throw new Error('Current agreement rates hook missing');
    writeFileSync(path, html);
    continue;
  }
  // One pass prevents 180 -> 200 -> 225 -> 250 cascading replacements.
  html = html.replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g,
    (all, n) => Object.hasOwn(oldMoney, n) ? '$' + money(oldMoney[n]) : all);
  html = html.replace(/data-price="(\d+(?:\.\d+)?)"/g,
    (all, n) => Object.hasOwn(oldData, n) ? `data-price="${oldData[n]}"` : all);
  html = html.replaceAll('with any order $50+', `with any order $${money(freeCoolerMinimum)}+`);
  html = html.replaceAll('August 2026', updatedLabel);
  if (rel === 'quote/index.html') {
    const packageMap = Object.fromEntries(Object.values(packages).map(p => [p.name, {
      tables: p.tables, chairs: p.chairs, coolers: p.coolers, speakers: p.speakers,
      discount: value(p) - p.price,
    }]));
    const next = html.replace(/var PACKAGES = \{[\s\S]*?\n  \};/, `var PACKAGES = ${JSON.stringify(packageMap)};`);
    if (next === html) throw new Error('Quote handoff package hook missing');
    html = next;
  }

  // Examples and derived amounts are recalculated, not treated as unit prices.
  html = html.replaceAll('a $225 Cookout for 60 package needs a $50 deposit',
    `a $${money(packages.cookout60.price)} Cookout for 60 package needs a $${money(packages.cookout60.price * .25)} deposit`);
  html = html.replaceAll('A $225 package needs $50',
    `A $${money(packages.party60.price)} package needs $${money(packages.party60.price * .25)}`);
  html = html.replaceAll('A $225 package needs just $50',
    `A $${money(packages.party60.price)} package needs just $${money(packages.party60.price * .25)}`);
  html = html.replaceAll("for a $200 package that's $45", `for a $${money(packages.party60.price)} package that's $${money(packages.party60.price * .25)}`);
  html = html.replaceAll('ten tables and sixty chairs run $225', `ten tables and sixty chairs run $${money(value(packages.party60))}`);
  // Package upgrades cost the difference between packages, not a standalone speaker.
  html = html.replaceAll('Add the JBL PartyBox speaker for $40 more',
    `Upgrade to The Whole Party with the JBL PartyBox speaker for $${money(packages.wholeparty.price - packages.cookout60.price)} more`);
  html = html.replaceAll('Add the JBL speaker for $40 more',
    `Upgrade to The Whole Party with the JBL speaker for $${money(packages.wholeparty.price - packages.cookout60.price)} more`);
  html = html.replaceAll('2 coolers for drinks: <b>+$24</b>', `2 coolers for drinks: <b>+$${money(2 * rates.coolers)}</b>`);
  html = html.replaceAll('rental budget under $250', `60-guest rental package at $${money(packages.wholeparty.price)} before delivery`);

  if (rel === 'inventory/index.html') {
    let index = 0;
    html = html.replace(/<p class="savings">[\s\S]*?<\/p>/g, () => {
      const p = Object.values(packages)[index++];
      if (!p) throw new Error('Unexpected inventory savings card');
      return `<p class="savings">&Agrave; la carte value: $${money(value(p))} &middot; save $${money(value(p) - p.price)}</p>`;
    });
    if (index !== 3) throw new Error('Expected 3 inventory savings cards');
    let rows = 0;
    html = html.replace(/<tr><th scope="row">(Party for 60|Cookout for 60|The Whole Party)<\/th>([\s\S]*?)<\/tr>/g, (all, name) => {
      rows++;
      const p = Object.values(packages).find(p => p.name === name);
      return `<tr><th scope="row">${name}</th><td>10</td><td>60</td><td>${p.coolers || '-'}</td><td>${p.speakers ? 'Yes' : '-'}</td><td class="rr-price">$${money(p.price)}</td><td>$${money(value(p))}</td><td class="rr-price">$${money(value(p) - p.price)}</td></tr>`;
    });
    if (rows !== 3) throw new Error('Expected 3 comparison rows');
  }

  if (rel === 'seating-calculator/index.html') {
    html = html.replace('TABLE_RATE = 8, CHAIR_RATE = 2', `TABLE_RATE = ${rates.tables}, CHAIR_RATE = ${rates.chairs}`);
    let count = 0;
    html = html.replace(/(<tr><th scope="row">\d+<\/th><td>)(\d+)(<\/td><td>\d+<\/td><td>)(\d+)(<\/td><td class="rr-price">)\$[\d,.]+(<\/td><\/tr>)/g,
      (_, a, t, b, c, d, e) => { count++; return a + t + b + c + d + '$' + money(t * rates.tables + c * rates.chairs) + e; });
    if (count !== 9) throw new Error('Expected 9 seating reference rows');
    html = html.replace(/(id="rr-cost">)\$[\d,.]+/, `$1$${money(10 * rates.tables + 66 * rates.chairs)}`);
    html = html.replaceAll('six spare chairs on a 60-guest party costs $18', `six spare chairs on a 60-guest party costs $${money(6 * rates.chairs)}`);
    html = html.replace("out.cost.textContent = '$' + cost;", () => "out.cost.textContent = '$' + cost.toLocaleString('en-US', {minimumFractionDigits: Number.isInteger(cost) ? 0 : 2, maximumFractionDigits: 2});");
  }

  if (rel === 'quinceanera-rentals/index.html') {
    let count = 0;
    html = html.replace(/(<tr><th scope="row">\d+[^<]*<\/th><td>)([^<]+?) &mdash; \$[\d,.]+(<\/td><td>[^<]*<\/td><td>)(\d+) \/ (\d+)(<\/td><td class="rr-price">)\$[\d,.]+(<\/td><\/tr>)/g,
      (_, a, name, b, t, c, d, e) => {
        const p = Object.values(packages).find(p => p.name === name);
        if (!p) throw new Error('Unknown quinceanera package');
        count++;
        return a + name + ' &mdash; $' + money(p.price) + b + t + ' / ' + c + d + '$' + money(p.price + (t - 10) * rates.tables + (c - 60) * rates.chairs) + e;
      });
    if (count !== 6) throw new Error('Expected 6 quinceanera rows');
    html = html.replaceAll('roughly $530 a day', `$${money(25 * rates.tables + 165 * rates.chairs)} a day`);
    html = html.replaceAll('$555 a day starting from The Whole Party', `$${money(packages.wholeparty.price + 15 * rates.tables + 105 * rates.chairs)} a day starting from The Whole Party`);
  }

  if (rel === 'corporate-event-rentals/index.html') {
    let count = 0;
    html = html.replace(/(<tr><th scope="row">\d+<\/th><td>)(\d+)(<\/td><td>)(\d+)(<\/td><td class="rr-price">)\$[\d,.]+(<\/td><\/tr>)/g,
      (_, a, t, b, c, d, e) => { count++; return a + t + b + c + d + '$' + money(t * rates.tables + c * rates.chairs + 150) + e; });
    if (count !== 19) throw new Error('Expected 19 corporate setup rows');
  }

  if (rel === 'event-rentals/wedding/index.html') {
    html = html.replace('17 guest tables, a head table, serving and cake tables, and 100 chairs &mdash; call it under $350 in rentals for the whole day',
      `17 guest tables, a head table, a serving table and a cake table, plus 100 chairs &mdash; $${money(20 * rates.tables + 100 * rates.chairs)} per day before delivery`);
  }

  if (html !== before) {
    // Update existing content modification dates, never publication dates.
    html = html.replace(ld, (_, block) => {
      const doc = JSON.parse(block);
      const update = obj => {
        if (!obj || typeof obj !== 'object') return;
        if (Object.hasOwn(obj, 'dateModified')) obj.dateModified = effectiveDate;
        if (obj['@type'] === 'FAQPage') {
          const visible = [...html.matchAll(/<details class="faq-item"[^>]*><summary>([\s\S]*?)<\/summary><div class="a">([\s\S]*?)<\/div><\/details>/g)].map(([, q, a]) => [text(q), text(a)]);
          for (const question of obj.mainEntity) {
            const answer = visible.find(([q]) => q === text(question.name));
            if (!answer) throw new Error(`FAQ schema has no visible answer: ${question.name}`);
            question.acceptedAnswer.text = answer[1];
          }
        }
        if (obj['@type'] === 'Offer' && obj.itemOffered) {
          const rate = {
            '6 ft Folding Table': rates.tables,
            'White Resin Folding Chair': rates.chairs,
            'Drink Cooler': rates.coolers,
            'JBL PartyBox 110 Speaker': rates.speakers,
          }[obj.itemOffered.name];
          if (!rate) throw new Error(`Unmapped city offer: ${obj.itemOffered.name}`);
          obj.price = String(rate);
          obj.priceCurrency = 'USD';
          obj.priceSpecification.price = String(rate);
          obj.priceSpecification.unitCode = 'DAY';
        }
        Object.values(obj).forEach(update);
      };
      update(doc);
      return `<script type="application/ld+json">${JSON.stringify(doc)}</script>`;
    });
    writeFileSync(path, html);
    changed.push(rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, ''));
  }
}

// Generated sitemap dates reflect only pages whose pricing/content changed.
const sitemap = readFileSync('out/sitemap.xml', 'utf8');
writeFileSync('out/sitemap.xml', sitemap.replace(/<url>([\s\S]*?)<\/url>/g, (all, body) => {
  const url = /<loc>https:\/\/raysrental\.com([^<]*)<\/loc>/.exec(body)?.[1];
  if (!changed.includes(url)) return all;
  const date = `<lastmod>${effectiveDate}</lastmod>`;
  return '<url>' + (/<lastmod>/.test(body) ? body.replace(/<lastmod>[^<]*<\/lastmod>/, date) : body + date) + '</url>';
}));
// Round the deposit once, then derive the balance from that rounded amount.
// Formatting two unrounded values separately can make their sum one cent too high.
const quoteJs = readFileSync('out/assets/js/quote.js', 'utf8');
if (!quoteJs.includes('deposit:sub*0.25')) throw new Error('Quote deposit hook missing');
writeFileSync('out/assets/js/quote.js', quoteJs.replace('deposit:sub*0.25', 'deposit:Math.round(sub*25)/100'));
console.log(`patch-pricing: updated ${changed.length} pages from pricing.json; layout and assets preserved`);
