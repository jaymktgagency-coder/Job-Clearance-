-- ===========================================================================
-- Vouch — a voucher reaching out first
--
-- WHAT THIS FILE IS
-- Until now the arrow only pointed one way: a seeker asked, a voucher
-- answered. This lets a verified employee start the conversation.
--
-- THE MATCHING RULE, AND THE ONE THING IT IS NOT
-- A voucher may see and message a seeker ONLY IF that seeker has said, in so
-- many words, that they want to work at the voucher's own verified company.
-- Not any seeker. Not by category. Not "people like this". The seeker names
-- the company and that naming is the consent.
--
-- The match key is `verified_voucher_company()`, which has existed since
-- migration 0002 and already decides who may read a seeker's intro request.
-- Reusing it means the two directions of this marketplace can never disagree
-- about who counts as verified — and it covers both routes to being verified,
-- work email and employer invitation. The invitation route is how businesses
-- on Gmail get vouchers at all, and that segment is the hourly market.
--
-- WHAT A VOUCHER CAN SEE BEFORE THE SEEKER ANSWERS
-- Deliberately little: name, picture, headline, location, years, skills,
-- desired titles. NOT the email address, and NOT the resume.
--
-- The reason is worth writing down, because the obvious implementation gets
-- it wrong. Postgres row-level security is row level, not column level: a
-- policy letting a voucher read an interested seeker's `users` row would hand
-- over their email address with it, and a voucher who can email a seeker
-- directly can arrange a hire with nobody paying anybody. So there is no such
-- policy. Everything the browse screen shows comes from
-- `seekers_interested_in_my_company()` below, which names its columns one by
-- one and cannot leak a column it does not mention.
--
-- The resume needs no new rule at all: `resumes_read_as_voucher` in migration
-- 0006 keys on intro_requests, so an interest alone has never reached it. It
-- unlocks when the seeker accepts and asks for an intro, which is the point
-- at which they have chosen this person.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. WHAT AN OUTREACH CAN BE
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.outreach_status as enum (
    'pending',    -- sent, waiting on the seeker (counts toward the voucher's cap)
    'accepted',   -- the seeker said yes; they may now ask for an intro
    'declined',   -- the seeker said no. Final — there is no second attempt
    'withdrawn',  -- the voucher took it back
    'expired'     -- unanswered for too long
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE SEEKER NAMING A COMPANY
--
-- This row IS the consent. Creating it is how a seeker says "employees of
-- this company may see my profile and may write to me". Deleting it takes
-- that back, and because outreach is checked at the moment it is sent, a
-- seeker who removes a company stops being visible to it immediately.
-- ---------------------------------------------------------------------------

create table if not exists public.seeker_company_interests (
  id          uuid primary key default gen_random_uuid(),
  seeker_id   uuid not null references public.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  -- Optional: "I've worked in your Riverside store's cafe for two years."
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  unique (seeker_id, company_id)
);

comment on table public.seeker_company_interests is
  'A seeker naming a company they want to work at. This row is the consent that lets that company''s verified vouchers see and message them.';

create index if not exists seeker_company_interests_company_idx
  on public.seeker_company_interests (company_id);

-- ---------------------------------------------------------------------------
-- 3. THE MESSAGE ITSELF
-- ---------------------------------------------------------------------------

create table if not exists public.voucher_outreach (
  id            uuid primary key default gen_random_uuid(),
  voucher_id    uuid not null references public.users (id) on delete cascade,
  seeker_id     uuid not null references public.users (id) on delete cascade,
  -- Copied from the voucher's verified employer by the guard below, never
  -- accepted from the caller. It is stored rather than looked up each time so
  -- that a voucher who later changes jobs does not rewrite their own history.
  company_id    uuid not null references public.companies (id) on delete cascade,
  message       text not null check (char_length(btrim(message)) >= 40),
  status        public.outreach_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,

  -- One approach per voucher per seeker, ever. A voucher who is declined
  -- cannot try again, which is the difference between outreach and spam.
  unique (voucher_id, seeker_id),
  -- Nobody reaches out to themselves.
  constraint outreach_not_self check (voucher_id <> seeker_id)
);

comment on table public.voucher_outreach is
  'A verified voucher writing to a seeker who named their company. One per pair, ever.';

create index if not exists voucher_outreach_seeker_idx on public.voucher_outreach (seeker_id, status);
create index if not exists voucher_outreach_voucher_idx on public.voucher_outreach (voucher_id, status);

-- Where an intro request came from, when it came from outreach. Provenance
-- only — nothing reads it to make a decision. It is what makes "did reaching
-- out actually produce hires?" a question the database can answer.
alter table public.intro_requests
  add column if not exists source_outreach_id uuid
    references public.voucher_outreach (id) on delete set null;

comment on column public.intro_requests.source_outreach_id is
  'Set when this request began as a voucher reaching out. Provenance only; affects nothing.';

-- ---------------------------------------------------------------------------
-- 4. THE NUMBERS, IN THE SETTINGS TABLE WHERE THEY BELONG
--
-- `platform_settings` is keyed by (key, effective_from), so there is no
-- unique constraint on key alone and `on conflict (key)` fails. Insert with
-- `where not exists`.
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, note)
select 'max_open_outreach_per_voucher', to_jsonb(5),
       'How many unanswered approaches one voucher may have out at once.'
where not exists (select 1 from public.platform_settings where key = 'max_open_outreach_per_voucher');

insert into public.platform_settings (key, value, note)
select 'max_company_interests_per_seeker', to_jsonb(20),
       'How many companies one seeker may name. Stops "interested in everything", which is interested in nothing.'
where not exists (select 1 from public.platform_settings where key = 'max_company_interests_per_seeker');

insert into public.platform_settings (key, value, note)
select 'outreach_expiry_days', to_jsonb(14),
       'An unanswered approach goes stale after this many days and stops counting against the voucher.'
where not exists (select 1 from public.platform_settings where key = 'outreach_expiry_days');

-- ---------------------------------------------------------------------------
-- 5. HELPERS
--
-- These three are SECURITY DEFINER on purpose, and it is the opposite of the
-- trap the guards below avoid. A guard must NOT be definer, because it asks
-- "who is calling?" and under definer everyone looks trusted. These ask no
-- such question — they answer a fixed factual question about somebody else's
-- row, which the caller is not allowed to read directly and must not be.
--
-- That is exactly why they exist: the insert guard has to check a seeker's
-- interest and their open_to_work flag, and it runs with the voucher's own
-- permissions. Without these, making that check work would mean opening
-- `seeker_profiles` to vouchers wholesale — bio, resume path and all — which
-- is the leak this whole design is arranged to avoid.
-- ---------------------------------------------------------------------------

create or replace function public.outreach_expiry_cutoff()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select now() - make_interval(days => public.platform_setting_int('outreach_expiry_days', 14));
$$;

comment on function public.outreach_expiry_cutoff() is
  'Anything still pending and older than this is stale. Read-time expiry, because nothing runs on a schedule yet.';

create or replace function public.seeker_has_interest_in(p_seeker uuid, p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.seeker_company_interests sci
    where sci.seeker_id = p_seeker and sci.company_id = p_company
  );
$$;

-- `open_to_work` has been on the seeker's profile form since Step 5 and until
-- now was stored and never read by anything. It is the global off switch: a
-- seeker who unticks it disappears from every voucher's list at once, without
-- having to remove the companies they named one at a time.
create or replace function public.seeker_accepts_approaches(p_seeker uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select sp.open_to_work from public.seeker_profiles sp where sp.user_id = p_seeker),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. THE GUARDS
--
-- Same shape as every other guard here: trusted callers pass through,
-- everyone else is either silently reverted or raised at. Raise where the
-- whole statement is illegitimate; silently revert where a legitimate change
-- is mixed in with an illegitimate one.
--
-- NOT `security definer`. Under it `current_user` becomes this function's
-- owner, every caller looks trusted, and the guard quietly does nothing.
-- ---------------------------------------------------------------------------

create or replace function public.protect_outreach_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
  v_company uuid;
begin
  if v_trusted then
    return new;
  end if;

  -- You may only ever send as yourself.
  if new.voucher_id is distinct from (select auth.uid()) then
    raise exception 'You can only send an approach as yourself.'
      using errcode = 'check_violation';
  end if;

  -- And only if you are a verified employee somewhere.
  v_company := public.verified_voucher_company();
  if v_company is null then
    raise exception 'Only a verified voucher can reach out to a job seeker.'
      using errcode = 'check_violation';
  end if;

  -- The company is taken from the verification, never from the request. A
  -- voucher cannot approach on behalf of a company they do not work at by
  -- naming a different one here.
  new.company_id := v_company;

  -- THE MATCHING RULE. Everything else in this file exists to serve this line.
  if not public.seeker_has_interest_in(new.seeker_id, v_company) then
    raise exception 'You can only reach out to people who have said they want to work at your company.'
      using errcode = 'check_violation';
  end if;

  if not public.seeker_accepts_approaches(new.seeker_id) then
    raise exception 'This person is not currently open to being approached.'
      using errcode = 'check_violation';
  end if;

  -- An approach starts unanswered, whatever was sent.
  new.status       := 'pending';
  new.responded_at := null;
  new.created_at   := now();

  return new;
end;
$$;

comment on function public.protect_outreach_insert() is
  'The matching rule, enforced where it cannot be forgotten: a voucher may only write to somebody who named their company.';

create or replace function public.protect_outreach_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
  v_actor   uuid := (select auth.uid());
begin
  if v_trusted then
    return new;
  end if;

  -- Nothing about who, which company, or what was said can ever change. An
  -- approach is a thing that was said at a moment; editing it afterwards
  -- would rewrite what the other person agreed to.
  new.id         := old.id;
  new.voucher_id := old.voucher_id;
  new.seeker_id  := old.seeker_id;
  new.company_id := old.company_id;
  new.message    := old.message;
  new.created_at := old.created_at;

  -- Answered is answered. Silently revert rather than raise, so that a
  -- double-tap on Accept is a no-op instead of an error page.
  if old.status <> 'pending' then
    new.status       := old.status;
    new.responded_at := old.responded_at;
    return new;
  end if;

  if v_actor = old.seeker_id then
    -- The seeker's half: they answer. They cannot withdraw somebody else's
    -- approach or mark it expired.
    if new.status not in ('accepted', 'declined') then
      new.status := old.status;
    end if;
  elsif v_actor = old.voucher_id then
    -- The voucher's half: they may take it back, and that is all. This is
    -- the line that stops a voucher answering on the seeker's behalf —
    -- exactly the hole `protect_hire_insert` closed for hires in 0009.
    if new.status <> 'withdrawn' then
      new.status := old.status;
    end if;
  else
    new.status := old.status;
  end if;

  new.responded_at := case when new.status <> old.status then now() else old.responded_at end;

  return new;
end;
$$;

comment on function public.protect_outreach_columns() is
  'Each side writes only its own half: the seeker answers, the voucher withdraws, and nobody edits what was said.';

create or replace function public.enforce_voucher_outreach_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap  int := public.platform_setting_int('max_open_outreach_per_voucher', 5);
  v_open int;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  -- Stale approaches do not count. Without the cutoff a voucher whose five
  -- messages were all ignored is locked out forever.
  select count(*) into v_open
  from public.voucher_outreach vo
  where vo.voucher_id = new.voucher_id
    and vo.status = 'pending'
    and vo.created_at > public.outreach_expiry_cutoff()
    and vo.id <> new.id;

  if v_open >= v_cap then
    raise exception 'You already have % approaches waiting for an answer, which is the limit of %.', v_open, v_cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_seeker_interest_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap  int := public.platform_setting_int('max_company_interests_per_seeker', 20);
  v_held int;
begin
  select count(*) into v_held
  from public.seeker_company_interests sci
  where sci.seeker_id = new.seeker_id
    and sci.id <> new.id;

  if v_held >= v_cap then
    raise exception 'You have already named % companies, which is the limit of %. Remove one first.', v_held, v_cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Provenance can be claimed, so it is checked. A seeker cannot dress an
-- ordinary request up as one that came from an approach that was never made
-- or never accepted. Silently nulled rather than raised at, because the rest
-- of the request is perfectly legitimate and should still be created.
create or replace function public.protect_intro_request_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  if v_trusted or new.source_outreach_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.voucher_outreach vo
    where vo.id = new.source_outreach_id
      and vo.seeker_id = new.seeker_id
      and vo.status = 'accepted'
  ) then
    new.source_outreach_id := null;
  end if;

  return new;
end;
$$;

-- Triggers fire in alphabetical order by name, hence the numbers. The insert
-- guard must run before the cap: it is what forces `status` to 'pending', and
-- the cap only counts pending rows.
drop trigger if exists trg_outreach_10_insert on public.voucher_outreach;
create trigger trg_outreach_10_insert
  before insert on public.voucher_outreach
  for each row execute function public.protect_outreach_insert();

drop trigger if exists trg_outreach_20_columns on public.voucher_outreach;
create trigger trg_outreach_20_columns
  before update on public.voucher_outreach
  for each row execute function public.protect_outreach_columns();

drop trigger if exists trg_outreach_30_cap on public.voucher_outreach;
create trigger trg_outreach_30_cap
  before insert or update of status on public.voucher_outreach
  for each row execute function public.enforce_voucher_outreach_cap();

drop trigger if exists trg_interest_cap on public.seeker_company_interests;
create trigger trg_interest_cap
  before insert on public.seeker_company_interests
  for each row execute function public.enforce_seeker_interest_cap();

drop trigger if exists trg_intro_request_05_source on public.intro_requests;
create trigger trg_intro_request_05_source
  before insert on public.intro_requests
  for each row execute function public.protect_intro_request_source();

-- ---------------------------------------------------------------------------
-- 7. WHO MAY READ AND WRITE THESE ROWS
--
-- Note what is NOT here: no policy anywhere lets a voucher read
-- `seeker_company_interests` for somebody else, and none widens
-- `users` or `seeker_profiles`. The browse screen goes through the function
-- in section 8, which hands back a fixed list of columns. That is the whole
-- privacy design in one sentence.
-- ---------------------------------------------------------------------------

alter table public.seeker_company_interests enable row level security;
alter table public.voucher_outreach         enable row level security;

-- --- the seeker's own list -------------------------------------------------

drop policy if exists interests_read_self on public.seeker_company_interests;
create policy interests_read_self on public.seeker_company_interests
  for select to authenticated
  using (seeker_id = (select auth.uid()));

drop policy if exists interests_insert_self on public.seeker_company_interests;
create policy interests_insert_self on public.seeker_company_interests
  for insert to authenticated
  with check (seeker_id = (select auth.uid()) and public.auth_user_role() = 'seeker');

-- Removing a company is how a seeker takes back the permission they gave.
-- There is no update policy: a row either stands or it does not.
drop policy if exists interests_delete_self on public.seeker_company_interests;
create policy interests_delete_self on public.seeker_company_interests
  for delete to authenticated
  using (seeker_id = (select auth.uid()));

-- --- the approach ----------------------------------------------------------

drop policy if exists outreach_read_own on public.voucher_outreach;
create policy outreach_read_own on public.voucher_outreach
  for select to authenticated
  using (voucher_id = (select auth.uid()) or seeker_id = (select auth.uid()));

-- The guard does the real work. This only establishes that the sender is the
-- signed-in person and that they are a voucher at all; the trigger checks
-- that they are verified, and that the seeker named their company.
drop policy if exists outreach_insert_by_voucher on public.voucher_outreach;
create policy outreach_insert_by_voucher on public.voucher_outreach
  for insert to authenticated
  with check (voucher_id = (select auth.uid()) and public.auth_user_role() = 'voucher');

-- Both sides may update their own row, and `protect_outreach_columns` decides
-- which half of it each of them is actually allowed to move.
drop policy if exists outreach_update_own on public.voucher_outreach;
create policy outreach_update_own on public.voucher_outreach
  for update to authenticated
  using (voucher_id = (select auth.uid()) or seeker_id = (select auth.uid()))
  with check (voucher_id = (select auth.uid()) or seeker_id = (select auth.uid()));

-- No delete policy on purpose. A declined approach has to stay, or the unique
-- constraint on (voucher_id, seeker_id) could be stepped around by deleting
-- the refusal and sending again.

-- ---------------------------------------------------------------------------
-- 8. WHAT THE VOUCHER ACTUALLY SEES
--
-- The column list below IS the privacy rule. Adding a column here shows it to
-- every verified voucher at a company the seeker named, so `email` and
-- `resume_path` are absent and should stay absent.
--
-- SECURITY DEFINER because it reads rows the caller deliberately cannot, and
-- it gates on `verified_voucher_company()` rather than on `current_user`, so
-- the trap that makes a guard useless does not apply.
-- ---------------------------------------------------------------------------

create or replace function public.seekers_interested_in_my_company()
returns table (
  seeker_id        uuid,
  full_name        text,
  avatar_url       text,
  headline         text,
  location         text,
  years_experience int,
  skills           text[],
  desired_titles   text[],
  note             text,
  interested_at    timestamptz,
  outreach_id      uuid,
  outreach_status  public.outreach_status,
  outreach_sent_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.full_name,
    u.avatar_url,
    sp.headline,
    sp.location,
    sp.years_experience,
    sp.skills,
    sp.desired_titles,
    sci.note,
    sci.created_at,
    vo.id,
    -- Expiry is worked out as it is read. Nothing in this project runs on a
    -- schedule yet, so a row can sit at 'pending' long after it went stale;
    -- showing it as pending would be a lie to both sides and would make the
    -- voucher's cap look full when it is not.
    case
      when vo.status = 'pending' and vo.created_at <= public.outreach_expiry_cutoff()
        then 'expired'::public.outreach_status
      else vo.status
    end,
    vo.created_at
  from public.seeker_company_interests sci
  join public.users u  on u.id = sci.seeker_id
  join public.seeker_profiles sp on sp.user_id = sci.seeker_id
  -- Whether this particular voucher has already written to them. A left join,
  -- so somebody nobody has approached still appears.
  left join public.voucher_outreach vo
    on vo.seeker_id = sci.seeker_id
   and vo.voucher_id = (select auth.uid())
  where sci.company_id = public.verified_voucher_company()
    and public.verified_voucher_company() is not null
    and sp.open_to_work
  order by sci.created_at desc;
$$;

comment on function public.seekers_interested_in_my_company() is
  'The voucher''s browse list. The column list is the privacy rule: no email, no resume, until the seeker accepts.';

-- ---------------------------------------------------------------------------
-- 9. SWEEPING UP STALE APPROACHES
--
-- Written in the same shape as `open_stale_hire_disputes()` and
-- `release_due_payouts()`, and like them it is not called by anything yet —
-- there is no scheduler. The reading above is what makes expiry correct in
-- the meantime; this is what will make it tidy once Vercel Cron is wired up.
-- ---------------------------------------------------------------------------

create or replace function public.expire_stale_outreach()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with stale as (
    update public.voucher_outreach
       set status = 'expired', responded_at = now()
     where status = 'pending'
       and created_at <= public.outreach_expiry_cutoff()
    returning 1
  )
  select count(*) into v_count from stale;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. PERMISSIONS
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.seeker_company_interests to authenticated, service_role;
grant select, insert, update on public.voucher_outreach         to authenticated, service_role;

grant execute on function public.seekers_interested_in_my_company() to authenticated, service_role;
grant execute on function public.outreach_expiry_cutoff()           to authenticated, service_role;
grant execute on function public.seeker_has_interest_in(uuid, uuid) to authenticated, service_role;
grant execute on function public.seeker_accepts_approaches(uuid)    to authenticated, service_role;
-- The sweeper is the platform's, not a login's.
grant execute on function public.expire_stale_outreach() to service_role;

commit;
