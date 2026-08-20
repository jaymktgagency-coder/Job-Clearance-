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
  -f supabase/tests/10_database_rules.sql \
  -f supabase/tests/20_caps_and_privacy.sql \
  -f supabase/tests/30_money_and_reputation.sql \
  -f supabase/tests/40_resume_storage.sql \
  -f supabase/tests/50_ai_is_advisory.sql
```

All 68 checks print `PASS`, and the run ends with
`50_ai_is_advisory.sql: all checks passed`. Any failure stops the run.

`00_supabase_stubs.sql` fakes the small parts of Supabase the migrations rely
on (the `auth` schema and the three Supabase roles) so the same SQL can run on
a plain Postgres.
