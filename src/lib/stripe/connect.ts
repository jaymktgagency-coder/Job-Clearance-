/**
 * stripe/connect.ts — the account a voucher gets paid into.
 *
 * Plain English: a voucher earns half the fee, released 60 days after their
 * person's start date. To be paid they need a Stripe account of their own.
 * They set it up on pages Stripe hosts, and Stripe keeps everything sensitive
 * — bank account number, date of birth, tax number. Vouch stores an account
 * identifier and a few dates, and nothing else.
 *
 * Stripe also files the 1099s. That is Vouch's obligation as the payer, not
 * the employer's, and it is a good reason to let Stripe hold the tax details.
 *
 * THE API SHAPE, WHICH IS NOT OBVIOUS
 * Stripe no longer accepts Accounts v1 for new Connect integrations, so the
 * account is created with `v2.core.accounts` using the `recipient`
 * configuration. Everything after that uses the v1 endpoints, which accept a
 * v2 account id:
 *
 *   create   -> stripe.v2.core.accounts.create   (v2, required)
 *   onboard  -> stripe.accountLinks.create       (v1, takes the v2 id)
 *   read     -> stripe.accounts.retrieve         (v1, gives payouts_enabled)
 *   pay      -> stripe.transfers.create          (v1, needs `transfers` live)
 *
 * All four were proven against the live test account before this was written.
 */

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { stripe, stripeErrorMessage, stripeIsConfigured } from "./client";

/** Where a voucher has got to, in words a screen can use. */
export type PayoutAccountState = {
  status: "none" | "onboarding" | "restricted" | "active";
  payoutsEnabled: boolean;
  /** Stripe's own list of what is still missing, in plain-ish English. */
  outstanding: string[];
  accountId: string | null;
};

/**
 * Stripe names requirements like `identity.individual.date_of_birth.day`.
 * This turns the ones vouchers actually hit into something a person can act
 * on. Patterns cover both the v2 names and their v1 equivalents.
 */
const REQUIREMENT_LABELS: [RegExp, string][] = [
  [/external_account|bank_account/, "your bank account details"],
  [/(given_name|surname|first_name|last_name)/, "your name"],
  [/(date_of_birth|\bdob\b)/, "your date of birth"],
  [/address/, "your home address"],
  [/(id_number|ssn|tax_id)/, "your tax number"],
  [/verification.*document|document.*verification/, "a photo of your ID"],
  [/terms_of_service|tos_acceptance/, "agreeing to Stripe's terms"],
  [/business_url|business_profile|profile/, "a line about what you do"],
  [/phone/, "a phone number"],
  [/entity_type|business_type/, "whether you're an individual or a business"],
];

function describeRequirements(fields: string[]): string[] {
  const out = new Set<string>();
  for (const field of fields) {
    const match = REQUIREMENT_LABELS.find(([pattern]) => pattern.test(field));
    out.add(match ? match[1] : field.replace(/[._]/g, " "));
  }
  return [...out];
}

/**
 * The voucher's Stripe account, made the first time they ask to set up payouts.
 *
 * `recipient` is the configuration for an account that only ever RECEIVES
 * money. A voucher never charges anyone, so they get nothing else.
 */
export async function getOrCreateRecipientAccount(userId: string): Promise<string> {
  const admin = await createAdminClient();

  const { data: profile, error } = await admin
    .from("voucher_profiles")
    .select("user_id, payout_account_id, users(full_name, email)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    throw new Error(`We couldn't find that voucher: ${error?.message ?? "no profile"}`);
  }
  if (profile.payout_account_id) return profile.payout_account_id as string;

  const person = (Array.isArray(profile.users) ? profile.users[0] : profile.users) as
    | { full_name: string | null; email: string }
    | null;

  const account = await stripe().v2.core.accounts.create({
    contact_email: person?.email,
    display_name: person?.full_name ?? undefined,
    // Stripe hosts their dashboard, so Vouch never has to build one.
    dashboard: "express",
    identity: { country: "us", entity_type: "individual" },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
    },
    defaults: {
      currency: "usd",
      locales: ["en-US"],
      // Stripe only accepts "application" for a recipient-only account, which
      // means Vouch — not Stripe — carries a negative balance if one happens.
      responsibilities: { fees_collector: "application", losses_collector: "application" },
    },
    metadata: { vouch_user_id: userId },
  } as Stripe.V2.Core.AccountCreateParams);

  const { error: saveErr } = await admin
    .from("voucher_profiles")
    .update({
      payout_account_id: account.id,
      payout_account_status: "onboarding",
      payout_onboarding_started_at: new Date().toISOString(),
      payout_account_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (saveErr) {
    throw new Error(`Stripe made the account but we couldn't record it: ${saveErr.message}`);
  }
  return account.id;
}

/**
 * A one-use link to Stripe's own onboarding form.
 *
 * These expire in minutes and grant access to the person's own details, so
 * they are made on demand and never emailed or stored.
 */
export async function onboardingLinkFor(userId: string, siteUrl: string): Promise<string> {
  const accountId = await getOrCreateRecipientAccount(userId);
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl}/voucher/payouts?refresh=1`,
    return_url: `${siteUrl}/voucher/payouts?done=1`,
    // Ask for everything now rather than coming back for more later — a
    // voucher who has to do this twice mostly doesn't do it twice.
    collection_options: { fields: "eventually_due" },
  });
  return link.url;
}

/**
 * Copies Stripe's view of the account into our columns.
 *
 * Two of those columns gate money, so what they mean matters:
 *
 *   identity_verified_at  — set when Stripe has ENABLED PAYOUTS. Stripe does
 *     not enable payouts until it has verified the person to its own KYC
 *     standard, so that flag is a stronger statement than anything Vouch
 *     could check for itself.
 *
 *   tax_info_collected_at — set when the account is submitted and Stripe is
 *     no longer asking for a tax number or ID document. Stripe holds the
 *     number; Vouch only records that it exists.
 */
export async function syncRecipientAccount(accountId: string): Promise<PayoutAccountState> {
  // Read the V2 view, not the v1 one. They disagree, and v2 is the one that
  // decides: a transfer to a v2 account is refused unless
  // configuration.recipient.capabilities.stripe_balance.stripe_transfers is
  // 'active'. The v1 view of the same account has been observed reporting
  // payouts_enabled: true and transfers: "active" while v2 called it
  // restricted and Stripe refused the transfer. Believing v1 would tell a
  // voucher they were ready to be paid when they were not.
  const account = (await stripe().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient", "requirements", "identity"],
  })) as Stripe.V2.Core.Account;

  const userId = account.metadata?.vouch_user_id;

  const transfers =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
  const transfersActive = transfers?.status === "active";

  // Anything Stripe is still waiting on the person to provide.
  const entries = account.requirements?.entries ?? [];
  const outstandingFields = entries
    .filter((e) => e.awaiting_action_from === "user")
    .map((e) => e.description ?? "")
    .filter(Boolean);

  const started = !!account.requirements || entries.length > 0;
  const taxOutstanding = outstandingFields.some((f) => /id_number|ssn|tax_id|document/.test(f));

  const status: PayoutAccountState["status"] = transfersActive
    ? "active"
    : outstandingFields.length > 0
      ? "restricted"
      : started
        ? "onboarding"
        : "onboarding";

  const state: PayoutAccountState = {
    status,
    payoutsEnabled: transfersActive,
    outstanding: describeRequirements(outstandingFields),
    accountId,
  };

  if (!userId) return state;

  const now = new Date().toISOString();
  const admin = await createAdminClient();

  // Once set, these two stay set — losing them would strand a payout that was
  // already approved. Stripe re-asking for something later shows up in
  // payouts_enabled and the requirements list instead.
  const { data: existing } = await admin
    .from("voucher_profiles")
    .select("identity_verified_at, tax_info_collected_at")
    .eq("user_id", userId)
    .maybeSingle();

  await admin
    .from("voucher_profiles")
    .update({
      payout_account_status: status,
      payouts_enabled: transfersActive,
      payout_requirements: outstandingFields,
      payout_account_updated_at: now,
      // Stripe does not turn on transfers until it has verified the person to
      // its own KYC standard, so this flag is a stronger statement than
      // anything Vouch could check for itself.
      identity_verified_at:
        (existing?.identity_verified_at as string | null) ?? (transfersActive ? now : null),
      tax_info_collected_at:
        (existing?.tax_info_collected_at as string | null) ??
        (transfersActive && !taxOutstanding ? now : null),
    })
    .eq("user_id", userId);

  return state;
}

/** Reads the state we already have, without calling Stripe. */
export async function payoutAccountState(userId: string): Promise<PayoutAccountState> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("voucher_profiles")
    .select("payout_account_id, payout_account_status, payouts_enabled, payout_requirements")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    status: (data?.payout_account_status as PayoutAccountState["status"]) ?? "none",
    payoutsEnabled: (data?.payouts_enabled as boolean) ?? false,
    outstanding: describeRequirements((data?.payout_requirements as string[]) ?? []),
    accountId: (data?.payout_account_id as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Actually sending the money
// ---------------------------------------------------------------------------

export type PayoutResult = { ok: boolean; status: string; detail: string };

/**
 * Sends one released payout to the voucher's account.
 *
 * Only ever pays a payout the database has already marked 'released', which
 * by then means: both sides confirmed the hire, 60 days passed, nobody
 * reported a departure, the employer's fee actually arrived, and identity and
 * tax details are done. This function re-reads all of that rather than
 * trusting its caller.
 */
export async function payPayout(payoutId: string): Promise<PayoutResult> {
  if (!stripeIsConfigured()) {
    return { ok: false, status: "skipped", detail: "Payments are switched off (no STRIPE_SECRET_KEY)." };
  }

  const admin = await createAdminClient();

  const { data: payout, error } = await admin
    .from("payouts")
    .select(`
      id, hire_id, voucher_id, amount_cents, status, stripe_transfer_id, attempt_count,
      voucher_profiles:voucher_id(payout_account_id, payouts_enabled),
      hires(jobs(title))
    `)
    .eq("id", payoutId)
    .maybeSingle();

  if (error || !payout) {
    return { ok: false, status: "skipped", detail: `No such payout: ${error?.message ?? "not found"}` };
  }
  if (payout.status === "paid") {
    return { ok: true, status: "paid", detail: "Already paid." };
  }
  if (payout.status !== "released") {
    return { ok: false, status: payout.status as string, detail: `This payout is '${payout.status}', not released.` };
  }
  if (payout.stripe_transfer_id) {
    return { ok: true, status: "paid", detail: "A transfer already exists for this payout." };
  }

  const vp = (Array.isArray(payout.voucher_profiles) ? payout.voucher_profiles[0] : payout.voucher_profiles) as
    | { payout_account_id: string | null; payouts_enabled: boolean }
    | null;

  if (!vp?.payout_account_id || !vp.payouts_enabled) {
    const detail = "This voucher's payout account isn't ready yet, so there is nowhere to send the money.";
    await admin.from("payouts").update({
      last_error: detail, attempted_at: new Date().toISOString(),
      attempt_count: (payout.attempt_count as number) + 1,
    }).eq("id", payoutId);
    return { ok: false, status: "released", detail };
  }

  const hire = (Array.isArray(payout.hires) ? payout.hires[0] : payout.hires) as { jobs: unknown } | null;
  const job = hire?.jobs as { title?: string } | { title?: string }[] | null;
  const title = (Array.isArray(job) ? job[0]?.title : job?.title) ?? "a hire";

  try {
    const transfer = await stripe().transfers.create(
      {
        amount: payout.amount_cents as number,
        currency: "usd",
        destination: vp.payout_account_id,
        description: `Vouch — your share for ${title}`,
        metadata: { vouch_payout_id: payoutId, vouch_hire_id: payout.hire_id as string },
      },
      // A retry returns the original transfer rather than paying twice.
      { idempotencyKey: `vouch-payout-${payoutId}` },
    );

    await admin
      .from("payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        paid_at: new Date().toISOString(),
        last_error: null,
        attempted_at: new Date().toISOString(),
        attempt_count: (payout.attempt_count as number) + 1,
      })
      .eq("id", payoutId);

    return {
      ok: true,
      status: "paid",
      detail: `Sent $${((payout.amount_cents as number) / 100).toLocaleString()} to the voucher.`,
    };
  } catch (err) {
    const detail = stripeErrorMessage(err);
    await admin
      .from("payouts")
      .update({
        last_error: detail,
        attempted_at: new Date().toISOString(),
        attempt_count: (payout.attempt_count as number) + 1,
      })
      .eq("id", payoutId);
    return { ok: false, status: "released", detail };
  }
}
