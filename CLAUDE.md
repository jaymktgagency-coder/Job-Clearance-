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
- **Verify on the live deployed site before calling anything done.** A green
  local build and a happy database are not evidence that the thing works: a
  filter shipped visibly broken because it was only ever checked that way.
  Verification needs a Supabase personal access token — **ask for one and say
  plainly that you are blocked without it**, then follow the routine below.
- **Keep dependencies minimal.** Current runtime deps: Next, React, Tailwind,
  shadcn/Base UI, `@supabase/*`, `@anthropic-ai/sdk`, `stripe`, `lottie-react`.
  Adding one is a decision, not a reflex. A ~60-line hand-written zip reader
  (`resume-file.ts`) was preferred over a docx library. `lottie-react` is the
  one place that call went the other way: the founder asked for a specific
  published animation, which is a data file no amount of hand-written SVG can
  be, so it needs a player. It is imported as `LottieSvg`, the smallest of the
  three builds it ships.
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
    employer/company/     voucher/profile/  -- each role's own profile page
    voucher/seekers/      -- people who named your employer, and reaching out
    employer/locations/   -- the places a company hires into, and their ZIPs
    terms/ privacy/ refunds/ support/   setup/
    hires/actions.ts      -- separation flow, shared by both sides
  components/  ai-notice, parsed-resume, separation-panel, site-footer, legal/, ui/
               hello-lottie (the greeting), hello-overlay (the post-login moment)
               avatar, picture-form, job-filters, outreach-panel, ui/skeleton
  assets/      hello-apple.json -- the greeting animation, as downloaded
  lib/
    env.ts legal.ts auth.ts invites.ts email.ts email-domains.ts verification-codes.ts
    avatars.ts job-filters.ts outreach.ts geo.ts
    supabase/{client,server,health,db-status}.ts
    ai/{client,resume-file,parse-resume,score-fit,run}.ts
    stripe/{client,payment-methods}.ts
  proxy.ts               -- Next 16 renamed middleware.ts; exports proxy()
supabase/migrations/     0001-0012
supabase/tests/          00 stubs + 10..90, 113 checks
scripts/                 seed.mts, ai-backfill.mts
tests/                   7 browser tests (.mjs) + ai-layer.mts + stripe-9a.mts
```

24 tables, 1 view (`voucher_reputation`, security_invoker), 18 enums,
65 RLS policies.

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
| 0015 | `protect_outreach_insert()` | A voucher messaging any seeker they liked, rather than only those who named their employer — the line between outreach and scraping. Also: naming someone else's company on the way in |
| 0015 | `protect_outreach_columns()` | A voucher accepting their own approach on the seeker's behalf, and rewriting the message after it was answered |
| 0015 | `protect_intro_request_source()` | A seeker dressing an ordinary request up as one that came from an approach that was never made |

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

**Verifying against the live site, in a real browser.** This is possible and
was wrongly believed not to be. The egress proxy re-terminates TLS with its own
CA, which Chromium rejects — but the fix is to TRUST the CA, never to disable
verification. Write the bundle at `/root/.ccr/ca-bundle.crt` into a Chromium
enterprise policy as base64 DER:

```js
// /etc/chromium/policies/managed/ccr-proxy-ca.json
{ "CACertificates": ["<base64 DER of each cert in the bundle>"] }
```

then launch Playwright with `proxy: { server: process.env.HTTPS_PROXY }`. Sign
in as a seeded demo account (password `vouch-demo-1234`) and drive the real
thing. **Two projects answer to this token** — `nxhmntietskcxzdtyjhp` ("Vouch
v1") is the live one; the other is empty. Check before writing.

**A merge is not a deploy.** PR #9 sat merged on `main` for over half an hour
with the live site still serving the previous build, so "fixed" would have been
untrue. `/jobs` is `force-dynamic`, so it is never CDN-cached — if it still
behaves like the old code, the DEPLOYMENT is stale, not the cache. The landing
page is cached and will lie about this (`x-vercel-cache: HIT`, a large `age`).

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

**The look lives in `DESIGN.md`, and colours live only in `globals.css`.**
Orange and white, warm neutrals, three motion curves, no hard-coded colour
anywhere else. The one rule worth knowing before touching a screen: orange as
a *surface* carries near-black text (7.0:1), orange as *text* is always the
darker `--brand-700` (5.8:1). White on bright orange is 2.6:1 and fails.

**Tailwind v4 moves things with `translate` and `scale`, not `transform`.**
A transition naming `transform` animates nothing, silently, and looks fine in
a screenshot. **And a utility class outranks anything in `@layer base`** — so
`outline-none` on a component beats the global `:focus-visible` ring and makes
it invisible to keyboard users. Both of these shipped once and were caught
only by reading computed styles off a live page. `/design` is the parts
catalogue; it needs no login and renders without a database.

**Each role lands somewhere different.** `homeFor()` in `lib/auth.ts` is the
only place that decides: a seeker goes to `/jobs`, everyone else to
`/dashboard`. `/dashboard` stays reachable from the logo. The `?hello=1`
greeting follows whatever that function returns.

**Seeker job filters live in two places, on purpose.** The address bar is the
truth; a session cookie (`vouch_job_filters`) is the fallback for arriving
with no query string, which is what makes filters survive a trip into a role.
The URL always wins, so the cookie can never overrule a filter just set. The
"Clear" control must be a button, not a link to `/jobs` — a link would be
undone by the cookie on the next render.

**`/jobs` filters in JavaScript, not SQL.** One query for every open role,
then filtered in memory, so the dropdowns can only ever offer categories and
towns that have a role in them. 0014 ships the indexes for the day that stops
being a few hundred rows; the comment in `jobs/page.tsx` says what to change.

**The `avatars` bucket is public, `resumes` is not.** A resume is read one at
a time by someone who earned it, so signing a URL is cheap. An avatar appears
beside every name in a list, so signing one per row would be dozens of round
trips. The protection is an unguessable path (`<user-id>/<uuid>.<ext>`), and
account deletion erases the file — a public file is still personal data.

**The marketplace runs both ways now.** A seeker names companies
(`seeker_company_interests`); a verified voucher at one of those companies may
write to them once (`voucher_outreach`). The match key is
`verified_voucher_company()` — the same helper four other policies use, so the
two directions can never disagree about who counts as verified. Accepting does
not fork the flow: it ends in an ordinary `intro_request`, so every fee, vouch
and hire guard applies unchanged.

**The voucher's browse list is a column allowlist, not a policy.** RLS is row
level, so a policy letting a voucher read an interested seeker's `users` row
would hand over their **email** — and a voucher who can email a seeker can
arrange a hire with nobody paying anybody. So there is no such policy:
everything comes from `seekers_interested_in_my_company()`, whose returned
columns *are* the privacy rule. `resumes_read_as_voucher` still keys on
`intro_requests`, so a resume stays private until the seeker accepts and asks.
Test 96 asserts the exact column list — **read from `pg_proc`, not
`information_schema.columns`, which does not contain function return columns
at all and made the first version of that check pass while `email` leaked.**

**`open_to_work` is load-bearing now.** It sat on the profile form unread since
Step 5; it is the global off switch that hides a seeker from every voucher at
once.

**Outreach expiry is computed on read.** Nothing runs on a schedule, so
`expire_stale_outreach()` exists unscheduled beside the other two sweepers and
the *reading* applies the cutoff — otherwise a voucher's cap looks full of
messages that went stale weeks ago.

**A filter needs data behind it or it ships dead.** This has now happened
twice. Category shipped with `jobs.category` added and never backfilled, and
no way to set one on an existing role — so the dropdown held a single option
and was reported as broken. Radius would have shipped the same way: `locations`
has had a `postal_code` column since 0001, nothing ever set it, and **there was
no screen anywhere to create or edit a location at all**. `/employer/locations`
exists because of that. Before adding a filter, ask who supplies the data and
on which screen.

**The haversine exists twice, on purpose.** `miles_between` in SQL (0016) so a
distance can be asked for in a query, and `milesBetween` in `lib/geo.ts` so the
job list can filter in memory without a round trip per role. Neither is checked
against the other — **both are pinned to the same real city distances**, in
`97_radius.sql` and `tests/geo.mts` (`npm run test:geo`). Edit one into
disagreement and one of the two suites fails.

**ZIP centroids are not doorsteps.** Distance is centre-of-ZIP to centre-of-ZIP,
which is why the screen says "about 20 miles away" and never "20.3". A role at
a place with no ZIP is EXCLUDED from a distance search and counted underneath
it — including it would mean "within 10 miles" returning things 400 miles away,
and dropping it silently would hide half the board with no explanation.

**Supabase gotchas:** errors are plain objects, not `Error` — check
`"message" in error`. `head: true` returns 204 with a null count on a missing
table; use `.select("id", { count: "exact" }).limit(1)`. Uploading a `Blob`
sends `application/octet-stream` and the bucket rejects it — use a `Buffer`.

**AI writes go through the admin client** — the columns are platform-only by
design. Both AI jobs run inside `after()` from `next/server`, so nobody waits
and a failure costs a score, never an upload or a vouch.

**Stripe Connect is on Accounts v2.** Stripe refuses Accounts v1 for new
integrations, so a voucher's account is created with `v2.core.accounts` using
the `recipient` configuration; onboarding, reading state and transfers still
go through the v1 endpoints, which accept a v2 id. **Read capability status
from the v2 view, never v1** — they disagree, and the transfer follows v2. A
v1 read has been seen reporting `payouts_enabled: true` on an account v2 called
restricted and Stripe then refused to pay. A recipient-only account also forces
`fees_collector`/`losses_collector` to `"application"`, so **Vouch carries a
negative balance on a voucher's account, not Stripe.**

**Stripe:** employers enter card details on **Stripe's own hosted Checkout page**
(`mode: "setup"`) — Vouch never receives a card number, account number or CVC.
The webhook verifies the signature over the **raw body**, is safe to run twice,
returns 200 for unhandled events, and **refuses everything with 503 if
`STRIPE_WEBHOOK_SECRET` is missing** rather than trusting an unverified call.

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
| `0012_voucher_payout_accounts.sql` | Stripe Connect recipient accounts; paying needs an account Stripe enabled |
| `0013_profile_pictures.sql` | Public `avatars` bucket. **No new columns** — `users.avatar_url` and `companies.logo_url` existed from 0001 |
| `0014_job_categories.sql` | `job_categories` lookup table + `jobs.category`; the list is rows, not an enum, so it changes without a migration |
| `0015_voucher_outreach.sql` | The other direction: `seeker_company_interests`, `voucher_outreach`, and the column-allowlist function that keeps email and resume out of it |
| `0016_radius.sql` | 33,791 US ZIP centroids from the Census gazetteer (public domain), `seeker_profiles.postal_code`, and the haversine. ~0.9 MB — the data is IN the migration because the founder cannot run a loader script |

## Testing

```bash
npm run seed          # demo data; password for every demo login: vouch-demo-1234
npm run test:ai       # 26 checks, real Anthropic calls, a few cents
npm run test:stripe   # 15 checks, real Stripe test-mode calls, needs the site on :3000
npm run ai:backfill -- --dry-run
```

SQL suite (136 checks) — run against a throwaway database, **as the `postgres`
role**:
```bash
su postgres -c "dropdb --if-exists test && createdb test"
ARGS=$(ls supabase/migrations/*.sql supabase/tests/[1-9][0-9]_*.sql \
  | sed 's/^/-f /' | tr '\n' ' ')
su postgres -c "cd $PWD && psql -d test -v ON_ERROR_STOP=1 -q \
  -f supabase/tests/00_supabase_stubs.sql $ARGS"
```

Two things this gets right that the obvious version did not:

- **`[1-9][0-9]_`, not `[1-7]0_`.** The old glob predates `80_`, `90_`, `95_`,
  `96_` and `97_`, so it ran five files fewer — a green run that had never
  opened the money, payout, category, outreach or radius checks at all.
- **As `postgres`, not as whoever you happen to be.** The guards trust
  `service_role` and `postgres` and nobody else, and the fixtures need a
  trusted caller to seed a verified voucher. Run the suite as a fresh
  superuser named anything else and `10_database_rules.sql` dies on line 42
  with "A new voucher profile always starts unverified" — the guard working
  exactly as designed, looking exactly like a broken suite.

After a container restart the server is down but the data directory survives.
`pg_ctlcluster 16 main start`, then recreate `test` as above.

Browser tests in `tests/*.mjs` cover auth, invites, onboarding, verification,
the seeker journey, the voucher inbox and the employer flow. `tests/README.md`
says what each one asserts. `tests/resolve-ts.mjs` is the loader that lets
plain `node` import the app's TypeScript.

Two tests are worth protecting: **`ai-layer.mts` scores the same resume under
two different names and asserts the score barely moves** — if that ever fails,
stop. **`stripe-9a.mts` asserts a forged webhook signature is refused** — that
check is the only thing between Stripe's word and a stranger's.

## Current state

Steps 1–8 built and live. Step 9 (payments): **9e** departure flow, **9a**
employer payment methods, **9b** charge on a confirmed hire and **9c** the
voucher's Connect payout account are all built and merged.

**All migrations through 0016 are applied to the live database**, each
verified afterwards by attacking as a real logged-in user. The older warning
here that 0009 and 0010 were unapplied was stale and has been removed.

Still open, in rough priority order:

- **9d — the release job. This is the next step.** `release_due_payouts()`
  exists and is covered by the SQL suite, and **nothing calls it**: no
  schedule runs anywhere in this product, so `release_at` passes on a payout
  and no code notices. A voucher who earned their half 60 days ago is owed it
  and will not be paid. Needs a Vercel Cron entry, a route for it to call, and
  a shared secret on that route — it is a URL that moves money, and it must
  not be one a stranger can hit.
- **Nobody's locations have ZIPs yet.** The Radius filter stays hidden until an
  employer fills them in at `/employer/locations`, and stays useless to a
  seeker until they add their own ZIP on `/profile`.
- **No admin screen exists anywhere.** `hire_status` has `disputed`,
  `abuse_flags` has a whole table, and there is no human queue for either.
- Fill in `src/lib/legal.ts` — company name, address, support email are all
  `TODO` and `/support` shows a warning until they are. Stripe reads those
  pages by hand when approving a marketplace.
- Turn Supabase email confirmation back on (needs Resend) and unset
  `SHOW_VERIFICATION_CODES` before sharing the URL with anyone.
- Nothing decides *who* verifies a business registration; it is a timestamp
  set by hand.
