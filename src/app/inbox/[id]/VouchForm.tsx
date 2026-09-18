/**
 * VouchForm.tsx — writing the vouch, or declining.
 *
 * The character counter isn't decoration: a vouch has a minimum length on
 * purpose, so the writer can see how far they have to go rather than being
 * refused after they hit send.
 */

"use client";

import { useActionState, useState } from "react";
import { CoinsIcon } from "lucide-react";

import { writeVouch, declineRequest, type VouchState } from "../actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

        <FormError>{state.error}</FormError>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">
            Which is this? {seekerName}&apos;s employer will be told either way.
          </legend>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
            <input type="radio" name="relationship" value="knows_personally" className="mt-0.5 size-4 accent-brand-500" required />
            <span>
              <span className="block text-sm font-semibold">I know this person</span>
              <span className="block text-sm text-muted-foreground">
                You&apos;ve worked with them, or know them well enough to speak to how
                they work.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
            <input type="radio" name="relationship" value="reviewed_profile_only" className="mt-0.5 size-4 accent-brand-500" required />
            <span>
              <span className="block text-sm font-semibold">
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
          <Textarea
            id="body"
            name="body"
            rows={8}
            required
            aria-describedby="vouch-length"
            onChange={(e) => setLength(e.target.value.trim().length)}
            className="min-h-48"
            placeholder="What did you notice? What would you want a hiring manager to look at? If you have doubts, say so — an honest vouch is worth more than a glowing one."
          />
          {/* aria-live so a screen reader hears the count catch up as it is
              typed, rather than only finding out on a rejected submit. */}
          <p
            id="vouch-length"
            aria-live="polite"
            className={`tabular text-sm ${short ? "font-medium text-destructive" : "text-muted-foreground"}`}
          >
            {length} characters
            {short
              ? ` — ${minimum - length} more needed`
              : ` (minimum ${minimum})`}
          </p>
        </div>

        {/* Rule six: every vouch discloses what the voucher stands to earn.
            Given its own panel rather than a grey aside, because a disclosure
            nobody reads is not a disclosure. */}
        <div className="flex items-start gap-3 rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
          <CoinsIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">The employer is shown all of this</p>
            <p className="mt-1 text-brand-800">
              Whether you know this person, your written vouch, and that you
              stand to earn{" "}
              <strong className="tabular font-semibold text-brand-900">
                {earns}
              </strong>{" "}
              if they are hired and stay 60 days. Paid endorsements only work
              when everyone knows they are paid.
            </p>
          </div>
        </div>

        <Button type="submit" size="lg" loading={pending}>
          Vouch for this person
        </Button>
      </form>

      <form action={declineRequest} className="border-t border-border pt-5">
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
