\set ON_ERROR_STOP on
-- ===========================================================================
-- Where a voucher's money goes
--
-- Three columns decide whether a person can be paid: identity_verified_at,
-- tax_info_collected_at, and payout_account_id. Since Step 9c they are
-- written from what Stripe says, and the payout gate checks there is somewhere
-- to send the money before it says anything has been sent.
-- ===========================================================================

-- --- fixtures ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('bbbb0000-0000-0000-0000-000000000001','boss@payout.test'),
  ('bbbb0000-0000-0000-0000-000000000002','voucher@payout.test'),
  ('bbbb0000-0000-0000-0000-000000000003','hired@payout.test');

insert into public.users (id, role, full_name, email) values
  ('bbbb0000-0000-0000-0000-000000000001','employer','Payout Boss','boss@payout.test'),
  ('bbbb0000-0000-0000-0000-000000000002','voucher','Payout Voucher','voucher@payout.test'),
  ('bbbb0000-0000-0000-0000-000000000003','seeker','Payout Seeker','hired@payout.test');

insert into public.seeker_profiles (user_id, headline)
values ('bbbb0000-0000-0000-0000-000000000003','Test seeker');

insert into public.companies (id, name, slug, payment_method_on_file, business_registration_verified_at)
values ('bbbb1111-0000-0000-0000-000000000001','Payout Test Co','payout-test-co', true, now());

insert into public.company_members (company_id, user_id, member_role)
values ('bbbb1111-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000001','owner');

insert into public.voucher_profiles
  (user_id, company_id, status, verification_method, verified_at, employer_permission_confirmed_at)
values ('bbbb0000-0000-0000-0000-000000000002','bbbb1111-0000-0000-0000-000000000001',
        'verified','employer_invite', now(), now());

insert into public.jobs (id, company_id, posted_by, title, description, pay_type, status, posted_at)
values ('bbbb2222-0000-0000-0000-000000000001','bbbb1111-0000-0000-0000-000000000001',
        'bbbb0000-0000-0000-0000-000000000001','Payout role','Work.','hourly','open', now());

insert into public.intro_requests (id, job_id, seeker_id)
values ('bbbb3333-0000-0000-0000-000000000001','bbbb2222-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000003');

insert into public.vouches (intro_request_id, voucher_id, relationship, body)
values ('bbbb3333-0000-0000-0000-000000000001','bbbb0000-0000-0000-0000-000000000002','knows_personally',
        repeat('I worked alongside them and would again, without hesitation. ',4));

insert into public.hires (application_id, start_date, confirmed_by_employer_at)
select id, current_date - 61, now() from public.applications where job_id = 'bbbb2222-0000-0000-0000-000000000001';
update public.hires set confirmed_by_seeker_at = now()
 where application_id in (select id from public.applications where job_id = 'bbbb2222-0000-0000-0000-000000000001');
update public.employer_charges set status = 'paid', paid_at = now()
 where company_id = 'bbbb1111-0000-0000-0000-000000000001';

create table public.t_pay as
  select p.id as payout_id from public.payouts p
   where p.voucher_id = 'bbbb0000-0000-0000-0000-000000000002';
grant select on public.t_pay to authenticated;

do $$ begin
  if (select count(*) from public.t_pay) <> 1 then raise exception 'FAIL: fixture produced no payout'; end if;
  raise notice 'PASS: a confirmed hire with a paid fee produced one payout';
end $$;

-- --- 1. a new voucher profile cannot arrive with a payout account -----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, email) values ('bbbb0000-0000-0000-0000-000000000004','sneaky@payout.test');
insert into public.users (id, role, full_name, email)
values ('bbbb0000-0000-0000-0000-000000000004','voucher','Sneaky','sneaky@payout.test');

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbb0000-0000-0000-0000-000000000004';
  select must_fail(
    $$insert into public.voucher_profiles (user_id, company_id, payout_account_id, payouts_enabled)
      values ('bbbb0000-0000-0000-0000-000000000004','bbbb1111-0000-0000-0000-000000000001','acct_invented', true)$$,
    'a voucher profile created with a payout account already attached');
commit;

-- --- 2. nor can a voucher award themselves one afterwards -------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbb0000-0000-0000-0000-000000000002';
  select must_fail(
    $$update public.voucher_profiles set payout_account_id = 'acct_invented'
       where user_id = 'bbbb0000-0000-0000-0000-000000000002'$$,
    'a voucher naming their own payout account');
  select must_fail(
    $$update public.voucher_profiles set payouts_enabled = true
       where user_id = 'bbbb0000-0000-0000-0000-000000000002'$$,
    'a voucher switching on their own payouts');
  select must_fail(
    $$update public.voucher_profiles set identity_verified_at = now(), tax_info_collected_at = now()
       where user_id = 'bbbb0000-0000-0000-0000-000000000002'$$,
    'a voucher declaring their own identity verified');
  select must_fail(
    $$update public.voucher_profiles set payout_account_status = 'active'
       where user_id = 'bbbb0000-0000-0000-0000-000000000002'$$,
    'a voucher setting their account status to active');
commit;

do $$
declare vp record;
begin
  select payout_account_id, payouts_enabled, identity_verified_at, payout_account_status into vp
    from public.voucher_profiles where user_id = 'bbbb0000-0000-0000-0000-000000000002';
  if vp.payout_account_id is not null or vp.payouts_enabled
     or vp.identity_verified_at is not null or vp.payout_account_status <> 'none' then
    raise exception 'FAIL: the voucher changed their own payout state';
  end if;
  raise notice 'PASS: every payout field is still the platform''s to write';
end $$;

-- --- 3. releasing needs identity and tax ------------------------------------
select must_fail(
  $$update public.payouts set status = 'released', released_at = now()
     where id = (select payout_id from public.t_pay)$$,
  'releasing a payout before identity and tax are done');

update public.voucher_profiles
   set identity_verified_at = now(), tax_info_collected_at = now()
 where user_id = 'bbbb0000-0000-0000-0000-000000000002';

update public.payouts set status = 'released', released_at = now()
 where id = (select payout_id from public.t_pay);
do $$ begin raise notice 'PASS: with identity and tax done, the payout releases'; end $$;

-- --- 4. but PAYING needs somewhere to send it -------------------------------
-- Releasing says "this is owed and approved". Paying says "the money has
-- gone". Only the second needs an account Stripe will accept.
select must_fail(
  $$update public.payouts set status = 'paid', paid_at = now()
     where id = (select payout_id from public.t_pay)$$,
  'marking a payout paid with no payout account');

update public.voucher_profiles set payout_account_id = 'acct_test_platform_written'
 where user_id = 'bbbb0000-0000-0000-0000-000000000002';

select must_fail(
  $$update public.payouts set status = 'paid', paid_at = now()
     where id = (select payout_id from public.t_pay)$$,
  'marking a payout paid before Stripe enabled payouts on the account');

update public.voucher_profiles set payouts_enabled = true, payout_account_status = 'active'
 where user_id = 'bbbb0000-0000-0000-0000-000000000002';

update public.payouts set status = 'paid', paid_at = now(), stripe_transfer_id = 'tr_test'
 where id = (select payout_id from public.t_pay);

do $$
declare p record;
begin
  select status, stripe_transfer_id into p from public.payouts where id = (select payout_id from public.t_pay);
  if p.status <> 'paid' then raise exception 'FAIL: expected paid, got %', p.status; end if;
  raise notice 'PASS: identity + tax + a live payout account -> the money can be sent';
end $$;

-- --- 5. and a voucher still cannot touch the payout itself ------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbb0000-0000-0000-0000-000000000002';
  update public.payouts set amount_cents = 999999 where id = (select payout_id from public.t_pay);
commit;

do $$
declare n int;
begin
  select amount_cents into n from public.payouts where id = (select payout_id from public.t_pay);
  if n = 999999 then raise exception 'FAIL: a voucher rewrote what they were owed'; end if;
  raise notice 'PASS: a voucher cannot rewrite what they are owed (still % cents)', n;
end $$;

drop table public.t_pay;

do $$ begin raise notice '--- 90_voucher_payout_accounts.sql: all checks passed ---'; end $$;
