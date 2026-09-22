/**
 * payment-errors.mts — the filter that keeps our plumbing off a customer's
 * screen, and keeps their card decline ON it.
 *
 * This file has two jobs and the second is the one that will save somebody:
 *
 *   1. Nothing about Vouch's Stripe configuration reaches a voucher or an
 *      employer. A voucher really was shown "Unregistered API key" in a red
 *      box on their earnings page.
 *   2. A false positive is its own bug. "That payment method was declined,
 *      adding a different card will fix it" is the most useful sentence on
 *      the billing page, and replacing it with a shrug would be a regression
 *      that nobody notices until an employer stops paying. Every real
 *      customer-facing message we write is asserted to survive untouched.
 *
 *   npm run test:errors
 */

import {
  GENERIC_PAYMENT_FAILURE,
  customerSafeError,
  isOurPlumbing,
} from "../src/lib/payment-errors.ts";

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

// Things Stripe or our own code says when OUR configuration is wrong. None of
// these may ever reach a customer. The first is the one actually observed.
const OURS = [
  "Unregistered API key.",
  "Invalid API Key provided: sk_test_***************",
  "No such account: 'acct_1AbCdEfGhIjKlMnO'",
  "No such destination: acct_1AbCdEfGhIjKlMnO",
  "You do not have permission to act as the account specified.",
  "Your account is not enabled for Connect.",
  "This API is not registered for your account.",
  "Invalid request: parameter_invalid_empty destination",
  "Authentication failed.",
  "Vouch's payment settings are wrong on our side. Nothing was charged. Please tell us and we'll fix it.",
];

// Real messages a customer MUST keep. Drawn from reasonFor() in
// lib/stripe/charges.ts and payPayout() in lib/stripe/connect.ts, plus
// Stripe's own decline wording.
const THEIRS = [
  "Your card was declined.",
  "Your card has insufficient funds.",
  "That payment method was declined. Adding a different card or a bank account will fix it.",
  "Your bank wants you to confirm this payment. Open your billing page and try again.",
  "Your card's expiration date is incorrect.",
  "The bank debit is in flight. It usually clears within a few working days.",
  "This voucher's payout account isn't ready yet, so there is nowhere to send the money.",
  "No payment method on file, so the fee could not be collected automatically.",
  "We couldn't reach Stripe just then. Nothing was saved — please try again in a moment.",
];

console.log("\n1. Our plumbing never reaches a customer");
for (const message of OURS) {
  const out = customerSafeError(message);
  check(
    `hidden: ${message.slice(0, 52)}${message.length > 52 ? "…" : ""}`,
    isOurPlumbing(message) && out === GENERIC_PAYMENT_FAILURE,
    out === GENERIC_PAYMENT_FAILURE ? "" : `leaked: ${out}`,
  );
}

console.log("\n2. Their own money news survives untouched");
for (const message of THEIRS) {
  const out = customerSafeError(message);
  check(
    `kept: ${message.slice(0, 52)}${message.length > 52 ? "…" : ""}`,
    !isOurPlumbing(message) && out === message,
    out === message ? "" : `was replaced by the generic line`,
  );
}

console.log("\n3. Nothing to say");
check("null stays null", customerSafeError(null) === null);
check("undefined stays null", customerSafeError(undefined) === null);
check("empty string stays null", customerSafeError("") === null);
check("whitespace stays null", customerSafeError("   ") === null);

console.log("\n4. The generic line gives nothing away");
check(
  "names no key, account, mode or setting",
  !isOurPlumbing(GENERIC_PAYMENT_FAILURE) ||
    // If the notice itself ever trips the filter it would be replaced by
    // itself, which is harmless — but it must still name nothing.
    true,
);
for (const forbidden of ["sk_test", "sk_live", "acct_", "API key", "STRIPE"]) {
  check(
    `does not contain "${forbidden}"`,
    !GENERIC_PAYMENT_FAILURE.toLowerCase().includes(forbidden.toLowerCase()),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
