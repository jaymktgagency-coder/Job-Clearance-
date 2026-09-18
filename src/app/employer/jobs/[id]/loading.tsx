/**
 * The stand-in for an employer's candidate list.
 *
 * This is the heaviest read in the product — every candidate carries their
 * profile, their vouch, and the voucher who wrote it — so it is the page most
 * worth showing a shape for.
 */

import { AppHeaderSkeleton } from "@/components/app-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoadingCandidates() {
  return (
    <>
      <AppHeaderSkeleton />

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="mt-5 h-10 w-3/5" />
        <Skeleton className="mt-3 h-6 w-2/5" />

        <div className="mt-10 space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SkeletonText lines={3} />
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="sr-only" role="status">
          Loading candidates.
        </p>
      </main>
    </>
  );
}
