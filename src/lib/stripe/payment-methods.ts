/**
 * stripe/payment-methods.ts — the employer's saved card or bank account.
 *
 * Plain English: an employer pays a fee only when they hire someone, which
 * might be weeks after they post a role. So we ask them to put a payment
 * method on file up front, and Stripe keeps it.
 *
 * WHAT THIS FILE NEVER SEES: the card number, the bank account number, the
 * CVC, or the name on the card. The employer types those into a page hosted
 * by Stripe, on Stripe's own domain. What comes back to us is an identifier
 * and the last four digits — enough to say "Visa ending 4242" and nothing more.
 *
 * The columns written here are platform-only (migration 0010): an employer
 * cannot tick their own "payment method on file" box, because that box is one
 * of the three things their verification badge is built from.
 */

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "./client";

/** What an employer sees about the method they've saved. */
export type SavedMethod = {
  type: "card" | "us_bank_account";
  label: string;
  last4: string;
  updatedAt: string | null;
};

/**
 * Finds the Stripe customer for a company, making one the first time.
 *
 * The company row is the record of which customer is theirs, so this can't
 * create a second one by accident — and if Stripe already has it, we reuse it.
 */
export async function getOrCreateCustomer(companyId: string): Promise<string> {
  const admin = await createAdminClient();

  const { data: company, error } = await admin
    .from("companies")
    .select("id, name, stripe_customer_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !company) {
    throw new Error(`We couldn't find that company: ${error?.message ?? "no such company"}`);
  }
  if (company.stripe_customer_id) return company.stripe_customer_id as string;

  const customer = await stripe().customers.create(
    {
      name: company.name as string,
      metadata: { vouch_company_id: companyId },
    },
    // If this call is retried, Stripe returns the same customer rather than
    // making a second one.
    { idempotencyKey: `vouch-customer-${companyId}` },
  );

  const { error: saveErr } = await admin
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", companyId);

  if (saveErr) {
    throw new Error(`Stripe accepted it but we couldn't record it: ${saveErr.message}`);
  }
  return customer.id;
}

/** Reads the human-friendly bits out of whatever kind of method this is. */
function describe(method: Stripe.PaymentMethod): { type: SavedMethod["type"]; label: string; last4: string } | null {
  if (method.type === "card" && method.card) {
    return {
      type: "card",
      // "visa" -> "Visa"
      label: method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1),
      last4: method.card.last4,
    };
  }
  if (method.type === "us_bank_account" && method.us_bank_account) {
    return {
      type: "us_bank_account",
      label: method.us_bank_account.bank_name ?? "Bank account",
      last4: method.us_bank_account.last4 ?? "0000",
    };
  }
  return null;
}

/**
 * Records a saved payment method against the company, and makes it the one
 * Stripe uses by default.
 *
 * Safe to run twice with the same method — it simply writes the same values
 * again, which matters because both the return page and the webhook call it.
 */
export async function saveDefaultPaymentMethod(
  companyId: string,
  paymentMethodId: string,
): Promise<SavedMethod> {
  const client = stripe();
  const method = await client.paymentMethods.retrieve(paymentMethodId);
  const details = describe(method);

  if (!details) {
    throw new Error(`We can't take a ${method.type} as a payment method yet.`);
  }

  // Tell Stripe to use this one when we charge the fee later.
  if (typeof method.customer === "string") {
    await client.customers.update(method.customer, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({
      default_payment_method_id: paymentMethodId,
      default_payment_method_type: details.type,
      default_payment_method_label: details.label,
      default_payment_method_last4: details.last4,
      payment_method_updated_at: new Date().toISOString(),
      // This is the bit an employer may not set for themselves.
      payment_method_on_file: true,
    })
    .eq("id", companyId);

  if (error) {
    throw new Error(`Stripe saved it but we couldn't record it: ${error.message}`);
  }

  return { ...details, updatedAt: new Date().toISOString() };
}

/** Forgets the saved method, on both sides. */
export async function removePaymentMethod(companyId: string): Promise<void> {
  const admin = await createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("default_payment_method_id")
    .eq("id", companyId)
    .maybeSingle();

  const methodId = company?.default_payment_method_id as string | undefined;
  if (methodId) {
    // Detaching at Stripe is what actually stops it being chargeable.
    await stripe().paymentMethods.detach(methodId).catch(() => {
      // Already detached at Stripe is fine — we still clear our own record.
    });
  }

  await admin
    .from("companies")
    .update({
      default_payment_method_id: null,
      default_payment_method_type: null,
      default_payment_method_label: null,
      default_payment_method_last4: null,
      payment_method_updated_at: new Date().toISOString(),
      payment_method_on_file: false,
    })
    .eq("id", companyId);
}
