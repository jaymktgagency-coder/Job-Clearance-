/**
 * /profile — the seeker's own page: who they are, and their resume.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { AiNotice } from "@/components/ai-notice";
import { ProfileForm, ResumeForm, DeleteAccount } from "./ProfileForms";
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
    .select("headline, location, bio, years_experience, skills, desired_titles, open_to_work, resume_path, resume_uploaded_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/jobs" />}>
            Browse roles
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground">
        This is what a voucher reads before deciding whether to back you. Vouch
        is free for job seekers, always.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">About you</CardTitle>
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
          <CardTitle className="text-base">Your resume</CardTitle>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>Your resume is personal data. You control it.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
    </main>
  );
}
