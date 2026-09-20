/**
 * /api/cron/nightly — the one thing in Vouch that happens without anybody
 * pressing a button.
 *
 * Plain English: several rules in this product are about time passing rather
 * than about somebody doing something. A payout becomes due 60 days after a
 * start date. A hire report nobody answers within 7 days becomes a dispute.
 * None of those moments has a person attached to it, so until now none of
 * them happened at all: the date passed and no code noticed.
 *
 * Vercel calls this address once a day (see vercel.json) and this file runs
 * the four sweeps below.
 *
 * WHAT THIS DOES NOT DO: PAY ANYBODY
 * This job decides who is OWED money and who is held and why. It does not
 * send a penny. Releasing says "this is owed and approved"; paying says "the
 * money has gone", and the second stays a deliberate act by a person. A bug
 * in a nightly job that only writes a status is a wrong row that can be
 * fixed; a bug in one that moves money is money in a stranger's account.
 *
 * The database backs this up rather than trusting this file: `payouts` has no
 * UPDATE policy for any login at all, and guard_payout_release refuses to let
 * a payout be marked PAID without identity, tax details and a payout account
 * Stripe has actually enabled.
 *
 * WHY THIS ADDRESS NEEDS A PASSWORD
 * It is a URL on the public internet that changes money rows. Without a
 * shared secret anybody who guessed the path could run the sweeps whenever
 * they liked — which, with the dispute timers, is a way to push someone
 * else's argument forward on demand. So: no CRON_SECRET, no service at all.
 * This is the same posture as the Stripe webhook, and for the same reason.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

// Never prerendered, never cached: it must actually run each time.
export const dynamic = "force-dynamic";

/**
 * Compares two secrets without leaking, through how long it takes, how much
 * of the guess was right.
 *
 * `timingSafeEqual` throws if the two buffers are different lengths, which
 * would itself be a length oracle, so the lengths are checked first and a
 * mismatch simply fails.
 */
function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The sweeps, in the order they should run.
 *
 * Disputes before payouts, deliberately: opening a dispute is one of the
 * things that HOLDS a payout, and running it first means a report that went
 * unanswered today is already a dispute by the time the payout sweep looks at
 * it. The other way round, that payout would release tonight and the dispute
 * would open a second later against money already approved.
 */
const SWEEPS = [
  {
    fn: "open_stale_hire_disputes",
    says: "hire reports nobody answered in time, now disputes",
  },
  {
    fn: "open_stale_separation_disputes",
    says: "departure reports nobody answered in time, now disputes",
  },
  {
    fn: "release_due_payouts",
    says: "payouts past their 60 days, now released or held with a reason",
  },
  {
    fn: "expire_stale_outreach",
    says: "voucher approaches that went stale, now expired",
  },
] as const;

export async function GET(request: Request) {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (!expected) {
    // Refusing beats running. Without the secret this address cannot tell
    // Vercel's nightly call from anyone else's, and the sweeps it runs decide
    // who is owed money and whose argument has escalated.
    console.error("[cron] CRON_SECRET is missing — refusing to run the nightly sweeps.");
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
  // once CRON_SECRET is set on the project. Nothing has to be configured on
  // the cron entry itself.
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !secretMatches(given, expected)) {
    // 404 rather than 401: an unauthenticated caller learns nothing about
    // whether this address exists.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = await createAdminClient();

  const ran: Record<string, number> = {};
  const failed: Record<string, string> = {};

  for (const sweep of SWEEPS) {
    // Each sweep is independent, so one failing must not stop the rest. A
    // payout sweep skipped because an unrelated outreach sweep threw would
    // mean somebody not being paid for a reason that has nothing to do with
    // them.
    const { data, error } = await supabase.rpc(sweep.fn);
    if (error) {
      // Supabase errors are plain objects, not Error instances.
      const message = error && "message" in error ? String(error.message) : String(error);
      console.error(`[cron] ${sweep.fn} failed: ${message}`);
      failed[sweep.fn] = message;
      continue;
    }
    ran[sweep.fn] = typeof data === "number" ? data : 0;
  }

  const anyFailed = Object.keys(failed).length > 0;
  if (anyFailed) {
    // A 500 is what makes a broken night visible in Vercel's log rather than
    // a green tick over a job that did nothing. Whatever did succeed is still
    // reported, because those rows really were written.
    return NextResponse.json({ ok: false, ran, failed }, { status: 500 });
  }

  // Printed so a night's work is readable in the Vercel log without opening
  // the database.
  console.log(
    `[cron] ${SWEEPS.map((s) => `${s.fn}=${ran[s.fn] ?? 0}`).join(" ")}`,
  );

  return NextResponse.json({ ok: true, ran });
}
