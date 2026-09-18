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
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Where each role actually spends its time. */
const NAV: Record<Profile["role"], { href: string; label: string }[]> = {
  seeker: [
    { href: "/jobs", label: "Roles" },
    { href: "/requests", label: "My requests" },
    { href: "/profile", label: "Profile" },
  ],
  voucher: [
    { href: "/inbox", label: "Inbox" },
    // The other direction of the marketplace: people who named your employer
    // and can be written to first.
    { href: "/voucher/seekers", label: "Find people" },
    { href: "/voucher/payouts", label: "Earnings" },
    // Not /profile: that is the seeker's page, and it used to bounce a
    // voucher straight back to their dashboard.
    { href: "/voucher/profile", label: "Profile" },
  ],
  employer: [
    { href: "/employer/jobs", label: "Roles" },
    { href: "/employer/billing", label: "Billing" },
    { href: "/employer/company", label: "Company" },
  ],
};

/** Where each role's own profile page lives. One list, so it cannot drift. */
const PROFILE_HREF: Record<Profile["role"], string> = {
  seeker: "/profile",
  voucher: "/voucher/profile",
  employer: "/employer/company",
};

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
        <Link
          href="/dashboard"
          className="font-heading inline-flex min-h-11 items-center text-lg font-semibold tracking-[-0.03em] transition-colors duration-[160ms] ease-out hover:text-brand-700"
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
            /* Full 44px height, with the horizontal padding pulled in so
               three of them still fit across a phone. */
            <Button
              key={item.href}
              variant="ghost"
              className="px-3"
              render={<Link href={item.href} />}
            >
              {item.label}
            </Button>
          ))}
        </nav>

        {/* Their own picture, linking to wherever their profile lives. Small
            and last, because it is a way back to yourself rather than
            something anybody comes to this bar looking for. */}
        <Link
          href={PROFILE_HREF[profile.role]}
          className="shrink-0 rounded-full transition-opacity duration-[160ms] ease-out hover:opacity-80"
          aria-label="Your profile"
        >
          <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
        </Link>

        <form action={signOut}>
          <Button type="submit" variant="ghost" className="px-3">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}

/**
 * The header's own stand-in, for `loading.tsx` files.
 *
 * Every signed-in page renders its own header rather than inheriting one from
 * a layout, so a loading screen that showed only the page body would appear
 * with no bar at the top and then have one drop in. The word "Vouch" is real
 * — it is the same on every screen and does not need fetching — and only the
 * parts that depend on who you are stand in as grey.
 */
export function AppHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
        <span className="font-heading inline-flex min-h-11 items-center text-lg font-semibold tracking-[-0.03em]">
          Vouch
        </span>
        <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        <div className="flex flex-1 items-center gap-1">
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-28" />
          <Skeleton className="hidden h-11 w-20 sm:block" />
        </div>
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-11 w-20" />
      </div>
    </header>
  );
}
