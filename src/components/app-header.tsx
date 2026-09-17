/**
 * app-header.tsx — the bar across the top of every signed-in screen.
 *
 * Plain English: there was no header anywhere in the product. Each screen
 * hand-rolled its own set of links back to wherever it thought you came from,
 * which meant the way around changed depending on where you were standing.
 * One bar, the same on every page, with the links that actually apply to your
 * role.
 *
 * It takes the profile as a prop rather than looking it up itself. Every page
 * that renders this has already fetched the profile to decide whether to let
 * you in at all, so looking it up again would be a second database round trip
 * on every page for information already sitting in memory.
 */

import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABEL, type Profile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Where each role actually spends its time. */
const NAV: Record<Profile["role"], { href: string; label: string }[]> = {
  seeker: [
    { href: "/jobs", label: "Roles" },
    { href: "/requests", label: "My requests" },
    { href: "/profile", label: "Profile" },
  ],
  voucher: [
    { href: "/inbox", label: "Inbox" },
    { href: "/voucher/payouts", label: "Earnings" },
    { href: "/profile", label: "Profile" },
  ],
  employer: [
    { href: "/employer/jobs", label: "Roles" },
    { href: "/employer/billing", label: "Billing" },
    { href: "/profile", label: "Profile" },
  ],
};

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
        <Link
          href="/dashboard"
          className="font-heading text-lg font-semibold tracking-[-0.03em] transition-colors duration-[160ms] ease-out hover:text-brand-700"
        >
          Vouch
        </Link>

        <Badge variant="soft" className="hidden sm:inline-flex">
          {ROLE_LABEL[profile.role]}
        </Badge>

        {/* Scrolls sideways on a narrow screen rather than wrapping onto a
            second line and pushing the page down. */}
        <nav className="-mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2">
          {NAV[profile.role].map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              render={<Link href={item.href} />}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
