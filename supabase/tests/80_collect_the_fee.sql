\set ON_ERROR_STOP on
-- ===========================================================================
-- No money leaves until money arrived
--
-- Before migration 0011 a payout released on day 60 whether or not the
-- employer had ever been charged — Vouch would have paid the voucher out of
-- its own pocket and then chased an employer who might decline.
-- ===========================================================================

-- --- fixtures: this file's own company and people ---------------------------
insert into auth.users (id, email) values
  ('cccc0000-0000-0000-0000-000000000001','boss@fee.test'),
  ('cccc0000-0000-0000-0000-000000000002','voucher@fee.test'),
  ('cccc0000-0000-0000-0000-000000000003','hired@fee.test'),
  ('cccc0000-0000-0000-0000-000000000004','hired2@fee.test');

insert into public.users (id, role, full_name, email) values
  ('cccc0000-0000-0000-0000-000000000001','employer','Fee Boss','boss@fee.test'),
  ('cccc0000-0000-0000-0000-000000000002','voucher','Fee Voucher','voucher@fee.test'),
  ('cccc0000-0000-0000-0000-000000000003','seeker','Paid Properly','hired@fee.test'),
  ('cccc0000-0000-0000-0000-000000000004','seeker','Credit Covered','hired2@fee.test');

insert into public.seeker_profiles (user_id, headline)
select id, 'Test seeker' from public.users where email in ('hired@fee.test','hired2@fee.test');

insert into public.companies (id, name, slug, payment_method_on_file, business_registration_verified_at)
values ('cccc1111-0000-0000-0000-000000000001','Fee Test Co','fee-test-co', true, now());

insert into public.company_members (company_id, user_id, member_role)
values ('cccc1111-0000-0000-0000-000000000001','cccc0000-0000-0000-0000-000000000001','owner');

insert into public.voucher_profiles
  (user_id, company_id, status, verification_method, verified_at, employer_permission_confirmed_at,
   identity_verified_at, tax_info_collected_at)
values ('cccc0000-0000-0000-0000-000000000002','cccc1111-0000-0000-0000-000000000001',
        'verified','employer_invite', now(), now(), now(), now());

insert into public.jobs (id, company_id, posted_by, title, description, pay_type, status, posted_at)
select ('cccc2222-0000-0000-0000-00000000000'||g)::uuid,'cccc1111-0000-0000-0000-000000000001',
       'cccc0000-0000-0000-0000-000000000001','Fee role '||g,'Work.','hourly','open', now()
from generate_series(1,2) g;

insert into public.intro_requests (id, job_id, seeker_id) values
  ('cccc3333-0000-0000-0000-000000000001','cccc2222-0000-0000-0000-000000000001','cccc0000-0000-0000-0000-000000000003'),
  ('cccc3333-0000-0000-0000-000000000002','cccc2222-0000-0000-0000-000000000002','cccc0000-0000-0000-0000-000000000004');

insert into public.vouches (intro_request_id, voucher_id, relationship, body)
select id,'cccc0000-0000-0000-0000-000000000002','knows_personally',
       repeat('I worked alongside them and would again, without hesitation. ',4)
from public.intro_requests where id in ('cccc3333-0000-0000-0000-000000000001','cccc3333-0000-0000-0000-000000000002');

-- Both hires confirmed, both started 61 days ago so their payouts are due.
insert into public.hires (application_id, start_date, confirmed_by_employer_at)
select a.id, current_date - 61, now() from public.applications a
 where a.job_id in ('cccc2222-0000-0000-0000-000000000001','cccc2222-0000-0000-0000-000000000002');
update public.hires set confirmed_by_seeker_at = now()
 where application_id in (select id from public.applications
                           where job_id in ('cccc2222-0000-0000-0000-000000000001','cccc2222-0000-0000-0000-000000000002'));

create table public.t_fee as
  select h.id as hire_id, j.id as job_id
    from public.hires h join public.jobs j on j.id = h.job_id
   where j.company_id = 'cccc1111-0000-0000-0000-000000000001';
grant select on public.t_fee to authenticated;

do $$
declare n int;
begin
  select count(*) into n from public.employer_charges c join public.t_fee t on t.hire_id = c.hire_id;
  if n <> 2 then raise exception 'FAIL: expected 2 charges from 2 confirmed hires, got %', n; end if;
  raise notice 'PASS: two confirmed hires raised two charges';
end $$;

-- --- 1. the net figure is the fee less credits, and cannot drift -------------
do $$
declare c record;
begin
  select amount_cents, credit_applied_cents, net_amount_cents into c
    from public.employer_charges where hire_id = (select hire_id from public.t_fee limit 1);
  if c.net_amount_cents <> c.amount_cents - c.credit_applied_cents then
    raise exception 'FAIL: net % is not % - %', c.net_amount_cents, c.amount_cents, c.credit_applied_cents;
  end if;
  raise notice 'PASS: net to collect is % cents (fee % less credit %)',
    c.net_amount_cents, c.amount_cents, c.credit_applied_cents;
end $$;

-- --- 2. THE RULE: an unpaid fee holds the payout ----------------------------
do $$ begin
  if (select count(*) from public.employer_charges c join public.t_fee t on t.hire_id=c.hire_id
       where c.status = 'pending') <> 2 then
    raise exception 'FAIL: charges should start pending';
  end if;
end $$;

select public.release_due_payouts();

do $$
declare p record;
begin
  select status, hold_reason into p from public.payouts
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  if p.status = 'released' then
    raise exception 'FAIL: a payout released while the employer had not paid';
  end if;
  if p.status <> 'held' then raise exception 'FAIL: expected held, got %', p.status; end if;
  if p.hold_reason not like '%fee has not been collected%' then
    raise exception 'FAIL: held for the wrong reason: %', p.hold_reason;
  end if;
  raise notice 'PASS: due payout HELD because the fee had not arrived — "%"', left(p.hold_reason, 52);
end $$;

-- --- 3. money arrives -> the payout goes back in the queue and releases ------
update public.employer_charges set status = 'paid', paid_at = now()
 where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);

select public.unhold_settled_payouts();

do $$
declare p record;
begin
  select status, hold_reason into p from public.payouts
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  if p.status <> 'scheduled' or p.hold_reason is not null then
    raise exception 'FAIL: paid charge did not free the payout (still %)', p.status;
  end if;
  raise notice 'PASS: the fee arrived -> the held payout went back in the queue';
end $$;

select public.release_due_payouts();

do $$
declare p record;
begin
  select status into p from public.payouts
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  if p.status <> 'released' then raise exception 'FAIL: expected released, got %', p.status; end if;
  raise notice 'PASS: and then released';
end $$;

-- --- 4. a fee covered entirely by credit needs no money to move -------------
update public.employer_charges set status = 'credited'
 where hire_id = (select hire_id from public.t_fee order by hire_id desc limit 1);
select public.unhold_settled_payouts();
select public.release_due_payouts();

do $$
declare p record;
begin
  select status into p from public.payouts
   where hire_id = (select hire_id from public.t_fee order by hire_id desc limit 1);
  if p.status <> 'released' then
    raise exception 'FAIL: a credit-covered fee should still release the payout, got %', p.status;
  end if;
  raise notice 'PASS: a fee covered by credit counts as settled — payout released, no money moved';
end $$;

-- --- 5. an employer cannot mark their own bill paid --------------------------
-- There are two locks on this table and both are checked, because they fail
-- differently. RLS makes the write match nothing (silent, no error). The
-- trigger raises. The trigger only matters if someone later adds an UPDATE
-- policy "for convenience", so the second block does exactly that and proves
-- the money is still safe.
update public.employer_charges set status = 'pending', paid_at = null
 where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- lock 1: row-level security. No UPDATE policy exists, so nothing matches.
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'cccc0000-0000-0000-0000-000000000001';
  update public.employer_charges set status = 'waived'
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  delete from public.employer_charges
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
commit;

do $$
declare s public.charge_status; n int;
begin
  select count(*) into n from public.employer_charges
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  select status into s from public.employer_charges
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  if n <> 1 then raise exception 'FAIL: the employer deleted their own bill'; end if;
  if s <> 'pending' then raise exception 'FAIL: the employer set their bill to %', s; end if;
  raise notice 'PASS: lock 1 (row-level security) — the write matched nothing, the bill still stands';
end $$;

-- lock 2: the trigger. Simulate a future change that adds an UPDATE policy.
create policy charges_update_oops on public.employer_charges
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'cccc0000-0000-0000-0000-000000000001';
  select must_fail(
    $$update public.employer_charges set status = 'waived'
       where hire_id = (select hire_id from public.t_fee order by hire_id limit 1)$$,
    'an employer waiving their own fee, even with an UPDATE policy in place');
commit;

drop policy charges_update_oops on public.employer_charges;

do $$
declare s public.charge_status;
begin
  select status into s from public.employer_charges
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  if s <> 'pending' then raise exception 'FAIL: the bill changed to %', s; end if;
  raise notice 'PASS: lock 2 (the trigger) — still refused even with a policy letting them through';
end $$;

-- --- 6. and a payment in flight is not the same as a payment received -------
update public.employer_charges set status = 'processing'
 where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
update public.payouts set status = 'scheduled', hold_reason = null
 where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
select public.release_due_payouts();

do $$
declare p record;
begin
  select status into p from public.payouts
   where hire_id = (select hire_id from public.t_fee order by hire_id limit 1);
  if p.status = 'released' then
    raise exception 'FAIL: released against a bank debit that had not cleared';
  end if;
  raise notice 'PASS: a bank debit still in flight does not release a payout';
end $$;

-- --- 7. a charge still cascades away with what it belongs to ----------------
-- The guard above fires on DELETE, and a BEFORE DELETE trigger that returns
-- NEW returns null — which cancels the delete instead of allowing it. That
-- silently orphaned every charge row when a company or an account was
-- removed, and broke "deleting an account erases everything".
do $$
declare v_before int; v_after int; v_company uuid := 'cccc1111-0000-0000-0000-000000000001';
begin
  select count(*) into v_before from public.employer_charges where company_id = v_company;
  if v_before = 0 then raise exception 'FAIL: fixture has no charges to cascade'; end if;

  delete from public.voucher_profiles where company_id = v_company;   -- ON DELETE RESTRICT
  delete from public.companies where id = v_company;

  select count(*) into v_after from public.employer_charges where company_id = v_company;
  if v_after <> 0 then
    raise exception 'FAIL: % charge rows survived their company being deleted', v_after;
  end if;
  if exists (select 1 from public.companies where id = v_company) then
    raise exception 'FAIL: the company itself was not deleted';
  end if;
  raise notice 'PASS: deleting the company took its % charge(s) with it — no orphaned money rows', v_before;
end $$;

drop table public.t_fee;

do $$ begin raise notice '--- 80_collect_the_fee.sql: all checks passed ---'; end $$;
