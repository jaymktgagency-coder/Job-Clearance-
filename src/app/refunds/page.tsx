/**
 * /refunds — what happens to the money when a hire doesn't work out.
 *
 * Stripe requires a clear refund policy for a marketplace. This is also the
 * page an employer will actually read before posting their first role, so it
 * says plainly that there is no cash refund, rather than burying it.
 */

import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage } from "@/components/legal/page-shell";

export const metadata: Metadata = { title: "Refund and Credit Policy — Vouch" };

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund and credit policy"
      intro="What you pay, when you pay it, and what happens if the hire doesn't last."
    >
      <h2>Job seekers pay nothing</h2>
      <p>
        There is nothing to refund because there is nothing to pay. Vouch is
        free for job seekers, permanently.
      </p>

      <h2>Employers: you pay only on a hire</h2>
      <p>
        There is no subscription, no listing fee, and no charge for browsing.
        A single success fee becomes payable when someone you found through
        Vouch is hired:
      </p>
      <ul>
        <li>Hourly and service roles: $500.</li>
        <li>Salaried and professional roles: $2,000.</li>
      </ul>
      <p>
        The fee for a role is fixed the moment you post it. If we change our
        pricing later, roles you have already posted keep the price you posted
        them at.
      </p>

      <h2>When the fee becomes due</h2>
      <p>
        Only when both you and the person hired confirm the hire. Your word
        alone does not trigger a charge, and neither does theirs. If the two of
        you disagree, nothing is charged until a person here has settled it.
      </p>

      <h2>If the hire leaves within 30 days</h2>
      <p>
        You receive a credit for <strong className="text-foreground">50% of the fee</strong>, applied
        automatically to your next hire through Vouch.
      </p>
      <p>
        <strong className="text-foreground">This is a credit, not a cash refund.</strong> We do not
        return money to your card or bank account. The reason is straightforward:
        by the time someone leaves, the introduction has already been made and
        the person who made it has already done the work. A credit keeps you
        whole on your next hire without asking them to give back an
        introduction they cannot unmake.
      </p>
      <ul>
        <li>Credits are applied automatically to your next confirmed hire, oldest first.</li>
        <li>A credit larger than your next fee carries the balance forward.</li>
        <li>Credits expire 12 months after they are issued.</li>
        <li>Credits have no cash value and cannot be transferred to another company.</li>
      </ul>

      <h2>If the hire leaves after 30 days</h2>
      <p>
        The fee stands and no credit is issued. Thirty days is the window we
        think is fair for judging whether an introduction was a good one.
      </p>

      <h2>The voucher&apos;s share</h2>
      <p>
        The employee who vouched receives 50% of the fee, released 60 days after
        the start date — not at the point of hire. If the person leaves before
        day 60, the voucher receives nothing, whatever the reason and whoever is
        at fault.
      </p>
      <p>
        That delay is deliberate and it is the main thing keeping vouches
        honest: vouching for someone who does not last costs the voucher the
        money and their public track record.
      </p>

      <h2>Disputes</h2>
      <p>
        If you believe you were charged in error — the hire did not happen, the
        person was already in your pipeline, or the amount is wrong — email{" "}
        {LEGAL.supportEmail} within 60 days of the charge with the role and the
        candidate. We will look at it and reply within five working days. Where
        we got it wrong, we will refund in cash.
      </p>
      <p>
        Please come to us before raising a chargeback with your bank. A
        chargeback takes the money back from us after we may already have paid
        the voucher their share, and it does not get you an answer any faster.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can close a role, or your whole account, at any time and at no cost.
        Doing so does not cancel a fee already due for a hire both sides have
        confirmed.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.entityName}, {LEGAL.address}. Email {LEGAL.supportEmail} — a
        person reads it.
      </p>
    </LegalPage>
  );
}
