// Assigns the next Rays Rentals quote number for today's Chicago calendar day.
//
// Store: Netlify Blobs, store name "quote-numbers", key YYYY-MM-DD, value the
// last sequence issued that day. The displayed number is RR-MMDD-## (no year);
// the key keeps a new year from continuing last year's count.
//
// Body: { date?: "YYYY-MM-DD", minSeq?: number }
// minSeq is honored only when it belongs to the same Chicago day the server is
// numbering, so a browser that issued quotes offline can skip past those
// numbers instead of colliding once it is back online. A date for any other
// day is ignored — callers cannot pick the counter they increment.
//
// POST /.netlify/functions/quote-number
// -> { number: "RR-0917-01", seq: 1, date: "2026-09-17" }

import { getStore } from '@netlify/blobs';
import { allocateSeq, chicagoDateParts, formatQuoteNumber } from '../../site-overlay/assets/js/quote-doc.js';

export async function assignQuoteNumber(blob, body, now = new Date()) {
  const parts = chicagoDateParts(now);
  const requested = body && typeof body === 'object' ? body : {};
  const honor = requested.date === parts.key ? requested.minSeq : 0;
  const raw = await blob.get(parts.key, { type: 'text' });
  const seq = allocateSeq(raw, honor);
  await blob.set(parts.key, String(seq));
  return {
    number: formatQuoteNumber(parts.month, parts.day, seq),
    seq,
    date: parts.key,
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    const store = getStore('quote-numbers');
    return json(await assignQuoteNumber(store, body));
  } catch (err) {
    const status = err && err.code === 'EXHAUSTED' ? 409 : 500;
    return json({ error: err && err.message ? err.message : 'Could not assign a quote number' }, status);
  }
}
