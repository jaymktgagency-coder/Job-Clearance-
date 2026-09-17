/**
 * / — the front door.
 *
 * Plain English: the one page that has to do a job of persuasion rather than
 * a job of work. A visitor arrives knowing nothing and has to leave
 * understanding three things: what a vouch is, that it costs a job seeker
 * nothing, and that an employer pays only when someone is actually hired.
 *
 * A note on money. There are no dollar figures anywhere on this page, and
 * that is deliberate rather than an oversight. Every price in Vouch lives in
 * the `platform_settings` table so that changing it never means editing code
 * — but that table is readable only by logged-in users, and this page is
 * public. Reading it here would mean either a new database policy or using
 * the admin key on a marketing page, and typing "$2,000" in by hand would
 * leave a stale number on the most-read page on the site the first time
 * pricing moves.
 *
 * So this page sells the SHAPE of the deal, which never changes: seekers pay
 * nothing, employers pay only on a real hire, the voucher takes half, and it
 * is held until the job has actually stuck. The exact figures appear once an
 * employer is signed in and the page can read them properly.
 */

import Link from "next/link";
import {
  BanIcon,
  BrainIcon,
  HandCoinsIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { VouchChain } from "@/components/vouch-chain";

/**
 * The three sides of the marketplace.
 *
 * Laid out as a stack of wide rows rather than a row of matching cards. Three
 * identical boxes would imply these are three versions of the same thing, and
 * they are not — a seeker pays nothing, a voucher earns, an employer spends.
 * Each row gets its own headline, its own verdict line, and room to breathe.
 */
const SIDES = [
  {
    who: "If you are looking",
    headline: "Getting hired increasingly means knowing someone inside.",
    body: "Vouch gets you vouched for even when you know nobody there. You are told, plainly, that an AI reads your resume — and shown exactly what it took from it.",
    verdict: "Free. Not free-for-now: free.",
    cta: { href: "/signup", label: "Find a voucher" },
  },
  {
    who: "If you already work somewhere",
    headline: "You know who would do well in your team.",
    body: "Review requests for roles at your own company and write an honest vouch. Every vouch says whether you actually know the person or only read their profile, and what you stand to earn from it.",
    verdict: "Half the fee, once the hire has lasted.",
    cta: { href: "/signup", label: "Become a voucher" },
  },
  {
    who: "If you are hiring",
    headline: "A short list of people someone put their name on.",
    body: "Not three hundred cold resumes. Every candidate arrives carrying a vouch from somebody who already works at the company, and you never see anyone who does not.",
    verdict: "You pay only when you actually hire.",
    cta: { href: "/signup", label: "Post a role" },
  },
] as const;

/**
 * The promises. These are the product's non-negotiable rules, and they are
 * the most persuasive thing on the page — every one of them is something a
 * competitor could do and does.
 */
const PROMISES = [
  {
    icon: HandCoinsIcon,
    title: "A job seeker is never charged",
    body: "Not for applying, not for a vouch, not for a better position in a list. There is no seeker-side product and there never will be.",
  },
  {
    icon: BanIcon,
    title: "Nothing is scraped",
    body: "No imported profiles, no harvested job boards, nobody added without asking. Every person here signed up.",
  },
  {
    icon: BrainIcon,
    title: "The AI cannot reject you",
    body: "It reads resumes and suggests a fit score, and it is advisory — it is not allowed to decide anything, and it cannot record a score without writing down its reasoning.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Vouchers are verified, and cannot verify themselves",
    body: "A voucher confirms they work where they say, and confirms their employer permits it. Nobody marks their own homework.",
  },
] as const;

export default function HomePage() {
  return (
    <main>
      {/* ---- Hero ---------------------------------------------------------
          No label above the headline. A small word sitting over a large one
          adds nothing the headline does not already carry. */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28">
        <h1 className="max-w-3xl text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.05] font-semibold">
          Warm introductions beat cold applications.
        </h1>

        <p className="measure mt-6 text-lg text-muted-foreground sm:text-xl">
          Vouch connects job seekers to real employees inside the companies
          they want to work for. Employers only ever see candidates a human has
          personally endorsed.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button size="xl" render={<Link href="/signup" />}>
            Get started
          </Button>
          <Button size="xl" variant="outline" render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>

        {/* The diagram sits on its own raised panel rather than floating in
            the margin. At desktop width the hero text only fills the left
            half, and a panel spanning the full column gives the page
            something to stand on instead of trailing off into blank paper. */}
        <div className="mt-16 rounded-lg bg-card p-8 shadow-raised sm:mt-20 sm:p-14">
          <VouchChain />
        </div>
      </section>

      {/* ---- The problem, stated once, in the largest type on the page ---- */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
          <p className="max-w-4xl font-heading text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.2] font-semibold tracking-[-0.025em] text-balance">
            A cold application goes into a pile of three hundred.{" "}
            <span className="text-brand-700">
              A vouched one is read by a person who already trusts the name on
              it.
            </span>
          </p>
          <p className="measure mt-8 text-lg text-muted-foreground">
            That difference has always existed. It has just never been
            available to people who do not already know someone. That is the
            entire product.
          </p>
        </div>
      </section>

      {/* ---- The three sides ---------------------------------------------- */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Three sides, one honest deal.
        </h2>

        <div className="mt-12 space-y-px overflow-hidden rounded-lg shadow-raised">
          {SIDES.map((side) => (
            <div
              key={side.who}
              className="grid gap-6 bg-card p-7 sm:p-9 md:grid-cols-[1fr_auto] md:items-center md:gap-10"
            >
              <div>
                <p className="text-sm font-semibold text-brand-700">
                  {side.who}
                </p>
                <h3 className="mt-2 font-heading text-xl font-semibold text-balance sm:text-2xl">
                  {side.headline}
                </h3>
                <p className="measure mt-3 text-muted-foreground">
                  {side.body}
                </p>
                <p className="mt-4 font-semibold">{side.verdict}</p>
              </div>

              <Button
                variant="outline"
                className="justify-self-start md:justify-self-end"
                render={<Link href={side.cta.href} />}
              >
                {side.cta.label}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ---- The money, as a shape rather than a number -------------------- */}
      <section className="border-y border-border bg-sunken">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Nobody pays until somebody is hired.
          </h2>
          <p className="measure mt-4 text-lg text-muted-foreground">
            The fee for a role is fixed the moment it is posted, so later
            pricing changes never rewrite a deal that already exists.
          </p>

          <dl className="mt-12 grid gap-px overflow-hidden rounded-lg shadow-raised sm:grid-cols-3">
            <div className="bg-card p-7">
              <dt className="font-heading text-lg font-semibold">
                Both sides confirm
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                A fee is owed only when the employer and the person hired both
                say it happened. One side cannot decide it alone.
              </dd>
            </div>
            <div className="bg-card p-7">
              <dt className="font-heading text-lg font-semibold">
                The voucher takes half
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Split evenly between Vouch and the person who put their name
                on the candidate.
              </dd>
            </div>
            <div className="bg-card p-7">
              <dt className="font-heading text-lg font-semibold">
                Held for 60 days
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Counted from the start date, not the offer. Leave before then
                and the voucher is paid nothing — which is exactly why a vouch
                is worth something.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---- The promises -------------------------------------------------- */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Things we have decided not to do.
        </h2>
        <p className="measure mt-4 text-lg text-muted-foreground">
          Each of these is enforced by the database itself, not by a policy
          document, so no future change can quietly drop one.
        </p>

        <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-800">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-heading text-base font-semibold">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Last ask ------------------------------------------------------ */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 text-center sm:py-24">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold text-balance sm:text-4xl">
            Someone you have not met yet would vouch for you.
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button size="xl" render={<Link href="/signup" />}>
              Create an account
            </Button>
            <Button size="xl" variant="ghost" render={<Link href="/login" />}>
              I already have one
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
