/**
 * employer/billing/actions.ts — saving a card or a bank account.
 *
 * Plain English: the employer never types card details into Vouch. They click
 * a button here, we send them to a page hosted by Stripe on Stripe's own
 * domain, and they come back. Nothing sensitive passes through this codebase
 * at any point — which is exactly why it's done this way rather than with a
 * card form of our own.
 *
 * Card and bank are both offered. Bank costs a fraction of card on a $2,000
 * fee, which is money that would otherwise come straight out of the margin.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, stripeErrorMessage, stripeIsConfigured } from "@/lib/stripe/client";
import {
  getOrCreateCustomer,
  removePaymentMethod,
  saveDefaultPaymentMethod,
} from "@/lib/stripe/payment-methods";
import { collectFeeForHire } from "@/lib/stripe/charges";

export type BillingState = { error: string | null; notice?: string | null };

/** The company this employer acts for, or null. */
async function employerCompany() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return { user: auth.user, companyId: data.company_id as string };
}

/** Where Stripe sends people back to. Must be a full address, not a path. */
function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3000";
}

/**
 * Sends the employer to Stripe to enter their details.
 *
 * `mode: "setup"` means "save this for later, don't charge anything now" —
 * no money moves at this point, and the employer is told so on screen.
 */
export async function startPaymentMethodSetup(): Promise<void> {
  if (!stripeIsConfigured()) redirect("/employer/billing?error=off");

  const ctx = await employerCompany();
  if (!ctx) redirect("/dashboard");

  let url: string | null = null;
  try {
    const customerId = await getOrCreateCustomer(ctx.companyId);
    const session = await stripe().checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      // Card is instant. A US bank account is far cheaper on the $2,000 tier.
      payment_method_types: ["card", "us_bank_account"],
      success_url: `${siteUrl()}/employer/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/employer/billing?cancelled=1`,
      metadata: { vouch_company_id: ctx.companyId },
    });
    url = session.url;
  } catch (error) {
    console.error("[stripe] could not start setup:", stripeErrorMessage(error));
    redirect("/employer/billing?error=start");
  }

  if (!url) redirect("/employer/billing?error=start");
  // Off to Stripe. `redirect` throws, so nothing below runs.
  redirect(url);
}

/**
 * Called when they come back from Stripe.
 *
 * The webhook does this too. Both are safe to run: saving the same method
 * twice writes the same values. Doing it here as well means the employer sees
 * the result immediately rather than waiting for a webhook to land.
 */
export async function completePaymentMethodSetup(sessionId: string): Promise<BillingState> {
  if (!stripeIsConfigured()) return { error: null };

  const ctx = await employerCompany();
  if (!ctx) return { error: "You're not set up as an employer on any company." };

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    // Only ever act on a session belonging to this employer's own company.
    if (session.metadata?.vouch_company_id !== ctx.companyId) {
      return { error: "That payment setup belongs to a different company." };
    }

    const setupIntent = session.setup_intent;
    if (!setupIntent || typeof setupIntent === "string") {
      return { error: "Stripe hasn't finished setting that up yet. Refresh in a moment." };
    }

    const methodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!methodId) {
      // A bank account verified by micro-deposits finishes days later. The
      // webhook picks it up when it does.
      return {
        error: null,
        notice:
          "Your bank is still confirming this. Stripe will finish it — usually within a " +
          "couple of days — and it'll appear here automatically. You can post roles meanwhile.",
      };
    }

    const saved = await saveDefaultPaymentMethod(ctx.companyId, methodId);
    revalidatePath("/employer/billing");
    revalidatePath("/dashboard");
    return {
      error: null,
      notice: `Saved — ${saved.label} ending ${saved.last4}. You'll only ever be charged when you actually hire someone.`,
    };
  } catch (error) {
    return { error: stripeErrorMessage(error) };
  }
}

/** Removes the saved method, at Stripe and here. */
export async function forgetPaymentMethod(): Promise<void> {
  const ctx = await employerCompany();
  if (!ctx) return;

  try {
    await removePaymentMethod(ctx.companyId);
  } catch (error) {
    console.error("[stripe] could not remove payment method:", stripeErrorMessage(error));
  }

  revalidatePath("/employer/billing");
  revalidatePath("/dashboard");
  redirect("/employer/billing?removed=1");
}

/**
 * "Try that fee again."
 *
 * Off-session card charges get declined for ordinary reasons — a card expired,
 * the bank wanted a nudge, the limit was low that day. The employer fixes it
 * and presses this. It cannot charge anything that is already settled, and it
 * cannot charge a hire both sides have not confirmed; `collectFeeForHire`
 * checks both before it talks to Stripe.
 */
export async function retryCharge(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const hireId = String(formData.get("hire_id") ?? "");
  if (!hireId) return { error: "We couldn't tell which fee that was." };

  const ctx = await employerCompany();
  if (!ctx) return { error: "You're not set up as an employer on any company." };

  // Only ever retry a fee belonging to this employer's own company.
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("employer_charges")
    .select("id")
    .eq("hire_id", hireId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!owned) return { error: "That fee isn't one of yours." };

  const result = await collectFeeForHire(hireId);
  revalidatePath("/employer/billing");

  if (result.status === "paid") return { error: null, notice: result.detail };
  if (result.status === "processing") {
    return { error: null, notice: "Sent. Bank payments take a few working days to clear." };
  }
  return { error: result.detail };
}
