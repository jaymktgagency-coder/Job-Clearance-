/**
 * OutreachForm.tsx — the voucher's first message to a seeker.
 *
 * Plain English: a short note saying who you are and why you're writing. It
 * opens closed rather than sitting on screen as an empty box beside every
 * person, which would turn the page into a mail-merge.
 */

"use client";

import { useActionState, useState } from "react";

import { sendOutreach, type OutreachState } from "./actions";
import { MIN_OUTREACH_CHARS } from "@/lib/outreach";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OutreachForm({
  seekerId,
  seekerName,
  companyName,
  atCap,
}: {
  seekerId: string;
  seekerName: string;
  companyName: string;
  /** True when this voucher already has the maximum unanswered approaches out. */
  atCap: boolean;
}) {
  const [state, action, pending] = useActionState<OutreachState, FormData>(
    sendOutreach,
    { error: null },
  );
  const [open, setOpen] = useState(false);

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

  if (atCap) {
    return (
      <p className="text-sm text-muted-foreground">
        You&apos;ve got the maximum number of messages waiting for an answer.
        One of them has to be answered, withdrawn or go stale before you can
        write to anybody else.
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Reach out to {seekerName.split(" ")[0]}
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="seeker_id" value={seekerId} />

      <FormError>{state.error}</FormError>

      <div className="space-y-2">
        <Label htmlFor={`message-${seekerId}`}>
          Your message to {seekerName.split(" ")[0]}
        </Label>
        <Textarea
          id={`message-${seekerId}`}
          name="message"
          rows={4}
          minLength={MIN_OUTREACH_CHARS}
          maxLength={1000}
          required
          className="min-h-28"
          placeholder={`Hello — I work at ${companyName} and saw you'd like to as well. We're short-staffed on mornings and I think you'd fit. Happy to vouch for you if you'd like to apply.`}
        />
        <p className="text-sm text-muted-foreground">
          They see your name, your job title and where you work. Say why you
          picked them — a message that could have been sent to anyone usually is.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Send
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
