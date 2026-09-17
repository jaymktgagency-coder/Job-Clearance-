/**
 * form-message.tsx — the panel that appears above a form when something went
 * wrong, or when there is something you need to know.
 *
 * Plain English: before this, nine different forms each had their own
 * hand-written error paragraph. They drifted — different padding, different
 * corners, different red. One component means fixing the error state fixes it
 * in nine places.
 *
 * IMPORTANT, DO NOT CHANGE WITHOUT READING THIS:
 *
 * `role="alert"` on the error variant is load-bearing twice over.
 *
 * 1. It is how a screen reader knows to stop and read the message out the
 *    moment it appears. Without it, somebody who cannot see the red box gets
 *    no indication their sign-in failed.
 *
 * 2. Seven of the browser tests in tests/ locate errors with the selector
 *    `[role="alert"]`. Removing or renaming it silently breaks all of them —
 *    they would report "no error shown" and pass a form that is in fact
 *    broken.
 *
 * The notice variant deliberately does NOT get it. `role="alert"` interrupts,
 * and "check your email to confirm your account" is not an interruption.
 */

import { InfoIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function FormError({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive",
        className
      )}
    >
      <TriangleAlertIcon
        className="mt-px size-4 shrink-0"
        aria-hidden="true"
      />
      <span>{children}</span>
    </p>
  );
}

export function FormNotice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <p
      // Polite, not interrupting: announced when the reader next pauses.
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900",
        className
      )}
    >
      <InfoIcon className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
