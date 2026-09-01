/**
 * ChargeList.tsx — what this employer has been charged, and what they owe.
 *
 * Plain English: an employer should be able to see every fee Vouch has taken
 * or is waiting on, without emailing anyone. Where a charge failed, the reason
 * Stripe gave is shown as-is and there is a button to try again — a declined
 * card is usually a five-second fix, and hiding it behind support is how a
 * small business decides you are not worth the trouble.
 */

"use client";

import { useActionState } from "react";
import { retryCharge, type BillingState } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ChargeRow = {
  hire_id: string;
  amount_cents: number;
  credit_applied_cents: number;
  net_amount_cents: number;
  status: string;
  paid_at: string | null;
  last_error: string | null;
  role: string;
  startDate: string;
};

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

/** What each status means to the person reading it, not to the database. */
const EXPLAIN: Record<string, { label: string; tone: "default" | "secondary" | "outline"; line: string }> = {
  paid: { label: "Paid", tone: "secondary", line: "Collected." },
  credited: { label: "Covered by credit", tone: "secondary", line: "A credit from an earlier hire covered this in full. Nothing was charged." },
  waived: { label: "Waived", tone: "secondary", line: "We decided not to collect this one." },
  processing: { label: "In flight", tone: "outline", line: "Your bank is processing it. Bank payments take a few working days." },
  pending: { label: "Owed", tone: "outline", line: "Not collected yet." },
  cancelled: { label: "Cancelled", tone: "outline", line: "No longer owed." },
};

function Row({ charge }: { charge: ChargeRow }) {
  const [state, retry, pending] = useActionState<BillingState, FormData>(retryCharge, { error: null });
  const meta = EXPLAIN[charge.status] ?? EXPLAIN.pending;
  const owed = charge.status === "pending";

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{charge.role}</span>
        <Badge variant={meta.tone}>{meta.label}</Badge>
      </div>

      <p className="mt-1 text-muted-foreground">
        {money(charge.net_amount_cents)}
        {charge.credit_applied_cents > 0
          ? ` — ${money(charge.amount_cents)} fee, less ${money(charge.credit_applied_cents)} of credit`
          : ""}
        {" · started "}
        {charge.startDate}
      </p>

      <p className="mt-1 text-muted-foreground">{meta.line}</p>

      {/* Stripe's own wording. Better than anything we would invent. */}
      {owed && charge.last_error ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
          {charge.last_error}
        </p>
      ) : null}

      {state.notice ? (
        <p role="status" className="mt-2 rounded-md border px-3 py-2">{state.notice}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
          {state.error}
        </p>
      ) : null}

      {owed && !state.notice ? (
        <form action={retry} className="mt-3">
          <input type="hidden" name="hire_id" value={charge.hire_id} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Trying..." : "Try this payment again"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function ChargeList({ charges }: { charges: ChargeRow[] }) {
  if (charges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet. A fee appears here only when you and the person you hired
        have both confirmed a hire.
      </p>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      {charges.map((c) => (
        <Row key={c.hire_id} charge={c} />
      ))}
    </div>
  );
}
