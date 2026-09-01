-- ===========================================================================
-- Vouch — Step 9b: collecting the fee when both sides confirm a hire
--
-- WHAT ALREADY HAPPENS
-- When a hire reaches 'confirmed', `open_money_for_hire()` raises a row in
-- employer_charges for the full fee, spends any credits the company is
-- carrying, and schedules the voucher's payout. None of that changes.
--
-- WHAT THIS ADDS
-- The bit where money actually moves, and the rule that keeps it honest:
--
--   **NO MONEY LEAVES UNTIL MONEY ARRIVED.**
--
-- Until now a payout could release on day 60 whether or not the employer's
-- card had ever been charged. Vouch would have paid the voucher its own money
-- and been left chasing an employer who might decline. `release_due_payouts`
-- now refuses to release against an unsettled charge, and says so.
--
-- A charge is settled when it is 'paid' (money arrived), 'credited' (covered
-- by an early-departure credit, so no money was due), or 'waived' (a person
-- here decided not to collect). 'pending' and 'processing' are not settled.
-- A US bank debit sits in 'processing' for days, which is exactly the window
-- this rule exists to cover.
-- ===========================================================================

-- A bank debit is neither pending nor paid for several days. Added outside the
-- transaction below and deliberately not used anywhere in this file — a new
-- enum value cannot be used in the transaction that creates it.
alter type public.charge_status add value if not exists 'processing';

begin;

-- ---------------------------------------------------------------------------
-- 1. WHAT WE KNOW ABOUT AN ATTEMPT TO COLLECT
-- ---------------------------------------------------------------------------

alter table public.employer_charges
  -- What we actually try to collect: the fee, less any credit already spent
  -- on it. Generated, so it can never drift from the two numbers it comes from.
  add column net_amount_cents int generated always as
    (greatest(amount_cents - credit_applied_cents, 0)) stored,
  add column attempted_at   timestamptz,
  add column attempt_count  int not null default 0,
  -- Stripe's own words when a charge fails, kept so the employer can be told
  -- something better than "payment failed".
  add column last_error     text;

comment on column public.employer_charges.net_amount_cents is
  'The fee less credits already applied. This is the figure actually charged.';

comment on column public.employer_charges.last_error is
  'Stripe''s reason for the most recent failure. Shown to the employer so they can fix it.';

-- ---------------------------------------------------------------------------
-- 2. NOBODY MARKS THEIR OWN BILL PAID
--
-- employer_charges has a SELECT policy and nothing else, so RLS already blocks
-- every write from a login. This trigger is the second lock: if anyone ever
-- adds an UPDATE policy to this table for convenience, the money still cannot
-- be touched from a session that isn't Vouch's own server.
-- ---------------------------------------------------------------------------

create or replace function public.protect_employer_charge()
returns trigger
language plpgsql
-- NOT `security definer` — under it current_user becomes this function's
-- owner and every caller looks trusted. Same trap as 0009 and 0010.
set search_path = ''
as $$
begin
  if current_user in ('service_role', 'postgres') then
    -- In a BEFORE DELETE trigger NEW is null, and returning null CANCELS the
    -- delete. `return new` here silently suppressed every cascade — deleting a
    -- company or an account left its charge rows behind as orphans, which
    -- breaks the promise that deleting an account erases everything.
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'A charge is recorded by Vouch, not by the person paying it.'
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.protect_employer_charge() is
  'Charges are written only by Vouch''s own server. An employer cannot mark their own fee paid, waived, or cancelled.';

create trigger trg_charges_protect
  before insert or update or delete on public.employer_charges
  for each row execute function public.protect_employer_charge();

-- ---------------------------------------------------------------------------
-- 3. IS THIS CHARGE SETTLED?
--
-- One definition, used by the release job and by the app, so the two can never
-- disagree about whether an employer has actually paid.
-- ---------------------------------------------------------------------------

create or replace function public.charge_is_settled(p_hire_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employer_charges c
     where c.hire_id = p_hire_id
       and c.status in ('paid', 'credited', 'waived')
  );
$$;

comment on function public.charge_is_settled(uuid) is
  'True when the employer''s fee has arrived, was covered by credit, or was waived by a person. Gates every payout.';

-- ---------------------------------------------------------------------------
-- 4. NO MONEY OUT BEFORE MONEY IN
--
-- The only change from the 0009 version is the settled-charge condition, and
-- a hold that explains itself rather than leaving a payout silently stuck.
-- ---------------------------------------------------------------------------

create or replace function public.release_due_payouts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold int := public.platform_setting_int('payout_hold_days', 60);
  n int;
begin
  -- Waiting on identity and tax details.
  update public.payouts p
     set status = 'held',
         hold_reason = 'Waiting on identity and tax verification.'
    from public.voucher_profiles vp
   where vp.user_id = p.voucher_id
     and p.status = 'scheduled'
     and p.release_at <= current_date
     and (vp.identity_verified_at is null or vp.tax_info_collected_at is null);

  -- Waiting on the two sides to agree about whether the job ended.
  update public.payouts p
     set status = 'held',
         hold_reason = 'Somebody has reported that this job ended. Held until both sides agree, or a person settles it.'
    from public.hires h
   where h.id = p.hire_id
     and p.status = 'scheduled'
     and p.release_at <= current_date
     and h.separated_at is null
     and h.separation_reported_at is not null;

  -- NEW: waiting on the employer's money to actually arrive.
  update public.payouts p
     set status = 'held',
         hold_reason = 'The employer''s fee has not been collected yet. Nothing is paid out until it has.'
   where p.status = 'scheduled'
     and p.release_at <= current_date
     and not public.charge_is_settled(p.hire_id);

  with released as (
    update public.payouts p
       set status = 'released', released_at = now(), hold_reason = null
      from public.voucher_profiles vp, public.hires h
     where vp.user_id = p.voucher_id
       and h.id = p.hire_id
       and p.status = 'scheduled'
       and p.release_at <= current_date
       and h.status = 'confirmed'
       and h.separation_reported_at is null
       and (h.separated_at is null or h.separated_at >= h.start_date + v_hold)
       and vp.identity_verified_at is not null
       and vp.tax_info_collected_at is not null
       -- The rule this migration exists for.
       and public.charge_is_settled(p.hire_id)
    returning 1
  )
  select count(*) into n from released;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. A HELD PAYOUT GOES BACK IN THE QUEUE WHEN ITS BLOCKER CLEARS
--
-- Without this, a payout held because the card had not been charged stays
-- held forever, even after the employer pays. Held is a waiting room, not a
-- verdict.
-- ---------------------------------------------------------------------------

create or replace function public.unhold_settled_payouts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  with freed as (
    update public.payouts p
       set status = 'scheduled', hold_reason = null
      from public.voucher_profiles vp, public.hires h
     where vp.user_id = p.voucher_id
       and h.id = p.hire_id
       and p.status = 'held'
       and h.status = 'confirmed'
       and h.separation_reported_at is null
       and (h.separated_at is null or h.separated_at >= h.start_date + public.platform_setting_int('payout_hold_days', 60))
       and vp.identity_verified_at is not null
       and vp.tax_info_collected_at is not null
       and public.charge_is_settled(p.hire_id)
    returning 1
  )
  select count(*) into n from freed;
  return n;
end;
$$;

comment on function public.unhold_settled_payouts() is
  'Returns held payouts to the queue once whatever blocked them is resolved. Held is a waiting room, not a verdict.';

revoke execute on function public.unhold_settled_payouts() from authenticated;

commit;
