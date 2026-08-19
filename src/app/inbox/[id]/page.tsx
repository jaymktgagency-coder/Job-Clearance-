/**
 * /inbox/<id> — everything the voucher needs to make an honest decision.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { minimumVouchLength } from "../actions";
import { VouchForm } from "./VouchForm";
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
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Button variant="ghost" size="sm" render={<Link href="/inbox" />}>
        ← Inbox
      </Button>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {person?.full_name ?? "Someone"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Asking for an intro to <strong>{job?.title}</strong> at {company?.name}
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Their profile</CardTitle>
          <CardDescription>{sp?.headline ?? "No headline yet"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            {sp?.location ? <span>{sp.location}</span> : null}
            {sp?.years_experience != null ? <span>{sp.years_experience} years experience</span> : null}
          </div>

          {sp?.bio ? <p className="whitespace-pre-line">{sp.bio}</p> : null}

          {(sp?.skills ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(sp?.skills ?? []).map((s: string) => (
                <Badge key={s} variant="secondary">{s}</Badge>
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
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">What they said to you:</p>
              <p className="mt-1 italic">&ldquo;{request.message}&rdquo;</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">The role</CardTitle>
          <CardDescription>{job?.title} · {company?.name}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="whitespace-pre-line">{job?.description}</p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
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
  );
}
