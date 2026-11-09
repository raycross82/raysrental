# Editorial queue

Updated November 9, 2026. Dates are proposed review weeks, not automatic publication dates.
Analytics is unavailable at setup; topic order reflects seasonal relevance and customer
planning needs, not measured search-volume estimates. Reassess at every run.

| Review week | Contribution | Purpose and evidence needed | State |
|---|---|---|---|
| Nov 3 | Thanksgiving & Friendsgiving table and chair rentals in DFW | Distinct seasonal dinner intent; current rental prices and seating assumptions checked against site/source | Draft prepared; owner approval required |
| Nov 9 | Delivery vs. setup: what to confirm before renting | Clarify carrying/placement/return questions; resolve FAQ wording against owner-approved fulfillment terms | Draft prepared with FAQ/schema correction; owner approval required |
| Nov 16 | Small office holiday party rental checklist | Buffet vs. dining counts, venue access and schedule; link corporate service page without repeating it | Proposed; avoid invented office case study |
| Nov 23 | Picking up folding tables and chairs: planning your trip | Folded dimensions, secure transport and returns; verify actual inventory dimensions before any vehicle-fit advice | Proposed; facts needed |
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
