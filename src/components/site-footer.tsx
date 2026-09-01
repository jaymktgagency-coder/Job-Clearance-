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
    <footer className="mt-auto border-t">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
        <p>
          {LEGAL.serviceName} — free for job seekers, always.
        </p>
        <nav className="flex flex-wrap gap-4">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
