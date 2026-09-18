/**
 * inline-link.tsx — a link inside a sentence.
 *
 * Plain English: the readable orange, not the bright one. Bright orange text
 * on paper measures 2.5:1 and is genuinely hard to read; this is 5.8:1. It is
 * the single easiest mistake to make in an orange product, so the correct
 * version lives in one component rather than being retyped in twenty places.
 *
 * In its own file, rather than inside auth-shell, because both server and
 * client components use it — importing it from the shell would pull the whole
 * shell into the browser bundle for the sake of one anchor tag.
 */

import Link from "next/link";

import { cn } from "@/lib/utils";

export function InlineLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-brand-700 underline underline-offset-[0.2em] transition-colors duration-[160ms] ease-out hover:text-brand-900",
        className
      )}
    >
      {children}
    </Link>
  );
}
