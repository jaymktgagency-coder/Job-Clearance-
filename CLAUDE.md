@AGENTS.md

# Vouch

A two-sided hiring marketplace. Job seekers get **vouched for** by verified
current employees at companies they want to join. Employers only ever see
candidates carrying a vouch, and pay a success fee only on an actual hire.
The voucher earns half that fee, released 60 days after the start date.

Three roles, one login table: `seeker`, `voucher`, `employer`.

> Keep this file current. When you add a migration, a guard, or a setting,
> update the tables below in the same commit — a stale CLAUDE.md costs more
> than no CLAUDE.md, because it is believed.

- Repo: `jaymktgagency-coder/job-clearance-` · dev branch `claude/hiring-marketplace-setup-5k3rk2`
- Live: <https://vouch-nu-gold.vercel.app> (Vercel production branch is `main`)
- Supabase project ref: `nxhmntietskcxzdtyjhp`

## Who you are working for

Non-technical founder, working from an **Android tablet**. They cannot run
localhost and have never seen a screen except on the deployed site. That
shapes everything:

- Write **plain-English comments** explaining what each file does and why.
- After each step, say exactly how to test it — on the live site, not locally.
- **Keep dependencies minimal.** Current runtime deps: Next, React, Tailwind,
  shadcn/Base UI, `@supabase/*`, `@anthropic-ai/sdk`, `stripe`. Adding one is
  a decision, not a reflex. A ~60-line hand-written zip reader (`resume-file.ts`)
  was preferred over a docx library.
- If something in their spec is technically wrong, **say so once**, then do it
  their way if they confirm.
- **Ask rather than guess** when genuinely ambiguous.
- Work is delivered **one step at a time, stopping for approval** after each.

## Non-negotiable product rules

These are requirements, most enforced by the database so no future change can
quietly drop them.

1. **The AI score is advisory.** Never auto-rejects. Cannot be stored without
   written reasoning. Cannot be written in the same UPDATE as a status change.
2. **Seekers are told, visibly, that AI ranks them**, and are shown exactly
   what it read from their resume.
3. **Job seekers are never charged. Ever.**
4. **No scraping** — no LinkedIn, no job boards, no imported applicants.
5. **Resumes are personal data.** Account deletion erases everything by cascade,
   including the storage file.
6. Every vouch states whether the voucher knows the person or only read their
   profile, and discloses what they stand to earn.
7. Vouchers affirm their employer permits participation, and cannot self-verify.
8. **Two verification badges**, both legitimate: *Verified Business* (payment
   method + business registration) and *Verified Domain* (that plus a proven
   email domain). A business on Gmail must never be second-class — that segment
   is the hourly market. Domain only additionally unlocks work-email voucher
   verification.
9. **No money moves from a login.** Payouts and charges have no UPDATE policies
   at all.
10. **No money leaves until money arrived.** A payout will not release against
    an unpaid charge. `processing` (a bank debit in flight) is not settled.

## Money model

Every number lives in `platform_settings`, never in code. Current values:

| Setting | Value | Meaning |
|---|---|---|
| `fee_tier_1_cents` | 50000 | $500 — hourly / service roles |
| `fee_tier_2_cents` | 200000 | $2,000 — salaried / professional |
| `voucher_share_bps` | 5000 | Voucher gets 50% |
| `payout_hold_days` | 60 | Payout releases 60 days after **start date** |
| `early_departure_days` | 30 | Leave inside this → employer credit |
| `early_departure_credit_bps` | 5000 | Credit is 50% of fee, **never cash** |
| `credit_valid_days` | 365 | Credits lapse after a year |
| `hire_dispute_after_days` | 7 | Unanswered hire report → dispute |
| `separation_dispute_after_days` | 7 | Unanswered departure report → dispute |
| `max_open_intro_requests_per_seeker` | 5 | |
| `max_open_vouches_per_voucher` | 5 | |
| `min_vouch_body_chars` | 200 | DB hard floor is 150 |
| `min_hires_for_retention_pct` | 5 | Below this, show counts not a percentage |
| `payout_reminder_days` | `[30, 14, 3]` | Days before release a voucher who still hasn't set up payouts is reminded. `[]` turns reminders off |
| `payout_reminder_min_hours_apart` | 48 | Two reminders never land closer than this, whatever the milestones say |

Rules that follow from this:

- A fee is owed **only** when the employer *and* the seeker both confirm a hire.
- The fee is frozen onto the job at posting. Changing pricing never rewrites an
  existing deal.
- Leave before day 60 → **voucher paid nothing**, whatever the reason. That
  delay is the entire anti-abuse mechanism.
- Leave before day 30 → employer gets 50% credit toward their next hire. **No
  cash refund**, ever.
- Payments decision, already made: **card + US bank, ACH preferred on tier 2**
  ($58 card vs ~$5 ACH on $2,000); **pay the voucher at day 60 and absorb**
  the card-chargeback gap (~120 days); **either side reports a departure, the
  other confirms**.

## Architecture

Next.js 16 App Router + TypeScript, Tailwind v4, shadcn/ui (**on Base UI, not
Radix**), Supabase (Postgres + Auth + Storage + RLS), Anthropic, Stripe,
Resend, Vercel.

```
src/
  app/
    (auth)/login,signup   onboarding/   dashboard/   invite/[token]/  verify/
    profile/              jobs/[id]/    requests/     inbox/[id]/
    employer/jobs/[id]/   employer/billing/           api/stripe/webhook/
    terms/ privacy/ refunds/ support/   setup/
    payouts/              -- the voucher's money, and the only screen that
                             asks them for tax details
    hires/actions.ts      -- separation flow, shared by both sides
  components/  ai-notice, parsed-resume, separation-panel, site-footer, legal/, ui/
  lib/
    env.ts legal.ts auth.ts invites.ts email.ts email-domains.ts verification-codes.ts
    payout-emails.ts       -- what a voucher is told about money they've earned
    supabase/{client,server,health,db-status}.ts
    ai/{client,resume-file,parse-resume,score-fit,run}.ts
    stripe/{client,payment-methods,charges,connect}.ts
  proxy.ts               -- Next 16 renamed middleware.ts; exports proxy()
supabase/migrations/     0001-0012
supabase/tests/          00 stubs + 10..80, 100 checks
scripts/                 seed.mts, ai-backfill.mts
tests/                   7 browser tests (.mjs) + ai-layer.mts + stripe-9a.mts
```

20 tables, 1 view (`voucher_reputation`, security_invoker), 17 enums,
56 RLS policies.

## The security guards, and why each exists

Every one of these was written **after proving the hole against a real
database from an ordinary logged-in user**. Do not remove one without
understanding the attack it stops.

| Migration | Guard | The attack it closed |
|---|---|---|
| 0005 | `company_has_members()` helper | Infinite recursion in the `company_members` insert policy broke *every* employer signup |
| 0007 | `set_job_fee_snapshot()` | Employer posted a $2,000 salaried role with a **1-cent fee**, frozen for the life of the job |
| 0008 | `protect_ai_advice()` | Employer wrote their own AI score; and a score could be written in the same UPDATE that rejected the candidate |
| 0008 | `protect_parsed_resume()` | Seeker wrote their own "parsed resume". Clearing it to null is still always allowed — it is their data |
| 0009 | `protect_hire_insert()` / `protect_hire_columns()` | Employer signed the **seeker's** confirmation → confirmed hire, charge and payout opened with the seeker never asked. Also: employer rewrote a confirmed fee to 1 cent; seeker moved `start_date` 400 days |
| 0009 | `settle_separation_confirmation()` | Employer declared a day-5 departure alone → **cancelled the voucher's $250 payout and credited themselves $250** |
| 0010 | `protect_company_trust()` | A stranger created a company called "Starbucks" and awarded itself **Verified Domain** in one transaction |
| 0010 | `protect_company_domain()` | Same stranger claimed `starbucks.com`. `domain` is UNIQUE, so a squatter permanently blocks the real company |
| 0001 | `protect_voucher_verification()` | Voucher marked themselves verified |
| 0003 | `guard_payout_release()` | Payout released without identity + tax details |
| 0011 | `charge_is_settled()` gate in `release_due_payouts()` | A voucher's payout released on day 60 with the employer's fee never collected — Vouch paying out its own money |
| 0011 | `protect_employer_charge()` | Second lock under the SELECT-only policy: even if an UPDATE policy is ever added, an employer still cannot waive their own bill |

Shape they all share: **trusted callers pass through, everyone else is either
silently reverted or raised at.** Silent revert where a legitimate update is
mixed in (an employer's real status change must still land); raise where the
whole update is illegitimate (money terms).

```sql
v_trusted boolean := current_user in ('service_role', 'postgres');
```

## Conventions that matter here

**Test as the actual user, not as postgres or the secret key.** This mistake
was made three separate times and produced confident, wrong "still
exploitable" results. The guards *deliberately trust* `service_role` and
`postgres`. A test using either proves nothing.

```sql
begin;                                    -- MUST be in a transaction:
  set local role authenticated;           -- SET LOCAL outside one is a silent
  set local request.jwt.claim.sub = '<uuid>';  -- no-op, and the test runs as
  -- ... the attack ...                   -- superuser while looking fine
commit;
```
From Node, sign in with the **publishable** key via `supabase.auth.signInWithPassword`.

**Guard triggers must NOT be `SECURITY DEFINER`.** Under it, `current_user`
becomes the function's owner, every caller looks trusted, and the guard
silently does nothing. This shipped once and was caught only by a test that
expected it to bite. Current split, and it is correct:

- *invoker rights* — every `protect_*` and `set_job_fee_snapshot` (they check `current_user`)
- *SECURITY DEFINER* — `settle_separation_confirmation`, `dispute_separation`,
  `sync_company_domain_verification`, `guard_payout_release`,
  `handle_hire_separation`, `check_hire_retention`, `release_due_payouts`,
  `open_stale_hire_disputes`, `open_stale_separation_disputes`
  (they write rows a login may not, and do not gate on `current_user`)

**Trigger firing order is alphabetical by name.** Hence `trg_hire_04/05/10/15/20/30/35/40`.
`protect_hire_insert` must run at **15** — after `fill_hire_from_application`
copies `seeker_id` and `company_id` across, or it checks identity against
empty columns and strips the reporter's own confirmation too.

**`platform_settings` is versioned by `(key, effective_from)`.** There is no
unique constraint on `key` alone, so `on conflict (key)` fails. Insert with
`where not exists (...)`.

**Never hardcode a money number.** Read it from `platform_settings` via
`platform_setting_int(key, default)`.

**Migrations reach the live database only through the Supabase Management API**
(`api.supabase.com`) with a personal access token — direct Postgres port 5432
is blocked by egress policy. The routine: user issues a PAT → apply → verify by
attacking as a real user → shred the local token file → user revokes → confirm
401. Validate migrations first against local Postgres 16 with
`supabase/tests/00_supabase_stubs.sql` (hand-written `auth` schema, `auth.uid()`,
storage schema, the three Supabase roles).

**Apply the migration before merging code that needs it.** Code deployed ahead
of its columns makes queries fail silently and pages render empty.

**Next.js 16 specifics:** `middleware.ts` → `src/proxy.ts` exporting `proxy()`;
`params`/`searchParams` are Promises; `PageProps<'/route'>` is *generated at
build time*, so a brand-new route fails typecheck until `next build` runs once.

**Server actions:** every export from a `"use server"` file must be an async
function. A non-async helper there is a build error (this bit once —
`isFreeEmailDomain` moved to `lib/email-domains.ts`).

**shadcn/ui here is Base UI**: use `render={<Link href="..." />}`, not `asChild`.

**Supabase gotchas:** errors are plain objects, not `Error` — check
`"message" in error`. `head: true` returns 204 with a null count on a missing
table; use `.select("id", { count: "exact" }).limit(1)`. Uploading a `Blob`
sends `application/octet-stream` and the bucket rejects it — use a `Buffer`.

**AI writes go through the admin client** — the columns are platform-only by
design. Both AI jobs run inside `after()` from `next/server`, so nobody waits
and a failure costs a score, never an upload or a vouch.

**Stripe:** employers enter card details on **Stripe's own hosted Checkout page**
(`mode: "setup"`) — Vouch never receives a card number, account number or CVC.
The webhook verifies the signature over the **raw body**, is safe to run twice,
returns 200 for unhandled events, and **refuses everything with 503 if
`STRIPE_WEBHOOK_SECRET` is missing** rather than trusting an unverified call.

**Voucher payout onboarding is deferred on purpose** (9c). A voucher is asked
for identity and tax details only once a vouch has become a confirmed hire and
there is money with their name on it — never at signup, never to write a vouch.
Nothing enforces this in code because nothing needs to: no route except
`/payouts` ever asks, and it only asks when a payout row exists. The gates are
`voucher_profiles.identity_verified_at` / `.tax_info_collected_at`, both
platform-only, and the whole flow rests on `release_due_payouts()` **holding**
rather than failing (`0011:131`) and `unhold_settled_payouts()` putting it back
in the queue afterwards (`0011:186`).

`recordAccountState()` in `stripe/connect.ts` is the single place that turns a
Stripe account into those two gates: identity ← `payouts_enabled`, tax ←
`details_submitted` with nothing tax-shaped left in `requirements`. **It works
in both directions** — if Stripe later restricts the account, the identity gate
shuts again and the money goes back to held. It writes only on a change, so the
"verified at" date stays the day they verified instead of creeping forward on
every `account.updated`. That event must be ticked on in the Stripe dashboard
or a voucher's money sits held with nothing on screen to explain why.

**Telling the voucher is half of deferring the paperwork** (0012). Deferring
the ask only buys a head start if the voucher hears about it on the day the
clock starts, so `notifyVoucherOfPayout()` sends one email per payout from the
`after()` block in `confirmHire` — the same click that raises the payout row.
It sits **outside** the `stripeIsConfigured()` guard and in its own `after()`:
the payout row exists whether or not Stripe is on, and a fee that fails to
collect must not also cost the voucher their run-up.

`payouts.voucher_notified_at` is stamped **only on `delivered: true`**. With no
`RESEND_API_KEY`, `sendEmail()` logs and reports `delivered: false`; stamping on
that would mark a whole cohort "told" and never tell them. Send first, stamp
second, guarded with `.is("voucher_notified_at", null)`. The three new columns
need no guard trigger — `payouts` has **no UPDATE policies at all**, so they are
platform-only by construction, and `guard_payout_release()` returns early unless
the status is moving to `released`/`paid`.

Reminders key off `last_reminder_days_out` — the **milestone** last sent, not a
count — so a missed scheduled run skips the stale reminders instead of firing
all three at once.

**This container:** the headless browser cannot reach external sites — only
`curl` goes through the proxy. Google Fonts is blocked locally, so pages render
in a serif fallback; that is cosmetic and fine on Vercel. Postgres in the
scratchpad dies on container restart — restart it and rebuild before trusting
an empty test result. A test run that prints nothing is zero checks, not zero
failures.

## Migrations

| File | Contents |
|---|---|
| `0001_core_schema.sql` | 15 core tables, enums, caps, `ai_score_requires_reasoning` |
| `0002_row_level_security.sql` | 46 policies + `auth_user_role()`, `is_company_member()`, `verified_voucher_company()` |
| `0003_money_and_reputation.sql` | hires, charges, credits, payouts, abuse flags, reputation view, two-tier badge |
| `0004_money_row_level_security.sql` | 10 more policies; **no update policies on payouts/charges at all** |
| `0005_fix_company_member_signup.sql` | recursion fix that unbroke employer signup |
| `0006_resume_storage.sql` | private `resumes` bucket (5 MB) + 6 storage policies |
| `0007_lock_the_fee.sql` | the platform imposes the fee |
| `0008_ai_is_advisory.sql` | AI columns are platform-only and can never decide |
| `0009_separation_and_hire_integrity.sql` | departure flow; each side writes only its own half; credits lapse |
| `0010_payment_methods_and_company_trust.sql` | Stripe columns; badges and domain claims are platform-only |
| `0011_collect_the_fee.sql` | Collect the fee off-session; **no payout releases against an unpaid charge** |
| `0012_telling_the_voucher.sql` | Three nullable columns recording what a voucher has been told; the reminder cadence as a setting; `platform_setting_int_array()` |

## Testing

```bash
npm run seed          # demo data; password for every demo login: vouch-demo-1234
npm run test:ai       # 26 checks, real Anthropic calls, a few cents
npm run test:stripe   # 15 checks, real Stripe test-mode calls, needs the site on :3000
npm run test:9b       # 22 checks, collecting the fee
npm run test:9c       # 27 checks, voucher payout onboarding
npm run ai:backfill -- --dry-run
```

SQL suite (88 checks) — run against a throwaway database:
```bash
psql -d test -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stubs.sql \
  $(ls supabase/migrations/*.sql | sed 's/^/-f /') \
  $(ls supabase/tests/[1-7]0_*.sql | sed 's/^/-f /')
```

Browser tests in `tests/*.mjs` cover auth, invites, onboarding, verification,
the seeker journey, the voucher inbox and the employer flow. `tests/README.md`
says what each one asserts. `tests/resolve-ts.mjs` is the loader that lets
plain `node` import the app's TypeScript.

Two tests are worth protecting: **`ai-layer.mts` scores the same resume under
two different names and asserts the score barely moves** — if that ever fails,
stop. **`stripe-9a.mts` asserts a forged webhook signature is refused** — that
check is the only thing between Stripe's word and a stranger's.

## Current state

Steps 1–8 built and live. Step 9 (payments): **9e** (departure flow), **9a**
(employer payment methods) and **9b** (collecting the fee) are merged, with
migrations 0009–0011 applied. **9c** (voucher payout onboarding) is written and
needs `npm run test:9c` run against real Stripe test keys before merging — it
adds no migration, so nothing has to be applied first.

Still open, in rough priority order:

- **The initial payout email is written (0012) but reminders are not.** The
  "you earned this" email now goes out from `confirmHire`, in both a
  needs-setup and an already-set-up version. The reminder cadence
  (`payout_reminder_days`, 30/14/3 days out) has its schema, its settings and
  its index, but **nothing sends them yet** — that is the same missing cron as
  9d. Vouchers who ignore the first email currently hear nothing more.
- **Nothing has been emailed to anyone yet.** `RESEND_API_KEY` is unconfirmed
  on Vercel; until it is set, `sendEmail()` writes to the function log and
  reports `delivered: false`, so `voucher_notified_at` stays null and those
  payouts are picked up once Resend is on. Check with `vercel env ls`.
- **A voucher whose money is already overdue gets no further email.** The
  milestones stop at 3 days out by design. The `/payouts` card still shows it.
- 9d the release job (Vercel Cron — **nothing runs on a schedule yet**, so
  `release_at` passes and no code notices). `unhold_settled_payouts()` is
  currently only ever called from `charges.ts` and `connect.ts`, so a payout
  held for any other reason waits for a job that does not exist.
- 9c stops at opening the gates. **No money is actually sent yet** — creating
  the Stripe transfer at release is 9d's half.
- **No admin screen exists anywhere.** `hire_status` has `disputed`,
  `abuse_flags` has a whole table, and there is no human queue for either.
- Fill in `src/lib/legal.ts` — company name, address, support email are all
  `TODO` and `/support` shows a warning until they are. Stripe reads those
  pages by hand when approving a marketplace.
- Turn Supabase email confirmation back on (needs Resend) and unset
  `SHOW_VERIFICATION_CODES` before sharing the URL with anyone.
- Nothing decides *who* verifies a business registration; it is a timestamp
  set by hand.
