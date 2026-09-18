/**
 * LocationForm.tsx — adding or editing one place.
 *
 * The ZIP is the field that matters and the copy says why: it is what a job
 * seeker's "within 25 miles" search measures from, and a role at a place with
 * no ZIP simply will not appear in one.
 */

"use client";

import { useActionState } from "react";

import { saveLocation, type LocationState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LocationValues = {
  id?: string;
  label: string;
  address_line1: string;
  city: string;
  region: string;
  postal_code: string;
};

export function LocationForm({
  values,
  onDoneLabel = "Add this place",
}: {
  values?: LocationValues;
  onDoneLabel?: string;
}) {
  const [state, action, pending] = useActionState<LocationState, FormData>(
    saveLocation,
    { error: null },
  );

  return (
    <form action={action} className="space-y-5">
      {values?.id ? (
        <input type="hidden" name="location_id" value={values.id} />
      ) : null}

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
        <Label htmlFor={`label-${values?.id ?? "new"}`}>What you call it</Label>
        <Input
          id={`label-${values?.id ?? "new"}`}
          name="label"
          defaultValue={values?.label ?? ""}
          placeholder="Ballard store"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`addr-${values?.id ?? "new"}`}>Street address (optional)</Label>
        <Input
          id={`addr-${values?.id ?? "new"}`}
          name="address_line1"
          defaultValue={values?.address_line1 ?? ""}
          placeholder="2208 NW Market St"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`city-${values?.id ?? "new"}`}>Town or city</Label>
          <Input
            id={`city-${values?.id ?? "new"}`}
            name="city"
            defaultValue={values?.city ?? ""}
            placeholder="Seattle"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`region-${values?.id ?? "new"}`}>State</Label>
          <Input
            id={`region-${values?.id ?? "new"}`}
            name="region"
            defaultValue={values?.region ?? ""}
            maxLength={2}
            placeholder="WA"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`zip-${values?.id ?? "new"}`}>ZIP code</Label>
        <Input
          id={`zip-${values?.id ?? "new"}`}
          name="postal_code"
          inputMode="numeric"
          maxLength={5}
          defaultValue={values?.postal_code ?? ""}
          placeholder="98107"
        />
        <p className="text-sm text-muted-foreground">
          This is the one that matters. Job seekers search by how far a role is
          from them, and a role here won&apos;t show up in that search without
          a ZIP.
        </p>
      </div>

      <Button type="submit" loading={pending}>
        {onDoneLabel}
      </Button>
    </form>
  );
}
