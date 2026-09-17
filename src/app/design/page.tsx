/**
 * /design — the parts catalogue.
 *
 * Plain English: this page exists for you, not for customers.
 *
 * You cannot run the site on your tablet, so the only way you can check a
 * button is to find a real page that happens to have one. This page puts
 * every button, field, card and badge in one place, so you can press them
 * all and tell me what feels wrong — without hunting through sign-up forms
 * and billing screens.
 *
 * It needs no login and no database, so it works even when the rest of the
 * site is mid-deploy. It is marked "noindex", so Google will not list it.
 *
 * If you ever want it gone, deleting this one file removes it completely.
 * Nothing else imports it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Parts catalogue — Vouch",
  description: "Every component in Vouch, in one place, for design review.",
  robots: { index: false, follow: false },
};

/** A labelled band, so the page reads as a document rather than a dump. */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-12">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <p className="measure mt-2 text-sm text-muted-foreground">{note}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold sm:text-5xl">Parts catalogue</h1>
      <p className="measure mt-4 text-lg text-muted-foreground">
        Every piece the site is built from. Press things. If something feels
        wrong here, it feels wrong everywhere — this is the fastest place to
        catch it.
      </p>
      <Badge variant="soft" className="mt-6">
        Not linked from anywhere · hidden from search
      </Badge>

      <Section
        title="Buttons"
        note="Press and hold one. It drops and shrinks quickly under your finger, then springs back slightly past its resting place when you let go. That asymmetry is deliberate: it is the difference between a button that is animated and one that is satisfying."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Get started</Button>
          <Button variant="outline">Sign in</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">
            <TrashIcon aria-hidden="true" />
            Delete account
          </Button>
          <Button variant="link">Read the terms</Button>
        </div>

        <h3 className="mt-10 mb-4 text-sm font-semibold">
          Sizes — every one of these is at least 44px tall except xs and sm,
          which are for dense rows only
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xl">Extra large</Button>
          <Button size="lg">Large</Button>
          <Button>Default (44px)</Button>
          <Button size="sm">Small</Button>
          <Button size="xs">Tiny</Button>
        </div>

        <h3 className="mt-10 mb-4 text-sm font-semibold">
          Working, waiting, and unavailable
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading>Confirming hire</Button>
          <Button variant="outline" loading>
            Checking
          </Button>
          <Button disabled>Not available yet</Button>
          <Button variant="outline" disabled>
            Not available yet
          </Button>
        </div>
        <p className="measure mt-4 text-sm text-muted-foreground">
          A loading button keeps its exact width rather than swapping its label
          for &ldquo;Saving&hellip;&rdquo;, so the page never shifts under
          whatever you were about to tap next.
        </p>

        <h3 className="mt-10 mb-4 text-sm font-semibold">
          Buttons that are really links
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button render={<Link href="/design" />}>
            Stay here
            <ArrowRightIcon aria-hidden="true" />
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            Back to the home page
          </Button>
        </div>
      </Section>

      <Section
        title="Fields"
        note="Buttons come toward you; fields go away from you. A button has a lit top edge and a shadow below it. A field has its shadow cast inwards, so it reads as a well cut into the page — somewhere to put something. Tap into one and it warms up."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="d-email">Work email</Label>
            <Input
              id="d-email"
              type="email"
              placeholder="you@company.com"
              autoComplete="off"
            />
            <p className="text-sm text-muted-foreground">
              Helper text sits under the field, where it is read before the
              mistake is made rather than after.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-name">Full name</Label>
            <Input id="d-name" defaultValue="Priya Raman" autoComplete="off" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-bad">Start date</Label>
            <Input
              id="d-bad"
              aria-invalid
              defaultValue="32 / 13 / 2026"
              autoComplete="off"
            />
            {/* role="alert" so a screen reader announces the problem the
                moment it appears, not whenever the reader next pauses. */}
            <p role="alert" className="text-sm font-medium text-destructive">
              That is not a real date. Use day / month / year.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="d-off">Company</Label>
            <Input id="d-off" disabled defaultValue="Set during onboarding" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="d-file">Resume</Label>
            <Input id="d-file" type="file" />
          </div>
        </div>
      </Section>

      <Section
        title="Cards"
        note="White, on warm off-white paper, with a lit top edge and a soft shadow. Depth is declared once — a shadow or a border, never both. The middle one is clickable, so it lifts under the cursor and presses down when tapped."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Still</CardTitle>
              <CardDescription>
                An ordinary card. It holds information and does not react.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card interactive>
            <CardHeader>
              <CardTitle>Clickable</CardTitle>
              <CardDescription>
                Hover or tap this one. It behaves like a button, because it is
                one.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>With a footer</CardTitle>
              <CardDescription>
                The footer sits in a recessed well at the bottom.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <span className="tabular text-sm font-semibold">$2,000.00</span>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <Section
        title="Labels and status"
        note="Used for job tiers, vouch states, verification badges and payout status. Colour is never the only signal — roughly one man in twelve cannot reliably tell the red one from the orange one, so these always carry words, and an icon where it matters."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Vouched</Badge>
          <Badge variant="soft">Awaiting reply</Badge>
          <Badge variant="secondary">Draft</Badge>
          <Badge variant="outline">Verified Business</Badge>
          <Badge variant="success">
            <CheckIcon aria-hidden="true" />
            Payout released
          </Badge>
          <Badge variant="destructive">
            <TriangleAlertIcon aria-hidden="true" />
            Disputed
          </Badge>
        </div>
      </Section>

      <Section
        title="Messages"
        note="Only a problem interrupts. An error is announced to a screen reader the instant it appears; good news waits politely until the reader next pauses."
      >
        <div className="space-y-4">
          <Alert variant="brand">
            <InfoIcon aria-hidden="true" />
            <AlertTitle>An AI reads your resume</AlertTitle>
            <AlertDescription>
              It ranks how well you fit a role, and it can never reject you on
              its own. You can see exactly what it read.
            </AlertDescription>
          </Alert>

          <Alert variant="success">
            <CheckIcon aria-hidden="true" />
            <AlertTitle>Hire confirmed by both sides</AlertTitle>
            <AlertDescription>
              The voucher&rsquo;s share is held for 60 days from the start date.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>We could not take that payment</AlertTitle>
            <AlertDescription>
              Your card was declined. Add another payment method and we will try
              again — nothing is owed until a hire is confirmed by both sides.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section
        title="The two oranges"
        note="Bright orange is the hardest colour in interface design, because the obvious way to use it fails. These are the two that passed."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="overflow-hidden rounded-lg shadow-raised">
            <div className="flex h-28 items-end bg-brand-500 p-4">
              <span className="font-heading text-lg font-semibold text-primary-foreground">
                Near-black on bright orange
              </span>
            </div>
            <div className="bg-card p-4">
              <p className="tabular text-sm font-semibold">7.0 : 1</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Surfaces. Buttons and anything loud. White text here would be
                2.6:1, which fails.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg shadow-raised">
            <div className="flex h-28 items-end bg-card p-4">
              <span className="font-heading text-lg font-semibold text-brand-700">
                Deep orange on paper
              </span>
            </div>
            <div className="bg-card p-4">
              <p className="tabular text-sm font-semibold">5.8 : 1</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Words. Links and emphasis. Bright orange text here would be
                2.5:1, which is unreadable.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex overflow-hidden rounded-lg shadow-raised">
          {(
            [
              "50",
              "100",
              "200",
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
            ] as const
          ).map((step) => (
            <div
              key={step}
              className="flex h-16 flex-1 items-end justify-center pb-1.5 text-[0.625rem] font-semibold"
              style={{
                background: `var(--brand-${step})`,
                // 500 and 600 are the awkward middle: they fail against
                // white AND against brand-900. Only the near-black ink clears
                // 4.5:1 on them, which is the same reason buttons use it.
                color:
                  Number(step) >= 700 ? "white" : "var(--foreground)",
              }}
            >
              {step}
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
