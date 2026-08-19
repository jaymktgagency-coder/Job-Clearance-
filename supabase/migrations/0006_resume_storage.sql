-- ===========================================================================
-- Vouch — resume file storage
--
-- WHAT THIS FILE IS
-- Resumes are files, not rows, so they live in Supabase Storage rather than a
-- table. This creates the private bucket they go in, and the rules for who
-- may read them.
--
-- Resumes are the most personal thing on Vouch. The rules here mirror the
-- ones on the seeker's profile exactly:
--
--   * a seeker can upload, replace, and delete their own resume
--   * a verified voucher can read the resume of someone who has asked for a
--     vouch at THEIR company, and nobody else's
--   * an employer can read the resume of a candidate who carries a vouch for
--     one of THEIR jobs
--   * nobody else can read anything, and the bucket is not public, so there
--     is no shareable URL
--
-- Every file lives at  <user-id>/<filename>, which is what the rules match on.
-- ===========================================================================

begin;

-- A private bucket. 5 MB per file, and only document formats.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: the folder a file sits in is the owner's user id.
create or replace function public.storage_owner_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

-- --- the seeker's own file -------------------------------------------------

drop policy if exists resumes_owner_read on storage.objects;
create policy resumes_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.storage_owner_id(name) = (select auth.uid()));

drop policy if exists resumes_owner_write on storage.objects;
create policy resumes_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and public.storage_owner_id(name) = (select auth.uid()));

drop policy if exists resumes_owner_update on storage.objects;
create policy resumes_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and public.storage_owner_id(name) = (select auth.uid()))
  with check (bucket_id = 'resumes' and public.storage_owner_id(name) = (select auth.uid()));

-- Deleting your own resume is part of "delete my data".
drop policy if exists resumes_owner_delete on storage.objects;
create policy resumes_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and public.storage_owner_id(name) = (select auth.uid()));

-- --- the voucher deciding whether to vouch ---------------------------------

drop policy if exists resumes_read_as_voucher on storage.objects;
create policy resumes_read_as_voucher on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.intro_requests ir
      join public.jobs j on j.id = ir.job_id
      where ir.seeker_id = public.storage_owner_id(storage.objects.name)
        and j.company_id = public.verified_voucher_company()
    )
  );

-- --- the employer reviewing a vouched candidate ----------------------------

drop policy if exists resumes_read_as_employer on storage.objects;
create policy resumes_read_as_employer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.seeker_id = public.storage_owner_id(storage.objects.name)
        and public.is_company_member(j.company_id)
    )
  );

grant execute on function public.storage_owner_id(text) to authenticated, service_role;

commit;
