/**
 * HireForm.tsx — "we hired them", which needs a start date.
 */

"use client";

import { useActionState, useState } from "react";
import { reportHire, type CandidateState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HireForm({ applicationId, name }: { applicationId: string; name: string }) {
  const [state, action, pending] = useActionState<CandidateState, FormData>(reportHire, { error: null });
  const [open, setOpen] = useState(false);

  if (state.notice) {
    return (
      <p role="status" className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
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
    <form action={action} className="space-y-3 rounded-md border p-3">
      <input type="hidden" name="application_id" value={applicationId} />
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`start-${applicationId}`}>When do they start?</Label>
        <Input id={`start-${applicationId}`} name="start_date" type="date" required />
        <p className="text-sm text-muted-foreground">
          The fee is due on a hire, and the voucher&apos;s share releases 60 days
          after this date. We&apos;ll ask {name.split(" ")[0]} to confirm too.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording..." : "Confirm the hire"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
