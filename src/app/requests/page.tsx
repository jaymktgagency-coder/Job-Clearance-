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
import { OutreachPanel, type ApproachRow } from "@/components/outreach-panel";
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

  // Employees who wrote to this seeker first. Declined and withdrawn ones are
  // left out — an answered "no" is not something to keep showing somebody.
  const { data: approachRows } = await supabase
    .from("voucher_outreach")
    .select(`id, message, status, created_at, company_id,
             users!voucher_outreach_voucher_id_fkey(full_name, avatar_url, voucher_profiles(job_title)),
             companies(name, logo_url)`)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false });

  // The open roles at the companies whose approaches were accepted — that is
  // the "now ask them for an intro" step. One query for all of them rather
  // than one per card.
  const acceptedCompanies = (approachRows ?? [])
    .filter((a) => a.status === "accepted")
    .map((a) => a.company_id as string);

  const { data: rolesAtThoseCompanies } = acceptedCompanies.length
    ? await supabase
        .from("jobs")
        .select("id, title, company_id")
        .eq("status", "open")
        .in("company_id", acceptedCompanies)
    : { data: [] };

  const approaches: ApproachRow[] = (approachRows ?? []).map((a) => {
    const v = Array.isArray(a.users) ? a.users[0] : a.users;
    const vpRaw = v?.voucher_profiles;
    const vp = Array.isArray(vpRaw) ? vpRaw[0] : vpRaw;
    const c = Array.isArray(a.companies) ? a.companies[0] : a.companies;
    return {
      id: a.id as string,
      message: a.message as string,
      status: a.status as string,
      created_at: a.created_at as string,
      voucher_name: (v?.full_name as string) ?? "Someone",
      voucher_avatar: (v?.avatar_url as string | null) ?? null,
      voucher_title: (vp?.job_title as string | null) ?? null,
      company_name: (c?.name as string) ?? "their company",
      company_logo: (c?.logo_url as string | null) ?? null,
      openRoles: (rolesAtThoseCompanies ?? [])
        .filter((j) => j.company_id === a.company_id)
        .map((j) => ({ id: j.id as string, title: j.title as string })),
    };
  });

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

      {/* Above the seeker's own requests on purpose: somebody has written to
          them and is waiting, which is more urgent than the state of a
          request they sent last week. */}
      {approaches.length > 0 ? (
        <section className="mt-10 space-y-4">
          <h2 className="font-heading text-xl font-semibold">
            {approaches.length === 1
              ? "Someone reached out to you"
              : "People who reached out to you"}
          </h2>
          {approaches.map((a) => (
            <OutreachPanel key={a.id} approach={a} />
          ))}
        </section>
      ) : null}

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
