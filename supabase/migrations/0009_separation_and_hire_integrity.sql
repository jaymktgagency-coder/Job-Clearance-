-- ===========================================================================
-- Vouch — leaving a job, and who is allowed to say what about a hire
--
-- TWO PROBLEMS, ONE FILE.
--
-- PROBLEM 1: nothing ever recorded that someone left.
-- `hires.separated_at` existed and no screen wrote to it. Every payout would
-- have released at 60 days whether or not the person was still there — the
-- entire reason for the 60-day hold, silently absent. This adds the flow:
-- either side reports it, the other confirms, and seven days of silence
-- becomes a dispute for a human. Same shape as confirming the hire itself,
-- and for the same reason: whoever benefits shouldn't get to decide alone.
--
-- PROBLEM 2: either side could rewrite the money.
-- Both the employer and the seeker can update their own hire row — they have
-- to, that is how each confirms their half. But nothing said WHICH columns.
-- Proven against a real database, from an ordinary login:
--
--   * an employer reported a hire and wrote the seeker's confirmation
--     themselves. The hire went 'confirmed', a charge and a payout opened,
--     and the person supposedly hired was never asked.
--   * an employer declared the hire left on day 5. The voucher's $250 payout
--     was cancelled and a $250 credit was issued to the employer, on the say-so
--     of the one party with $250 of reason to say it.
--   * an employer rewrote the fee on a confirmed hire to one cent.
--   * a seeker moved the start date 400 days into the past.
--
-- From here, each side may write only its own half, and only the platform
-- moves anything that costs money.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. SETTINGS — every number stays a setting, never a constant in code
-- ---------------------------------------------------------------------------

-- Settings are versioned by `effective_from`, so a plain insert would stack a
-- second copy every time this file runs. Only add them if they aren't there.
insert into public.platform_settings (key, value, note)
select v.key, v.value, v.note
from (values
  ('separation_dispute_after_days', to_jsonb(7),
   'One side says the hire ended; if the other neither agrees nor disagrees within this many days, it becomes a dispute.'),
  ('credit_valid_days', to_jsonb(365),
   'How long an early-departure credit can be spent before it lapses. An open-ended credit is an open-ended liability.')
) as v(key, value, note)
where not exists (select 1 from public.platform_settings ps where ps.key = v.key);

-- ---------------------------------------------------------------------------
-- 2. SAYING THAT A HIRE ENDED
--
-- `separated_at` stays the single fact everything else keys off — the payout
-- cancellation, the employer's credit, the voucher's retention record. What
-- changes is that nobody can write it directly any more. It is now filled in
-- by this file, once, when both sides have agreed on a date.
-- ---------------------------------------------------------------------------

alter table public.hires
  add column separation_reported_by                 uuid references public.users (id) on delete set null,
  add column separation_reported_at                 timestamptz,
  -- The date being claimed. Becomes `separated_at` only once both sides agree.
  add column separation_claimed_date                date,
  add column separation_confirmed_by_employer_at    timestamptz,
  add column separation_confirmed_by_seeker_at      timestamptz,
  add column separation_disputed_at                 timestamptz,
  add column separation_dispute_note                text;

comment on column public.hires.separation_claimed_date is
  'The last day worked, as claimed by whoever reported it. Only becomes separated_at once the other side agrees.';

alter table public.hires
  add constraint separation_claim_after_start
    check (separation_claimed_date is null or separation_claimed_date >= start_date);

create index hires_separation_open_idx on public.hires (separation_reported_at)
  where separation_reported_at is not null and separated_at is null and separation_disputed_at is null;

-- --- Both sides agreeing is what makes it real ------------------------------

create or replace function public.settle_separation_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nothing to settle unless a date has been claimed and is still unresolved.
  if new.separation_claimed_date is null or new.separated_at is not null then
    return new;
  end if;

  if new.separation_confirmed_by_employer_at is not null
     and new.separation_confirmed_by_seeker_at is not null then
    -- Agreed. This is the line that cancels the payout and credits the
    -- employer, by way of the separation trigger that runs straight after.
    new.separated_at           := new.separation_claimed_date;
    new.separation_disputed_at := null;
  end if;

  return new;
end;
$$;

comment on function public.settle_separation_confirmation() is
  'A hire has only ended when both sides say it ended. One side alone cannot cancel a payout or earn a credit.';

-- Runs before trg_hire_40_separation, which is what acts on separated_at.
-- Postgres fires same-event triggers in name order, so 35 beats 40.
create trigger trg_hire_35_separation_confirm
  before update on public.hires
  for each row execute function public.settle_separation_confirmation();

-- --- Silence becomes a dispute, not a default ------------------------------

create or replace function public.open_stale_separation_disputes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int := public.platform_setting_int('separation_dispute_after_days', 7);
  n int;
begin
  with opened as (
    update public.hires
       set separation_disputed_at = now(),
           separation_dispute_note =
             'One side reported that this hire ended; the other did not respond within '
             || v_days || ' days.'
     where separated_at is null
       and separation_disputed_at is null
       and separation_reported_at is not null
       and separation_reported_at < now() - (v_days || ' days')::interval
       and (separation_confirmed_by_employer_at is null
            or separation_confirmed_by_seeker_at is null)
    returning 1
  )
  select count(*) into n from opened;
  return n;
end;
$$;

comment on function public.open_stale_separation_disputes() is
  'Unanswered separation reports become disputes for a person to look at. Nothing is decided by silence.';

-- ---------------------------------------------------------------------------
-- 3. WHO MAY WRITE WHAT ON A HIRE
--
-- Both sides legitimately update this row: each confirms their own half. What
-- follows is the list of what that permission does NOT extend to.
-- ---------------------------------------------------------------------------

create or replace function public.protect_hire_columns()
returns trigger
language plpgsql
-- Deliberately NOT `security definer`. These checks turn on `current_user`
-- being the person making the request; under `security definer` current_user
-- is this function's owner instead, every caller looks trusted, and the whole
-- guard quietly does nothing. Found by a test that expected it to bite.
set search_path = ''
as $$
declare
  -- service_role = Vouch's own server. postgres = the SQL editor.
  v_trusted   boolean := current_user in ('service_role', 'postgres');
  v_uid       uuid    := (select auth.uid());
  v_is_seeker boolean;
  v_is_employer boolean;
begin
  if v_trusted then
    return new;
  end if;

  v_is_seeker   := v_uid is not null and v_uid = old.seeker_id;
  v_is_employer := v_uid is not null and public.is_company_member(old.company_id);

  -- --- Facts nobody may edit, ever -----------------------------------------
  -- These were copied from the job when the hire was created precisely so
  -- that later edits could not move the money.
  if new.application_id       is distinct from old.application_id
     or new.job_id            is distinct from old.job_id
     or new.seeker_id         is distinct from old.seeker_id
     or new.voucher_id        is distinct from old.voucher_id
     or new.company_id        is distinct from old.company_id
     or new.fee_amount_cents  is distinct from old.fee_amount_cents
     or new.voucher_amount_cents is distinct from old.voucher_amount_cents then
    raise exception 'The money terms on a hire are fixed when it is created and cannot be changed afterwards.'
      using errcode = 'check_violation';
  end if;

  -- --- Things only the platform decides ------------------------------------
  if new.status                is distinct from old.status
     or new.confirmed_at       is distinct from old.confirmed_at
     or new.disputed_at        is distinct from old.disputed_at
     or new.cancelled_at       is distinct from old.cancelled_at
     or new.payout_due_at      is distinct from old.payout_due_at
     or new.separated_at       is distinct from old.separated_at
     or new.still_employed_at_60d is distinct from old.still_employed_at_60d
     or new.retention_checked_at  is distinct from old.retention_checked_at
     or new.separation_disputed_at is distinct from old.separation_disputed_at then
    raise exception 'Only Vouch can change that. Confirm or dispute your side and the rest follows from it.'
      using errcode = 'check_violation';
  end if;

  -- --- Each side confirms its OWN half of the hire --------------------------
  if new.confirmed_by_employer_at is distinct from old.confirmed_by_employer_at then
    if not v_is_employer then
      raise exception 'Only the hiring employer can confirm the employer''s side of a hire.'
        using errcode = 'check_violation';
    end if;
    if old.confirmed_by_employer_at is not null then
      raise exception 'That hire has already been confirmed by the employer.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.confirmed_by_seeker_at is distinct from old.confirmed_by_seeker_at then
    if not v_is_seeker then
      raise exception 'Only the person hired can confirm that they took the job.'
        using errcode = 'check_violation';
    end if;
    if old.confirmed_by_seeker_at is not null then
      raise exception 'You have already confirmed this hire.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- --- The start date is the employer's, and only before it counts ----------
  if new.start_date is distinct from old.start_date then
    if not v_is_employer then
      raise exception 'Only the employer can correct the start date.'
        using errcode = 'check_violation';
    end if;
    if old.status <> 'reported' then
      raise exception 'The start date is fixed once both sides have confirmed the hire. Tell us if it is wrong.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- --- Reporting that the hire ended ---------------------------------------
  if new.separation_reported_at is distinct from old.separation_reported_at
     or new.separation_claimed_date is distinct from old.separation_claimed_date
     or new.separation_reported_by is distinct from old.separation_reported_by then
    if not (v_is_seeker or v_is_employer) then
      raise exception 'Only the employer or the person hired can report that a job ended.'
        using errcode = 'check_violation';
    end if;
    if old.separation_reported_at is not null then
      raise exception 'The end of this job has already been reported. Confirm it or dispute it.'
        using errcode = 'check_violation';
    end if;
    if old.status <> 'confirmed' then
      raise exception 'This hire is not confirmed yet, so there is nothing to end.'
        using errcode = 'check_violation';
    end if;
    if new.separation_reported_by is distinct from v_uid then
      raise exception 'A separation is recorded against whoever reported it.'
        using errcode = 'check_violation';
    end if;
    -- Reporting it counts as your own confirmation of it.
    if v_is_employer then
      new.separation_confirmed_by_employer_at := coalesce(new.separation_confirmed_by_employer_at, now());
    end if;
    if v_is_seeker then
      new.separation_confirmed_by_seeker_at := coalesce(new.separation_confirmed_by_seeker_at, now());
    end if;
  end if;

  -- --- Agreeing that it ended: again, each side speaks only for itself ------
  if new.separation_confirmed_by_employer_at is distinct from old.separation_confirmed_by_employer_at
     and not v_is_employer then
    raise exception 'Only the employer can confirm the employer''s side of a separation.'
      using errcode = 'check_violation';
  end if;

  if new.separation_confirmed_by_seeker_at is distinct from old.separation_confirmed_by_seeker_at
     and not v_is_seeker then
    raise exception 'Only the person who held the job can confirm that they left.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.protect_hire_columns() is
  'Each side of a hire may write only its own half. Everything that costs money is the platform''s to write.';

-- Runs first, before anything else looks at the row.
create trigger trg_hire_05_protect
  before update on public.hires
  for each row execute function public.protect_hire_columns();

-- --- The same problem exists on the way in ---------------------------------
-- An employer inserts the hire (that is the normal path), and could write the
-- seeker's confirmation into the very first row.

create or replace function public.protect_hire_insert()
returns trigger
language plpgsql
-- Invoker rights, for the same reason as protect_hire_columns above.
set search_path = ''
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
  v_uid     uuid    := (select auth.uid());
begin
  if v_trusted then
    return new;
  end if;

  -- Whoever is reporting the hire may confirm their own half and no one else's.
  if v_uid is distinct from new.seeker_id then
    new.confirmed_by_seeker_at := null;
  end if;

  if not public.is_company_member(new.company_id) then
    new.confirmed_by_employer_at := null;
  end if;

  -- Nothing arrives already settled, separated, or disputed.
  new.status                    := 'reported';
  new.confirmed_at              := null;
  new.disputed_at               := null;
  new.cancelled_at              := null;
  new.separated_at              := null;
  new.separation_reported_at    := null;
  new.separation_reported_by    := null;
  new.separation_claimed_date   := null;
  new.separation_confirmed_by_employer_at := null;
  new.separation_confirmed_by_seeker_at   := null;
  new.separation_disputed_at    := null;
  new.still_employed_at_60d     := null;
  new.retention_checked_at      := null;

  return new;
end;
$$;

-- AFTER trg_hire_10_fill and BEFORE trg_hire_20_confirm. The order matters:
-- seeker_id and company_id are copied across by the fill trigger, so running
-- any earlier means checking who someone is against columns that are still
-- empty — which strips the reporter's own confirmation along with everyone
-- else's. Postgres fires same-event triggers in name order, hence 15.
create trigger trg_hire_15_protect_insert
  before insert on public.hires
  for each row execute function public.protect_hire_insert();

-- ---------------------------------------------------------------------------
-- 4. CREDITS THAT LAPSE
--
-- An early-departure credit with no end date is a liability with no end date.
-- ---------------------------------------------------------------------------

alter table public.employer_credits
  add column expires_at date;

comment on column public.employer_credits.expires_at is
  'After this date the credit can no longer be spent. Null means it never lapses (only for credits issued by hand).';

-- Existing credits get the same window, counted from when they were issued.
update public.employer_credits
   set expires_at = (created_at + (public.platform_setting_int('credit_valid_days', 365) || ' days')::interval)::date
 where expires_at is null;

create or replace function public.set_credit_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expires_at is null then
    new.expires_at := (current_date + public.platform_setting_int('credit_valid_days', 365));
  end if;
  return new;
end;
$$;

create trigger trg_credits_expiry
  before insert on public.employer_credits
  for each row execute function public.set_credit_expiry();

-- Spending credits now skips the lapsed ones.
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

  insert into public.payouts (hire_id, voucher_id, amount_cents, release_at)
  values (new.id, new.voucher_id, new.voucher_amount_cents, new.payout_due_at)
  on conflict (hire_id) do nothing;

  v_remaining := new.fee_amount_cents;

  for c in
    select * from public.employer_credits
    where company_id = new.company_id
      and consumed_at is null
      -- Lapsed credits are not spendable. Soonest-to-lapse goes first, so a
      -- credit is never lost while an older one sits unused.
      and (expires_at is null or expires_at >= current_date)
    order by coalesce(expires_at, 'infinity'::date), created_at
  loop
    exit when v_remaining <= 0;

    if c.amount_cents <= v_remaining then
      v_take := c.amount_cents;
      update public.employer_credits
         set consumed_at = now(), consumed_by_hire_id = new.id
       where id = c.id;
    else
      v_take := v_remaining;
      update public.employer_credits
         set amount_cents = c.amount_cents - v_take
       where id = c.id;
      insert into public.employer_credits (company_id, amount_cents, source_hire_id, consumed_by_hire_id, consumed_at, expires_at, note)
      values (new.company_id, v_take, c.source_hire_id, new.id, now(), c.expires_at, 'partial use of an earlier credit');
    end if;

    v_applied   := v_applied + v_take;
    v_remaining := v_remaining - v_take;
  end loop;

  insert into public.employer_charges (hire_id, company_id, amount_cents, credit_applied_cents, status)
  values (new.id, new.company_id, new.fee_amount_cents, v_applied,
          case when v_remaining <= 0 then 'credited'::public.charge_status
               else 'pending'::public.charge_status end)
  on conflict (hire_id) do nothing;

  update public.applications
     set status = 'hired'
   where id = new.application_id and status <> 'hired';

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. TWO FIXES TO RELEASING PAYOUTS
--
-- (a) A hire that ended AFTER the hold was over should still pay. The old
--     condition was `separated_at is null`, so if the scheduled job missed a
--     day and the person left on day 62, that payout was stranded forever.
-- (b) A payout must not release while somebody has said the job ended and
--     the other side has not answered yet. Money out the door is the one
--     thing you cannot undo by arguing about it afterwards.
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
       -- Left after the hold was up? Then they saw it out, and it pays.
       and (h.separated_at is null or h.separated_at >= h.start_date + v_hold)
       and vp.identity_verified_at is not null
       and vp.tax_info_collected_at is not null
    returning 1
  )
  select count(*) into n from released;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. SAYING "NO, THAT ISN'T RIGHT"
--
-- Disputing has to be possible from a login — it is half the point of asking
-- the other side at all. But `separation_disputed_at` is deliberately not
-- writable by a login, because a column anyone can set is a column anyone can
-- set to their own advantage. So disputing goes through this one door, which
-- checks who is knocking.
-- ---------------------------------------------------------------------------

create or replace function public.dispute_separation(p_hire_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  v_uid uuid := (select auth.uid());
begin
  select * into h from public.hires where id = p_hire_id;
  if h.id is null then
    raise exception 'We could not find that hire.' using errcode = 'no_data_found';
  end if;

  if not (v_uid = h.seeker_id or public.is_company_member(h.company_id)) then
    raise exception 'Only the employer or the person hired can dispute this.'
      using errcode = 'insufficient_privilege';
  end if;

  if h.separation_reported_at is null then
    raise exception 'Nobody has said this job ended, so there is nothing to dispute.'
      using errcode = 'check_violation';
  end if;

  if h.separated_at is not null then
    raise exception 'Both sides already agreed this job ended. Get in touch and a person will look at it.'
      using errcode = 'check_violation';
  end if;

  update public.hires
     set separation_disputed_at = now(),
         separation_dispute_note = coalesce(
           nullif(btrim(p_note), ''),
           'The other side disagreed that the job ended on the date reported.')
   where id = p_hire_id;
end;
$$;

comment on function public.dispute_separation(uuid, text) is
  'The one way a login may mark a separation disputed, and only by one of the two people it concerns.';

-- The scheduled jobs stay platform work.
revoke execute on function public.open_stale_separation_disputes() from authenticated;

commit;
