# Editorial queue

Updated November 23, 2026. Dates are proposed review weeks, not automatic publication dates.
Analytics reads succeeded November 23. Reassess seasonal relevance and customer
planning needs alongside the available performance evidence. Reassess at every run.

| Review week | Contribution | Purpose and evidence needed | State |
|---|---|---|---|
| Nov 3 | Thanksgiving & Friendsgiving table and chair rentals in DFW | Distinct seasonal dinner intent; current rental prices and seating assumptions checked against site/source | Draft prepared; owner approval required |
| Nov 9 | Delivery vs. setup: what to confirm before renting | Clarify carrying/placement/return questions; resolve FAQ wording against owner-approved fulfillment terms | Draft prepared with FAQ/schema correction; owner approval required |
| Nov 16 | Small office holiday party rental checklist | Buffet vs. dining counts, venue access and schedule; link corporate service page without repeating it | Draft ready; hypothetical lunch shifts clearly labeled |
| Nov 23 | Refresh venue-access checklist if there are verified gaps | Confirm current delivery terms and avoid duplicating the delivery guide | Completed as a refresh within the delivery guide |
| Nov 30 | Indoor birthday party seating at home | Combine household seating and rentals; room layout checklist; avoid duplicating general seating guide | Proposed; merge into existing guide if insufficient new value |
| Dec 7 | Rental quote checklist for a New Year's gathering | Date/return period, guest counts, serving space, sound and availability; no assumed holiday hours | Proposed |

## Existing content to preserve

- /blog/party-rental-prices-dfw/
- /blog/graduation-party-rentals-dfw/
- /blog/seating-guide/
- /blog/backyard-quinceanera-dfw/
- /blog/backyard-cookout-checklist/

## Pending independent work

PR #23: Mesquite metadata proposal; awaiting review. Keep separate from this batch.

## Release log

No public release from this workflow yet. On approval, record the exact commit, public
deployment ID, article URLs, actual publication date, tests and measurement window here.
Do not put private account analytics, customer details or secrets in this repository.

## November 9 review

Main and production remain at 23bad35; PR #32 is pending, PR #23 untouched.
Two unpublished articles now await approval in PR #32. Delivery/setup guide is
based on an observed FAQ/quote ambiguity, not measured search demand. The FAQ
answer and its structured data now match the existing optional-setup quote terms.
Windsor read retried: account-limit blocker persists; no performance figures used.
Competitor-watch lookup returned no readable latest result; no competitor claims added.
Validation: full build passed (53 HTML pages, 45 JSON-LD blocks, 45 sitemap targets),
including quote/form and preview tracking-isolation regression checks. Editorial
generation is repeatable. Desktop/390px mobile preview reviewed. Live homepage,
quote, blog, robots and sitemap returned HTTP 200. No customer forms submitted.

## November 16 review

Three drafts await release approval. Current production uses delivery-only fulfillment from PR #33. Both earlier guides now reflect it and the current FAQ comes from main. The office guide covers staggered lunches and existing furniture. Analytics access restored. Hold additional drafts until space opens. PRs #23 and #34 remain independent.

## November 23 review

Main remains 21cc20f and production deploy 6af3485f920f862b7cd45145 is ready. Three drafts remain pending in PR #32. Expanded the delivery guide with an actionable entrance/access/placement/collection checklist and an office-guide link. Current quote wording and source prices reviewed. Search Console and GA4 reads succeeded for October 23 through November 19. Private metrics are excluded from this repository. Competitor watch completed but exposed no latest result, so no competitor claims were added.

The owner is considering a rental minimum in a separate conversation. A final minimum amount and calculation rule are still needed before changing prices, forms or article claims. Review seasonal relevance again if Thanksgiving publication is delayed.

Full build passed with 54 pages, 46 JSON-LD blocks, 93 FAQ answers and 46 sitemap targets. Quote/form and preview tracking-isolation tests passed. Editorial generation is repeatable. Live homepage, quote, blog, robots and sitemap responded HTTP 200.

Visual review found shared-header logo/navigation overlap at 1040px. The build now uses the existing expandable menu through 1200px. No menu links or business policies changed.
Desktop and 390px mobile layouts reviewed; the 1040px expandable menu opens and its quote link works. Full build and regression checks passed again after the navigation correction. No lead form submitted.
