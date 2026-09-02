/**
 * stripe-9c.mts — a voucher setting up how they get paid, after they've
 * earned something rather than before.
 *
 * The point of Step 9c is that nobody does tax paperwork for money they may
 * never earn. So the things worth proving here are: that a voucher cannot
 * open their own payout gates; that Stripe's answer is read correctly in both
 * directions; and that money held only because we were waiting on those
 * details actually starts moving once they arrive.
 *
 * WHAT IS REAL AND WHAT IS NOT, honestly:
 *   - account creation and its idempotency are REAL calls to Stripe test mode.
 *   - the state mapping is tested with hand-built account objects. There is no
 *     way to drive a person through Stripe's hosted onboarding from a script,
 *     so an Express account made here stays restricted forever. The mapping is
 *     our logic, not Stripe's, and hand-built objects test our logic exactly —
 *     including the restricted case, which a happy-path script would never
 *     reach.
 *   - the payout hold and release are REAL rows going through the real
 *     database functions.
 *
 *   npm run test:9c
 */

import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import StripeLib from "stripe";
import {
  getOrCreateConnectAccount,
  handleAccountUpdated,
  payoutReadiness,
  recordAccountState,
} from "@/lib/stripe/connect";

const KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

let passed = 0, failed = 0;
const check = (l: string, ok: boolean, d = "") => { ok ? passed++ : failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${d ? ` — ${d}` : ""}`); };

if (!KEY) { console.log("No STRIPE_SECRET_KEY — nothing to test."); process.exit(0); }
if (!KEY.startsWith("sk_test_")) { console.error("REFUSING TO RUN: not a test key."); process.exit(1); }

const stripe = new StripeLib(KEY);
const stamp = Date.now();
const password = `payout-test-${stamp}`;
const users: string[] = [];
let companyId = "";
let voucherId = "";
let accountId = "";

async function mkUser(tag: string, role: string, name: string) {
  const email = `${tag}.${stamp}@payouttest.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(error.message);
  users.push(data.user!.id);
  await admin.from("users").insert({ id: data.user!.id, role, full_name: name, email });
  return { id: data.user!.id, email };
}

/**
 * A Stripe account as it looks at each stage. Only the fields our code reads.
 * Cast rather than built in full: a real Account has ~60 fields and none of
 * the others change the answer.
 */
function account(stage: "started" | "tax_outstanding" | "complete" | "restricted"): Stripe.Account {
  const base = { id: accountId, object: "account", metadata: { vouch_voucher_id: voucherId } };
  switch (stage) {
    // Made an account, typed nothing in.
    case "started":
      return { ...base, details_submitted: false, payouts_enabled: false,
        requirements: { currently_due: ["individual.id_number", "external_account"], past_due: [] } } as unknown as Stripe.Account;
    // Filled most of it in; Stripe still wants the tax number.
    case "tax_outstanding":
      return { ...base, details_submitted: true, payouts_enabled: false,
        requirements: { currently_due: ["individual.id_number"], past_due: [] } } as unknown as Stripe.Account;
    // Done. Stripe will pay them.
    case "complete":
      return { ...base, details_submitted: true, payouts_enabled: true,
        requirements: { currently_due: [], past_due: [] } } as unknown as Stripe.Account;
    // Was fine, now isn't: a document expired and Stripe shut payouts off.
    case "restricted":
      return { ...base, details_submitted: true, payouts_enabled: false,
        requirements: { currently_due: [], past_due: ["individual.verification.document"] } } as unknown as Stripe.Account;
  }
}

const gates = async () => (await admin
  .from("voucher_profiles")
  .select("identity_verified_at, tax_info_collected_at, payout_account_id")
  .eq("user_id", voucherId).single()).data!;

async function main() {
  const boss = await mkUser("boss", "employer", "Payout Boss");
  const voucher = await mkUser("voucher", "voucher", "Payout Voucher");
  const seeker = await mkUser("seeker", "seeker", "Payout Seeker");
  voucherId = voucher.id;
  await admin.from("seeker_profiles").insert({ user_id: seeker.id, headline: "Test" });

  const { data: co } = await admin.from("companies").insert({
    name: `Payout Test Co ${stamp}`, slug: `payout-test-${stamp}`,
    business_registration_verified_at: new Date().toISOString(),
  }).select("id").single();
  companyId = co!.id;
  await admin.from("company_members").insert({ company_id: companyId, user_id: boss.id, member_role: "owner" });

  // Verified to vouch, but with NO payout details — which is the whole point:
  // this is what every voucher looks like until they earn something.
  await admin.from("voucher_profiles").insert({
    user_id: voucherId, company_id: companyId, status: "verified", verification_method: "employer_invite",
    verified_at: new Date().toISOString(), employer_permission_confirmed_at: new Date().toISOString(),
  });

  // --- 1. a voucher cannot open their own gates ----------------------------
  //
  // Signed in as the actual person with the publishable key. Testing this as
  // postgres or with the secret key proves nothing: the guard deliberately
  // trusts both.
  console.log("\n1. The voucher tries to verify themselves");
  const asVoucher = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { error: signInErr } = await asVoucher.auth.signInWithPassword({ email: voucher.email, password });
  check("signed in as the voucher, not as an admin", !signInErr, signInErr?.message ?? "");

  const attack = await asVoucher.from("voucher_profiles").update({
    identity_verified_at: new Date().toISOString(),
    tax_info_collected_at: new Date().toISOString(),
  }).eq("user_id", voucherId);
  check("refused", !!attack.error, attack.error?.message?.slice(0, 70) ?? "IT WENT THROUGH");

  const afterAttack = await gates();
  check("identity gate still shut", afterAttack.identity_verified_at === null);
  check("tax gate still shut", afterAttack.tax_info_collected_at === null);

  const attackAccount = await asVoucher.from("voucher_profiles")
    .update({ payout_account_id: "acct_attacker" }).eq("user_id", voucherId);
  check("cannot point their payout at another Stripe account", !!attackAccount.error);

  // --- 2. making the Stripe account (real calls) ---------------------------
  console.log("\n2. Creating the Stripe account");
  accountId = await getOrCreateConnectAccount(voucherId);
  check("an Express account was made", accountId.startsWith("acct_"), accountId);
  check("recorded against the voucher", (await gates()).payout_account_id === accountId);

  const again = await getOrCreateConnectAccount(voucherId);
  check("asking twice does not make a second account", again === accountId);

  const live = await stripe.accounts.retrieve(accountId);
  check("tagged with the voucher, so a webhook knows whose it is",
    live.metadata?.vouch_voucher_id === voucherId);
  check("it can be paid but cannot take payments from anyone",
    live.capabilities?.transfers !== undefined && live.capabilities?.card_payments === undefined);

  // --- 3. reading Stripe's answer ------------------------------------------
  console.log("\n3. What each stage of onboarding means");
  await recordAccountState(account("started"));
  let g = await gates();
  check("started but empty: neither gate opens", g.identity_verified_at === null && g.tax_info_collected_at === null);

  await recordAccountState(account("tax_outstanding"));
  g = await gates();
  check("details in but tax number missing: tax gate stays shut", g.tax_info_collected_at === null);
  check("...and so does identity, because Stripe has not enabled payouts", g.identity_verified_at === null);

  await recordAccountState(account("complete"));
  g = await gates();
  check("finished: identity gate opens", g.identity_verified_at !== null);
  check("finished: tax gate opens", g.tax_info_collected_at !== null);
  check("payoutReadiness agrees", (await payoutReadiness(voucherId)).ready);

  // --- 4. safe to run twice ------------------------------------------------
  console.log("\n4. Stripe sends the same update again");
  const before = await gates();
  await recordAccountState(account("complete"));
  await recordAccountState(account("complete"));
  const after = await gates();
  check("the verification date does not creep forward",
    after.identity_verified_at === before.identity_verified_at, `${before.identity_verified_at} -> ${after.identity_verified_at}`);
  check("nor does the tax date", after.tax_info_collected_at === before.tax_info_collected_at);

  // --- 5. it works in both directions --------------------------------------
  console.log("\n5. Stripe restricts the account later");
  await recordAccountState(account("restricted"));
  g = await gates();
  check("the identity gate shuts again", g.identity_verified_at === null,
    "an account Stripe has stopped trusting must not be paid into");
  check("payoutReadiness says not ready", !(await payoutReadiness(voucherId)).ready);

  await recordAccountState(account("complete"));
  check("and opens again when they fix it", (await gates()).identity_verified_at !== null);

  // --- 6. the money actually moves -----------------------------------------
  console.log("\n6. A payout held for these details, once they arrive");

  // Close the gates again so the payout is created in the state a real
  // deferred-onboarding voucher would be in.
  await admin.from("voucher_profiles")
    .update({ identity_verified_at: null, tax_info_collected_at: null }).eq("user_id", voucherId);

  const { data: job } = await admin.from("jobs").insert({
    company_id: companyId, posted_by: boss.id, title: "Barista", description: "Work.",
    pay_type: "hourly", status: "open", posted_at: new Date().toISOString(),
  }).select("id").single();
  const { data: req } = await admin.from("intro_requests").insert({ job_id: job!.id, seeker_id: seeker.id }).select("id").single();
  await admin.from("vouches").insert({
    intro_request_id: req!.id, voucher_id: voucherId, relationship: "knows_personally",
    body: "I worked alongside them for two years and would again. ".repeat(4),
  });
  const { data: app } = await admin.from("applications").select("id").eq("job_id", job!.id).single();
  const { data: hire } = await admin.from("hires").insert({
    application_id: app!.id,
    start_date: new Date(Date.now() - 61 * 864e5).toISOString().slice(0, 10),
    confirmed_by_employer_at: new Date().toISOString(),
  }).select("id").single();
  await admin.from("hires").update({ confirmed_by_seeker_at: new Date().toISOString() }).eq("id", hire!.id);

  // The employer's fee is settled, so that is not what is holding this up.
  await admin.from("employer_charges")
    .update({ status: "paid", paid_at: new Date().toISOString() }).eq("hire_id", hire!.id);

  await admin.rpc("release_due_payouts");
  let payout = (await admin.from("payouts").select("status, hold_reason, amount_cents").eq("hire_id", hire!.id).single()).data!;
  check("the payout is held, not lost", payout.status === "held", payout.hold_reason as string);
  check("and it says why, in words the voucher can read",
    (payout.hold_reason as string ?? "").includes("identity and tax"), payout.hold_reason as string);

  // Now they finish onboarding. This is exactly what the webhook does.
  const outcome = await handleAccountUpdated(account("complete"));
  console.log(`     (handleAccountUpdated: ${outcome})`);

  payout = (await admin.from("payouts").select("status, hold_reason, amount_cents").eq("hire_id", hire!.id).single()).data!;
  check("finishing onboarding puts it back in the queue", payout.status === "scheduled", payout.status as string);
  check("the hold reason is cleared", payout.hold_reason === null);

  await admin.rpc("release_due_payouts");
  payout = (await admin.from("payouts").select("status, hold_reason, amount_cents").eq("hire_id", hire!.id).single()).data!;
  check("and then it releases", payout.status === "released", payout.status as string);
  check("for half the fee, as promised on the vouch form", payout.amount_cents === 25000, String(payout.amount_cents));

  console.log(`\n${failed === 0 ? "ALL GREEN" : "SOMETHING FAILED"} — ${passed} passed, ${failed} failed`);
}

async function cleanup() {
  try {
    if (companyId) {
      // voucher_profiles.company_id is ON DELETE RESTRICT, so it goes first.
      await admin.from("voucher_profiles").delete().eq("company_id", companyId);
      await admin.from("companies").delete().eq("id", companyId);
    }
    for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
    // Connect accounts can be deleted while they are still restricted, which
    // every account this test makes always is.
    if (accountId) await stripe.accounts.del(accountId).catch(() => {});
    console.log(`cleanup: removed ${users.length} test logins and ${accountId ? "1" : "0"} Stripe account\n`);
  } catch (e) {
    console.error("cleanup problem:", e instanceof Error ? e.message : e);
  }
}

try { await main(); } finally { await cleanup(); }
process.exit(failed === 0 ? 0 : 1);
