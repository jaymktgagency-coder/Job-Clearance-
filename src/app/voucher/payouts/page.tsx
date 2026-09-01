/**
 * /voucher/payouts — what a voucher has earned, and where it goes.
 *
 * Plain English: the whole reason someone vouches for a stranger is on this
 * page, so it has to be honest about the thing people find hardest to
 * believe: the money is real, but it arrives 60 days after the person starts,
 * and not at all if they leave first.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { stripeIsConfigured, stripeIsTestMode } from "@/lib/stripe/client";
import { payoutAccountState } from "@/lib/stripe/connect";
import { refreshPayoutAccount, startPayoutOnboarding } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

/** What each payout state means to the person waiting for the money. */
const EXPLAIN: Record<string, { label: string; tone: "default" | "secondary" | "outline"; line: string }> = {
  scheduled: { label: "On the way", tone: "outline", line: "Waiting out the 60 days from their start date." },
  held: { label: "Held", tone: "outline", line: "Something needs sorting before this can be paid." },
  released: { label: "Approved", tone: "secondary", line: "Cleared to pay. It'll be sent shortly." },
  paid: { label: "Paid", tone: "secondary", line: "Sent to your account." },
  cancelled: { label: "Not payable", tone: "outline", line: "The person left before the 60 days were up." },
};

export default async function VoucherPayoutsPage(props: PageProps<"/voucher/payouts">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const params = await props.searchParams;
  const supabase = await createClient();

  // Coming back from Stripe: get the answer before drawing the page.
  const justReturned = params.done === "1";
  const refreshed = justReturned ? await refreshPayoutAccount() : null;

  const account = await payoutAccountState(profile.id);

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, amount_cents, status, release_at, paid_at, hold_reason, last_error, hires(start_date, jobs(title))")
    .order("release_at", { ascending: true });

  const rows = payouts ?? [];
  const totalPaid = rows.filter((p) => p.status === "paid").reduce((n, p) => n + (p.amount_cents as number), 0);
  const totalComing = rows
    .filter((p) => ["scheduled", "held", "released"].includes(p.status as string))
    .reduce((n, p) => n + (p.amount_cents as number), 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
        ← Dashboard
      </Button>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Getting paid</h1>
      <p className="mt-2 text-muted-foreground">
        You earn half the fee when someone you vouched for is hired. It&apos;s
        released 60 days after they start — and if they leave before then, it
        isn&apos;t paid at all. That delay is what makes a vouch worth something.
      </p>

      {stripeIsConfigured() && stripeIsTestMode() ? (
        <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Test mode.</strong> No real
          money moves, and any details entered go to Stripe&apos;s test system.
        </p>
      ) : null}

      {refreshed?.notice ? (
        <p role="status" className="mt-3 rounded-md border px-3 py-2 text-sm">{refreshed.notice}</p>
      ) : null}
      {refreshed?.error ? (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {refreshed.error}
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {params.error === "off"
            ? "Payouts aren't switched on yet on this site."
            : "We couldn't reach Stripe just then. Nothing was lost — please try again."}
        </p>
      ) : null}

      {/* Where the money goes. */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Your payout account
            <Badge variant={account.status === "active" ? "secondary" : "outline"}>
              {account.status === "active"
                ? "Ready"
                : account.status === "restricted"
                  ? "Needs more"
                  : account.status === "onboarding"
                    ? "Half done"
                    : "Not set up"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Set up with Stripe, on Stripe&apos;s own pages. Vouch never sees your
            bank details, your date of birth, or your tax number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {account.status === "active" ? (
            <p className="text-muted-foreground">
              Stripe has everything it needs. Money released to you goes here
              automatically — you don&apos;t have to come back and claim it.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {account.status === "none"
                  ? "You can vouch for people without this. You just can't be paid until it's done."
                  : "You've started this but Stripe still needs a few things."}
              </p>
              {account.outstanding.length > 0 ? (
                <div>
                  <p className="font-medium">Still needed:</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {account.outstanding.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <form action={startPayoutOnboarding}>
                <Button type="submit" disabled={!stripeIsConfigured()}>
                  {account.status === "none" ? "Set up payouts" : "Finish setting up payouts"}
                </Button>
              </form>
              <p className="text-muted-foreground">
                Stripe needs your identity and tax details because it reports what
                you earn to the tax authorities — that&apos;s their job, not ours, and
                it&apos;s why we don&apos;t hold any of it.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* What you've earned. */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your earnings</CardTitle>
          <CardDescription>
            {money(totalPaid)} paid · {money(totalComing)} still to come
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing yet. A payout appears here when someone you vouched for is
              hired and both they and the employer confirm it.
            </p>
          ) : (
            rows.map((p) => {
              const hire = Array.isArray(p.hires) ? p.hires[0] : p.hires;
              const job = hire ? (Array.isArray(hire.jobs) ? hire.jobs[0] : hire.jobs) : null;
              const meta = EXPLAIN[p.status as string] ?? EXPLAIN.scheduled;
              return (
                <div key={p.id as string} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {money(p.amount_cents as number)} · {job?.title ?? "a role"}
                    </span>
                    <Badge variant={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {meta.line}
                    {p.status === "scheduled" && p.release_at ? ` Releases ${p.release_at}.` : ""}
                    {p.status === "paid" && p.paid_at ? ` Sent ${String(p.paid_at).slice(0, 10)}.` : ""}
                  </p>
                  {p.hold_reason ? (
                    <p className="mt-2 rounded-md border px-3 py-2 text-muted-foreground">{p.hold_reason}</p>
                  ) : null}
                  {p.last_error ? (
                    <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                      {p.last_error}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </main>
  );
}
