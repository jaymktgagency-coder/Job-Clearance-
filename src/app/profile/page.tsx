/**
 * /profile — the seeker's own page: who they are, and their resume.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { AiNotice } from "@/components/ai-notice";
import { ParsedResume, type ParsedResumeShape } from "@/components/parsed-resume";
import { ProfileForm, ResumeForm, DeleteAccount } from "./ProfileForms";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "seeker") redirect("/dashboard");

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("seeker_profiles")
    .select("headline, location, bio, years_experience, skills, desired_titles, open_to_work, resume_path, resume_uploaded_at, resume_parsed, resume_parsed_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  // What the AI took away from the resume, if it has read one yet.
  const parsed = (p?.resume_parsed ?? null) as ParsedResumeShape | null;

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Your profile</h1>
        <Button variant="outline" render={<Link href="/jobs" />}>
          Browse roles
        </Button>
      </div>
      <p className="measure mt-3 text-lg text-muted-foreground">
        This is what a voucher reads before deciding whether to back you. Vouch
        is free for job seekers, always.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About you</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            values={{
              full_name: profile.full_name ?? "",
              headline: p?.headline ?? "",
              location: p?.location ?? "",
              bio: p?.bio ?? "",
              years_experience: p?.years_experience?.toString() ?? "",
              skills: (p?.skills ?? []).join(", "),
              desired_titles: (p?.desired_titles ?? []).join(", "),
              open_to_work: p?.open_to_work ?? true,
            }}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your resume</CardTitle>
          <CardDescription>
            Stored privately. Only you, a voucher at a company you&apos;ve asked for
            an intro at, and an employer who has a vouch for you can ever open it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResumeForm
            resumePath={p?.resume_path ?? null}
            uploadedAt={p?.resume_uploaded_at ?? null}
          />
          <AiNotice />
        </CardContent>
      </Card>

      {/* What the AI made of it. Shown to the seeker, always, so a misreading
          is something they can see and correct rather than something that
          quietly follows them around. */}
      {p?.resume_path ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>What we read from your resume</CardTitle>
            <CardDescription>
              {parsed
                ? "This is what our AI took from your file. If something here is wrong or missing, fix it in your resume and upload it again — or correct it in the profile above, which is what vouchers actually read."
                : "Nothing yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parsed ? (
              <ParsedResume parsed={parsed} />
            ) : (
              <p className="text-sm text-muted-foreground">
                We haven&apos;t finished reading your resume. It usually takes under a
                minute — refresh this page. If it never appears, your file may be a
                scan or an old .doc; saving it as a PDF and uploading again fixes
                most cases. Nothing about your application depends on this working.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>Your resume is personal data. You control it.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
      </main>
    </>
  );
}
