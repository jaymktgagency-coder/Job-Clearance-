/**
 * stripe/charges.ts — collecting the fee once both sides confirm a hire.
 *
 * Plain English: this is the only place in Vouch that takes money from
 * anybody. Everything about it is written to be dull and repeatable, because
 * the failure modes here are charging someone twice or charging them for
 * something that did not happen.
 *
 * WHAT MUST BE TRUE BEFORE THIS RUNS
 *   - the hire is 'confirmed', which takes BOTH the employer and the person
 *     hired. The database will not create a charge row otherwise.
 *   - the amount comes from the charge row, which came from the fee frozen
 *     onto the job when it was posted. Nothing here computes a price.
 *
 * WHY IT IS SAFE TO RUN TWICE
 *   - a charge row already settled, or already carrying a Stripe payment
 *     intent, is left alone
 *   - the Stripe call carries an idempotency key derived from the hire, so a
 *     retried call returns the original payment intent instead of making a
 *     second one
 *   - the webhook and this function write the same values
 */

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe, stripeErrorMessage, stripeIsConfigured } from "./client";

/** Everything is USD. There is no currency column, and one currency is a decision, not an oversight. */
const CURRENCY = "usd";

export type ChargeOutcome = {
  ok: boolean;
  status: "paid" | "processing" | "pending" | "credited" | "skipped";
  detail: string;
};

/** Turns Stripe's payment-intent status into ours. */
function statusFor(intent: Stripe.PaymentIntent): "paid" | "processing" | "pending" {
  if (intent.status === "succeeded") return "paid";
  // A US bank debit sits here for days. It is neither owed nor arrived.
  if (intent.status === "processing") return "processing";
  return "pending";
}

/** A human-readable reason a payment intent is not finished. */
function reasonFor(intent: Stripe.PaymentIntent): string | null {
  if (intent.status === "succeeded" || intent.status === "processing") return null;
  if (intent.last_payment_error?.message) return intent.last_payment_error.message;
  if (intent.status === "requires_action") {
    return "Your bank wants you to confirm this payment. Open your billing page and try again.";
  }
  if (intent.status === "requires_payment_method") {
    return "That payment method was declined. Adding a different card or a bank account will fix it.";
  }
  return `Stripe left this payment ${intent.status}.`;
}

/**
 * Collects the fee for one confirmed hire.
 *
 * Never throws at the caller: a failure here must not undo a hire that both
 * people agreed to. It records why and leaves the charge owed.
 */
export async function collectFeeForHire(hireId: string): Promise<ChargeOutcome> {
  if (!stripeIsConfigured()) {
    return { ok: false, status: "skipped", detail: "Payments are switched off (no STRIPE_SECRET_KEY)." };
  }

  const admin = await createAdminClient();

  const { data: charge, error } = await admin
    .from("employer_charges")
    .select(`
      id, hire_id, company_id, amount_cents, credit_applied_cents, net_amount_cents,
      status, stripe_payment_intent_id, attempt_count,
      hires(status, start_date, jobs(title)),
      companies(name, stripe_customer_id, default_payment_method_id)
    `)
    .eq("hire_id", hireId)
    .maybeSingle();

  if (error || !charge) {
    return { ok: false, status: "skipped", detail: `No charge to collect: ${error?.message ?? "not found"}` };
  }

  const hire = (Array.isArray(charge.hires) ? charge.hires[0] : charge.hires) as
    | { status: string; start_date: string; jobs: unknown }
    | null;
  const company = (Array.isArray(charge.companies) ? charge.companies[0] : charge.companies) as
    | { name: string; stripe_customer_id: string | null; default_payment_method_id: string | null }
    | null;

  // --- the guards, in the order that matters -------------------------------

  if (hire?.status !== "confirmed") {
    return { ok: false, status: "skipped", detail: `The hire is '${hire?.status}', not confirmed. Nothing is owed.` };
  }
  if (["paid", "credited", "waived"].includes(charge.status as string)) {
    return { ok: true, status: "credited", detail: `Already settled (${charge.status}).` };
  }
  if (charge.status === "processing") {
    return { ok: true, status: "processing", detail: "A payment is already in flight for this hire." };
  }
  if (charge.stripe_payment_intent_id) {
    // Somebody already started one. Ask Stripe where it got to rather than
    // starting a second.
    return reconcileExisting(charge.id as string, charge.stripe_payment_intent_id as string);
  }
  if ((charge.net_amount_cents as number) <= 0) {
    // Credits covered the whole fee. The database already said 'credited'.
    return { ok: true, status: "credited", detail: "Covered in full by credit. Nothing to collect." };
  }
  if (!company?.stripe_customer_id || !company.default_payment_method_id) {
    const detail = "No payment method on file, so the fee could not be collected automatically.";
    await admin.from("employer_charges")
      .update({ last_error: detail, attempted_at: new Date().toISOString(), attempt_count: (charge.attempt_count as number) + 1 })
      .eq("id", charge.id);
    return { ok: false, status: "pending", detail };
  }

  // --- the charge itself ---------------------------------------------------

  const job = hire.jobs as { title?: string } | { title?: string }[] | null;
  const title = (Array.isArray(job) ? job[0]?.title : job?.title) ?? "a role";

  try {
    const intent = await stripe().paymentIntents.create(
      {
        amount: charge.net_amount_cents as number,
        currency: CURRENCY,
        customer: company.stripe_customer_id,
        payment_method: company.default_payment_method_id,
        confirm: true,
        // The employer is not sitting in front of the screen. They agreed to
        // this when they saved the payment method and confirmed the hire.
        off_session: true,
        description: `Vouch success fee — ${title}`,
        statement_descriptor_suffix: "HIRING FEE",
        metadata: { vouch_hire_id: hireId, vouch_company_id: charge.company_id as string },
      },
      // A retry returns the original intent rather than charging twice.
      { idempotencyKey: `vouch-charge-${hireId}` },
    );

    const status = statusFor(intent);
    await admin
      .from("employer_charges")
      .update({
        status,
        stripe_payment_intent_id: intent.id,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        last_error: reasonFor(intent),
        attempted_at: new Date().toISOString(),
        attempt_count: (charge.attempt_count as number) + 1,
      })
      .eq("id", charge.id);

    if (status === "paid") await releaseWhatIsNowUnblocked();

    return {
      ok: status !== "pending",
      status,
      detail:
        status === "paid"
          ? `Collected $${((charge.net_amount_cents as number) / 100).toLocaleString()} from ${company.name}.`
          : status === "processing"
            ? "The bank debit is in flight. It usually clears within a few working days."
            : (reasonFor(intent) ?? "Stripe did not complete the payment."),
    };
  } catch (err) {
    // An off-session card decline arrives as a thrown error, not a status.
    const detail = stripeErrorMessage(err);
    const intentId =
      err instanceof Stripe.errors.StripeError
        ? (err.raw as { payment_intent?: { id?: string } } | undefined)?.payment_intent?.id ?? null
        : null;

    await admin
      .from("employer_charges")
      .update({
        status: "pending",
        stripe_payment_intent_id: intentId,
        last_error: detail,
        attempted_at: new Date().toISOString(),
        attempt_count: (charge.attempt_count as number) + 1,
      })
      .eq("id", charge.id);

    return { ok: false, status: "pending", detail };
  }
}

/** Asks Stripe where an already-started payment got to, and records it. */
async function reconcileExisting(chargeId: string, intentId: string): Promise<ChargeOutcome> {
  const admin = await createAdminClient();
  try {
    const intent = await stripe().paymentIntents.retrieve(intentId);
    const status = statusFor(intent);
    await admin
      .from("employer_charges")
      .update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        last_error: reasonFor(intent),
      })
      .eq("id", chargeId);
    if (status === "paid") await releaseWhatIsNowUnblocked();
    return { ok: status !== "pending", status, detail: `Existing payment is ${intent.status}.` };
  } catch (err) {
    return { ok: false, status: "pending", detail: stripeErrorMessage(err) };
  }
}

/**
 * Records a payment intent's outcome from a webhook.
 * Same writes as above, because the same thing happened.
 */
export async function recordIntentOutcome(intent: Stripe.PaymentIntent): Promise<string> {
  const hireId = intent.metadata?.vouch_hire_id;
  if (!hireId) return "not a Vouch fee payment";

  const admin = await createAdminClient();
  const status = statusFor(intent);

  const { error } = await admin
    .from("employer_charges")
    .update({
      status,
      stripe_payment_intent_id: intent.id,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      last_error: reasonFor(intent),
    })
    .eq("hire_id", hireId)
    // Never walk a settled charge backwards on a late or replayed event.
    .not("status", "in", "(paid,credited,waived)");

  if (error) return `could not record it: ${error.message}`;
  if (status === "paid") await releaseWhatIsNowUnblocked();
  return `hire ${hireId} charge is now ${status}`;
}

/**
 * A payout held only because the fee had not arrived can go back in the queue
 * now that it has. Held is a waiting room, not a verdict.
 */
async function releaseWhatIsNowUnblocked(): Promise<void> {
  try {
    const admin = await createAdminClient();
    await admin.rpc("unhold_settled_payouts");
  } catch {
    // The scheduled job (9d) will pick it up anyway. Not worth failing a
    // successful payment over.
  }
}
