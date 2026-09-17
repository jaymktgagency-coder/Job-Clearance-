/**
 * select.tsx — dropdown lists: which company you work at, which location a
 * role is in.
 *
 * Plain English: this is the browser's own dropdown, restyled. That is a
 * deliberate choice over building a custom one.
 *
 * A hand-built dropdown is a large amount of code that has to reimplement
 * keyboard control, screen-reader support and scrolling, and on a phone or
 * tablet it loses the native picker — the big scrolling wheel that is far
 * easier to use with a thumb than a list of small targets. The native
 * element gets all of that for free and forever.
 *
 * The only thing it does not give us is the arrow, since browsers each draw
 * their own. So we hide theirs and draw ours, which is the one part that
 * genuinely needs to match the rest of the product.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-card py-2 pr-11 pl-3.5",
          "text-base md:text-sm",
          "shadow-inset transition-[border-color,box-shadow,background-color] duration-[160ms] ease-out",
          "hover:border-brand-300",
          "focus-visible:border-brand-500 focus-visible:bg-brand-50/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55",
          "aria-invalid:border-destructive aria-invalid:bg-destructive/5",
          // Hide the browser's own arrow so ours is the only one showing.
          "cursor-pointer appearance-none",
          className
        )}
        {...props}
      >
        {children}
      </select>

      {/* Ours. `pointer-events-none` so a tap passes straight through to the
          select underneath rather than landing on the decoration. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-brand-700"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export { Select };
