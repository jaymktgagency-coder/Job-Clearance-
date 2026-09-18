/**
 * LoginForm.tsx — email and password, with errors shown in place.
 */

"use client";

import { useActionState } from "react";

import { signIn, type FormState } from "../actions";
import { FormError } from "@/components/form-message";
import { InlineLink } from "@/components/inline-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {
    error: null,
  });

  return (
    <form action={action} className="space-y-5">
      {/* FormError carries role="alert" — a screen reader announces this the
          moment it appears, and the browser tests locate it by that role. */}
      <FormError>{state.error}</FormError>

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
          autoComplete="current-password"
          required
        />
      </div>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Sign in
      </Button>

      <p className="text-sm text-muted-foreground">
        Job seekers are never charged — not now, not later.{" "}
        <InlineLink href="/">How Vouch works</InlineLink>
      </p>
    </form>
  );
}
