/**
 * /employer/jobs/<id> — the vouched candidates for one role.
 *
 * Every person here arrived with a vouch. There is no pile of cold
 * applications to wade through, because the database only ever creates a
 * candidate record when someone vouches.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { setCandidateStatus } from "../../actions";
import { HireForm } from "./HireForm";
import { SeparationPanel, type SeparationHire } from "@/components/separation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

const NEXT_STEPS: Record<string, { value: string; label: string }[]> = {
  new: [{ value: "reviewing", label: "Start reviewing" }, { value: "passed", label: "Pass" }],
  reviewing: [{ value: "interviewed", label: "Interviewed them" }, { value: "passed", label: "Pass" }],
  interviewed: [{ value: "offered", label: "Made an offer" }, { value: "passed", label: "Pass" }],
  offered: [{ value: "passed", label: "They declined" }],
  hired: [],
  passed: [{ value: "reviewing", label: "Reconsider" }],
};

export default async function CandidatesPage(props: PageProps<"/employer/jobs/[id]">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employer") redirect("/dashboard");

  const { id } = await props.params;
  const params = await props.searchParams;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, fee_amount_cents, voucher_share_bps, locations(label)")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const location = Array.isArray(job.locations) ? job.locations[0] : job.locations;

  const { data: candidates } = await supabase
    .from("applications")
    .select(`
      id, status, ai_fit_score, ai_reasoning, created_at, seeker_id,
      users!applications_seeker_id_fkey(full_name, seeker_profiles(headline, location, years_experience, skills, resume_path)),
      vouches(body, relationship, disclosed_fee_cents, created_at,
              users!vouches_voucher_id_fkey(full_name, voucher_profiles(job_title))),
      hires(id, start_date, status, confirmed_by_seeker_at,
            separated_at, separation_reported_by, separation_reported_at, separation_claimed_date,
            separation_confirmed_by_employer_at, separation_confirmed_by_seeker_at, separation_disputed_at)
    `)
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Short-lived links to each resume. They only resolve because the storage
  // rules allow this employer to read these particular files.
  const resumeLinks = new Map<string, string>();
  for (const c of candidates ?? []) {
    const person = Array.isArray(c.users) ? c.users[0] : c.users;
    const sp = Array.isArray(person?.seeker_profiles) ? person?.seeker_profiles[0] : person?.seeker_profiles;
    if (sp?.resume_path) {
      const { data: signed } = await supabase.storage.from("resumes").createSignedUrl(sp.resume_path, 300);
      if (signed?.signedUrl) resumeLinks.set(c.id as string, signed.signedUrl);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Button variant="ghost" size="sm" render={<Link href="/employer/jobs" />}>
        ← Your roles
      </Button>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{job.title as string}</h1>
      <p className="mt-1 text-muted-foreground">
        {location?.label ? `${location.label} · ` : ""}
        {job.status as string} · {money(job.fee_amount_cents as number)} if you hire
      </p>

      {params.posted ? (
        <p role="status" className="mt-6 rounded-md border px-3 py-2 text-sm">
          Posted. Seekers can find it now, and anyone vouched for will appear here.
        </p>
      ) : null}

      <div className="mt-8 space-y-4">
        {(candidates ?? []).map((c) => {
          const person = Array.isArray(c.users) ? c.users[0] : c.users;
          const sp = Array.isArray(person?.seeker_profiles) ? person?.seeker_profiles[0] : person?.seeker_profiles;
          const vouch = Array.isArray(c.vouches) ? c.vouches[0] : c.vouches;
          const voucher = vouch ? (Array.isArray(vouch.users) ? vouch.users[0] : vouch.users) : null;
          const voucherProfile = voucher
            ? Array.isArray(voucher.voucher_profiles) ? voucher.voucher_profiles[0] : voucher.voucher_profiles
            : null;
          const hire = Array.isArray(c.hires) ? c.hires[0] : c.hires;
          const resume = resumeLinks.get(c.id as string);

          return (
            <Card key={c.id as string}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {person?.full_name ?? "Someone"}
                  <Badge variant={c.status === "hired" ? "default" : "outline"}>{c.status as string}</Badge>
                </CardTitle>
                <CardDescription>
                  {sp?.headline ?? "No headline"}
                  {sp?.location ? ` · ${sp.location}` : ""}
                  {sp?.years_experience != null ? ` · ${sp.years_experience} years` : ""}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                {/* The vouch. This is the reason they're on your screen. */}
                {vouch ? (
                  <div className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {voucher?.full_name ?? "A colleague"}
                        {voucherProfile?.job_title ? `, ${voucherProfile.job_title}` : ""}
                      </span>
                      <Badge variant={vouch.relationship === "knows_personally" ? "default" : "secondary"}>
                        {vouch.relationship === "knows_personally"
                          ? "Knows them personally"
                          : "Reviewed their profile only"}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-line">{vouch.body}</p>
                    <p className="mt-2 text-muted-foreground">
                      They receive {money(vouch.disclosed_fee_cents as number)} if you hire this
                      person and they stay 60 days.
                    </p>
                  </div>
                ) : null}

                {/* The AI score, when there is one. Never on its own — the
                    database refuses to store a score without its reasoning,
                    and refuses any update that scores and moves someone at
                    the same time. */}
                <div className="rounded-md border bg-muted/40 p-3">
                  {c.ai_fit_score != null ? (
                    <>
                      <p className="font-medium">
                        AI fit score: {c.ai_fit_score} / 100 — advisory only
                      </p>
                      <p className="mt-1 whitespace-pre-line text-muted-foreground">
                        {c.ai_reasoning}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        A suggestion about reading order, nothing more. It is
                        told to ignore age, sex, race, nationality, religion,
                        disability, family status, school prestige, employment
                        gaps, and how polished the writing is.
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No AI score for this candidate. That happens when scoring is
                      switched off, or when it couldn&apos;t produce reasoning it could
                      stand behind — we store nothing rather than a bare number. Read
                      the vouch; it is the better signal anyway.
                    </p>
                  )}
                  <p className="mt-2 text-muted-foreground">
                    Whatever the score says, the decision on this page is yours. Nothing
                    here rejects anyone automatically.
                  </p>
                </div>

                {resume ? (
                  <Button variant="outline" size="sm" render={<a href={resume} target="_blank" rel="noreferrer" />}>
                    Open their resume
                  </Button>
                ) : (
                  <p className="text-muted-foreground">No resume uploaded.</p>
                )}

                {/* What happens next — a person chooses. */}
                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  {(NEXT_STEPS[c.status as string] ?? []).map((step) => (
                    <form key={step.value} action={setCandidateStatus}>
                      <input type="hidden" name="application_id" value={c.id as string} />
                      <input type="hidden" name="status" value={step.value} />
                      <Button type="submit" size="sm" variant="outline">
                        {step.label}
                      </Button>
                    </form>
                  ))}

                  {c.status !== "hired" && !hire ? (
                    <HireForm applicationId={c.id as string} name={person?.full_name ?? "them"} />
                  ) : null}
                </div>

                {hire ? (
                  <>
                    <p className="text-muted-foreground">
                      Hire recorded, starting {hire.start_date}.{" "}
                      {hire.confirmed_by_seeker_at
                        ? "They've confirmed it too, so the fee is due and the voucher's share is scheduled."
                        : "Waiting for them to confirm — nothing is owed until they do."}
                    </p>

                    {/* Did this job end? Either side can say so; the other has
                        to agree before any money moves. Without this the
                        60-day hold means nothing. */}
                    <SeparationPanel
                      hire={hire as unknown as SeparationHire}
                      side="employer"
                      otherParty={person?.full_name?.split(" ")[0] ?? "them"}
                    />
                  </>
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        {(candidates ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <p>No vouched candidates yet.</p>
              <p className="mt-1">
                People appear here only once a verified employee has vouched for
                them — never as a pile of cold applications.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
