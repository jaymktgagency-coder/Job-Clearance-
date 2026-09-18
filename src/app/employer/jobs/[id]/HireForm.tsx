/**
 * HireForm.tsx — "we hired them", which needs a start date.
 */

"use client";

import { useActionState, useState } from "react";
import { reportHire, type CandidateState } from "../../actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HireForm({ applicationId, name }: { applicationId: string; name: string }) {
  const [state, action, pending] = useActionState<CandidateState, FormData>(reportHire, { error: null });
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

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        We hired {name.split(" ")[0]}
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-4 rounded-lg bg-sunken p-4">
      <input type="hidden" name="application_id" value={applicationId} />
      <FormError>{state.error}</FormError>
      <div className="space-y-2">
        <Label htmlFor={`start-${applicationId}`}>When do they start?</Label>
        <Input id={`start-${applicationId}`} name="start_date" type="date" required />
        <p className="text-sm text-muted-foreground">
          The fee is due on a hire, and the voucher&apos;s share releases 60 days
          after this date. We&apos;ll ask {name.split(" ")[0]} to confirm too —
          nothing is owed until they do.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Confirm the hire
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
