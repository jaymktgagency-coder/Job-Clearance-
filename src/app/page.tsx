/**
 * / — the home page.
 *
 * Plain English: a placeholder front door for Vouch. It explains the three
 * types of user and links to the setup checker. Real sign-up buttons arrive in
 * Step 3 (auth + onboarding).
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The three sides of the marketplace, described the way a visitor would need it.
const AUDIENCES = [
  {
    title: "Seekers",
    body: "Getting hired increasingly means knowing someone inside. Vouch gets you vouched for anyway — even with no network. Free, forever.",
  },
  {
    title: "Vouchers",
    body: "Verified employees review requests for roles where they already work, and write an honest vouch. They earn a share of the fee, and build a public track record.",
  },
  {
    title: "Employers",
    body: "A short list of vouched-for candidates instead of 300 cold resumes. You pay only when you actually hire.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Vouch</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Warm introductions beat cold applications.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Vouch connects job seekers to real employees inside the companies they
        want to work for. Employers only ever see candidates a human has
        personally endorsed.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {/* `render` tells the button to be a real link (shadcn/Base UI pattern). */}
        <Button size="lg" render={<Link href="/signup" />}>
          Get started
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/login" />}>
          Sign in
        </Button>
        <Button size="lg" variant="ghost" render={<Link href="/setup" />}>
          Check my setup
        </Button>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {AUDIENCES.map((a) => (
          <Card key={a.title}>
            <CardHeader>
              <CardTitle className="text-base">{a.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{a.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-14 text-sm text-muted-foreground">
        Accounts and sign-in work now. Browsing jobs, requesting intros, the
        voucher inbox and the employer&apos;s candidate list arrive in Steps 5 to 7.
      </p>
    </main>
  );
}
