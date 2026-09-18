/**
 * CompanyInterests.tsx — the seeker's list of companies they want to work at.
 *
 * Plain English: pick a company, and verified employees there can see your
 * profile and write to you first.
 *
 * The wording is the important part of this file. This is a permission, not a
 * bookmark, and somebody who thinks they are saving a favourite and then gets
 * a message from a stranger has been misled by the screen. So it says who
 * will see them, exactly what those people will see, and what will stay
 * private — before they add anything, not in a help page.
 */

"use client";

import { useActionState } from "react";
import { XIcon } from "lucide-react";

import {
  addCompanyInterest,
  removeCompanyInterest,
  type InterestState,
} from "./interests";
import { Avatar } from "@/components/avatar";
import { FormError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type InterestRow = {
  id: string;
  company_id: string;
  note: string | null;
  company_name: string;
  company_logo: string | null;
};

export function CompanyInterests({
  interests,
  companies,
  openToWork,
}: {
  interests: InterestRow[];
  /** Every company on Vouch, minus the ones already on the list. */
  companies: { id: string; name: string }[];
  openToWork: boolean;
}) {
  const [state, action, pending] = useActionState<InterestState, FormData>(
    addCompanyInterest,
    { error: null },
  );

  return (
    <div className="space-y-5">
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.notice ? (
        <p
          role="status"
          className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          {state.notice}
        </p>
      ) : null}

      {/* If the global switch is off, say so here rather than letting somebody
          build a list that quietly does nothing. */}
      {!openToWork ? (
        <p className="rounded-lg bg-sunken px-4 py-3 text-sm">
          <strong className="font-semibold">
            You&apos;ve turned off &ldquo;open to work&rdquo; above.
          </strong>{" "}
          Your list is kept, but nobody can see you or write to you until you
          turn it back on.
        </p>
      ) : null}

      {interests.length > 0 ? (
        <ul className="space-y-2">
          {interests.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Avatar src={i.company_logo} name={i.company_name} size="sm" contain />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{i.company_name}</p>
                {i.note ? (
                  <p className="truncate text-sm text-muted-foreground">{i.note}</p>
                ) : null}
              </div>
              <form action={removeCompanyInterest}>
                <input type="hidden" name="interest_id" value={i.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  aria-label={`Remove ${i.company_name}`}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t named any companies yet.
        </p>
      )}

      {companies.length > 0 ? (
        <form action={action} className="space-y-3 border-t border-border pt-5">
          <div className="space-y-2">
            <Label htmlFor="company_id">Add a company</Label>
            <Select id="company_id" name="company_id" defaultValue="" required>
              <option value="">Choose a company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Anything they should know (optional)</Label>
            <Input
              id="note"
              name="note"
              maxLength={500}
              placeholder="I've been a barista two streets away for three years."
            />
          </div>

          <Button type="submit" loading={pending}>
            Add to my list
          </Button>
        </form>
      ) : (
        <p className="border-t border-border pt-5 text-sm text-muted-foreground">
          Every company on Vouch is already on your list.
        </p>
      )}
    </div>
  );
}
