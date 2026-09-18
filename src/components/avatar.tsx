/**
 * avatar.tsx — somebody's picture, or their initials when they have not
 * uploaded one.
 *
 * Plain English: a round picture, used everywhere a person or a company is
 * named. Most people will never upload one, so the version WITHOUT a picture
 * is the one that matters: it shows their initials on a coloured circle
 * rather than a grey silhouette, which makes a list of six people readable at
 * a glance instead of six identical blanks.
 *
 * The colour is picked from the name itself, so the same person is the same
 * colour on every screen and it never has to be stored anywhere.
 *
 * Deliberately a plain `<img>` rather than `next/image`. These come from a
 * public Supabase bucket at an unpredictable path, so Next's optimiser would
 * need the whole storage host allow-listed to do anything useful, and at
 * 32 pixels it would save nothing worth that.
 */

import { cn } from "@/lib/utils";

/** Two letters from a name: "Priya Raman" -> "PR", "Starbucks" -> "S". */
function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * The six background tints an initials circle can have.
 *
 * Every one is a dark, saturated shade carrying white text, so the contrast
 * is the same whichever a name lands on and none of them needs checking
 * separately.
 */
const TINTS = [
  "bg-brand-700",
  "bg-[oklch(0.45_0.13_25)]",
  "bg-[oklch(0.45_0.10_150)]",
  "bg-[oklch(0.45_0.12_255)]",
  "bg-[oklch(0.45_0.13_310)]",
  "bg-[oklch(0.45_0.10_95)]",
] as const;

/** Same name in, same tint out — no randomness, nothing stored. */
function tintFor(name: string | null | undefined): string {
  const s = name ?? "";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
} as const;

export function Avatar({
  src,
  name,
  size = "md",
  className,
  /**
   * A company logo is usually a square mark on a background of its own, so it
   * is fitted inside the circle rather than cropped to fill it — cropping
   * turns a wordmark into a letter and a half.
   */
  contain = false,
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  contain?: boolean;
}) {
  const shared = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    SIZES[size],
    className,
  );

  if (src) {
    return (
      // next/image would need the Supabase storage host allow-listed to do
      // anything here, and saves nothing at 32 pixels. See the note at the
      // top of this file.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        // The name is already written next to every one of these, so
        // repeating it would have a screen reader say it twice.
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={cn(shared, "bg-sunken", contain ? "object-contain" : "object-cover")}
      />
    );
  }

  return (
    <span
      className={cn(shared, tintFor(name), "font-heading font-semibold text-white select-none")}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
