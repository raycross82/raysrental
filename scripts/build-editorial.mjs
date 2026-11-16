// Run after the existing archive/overlay build: reuse its current navigation,
// phone, footer and analytics isolation. Never freeze an archive-owned page.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {NEW_DISPLAY, NEW_E164} from './phone.mjs';
const read = p => readFileSync(p, 'utf8');
const posts = JSON.parse(read('content/blog/posts.json'));
const pricing = JSON.parse(read('pricing.json'));
const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let index = read('out/blog/index.html');
const template = index;
const origin = 'https://raysrental.com';
const jsonLd = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
const toScript = obj => '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g,'\\u003c') + '</script>';
assert.equal(new Set(posts.map(p=>p.slug)).size, posts.length, 'duplicate editorial URL');
for (const p of posts) {
  assert.match(p.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(p.bodyFile, p.slug + '.html');
  const url = `${origin}/blog/${p.slug}/`;
  const tokens = {'freeCoolerMinimum':money(pricing.freeCoolerMinimum)};
  for (const [key,value] of Object.entries(pricing.rates)) tokens['rate.'+key] = money(value);
  for (const [key,value] of Object.entries(pricing.packages)) {
    tokens[`package.${key}.name`] = escape(value.name);
    tokens[`package.${key}.price`] = money(value.price);
  }
  tokens.dinner_rows = `<table><caption>Dining furniture examples at six guests per table</caption><thead><tr><th scope="col">Guests</th><th scope="col">Tables</th><th scope="col">Chairs</th><th scope="col">Rental / day</th></tr></thead><tbody>${[12,18,24,30].map(n=>`<tr data-guests="${n}"><th scope="row">${n}</th><td>${Math.ceil(n/6)}</td><td>${n}</td><td>${money(Math.ceil(n/6)*pricing.rates.tables+n*pricing.rates.chairs)}</td></tr>`).join('')}</tbody></table>`;
  const body = read('content/blog/'+p.bodyFile).replace(/\{\{([^}]+)\}\}/g, (_,key) => {
    assert.ok(Object.hasOwn(tokens,key), 'Unknown editorial token: '+key);return tokens[key];
  });
  const title = p.title + " | Ray's Rentals";
  let page = template.replace(/<title>[\s\S]*?<\/title>/, '<title>'+escape(title)+'</title>');
  for (const [name,value] of Object.entries({'description':p.description,'og:description':p.description,'twitter:description':p.description,'og:title':title,'twitter:title':title,'og:url':url,'og:type':'article'})) {
    const re = new RegExp(`<meta (?:name|property)="${name}" content="[^"]*">`);
    assert.ok(re.test(page), 'Missing metadata '+name);
    page = page.replace(re, `<meta ${name.startsWith('og:')?'property':'name'}="${name}" content="${escape(value)}">`);
  }
  page = page.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  page = page.replace(jsonLd, toScript({'@context':'https://schema.org','@graph':[
    {'@type':'BlogPosting','@id':url,headline:p.title,description:p.description,mainEntityOfPage:url,inLanguage:'en-US',author:{'@type':'Organization',name:"Ray's Rentals",url:origin+'/about/'},publisher:{'@type':'Organization',name:"Ray's Rentals",url:origin+'/'},...(p.publishedOn?{datePublished:p.publishedOn}:{})},
    {'@type':'BreadcrumbList',itemListElement:[['Home','/'],['Blog','/blog/'],[p.title,'/blog/'+p.slug+'/']].map(([name,path],i)=>({'@type':'ListItem',position:i+1,name,item:origin+path}))}
  ]}));
  page = page.replace(/<main>[\s\S]*?<\/main>/, `<main>
<section class="page-hero"><div class="container"><p class="kicker">${escape(p.category)}</p><h1 style="max-width:900px;margin:0 auto">${escape(p.title)}</h1><p class="lead">${escape(p.summary)}</p><p style="margin-top:1rem">By Ray's Rentals</p></div></section>
<section class="article"><article class="container article-body editorial-body" aria-label="${escape(p.title)}">${body}</article></section>
<section class="cta-band"><div class="container"><h2>Plan your rental with Ray</h2><p>Send your date, city and quantities. We'll confirm availability and the final quote.</p><p><a class="btn btn-primary" href="/quote/">Build a Free Quote</a> <a class="btn" href="/check-availability/" style="color:#fff;border:1px solid #fff">Check Availability</a></p><p class="phone">Call or text Ray: <a href="tel:${NEW_E164}" style="color:#fff">${NEW_DISPLAY}</a></p></div></section>
</main>`);
  page = page.replace('</head>', '<style>@media(max-width:600px){.editorial-body table{display:table;table-layout:fixed;font-size:14px}.editorial-body th,.editorial-body td{padding:8px;overflow-wrap:anywhere}.editorial-body caption{text-align:left;margin-bottom:8px}}</style></head>');
  // Avoid downloading an unused hero photo on this text-led article.
  page = page.replace(/<link rel="preload" as="image"[^>]*>\n?/, '');
  mkdirSync('out/blog/'+p.slug,{recursive:true});writeFileSync('out/blog/'+p.slug+'/index.html',page);
}
// Replace our block on a repeated run, leaving the five legacy cards untouched.
index = index.replace(/\n?<!-- editorial:start -->[\s\S]*?<!-- editorial:end -->/, '');
const cards = posts.map(p=>`<div class="card"><div class="post-meta" style="justify-content:flex-start"><span class="tag">${escape(p.category)}</span></div><h3><a href="/blog/${p.slug}/" style="color:var(--navy)">${escape(p.title)}</a></h3><p class="desc" style="margin-top:.6rem">${escape(p.summary)}</p><a href="/blog/${p.slug}/"><b>Read article &rarr;</b></a></div>`).join('\n');
assert.ok(index.includes('<div class="grid grid-3">'));
index = index.replace('<div class="grid grid-3">', '<div class="grid grid-3">\n<!-- editorial:start -->'+cards+'<!-- editorial:end -->');
const graph = JSON.parse(index.match(jsonLd)[0].replace(/^<script[^>]*>|<\/script>$/g,''));
const blog = graph['@graph'].find(n=>n['@type']==='Blog');
const ids = new Set(posts.map(p=>`${origin}/blog/${p.slug}/`));
blog.blogPost = [...posts.map(p=>({'@id':`${origin}/blog/${p.slug}/`})), ...blog.blogPost.filter(p=>!ids.has(p['@id']))];
index=index.replace(jsonLd,toScript(graph));writeFileSync('out/blog/index.html',index);
let sitemap=read('out/sitemap.xml');
for (const p of posts) {
  const url=`${origin}/blog/${p.slug}/`;
  if(!sitemap.includes('<loc>'+url+'</loc>')) sitemap=sitemap.replace('</urlset>',`<url><loc>${url}</loc></url>\n</urlset>`);
}
writeFileSync('out/sitemap.xml',sitemap);
console.log(`build-editorial: rendered ${posts.length} article(s), blog cards, BlogPosting/Breadcrumb schema and sitemap entries`);
