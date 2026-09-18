\set ON_ERROR_STOP on
-- ===========================================================================
-- Profile pictures, and the Category filter
--
-- Two questions this file exists to answer, both asked as an ordinary logged
-- in person rather than as postgres:
--
--   * a picture is a thing you say about yourself, so setting your own is
--     allowed and setting somebody else's is not;
--   * a category is a thing the PLATFORM says, the same way the fee is. An
--     employer may put their job in one, and may not invent one.
-- ===========================================================================

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001','vain@example.test'),
  ('cccccccc-0000-0000-0000-000000000002','nosy@example.test');
insert into public.users (id, role, full_name, email) values
  ('cccccccc-0000-0000-0000-000000000001','employer','Vain Person','vain@example.test'),
  ('cccccccc-0000-0000-0000-000000000002','employer','Nosy Person','nosy@example.test');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --- 1. your own picture is yours to set ------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
  update public.users
     set avatar_url = 'https://example.test/avatars/mine.png'
   where id = 'cccccccc-0000-0000-0000-000000000001';
commit;

do $$
declare v text;
begin
  select avatar_url into v from public.users
   where id = 'cccccccc-0000-0000-0000-000000000001';
  if v is distinct from 'https://example.test/avatars/mine.png' then
    raise exception 'FAIL: a person could not set their own picture (got %)', v;
  end if;
  raise notice 'PASS: your own picture is yours to set';
end $$;

-- --- 2. somebody else's is not ----------------------------------------------
-- users_update_self restricts the rows you can see to update, so this does
-- not raise — it simply matches nothing. Either way the picture must not move.
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000002';
  update public.users
     set avatar_url = 'https://example.test/avatars/defaced.png'
   where id = 'cccccccc-0000-0000-0000-000000000001';
commit;

do $$
declare v text;
begin
  select avatar_url into v from public.users
   where id = 'cccccccc-0000-0000-0000-000000000001';
  if v <> 'https://example.test/avatars/mine.png' then
    raise exception 'FAIL: a stranger changed somebody else''s picture to %', v;
  end if;
  raise notice 'PASS: a stranger cannot change somebody else''s picture';
end $$;

-- --- 3. a logo is an edit; a badge is still not ------------------------------
-- The picture must land, and protect_company_trust must still discard the
-- verification fields smuggled alongside it in the same statement.
insert into public.companies (id, name, slug)
  values ('cccccccc-1111-0000-0000-000000000001','Picture Co','picture-co');
insert into public.company_members (company_id, user_id, member_role)
  values ('cccccccc-1111-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','owner');

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
  update public.companies
     set logo_url = 'https://example.test/avatars/logo.png',
         domain_verified_at = now(),
         payment_method_on_file = true
   where id = 'cccccccc-1111-0000-0000-000000000001';
commit;

do $$
declare c record;
begin
  select logo_url, verification_tier, domain_verified_at, payment_method_on_file
    into c from public.companies where id = 'cccccccc-1111-0000-0000-000000000001';
  if c.logo_url is distinct from 'https://example.test/avatars/logo.png' then
    raise exception 'FAIL: a company member could not set their own logo';
  end if;
  if c.verification_tier <> 'none'
     or c.domain_verified_at is not null
     or c.payment_method_on_file then
    raise exception 'FAIL: a badge rode in on the back of a logo upload (tier %)',
      c.verification_tier;
  end if;
  raise notice 'PASS: the logo landed, the badge smuggled beside it did not';
end $$;

-- --- 4. the category list is the platform's, not an employer's --------------
do $$
declare n_before int; n_after int;
begin
  select count(*) into n_before from public.job_categories;

  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';
    insert into public.job_categories (slug, label) values ('vip_roles','VIP roles');
    reset role;
    raise exception 'FAIL: an employer invented a category';
  exception
    when insufficient_privilege then reset role;  -- no insert policy: correct
    when others then
      reset role;
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  select count(*) into n_after from public.job_categories;
  if n_after <> n_before then
    raise exception 'FAIL: the category list grew by % row(s)', n_after - n_before;
  end if;
  raise notice 'PASS: an employer cannot invent a category';
end $$;

-- --- 5. nor can a job point at one that does not exist ----------------------
do $$
declare v_loc uuid;
begin
  insert into public.locations (company_id, label, city, region)
  values ('cccccccc-1111-0000-0000-000000000001','Main','Austin','TX')
  returning id into v_loc;

  begin
    insert into public.jobs
      (company_id, location_id, title, description, pay_type, status,
       fee_tier, fee_amount_cents, voucher_share_bps, category)
    values ('cccccccc-1111-0000-0000-000000000001', v_loc, 'Barista','Make coffee',
            'hourly','open','tier_1',50000,5000,'vip_roles');
    raise exception 'FAIL: a job was filed under a category that does not exist';
  exception
    when foreign_key_violation then null;  -- correct
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: a job cannot be filed under a made-up category';
end $$;

-- --- 6. a real category works, and null stays allowed -----------------------
do $$
declare v_loc uuid; v_cat text; v_null_ok boolean;
begin
  select id into v_loc from public.locations
   where company_id = 'cccccccc-1111-0000-0000-000000000001' limit 1;

  insert into public.jobs
    (company_id, location_id, title, description, pay_type, status,
     fee_tier, fee_amount_cents, voucher_share_bps, category)
  values ('cccccccc-1111-0000-0000-000000000001', v_loc, 'Barista','Make coffee',
          'hourly','open','tier_1',50000,5000,'food_service')
  returning category into v_cat;

  if v_cat <> 'food_service' then
    raise exception 'FAIL: a real category did not stick (got %)', v_cat;
  end if;

  -- Every job posted before today has no category. That has to remain legal,
  -- or this migration breaks every existing listing.
  insert into public.jobs
    (company_id, location_id, title, description, pay_type, status,
     fee_tier, fee_amount_cents, voucher_share_bps)
  values ('cccccccc-1111-0000-0000-000000000001', v_loc, 'Older role','Posted before categories existed',
          'hourly','open','tier_1',50000,5000)
  returning (category is null) into v_null_ok;

  if not v_null_ok then
    raise exception 'FAIL: an uncategorised job was not allowed';
  end if;
  raise notice 'PASS: a real category sticks, and an uncategorised job is still legal';
end $$;

do $$ begin raise notice '--- 95_pictures_and_categories.sql: all checks passed ---'; end $$;
