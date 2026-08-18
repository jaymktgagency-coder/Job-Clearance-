\set ON_ERROR_STOP on
-- More seekers and jobs so one voucher can reach the cap of 5.
insert into auth.users (id, email)
select ('66666666-0000-0000-0000-00000000000'||g)::uuid, 'seeker'||g||'@test.test' from generate_series(1,6) g;
insert into public.users (id, role, full_name, email)
select ('66666666-0000-0000-0000-00000000000'||g)::uuid,'seeker','Seeker '||g,'seeker'||g||'@test.test' from generate_series(1,6) g;
insert into public.seeker_profiles (user_id, headline)
select ('66666666-0000-0000-0000-00000000000'||g)::uuid, 'Headline '||g from generate_series(1,6) g;

insert into public.jobs (id, company_id, title, description, pay_type, status, posted_at)
select ('77777777-0000-0000-0000-00000000000'||g)::uuid,'aaaaaaaa-0000-0000-0000-000000000001',
       'Cap job '||g,'Role.','hourly','open',now() from generate_series(1,6) g;

insert into public.intro_requests (id, job_id, seeker_id)
select ('88888888-0000-0000-0000-00000000000'||g)::uuid,
       ('77777777-0000-0000-0000-00000000000'||g)::uuid,
       ('66666666-0000-0000-0000-00000000000'||g)::uuid
from generate_series(1,6) g;

-- --- voucher cap of 5 open vouches -----------------------------------------
insert into public.vouches (intro_request_id, voucher_id, relationship, body)
select ('88888888-0000-0000-0000-00000000000'||g)::uuid,'22222222-2222-2222-2222-222222222222',
       'reviewed_profile_only', repeat('Careful written assessment of this candidate. ',5)
from generate_series(1,4) g;
do $$ begin raise notice 'PASS: 4 more open vouches accepted (5 total with the earlier one)'; end $$;

select must_fail($$insert into public.vouches (intro_request_id, voucher_id, relationship, body)
  values ('88888888-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','knows_personally',
          repeat('Worked with them directly for two years. ',6))$$,
  'a 6th open vouch from one voucher');

-- resolving one (passed) should free a slot
update public.applications set status='passed', last_status_changed_by='11111111-1111-1111-1111-111111111111'
 where vouch_id = (select id from public.vouches where intro_request_id='88888888-0000-0000-0000-000000000001');
insert into public.vouches (intro_request_id, voucher_id, relationship, body)
values ('88888888-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','knows_personally',
        repeat('Worked with them directly for two years. ',6));
do $$ begin raise notice 'PASS: resolving a candidate frees a vouch slot'; end $$;


-- Give Other Corp a request of its own, so "sees only their own" is a real test.
insert into public.intro_requests (id, job_id, seeker_id)
values ('99999999-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','66666666-0000-0000-0000-000000000006')
on conflict do nothing;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---- Acme voucher ----------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  do $$
  declare mine int; foreign_n int;
  begin
    select count(*) into mine from public.intro_requests;
    select count(*) into foreign_n from public.intro_requests ir join public.jobs j on j.id=ir.job_id
      where j.company_id <> 'aaaaaaaa-0000-0000-0000-000000000001';
    if mine = 0 then raise exception 'FAIL: Acme voucher sees nothing'; end if;
    if foreign_n <> 0 then raise exception 'FAIL: Acme voucher sees % other-company requests', foreign_n; end if;
    raise notice 'PASS: Acme voucher sees % requests, 0 from other companies', mine;
  end $$;
commit;

-- ---- Other Corp voucher ----------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
  do $$
  declare acme int; own int; resumes int;
  begin
    select count(*) into acme from public.intro_requests ir join public.jobs j on j.id=ir.job_id
      where j.company_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    select count(*) into own from public.intro_requests;
    select count(*) into resumes from public.seeker_profiles;
    if acme <> 0 then raise exception 'FAIL: Other Corp voucher sees % Acme requests', acme; end if;
    if own <> 1 then raise exception 'FAIL: Other Corp voucher should see exactly its own 1 request, sees %', own; end if;
    if resumes <> 1 then raise exception 'FAIL: Other Corp voucher sees % resumes (should be only its own requester)', resumes; end if;
    raise notice 'PASS: Other Corp voucher sees only its own 1 request and 1 profile, 0 from Acme';
  end $$;
commit;

-- ---- unverified voucher ----------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
  do $$
  declare n int;
  begin
    select count(*) into n from public.intro_requests;
    if n <> 0 then raise exception 'FAIL: unverified voucher sees % requests', n; end if;
    raise notice 'PASS: unverified voucher sees nothing at all';
  end $$;
commit;

-- ---- seeker ----------------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '66666666-0000-0000-0000-000000000002';
  do $$
  declare own int; others int; reqs int;
  begin
    select count(*) into own from public.seeker_profiles where user_id='66666666-0000-0000-0000-000000000002';
    select count(*) into others from public.seeker_profiles where user_id<>'66666666-0000-0000-0000-000000000002';
    select count(*) into reqs from public.intro_requests where seeker_id<>'66666666-0000-0000-0000-000000000002';
    if own <> 1 then raise exception 'FAIL: seeker cannot see own profile'; end if;
    if others <> 0 then raise exception 'FAIL: seeker can read % other resumes', others; end if;
    if reqs <> 0 then raise exception 'FAIL: seeker can read % other seekers'' requests', reqs; end if;
    raise notice 'PASS: seeker sees only their own profile and requests';
  end $$;
commit;

-- ---- Acme employer ---------------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
  do $$
  declare apps int; foreign_apps int; rel text; fee int; unvouched int;
  begin
    select count(*) into apps from public.applications;
    select count(*) into foreign_apps from public.applications a join public.jobs j on j.id=a.job_id
      where j.company_id <> 'aaaaaaaa-0000-0000-0000-000000000001';
    if apps = 0 then raise exception 'FAIL: employer sees no candidates'; end if;
    if foreign_apps <> 0 then raise exception 'FAIL: employer sees other-company candidates'; end if;
    -- every application must carry a vouch
    select count(*) into unvouched from public.applications where vouch_id is null;
    if unvouched <> 0 then raise exception 'FAIL: % candidates without a vouch', unvouched; end if;
    select v.relationship::text, v.disclosed_fee_cents into rel, fee from public.vouches v limit 1;
    if rel is null or fee is null then raise exception 'FAIL: vouch label or fee disclosure not visible'; end if;
    raise notice 'PASS: employer sees % vouched candidates (0 foreign, 0 unvouched); vouch labelled "%" with $% disclosed', apps, rel, fee/100;
  end $$;
commit;

-- ---- verification codes ----------------------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
  do $$
  declare n int;
  begin
    select count(*) into n from public.email_verifications;
    if n <> 0 then raise exception 'FAIL: verification codes readable'; end if;
    raise notice 'PASS: verification codes invisible to every logged-in user';
  end $$;
commit;

-- ---- a voucher must not be able to verify themselves ----------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
  do $$
  begin
    begin
      update public.voucher_profiles set status='verified', verified_at=now(),
             employer_permission_confirmed_at=now()
       where user_id='44444444-4444-4444-4444-444444444444';
      raise exception 'FAIL: a voucher verified themselves';
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'PASS (rejected): a voucher marking themselves verified -> %', left(sqlerrm, 80);
    end;
  end $$;
commit;

-- and they still cannot vouch
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
  do $$
  declare s public.voucher_status;
  begin
    select status into s from public.voucher_profiles where user_id='44444444-4444-4444-4444-444444444444';
    if s <> 'unverified' then raise exception 'FAIL: status is now %', s; end if;
    raise notice 'PASS: they are still unverified afterwards';
  end $$;
commit;
