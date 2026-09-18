/**
 * JobCategoryPicker.tsx — filing an already-posted role under a category.
 *
 * Plain English: a small dropdown on each role in the employer's list. Choose
 * a category and it saves immediately — there is no Save button, because one
 * dropdown is not a form.
 *
 * This exists because the picker on the "post a role" form only helps roles
 * posted after categories existed. Every role posted before that had no way
 * of getting one, which left the seeker's Category filter with nothing to
 * offer and looking broken.
 */

"use client";

import { useRef, useTransition } from "react";

import { setJobCategory } from "../actions";
import { Select } from "@/components/ui/select";

export function JobCategoryPicker({
  jobId,
  current,
  categories,
}: {
  jobId: string;
  current: string | null;
  categories: { slug: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form ref={formRef} action={setJobCategory} className="flex items-center gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <label htmlFor={`cat-${jobId}`} className="text-sm text-muted-foreground">
        Category
      </label>
      <Select
        id={`cat-${jobId}`}
        name="category"
        defaultValue={current ?? ""}
        disabled={pending}
        className="h-9 w-auto min-w-44 text-sm"
        onChange={() => startTransition(() => formRef.current?.requestSubmit())}
      >
        <option value="">Not set</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
