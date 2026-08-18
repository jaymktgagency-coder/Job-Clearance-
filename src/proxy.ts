/**
 * proxy.ts — runs on the server before every page loads.
 *
 * Plain English: logins expire. This file quietly refreshes the visitor's
 * login cookie on each request so people don't get randomly logged out.
 * (In older Next.js tutorials this file was called `middleware.ts`; Next.js 16
 * renamed it to `proxy.ts`. Same job, new name.)
 *
 * Right now it ONLY refreshes the session. Deciding who is allowed to see
 * which page comes later, in Step 3 (auth + onboarding).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSet } from "@/lib/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If Supabase keys aren't filled in yet, do nothing. This keeps the site
  // (and the /setup helper page) working before you've pasted your keys.
  if (
    !isSet("NEXT_PUBLIC_SUPABASE_URL") ||
    !isSet("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write the refreshed cookie onto both the request (so the page we're
          // about to render sees it) and the response (so the browser keeps it).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Asking for the user is what triggers the refresh. We ignore the result.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip Next.js internals, images, and static files — this only needs to run
  // for real pages.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
