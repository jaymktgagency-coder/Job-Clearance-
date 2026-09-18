/**
 * hello-overlay.tsx — the "hello" that plays right after you sign in.
 *
 * Plain English: the moment you sign in, the word "hello" writes itself across
 * the screen, then fades away and leaves you on your dashboard.
 *
 * The important part is what this does NOT do: it does not hold the dashboard
 * back. The dashboard is fully built and sitting underneath before this ever
 * appears — this is a sheet laid over the top of a page that is already there.
 * If the animation broke entirely, you would still be looking at your
 * dashboard a moment later.
 *
 * Two separate things end it, so it can never get stuck:
 *
 * 1. The word finishes writing.
 * 2. A hard time limit, in case anything at all goes wrong with the player.
 *
 * Whichever happens first wins. Worst case, the overlay is gone in about two
 * seconds.
 *
 * It also clears the `?hello=1` from the address bar as it goes, so refreshing
 * the dashboard does not replay the greeting.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { HelloLottie } from "@/components/hello-lottie";

/** Never cover the dashboard for longer than this, whatever happens. */
const HARD_LIMIT_MS = 2000;

/** How long the sheet takes to fade out once the word is written. */
const FADE_MS = 320;

export function HelloOverlay() {
  // "playing" -> "leaving" (fading out) -> gone from the page entirely.
  const [phase, setPhase] = useState<"playing" | "leaving" | "gone">("playing");

  const dismiss = useCallback(() => {
    setPhase((p) => (p === "playing" ? "leaving" : p));
  }, []);

  // The safety net. Runs no matter what the animation does.
  useEffect(() => {
    const timer = setTimeout(dismiss, HARD_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  // Take the ?hello=1 back out of the address bar. replaceState rather than a
  // router navigation, because this must not re-fetch the dashboard we are
  // currently sitting on top of.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("hello")) return;
    url.searchParams.delete("hello");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  // Once it starts leaving, take it off the page after the fade.
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      // Decorative, and covering a dashboard a screen-reader user is already
      // being read. Nothing here should reach the accessibility tree.
      aria-hidden="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity ease-out"
      style={{
        opacity: phase === "leaving" ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        // The dashboard underneath is live the whole time. Ignoring pointer
        // events means a tap during the fade-out lands on the page, not here.
        pointerEvents: phase === "leaving" ? "none" : "auto",
      }}
    >
      {/* Faster here than on the landing page. On the landing page the word is
          one thing among many and can take its time; here it is the only thing
          on screen and standing between somebody and their dashboard. */}
      <HelloLottie size={280} speed={2.1} onFinished={dismiss} />
    </div>
  );
}
