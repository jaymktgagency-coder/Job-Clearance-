-- ===========================================================================
-- Vouch — Step 9c (part two): telling the voucher their money is coming
--
-- THE PROBLEM THIS FIXES
-- A voucher is asked for identity and tax details only once a vouch has become
-- a confirmed hire and there is real money with their name on it. That is
-- deliberate, and it is right. But until now the only places that ASKED were
-- the dashboard and /payouts — both of which require the voucher to log in.
--
-- So the 60-day head start that deferring the paperwork was designed to buy
-- only ever applied to vouchers who happened to log in. Everyone else first
-- heard about it when the money was already due and already held, which is
-- precisely the delay the design exists to avoid.
--
-- WHAT THIS ADDS
-- Three nullable columns on `payouts` that record what we have told them:
--
--   voucher_notified_at     — the one "you earned this" email, sent when the
--                             hire is confirmed. Sent once per payout, ever.
--   last_reminder_at        — when we last chased them. For a human looking
--                             at a support question, and as a safety rail so
--                             two reminders can never land on the same day.
--   last_reminder_days_out  — WHICH reminder that was, counted in days before
--                             release_at. See the long note below; this is the
--                             column that stops a missed cron run turning into
--                             a burst of three emails.
--
-- WHY THESE ARE SAFE TO ADD
-- `payouts` has NO UPDATE POLICIES AT ALL (rule 9, migration 0004). Nothing
-- reachable from a login can write any of these columns, so they are
-- platform-only by construction and need no new guard trigger. And
-- `guard_payout_release()` returns early unless the status is being moved to
-- 'released' or 'paid', so stamping a notification date never trips it.
--
-- NO MONEY LOGIC CHANGES HERE. Nothing in this file can make a payout release
-- earlier, later, or at all. It only records what was said to whom.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. WHAT WE HAVE TOLD THEM
-- ---------------------------------------------------------------------------

alter table public.payouts
  add column if not exists voucher_notified_at    timestamptz,
  add column if not exists last_reminder_at       timestamptz,
  add column if not exists last_reminder_days_out int;

comment on column public.payouts.voucher_notified_at is
  'When the voucher was emailed that this payout exists. Set ONLY on a delivered email — never on a send that failed or only went to the console, or a voucher would be marked told and never actually told.';

comment on column public.payouts.last_reminder_at is
  'When we last chased this voucher to finish their payout setup. Null means never.';

comment on column public.payouts.last_reminder_days_out is
  'Which reminder that was, as days before release_at (30, 14, 3). Null means none sent. Stored as the milestone rather than a count so a missed cron run skips the stale reminders instead of sending them all at once.';

-- A negative milestone would mean "we reminded them N days AFTER the money was
-- due", which the reminder logic cannot produce. Cheap to assert, and it
-- documents what the column means better than the comment alone.
alter table public.payouts
  drop constraint if exists reminder_milestone_is_days_before;

alter table public.payouts
  add constraint reminder_milestone_is_days_before
  check (last_reminder_days_out is null or last_reminder_days_out >= 0);

-- The scheduled job (9d) asks one question: which payouts are approaching
-- their release date, have already had the first email, and are not finished?
-- This is the index for that question.
create index if not exists payouts_reminder_idx
  on public.payouts (release_at)
  where status in ('scheduled', 'held') and voucher_notified_at is not null;

-- ---------------------------------------------------------------------------
-- 2. THE CADENCE, AS A SETTING RATHER THAN A NUMBER IN THE CODE
--
-- Same rule as every other timing and money number in Vouch: it lives in
-- platform_settings, so it can be changed without a deploy and so there is one
-- place to look. `payout_hold_days` is 60; these are counted backwards from
-- the release date, so 30/14/3 land on days 30, 46 and 57 of the hold.
--
-- Why these three:
--   30 — the first nudge. Far enough after the good news not to read as
--        nagging, with a month of runway. Stripe can ask for a document and
--        that round trip takes days.
--   14 — real urgency, still time for a re-submitted document to clear.
--    3 — last call before the money is held instead of paid.
--
-- Settings are versioned by (key, effective_from), so `on conflict (key)`
-- fails and a plain insert would stack a second copy every time this file
-- runs. Only add them if they are not already there.
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, note)
select v.key, v.value, v.note
from (values
  ('payout_reminder_days', '[30, 14, 3]'::jsonb,
   'Days before a payout releases at which a voucher who still has not finished their payout setup is reminded. Descending. Empty list turns reminders off.'),
  ('payout_reminder_min_hours_apart', to_jsonb(48),
   'A voucher is never sent two payout reminders closer together than this, whatever the milestones say. Stops a missed scheduled run turning into a burst.')
) as v(key, value, note)
where not exists (select 1 from public.platform_settings ps where ps.key = v.key);

-- ---------------------------------------------------------------------------
-- 3. READING A LIST OF NUMBERS OUT OF A SETTING
--
-- `platform_setting_int` covers the single-number case and is used everywhere.
-- The cadence is a list, so it needs its own accessor rather than three
-- separate settings named _1, _2, _3. Same shape, same guarantee: if the
-- setting is missing or malformed you get the default, never an error and
-- never a silent zero.
-- ---------------------------------------------------------------------------

create or replace function public.platform_setting_int_array(p_key text, p_default int[])
returns int[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_raw jsonb := public.platform_setting(p_key);
  v_out int[];
begin
  if v_raw is null or jsonb_typeof(v_raw) <> 'array' then
    return p_default;
  end if;

  select array_agg(e::int order by e::int desc)
    into v_out
  from jsonb_array_elements_text(v_raw) as e
  where e ~ '^[0-9]+$';

  -- An array that was present but held nothing usable is a deliberate
  -- "switch this off", not a mistake to paper over with the default.
  return coalesce(v_out, '{}'::int[]);
exception
  when others then
    return p_default;
end;
$$;

comment on function public.platform_setting_int_array(text, int[]) is
  'Reads a setting that holds a list of whole numbers, newest-effective first, sorted descending. Falls back to the default if the setting is missing or is not an array.';

commit;
