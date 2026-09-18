/** The voucher's own details. Name and job title; nothing that confers trust. */

"use client";

import { useActionState } from "react";

import { saveVoucherProfile, type VoucherProfileState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VoucherProfileForm({
  values,
}: {
  values: { full_name: string; job_title: string };
}) {
  const [state, action, pending] = useActionState<VoucherProfileState, FormData>(
    saveVoucherProfile,
    { error: null },
  );

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.notice ? (
        <p
          role="status"
          className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          {state.notice}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="full_name">Your name</Label>
        <Input id="full_name" name="full_name" defaultValue={values.full_name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="job_title">Your job title</Label>
        <Input
          id="job_title"
          name="job_title"
          defaultValue={values.job_title}
          placeholder="Shift supervisor"
        />
        <p className="text-sm text-muted-foreground">
          Shown to an employer beside your vouch, so they can see the vouch
          came from somebody who would know.
        </p>
      </div>

      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  );
}
