import { readFileSync } from 'node:fs';

const { rates, freeCoolerMinimum } = JSON.parse(readFileSync(new URL('../pricing.json', import.meta.url), 'utf8'));
const products = [
  ['tables', '6-ft folding table', 'item-table.jpg'],
  ['chairs', 'Folding chair', 'item-chair.jpg'],
  ['coolers', 'Drink cooler', 'item-cooler.jpg'],
  ['speakers', 'JBL PartyBox 110', 'item-speaker.jpg']
];

const rows = products.map(([key, label, image]) => {
  const price = '$' + rates[key].toFixed(Number.isInteger(rates[key]) ? 0 : 2);
  return `<div class="rr-addon-row">
    <img src="/assets/img/${image}" width="54" height="54" alt="" loading="lazy" decoding="async">
    <label for="tent-addon-${key}"><strong>${label}</strong><span>${price} each per day</span></label>
    <div class="rr-addon-quantity">
      <button type="button" data-step="-1" aria-label="Remove one ${label.toLowerCase()}">−</button>
      <input id="tent-addon-${key}" type="number" min="0" step="1" inputmode="numeric" value="0" data-rental="${label}" aria-label="${label} quantity">
      <button type="button" data-step="1" aria-label="Add one ${label.toLowerCase()}">+</button>
    </div>
  </div>`;
}).join('\n');

export const tentAddons = `<details class="rr-wide rr-tent-addons" id="tent-addons" hidden>
  <summary>
    <span><strong>Add other rentals</strong><small id="tent-addon-summary" aria-live="polite">Tables, chairs, coolers &amp; sound</small></span>
    <span class="rr-addon-chevron" aria-hidden="true"></span>
  </summary>
  <div class="rr-addon-choices">
    ${rows}
    <p class="rr-addon-promo">One cooler is included with $${freeCoolerMinimum}+ in table, chair and speaker rentals.</p>
    <fieldset class="rr-addon-specials">
      <legend>Also ask about pricing for</legend>
      <label><input type="checkbox" data-rental="Round tables"> Round tables</label>
      <label><input type="checkbox" data-rental="Specialty white resin chairs"> White resin chair options</label>
      <label><input type="checkbox" data-rental="DJ services"> DJ services</label>
    </fieldset>
  </div>
</details>
<noscript><p class="rr-wide">Include any extra tables, chairs, coolers or sound equipment in the notes below.</p></noscript>`;
