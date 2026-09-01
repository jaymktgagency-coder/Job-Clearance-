-- ===========================================================================
-- Vouch — Step 9c: paying the voucher through Stripe Connect
--
-- WHAT THIS IS FOR
-- `voucher_profiles` has carried three columns since Step 2b that were only
-- ever set by hand: identity_verified_at, tax_info_collected_at, and
-- payout_account_id. Nothing verified anything. This is where they become
-- facts Stripe tells us.
--
-- WHY IT MATTERS THAT VOUCH NEVER SEES ANY OF IT
-- A voucher's bank account number, date of birth and tax number are collected
-- on a page Stripe hosts, and are held by Stripe. Vouch stores an account
-- identifier and two dates. That is deliberate: this is the most sensitive
-- data in the product and the safest place to keep it is somewhere else.
--
-- Stripe also files the 1099s, which is Vouch's obligation as the payer, not
-- the employer's.
--
-- HOW THE ACCOUNT IS BUILT (the non-obvious bit, recorded here on purpose)
-- Stripe now refuses Accounts v1 for new Connect integrations, so the account
-- is created with POST /v2/core/accounts using the `recipient` configuration.
-- Everything after that still runs through the v1 endpoints, which accept a
-- v2 account id:  /v1/account_links to onboard, /v1/accounts to read state,
-- /v1/transfers to pay. Proven against the live test account before writing.
--
-- One consequence worth knowing: a recipient-only account forces
-- `fees_collector` and `losses_collector` to "application". Stripe will not
-- accept anything else for this configuration. That means VOUCH carries a
-- negative balance on a voucher's account, not Stripe.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. WHAT WE KNOW ABOUT A VOUCHER'S PAYOUT ACCOUNT
--
-- All of it is a copy of what Stripe told us, kept so a screen can explain
-- where someone has got to without calling Stripe on every page load.
-- ---------------------------------------------------------------------------

alter table public.voucher_profiles
  -- 'none' before they start, then whatever Stripe says: 'onboarding',
  -- 'restricted' (Stripe wants more), or 'active' (they can be paid).
  add column payout_account_status text not null default 'none'
    check (payout_account_status in ('none', 'onboarding', 'restricted', 'active')),
  add column payouts_enabled boolean not null default false,
  -- Stripe's own list of what is still outstanding, so the voucher can be
  -- told "a bank account and your date of birth" rather than "incomplete".
  add column payout_requirements jsonb,
  add column payout_onboarding_started_at timestamptz,
  add column payout_account_updated_at timestamptz;

comment on column public.voucher_profiles.payout_account_status is
  'Mirror of the Stripe account state. Only "active" can be paid, and only Vouch writes it.';

comment on column public.voucher_profiles.payout_requirements is
  'Stripe''s currently_due list, copied so a screen can say exactly what is missing.';

-- ---------------------------------------------------------------------------
-- 2. THE NEW COLUMNS ARE THE PLATFORM'S TOO
--
-- The existing guard already refuses a voucher writing identity_verified_at,
-- tax_info_collected_at or payout_account_id. These belong in the same list:
-- a voucher who could set payouts_enabled could talk their way past the
-- payout gate entirely.
-- ---------------------------------------------------------------------------

create or replace function public.protect_voucher_verification()
returns trigger
language plpgsql
-- Invoker rights, deliberately: the check below is on current_user, and
-- `security definer` would make every caller look like the owner.
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  if v_trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Anyone may create their own voucher profile, but it starts unverified
    -- and with no payout account.
    if new.status <> 'unverified'
       or new.verified_at is not null
       or new.identity_verified_at is not null
       or new.payout_account_id is not null
       or new.payouts_enabled
       or new.payout_account_status <> 'none' then
      raise exception 'A new voucher profile always starts unverified.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status                       is distinct from old.status
  or new.verified_at                  is distinct from old.verified_at
  or new.verification_method          is distinct from old.verification_method
  or new.identity_verified_at         is distinct from old.identity_verified_at
  or new.tax_info_collected_at        is distinct from old.tax_info_collected_at
  or new.payout_account_id            is distinct from old.payout_account_id
  or new.payout_account_status        is distinct from old.payout_account_status
  or new.payouts_enabled              is distinct from old.payouts_enabled
  or new.payout_requirements          is distinct from old.payout_requirements
  or new.payout_onboarding_started_at is distinct from old.payout_onboarding_started_at
  or new.payout_account_updated_at    is distinct from old.payout_account_updated_at
  or new.company_id                   is distinct from old.company_id then
    raise exception 'Verification and payout details can only be changed by Vouch, not by the voucher.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. WHAT WE KNOW ABOUT AN ATTEMPT TO PAY
-- ---------------------------------------------------------------------------

alter table public.payouts
  add column attempted_at  timestamptz,
  add column attempt_count int not null default 0,
  add column last_error    text;

comment on column public.payouts.last_error is
  'Stripe''s reason the last transfer failed. Shown to the voucher so they can fix it.';

-- ---------------------------------------------------------------------------
-- 4. AND MONEY STILL CANNOT LEAVE WITHOUT SOMEWHERE TO SEND IT
--
-- The existing guard blocked release without identity and tax details. It did
-- not check there was an account to pay into, because until now there was no
-- such thing.
-- ---------------------------------------------------------------------------

create or replace function public.guard_payout_release()
returns trigger
language plpgsql
security definer          -- reads voucher_profiles, which the payer may not
set search_path = ''
as $$
declare
  vp record;
begin
  if new.status not in ('released', 'paid') then
    return new;
  end if;

  select identity_verified_at, tax_info_collected_at, payout_account_id, payouts_enabled
    into vp
  from public.voucher_profiles where user_id = new.voucher_id;

  if vp.identity_verified_at is null or vp.tax_info_collected_at is null then
    raise exception 'This voucher has not completed identity and tax verification, so no money can be released to them.'
      using errcode = 'check_violation';
  end if;

  -- Paying is a further step than releasing: releasing says "this is owed and
  -- approved", paying says "the money has gone". Only the second needs a
  -- destination that Stripe will actually accept.
  if new.status = 'paid' then
    if vp.payout_account_id is null then
      raise exception 'This voucher has no payout account, so there is nowhere to send the money.'
        using errcode = 'check_violation';
    end if;
    if not vp.payouts_enabled then
      raise exception 'Stripe has not enabled payouts on this voucher''s account yet.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

commit;
