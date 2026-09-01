/**
 * /employer/billing — the employer's payment method.
 *
 * Plain English: nothing is charged here and nothing is charged today. This
 * screen exists so that when the employer does hire someone, there is a way to
 * collect the fee without chasing them for details weeks later.
 *
 * The page says that plainly, because "add a payment method" on a hiring site
 * is exactly the moment a small business gets suspicious — and they are right
 * to be. Telling them the truth up front is the only thing that works.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { stripeIsConfigured, stripeIsTestMode } from "@/lib/stripe/client";
import {
  completePaymentMethodSetup,
  forgetPaymentMethod,
  startPaymentMethodSetup,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  none: "Not verified yet",
  business: "Verified Business",
  domain: "Verified Domain",
};

export default async function BillingPage(props: PageProps<"/employer/billing">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employer") redirect("/dashboard");

  const params = await props.searchParams;
  const supabase = await createClient();

  const { data: membership, error: companyError } = await supabase
    .from("company_members")
    .select(`company_id, companies(name, verification_tier, payment_method_on_file,
             default_payment_method_type, default_payment_method_label,
             default_payment_method_last4, payment_method_updated_at,
             business_registration_verified_at)`)
    .eq("user_id", profile.id)
    .maybeSingle();

  const company = membership
    ? Array.isArray(membership.companies)
      ? membership.companies[0]
      : membership.companies
    : null;

  // If the query itself failed, say so. Bouncing an employer to the dashboard
  // with no explanation is the wrong answer on a screen about money — and the
  // usual cause is this site running ahead of its database migrations.
  if (companyError) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <Button variant="ghost" size="sm" render={<Link href="/employer/jobs" />}>
          ← Your roles
        </Button>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Payment method</h1>
        <p role="alert" className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This screen isn&apos;t ready yet on this site — its database is missing the
          payment columns. Nothing is wrong with your account, and nothing you do
          elsewhere on Vouch is affected. Tell us and we&apos;ll sort it out.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Technical detail, in case it helps: {companyError.message}
        </p>
      </main>
    );
  }

  if (!company) redirect("/onboarding");

  // Coming back from Stripe: finish the job before drawing the page, so what
  // they see is the result rather than the state from before they left.
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  const result = sessionId ? await completePaymentMethodSetup(sessionId) : null;

  const saved = company.payment_method_on_file
    ? {
        label: (company.default_payment_method_label as string) ?? "Payment method",
        last4: (company.default_payment_method_last4 as string) ?? "····",
        type: company.default_payment_method_type as string,
        updatedAt: company.payment_method_updated_at as string | null,
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Button variant="ghost" size="sm" render={<Link href="/employer/jobs" />}>
        ← Your roles
      </Button>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Payment method</h1>
      <p className="mt-2 text-muted-foreground">
        {company.name as string}
      </p>

      {/* Say the quiet part first. */}
      <div className="mt-6 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Nothing is charged here.</strong>{" "}
        There is no subscription and no listing fee. A card or bank account on
        file is only ever charged when you confirm you&apos;ve hired someone — and
        the person you hired has to confirm it too.
      </div>

      {stripeIsConfigured() && stripeIsTestMode() ? (
        <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Test mode.</strong> No real
          money can move. Use card <code>4242 4242 4242 4242</code>, any future
          expiry, any CVC.
        </p>
      ) : null}

      {result?.notice ? (
        <p role="status" className="mt-3 rounded-md border px-3 py-2 text-sm">
          {result.notice}
        </p>
      ) : null}
      {result?.error ? (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {result.error}
        </p>
      ) : null}
      {params.cancelled ? (
        <p role="status" className="mt-3 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          No problem — nothing was saved. You can do this any time before you hire someone.
        </p>
      ) : null}
      {params.removed ? (
        <p role="status" className="mt-3 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Removed. Stripe no longer holds those details for you.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {params.error === "off"
            ? "Payments aren't switched on yet on this site."
            : "We couldn't reach Stripe just then. Nothing was saved — please try again."}
        </p>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">
            {saved ? "On file" : "Nothing on file yet"}
          </CardTitle>
          <CardDescription>
            {saved
              ? "Held securely by Stripe. Vouch never sees the full number."
              : "You can browse and post roles without one. You'll need it before a hire can be settled."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {saved ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {saved.label} ending {saved.last4}
                </span>
                <Badge variant="secondary">
                  {saved.type === "us_bank_account" ? "Bank account" : "Card"}
                </Badge>
              </div>
              {saved.type === "card" ? (
                <p className="text-muted-foreground">
                  A bank account costs you less on salaried roles — card fees on a
                  $2,000 fee come to about $58, against $5 by bank.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Good choice — bank transfer keeps the fee on a $2,000 hire to
                  about $5 rather than $58.
                </p>
              )}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <form action={startPaymentMethodSetup}>
                  <Button type="submit" size="sm" variant="outline">
                    Replace it
                  </Button>
                </form>
                <form action={forgetPaymentMethod}>
                  <Button type="submit" size="sm" variant="ghost">
                    Remove it
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <form action={startPaymentMethodSetup}>
              <Button type="submit" disabled={!stripeIsConfigured()}>
                Add a card or bank account
              </Button>
              <p className="mt-2 text-muted-foreground">
                You&apos;ll enter your details on Stripe&apos;s own site, not ours. Vouch
                never sees the number.
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your verification</CardTitle>
          <CardDescription>
            What job seekers and vouchers see next to your roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Badge variant={company.verification_tier === "none" ? "outline" : "secondary"}>
              {TIER_LABEL[company.verification_tier as string] ?? "Not verified yet"}
            </Badge>
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>{company.payment_method_on_file ? "✓" : "○"} Payment method on file</li>
            <li>
              {company.business_registration_verified_at ? "✓" : "○"} Business
              registration checked by Vouch
            </li>
          </ul>
          <p className="text-muted-foreground">
            A business running on a free email address can earn Verified Business
            just like anyone else. Verified Domain needs a company email domain
            we&apos;ve checked — it&apos;s not a better badge, it just also lets your
            staff verify themselves with their work email.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
