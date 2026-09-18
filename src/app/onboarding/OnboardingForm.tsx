/**
 * OnboardingForm.tsx — the "tell us about yourself" step, which asks
 * different questions depending on the role.
 */

"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

      <FormError>{state.error}</FormError>

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
          <p className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
            You&apos;ll add a payment method and business registration later to earn
            a <strong className="font-semibold">Verified Business</strong> badge.
            Proving your email domain on top of that earns{" "}
            <strong className="font-semibold">Verified Domain</strong>, which lets
            your staff verify themselves with a work email. A business on Gmail is
            never second-class here.
          </p>
        </>
      ) : null}

      {role === "voucher" ? (
        <>
          {invitedCompany ? (
            <div className="rounded-lg bg-brand-50 p-4 text-sm">
              <p className="font-semibold text-brand-900">{invitedCompany}</p>
              <p className="mt-1 text-brand-800">
                They invited you, so you&apos;re all set — no work email needed. You&apos;ll
                be able to vouch as soon as you finish here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="company_id">Where do you work?</Label>
                <Select id="company_id" name="company_id" required defaultValue="">
                  <option value="" disabled>
                    Choose your employer
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
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

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
            <input
              type="checkbox"
              name="employer_permission"
              className="mt-0.5 size-4 accent-brand-500"
              required
            />
            <span className="text-sm">
              <span className="block font-semibold">
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

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Finish setting up
      </Button>
    </form>
  );
}
