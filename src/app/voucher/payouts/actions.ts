/**
 * voucher/payouts/actions.ts — setting up where a voucher gets paid.
 *
 * Plain English: the voucher clicks a button, lands on a form Stripe hosts,
 * fills in their bank details and identity, and comes back. Vouch never sees
 * any of it — only whether Stripe is now willing to pay them.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripeErrorMessage, stripeIsConfigured } from "@/lib/stripe/client";
import { onboardingLinkFor, syncRecipientAccount } from "@/lib/stripe/connect";

export type PayoutState = { error: string | null; notice?: string | null };

/** The signed-in voucher, or null. */
async function currentVoucher() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("voucher_profiles")
    .select("user_id, payout_account_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return { userId: auth.user.id, accountId: data.payout_account_id as string | null };
}

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return url ? url.replace(/\/$/, "") : "http://localhost:3000";
}

/** Sends the voucher to Stripe to set up (or finish setting up) their account. */
export async function startPayoutOnboarding(): Promise<void> {
  if (!stripeIsConfigured()) redirect("/voucher/payouts?error=off");

  const ctx = await currentVoucher();
  if (!ctx) redirect("/dashboard");

  let url: string | null = null;
  try {
    url = await onboardingLinkFor(ctx.userId, siteUrl());
  } catch (error) {
    console.error("[stripe] payout onboarding failed:", stripeErrorMessage(error));
    redirect("/voucher/payouts?error=start");
  }

  if (!url) redirect("/voucher/payouts?error=start");
  redirect(url);
}

/**
 * Asks Stripe where this account has got to and writes it down.
 *
 * The webhook does this too. This is here because someone coming back from
 * onboarding wants to see the result now, not whenever a webhook lands.
 */
export async function refreshPayoutAccount(): Promise<PayoutState> {
  const ctx = await currentVoucher();
  if (!ctx?.accountId) return { error: null };

  try {
    const state = await syncRecipientAccount(ctx.accountId);
    revalidatePath("/voucher/payouts");
    revalidatePath("/dashboard");

    if (state.status === "active") {
      return { error: null, notice: "You're all set. Anything you've earned will be paid out when it releases." };
    }
    if (state.outstanding.length > 0) {
      return {
        error: null,
        notice: `Stripe still needs ${state.outstanding.slice(0, 3).join(", ")}. Pick up where you left off below.`,
      };
    }
    return { error: null, notice: "Stripe is still checking your details. This usually takes a few minutes." };
  } catch (error) {
    return { error: stripeErrorMessage(error) };
  }
}
