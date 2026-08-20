\set ON_ERROR_STOP on
-- ===========================================================================
-- Step 8 — proving the AI is advisory, in the database
--
-- Three claims are made in the README and on every screen a seeker sees.
-- These check that they are true of the database itself, not just of the app:
--
--   * a score can't be stored without its written reasoning
--   * a score can't move anyone — not even from our own server
--   * nobody with a login can write a score, or edit what we read from a resume
-- ===========================================================================

-- A candidate to work with: the first one a vouch created for an Acme role.
-- Kept in an ordinary table (not a temporary one) so the checks further down
-- can still read it after switching to an ordinary logged-in role.
create table public.t_app as
  select a.id
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where j.company_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and a.status = 'new'
  order by a.created_at
  limit 1;
grant select on public.t_app to authenticated;

do $$
begin
  if (select count(*) from public.t_app) <> 1 then
    raise exception 'FAIL: no candidate to test against — earlier fixtures did not run';
  end if;
  raise notice 'PASS: found a vouched candidate to score';
end $$;

-- --- 1. a score needs its reasoning ----------------------------------------
select must_fail(
  $$update public.applications set ai_fit_score = 88, ai_scored_at = now()
     where id = (select id from public.t_app)$$,
  'an AI score stored with no written reasoning');

-- --- 2. a score with reasoning is fine --------------------------------------
update public.applications
   set ai_fit_score = 72,
       ai_reasoning = 'Four years on espresso bars and two years running opening shift match what this role asks for. No evidence either way about the POS system named in the description.',
       ai_scored_at = now()
 where id = (select id from public.t_app);

do $$
declare s int;
begin
  select ai_fit_score into s from public.applications where id = (select id from public.t_app);
  if s <> 72 then raise exception 'FAIL: the score did not store (got %)', s; end if;
  raise notice 'PASS: a score stores when it comes with its reasoning';
end $$;

-- --- 3. THE BIG ONE: a score may never move a candidate ---------------------
-- Even from our own server. Scoring and deciding are separate acts.
select must_fail(
  $$update public.applications
       set ai_fit_score = 12,
           ai_reasoning = 'Weak match on the evidence provided.',
           ai_scored_at = now(),
           status = 'passed'
     where id = (select id from public.t_app)$$,
  'an AI score that also rejects the candidate');

do $$
declare st public.application_status;
begin
  select status into st from public.applications where id = (select id from public.t_app);
  if st <> 'new' then raise exception 'FAIL: the candidate moved to % anyway', st; end if;
  raise notice 'PASS: the candidate is still ''new'' — nothing was auto-rejected';
end $$;

-- --- 4. a human decision, on its own, still works ---------------------------
update public.applications
   set status = 'reviewing', last_status_changed_by = '11111111-1111-1111-1111-111111111111'
 where id = (select id from public.t_app);
do $$ begin raise notice 'PASS: a person can still move a candidate along'; end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --- 5. an employer cannot invent a score ----------------------------------
-- Erin owns Acme, so she is allowed to update her own candidates. That is how
-- a candidate moves from 'new' to 'interviewed'. It must not also let her
-- write whatever number she likes into the platform's score.
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

  update public.applications
     set ai_fit_score = 100,
         ai_reasoning = 'Outstanding candidate, hire immediately.',
         status = 'interviewed'
   where id = (select id from public.t_app);

  do $$
  declare s int; r text; st public.application_status;
  begin
    select ai_fit_score, ai_reasoning, status into s, r, st
      from public.applications where id = (select id from public.t_app);
    if s = 100 then raise exception 'FAIL: an employer wrote their own AI score'; end if;
    if r like 'Outstanding%' then raise exception 'FAIL: an employer wrote their own AI reasoning'; end if;
    if s <> 72 then raise exception 'FAIL: the real score was disturbed (now %)', s; end if;
    if st <> 'interviewed' then raise exception 'FAIL: the employer''s own status change was lost'; end if;
    raise notice 'PASS: employer''s status change kept, invented score discarded (still %)', s;
  end $$;
commit;

-- --- 6. a seeker cannot write their own "parsed resume" ---------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

  update public.seeker_profiles
     set resume_parsed = '{"skills":["brain surgery","piloting"]}'::jsonb,
         resume_parsed_at = now(),
         headline = 'Barista, 5 years'
   where user_id = '33333333-3333-3333-3333-333333333333';

  do $$
  declare p jsonb; h text;
  begin
    select resume_parsed, headline into p, h
      from public.seeker_profiles where user_id = '33333333-3333-3333-3333-333333333333';
    if p is not null then raise exception 'FAIL: a seeker wrote their own parsed resume: %', p; end if;
    if h <> 'Barista, 5 years' then raise exception 'FAIL: their real edit was lost'; end if;
    raise notice 'PASS: seeker''s own edits kept, invented resume data discarded';
  end $$;
commit;

-- --- 7. Vouch's own server writes it, and the seeker can always erase it ----
update public.seeker_profiles
   set resume_parsed = '{"skills":["espresso","opening shift"],"positions":[]}'::jsonb,
       resume_parsed_at = now()
 where user_id = '33333333-3333-3333-3333-333333333333';

do $$
begin
  if (select resume_parsed from public.seeker_profiles
       where user_id='33333333-3333-3333-3333-333333333333') is null then
    raise exception 'FAIL: the platform could not store what it read';
  end if;
  raise notice 'PASS: the platform can store what it read from a resume';
end $$;

begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

  update public.seeker_profiles
     set resume_parsed = null, resume_parsed_at = null
   where user_id = '33333333-3333-3333-3333-333333333333';

  do $$
  declare p jsonb; d timestamptz;
  begin
    select resume_parsed, resume_parsed_at into p, d
      from public.seeker_profiles where user_id = '33333333-3333-3333-3333-333333333333';
    if p is not null or d is not null then
      raise exception 'FAIL: a seeker could not erase what we read about them';
    end if;
    raise notice 'PASS: a seeker can always erase what we read from their resume';
  end $$;
commit;

do $$ begin raise notice '--- 50_ai_is_advisory.sql: all checks passed ---'; end $$;

drop table public.t_app;
