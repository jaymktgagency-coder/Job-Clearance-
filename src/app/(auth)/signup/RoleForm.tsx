/**
 * RoleForm.tsx — the sign-up form itself.
 *
 * Plain English: this runs in the browser so it can show errors without a
 * page reload. The three role cards are radio buttons dressed up to look
 * clickable. If someone arrived from an employer's invitation, "Voucher" is
 * pre-selected and their company is named on the card — they can still change
 * it, but the sensible choice is already made for them.
 */

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES = [
  {
    value: "seeker",
    title: "I'm looking for work",
    blurb: "Get vouched for by someone who already works there. Always free.",
  },
  {
    value: "voucher",
    title: "I want to vouch for people",
    blurb: "You work somewhere, and you're willing to back people applying there.",
  },
  {
    value: "employer",
    title: "I'm hiring",
    blurb: "Post roles and see only candidates a real employee has vouched for.",
  },
] as const;

export function RoleForm({
  inviteToken,
  invitedCompany,
}: {
  inviteToken?: string;
  invitedCompany?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {
    error: null,
  });

  return (
    <form action={action} className="space-y-6">
      {inviteToken ? <input type="hidden" name="invite_token" value={inviteToken} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          {state.notice}
        </p>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">How will you use Vouch?</legend>
        {ROLES.map((r) => (
          <label
            key={r.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-checked:border-primary has-checked:bg-muted/50"
          >
            <input
              type="radio"
              name="role"
              value={r.value}
              defaultChecked={invitedCompany ? r.value === "voucher" : undefined}
              required
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="block text-sm text-muted-foreground">{r.blurb}</span>
              {invitedCompany && r.value === "voucher" ? (
                <span className="mt-2 block text-sm font-medium text-primary">
                  {invitedCompany} invited you — we&apos;ll set this up for you.
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        <p className="text-sm text-muted-foreground">At least 6 characters.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating your account..." : "Create account"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
