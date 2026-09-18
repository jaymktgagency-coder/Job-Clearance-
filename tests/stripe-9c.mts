/**
 * stripe-9c.mts — the account a voucher gets paid into.
 *
 * Talks to Stripe in test mode and builds its own company and people, which
 * it removes again at the end.
 *
 * WHAT IT CANNOT TEST, AND WHY
 * A voucher's account only becomes payable once a real person completes
 * Stripe's hosted form — Stripe will not let the platform accept its terms of
 * service on someone's behalf for an Express account. So the happy path ends
 * at "Stripe is still waiting for them". Everything up to that point, and
 * every refusal after it, is checked here.
 *
 *   npm run test:9c
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  getOrCreateRecipientAccount,
  onboardingLinkFor,
  payoutAccountState,
  payPayout,
  syncRecipientAccount,
} from "@/lib/stripe/connect";

const KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

let passed = 0, failed = 0;
const check = (l: string, ok: boolean, d = "") => { ok ? passed++ : failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${d ? ` — ${d}` : ""}`); };

if (!KEY) { console.log("No STRIPE_SECRET_KEY — nothing to test."); process.exit(0); }
if (!KEY.startsWith("sk_test_")) { console.error("REFUSING TO RUN: not a test key."); process.exit(1); }

const stripe = new Stripe(KEY);
const stamp = Date.now();
const users: string[] = [];
let companyId = "";
let accountId = "";

async function mkUser(tag: string, role: string, name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${tag}.${stamp}@connecttest.test`, password: `connect-${stamp}`, email_confirm: true,
  });
  if (error) throw new Error(error.message);
  users.push(data.user!.id);
  await admin.from("users").insert({ id: data.user!.id, role, full_name: name, email: `${tag}.${stamp}@connecttest.test` });
  return data.user!.id;
}

async function main() {
  const probe = await admin.from("voucher_profiles").select("payout_account_status").limit(1);
  if (probe.error?.message.includes("payout_account_status")) {
    console.error("\nMigration 0012 is not applied to this database.\nApply supabase/migrations/0012_voucher_payout_accounts.sql first.\n");
    process.exit(1);
  }

  const boss = await mkUser("boss", "employer", "Connect Boss");
  const voucher = await mkUser("voucher", "voucher", "Connect Voucher");
  const seeker = await mkUser("seeker", "seeker", "Connect Seeker");
  await admin.from("seeker_profiles").insert({ user_id: seeker, headline: "Test" });

  const { data: co } = await admin.from("companies").insert({
    name: `Connect Test Co ${stamp}`, slug: `connect-test-${stamp}`,
    business_registration_verified_at: new Date().toISOString(),
  }).select("id").single();
  companyId = co!.id;
  await admin.from("company_members").insert({ company_id: companyId, user_id: boss, member_role: "owner" });
  await admin.from("voucher_profiles").insert({
    user_id: voucher, company_id: companyId, status: "verified", verification_method: "employer_invite",
    verified_at: new Date().toISOString(), employer_permission_confirmed_at: new Date().toISOString(),
  });

  // --- 1. the account -----------------------------------------------------
  console.log("\n1. Creating the voucher's payout account");
  accountId = await getOrCreateRecipientAccount(voucher);
  check("a Stripe account was created", accountId.startsWith("acct_"), accountId);
  check("asking again returns the same one, not a second", (await getOrCreateRecipientAccount(voucher)) === accountId);

  let vp = (await admin.from("voucher_profiles").select("*").eq("user_id", voucher).single()).data!;
  check("recorded against the voucher", vp.payout_account_id === accountId);
  check("marked as onboarding, not ready", vp.payout_account_status === "onboarding", vp.payout_account_status as string);
  check("payouts NOT enabled yet", vp.payouts_enabled === false);
  check("identity NOT marked verified", vp.identity_verified_at === null);
  check("tax details NOT marked collected", vp.tax_info_collected_at === null);

  // --- 2. it is a recipient-only account ----------------------------------
  console.log("\n2. What kind of account it is");
  const v2 = await stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient", "configuration.merchant"] });
  check("has the recipient configuration", !!v2.configuration?.recipient);
  check("has NO merchant configuration — a voucher never charges anyone", !v2.configuration?.merchant);
  check("transfers capability is requested but not yet active",
    v2.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status !== "active",
    v2.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ?? "none");
  check("tagged with the Vouch user, so the webhook knows whose it is", v2.metadata?.vouch_user_id === voucher);

  // --- 3. the onboarding link ---------------------------------------------
  console.log("\n3. The link to Stripe's own form");
  const link = await onboardingLinkFor(voucher, "https://vouch-nu-gold.vercel.app");
  check("a Stripe-hosted onboarding URL", link.startsWith("https://connect.stripe.com/"), link.slice(0, 45) + "...");

  // --- 4. syncing tells the truth -----------------------------------------
  console.log("\n4. Asking Stripe where they've got to");
  const state = await syncRecipientAccount(accountId);
  check("still not payable", state.payoutsEnabled === false && state.status !== "active", state.status);
  check("tells the voucher what's missing, in words", state.outstanding.length > 0, state.outstanding.slice(0, 4).join(", "));
  const cached = await payoutAccountState(voucher);
  check("and that was written down for the screen to read", cached.outstanding.length === state.outstanding.length);

  vp = (await admin.from("voucher_profiles").select("*").eq("user_id", voucher).single()).data!;
  check("identity STILL not marked verified while Stripe is waiting", vp.identity_verified_at === null);

  // --- 5. nothing can be paid to an unfinished account --------------------
  console.log("\n5. Trying to pay it anyway");
  const { data: job } = await admin.from("jobs").insert({
    company_id: companyId, posted_by: boss, title: "Connect role", description: "Work.",
    pay_type: "hourly", status: "open", posted_at: new Date().toISOString(),
  }).select("id").single();
  const { data: req } = await admin.from("intro_requests").insert({ job_id: job!.id, seeker_id: seeker }).select("id").single();
  await admin.from("vouches").insert({
    intro_request_id: req!.id, voucher_id: voucher, relationship: "knows_personally",
    body: "I worked alongside them for two years and would again. ".repeat(4),
  });
  const { data: app } = await admin.from("applications").select("id").eq("job_id", job!.id).single();
  const { data: hire } = await admin.from("hires").insert({
    application_id: app!.id, start_date: new Date(Date.now() - 61 * 864e5).toISOString().slice(0, 10),
    confirmed_by_employer_at: new Date().toISOString(),
  }).select("id").single();
  await admin.from("hires").update({ confirmed_by_seeker_at: new Date().toISOString() }).eq("id", hire!.id);
  await admin.from("employer_charges").update({ status: "paid", paid_at: new Date().toISOString() }).eq("hire_id", hire!.id);

  const payout = (await admin.from("payouts").select("id, amount_cents, status").eq("hire_id", hire!.id).single()).data!;
  check("a payout exists for the voucher", !!payout.id, `$${(payout.amount_cents as number) / 100}`);

  // The database refuses to release it: identity and tax are not done.
  const relErr = await admin.from("payouts").update({ status: "released", released_at: new Date().toISOString() }).eq("id", payout.id);
  check("the database refuses to release it — identity and tax aren't done", !!relErr.error,
    relErr.error?.message.slice(0, 70));

  // And the code refuses to pay it.
  const paid = await payPayout(payout.id as string);
  check("payPayout refuses", paid.ok === false, paid.detail);
  const after = (await admin.from("payouts").select("status, stripe_transfer_id, last_error, attempt_count").eq("id", payout.id).single()).data!;
  check("no transfer was made", after.stripe_transfer_id === null);
  check("still not paid", after.status !== "paid", after.status as string);

  // --- 6. and Stripe itself refuses too -----------------------------------
  console.log("\n6. Going around the app and asking Stripe directly");
  try {
    await stripe.transfers.create({ amount: 25000, currency: "usd", destination: accountId });
    check("Stripe refused the transfer", false, "IT WENT THROUGH — that should not happen");
  } catch (e) {
    check("Stripe refuses a transfer to an unfinished account", true,
      (e instanceof Error ? e.message : String(e)).slice(0, 80));
  }

  console.log(`\n${failed === 0 ? "ALL GREEN" : "SOMETHING FAILED"} — ${passed} passed, ${failed} failed`);
  console.log("\nNot covered: a completed account. Stripe will not let the platform accept");
  console.log("its terms on someone's behalf, so that step needs a real person.");
}

async function cleanup() {
  try {
    if (accountId) await stripe.accounts.del(accountId).catch(() => {});
    if (companyId) {
      await admin.from("voucher_profiles").delete().eq("company_id", companyId);
      await admin.from("companies").delete().eq("id", companyId);
    }
    for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
    const left = (await admin.from("companies").select("id").like("slug", "connect-test-%")).data ?? [];
    console.log(`\ncleanup: ${left.length} test companies left, ${users.length} logins removed, account deleted\n`);
  } catch (e) {
    console.error("cleanup problem:", e instanceof Error ? e.message : e);
  }
}

try { await main(); } finally { await cleanup(); }
process.exit(failed === 0 ? 0 : 1);
