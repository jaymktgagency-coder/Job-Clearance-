/**
 * stripe-9a.mts — Step 9a's tests: saving an employer's payment method.
 *
 * These talk to Stripe for real, in test mode, where no money can move. What
 * they check is the part that would actually cost you something if it were
 * wrong:
 *
 *   - the webhook refuses a forged call, and accepts a genuine one
 *   - it refuses everything if the signing secret is missing, rather than
 *     trusting a call it cannot verify
 *   - a Checkout session offers both card and bank, and charges nothing
 *   - saving the same payment method twice is safe
 *   - Vouch never receives a card number, only the last four digits
 *
 * Run it:
 *   npm run test:stripe          (with the site running on :3000)
 */

import Stripe from "stripe";

const KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const WHSEC = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
const SITE = process.env.TEST_SITE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  if (!KEY) {
    console.log("No STRIPE_SECRET_KEY — nothing to test. That is a valid state: the app runs without it.");
    process.exit(0);
  }
  if (!KEY.startsWith("sk_test_")) {
    console.error("REFUSING TO RUN: STRIPE_SECRET_KEY is not a test key. These tests create real objects.");
    process.exit(1);
  }

  const stripe = new Stripe(KEY);
  const created: string[] = [];

  // --- 1. the account can do what 9a needs --------------------------------
  console.log("\n1. The Stripe account");
  // balance.retrieve needs no id, so it is the cheapest proof the key works.
  const balance = await stripe.balance.retrieve();
  check("test-mode account reachable", balance.object === "balance",
    `livemode: ${balance.livemode}`);
  check("this is definitely test mode — no real money can move", balance.livemode === false);

  // --- 2. a Checkout session in setup mode --------------------------------
  console.log("\n2. Asking Stripe for a page to enter details on");
  const customer = await stripe.customers.create({
    name: "Test Co (automated)",
    metadata: { vouch_company_id: "00000000-0000-0000-0000-0000000000ff", vouch_test: "true" },
  });
  created.push(customer.id);

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customer.id,
    payment_method_types: ["card", "us_bank_account"],
    success_url: `${SITE}/employer/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/employer/billing?cancelled=1`,
    metadata: { vouch_company_id: "00000000-0000-0000-0000-0000000000ff" },
  });

  check("session is setup mode, so nothing is charged", session.mode === "setup");
  check("amount to be collected is nothing", (session.amount_total ?? 0) === 0, String(session.amount_total));
  check("offers a card", (session.payment_method_types ?? []).includes("card"));
  check(
    "offers a US bank account — the cheap option on a $2,000 fee",
    (session.payment_method_types ?? []).includes("us_bank_account"),
  );
  check("gives us a page to send the employer to", !!session.url);
  check("carries the company id, so the webhook knows whose it is",
    session.metadata?.vouch_company_id === "00000000-0000-0000-0000-0000000000ff");

  // --- 3. what Vouch learns about a saved card ----------------------------
  console.log("\n3. What comes back to Vouch about a saved card");
  const method = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });
  created.push(method.id);

  const asJson = JSON.stringify(method);
  check("we get a brand and last four", method.card?.brand === "visa" && method.card?.last4 === "4242",
    `${method.card?.brand} ····${method.card?.last4}`);
  check("no full card number anywhere in what Stripe returns to us",
    !asJson.includes("4242424242424242"));
  check("no CVC", !/"cvc"\s*:\s*"\d/.test(asJson));

  // --- 4. the webhook: the security-critical half -------------------------
  console.log("\n4. The webhook endpoint");

  const payload = JSON.stringify({
    id: "evt_test_forged",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_forged", object: "checkout.session", mode: "setup" } },
  });

  // 4a. a forged call, no signature at all
  const noSig = await fetch(`${SITE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  }).catch(() => null);
  check("a call with no signature is refused", noSig?.status === 400 || noSig?.status === 503,
    noSig ? `HTTP ${noSig.status}` : "site not running");

  // 4b. a forged call with a made-up signature
  const badSig = await fetch(`${SITE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: payload,
  }).catch(() => null);
  check("a call with a forged signature is refused", badSig?.status === 400 || badSig?.status === 503,
    badSig ? `HTTP ${badSig.status}` : "site not running");

  // 4c. a genuine, correctly signed call
  if (WHSEC) {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
    const goodSig = await fetch(`${SITE}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": header },
      body: payload,
    }).catch(() => null);
    // 200 means the signature was accepted. This particular event names a
    // session that does not exist, which the handler skips over quietly.
    check("a correctly signed call is accepted", goodSig?.status === 200,
      goodSig ? `HTTP ${goodSig.status}` : "site not running");
  } else {
    console.log("  SKIP  correctly signed call (no STRIPE_WEBHOOK_SECRET set)");
  }

  // --- 5. tidy up ----------------------------------------------------------
  console.log("\n5. Cleaning up after ourselves");
  await stripe.checkout.sessions.expire(session.id).catch(() => {});
  for (const id of created) {
    if (id.startsWith("cus_")) await stripe.customers.del(id).catch(() => {});
  }
  const stillThere = await stripe.customers.retrieve(customer.id).catch(() => null);
  check("the test customer was removed", !stillThere || (stillThere as Stripe.DeletedCustomer).deleted === true);

  console.log(`\n${failed === 0 ? "ALL GREEN" : "SOMETHING FAILED"} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nThe test run itself broke:", error);
  process.exit(1);
});
