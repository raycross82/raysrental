// The archive remains the page source. Apply the delivery-only policy after all
// overlays and pricing patches, including matching visible copy and JSON-LD.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const files = fs.readdirSync('out', {recursive:true}).filter(p=>p.endsWith('.html'));
const edits = [
 [", or at our lot if you are collecting, which costs nothing and works fine for anything that fits in an SUV with the seats folded down.", "."],
 [", or nothing at all if you collect the order yourself.", "."],
 ["Most weekend events are picked up Friday or Saturday and returned Sunday or Monday", "Most weekend events have delivery Friday or Saturday and collection Sunday or Monday"],
 ["most hosts take delivery Friday or Saturday and return Monday.", "most hosts take delivery Friday or Saturday with collection Monday."],
 ['Free pickup, local delivery, and', 'Local delivery and'],
 ['with free pickup and local delivery', 'with local delivery'],
 ['<li>Free pickup at our DFW lot</li>', '<li>Delivery priced by location</li>'],
 ['<li>Free pickup included</li>', '<li>Delivery priced by location</li>'],
 ['<h3>Pick up or deliver</h3><p>Grab it free at our lot, or we deliver and set up across DFW.</p>', '<h3>Arrange delivery</h3><p>We deliver and set up across DFW, priced by location.</p>'],
 ['free pickup vs delivery', 'delivery'],
 ['Do you deliver, or do I pick up?', 'Do you deliver?'],
 ['Both! Pickup at our DFW lot is always free. Prefer delivery? We bring', 'Yes! We bring'],
 ['Everything about booking, deposits, delivery and pickup.', 'Everything about booking, deposits and delivery.'],
 [', free pickup at our DFW lot.</li>', '.</li>'],
 ['Pickup &amp; delivery</b><br>Free pickup at our DFW lot (address shared when you book), or delivery and setup priced by your location.', 'Delivery</b><br>Delivery and setup priced by your location.'],
 [' &mdash; or pick up free at our DFW lot.', '.'],
 ['<li>Free pickup or delivery priced by location</li>', '<li>Delivery priced by location</li>'],
 [' Free pickup available.', ''],
 ['Free pickup at our lot, and delivery across', 'Delivery across'],
 ['Free pickup at our lot, plus delivery to', 'Delivery to'],
 [' &middot; free pickup lot', ''],
 ['<div class="card">\n<h3>Free Pickup</h3>\n<p class="desc">Swing by our lot, load up, and bring it back. No charge, ever.</p>\n<p class="price">$0</p>\n</div>\n', ''],
 ['grid-template-columns:repeat(2,1fr);max-width:800px;margin-left:auto;margin-right:auto;text-align:left', 'grid-template-columns:1fr;max-width:800px;margin-left:auto;margin-right:auto;text-align:left'],
 ['3 &middot; Pickup or delivery', '3 &middot; Delivery'],
 ['Free pickup at our DFW lot, or we deliver &amp; set up.', 'We deliver &amp; set up, priced by your location.'],
 ['<label class="pick-card"><span class="pc-head"><span><input type="radio" name="fulfillment" value="Free Pickup" checked>Free Pickup</span><span>$0</span></span><span class="pc-sub">Grab it at our lot &mdash; no charge.</span></label>', ''],
 ['name="fulfillment" value="Delivery & Setup">', 'name="fulfillment" value="Delivery & Setup" checked>'],
 ['Address (optional for pickup)', 'Delivery address (if known)'],
 ['<span>Pickup / delivery</span><span id="s-fulfill">Free</span>', '<span>Delivery</span><span id="s-fulfill">Priced by location</span>'],
 ['<label for="i-pickup">Pick-up timing</label>', '<label for="i-pickup">After-event collection timing</label>'],
 ['Pickup at our DFW lot is free — tables fold flat and chairs stack, so a 60-guest order fits in a mid-size SUV with the seats down. ', ''],
 ['Pickup at our DFW lot is free &mdash; tables fold flat and chairs stack, so a 60-guest order fits in a mid-size SUV with the seats down. ', ''],
 ['Free pickup at our DFW lot, delivery quoted by location.', 'Delivery quoted by location.'],
 ['<li><b>Pickup</b> is free at our DFW lot. Delivery is quoted by location,', '<li><b>Delivery</b> is quoted by location,'],
 ['Most weekend events pick up Friday or Saturday and return Sunday or Monday.', 'Most weekend events have delivery Friday or Saturday and collection Sunday or Monday.'],
 ['<tr><th scope="row">Is pickup free?</th><td>Yes, pickup at our DFW lot is always free.</td></tr>', '<tr><th scope="row">How is delivery priced?</th><td>Delivery is priced by your location.</td></tr>'],
 ['then pick up free at our DFW lot or have us deliver', 'then have us deliver'],
 [' Pickup at our DFW lot is always free.', ''],
 ['; lot pickup is free.', '.'],
 [", and pickup at our DFW lot is free if you'd rather skip the delivery line entirely.", '.'],
 ['Pickup, Delivery, and the Drive South', 'Delivery and the Drive South'],
 ['Two ways to take the order. Pickup at our DFW lot costs nothing and suits a smaller list &mdash; tables fold flat, chairs stack, and forty chairs ride fine in a truck bed. ', ''],
 ['Free lot pickup or delivery, and 25% down reserves your date.', 'Delivery available, and 25% down reserves your date.'],
 ['Pickup at our DFW lot is free, and delivery into DeSoto', 'Delivery into DeSoto'],
 ['Pick up free at our DFW lot or have the whole order delivered', 'Have the whole order delivered'],
 ['Pickup, Delivery, and What Happens After', 'Delivery and What Happens After'],
 ['Free pickup at our DFW lot is the cheapest route and works fine for smaller orders &mdash; tables fold flat, chairs stack, and it all rides in a truck bed or an SUV with the seats folded down. ', ''],
 ['Either way, a 25% deposit reserves the date and the equipment', 'A 25% deposit reserves the date and the equipment'],
 [', plus free pickup at our DFW lot.', ', with delivery priced by location.'],
 ['Two ways to take it. Free pickup at our DFW lot is the cheapest route and fine for a modest order, since tables fold flat and chairs stack. Or we deliver', 'We deliver'],
 ['Free pickup, 25% deposit books it.', '25% deposit books it.'],
 ['Pickup at our DFW lot is free; delivery to Cedar Hill', 'Delivery to Cedar Hill'],
 ['There are two ways to get your order. Pickup at our DFW lot is free, always &mdash; tables fold flat and chairs stack, so a modest party fits in a mid-size SUV with the seats down. Or we deliver', 'We deliver'],
 ['the rest is due at delivery or pickup.', 'the rest is due at delivery.'],
 ['; free pickup at our DFW lot is also an option.', '.'],
 ['Delivery or free pickup.', 'Delivery available.'],
 ['Friday pickup/delivery to Monday return', 'Friday delivery to Monday collection'],
 ['We deliver across the metroplex or you can pick up free at our DFW lot.', 'We deliver across the metroplex.'],
 ['We have no order minimum, and free pickup at our lot is always an option.', 'We have no order minimum.'],
 [", and free pickup is always free.", '.'],
 ['most hosts pick up Friday or Saturday and return Monday.', 'most hosts arrange delivery Friday or Saturday and collection Monday.'],
 ['Free pickup at our lot or local delivery across', 'Local delivery across'],
 ['Delivery &amp; setup: priced by location, or <b>free pickup</b> at our DFW lot', 'Delivery &amp; setup: priced by location'],
];
const counts = Array(edits.length).fill(0);
for (const path of files) {
  let text = fs.readFileSync('out/'+path, 'utf8');
  for (const [i,[from,to]] of edits.entries()) {
    counts[i] += text.split(from).length-1;
    text = text.replaceAll(from,to);
  }
  fs.writeFileSync('out/'+path,text);
}
for (const [i,[from]] of edits.entries()) assert(counts[i]>0, 'Delivery-only copy anchor missing: '+from);
const cartPath = 'out/assets/js/quote.js';
let cart = fs.readFileSync(cartPath,'utf8');
const old = "var delivery=document.querySelector('input[name=fulfillment]:checked').value!=='Free Pickup';";
assert(cart.includes(old),'Delivery-only cart anchor missing');
cart = cart.replace(old, 'var delivery=true;');
fs.writeFileSync(cartPath,cart);
console.log('patch-delivery-only: customer pickup offers removed; delivery, pricing and after-event collection retained');
