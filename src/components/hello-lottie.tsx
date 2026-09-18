/**
 * hello-lottie.tsx — the "hello" animation, written on by hand.
 *
 * Plain English: this draws the cursive word "hello" as though somebody were
 * writing it with a pen. It replaces the waving hand that used to sit here.
 *
 * The animation itself is `src/assets/hello-apple.json`, downloaded from
 * LottieFiles (see `src/assets/README.md` for who made it and the licence).
 * That file is left exactly as it was published; everything we want different
 * about it is done here, at runtime, so the asset can be swapped for a fresh
 * download without our changes being lost.
 *
 * Four things are done to it here:
 *
 * 1. **It is tinted.** The original is flat black. The site's greeting has
 *    always been brand orange, so the stroke is recoloured to match.
 * 2. **Only the first stretch is played.** The full file writes the word on,
 *    holds it, and then rubs it out again. Rubbing it out is wrong for a
 *    greeting sitting above a headline, so we stop at the moment the word is
 *    finished and leave it there.
 * 3. **It is sped up.** Even that first stretch is 2.5 seconds, which is slow
 *    for the first thing on a page. See `speed` below.
 * 4. **It is cropped.** The artwork is a square with the word across the
 *    middle, so most of it is empty. Left uncropped it would shove the
 *    headline half a screen down the page.
 *
 * It plays ONCE, when it appears — never on a loop, and never tied to
 * scrolling. A loop in the corner of a sign-in form is a distraction you
 * cannot dismiss.
 */

"use client";

import { useMemo, useSyncExternalStore } from "react";
import { LottieSvg } from "lottie-react";

import helloSource from "@/assets/hello-apple.json";
import { cn } from "@/lib/utils";

/**
 * The frame at which the word is fully written. Everything after it is the
 * animation erasing itself, which we never show. The file runs at 120 frames
 * per second, so frame 300 is the 2.5 second mark.
 */
const WRITTEN_FRAME = 300;

/**
 * Where the word actually sits inside the 500x500 square, measured from the
 * file: the ink spans 88.9..408.4 across and 191.6..304.3 down, including the
 * width of the pen stroke. That is a band 64% of the width and 22.6% of the
 * height, sitting dead centre — so cropping to it is a matter of making a box
 * that shape and centring the artwork behind it.
 */
const WORD_WIDTH_FRACTION = 0.639;
const WORD_ASPECT = 112.8 / 319.5; // the word's own height ÷ its own width

/** The brand orange, `--brand-500`. Lottie needs a real colour, not a CSS variable. */
const BRAND_500 = "#fd7924";

/** Turns "#fd7924" into the [0-1, 0-1, 0-1] triplet Lottie stores colours as. */
function toLottieRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Returns a copy of the animation with its stroke recoloured.
 *
 * The stroke is stored as a gradient, which in a Lottie file is one flat list
 * of numbers repeating [position, red, green, blue]. Every stop in this file
 * is the same black, so we walk the list and overwrite each colour while
 * leaving the positions alone.
 *
 * The original is deep-copied first — mutating the imported JSON would tint it
 * for every other part of the app that imports it, permanently.
 */
function tinted(color: string): object {
  const copy = structuredClone(helloSource) as Record<string, unknown>;
  const [r, g, b] = toLottieRgb(color);

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    // "gs" is a gradient stroke and "gf" a gradient fill; both keep their
    // colour stops at g.k.k as that flat [position, r, g, b, ...] list. "st"
    // and "fl" are the plain-colour versions, which keep theirs at c.k.
    if ((obj.ty === "gs" || obj.ty === "gf") && obj.g) {
      const stops = (obj.g as { k?: { k?: unknown } }).k?.k;
      if (Array.isArray(stops)) {
        for (let i = 0; i + 3 < stops.length; i += 4) {
          stops[i + 1] = r;
          stops[i + 2] = g;
          stops[i + 3] = b;
        }
      }
    }
    if ((obj.ty === "st" || obj.ty === "fl") && obj.c) {
      const c = obj.c as { k?: unknown };
      if (Array.isArray(c.k)) c.k = [r, g, b, 1];
    }

    Object.values(obj).forEach(walk);
  };

  walk(copy);
  return copy;
}

/**
 * The three halves of reading a media query the way React wants it read: how
 * to be told when it changes, how to read it now, and what to say when asked
 * on the server, where there is no such thing as a media query.
 */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readMotionPreference(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}

function readMotionPreferenceOnServer(): null {
  return null;
}

export function HelloLottie({
  className,
  /** How wide the word itself should be, in pixels. The height follows it. */
  size = 200,
  /**
   * How much faster than the original to play it. The stretch we play is 2.5
   * seconds long, so 1.6 puts the word on screen in about 1.6 seconds — quick
   * enough to read as a flourish rather than a wait.
   */
  speed = 1.6,
  color = BRAND_500,
  /** Called once the word has finished writing. Used by the post-login moment. */
  onFinished,
}: {
  className?: string;
  size?: number;
  speed?: number;
  color?: string;
  onFinished?: () => void;
}) {
  // Recolouring walks the whole file, so do it once per colour, not per render.
  const data = useMemo(() => tinted(color), [color]);

  // Whether this visitor has asked their device for less motion.
  //
  // On the server this is null — "we do not know yet" — because the server
  // cannot know. Guessing "no" there would mean a reduced-motion visitor
  // briefly seeing the very movement they asked not to see, so nothing is
  // drawn at all until the browser has answered, which takes one tick.
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    readMotionPreference,
    readMotionPreferenceOnServer,
  );

  const boxWidth = size / WORD_WIDTH_FRACTION; // the full square, scaled up
  const height = size * WORD_ASPECT;

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden", className)}
      style={{ width: size, height }}
      // Decorative. The headline beside it already greets the visitor in
      // words, and a screen reader announcing "hello" twice is noise.
      aria-hidden="true"
    >
      {reduced === null ? null : (
        <LottieSvg
          // Remounting on a colour or speed change is intended: both are
          // load-time settings for the player, and this is not something that
          // changes while anybody is looking at it.
          key={`${color}-${speed}-${reduced}`}
          src={data}
          loop={false}
          autoplay
          speed={speed}
          // Someone who asked for less motion gets the last two frames — which
          // is to say the finished word, immediately, sitting still. The point
          // of the greeting survives; the movement does not.
          segment={reduced ? [WRITTEN_FRAME - 1, WRITTEN_FRAME] : [0, WRITTEN_FRAME]}
          subscriptions={onFinished ? { complete: onFinished } : undefined}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: boxWidth, height: boxWidth }}
        />
      )}
    </div>
  );
}
