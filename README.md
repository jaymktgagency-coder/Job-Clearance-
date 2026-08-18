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
| Seeker pays | Nothing, ever |

Fees, shares, and caps live in the `platform_settings` table, not in code. The
price a job was posted under is frozen onto that job, so changing your pricing
never rewrites a deal you already struck.

Payments are **stubbed out in v1** — the tables exist, no money moves.

---

## Ground rules baked into this product

Requirements, not preferences. Most are enforced by the database itself, so no
future change can quietly drop them.

1. **The AI score is advisory only.** It never auto-rejects anyone. A score
   cannot even be stored without its written reasoning, and a human makes every
   decision.
2. **Seekers are told, visibly, that AI helps rank their application.**
3. **Job seekers are never charged.**
4. **No scraping.** No LinkedIn, no job boards, no imported applicants. Vouchers
   self-declare their employer and verify by work email or employer invitation.
5. **Resumes are personal data.** Deleting an account erases everything attached
   to it, by cascade.
6. **Every vouch says what it is** — whether the voucher knows the person or
   only reviewed their profile — and discloses what the voucher stands to earn.
7. **Vouchers affirm their employer permits participation** before they can be
   verified, and cannot mark themselves verified.

---

## Tech stack

| Piece | What it's for |
|---|---|
| Next.js 16 (App Router) + TypeScript | The website itself, pages and server code |
| Tailwind CSS v4 + shadcn/ui | Styling and ready-made UI components |
| Supabase | Database (Postgres), logins, resume file storage |
| Anthropic API | Resume parsing, candidate fit scoring |
| Resend | Transactional email (voucher verification codes) |
| Stripe Connect | Payments — **stubbed out, not implemented in v1** |
| Vercel | Hosting |

## Running it locally

```bash
npm install
cp .env.example .env.local   # then paste your keys in — see SETUP.md
npm run seed                 # fake data to click around (after the migrations)
npm run dev
```

- <http://localhost:3000> — the site
- <http://localhost:3000/setup> — checks your keys, connection, and database

## Where things live

```
src/
  app/                    Pages. A folder here = a URL.
    page.tsx              The home page (/)
    setup/page.tsx        Setup health check (/setup)
    layout.tsx            Wrapper around every page: fonts, tab title
  components/ui/          shadcn/ui building blocks
  lib/
    env.ts                Every environment variable, in one list
    supabase/client.ts    Supabase connection for browser code
    supabase/server.ts    Supabase connection for server code (+ admin version)
    supabase/health.ts    Connection test used by /setup
    supabase/db-status.ts Table + demo-data check used by /setup
  proxy.ts                Runs before every request; keeps logins alive
supabase/
  migrations/             SQL you paste into Supabase, in order
scripts/
  seed.mts                Fills the database with demo data
docs/
  SCHEMA.md               What every table holds, in plain English
```

## Build progress

- [x] **Step 1** — Project scaffold, Supabase connection, environment setup
- [x] **Step 2a** — Core schema (15 tables) + security rules + seed data
- [ ] Step 2b — Money and reputation: hires, payouts, employer charges,
      voucher track record, abuse flags
- [ ] Step 3 — Auth + onboarding for all three roles
- [ ] Step 4 — Voucher verification: work email + 6-digit code, and the
      employer-invite path
- [ ] Step 5 — Seeker flow: profile, resume upload, browse jobs, request intro
- [ ] Step 6 — Voucher flow: request inbox, write vouch or decline
- [ ] Step 7 — Employer flow: post a job, view vouched candidates, update status
- [ ] Step 8 — AI layer: resume parsing + fit scoring with written reasoning
