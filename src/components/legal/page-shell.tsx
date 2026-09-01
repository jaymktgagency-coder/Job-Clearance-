/**
 * legal/page-shell.tsx — shared frame for the terms, privacy and refund pages.
 *
 * Plain English: the four legal pages should look like each other and like the
 * rest of Vouch. This gives them a title, a last-updated line, readable
 * measure, and a way back to the site.
 */

import Link from "next/link";
import { LEGAL } from "@/lib/legal";
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
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Button variant="ghost" size="sm" render={<Link href="/" />}>
        ← Vouch
      </Button>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{intro}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated {LEGAL.lastUpdated}. {LEGAL.entityName}, {LEGAL.address}.
      </p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        Questions about any of this? Email{" "}
        <a className="underline underline-offset-4" href={`mailto:${LEGAL.supportEmail}`}>
          {LEGAL.supportEmail}
        </a>
        .
      </p>
    </main>
  );
}
