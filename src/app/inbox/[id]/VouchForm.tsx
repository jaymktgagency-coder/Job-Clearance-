/**
 * VouchForm.tsx — writing the vouch, or declining.
 *
 * The character counter isn't decoration: a vouch has a minimum length on
 * purpose, so the writer can see how far they have to go rather than being
 * refused after they hit send.
 */

"use client";

import { useActionState, useState } from "react";
import { writeVouch, declineRequest, type VouchState } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function VouchForm({
  requestId,
  minimum,
  earns,
  seekerName,
}: {
  requestId: string;
  minimum: number;
  earns: string;
  seekerName: string;
}) {
  const [state, action, pending] = useActionState<VouchState, FormData>(writeVouch, { error: null });
  const [length, setLength] = useState(0);
  const short = length > 0 && length < minimum;

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5">
        <input type="hidden" name="request_id" value={requestId} />

        {state.error ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">
            Which is this? {seekerName}&apos;s employer will be told either way.
          </legend>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-muted/50">
            <input type="radio" name="relationship" value="knows_personally" className="mt-1" required />
            <span>
              <span className="block text-sm font-medium">I know this person</span>
              <span className="block text-sm text-muted-foreground">
                You&apos;ve worked with them, or know them well enough to speak to how
                they work.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-muted/50">
            <input type="radio" name="relationship" value="reviewed_profile_only" className="mt-1" required />
            <span>
              <span className="block text-sm font-medium">
                I&apos;ve only read their profile
              </span>
              <span className="block text-sm text-muted-foreground">
                Just as valuable, and completely normal — most people on Vouch have
                no network. Say what stood out and what you&apos;d want checked.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="body">Your vouch</Label>
          <textarea
            id="body"
            name="body"
            rows={8}
            required
            onChange={(e) => setLength(e.target.value.trim().length)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
            placeholder="What did you notice? What would you want a hiring manager to look at? If you have doubts, say so — an honest vouch is worth more than a glowing one."
          />
          <p className={`text-sm ${short ? "text-destructive" : "text-muted-foreground"}`}>
            {length} characters{short ? ` — ${minimum - length} more needed` : ` (minimum ${minimum})`}
          </p>
        </div>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Shown to the employer:</strong>{" "}
          whether you know this person, your written vouch, and that you stand to
          earn <strong className="text-foreground">{earns}</strong> if they&apos;re
          hired and stay 60 days. Paid endorsements only work when everyone knows
          they&apos;re paid.
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Vouch for this person"}
        </Button>
      </form>

      <form action={declineRequest} className="border-t pt-5">
        <input type="hidden" name="request_id" value={requestId} />
        <p className="text-sm text-muted-foreground">
          Not for you? Declining is normal and costs you nothing. They&apos;ll only
          see that nobody took it on.
        </p>
        <Button type="submit" variant="outline" size="sm" className="mt-3">
          Decline this request
        </Button>
      </form>
    </div>
  );
}
