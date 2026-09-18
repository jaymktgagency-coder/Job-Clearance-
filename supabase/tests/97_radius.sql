\set ON_ERROR_STOP on
-- ===========================================================================
-- The Radius filter
--
-- Two things to prove. First that the arithmetic is right, because a distance
-- filter that is quietly wrong is worse than none: somebody turns down a job
-- they could have walked to. Second that the reference data is reference
-- data — readable by everyone, writable by nobody, because a login that can
-- move a ZIP's coordinates can move every job on the board.
-- ===========================================================================

insert into auth.users (id, email) values
  ('dddd0000-0000-0000-0000-000000000001','rad-seeker@example.test'),
  ('dddd0000-0000-0000-0000-000000000002','rad-other@example.test');
insert into public.users (id, role, full_name, email) values
  ('dddd0000-0000-0000-0000-000000000001','seeker','Rad Seeker','rad-seeker@example.test'),
  ('dddd0000-0000-0000-0000-000000000002','seeker','Other Seeker','rad-other@example.test');
insert into public.seeker_profiles (user_id) values
  ('dddd0000-0000-0000-0000-000000000001'),
  ('dddd0000-0000-0000-0000-000000000002');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- --- 1. the arithmetic, against distances a person can check ---------------
do $$
declare
  d_bellevue double precision := public.postal_code_miles('98101','98004');
  d_tacoma   double precision := public.postal_code_miles('98101','98402');
  d_portland double precision := public.postal_code_miles('98101','97205');
  d_nyc      double precision := public.postal_code_miles('98101','10001');
begin
  -- Generous windows on purpose: these are ZIP centroids, not doorsteps. The
  -- point is to catch a formula that is wrong by a factor, a swapped
  -- latitude and longitude, or degrees fed in where radians were wanted —
  -- all of which land nowhere near these ranges.
  if d_bellevue not between 3 and 12 then
    raise exception 'FAIL: Seattle to Bellevue came out as % miles', round(d_bellevue::numeric,1);
  end if;
  if d_tacoma not between 20 and 32 then
    raise exception 'FAIL: Seattle to Tacoma came out as % miles', round(d_tacoma::numeric,1);
  end if;
  if d_portland not between 130 and 160 then
    raise exception 'FAIL: Seattle to Portland came out as % miles', round(d_portland::numeric,1);
  end if;
  if d_nyc not between 2300 and 2500 then
    raise exception 'FAIL: Seattle to New York came out as % miles', round(d_nyc::numeric,1);
  end if;
  raise notice 'PASS: distances match the real world (Bellevue %, Tacoma %, Portland %, NYC %)',
    round(d_bellevue::numeric,1), round(d_tacoma::numeric,1),
    round(d_portland::numeric,1), round(d_nyc::numeric,1);
end $$;

-- --- 2. a ZIP is zero miles from itself, and symmetric --------------------
do $$
declare
  d_self double precision := public.postal_code_miles('98101','98101');
  d_ab   double precision := public.postal_code_miles('98101','97205');
  d_ba   double precision := public.postal_code_miles('97205','98101');
begin
  if d_self <> 0 then
    raise exception 'FAIL: a ZIP is % miles from itself', d_self;
  end if;
  if abs(d_ab - d_ba) > 0.0001 then
    raise exception 'FAIL: distance is not symmetric (% vs %)', d_ab, d_ba;
  end if;
  raise notice 'PASS: zero from itself, and the same in both directions';
end $$;

-- --- 3. an unknown ZIP is null, never a wrong number ----------------------
do $$
begin
  if public.postal_code_miles('98101','00000') is not null then
    raise exception 'FAIL: an unknown ZIP produced a distance instead of null';
  end if;
  if public.postal_code_miles('ABCDE','98101') is not null then
    raise exception 'FAIL: nonsense input produced a distance instead of null';
  end if;
  raise notice 'PASS: an unknown ZIP is null, so the screen can say so rather than guess';
end $$;

-- --- 4. the gazetteer actually loaded, and looks like the United States ---
do $$
declare n int; bad int;
begin
  select count(*) into n from public.postal_codes;
  if n < 30000 then
    raise exception 'FAIL: only % ZIPs loaded; the gazetteer did not come through', n;
  end if;
  -- Every point should sit inside US territory. The real job of this check is
  -- to catch latitude and longitude being swapped somewhere in the loading —
  -- a mistake that produces plausible-looking numbers that are all wrong, and
  -- would send a seeker's ten-mile search to the wrong hemisphere.
  --
  -- The bounds below were widened once, after this check failed on eleven
  -- rows that turned out to be correct: Guam and the Northern Marianas sit
  -- EAST of the antimeridian, so their longitude is positive, and American
  -- Samoa is south of the equator, so its latitude is negative. They are
  -- named here so nobody widens the bounds again without knowing why.
  select count(*) into bad from public.postal_codes
   where latitude not between -15 and 72                 -- American Samoa .. northern Alaska
      or not (longitude between -180 and -64             -- the states, PR, USVI
              or longitude between 144 and 146);         -- Guam, Northern Marianas
  if bad > 0 then
    raise exception 'FAIL: % ZIPs sit outside US territory — latitude and longitude may be swapped', bad;
  end if;

  -- A swap would also drag the average wildly: the states cluster around
  -- 39N, 95W. If this ever drifts, something has been transposed.
  if (select avg(latitude) from public.postal_codes) not between 30 and 48 then
    raise exception 'FAIL: the average latitude is %, which is not the United States',
      (select round(avg(latitude)::numeric,1) from public.postal_codes);
  end if;

  raise notice 'PASS: % ZIPs loaded, all inside US territory (Guam and American Samoa included)', n;
end $$;

-- --- 5. reference data is read-only to a login ---------------------------
do $$
declare n_before int; n_after int; moved double precision;
begin
  select count(*) into n_before from public.postal_codes;

  -- Insert
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'dddd0000-0000-0000-0000-000000000001';
    insert into public.postal_codes (code, latitude, longitude) values ('00001', 0, 0);
    reset role;
    raise exception 'FAIL: a seeker invented a ZIP code';
  exception
    when insufficient_privilege then reset role;
    when others then reset role; if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- Update: moving a ZIP would move every job filed under it.
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'dddd0000-0000-0000-0000-000000000001';
    update public.postal_codes set latitude = 0, longitude = 0 where code = '98101';
    reset role;
  exception
    when insufficient_privilege then reset role;
    when others then reset role; if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  select count(*) into n_after from public.postal_codes;
  select latitude into moved from public.postal_codes where code = '98101';

  if n_after <> n_before then
    raise exception 'FAIL: the ZIP table grew by % row(s)', n_after - n_before;
  end if;
  if moved = 0 then
    raise exception 'FAIL: a seeker moved Seattle to the equator';
  end if;
  raise notice 'PASS: a login cannot add a ZIP, and cannot move one that exists';
end $$;

-- --- 6. a seeker sets their OWN ZIP, and only a real one ------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddd0000-0000-0000-0000-000000000001';
  update public.seeker_profiles set postal_code = '98101'
   where user_id = 'dddd0000-0000-0000-0000-000000000001';
commit;

do $$
declare v text;
begin
  select postal_code into v from public.seeker_profiles
   where user_id = 'dddd0000-0000-0000-0000-000000000001';
  if v is distinct from '98101' then
    raise exception 'FAIL: a seeker could not set their own ZIP (got %)', v;
  end if;

  -- A made-up ZIP must be refused by the foreign key, not stored and later
  -- silently producing no distance.
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'dddd0000-0000-0000-0000-000000000001';
    update public.seeker_profiles set postal_code = '00000'
     where user_id = 'dddd0000-0000-0000-0000-000000000001';
    reset role;
    raise exception 'FAIL: a made-up ZIP was accepted onto a profile';
  exception
    when foreign_key_violation then reset role;
    when others then reset role; if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: a seeker sets their own ZIP, and a made-up one is refused';
end $$;

-- --- 7. and cannot set somebody else's ------------------------------------
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = 'dddd0000-0000-0000-0000-000000000002';
  update public.seeker_profiles set postal_code = '10001'
   where user_id = 'dddd0000-0000-0000-0000-000000000001';
commit;

do $$
declare v text;
begin
  select postal_code into v from public.seeker_profiles
   where user_id = 'dddd0000-0000-0000-0000-000000000001';
  if v <> '98101' then
    raise exception 'FAIL: a stranger changed somebody else''s ZIP to %', v;
  end if;
  raise notice 'PASS: a seeker cannot set somebody else''s ZIP';
end $$;

do $$ begin raise notice '--- 97_radius.sql: all checks passed ---'; end $$;
