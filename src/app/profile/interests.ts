/**
 * profile/interests.ts — the seeker naming companies they want to work at.
 *
 * Plain English: adding a company here is what lets verified employees of
 * that company see your profile and write to you. It is a permission you are
 * granting, not a bookmark, and the form says so in those words.
 *
 * Removing a company takes the permission back straight away — the check
 * happens at the moment somebody tries to write to you, not when the list was
 * drawn, so there is no window where a removed company can still reach you.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InterestState = { error: string | null; notice?: string | null };

async function requireSeeker() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  return { supabase, user: auth.user };
}

export async function addCompanyInterest(
  _prev: InterestState,
  formData: FormData,
): Promise<InterestState> {
  const ctx = await requireSeeker();
  if (!ctx) return { error: "You're not signed in any more. Please sign in again." };

  const companyId = String(formData.get("company_id") ?? "").trim();
  if (!companyId) return { error: "Please choose a company first." };

  const { error } = await ctx.supabase.from("seeker_company_interests").insert({
    seeker_id: ctx.user.id,
    company_id: companyId,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That company is already on your list." };
    }
    // The cap's message is written for a human in the database itself, so it
    // is passed straight through rather than reworded here where the two
    // could drift apart.
    if (error.message.includes("already named")) return { error: error.message };
    return { error: `We couldn't add that: ${error.message}` };
  }

  revalidatePath("/profile");
  return { error: null, notice: "Added. Verified employees there can now see your profile." };
}

export async function removeCompanyInterest(formData: FormData): Promise<void> {
  const ctx = await requireSeeker();
  if (!ctx) return;

  const id = String(formData.get("interest_id") ?? "");
  if (!id) return;

  // The `eq` on seeker_id is belt and braces — the delete policy already
  // restricts this to your own rows — but it costs nothing and means a bug
  // here cannot become somebody else's problem.
  await ctx.supabase
    .from("seeker_company_interests")
    .delete()
    .eq("id", id)
    .eq("seeker_id", ctx.user.id);

  revalidatePath("/profile");
}
