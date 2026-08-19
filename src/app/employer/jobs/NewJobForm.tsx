/**
 * NewJobForm.tsx — posting a role.
 *
 * The fee is shown live as they pick the pay type, because the employer
 * should know what a hire will cost them before they post, not after.
 */

"use client";

import { useActionState, useState } from "react";
import { createJob, type JobState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewJobForm({
  locations,
  tier1,
  tier2,
}: {
  locations: { id: string; label: string }[];
  tier1: string;
  tier2: string;
}) {
  const [state, action, pending] = useActionState<JobState, FormData>(createJob, { error: null });
  const [payType, setPayType] = useState<"" | "hourly" | "salaried">("");

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Job title</Label>
        <Input id="title" name="title" placeholder="Barista" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What the job involves</Label>
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
          placeholder="Shifts, what a good week looks like, what you'll train and what you need them to arrive with."
        />
        <p className="text-sm text-muted-foreground">
          A voucher reads this before deciding whether to back someone for it.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">How is it paid?</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-muted/50">
          <input type="radio" name="pay_type" value="hourly" className="mt-1" required
                 onChange={() => setPayType("hourly")} />
          <span>
            <span className="block text-sm font-medium">Hourly</span>
            <span className="block text-sm text-muted-foreground">
              Retail, hospitality, warehouse, care — anything paid by the hour.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-muted/50">
          <input type="radio" name="pay_type" value="salaried" className="mt-1" required
                 onChange={() => setPayType("salaried")} />
          <span>
            <span className="block text-sm font-medium">Salaried</span>
            <span className="block text-sm text-muted-foreground">
              A yearly salary rather than an hourly rate.
            </span>
          </span>
        </label>
      </fieldset>

      {payType ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <strong className="font-medium">
            You&apos;ll pay {payType === "hourly" ? tier1 : tier2} — but only if you hire someone.
          </strong>{" "}
          Half goes to whoever vouched for them, released 60 days after they
          start. Nothing is charged for posting, and nothing if you don&apos;t hire.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pay_min">Pay from (optional)</Label>
          <Input id="pay_min" name="pay_min" inputMode="decimal"
                 placeholder={payType === "salaried" ? "65000" : "19.00"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay_max">Pay to (optional)</Label>
          <Input id="pay_max" name="pay_max" inputMode="decimal"
                 placeholder={payType === "salaried" ? "78000" : "23.00"} />
        </div>
      </div>

      {locations.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="location_id">Where is it?</Label>
          <select id="location_id" name="location_id" defaultValue=""
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="">No particular location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4">
        <input type="checkbox" name="publish" defaultChecked className="mt-1" />
        <span className="text-sm">
          <span className="block font-medium">Publish it now</span>
          <span className="mt-1 block text-muted-foreground">
            Seekers can see it and ask for intros straight away. Untick to save it
            as a draft.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Posting..." : "Post this role"}
      </Button>
    </form>
  );
}
