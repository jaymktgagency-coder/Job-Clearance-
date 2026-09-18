-- ===========================================================================
-- Vouch — job categories
--
-- WHAT THIS FILE IS
-- A seeker browsing /jobs had no way to narrow the list. This adds the thing
-- a Category filter needs to filter on.
--
-- WHY A TABLE AND NOT AN ENUM
-- Postgres enums are the obvious choice and the wrong one here. Adding a
-- value to an enum needs a migration, and the whole point of this list is
-- that it will be wrong at first and want changing once real employers start
-- posting. A table is rows, and rows can be added by hand in the Supabase
-- editor without anybody writing SQL DDL or shipping a deploy.
--
-- `sort_order` exists so the list reads in a sensible order rather than
-- alphabetically, where "Warehouse" would sit above "Office".
--
-- Categories are deliberately broad. A seeker filtering a young job board
-- wants four results rather than none, and fifty narrow categories on a board
-- with thirty jobs means every filter comes back empty.
-- ===========================================================================

begin;

create table if not exists public.job_categories (
  slug        text primary key check (slug = lower(slug)),
  label       text not null,
  sort_order  int  not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.job_categories is
  'The Category filter on /jobs. Rows, not an enum, so the list can change without a migration.';

-- The starter list, aimed at the hourly and service market that is the
-- reason the $500 tier exists. "Other" is last and is the fallback for
-- anything that does not fit, so no job is ever unfilterable.
insert into public.job_categories (slug, label, sort_order) values
  ('food_service',   'Food & drink',            10),
  ('retail',         'Retail',                  20),
  ('warehouse',      'Warehouse & logistics',   30),
  ('driving',        'Driving & delivery',      40),
  ('care',           'Care & childcare',        50),
  ('trades',         'Trades & construction',   60),
  ('cleaning',       'Cleaning & facilities',   70),
  ('hospitality',    'Hotels & hospitality',    80),
  ('office_admin',   'Office & admin',          90),
  ('customer_service','Customer service',      100),
  ('sales',          'Sales',                  110),
  ('healthcare',     'Healthcare',             120),
  ('education',      'Education',              130),
  ('technology',     'Technology',             140),
  ('finance',        'Finance & accounting',   150),
  ('other',          'Something else',         900)
on conflict (slug) do nothing;

-- The column itself. Nullable, because every job posted before today has no
-- category and inventing one for them would be a guess presented as a fact.
-- `on delete set null` so retiring a category never deletes anybody's job.
alter table public.jobs
  add column if not exists category text
    references public.job_categories (slug) on delete set null;

comment on column public.jobs.category is
  'Which Category filter this job answers to. Null means the employer has not chosen one yet.';

-- The filter reads this on every /jobs page load, always alongside status.
create index if not exists jobs_status_category_idx
  on public.jobs (status, category);

-- The Location filter matches on city, so it needs the same treatment.
create index if not exists locations_city_idx
  on public.locations (city)
  where city is not null;

-- --- who may read and write it -------------------------------------------

alter table public.job_categories enable row level security;

-- Everyone signed in can read the list — it is what fills the dropdown.
drop policy if exists job_categories_read_all on public.job_categories;
create policy job_categories_read_all on public.job_categories
  for select to authenticated using (true);

-- Deliberately NO insert, update or delete policy. The list of categories is
-- the platform's to set, the same way the fee is. An employer choosing a
-- category for their job writes `jobs.category`, which their existing job
-- policies already cover; they cannot invent a new category to put it in,
-- and the foreign key above means a made-up slug is rejected outright.

commit;
