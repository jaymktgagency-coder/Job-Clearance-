/**
 * InviteForm.tsx — employer-side form that produces an invitation link.
 * The link is shown once, to copy and send. Step 4 will email it instead.
 */

"use client";

import { useActionState } from "react";
import { inviteVoucher, type InviteState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({ canInvite }: { canInvite: boolean }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteVoucher, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <FormError>{state.error}</FormError>

      {state.link ? (
        <div role="status" className="rounded-lg bg-brand-50 p-4 text-sm">
          <p className="font-semibold text-brand-900">
            Invitation ready for {state.email}
          </p>
          <p className="mt-1 text-brand-800">
            Send them this link. It works once and expires in 14 days.
          </p>
          {/* Selectable, wrapping, and in the mono face — this is the one
              place in the product where a person has to copy a long string
              by hand without dropping a character. */}
          <code className="mt-3 block rounded-md bg-card px-3 py-2 font-mono text-xs break-all select-all">
            {state.link}
          </code>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="invite_email">Invite someone who works here</Label>
        <Input
          id="invite_email"
          name="email"
          type="email"
          placeholder="colleague@example.com"
          required
          disabled={!canInvite}
        />
      </div>

      <Button type="submit" loading={pending} disabled={!canInvite}>
        Create invitation link
      </Button>
    </form>
  );
}
