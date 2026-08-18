-- ===========================================================================
-- Vouch — Step 2a core schema
--
-- WHAT THIS FILE IS
-- The blueprint for your database: the tables that hold people, companies,
-- jobs, and vouches. You paste this into the Supabase SQL Editor once and it
-- builds everything.
--
-- Money, payouts, and reputation tables come in Step 2b. This file
-- deliberately stops short of those.
--
-- HOW TO READ IT
-- Each table starts with a plain-English comment explaining what it holds.
-- "cents" columns store whole numbers (50000 = $500.00) because storing money
-- as a decimal invites rounding bugs.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. LISTS OF ALLOWED VALUES
-- Postgres calls these "enums". They stop typos from becoming bad data: a
-- job's status can only ever be one of the words listed here.
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('seeker', 'voucher', 'employer');

create type public.voucher_status as enum (
  'unverified',  -- signed up, hasn't proved they work there yet
  'pending',     -- code sent / invitation sent, awaiting confirmation
  'verified',    -- proved it; allowed to vouch
  'suspended'    -- flagged or paused by the platform
);

-- The two ways a voucher can prove they work somewhere.
create type public.verification_method as enum (
  'work_email',      -- self-serve: emailed a 6-digit code at the company domain
  'employer_invite'  -- a verified employer invited them directly
);

create type public.pay_type as enum ('hourly', 'salaried');

-- The success fee bracket. Derived from pay_type, frozen onto the job.
create type public.fee_tier as enum ('tier_1', 'tier_2');

create type public.job_status as enum ('draft', 'open', 'paused', 'closed', 'filled');

create type public.intro_request_status as enum (
  'pending',    -- waiting for a voucher to pick it up (counts toward the seeker's cap)
  'vouched',    -- a voucher wrote a vouch
  'declined',   -- a voucher said no
  'withdrawn',  -- the seeker took it back
  'expired'     -- aged out
);

-- What the voucher is actually claiming. Shown to employers, never hidden.
create type public.vouch_relationship as enum (
  'knows_personally',        -- "I know this person"
  'reviewed_profile_only'    -- "I read their profile and think they're worth a look"
);

create type public.application_status as enum (
  'new', 'reviewing', 'interviewed', 'offered', 'hired', 'passed'
);

create type public.company_member_role as enum ('owner', 'recruiter');

create type public.invitation_status as enum ('sent', 'accepted', 'expired', 'revoked');

-- ---------------------------------------------------------------------------
-- 2. PLATFORM SETTINGS
-- Your configurable numbers: fees, the voucher's share, both caps. Each row
-- has a start date, so changing a price later never rewrites a past deal.
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  key             text        not null,
  value           jsonb       not null,
  effective_from  timestamptz not null default now(),
  note            text,
  created_at      timestamptz not null default now(),
  primary key (key, effective_from)
);

comment on table public.platform_settings is
  'Configurable platform numbers (fees, shares, caps). Never hardcode these in app code.';

-- Reads the value of a setting as of right now.
create or replace function public.platform_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select ps.value
  from public.platform_settings ps
  where ps.key = p_key
    and ps.effective_from <= now()
  order by ps.effective_from desc
  limit 1;
$$;

-- Same, but for whole-number settings, with a fallback if the row is missing.
create or replace function public.platform_setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((public.platform_setting(p_key))::int, p_default);
$$;

insert into public.platform_settings (key, value, note) values
  ('fee_tier_1_cents',                    to_jsonb(50000),  'Success fee for hourly/retail/service roles ($500).'),
  ('fee_tier_2_cents',                    to_jsonb(200000), 'Success fee for salaried/professional roles ($2,000).'),
  ('voucher_share_bps',                   to_jsonb(5000),   'Voucher''s cut in basis points. 5000 = 50%.'),
  ('max_open_intro_requests_per_seeker',  to_jsonb(5),      'How many intro requests a seeker may have pending at once.'),
  ('max_open_vouches_per_voucher',        to_jsonb(5),      'How many unresolved vouches a voucher may have at once.'),
  ('min_vouch_body_chars',                to_jsonb(200),    'Minimum length of vouch text. Database floor is 150.'),
  ('payout_hold_days',                    to_jsonb(60),     'Days after start date before a voucher payout releases. Step 2b.'),
  ('early_departure_days',                to_jsonb(30),     'Leave within this many days and the employer earns a credit. Step 2b.'),
  ('early_departure_credit_bps',          to_jsonb(5000),   'Size of that credit. 5000 = 50% toward their next hire. Step 2b.');

-- ---------------------------------------------------------------------------
-- 3. PEOPLE
-- ---------------------------------------------------------------------------

-- One row per person, whatever their role.
-- The id matches Supabase's own login record. `on delete cascade` means that
-- deleting the login erases this row and everything hanging off it — that is
-- how "delete my account and all my data" is guaranteed rather than promised.
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  full_name   text,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.users is
  'Everyone with a Vouch login. Deleting the auth user cascades to every row here and below.';

-- The seeker's profile. Almost everything is optional on purpose: the form has
-- to be fast to fill out, and the resume upload fills most of it in later.
create table public.seeker_profiles (
  user_id             uuid primary key references public.users (id) on delete cascade,
  headline            text,
  location            text,
  bio                 text,
  years_experience    int check (years_experience is null or years_experience between 0 and 60),
  skills              text[] not null default '{}',
  desired_titles      text[] not null default '{}',
  open_to_work        boolean not null default true,
  -- Where the resume file sits in Supabase Storage (Step 5).
  resume_path         text,
  resume_uploaded_at  timestamptz,
  -- Structured resume data written by the AI in Step 8. Null until then.
  resume_parsed       jsonb,
  resume_parsed_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.seeker_profiles is
  'Job seeker details. Seekers are never charged for anything, ever.';

-- ---------------------------------------------------------------------------
-- 4. COMPANIES, LOCATIONS, AND EMPLOYER LOGINS
-- ---------------------------------------------------------------------------

-- An employer organization.
-- The green checkmark is NOT a column someone can flip by hand: `is_verified`
-- is computed by the database from the two things you said it requires —
-- proven domain ownership AND a payment method on file.
create table public.companies (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text not null unique,
  website                 text,
  description             text,
  logo_url                text,
  domain_verified_at      timestamptz,
  payment_method_on_file  boolean not null default false,
  is_verified             boolean generated always as
                            (domain_verified_at is not null and payment_method_on_file) stored,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on column public.companies.is_verified is
  'The green checkmark. Computed: requires BOTH a verified domain AND a payment method. Cannot be set by hand.';

-- The email domains that prove employment at a company. A company can own
-- several (acme.com, acme.co.uk), which is why this is its own table.
create table public.company_domains (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  domain      text not null unique check (domain = lower(domain) and domain like '%.%'),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.company_domains is
  'Work-email domains that prove employment. Free providers (gmail etc.) are blocked in app code, Step 4.';

-- One row per store, branch, or office, so multi-location businesses work.
create table public.locations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  label           text not null,
  address_line1   text,
  address_line2   text,
  city            text,
  region          text,
  postal_code     text,
  country         text not null default 'US',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.locations is
  'A physical branch of a company. Jobs point at one; vouchers display theirs.';

-- Which employer logins may act for which company. Without this a company is
-- hostage to whichever single person happened to sign up.
create table public.company_members (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  member_role  public.company_member_role not null default 'recruiter',
  created_at   timestamptz not null default now(),
  unique (company_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 5. VOUCHERS
-- ---------------------------------------------------------------------------

-- A verified current employee who can vouch for people applying where they work.
--
-- Two rules from your spec are enforced by the database itself, at the bottom:
--   * nobody reaches 'verified' without a verification method and a date;
--   * nobody reaches 'verified' without affirming their employer permits this.
-- Encoding them here means no future bug can quietly skip them.
create table public.voucher_profiles (
  user_id                           uuid primary key references public.users (id) on delete cascade,
  company_id                        uuid not null references public.companies (id) on delete restrict,
  location_id                       uuid references public.locations (id) on delete set null,
  job_title                         text,
  -- Present for the self-serve path, null for invited vouchers.
  work_email                        text,
  verification_method               public.verification_method,
  status                            public.voucher_status not null default 'unverified',
  verified_at                       timestamptz,
  -- The conflict-of-interest safeguard: they confirmed their employer allows this.
  employer_permission_confirmed_at  timestamptz,
  -- Payout gates (Step 2b). Money cannot move until both are set.
  identity_verified_at              timestamptz,
  tax_info_collected_at             timestamptz,
  payout_account_id                 text,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),

  constraint verified_requires_method check (
    status <> 'verified'
    or (verified_at is not null and verification_method is not null)
  ),
  constraint verified_requires_employer_permission check (
    status <> 'verified'
    or employer_permission_confirmed_at is not null
  )
);

comment on table public.voucher_profiles is
  'Verified employees who vouch. Can only vouch for jobs at their own company (enforced by trigger).';

-- The employer-invite path: a verified employer invites someone by email, and
-- that invitation IS the verification. This is how businesses that run on
-- Gmail get vouchers at all.
create table public.voucher_invitations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  location_id  uuid references public.locations (id) on delete set null,
  invited_by   uuid references public.users (id) on delete set null,
  email        text not null check (email = lower(email)),
  -- Only the hash of the invite token is stored, never the token itself.
  token_hash   text not null,
  status       public.invitation_status not null default 'sent',
  accepted_by  uuid references public.users (id) on delete set null,
  accepted_at  timestamptz,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- One outstanding invitation per email per company.
create unique index voucher_invitations_one_open_per_email
  on public.voucher_invitations (company_id, email)
  where status = 'sent';

-- The 6-digit codes for work-email verification (used in Step 4).
-- We store only a hash of the code, so a database leak doesn't hand anyone
-- a working verification code.
create table public.email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. JOBS
-- ---------------------------------------------------------------------------

-- An open role.
--
-- The three fee columns are a FROZEN COPY of your pricing as it stood the
-- moment the job was posted. If you change your fees next year, every job
-- posted before the change keeps the deal it was posted under. A trigger
-- below fills them in and then refuses to let them change after posting.
create table public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  location_id        uuid references public.locations (id) on delete set null,
  posted_by          uuid references public.users (id) on delete set null,
  title              text not null,
  description        text not null,
  pay_type           public.pay_type not null,
  pay_min_cents      int check (pay_min_cents is null or pay_min_cents >= 0),
  pay_max_cents      int check (pay_max_cents is null or pay_max_cents >= 0),
  status             public.job_status not null default 'draft',

  fee_tier           public.fee_tier not null,
  fee_amount_cents   int not null check (fee_amount_cents > 0),
  voucher_share_bps  int not null check (voucher_share_bps between 0 and 10000),
  -- True when a human overrode the tier the pay type would have chosen.
  tier_overridden    boolean not null default false,

  posted_at          timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint pay_range_ordered check (
    pay_min_cents is null or pay_max_cents is null or pay_max_cents >= pay_min_cents
  )
);

comment on column public.jobs.fee_amount_cents is
  'Frozen at posting. Changing platform pricing later must never alter an existing job.';

-- ---------------------------------------------------------------------------
-- 7. THE VOUCH FLOW
-- ---------------------------------------------------------------------------

-- A seeker asking for a vouch on one specific job.
-- 'pending' rows are what the seeker's cap of 5 counts.
create table public.intro_requests (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,
  seeker_id     uuid not null references public.users (id) on delete cascade,
  message       text,
  status        public.intro_request_status not null default 'pending',
  -- Set to the voucher who responded.
  claimed_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  -- A seeker can only ask once per job.
  unique (job_id, seeker_id)
);

-- The written endorsement.
--
-- `relationship` is the honest label you asked for: whether the voucher knows
-- this person or has only read their profile. Both are legitimate; the
-- employer is always told which. It is NOT NULL — there is no way to write a
-- vouch that stays silent about it.
--
-- `disclosed_fee_cents` records what this voucher stands to earn if the person
-- is hired. The employer sees it on the vouch itself.
create table public.vouches (
  id                     uuid primary key default gen_random_uuid(),
  intro_request_id       uuid not null unique references public.intro_requests (id) on delete cascade,
  -- Copied from the intro request by a trigger, so they can never disagree.
  job_id                 uuid not null references public.jobs (id) on delete cascade,
  seeker_id              uuid not null references public.users (id) on delete cascade,
  voucher_id             uuid not null references public.users (id) on delete cascade,
  relationship           public.vouch_relationship not null,
  -- 150 is a hard floor. The friendlier minimum lives in platform_settings.
  body                   text not null check (char_length(btrim(body)) >= 150),
  disclosed_fee_cents    int not null default 0 check (disclosed_fee_cents >= 0),
  withdrawn_at           timestamptz,
  created_at             timestamptz not null default now()
);

comment on column public.vouches.relationship is
  'Whether the voucher knows the seeker or only reviewed their profile. Always shown to employers.';

-- What the employer actually works with. Created automatically the moment a
-- vouch is written — which is what makes "employers only ever see vouched
-- candidates" true by construction rather than by remembering to filter.
--
-- The AI columns are advisory. The check constraint at the bottom makes it
-- physically impossible to store a score without its written reasoning.
create table public.applications (
  id                       uuid primary key default gen_random_uuid(),
  job_id                   uuid not null references public.jobs (id) on delete cascade,
  seeker_id                uuid not null references public.users (id) on delete cascade,
  vouch_id                 uuid not null unique references public.vouches (id) on delete cascade,
  status                   public.application_status not null default 'new',

  ai_fit_score             int check (ai_fit_score is null or ai_fit_score between 1 and 100),
  ai_reasoning             text,
  ai_scored_at             timestamptz,

  -- Every status change records the human who made it.
  last_status_changed_by   uuid references public.users (id) on delete set null,
  last_status_changed_at   timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (job_id, seeker_id),

  constraint ai_score_requires_reasoning check (
    ai_fit_score is null
    or (ai_reasoning is not null and char_length(btrim(ai_reasoning)) > 0)
  )
);

comment on constraint ai_score_requires_reasoning on public.applications is
  'LEGAL REQUIREMENT: an AI score may never be stored or shown without its written reasoning.';

comment on table public.applications is
  'Vouched candidates. The AI score is advisory only and must never auto-reject anyone; a human decides.';

-- A log of every status change: who moved it, when, from what to what.
-- Feeds dispute resolution and the retention maths in Step 2b.
create table public.application_events (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  from_status     public.application_status,
  to_status       public.application_status not null,
  changed_by      uuid references public.users (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. INDEXES
-- Indexes make the common lookups fast: "jobs at my company", "requests
-- waiting for me", "candidates for this job".
-- ---------------------------------------------------------------------------

create index company_domains_company_idx     on public.company_domains (company_id);
create index locations_company_idx           on public.locations (company_id);
create index company_members_user_idx        on public.company_members (user_id);
create index voucher_profiles_company_idx    on public.voucher_profiles (company_id);
create index voucher_invitations_email_idx   on public.voucher_invitations (email);
create index email_verifications_user_idx    on public.email_verifications (user_id);
create index jobs_company_status_idx         on public.jobs (company_id, status);
create index jobs_open_idx                   on public.jobs (created_at desc) where status = 'open';
create index intro_requests_job_idx          on public.intro_requests (job_id);
create index intro_requests_seeker_idx       on public.intro_requests (seeker_id);
create index intro_requests_pending_idx      on public.intro_requests (seeker_id) where status = 'pending';
create index vouches_voucher_idx             on public.vouches (voucher_id);
create index vouches_job_idx                 on public.vouches (job_id);
create index applications_job_status_idx     on public.applications (job_id, status);
create index applications_seeker_idx         on public.applications (seeker_id);
create index application_events_app_idx      on public.application_events (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. RULES THE DATABASE ENFORCES BY ITSELF
--
-- Everything below is a "trigger": a small piece of logic Postgres runs
-- automatically whenever a row is written. Rules that live here cannot be
-- forgotten by a future screen, skipped by a bug, or bypassed by someone
-- poking at the database directly.
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` honest on every table that has one.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_users_touch              before update on public.users              for each row execute function public.touch_updated_at();
create trigger trg_seeker_profiles_touch    before update on public.seeker_profiles    for each row execute function public.touch_updated_at();
create trigger trg_companies_touch          before update on public.companies          for each row execute function public.touch_updated_at();
create trigger trg_locations_touch          before update on public.locations          for each row execute function public.touch_updated_at();
create trigger trg_voucher_profiles_touch   before update on public.voucher_profiles   for each row execute function public.touch_updated_at();
create trigger trg_jobs_touch               before update on public.jobs               for each row execute function public.touch_updated_at();
create trigger trg_applications_touch       before update on public.applications       for each row execute function public.touch_updated_at();

-- --- Fee tier: derived from pay type, overridable, then frozen ---------------

-- Hourly work is Tier 1 ($500), salaried is Tier 2 ($2,000), unless someone
-- deliberately overrode it. The amounts come from platform_settings and are
-- copied onto the job so later pricing changes can't reach back in time.
create or replace function public.set_job_fee_snapshot()
returns trigger
language plpgsql
as $$
begin
  if not new.tier_overridden or new.fee_tier is null then
    new.fee_tier := case new.pay_type
                      when 'hourly'   then 'tier_1'::public.fee_tier
                      when 'salaried' then 'tier_2'::public.fee_tier
                    end;
  end if;

  if new.fee_amount_cents is null then
    new.fee_amount_cents := case new.fee_tier
                              when 'tier_1' then public.platform_setting_int('fee_tier_1_cents', 50000)
                              when 'tier_2' then public.platform_setting_int('fee_tier_2_cents', 200000)
                            end;
  end if;

  if new.voucher_share_bps is null then
    new.voucher_share_bps := public.platform_setting_int('voucher_share_bps', 5000);
  end if;

  return new;
end;
$$;

create trigger trg_jobs_fee_snapshot
  before insert on public.jobs
  for each row execute function public.set_job_fee_snapshot();

-- Once a job is live, its agreed price is settled.
create or replace function public.freeze_posted_job_fees()
returns trigger
language plpgsql
as $$
begin
  if old.posted_at is not null and (
       new.fee_tier          is distinct from old.fee_tier
    or new.fee_amount_cents  is distinct from old.fee_amount_cents
    or new.voucher_share_bps is distinct from old.voucher_share_bps
  ) then
    raise exception 'The fee on a posted job is frozen and cannot be changed. Close this job and post a new one instead.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_jobs_freeze_fees
  before update on public.jobs
  for each row execute function public.freeze_posted_job_fees();

-- --- Vouches: fill in, check eligibility, enforce the cap -------------------
-- These three run in name order (10, 20, 30), so the row is complete before
-- it gets checked.

-- Copy job and seeker from the intro request, and record what this voucher
-- stands to earn — the figure the employer is shown.
create or replace function public.fill_vouch_from_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id     uuid;
  v_seeker_id  uuid;
  v_fee        int;
  v_share_bps  int;
begin
  select ir.job_id, ir.seeker_id into v_job_id, v_seeker_id
  from public.intro_requests ir
  where ir.id = new.intro_request_id;

  if v_job_id is null then
    raise exception 'That intro request does not exist.' using errcode = 'foreign_key_violation';
  end if;

  new.job_id    := v_job_id;
  new.seeker_id := v_seeker_id;

  select j.fee_amount_cents, j.voucher_share_bps into v_fee, v_share_bps
  from public.jobs j where j.id = v_job_id;

  new.disclosed_fee_cents := (v_fee * v_share_bps) / 10000;

  return new;
end;
$$;

create trigger trg_vouch_10_fill
  before insert on public.vouches
  for each row execute function public.fill_vouch_from_request();

-- Only a verified voucher, and only for a job at their own company.
create or replace function public.check_vouch_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voucher_company  uuid;
  v_voucher_status   public.voucher_status;
  v_job_company      uuid;
  v_request_status   public.intro_request_status;
begin
  select vp.company_id, vp.status into v_voucher_company, v_voucher_status
  from public.voucher_profiles vp where vp.user_id = new.voucher_id;

  if v_voucher_company is null then
    raise exception 'Only vouchers can write vouches.' using errcode = 'check_violation';
  end if;

  if v_voucher_status <> 'verified' then
    raise exception 'This voucher is not verified yet, so they cannot vouch for anyone.'
      using errcode = 'check_violation';
  end if;

  select j.company_id into v_job_company from public.jobs j where j.id = new.job_id;

  if v_job_company is distinct from v_voucher_company then
    raise exception 'A voucher can only vouch for jobs at their own company.'
      using errcode = 'check_violation';
  end if;

  select ir.status into v_request_status
  from public.intro_requests ir where ir.id = new.intro_request_id;

  if v_request_status <> 'pending' then
    raise exception 'That intro request is no longer open (it is %).', v_request_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_vouch_20_eligibility
  before insert on public.vouches
  for each row execute function public.check_vouch_eligibility();

-- Cap on how many unresolved vouches one voucher may have running.
-- "Unresolved" means the candidate hasn't been hired or passed on yet.
create or replace function public.enforce_voucher_vouch_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap  int := public.platform_setting_int('max_open_vouches_per_voucher', 5);
  v_open int;
begin
  select count(*) into v_open
  from public.vouches v
  left join public.applications a on a.vouch_id = v.id
  where v.voucher_id = new.voucher_id
    and v.withdrawn_at is null
    and (a.status is null or a.status not in ('hired', 'passed'));

  if v_open >= v_cap then
    raise exception 'You already have % open vouches, which is the limit of %. Wait for one to be resolved.', v_open, v_cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_vouch_30_cap
  before insert on public.vouches
  for each row execute function public.enforce_voucher_vouch_cap();

-- Cap on how many intro requests a seeker may have waiting at once.
create or replace function public.enforce_seeker_request_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap  int := public.platform_setting_int('max_open_intro_requests_per_seeker', 5);
  v_open int;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select count(*) into v_open
  from public.intro_requests ir
  where ir.seeker_id = new.seeker_id
    and ir.status = 'pending'
    and ir.id <> new.id;

  if v_open >= v_cap then
    raise exception 'You already have % open intro requests, which is the limit of %. Withdraw one before asking for another.', v_open, v_cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_intro_request_cap
  before insert or update of status on public.intro_requests
  for each row execute function public.enforce_seeker_request_cap();

-- --- A vouch creates the employer's candidate record ------------------------

create or replace function public.create_application_for_vouch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.applications (job_id, seeker_id, vouch_id)
  values (new.job_id, new.seeker_id, new.id)
  on conflict (job_id, seeker_id) do update set vouch_id = excluded.vouch_id;

  update public.intro_requests
     set status = 'vouched',
         claimed_by = new.voucher_id,
         responded_at = now()
   where id = new.intro_request_id;

  return new;
end;
$$;

create trigger trg_vouch_creates_application
  after insert on public.vouches
  for each row execute function public.create_application_for_vouch();

-- --- Every status change is logged -----------------------------------------

create or replace function public.log_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.last_status_changed_by);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.application_events (application_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, new.last_status_changed_by);
  end if;

  return new;
end;
$$;

create trigger trg_application_status_log
  after insert or update of status on public.applications
  for each row execute function public.log_application_status_change();

-- Records when a status last moved.
create or replace function public.stamp_application_status_time()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.last_status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_application_status_stamp
  before update on public.applications
  for each row execute function public.stamp_application_status_time();

-- ---------------------------------------------------------------------------
-- 10. VOUCHERS CANNOT VERIFY THEMSELVES
--
-- A voucher is allowed to edit their own profile (job title, branch), but the
-- fields that decide whether they may vouch at all — and whether they may be
-- paid — must only ever be changed by Vouch's own server code. Without this,
-- anyone could sign up, set their own status to 'verified', and start vouching.
--
-- `current_user` is 'service_role' when the change comes from our server using
-- the secret key, and 'postgres' when it comes from the Supabase SQL Editor.
-- Anything else is an ordinary logged-in person.
-- ---------------------------------------------------------------------------

create or replace function public.protect_voucher_verification()
returns trigger
language plpgsql
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  if v_trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Anyone may create their own voucher profile, but it starts unverified.
    if new.status <> 'unverified'
       or new.verified_at is not null
       or new.identity_verified_at is not null then
      raise exception 'A new voucher profile always starts unverified.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status                is distinct from old.status
  or new.verified_at           is distinct from old.verified_at
  or new.verification_method   is distinct from old.verification_method
  or new.identity_verified_at  is distinct from old.identity_verified_at
  or new.tax_info_collected_at is distinct from old.tax_info_collected_at
  or new.payout_account_id     is distinct from old.payout_account_id
  or new.company_id            is distinct from old.company_id then
    raise exception 'Verification and payout details can only be changed by Vouch, not by the voucher.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_voucher_protect_verification
  before insert or update on public.voucher_profiles
  for each row execute function public.protect_voucher_verification();
