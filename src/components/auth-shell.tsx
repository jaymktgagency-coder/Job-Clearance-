/**
 * auth-shell.tsx — the frame around signing in, signing up, finishing setup,
 * and verifying a work email.
 *
 * Plain English: four pages that used to each invent their own layout now
 * share one. They get the same width, the same spacing, the same way back to
 * the home page, and the same card.
 *
 * `greet` puts the "hello" animation above the title. It is on for signing
 * in and signing up — the two doors into the product — and off for the steps
 * in the middle, where you have already been greeted and are trying to finish
 * something.
 */

import Link from "next/link";

import { HelloLottie } from "@/components/hello-lottie";
import { Card, CardContent } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  greet = false,
  children,
  footer,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  greet?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-14 sm:py-20">
      <Link
        href="/"
        className="font-heading inline-flex min-h-11 items-center self-start text-lg font-semibold tracking-[-0.03em] transition-colors duration-[160ms] ease-out hover:text-brand-700"
      >
        Vouch
      </Link>

      <div className="mt-10">
        {greet ? <HelloLottie className="mb-5" size={150} /> : null}

        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <Card className="mt-8">
        <CardContent className="py-1">{children}</CardContent>
      </Card>

      {footer ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </main>
  );
}
