/**
 * textarea.tsx — the big multi-line boxes: a vouch, a job description, the
 * note attached to an intro request.
 *
 * Plain English: the same sunken well as a single-line field, just taller.
 * Before this existed, four different screens each had a hand-written
 * textarea with slightly different styling, which is how an interface starts
 * looking like it was built by four different people.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-32 w-full rounded-lg border border-input bg-card px-3.5 py-2.5",
        // 16px on phones, or iOS Safari zooms the page when the box is tapped.
        "text-base md:text-sm",
        "shadow-inset transition-[border-color,box-shadow,background-color] duration-[160ms] ease-out",
        "placeholder:text-muted-foreground/70",
        "hover:border-brand-300",
        "focus-visible:border-brand-500 focus-visible:bg-brand-50/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55",
        "aria-invalid:border-destructive aria-invalid:bg-destructive/5",
        // Let people drag it taller, but never wider — a textarea dragged
        // wider than its column breaks the page layout around it.
        "resize-y",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
