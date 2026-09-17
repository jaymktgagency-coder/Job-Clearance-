# The Vouch visual world

Product truth — what Vouch is, who it serves, what the money rules are —
lives in `CLAUDE.md` and is not repeated here. Two files claiming to
describe the same thing is how documentation starts lying. **This file
covers only how it looks and moves.**

> Keep this current the same way as CLAUDE.md. If you change a token, change
> the line here that explains it, in the same commit.

---

## The idea

Hiring software is blue. LinkedIn is blue, every applicant tracking system
is blue, every job board is blue-grey. Blue is the colour of being processed
by a machine.

Vouch is the opposite claim: **a real person put their name on you.** So the
product is orange — warm, human, a bit loud, impossible to mistake for an
ATS. The orange is not decoration, it is the argument.

Against that: warm off-white paper, warm near-black ink, and genuinely
physical surfaces. Premium, not corporate.

**Reference for feel and energy:** [mikes.cv](https://www.mikes.cv) —
specifically its restraint in motion, its layered surfaces, and its warm
neutrals. We take its *physics*, not its layout.

---

## Palette

Defined in `src/app/globals.css`. Never write a colour anywhere else.

### The two oranges that matter

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `--brand-500` | `#fd7924` | **7.0:1** with near-black on it | Fills. Buttons, the mark, anything loud |
| `--brand-700` | `#ac3f1a` | **5.8:1** on paper | Orange *words*. Links, emphasis |

**Why two.** Bright orange is the hardest colour in interface design.
White text on `#fd7924` is 2.6:1 and bright orange text on white is 2.5:1 —
both fail the 4.5:1 accessibility floor badly, and both are the naive
default. So:

- Orange as a **surface** carries near-black text, never white.
- Orange as **text** is always the darker `--brand-700`.

That single split is what lets Vouch be aggressively orange and still pass
an accessibility audit. Stripe reads these pages by hand when approving a
marketplace; a failing contrast ratio is a real commercial risk, not a
matter of taste.

The full ramp is `--brand-50` … `--brand-900`, every step verified to sit
inside the sRGB gamut. Steps outside it get silently flattened by the
browser into something duller than specified — four of the first-draft
steps did exactly that and were pulled back in.

### Ground and ink

| Token | Value | Note |
|---|---|---|
| `--background` | `oklch(0.985 0.006 70)` | Warm paper. **Not** `#ffffff` |
| `--card` | `oklch(1 0 0)` | Pure white — cards lift *off* the paper |
| `--sunken` | `oklch(0.962 0.011 62)` | Sits below the page: wells, table heads |
| `--foreground` | `oklch(0.19 0.02 55)` | Warm near-black. **Not** `#000` |
| `--muted-foreground` | `oklch(0.48 0.028 52)` | 6.4:1. Quiet, still legible |

Every neutral carries a trace of orange. A cold grey next to a warm orange
reads as a mistake.

### The other two

`--destructive` is pushed toward crimson (hue 22, not the usual 27) to pull
it away from the brand orange — in an orange product a normal red error
looks like just another brand colour. Colour is never the only signal:
errors always carry an icon and words.

`--success` is a deep green for a vouch accepted or a payout released.

---

## Depth — the "3D"

Not drop shadows on everything. Three stacked techniques:

1. **Layered surfaces.** `sunken` → `background` → `card`. Three planes,
   each a visible step apart.
2. **The keyline** (`.keyline`) — a 1px inset highlight along the top edge.
   This is what makes a rectangle read as a lit physical object. It is the
   cheapest and most convincing part of the whole system.
3. **Warm shadows.** Every shadow has *both* an offset and a blur — a
   zero-offset shadow is a glow, and glows read as cheap. The shadow colour
   is warm brown (`--shadow-rgb: 62 30 12`), never black, so it belongs to
   the same world as the orange.

`--shadow-brand` tints the glow under a primary button with the orange
itself, so the button looks lit rather than merely floating.

**Declare elevation once.** A border *or* a shadow, never both — a 1px
border under a soft shadow is the giveaway of a card that cannot decide
what it is. The keyline is an inset highlight and does not count as a
border.

Card radius is 14px (`--radius`). Pills are for small controls only.

---

## Motion

Three curves. Never improvise a fourth.

| Token | Curve | When |
|---|---|---|
| `--ease-out` | `cubic-bezier(.23, 1, .32, 1)` | General slowdown |
| `--ease-enter` | `cubic-bezier(.22, 1, .36, 1)` | Pressing or hovering *into* a thing |
| `--ease-spring` | `cubic-bezier(.34, 1.9, .64, 1)` | **Release.** Overshoots, then settles |

The asymmetry is the whole trick. Press settles smoothly; release springs
slightly past its resting point and comes back. That is the difference
between a button that is animated and a button that is satisfying.

| Token | Value | For |
|---|---|---|
| `--duration-fast` | 160ms | Buttons, links, small controls |
| `--duration-mid` | 260ms | Cards, panels |
| `--duration-slow` | 420ms | Page-level and large media |

Small things move fast, big things move slower. Mismatching these is what
makes an interface feel twitchy in one place and sluggish in another.

**`prefers-reduced-motion` is honoured globally** in `globals.css`. Not
politeness — an accessibility requirement.

---

## Type

| Face | Role | Why |
|---|---|---|
| **Outfit** | Headings, display | Geometric with real character at large sizes |
| **DM Sans** | Body, labels, forms, tables | Holds up at 14px, where Outfit does not |
| **Geist Mono** | Money, dates, counts only | Digits must line up in a column |

All three are downloaded and self-hosted at build time by `next/font`, so
no visitor request ever leaves for Google.

- Headings: display face, `-0.025em` tracking, balanced wrapping. Tracking
  never goes past `-0.04em`.
- Body: `.measure` caps line length at 68ch.
- Anything in a money column gets `.tabular`.

---

## The parts we did not draw

Text selection, the typing caret, the scrollbar and the focus ring ship
with browser defaults that belong to no design system. All four are themed
from the palette in `globals.css`. It is the cheapest signal that a page
was built rather than assembled, and the one most reliably skipped.

The focus ring is orange, 2px, offset 2px, and is **never** removed.

---

## House rules

Things that are *category defaults*, deliberately refused here:

- **No kicker/eyebrow** above a heading. The heading carries its own weight.
- **No gradient text.** Emphasis comes from weight or size.
- **No grid of identical icon-heading-text cards** as page structure. Cards
  are the lazy container; nested cards are always wrong.
- **No emoji as icons.** Icons are drawn — `lucide-react`, one stroke weight.
- **No mono as a costume** for "technical". Mono means data or measurement.
- **No section numbers** (01 / 02 / 03) unless the sequence carries meaning.
- **No hard offset shadows.** This is not a neobrutalist world.

---

## Scope of the visual pass

Presentation only. Untouched: server actions, Supabase queries and RLS,
Stripe flows, the webhook, migrations, `src/lib/**`, the AI layer.

**Loud everywhere** is the founder's explicit call (asked and confirmed) —
the high-energy treatment runs across working screens too, not just the
landing page, with the floor that contrast and scanability never drop below
usable on data-heavy screens like `/employer/billing`.
