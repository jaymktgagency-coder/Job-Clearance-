/**
 * VerifyForms.tsx — "send me a code" and "here's the code" .
 */

"use client";

import { useActionState } from "react";
import { sendCode, confirmCode, type VerifyState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Message({ state }: { state: VerifyState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (!state.notice) return null;
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <p className="text-muted-foreground">{state.notice}</p>
      {state.devCode ? (
        <p className="mt-2 font-mono text-2xl tracking-widest" data-testid="dev-code">
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
        We&apos;ll send a 6-digit code to <strong>{workEmail}</strong>.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send me a code"}
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
          className="font-mono text-lg tracking-widest"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking..." : "Verify me"}
      </Button>
    </form>
  );
}
