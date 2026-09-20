/**
 * admin/payouts/actions.ts — the button that actually sends a voucher money.
 *
 * Plain English: the nightly job decides who is owed. This is the only place
 * in Vouch where somebody says "send it", and the money leaves.
 *
 * THREE LOCKS, AND THEY ARE DELIBERATELY NOT THE SAME LOCK
 *
 *   1. This file checks the person is named in ADMIN_USER_IDS. A customer who
 *      finds the URL gets nothing.
 *   2. `payPayout()` re-reads the payout from the database and refuses
 *      anything that is not already 'released' — so even a correct admin
 *      cannot pay a payout the 60 days have not run out on, or one held
 *      because the employer's fee never arrived.
 *   3. `guard_payout_release` runs in the database on the way in and refuses
 *      'paid' without identity, tax details and an account Stripe has
 *      enabled. That one holds even if both of the above were bypassed.
 *
 * The admin check is the weakest of the three on purpose: it decides WHO may
 * press the button, never WHAT the button is allowed to do.
 */

"use server";

import { revalidatePath } from "next/cache";
import { adminCheck } from "@/lib/admin";
import { payPayout } from "@/lib/stripe/connect";

export type PayResult = { ok: boolean; message: string };

/**
 * Pays one released payout.
 *
 * Takes the payout id from the form. It is not trusted: `payPayout()` looks
 * the row up itself and applies every rule to what it finds, so a forged id
 * in the form can only ever name a payout that is already payable.
 */
export async function sendPayout(
  _prev: PayResult | null,
  formData: FormData,
): Promise<PayResult> {
  const { isAdmin } = await adminCheck();
  if (!isAdmin) {
    // Says nothing about whether the payout exists.
    return { ok: false, message: "You're not allowed to do that." };
  }

  const payoutId = String(formData.get("payoutId") ?? "").trim();
  if (!payoutId) return { ok: false, message: "No payout was named." };

  const result = await payPayout(payoutId);

  // Both screens change: this queue, and the voucher's own earnings page.
  revalidatePath("/admin/payouts");
  revalidatePath("/voucher/payouts");

  return { ok: result.ok, message: result.detail };
}
