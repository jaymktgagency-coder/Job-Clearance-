/**
 * /employer/jobs — the employer's roles, and the form to post another.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { NewJobForm } from "./NewJobForm";
import { setJobStatus } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export default async function EmployerJobsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employer") redirect("/dashboard");

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, companies(name)")
    .maybeSingle();

  if (!membership) redirect("/onboarding");
  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, pay_type, fee_amount_cents, created_at, applications(id, status)")
    .order("created_at", { ascending: false });

  const { data: locations } = await supabase
    .from("locations")
    .select("id, label")
    .eq("company_id", membership.company_id)
    .eq("is_active", true)
    .order("label");

  // What a hire costs, straight from your settings table.
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("key, value, effective_from")
    .in("key", ["fee_tier_1_cents", "fee_tier_2_cents"])
    .order("effective_from", { ascending: false });

  const latest = (key: string, fallback: number) =>
    Number(settings?.find((s) => s.key === key)?.value ?? fallback);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your roles</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/employer/billing" />}>
            Payment method
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground">
        {company?.name} · you only ever see candidates someone has vouched for.
      </p>

      <div className="mt-8 space-y-4">
        {(jobs ?? []).map((job) => {
          const apps = (job.applications ?? []) as { id: string; status: string }[];
          const live = apps.filter((a) => !["hired", "passed"].includes(a.status)).length;

          return (
            <Card key={job.id as string}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <Link href={`/employer/jobs/${job.id}`} className="underline-offset-4 hover:underline">
                    {job.title as string}
                  </Link>
                  <Badge variant={job.status === "open" ? "default" : "outline"}>
                    {job.status as string}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {apps.length} vouched {apps.length === 1 ? "candidate" : "candidates"}
                  {live !== apps.length ? ` · ${live} still open` : ""}
                  {" · "}
                  {money(job.fee_amount_cents as number)} if you hire
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button size="sm" render={<Link href={`/employer/jobs/${job.id}`} />}>
                  {apps.length > 0 ? "See candidates" : "Open"}
                </Button>
                <form action={setJobStatus}>
                  <input type="hidden" name="job_id" value={job.id as string} />
                  <input type="hidden" name="status" value={job.status === "open" ? "closed" : "open"} />
                  <Button type="submit" size="sm" variant="outline">
                    {job.status === "open" ? "Close it" : "Reopen it"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}

        {(jobs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roles yet. Post your first one below.
          </p>
        ) : null}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Post a role</CardTitle>
          <CardDescription>
            Free to post. You pay only when you actually hire someone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewJobForm
            locations={(locations ?? []) as { id: string; label: string }[]}
            tier1={money(latest("fee_tier_1_cents", 50000))}
            tier2={money(latest("fee_tier_2_cents", 200000))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
