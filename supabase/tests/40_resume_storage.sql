\set ON_ERROR_STOP on
-- Who can read a resume file. Runs after 10 and 20.

-- Two seekers with resumes: one who asked for a vouch at Acme (seeker 3333),
-- and one who has nothing to do with Acme at all.
insert into auth.users (id, email) values
  ('aaaa1111-0000-0000-0000-000000000001','stranger@seeker.test') on conflict do nothing;
insert into public.users (id, role, full_name, email) values
  ('aaaa1111-0000-0000-0000-000000000001','seeker','Unrelated Stranger','stranger@seeker.test') on conflict do nothing;
insert into public.seeker_profiles (user_id, headline) values
  ('aaaa1111-0000-0000-0000-000000000001','Nothing to do with Acme') on conflict do nothing;

insert into storage.objects (bucket_id, name) values
  ('resumes', '33333333-3333-3333-3333-333333333333/resume.pdf'),
  ('resumes', 'aaaa1111-0000-0000-0000-000000000001/resume.pdf');

grant usage on schema public, storage to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

-- the bucket must not be public
do $$
begin
  if (select public from storage.buckets where id='resumes') is not false then
    raise exception 'FAIL: the resumes bucket is public';
  end if;
  raise notice 'PASS: the resume bucket is private — no shareable URLs';
end $$;

-- the seeker themselves
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  declare mine int; others int;
  begin
    select count(*) into mine from storage.objects where name like '33333333%';
    select count(*) into others from storage.objects where name not like '33333333%';
    if mine <> 1 then raise exception 'FAIL: a seeker cannot see their own resume'; end if;
    if others <> 0 then raise exception 'FAIL: a seeker can see % other resumes', others; end if;
    raise notice 'PASS: a seeker sees their own resume and no one else''s';
  end $$;
commit;

-- a verified voucher at the company the seeker applied to
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare requester int; stranger int;
  begin
    select count(*) into requester from storage.objects where name like '33333333%';
    select count(*) into stranger from storage.objects where name like 'aaaa1111%';
    if requester <> 1 then raise exception 'FAIL: the voucher cannot read the resume of someone who asked them'; end if;
    if stranger <> 0 then raise exception 'FAIL: the voucher can read an unrelated seeker resume'; end if;
    raise notice 'PASS: a verified voucher reads the resume of someone who asked at their company — and no others';
  end $$;
commit;

-- a verified voucher at a DIFFERENT company
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
  do $$
  declare n int;
  begin
    select count(*) into n from storage.objects;
    if n <> 0 then raise exception 'FAIL: a voucher at another company can read % resumes', n; end if;
    raise notice 'PASS: a voucher at a different company reads 0 resumes';
  end $$;
commit;

-- an unverified voucher at the right company
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
  do $$
  declare n int;
  begin
    select count(*) into n from storage.objects;
    if n <> 0 then raise exception 'FAIL: an unverified voucher can read % resumes', n; end if;
    raise notice 'PASS: an UNVERIFIED voucher reads 0 resumes, even at the right company';
  end $$;
commit;

-- the employer whose job the seeker was vouched for
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare candidate int; stranger int;
  begin
    select count(*) into candidate from storage.objects where name like '33333333%';
    select count(*) into stranger from storage.objects where name like 'aaaa1111%';
    if candidate <> 1 then raise exception 'FAIL: the employer cannot read their vouched candidate resume'; end if;
    if stranger <> 0 then raise exception 'FAIL: the employer can read an unrelated resume'; end if;
    raise notice 'PASS: an employer reads the resume of a vouched candidate for their own job — and no others';
  end $$;
commit;

-- nobody can write into someone else's folder
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  begin
    begin
      insert into storage.objects (bucket_id, name)
      values ('resumes', 'aaaa1111-0000-0000-0000-000000000001/fake.pdf');
      raise exception 'FAIL: a seeker wrote into someone else''s folder';
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'PASS (rejected): writing a file into another person''s folder';
    end;
  end $$;
rollback;

-- deleting your own resume works — part of "delete my data"
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  declare n int;
  begin
    delete from storage.objects where name like '33333333%';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'FAIL: a seeker could not delete their own resume'; end if;
    raise notice 'PASS: a seeker can delete their own resume';
  end $$;
rollback;
