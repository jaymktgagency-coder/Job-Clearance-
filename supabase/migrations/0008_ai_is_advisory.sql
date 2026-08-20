-- ===========================================================================
-- Vouch — the AI's output belongs to the platform, and can never decide
--
-- Step 8 adds two AI features: reading resumes, and suggesting how well a
-- vouched candidate fits a role. This migration makes the three promises
-- around them true in the database rather than in a policy document, so no
-- future change to the app can quietly drop one.
--
-- 1. AN AI SCORE CAN NEVER REJECT ANYONE.
--    A single update may not both write an AI score and move a candidate's
--    status. That splits the machine's opinion from the human's decision at
--    the level where it cannot be forgotten: the score arrives, and then a
--    person on the employer's screen chooses what happens next.
--
-- 2. NOBODY CAN FAKE THE PLATFORM'S OUTPUT.
--    An employer can update their own candidates (they have to — that's how
--    a candidate moves from 'new' to 'interviewed'). That same permission let
--    them write any number they liked into the AI score, and any words they
--    liked into its reasoning. From here those three columns can only be
--    written by Vouch's own server. Same for the parsed resume: it is what we
--    read, not what the seeker would prefer we had read.
--
-- 3. DELETING YOUR OWN DATA STILL WORKS.
--    A seeker may always clear what we read from their resume back to empty.
--    Rule 2 stops them writing something new in; it does not trap them with
--    something they want gone. Removing a resume, and deleting an account,
--    both still erase everything.
--
-- The existing check constraint `ai_score_requires_reasoning` already makes a
-- score without written reasoning impossible to store. This is the other half.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- Candidates: the AI columns are the platform's, and never decide anything
-- ---------------------------------------------------------------------------

create or replace function public.protect_ai_advice()
returns trigger
language plpgsql
as $$
declare
  -- service_role = Vouch's own server code. postgres = the SQL editor.
  -- Everyone else is an ordinary logged-in person: an employer, a seeker,
  -- or a voucher, holding a normal login.
  v_trusted boolean := current_user in ('service_role', 'postgres');
  v_ai_changed boolean;
begin
  v_ai_changed :=
       new.ai_fit_score  is distinct from old.ai_fit_score
    or new.ai_reasoning  is distinct from old.ai_reasoning
    or new.ai_scored_at  is distinct from old.ai_scored_at;

  -- RULE 2: an ordinary login cannot write these. Rather than blow up in the
  -- employer's face mid-update, we simply put back what was there — their
  -- status change goes through, their invented score does not.
  if v_ai_changed and not v_trusted then
    new.ai_fit_score := old.ai_fit_score;
    new.ai_reasoning := old.ai_reasoning;
    new.ai_scored_at := old.ai_scored_at;
    v_ai_changed := false;
  end if;

  -- RULE 1: scoring and deciding are separate acts. Even our own server may
  -- not do both at once, which is what makes "the AI never auto-rejects"
  -- structural instead of a promise.
  if v_ai_changed and new.status is distinct from old.status then
    raise exception
      'An AI score may never change a candidate''s status. The score is advisory; a person decides.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.protect_ai_advice() is
  'LEGAL REQUIREMENT: the AI score is advisory. It cannot be written by a login, and cannot move anyone in the same breath.';

drop trigger if exists trg_applications_ai_advisory on public.applications;
create trigger trg_applications_ai_advisory
  before update on public.applications
  for each row execute function public.protect_ai_advice();

-- ---------------------------------------------------------------------------
-- Resumes: what we read is what we read
-- ---------------------------------------------------------------------------

create or replace function public.protect_parsed_resume()
returns trigger
language plpgsql
as $$
declare
  v_trusted boolean := current_user in ('service_role', 'postgres');
begin
  if v_trusted then
    return new;
  end if;

  -- Clearing it is always allowed: this is the seeker's own data, and being
  -- able to delete it is one of the ground rules of this product.
  if new.resume_parsed is null then
    new.resume_parsed_at := null;
    return new;
  end if;

  -- Anything else is left exactly as it was.
  new.resume_parsed    := old.resume_parsed;
  new.resume_parsed_at := old.resume_parsed_at;
  return new;
end;
$$;

comment on function public.protect_parsed_resume() is
  'The parsed resume is written by Vouch reading the file, never by the seeker. Clearing it is always allowed.';

drop trigger if exists trg_seeker_profiles_parsed_resume on public.seeker_profiles;
create trigger trg_seeker_profiles_parsed_resume
  before update on public.seeker_profiles
  for each row execute function public.protect_parsed_resume();

commit;
