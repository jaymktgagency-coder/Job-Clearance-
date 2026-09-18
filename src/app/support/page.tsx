/**
 * /support — how to reach a person, and what Vouch actually is.
 *
 * Stripe's review of a marketplace looks for a real support contact and a
 * plain description of the business. This is that page, and it is also the
 * page a confused user will land on, so it answers the questions they will
 * actually have.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { LEGAL, legalDetailsIncomplete } from "@/lib/legal";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Support — Vouch" };

const FAQ = [
  {
    q: "What does Vouch do?",
    a: "We connect job seekers with current employees at companies that are hiring. An employee who is willing to vouch for someone writes an endorsement, and employers only see candidates carrying one. If the employer hires that person, the employer pays a success fee and the employee who vouched receives half of it.",
  },
  {
    q: "What does it cost?",
    a: "Job seekers pay nothing, ever. Employers pay only when they actually hire someone: $500 for hourly and service roles, $2,000 for salaried and professional roles. There is no subscription and no listing fee.",
  },
  {
    q: "When does a voucher get paid?",
    a: "60 days after the hire's start date, not at the point of hire. If the person leaves before day 60, the voucher is paid nothing. That delay is what keeps vouches honest.",
  },
  {
    q: "The hire didn't work out. Do I get my money back?",
    a: "If they left within 30 days you get a credit for half the fee toward your next hire. It is a credit, not a cash refund — the refund policy explains why.",
  },
  {
    q: "How is AI used?",
    a: "To read resumes into structured information, and to suggest how well a candidate fits a role. The suggestion is advisory: it is always shown with its written reasoning, it never rejects anyone, and a person makes every decision. Job seekers can see exactly what our AI read from their resume.",
  },
  {
    q: "How do I delete my account and my data?",
    a: "From your profile page, using 'Delete my account'. It removes your login, your profile, your resume file, and everything attached to them, immediately. You don't need to ask us.",
  },
  {
    q: "Something looks wrong with a charge or a payout.",
    a: `Email ${LEGAL.supportEmail} with the role and the person involved. We answer within five working days. Please come to us before raising a chargeback — it is faster and it doesn't take money back from the voucher.`,
  },
];

export default function SupportPage() {
  const incomplete = legalDetailsIncomplete();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <Button variant="ghost" className="px-3" render={<Link href="/" />}>
        <ArrowLeftIcon aria-hidden="true" />
        Vouch
      </Button>
      <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Support</h1>
      <p className="measure mt-3 text-lg text-muted-foreground">
        A person reads this inbox. Tell us what happened and we&apos;ll come back to
        you within five working days — sooner if money is involved.
      </p>

      {/* This banner removes itself as soon as src/lib/legal.ts is filled in.
          It is here because a site with placeholder company details is not
          ready to take a payment, and that is easy to forget. */}
      {incomplete ? (
        <FormError className="mt-6">
          <strong className="font-semibold">Not ready to take payments.</strong>{" "}
          The company name, address, and support email on this site are still
          placeholders. Fill them in at{" "}
          <code className="font-mono">src/lib/legal.ts</code> before applying to
          Stripe — placeholder details are a common reason marketplace
          applications are sent back.
        </FormError>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Get in touch</CardTitle>
          <CardDescription>
            Email is the only channel, and it is a real one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-semibold">General and billing</p>
            <a
              className="font-medium text-brand-700 underline underline-offset-[0.2em] hover:text-brand-900"
              href={`mailto:${LEGAL.supportEmail}`}
            >
              {LEGAL.supportEmail}
            </a>
          </div>
          <div>
            <p className="font-semibold">Privacy and data requests</p>
            <a
              className="font-medium text-brand-700 underline underline-offset-[0.2em] hover:text-brand-900"
              href={`mailto:${LEGAL.privacyEmail}`}
            >
              {LEGAL.privacyEmail}
            </a>
          </div>
          <address className="rounded-lg bg-sunken p-4 text-muted-foreground not-italic">
            {LEGAL.entityName}
            <br />
            {LEGAL.address}
          </address>
          <p className="measure text-muted-foreground">
            Including the role title and the other person&apos;s name gets you a
            useful answer first time.
          </p>
        </CardContent>
      </Card>

      <h2 className="mt-14 text-2xl font-semibold sm:text-3xl">
        Common questions
      </h2>
      {/* A definition list rather than a stack of cards: these are questions
          and their answers, and nesting each pair in its own box makes a page
          you scroll instead of one you read. */}
      <dl className="mt-6 divide-y divide-border overflow-hidden rounded-lg bg-card shadow-raised">
        {FAQ.map((item) => (
          <div key={item.q} className="p-5 sm:p-6">
            <dt className="font-heading text-base font-semibold">{item.q}</dt>
            <dd className="measure mt-2 text-sm text-muted-foreground">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
        <Button variant="outline" render={<Link href="/terms" />}>
          Terms of Service
        </Button>
        <Button variant="outline" render={<Link href="/privacy" />}>
          Privacy Policy
        </Button>
        <Button variant="outline" render={<Link href="/refunds" />}>
          Refund policy
        </Button>
      </div>
    </main>
  );
}
