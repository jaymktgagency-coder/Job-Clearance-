/**
 * /admin/payouts — the queue of vouchers owed money, and the button that pays
 * them.
 *
 * Plain English: the nightly job works out who is owed. Until this screen
 * existed, that was the end of it — a correct list of people owed money and
 * no way in the entire product to give it to them. `payouts` has no UPDATE
 * policy for any login, so it could not even be done by hand in the Supabase
 * dashboard.
 *
 * WHY IT SHOWS HELD PAYOUTS TOO
 * The first question anybody asks about this screen is not "who do I pay" but
 * "why is that person not on the list". A held payout carries the reason the
 * nightly job wrote, so the answer is on the screen rather than in a database
 * somebody has to be shown how to open.
 *
 * IT READS THROUGH THE ADMIN CLIENT
 * Deliberately. The payout policies let a voucher see their own rows and
 * nobody else's, which is right, and means an admin's own login can see
 * almost nothing here. The gate on this data is the ADMIN_USER_IDS check at
 * the top of this file, not a database policy — and there is no database
 * policy that could express it, because an admin is not a row.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { currentProfile } from "@/lib/auth";
import { adminCheck } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { stripeIsConfigured, stripeIsTestMode } from "@/lib/stripe/client";
import { diagnoseStripe } from "@/lib/stripe/diagnose";
import { PayButton } from "./PayButton";
import { AppHeader } from "@/components/app-header";
import { FormError, FormNotice } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

/** A date as a person reads it, not as Postgres stores it. */
function when(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The shape of one row after the joins, so the page is not a pile of `any`. */
type Row = {
  id: string;
  amount_cents: number;
  status: string;
  release_at: string | null;
  released_at: string | null;
  paid_at: string | null;
  hold_reason: string | null;
  last_error: string | null;
  attempt_count: number;
  stripe_transfer_id: string | null;
  voucher: { full_name: string | null; email: string } | null;
  account: {
    payouts_enabled: boolean;
    payout_account_status: string | null;
    payout_account_id: string | null;
  } | null;
  jobTitle: string;
};

/** Pulls the one-or-many joins Supabase returns into a flat, typed row. */
function flatten(raw: Record<string, unknown>): Row {
  const one = <T,>(v: unknown): T | null =>
    (Array.isArray(v) ? (v[0] as T) : (v as T)) ?? null;

  const hire = one<{ jobs: unknown }>(raw.hires);
  const job = one<{ title?: string }>(hire?.jobs);

  return {
    id: raw.id as string,
    amount_cents: raw.amount_cents as number,
    status: raw.status as string,
    release_at: (raw.release_at as string) ?? null,
    released_at: (raw.released_at as string) ?? null,
    paid_at: (raw.paid_at as string) ?? null,
    hold_reason: (raw.hold_reason as string) ?? null,
    last_error: (raw.last_error as string) ?? null,
    attempt_count: (raw.attempt_count as number) ?? 0,
    stripe_transfer_id: (raw.stripe_transfer_id as string) ?? null,
    voucher: one<{ full_name: string | null; email: string }>(raw.users),
    account: one<{
      payouts_enabled: boolean;
      payout_account_status: string | null;
      payout_account_id: string | null;
    }>(raw.voucher_profiles),
    jobTitle: job?.title ?? "a hire",
  };
}

export default async function AdminPayoutsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");

  const { userId, isAdmin, unconfigured } = await adminCheck();

  // --- First run: nobody has been named an admin yet -----------------------
  // This screen grants nothing — it shows the signed-in person their own id,
  // which their own browser already knows. It exists because the alternative
  // is a non-technical founder hunting for a UUID in the Supabase dashboard.
  if (unconfigured) {
    return (
      <>
        <AppHeader profile={profile} />
        <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
          <h1 className="text-3xl font-semibold sm:text-4xl">No admin yet</h1>
          <p className="measure mt-3 text-lg text-muted-foreground">
            Nobody can work the payout queue until somebody is named. Nothing on
            this page can do that for you — it is a setting on the deployment,
            which is exactly why a stranger finding this address gains nothing.
          </p>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Make yourself the admin</CardTitle>
              <CardDescription>
                In Vercel: your project → Settings → Environment Variables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="tabular mt-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
                  ADMIN_USER_IDS
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Value — this is your ID</p>
                <p className="tabular mt-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">
                  {userId ?? "(signed out)"}
                </p>
              </div>
              <p className="measure text-sm text-muted-foreground">
                Redeploy afterwards — a new environment variable does not reach
                a build that already happened. Then come back here. To have
                more than one admin later, separate the IDs with commas.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  // Named list exists and this person is not on it. Nothing further is said.
  if (!isAdmin) redirect("/dashboard");

  // --- The queue -----------------------------------------------------------
  const admin = await createAdminClient();

  const { data, error } = await admin
    .from("payouts")
    .select(`
      id, amount_cents, status, release_at, released_at, paid_at, hold_reason,
      last_error, attempt_count, stripe_transfer_id,
      users:voucher_id(full_name, email),
      voucher_profiles:voucher_id(payouts_enabled, payout_account_status, payout_account_id),
      hires(jobs(title))
    `)
    .in("status", ["released", "held", "paid"])
    .order("release_at", { ascending: true });

  const rows = (data ?? []).map((r) => flatten(r as Record<string, unknown>));
  const owed = rows.filter((r) => r.status === "released");
  const held = rows.filter((r) => r.status === "held");
  // Newest first, and only a recent slice: this is reassurance, not an archive.
  const paid = rows
    .filter((r) => r.status === "paid")
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
    .slice(0, 10);

  const owedTotal = owed.reduce((n, r) => n + r.amount_cents, 0);

  // Ask Stripe who we are and whether it recognises the accounts we are about
  // to pay. Only for the ones actually waiting — there is no point checking an
  // account whose money already arrived.
  const diagnosis = await diagnoseStripe(
    owed
      .map((r): [string, string] => [
        r.account?.payout_account_id ?? "",
        r.voucher?.full_name ?? r.voucher?.email ?? "a voucher",
      ])
      .filter(([id]) => id.length > 0),
  );

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
        <Button variant="ghost" className="px-3" render={<Link href="/dashboard" />}>
          <ArrowLeftIcon aria-hidden="true" />
          Dashboard
        </Button>

        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Payouts</h1>
        <p className="measure mt-3 text-lg text-muted-foreground">
          {owed.length === 0
            ? "Nobody is waiting to be paid right now."
            : `${owed.length} ${owed.length === 1 ? "voucher is" : "vouchers are"} owed ${money(owedTotal)}. Each button below sends that person their money, for real.`}
        </p>

        {!stripeIsConfigured() ? (
          <FormError className="mt-6">
            Payments are switched off on this deployment (no STRIPE_SECRET_KEY),
            so nothing can be sent.
          </FormError>
        ) : stripeIsTestMode() ? (
          <FormNotice className="mt-6">
            This is Stripe test mode. Buttons here move no real money.
          </FormNotice>
        ) : null}

        {error ? (
          <FormError className="mt-6">
            Couldn&apos;t read the payouts: {error.message}
          </FormError>
        ) : null}

        {/* --- Which Stripe account are we actually talking to? -------------
            A valid key can still be the WRONG key. A voucher's payout account
            lives under one Stripe platform account; point the app at another
            and every stored acct_ becomes an id Stripe has never heard of.
            Nothing in the database records which account an acct_ came from,
            so this panel asks Stripe instead of guessing. Admin-only, which
            is why raw Stripe wording is allowed here and nowhere else. */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Stripe</CardTitle>
            <CardDescription>
              Which Stripe account this deployment is using, and whether it
              recognises the accounts it is about to pay.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* The headline, so the answer is readable without reading rows. */}
            {!diagnosis.key.ok ? (
              <FormError>
                This deployment&apos;s Stripe key could not be used at all.
                Nothing can be paid until that is fixed.
              </FormError>
            ) : diagnosis.anyMismatch ? (
              <FormError>
                Stripe does not recognise at least one of the payout accounts
                below. That is almost always the key and the accounts belonging
                to two different Stripe accounts — see the verdict on each one.
              </FormError>
            ) : diagnosis.accounts.length > 0 ? (
              <FormNotice>
                Every payout account below belongs to this Stripe account.
              </FormNotice>
            ) : null}

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Key</dt>
              <dd className="font-medium">
                {diagnosis.keyMode === "none"
                  ? "Not set"
                  : diagnosis.keyMode === "test"
                    ? "Test mode (sk_test_…) — no real money moves"
                    : "LIVE mode (sk_live_…) — real money moves"}
              </dd>

              <dt className="text-muted-foreground">Stripe account</dt>
              <dd className="tabular font-mono text-xs break-all sm:text-sm">
                {diagnosis.platformAccountId ?? "could not be read"}
              </dd>

              <dt className="text-muted-foreground">Key works</dt>
              <dd className={diagnosis.key.ok ? "font-medium" : "font-medium text-destructive"}>
                {diagnosis.key.ok ? "Yes" : "No"} — {diagnosis.key.detail}
              </dd>
            </dl>

            {diagnosis.accounts.length > 0 ? (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium">
                  The payout accounts waiting to be paid
                </p>
                {diagnosis.accounts.map((a) => (
                  <div key={a.accountId} className="text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.who}</span>
                      <span className="tabular font-mono text-xs break-all text-muted-foreground">
                        {a.accountId}
                      </span>
                      <Badge variant={a.v1.ok && a.v2.ok ? "success" : "outline"}>
                        {a.v1.ok && a.v2.ok ? "Recognised" : "Problem"}
                      </Badge>
                    </p>
                    {a.v1.ok && a.v2.ok ? null : (
                      <>
                        <p className="measure mt-1 text-destructive">{a.verdict}</p>
                        {/* The raw Stripe wording. On this screen only. */}
                        <p className="measure mt-1 text-xs text-muted-foreground">
                          v1: {a.v1.detail}
                          <br />
                          v2: {a.v2.detail}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* --- Owed ---------------------------------------------------------- */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Ready to pay</h2>
          <div className="mt-4 space-y-4">
            {owed.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {r.voucher?.full_name ?? r.voucher?.email ?? "A voucher"} —{" "}
                    <span className="tabular">{money(r.amount_cents)}</span>
                  </CardTitle>
                  <CardDescription>
                    Their share for {r.jobTitle}. Approved {when(r.released_at)}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* The one thing that stops a press working, said before the
                      press rather than after it. */}
                  {!r.account?.payouts_enabled ? (
                    <FormError>
                      Stripe hasn&apos;t enabled payouts on this voucher&apos;s
                      account yet, so there is nowhere to send it. They need to
                      finish setting up on their Earnings page.
                    </FormError>
                  ) : (
                    <PayButton
                      payoutId={r.id}
                      amount={money(r.amount_cents)}
                      who={r.voucher?.full_name ?? "this voucher"}
                    />
                  )}

                  {/* A previous press that Stripe refused. What is STORED
                      here is the line the voucher sees, so it is deliberately
                      vague when the fault was ours; the Stripe panel above and
                      the Vercel log carry the specifics. */}
                  {r.last_error ? (
                    <p className="text-sm text-muted-foreground">
                      Last attempt ({r.attempt_count}
                      {r.attempt_count === 1 ? " try" : " tries"}): {r.last_error}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}

            {owed.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Nothing is waiting. Payouts appear here once the nightly job
                  releases them — 60 days after a start date, and only once the
                  employer&apos;s fee has actually been collected.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>

        {/* --- Held ---------------------------------------------------------- */}
        {held.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xl font-semibold">Held, and why</h2>
            <p className="measure mt-2 text-sm text-muted-foreground">
              These are not payable yet. The reason is the one the nightly job
              wrote when it looked at them.
            </p>
            <div className="mt-4 space-y-3">
              {held.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-4">
                    <p className="font-medium">
                      {r.voucher?.full_name ?? r.voucher?.email ?? "A voucher"} —{" "}
                      <span className="tabular">{money(r.amount_cents)}</span>{" "}
                      <Badge variant="outline">Held</Badge>
                    </p>
                    <p className="measure mt-1 text-sm text-muted-foreground">
                      {r.hold_reason ?? "No reason was recorded."}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* --- Recently paid -------------------------------------------------- */}
        {paid.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xl font-semibold">Recently paid</h2>
            <div className="mt-4 space-y-2">
              {paid.map((r) => (
                <p key={r.id} className="text-sm text-muted-foreground">
                  <span className="tabular font-medium text-foreground">
                    {money(r.amount_cents)}
                  </span>{" "}
                  to {r.voucher?.full_name ?? r.voucher?.email ?? "a voucher"} on{" "}
                  {when(r.paid_at)}
                  {r.stripe_transfer_id ? ` · ${r.stripe_transfer_id}` : ""}
                </p>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
