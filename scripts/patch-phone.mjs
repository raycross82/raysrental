// Build-time rewrite of the business phone number across the whole publish directory.
//
// Almost every page carrying the number is owned by raysrental-deploy.zip -- the footer
// "Get in Touch" block, the sticky Call Ray / Text Us bar, the contact and quote pages,
// the inventory page and all city landing pages. Shipping edited copies of those in
// site-overlay/ would freeze the rest of their content too, and a re-uploaded archive
// would silently restore the dead number on any page we had not frozen. So this runs over
// the unpacked output, after every other injection in netlify.toml, the same way the
// /inventory/ page is patched rather than replaced.
//
// It deliberately walks everything text-shaped rather than just *.html: the number also
// appears in JSON-LD (LocalBusiness.telephone and ContactPoint.telephone), in the contact
// page's <title>, and in og:/twitter: meta content. Those all live inside the HTML today,
// but a future archive could move structured data into a standalone .json and this would
// still cover it.
//
// scripts/assert-phone.mjs re-scans the finished output afterwards and fails the build if
// anything the old number could still be spelled as survived.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTextFile, replacePhone, NEW_E164, NEW_DISPLAY } from './phone.mjs';

const ROOT = 'out';

const fail = (msg) => {
  console.error(`patch-phone: ${msg}`);
  process.exit(1);
};

let filesChanged = 0;
let replacements = 0;

for (const entry of readdirSync(ROOT, { withFileTypes: true, recursive: true })) {
  if (!entry.isFile() || !isTextFile(entry.name)) continue;
  const path = join(entry.parentPath ?? entry.path, entry.name);
  const before = readFileSync(path, 'utf8');
  const [after, count] = replacePhone(before);
  if (!count) continue;
  writeFileSync(path, after);
  filesChanged += 1;
  replacements += count;
}

// A future archive that already ships the new number legitimately produces zero
// replacements, so zero is not an error. The number vanishing altogether is -- that would
// mean the site went out with no way to reach the business.
const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
if (!home.includes(`tel:${NEW_E164}`)) fail(`homepage has no tel:${NEW_E164} link`);
if (!home.includes(`sms:${NEW_E164}`)) fail(`homepage has no sms:${NEW_E164} link`);
if (!home.includes(NEW_DISPLAY)) fail(`homepage never shows ${NEW_DISPLAY} as visible text`);

console.log(`patch-phone: ok, ${replacements} replacements across ${filesChanged} files`);
