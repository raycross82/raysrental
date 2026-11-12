// These city and planning pages come from the deploy archives.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const links = [
  {
    page: 'party-rentals/dallas',
    original: 'plan shade, order an extra cooler, and schedule dinner after the sun drops.',
    linked: 'plan shade, order an extra cooler, and schedule dinner after the sun drops. For a backyard without covered seating, <a href="/tent-rentals/?city=Dallas">check party tent availability</a> for your date.'
  },
  {
    page: 'party-rentals/mesquite',
    original: 'Our Cookout for 60 package was practically designed for a Mesquite graduation BBQ.',
    linked: 'Our Cookout for 60 package was practically designed for a Mesquite graduation BBQ. If you also need cover for your tables and chairs, <a href="/tent-rentals/?city=Mesquite">ask for a backyard tent quote</a>.'
  },
  {
    page: 'party-rentals/mckinney',
    original: 'book the shade canopy through your venue, and let us handle the seating.',
    linked: 'check what shade your venue provides. For a yard without cover, you can <a href="/tent-rentals/?city=McKinney">ask about a tent for your date</a>.'
  },
  {
    page: 'blog/backyard-cookout-checklist',
    original: 'Position seating under trees, patio covers, or canopies',
    linked: 'Position seating under trees or a patio cover. If the tables will be in full sun, <a href="/tent-rentals/">ask about a backyard party tent</a>.'
  },
  {
    page: 'blog/graduation-party-rentals-dfw',
    original: 'afternoon parties need trees, patio covers or canopies.',
    linked: 'for an afternoon party, look for mature trees or a covered patio, or <a href="/tent-rentals/">check tent availability for graduation weekend</a>.'
  },
  {
    page: 'blog/backyard-quinceanera-dfw',
    original: 'Position seating under trees, a patio cover, or rented canopies.',
    linked: 'Position seating under trees or a patio cover. If you need a <a href="/tent-rentals/">tent for your backyard quincea&ntilde;era</a>, include the head table in your guest layout.'
  }
];

for (const { page, original, linked } of links) {
  const file = join('out', page, 'index.html');
  const html = readFileSync(file, 'utf8');
  if (html.includes(linked)) continue;
  assert.equal(html.split(original).length, 2, 'Expected one tent link anchor on /' + page + '/');
  writeFileSync(file, html.replace(original, () => linked));
}
