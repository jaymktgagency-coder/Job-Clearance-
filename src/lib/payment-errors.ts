/**
 * payment-errors.ts — the last thing between Stripe's wording and a customer's
 * screen.
 *
 * Plain English: `payouts.last_error` and `employer_charges.last_error` hold
 * the reason the last attempt failed, and both rows are readable by the person
 * they belong to. Most of what lands there SHOULD be read by them — "that card
 * was declined, try another" is the most useful sentence on a billing page.
 * But some of it is about Vouch's own configuration, and a voucher was shown
 * "Unregistered API key" in a red box on their earnings page: a sentence about
 * our Stripe settings, phrased as though it were about them.
 *
 * `stripeFailure()` in lib/stripe/client.ts now decides this at the moment of
 * writing, by the error's CLASS, which is the reliable way to do it. This file
 * is the second line of defence, and it exists for one specific reason:
 *
 *   ROWS WRITTEN BEFORE THAT FIX STILL HOLD THE RAW TEXT.
 *
 * There is no migration that can sensibly rewrite free text, and the founder
 * cannot be asked to go and clear columns by hand. So the read side also
 * refuses to print anything that smells of our own plumbing. Once the old rows
 * have been overwritten by a fresh attempt this is belt and braces — which is
 * a fine thing for it to be.
 *
 * NO IMPORTS, DELIBERATELY. ChargeList.tsx is a client component; pulling
 * lib/stripe/client.ts in here would drag the Stripe SDK into the browser
 * bundle along with everything it reads from `process.env`.
 */

/** What a customer is told when the failure was ours. Says no more than that. */
export const GENERIC_PAYMENT_FAILURE =
  "Something on Vouch's side stopped this going through. No money moved, " +
  "and we've been told — you don't need to do anything.";

/**
 * Wording that means the problem is OUR configuration, not the reader's money.
 *
 * Every one of these is a phrase that cannot occur in a message about somebody
 * else's card or bank account. Kept deliberately narrow: a false positive here
 * replaces a useful decline reason with a shrug, which is its own bug. That is
 * why it matches "no such account" and "stripe account" but not the bare word
 * "account" — "adding a different card or a bank account will fix it" is a
 * message a customer must keep.
 */
const OUR_PLUMBING = [
  /api[ _-]?key/i,
  /unregistered/i,
  /unauthori[sz]ed|unauthenticated|authentication/i,
  /\bpermission\b|not permitted/i,
  /not enabled|not activated|not registered/i,
  /no such (account|destination|customer|transfer)/i,
  /\bacct_[A-Za-z0-9]/,
  /\bsk_(test|live)_/,
  /stripe account|platform account|connect/i,
  /invalid request|invalid parameter|parameter_invalid/i,
  /internal server error|something went wrong on stripe/i,
  // Our own older wording for an authentication failure. It names no key, but
  // it IS a sentence about our configuration — and its "nothing was charged"
  // is plainly wrong on a voucher's payout, where the money was going TO them.
  // Caught by the test that pins this list.
  /on our side|our end|payment settings/i,
];

/** True when this text is about Vouch's plumbing rather than the reader. */
export function isOurPlumbing(message: string): boolean {
  return OUR_PLUMBING.some((pattern) => pattern.test(message));
}

/**
 * The version of a stored failure that is safe to show a seeker, voucher or
 * employer. Returns null when there is nothing to show at all.
 *
 * Admin screens do NOT call this — /admin/payouts is allowed the raw text,
 * because diagnosing exactly this is the job that screen exists to do.
 */
export function customerSafeError(stored: string | null | undefined): string | null {
  const message = stored?.trim();
  if (!message) return null;
  return isOurPlumbing(message) ? GENERIC_PAYMENT_FAILURE : message;
}
