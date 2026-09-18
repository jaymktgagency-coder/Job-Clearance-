\set ON_ERROR_STOP on
-- ===========================================================================
-- A voucher reaching out first
--
-- The attack this file exists for: a verified voucher at one company browsing
-- and messaging seekers who never named them — which is the whole difference
-- between this feature and scraping. Plus the three smaller ones: approaching
-- somebody who has closed their door, answering on the seeker's behalf, and
-- reading an email address that was never on offer.
--
-- Everything below runs as an ordinary logged-in person. Running it as
-- postgres would prove nothing: every guard here deliberately trusts
-- service_role and postgres.
-- ===========================================================================

insert into auth.users (id, email) values
  ('aaaa0000-0000-0000-0000-000000000001','voucher-acme@example.test'),
  ('aaaa0000-0000-0000-0000-000000000002','voucher-rival@example.test'),
  ('aaaa0000-0000-0000-0000-000000000003','keen@example.test'),
  ('aaaa0000-0000-0000-0000-000000000004','closed@example.test'),
  ('aaaa0000-0000-0000-0000-000000000005','stranger@example.test');

insert into public.users (id, role, full_name, email) values
  ('aaaa0000-0000-0000-0000-000000000001','voucher','Acme Employee','voucher-acme@example.test'),
  ('aaaa0000-0000-0000-0000-000000000002','voucher','Rival Employee','voucher-rival@example.test'),
  ('aaaa0000-0000-0000-0000-000000000003','seeker','Keen Seeker','keen@example.test'),
  ('aaaa0000-0000-0000-0000-000000000004','seeker','Closed Seeker','closed@example.test'),
  ('aaaa0000-0000-0000-0000-000000000005','seeker','Uninterested Seeker','stranger@example.test');

insert into public.companies (id, name, slug) values
  ('aaaa1111-0000-0000-0000-000000000001','Acme','acme-outreach'),
  ('aaaa1111-0000-0000-0000-000000000002','Rival','rival-outreach');

-- Two verified vouchers, one at each company. The Acme one came in by work
-- email, the Rival one by employer invitation — both must behave identically,
-- because the invitation route is how businesses on Gmail get vouchers.
insert into public.voucher_profiles
  (user_id, company_id, job_title, work_email, verification_method, status,
   verified_at, employer_permission_confirmed_at)
values
  ('aaaa0000-0000-0000-0000-000000000001','aaaa1111-0000-0000-0000-000000000001',
   'Shift lead','lead@acme.test','work_email','verified', now(), now()),
  ('aaaa0000-0000-0000-0000-000000000002','aaaa1111-0000-0000-0000-000000000002',
   'Manager', null,'employer_invite','verified', now(), now());

insert into public.seeker_profiles (user_id, headline, open_to_work) values
  ('aaaa0000-0000-0000-0000-000000000003','Barista of four years', true),
  ('aaaa0000-0000-0000-0000-000000000004','Also a barista',        false),  -- door closed
  ('aaaa0000-0000-0000-0000-000000000005','Never heard of Acme',   true);

-- Only the keen one and the closed one named Acme.
insert into public.seeker_company_interests (seeker_id, company_id) values
  ('aaaa0000-0000-0000-0000-000000000003','aaaa1111-0000-0000-0000-000000000001'),
  ('aaaa0000-0000-0000-0000-000000000004','aaaa1111-0000-0000-0000-000000000001');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --- 1. the match works when it should -------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';
  insert into public.voucher_outreach (id, voucher_id, seeker_id, company_id, message)
  values ('aaaa2222-0000-0000-0000-000000000001',
          'aaaa0000-0000-0000-0000-000000000001',
          'aaaa0000-0000-0000-0000-000000000003',
          'aaaa1111-0000-0000-0000-000000000002',   -- lies about the company
          'We are hiring baristas and your profile looks like a strong fit for our team.');
commit;

do $$
declare o record;
begin
  select company_id, status, responded_at into o
    from public.voucher_outreach where id = 'aaaa2222-0000-0000-0000-000000000001';
  if o.company_id <> 'aaaa1111-0000-0000-0000-000000000001' then
    raise exception 'FAIL: the voucher chose their own company_id (%)', o.company_id;
  end if;
  if o.status <> 'pending' or o.responded_at is not null then
    raise exception 'FAIL: an approach did not start unanswered (% / %)', o.status, o.responded_at;
  end if;
  raise notice 'PASS: a verified voucher reached a seeker who named their company, and the company was taken from the verification not the request';
end $$;

-- --- 2. THE MATCHING RULE: a seeker who never named you ---------------------
do $$
begin
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';
    insert into public.voucher_outreach (voucher_id, seeker_id, company_id, message)
    values ('aaaa0000-0000-0000-0000-000000000001',
            'aaaa0000-0000-0000-0000-000000000005',
            'aaaa1111-0000-0000-0000-000000000001',
            'You do not know me and never asked to, but I found you in a list somewhere.');
    reset role;
    raise exception 'FAIL: a voucher messaged a seeker who never named their company';
  exception
    when check_violation then reset role;
    when others then
      reset role;
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: a voucher cannot reach a seeker who never named their company';
end $$;

-- --- 3. a voucher at a DIFFERENT company cannot use somebody else's match ---
do $$
begin
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000002';
    insert into public.voucher_outreach (voucher_id, seeker_id, company_id, message)
    values ('aaaa0000-0000-0000-0000-000000000002',
            'aaaa0000-0000-0000-0000-000000000003',
            'aaaa1111-0000-0000-0000-000000000001',
            'I work at Rival, but this person expressed interest in Acme so I will write anyway.');
    reset role;
    raise exception 'FAIL: a voucher used another company''s interested seeker';
  exception
    when check_violation then reset role;
    when others then
      reset role;
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: interest in Acme does not expose you to employees of Rival';
end $$;

-- --- 4. open_to_work is a real door, not a label ----------------------------
do $$
begin
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';
    insert into public.voucher_outreach (voucher_id, seeker_id, company_id, message)
    values ('aaaa0000-0000-0000-0000-000000000001',
            'aaaa0000-0000-0000-0000-000000000004',
            'aaaa1111-0000-0000-0000-000000000001',
            'You named my company once, though you have since closed your door to approaches.');
    reset role;
    raise exception 'FAIL: a seeker who is not open to work was approached anyway';
  exception
    when check_violation then reset role;
    when others then
      reset role;
      if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: unticking "open to work" closes the door, even to a company you named';
end $$;

-- --- 5. the voucher cannot answer on the seeker's behalf --------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';
  update public.voucher_outreach
     set status = 'accepted', message = 'and I have rewritten what I said'
   where id = 'aaaa2222-0000-0000-0000-000000000001';
commit;

do $$
declare o record;
begin
  select status, message into o
    from public.voucher_outreach where id = 'aaaa2222-0000-0000-0000-000000000001';
  if o.status <> 'pending' then
    raise exception 'FAIL: the voucher accepted their own approach (status %)', o.status;
  end if;
  if o.message not like 'We are hiring baristas%' then
    raise exception 'FAIL: the voucher rewrote the message after sending it';
  end if;
  raise notice 'PASS: a voucher cannot accept on the seeker''s behalf, nor rewrite what they sent';
end $$;

-- --- 6. the seeker can, and that is final -----------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000003';
  update public.voucher_outreach set status = 'accepted'
   where id = 'aaaa2222-0000-0000-0000-000000000001';
commit;

-- ...and the voucher cannot then un-accept it by withdrawing.
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';
  update public.voucher_outreach set status = 'withdrawn'
   where id = 'aaaa2222-0000-0000-0000-000000000001';
commit;

do $$
declare o record;
begin
  select status, responded_at into o
    from public.voucher_outreach where id = 'aaaa2222-0000-0000-0000-000000000001';
  if o.status <> 'accepted' then
    raise exception 'FAIL: an answered approach was changed afterwards (now %)', o.status;
  end if;
  if o.responded_at is null then
    raise exception 'FAIL: answering did not record when';
  end if;
  raise notice 'PASS: the seeker answers, the answer is stamped, and it is final';
end $$;

-- --- 7. the browse list shows the right people, and no more ----------------
do $$
declare
  v_rows  int;
  v_names text;
  v_cols  text[];
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';

  select count(*), string_agg(full_name, ', ' order by full_name)
    into v_rows, v_names
    from public.seekers_interested_in_my_company();
  reset role;

  -- Keen only: the closed one is filtered by open_to_work, the stranger never
  -- named Acme.
  if v_rows <> 1 or v_names <> 'Keen Seeker' then
    raise exception 'FAIL: the browse list returned % row(s): %', v_rows, v_names;
  end if;

  -- The column list IS the privacy rule, so it is asserted rather than
  -- trusted.
  --
  -- Read from pg_proc, NOT information_schema.columns: a function's return
  -- columns are not in information_schema at all, so the obvious version of
  -- this check passes whatever the function returns. It was written that way
  -- first and only caught by deliberately leaking `email` to see the test
  -- fail — which it did not.
  --
  -- Asserted as the WHOLE expected list rather than a blocklist of bad names,
  -- so a column nobody thought to ban (a phone number, a date of birth) also
  -- trips it. Adding a column here is a deliberate act with a test to change.
  select array_agg(name order by name) into v_cols
    from unnest((
      select proargnames from pg_proc
       where proname = 'seekers_interested_in_my_company'
         and pronamespace = 'public'::regnamespace
    )) as name;

  if v_cols is distinct from array[
       'avatar_url','desired_titles','full_name','headline','interested_at',
       'location','note','outreach_id','outreach_sent_at','outreach_status',
       'seeker_id','skills','years_experience'
     ]::text[] then
    raise exception 'FAIL: the browse list no longer returns exactly the agreed columns. Got: %', v_cols;
  end if;

  raise notice 'PASS: the list shows only the matched, open seeker — and carries no email, resume or bio';
end $$;

-- --- 8. a voucher at a rival company sees nobody ----------------------------
do $$
declare v_rows int;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000002';
  select count(*) into v_rows from public.seekers_interested_in_my_company();
  reset role;

  if v_rows <> 0 then
    raise exception 'FAIL: a voucher at Rival saw % of Acme''s interested seekers', v_rows;
  end if;
  raise notice 'PASS: a voucher sees only their own company''s interested seekers';
end $$;

-- --- 9. the email address is still not reachable the ordinary way ----------
-- The function hides it; this checks the table underneath does too, so the
-- function is the only door rather than merely the easiest one.
do $$
declare v_seen int;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000001';
  -- Interest alone must not make the seeker's row readable. (Once they have
  -- ACCEPTED and asked for an intro, the 0002 policy applies and it does —
  -- by then they have chosen this person.)
  select count(*) into v_seen from public.users
   where id = 'aaaa0000-0000-0000-0000-000000000003';
  reset role;

  if v_seen <> 0 then
    raise exception 'FAIL: a voucher read the seeker''s users row, email and all, on interest alone';
  end if;
  raise notice 'PASS: interest alone does not expose the seeker''s email address';
end $$;

-- --- 10. provenance cannot be claimed --------------------------------------
do $$
declare v_loc uuid; v_job uuid; v_src uuid;
begin
  insert into public.locations (company_id, label, city)
  values ('aaaa1111-0000-0000-0000-000000000001','Main','Austin') returning id into v_loc;
  insert into public.jobs
    (company_id, location_id, title, description, pay_type, status,
     fee_tier, fee_amount_cents, voucher_share_bps)
  values ('aaaa1111-0000-0000-0000-000000000001', v_loc,'Barista','Make coffee well',
          'hourly','open','tier_1',50000,5000) returning id into v_job;

  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaa0000-0000-0000-0000-000000000005';
  -- A seeker nobody approached, claiming somebody else's accepted approach.
  insert into public.intro_requests (job_id, seeker_id, message, source_outreach_id)
  values (v_job, 'aaaa0000-0000-0000-0000-000000000005','Please vouch for me',
          'aaaa2222-0000-0000-0000-000000000001')
  returning source_outreach_id into v_src;
  reset role;

  if v_src is not null then
    raise exception 'FAIL: a seeker claimed an approach that was never made to them';
  end if;
  raise notice 'PASS: a request cannot claim to have come from somebody else''s approach';
end $$;

do $$ begin raise notice '--- 96_voucher_outreach.sql: all checks passed ---'; end $$;
