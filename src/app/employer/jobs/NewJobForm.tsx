/**
 * NewJobForm.tsx — posting a role.
 *
 * The fee is shown live as they pick the pay type, because the employer
 * should know what a hire will cost them before they post, not after.
 */

"use client";

import { useActionState, useState } from "react";
import { CoinsIcon } from "lucide-react";
import { createJob, type JobState } from "../actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function NewJobForm({
  locations,
  categories,
  tier1,
  tier2,
}: {
  locations: { id: string; label: string }[];
  /** The Category filter's options, from the job_categories table. */
  categories: { slug: string; label: string }[];
  tier1: string;
  tier2: string;
}) {
  const [state, action, pending] = useActionState<JobState, FormData>(createJob, { error: null });
  const [payType, setPayType] = useState<"" | "hourly" | "salaried">("");

  return (
    <form action={action} className="space-y-5">
      <FormError>{state.error}</FormError>

      <div className="space-y-2">
        <Label htmlFor="title">Job title</Label>
        <Input id="title" name="title" placeholder="Barista" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What the job involves</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          required
          placeholder="Shifts, what a good week looks like, what you'll train and what you need them to arrive with."
        />
        <p className="text-sm text-muted-foreground">
          A voucher reads this before deciding whether to back someone for it.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">How is it paid?</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
          <input type="radio" name="pay_type" value="hourly" className="mt-0.5 size-4 accent-brand-500" required
                 onChange={() => setPayType("hourly")} />
          <span>
            <span className="block text-sm font-semibold">Hourly</span>
            <span className="block text-sm text-muted-foreground">
              Retail, hospitality, warehouse, care — anything paid by the hour.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
          <input type="radio" name="pay_type" value="salaried" className="mt-0.5 size-4 accent-brand-500" required
                 onChange={() => setPayType("salaried")} />
          <span>
            <span className="block text-sm font-semibold">Salaried</span>
            <span className="block text-sm text-muted-foreground">
              A yearly salary rather than an hourly rate.
            </span>
          </span>
        </label>
      </fieldset>

      {/* The fee, stated before they post rather than after. It is read live
          from platform_settings by the page above, never hardcoded here. */}
      {payType ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg bg-brand-50 p-4 text-sm text-brand-900"
        >
          <CoinsIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              You&apos;ll pay{" "}
              <span className="tabular">
                {payType === "hourly" ? tier1 : tier2}
              </span>{" "}
              — but only if you hire someone.
            </p>
            <p className="mt-1 text-brand-800">
              Half goes to whoever vouched for them, released 60 days after they
              start. Nothing is charged for posting, and nothing if you
              don&apos;t hire.
            </p>
          </div>
        </div>
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

      {categories.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="category">What kind of work is it?</Label>
          <Select id="category" name="category" defaultValue="">
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">
            This is how job seekers filter the list. A role with no category
            still gets posted, but it will not show up when somebody narrows
            their search.
          </p>
        </div>
      ) : null}

      {locations.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="location_id">Where is it?</Label>
          <Select id="location_id" name="location_id" defaultValue="">
            <option value="">No particular location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-[160ms] ease-out hover:border-brand-300 hover:bg-brand-50/50 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:shadow-raised">
        <input type="checkbox" name="publish" defaultChecked className="mt-0.5 size-4 accent-brand-500" />
        <span className="text-sm">
          <span className="block font-semibold">Publish it now</span>
          <span className="mt-1 block text-muted-foreground">
            Seekers can see it and ask for intros straight away. Untick to save it
            as a draft.
          </span>
        </span>
      </label>

      <Button type="submit" size="lg" loading={pending}>
        Post this role
      </Button>
    </form>
  );
}
