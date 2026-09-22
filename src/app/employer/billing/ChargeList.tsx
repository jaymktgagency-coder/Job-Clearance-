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
import { FormError } from "@/components/form-message";
import { customerSafeError } from "@/lib/payment-errors";
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
const EXPLAIN: Record<
  string,
  { label: string; tone: "success" | "soft" | "outline"; line: string }
> = {
  paid: { label: "Paid", tone: "success", line: "Collected." },
  credited: {
    label: "Covered by credit",
    tone: "success",
    line: "A credit from an earlier hire covered this in full. Nothing was charged.",
  },
  waived: {
    label: "Waived",
    tone: "soft",
    line: "We decided not to collect this one.",
  },
  processing: {
    label: "In flight",
    tone: "soft",
    // Not settled. A payout will not release against this — a bank debit in
    // flight is not money that has arrived.
    line: "Your bank is processing it. Bank payments take a few working days.",
  },
  pending: { label: "Owed", tone: "outline", line: "Not collected yet." },
  cancelled: { label: "Cancelled", tone: "outline", line: "No longer owed." },
};

function Row({ charge }: { charge: ChargeRow }) {
  const [state, retry, pending] = useActionState<BillingState, FormData>(retryCharge, { error: null });
  const meta = EXPLAIN[charge.status] ?? EXPLAIN.pending;
  const owed = charge.status === "pending";

  return (
    <div className="rounded-lg bg-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{charge.role}</p>
          <p className="mt-0.5 text-muted-foreground">
            started <span className="tabular">{charge.startDate}</span>
          </p>
        </div>
        {/* The amount gets the display face and tabular figures, so a column
            of fees lines up digit over digit instead of drifting. */}
        <div className="text-right">
          <p className="tabular font-heading text-xl font-semibold">
            {money(charge.net_amount_cents)}
          </p>
          <Badge variant={meta.tone} className="mt-1.5">
            {meta.label}
          </Badge>
        </div>
      </div>

      {charge.credit_applied_cents > 0 ? (
        <p className="tabular mt-2 text-muted-foreground">
          {money(charge.amount_cents)} fee, less{" "}
          {money(charge.credit_applied_cents)} of credit
        </p>
      ) : null}

      <p className="measure mt-2 text-muted-foreground">{meta.line}</p>

      {/* Stripe's own wording for a decline — better than anything we would
          invent, and the employer can act on it. But NOT when the failure was
          our own configuration: that is not theirs to read or to fix. */}
      {owed && customerSafeError(charge.last_error) ? (
        <FormError className="mt-3">
          {customerSafeError(charge.last_error)}
        </FormError>
      ) : null}

      {state.notice ? (
        <p
          role="status"
          className="mt-3 rounded-lg bg-success/10 px-4 py-3 font-medium text-success"
        >
          {state.notice}
        </p>
      ) : null}
      {state.error ? <FormError className="mt-3">{state.error}</FormError> : null}

      {owed && !state.notice ? (
        <form action={retry} className="mt-4">
          <input type="hidden" name="hire_id" value={charge.hire_id} />
          <Button type="submit" size="sm" variant="outline" loading={pending}>
            Try this payment again
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function ChargeList({ charges }: { charges: ChargeRow[] }) {
  if (charges.length === 0) {
    return (
      <p className="measure text-sm text-muted-foreground">
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
