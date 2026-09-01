/**
 * /terms — the deal between Vouch and the three kinds of people who use it.
 *
 * Written to describe what this product actually does, clause by clause,
 * rather than to be as broad as possible. Where the software enforces a rule,
 * the rule is stated here in the same words.
 */

import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage } from "@/components/legal/page-shell";

export const metadata: Metadata = { title: "Terms of Service — Vouch" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`The agreement between you and ${LEGAL.entityName}, which runs ${LEGAL.serviceName}.`}
    >
      <h2>1. What Vouch is</h2>
      <p>
        Vouch connects job seekers with current employees at companies that are
        hiring. An employee who is willing to vouch for a candidate writes an
        endorsement, and only candidates carrying one are shown to the employer.
        If the employer hires that candidate, the employer pays Vouch a success
        fee and the employee who vouched receives a share of it.
      </p>
      <p>
        Vouch is not an employer, an employment agency of record, or a party to
        any employment relationship. We do not guarantee that anyone will be
        hired, that any role is real, or that any statement made by a user is
        accurate.
      </p>

      <h2>2. Who may use it</h2>
      <ul>
        <li>You must be 18 or older and legally able to enter a contract.</li>
        <li>
          One account per person, with accurate details. Accounts are personal
          and may not be shared, sold, or transferred.
        </li>
        <li>
          You may not use Vouch if we have previously closed your account.
        </li>
      </ul>

      <h2>3. Job seekers are never charged</h2>
      <p>
        Vouch is free for job seekers, permanently and without exception. We
        will never charge you to create a profile, upload a resume, browse
        roles, request an introduction, or be hired. If anyone asks a job seeker
        for money in connection with Vouch, it is not us — tell us at{" "}
        {LEGAL.supportEmail}.
      </p>

      <h2>4. Vouchers</h2>
      <p>
        A voucher is a current employee of the company they vouch for. Before
        you can be verified as a voucher you must confirm that your employer
        permits you to take part. It is your responsibility to know your own
        employer&apos;s policy on referral payments, and to comply with it.
      </p>
      <ul>
        <li>
          You may only vouch for roles at the company where you actually work.
        </li>
        <li>
          Every vouch must be written by you, must state whether you know the
          candidate personally or have only read their profile, and must be
          honest. Both of those facts are shown to the employer, along with the
          amount you stand to earn.
        </li>
        <li>
          You may hold up to five open vouches at a time. This is a deliberate
          limit, not a technical one.
        </li>
        <li>
          You may not vouch for yourself, for an account you control, or as part
          of an arrangement to generate fees rather than genuine referrals.
        </li>
        <li>
          You are an independent party, not an employee or contractor of Vouch.
          You are responsible for your own taxes on anything you earn. Where the
          law requires it, we will report amounts paid to you to the relevant
          tax authority, and we will need your identity and tax details before
          we can pay you anything.
        </li>
      </ul>

      <h2>5. Employers</h2>
      <ul>
        <li>
          You may only post roles you are authorised to hire for, at the company
          you are registered against.
        </li>
        <li>
          The success fee for a role is fixed at the moment you post it. Later
          changes to our pricing never alter a role you have already posted.
        </li>
        <li>
          You must tell us when someone you found through Vouch is hired, and
          when they leave. Deliberately concealing a hire to avoid the fee, or
          reporting a departure that did not happen, is a breach of these terms.
        </li>
        <li>
          Hiring decisions are entirely yours. Vouch does not screen, endorse,
          or reject candidates, and nothing on the platform rejects anyone
          automatically.
        </li>
      </ul>

      <h2>6. The fee, and when money moves</h2>
      <ul>
        <li>
          A fee becomes payable only when a hire is confirmed by both the
          employer and the person hired. One side saying so is not enough.
        </li>
        <li>
          The voucher&apos;s share is released 60 days after the start date, not at
          the point of hire. If the person leaves before day 60, the voucher is
          paid nothing, whatever the reason.
        </li>
        <li>
          A job is only treated as ended when both sides agree it ended, or when
          we decide the matter after one side raises a dispute.
        </li>
        <li>
          Payments are processed by Stripe. Using Vouch to pay or be paid means
          also accepting Stripe&apos;s terms, and vouchers must complete Stripe&apos;s
          identity checks before receiving anything.
        </li>
      </ul>
      <p>
        Refunds and credits are covered separately on our{" "}
        <a className="underline underline-offset-4" href="/refunds">refund policy</a> page,
        which forms part of these terms.
      </p>

      <h2>7. How AI is used</h2>
      <p>
        Vouch uses AI to read uploaded resumes into structured information, and
        to suggest how well a candidate fits a role. Both are advisory. A score
        is never shown without its written reasoning, it never rejects anyone,
        and every decision about a candidate is made by a person. Job seekers
        are told this on their own profile and can see exactly what our AI read
        from their resume.
      </p>

      <h2>8. What you may not do</h2>
      <ul>
        <li>
          Scrape, copy, or import candidate data from LinkedIn, Indeed, or any
          other job board or network into Vouch. We do not do this and neither
          may you.
        </li>
        <li>
          Contact anyone you meet through Vouch for a purpose unrelated to the
          role in question.
        </li>
        <li>
          Misrepresent who you are, who you work for, or your relationship to a
          candidate.
        </li>
        <li>
          Attempt to access data belonging to anyone else, or to interfere with
          how the service works.
        </li>
      </ul>

      <h2>9. Your content</h2>
      <p>
        You keep ownership of everything you put on Vouch — your profile, your
        resume, the vouches you write. You give us permission to store and show
        it to the specific people the product is designed to show it to, and to
        no one else. Vouches you write are shown to the employer concerned and
        contribute to your public track record on Vouch.
      </p>

      <h2>10. Ending it</h2>
      <p>
        You may close your account at any time, from your own settings. Doing so
        deletes your data, including your resume file. Money already owed for a
        confirmed hire is settled according to these terms; closing your account
        does not cancel a fee that is already due, and does not accelerate a
        payout that has not yet released.
      </p>
      <p>
        We may suspend or close an account that breaches these terms. Where we
        can, we will tell you why.
      </p>

      <h2>11. No warranty, and the limit of what we owe you</h2>
      <p>
        Vouch is provided as it is. We do not warrant that it will be
        uninterrupted, error-free, or that any role, candidate, or vouch is
        accurate. To the extent the law allows, our total liability to you for
        anything arising out of Vouch is limited to the fees you paid us in the
        twelve months before the claim, or one hundred dollars, whichever is
        greater. We are not liable for lost profits or indirect losses.
      </p>
      <p>
        Nothing here limits liability that cannot lawfully be limited, including
        for fraud.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may change these terms. If a change materially affects you, we will
        tell you before it takes effect. Continuing to use Vouch after that
        means you accept the change. The fee terms of a role or hire already
        agreed are never changed retrospectively.
      </p>

      <h2>13. Law</h2>
      <p>
        These terms are governed by the laws of {LEGAL.jurisdiction}, and the
        courts there have jurisdiction over any dispute.
      </p>

      <h2>14. Contact</h2>
      <p>
        {LEGAL.entityName}, {LEGAL.address}. Email {LEGAL.supportEmail}.
      </p>
    </LegalPage>
  );
}
