/**
 * voucher/seekers/actions.ts — a voucher writing to a seeker first.
 *
 * Plain English: this is the other direction of the marketplace. Everything
 * that decides WHO may be written to lives in the database, in
 * `protect_outreach_insert` (migration 0015), not here. This file's job is to
 * pass the attempt along and turn whatever the database says back into a
 * sentence a person can act on.
 *
 * That split is deliberate and matches the rest of the project: a rule
 * enforced in a server action is a rule a future screen can forget to apply.
 * A rule enforced by a trigger cannot be forgotten.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MIN_OUTREACH_CHARS } from "@/lib/outreach";

export type OutreachState = { error: string | null; notice?: string | null };

export async function sendOutreach(
  _prev: OutreachState,
  formData: FormData,
): Promise<OutreachState> {
  const seekerId = String(formData.get("seeker_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!seekerId) return { error: "We couldn't tell who that was meant for." };
  if (message.length < MIN_OUTREACH_CHARS) {
    return {
      error: `Please write at least ${MIN_OUTREACH_CHARS} characters. A first message worth answering says who you are and why you're writing.`,
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "You're not signed in any more. Please sign in again." };

  // `company_id` is NOT NULL on the table but is overwritten by the guard
  // with the sender's own verified employer, so whatever is sent here cannot
  // matter. The placeholder exists only to satisfy the column.
  const { error } = await supabase.from("voucher_outreach").insert({
    voucher_id: auth.user.id,
    seeker_id: seekerId,
    company_id: "00000000-0000-0000-0000-000000000000",
    message,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already reached out to this person once." };
    }
    // These arrive already written for a human, straight from the guard.
    if (
      error.message.includes("only reach out to people") ||
      error.message.includes("not currently open") ||
      error.message.includes("approaches waiting") ||
      error.message.includes("Only a verified voucher")
    ) {
      return { error: error.message };
    }
    if (error.code === "23503") {
      // The placeholder reaching the foreign key means the guard never ran,
      // which would mean migration 0015 is not applied to this database.
      return {
        error: "We couldn't send that — the outreach rules aren't set up on this database yet.",
      };
    }
    return { error: `We couldn't send that: ${error.message}` };
  }

  revalidatePath("/voucher/seekers");
  return {
    error: null,
    notice: "Sent. They'll see it on their requests page and can accept or decline.",
  };
}

/** Taking it back. The guard allows the voucher this one status and no other. */
export async function withdrawOutreach(formData: FormData): Promise<void> {
  const id = String(formData.get("outreach_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("voucher_outreach")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("voucher_id", auth.user.id)
    .eq("status", "pending");

  revalidatePath("/voucher/seekers");
}
