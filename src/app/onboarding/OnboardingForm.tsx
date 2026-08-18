/**
 * OnboardingForm.tsx — the "tell us about yourself" step, which asks
 * different questions depending on the role.
 */

"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Company = { id: string; name: string; verification_tier: string };

export function OnboardingForm({
  role,
  companies,
  invitedCompany,
}: {
  role: "seeker" | "voucher" | "employer";
  companies: Company[];
  invitedCompany: string | null;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    { error: null },
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="role" value={role} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="full_name">Your name</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>

      {role === "seeker" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="headline">What do you do?</Label>
            <Input id="headline" name="headline" placeholder="Barista and shift lead, 4 years" />
            <p className="text-sm text-muted-foreground">
              One line. You can add the rest later — including your resume.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Where are you looking?</Label>
            <Input id="location" name="location" placeholder="Seattle, WA" />
          </div>
        </>
      ) : null}

      {role === "employer" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company name</Label>
            <Input id="company_name" name="company_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input id="website" name="website" placeholder="https://" />
          </div>
          <p className="rounded-md border p-3 text-sm text-muted-foreground">
            You&apos;ll add a payment method and business registration later to earn
            a <strong>Verified Business</strong> badge. Proving your email domain
            on top of that earns <strong>Verified Domain</strong>, which lets your
            staff verify themselves with a work email.
          </p>
        </>
      ) : null}

      {role === "voucher" ? (
        <>
          {invitedCompany ? (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">{invitedCompany}</p>
              <p className="mt-1 text-muted-foreground">
                They invited you, so you&apos;re all set — no work email needed. You&apos;ll
                be able to vouch as soon as you finish here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="company_id">Where do you work?</Label>
                <select
                  id="company_id"
                  name="company_id"
                  required
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose your employer
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Don&apos;t see your employer? Ask them to invite you — that works even
                  if they don&apos;t have their own email domain.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_email">Your work email</Label>
                <Input id="work_email" name="work_email" type="email" required />
                <p className="text-sm text-muted-foreground">
                  Must be at your company&apos;s domain — personal addresses can&apos;t prove
                  where you work. We&apos;ll send a 6-digit code to confirm it.
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="job_title">Your job title (optional)</Label>
            <Input id="job_title" name="job_title" placeholder="Shift Supervisor" />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
            <input type="checkbox" name="employer_permission" className="mt-1" required />
            <span className="text-sm">
              <span className="block font-medium">
                My employer allows me to take part in Vouch.
              </span>
              <span className="mt-1 block text-muted-foreground">
                Vouching pays, and some employers have rules about outside payment
                relating to hiring. We ask so you don&apos;t get caught out.
              </span>
            </span>
          </label>
        </>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Setting things up..." : "Finish setting up"}
      </Button>
    </form>
  );
}
