/**
 * /onboarding — the step between "I have a login" and "I have an account".
 *
 * If someone has already finished, this sends them straight to their
 * dashboard, so it's safe to bounce people here after signing in.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser, currentProfile, pendingRole, pendingInviteToken, ROLE_LABEL } from "@/lib/auth";
import { hashInviteToken } from "@/lib/invites";
import { OnboardingForm } from "./OnboardingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Already done? Straight through.
  if (await currentProfile()) redirect("/dashboard");

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
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Finish setting up</CardTitle>
          <CardDescription>
            Signing up as a <strong>{ROLE_LABEL[role].toLowerCase()}</strong>. A few
            details and you&apos;re in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            role={role}
            companies={companies ?? []}
            invitedCompany={invitedCompany}
          />
        </CardContent>
      </Card>
    </main>
  );
}
