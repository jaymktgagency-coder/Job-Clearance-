/**
 * /verify — where a voucher proves they work where they say they do.
 *
 * Only reachable by vouchers who verify with a work email. People who were
 * invited by their employer are already verified and never see this.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { SendCodeForm, ConfirmCodeForm } from "./VerifyForms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const supabase = await createClient();
  const { data: vp } = await supabase
    .from("voucher_profiles")
    .select("status, work_email, verification_method, companies(name)")
    .maybeSingle();

  const company = Array.isArray(vp?.companies) ? vp?.companies[0] : vp?.companies;
  const verified = vp?.status === "verified";

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            Verify you work at {company?.name ?? "your company"}
            {verified ? <Badge>Verified</Badge> : <Badge variant="outline">Not verified</Badge>}
          </CardTitle>
          <CardDescription>
            {verified
              ? vp?.verification_method === "employer_invite"
                ? "Your employer invited you directly, so you're already verified."
                : "You're verified by your work email."
              : "Only verified employees can vouch. This is what makes a vouch mean anything."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {verified ? (
            <Button render={<Link href="/dashboard" />}>Back to your dashboard</Button>
          ) : vp?.work_email ? (
            <>
              <SendCodeForm workEmail={vp.work_email} />
              <hr />
              <ConfirmCodeForm />
              <p className="text-sm text-muted-foreground">
                No company email address? Ask your employer to invite you directly —
                that works for businesses without their own email domain.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              There&apos;s no work email on your profile. Ask your employer to invite you
              directly instead.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
