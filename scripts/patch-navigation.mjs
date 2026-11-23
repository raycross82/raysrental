// Switch to the existing expandable menu before the logo and links collide.
import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const file = 'out/assets/css/style.css';
let css = readFileSync(file, 'utf8');
const original = '@media(max-width:940px){';
const updated = '@media(max-width:1200px){';
assert.ok(css.includes(original) || css.includes(updated), 'Navigation breakpoint missing');
css = css.replace(original, updated).replace('hamburger below 940px', 'hamburger below 1200px');
writeFileSync(file, css);
