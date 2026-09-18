-- ===========================================================================
-- Vouch — profile pictures
--
-- WHAT THIS FILE IS
-- Somewhere to put the picture a person or a company uploads of themselves.
--
-- There is no new column here. `users.avatar_url` and `companies.logo_url`
-- have existed since the very first migration and were simply never filled
-- in. All that was ever missing was the bucket the file goes in.
--
-- WHY THIS BUCKET IS PUBLIC AND THE RESUME ONE IS NOT
-- A resume is read on one page at a time, by one person who had to earn the
-- right to see it, so signing a private URL each time costs nothing and buys
-- a great deal. A profile picture is the opposite: it appears beside every
-- name in a list, so a private bucket would mean signing a separate URL for
-- every row of every page — dozens of round trips to show something whose
-- whole purpose is to be seen by the people you are already shown to.
--
-- So the file itself is public, and the protection is that the path is
-- unguessable: <user-id>/<random>.<ext>. Knowing somebody's name tells you
-- nothing about where their picture lives, and the column holding the path is
-- still behind the same row-level rules as the rest of their profile.
--
-- Nothing else changes. Who may WRITE a picture is as tight as ever: your own
-- folder and nobody else's.
-- ===========================================================================

begin;

-- A public bucket. 2 MB per file, images only.
--
-- The size limit matters more than it looks: without it a phone camera photo
-- goes in at 8 MB and every page that lists people downloads all of it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- `storage_owner_id` already exists from the resume bucket (migration 0006):
-- it reads the first folder of a path as the owner's user id. The same shape
-- is used here, so a company's logo is stored under the user id of whoever
-- uploaded it rather than the company id — which keeps one rule for writing
-- instead of two, and means a logo is cleaned up with its uploader.

-- --- reading -------------------------------------------------------------

-- The bucket is public, so files are served without a policy. This one exists
-- so that code holding a logged-in client can still LIST a folder, which is
-- what account deletion needs in order to find the file it has to erase.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'avatars');

-- --- writing: your own folder, and nobody else's -------------------------

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.storage_owner_id(name) = (select auth.uid()));

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.storage_owner_id(name) = (select auth.uid()))
  with check (bucket_id = 'avatars' and public.storage_owner_id(name) = (select auth.uid()));

-- Removing your own picture is part of "delete my data", and is also what
-- replacing one does to the file it replaced.
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.storage_owner_id(name) = (select auth.uid()));

commit;
