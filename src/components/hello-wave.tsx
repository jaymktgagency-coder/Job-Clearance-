/**
 * hello-wave.tsx — the waving hand on the sign-in and home pages.
 *
 * Plain English: this is the "hello" animation, hand-built rather than
 * downloaded.
 *
 * The Lottie file originally chosen could not be fetched (LottieFiles refuses
 * automated downloads), and playing one would have meant adding a ~150KB
 * animation library plus a licence attribution — for a single wave. This is
 * about 40 lines, weighs nothing, needs no library, and can be tuned to the
 * exact orange used everywhere else. It is the same call the project already
 * made preferring a hand-written zip reader over a document library.
 *
 * The hand is drawn from shapes that can be specified exactly — four rounded
 * rectangles for the fingers, one rotated for the thumb, one for the palm —
 * rather than being a drawing of a hand. It reads as a pictogram, which is
 * what belongs beside an icon set.
 *
 * It waves ONCE per page load and then holds still. A looping wave in the
 * corner of a sign-in form is a distraction you cannot dismiss.
 */

import { cn } from "@/lib/utils";

export function HelloWave({
  className,
  size = 44,
}: {
  className?: string;
  /** Rendered width in pixels. The whole thing scales from this. */
  size?: number;
}) {
  return (
    <span
      className={cn("hello-wave inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      // Decorative. The greeting beside it already says "hello" in words, and
      // a screen reader announcing "waving hand" twice is noise.
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 72" className="size-full" fill="currentColor">
        {/* Everything pivots at the wrist, bottom centre, like a real wave. */}
        <g className="hello-wave-hand">
          {/* Thumb. Pivoted about a point INSIDE the palm so its base stays
              buried there — rotated about its own edge it detaches and reads
              as a separate blob floating next to the hand. */}
          <rect
            x="8"
            y="34"
            width="10.5"
            height="26"
            rx="5.25"
            transform="rotate(-25 18 60)"
          />
          {/* Four fingers. Middle tallest, little finger shortest and set
              lower — that stagger is the only reason this reads as a hand
              rather than a comb. */}
          <rect x="15.5" y="12" width="10.5" height="31" rx="5.25" />
          <rect x="27.5" y="6" width="10.5" height="37" rx="5.25" />
          <rect x="39.5" y="11" width="10.5" height="32" rx="5.25" />
          <rect x="51" y="19" width="9.5" height="24" rx="4.75" />
          {/* Palm, drawn last so it sits over the base of every finger. */}
          <rect x="13" y="34" width="48" height="36" rx="15" />
        </g>
      </svg>
    </span>
  );
}
