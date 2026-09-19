/**
 * admin.ts — who is allowed to work the platform's own queues.
 *
 * Plain English: some jobs are Vouch's, not a customer's. Sending a voucher
 * the money they are owed is one of them. This file answers one question —
 * "is the person looking at this screen allowed to do that?" — and nothing on
 * an admin screen should decide it any other way.
 *
 * IT IS AN ENVIRONMENT VARIABLE, NOT A ROLE IN THE DATABASE
 * `users.role` is seeker, voucher or employer, and there is deliberately no
 * fourth value. An admin flag living in a table is a row somebody might one
 * day be able to write; a list in Vercel's settings is not reachable from any
 * login at all.
 *
 * IT KEYS ON THE AUTH USER ID, AND THIS PART IS LOAD-BEARING
 * Not the email. `public.users` has `users_update_self`, an UPDATE policy with
 * no column restriction, so a logged-in person may rewrite their own row —
 * including `email` and `role`. That was proven against a real database from
 * an ordinary seeker's login: they set `email` to the founder's address and
 * `role` to employer, and both landed. An allowlist on `users.email` would
 * therefore be a promotion anybody could grant themselves in one UPDATE.
 *
 * The email on the LOGIN (`auth.users`) survived that attack — but Supabase
 * email confirmation is currently switched off on this project, so a person
 * can change their login's address without proving they own the new one.
 * Until that is turned back on, an email is not an identity here either.
 *
 * The auth user id is. It is the subject of the signed JWT, minted by
 * Supabase, and nothing a login can write changes it.
 *
 * NOBODY IS AN ADMIN UNTIL SOMEBODY IS NAMED
 * An unset or empty ADMIN_USER_IDS means the list is empty, not that the door
 * is open. Same posture as CRON_SECRET and STRIPE_WEBHOOK_SECRET: a missing
 * setting refuses, it never waves things through.
 */

import { createClient } from "@/lib/supabase/server";

/**
 * The ids named in ADMIN_USER_IDS.
 *
 * Comma or whitespace separated, so a founder pasting from anywhere gets the
 * same result. Lowercased because a UUID written in capitals is the same UUID.
 */
export function adminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(/[\s,]+/)
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

/** True when at least one admin has been named. */
export function adminIsConfigured(): boolean {
  return adminUserIds().length > 0;
}

/** Is this particular auth user id on the list? */
export function isAdminUserId(id: string | null | undefined): boolean {
  if (!id) return false;
  return adminUserIds().includes(id.trim().toLowerCase());
}

export type AdminCheck = {
  /** The signed-in person's auth user id, or null if nobody is signed in. */
  userId: string | null;
  /** True only when they are signed in AND named in ADMIN_USER_IDS. */
  isAdmin: boolean;
  /** True when nobody has been named yet, so the first-run screen applies. */
  unconfigured: boolean;
};

/**
 * Who is looking, and may they act.
 *
 * Reads the id from Supabase Auth rather than from `public.users`, for the
 * reason in this file's header: the profile row is writable by the person it
 * belongs to, and the login is not.
 */
export async function adminCheck(): Promise<AdminCheck> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;

  return {
    userId,
    isAdmin: isAdminUserId(userId),
    unconfigured: !adminIsConfigured(),
  };
}
