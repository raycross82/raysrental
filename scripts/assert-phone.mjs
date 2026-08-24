// Build-time assertion: the dead phone number must not reach production.
//
// This is the last thing the build does, so it also covers anything a later sed in
// netlify.toml or a re-uploaded archive reintroduces after scripts/patch-phone.mjs ran.
// It fails the build rather than warning: a page that still shows (945) 444-1941 looks
// completely fine in a browser and in a deploy preview, and the only symptom is calls and
// texts going nowhere.
//
// Two passes. The raw pass greps every text file for the number in any separator style,
// which is what catches visible copy, tel:/sms: hrefs, <title> and og:/twitter: meta. The
// JSON-LD pass parses each ld+json block and walks it as data, which catches a number that
// the raw pass could miss because it was escaped or split by the serialiser, and asserts
// that every telephone property actually carries the new number rather than having been
// dropped.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTextFile, findOldPhone, NEW_E164, OLD_DISPLAY } from './phone.mjs';

const ROOT = 'out';
const LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

const problems = [];
let scanned = 0;
let ldBlocks = 0;
let telephones = 0;

const files = readdirSync(ROOT, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && isTextFile(e.name))
  .map((e) => join(e.parentPath ?? e.path, e.name))
  .sort();

// Walks a parsed JSON-LD value and reports every string holding the old number, plus the
// value of every "telephone" property it passes.
function walk(node, path, onOld, onPhone) {
  if (typeof node === 'string') {
    for (const hit of findOldPhone(node)) onOld(path, hit);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, `${path}[${i}]`, onOld, onPhone));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'telephone') onPhone(`${path}.${key}`, value);
      walk(value, `${path}.${key}`, onOld, onPhone);
    }
  }
}

for (const path of files) {
  const text = readFileSync(path, 'utf8');
  scanned += 1;

  for (const hit of findOldPhone(text)) {
    const count = text.split(hit).length - 1;
    problems.push(`${path}: ${count}x "${hit}"`);
  }

  if (!path.endsWith('.html')) continue;

  for (const [, block] of text.matchAll(LD_RE)) {
    ldBlocks += 1;
    let doc;
    try {
      doc = JSON.parse(block);
    } catch (err) {
      problems.push(`${path}: JSON-LD did not parse (${err.message})`);
      continue;
    }
    walk(
      doc,
      '$',
      (at, hit) => problems.push(`${path}: JSON-LD ${at} holds "${hit}"`),
      (at, value) => {
        telephones += 1;
        if (value !== NEW_E164) problems.push(`${path}: JSON-LD ${at} is "${value}", expected "${NEW_E164}"`);
      },
    );
  }
}

if (!telephones) problems.push('no JSON-LD node carries a telephone property at all');

if (problems.length) {
  console.error(`assert-phone: the retired number ${OLD_DISPLAY} is still in the output:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `assert-phone: ok, ${scanned} files and ${ldBlocks} JSON-LD blocks clean, ${telephones} telephone properties on ${NEW_E164}`,
);
