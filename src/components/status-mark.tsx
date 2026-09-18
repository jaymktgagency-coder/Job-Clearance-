/**
 * status-mark.tsx — the little tick or circle beside "Payment method",
 * "Business registration", "Email domain".
 *
 * Plain English: these used to be emoji — ✅ and ⚪️ typed straight into the
 * page. Three problems with that, and they are not matters of taste:
 *
 * 1. Every operating system draws emoji differently. The same tick is flat on
 *    Windows, glossy on an iPhone, and a different green on Android. Nothing
 *    you design survives contact with them.
 * 2. A screen reader announces "white heavy check mark" — the name of the
 *    picture, not what it means. "Payment method: done" is the useful thing.
 * 3. They cannot take a colour from the palette, so they never match.
 *
 * These are drawn icons on a tinted disc, and each one carries a real word
 * for anyone who cannot see it.
 */

import { CheckIcon, MinusIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const MARKS = {
  done: {
    Icon: CheckIcon,
    label: "Done",
    className: "bg-success/12 text-success",
  },
  waiting: {
    Icon: MinusIcon,
    label: "Not done yet",
    className: "bg-muted text-muted-foreground",
  },
  attention: {
    Icon: TriangleAlertIcon,
    label: "Needs attention",
    className: "bg-brand-100 text-brand-800",
  },
  failed: {
    Icon: XIcon,
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
} as const;

export type StatusMarkState = keyof typeof MARKS;

export function StatusMark({
  state,
  className,
}: {
  state: StatusMarkState;
  className?: string;
}) {
  const { Icon, label, className: tone } = MARKS[state];
  return (
    <span
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded-full",
        tone,
        className
      )}
    >
      <Icon className="size-3" strokeWidth={3} aria-hidden="true" />
      {/* Read aloud in place of the icon, so the meaning survives. */}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A status mark with its label beside it — the common case. */
export function StatusLine({
  state,
  children,
  className,
}: {
  state: StatusMarkState;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2.5 text-sm", className)}>
      <StatusMark state={state} />
      <span>{children}</span>
    </p>
  );
}
