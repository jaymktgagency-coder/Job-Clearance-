/**
 * /privacy — what Vouch holds about you, who can see it, and how to get rid of it.
 *
 * Written against what the database actually stores and what the row-level
 * security rules actually allow, rather than as a generic template.
 */

import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";
import { LegalPage } from "@/components/legal/page-shell";

export const metadata: Metadata = { title: "Privacy Policy — Vouch" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What we hold about you, who can see it, and how to make us delete it."
    >
      <h2>The short version</h2>
      <ul>
        <li>Your resume is private. Three groups of people can open it, listed below, and nobody else.</li>
        <li>We never sell your data, and we never share it for advertising.</li>
        <li>You can delete your account and everything attached to it yourself, in one click, at any time.</li>
        <li>We do not scrape LinkedIn, Indeed, or any job board. Everything we hold, someone gave us.</li>
      </ul>

      <h2>What we collect</h2>
      <p><strong className="text-foreground">Everyone:</strong> your name, email address, and which of the three roles you signed up as.</p>
      <p>
        <strong className="text-foreground">Job seekers:</strong> your headline, location, a short bio, years of
        experience, skills, the roles you want, your resume file, and the
        structured information our AI reads out of that resume. Also the intro
        requests you send and their outcomes.
      </p>
      <p>
        <strong className="text-foreground">Vouchers:</strong> where you work, your job title, your work email
        address if you verified that way, and the vouches you write. To pay you
        we also need identity and tax details — those are collected and held by
        Stripe, not by us. We never see your bank details or your tax number.
      </p>
      <p>
        <strong className="text-foreground">Employers:</strong> your company details, your roles, and your
        hiring decisions. Payment card and bank details go to Stripe; we hold
        only the fact that a payment method exists.
      </p>
      <p>
        We do not ask for, infer, or record your age, sex, gender, race,
        ethnicity, nationality, immigration status, religion, disability,
        health, or family status. Our AI is explicitly instructed not to record
        or weigh any of it, and there is no field in our database where it could
        be stored.
      </p>

      <h2>Who can see your resume</h2>
      <p>Resume files are stored privately. Only these people can open yours:</p>
      <ul>
        <li>You.</li>
        <li>
          A verified employee at a company where you have asked for an
          introduction — and only for as long as that request is live.
        </li>
        <li>An employer who has received a vouch for you, for one of their own roles.</li>
      </ul>
      <p>
        Nobody else — not other job seekers, not employees at other companies,
        not employers you have not been vouched to. This is enforced by the
        database itself on every single request, not by remembering to filter.
      </p>

      <h2>What we use it for</h2>
      <ul>
        <li>Running the service: showing your profile to the people above, and nobody else.</li>
        <li>
          Reading your resume with AI, into structured information you can see on
          your own profile, and suggesting how well you fit a role you have asked
          for an introduction to. That suggestion is advisory, is always shown
          with its written reasoning, and never rejects anyone.
        </li>
        <li>Sending you the emails the service needs to send, like a verification code.</li>
        <li>Detecting abuse, such as vouching rings or accounts generating fees rather than genuine referrals.</li>
        <li>Meeting our legal obligations, including tax reporting on money we pay out.</li>
      </ul>
      <p>We do not use your data to train AI models.</p>

      <h2>Who we share it with</h2>
      <p>Four service providers, each for one job:</p>
      <ul>
        <li><strong className="text-foreground">Supabase</strong> — stores the database and resume files.</li>
        <li><strong className="text-foreground">Anthropic</strong> — reads resumes and writes fit scores. Content sent for this purpose is not used to train their models.</li>
        <li><strong className="text-foreground">Stripe</strong> — handles all payments, and holds identity and tax details for vouchers.</li>
        <li><strong className="text-foreground">Resend</strong> — sends transactional email.</li>
        <li><strong className="text-foreground">Vercel</strong> — hosts the site.</li>
      </ul>
      <p>
        We also share what we must if the law requires it. We never sell your
        data and we never share it for advertising.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your account data for as long as your account exists. When you delete
        your account, your profile, resume file, requests, and vouches are
        erased immediately. We keep the minimum record of completed payments
        that tax and accounting law requires, which does not include your
        resume.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Go to your profile and use &quot;Delete my account&quot;. It removes your login,
        your profile, your resume file, and everything attached to them, and it
        cannot be undone. You do not have to email anyone or wait for us.
      </p>
      <p>
        You can also delete just what our AI read from your resume, at any time,
        without deleting the resume or your account.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to see the data we
        hold about you, correct it, have it deleted, object to how we use it, or
        take it elsewhere. Most of these you can do yourself from your profile.
        For anything else, email {LEGAL.privacyEmail} and we will respond within
        30 days.
      </p>
      <p>
        We do not sell personal information, and we do not share it in ways that
        would count as &quot;sharing&quot; for cross-context behavioural advertising under
        California law. There is nothing to opt out of.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest. Access rules are enforced by
        the database on every request rather than by application code, which
        means a bug in one screen cannot expose another person&apos;s data. Resume
        files are served through short-lived links that expire in minutes.
      </p>

      <h2>Children</h2>
      <p>Vouch is for people 18 and over. We do not knowingly collect data about anyone younger.</p>

      <h2>Changes and contact</h2>
      <p>
        If we change this policy in a way that matters, we will tell you before
        it takes effect. Questions, or a request about your data:{" "}
        {LEGAL.privacyEmail}. {LEGAL.entityName}, {LEGAL.address}.
      </p>
    </LegalPage>
  );
}
