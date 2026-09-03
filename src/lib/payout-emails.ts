/**
 * payout-emails.ts — telling a voucher, by email, that they have money coming.
 *
 * Plain English: a voucher is asked for tax and identity details only once a
 * vouch has turned into a real hire and there is money with their name on it.
 * That is deliberate — nobody should do paperwork for money they may never
 * earn. But it only works if they FIND OUT on the day the clock starts, not
 * on the day the money is due.
 *
 * Before this file, the only places that told them were the dashboard and
 * /payouts, and both of those need the voucher to log in. A voucher who
 * doesn't log in first heard about it when the money was already held — which
 * is exactly the delay that deferring the paperwork was meant to avoid.
 *
 * WHAT THIS SENDS
 *   - one "you earned this" email per payout, ever, at the moment both sides
 *     confirm the hire. That is the moment the 60-day clock starts.
 *   - (9d, the scheduled job) reminders as the release date nears, and only
 *     to vouchers who still have not finished their setup.
 *
 * THE RULE THAT MATTERS MOST HERE
 * `voucher_notified_at` is stamped ONLY when the email was really delivered.
 * With no RESEND_API_KEY, sendEmail() writes the message to the log and
 * reports `delivered: false` — and if we stamped on that, every voucher
 * confirmed before Resend was switched on would be marked "told" and never
 * actually told. A silent cohort nobody would notice until someone complained
 * about money they never heard about.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { payoutReadiness } from "@/lib/stripe/connect";

/** Where the voucher is sent to finish their setup. */
function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3000";
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

const longDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
    : "a date we haven't set yet";

/**
 * How long this payout is actually held, in days.
 *
 * Read off the payout's own dates rather than the `payout_hold_days` setting.
 * The setting is what NEW hires get; these two dates are the terms frozen onto
 * THIS hire. If the setting is ever changed, an email about an existing payout
 * must still describe the deal that payout was made under.
 */
function holdDays(startDate: string | null, releaseAt: string | null): number | null {
  if (!startDate || !releaseAt) return null;
  const ms = new Date(releaseAt).getTime() - new Date(startDate).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86_400_000);
}

export type NoticeFacts = {
  name: string | null;
  amountCents: number;
  releaseAt: string | null;
  startDate: string | null;
  jobTitle: string | null;
  companyName: string | null;
};

/**
 * The initial email, in the two versions it comes in.
 *
 * `ready` is the difference between a request and a receipt. A voucher who
 * already did their setup on an earlier hire is not asked to do it again —
 * they are told the amount and the date and left alone. Asking someone to
 * "complete your setup" when their setup is complete is how an email stops
 * being read.
 */
export function initialEmail(facts: NoticeFacts, ready: boolean): { subject: string; text: string } {
  const hello = facts.name ? `Hi ${facts.name.split(" ")[0]},` : "Hi,";
  const amount = money(facts.amountCents);
  // Named if we can name it. If both the title and the company are missing
  // the sentence closes early rather than trailing off into a vague clause.
  const named =
    facts.jobTitle && facts.companyName
      ? `${facts.jobTitle} at ${facts.companyName}`
      : facts.jobTitle ?? facts.companyName ?? null;
  const hired = named ? `was hired: ${named}` : "was hired";
  // Both dates are always present on a confirmed hire, so this is belt and
  // braces. It still has to read like a sentence if it ever fires, rather
  // than "released the agreed hold after their start date, which is a date
  // we haven't set yet".
  const days = holdDays(facts.startDate, facts.releaseAt);
  const timing =
    facts.releaseAt && days
      ? `The money is released ${days} days after their start date, which is ${longDate(facts.releaseAt)}.`
      : facts.releaseAt
        ? `The money is released on ${longDate(facts.releaseAt)}.`
        : "We'll confirm the exact release date shortly.";

  if (ready) {
    return {
      subject: `You've earned ${amount} — nothing to do`,
      text: `${hello}

Someone you vouched for ${hired}. Both sides have confirmed it, so your ${amount} is booked.

You have already set up how you get paid, so there is nothing for you to do. ${timing}

That wait is not us being slow — it is the whole reason an employer can trust a vouch. If the person leaves before then, the payout does not go ahead.

You can see it any time here:
${siteUrl()}/payouts

Thanks for vouching.
— Vouch`,
    };
  }

  return {
    subject: `You've earned ${amount} — set up how you get paid`,
    text: `${hello}

Someone you vouched for ${hired}. Both sides have confirmed it, so your ${amount} is booked.

Before we can send it we need two things Stripe and the tax rules both require: proof of who you are, and your tax details. You type those into a page hosted by Stripe — they never pass through Vouch, and we never see a Social Security number or a bank account number.

Set it up here, it takes a few minutes:
${siteUrl()}/payouts

There is no rush today. ${timing} We are telling you now so you have the full run-up rather than finding out on the day — if the details are missing when the date arrives, the money waits until they are there.

We did not ask for any of this when you wrote the vouch, on purpose. Most vouches never become a hire, and nobody should file tax details for money they may never earn. This one earned it.

— Vouch`,
  };
}

/**
 * Tells the voucher about the payout for one confirmed hire.
 *
 * Returns a line for the log. Never throws: this runs inside after(), behind
 * the seeker's confirmation, and a bounced email must never be able to undo
 * the fact that a hire was confirmed.
 *
 * Safe to run twice — a payout already stamped is left alone.
 */
export async function notifyVoucherOfPayout(hireId: string): Promise<string> {
  try {
    const admin = await createAdminClient();

    const { data, error } = await admin
      .from("payouts")
      .select(
        `id, voucher_id, amount_cents, release_at, voucher_notified_at,
         users:voucher_id(email, full_name),
         hires(start_date, jobs(title), companies(name))`,
      )
      .eq("hire_id", hireId)
      .maybeSingle();

    if (error) return `could not look up the payout: ${error.message}`;
    // No payout row means the hire is not confirmed yet. Nothing to tell.
    if (!data) return `no payout for hire ${hireId} yet`;
    if (data.voucher_notified_at) return `voucher already told about payout ${data.id}`;

    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;

    const user = one(data.users as unknown as { email: string; full_name: string | null });
    const hire = one(
      data.hires as unknown as {
        start_date: string | null;
        jobs: { title: string } | { title: string }[] | null;
        companies: { name: string } | { name: string }[] | null;
      },
    );

    if (!user?.email) return `payout ${data.id} has no email to send to`;

    const { ready } = await payoutReadiness(data.voucher_id as string);

    const { subject, text } = initialEmail(
      {
        name: user.full_name,
        amountCents: data.amount_cents as number,
        releaseAt: data.release_at as string | null,
        startDate: hire?.start_date ?? null,
        jobTitle: one(hire?.jobs ?? null)?.title ?? null,
        companyName: one(hire?.companies ?? null)?.name ?? null,
      },
      ready,
    );

    const result = await sendEmail({ to: user.email, subject, text });

    // Only a real delivery counts. A console-only send stays unstamped so it
    // is picked up once Resend is switched on. See the note at the top.
    if (!result.delivered) {
      return `payout ${data.id}: not stamped — ${result.reason}`;
    }

    // Send first, stamp second, deliberately: the alternative (claim the row,
    // then send) would mark a voucher told when the send failed. The `is null`
    // guard keeps a replay from moving the date it already carries.
    const { error: stampErr } = await admin
      .from("payouts")
      .update({ voucher_notified_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("voucher_notified_at", null);

    if (stampErr) return `emailed, but could not record it: ${stampErr.message}`;
    return `payout ${data.id}: voucher emailed (${ready ? "already set up" : "asked to set up"})`;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return `could not tell the voucher about hire ${hireId}: ${detail}`;
  }
}
