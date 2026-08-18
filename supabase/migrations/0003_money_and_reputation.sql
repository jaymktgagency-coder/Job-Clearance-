-- ===========================================================================
-- Vouch — Step 2b: money, reputation, and two-tier business verification
--
-- WHAT THIS FILE IS
-- Step 2a built the people and the hiring flow. This adds what happens after
-- someone is actually hired: who owes what, who gets paid when, and the
-- public track record a voucher builds up.
--
-- It also replaces the single green checkmark with two badges, so a business
-- that runs on a free email address can still look legitimate.
--
-- Money is still STUBBED: these tables record what is owed and when it
-- releases, but no payment provider is called. Stripe arrives later.
-- ===========================================================================

begin;
-- ---------------------------------------------------------------------------
-- 1. TWO-TIER BUSINESS VERIFICATION
--
-- The old rule ("green checkmark = verified domain + payment method") locked
-- out every business running on Gmail — which is most of the hourly and
-- service employers this product exists to serve. Replaced with two badges:
--
--   Verified Business  = payment method on file + business registration checked
--   Verified Domain    = all of the above, PLUS a proven company email domain
--
-- Both are real badges. Domain is not "better", it is "also owns a domain we
-- checked" — which is what makes work-email voucher verification possible.
-- ---------------------------------------------------------------------------

create type public.company_verification_tier as enum (
  'none',       -- hasn't completed either
  'business',   -- Verified Business
  'domain'      -- Verified Business + Verified Domain
);

-- The old single checkmark goes away.
alter table public.companies drop column if exists is_verified;

alter table public.companies
  add column business_registration_verified_at timestamptz,
  -- Free-text so it fits any country's registry (EIN, company number, etc.).
  add column business_registration_reference text;

-- Computed, never set by hand — same guarantee the old checkmark had.
alter table public.companies
  add column verification_tier public.company_verification_tier
    generated always as (
      case
        when payment_method_on_file
         and business_registration_verified_at is not null
         and domain_verified_at is not null then 'domain'::public.company_verification_tier
        when payment_method_on_file
         and business_registration_verified_at is not null then 'business'::public.company_verification_tier
        else 'none'::public.company_verification_tier
      end
    ) stored;

comment on column public.companies.verification_tier is
  'Computed badge. "business" = payment method + registration. "domain" = both of those plus a proven email domain. Cannot be set by hand.';

comment on column public.companies.business_registration_reference is
  'Whatever the registry calls it — EIN, company number, ABN. Stored for the record, not validated here.';

-- Work-email voucher verification still needs a proven domain, so it stays
-- tied to the domain tier. A "business" tier company invites its vouchers
-- instead, which is exactly what the invite path is for.

-- ---------------------------------------------------------------------------
-- 2. LISTS OF ALLOWED VALUES FOR THE MONEY TABLES
-- ---------------------------------------------------------------------------

create type public.hire_status as enum (
  'reported',   -- somebody said a hire happened; not yet agreed by both sides
  'confirmed',  -- seeker AND employer both confirmed; the clock starts
  'disputed',   -- the two sides disagree; a human sorts it out
  'cancelled'   -- withdrawn or found to be untrue
);

create type public.payout_status as enum (
  'scheduled',  -- confirmed hire, waiting out the 60 days
  'held',       -- blocked: identity or tax details missing, or under review
  'released',   -- the hold is over and it is approved to pay
  'paid',       -- money actually sent (Stripe, later)
  'cancelled'   -- the hire fell through, or they left early
);

create type public.charge_status as enum (
  'pending',    -- owed by the employer
  'paid',
  'credited',   -- settled using an existing credit
  'waived',
  'cancelled'
);

create type public.abuse_subject as enum ('voucher', 'seeker', 'company');

create type public.abuse_reason as enum (
  'high_volume',        -- far more vouches than anyone else
  'poor_retention',     -- their hires keep leaving
  'duplicate_content',  -- the same vouch text over and over
  'self_dealing',       -- signs of vouching for themselves or a ring
  'manual_report'       -- a person reported them
);

-- ---------------------------------------------------------------------------
-- 3. HIRES — the money event
--
-- Nothing is owed and nothing is payable until a row here reaches 'confirmed'.
-- Confirmation takes BOTH the seeker and the employer, because the employer
-- alone has a $500–$2,000 reason to stay quiet, and the seeker alone has no
-- way to prove it. A seeker confirming on their own opens a dispute instead.
-- ---------------------------------------------------------------------------

create table public.hires (
  id                        uuid primary key default gen_random_uuid(),
  application_id            uuid not null unique references public.applications (id) on delete cascade,
  -- Copied at confirmation so later edits can never move the money.
  job_id                    uuid not null references public.jobs (id) on delete cascade,
  seeker_id                 uuid not null references public.users (id) on delete cascade,
  voucher_id                uuid not null references public.users (id) on delete cascade,
  company_id                uuid not null references public.companies (id) on delete cascade,

  start_date                date not null,
  status                    public.hire_status not null default 'reported',

  confirmed_by_employer_at  timestamptz,
  confirmed_by_seeker_at    timestamptz,
  confirmed_at              timestamptz,
  disputed_at               timestamptz,
  dispute_note              text,
  cancelled_at              timestamptz,

  -- Frozen money terms, copied from the job.
  fee_amount_cents          int not null check (fee_amount_cents > 0),
  voucher_amount_cents      int not null check (voucher_amount_cents >= 0),

  -- start_date + payout_hold_days. Filled in on confirmation.
  payout_due_at             date,

  -- Retention, which drives both the payout and the voucher's public record.
  separated_at              date,
  still_employed_at_60d     boolean,
  retention_checked_at      timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint separation_after_start check (separated_at is null or separated_at >= start_date)
);

comment on table public.hires is
  'A confirmed hire is the only thing that makes money owed. Requires both the seeker and the employer to confirm.';

-- ---------------------------------------------------------------------------
-- 4. EMPLOYER CHARGES — what the employer owes
-- ---------------------------------------------------------------------------

create table public.employer_charges (
  id                       uuid primary key default gen_random_uuid(),
  hire_id                  uuid not null unique references public.hires (id) on delete cascade,
  company_id               uuid not null references public.companies (id) on delete cascade,
  amount_cents             int not null check (amount_cents >= 0),
  -- How much of this was settled with a credit rather than new money.
  credit_applied_cents     int not null default 0 check (credit_applied_cents >= 0),
  status                   public.charge_status not null default 'pending',
  paid_at                  timestamptz,
  -- Stripe, later. Empty in v1.
  stripe_payment_intent_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. EMPLOYER CREDITS — the early-departure remedy
--
-- If the person leaves inside the early-departure window, the employer does
-- NOT get cash back. They get a credit toward their next hire. This table is
-- the ledger: one row per credit, marked off when it gets used.
-- ---------------------------------------------------------------------------

create table public.employer_credits (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  amount_cents      int not null check (amount_cents > 0),
  -- The hire that went wrong, and the hire this credit was later spent on.
  source_hire_id    uuid references public.hires (id) on delete set null,
  consumed_by_hire_id uuid references public.hires (id) on delete set null,
  consumed_at       timestamptz,
  note              text,
  created_at        timestamptz not null default now()
);

comment on table public.employer_credits is
  'Credit toward a future hire when someone leaves early. Never a cash refund.';

-- ---------------------------------------------------------------------------
-- 6. PAYOUTS — what the voucher is owed
--
-- Released 60 days after the start date, not at hire. That delay is the whole
-- anti-abuse mechanism: vouching for a stranger who does not last costs the
-- voucher the money and their retention record.
-- ---------------------------------------------------------------------------

create table public.payouts (
  id                  uuid primary key default gen_random_uuid(),
  hire_id             uuid not null unique references public.hires (id) on delete cascade,
  voucher_id          uuid not null references public.users (id) on delete cascade,
  amount_cents        int not null check (amount_cents >= 0),
  status              public.payout_status not null default 'scheduled',
  -- The date the hold expires. Copied from the hire.
  release_at          date,
  released_at         timestamptz,
  paid_at             timestamptz,
  hold_reason         text,
  -- Stripe Connect, later. Empty in v1.
  stripe_transfer_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. ABUSE FLAGS
-- ---------------------------------------------------------------------------

create table public.abuse_flags (
  id            uuid primary key default gen_random_uuid(),
  subject_type  public.abuse_subject not null,
  subject_id    uuid not null,
  reason        public.abuse_reason not null,
  severity      int not null default 1 check (severity between 1 and 3),
  details       jsonb,
  opened_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.users (id) on delete set null,
  resolution    text
);

comment on table public.abuse_flags is
  'Accounts needing a human look. Nothing here is automatic punishment — a person decides.';

create index abuse_flags_open_idx on public.abuse_flags (subject_type, subject_id) where resolved_at is null;
create index hires_company_idx    on public.hires (company_id);
create index hires_voucher_idx    on public.hires (voucher_id);
create index hires_due_idx        on public.hires (payout_due_at) where status = 'confirmed';
create index payouts_voucher_idx  on public.payouts (voucher_id);
create index payouts_due_idx      on public.payouts (release_at) where status = 'scheduled';
create index charges_company_idx  on public.employer_charges (company_id);
create index credits_unused_idx   on public.employer_credits (company_id) where consumed_at is null;

-- ---------------------------------------------------------------------------
-- 8. NEW SETTINGS
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, note) values
  ('hire_dispute_after_days',        to_jsonb(7),  'If a seeker confirms a hire and the employer does not within this many days, it becomes a dispute.'),
  ('min_hires_for_retention_pct',    to_jsonb(5),  'Below this many completed hires, a voucher shows raw counts only — no percentage.');

-- ---------------------------------------------------------------------------
-- 9. RULES THE DATABASE ENFORCES
-- ---------------------------------------------------------------------------

create trigger trg_hires_touch             before update on public.hires             for each row execute function public.touch_updated_at();
create trigger trg_charges_touch           before update on public.employer_charges  for each row execute function public.touch_updated_at();
create trigger trg_payouts_touch           before update on public.payouts           for each row execute function public.touch_updated_at();

-- --- A hire copies its money terms from the job it came from ---------------

create or replace function public.fill_hire_from_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
begin
  select ap.job_id, ap.seeker_id, v.voucher_id, j.company_id,
         j.fee_amount_cents, j.voucher_share_bps
    into a
  from public.applications ap
  join public.vouches v on v.id = ap.vouch_id
  join public.jobs j on j.id = ap.job_id
  where ap.id = new.application_id;

  if a.job_id is null then
    raise exception 'That application does not exist, or has no vouch attached.'
      using errcode = 'foreign_key_violation';
  end if;

  new.job_id     := a.job_id;
  new.seeker_id  := a.seeker_id;
  new.voucher_id := a.voucher_id;
  new.company_id := a.company_id;

  new.fee_amount_cents     := a.fee_amount_cents;
  new.voucher_amount_cents := (a.fee_amount_cents * a.voucher_share_bps) / 10000;

  return new;
end;
$$;

create trigger trg_hire_10_fill
  before insert on public.hires
  for each row execute function public.fill_hire_from_application();

-- --- Both sides must confirm before anything is owed ------------------------

create or replace function public.settle_hire_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold_days int := public.platform_setting_int('payout_hold_days', 60);
begin
  -- Only a hire both sides agree on becomes 'confirmed'.
  if new.status = 'reported'
     and new.confirmed_by_employer_at is not null
     and new.confirmed_by_seeker_at is not null then
    new.status        := 'confirmed';
    new.confirmed_at  := now();
    new.payout_due_at := new.start_date + v_hold_days;
  end if;
  return new;
end;
$$;

create trigger trg_hire_20_confirm
  before insert or update on public.hires
  for each row execute function public.settle_hire_confirmation();

-- --- Confirmation creates the charge and the scheduled payout --------------

create or replace function public.open_money_for_hire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining int;
  v_applied   int := 0;
  c           record;
  v_take      int;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status = 'confirmed') then
    return new;
  end if;

  -- What the voucher is owed, held until the 60 days are up.
  insert into public.payouts (hire_id, voucher_id, amount_cents, release_at)
  values (new.id, new.voucher_id, new.voucher_amount_cents, new.payout_due_at)
  on conflict (hire_id) do nothing;

  -- What the employer owes, minus any credit they are carrying from a hire
  -- that ended early. Credits are spent oldest first.
  v_remaining := new.fee_amount_cents;

  for c in
    select * from public.employer_credits
    where company_id = new.company_id and consumed_at is null
    order by created_at
  loop
    exit when v_remaining <= 0;

    if c.amount_cents <= v_remaining then
      v_take := c.amount_cents;
      update public.employer_credits
         set consumed_at = now(), consumed_by_hire_id = new.id
       where id = c.id;
    else
      -- Credit is bigger than the bill: spend part, leave the rest behind.
      v_take := v_remaining;
      update public.employer_credits
         set amount_cents = c.amount_cents - v_take
       where id = c.id;
      insert into public.employer_credits (company_id, amount_cents, source_hire_id, consumed_by_hire_id, consumed_at, note)
      values (new.company_id, v_take, c.source_hire_id, new.id, now(), 'partial use of an earlier credit');
    end if;

    v_applied   := v_applied + v_take;
    v_remaining := v_remaining - v_take;
  end loop;

  insert into public.employer_charges (hire_id, company_id, amount_cents, credit_applied_cents, status)
  values (new.id, new.company_id, new.fee_amount_cents, v_applied,
          case when v_remaining <= 0 then 'credited'::public.charge_status
               else 'pending'::public.charge_status end)
  on conflict (hire_id) do nothing;

  -- Keep the candidate record in step with reality.
  update public.applications
     set status = 'hired'
   where id = new.application_id and status <> 'hired';

  return new;
end;
$$;

create trigger trg_hire_30_open_money
  after insert or update on public.hires
  for each row execute function public.open_money_for_hire();

-- --- Someone leaving early cancels the payout and credits the employer -----

create or replace function public.handle_hire_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_early_days  int := public.platform_setting_int('early_departure_days', 30);
  v_credit_bps  int := public.platform_setting_int('early_departure_credit_bps', 5000);
  v_hold_days   int := public.platform_setting_int('payout_hold_days', 60);
  v_days        int;
begin
  if new.separated_at is null or old.separated_at is not null then
    return new;
  end if;

  v_days := new.separated_at - new.start_date;

  -- Left before the hold was up: the voucher is not paid. This is the whole
  -- point of the delay.
  if v_days < v_hold_days then
    update public.payouts
       set status = 'cancelled',
           hold_reason = 'The hire left after ' || v_days || ' days, before the ' || v_hold_days || '-day hold ended.'
     where hire_id = new.id
       and status in ('scheduled', 'held');
    new.still_employed_at_60d := false;
    new.retention_checked_at  := now();
  end if;

  -- Left inside the early window: the employer earns a credit toward their
  -- next hire. Never a cash refund.
  if v_days < v_early_days then
    insert into public.employer_credits (company_id, amount_cents, source_hire_id, note)
    values (new.company_id,
            (new.fee_amount_cents * v_credit_bps) / 10000,
            new.id,
            'Hire left after ' || v_days || ' days (inside the ' || v_early_days || '-day window).');
  end if;

  return new;
end;
$$;

create trigger trg_hire_40_separation
  before update on public.hires
  for each row execute function public.handle_hire_separation();

-- --- No payout without identity and tax details ----------------------------

create or replace function public.guard_payout_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vp record;
begin
  if new.status not in ('released', 'paid') then
    return new;
  end if;

  select identity_verified_at, tax_info_collected_at
    into vp
  from public.voucher_profiles where user_id = new.voucher_id;

  if vp.identity_verified_at is null or vp.tax_info_collected_at is null then
    raise exception 'This voucher has not completed identity and tax verification, so no money can be released to them.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_payout_guard_release
  before update on public.payouts
  for each row execute function public.guard_payout_release();

-- ---------------------------------------------------------------------------
-- 10. JOBS THAT RUN ON A SCHEDULE
-- Called by a timer later. Written as functions so they are testable now.
-- ---------------------------------------------------------------------------

-- Marks whether each hire was still employed at the 60-day mark.
create or replace function public.check_hire_retention()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold int := public.platform_setting_int('payout_hold_days', 60);
  n int;
begin
  with done as (
    update public.hires h
       set still_employed_at_60d = (h.separated_at is null or h.separated_at >= h.start_date + v_hold),
           retention_checked_at  = now()
     where h.status = 'confirmed'
       and h.retention_checked_at is null
       and current_date >= h.start_date + v_hold
    returning 1
  )
  select count(*) into n from done;
  return n;
end;
$$;

-- Releases payouts whose hold has expired, holding back anyone who still
-- has not completed identity and tax verification.
create or replace function public.release_due_payouts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.payouts p
     set status = 'held',
         hold_reason = 'Waiting on identity and tax verification.'
    from public.voucher_profiles vp
   where vp.user_id = p.voucher_id
     and p.status = 'scheduled'
     and p.release_at <= current_date
     and (vp.identity_verified_at is null or vp.tax_info_collected_at is null);

  with released as (
    update public.payouts p
       set status = 'released', released_at = now(), hold_reason = null
      from public.voucher_profiles vp, public.hires h
     where vp.user_id = p.voucher_id
       and h.id = p.hire_id
       and p.status = 'scheduled'
       and p.release_at <= current_date
       and h.status = 'confirmed'
       and h.separated_at is null
       and vp.identity_verified_at is not null
       and vp.tax_info_collected_at is not null
    returning 1
  )
  select count(*) into n from released;
  return n;
end;
$$;

-- Opens a dispute when a seeker says they were hired and the employer has
-- neither agreed nor disagreed within the grace period.
create or replace function public.open_stale_hire_disputes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int := public.platform_setting_int('hire_dispute_after_days', 7);
  n int;
begin
  with opened as (
    update public.hires
       set status = 'disputed',
           disputed_at = now(),
           dispute_note = 'The seeker reported this hire; the employer did not respond within ' || v_days || ' days.'
     where status = 'reported'
       and confirmed_by_seeker_at is not null
       and confirmed_by_employer_at is null
       and confirmed_by_seeker_at < now() - (v_days || ' days')::interval
    returning 1
  )
  select count(*) into n from opened;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. VOUCHER REPUTATION — a saved query, not a table
--
-- Computed live from hires, so the numbers can never drift out of sync with
-- reality the way stored counters do.
--
-- Raw counts are always shown. The retention PERCENTAGE is deliberately null
-- until a voucher has enough completed hires to make a percentage meaningful:
-- one hire who quit should not read as "0% retention" forever.
-- ---------------------------------------------------------------------------

create view public.voucher_reputation
with (security_invoker = on) as
select
  vp.user_id as voucher_id,
  vp.company_id,
  count(distinct v.id) filter (where v.withdrawn_at is null)          as vouches_written,
  count(distinct h.id) filter (where h.status = 'confirmed')          as hires_resulting,
  count(distinct h.id) filter (where h.status = 'confirmed'
                                and h.retention_checked_at is not null) as hires_measured,
  count(distinct h.id) filter (where h.status = 'confirmed'
                                and h.still_employed_at_60d)          as hires_still_employed,
  case
    when count(distinct h.id) filter (where h.status = 'confirmed'
                                       and h.retention_checked_at is not null)
         >= public.platform_setting_int('min_hires_for_retention_pct', 5)
    then round(
      100.0 * count(distinct h.id) filter (where h.status = 'confirmed' and h.still_employed_at_60d)
            / nullif(count(distinct h.id) filter (where h.status = 'confirmed'
                                                   and h.retention_checked_at is not null), 0)
    )
  end as retention_pct,
  min(v.created_at) as first_vouch_at
from public.voucher_profiles vp
left join public.vouches v on v.voucher_id = vp.user_id
left join public.hires   h on h.voucher_id = vp.user_id
group by vp.user_id, vp.company_id;

comment on view public.voucher_reputation is
  'A voucher public track record. retention_pct stays null until there are enough measured hires for a percentage to mean anything.';

commit;
