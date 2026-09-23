import { SHOW_PLACEHOLDER_PHOTO_TAGS } from "@/lib/business";

/**
 * A small label on each stock photo so it's obvious which images still need
 * swapping for real job photos. Turn them all off in lib/business.ts.
 */
export function PhotoTag({ className = "" }: { className?: string }) {
  if (!SHOW_PLACEHOLDER_PHOTO_TAGS) return null;
  return (
    <span
      className={`pointer-events-none absolute z-10 rounded-sm bg-navy-950/80 px-2 py-1 text-[0.68rem] font-semibold tracking-wide text-white uppercase ${className}`}
    >
      Placeholder photo
    </span>
  );
}
