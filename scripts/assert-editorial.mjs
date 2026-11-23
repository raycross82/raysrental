import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(p,'utf8');
const posts=JSON.parse(read('content/blog/posts.json'));
const rates=JSON.parse(read('pricing.json')).rates;
const index=read('out/blog/index.html');
const sitemap=read('out/sitemap.xml');
const legacy=['party-rental-prices-dfw','graduation-party-rentals-dfw','seating-guide','backyard-quinceanera-dfw','backyard-cookout-checklist'];
for(const slug of [...legacy,...posts.map(p=>p.slug)]) {
  const path='/blog/'+slug+'/';
  assert.ok(existsSync('out'+path+'index.html'), 'article missing '+path);
  assert.ok(index.includes('href="'+path+'"'), 'orphan blog article '+path);
  assert.equal(sitemap.split('<loc>https://raysrental.com'+path+'</loc>').length-1,1,'sitemap article count '+path);
}
for(const p of posts) {
  const html=read(`out/blog/${p.slug}/index.html`);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,'single H1');
  assert.ok(!/\{\{[a-zA-Z_][^{}]*\}\}/.test(html),'unexpanded token');
  const url=`https://raysrental.com/blog/${p.slug}/`;
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
  assert.ok(html.includes('content="index, follow, max-image-preview:large"'));
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const article=graph['@graph'].find(n=>n['@type']==='BlogPosting');
  assert.equal(article.headline,p.title);assert.equal(article.mainEntityOfPage,url);
  assert.equal(article.author.name,"Ray's Rentals");
  assert.equal(article.datePublished,p.publishedOn); // never invent a publication date
  for(const [,href] of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
    const local='out'+href+(href.endsWith('/')?'index.html':'');
    assert.ok(existsSync(local), 'broken article link/asset '+href);
  }
  const rows=[...html.matchAll(/<tr data-guests="(\d+)"><th scope="row">\d+<\/th><td>(\d+)<\/td><td>(\d+)<\/td><td>\$([\d.]+)<\/td><\/tr>/g)];
  if(p.slug==='thanksgiving-friendsgiving-rentals-dfw') {
    assert.equal(rows.length,4);
    for(const [,guests,tables,chairs,total] of rows) {
      assert.equal(Number(chairs),Number(guests));assert.equal(Number(tables),Math.ceil(Number(guests)/6));
      assert.equal(Number(total),Number(tables)*rates.tables+Number(chairs)*rates.chairs);
    }
  }
}
// Guard every sitemap URL, including pages created before this workflow.
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(new Set(urls).size,urls.length,'duplicate sitemap URLs');
for(const url of urls) {
  const u=new URL(url);assert.equal(u.origin,'https://raysrental.com');
  const f=resolve('out','.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));
  assert.ok(f.startsWith(resolve('out')+'/'));assert.ok(existsSync(f),'sitemap target missing '+url);
  const html=read(f);assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html),'noindex in sitemap '+url);
}
console.log(`assert-editorial: ${posts.length} article(s), pricing examples, metadata, internal links, ${urls.length} sitemap targets and all legacy blog URLs pass`);
