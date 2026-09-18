/**
 * /requests — the seeker's own intro requests, and what became of them.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { withdrawRequest, confirmHire } from "../jobs/actions";
import { SeparationPanel, type SeparationHire } from "@/components/separation-panel";
import { AiNotice } from "@/components/ai-notice";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
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
    .select("id, status, message, created_at, responded_at, jobs(id, title, companies(name, logo_url))")
    .order("created_at", { ascending: false });

  const open = (requests ?? []).filter((r) => r.status === "pending").length;

  // Has an employer said they hired this person? Nothing is owed until the
  // person themselves confirms it, so ask them here.
  const { data: hires } = await supabase
    .from("hires")
    .select("id, start_date, confirmed_by_seeker_at, status, jobs(title), companies(name)")
    .is("confirmed_by_seeker_at", null);

  // Jobs this person actually started. Either they or the employer may say one
  // of them ended — and whether it did decides whether the person who vouched
  // for them gets paid, so it is worth showing plainly.
  const { data: started } = await supabase
    .from("hires")
    .select(`id, start_date, status, separated_at,
             separation_reported_by, separation_reported_at, separation_claimed_date,
             separation_confirmed_by_employer_at, separation_confirmed_by_seeker_at,
             separation_disputed_at,
             jobs(title), companies(name)`)
    .eq("status", "confirmed")
    .order("start_date", { ascending: false });

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Your intro requests</h1>
        <Button variant="outline" render={<Link href="/jobs" />}>
          Browse roles
        </Button>
      </div>
      <p className="measure mt-3 text-lg text-muted-foreground">
        {open} of 5 open. The limit keeps requests meaningful — someone reading
        five focused asks takes them more seriously than fifty scattergun ones.
      </p>

      {(hires ?? []).map((h) => {
        const job = Array.isArray(h.jobs) ? h.jobs[0] : h.jobs;
        const co = Array.isArray(h.companies) ? h.companies[0] : h.companies;
        return (
          <Card key={h.id as string} className="mt-6">
            <CardHeader>
              <CardTitle>Did you start at {co?.name}?</CardTitle>
              <CardDescription>
                {co?.name} says they hired you as {job?.title}, starting{" "}
                {h.start_date as string}. Confirm it and the person who vouched for
                you gets paid — 60 days after your start date.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <form action={confirmHire}>
                <input type="hidden" name="hire_id" value={h.id as string} />
                <Button type="submit">Yes, I started there</Button>
              </form>
              <p className="text-sm text-muted-foreground">
                If this isn&apos;t right, don&apos;t confirm it — tell us instead.
              </p>
            </CardContent>
          </Card>
        );
      })}

      {(started ?? []).map((h) => {
        const job = Array.isArray(h.jobs) ? h.jobs[0] : h.jobs;
        const co = Array.isArray(h.companies) ? h.companies[0] : h.companies;
        return (
          <Card key={h.id as string} className="mt-6">
            <CardHeader>
              <CardTitle>
                {job?.title} at {co?.name}
              </CardTitle>
              <CardDescription>
                You started here on {h.start_date as string}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SeparationPanel
                hire={h as unknown as SeparationHire}
                side="seeker"
                otherParty={co?.name ?? "your employer"}
              />
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
                <CardTitle className="text-lg">
                  {job ? (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="underline-offset-[0.2em] hover:text-brand-800 hover:underline"
                    >
                      {job.title}
                    </Link>
                  ) : (
                    "A role that's since closed"
                  )}
                </CardTitle>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Avatar
                    src={company?.logo_url}
                    name={company?.name}
                    size="sm"
                    contain
                  />
                  <span className="text-muted-foreground">{company?.name}</span>
                  <Badge variant={r.status === "vouched" ? "success" : "soft"}>
                    {STATUS_TEXT[r.status as string] ?? (r.status as string)}
                  </Badge>
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {r.message ? (
                    /* Their own words, set apart from the page's voice. */
                    <blockquote className="measure border-l-2 border-brand-200 pl-3 italic">
                      {r.message}
                    </blockquote>
                  ) : null}
                  <p className="mt-2">
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
            <CardContent className="py-8 text-center">
              <p className="font-semibold">
                You haven&apos;t asked for any intros yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Find a role you want, and someone who already works there
                decides whether to back you.
              </p>
              <Button className="mt-5" render={<Link href="/jobs" />}>
                Browse open roles
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

        <AiNotice className="mt-8" />
      </main>
    </>
  );
}
