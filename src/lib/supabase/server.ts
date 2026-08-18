/**
 * supabase/server.ts — the Supabase connection used on the SERVER.
 *
 * Plain English: most Vouch pages are rendered on the server before being sent
 * to the visitor. Those pages use this file to talk to Supabase. It reads the
 * login cookie from the incoming request so Supabase knows who is logged in.
 *
 * Note: `cookies()` must be awaited in this version of Next.js, which is why
 * every function here is async.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicConfig, supabaseSecretKey } from "@/lib/env";

/**
 * The normal server connection: acts as whoever is currently logged in.
 * Use this in pages, layouts, server actions, and route handlers.
 */
export async function createClient() {
  const { url, key } = supabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      // Hand Supabase the cookies that came in with the request.
      getAll() {
        return cookieStore.getAll();
      },
      // Let Supabase refresh the login cookie when it expires.
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Next.js doesn't allow setting cookies while rendering a page.
          // That's fine: src/proxy.ts already refreshes the session on every
          // request, so we can safely ignore this.
        }
      },
    },
  });
}

/**
 * The admin connection: ignores all security rules and can see everything.
 * Only for trusted server jobs (e.g. the seed script in Step 2).
 * Never use this to serve data straight to a visitor.
 */
export async function createAdminClient() {
  const { url } = supabasePublicConfig();

  return createServerClient(url, supabaseSecretKey(), {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // An admin connection has no user session, so there are no cookies.
      },
    },
  });
}
