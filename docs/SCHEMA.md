# The Vouch database, in plain English

Fifteen tables. This explains what each one holds and why, without assuming you
know anything about databases.

Built in Step 2a. Money, payouts, and reputation arrive in Step 2b.

---

## The shape of it

```
company ─┬─ company_domains        which work emails prove you work here
         ├─ locations              each store / branch / office
         ├─ company_members        which employer logins may act for it
         ├─ voucher_invitations    "come be a voucher" invites it sent
         └─ jobs ──┐
                   │
                   ├── intro_requests ── vouches ── applications ── application_events
                   │   seeker asks       voucher    employer         who changed what,
                   │                     writes     decides          and when
users ──┬── seeker_profiles
        └── voucher_profiles
```

---

## The tables

### People

**`users`** — one row per person, with a `role` of seeker, voucher, or
employer. Its id is the same as the Supabase login id, and it's wired so that
deleting the login erases this row and everything attached to it. That's how
"delete my account and all my data" is *guaranteed* rather than promised.

**`seeker_profiles`** — the seeker's details: headline, location, skills, bio,
and where their resume file lives. Nearly every field is optional on purpose,
because the sign-up form has to be fast. Two columns (`resume_parsed`,
`resume_parsed_at`) sit empty until Step 8, when the AI fills them in.

**`voucher_profiles`** — one row per voucher: which company they work for,
which branch, their work email, and how they were verified. Also the payout
gates — identity verification and tax info — which stay empty until Step 2b.

The database itself refuses to mark anyone `verified` unless they have both a
verification method *and* a recorded confirmation that their employer permits
them to take part. That rule can't be skipped by a future bug, because it isn't
in the app code — it's in the table.

### Companies

**`companies`** — the employer organizations. The green checkmark
(`is_verified`) is **computed, not set**: it's true only when the company has
proven domain ownership *and* has a payment method on file. Nobody can flip it
by hand, including us.

**`company_domains`** — the email domains that prove employment. Separate table
because real companies own several. Free providers like gmail are blocked in
app code during Step 4.

**`locations`** — one row per store, branch, or office, with an address. Jobs
point at one; vouchers display theirs so employers can judge how close the
voucher actually sits to the role.

**`company_members`** — which employer logins may act for which company, and at
what level (owner or recruiter). Without this a company would be hostage to
whichever single person happened to sign up first.

### Getting verified

**`voucher_invitations`** — the employer-invite path. A verified employer
invites someone by email, and that invitation *is* their verification. This is
how a two-chair dental practice running on Gmail gets vouchers at all, since it
has no company domain to email.

**`email_verifications`** — the 6-digit codes for the self-serve path. Only a
*hash* of each code is stored, never the code itself, so a database leak
doesn't hand anyone a working code. No logged-in user can read this table at
all; only server-side code with the secret key can.

### Jobs and the vouch flow

**`jobs`** — an open role. The three fee columns are the interesting part: they
are a **frozen copy** of your pricing as it stood the moment the job was
posted. Hourly work becomes Tier 1 ($500), salaried becomes Tier 2 ($2,000),
and a human can override that. Once the job is live, the database refuses to
let the fee change — so raising your prices next year can never rewrite a deal
you already struck.

**`intro_requests`** — a seeker asking for a vouch on one specific job. Rows
still `pending` are what the cap of 5 counts. One request per seeker per job,
enforced by the database rather than by hoping the screen prevents it.

**`vouches`** — the written endorsement itself. Three things worth knowing:

- `relationship` records whether the voucher **knows the person** or has
  **only reviewed their profile**. It cannot be left blank. Both kinds are
  legitimate, and the employer is always told which one they're reading.
- `body` must be at least 150 characters. One-click vouches are impossible.
- `disclosed_fee_cents` records what this voucher stands to earn if the person
  is hired, and the employer sees it on the vouch. Paid endorsements only work
  if everyone knows they're paid.

**`applications`** — what the employer actually works with. It's created
*automatically* the instant a vouch is written, which is what makes "employers
only ever see vouched candidates" true by construction instead of true by
remembering to filter.

The AI columns (`ai_fit_score`, `ai_reasoning`) are advisory. A rule on the
table makes it physically impossible to store a score without its written
reasoning — so a screen can never show a number with no explanation behind it.
Nothing here auto-rejects anyone; a human moves every candidate.

**`application_events`** — a log of every status change: who moved it, when,
and from what to what. Feeds dispute resolution and, in Step 2b, the retention
figures behind a voucher's public record.

### Settings

**`platform_settings`** — your configurable numbers: both tier fees, the
voucher's 50% share, the cap of 5 open requests per seeker, the cap of 5 open
vouches per voucher, and the 60-day payout hold. Each row carries a start date,
so changing a number never rewrites history.

Change a fee like this, in the Supabase SQL Editor:

```sql
insert into platform_settings (key, value, note)
values ('fee_tier_1_cents', to_jsonb(60000), 'Raised to $600 in March');
```

The old row stays. Jobs posted before today keep the price they were posted
under.

---

## Rules the database enforces on its own

These aren't in the app code, so no future screen or script can skip them.
Every one is covered by a test that was run against a real Postgres database
before this shipped.

| Rule | What happens if you try |
|---|---|
| Hourly → Tier 1 $500, salaried → Tier 2 $2,000 | Set automatically at posting |
| A posted job's fee is frozen | Update is rejected |
| A seeker may have 5 open intro requests | The 6th is rejected |
| A voucher may have 5 unresolved vouches | The 6th is rejected |
| Only verified vouchers may vouch | Rejected |
| Only for jobs at their own company | Rejected |
| A vouch must be at least 150 characters | Rejected |
| An AI score without written reasoning | Rejected |
| A verified voucher who never affirmed employer permission | Rejected |
| The green checkmark, set by hand | Rejected — it's computed |
| A voucher marking themselves verified | Rejected — only Vouch's server can |

---

## Who can see what

Every table has row-level security switched on. Postgres checks these on every
query, so they hold no matter which screen or script is asking.

| Who | Can see |
|---|---|
| Seeker | Their own profile, requests, and applications. No other seeker's anything. |
| Voucher (verified) | Intro requests for jobs **at their own company**, and those seekers' profiles. Nothing from any other company. |
| Voucher (unverified) | Nothing. |
| Employer | Candidates with a vouch for **their own** jobs, those seekers' profiles, and the vouchers who wrote them. |
| Anyone | Company names, locations, and open jobs. |
| Nobody | Verification codes. Server-side only. |

Tested by logging in as each role against a real database and counting what
came back — including checking that a voucher at one company sees exactly zero
of another company's requests and resumes.
