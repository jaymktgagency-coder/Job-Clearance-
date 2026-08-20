# The Vouch database, in plain English

Twenty tables and one saved query. This explains what each one holds and why,
without assuming you know anything about databases.

Steps 2a (people, companies, jobs, vouches) and 2b (money and reputation).

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
`resume_parsed_at`) hold what the AI read out of the resume file. Only Vouch's
own server can write them — a seeker cannot put words in the AI's mouth — but
a seeker can always clear them, because it is their data.

**`voucher_profiles`** — one row per voucher: which company they work for,
which branch, their work email, and how they were verified. Also the payout
gates — identity verification and tax info — which stay empty until Step 2b.

The database itself refuses to mark anyone `verified` unless they have both a
verification method *and* a recorded confirmation that their employer permits
them to take part. That rule can't be skipped by a future bug, because it isn't
in the app code — it's in the table.

### Companies

**`companies`** — the employer organizations, and the two verification badges.

`verification_tier` is **computed, not set** — nobody can flip it by hand,
including us:

| Badge | What it takes | What it means |
|---|---|---|
| **Verified Domain** | payment method + business registration + proven email domain | Everything below, plus we've confirmed they own their email domain — which is what makes work-email voucher verification possible |
| **Verified Business** | payment method + business registration | A real, registered business that can actually pay. No domain needed |
| *(none)* | anything less | Hasn't finished signing up |

The distinction matters: a two-chair dental practice running on Gmail can never
own a company domain, but it is every bit as real an employer. Under the old
single checkmark it would have looked permanently second-rate next to a chain.
Now it earns **Verified Business**, and gets its vouchers through invitations
instead of work-email checks.

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

The AI columns (`ai_fit_score`, `ai_reasoning`, `ai_scored_at`) are advisory,
and three separate rules keep them that way:

- a check constraint makes it **impossible to store a score without its written
  reasoning**, so a screen can never show a number with no explanation;
- a trigger **rejects any update that writes a score and changes the status**,
  which is what makes "the AI never auto-rejects anyone" structural rather than
  a promise. The score arrives; then a person decides;
- that same trigger **discards AI columns written from a login**. An employer
  legitimately updates their own candidates — that is how someone moves from
  'new' to 'interviewed' — but they cannot type their own score into the
  platform's field. Their status change still goes through.

**`application_events`** — a log of every status change: who moved it, when,
and from what to what. Feeds dispute resolution and, in Step 2b, the retention
figures behind a voucher's public record.

### Money (Step 2b)

**`hires`** — the money event, and the only thing that makes anything owed.
A hire needs **both** the employer and the seeker to confirm it. That's
deliberate: the employer is the one who owes $500–$2,000 and has every reason
to stay quiet, and the seeker has no way to prove it alone. If a seeker
reports a hire and the employer says nothing for a week, it becomes a
**dispute** for a human to sort out, rather than quietly disappearing.

Confirmation freezes the fee, sets the payout date to 60 days after the start
date, and marks the candidate as hired.

**`employer_charges`** — what the employer owes for one hire, and whether it's
been paid, credited, or waived.

**`employer_credits`** — the early-departure remedy. If the person leaves
inside the 30-day window, the employer does **not** get cash back; they get a
credit worth half the fee toward their next hire. This table is the ledger:
one row per credit, marked off when spent. Credits are spent oldest first, and
a credit bigger than the next bill is split rather than wasted.

**`payouts`** — what the voucher is owed, released 60 days after the start
date rather than at hire. That delay is the entire anti-abuse mechanism: vouch
carelessly for a stranger who doesn't last, and you lose both the money and
your retention record. No payout can reach `released` or `paid` until the
voucher has completed identity **and** tax verification.

**`abuse_flags`** — accounts needing a human look: unusual volume, poor
retention, repeated vouch text, signs of a ring. Nothing here punishes anyone
automatically; a person decides. **No logged-in user can read this table at
all** — you should not be able to discover you've been flagged by querying the
API.

**`voucher_reputation`** — **a saved query, not a table.** Computed live from
hires, so the numbers can never drift out of sync with reality the way stored
counters do. It reports vouches written, hires resulting, how many were still
there at 60 days — and a retention *percentage* that stays deliberately blank
until there are at least five measured hires. One vouch that didn't work out
should not read as "0% retention" forever.

### Jobs that run on a timer

Three functions the platform calls on a schedule. They're written as database
functions so they can be tested now and wired to a timer later:

- `check_hire_retention()` — marks whether each hire was still employed at 60 days
- `release_due_payouts()` — releases payouts whose hold has expired, and puts a
  hold on anyone who still hasn't completed identity and tax checks
- `open_stale_hire_disputes()` — opens a dispute when a seeker reports a hire
  and the employer never responds

### Resume files

Resumes are files, not rows, so they live in Supabase Storage rather than a
table — in a **private** bucket called `resumes`, capped at 5 MB and limited to
PDF, Word, and plain text. Private means there is no shareable URL: every read
goes through the same permission check as everything else.

Each file sits at `<user-id>/<filename>`, and the rules mirror the seeker's
profile exactly: the seeker can upload, replace and delete their own; a
**verified** voucher can read the resume of someone who asked for a vouch at
their own company; an employer can read a vouched candidate's resume for their
own job. Nobody else can read anything, and nobody can write into another
person's folder.

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
| A verification badge, set by hand | Rejected — it's computed |
| A voucher marking themselves verified | Rejected — only Vouch's server can |
| Money owed before both sides confirm a hire | No charge or payout is created |
| Releasing a payout before identity + tax checks | Rejected |
| A voucher editing their own payout | 0 rows touched — there is no policy allowing it |
| Cash refund for an early departure | Not possible — the remedy is a credit row |

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
| Anyone | Company names, badges, locations, and open jobs. |
| Nobody | Verification codes, and abuse flags. Server-side only. |

On the money specifically:

| Who | Can see |
|---|---|
| Voucher | Their own payouts. Not other vouchers' payouts, not employer charges. |
| Employer | Their own company's charges and credits. Never a voucher's payout. |
| Seeker | The hire itself. No payouts, no charges — the money is not their business. |
| Anyone, writing | **Nothing.** There are no update policies on payouts or charges at all; every money movement happens server-side. |

Tested by logging in as each role against a real database and counting what
came back — including checking that a voucher at one company sees exactly zero
of another company's requests and resumes.
