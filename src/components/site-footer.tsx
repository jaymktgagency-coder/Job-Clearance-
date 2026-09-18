/**
 * site-footer.tsx — the footer on every page.
 *
 * Plain English: the terms, privacy, and refund pages have to be reachable
 * from anywhere on the site. Stripe checks for exactly this when reviewing a
 * marketplace, and people looking for a refund policy look at the bottom of
 * the page.
 */

import Link from "next/link";
import { LEGAL } from "@/lib/legal";

const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/support", label: "Support" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <p>{LEGAL.serviceName} — free for job seekers, always.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              /* The text stays the size it looks; the TAP TARGET is padded
                 out to 44px. These measured 20px tall, which is a miss
                 waiting to happen on a tablet. The negative margin keeps the
                 row looking the same as before. */
              className="-mx-1.5 -my-2 inline-flex min-h-11 items-center px-1.5 underline-offset-[0.2em] transition-colors duration-[160ms] ease-out hover:text-brand-700 hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
