// Single source of truth for the business phone number swap.
//
// The old number is dead: it cannot take calls and cannot take SMS. Any copy of it that
// survives into the published output is a lost booking, so both the patcher and the
// assertion below read their patterns from here rather than keeping two lists that can
// drift apart.
//
// The pairs are written out literally instead of being generated from a separator-tolerant
// regex because the replacement has to preserve the exact formatting of whichever style it
// matched -- "(945) 444-1941" in visible copy must stay parenthesised, "+19454441941" in a
// tel: href must stay E.164. Order matters: replacement is sequential, so the longer forms
// have to run before the bare-digit forms that are substrings of them. The old and new
// numbers share no digit sequence, so a replaced string can never be re-matched by a later
// pair.

export const OLD_DISPLAY = '(945) 444-1941';
export const NEW_DISPLAY = '(469) 571-8720';
export const OLD_E164 = '+19454441941';
export const NEW_E164 = '+14695718720';

// Longest / most specific first.
const PAIRS = [
  ['+1 (945) 444-1941', '+1 (469) 571-8720'],
  ['+1-945-444-1941', '+1-469-571-8720'],
  ['+1.945.444.1941', '+1.469.571.8720'],
  ['+1 945 444 1941', '+1 469 571 8720'],
  ['1-945-444-1941', '1-469-571-8720'],
  ['(945) 444-1941', '(469) 571-8720'],
  ['(945)444-1941', '(469)571-8720'],
  ['945-444-1941', '469-571-8720'],
  ['945.444.1941', '469.571.8720'],
  ['945 444 1941', '469 571 8720'],
  ['+19454441941', '+14695718720'],
  ['19454441941', '14695718720'],
  ['9454441941', '4695718720'],
];

// Anything that still reads as the old number after patching, in any separator style.
const LEFTOVER = /\(?945\)?[-. ]{0,2}444[-. ]{0,2}1941/g;

// File types whose bytes are text we own. Images and fonts are skipped.
const TEXT_EXT = new Set(['.html', '.htm', '.json', '.xml', '.txt', '.js', '.mjs', '.css', '.svg', '.webmanifest']);

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

// Returns the distinct old-number spellings still present in `text`.
export const findOldPhone = (text) => [...new Set(text.match(LEFTOVER) ?? [])];
