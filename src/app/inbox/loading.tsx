/** The stand-in for the voucher's inbox while their requests are fetched. */

import { AppHeaderSkeleton } from "@/components/app-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoadingInbox() {
  return (
    <>
      <AppHeaderSkeleton />

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 h-6 w-4/5" />

        <div className="mt-10 space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SkeletonText lines={2} />
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="sr-only" role="status">
          Loading your inbox.
        </p>
      </main>
    </>
  );
}
