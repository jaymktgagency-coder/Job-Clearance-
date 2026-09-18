/**
 * /jobs/<id> — one role, and the button that asks for an intro.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { AiNotice } from "@/components/ai-notice";
import { RequestForm } from "./RequestForm";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  domain: "Verified Domain",
  business: "Verified Business",
  none: "Not verified",
};

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");

  const { id } = await props.params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, pay_type, pay_min_cents, pay_max_cents, status, companies(name, description, verification_tier), locations(label, city, region)")
    .eq("id", id)
    .maybeSingle();

  if (!job) notFound();

  const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
  const location = Array.isArray(job.locations) ? job.locations[0] : job.locations;

  const { data: existing } = await supabase
    .from("intro_requests")
    .select("id, status")
    .eq("job_id", id)
    .maybeSingle();

  const { count: openCount } = await supabase
    .from("intro_requests")
    .select("id", { count: "exact" })
    .eq("status", "pending")
    .limit(1);

  const isSeeker = profile.role === "seeker";

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
        <Button variant="ghost" className="px-3" render={<Link href="/jobs" />}>
          <ArrowLeftIcon aria-hidden="true" />
          All roles
        </Button>

        <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">
          {job.title as string}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-muted-foreground">
          <span className="font-semibold text-foreground">{company?.name}</span>
          {company?.verification_tier && company.verification_tier !== "none" ? (
            <Badge variant="soft">
              {TIER_LABEL[company.verification_tier]}
            </Badge>
          ) : null}
          {location?.label ? (
            <span>
              · {location.label}
              {location.city ? `, ${location.city}` : ""}
            </span>
          ) : null}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>About the role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="measure text-sm whitespace-pre-line">
              {job.description as string}
            </p>
            {company?.description ? (
              <p className="measure text-sm text-muted-foreground">
                {company.description}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {isSeeker ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Ask for an intro</CardTitle>
              <CardDescription>
                A verified employee at {company?.name} reads your profile and
                decides whether to vouch for you. They can also say no —
                that&apos;s normal, and it costs you nothing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {existing ? (
                <p
                  role="status"
                  className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900"
                >
                  {existing.status === "pending"
                    ? `Request sent — waiting on a verified employee at ${company?.name ?? "that company"} to pick it up. You'll see it under "My requests".`
                    : existing.status === "vouched"
                      ? "Someone vouched for you on this role."
                      : `This request is ${existing.status}.`}
                </p>
              ) : (
                <RequestForm
                  jobId={job.id as string}
                  atCap={(openCount ?? 0) >= 5}
                />
              )}
              <AiNotice />
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  );
}
