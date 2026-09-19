/**
 * /jobs — every open role on Vouch, and the seeker's filters over them.
 *
 * This is also where a seeker lands when they sign in, rather than the
 * dashboard: the roles are what they came for.
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import {
  FILTER_COOKIE,
  filtersFromCookie,
  filtersFromParams,
  filtersToQuery,
  noFilters,
  radiusMiles,
  type JobFilters,
} from "@/lib/job-filters";
import { milesBetween, describeMiles } from "@/lib/geo";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { HelloOverlay } from "@/components/hello-overlay";
import { ClearFiltersButton, JobFilters as JobFilterBar } from "@/components/job-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  domain: "Verified Domain",
  business: "Verified Business",
  none: "Not verified",
};

/** "$19.00–$23.00 an hour" or "$65,000–$78,000 a year". */
function pay(job: { pay_type: string; pay_min_cents: number | null; pay_max_cents: number | null }): string | null {
  if (job.pay_min_cents == null && job.pay_max_cents == null) return null;
  const unit = job.pay_type === "hourly" ? "an hour" : "a year";
  const fmt = (c: number) =>
    job.pay_type === "hourly"
      ? `$${(c / 100).toFixed(2)}`
      : `$${Math.round(c / 100).toLocaleString()}`;
  const lo = job.pay_min_cents != null ? fmt(job.pay_min_cents) : null;
  const hi = job.pay_max_cents != null ? fmt(job.pay_max_cents) : null;
  return `${lo && hi ? `${lo}–${hi}` : (lo ?? hi)} ${unit}`;
}

/**
 * The town a role is in, used both as the filter's value and its label.
 *
 * City rather than the location's own label, because a label is a branch name
 * ("Riverside Store") and nobody searches for one of those.
 */
function cityOf(job: { locations?: unknown }): string | null {
  const l = Array.isArray(job.locations) ? job.locations[0] : job.locations;
  const city = (l as { city?: string | null } | null)?.city;
  return city?.trim() || null;
}

/** The ZIP of the place a role is at, if its employer has supplied one. */
function postalOf(job: { locations?: unknown }): string | null {
  const l = Array.isArray(job.locations) ? job.locations[0] : job.locations;
  const zip = (l as { postal_code?: string | null } | null)?.postal_code;
  return zip?.trim() || null;
}

export default async function JobsPage(props: PageProps<"/jobs">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");

  const params = await props.searchParams;

  // The address bar is the truth whenever it says anything. Only when it is
  // silent do we fall back on what this browser was filtering by last — which
  // is what makes the filters survive a trip into a role and back.
  const fromUrl = filtersFromParams(params);
  if (noFilters(fromUrl)) {
    const jar = await cookies();
    const remembered = filtersFromCookie(jar.get(FILTER_COOKIE)?.value);
    if (!noFilters(remembered)) {
      // Sent to the address bar rather than just applied quietly, so the page
      // and the address agree and Back behaves. This cannot loop: the address
      // it redirects to always carries a filter, so the next time round
      // `fromUrl` is not empty and this branch is skipped.
      const query = filtersToQuery(remembered);
      redirect(`/jobs${query}${params.hello === "1" ? `${query ? "&" : "?"}hello=1` : ""}`);
    }
  }
  const filters: JobFilters = fromUrl;

  const supabase = await createClient();

  const [{ data: allJobs }, { data: mine }, { data: categoryRows }, { data: meRow }, { data: radiusRow }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, category, pay_type, pay_min_cents, pay_max_cents, created_at, companies(name, verification_tier, logo_url), locations(label, city, region, postal_code)")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    // Which ones have they already asked about?
    supabase.from("intro_requests").select("job_id, status"),
    supabase
      .from("job_categories")
      .select("slug, label")
      .eq("is_active", true)
      .order("sort_order"),
    // Where this seeker measures distance from. Null until they add a ZIP,
    // and the Radius control is not offered until they have.
    supabase
      .from("seeker_profiles")
      .select("postal_code")
      .eq("user_id", profile.id)
      .maybeSingle(),
    // The distances the dropdown offers. In the settings table like every
    // other number here, so it changes without a deploy.
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "job_radius_options_miles")
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const radiusOptions = (() => {
    const raw = radiusRow?.value;
    return Array.isArray(raw) && raw.every((n) => typeof n === "number")
      ? (raw as number[])
      : [5, 10, 25, 50, 100];
  })();

  const myPostalCode = (meRow?.postal_code as string | null) ?? null;

  // Only the ZIPs this page actually mentions — the seeker's own and one per
  // role. A few dozen rows out of the Census table's thirty-three thousand,
  // rather than loading the lot to measure eight jobs.
  const neededZips = Array.from(
    new Set(
      [myPostalCode, ...(allJobs ?? []).map(postalOf)].filter(
        (z): z is string => Boolean(z),
      ),
    ),
  );

  const { data: zipRows } = neededZips.length
    ? await supabase
        .from("postal_codes")
        .select("code, latitude, longitude")
        .in("code", neededZips)
    : { data: [] };

  const zipIndex = new Map(
    (zipRows ?? []).map((z) => [
      z.code as string,
      { latitude: z.latitude as number, longitude: z.longitude as number },
    ]),
  );

  const asked = new Map((mine ?? []).map((r) => [r.job_id as string, r.status as string]));
  const openCount = (mine ?? []).filter((r) => r.status === "pending").length;

  // Every open role is fetched and the filtering happens here rather than in
  // the database. That is the right trade at this size: it is one query
  // instead of three, and it means the dropdowns can only ever offer
  // categories and towns that genuinely have a role in them — a filter that
  // returns nothing is worse than no filter.
  //
  // Migration 0014 adds the indexes this would need if the board outgrows it.
  // The moment "every open role" stops being a few hundred rows, move the two
  // `.filter` calls below into `.eq()` on the query above.
  // How far each role is from the seeker. Worked out once here rather than
  // inside the filter, because the same number is shown on the card.
  //
  // Null means "we cannot say": the role's place has no ZIP, or the seeker
  // has not given one. A role we cannot measure is never silently dropped —
  // see the filter below.
  const distances = new Map<string, number | null>();
  if (myPostalCode) {
    const origin = zipIndex.get(myPostalCode);
    for (const job of allJobs ?? []) {
      const zip = postalOf(job);
      const there = zip ? zipIndex.get(zip) : undefined;
      distances.set(
        job.id as string,
        origin && there ? milesBetween(origin, there) : null,
      );
    }
  }

  const wanted = radiusMiles(filters);

  const jobs = (allJobs ?? []).filter((job) => {
    if (filters.category && job.category !== filters.category) return false;
    if (filters.location && cityOf(job) !== filters.location) return false;
    if (wanted != null) {
      const d = distances.get(job.id as string);
      // A role whose distance is unknown is EXCLUDED from a distance search,
      // and the count of those is shown underneath. Including them would mean
      // "within 10 miles" quietly returning things 400 miles away; dropping
      // them silently would mean a seeker never learning that half the board
      // has no address on it.
      if (d == null || d > wanted) return false;
    }
    return true;
  });

  // How many roles the distance filter could not judge, so the page can say so.
  const unmeasurable = wanted == null
    ? 0
    : (allJobs ?? []).filter((j) => {
        if (filters.category && j.category !== filters.category) return false;
        if (filters.location && cityOf(j) !== filters.location) return false;
        return distances.get(j.id as string) == null;
      }).length;

  // The dropdowns' contents, built from what is actually posted.
  const presentCategories = new Set((allJobs ?? []).map((j) => j.category).filter(Boolean));
  const categoryOptions = (categoryRows ?? [])
    .filter((c) => presentCategories.has(c.slug as string))
    .map((c) => ({ value: c.slug as string, label: c.label as string }));

  const locationOptions = Array.from(
    new Set((allJobs ?? []).map(cityOf).filter((c): c is string => Boolean(c))),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((city) => ({ value: city, label: city }));

  // Whose page this is. An employer and a voucher can reach /jobs perfectly
  // legitimately — it is the public board — but every line written in the
  // second person here was written for a seeker, and reads as a bug to
  // anyone else. One flag, so the seeker-only copy cannot drift apart.
  const isSeeker = profile.role === "seeker";

  // A seeker arriving straight from signing in gets the greeting here, since
  // this is now where they land instead of the dashboard.
  const greet = params.hello === "1";

  const filtering = !noFilters(filters);

  return (
    <>
      {greet ? <HelloOverlay /> : null}

      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">Open roles</h1>
          {isSeeker ? (
            <Button
              variant="outline"
              className="hidden sm:inline-flex"
              render={<Link href="/requests" />}
            >
              My requests ({openCount}/5)
            </Button>
          ) : null}
        </div>
        <p className="measure mt-3 text-lg text-muted-foreground">
          {filtering ? (
            <>
              {jobs.length} of {allJobs?.length ?? 0} roles match your filters.
            </>
          ) : isSeeker ? (
            <>
              {jobs.length} roles hiring through Vouch. Ask for an intro and a
              verified employee there decides whether to vouch for you.
            </>
          ) : (
            // An employer or a voucher can open this page too, and telling
            // them to "ask for an intro" is addressing the wrong person. They
            // get the count and nothing else.
            <>{jobs.length} roles hiring through Vouch.</>
          )}
        </p>

        {/* Only offered when there is something to narrow. Two dropdowns over
            an empty board are furniture. */}
        {(allJobs?.length ?? 0) > 0 ? (
          <JobFilterBar
            filters={filters}
            categories={categoryOptions}
            locations={locationOptions}
            radiusOptions={radiusOptions}
            hasPostalCode={Boolean(myPostalCode)}
            isSeeker={isSeeker}
            resultCount={jobs.length}
          />
        ) : null}

        {unmeasurable > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {unmeasurable} other {unmeasurable === 1 ? "role is" : "roles are"}{" "}
            hidden because the employer hasn&apos;t given that place a ZIP
            code, so we can&apos;t tell how far away {unmeasurable === 1 ? "it is" : "they are"}.
          </p>
        ) : null}

        <div className="mt-10 space-y-4">
        {jobs.map((job) => {
          const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
          const location = Array.isArray(job.locations) ? job.locations[0] : job.locations;
          const status = asked.get(job.id as string);
          const money = pay(job);

          return (
            <Card key={job.id as string} interactive className="group">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Avatar src={company?.logo_url} name={company?.name} contain />
                  <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">
                  {/* The whole card is the target, not just the words — the
                      stretched link covers it so a thumb can land anywhere.
                      The filters ride along, so "All roles" on the far side
                      comes back to this same filtered list. */}
                  <Link
                    href={`/jobs/${job.id}${filtersToQuery(filters)}`}
                    className="after:absolute after:inset-0 after:content-[''] group-hover/card:text-brand-800"
                  >
                    {job.title as string}
                  </Link>
                </CardTitle>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {company?.name}
                  </span>
                  {company?.verification_tier &&
                  company.verification_tier !== "none" ? (
                    <Badge variant="soft">
                      {TIER_LABEL[company.verification_tier]}
                    </Badge>
                  ) : null}
                  {location?.label ? (
                    <span>
                      · {location.label}
                      {location.city ? `, ${location.city}` : ""}
                    </span>
                  ) : null}
                </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="tabular text-sm font-semibold">
                  {money ?? (
                    <span className="font-normal text-muted-foreground">
                      Pay not listed
                    </span>
                  )}
                </p>
                {distances.get(job.id as string) != null ? (
                  <span className="text-sm text-muted-foreground">
                    {describeMiles(distances.get(job.id as string) as number)}
                  </span>
                ) : null}
                {status ? (
                  <Badge variant={status === "vouched" ? "success" : "outline"}>
                    {status === "pending"
                      ? "Intro requested"
                      : status === "vouched"
                        ? "Vouched for you"
                        : status}
                  </Badge>
                ) : (
                  <span className="text-sm font-semibold text-brand-700">
                    Ask for an intro →
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                {filtering ? (
                  <>
                    <p className="font-semibold">
                      No roles match what you&apos;re filtering by.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      There {(allJobs?.length ?? 0) === 1 ? "is" : "are"}{" "}
                      {allJobs?.length ?? 0} other{" "}
                      {(allJobs?.length ?? 0) === 1 ? "role" : "roles"} open.
                    </p>
                    <ClearFiltersButton className="mt-4" />
                  </>
                ) : (
                  <>
                    <p className="font-semibold">No open roles right now.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      New roles appear here as employers post them. Nothing is
                      scraped, so everything you see was posted by a real company.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </>
  );
}
