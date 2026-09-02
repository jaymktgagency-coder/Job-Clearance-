/**
 * stripe/connect.ts — how a voucher gets paid.
 *
 * Plain English: a voucher earns half the fee, and it releases 60 days after
 * the person they vouched for starts work. To send them that money we need
 * two things the law and Stripe both insist on: proof of who they are, and
 * their tax details.
 *
 * WE ASK FOR NONE OF THAT UP FRONT. Writing a vouch costs nothing and requires
 * no paperwork. Most vouches never become a hire, and making someone file tax
 * details for money they may never earn is a good way to have them not bother.
 * So the ask happens once there is actually money with their name on it.
 *
 * WHAT THIS FILE NEVER SEES: a Social Security number, a date of birth, a
 * bank account number, a photo of a driving licence. The voucher types those
 * into a page hosted by Stripe, on Stripe's own domain — the same arrangement
 * as the employer's card in payment-methods.ts. What comes back to us is an
 * account identifier and Stripe's yes-or-no answer on whether they are ready
 * to be paid.
 *
 * The three columns written here are platform-only (migration 0001,
 * protect_voucher_verification): a voucher cannot tick their own "identity
 * verified" box, because that box is the only thing standing between an
 * unverified stranger and a payout.
 */

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "./client";

/** What the payouts screen needs to know, read from our own columns. */
export type PayoutReadiness = {
  /** The Stripe account id, or null if they have never started. */
  accountId: string | null;
  identityVerifiedAt: string | null;
  taxCollectedAt: string | null;
  /** True when both gates are open and money can actually be released. */
  ready: boolean;
};

/**
 * Requirements that mean "we still need their tax details".
 *
 * Stripe has no single "tax info collected" flag, so we read it off the list
 * of things it is still waiting for. These are the entries that are tax
 * paperwork rather than identity or bank details.
 */
const TAX_REQUIREMENTS = [
  "individual.id_number",
  "individual.ssn_last_4",
  "individual.id_number_secondary",
  "company.tax_id",
  "company.tax_id_registrar",
];

/**
 * Finds the voucher's Stripe account, making one the first time.
 *
 * The voucher_profiles row is the record of which account is theirs, so this
 * cannot create a second one by accident — and the idempotency key means a
 * retried call returns the original account rather than making another.
 */
export async function getOrCreateConnectAccount(voucherId: string): Promise<string> {
  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("voucher_profiles")
    .select("user_id, payout_account_id, users(email)")
    .eq("user_id", voucherId)
    .maybeSingle();

  if (error || !profile) {
    throw new Error(`We couldn't find that voucher: ${error?.message ?? "no such voucher"}`);
  }
  if (profile.payout_account_id) return profile.payout_account_id as string;

  const user = Array.isArray(profile.users) ? profile.users[0] : profile.users;

  const account = await stripe().accounts.create(
    {
      type: "express",
      country: "US",
      email: (user?.email as string) ?? undefined,
      // Vouch sends money out to them; they never take payments from anyone.
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      metadata: { vouch_voucher_id: voucherId },
    },
    { idempotencyKey: `vouch-connect-${voucherId}` },
  );

  const { error: saveErr } = await admin
    .from("voucher_profiles")
    .update({ payout_account_id: account.id })
    .eq("user_id", voucherId);

  if (saveErr) {
    throw new Error(`Stripe accepted it but we couldn't record it: ${saveErr.message}`);
  }
  return account.id;
}

/**
 * The link that takes a voucher to Stripe to fill in their details.
 *
 * These links go stale after a few minutes, which is why `refresh_url` points
 * back at our own screen: if they leave the tab open and come back to a dead
 * link, Stripe sends them there and we mint a fresh one. A voucher never sees
 * an expired-link error page.
 */
export async function startOnboardingLink(voucherId: string, siteUrl: string): Promise<string> {
  const accountId = await getOrCreateConnectAccount(voucherId);

  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl}/payouts?refresh=1`,
    return_url: `${siteUrl}/payouts?done=1`,
    type: "account_onboarding",
  });

  return link.url;
}

/**
 * Turns a Stripe account into our two gates.
 *
 * This is the only place that decides what Stripe's answer means for us, and
 * it is a judgement call, so here it is in full:
 *
 *   identity — we trust `payouts_enabled`. Stripe does not switch that on
 *   until it has satisfied itself who the person is. It is Stripe's answer to
 *   that question, not ours, and Stripe is the one carrying the risk.
 *
 *   tax — they have submitted their details and Stripe is not still asking
 *   for anything tax-shaped.
 *
 * IT WORKS IN BOTH DIRECTIONS. If Stripe later turns payouts off — a document
 * expired, a requirement re-opened, the account got restricted — the identity
 * gate closes again and release_due_payouts() goes back to holding the money.
 * Paying into an account Stripe has stopped trusting is exactly the kind of
 * thing that is obvious afterwards and invisible before.
 *
 * Safe to run twice: an unchanged answer writes nothing, so the date on
 * "verified at" stays the day they actually verified rather than creeping
 * forward every time Stripe sends us another update.
 */
export async function recordAccountState(account: Stripe.Account): Promise<string> {
  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("voucher_profiles")
    .select("user_id, identity_verified_at, tax_info_collected_at")
    .eq("payout_account_id", account.id)
    .maybeSingle();

  if (error) return `could not look that account up: ${error.message}`;
  if (!profile) return `account ${account.id} does not belong to a Vouch voucher`;

  const outstanding = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.past_due ?? []),
  ];

  const identityOk = account.payouts_enabled === true;
  const taxOk =
    account.details_submitted === true &&
    !outstanding.some((r) => TAX_REQUIREMENTS.includes(r));

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {};

  // Only write a change. Setting the same value again would move the date.
  if (identityOk && !profile.identity_verified_at) patch.identity_verified_at = now;
  if (!identityOk && profile.identity_verified_at) patch.identity_verified_at = null;
  if (taxOk && !profile.tax_info_collected_at) patch.tax_info_collected_at = now;
  if (!taxOk && profile.tax_info_collected_at) patch.tax_info_collected_at = null;

  if (Object.keys(patch).length === 0) {
    return `no change for ${account.id} (identity ${identityOk ? "ok" : "not ok"}, tax ${taxOk ? "ok" : "not ok"})`;
  }

  const { error: saveErr } = await admin
    .from("voucher_profiles")
    .update(patch)
    .eq("user_id", profile.user_id);

  if (saveErr) return `could not record it: ${saveErr.message}`;

  return `voucher ${profile.user_id}: identity ${identityOk ? "verified" : "NOT verified"}, tax ${taxOk ? "collected" : "NOT collected"}`;
}

/**
 * A payout that was held only because we were waiting on these details can go
 * back in the queue now that we have them. Held is a waiting room, not a
 * verdict — the same call charges.ts makes when an employer's fee lands.
 */
export async function releaseWhatIsNowUnblocked(): Promise<void> {
  try {
    const admin = await createAdminClient();
    await admin.rpc("unhold_settled_payouts");
  } catch {
    // The scheduled job (9d) will pick it up anyway. Not worth failing a
    // successful verification over.
  }
}

/**
 * Reads the two gates for a voucher. Makes no call to Stripe.
 *
 * Platform-side only — the payouts screen reads the same columns as the
 * logged-in voucher, through row-level security, because that is data going
 * to a visitor.
 */
export async function payoutReadiness(voucherId: string): Promise<PayoutReadiness> {
  const admin = await createAdminClient();

  const { data } = await admin
    .from("voucher_profiles")
    .select("payout_account_id, identity_verified_at, tax_info_collected_at")
    .eq("user_id", voucherId)
    .maybeSingle();

  const identityVerifiedAt = (data?.identity_verified_at as string) ?? null;
  const taxCollectedAt = (data?.tax_info_collected_at as string) ?? null;

  return {
    accountId: (data?.payout_account_id as string) ?? null,
    identityVerifiedAt,
    taxCollectedAt,
    ready: Boolean(identityVerifiedAt && taxCollectedAt),
  };
}

/**
 * Fetches the live account from Stripe and records what it says.
 * Used by the return-from-Stripe screen, so a voucher sees the result at once
 * instead of waiting for a webhook to land.
 */
export async function refreshAccountState(voucherId: string): Promise<string> {
  const admin = await createAdminClient();

  const { data } = await admin
    .from("voucher_profiles")
    .select("payout_account_id")
    .eq("user_id", voucherId)
    .maybeSingle();

  const accountId = (data?.payout_account_id as string) ?? null;
  if (!accountId) return "no Stripe account yet";

  const account = await stripe().accounts.retrieve(accountId);
  const result = await recordAccountState(account);
  await releaseWhatIsNowUnblocked();
  return result;
}

/**
 * What the webhook calls when Stripe says an account changed.
 *
 * Records the new state and then puts back in the queue anything that was
 * held only because we were waiting on these details.
 *
 * The backfill in the middle covers one real gap: the account is created at
 * Stripe before we write its id to our row, so if that write failed we would
 * have an account nobody owns. The account carries the voucher id in its own
 * metadata, so we can repair it here rather than stranding their money.
 */
export async function handleAccountUpdated(account: Stripe.Account): Promise<string> {
  const voucherId = account.metadata?.vouch_voucher_id;

  if (voucherId) {
    const admin = await createAdminClient();
    const { data: byAccount } = await admin
      .from("voucher_profiles")
      .select("user_id")
      .eq("payout_account_id", account.id)
      .maybeSingle();

    if (!byAccount) {
      // Only ever fills in a blank. It will not move an account from one
      // voucher to another, whatever the metadata claims.
      await admin
        .from("voucher_profiles")
        .update({ payout_account_id: account.id })
        .eq("user_id", voucherId)
        .is("payout_account_id", null);
    }
  }

  const result = await recordAccountState(account);
  await releaseWhatIsNowUnblocked();
  return result;
}
