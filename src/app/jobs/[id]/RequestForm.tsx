/** RequestForm.tsx — the "ask for an intro" form on a single role. */

"use client";

import { useActionState } from "react";
import { requestIntro, type RequestState } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function RequestForm({ jobId, atCap }: { jobId: string; atCap: boolean }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestIntro, { error: null });

  if (state.notice) {
    return (
      <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground" role="status">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="job_id" value={jobId} />

      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="message">A note to whoever reads this (optional)</Label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
          placeholder="Why this role, and anything that isn't obvious from your profile."
        />
      </div>

      <Button type="submit" disabled={pending || atCap}>
        {pending ? "Sending..." : "Ask for an intro"}
      </Button>

      {atCap ? (
        <p className="text-sm text-muted-foreground">
          You already have 5 open requests, which is the limit. Withdraw one first.
        </p>
      ) : null}
    </form>
  );
}
