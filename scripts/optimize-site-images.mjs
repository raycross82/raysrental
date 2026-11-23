// Convert archive photos at build time so future uploads keep serving WebP.
// Original URLs remain available for existing links and platform icons.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const root='out';
const files=await fs.readdir(root,{recursive:true});
const images=new Map();
let before=0,after=0;
for(const file of files.filter(p=>p.startsWith('assets/img/') && /\.(png|jpe?g)$/i.test(p) && !p.endsWith('favicon.png'))) {
 const input=path.join(root,file),dest=file.replace(/\.(png|jpe?g)$/i,'.webp');
 const meta=await sharp(input).metadata();
 const info=await sharp(input).webp({quality:82,alphaQuality:100,effort:6}).toFile(path.join(root,dest));
 before+=(await fs.stat(input)).size;after+=info.size;
 images.set('/'+file,{url:'/'+dest,width:meta.width,height:meta.height});
}
const dimensions=new Map([...images.values()].map(v=>[v.url,v]));
for(const file of files.filter(p=>p.endsWith('.webp'))) {
 const meta=await sharp(path.join(root,file)).metadata();
 dimensions.set('/'+file,{width:meta.width,height:meta.height});
}
for(const file of files.filter(p=>/\.(html|css|js|json|xml)$/.test(p))) {
 const filename=path.join(root,file);
 let text=await fs.readFile(filename,'utf8');
 // Keep Apple home-screen icons in PNG for platform compatibility.
 const icons=[];
 text=text.replace(/<link\b[^>]*rel="(?:apple-touch-icon|icon)"[^>]*>/g,s=>`__RR_ICON_${icons.push(s)-1}__`);
 for(const [url,data] of images) text=text.replaceAll(url,data.url);
 text=text.replace(/__RR_ICON_(\d+)__/g,(_,i)=>icons[i]);
 if(file.endsWith('.html')) {
  text=text.replace(/<img\b[^>]*>/g,tag=>{
   const src=tag.match(/\bsrc="([^"]+)"/)?.[1];
   if(!src?.startsWith('/assets/img/')) return tag;
   assert(/\.(webp|svg)$/.test(src),'Unoptimized rendered image on '+file+': '+src);
   const meta=dimensions.get(src);
   let attrs='';
   if(meta){if(!/\bwidth=/.test(tag))attrs+=` width="${meta.width}"`;if(!/\bheight=/.test(tag))attrs+=` height="${meta.height}"`;}
   if(!/\bdecoding=/.test(tag))attrs+=' decoding="async"';
   return tag.replace(/\s*\/?>$/,attrs+'>');
  });
  // An old global preload fetched the home photo even on pages without it.
  const hero='/assets/img/hero.webp';
  const withoutPreloads=text.replace(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>/g,'');
  if(!withoutPreloads.includes(hero))text=withoutPreloads;
 }
 if(file==='assets/css/style.css')text=text.replace('img{max-width:100%;display:block}','img{max-width:100%;height:auto;display:block}');
 await fs.writeFile(filename,text);
}
assert(after<before,'WebP conversion must reduce total image bytes');
console.log(`WebP: ${images.size} legacy images, ${before} → ${after} bytes (${Math.round((1-after/before)*100)}% smaller). Rendered images verified; PNG icons retained.`);
