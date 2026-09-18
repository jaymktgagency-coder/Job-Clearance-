/**
 * skeleton.tsx — a grey block standing in for something still loading.
 *
 * Plain English: a soft pulsing rectangle the shape of the thing that has not
 * arrived yet, so a page can show its own layout before it has any content to
 * put in it.
 *
 * The point is not decoration. Until this existed, clicking into a profile
 * did nothing at all for a second or two — the browser sat on the old page
 * while the server fetched, and a person who cannot see anything happening
 * taps the link again. A skeleton is the difference between "this is broken"
 * and "this is coming".
 */

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-sunken", className)}
      {...props}
    />
  );
}

/**
 * A run of fake text lines. The last one is deliberately short, the way a
 * real last line of a paragraph is — equal-length bars read as a barcode.
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}
