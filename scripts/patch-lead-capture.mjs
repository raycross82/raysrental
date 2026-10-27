import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Layer on the built archive so pricing pages retain their existing owner.
const root = 'out';
const homePath = path.join(root, 'index.html');
const template = fs.readFileSync(homePath, 'utf8');
const pricing = JSON.parse(fs.readFileSync('pricing.json', 'utf8'));
const form = fs.readFileSync('availability-form.html', 'utf8').replace('{{freeCoolerMinimum}}', pricing.freeCoolerMinimum);
const css = '<link rel="stylesheet" href="/assets/css/availability.css?v=1">';
const header = template.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0].replace(' aria-current="page"', '');
const footer = template.slice(template.indexOf('<footer class="site-footer">'));
assert(header && footer.includes('</html>'), 'Shared header/footer anchors missing');
function pageHead(title, description, route, noindex = false) {
  let head = template.slice(0, template.indexOf('</head>'));
  head = head.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*(">)/g, `$1${description}$2`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*(">)/g, `$1${title}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1https://raysrental.com${route}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1https://raysrental.com${route}$2`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace(/<link rel="preload" as="image"[^>]*>/g, '');
  if (noindex) head = head.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,follow">');
  return `${head}\n${css}\n</head>\n<body class="rr-availability-page">\n${header}`;
}
fs.mkdirSync(path.join(root, 'check-availability'), { recursive: true });
fs.writeFileSync(path.join(root, 'check-availability/index.html'),
  pageHead("Check Rental Availability in DFW | Ray's Rentals", 'Ask about tables, chairs and party rental availability for your event in Dallas–Fort Worth. No payment or commitment to ask.', '/check-availability/') +
  `<main>${form}</main>\n<script src="/assets/js/availability.js" defer></script>\n${footer}`);
fs.mkdirSync(path.join(root, 'availability-requested'), { recursive: true });
fs.writeFileSync(path.join(root, 'availability-requested/index.html'),
  pageHead("Availability Request Received | Ray's Rentals", 'Thank you for your rental availability request.', '/availability-requested/', true) +
  `<main><section><div class="container" style="max-width:760px"><div class="rr-availability-card"><p class="kicker">Request received</p><h1>Thanks — we got your request.</h1><p style="margin:24px 0">We'll text you about availability and pricing during business hours. Your date isn't reserved yet, and no payment is due now.</p><p><a class="btn btn-primary" href="/inventory/">Browse rentals &amp; pricing</a></p><p style="margin-top:24px">Need to reach us? <a href="sms:+14696544110">Text Ray</a> or <a href="tel:+14696544110">call (469) 654-4110</a>.</p></div></div></section></main>\n${footer}`);

const cities = fs.readdirSync(path.join(root, 'party-rentals'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const targets = ['index.html', 'contact/index.html', 'inventory/index.html', 'quote/index.html', ...cities.map(c => `party-rentals/${c}/index.html`)];
for (const relative of targets) {
  const file = path.join(root, relative);
  let html = fs.readFileSync(file, 'utf8');
  const slug = relative.startsWith('party-rentals/') ? relative.split('/')[1] : null;
  const city = slug ? ({ desoto: 'DeSoto', mckinney: 'McKinney' }[slug] || slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')) : '';
  const href = '/check-availability/' + (city ? '?city=' + encodeURIComponent(city) : '');
  const link = relative === 'index.html'
    ? '<p class="rr-quick-link">Want to choose your rentals first? <a href="/quote/">Build a free quote &rarr;</a></p>'
    : `<p class="rr-quick-link">Just checking a date? <a href="${href}">Ask about availability &rarr;</a> No payment to ask.</p>`;
  let changed = false;
  html = html.replace(/<section class="(?:hero|page-hero)">[\s\S]*?<\/section>/, hero => {
    assert(/<\/div>\s*<\/section>$/.test(hero), `Hero closing anchor missing: ${relative}`);
    changed = true;
    if (relative === 'index.html') {
      const original = '<a class="btn btn-primary" href="/quote/">Build a Free Quote</a>';
      assert(hero.includes(original), 'Homepage primary CTA missing');
      hero = hero.replace(original, '<a class="btn btn-primary" href="/check-availability/">Check My Date</a>');
    }
    return hero.replace(/<\/div>\s*<\/section>$/, `${link}\n</div>\n</section>`);
  });
  assert(changed, `Hero missing: ${relative}`);
  html = html.replace('</head>', `${css}\n</head>`);
  fs.writeFileSync(file, html);
}
// Make the short form discoverable without displacing the existing mobile call/text bar.
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8');
      const anchor = '<li><a href="/quote/">Build a Quote</a></li>';
      fs.writeFileSync(file, html.replace(anchor, `${anchor}<li><a href="/check-availability/">Check Availability</a></li>`));
    }
  }
}
walk(root);
const sitemapPath = path.join(root, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
assert(sitemap.includes('</urlset>'), 'Sitemap anchor missing');
fs.writeFileSync(sitemapPath, sitemap.replace('</urlset>', '<url><loc>https://raysrental.com/check-availability/</loc></url>\n</urlset>'));
console.log(`patch-lead-capture: short form added; ${targets.length} entry pages linked; existing quote inbox reused`);
