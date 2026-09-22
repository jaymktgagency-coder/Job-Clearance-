/**
 * stripe/client.ts — one place that knows how to talk to Stripe.
 *
 * Plain English: Stripe handles the money. This file makes the connection and
 * decides whether payments are switched on at all — with no key, Vouch works
 * exactly as it did before, and the "add a payment method" screen says so
 * plainly instead of breaking.
 *
 * The secret key must never reach a browser. Everything in here is server-only.
 */

import Stripe from "stripe";

/** True when a Stripe key is present. False turns the payment screens off. */
export function stripeIsConfigured(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0;
}

/** True when the key is a TEST key. Used to warn on screen that no money moves. */
export function stripeIsTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim().startsWith("sk_test_");
}

/** The Stripe connection. Server-side only. */
export function stripe(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("STRIPE_SECRET_KEY must never be used in the browser.");
  }
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is missing. Add it to .env.local and to your Vercel " +
        "environment variables — see SETUP.md, Part 9.",
    );
  }
  return new Stripe(key);
}

/**
 * A short-fused connection, for the diagnostic panel on the admin screen.
 *
 * The default SDK timeout is 80 seconds with network retries on top. That is
 * the right default for taking money — a payment worth retrying is worth
 * waiting for — and completely wrong for a panel that renders on page load:
 * a slow or unreachable Stripe would hang the admin screen for minutes.
 *
 * `maxNetworkRetries: 0` matters as much as the timeout. Leaving retries on
 * would multiply the wait by every attempt.
 */
export function stripeBriefly(timeoutMs: number): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("STRIPE_SECRET_KEY must never be used in the browser.");
  }
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing.");
  return new Stripe(key, { timeout: timeoutMs, maxNetworkRetries: 0 });
}

/**
 * Turns a Stripe error into something an employer can read.
 * Stripe's own messages are usually decent; this catches the ones that aren't.
 */
export function stripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case "StripeAuthenticationError":
        return "Vouch's payment settings are wrong on our side. Nothing was charged. Please tell us and we'll fix it.";
      case "StripeConnectionError":
        return "We couldn't reach Stripe just then. Nothing was saved — please try again in a moment.";
      case "StripeCardError":
        return error.message;
      default:
        return error.message || "Stripe couldn't complete that.";
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

// ---------------------------------------------------------------------------
// Whose fault was it? — which decides who is allowed to read the details
// ---------------------------------------------------------------------------

/**
 * One failure, split into the part a customer may read and the part they
 * may not.
 *
 * WHY THIS EXISTS
 * `last_error` is stored on a payout and on a charge, and both of those rows
 * are readable by the person they belong to. A voucher opening their earnings
 * page was shown whatever Stripe last said — including "Unregistered API
 * key", which is a sentence about VOUCH'S configuration appearing in a red
 * box on somebody else's page, phrased as though it were about them.
 *
 * Genericising all of it would have been worse. Most of what lands in
 * `last_error` is a card decline, and "that card was declined, try another"
 * is the single most useful thing an employer can be told. So the split is by
 * WHOSE PROBLEM IT IS, decided from the error's class rather than by reading
 * its text:
 *
 *   ours = false — the card, the bank, the network. Their business, and
 *     Stripe's own wording is better than anything we would write.
 *   ours = true  — authentication, permission, a malformed request, a 5xx.
 *     None of those are caused by the person looking at the screen and none
 *     of them can be acted on by them.
 *
 * A plain (non-Stripe) Error is always ours: it is our own code failing.
 *
 * Only `publicMessage` is ever written to a row. `detail` goes to the server
 * log and to the admin who pressed the button, and nowhere else.
 */
export type StripeFailure = {
  /** True when this is Vouch's problem, not the reader's. */
  ours: boolean;
  /** Safe on any screen. Never names a key, an account or our settings. */
  publicMessage: string;
  /** What Stripe actually said. Admin screens and server logs only. */
  detail: string;
};

/** Said to a customer when the failure is ours. Deliberately says no more. */
const OURS_PUBLIC =
  "Something on Vouch's side stopped this going through. No money moved, " +
  "and we've been told — you don't need to do anything.";

export function stripeFailure(error: unknown): StripeFailure {
  const detail = stripeErrorMessage(error);

  if (error instanceof Stripe.errors.StripeError) {
    // A declined card and a dropped connection are the two the reader can
    // actually do something about, so they keep Stripe's own words.
    const theirs =
      error.type === "StripeCardError" || error.type === "StripeConnectionError";
    return theirs
      ? { ours: false, publicMessage: detail, detail }
      : { ours: true, publicMessage: OURS_PUBLIC, detail };
  }

  return { ours: true, publicMessage: OURS_PUBLIC, detail };
}
