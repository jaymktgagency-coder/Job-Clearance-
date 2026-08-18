/**
 * auth.ts — "who is logged in, and what are they?"
 *
 * Plain English: nearly every page needs to know three things — is anyone
 * logged in, have they finished signing up, and which of the three roles are
 * they. This file answers all three in one place so no page has to work it out
 * for itself.
 */

import { createClient } from "@/lib/supabase/server";

export type Role = "seeker" | "voucher" | "employer";

/** The Vouch profile row that sits alongside the Supabase login. */
export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  email: string;
};

/** The logged-in person, or null. Cheap — no database round trip. */
export async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * The person's Vouch profile. Null means one of two things: nobody is logged
 * in, or they signed up but haven't finished onboarding yet.
 */
export async function currentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, role, full_name, email")
    .eq("id", auth.user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

/**
 * The role someone picked at sign-up, before their profile row exists.
 * Stored on the login itself so it survives the email-confirmation round trip.
 */
export function pendingRole(metadata: Record<string, unknown> | undefined): Role | null {
  const role = metadata?.role;
  return role === "seeker" || role === "voucher" || role === "employer" ? role : null;
}

/** The invite token someone arrived with, if any. Same storage trick. */
export function pendingInviteToken(metadata: Record<string, unknown> | undefined): string | null {
  const token = metadata?.invite_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/** Human-readable labels, so the three roles read the same way everywhere. */
export const ROLE_LABEL: Record<Role, string> = {
  seeker: "Job seeker",
  voucher: "Voucher",
  employer: "Employer",
};
