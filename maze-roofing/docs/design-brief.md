# Build Prompt — Maze Roofing Fort Lauderdale

Paste everything below the line into Claude, Lovable, v0, or Cursor. It is written as a single self-contained brief.

---

## ROLE

You are the design lead at a small studio known for giving every client an identity that could not be mistaken for anyone else's. Build a complete, production-ready marketing website for a roofing contractor. Reject templated contractor-website conventions. Make deliberate, opinionated choices and take one real aesthetic risk you can defend.

## THE CLIENT

**Maze Roofing Fort Lauderdale** — residential and light-commercial roofing serving Broward and Palm Beach County (Fort Lauderdale, Boca Raton, Pompano Beach, Plantation, Coral Springs, Hollywood, Davie, Weston, Sunrise, Miramar).

They have never had a website. Everything below has been reverse-engineered from 192 Google reviews averaging 4.8 stars. Treat it as ground truth about who they are.

**What they actually do:** full roof replacement (asphalt shingle, standing-seam and corrugated metal, barrel tile, flat/TPO), leak repair, storm and wind damage repair, drip edge / fascia / soffit, under-roof insulation, free inspections and second opinions, insurance and permit handling.

**Real project price bands, pulled from verified Google reviews:**

| Work | Range seen in reviews |
|---|---|
| Repairs and small jobs | $1,000 – $8,000 |
| Shingle replacement, average home | $10,000 – $18,000 |
| Larger homes / metal / complex roofs | $20,000 – $35,000 |

## WHAT THE REVIEWS ACTUALLY SAY — build the site on these five findings

**1. Customers fall in love with a person, not a company.** Nearly every five-star review names an individual: Ofir, Gal, Meir, Tony, Sheva, Patrick, Lorenzo, Harel, Or, Itay, Benjamin, Aren, Nir, Alon. Reviewers describe them as patient, honest, "down to earth," available on the phone, sending photos after each step. Several customers say they hired Maze specifically because of the person who showed up.

**2. They win on the estimate.** Reviewers repeatedly mention comparing Maze against three, four, five, eight, even ten other quotes and choosing Maze. Sometimes Maze was the cheapest; often they weren't, and the salesperson explained *why*, which is what closed the deal.

**3. Their best trust signal is the jobs they turned down.** One customer was told a repair would buy him another 15–20 years instead of a replacement. Another was walked through questions on the phone until they realized her leak was already covered under an existing warranty — Maze lost the job and she reviewed them anyway. A third expected a hard upsell and got a small repair recommendation instead. This is rare in roofing and it is the single most persuasive thing about them.

**4. Speed and cleanliness.** Roofs finished in three days, one week, one afternoon. Permits pulled by the company. Crews that sweep the driveway and come back the next morning to check for stray debris. Emergency response inside the hour, including a Sunday afternoon flat-roof leak.

**5. They serve absentee owners, developers, and HOAs.** Out-of-state landlords managing a job from Boston, real estate developers, rental properties, HOA coordination, repeat customers on second and third homes.

### Two real weaknesses the site must design around

- A minority of negative reviews are about **surprise costs** — a permit fee billed after the final invoice, a scope that didn't match what was ordered. Radical written transparency about what a quote includes is therefore a **conversion feature, not a legal footnote.**
- Two reviewers complain about **repeated unsolicited sales texts.** So: no exit-intent popups, no auto-dialers, no pre-checked consent boxes. Lead capture must be explicitly opt-in and say plainly what happens after someone submits. Make restraint part of the brand.

---

## VISUAL DIRECTION

Luxury here means *material* and *precision*, not gold gradients. Think architecture-firm monograph, not contractor flyer. The reference points are standing-seam metal, oxidized copper flashing, coquina and limestone, and the specific quality of South Florida light at 5pm.

### Palette — use exactly these

```
Bitumen   #14161A   base / dark sections, near-black with a blue cast
Shell     #EDE7DD   warm limestone, light sections — NOT a cream #F4F1EA
Zinc      #6E7681   secondary text, rules, metal surfaces
Patina    #3E7A6B   primary accent — aged copper flashing, used for links,
                    active states, and the signature spec plates
Copper    #C1743F   emergency accent ONLY — the leak/storm CTA and nothing else
```

Do not introduce a fifth accent. Do not use contractor red, safety orange, or a blue-to-purple gradient anywhere.

### Type

- **Display:** Archivo Expanded — wide, architectural, structural. Weights 600/700. Tight tracking at large sizes.
- **Body:** Inter Tight — 400/500, generous line height, 17–18px base.
- **Data:** JetBrains Mono — prices, square footage, permit numbers, timelines, spec plates. This face is what makes the site feel like a spec sheet instead of a brochure.

Sentence case everywhere. No all-caps headlines except tiny eyebrow labels in mono at 11px with wide tracking.

### Signature element — the spec plate

**Every project photograph on the site carries a small mono-type plate in the corner**, in the manner of an architectural drawing label:

```
FORT LAUDERDALE, FL 33304
STANDING SEAM METAL / 2,400 SQ FT
PERMIT PULLED BY MAZE
4 DAYS ON SITE
$28,400 — FINAL, AS QUOTED
```

That last line is the whole brand thesis in five words. Repeat it across the site. Nobody else in this industry publishes it.

Spend the boldness here and keep everything else disciplined: hairline Zinc rules, generous whitespace, no drop shadows, no glassmorphism, border radius 2px or 0.

### Motion

One orchestrated moment on load: the hero spec plate types in line by line in mono, roughly 400ms total, then stops. Elsewhere, scroll reveals at 12px translate and 300ms only. Respect `prefers-reduced-motion` fully. Nothing loops, nothing parallaxes, nothing bounces.

---

## PAGE STRUCTURE — home page

**1 — Hero.** Full-bleed photograph of a finished South Florida roof, shot low and late in the day so the metal or granule texture reads. Spec plate bottom-left. Headline in Archivo Expanded, no more than seven words, in the register of: *The roof gets done when we said it would.* Sub-line naming the actual promise: free inspection, honest assessment, permits handled, fixed written price. Two buttons only — **Get a free inspection** (Patina) and **Roof leaking right now** (Copper). No form in the hero.

**2 — Proof strip.** Thin Bitumen band: `4.8 ★ · 192 Google reviews` · `Licensed & insured` · `Permits pulled by us` · `Broward & Palm Beach`. Numerals in mono. Link the rating to the live Google profile.

**3 — Meet the person who will run your roof.** *Lead with this — it is the strongest asset they have.* A horizontal roster of real project managers, each with a portrait, first name, role, years, specialty, and one short line in their own voice. Ofir, Gal, Meir, Tony, Sheva, Patrick, Lorenzo, Or, Harel, Itay. Copy above it: customers ask for these people by name. Every estimate form field set should end with an optional "request someone specific" dropdown built from this roster.

**4 — What we do.** Six cards: metal, shingle, tile, flat & TPO, leak & storm repair, inspections and second opinions. Each card gets a real photo with a spec plate and a typical range in mono. No icon sets, no clipart.

**5 — What a Maze quote includes.** The transparency section — a written ledger, mono-typed, of everything folded into the number: tear-off and disposal, underlayment, permit fees, final county inspection, cleanup, warranty registration. Then a short second column headed *What could still change the price*, listing honestly the things nobody can see until the old roof comes off — rotted decking, unexpected layers, code upgrades — with the sentence that any change is priced and approved in writing before anyone touches it. This section will convert better than the hero. Do not soften it.

**6 — Sometimes we tell you not to replace your roof.** Three short case cards, each ending with what Maze recommended and what it cost the company:
- A homeowner braced for a full replacement, told the roof had 15–20 years left with one repair.
- A leak diagnosed over the phone as covered by an existing warranty — no job for Maze at all.
- An expected upsell that came back as a small repair recommendation instead.

Set this section on Bitumen. It is the emotional center of the page.

**7 — How it goes.** A genuine sequence, so number it 01–06: inspection and photos → written fixed quote → permit filed by Maze → tear-off and install → county final inspection → warranty registered. Give each step a realistic duration in mono. Note the six-week-including-permits reality rather than pretending it's instant.

**8 — Reviews.** A dense masonry wall of real Google reviews pulled from the client's profile, each showing reviewer name, star count, date, and the team member named in it. Filter chips by team member and by service type. Include the volume — 192 reviews at 4.8 is the proof; don't cherry-pick six.

**9 — Emergency band.** Copper. For active leaks and storm damage. One phone number, huge, tappable, plus the real detail that they have shown up inside an hour on a Sunday. This is the only place Copper appears.

**10 — Service areas.** Simple typographic list of cities, not a map embed. Include a line for out-of-state and absentee owners managing a property remotely — they have real reviews from exactly those customers.

**11 — Estimate request.** Multi-step, four screens maximum: what's happening (replacement / repair / inspection / emergency) → property type and rough size → timing and whether it's insurance-related → name, contact, address. Then a consent block, unchecked by default, in plain language: what Maze will do with the number, who calls, how fast, and how to stop. Below submit, in mono: *We call once. If you don't want a call, tell us and we'll email.* Given their review history on this exact issue, this restraint is a selling point — write it like one.

**12 — Footer.** License number, insurance, hours, phone, address, Google and Instagram links, service pages, financing, warranty, privacy, SMS terms.

## OTHER PAGES

Build routes and full page structure for: each of the six services; each of the ten cities (unique intro copy, local permit notes, real nearby project spec plates — never spun duplicate text); About / the team; Financing and payment options (reviews mention flexible payment and approval assistance); Warranty; Reviews; Contact; Privacy and SMS terms.

## VOICE

Plain, warm, specific, quietly confident. Short sentences. Real numbers instead of adjectives. Never "unparalleled," "premier," "your trusted partner," or "we go above and beyond." The team is largely Israeli-American and the reviews describe a family feeling — several owner responses welcome customers "to the Maze family." That warmth is allowed; corporate polish is not.

Write every word of the copy. Do not leave lorem ipsum or `[placeholder]` anywhere.

## TECHNICAL

- Next.js (App Router) + Tailwind + TypeScript. Static where possible.
- Mobile-first. Most of this traffic taps a phone number from a Google Maps listing on an iPhone — the sticky mobile call bar and tap targets matter more than the desktop hero.
- Lighthouse 95+ across the board. Images in WebP with explicit dimensions, lazy-loaded below the fold, LCP hero preloaded.
- WCAG AA: visible keyboard focus rings in Patina, 4.5:1 minimum contrast, real alt text, semantic landmarks.
- `RoofingContractor` + `AggregateRating` + `FAQPage` JSON-LD schema. NAP consistent with the Google Business Profile everywhere.
- Per-page titles and meta descriptions, OG images, sitemap, robots.
- Form posts to a placeholder endpoint with clear TODO comments for CRM wiring. Include a honeypot field and basic rate limiting.
- Every phone number and CTA gets a distinct analytics event name.

## DO NOT

Stock photos of generic smiling families. Countdown timers or fake urgency. Exit-intent popups. Chat bubbles that open by themselves. Pre-checked consent boxes. Auto-playing video with sound. Carousels. Star ratings that aren't real. Trust badges the client hasn't earned. AI-generated roof imagery — leave clearly marked `IMAGE:` placeholders describing the exact photo the client should supply.

## DELIVER

Before writing any code, output a short design plan: the token system, the type scale, an ASCII wireframe of the home page, and one paragraph naming the aesthetic risk you're taking and why it's right for this client. Then build the full site.
