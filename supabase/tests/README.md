# Database tests

**You don't need to run these.** They're here so that whoever changes the
schema later can prove they haven't broken a rule the product depends on.

They check, against a real Postgres database, that:

- hourly jobs price at $500 and salaried at $2,000, automatically
- a posted job's fee can't be changed afterwards
- a seeker can't exceed 5 open intro requests, and a voucher 5 open vouches
- unverified vouchers can't vouch, and nobody can vouch outside their own company
- a vouch under 150 characters is refused
- an AI score can't be stored without its written reasoning
- a verification badge can't be set by hand, and a Gmail-run business can
  still earn Verified Business
- no money is owed until both the employer and the seeker confirm a hire
- a payout can't be released before identity and tax checks
- leaving inside 30 days cancels the payout and credits the employer instead
  of refunding cash; leaving on day 45 cancels the payout but earns no credit
- a voucher's retention percentage stays hidden below five measured hires
- a voucher cannot pay themselves, and cannot see anyone else's payouts
- a voucher at one company sees zero requests and zero resumes from any other
- unverified vouchers see nothing at all
- verification codes are invisible to every logged-in user
- an AI score cannot be stored without its written reasoning
- an update cannot both score a candidate and move them — not even from our
  own server code
- an employer cannot write their own "AI score", and their real status change
  still goes through when they try
- a seeker cannot write their own parsed resume, but can always erase it
- an employer cannot sign a hire on behalf of the person they hired
- neither side can rewrite the fee, the share, the status or the dates
- one side alone cannot end a job, cancel a payout, or earn itself a credit
- a due payout is held, not released, while a departure is unresolved
- an unanswered separation becomes a dispute after 7 days, deciding nothing
- an early departure credits the employer and never refunds cash
- a lapsed credit cannot be spent
- a voucher's payout is held, not released, while the employer's fee is unpaid
- a fee covered entirely by credit counts as settled, and releases the payout
- a bank debit still in flight does not count as money arrived
- an employer cannot waive, delete, or mark their own fee paid — checked
  against BOTH locks, row-level security and the trigger behind it
- a company cannot award itself a verification badge, at creation or after
- a company may claim an email domain, but claiming proves nothing and
  unlocks nothing until Vouch marks it proven
- a company cannot invent its own Stripe identifiers

## Running them

Needs a local PostgreSQL 16. From a database you don't mind wiping:

```bash
psql -d yourtestdb -v ON_ERROR_STOP=1 \
  -f supabase/tests/00_supabase_stubs.sql \
  -f supabase/migrations/0001_core_schema.sql \
  -f supabase/migrations/0002_row_level_security.sql \
  -f supabase/migrations/0003_money_and_reputation.sql \
  -f supabase/migrations/0004_money_row_level_security.sql \
  -f supabase/migrations/0005_fix_company_member_signup.sql \
  -f supabase/migrations/0006_resume_storage.sql \
  -f supabase/migrations/0007_lock_the_fee.sql \
  -f supabase/migrations/0008_ai_is_advisory.sql \
  -f supabase/migrations/0009_separation_and_hire_integrity.sql \
  -f supabase/migrations/0010_payment_methods_and_company_trust.sql \
  -f supabase/migrations/0011_collect_the_fee.sql \
  -f supabase/tests/10_database_rules.sql \
  -f supabase/tests/20_caps_and_privacy.sql \
  -f supabase/tests/30_money_and_reputation.sql \
  -f supabase/tests/40_resume_storage.sql \
  -f supabase/tests/50_ai_is_advisory.sql \
  -f supabase/tests/60_separation_and_integrity.sql \
  -f supabase/tests/70_company_trust.sql \
  -f supabase/tests/80_collect_the_fee.sql
```

All 99 checks print `PASS`, and the run ends with
`80_collect_the_fee.sql: all checks passed`. Any failure stops the
run. `60_` builds its own company and people, so it also passes on its own.

`00_supabase_stubs.sql` fakes the small parts of Supabase the migrations rely
on (the `auth` schema and the three Supabase roles) so the same SQL can run on
a plain Postgres.
