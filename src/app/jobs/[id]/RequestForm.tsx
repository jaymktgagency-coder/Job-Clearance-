/** RequestForm.tsx — the "ask for an intro" form on a single role. */

"use client";

import { useActionState } from "react";
import { requestIntro, type RequestState } from "../actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RequestForm({ jobId, atCap }: { jobId: string; atCap: boolean }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestIntro, { error: null });

  if (state.notice) {
    return (
      <p
        role="status"
        className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success"
      >
        {state.notice}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="job_id" value={jobId} />

      <FormError>{state.error}</FormError>

      <div className="space-y-2">
        <Label htmlFor="message">A note to whoever reads this (optional)</Label>
        <Textarea
          id="message"
          name="message"
          rows={3}
          maxLength={500}
          className="min-h-24"
          placeholder="Why this role, and anything that isn't obvious from your profile."
        />
      </div>

      <Button type="submit" size="lg" loading={pending} disabled={atCap}>
        Ask for an intro
      </Button>

      {atCap ? (
        <p className="text-sm text-muted-foreground">
          You already have 5 open requests, which is the limit. Withdraw one first.
        </p>
      ) : null}
    </form>
  );
}
