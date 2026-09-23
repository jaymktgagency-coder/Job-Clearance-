# Things to replace before this goes live

Everything below was not supplied, so the demo uses a stand-in.

## Photos — `public/images/`
Every stock photo carries a small "PLACEHOLDER PHOTO" tag on the page.
Replace each file with a real photo **of the same name** (JPG, ideally 2000px wide)
and the site picks it up. When all four are real, set
`SHOW_PLACEHOLDER_PHOTO_TAGS = false` in `src/lib/business.ts`.

| File | Where it shows | Best replacement |
|---|---|---|
| `placeholder-hero-roofer.jpg` | Top of the page (also the link preview on social/text) | Your crew on a finished roof, landscape |
| `placeholder-crew-on-roof.jpg` | Services section (desktop) | Crew mid-job |
| `placeholder-storm.jpg` | Storm damage section background | Storm damage you repaired, or a Fort Lauderdale sky |
| `placeholder-florida-home.jpg` | Service area section | A finished roof on a local home |

Stock photos are from Unsplash (free licence).

## Business details — all in `src/lib/business.ts`
- [ ] **Opening hours** — currently Mon–Fri 7–6, Sat 8–2, Sun closed (made up)
- [ ] **Florida roofing licence number** (e.g. `CCC1234567`) — empty, so the site just says "State-licensed in Florida"
- [ ] **Google rating and review count** — shows "5.0" with no count; confirm the real rating
- [ ] **Google reviews link** — currently a Google search; replace with the Business Profile reviews link
- [ ] **Warranty length** — empty, so copy says "backed in writing" without a number

## Reviews — `src/lib/content.ts`
- [ ] Reviewer names (shown as "Google review" until filled in). Only use names with the reviewer's permission / as shown publicly on Google.

## Services — `src/lib/content.ts`
- [ ] Confirm the six services and the roof types (shingle, tile, metal, flat). The brief listed examples only; gutters, soffits and skylights came from the reviews.
- [ ] Confirm the neighborhoods list.

## Contact form
- [ ] **Leads do not reach an inbox yet.** Submissions are validated and written to the Vercel logs only. Set `CONTACT_WEBHOOK_URL` in Vercel (Zapier, Make, Formspree, Slack…) and redeploy.

## Legal
- [ ] The storm-damage section includes the Florida Statute 489.147 notice (deductible + insurance fraud warning) and says you don't interpret policies or negotiate claims. Have the owner or their attorney confirm the wording.
- [ ] Confirm "Insured" and "Licensed" claims and the insurance certificate offer.

## Domain
- [ ] When a real domain is attached, set `NEXT_PUBLIC_SITE_URL` (e.g. `https://heritagesaferoofing.com`) in Vercel so the canonical URL, sitemap and structured data point at it.
