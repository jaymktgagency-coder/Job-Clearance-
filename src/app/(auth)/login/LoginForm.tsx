/**
 * LoginForm.tsx — email and password, with errors shown in place.
 */

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {
    error: null,
  });

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

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

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
