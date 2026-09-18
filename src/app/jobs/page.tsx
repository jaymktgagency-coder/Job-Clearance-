/**
 * /jobs — every open role on Vouch.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
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

export default async function JobsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, pay_type, pay_min_cents, pay_max_cents, created_at, companies(name, verification_tier), locations(label, city, region)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // Which ones have they already asked about?
  const { data: mine } = await supabase.from("intro_requests").select("job_id, status");
  const asked = new Map((mine ?? []).map((r) => [r.job_id as string, r.status as string]));
  const openCount = (mine ?? []).filter((r) => r.status === "pending").length;

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">Open roles</h1>
          {profile.role === "seeker" ? (
            <Button variant="outline" render={<Link href="/requests" />}>
              My requests ({openCount}/5)
            </Button>
          ) : null}
        </div>
        <p className="measure mt-3 text-lg text-muted-foreground">
          {jobs?.length ?? 0} roles hiring through Vouch. Ask for an intro and a
          verified employee there decides whether to vouch for you.
        </p>

        <div className="mt-10 space-y-4">
        {(jobs ?? []).map((job) => {
          const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
          const location = Array.isArray(job.locations) ? job.locations[0] : job.locations;
          const status = asked.get(job.id as string);
          const money = pay(job);

          return (
            <Card key={job.id as string} interactive className="group">
              <CardHeader>
                <CardTitle className="text-lg">
                  {/* The whole card is the target, not just the words — the
                      stretched link covers it so a thumb can land anywhere. */}
                  <Link
                    href={`/jobs/${job.id}`}
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
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="tabular text-sm font-semibold">
                  {money ?? (
                    <span className="font-normal text-muted-foreground">
                      Pay not listed
                    </span>
                  )}
                </p>
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

          {(jobs ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="font-semibold">No open roles right now.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New roles appear here as employers post them. Nothing is
                  scraped, so everything you see was posted by a real company.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </>
  );
}
