\set ON_ERROR_STOP on
-- ===========================================================================
-- Badges, claimed domains, and payment methods
--
-- The attack this file exists for: a stranger signs up, creates a company
-- called "Starbucks", claims starbucks.com, and awards themselves the
-- Verified Domain badge. That worked before migration 0010.
-- ===========================================================================

insert into auth.users (id, email) values
  ('eeeeeeee-0000-0000-0000-000000000001','stranger@example.test');
insert into public.users (id, role, full_name, email) values
  ('eeeeeeee-0000-0000-0000-000000000001','employer','A Stranger','stranger@example.test');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --- 1. a new company starts with nothing proven ----------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';

  insert into public.companies
    (id, name, slug, payment_method_on_file, domain_verified_at, business_registration_verified_at)
  values ('eeeeeeee-1111-0000-0000-000000000001','Starbucks','starbucks-fake',
          true, now(), now());
  insert into public.company_members (company_id, user_id, member_role)
  values ('eeeeeeee-1111-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001','owner');
commit;

do $$
declare c record;
begin
  select verification_tier, payment_method_on_file, domain_verified_at,
         business_registration_verified_at
    into c from public.companies where id = 'eeeeeeee-1111-0000-0000-000000000001';
  if c.verification_tier <> 'none' then
    raise exception 'FAIL: a brand new company awarded itself "%"', c.verification_tier;
  end if;
  if c.payment_method_on_file or c.domain_verified_at is not null
     or c.business_registration_verified_at is not null then
    raise exception 'FAIL: verification fields were accepted at creation';
  end if;
  raise notice 'PASS: a new company starts unverified, whatever it claims about itself';
end $$;

-- --- 2. nor can it promote itself afterwards --------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';
  update public.companies
     set payment_method_on_file = true,
         business_registration_verified_at = now(),
         domain_verified_at = now(),
         stripe_customer_id = 'cus_madeup',
         default_payment_method_id = 'pm_madeup',
         description = 'We roast coffee.'
   where id = 'eeeeeeee-1111-0000-0000-000000000001';
commit;

do $$
declare c record;
begin
  select verification_tier, stripe_customer_id, default_payment_method_id, description
    into c from public.companies where id = 'eeeeeeee-1111-0000-0000-000000000001';
  if c.verification_tier <> 'none' then
    raise exception 'FAIL: the company promoted itself to "%"', c.verification_tier;
  end if;
  if c.stripe_customer_id is not null or c.default_payment_method_id is not null then
    raise exception 'FAIL: it invented its own Stripe identifiers';
  end if;
  if c.description <> 'We roast coffee.' then
    raise exception 'FAIL: a legitimate edit to the description was lost';
  end if;
  raise notice 'PASS: badges and Stripe ids discarded, the real edit kept';
end $$;

-- --- 3. claiming a domain is allowed; it just proves nothing -----------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000001';
  insert into public.company_domains (company_id, domain, verified_at)
  values ('eeeeeeee-1111-0000-0000-000000000001','starbucks.com', now());
commit;

do $$
declare d record; c record;
begin
  select verified_at, claimed_by into d
    from public.company_domains where domain = 'starbucks.com';
  select verification_tier into c
    from public.companies where id = 'eeeeeeee-1111-0000-0000-000000000001';
  if d.verified_at is not null then
    raise exception 'FAIL: the claimant marked their own domain proven';
  end if;
  if d.claimed_by <> 'eeeeeeee-0000-0000-0000-000000000001' then
    raise exception 'FAIL: the claim was not recorded against whoever made it';
  end if;
  if c.verification_tier <> 'none' then
    raise exception 'FAIL: an unproven claim moved the badge to "%"', c.verification_tier;
  end if;
  raise notice 'PASS: domain claimed but unproven -> no badge, and it unlocks nothing';
end $$;

-- --- 4. Vouch proving it is what moves the badge ------------------------------
update public.companies
   set payment_method_on_file = true, business_registration_verified_at = now()
 where id = 'eeeeeeee-1111-0000-0000-000000000001';
update public.company_domains set verified_at = now() where domain = 'starbucks.com';

do $$
declare c record;
begin
  select verification_tier, domain_verified_at into c
    from public.companies where id = 'eeeeeeee-1111-0000-0000-000000000001';
  if c.domain_verified_at is null then
    raise exception 'FAIL: proving the domain did not reach the company row';
  end if;
  if c.verification_tier <> 'domain' then
    raise exception 'FAIL: expected the domain badge, got "%"', c.verification_tier;
  end if;
  raise notice 'PASS: Vouch proving the domain is what earns the badge';
end $$;

-- --- 5. and removing the proof takes the badge away again ---------------------
delete from public.company_domains where domain = 'starbucks.com';

do $$
declare c record;
begin
  select verification_tier into c
    from public.companies where id = 'eeeeeeee-1111-0000-0000-000000000001';
  if c.verification_tier <> 'business' then
    raise exception 'FAIL: badge stayed at "%" after the proven domain went away', c.verification_tier;
  end if;
  raise notice 'PASS: the last proven domain removed -> back to Verified Business';
end $$;

do $$ begin raise notice '--- 70_company_trust.sql: all checks passed ---'; end $$;
