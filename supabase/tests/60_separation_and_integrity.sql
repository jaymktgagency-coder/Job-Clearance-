\set ON_ERROR_STOP on
-- ===========================================================================
-- Leaving a job, and who may say what about a hire
--
-- Each block below is an attack that worked against the database before
-- migration 0009, followed by the flow that is supposed to work.
-- ===========================================================================

-- --- fixtures ---------------------------------------------------------------
-- This file builds its own company and people rather than borrowing whatever
-- earlier files left lying around, so it behaves the same run on its own or
-- last in the suite.

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001','boss@separation.test'),
  ('dddddddd-0000-0000-0000-000000000002','voucher@separation.test'),
  ('dddddddd-0000-0000-0000-000000000003','left-early@separation.test'),
  ('dddddddd-0000-0000-0000-000000000004','silent@separation.test'),
  ('dddddddd-0000-0000-0000-000000000005','credits@separation.test');

insert into public.users (id, role, full_name, email) values
  ('dddddddd-0000-0000-0000-000000000001','employer','Sep Boss','boss@separation.test'),
  ('dddddddd-0000-0000-0000-000000000002','voucher','Sep Voucher','voucher@separation.test'),
  ('dddddddd-0000-0000-0000-000000000003','seeker','Ada Early','left-early@separation.test'),
  ('dddddddd-0000-0000-0000-000000000004','seeker','Sam Silent','silent@separation.test'),
  ('dddddddd-0000-0000-0000-000000000005','seeker','Cal Credit','credits@separation.test');

insert into public.seeker_profiles (user_id, headline)
select id, 'Test seeker' from public.users where id::text like 'dddddddd-0000-0000-0000-00000000000[345]';

insert into public.companies (id, name, slug, payment_method_on_file, business_registration_verified_at)
values ('dddddddd-1111-0000-0000-000000000001','Separation Test Co','separation-test-co', true, now());

insert into public.company_members (company_id, user_id, member_role)
values ('dddddddd-1111-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','owner');

insert into public.voucher_profiles
  (user_id, company_id, status, verification_method, verified_at, employer_permission_confirmed_at,
   identity_verified_at, tax_info_collected_at)
values ('dddddddd-0000-0000-0000-000000000002','dddddddd-1111-0000-0000-000000000001',
        'verified','employer_invite', now(), now(), now(), now());

insert into public.jobs (id, company_id, posted_by, title, description, pay_type, status, posted_at)
select ('dddddddd-2222-0000-0000-00000000000'||g)::uuid,'dddddddd-1111-0000-0000-000000000001',
       'dddddddd-0000-0000-0000-000000000001','Test role '||g,'Do the work.','hourly','open', now()
from generate_series(1,3) g;

insert into public.intro_requests (id, job_id, seeker_id)
select ('dddddddd-3333-0000-0000-00000000000'||g)::uuid,
       ('dddddddd-2222-0000-0000-00000000000'||g)::uuid,
       ('dddddddd-0000-0000-0000-00000000000'||(g+2))::uuid
from generate_series(1,3) g;

insert into public.vouches (intro_request_id, voucher_id, relationship, body)
select ('dddddddd-3333-0000-0000-00000000000'||g)::uuid,'dddddddd-0000-0000-0000-000000000002',
       'knows_personally', repeat('I worked alongside them and would again, without hesitation. ', 4)
from generate_series(1,3) g;

-- The three candidates those vouches created, one per scenario below.
create table public.t_h  as select id as app_id from public.applications where job_id = 'dddddddd-2222-0000-0000-000000000001';
create table public.t_h2 as select id as app_id from public.applications where job_id = 'dddddddd-2222-0000-0000-000000000002';
create table public.t_h3 as select id as app_id from public.applications where job_id = 'dddddddd-2222-0000-0000-000000000003';
grant select on public.t_h, public.t_h2, public.t_h3 to authenticated;

do $$
begin
  if (select count(*) from public.t_h) <> 1 then
    raise exception 'FAIL: the vouch did not create a candidate';
  end if;
  raise notice 'PASS: three vouched candidates created for this file''s own company';
end $$;

-- ---------------------------------------------------------------------------
-- 1. AN EMPLOYER CANNOT SIGN FOR THE PERSON THEY HIRED
-- Before 0009 this produced a confirmed hire, a charge, and a payout, with
-- the seeker never asked.
-- ---------------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';

  insert into public.hires (application_id, start_date, confirmed_by_employer_at, confirmed_by_seeker_at)
  values ((select app_id from public.t_h), current_date - 10, now(), now());
commit;

do $$
declare h record;
begin
  select status, confirmed_by_seeker_at, confirmed_by_employer_at into h
    from public.hires where application_id = (select app_id from public.t_h);
  if h.confirmed_by_seeker_at is not null then
    raise exception 'FAIL: the employer signed for the seeker';
  end if;
  if h.confirmed_by_employer_at is null then
    raise exception 'FAIL: the employer''s own confirmation was lost';
  end if;
  if h.status <> 'reported' then
    raise exception 'FAIL: the hire reached % on one signature', h.status;
  end if;
  if (select count(*) from public.payouts p join public.hires hh on hh.id = p.hire_id
       where hh.application_id = (select app_id from public.t_h)) > 0 then
    raise exception 'FAIL: money opened without the seeker';
  end if;
  raise notice 'PASS: employer''s half kept, seeker''s half discarded, no money opened';
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE SEEKER'S OWN CONFIRMATION IS WHAT OPENS THE MONEY
-- ---------------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000003';
  update public.hires set confirmed_by_seeker_at = now()
   where application_id = (select app_id from public.t_h);
commit;

do $$
declare h record; n_pay int; n_chg int;
begin
  select status, payout_due_at, start_date into h
    from public.hires where application_id = (select app_id from public.t_h);
  select count(*) into n_pay from public.payouts p join public.hires hh on hh.id = p.hire_id
   where hh.application_id = (select app_id from public.t_h);
  select count(*) into n_chg from public.employer_charges c join public.hires hh on hh.id = c.hire_id
   where hh.application_id = (select app_id from public.t_h);
  if h.status <> 'confirmed' then raise exception 'FAIL: both signed and it is still %', h.status; end if;
  if n_pay <> 1 or n_chg <> 1 then raise exception 'FAIL: expected one payout and one charge, got % and %', n_pay, n_chg; end if;
  if h.payout_due_at <> h.start_date + 60 then raise exception 'FAIL: payout due % is not start + 60', h.payout_due_at; end if;
  raise notice 'PASS: both sides signed -> confirmed, 1 charge, 1 payout, due 60 days after the start date';
end $$;

-- ---------------------------------------------------------------------------
-- 3. NEITHER SIDE MAY REWRITE THE MONEY OR THE DATES
-- ---------------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';
  select must_fail(
    $$update public.hires set fee_amount_cents = 1, voucher_amount_cents = 0
       where application_id = (select app_id from public.t_h)$$,
    'an employer rewriting the fee on a confirmed hire');
  select must_fail(
    $$update public.hires set separated_at = current_date
       where application_id = (select app_id from public.t_h)$$,
    'an employer cancelling the payout by declaring a departure');
  select must_fail(
    $$update public.hires set status = 'cancelled'
       where application_id = (select app_id from public.t_h)$$,
    'an employer cancelling the hire outright');
commit;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000003';
  select must_fail(
    $$update public.hires set start_date = current_date - 400
       where application_id = (select app_id from public.t_h)$$,
    'a seeker moving the start date on a confirmed hire');
  select must_fail(
    $$update public.hires set confirmed_by_employer_at = now()
       where application_id = (select app_id from public.t_h)$$,
    'a seeker signing for the employer');
commit;

do $$
declare h record;
begin
  select fee_amount_cents, voucher_amount_cents, separated_at, status, start_date into h
    from public.hires where application_id = (select app_id from public.t_h);
  if h.fee_amount_cents <> 50000 or h.voucher_amount_cents <> 25000 then
    raise exception 'FAIL: the money moved (% / %)', h.fee_amount_cents, h.voucher_amount_cents;
  end if;
  if h.separated_at is not null or h.status <> 'confirmed' or h.start_date <> current_date - 10 then
    raise exception 'FAIL: the hire was altered';
  end if;
  raise notice 'PASS: fee, share, dates and status all survived being attacked from both sides';
end $$;

-- ---------------------------------------------------------------------------
-- 4. ONE SIDE REPORTING A DEPARTURE CHANGES NO MONEY
-- This is the one that matters: the employer has $250 of reason to say this.
-- ---------------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';
  update public.hires
     set separation_reported_by  = 'dddddddd-0000-0000-0000-000000000001',
         separation_reported_at  = now(),
         separation_claimed_date = current_date - 5
   where application_id = (select app_id from public.t_h);
commit;

do $$
declare h record; pay record;
begin
  select separated_at, separation_confirmed_by_employer_at, separation_confirmed_by_seeker_at into h
    from public.hires where application_id = (select app_id from public.t_h);
  select p2.status into pay from public.payouts p2 join public.hires hh on hh.id = p2.hire_id
   where hh.application_id = (select app_id from public.t_h);
  if h.separated_at is not null then raise exception 'FAIL: one side ended the job on its own'; end if;
  if h.separation_confirmed_by_employer_at is null then raise exception 'FAIL: reporting it should count as the reporter''s own confirmation'; end if;
  if h.separation_confirmed_by_seeker_at is not null then raise exception 'FAIL: the seeker was signed for again'; end if;
  if pay.status <> 'scheduled' then raise exception 'FAIL: the payout was already %', p.status; end if;
  if (select count(*) from public.employer_credits ec join public.hires hh on hh.id = ec.source_hire_id
       where hh.application_id = (select app_id from public.t_h)) > 0 then
    raise exception 'FAIL: the employer credited themselves on their own say-so';
  end if;
  raise notice 'PASS: employer reported a day-5 departure -> payout untouched, no credit, nothing decided';
end $$;

-- --- and a payout must not slip out while that is unresolved ---------------
update public.payouts set release_at = current_date - 1
 where hire_id = (select id from public.hires where application_id = (select app_id from public.t_h));
update public.voucher_profiles set identity_verified_at = now(), tax_info_collected_at = now()
 where user_id = 'dddddddd-0000-0000-0000-000000000002';
select public.release_due_payouts();

do $$
declare pay record;
begin
  select p2.status, p2.hold_reason into pay from public.payouts p2 join public.hires hh on hh.id = p2.hire_id
   where hh.application_id = (select app_id from public.t_h);
  if pay.status = 'released' then
    raise exception 'FAIL: money released while the two sides disagreed about whether the job ended';
  end if;
  if pay.status <> 'held' then raise exception 'FAIL: expected held, got %', p.status; end if;
  raise notice 'PASS: due payout HELD, not released, while the departure is unresolved';
end $$;

-- ---------------------------------------------------------------------------
-- 5. BOTH SIDES AGREEING IS WHAT MOVES THE MONEY
-- ---------------------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000003';
  update public.hires set separation_confirmed_by_seeker_at = now()
   where application_id = (select app_id from public.t_h);
commit;

do $$
declare h record; pay record; c record;
begin
  select separated_at, still_employed_at_60d into h
    from public.hires where application_id = (select app_id from public.t_h);
  select p2.status, p2.hold_reason into pay from public.payouts p2 join public.hires hh on hh.id = p2.hire_id
   where hh.application_id = (select app_id from public.t_h);
  select amount_cents, expires_at into c from public.employer_credits ec join public.hires hh on hh.id = ec.source_hire_id
   where hh.application_id = (select app_id from public.t_h);

  if h.separated_at <> current_date - 5 then raise exception 'FAIL: separation date is %', h.separated_at; end if;
  if pay.status <> 'cancelled' then raise exception 'FAIL: the voucher was still paid (%)', p.status; end if;
  if h.still_employed_at_60d is not false then raise exception 'FAIL: the retention record does not show the departure'; end if;
  if c.amount_cents <> 25000 then raise exception 'FAIL: employer credit is % not 25000', c.amount_cents; end if;
  if c.expires_at is null then raise exception 'FAIL: the credit never lapses'; end if;
  raise notice 'PASS: both agreed -> voucher paid nothing, employer credited $% , credit lapses %',
    (c.amount_cents/100), c.expires_at;
end $$;

-- no cash refund, ever
do $$
begin
  if exists (select 1 from public.employer_charges c join public.hires hh on hh.id = c.hire_id
              where hh.application_id = (select app_id from public.t_h) and c.status = 'cancelled') then
    raise exception 'FAIL: the employer got their money back in cash';
  end if;
  raise notice 'PASS: the charge stands — a credit, never a refund';
end $$;

-- ---------------------------------------------------------------------------
-- 6. SILENCE BECOMES A DISPUTE, NOT A DEFAULT
-- ---------------------------------------------------------------------------
insert into public.hires (application_id, start_date, confirmed_by_employer_at)
values ((select app_id from public.t_h2), current_date - 20, now());
update public.hires set confirmed_by_seeker_at = now() where application_id = (select app_id from public.t_h2);

update public.hires
   set separation_reported_by = 'dddddddd-0000-0000-0000-000000000001',
       separation_reported_at = now() - interval '8 days',
       separation_claimed_date = current_date - 3,
       separation_confirmed_by_employer_at = now() - interval '8 days'
 where application_id = (select app_id from public.t_h2);

select public.open_stale_separation_disputes();

do $$
declare h record;
begin
  select separation_disputed_at, separated_at, separation_dispute_note into h
    from public.hires where application_id = (select app_id from public.t_h2);
  if h.separation_disputed_at is null then raise exception 'FAIL: 8 days of silence did not open a dispute'; end if;
  if h.separated_at is not null then raise exception 'FAIL: silence was treated as agreement'; end if;
  raise notice 'PASS: unanswered after 8 days -> dispute for a person, and still nothing decided';
end $$;

-- ---------------------------------------------------------------------------
-- 7. A LAPSED CREDIT CANNOT BE SPENT
-- ---------------------------------------------------------------------------
insert into public.employer_credits (company_id, amount_cents, expires_at, note)
values ('dddddddd-1111-0000-0000-000000000001', 999999, current_date - 1, 'lapsed yesterday');

insert into public.hires (application_id, start_date, confirmed_by_employer_at)
values ((select app_id from public.t_h3), current_date, now());
update public.hires set confirmed_by_seeker_at = now() where application_id = (select app_id from public.t_h3);

do $$
declare c record;
begin
  select ch.status, ch.credit_applied_cents into c
    from public.employer_charges ch join public.hires hh on hh.id = ch.hire_id
   where hh.application_id = (select app_id from public.t_h3);
  if c.credit_applied_cents > 25000 then
    raise exception 'FAIL: a lapsed credit was spent (% cents applied)', c.credit_applied_cents;
  end if;
  raise notice 'PASS: the lapsed credit was not spent (% cents applied, from live credits only)', c.credit_applied_cents;
end $$;

drop table public.t_h;
drop table public.t_h2;
drop table public.t_h3;

do $$ begin raise notice '--- 60_separation_and_integrity.sql: all checks passed ---'; end $$;
