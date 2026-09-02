/**
 * /dashboard — where everyone lands after signing in.
 *
 * Plain English: one page that shows a different summary depending on who you
 * are. The real working screens come in Steps 5, 6 and 7 — this proves the
 * account, the role, and the data behind them are all real.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentUser, currentProfile, ROLE_LABEL } from "@/lib/auth";
import { signOut } from "../(auth)/actions";
import { InviteForm } from "./InviteForm";
import { AiNotice } from "@/components/ai-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  domain: "Verified Domain",
  business: "Verified Business",
  none: "Not verified yet",
};

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const profile = await currentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Signed in as {profile.email}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {profile.full_name ?? "Your account"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{ROLE_LABEL[profile.role]}</Badge>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      {profile.role === "seeker" ? <SeekerView /> : null}
      {profile.role === "voucher" ? <VoucherView /> : null}
      {profile.role === "employer" ? <EmployerView /> : null}

      <p className="mt-10 text-sm text-muted-foreground">
        Everything from signing up to hiring works now. AI resume reading and fit
        scoring are the last piece still to come.
      </p>
    </main>
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
      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" render={<Link href="/jobs" />}>
            Browse open roles
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/requests" />}>
            My intro requests
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/profile" />}>
            Edit my profile
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your profile</CardTitle>
            <CardDescription>{p?.headline ?? "No headline yet"}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{p?.location ?? "No location yet"}</p>
            <p className="mt-1">
              {p?.resume_path ? "Resume uploaded" : "No resume yet — that's Step 5"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your intro requests</CardTitle>
            <CardDescription>
              {openRequests ?? 0} open, out of 5 allowed at once
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{openJobs ?? 0} open roles on Vouch right now.</p>
            <p className="mt-2">Vouch is free for job seekers. Always.</p>
          </CardContent>
        </Card>
        </div>
        <AiNotice />
      </div>
    );
  }

  async function VoucherView() {
    const { data: vp } = await supabase
      .from("voucher_profiles")
      .select(`status, verification_method, job_title, identity_verified_at,
               tax_info_collected_at, companies(name), locations(label)`)
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

    // Money with their name on it that has not been sent yet. This is the
    // only thing that makes us ask a voucher for tax details at all — no
    // payout coming, no ask. See /payouts and lib/stripe/connect.ts.
    const { data: coming } = await supabase
      .from("payouts")
      .select("amount_cents, release_at")
      .in("status", ["scheduled", "held"])
      .order("release_at", { ascending: true });

    const owed = (coming ?? []).reduce((sum, p) => sum + (p.amount_cents as number), 0);
    const payoutSetupDone = Boolean(vp?.identity_verified_at && vp?.tax_info_collected_at);
    const needsPayoutSetup = (coming ?? []).length > 0 && !payoutSetupDone;

    return (
      <div className="mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3 text-base">
              {company?.name ?? "Your company"}
              <Badge variant={verified ? "default" : "outline"}>
                {verified ? "Verified" : vp?.status === "pending" ? "Verification pending" : "Not verified"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {[vp?.job_title, location?.label].filter(Boolean).join(" · ") || "No job title set"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {verified ? (
              <p>
                {vp?.verification_method === "employer_invite"
                  ? "Verified because your employer invited you directly."
                  : "Verified by your work email."}{" "}
                You can vouch for people applying where you work.
              </p>
            ) : (
              <>
                <p>
                  You can&apos;t vouch until you&apos;re verified — that&apos;s what makes a
                  vouch mean something.
                </p>
                <p className="mt-3">
                  <Link href="/verify" className="font-medium underline underline-offset-4">
                    Verify with your work email
                  </Link>{" "}
                  — or ask your employer to invite you directly.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Only ever shown to a voucher who has actually earned something.
            A voucher with no payout coming sees nothing here and is asked
            for nothing — that is the whole point of leaving this until now. */}
        {needsPayoutSetup ? (
          <Card className="border-foreground/20">
            <CardHeader>
              <CardTitle className="text-base">{money(owed)} is waiting for you</CardTitle>
              <CardDescription>We need your details before we can send it</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Someone you vouched for was hired. To pay you we need to know who
                you are and have your tax details — that is the law for anyone
                paying you, not a Vouch rule. It takes about five minutes, on
                Stripe&apos;s own site rather than this one.
              </p>
              <Button size="sm" render={<Link href="/payouts" />}>
                Set up getting paid
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {(coming ?? []).length > 0 && payoutSetupDone ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{money(owed)} on its way</CardTitle>
              <CardDescription>Nothing for you to do</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <Button size="sm" variant="outline" render={<Link href="/payouts" />}>
                See what you&apos;re owed
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your inbox</CardTitle>
              <CardDescription>{waiting ?? 0} people waiting on a vouch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>You can have 5 open vouches at once.</p>
              {verified ? (
                <Button size="sm" render={<Link href="/inbox" />}>
                  Open my inbox
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your track record</CardTitle>
              <CardDescription>What employers see next to your name</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{rep?.vouches_written ?? 0} vouches written</p>
              <p>{rep?.hires_resulting ?? 0} led to a hire</p>
              <p>
                {rep?.retention_pct != null
                  ? `${rep.retention_pct}% still there at 60 days`
                  : "Retention rate appears after 5 measured hires"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  async function EmployerView() {
    const { data: membership } = await supabase
      .from("company_members")
      .select("member_role, companies(id, name, verification_tier, payment_method_on_file, business_registration_verified_at, domain_verified_at)")
      .maybeSingle();

    const company = Array.isArray(membership?.companies)
      ? membership?.companies[0]
      : membership?.companies;
    const tier = company?.verification_tier ?? "none";

    const { count: jobs } = await supabase
      .from("jobs").select("id", { count: "exact" }).limit(1);
    const { count: candidates } = await supabase
      .from("applications").select("id", { count: "exact" }).limit(1);
    const { data: invites } = await supabase
      .from("voucher_invitations")
      .select("email, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return (
      <div className="mt-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3 text-base">
              {company?.name ?? "Your company"}
              <Badge variant={tier === "none" ? "outline" : "default"}>{TIER_LABEL[tier]}</Badge>
            </CardTitle>
            <CardDescription>
              {tier === "domain"
                ? "Your staff can verify themselves with a work email."
                : tier === "business"
                  ? "Invite your staff directly — no company email domain needed."
                  : "Add a payment method and your business registration to earn Verified Business."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <p>{company?.payment_method_on_file ? "✅" : "⚪️"} Payment method</p>
            <p>{company?.business_registration_verified_at ? "✅" : "⚪️"} Business registration</p>
            <p>{company?.domain_verified_at ? "✅" : "⚪️"} Email domain</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your roles</CardTitle>
              <CardDescription>{jobs ?? 0} posted</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{candidates ?? 0} vouched candidates.</p>
              <p>You only ever see candidates someone vouched for.</p>
              <Button size="sm" render={<Link href="/employer/jobs" />}>
                Post a role &amp; see candidates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite a voucher</CardTitle>
              <CardDescription>
                Works even without a company email domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InviteForm canInvite={tier !== "none"} />
              {invites && invites.length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {invites.map((i) => (
                    <li key={`${i.email}-${i.created_at}`}>
                      {i.email} — {i.status}
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
