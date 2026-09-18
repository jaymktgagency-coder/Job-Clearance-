/**
 * job-filters.ts — the seeker's Category and Location filters, and the one
 * place that knows how they are remembered.
 *
 * Plain English: a seeker sets a filter, clicks into a role, asks for an
 * intro, and comes back to the list. The filters are still set. That is the
 * whole requirement, and it is harder than it sounds because every one of
 * those steps is a fresh page from the server.
 *
 * HOW IT IS REMEMBERED
 * Two things, doing different jobs:
 *
 *   1. The address bar. `/jobs?category=retail` is the honest state of the
 *      page — the back button works, a filtered list can be bookmarked or
 *      sent to somebody, and refreshing does not lose it.
 *   2. A cookie, written whenever the filters change. This is what covers
 *      coming back by a route that carries no address — tapping "Roles" in
 *      the header, or arriving from the dashboard.
 *
 * The address bar wins whenever it says anything, so the cookie can never
 * overrule a filter somebody has just set. The cookie is only consulted when
 * the address bar is silent.
 *
 * It is a SESSION cookie — no expiry date — so it lasts as long as the
 * browser is open and is gone afterwards. "Persist across the session" is
 * exactly what was asked for, and a filter silently still applied a week
 * later is a support ticket about missing jobs.
 */

/** The name in the address bar and in the cookie. Written once, used everywhere. */
export const FILTER_KEYS = ["category", "location"] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** What the filters are set to. An absent key means "no filter". */
export type JobFilters = Partial<Record<FilterKey, string>>;

export const FILTER_COOKIE = "vouch_job_filters";

/** The value meaning "don't filter on this". Kept out of the address bar. */
export const ANY = "";

/**
 * Reads the filters out of whatever the page was given.
 *
 * Anything that is not a non-empty string is dropped, so a hand-typed
 * `?category=` or `?category[]=x` cannot produce a filter that matches
 * nothing and looks like an empty job board.
 */
export function filtersFromParams(
  params: Record<string, string | string[] | undefined>,
): JobFilters {
  const out: JobFilters = {};
  for (const key of FILTER_KEYS) {
    const raw = params[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) out[key] = value;
  }
  return out;
}

/** The same, from the cookie's stored value. Never throws on rubbish. */
export function filtersFromCookie(raw: string | undefined): JobFilters {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return filtersFromParams(parsed as Record<string, string>);
  } catch {
    // A cookie somebody has edited by hand, or one written by an older
    // version of this code. Not worth an error; no filters is a fine answer.
    return {};
  }
}

/** True when nothing is being filtered. */
export function noFilters(filters: JobFilters): boolean {
  return FILTER_KEYS.every((k) => !filters[k]);
}

/**
 * The filters as a query string: "?category=retail", or "" when there are
 * none. Used to build links that carry the filters with them.
 */
export function filtersToQuery(filters: JobFilters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

/** The link back to the job list that keeps whatever was filtered. */
export function jobsHref(filters: JobFilters): string {
  return `/jobs${filtersToQuery(filters)}`;
}
