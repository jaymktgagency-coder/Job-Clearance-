-- ===========================================================================
-- Vouch — Step 2a security rules (Row Level Security)
--
-- WHAT THIS FILE IS
-- The schema decides what CAN be stored. This file decides who is ALLOWED to
-- see and change it. Postgres enforces these rules itself, on every single
-- query, no matter which screen or script is asking.
--
-- Without this file, anyone who got hold of the public key could read every
-- resume in the database. Paste it right after 0001.
--
-- The short version:
--   * seekers see their own things
--   * vouchers see requests for jobs at their own company, and nothing else
--   * employers see candidates who carry a vouch for one of their own jobs
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- HELPERS
-- Three small questions the rules below ask over and over. They run with the
-- database owner's rights so they can answer without tripping over the very
-- rules they're helping to enforce.
-- ---------------------------------------------------------------------------

-- What kind of user is logged in?
create or replace function public.auth_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = (select auth.uid());
$$;

-- Does the logged-in person work for this company (as an employer)?
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
  );
$$;

-- Which company is the logged-in person a VERIFIED voucher for?
-- Returns nothing for unverified vouchers, which is what locks them out.
create or replace function public.verified_voucher_company()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select vp.company_id
  from public.voucher_profiles vp
  where vp.user_id = (select auth.uid())
    and vp.status = 'verified';
$$;

-- ---------------------------------------------------------------------------
-- TURN THE RULES ON
-- Until a table has a policy, "enable" means nobody can read it at all.
-- ---------------------------------------------------------------------------

alter table public.users                enable row level security;
alter table public.seeker_profiles      enable row level security;
alter table public.companies            enable row level security;
alter table public.company_domains      enable row level security;
alter table public.locations            enable row level security;
alter table public.company_members      enable row level security;
alter table public.voucher_profiles     enable row level security;
alter table public.voucher_invitations  enable row level security;
alter table public.email_verifications  enable row level security;
alter table public.platform_settings    enable row level security;
alter table public.jobs                 enable row level security;
alter table public.intro_requests       enable row level security;
alter table public.vouches              enable row level security;
alter table public.applications         enable row level security;
alter table public.application_events   enable row level security;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------

create policy users_read_self on public.users
  for select using (id = (select auth.uid()));

-- A verified voucher may see a seeker who has asked for a vouch at their company.
create policy users_read_seeker_as_voucher on public.users
  for select using (
    exists (
      select 1
      from public.intro_requests ir
      join public.jobs j on j.id = ir.job_id
      where ir.seeker_id = public.users.id
        and j.company_id = public.verified_voucher_company()
    )
  );

-- An employer may see seekers who have a vouched application for their jobs,
-- and the vouchers who wrote those vouches.
create policy users_read_candidate_as_employer on public.users
  for select using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.seeker_id = public.users.id
        and public.is_company_member(j.company_id)
    )
    or exists (
      select 1
      from public.vouches v
      join public.jobs j on j.id = v.job_id
      where v.voucher_id = public.users.id
        and public.is_company_member(j.company_id)
    )
  );

-- A seeker may see the voucher who vouched for them.
create policy users_read_my_voucher on public.users
  for select using (
    exists (
      select 1 from public.vouches v
      where v.voucher_id = public.users.id
        and v.seeker_id = (select auth.uid())
    )
  );

create policy users_insert_self on public.users
  for insert with check (id = (select auth.uid()));

create policy users_update_self on public.users
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- The data-deletion promise: people can delete themselves.
create policy users_delete_self on public.users
  for delete using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- SEEKER PROFILES — same audience as the user row above
-- ---------------------------------------------------------------------------

create policy seeker_profiles_read_self on public.seeker_profiles
  for select using (user_id = (select auth.uid()));

create policy seeker_profiles_read_as_voucher on public.seeker_profiles
  for select using (
    exists (
      select 1
      from public.intro_requests ir
      join public.jobs j on j.id = ir.job_id
      where ir.seeker_id = public.seeker_profiles.user_id
        and j.company_id = public.verified_voucher_company()
    )
  );

create policy seeker_profiles_read_as_employer on public.seeker_profiles
  for select using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.seeker_id = public.seeker_profiles.user_id
        and public.is_company_member(j.company_id)
    )
  );

create policy seeker_profiles_write_self on public.seeker_profiles
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- COMPANIES, DOMAINS, LOCATIONS
-- Company and location details are public inside the app — seekers need to
-- see who is hiring. Only the company's own people can change them.
-- ---------------------------------------------------------------------------

create policy companies_read_all on public.companies
  for select to authenticated using (true);

create policy companies_insert_by_employer on public.companies
  for insert to authenticated with check (public.auth_user_role() = 'employer');

create policy companies_update_by_member on public.companies
  for update using (public.is_company_member(id)) with check (public.is_company_member(id));

create policy company_domains_read_all on public.company_domains
  for select to authenticated using (true);

create policy company_domains_write_by_member on public.company_domains
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy locations_read_all on public.locations
  for select to authenticated using (true);

create policy locations_write_by_member on public.locations
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- COMPANY MEMBERS
-- ---------------------------------------------------------------------------

create policy company_members_read_own_company on public.company_members
  for select using (
    user_id = (select auth.uid()) or public.is_company_member(company_id)
  );

-- You may add yourself to a company that has no members yet (that's how the
-- person who creates a company becomes its owner), or you may be added by an
-- existing member.
create policy company_members_insert on public.company_members
  for insert to authenticated with check (
    public.is_company_member(company_id)
    or (
      user_id = (select auth.uid())
      and not exists (select 1 from public.company_members m where m.company_id = company_members.company_id)
    )
  );

create policy company_members_delete_by_member on public.company_members
  for delete using (public.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- VOUCHER PROFILES
-- ---------------------------------------------------------------------------

create policy voucher_profiles_read_self on public.voucher_profiles
  for select using (user_id = (select auth.uid()));

-- Employers see the track record of anyone who vouched for one of their jobs.
create policy voucher_profiles_read_as_employer on public.voucher_profiles
  for select using (
    exists (
      select 1
      from public.vouches v
      join public.jobs j on j.id = v.job_id
      where v.voucher_id = public.voucher_profiles.user_id
        and public.is_company_member(j.company_id)
    )
  );

-- A seeker sees the profile of whoever vouched for them.
create policy voucher_profiles_read_as_seeker on public.voucher_profiles
  for select using (
    exists (
      select 1 from public.vouches v
      where v.voucher_id = public.voucher_profiles.user_id
        and v.seeker_id = (select auth.uid())
    )
  );

-- Vouchers maintain their own profile (job title, branch). They cannot touch
-- the verification or payout fields: a trigger in 0001 restricts those to
-- Vouch's own server code, so nobody can mark themselves verified.
create policy voucher_profiles_write_self on public.voucher_profiles
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- INVITATIONS AND VERIFICATION CODES
-- Codes are only ever checked by server-side code holding the secret key, so
-- ordinary logins get no access at all to email_verifications.
-- ---------------------------------------------------------------------------

create policy voucher_invitations_read_by_company on public.voucher_invitations
  for select using (public.is_company_member(company_id));

create policy voucher_invitations_write_by_company on public.voucher_invitations
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- (No policies on email_verifications: nobody but the server may touch it.)

-- ---------------------------------------------------------------------------
-- PLATFORM SETTINGS — everyone may read the rules of the game, nobody may edit
-- ---------------------------------------------------------------------------

create policy platform_settings_read_all on public.platform_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- JOBS
-- ---------------------------------------------------------------------------

create policy jobs_read_open on public.jobs
  for select to authenticated using (status = 'open');

create policy jobs_read_own_company on public.jobs
  for select using (public.is_company_member(company_id));

create policy jobs_write_own_company on public.jobs
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- INTRO REQUESTS
-- ---------------------------------------------------------------------------

create policy intro_requests_read_self on public.intro_requests
  for select using (seeker_id = (select auth.uid()));

-- The voucher's inbox: requests for jobs at their own company. This single
-- rule is what stops a voucher at one company seeing another company's people.
create policy intro_requests_read_as_voucher on public.intro_requests
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = public.intro_requests.job_id
        and j.company_id = public.verified_voucher_company()
    )
  );

create policy intro_requests_read_as_employer on public.intro_requests
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = public.intro_requests.job_id
        and public.is_company_member(j.company_id)
    )
  );

create policy intro_requests_insert_by_seeker on public.intro_requests
  for insert to authenticated with check (
    seeker_id = (select auth.uid()) and public.auth_user_role() = 'seeker'
  );

-- Seekers withdraw their own; vouchers at that company decline them.
create policy intro_requests_update_by_seeker on public.intro_requests
  for update using (seeker_id = (select auth.uid()))
  with check (seeker_id = (select auth.uid()));

create policy intro_requests_update_by_voucher on public.intro_requests
  for update using (
    exists (
      select 1 from public.jobs j
      where j.id = public.intro_requests.job_id
        and j.company_id = public.verified_voucher_company()
    )
  );

-- ---------------------------------------------------------------------------
-- VOUCHES
-- ---------------------------------------------------------------------------

create policy vouches_read_own on public.vouches
  for select using (
    voucher_id = (select auth.uid()) or seeker_id = (select auth.uid())
  );

create policy vouches_read_as_employer on public.vouches
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = public.vouches.job_id and public.is_company_member(j.company_id)
    )
  );

create policy vouches_insert_by_voucher on public.vouches
  for insert to authenticated with check (voucher_id = (select auth.uid()));

create policy vouches_update_by_author on public.vouches
  for update using (voucher_id = (select auth.uid()))
  with check (voucher_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- APPLICATIONS
-- Employers decide; seekers watch; the voucher can follow what happened to
-- the person they backed. Nobody inserts these by hand — a vouch creates them.
-- ---------------------------------------------------------------------------

create policy applications_read_as_employer on public.applications
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = public.applications.job_id and public.is_company_member(j.company_id)
    )
  );

create policy applications_read_as_seeker on public.applications
  for select using (seeker_id = (select auth.uid()));

create policy applications_read_as_voucher on public.applications
  for select using (
    exists (
      select 1 from public.vouches v
      where v.id = public.applications.vouch_id and v.voucher_id = (select auth.uid())
    )
  );

-- Only the employer moves a candidate along. A human, every time.
create policy applications_update_as_employer on public.applications
  for update using (
    exists (
      select 1 from public.jobs j
      where j.id = public.applications.job_id and public.is_company_member(j.company_id)
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = public.applications.job_id and public.is_company_member(j.company_id)
    )
  );

-- ---------------------------------------------------------------------------
-- APPLICATION EVENTS — readable by the same people, written only by the system
-- ---------------------------------------------------------------------------

create policy application_events_read on public.application_events
  for select using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = public.application_events.application_id
        and (
          public.is_company_member(j.company_id)
          or a.seeker_id = (select auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- GRANTS
-- Supabase usually adds these automatically; setting them explicitly means
-- this file produces the same result no matter how the project was created.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on public.companies, public.locations, public.jobs to anon;
grant execute on all functions in schema public to authenticated, service_role;
