/**
 * legal/page-shell.tsx — shared frame for the terms, privacy and refund pages.
 *
 * Plain English: the four legal pages should look like each other and like the
 * rest of Vouch. This gives them a title, a last-updated line, readable
 * measure, and a way back to the site.
 */

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { LEGAL } from "@/lib/legal";
import { InlineLink } from "@/components/inline-link";
import { Button } from "@/components/ui/button";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <Button variant="ghost" className="px-3" render={<Link href="/" />}>
        <ArrowLeftIcon aria-hidden="true" />
        Vouch
      </Button>

      <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="measure mt-3 text-lg text-muted-foreground">{intro}</p>

      {/* Who is behind this page, and when it last changed. Stripe reads these
          by hand when approving a marketplace, and so does anyone deciding
          whether to trust the site with a card. */}
      <p className="mt-5 rounded-lg bg-sunken px-4 py-3 text-sm text-muted-foreground">
        Last updated {LEGAL.lastUpdated}. {LEGAL.entityName}, {LEGAL.address}.
      </p>

      {/* The body of every legal page is styled from here, so all four read
          the same way and none drifts. Sections get more space above than
          below, which is what makes a long document scannable. */}
      <div className="mt-10 space-y-6 text-[0.9375rem] leading-relaxed [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-[0.2em] [&_h2]:mt-10 [&_h2]:mb-1 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>

      <p className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
        Questions about any of this? Email{" "}
        <a
          className="font-medium text-brand-700 underline underline-offset-[0.2em] hover:text-brand-900"
          href={`mailto:${LEGAL.supportEmail}`}
        >
          {LEGAL.supportEmail}
        </a>
        , or read the{" "}
        <InlineLink href="/support">support page</InlineLink>.
      </p>
    </main>
  );
}
