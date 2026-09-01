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
