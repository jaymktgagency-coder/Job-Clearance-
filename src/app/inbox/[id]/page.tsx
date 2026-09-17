/**
 * /inbox/<id> — everything the voucher needs to make an honest decision.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { minimumVouchLength } from "../actions";
import { VouchForm } from "./VouchForm";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export default async function RequestPage(props: PageProps<"/inbox/[id]">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const { id } = await props.params;
  const supabase = await createClient();

  const { data: vp } = await supabase.from("voucher_profiles").select("status").maybeSingle();
  if (vp?.status !== "verified") redirect("/verify");

  const { data: request } = await supabase
    .from("intro_requests")
    .select("id, message, status, created_at, seeker_id, jobs(id, title, description, fee_amount_cents, voucher_share_bps, companies(name))")
    .eq("id", id)
    .maybeSingle();

  if (!request) notFound();

  const job = Array.isArray(request.jobs) ? request.jobs[0] : request.jobs;
  const company = job ? (Array.isArray(job.companies) ? job.companies[0] : job.companies) : null;

  // The seeker: their user row, their profile, and their resume.
  const { data: person } = await supabase
    .from("users")
    .select("full_name, seeker_profiles(headline, location, bio, years_experience, skills, desired_titles, resume_path)")
    .eq("id", request.seeker_id)
    .maybeSingle();

  const sp = Array.isArray(person?.seeker_profiles)
    ? person?.seeker_profiles[0]
    : person?.seeker_profiles;

  // A short-lived link to the resume. It only works because the storage rules
  // allow this voucher to read this particular file.
  let resumeUrl: string | null = null;
  if (sp?.resume_path) {
    const { data: signed } = await supabase.storage
      .from("resumes")
      .createSignedUrl(sp.resume_path, 300);
    resumeUrl = signed?.signedUrl ?? null;
  }

  const earns = job ? money((job.fee_amount_cents * job.voucher_share_bps) / 10000) : "$0";
  const minimum = await minimumVouchLength();
  const stillOpen = request.status === "pending";

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <Button variant="ghost" size="sm" render={<Link href="/inbox" />}>
        <ArrowLeftIcon aria-hidden="true" />
        Inbox
      </Button>

      <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">
        {person?.full_name ?? "Someone"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Asking for an intro to{" "}
        <strong className="font-semibold text-foreground">{job?.title}</strong>{" "}
        at {company?.name}
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Their profile</CardTitle>
          <CardDescription>{sp?.headline ?? "No headline yet"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            {sp?.location ? <span>{sp.location}</span> : null}
            {sp?.years_experience != null ? <span>{sp.years_experience} years experience</span> : null}
          </div>

          {sp?.bio ? (
            <p className="measure whitespace-pre-line">{sp.bio}</p>
          ) : null}

          {(sp?.skills ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(sp?.skills ?? []).map((s: string) => (
                <Badge key={s} variant="soft">
                  {s}
                </Badge>
              ))}
            </div>
          ) : null}

          {(sp?.desired_titles ?? []).length > 0 ? (
            <p className="text-muted-foreground">
              Looking for: {(sp?.desired_titles ?? []).join(", ")}
            </p>
          ) : null}

          {resumeUrl ? (
            <Button variant="outline" size="sm" render={<a href={resumeUrl} target="_blank" rel="noreferrer" />}>
              Open their resume
            </Button>
          ) : (
            <p className="text-muted-foreground">No resume uploaded.</p>
          )}

          {request.message ? (
            <div className="rounded-lg bg-sunken p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                What they said to you
              </p>
              <blockquote className="measure mt-2 border-l-2 border-brand-300 pl-3 italic">
                {request.message}
              </blockquote>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>The role</CardTitle>
          <CardDescription>{job?.title} · {company?.name}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="measure whitespace-pre-line">{job?.description}</p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            {stillOpen ? "Your decision" : "This request is closed"}
          </CardTitle>
          {stillOpen ? (
            <CardDescription>
              Your name goes on this. Say what you actually think.
            </CardDescription>
          ) : (
            <CardDescription>
              It&apos;s already been {request.status}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {stillOpen ? (
            <VouchForm
              requestId={request.id as string}
              minimum={minimum}
              earns={earns}
              seekerName={person?.full_name ?? "This person"}
            />
          ) : (
            <Button variant="outline" render={<Link href="/inbox" />}>
              Back to your inbox
            </Button>
          )}
        </CardContent>
      </Card>
      </main>
    </>
  );
}
