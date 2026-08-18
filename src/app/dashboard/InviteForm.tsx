/**
 * InviteForm.tsx — employer-side form that produces an invitation link.
 * The link is shown once, to copy and send. Step 4 will email it instead.
 */

"use client";

import { useActionState } from "react";
import { inviteVoucher, type InviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({ canInvite }: { canInvite: boolean }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteVoucher, {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.link ? (
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">Invitation ready for {state.email}</p>
          <p className="mt-1 text-muted-foreground">
            Send them this link. It works once and expires in 14 days.
          </p>
          <code className="mt-2 block break-all rounded bg-muted px-2 py-1 text-xs">
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

      <Button type="submit" disabled={pending || !canInvite}>
        {pending ? "Creating link..." : "Create invitation link"}
      </Button>
    </form>
  );
}
