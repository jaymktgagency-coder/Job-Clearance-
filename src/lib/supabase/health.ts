/**
 * supabase/health.ts — "is my Supabase project actually reachable?"
 *
 * Plain English: this makes one tiny request to your Supabase project and
 * translates whatever comes back into an English sentence, so the /setup page
 * can tell you exactly what's wrong instead of showing a code.
 *
 * We ask the login service for its public settings. That endpoint is a good
 * test because it proves two things at once: the URL points at a real project,
 * and the publishable key is accepted. (We deliberately do NOT use the
 * database's /rest/v1/ front door — modern Supabase requires the SECRET key
 * for that, so a perfectly good publishable key would look broken.)
 */

import { isSet } from "@/lib/env";

export type HealthResult = {
  ok: boolean;
  /** A short sentence you can act on. */
  message: string;
};

export async function checkSupabaseConnection(): Promise<HealthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (
    !isSet("NEXT_PUBLIC_SUPABASE_URL") ||
    !isSet("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  ) {
    return {
      ok: false,
      message:
        "Not tested yet — fill in your Supabase URL and publishable key first.",
    };
  }

  if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url.trim())) {
    return {
      ok: false,
      message: `Your NEXT_PUBLIC_SUPABASE_URL ("${url}") doesn't look right. It should look like https://abcdefgh.supabase.co with nothing after it.`,
    };
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/auth/v1/settings`,
      {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );

    if (response.ok) {
      return { ok: true, message: "Connected to Supabase successfully." };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message:
          "Reached your project, but the key was rejected. Re-copy the publishable key from Supabase → Project Settings → API Keys.",
      };
    }
    return {
      ok: false,
      message: `Reached your project but it answered with an unexpected status (${response.status}). Check that the project is not paused in the Supabase dashboard.`,
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not reach that address at all. Check the URL for typos, and check that your Supabase project isn't paused.",
    };
  }
}
