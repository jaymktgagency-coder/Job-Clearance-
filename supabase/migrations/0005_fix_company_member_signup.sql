-- ===========================================================================
-- Vouch — fix: employers could not create their company
--
-- THE BUG
-- The rule that lets the first person on a company become its owner asked
-- "does this company have any members yet?" by querying company_members from
-- inside company_members' own security policy. Postgres refuses that as
-- infinite recursion, so every employer sign-up failed at the last step with
-- "infinite recursion detected in policy for relation company_members".
--
-- THE FIX
-- Ask the same question through a helper that runs with the database owner's
-- rights, so it answers without re-entering the policy. Same rule, no loop.
--
-- Found by running the employer sign-up in a real browser; a regression test
-- now covers it.
-- ===========================================================================

begin;

create or replace function public.company_has_members(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m where m.company_id = p_company_id
  );
$$;

drop policy if exists company_members_insert on public.company_members;

create policy company_members_insert on public.company_members
  for insert to authenticated with check (
    -- an existing member may add colleagues
    public.is_company_member(company_id)
    -- or you may add yourself to a company that has nobody on it yet, which
    -- is how the person who creates a company becomes its owner
    or (
      user_id = (select auth.uid())
      and not public.company_has_members(company_id)
    )
  );

grant execute on function public.company_has_members(uuid) to authenticated, service_role;

commit;
