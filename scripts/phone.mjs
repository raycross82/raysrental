// Single source of truth for the business phone number.
//
// Current number: (469) 654-4110, E.164 +14696544110.
//
// Two retired numbers must never reach the published site. The deploy archives still
// carry area code 945, exchange 444, line 1941. Pages written after that swap carried
// area code 469, exchange 571, line 8720. patch-phone.mjs rewrites both to the current
// number after every other injection, and assert-phone.mjs fails the build if either
// spelling survives. The digit groups stay separate and the full spellings are built
// from them, so a parenthesised form stays parenthesised and an E.164 form stays
// E.164. Longer forms run first, before the bare-digit forms that are substrings of
// them. Neither retired exchange/line appears in the current number, so a replaced
// string is never matched by a later pair.

export const NEW_AREA = '469';
export const NEW_EXCH = '654';
export const NEW_LINE = '4110';
export const NEW_DISPLAY = `(${NEW_AREA}) ${NEW_EXCH}-${NEW_LINE}`;
export const NEW_E164 = `+1${NEW_AREA}${NEW_EXCH}${NEW_LINE}`;

// [area, exchange, line] for every number that must be rewritten.
const RETIRED = [
  ['945', '444', '1941'],
  ['469', '571', '8720'],
];

const OLD = RETIRED[0];
export const OLD_DISPLAY = `(${OLD[0]}) ${OLD[1]}-${OLD[2]}`;
export const OLD_E164 = `+1${OLD[0]}${OLD[1]}${OLD[2]}`;

// Every spelling we will rewrite, in the same order for the retired number and the
// current number so a dash form is replaced by a dash form.
function spellings(area, exch, line) {
  const digits = `${area}${exch}${line}`;
  return [
    `+1 (${area}) ${exch}-${line}`,
    `+1-${area}-${exch}-${line}`,
    `+1.${area}.${exch}.${line}`,
    `+1 ${area} ${exch} ${line}`,
    `1-${area}-${exch}-${line}`,
    `(${area}) ${exch}-${line}`,
    `(${area})${exch}-${line}`,
    `${area}-${exch}-${line}`,
    `${area}.${exch}.${line}`,
    `${area} ${exch} ${line}`,
    `+1${digits}`,
    `1${digits}`,
    digits,
    `%2B1${digits}`,
    `%2B1-${area}-${exch}-${line}`,
    `%28${area}%29%20${exch}-${line}`,
    `%28${area}%29+${exch}-${line}`,
    `${area}%2D${exch}%2D${line}`,
    `%28${area}%29${exch}-${line}`,
  ];
}

const CURRENT = spellings(NEW_AREA, NEW_EXCH, NEW_LINE);
const PAIRS = RETIRED.flatMap(([area, exch, line]) =>
  spellings(area, exch, line).map((from, i) => [from, CURRENT[i]]),
).sort((a, b) => b[0].length - a[0].length);

function loose(area, exch, line) {
  return `\\(?${area}\\)?[-. ]{0,2}${exch}[-. ]{0,2}${line}`;
}

// Anything that still reads as a retired number after patching, in any separator style.
const LEFTOVER = new RegExp(RETIRED.map(([area, exch, line]) => loose(area, exch, line)).join('|'), 'g');

// File types whose bytes are text we own. Images and fonts are skipped.
const TEXT_EXT = new Set([
  '.html', '.htm', '.json', '.xml', '.txt', '.js', '.mjs', '.css', '.svg', '.webmanifest', '.vcf',
]);

export const isTextFile = (name) => TEXT_EXT.has(name.slice(name.lastIndexOf('.')).toLowerCase());

// Returns [patchedText, replacementCount].
export function replacePhone(text) {
  let out = text;
  let count = 0;
  for (const [from, to] of PAIRS) {
    if (!out.includes(from)) continue;
    count += out.split(from).length - 1;
    out = out.split(from).join(to);
  }
  return [out, count];
}

// Returns the distinct retired-number spellings still present in `text`.
export function findOldPhone(text) {
  LEFTOVER.lastIndex = 0;
  return [...new Set(text.match(LEFTOVER) ?? [])];
}
