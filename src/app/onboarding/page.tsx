/**
 * /onboarding — the step between "I have a login" and "I have an account".
 *
 * If someone has already finished, this sends them straight to their
 * dashboard, so it's safe to bounce people here after signing in.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser, currentProfile, pendingRole, pendingInviteToken, ROLE_LABEL, homeFor, homeAfterSignIn } from "@/lib/auth";
import { hashInviteToken } from "@/lib/invites";
import { OnboardingForm } from "./OnboardingForm";
import { AuthShell } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  // Next 16 hands these over as a promise, so it has to be awaited.
  searchParams: Promise<{ hello?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Signing in lands here first, so the greeting flag arrives here and has to
  // be carried the rest of the way to the dashboard.
  const greet = (await searchParams).hello === "1";

  // Already done? Straight through — to wherever this role actually starts,
  // which for a seeker is the job list rather than the dashboard.
  const existing = await currentProfile();
  if (existing) {
    redirect(greet ? homeAfterSignIn(existing.role) : homeFor(existing.role));
  }

  const role = pendingRole(user.user_metadata);
  if (!role) redirect("/signup");

  // Vouchers pick an employer from the companies already on Vouch.
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, verification_tier")
    .order("name");

  // If they arrived by invitation, name the company that invited them.
  let invitedCompany: string | null = null;
  const token = pendingInviteToken(user.user_metadata);
  if (token) {
    try {
      const admin = await createAdminClient();
      const { data } = await admin
        .from("voucher_invitations")
        .select("status, companies(name)")
        .eq("token_hash", hashInviteToken(token))
        .maybeSingle();
      if (data?.status === "sent") {
        const c = data.companies as { name: string } | { name: string }[] | null;
        invitedCompany = Array.isArray(c) ? (c[0]?.name ?? null) : (c?.name ?? null);
      }
    } catch {
      invitedCompany = null;
    }
  }

  return (
    <AuthShell
      title="Almost there."
      description={
        <>
          Setting you up as a{" "}
          <strong className="font-semibold text-foreground">
            {ROLE_LABEL[role].toLowerCase()}
          </strong>
          . A few details and you are in.
        </>
      }
    >
      <OnboardingForm
        role={role}
        companies={companies ?? []}
        invitedCompany={invitedCompany}
      />
    </AuthShell>
  );
}
