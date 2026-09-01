/**
 * /api/stripe/webhook — Stripe telling us something happened.
 *
 * Plain English: some things finish long after the employer has closed the
 * tab. A bank account verified by micro-deposits can take a couple of days.
 * Stripe calls this address when it's done, and this is where we write it down.
 *
 * THREE RULES THIS FILE FOLLOWS, ALL OF WHICH MATTER FOR MONEY:
 *
 *   1. VERIFY THE SIGNATURE. Anyone on the internet can POST here. Without
 *      checking Stripe's signature, anyone could tell us a payment method was
 *      saved, or later, that a fee was paid. The raw body is required for
 *      that check, which is why it's read as text and not as JSON.
 *   2. BE SAFE TO RUN TWICE. Stripe retries, replays, and sometimes delivers
 *      the same event more than once. Everything here writes the same values
 *      when it runs again rather than adding something new.
 *   3. ALWAYS RETURN 200 ONCE THE SIGNATURE CHECKS OUT. If we return an error
 *      for something we simply don't handle, Stripe retries it for days.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeIsConfigured } from "@/lib/stripe/client";
import { saveDefaultPaymentMethod } from "@/lib/stripe/payment-methods";

// Webhooks are never prerendered and never cached.
export const dynamic = "force-dynamic";

/** Finds which Vouch company an event belongs to. */
async function companyIdFor(object: Stripe.Checkout.Session | Stripe.SetupIntent): Promise<string | null> {
  const fromMetadata = object.metadata?.vouch_company_id;
  if (fromMetadata) return fromMetadata;

  // A SetupIntent that finished on its own may not carry our metadata, but it
  // does know its customer — and we put the company id on that.
  const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;
  if (!customerId) return null;

  const customer = await stripe().customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.metadata?.vouch_company_id ?? null;
}

export async function POST(request: Request) {
  if (!stripeIsConfigured()) {
    return NextResponse.json({ error: "Payments are switched off." }, { status: 503 });
  }

  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    // Refusing is the right answer: without the secret we cannot tell a real
    // Stripe call from anyone else's, and acting on an unverified one is how
    // money goes missing.
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is missing — refusing to trust this call.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature." }, { status: 400 });
  }

  // The signature is over the exact bytes Stripe sent, so this must be the raw
  // body — parsing it first would break the check.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error("[stripe] signature check failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      // The employer finished entering their details and came back.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "setup") break;

        const companyId = await companyIdFor(session);
        if (!companyId || !session.setup_intent) break;

        const intentId =
          typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id;
        const intent = await stripe().setupIntents.retrieve(intentId);
        const methodId =
          typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;

        if (methodId) {
          await saveDefaultPaymentMethod(companyId, methodId);
          console.log(`[stripe] payment method saved for company ${companyId}`);
        }
        break;
      }

      // A bank account that needed micro-deposits, finishing days later.
      case "setup_intent.succeeded": {
        const intent = event.data.object as Stripe.SetupIntent;
        const companyId = await companyIdFor(intent);
        const methodId =
          typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;

        if (companyId && methodId) {
          await saveDefaultPaymentMethod(companyId, methodId);
          console.log(`[stripe] setup completed later for company ${companyId}`);
        }
        break;
      }

      // Worth a log line: the employer will be wondering why nothing saved.
      case "setup_intent.setup_failed": {
        const intent = event.data.object as Stripe.SetupIntent;
        console.warn(
          `[stripe] setup failed for ${intent.customer}: ${intent.last_setup_error?.message ?? "no reason given"}`,
        );
        break;
      }

      default:
        // Everything else is Stripe being chatty. Acknowledged, not acted on.
        break;
    }
  } catch (error) {
    // The signature was good, so this is our bug, not a forged call. Say so in
    // the log, and let Stripe retry — the handlers above are safe to re-run.
    console.error(`[stripe] handling ${event.type} failed:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
