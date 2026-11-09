# Rays Rentals website workflow

Owner: Ray Cross. Started November 3, 2026. Scope: raysrental.com marketing website.
HQ and Sun Ray remain separate workstreams. The user requested weekly SEO/AEO
content and ongoing maintenance, with Ray approving public releases.

## Source and release rules

- Source: https://github.com/raycross82/raysrental; public production branch: main.
- Netlify project: raysrentals, site ID 024d7ffb-a618-48f2-8633-87100e46fad9.
- Initial verified public deployment: 6ae77d758aded88f3fd0206c, source
  23bad35d0053023772509d124e9cccece7fe388b. Re-read live deployment every run.
- Work on a separate `website/` branch and open/update a draft PR. Never push
  straight to main, merge, approve your own release, enable auto-merge, or use
  a production deploy command without Ray's approval of that specific version.
- Preserve existing SEO URLs, branding, forms and customer records. This is a
  monorepo: do not change hq/ in a marketing-content task.
- Inspect open PRs before editing. PR #23 contains a separate Mesquite metadata
  proposal; do not silently incorporate, close, approve or overwrite it.
- Re-fetch main before work and before release. If newer changes affect the
  proposal, reconcile and retest; materially changed content needs fresh approval.
- The automation's approval instructions and draft PR are the current release
  controls. Required-review branch protection has NOT been configured or verified.

## Business facts

- `pricing.json` owns current public prices, packages and promotion threshold.
- `scripts/phone.mjs` owns current business phone information.
- The live quote page is the reference for current deposit and fulfillment wording:
  https://raysrental.com/quote/. At setup it states a 25% deposit after confirmation,
  per-day pricing, free customer pickup, and separately quoted delivery/optional setup.
- Prefer the latest explicit owner-approved change when sources conflict. Flag
  contradictions for review; never infer new prices, discounts or business policies.
- Use tokens for monetary examples in new articles. Do not change historical quotes.
- Do not promise holiday hours, stock, specific vehicles fitting equipment, delivery
  prices, permits, endorsements or capacities without evidence.

## Each weekly run

1. Read this file, CONTENT-QUEUE.md, pending PRs, the latest live deployment,
   `pricing.json`, the blog index and relevant current pages. Resume pending work
   before creating overlapping PRs. Save meaningful state in the branch.
2. Review Search Console queries/pages and GA4 landing pages/lead events when
   accessible. Compare complete equal 28-day periods; omit recent incomplete days
   and label low sample sizes. Calls clicked are not completed calls or bookings.
   Exclude known test/duplicate inquiries. Keep private analytics and lead records
   out of this PUBLIC repository and public previews.
3. Windsor reads were blocked at setup by an account-count plan limit. Account
   listings do not prove data access. Do not use substituted/demo numbers, remove
   accounts or buy an upgrade. Retry a bounded read on a later run and report the
   blocker if unresolved. Public research and technical checks can still proceed.
4. Review the existing rental competitor watch's verified findings when available.
   Otherwise use first-party competitor pages sparingly. Do not create another
   competitor monitor or treat a search cache as today's live price.
5. Select one substantive blog contribution: a new article answering a distinct
   customer question, or a meaningful refresh where an existing page already
   covers that intent. Aim for one new post weekly when evidence supports a distinct
   topic. Never create filler or near-identical city posts to meet a quota. Queue
   the next draft if a previous release is awaiting approval; limit active drafts
   to three, then improve or fact-check the queue until Ray reviews it.
6. Perform a bounded health review: availability of homepage/quote/blog, valid
   sitemap/robots/canonicals, broken internal links, price/phone/schema consistency,
   mobile usability, forms and tracking. Prioritize a verified lead-capture failure
   over optional content. Do not submit real lead forms or send customer messages.
7. Implement, run the full build/checks, inspect desktop and mobile preview, and
   create a reviewable PR with the actual preview URL. If preview/testing is blocked,
   describe exactly what was not verified; do not label it passed or release-ready.
8. Deliver one short approval brief: what changed, why (evidence vs hypothesis),
   preview and PR, passed/failed checks, any cost, and decision requested. No repeated
   alerts for unchanged findings. An outage or form failure deserves a clear alert.

## Editorial and AEO standard

- Write for DFW customers using clear, practical language and a direct answer near
  the beginning. Explain assumptions behind tables and calculations.
- Add useful question headings, concise answers, accessible comparison tables and
  relevant internal links to service pages and the quote/availability flow.
- Cite primary sources for external factual, technical and venue-policy claims.
  Never invent reviews, completed jobs, credentials, search demand or results.
- Use descriptive unique titles/descriptions, stable canonical URLs, BlogPosting
  and BreadcrumbList data matching visible text. Organization authorship must be
  visible. Set `publishedOn` only to the actual first-publication date at release;
  preserve it on refreshes. `reviewedOn` is an internal editorial date.
- No promises of rankings, AI citations or rich results. Google says ordinary SEO
  best practices apply to AI features; special AI markup is not required.
- Keep FAQs helpful even without FAQ rich-result eligibility. Do not add unsupported
  review/rating schema, fake locations, keyword stuffing or automated backlink trades.
- Source guidance: https://developers.google.com/search/docs/appearance/ai-features
  and https://developers.google.com/search/docs/fundamentals/creating-helpful-content.

## Build and authoring

The live build assembles ZIP archives, overlays and patches; files in `out/` are
generated. Do not edit the output as the permanent source or replace the live build
with an old archive. Preserve the existing build pipeline.

Add a unique entry to `content/blog/posts.json` and its HTML body under that folder.
Use `{{rate.tables}}`, `{{rate.chairs}}`, `{{rate.coolers}}`,
`{{package.party60.price}}` and `{{freeCoolerMinimum}}` for prices.
The optional `{{dinner_rows}}` token builds the first guide's seating examples.
The editorial builder inherits current site chrome and adds blog cards, schema and
sitemap entries without removing existing pages.

```sh
npm ci --ignore-scripts
python3 scripts/build-site.py
git diff --check
```

GitHub `Website checks` builds PRs/main, runs the full regression suite and tests
repeatable editorial generation. It does not publish or merge. Netlify handles
preview builds; main pushes can deploy BOTH marketing and HQ projects. Approval is
therefore required before merge even for apparently small edits.

## Approval, release and measurement

Before asking Ray: provide the preview, changed paths, source commit and tests.
Record his approval against that version. Set the actual article publication date,
rerun checks, merge only the approved scope, and confirm the resulting Netlify
production deploy and live URLs. Preserve the prior commit/deploy references.

Verify main page, article, links, canonical, robots and sitemap after release. Test
lead flows with local mocks or a designated test destination; don't create fake
customer submissions. If a published change fails, prepare a revert commit and
test the fix; seek Ray's release approval unless he separately pre-authorizes recovery.

Record release date and assess after 28 complete days (and 56 if traffic is low).
Use clicks, impressions, CTR and search position by page/query; add genuine inquiries
and bookings when available. These comparisons are observational, not proof of causality.
Never claim AI citations or lead improvement without evidence.

## Costs and operations

Use existing services. No new subscriptions, paid APIs, paid links or ads without
explicit approval. One normal weekly run, bounded retries, no overlapping writers.
Git history and saved build artifacts preserve website versions; customer-database
backup is a separate HQ responsibility. A continuous uptime monitor is not yet set up.
