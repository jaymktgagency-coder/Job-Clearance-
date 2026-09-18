/**
 * The screen a voucher sees while a seeker's profile is being fetched.
 *
 * Plain English: opening somebody's profile from the inbox used to do nothing
 * visible for a second or two. Next.js waits for a server page to finish
 * before it will navigate, so the browser sat on the inbox looking broken and
 * people tapped the link a second time.
 *
 * A file called `loading.tsx` changes that: Next shows this INSTANTLY on the
 * tap and swaps in the real page when it is ready. The shapes below are the
 * real page's shapes, so nothing jumps when the swap happens.
 */

import { AppHeaderSkeleton } from "@/components/app-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoadingRequest() {
  return (
    <>
      <AppHeaderSkeleton />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      {/* Stands in for the "Inbox" back button. */}
      <Skeleton className="h-11 w-28" />

      {/* The person's name and what they are asking for. */}
      <div className="mt-5 flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>

      {/* Their profile. */}
      <Card className="mt-8">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-3/5" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <SkeletonText lines={4} />
          <div className="flex flex-wrap gap-2">
            {["w-16", "w-20", "w-14", "w-24"].map((w) => (
              <Skeleton key={w} className={`h-6 ${w} rounded-full`} />
            ))}
          </div>
          <Skeleton className="h-9 w-44" />
        </CardContent>
      </Card>

      {/* The role. */}
      <Card className="mt-6">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-2/5" />
        </CardHeader>
        <CardContent>
          <SkeletonText lines={3} />
        </CardContent>
      </Card>

      {/* Their decision. */}
      <Card className="mt-6">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-3/5" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-11 w-40" />
        </CardContent>
      </Card>

      {/* Announced rather than shown: everything above is decorative shapes,
          so without this a screen reader reaches a page that is silent. */}
      <p className="sr-only" role="status">
        Loading this request.
      </p>
      </main>
    </>
  );
}
