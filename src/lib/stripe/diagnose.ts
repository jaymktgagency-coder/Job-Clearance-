/**
 * stripe/diagnose.ts — answering "is this the right Stripe account?" on screen.
 *
 * Plain English: a Stripe secret key can be perfectly valid and still be the
 * wrong key. A voucher's payout account (`acct_...`) is created under ONE
 * Stripe platform account. Point the app at a different Stripe account — a new
 * one, a colleague's, live keys instead of test — and every stored `acct_...`
 * becomes an id that platform has never heard of. Transfers then fail with a
 * message about keys and registration, which reads like "the key is broken"
 * when the key is fine and the PAIRING is broken.
 *
 * Nothing in the database records which Stripe account an `acct_...` came
 * from, so that mismatch was previously invisible. This file makes it visible
 * by asking Stripe, at the moment somebody is looking at the admin screen.
 *
 * WHY IT ASKS TWICE, v1 AND v2
 * Those two views of the same account disagree, and which one fails tells you
 * which thing is wrong:
 *
 *   v1 ok, v2 fails   -> the account is ours, but the v2 Accounts API is not
 *                        enabled for this key. Transfers follow v2, so this
 *                        still breaks paying.
 *   both "no such"    -> the account belongs to a DIFFERENT Stripe platform.
 *                        This is the mismatch.
 *   both "permission" -> Connect is not enabled on this account.
 *
 * NOTHING HERE THROWS. It is a diagnostic panel; if it cannot reach Stripe it
 * says so and the rest of the page still renders. An admin screen that goes
 * blank because Stripe is down is worse than no panel.
 */

import { stripeBriefly, stripeFailure, stripeIsConfigured, stripeIsTestMode } from "./client";

/** One thing we asked, and what came back. */
export type Check = {
  ok: boolean;
  /** Plain-English result, safe to put on screen. */
  detail: string;
};

/** What Stripe says about one voucher's payout account. */
export type AccountCheck = {
  accountId: string;
  /** Whose account it is, for the row label. */
  who: string;
  v1: Check;
  v2: Check;
  /** The conclusion, in a sentence an admin can act on. */
  verdict: string;
};

export type StripeDiagnosis = {
  configured: boolean;
  /** Which kind of key is set, read from its prefix. */
  keyMode: "test" | "live" | "none";
  /** The Stripe account the key belongs to, if it could be read. */
  platformAccountId: string | null;
  /** Whether the key itself works at all. */
  key: Check;
  accounts: AccountCheck[];
  /** True when at least one account is not recognised by this key. */
  anyMismatch: boolean;
};

/** At most this many accounts are checked, to bound a page render. */
const MAX_ACCOUNTS = 6;

/**
 * How long any one diagnostic call may take.
 *
 * Every call here is inside a try/catch AND on a short fuse, because this
 * panel renders on page load. An admin screen that hangs — or goes blank —
 * because Stripe is slow is worse than no panel at all.
 */
const TIMEOUT_MS = 5000;

/** Was this a "no such account" rather than some other refusal? */
function looksLikeUnknownAccount(detail: string): boolean {
  return /no such|does not exist|not found|unrecognized|unregistered/i.test(detail);
}

async function checkV1(accountId: string): Promise<Check> {
  try {
    const account = await stripeBriefly(TIMEOUT_MS).accounts.retrieve(accountId);
    return { ok: true, detail: `Stripe knows this account (${account.id}).` };
  } catch (err) {
    return { ok: false, detail: stripeFailure(err).detail };
  }
}

async function checkV2(accountId: string): Promise<Check> {
  try {
    await stripeBriefly(TIMEOUT_MS).v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient"],
    });
    return { ok: true, detail: "Readable through the v2 API, which is what a transfer follows." };
  } catch (err) {
    return { ok: false, detail: stripeFailure(err).detail };
  }
}

/** The sentence an admin should read first. */
function verdictFor(v1: Check, v2: Check): string {
  if (v1.ok && v2.ok) return "Fine — this account belongs to the current key.";
  if (v1.ok && !v2.ok) {
    return "This account IS ours, but the v2 Accounts API refused it. Transfers follow v2, so paying will still fail. Likely: the v2 Accounts API is not enabled for this Stripe account.";
  }
  if (looksLikeUnknownAccount(v1.detail)) {
    return "MISMATCH — the current key's Stripe account has never heard of this account. It was created under a different Stripe account. The voucher has to set up payouts again under the current one.";
  }
  return "Stripe refused to read this account. If it says permission, Connect is probably not enabled on this Stripe account.";
}

/**
 * Asks Stripe who we are and whether it recognises these payout accounts.
 *
 * `accounts` is a list of [accountId, who] pairs — the `who` is only used to
 * label the row on screen.
 */
export async function diagnoseStripe(
  accounts: [string, string][],
): Promise<StripeDiagnosis> {
  const keyMode = stripeIsConfigured() ? (stripeIsTestMode() ? "test" : "live") : "none";

  if (!stripeIsConfigured()) {
    return {
      configured: false,
      keyMode: "none",
      platformAccountId: null,
      key: { ok: false, detail: "No STRIPE_SECRET_KEY is set on this deployment." },
      accounts: [],
      anyMismatch: false,
    };
  }

  // Who does this key belong to? `retrieveCurrent` needs no id — it returns
  // the account the key itself is for, which is the whole question here.
  let platformAccountId: string | null = null;
  let key: Check;
  try {
    const me = await stripeBriefly(TIMEOUT_MS).accounts.retrieveCurrent();
    platformAccountId = me.id;
    key = { ok: true, detail: `The key works and belongs to ${me.id}.` };
  } catch (err) {
    const failure = stripeFailure(err);
    key = { ok: false, detail: failure.detail };
  }

  // De-duplicated: several payouts often share one voucher.
  const seen = new Set<string>();
  const unique = accounts.filter(([id]) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // All at once, not one after another: six accounts checked in sequence
  // against an unresponsive Stripe would be six timeouts end to end.
  const checked: AccountCheck[] = await Promise.all(
    unique.slice(0, MAX_ACCOUNTS).map(async ([accountId, who]) => {
      const [v1, v2] = await Promise.all([checkV1(accountId), checkV2(accountId)]);
      return { accountId, who, v1, v2, verdict: verdictFor(v1, v2) };
    }),
  );

  return {
    configured: true,
    keyMode,
    platformAccountId,
    key,
    accounts: checked,
    anyMismatch: checked.some((a) => !a.v1.ok || !a.v2.ok),
  };
}
