# Vouch

Getting hired increasingly means knowing someone inside who will vouch for you.
People without that network are locked out. Vouch lets a stranger get vouched
for anyway, by giving verified employees a reason to help.

- **Seekers** create a profile and request an intro to a specific role. Free
  forever. Never charged, for anything.
- **Vouchers** are verified current employees. They review requests for roles at
  their own workplace and write an honest vouch — or decline. They earn a share
  of the fee and build a public track record.
- **Employers** post roles and only ever see candidates carrying a vouch. They
  pay a flat success fee only when someone is actually hired.

**New here? Read [SETUP.md](./SETUP.md).** It walks through every account and
key from scratch. For what's in the database and why, see
[docs/SCHEMA.md](./docs/SCHEMA.md).

---

## How the money works

| | |
|---|---|
| Employer pays | Only on a hire. Tier 1 (hourly/service) $500, Tier 2 (salaried/professional) $2,000 |
| Voucher receives | 50% of that fee |
| Payout releases | 60 days after the hire's start date — not at hire |
| If the hire leaves within 30 days | Employer gets a 50% credit toward their next hire. No cash refund |
| If they leave before day 60 | The voucher is paid nothing, whatever the reason |
| Seeker pays | Nothing, ever |

Fees, shares, and caps live in the `platform_settings` table, not in code. The
price a job was posted under is frozen onto that job, so changing your pricing
never rewrites a deal you already struck.

Payments are being wired up now. An employer can save a card or a bank
account (Step 9a); collecting the fee and paying vouchers comes next. **No
money moves yet**, and the keys in use are Stripe test keys.

A US bank account costs about $5 on a $2,000 fee against roughly $58 by card,
which is why both are offered and the bank is nudged for salaried roles.

---

## Ground rules baked into this product

Requirements, not preferences. Most are enforced by the database itself, so no
future change can quietly drop them.

1. **The AI score is advisory only.** It never auto-rejects anyone. A score
   cannot be stored without its written reasoning, and an update that writes a
   score *and* moves a candidate is rejected by the database outright — the
   machine's opinion and the human's decision cannot happen in one breath.
   No login can write a score either; the AI's output belongs to the platform,
   not to the employer reading it.
2. **Seekers are told, visibly, that AI helps rank their application** — and
   are shown exactly what it read from their resume, so a misreading is
   something they can see and correct.
3. **Job seekers are never charged.**
4. **No scraping.** No LinkedIn, no job boards, no imported applicants. Vouchers
   self-declare their employer and verify by work email or employer invitation.
5. **Resumes are personal data.** Deleting an account erases everything attached
   to it, by cascade.
6. **Every vouch says what it is** — whether the voucher knows the person or
   only reviewed their profile — and discloses what the voucher stands to earn.
7. **Vouchers affirm their employer permits participation** before they can be
   verified, and cannot mark themselves verified.
8. **A business without a domain is still a real business.** Two badges:
   *Verified Business* (payment method + business registration) and
   *Verified Domain* (that, plus a proven email domain). Both are legitimate;
   the second simply unlocks work-email voucher verification. Neither can be
   awarded by the company itself — a company may *claim* a domain, and only
   Vouch marks one proven.
9. **No money moves from a login.** Payouts and charges have no update
   policies at all — every movement happens server-side. Each side of a hire
   may write only its own half: an employer cannot sign for the person they
   hired, neither can rewrite the fee, and neither can end a job alone.
11. **No money leaves until money arrived.** A voucher's payout will not
    release against an unpaid fee — not even on day 60. A bank debit still in
    flight does not count as arrived.
10. **The AI is told what not to weigh.** Age, sex, race, nationality,
    religion, disability and family status are excluded, and so are school
    prestige, employment gaps, and how polished the writing is. Hourly work
    counts the same as salaried. There is no field in which a protected
    characteristic could even be recorded.

---

## What the AI actually does

Two jobs, both optional. Delete `ANTHROPIC_API_KEY` and everything else in
Vouch carries on working — resumes upload, vouches send, employers hire.

**When a seeker uploads a resume**, Claude reads it into structured facts —
jobs held, dates, skills, certificates — and the seeker is shown exactly what
it took away. PDFs are read directly; Word `.docx` files are unzipped and read;
the old `.doc` format is refused with an explanation rather than a guess.

**When a voucher writes a vouch**, the candidate that vouch creates is scored
1–100 against the role, with written reasoning, the specific evidence it used,
and a list of what it could not tell from the material.

Both run *after* the page has already come back, so nobody waits on them, and
a failure costs a score rather than an upload or a vouch.

The score is a suggestion about reading order. It cannot do anything else:

| | |
|---|---|
| Store a score with no reasoning | Rejected by a check constraint |
| Score someone and move them in one update | Rejected by a trigger |
| An employer typing their own "AI score" | Silently discarded; their status change still goes through |
| A seeker editing what we read from their resume | Silently discarded — but clearing it is always allowed |

Costs a few cents per resume and per candidate. `npm run test:ai` checks all of
the above against the real API, including whether swapping a candidate's name
moves their score. It must not.

---

## Tech stack

| Piece | What it's for |
|---|---|
| Next.js 16 (App Router) + TypeScript | The website itself, pages and server code |
| Tailwind CSS v4 + shadcn/ui | Styling and ready-made UI components |
| Supabase | Database (Postgres), logins, resume file storage |
| Anthropic API | Resume parsing, candidate fit scoring (optional) |
| Resend | Transactional email (voucher verification codes) |
| Stripe | Employer payment methods (Step 9a). Connect payouts to vouchers still to come |
| Vercel | Hosting |

## Running it locally

```bash
npm install
cp .env.example .env.local   # then paste your keys in — see SETUP.md
npm run seed                 # fake data to click around (after the migrations)
npm run dev
```

Optional, once an Anthropic key is in `.env.local`:

```bash
npm run ai:backfill -- --dry-run   # what has no score yet
npm run ai:backfill                # read and score all of it
npm run test:ai                    # prove the AI rules still hold
```

- <http://localhost:3000> — the site
- <http://localhost:3000/setup> — checks your keys, connection, and database

## Where things live

```
src/
  app/                    Pages. A folder here = a URL.
    page.tsx              The home page (/)
    (auth)/               Sign up and sign in
    onboarding/           The "tell us about yourself" step, per role
    dashboard/            Where each role lands after signing in
    invite/[token]/       Where an employer's invitation link lands
    verify/               The 6-digit work-email check for vouchers
    profile/              The seeker's profile, resume, and account deletion
    jobs/                 Browsing open roles, and asking for an intro
    requests/             The seeker's own intro requests
    inbox/                The voucher's requests, and writing a vouch
    employer/jobs/        Posting roles and working the candidate list
    employer/billing/     Saving a card or bank account, via Stripe's own page
    api/stripe/webhook/   Stripe telling us a payment method was saved
    hires/actions.ts      Recording that a job ended, from either side
    terms/ privacy/       The legal pages Stripe's review looks for
    refunds/ support/     Refund policy, and how to reach a person
    setup/page.tsx        Setup health check (/setup)
    layout.tsx            Wrapper around every page: fonts, tab title
  components/
    ai-notice.tsx         The AI disclosure seekers must see
    parsed-resume.tsx     "Here's what we read from your resume"
    separation-panel.tsx  "Did this job end?" - shown to both sides
    site-footer.tsx       Terms/privacy/refunds, reachable everywhere
    ui/                   shadcn/ui building blocks
  lib/
    ai/client.ts          The Claude connection, and the on/off switch
    ai/resume-file.ts     Reading a PDF, a Word file, or plain text
    ai/parse-resume.ts    Turning a resume into structured facts
    ai/score-fit.ts       The fit score, and the rules it must follow
    ai/run.ts             Wiring both of those to the database
    env.ts                Every environment variable, in one list
    legal.ts              Company name and address - every legal blank, once
    stripe/client.ts      The Stripe connection, and the on/off switch
    stripe/payment-methods.ts  Saving an employer's card or bank account
    stripe/charges.ts     Collecting the fee — the only place money is taken
    supabase/client.ts    Supabase connection for browser code
    supabase/server.ts    Supabase connection for server code (+ admin version)
    supabase/health.ts    Connection test used by /setup
    supabase/db-status.ts Table + demo-data check used by /setup
    email.ts              Sends email via Resend, or prints it while developing
    verification-codes.ts The 6-digit code: making it, hashing it, expiring it
  proxy.ts                Runs before every request; keeps logins alive
supabase/
  migrations/             SQL applied to Supabase, in order (0001 - 0011)
  tests/                  99 checks that prove the rules above still hold
scripts/
  seed.mts                Fills the database with demo data
  ai-backfill.mts         Reads and scores anything the AI hasn't seen yet
tests/
  *.mjs                   Browser tests for sign-up, sign-in, and invites
  ai-layer.mts            Real calls to Claude: reading, scoring, and bias
docs/
  SCHEMA.md               What every table holds, in plain English
```

## Build progress

- [x] **Step 1** — Project scaffold, Supabase connection, environment setup
- [x] **Step 2a** — Core schema (15 tables) + security rules + seed data
- [x] **Step 2b** — Money and reputation: hires, payouts, employer charges,
      credits, voucher track record, abuse flags, two-tier business
      verification (20 tables, 1 view, 56 policies)
- [x] **Step 3** — Accounts, sign-in, and onboarding for all three roles,
      including the employer-invite path
- [x] **Step 4** — Voucher verification: work email + 6-digit code, plus the
      employer-invite path
- [x] **Step 5** — Seeker flow: profile, resume upload, browsing roles,
      requesting an intro, and deleting your account and files
- [x] **Step 6** — Voucher flow: request inbox, read the profile and resume,
      write a vouch or decline
- [x] **Step 7** — Employer flow: post a role, work the vouched candidate
      list, record a hire (which both sides must confirm)
- [ ] **Step 9b** — Charging the fee when both sides confirm a hire, with the
      rule that no payout releases against an unpaid fee. Built and tested
      locally; migration 0011 not yet applied to the live database
- [x] **Step 9a** — Employer payment methods: card or US bank account saved
      through Stripe's own hosted page. Built and tested against Stripe;
      waiting on migration 0010 to be applied before it can run end to end
- [x] **Step 9e** — Leaving a job: either side reports it, the other confirms,
      seven days of silence becomes a dispute. Plus the hire-integrity guard
      and lapsing credits. The rest of payments (Stripe) is next
- [x] **Step 8** — AI layer: resumes read into structured facts on upload,
      and a 1-100 fit score with written reasoning when a vouch arrives. Both
      optional; both advisory; neither can decide anything.
