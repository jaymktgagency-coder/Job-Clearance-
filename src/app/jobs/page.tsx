/**
 * /jobs — every open role on Vouch.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Open roles</h1>
        <div className="flex gap-2">
          {profile.role === "seeker" ? (
            <Button variant="outline" size="sm" render={<Link href="/requests" />}>
              My requests ({openCount}/5)
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground">
        {jobs?.length ?? 0} roles hiring through Vouch. Ask for an intro and a
        verified employee there decides whether to vouch for you.
      </p>

      <div className="mt-8 space-y-4">
        {(jobs ?? []).map((job) => {
          const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
          const location = Array.isArray(job.locations) ? job.locations[0] : job.locations;
          const status = asked.get(job.id as string);
          const money = pay(job);

          return (
            <Card key={job.id as string}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/jobs/${job.id}`} className="underline-offset-4 hover:underline">
                    {job.title as string}
                  </Link>
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>{company?.name}</span>
                  {company?.verification_tier && company.verification_tier !== "none" ? (
                    <Badge variant="secondary">{TIER_LABEL[company.verification_tier]}</Badge>
                  ) : null}
                  {location?.label ? (
                    <span className="text-muted-foreground">
                      · {location.label}
                      {location.city ? `, ${location.city}` : ""}
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{money ?? "Pay not listed"}</p>
                {status ? (
                  <Badge variant="outline">
                    {status === "pending"
                      ? "Intro requested"
                      : status === "vouched"
                        ? "Vouched for you"
                        : status}
                  </Badge>
                ) : (
                  <Button size="sm" render={<Link href={`/jobs/${job.id}`} />}>
                    Ask for an intro
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {(jobs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open roles right now. Check back soon.
          </p>
        ) : null}
      </div>
    </main>
  );
}
