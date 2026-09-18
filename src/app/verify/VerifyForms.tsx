/**
 * VerifyForms.tsx — "send me a code" and "here's the code" .
 */

"use client";

import { useActionState } from "react";
import { sendCode, confirmCode, type VerifyState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Message({ state }: { state: VerifyState }) {
  if (state.error) return <FormError>{state.error}</FormError>;
  if (!state.notice) return null;
  return (
    <div role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
      <p>{state.notice}</p>
      {/* The code shown on private test deployments only, never in production
          — SHOW_VERIFICATION_CODES gates it. `tabular` so the six digits sit
          in even columns instead of drifting. */}
      {state.devCode ? (
        <p
          className="tabular mt-2 font-mono text-2xl font-semibold tracking-[0.3em] text-brand-800"
          data-testid="dev-code"
        >
          {state.devCode}
        </p>
      ) : null}
    </div>
  );
}

export function SendCodeForm({ workEmail }: { workEmail: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(sendCode, { error: null });
  return (
    <form action={action} className="space-y-3">
      <Message state={state} />
      <p className="text-sm text-muted-foreground">
        We&apos;ll send a 6-digit code to{" "}
        <strong className="font-semibold text-foreground">{workEmail}</strong>.
      </p>
      <Button type="submit" loading={pending}>
        Send me a code
      </Button>
    </form>
  );
}

export function ConfirmCodeForm() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(confirmCode, { error: null });
  return (
    <form action={action} className="space-y-3">
      <Message state={state} />
      <div className="space-y-2">
        <Label htmlFor="code">Enter your code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="tabular font-mono text-lg font-semibold tracking-[0.3em]"
          required
        />
      </div>
      <Button type="submit" loading={pending}>
        Verify me
      </Button>
    </form>
  );
}
