/**
 * payouts/actions.ts — sending a voucher to Stripe to set up getting paid.
 *
 * Plain English: the voucher never types their tax details or bank account
 * into Vouch. They press a button here, we send them to a page hosted by
 * Stripe on Stripe's own domain, and they come back. Nothing sensitive passes
 * through this codebase at any point.
 *
 * This is only ever reached from the payouts screen, which only ever shows
 * the button when there is real money waiting for them.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripeErrorMessage, stripeIsConfigured } from "@/lib/stripe/client";
import { startOnboardingLink } from "@/lib/stripe/connect";

/** Where Stripe sends people back to. Must be a full address, not a path. */
function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** The logged-in voucher's id, or null if this isn't a voucher. */
async function currentVoucherId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  // Row-level security means this only ever returns their own row.
  const { data } = await supabase
    .from("voucher_profiles")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return (data?.user_id as string) ?? null;
}

/**
 * Off to Stripe.
 *
 * Used by both the first-time button and the "that link expired" path — the
 * link Stripe gives us is only good for a few minutes, so the only correct
 * answer to a stale one is a fresh one.
 */
export async function startPayoutSetup(): Promise<void> {
  if (!stripeIsConfigured()) redirect("/payouts?error=off");

  const voucherId = await currentVoucherId();
  if (!voucherId) redirect("/dashboard");

  let url: string | null = null;
  try {
    url = await startOnboardingLink(voucherId, siteUrl());
  } catch (error) {
    console.error("[stripe] could not start payout setup:", stripeErrorMessage(error));
    redirect("/payouts?error=start");
  }

  if (!url) redirect("/payouts?error=start");
  revalidatePath("/payouts");
  // `redirect` throws, so nothing below runs.
  redirect(url);
}
