/**
 * job-filters.tsx — the Category and Location dropdowns above the job list.
 *
 * Plain English: two dropdowns. Changing one reloads the list, puts the
 * choice in the address bar, and writes it to a cookie so it is still set
 * when the seeker comes back from looking at a role.
 *
 * There is no "Apply" button. Two dropdowns are not a form worth submitting;
 * making somebody choose and then press is a step that exists only because it
 * was easier to build.
 *
 * `router.replace` rather than `push`, deliberately: pushing would put every
 * intermediate filter on the history stack, so a seeker who tried four
 * categories would need four taps of Back to leave the page.
 */

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  FILTER_COOKIE,
  filtersToQuery,
  type JobFilters as FilterState,
} from "@/lib/job-filters";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type FilterOption = { value: string; label: string };

/**
 * Clears the filters from the empty-state card.
 *
 * It has to be a button rather than a link to `/jobs`: the cookie is what
 * makes filters survive navigation, so a plain link would land on /jobs, find
 * the remembered filters still in the cookie, and put them straight back —
 * the "Clear the filters" button would visibly do nothing.
 */
export function ClearFiltersButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      className={className}
      loading={pending}
      onClick={() => {
        remember({});
        startTransition(() => router.replace("/jobs", { scroll: false }));
      }}
    >
      Clear the filters
    </Button>
  );
}

/**
 * Remembers the filters for the rest of this browser session.
 *
 * No `max-age`, which is what makes it a session cookie: the browser drops it
 * when it closes. `SameSite=Lax` so it is not sent from other people's sites.
 * Nothing secret is in here — it is two words about what somebody is looking
 * for — so it does not need to be locked down further than that.
 */
function remember(filters: FilterState) {
  try {
    const value = encodeURIComponent(JSON.stringify(filters));
    document.cookie = `${FILTER_COOKIE}=${value}; path=/; SameSite=Lax`;
  } catch {
    // Cookies turned off. The address bar still carries the filters, so the
    // page works — it just forgets when you come back by a route without one.
  }
}

export function JobFilters({
  filters,
  categories,
  locations,
  resultCount,
}: {
  filters: FilterState;
  categories: FilterOption[];
  locations: FilterOption[];
  resultCount: number;
}) {
  const router = useRouter();
  // Marks the moment between choosing and the new list arriving, so the
  // dropdowns can go quiet rather than looking like nothing happened.
  const [pending, startTransition] = useTransition();

  function change(next: FilterState) {
    remember(next);
    startTransition(() => {
      router.replace(`/jobs${filtersToQuery(next)}`, { scroll: false });
    });
  }

  const anySet = Boolean(filters.category || filters.location);

  return (
    <div
      className="mt-8 flex flex-wrap items-end gap-3"
      data-pending={pending ? "" : undefined}
    >
      <div className="min-w-44 flex-1 space-y-1.5 sm:max-w-56">
        <Label htmlFor="filter-category">Category</Label>
        <Select
          id="filter-category"
          value={filters.category ?? ""}
          disabled={pending}
          onChange={(e) =>
            change({ ...filters, category: e.currentTarget.value || undefined })
          }
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-44 flex-1 space-y-1.5 sm:max-w-56">
        <Label htmlFor="filter-location">Location</Label>
        <Select
          id="filter-location"
          value={filters.location ?? ""}
          disabled={pending}
          onChange={(e) =>
            change({ ...filters, location: e.currentTarget.value || undefined })
          }
        >
          <option value="">Anywhere</option>
          {locations.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>

      {anySet ? (
        <Button variant="ghost" className="px-3" onClick={() => change({})}>
          Clear
        </Button>
      ) : null}

      {/* Announced rather than shown: the count is already visible above the
          list, but a screen-reader user who changes a dropdown gets no other
          signal that the page beneath them has changed. */}
      <p className="sr-only" role="status">
        {pending
          ? "Updating roles."
          : `${resultCount} ${resultCount === 1 ? "role" : "roles"} match your filters.`}
      </p>
    </div>
  );
}
