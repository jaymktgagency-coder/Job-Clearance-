\set ON_ERROR_STOP on
-- Step 2b checks. Runs after 10 and 20, reusing their people and vouches.

-- ===========================================================================
-- A. TWO-TIER BUSINESS VERIFICATION
-- ===========================================================================
do $$
declare t text;
begin
  -- Acme has a payment method and a proven domain, but no business
  -- registration yet, so it has earned nothing.
  select verification_tier into t from public.companies where slug='acme-coffee';
  if t <> 'none' then raise exception 'FAIL: expected none, got %', t; end if;

  update public.companies set business_registration_verified_at = now(),
         business_registration_reference = 'EIN 12-3456789' where slug='acme-coffee';
  select verification_tier into t from public.companies where slug='acme-coffee';
  if t <> 'domain' then raise exception 'FAIL: expected domain, got %', t; end if;
  raise notice 'PASS: payment + registration + domain -> Verified Domain';
end $$;

do $$
declare t text;
begin
  -- Other Corp is the Gmail-style business: no domain at all. It should still
  -- be able to reach a real badge.
  update public.companies set payment_method_on_file = true,
         business_registration_verified_at = now(),
         business_registration_reference = 'Company No. 998877' where slug='other-corp';
  select verification_tier into t from public.companies where slug='other-corp';
  if t <> 'business' then raise exception 'FAIL: expected business, got %', t; end if;
  raise notice 'PASS: a business with NO domain still earns Verified Business';
end $$;

do $$
declare t text;
begin
  update public.companies set payment_method_on_file = false where slug='other-corp';
  select verification_tier into t from public.companies where slug='other-corp';
  if t <> 'none' then raise exception 'FAIL: losing the payment method should drop the badge, got %', t; end if;
  update public.companies set payment_method_on_file = true where slug='other-corp';
  raise notice 'PASS: removing the payment method drops the badge again';
end $$;

select must_fail($$update public.companies set verification_tier = 'domain' where slug='other-corp'$$,
                 'setting a verification badge by hand');

-- ===========================================================================
-- B. A HIRE NEEDS BOTH SIDES TO CONFIRM
-- ===========================================================================
do $$
declare v_app uuid; v_hire uuid; v_status text;
begin
  select a.id into v_app from public.applications a
  join public.vouches v on v.id = a.vouch_id
  where v.voucher_id='22222222-2222-2222-2222-222222222222'
  order by a.created_at limit 1;

  insert into public.hires (application_id, start_date, confirmed_by_employer_at)
  values (v_app, current_date - 90, now()) returning id into v_hire;

  select status into v_status from public.hires where id=v_hire;
  if v_status <> 'reported' then raise exception 'FAIL: employer alone made it %', v_status; end if;
  if exists (select 1 from public.payouts where hire_id=v_hire) then
    raise exception 'FAIL: a payout was created before both sides confirmed'; end if;
  if exists (select 1 from public.employer_charges where hire_id=v_hire) then
    raise exception 'FAIL: the employer was charged before both sides confirmed'; end if;
  raise notice 'PASS: employer alone does not make money owed';

  update public.hires set confirmed_by_seeker_at = now() where id=v_hire;
  select status into v_status from public.hires where id=v_hire;
  if v_status <> 'confirmed' then raise exception 'FAIL: both confirmed but status is %', v_status; end if;
  raise notice 'PASS: both sides confirming makes it a real hire';
end $$;

do $$
declare h record; p record; c record;
begin
  select * into h from public.hires order by created_at desc limit 1;
  select * into p from public.payouts where hire_id = h.id;
  select * into c from public.employer_charges where hire_id = h.id;

  if h.payout_due_at <> h.start_date + 60 then
    raise exception 'FAIL: payout due % but start was %', h.payout_due_at, h.start_date; end if;
  if p.id is null or p.status <> 'scheduled' then raise exception 'FAIL: no scheduled payout'; end if;
  if p.amount_cents <> h.fee_amount_cents / 2 then
    raise exception 'FAIL: voucher gets % of a % fee', p.amount_cents, h.fee_amount_cents; end if;
  if c.id is null or c.status <> 'pending' then raise exception 'FAIL: no pending charge'; end if;
  if c.amount_cents <> h.fee_amount_cents then raise exception 'FAIL: charge is %', c.amount_cents; end if;
  raise notice 'PASS: confirmation created a % payout (50%% of %) due 60 days after start, and a % charge',
    p.amount_cents, h.fee_amount_cents, c.amount_cents;

  if (select status from public.applications where id = h.application_id) <> 'hired' then
    raise exception 'FAIL: the candidate record was not marked hired'; end if;
  raise notice 'PASS: the candidate record now reads "hired"';
end $$;

-- ===========================================================================
-- C. NO MONEY WITHOUT IDENTITY AND TAX DETAILS
-- ===========================================================================
select must_fail($$update public.payouts set status='released' where status='scheduled'$$,
                 'releasing a payout before identity and tax checks');

do $$
declare n int;
begin
  n := public.release_due_payouts();
  if n <> 0 then raise exception 'FAIL: released % payouts despite missing identity', n; end if;
  if not exists (select 1 from public.payouts where status='held' and hold_reason like '%identity%') then
    raise exception 'FAIL: payout was not put on hold'; end if;
  raise notice 'PASS: the scheduled job held the payout instead of paying it';
end $$;

-- Identity and tax are only one of the gates. Since migration 0011 the
-- employer's fee has to have arrived too, so clearing identity alone must
-- still not release anything.
do $$
declare n int;
begin
  update public.voucher_profiles set identity_verified_at = now(), tax_info_collected_at = now()
   where user_id='22222222-2222-2222-2222-222222222222';
  update public.payouts set status='scheduled' where status='held';
  n := public.release_due_payouts();
  if n <> 0 then raise exception 'FAIL: released % while the employer had not paid', n; end if;
  if not exists (select 1 from public.payouts where status='held' and hold_reason like '%fee has not been collected%') then
    raise exception 'FAIL: expected a hold explaining the unpaid fee';
  end if;
  raise notice 'PASS: identity done, but the fee had not arrived — still held';
end $$;

do $$
declare n int;
begin
  -- The employer pays.
  update public.employer_charges set status='paid', paid_at=now() where status='pending';
  perform public.unhold_settled_payouts();
  n := public.release_due_payouts();
  if n <> 1 then raise exception 'FAIL: expected 1 release, got %', n; end if;
  raise notice 'PASS: identity done AND the fee collected — the payout releases';
end $$;

-- ===========================================================================
-- D. LEAVING EARLY
-- ===========================================================================
do $$
declare v_app uuid; v_hire uuid; v_credit int; v_pay text;
begin
  select a.id into v_app from public.applications a
  join public.vouches v on v.id = a.vouch_id
  where v.voucher_id='22222222-2222-2222-2222-222222222222'
    and not exists (select 1 from public.hires h where h.application_id = a.id)
  limit 1;

  insert into public.hires (application_id, start_date, confirmed_by_employer_at, confirmed_by_seeker_at)
  values (v_app, current_date - 20, now(), now()) returning id into v_hire;

  -- they leave on day 10, inside the 30-day window
  update public.hires set separated_at = current_date - 10 where id=v_hire;

  select status into v_pay from public.payouts where hire_id=v_hire;
  if v_pay <> 'cancelled' then raise exception 'FAIL: payout is % after an early exit', v_pay; end if;

  select amount_cents into v_credit from public.employer_credits where source_hire_id=v_hire;
  if v_credit is null then raise exception 'FAIL: no employer credit was issued'; end if;
  if v_credit <> (select fee_amount_cents/2 from public.hires where id=v_hire) then
    raise exception 'FAIL: credit is % (expected half the fee)', v_credit; end if;
  if (select still_employed_at_60d from public.hires where id=v_hire) is not false then
    raise exception 'FAIL: retention not recorded as false'; end if;
  raise notice 'PASS: left on day 10 -> voucher paid nothing, employer credited % (50%% of fee), no cash refund', v_credit;
end $$;

-- the credit is spent on the very next confirmed hire
do $$
declare v_app uuid; v_hire uuid; c record; cr record;
begin
  select a.id into v_app from public.applications a
  join public.vouches v on v.id = a.vouch_id
  where v.voucher_id='22222222-2222-2222-2222-222222222222'
    and not exists (select 1 from public.hires h where h.application_id = a.id)
  limit 1;

  insert into public.hires (application_id, start_date, confirmed_by_employer_at, confirmed_by_seeker_at)
  values (v_app, current_date - 5, now(), now()) returning id into v_hire;

  select * into c from public.employer_charges where hire_id = v_hire;
  if c.credit_applied_cents <> 25000 then
    raise exception 'FAIL: expected 25000 of credit applied, got %', c.credit_applied_cents; end if;
  if c.status <> 'pending' then
    raise exception 'FAIL: a 50000 bill part-paid by 25000 of credit should still be pending, got %', c.status; end if;
  raise notice 'PASS: next hire billed %, of which % came off an earlier credit -> still % owed',
    c.amount_cents, c.credit_applied_cents, c.amount_cents - c.credit_applied_cents;

  select * into cr from public.employer_credits where consumed_by_hire_id = v_hire;
  if cr.consumed_at is null then raise exception 'FAIL: the credit was not marked as spent'; end if;
  if exists (select 1 from public.employer_credits where consumed_at is null) then
    raise exception 'FAIL: an unspent credit is still lying around'; end if;
  raise notice 'PASS: the credit ledger shows it spent, with nothing left over';
end $$;

-- leaving after the 30-day window: still no payout, but no credit either
do $$
declare v_app uuid; v_hire uuid; v_credits int;
begin
  select count(*) into v_credits from public.employer_credits;

  select a.id into v_app from public.applications a
  join public.vouches v on v.id = a.vouch_id
  where v.voucher_id='22222222-2222-2222-2222-222222222222'
    and not exists (select 1 from public.hires h where h.application_id = a.id)
  limit 1;

  insert into public.hires (application_id, start_date, confirmed_by_employer_at, confirmed_by_seeker_at)
  values (v_app, current_date - 50, now(), now()) returning id into v_hire;

  update public.hires set separated_at = current_date - 5 where id = v_hire;  -- day 45

  if (select status from public.payouts where hire_id = v_hire) <> 'cancelled' then
    raise exception 'FAIL: payout should be cancelled at day 45'; end if;
  if (select count(*) from public.employer_credits) <> v_credits then
    raise exception 'FAIL: a credit was issued for a day-45 departure'; end if;
  raise notice 'PASS: left on day 45 -> voucher still unpaid, and NO employer credit (outside the 30-day window)';
end $$;

-- ===========================================================================
-- F. RETENTION AND REPUTATION
-- ===========================================================================
do $$
declare n int; r record;
begin
  n := public.check_hire_retention();
  select * into r from public.voucher_reputation where voucher_id='22222222-2222-2222-2222-222222222222';
  if r.vouches_written < 1 then raise exception 'FAIL: no vouches counted'; end if;
  if r.hires_resulting < 1 then raise exception 'FAIL: no hires counted'; end if;
  raise notice 'PASS: reputation shows % vouches, % hires, % measured, % still employed',
    r.vouches_written, r.hires_resulting, r.hires_measured, r.hires_still_employed;

  if r.retention_pct is not null and r.hires_measured < 5 then
    raise exception 'FAIL: a percentage was shown with only % measured hires', r.hires_measured; end if;
  raise notice 'PASS: with % measured hires (under 5), the percentage is hidden — raw counts only', r.hires_measured;
end $$;

-- Give the voucher enough measured hires to cross the threshold, and the
-- percentage should appear.
do $$
declare v_seeker uuid; v_job uuid; v_req uuid; v_hire uuid; r record; i int;
begin
  for i in 1..3 loop
    v_seeker := gen_random_uuid();
    insert into auth.users (id, email) values (v_seeker, 'extra'||i||'@seeker.test');
    insert into public.users (id, role, full_name, email)
      values (v_seeker, 'seeker', 'Extra '||i, 'extra'||i||'@seeker.test');
    insert into public.seeker_profiles (user_id, headline) values (v_seeker, 'Extra seeker '||i);

    select id into v_job from public.jobs
     where company_id = 'aaaaaaaa-0000-0000-0000-000000000001'
       and id not in (select job_id from public.intro_requests where seeker_id = v_seeker)
     limit 1;

    insert into public.intro_requests (job_id, seeker_id) values (v_job, v_seeker) returning id into v_req;
    insert into public.vouches (intro_request_id, voucher_id, relationship, body)
      values (v_req, '22222222-2222-2222-2222-222222222222', 'reviewed_profile_only',
              repeat('A careful written assessment of this candidate for the role. ', 4));

    insert into public.hires (application_id, start_date, confirmed_by_employer_at, confirmed_by_seeker_at)
    select a.id, current_date - 120, now(), now() from public.applications a
     where a.seeker_id = v_seeker returning id into v_hire;
  end loop;

  perform public.check_hire_retention();

  select * into r from public.voucher_reputation where voucher_id='22222222-2222-2222-2222-222222222222';
  if r.hires_measured < 5 then raise exception 'FAIL: only % measured hires', r.hires_measured; end if;
  if r.retention_pct is null then raise exception 'FAIL: percentage still hidden at % measured hires', r.hires_measured; end if;
  raise notice 'PASS: at % measured hires the percentage appears: % percent retention (% of % still employed)',
    r.hires_measured, r.retention_pct, r.hires_still_employed, r.hires_measured;
end $$;

-- ===========================================================================
-- G. A SEEKER WHOSE EMPLOYER NEVER RESPONDS
-- ===========================================================================
do $$
declare v_seeker uuid; v_job uuid; v_req uuid; v_app uuid; v_hire uuid; n int;
begin
  v_seeker := gen_random_uuid();
  insert into auth.users (id, email) values (v_seeker, 'silent@seeker.test');
  insert into public.users (id, role, full_name, email)
    values (v_seeker, 'seeker', 'Silent Case', 'silent@seeker.test');
  insert into public.seeker_profiles (user_id, headline) values (v_seeker, 'Reported their own hire');

  select id into v_job from public.jobs where company_id='aaaaaaaa-0000-0000-0000-000000000001' limit 1;
  insert into public.intro_requests (job_id, seeker_id) values (v_job, v_seeker) returning id into v_req;
  insert into public.vouches (intro_request_id, voucher_id, relationship, body)
    values (v_req, '22222222-2222-2222-2222-222222222222', 'reviewed_profile_only',
            repeat('A careful written assessment of this candidate for the role. ', 4));
  select a.id into v_app from public.applications a where a.seeker_id = v_seeker;

  insert into public.hires (application_id, start_date, confirmed_by_seeker_at)
  values (v_app, current_date - 30, now() - interval '10 days') returning id into v_hire;

  n := public.open_stale_hire_disputes();
  if (select status from public.hires where id=v_hire) <> 'disputed' then
    raise exception 'FAIL: silence from the employer did not open a dispute'; end if;
  raise notice 'PASS: seeker reported a hire, employer stayed silent 10 days -> dispute opened';
end $$;

-- ===========================================================================
-- H. WHO CAN SEE THE MONEY
-- ===========================================================================
insert into public.abuse_flags (subject_type, subject_id, reason, severity, details)
values ('voucher', '22222222-2222-2222-2222-222222222222', 'high_volume', 2,
        '{"vouches_this_week": 14}'::jsonb);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.voucher_reputation to authenticated;

-- the voucher
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare mine int; others int; charges int; flags int;
  begin
    select count(*) into mine   from public.payouts where voucher_id='22222222-2222-2222-2222-222222222222';
    select count(*) into others from public.payouts where voucher_id<>'22222222-2222-2222-2222-222222222222';
    select count(*) into charges from public.employer_charges;
    select count(*) into flags  from public.abuse_flags;
    if mine = 0 then raise exception 'FAIL: voucher cannot see their own payouts'; end if;
    if others <> 0 then raise exception 'FAIL: voucher sees % other payouts', others; end if;
    if charges <> 0 then raise exception 'FAIL: voucher sees % employer charges', charges; end if;
    if flags <> 0 then raise exception 'FAIL: voucher can see they were flagged'; end if;
    raise notice 'PASS: voucher sees their own % payouts, 0 others, 0 employer charges, 0 abuse flags', mine;
  end $$;
commit;

-- the employer
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare charges int; credits int; payouts int; foreign_c int; rep int;
  begin
    select count(*) into charges from public.employer_charges;
    select count(*) into credits from public.employer_credits;
    select count(*) into payouts from public.payouts;
    select count(*) into foreign_c from public.employer_charges
      where company_id <> 'aaaaaaaa-0000-0000-0000-000000000001';
    select count(*) into rep from public.voucher_reputation
      where voucher_id='22222222-2222-2222-2222-222222222222';
    if charges = 0 then raise exception 'FAIL: employer cannot see their own charges'; end if;
    if foreign_c <> 0 then raise exception 'FAIL: employer sees another company charges'; end if;
    if payouts <> 0 then raise exception 'FAIL: employer sees % voucher payouts', payouts; end if;
    if rep <> 1 then raise exception 'FAIL: employer cannot read the track record of a voucher who vouched for them'; end if;
    raise notice 'PASS: employer sees % charges and % credits (all their own), 0 payouts, and the voucher track record', charges, credits;
  end $$;
commit;

-- the seeker
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  declare payouts int; charges int; hires int;
  begin
    select count(*) into payouts from public.payouts;
    select count(*) into charges from public.employer_charges;
    select count(*) into hires   from public.hires;
    if payouts <> 0 then raise exception 'FAIL: seeker sees % payouts', payouts; end if;
    if charges <> 0 then raise exception 'FAIL: seeker sees % charges', charges; end if;
    raise notice 'PASS: seeker sees 0 payouts and 0 charges (their own % hires are visible)', hires;
  end $$;
commit;

-- nobody may move money from a login
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare n int;
  begin
    update public.payouts set status='paid', amount_cents = 999999
     where voucher_id='22222222-2222-2222-2222-222222222222';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: a voucher changed % payout rows', n; end if;
    raise notice 'PASS: a voucher cannot pay themselves — the update touched 0 rows';
  end $$;
commit;
