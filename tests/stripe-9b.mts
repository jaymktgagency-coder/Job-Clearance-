/**
 * stripe-9b.mts — collecting the fee when both sides confirm a hire.
 *
 * Talks to Stripe in test mode, where no money can move, and builds its own
 * company and people in the database so it never touches your demo data. It
 * removes both again at the end.
 *
 * What it proves is the stuff that would cost real money if it were wrong:
 * that a fee is charged once and only once, for the right amount, against the
 * card actually on file; that a decline is recorded rather than swallowed;
 * and that a voucher's payout stays put until the employer's money arrives.
 *
 *   npm run test:9b
 */

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { collectFeeForHire } from "@/lib/stripe/charges";
import { getOrCreateCustomer } from "@/lib/stripe/payment-methods";

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

async function mkUser(tag: string, role: string, name: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${tag}.${stamp}@feetest.test`, password: `fee-test-${stamp}`, email_confirm: true,
  });
  if (error) throw new Error(error.message);
  users.push(data.user!.id);
  await admin.from("users").insert({ id: data.user!.id, role, full_name: name, email: `${tag}.${stamp}@feetest.test` });
  return data.user!.id;
}

/** Builds a confirmed hire and returns its id and the fee owed. */
async function confirmedHire(boss: string, voucher: string, seeker: string, title: string) {
  const { data: job } = await admin.from("jobs").insert({
    company_id: companyId, posted_by: boss, title, description: "Work.",
    pay_type: "hourly", status: "open", posted_at: new Date().toISOString(),
  }).select("id, fee_amount_cents").single();
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
  return { hireId: hire!.id as string, fee: job!.fee_amount_cents as number };
}

async function main() {
  // Everything below reads columns added by migration 0011. Say so plainly
  // rather than failing eight checks with a confusing message.
  const probe = await admin.from("employer_charges").select("net_amount_cents").limit(1);
  if (probe.error?.message.includes("net_amount_cents")) {
    console.error(
      "\nMigration 0011 is not applied to this database, so there is nothing to test yet.\n" +
      "Apply supabase/migrations/0011_collect_the_fee.sql first.\n",
    );
    process.exit(1);
  }

  const boss = await mkUser("boss", "employer", "Fee Boss");
  const voucher = await mkUser("voucher", "voucher", "Fee Voucher");
  const seekerA = await mkUser("seeka", "seeker", "Seeker A");
  const seekerB = await mkUser("seekb", "seeker", "Seeker B");
  for (const s of [seekerA, seekerB]) await admin.from("seeker_profiles").insert({ user_id: s, headline: "Test" });

  const { data: co } = await admin.from("companies").insert({
    name: `Fee Test Co ${stamp}`, slug: `fee-test-${stamp}`,
    business_registration_verified_at: new Date().toISOString(),
  }).select("id").single();
  companyId = co!.id;
  await admin.from("company_members").insert({ company_id: companyId, user_id: boss, member_role: "owner" });
  await admin.from("voucher_profiles").insert({
    user_id: voucher, company_id: companyId, status: "verified", verification_method: "employer_invite",
    verified_at: new Date().toISOString(), employer_permission_confirmed_at: new Date().toISOString(),
    identity_verified_at: new Date().toISOString(), tax_info_collected_at: new Date().toISOString(),
  });

  // --- 1. no payment method -> the fee is owed, not lost -------------------
  console.log("\n1. A confirmed hire with no payment method on file");
  const a = await confirmedHire(boss, voucher, seekerA, "Barista (pays)");
  let r = await collectFeeForHire(a.hireId);
  check("not collected", r.status === "pending");
  let charge = (await admin.from("employer_charges").select("*").eq("hire_id", a.hireId).single()).data!;
  check("the reason is recorded for the employer to read", (charge.last_error ?? "").includes("No payment method"), charge.last_error as string);
  check("still owed, not written off", charge.status === "pending");
  check("nothing was charged at Stripe", charge.stripe_payment_intent_id === null);

  // --- 2. with a card, the fee is collected --------------------------------
  console.log("\n2. The same hire, once a card is on file");
  const customerId = await getOrCreateCustomer(companyId);
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
  await stripe.paymentMethods.attach(pm.id, { customer: customerId });
  await admin.from("companies").update({
    default_payment_method_id: pm.id, default_payment_method_type: "card",
    default_payment_method_label: "Visa", default_payment_method_last4: "4242",
    payment_method_on_file: true, payment_method_updated_at: new Date().toISOString(),
  }).eq("id", companyId);

  r = await collectFeeForHire(a.hireId);
  check("collected", r.status === "paid", r.detail);
  charge = (await admin.from("employer_charges").select("*").eq("hire_id", a.hireId).single()).data!;
  check("charge marked paid", charge.status === "paid");
  check("timestamped", !!charge.paid_at);
  check("the earlier failure was cleared", charge.last_error === null);

  const intent = await stripe.paymentIntents.retrieve(charge.stripe_payment_intent_id as string);
  check("charged the exact fee, no more", intent.amount === a.fee, `${intent.amount} vs ${a.fee}`);
  check("in dollars", intent.currency === "usd");
  check("confirmed without the employer present, as agreed when they saved the card",
    intent.confirmation_method === "automatic" && intent.status === "succeeded");
  check("against the card actually on file", intent.payment_method === pm.id);
  check("tagged with the hire, so a webhook knows what it is", intent.metadata?.vouch_hire_id === a.hireId);

  // --- 3. never twice ------------------------------------------------------
  console.log("\n3. Running it again (the webhook and the action both call this)");
  const before = intent.id;
  r = await collectFeeForHire(a.hireId);
  charge = (await admin.from("employer_charges").select("stripe_payment_intent_id, status").eq("hire_id", a.hireId).single()).data!;
  check("no second charge", charge.stripe_payment_intent_id === before);
  check("still exactly one payment intent for this hire",
    (await stripe.paymentIntents.list({ customer: customerId, limit: 100 })).data.filter(p => p.metadata?.vouch_hire_id === a.hireId).length === 1);

  // --- 4. the voucher's payout waited for the money ------------------------
  console.log("\n4. The rule: no money out before money in");
  const b = await confirmedHire(boss, voucher, seekerB, "Barista (declines)");
  await admin.rpc("release_due_payouts");
  const payB = (await admin.from("payouts").select("status, hold_reason").eq("hire_id", b.hireId).single()).data!;
  check("unpaid fee holds the voucher's payout", payB.status === "held", payB.hold_reason as string);
  const payA = (await admin.from("payouts").select("status").eq("hire_id", a.hireId).single()).data!;
  check("the paid one released", payA.status === "released", payA.status as string);

  // --- 5. a declined card is recorded, not swallowed -----------------------
  console.log("\n5. When the card is declined");
  // tok_chargeCustomerFail attaches to a customer happily and then fails when
  // charged — which is the real-world case: a card that was fine when saved
  // and declines weeks later when the fee falls due. tok_chargeDeclined is
  // refused at attach time and never reaches a charge at all.
  const bad = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_chargeCustomerFail" } });
  await stripe.paymentMethods.attach(bad.id, { customer: customerId });
  await admin.from("companies").update({ default_payment_method_id: bad.id }).eq("id", companyId);

  r = await collectFeeForHire(b.hireId);
  check("not collected", r.status === "pending", r.detail);
  const chargeB = (await admin.from("employer_charges").select("*").eq("hire_id", b.hireId).single()).data!;
  check("still owed", chargeB.status === "pending");
  check("Stripe's own reason is stored for the employer", !!chargeB.last_error, (chargeB.last_error as string ?? "").slice(0, 60));
  check("the attempt was counted", (chargeB.attempt_count as number) >= 1, String(chargeB.attempt_count));
  const payB2 = (await admin.from("payouts").select("status").eq("hire_id", b.hireId).single()).data!;
  check("the voucher is still not paid", payB2.status !== "released" && payB2.status !== "paid", payB2.status as string);

  console.log(`\n${failed === 0 ? "ALL GREEN" : "SOMETHING FAILED"} — ${passed} passed, ${failed} failed`);
}

async function cleanup() {
  try {
    if (companyId) {
      // voucher_profiles.company_id is ON DELETE RESTRICT, so it goes first.
      await admin.from("voucher_profiles").delete().eq("company_id", companyId);
      const { data: c } = await admin.from("companies").select("stripe_customer_id").eq("id", companyId).maybeSingle();
      if (c?.stripe_customer_id) await stripe.customers.del(c.stripe_customer_id as string).catch(() => {});
      await admin.from("companies").delete().eq("id", companyId);
    }
    for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
    const left = (await admin.from("companies").select("id").like("slug", "fee-test-%")).data ?? [];
    // Charges cascade with their company. If any survive, something is
    // cancelling the cascade — which is exactly what a BEFORE DELETE trigger
    // returning NEW does, and it orphans money rows silently.
    const orphans = (await admin.from("employer_charges").select("id").eq("company_id", companyId)).data ?? [];
    console.log(`cleanup: ${left.length} test companies left, ${orphans.length} orphaned charges, ${users.length} test logins removed\n`);
    if (orphans.length > 0) {
      console.error("PROBLEM: charge rows survived their company being deleted.");
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("cleanup problem:", e instanceof Error ? e.message : e);
  }
}

try { await main(); } finally { await cleanup(); }
process.exit(failed === 0 ? 0 : 1);
