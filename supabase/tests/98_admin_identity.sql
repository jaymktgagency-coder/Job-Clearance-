-- ---------------------------------------------------------------------------
-- 98_admin_identity.sql — why the admin gate keys on the auth user id and not
-- on an email address.
--
-- This file is unusual: the other suites prove a hole is CLOSED. This one
-- pins open a fact about the schema that a piece of application code depends
-- on, so that nobody re-opens the question by accident.
--
-- THE FACT: `users_update_self` is an UPDATE policy with no column
-- restriction, so a logged-in person may rewrite any column of their own
-- `public.users` row — `email` and `role` included. There is no guard on
-- either. That is a reasonable design for a profile row, but it means those
-- two columns are SELF-REPORTED, and cannot carry a privilege.
--
-- WHAT DEPENDS ON IT: src/lib/admin.ts gates /admin/payouts — the screen that
-- sends vouchers real money — on ADMIN_USER_IDS, a list of Supabase AUTH user
-- ids. It deliberately does not read `public.users.email`. If it did, anybody
-- with a login could set their email to the founder's and pay themselves.
--
-- IF THIS FILE EVER FAILS, that is good news, not a broken test: somebody has
-- added a guard making these columns trustworthy. Read that guard, then
-- decide whether the admin gate could be simplified — do not simply delete
-- these checks.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aa000000-0000-0000-0000-00000000ad01','founder@vouch.test'),
  ('aa000000-0000-0000-0000-00000000ad02','stranger@example.com');

insert into public.users (id, role, full_name, email) values
  ('aa000000-0000-0000-0000-00000000ad01','employer','The Founder','founder@vouch.test'),
  ('aa000000-0000-0000-0000-00000000ad02','seeker','A Stranger','stranger@example.com');

-- --- 1. a seeker rewrites their own email to the founder's ------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'aa000000-0000-0000-0000-00000000ad02';
  update public.users
     set email = 'founder@vouch.test'
   where id = 'aa000000-0000-0000-0000-00000000ad02';
commit;

do $$
declare e text;
begin
  select email into e from public.users where id = 'aa000000-0000-0000-0000-00000000ad02';
  if e = 'founder@vouch.test' then
    raise notice 'PASS: public.users.email is self-written, so it cannot carry a privilege — the admin gate must not read it';
  else
    raise exception 'FAIL: public.users.email is now guarded (value: %). Re-read src/lib/admin.ts before changing anything', e;
  end if;
end $$;

-- --- 2. and role, the other column somebody might reach for -----------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'aa000000-0000-0000-0000-00000000ad02';
  update public.users
     set role = 'employer'
   where id = 'aa000000-0000-0000-0000-00000000ad02';
commit;

do $$
declare r text;
begin
  select role::text into r from public.users where id = 'aa000000-0000-0000-0000-00000000ad02';
  if r = 'employer' then
    raise notice 'PASS: public.users.role is self-written too — "admin" could never have been a fourth role value';
  else
    raise exception 'FAIL: public.users.role is now guarded (value: %). Re-read src/lib/admin.ts before changing anything', r;
  end if;
end $$;

-- --- 3. the login itself was NOT touched ------------------------------------
-- The attack above rewrote the profile row and left auth.users alone. That is
-- the whole reason the gate reads the auth user id: it is the subject of a
-- signed JWT, and nothing a login can write reaches it.
do $$
declare a text;
begin
  select email into a from auth.users where id = 'aa000000-0000-0000-0000-00000000ad02';
  if a = 'stranger@example.com' then
    raise notice 'PASS: auth.users survived the same attack untouched — the auth id is the only identity here';
  else
    raise exception 'FAIL: auth.users.email changed to %, which should not be reachable from a profile update', a;
  end if;
end $$;

-- --- 4. payouts still have no UPDATE policy for a login ---------------------
-- The admin screen writes payouts through the service key. That is only safe
-- while an ordinary login cannot write them at all.
do $$
declare n int;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public' and tablename = 'payouts' and cmd = 'UPDATE';
  if n = 0 then
    raise notice 'PASS: payouts still have 0 UPDATE policies — no login can move money, admin screen or not';
  else
    raise exception 'FAIL: % UPDATE policy/policies now exist on payouts. Money must not be writable from a login', n;
  end if;
end $$;
