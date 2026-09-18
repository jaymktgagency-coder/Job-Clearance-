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
import { PictureForm } from "@/components/picture-form";
import { CompanyInterests, type InterestRow } from "./CompanyInterests";
import { uploadAvatar, removeAvatar } from "./actions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "seeker") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: p }, { data: interestRows }, { data: allCompanies }] = await Promise.all([
    supabase
      .from("seeker_profiles")
      .select("headline, location, bio, years_experience, skills, desired_titles, open_to_work, resume_path, resume_uploaded_at, resume_parsed, resume_parsed_at")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("seeker_company_interests")
      .select("id, company_id, note, companies(name, logo_url)")
      .eq("seeker_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name").order("name"),
  ]);

  const interests: InterestRow[] = (interestRows ?? []).map((row) => {
    const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    return {
      id: row.id as string,
      company_id: row.company_id as string,
      note: (row.note as string | null) ?? null,
      company_name: (c?.name as string) ?? "A company",
      company_logo: (c?.logo_url as string | null) ?? null,
    };
  });

  // Only offer what is not already on the list, so adding a duplicate is not
  // something the screen lets you try and then refuses.
  const chosen = new Set(interests.map((i) => i.company_id));
  const addable = (allCompanies ?? [])
    .filter((c) => !chosen.has(c.id as string))
    .map((c) => ({ id: c.id as string, name: c.name as string }));

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
          <CardTitle>Your picture</CardTitle>
          <CardDescription>
            Shown next to your name wherever you appear — in a voucher&apos;s
            inbox, and on an employer&apos;s list of candidates. Optional, but a
            face makes a stranger far likelier to read the rest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PictureForm
            currentUrl={profile.avatar_url}
            name={profile.full_name}
            uploadAction={uploadAvatar}
            removeAction={removeAvatar}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
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
          <CardTitle>Companies you want to work at</CardTitle>
          <CardDescription>
            This is the one place you can be found rather than doing the
            finding. Naming a company lets its <strong>verified employees</strong>{" "}
            see your profile and write to you first.
            <br />
            <br />
            They see your name, picture, headline, location, years of
            experience, skills and the titles you&apos;re after. They do{" "}
            <strong>not</strong> see your email address or your resume — those
            stay private unless you accept someone&apos;s message and ask them
            for an intro. Remove a company any time and they lose access
            straight away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyInterests
            interests={interests}
            companies={addable}
            openToWork={p?.open_to_work ?? true}
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
