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
    title: "Job seekers",
    body: "Get a warm introduction from someone who actually works there — instead of applying into a black hole. Always free.",
  },
  {
    title: "Insiders",
    body: "Verified employees review intro requests for roles at their company and write a short vouch for people they'd genuinely recommend.",
  },
  {
    title: "Employers",
    body: "See a short list of vouched-for candidates instead of 300 cold resumes, with an advisory AI fit score and the reasoning behind it.",
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
        <Button size="lg" render={<Link href="/setup" />}>
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
        This is Step 1 of the build: project scaffold and Supabase connection.
        Sign-up, job listings, and vouches are not wired up yet.
      </p>
    </main>
  );
}
