-- ===========================================================================
-- Vouch — Step 9a: a real payment method, and badges that mean something
--
-- WHAT 9a NEEDS
-- Employers are about to save a card or a bank account with Stripe. That
-- needs somewhere to keep Stripe's identifiers, and it needs
-- `payment_method_on_file` to stop being a boolean anyone can set.
--
-- WHICH TURNED OUT TO BE THE SMALLER HALF OF THE PROBLEM.
-- `payment_method_on_file` is one of the three inputs to a company's
-- verification badge, and all three were writable by any member of that
-- company. So was the list of email domains a company claims to own. Proven
-- against a real database, from an ordinary employer login:
--
--   a stranger signed up, created a company called "Starbucks", claimed
--   starbucks.com as its domain, and set all three verification fields.
--   The company then displayed "Verified Domain" — the strongest trust
--   signal in this product — to every job seeker looking at its roles.
--   Total elapsed: one transaction. Proof of anything: none.
--
-- Worse, `company_domains.domain` is unique, so a squatter permanently blocks
-- the real company from ever claiming it. And a claimed domain is exactly
-- what lets someone verify as a voucher using a work email address.
--
-- From here: an employer may ASK to add a domain, and may save a payment
-- method through Stripe. Only Vouch marks either of them proven.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. WHERE STRIPE'S IDENTIFIERS LIVE
--
-- Note what is NOT here: no card number, no bank account number, no name on
-- the card. Those live at Stripe and never touch this database. What we keep
-- is the identifier we hand back to Stripe, plus the last four digits so an
-- employer can tell which card they saved.
-- ---------------------------------------------------------------------------

alter table public.companies
  add column stripe_customer_id            text unique,
  add column default_payment_method_id     text,
  -- 'card' or 'us_bank_account'. Bank costs a fraction of card on a $2,000
  -- fee, which is why both exist.
  add column default_payment_method_type   text
    check (default_payment_method_type is null
           or default_payment_method_type in ('card', 'us_bank_account')),
  add column default_payment_method_last4  text
    check (default_payment_method_last4 is null
           or default_payment_method_last4 ~ '^[0-9]{4}$'),
  -- 'visa', 'mastercard', or the bank's name.
  add column default_payment_method_label  text,
  add column payment_method_updated_at     timestamptz;

comment on column public.companies.stripe_customer_id is
  'The Stripe customer this company is. Card and bank details live at Stripe, never here.';

comment on column public.companies.default_payment_method_last4 is
  'Last four digits only, so an employer can tell which card is saved. Never the full number.';

-- ---------------------------------------------------------------------------
-- 2. A CLAIMED DOMAIN IS NOT A PROVEN DOMAIN
--
-- Until now the code said "a domain this company has proven it owns" and
-- nothing ever did the proving. Adding the column that makes that sentence
-- true, and a token to prove it with later.
-- ---------------------------------------------------------------------------

alter table public.company_domains
  add column verified_at        timestamptz,
  add column claimed_by         uuid references public.users (id) on delete set null,
  -- The value the company puts in a DNS record, or receives by email, to
  -- show they control the domain. Filled in when that flow is built.
  add column verification_token text;

comment on column public.company_domains.verified_at is
  'Null means claimed but unproven. A claimed-but-unproven domain unlocks nothing.';

-- Everything already here was created by the seed script or by hand through
-- the SQL editor, so it is as trustworthy as it was yesterday. Marking it
-- verified keeps existing demo accounts working rather than silently
-- breaking every voucher who verified by work email.
update public.company_domains set verified_at = created_at where verified_at is null;

-- ---------------------------------------------------------------------------
-- 3. WHO MAY MAKE A COMPANY LOOK TRUSTWORTHY
--
-- A company's own people may edit its name, website and description. They may
-- not edit anything a stranger relies on.
-- ---------------------------------------------------------------------------

create or replace function public.protect_company_trust()
returns trigger
language plpgsql
-- NOT `security definer`: under it, current_user is this function's owner and
-- every caller would look trusted. Same trap as migration 0009.
set search_path = ''
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  if v_trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A brand new company starts with nothing proven, whatever was sent.
    new.payment_method_on_file             := false;
    new.domain_verified_at                 := null;
    new.business_registration_verified_at  := null;
    new.business_registration_reference    := null;
    new.stripe_customer_id                 := null;
    new.default_payment_method_id          := null;
    new.default_payment_method_type        := null;
    new.default_payment_method_last4       := null;
    new.default_payment_method_label       := null;
    new.payment_method_updated_at          := null;
    return new;
  end if;

  -- On update: silently keep what was there. An employer editing their
  -- company description shouldn't get an error because of fields they never
  -- knowingly touched — but their badge doesn't move either.
  new.payment_method_on_file            := old.payment_method_on_file;
  new.domain_verified_at                := old.domain_verified_at;
  new.business_registration_verified_at := old.business_registration_verified_at;
  new.business_registration_reference   := old.business_registration_reference;
  new.stripe_customer_id                := old.stripe_customer_id;
  new.default_payment_method_id         := old.default_payment_method_id;
  new.default_payment_method_type       := old.default_payment_method_type;
  new.default_payment_method_last4      := old.default_payment_method_last4;
  new.default_payment_method_label      := old.default_payment_method_label;
  new.payment_method_updated_at         := old.payment_method_updated_at;

  return new;
end;
$$;

comment on function public.protect_company_trust() is
  'Badges and payment details are facts Vouch establishes, never claims a company makes about itself.';

create trigger trg_companies_protect_trust
  before insert or update on public.companies
  for each row execute function public.protect_company_trust();

-- ---------------------------------------------------------------------------
-- 4. CLAIMING A DOMAIN, AND PROVING ONE
-- ---------------------------------------------------------------------------

create or replace function public.protect_company_domain()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  if v_trusted then
    return new;
  end if;

  -- Anyone may say "we own acme.com". Nobody may say "and we proved it".
  new.verified_at        := case when tg_op = 'INSERT' then null else old.verified_at end;
  new.verification_token := case when tg_op = 'INSERT' then null else old.verification_token end;

  if tg_op = 'INSERT' then
    new.claimed_by := (select auth.uid());
  else
    new.claimed_by := old.claimed_by;
  end if;

  return new;
end;
$$;

comment on function public.protect_company_domain() is
  'A company may claim a domain. Only Vouch marks one proven, and only a proven domain unlocks work-email voucher verification.';

create trigger trg_company_domains_protect
  before insert or update on public.company_domains
  for each row execute function public.protect_company_domain();

-- ---------------------------------------------------------------------------
-- 5. THE BADGE NOW DEPENDS ON A *PROVEN* DOMAIN
--
-- `verification_tier` reads `companies.domain_verified_at`. That column is
-- now platform-only, and this keeps it in step with reality automatically:
-- prove a domain and the badge follows; remove the last proven domain and it
-- goes away again.
-- ---------------------------------------------------------------------------

create or replace function public.sync_company_domain_verification()
returns trigger
language plpgsql
security definer          -- deliberately: it writes a column no login may write
set search_path = ''
as $$
declare
  v_company uuid := coalesce(new.company_id, old.company_id);
  v_earliest timestamptz;
begin
  select min(verified_at) into v_earliest
    from public.company_domains
   where company_id = v_company and verified_at is not null;

  update public.companies
     set domain_verified_at = v_earliest
   where id = v_company
     and domain_verified_at is distinct from v_earliest;

  return null;
end;
$$;

create trigger trg_company_domains_sync
  after insert or update or delete on public.company_domains
  for each row execute function public.sync_company_domain_verification();

commit;
