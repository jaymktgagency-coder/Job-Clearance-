/**
 * PayButton.tsx — one row's "send the money" button.
 *
 * Plain English: a small form per payout rather than one big form with
 * checkboxes. Paying is not an edit you batch up and save: each press moves a
 * specific amount to a specific person, and the result of each one has to be
 * readable on its own line.
 *
 * It is a client component only because it needs to know when its own request
 * is in flight. `pending` disables the button, which is what stops a founder
 * on a slow tablet connection tapping twice. (Tapping twice would not pay
 * twice — the transfer carries an idempotency key — but a button that looks
 * dead invites the second tap, and the second tap deserves an answer.)
 */

"use client";

import { useActionState } from "react";
import { sendPayout, type PayResult } from "./actions";
import { Button } from "@/components/ui/button";

export function PayButton({
  payoutId,
  amount,
  who,
}: {
  payoutId: string;
  /** Formatted, e.g. "$250" — shown on the button so the press is specific. */
  amount: string;
  /** The voucher's name, for the screen-reader label. */
  who: string;
}) {
  const [state, act, pending] = useActionState<PayResult | null, FormData>(
    sendPayout,
    null,
  );

  return (
    <form action={act} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="payoutId" value={payoutId} />
      <Button type="submit" loading={pending} disabled={pending}>
        Send {amount}
        <span className="sr-only"> to {who}</span>
      </Button>

      {state ? (
        <p
          // Announced either way: the founder needs to hear "sent" as much as
          // they need to hear "declined".
          role="status"
          className={
            state.ok
              ? "text-sm font-medium text-brand-700"
              : "text-sm font-medium text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
