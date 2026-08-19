/**
 * /requests — the seeker's own intro requests, and what became of them.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { withdrawRequest, confirmHire } from "../jobs/actions";
import { AiNotice } from "@/components/ai-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting for someone there to pick it up",
  vouched: "Someone vouched for you",
  declined: "Nobody took this one on",
  withdrawn: "You withdrew this",
  expired: "This aged out",
};

export default async function RequestsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "seeker") redirect("/dashboard");

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("intro_requests")
    .select("id, status, message, created_at, responded_at, jobs(id, title, companies(name))")
    .order("created_at", { ascending: false });

  const open = (requests ?? []).filter((r) => r.status === "pending").length;

  // Has an employer said they hired this person? Nothing is owed until the
  // person themselves confirms it, so ask them here.
  const { data: hires } = await supabase
    .from("hires")
    .select("id, start_date, confirmed_by_seeker_at, status, jobs(title), companies(name)")
    .is("confirmed_by_seeker_at", null);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your intro requests</h1>
        <Button variant="outline" size="sm" render={<Link href="/jobs" />}>
          Browse roles
        </Button>
      </div>
      <p className="mt-2 text-muted-foreground">
        {open} of 5 open. The limit keeps requests meaningful — someone reading
        five focused asks takes them more seriously than fifty scattergun ones.
      </p>

      {(hires ?? []).map((h) => {
        const job = Array.isArray(h.jobs) ? h.jobs[0] : h.jobs;
        const co = Array.isArray(h.companies) ? h.companies[0] : h.companies;
        return (
          <Card key={h.id as string} className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Did you start at {co?.name}?</CardTitle>
              <CardDescription>
                {co?.name} says they hired you as {job?.title}, starting{" "}
                {h.start_date as string}. Confirm it and the person who vouched for
                you gets paid — 60 days after your start date.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <form action={confirmHire}>
                <input type="hidden" name="hire_id" value={h.id as string} />
                <Button type="submit" size="sm">Yes, I started there</Button>
              </form>
              <p className="text-sm text-muted-foreground">
                If this isn&apos;t right, don&apos;t confirm it — tell us instead.
              </p>
            </CardContent>
          </Card>
        );
      })}

      <div className="mt-8 space-y-4">
        {(requests ?? []).map((r) => {
          const job = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
          const company = job
            ? Array.isArray(job.companies)
              ? job.companies[0]
              : job.companies
            : null;

          return (
            <Card key={r.id as string}>
              <CardHeader>
                <CardTitle className="text-base">
                  {job ? (
                    <Link href={`/jobs/${job.id}`} className="underline-offset-4 hover:underline">
                      {job.title}
                    </Link>
                  ) : (
                    "A role that's since closed"
                  )}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>{company?.name}</span>
                  <Badge variant={r.status === "vouched" ? "default" : "outline"}>
                    {STATUS_TEXT[r.status as string] ?? (r.status as string)}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {r.message ? <p className="max-w-md italic">&ldquo;{r.message}&rdquo;</p> : null}
                  <p className="mt-1">
                    Asked {new Date(r.created_at as string).toLocaleDateString()}
                  </p>
                </div>
                {r.status === "pending" ? (
                  <form action={withdrawRequest}>
                    <input type="hidden" name="request_id" value={r.id as string} />
                    <Button type="submit" variant="outline" size="sm">
                      Withdraw
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        {(requests ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <p>You haven&apos;t asked for any intros yet.</p>
              <Button className="mt-4" render={<Link href="/jobs" />}>
                Browse open roles
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AiNotice className="mt-8" />
    </main>
  );
}
