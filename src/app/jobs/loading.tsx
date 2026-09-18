/**
 * The stand-in for the job list while it is being fetched.
 *
 * The filter bar's shape is included so that a seeker who has set filters
 * does not watch the list appear and then get pushed down the page when the
 * filters arrive underneath the heading.
 */

import { AppHeaderSkeleton } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoadingJobs() {
  return (
    <>
      <AppHeaderSkeleton />

      <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-52" />
          <Skeleton className="h-11 w-40" />
        </div>
        <Skeleton className="mt-4 h-6 w-3/4" />

        {/* The filter bar. */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Skeleton className="h-11 w-44" />
          <Skeleton className="h-11 w-44" />
        </div>

        <div className="mt-10 space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="sr-only" role="status">
          Loading open roles.
        </p>
      </main>
    </>
  );
}
