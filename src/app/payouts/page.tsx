/**
 * /payouts — what a voucher is owed, and the one screen that asks them for
 * tax and identity details.
 *
 * Plain English: vouching is free and always will be. Nobody is asked for a
 * Social Security number, a bank account, or anything else that feels like
 * tax paperwork in order to write a vouch. This screen only asks once a
 * vouch has actually turned into a hire and there is money with their name
 * on it — and it says the amount before it asks for anything.
 *
 * Three things a voucher can be looking at here:
 *   - nothing owed yet, so nothing to do. No button, no chore.
 *   - money coming and details missing. This is the whole point of the screen.
 *   - all set. The amount and the date, and whatever is holding it up.
 *
 * The payout rows are read as the logged-in voucher, so row-level security
 * (policy payouts_read_as_voucher, migration 0004) is what stops anyone
 * seeing anyone else's money — not a filter written here.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { stripeIsConfigured, stripeIsTestMode } from "@/lib/stripe/client";
import { refreshAccountState } from "@/lib/stripe/connect";
import { startPayoutSetup } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

const when = (date: string | null) =>
  date
    ? new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "a date we haven't set yet";

/** What each payout status means, said the way a person would say it. */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "On its way",
  held: "Waiting on something",
  released: "Approved to pay",
  paid: "Paid",
  cancelled: "Not going ahead",
};

type PayoutRow = {
  id: string;
  amount_cents: number;
  status: string;
  release_at: string | null;
  paid_at: string | null;
  hold_reason: string | null;
  hires: { start_date: string; jobs: { title: string } | null; companies: { name: string } | null } | null;
};

/** Supabase returns joined rows as either an object or a one-item array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PayoutsPage(props: PageProps<"/payouts">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const params = await props.searchParams;
  const supabase = await createClient();

  // Just back from Stripe. Ask Stripe what it decided and write it down now,
  // rather than leaving them staring at a stale screen until the webhook
  // lands. The webhook does the same thing; running both is harmless.
  let justFinished = false;
  if (params.done && stripeIsConfigured()) {
    try {
      await refreshAccountState(profile.id);
      justFinished = true;
    } catch (error) {
      console.error("[stripe] could not refresh payout account:", error);
    }
  }

  const { data, error } = await supabase
    .from("payouts")
    .select(`id, amount_cents, status, release_at, paid_at, hold_reason,
             hires(start_date, jobs(title), companies(name))`)
    .order("release_at", { ascending: true });

  // If the query itself failed, say so. Bouncing a voucher to the dashboard
  // with no explanation is the wrong answer on a screen about money.
  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          ← Dashboard
        </Button>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Getting paid</h1>
        <p role="alert" className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This screen isn&apos;t ready yet on this site. Nothing is wrong with your
          account and nothing you&apos;ve earned is affected. Tell us and we&apos;ll sort it out.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Technical detail, in case it helps: {error.message}
        </p>
      </main>
    );
  }

  const payouts = ((data ?? []) as unknown as PayoutRow[]).map((p) => ({
    ...p,
    hire: one(p.hires),
  }));

  // Their own two payout gates, read as them. The admin client could read
  // these too, but this is data being shown to a visitor, so it goes through
  // row-level security like everything else on the page.
  const { data: vp } = await supabase
    .from("voucher_profiles")
    .select("payout_account_id, identity_verified_at, tax_info_collected_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  const readiness = {
    accountId: (vp?.payout_account_id as string) ?? null,
    ready: Boolean(vp?.identity_verified_at && vp?.tax_info_collected_at),
  };

  // Money that is actually coming: not cancelled, not already paid.
  const coming = payouts.filter((p) => p.status === "scheduled" || p.status === "held");
  const comingTotal = coming.reduce((sum, p) => sum + p.amount_cents, 0);
  const needsSetup = coming.length > 0 && !readiness.ready;
  const nextDate = coming[0]?.release_at ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
        ← Dashboard
      </Button>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Getting paid</h1>
      <p className="mt-2 text-muted-foreground">
        Vouching is free. We only ask for your details when a vouch has turned
        into a hire and there&apos;s money to send you.
      </p>

      {stripeIsConfigured() && stripeIsTestMode() ? (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This site is in Stripe test mode. No real money moves and no real
          details are needed.
        </p>
      ) : null}

      {params.error === "off" ? (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Payments aren&apos;t switched on for this site yet. Nothing you&apos;ve earned is lost —
          it stays recorded here until they are.
        </p>
      ) : null}

      {params.error === "start" ? (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          We couldn&apos;t open Stripe just then. Nothing was saved and nothing was lost —
          please try again in a moment.
        </p>
      ) : null}

      {params.refresh ? (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          That link had expired — they only last a few minutes. Press the button
          again and we&apos;ll make you a fresh one.
        </p>
      ) : null}

      {justFinished && readiness.ready ? (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <strong className="font-medium">All set.</strong> Stripe has what it needs.
          Nothing else for you to do — the money releases on its own.
        </p>
      ) : null}

      {justFinished && !readiness.ready ? (
        <p className="mt-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Stripe is still checking your details. That can take a few minutes, and
          occasionally a day or two if they want to see a document. We&apos;ll update
          this page on our own — you don&apos;t need to keep it open.
        </p>
      ) : null}

      {/* --- Nothing owed: say so and ask for nothing ---------------------- */}
      {coming.length === 0 && payouts.length === 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Nothing to set up</CardTitle>
            <CardDescription>You haven&apos;t earned anything yet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              When someone you vouched for is hired, half the employer&apos;s fee is
              yours. It releases 60 days after they start.
            </p>
            <p>
              We&apos;ll ask for your tax and identity details then, and not before.
              There&apos;s no paperwork to do today.
            </p>
            <Button size="sm" variant="outline" render={<Link href="/inbox" />}>
              Open my inbox
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* --- Money coming, details missing: the ask ------------------------ */}
      {needsSetup ? (
        <Card className="mt-8 border-foreground/20">
          <CardHeader>
            <CardTitle className="text-base">
              {money(comingTotal)} is waiting for you
            </CardTitle>
            <CardDescription>
              {coming.length === 1
                ? `Releases ${when(nextDate)}`
                : `${coming.length} payouts, the first on ${when(nextDate)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              To send it we need to know who you are and have your tax details —
              that&apos;s the law for anyone paying you, not a Vouch rule.
            </p>
            <p>
              You&apos;ll fill it in on Stripe&apos;s own site, not this one. Vouch never sees
              your Social Security number or your bank details; Stripe holds those and
              tells us only whether you&apos;re ready to be paid.
            </p>
            <p>
              It takes about five minutes. Doing it now means the money moves the day
              it&apos;s due instead of waiting on you.
            </p>
            <form action={startPayoutSetup}>
              <Button type="submit" disabled={!stripeIsConfigured()}>
                {readiness.accountId ? "Finish setting up payouts" : "Set up getting paid"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* --- All set ------------------------------------------------------- */}
      {coming.length > 0 && readiness.ready ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">{money(comingTotal)} on its way</CardTitle>
            <CardDescription>
              {coming.length === 1
                ? `Releases ${when(nextDate)}`
                : `${coming.length} payouts, the first on ${when(nextDate)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Your details are with Stripe and there&apos;s nothing else for you to do.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* --- The list ------------------------------------------------------ */}
      {payouts.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Every vouch that paid off</h2>
          <ul className="mt-4 space-y-3">
            {payouts.map((p) => {
              const job = one(p.hire?.jobs);
              const company = one(p.hire?.companies);
              return (
                <li key={p.id} className="rounded-lg border px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{job?.title ?? "A role"}</p>
                      <p className="text-sm text-muted-foreground">
                        {company?.name ?? "A company"} · started {when(p.hire?.start_date ?? null)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{money(p.amount_cents)}</p>
                      <Badge variant={p.status === "paid" ? "default" : "outline"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </div>
                  </div>

                  {p.status === "scheduled" ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Releases {when(p.release_at)}.
                    </p>
                  ) : null}

                  {/* hold_reason is written in plain English by the database
                      itself, so it can be shown to a person as-is. */}
                  {p.status === "held" && p.hold_reason ? (
                    <p className="mt-2 text-sm text-muted-foreground">{p.hold_reason}</p>
                  ) : null}

                  {p.status === "paid" ? (
                    <p className="mt-2 text-sm text-muted-foreground">Sent {when(p.paid_at)}.</p>
                  ) : null}

                  {p.status === "cancelled" && p.hold_reason ? (
                    <p className="mt-2 text-sm text-muted-foreground">{p.hold_reason}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-sm text-muted-foreground">
        A payout releases 60 days after the person starts. If they leave before
        then, it isn&apos;t paid — that delay is what makes a vouch worth something
        to an employer.
      </p>
    </main>
  );
}
