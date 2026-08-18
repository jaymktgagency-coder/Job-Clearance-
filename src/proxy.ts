/**
 * proxy.ts — runs on the server before every page loads.
 *
 * Plain English: two jobs. First, logins expire, so this quietly refreshes
 * the visitor's login cookie on each request. Second, it keeps people out of
 * pages they shouldn't see — signed-out visitors can't reach the dashboard,
 * and signed-in people don't get shown the sign-up form again.
 *
 * (In older Next.js tutorials this file was called `middleware.ts`; Next.js 16
 * renamed it to `proxy.ts`. Same job, new name.)
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

  // Asking for the user is what triggers the refresh — and tells us whether
  // anyone is signed in.
  const { data } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user);
  const path = request.nextUrl.pathname;

  // Pages that only make sense once you are signed in.
  const needsAccount = path.startsWith("/dashboard") || path.startsWith("/onboarding");
  if (needsAccount && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // No point showing the sign-up form to someone already signed in.
  if (signedIn && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip Next.js internals, images, and static files — this only needs to run
  // for real pages.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
