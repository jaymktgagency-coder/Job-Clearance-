-- ===========================================================================
-- Vouch — Step 2b security rules
--
-- Money is the most sensitive thing in the database after resumes. The rules
-- here are deliberately tight:
--
--   * a voucher sees their own payouts and nobody else's
--   * an employer sees their own company's charges and credits
--   * a seeker sees the hire that is about to change their life, and no money
--   * NOBODY, at any login, can move money — every write to payouts and
--     charges happens server-side. There are no update policies at all.
--   * abuse flags are invisible to everyone except the platform
-- ===========================================================================

begin;
alter table public.hires             enable row level security;
alter table public.employer_charges  enable row level security;
alter table public.employer_credits  enable row level security;
alter table public.payouts           enable row level security;
alter table public.abuse_flags       enable row level security;

-- ---------------------------------------------------------------------------
-- HIRES
-- All three parties can see a hire they are part of. Both the employer and
-- the seeker need to be able to confirm one, which is why each may update.
-- ---------------------------------------------------------------------------

create policy hires_read_as_employer on public.hires
  for select using (public.is_company_member(company_id));

create policy hires_read_as_seeker on public.hires
  for select using (seeker_id = (select auth.uid()));

create policy hires_read_as_voucher on public.hires
  for select using (voucher_id = (select auth.uid()));

-- An employer reports a hire for one of their own jobs.
create policy hires_insert_as_employer on public.hires
  for insert to authenticated with check (
    exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = hires.application_id and public.is_company_member(j.company_id)
    )
  );

-- A seeker may also report their own hire — that is what stops an employer
-- quietly never mentioning it.
create policy hires_insert_as_seeker on public.hires
  for insert to authenticated with check (
    exists (
      select 1 from public.applications a
      where a.id = hires.application_id and a.seeker_id = (select auth.uid())
    )
  );

create policy hires_update_as_employer on public.hires
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy hires_update_as_seeker on public.hires
  for update using (seeker_id = (select auth.uid()))
  with check (seeker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- CHARGES AND CREDITS — the employer's side of the money
-- Read only. Rows are created by the database when a hire is confirmed.
-- ---------------------------------------------------------------------------

create policy charges_read_as_employer on public.employer_charges
  for select using (public.is_company_member(company_id));

create policy credits_read_as_employer on public.employer_credits
  for select using (public.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- PAYOUTS — the voucher's side
-- A voucher may look at what they are owed. Nobody may change it from a login.
-- ---------------------------------------------------------------------------

create policy payouts_read_as_voucher on public.payouts
  for select using (voucher_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- ABUSE FLAGS — no policies at all
-- Nobody should learn they have been flagged by reading it out of the API.
-- Only server-side code with the secret key can see or write these.
-- ---------------------------------------------------------------------------

-- (deliberately empty)

-- ---------------------------------------------------------------------------
-- REPUTATION
-- The view runs as whoever is asking (security_invoker), so it shows only
-- rows that person could already see. Employers can read a voucher's record
-- because they can already see that voucher's profile.
-- ---------------------------------------------------------------------------

grant select on public.voucher_reputation to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- GRANTS for the new tables
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- The scheduled jobs are platform work, not something a logged-in user runs.
revoke execute on function public.release_due_payouts()      from authenticated;
revoke execute on function public.check_hire_retention()     from authenticated;
revoke execute on function public.open_stale_hire_disputes() from authenticated;

commit;
