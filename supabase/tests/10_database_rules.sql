\set ON_ERROR_STOP on
-- helper to assert an operation fails
create or replace function must_fail(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % was allowed but should have been rejected', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'PASS (rejected): % -> %', label, left(sqlerrm, 90);
end $$;

-- --- fixtures --------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','employer@acme.test'),
  ('22222222-2222-2222-2222-222222222222','voucher@acme.test'),
  ('33333333-3333-3333-3333-333333333333','seeker@test.test'),
  ('44444444-4444-4444-4444-444444444444','unverified@acme.test'),
  ('55555555-5555-5555-5555-555555555555','voucher@other.test');

insert into public.users (id, role, full_name, email) values
  ('11111111-1111-1111-1111-111111111111','employer','Erin Employer','employer@acme.test'),
  ('22222222-2222-2222-2222-222222222222','voucher','Vic Voucher','voucher@acme.test'),
  ('33333333-3333-3333-3333-333333333333','seeker','Sam Seeker','seeker@test.test'),
  ('44444444-4444-4444-4444-444444444444','voucher','Uma Unverified','unverified@acme.test'),
  ('55555555-5555-5555-5555-555555555555','voucher','Otto Other','voucher@other.test');

insert into public.seeker_profiles (user_id, headline) values
  ('33333333-3333-3333-3333-333333333333','Barista, 4 years');

insert into public.companies (id, name, slug, domain_verified_at, payment_method_on_file) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Acme Coffee','acme-coffee', now(), true),
  ('aaaaaaaa-0000-0000-0000-000000000002','Other Corp','other-corp', null, false);

insert into public.locations (id, company_id, label) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Downtown');

insert into public.company_members (company_id, user_id, member_role) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','owner');

insert into public.voucher_profiles (user_id, company_id, location_id, status, verification_method, verified_at, employer_permission_confirmed_at) values
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','verified','work_email', now(), now()),
  ('55555555-5555-5555-5555-555555555555','aaaaaaaa-0000-0000-0000-000000000002',null,'verified','work_email', now(), now());
insert into public.voucher_profiles (user_id, company_id, status) values
  ('44444444-4444-4444-4444-444444444444','aaaaaaaa-0000-0000-0000-000000000001','unverified');

-- --- 1. company verification --------------------------------------------
-- The two-tier badge (Verified Business / Verified Domain) arrived in Step 2b
-- and is covered end to end in 30_money_and_reputation.sql. Nothing to check
-- here beyond the companies existing.
do $$
begin
  if (select count(*) from public.companies) < 2 then
    raise exception 'FAIL: fixture companies missing';
  end if;
  raise notice 'PASS: fixture companies created';
end $$;

-- --- 2. fee tier derived from pay type, amounts from settings ---------------
insert into public.jobs (id, company_id, location_id, posted_by, title, description, pay_type, status, posted_at)
values ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111','Barista','Make coffee.','hourly','open', now()),
       ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',null,
        '11111111-1111-1111-1111-111111111111','Store Manager','Run the store.','salaried','open', now()),
       ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002',null,
        null,'Analyst','Analyse.','salaried','open', now());
do $$
declare t1 record; t2 record;
begin
  select fee_tier, fee_amount_cents, voucher_share_bps into t1 from public.jobs where title='Barista';
  select fee_tier, fee_amount_cents, voucher_share_bps into t2 from public.jobs where title='Store Manager';
  if t1.fee_tier <> 'tier_1' or t1.fee_amount_cents <> 50000 then raise exception 'FAIL: hourly job got % / %', t1.fee_tier, t1.fee_amount_cents; end if;
  if t2.fee_tier <> 'tier_2' or t2.fee_amount_cents <> 200000 then raise exception 'FAIL: salaried job got % / %', t2.fee_tier, t2.fee_amount_cents; end if;
  if t1.voucher_share_bps <> 5000 then raise exception 'FAIL: voucher share not 50%%'; end if;
  raise notice 'PASS: hourly -> tier_1 $500, salaried -> tier_2 $2000, voucher share 50%%';
end $$;

-- --- 3. posted fees are frozen ---------------------------------------------
select must_fail($$update public.jobs set fee_amount_cents = 1 where title='Barista'$$,
                 'changing the fee on a posted job');

-- --- 4. seeker cap of 5 open intro requests ---------------------------------
insert into public.jobs (id, company_id, title, description, pay_type, status, posted_at)
select ('dddddddd-0000-0000-0000-00000000000'||g)::uuid,'aaaaaaaa-0000-0000-0000-000000000001',
       'Filler '||g,'Filler role.','hourly','open',now() from generate_series(1,6) g;
insert into public.intro_requests (job_id, seeker_id)
select ('dddddddd-0000-0000-0000-00000000000'||g)::uuid,'33333333-3333-3333-3333-333333333333'
from generate_series(1,5) g;
select must_fail($$insert into public.intro_requests (job_id, seeker_id)
                   values ('dddddddd-0000-0000-0000-000000000006','33333333-3333-3333-3333-333333333333')$$,
                 'a 6th open intro request for one seeker');

-- --- 5. vouch eligibility ---------------------------------------------------
-- free a slot: withdrawing a request must let the seeker ask again
update public.intro_requests set status='withdrawn'
 where job_id='dddddddd-0000-0000-0000-000000000001' and seeker_id='33333333-3333-3333-3333-333333333333';
do $$ begin raise notice 'PASS: withdrawing a request frees a slot under the cap'; end $$;

insert into public.intro_requests (id, job_id, seeker_id)
values ('eeeeeeee-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333');

select must_fail($$insert into public.vouches (intro_request_id, voucher_id, relationship, body)
  values ('eeeeeeee-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','reviewed_profile_only', repeat('x',200))$$,
  'an UNVERIFIED voucher writing a vouch');

select must_fail($$insert into public.vouches (intro_request_id, voucher_id, relationship, body)
  values ('eeeeeeee-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555','reviewed_profile_only', repeat('x',200))$$,
  'a voucher vouching at a company they do not work for');

select must_fail($$insert into public.vouches (intro_request_id, voucher_id, relationship, body)
  values ('eeeeeeee-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','reviewed_profile_only','too short')$$,
  'a one-line, low-effort vouch');

-- --- 6. a good vouch creates the application and disclosed fee --------------
insert into public.vouches (intro_request_id, voucher_id, relationship, body)
values ('eeeeeeee-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','reviewed_profile_only',
        repeat('I reviewed this profile carefully and think they are worth an interview. ', 4));
do $$
declare v record; a record; r record;
begin
  select * into v from public.vouches where intro_request_id='eeeeeeee-0000-0000-0000-000000000001';
  select * into a from public.applications where vouch_id = v.id;
  select * into r from public.intro_requests where id='eeeeeeee-0000-0000-0000-000000000001';
  if a.id is null then raise exception 'FAIL: no application was created'; end if;
  if r.status <> 'vouched' or r.claimed_by is null then raise exception 'FAIL: request not marked vouched'; end if;
  if v.disclosed_fee_cents <> 25000 then raise exception 'FAIL: disclosed fee is % (expected 25000)', v.disclosed_fee_cents; end if;
  if v.job_id <> 'cccccccc-0000-0000-0000-000000000001' then raise exception 'FAIL: job not copied from request'; end if;
  raise notice 'PASS: vouch created application, closed the request, disclosed $250 to the employer';
end $$;

-- --- 7. AI score can never be stored without reasoning ----------------------
select must_fail($$update public.applications set ai_fit_score = 88 where ai_fit_score is null$$,
                 'an AI score with no written reasoning');
update public.applications set ai_fit_score = 88, ai_reasoning = 'Strong overlap on shift work.', ai_scored_at = now();
do $$ begin raise notice 'PASS: score + reasoning together is accepted'; end $$;

-- --- 8. status changes are logged with the human who made them --------------
update public.applications set status='interviewed', last_status_changed_by='11111111-1111-1111-1111-111111111111';
do $$
declare n int;
begin
  select count(*) into n from public.application_events;
  if n < 2 then raise exception 'FAIL: expected an event for creation and for the status change, got %', n; end if;
  if not exists (select 1 from public.application_events where to_status='interviewed' and changed_by is not null)
    then raise exception 'FAIL: status change not attributed to a human'; end if;
  raise notice 'PASS: % status events logged, attributed to a person', n;
end $$;

-- --- 9. verified voucher must have affirmed employer permission -------------
select must_fail($$insert into public.voucher_profiles (user_id, company_id, status, verification_method, verified_at)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','verified','work_email', now())$$,
  'a verified voucher who never affirmed their employer permits it');
