/** The company's own details: name, website, and what they do. */

"use client";

import { useActionState } from "react";

import { saveCompany, type CompanyState } from "./actions";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CompanyForm({
  values,
}: {
  values: { name: string; website: string; description: string };
}) {
  const [state, action, pending] = useActionState<CompanyState, FormData>(
    saveCompany,
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
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" defaultValue={values.name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          defaultValue={values.website}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What you do</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={values.description}
          placeholder="Two or three sentences a job seeker would want to read."
        />
      </div>

      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  );
}
