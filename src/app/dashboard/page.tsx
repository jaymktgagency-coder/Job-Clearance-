/**
 * /dashboard — where everyone lands after signing in.
 *
 * Plain English: one page, three completely different views depending on who
 * you are. A seeker sees their profile and their open requests; a voucher
 * sees their inbox and track record; an employer sees their roles, their
 * verification progress and their invitations.
 *
 * The header at the top is shared with every other signed-in screen, and the
 * profile is fetched once here and handed to it rather than looked up twice.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { currentUser, currentProfile } from "@/lib/auth";
import { adminCheck } from "@/lib/admin";
import { InviteForm } from "./InviteForm";
import { AiNotice } from "@/components/ai-notice";
import { AppHeader } from "@/components/app-header";
import { HelloOverlay } from "@/components/hello-overlay";
import { InlineLink } from "@/components/inline-link";
import { StatusLine } from "@/components/status-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  domain: "Verified Domain",
  business: "Verified Business",
  none: "Not verified yet",
};

/**
 * A single number with its meaning under it.
 *
 * The figure is set in the display face at a size that can be read across a
 * room, because these are the things you open the page to check.
 */
function Stat({
  value,
  label,
  hint,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="tabular font-heading text-3xl leading-none font-semibold">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      {hint ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  // Next 16 hands these over as a promise, so it has to be awaited.
  searchParams: Promise<{ hello?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const profile = await currentProfile();
  if (!profile) redirect("/onboarding");

  // Set by signing in. Plays the "hello" animation over the top of this page
  // once, then takes itself away. The dashboard below is built and rendered
  // either way — the greeting never holds it up.
  const greet = (await searchParams).hello === "1";

  const supabase = await createClient();

  // Whether to offer the platform's own queue. An admin is not a role, so
  // this is the one place the dashboard asks.
  const { isAdmin } = await adminCheck();

  return (
    <>
      {greet ? <HelloOverlay /> : null}

      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
          {profile.full_name ?? "Your account"}
        </h1>

        {profile.role === "seeker" ? <SeekerView /> : null}
        {profile.role === "voucher" ? <VoucherView /> : null}
        {profile.role === "employer" ? <EmployerView /> : null}

        {/* Vouch's own work, not this account's — so it sits under whatever
            their role brought them here for, and only they can see it. */}
        {isAdmin ? (
          <section className="mt-12 border-t border-border pt-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              Platform
            </h2>
            <Button
              variant="outline"
              className="mt-3"
              render={<Link href="/admin/payouts" />}
            >
              Payouts waiting to be sent
            </Button>
          </section>
        ) : null}
      </main>
    </>
  );

  async function SeekerView() {
    const { data: p } = await supabase
      .from("seeker_profiles")
      .select("headline, location, resume_path")
      .maybeSingle();
    const { count: openRequests } = await supabase
      .from("intro_requests")
      .select("id", { count: "exact" })
      .eq("status", "pending")
      .limit(1);
    const { count: openJobs } = await supabase
      .from("jobs")
      .select("id", { count: "exact" })
      .eq("status", "open")
      .limit(1);

    return (
      <div className="mt-10 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/jobs" />}>
            Browse open roles
            <ArrowRightIcon aria-hidden="true" />
          </Button>
          <Button variant="outline" render={<Link href="/profile" />}>
            Edit my profile
          </Button>
        </div>

        <Card>
          <CardContent className="grid gap-8 sm:grid-cols-3">
            <Stat
              value={openJobs ?? 0}
              label="Open roles"
              hint="On Vouch right now"
            />
            <Stat
              value={openRequests ?? 0}
              label="Your open requests"
              hint="Five allowed at once"
            />
            <Stat value="$0" label="What you pay" hint="Now and always" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              {p?.headline ?? "No headline yet — vouchers read this first."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <StatusLine state={p?.headline ? "done" : "waiting"}>
              {p?.headline ? "Headline written" : "No headline yet"}
            </StatusLine>
            <StatusLine state={p?.location ? "done" : "waiting"}>
              {p?.location ?? "No location yet"}
            </StatusLine>
            <StatusLine state={p?.resume_path ? "done" : "waiting"}>
              {p?.resume_path ? (
                "Resume uploaded"
              ) : (
                <>
                  No resume yet —{" "}
                  <InlineLink href="/profile">add one</InlineLink>
                </>
              )}
            </StatusLine>
          </CardContent>
        </Card>

        <AiNotice />
      </div>
    );
  }

  async function VoucherView() {
    const { data: vp } = await supabase
      .from("voucher_profiles")
      .select(
        "status, verification_method, job_title, companies(name), locations(label)"
      )
      .maybeSingle();

    const company = Array.isArray(vp?.companies) ? vp?.companies[0] : vp?.companies;
    const location = Array.isArray(vp?.locations) ? vp?.locations[0] : vp?.locations;
    const verified = vp?.status === "verified";

    // Their inbox: requests for jobs at their company. Row-level security
    // means an unverified voucher simply sees nothing here.
    const { count: waiting } = await supabase
      .from("intro_requests")
      .select("id", { count: "exact" })
      .eq("status", "pending")
      .limit(1);

    const { data: rep } = await supabase
      .from("voucher_reputation")
      .select("vouches_written, hires_resulting, hires_measured, retention_pct")
      .maybeSingle();

    return (
      <div className="mt-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              {company?.name ?? "Your company"}
              {verified ? (
                <Badge>Verified</Badge>
              ) : (
                <Badge variant="soft">
                  {vp?.status === "pending"
                    ? "Verification pending"
                    : "Not verified"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {[vp?.job_title, location?.label].filter(Boolean).join(" · ") ||
                "No job title set"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verified ? (
              <p className="text-sm text-muted-foreground">
                {vp?.verification_method === "employer_invite"
                  ? "Verified because your employer invited you directly."
                  : "Verified by your work email."}{" "}
                You can vouch for people applying where you work.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You can&apos;t vouch until you&apos;re verified — that&apos;s
                  what makes a vouch mean something.
                </p>
                <Button variant="outline" render={<Link href="/verify" />}>
                  Verify with my work email
                </Button>
                <p className="text-sm text-muted-foreground">
                  No company email address? Ask your employer to invite you
                  directly instead.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-8 sm:grid-cols-3">
            <Stat
              value={rep?.vouches_written ?? 0}
              label="Vouches written"
              hint="What employers see by your name"
            />
            <Stat
              value={rep?.hires_resulting ?? 0}
              label="Led to a hire"
              hint="Confirmed by both sides"
            />
            <Stat
              value={
                rep?.retention_pct != null ? `${rep.retention_pct}%` : "—"
              }
              label="Still there at 60 days"
              hint={
                rep?.retention_pct != null
                  ? undefined
                  : "Shown after five measured hires"
              }
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your inbox</CardTitle>
              <CardDescription>
                {waiting ?? 0} waiting on a vouch · five open at once
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verified ? (
                <Button render={<Link href="/inbox" />}>
                  Open my inbox
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your inbox opens once you are verified.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting paid</CardTitle>
              <CardDescription>
                Half the fee, 60 days after they start
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You can vouch without setting this up. You just can&apos;t be
                paid until it&apos;s done.
              </p>
              <Button
                variant="outline"
                render={<Link href="/voucher/payouts" />}
              >
                Payouts and earnings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  async function EmployerView() {
    const { data: membership } = await supabase
      .from("company_members")
      .select(
        "member_role, companies(id, name, verification_tier, payment_method_on_file, business_registration_verified_at, domain_verified_at)"
      )
      .maybeSingle();

    const company = Array.isArray(membership?.companies)
      ? membership?.companies[0]
      : membership?.companies;
    const tier = company?.verification_tier ?? "none";

    const { count: jobs } = await supabase
      .from("jobs")
      .select("id", { count: "exact" })
      .limit(1);
    const { count: candidates } = await supabase
      .from("applications")
      .select("id", { count: "exact" })
      .limit(1);
    const { data: invites } = await supabase
      .from("voucher_invitations")
      .select("email, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return (
      <div className="mt-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              {company?.name ?? "Your company"}
              <Badge variant={tier === "none" ? "soft" : "default"}>
                {TIER_LABEL[tier]}
              </Badge>
            </CardTitle>
            <CardDescription>
              {tier === "domain"
                ? "Your staff can verify themselves with a work email."
                : tier === "business"
                  ? "Invite your staff directly — no company email domain needed."
                  : "Add a payment method and your business registration to earn Verified Business."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5 sm:grid-cols-3">
            <StatusLine
              state={company?.payment_method_on_file ? "done" : "waiting"}
            >
              Payment method
            </StatusLine>
            <StatusLine
              state={
                company?.business_registration_verified_at ? "done" : "waiting"
              }
            >
              Business registration
            </StatusLine>
            <StatusLine
              state={company?.domain_verified_at ? "done" : "waiting"}
            >
              Email domain
            </StatusLine>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-8 sm:grid-cols-2">
            <Stat value={jobs ?? 0} label="Roles posted" />
            <Stat
              value={candidates ?? 0}
              label="Vouched candidates"
              hint="You never see anyone without a vouch"
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your roles</CardTitle>
              <CardDescription>
                Post a role and see who has been vouched for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/employer/jobs" />}>
                Post a role &amp; see candidates
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invite a voucher</CardTitle>
              <CardDescription>
                Works even without a company email domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InviteForm canInvite={tier !== "none"} />
              {invites && invites.length > 0 ? (
                <ul className="space-y-1.5 border-t border-border pt-4">
                  {invites.map((i) => (
                    <li
                      key={`${i.email}-${i.created_at}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{i.email}</span>
                      <Badge
                        variant={i.status === "accepted" ? "success" : "soft"}
                      >
                        {i.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}
