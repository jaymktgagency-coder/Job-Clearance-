/**
 * requests/outreach-actions.ts — the seeker answering somebody who wrote first.
 *
 * Plain English: accept or decline. Both are final, and the database is what
 * makes them final — `protect_outreach_columns` reverts any later change,
 * so a double tap is a no-op rather than an error.
 *
 * Accepting is not itself an application. It unlocks the seeker asking for an
 * intro on one of that company's roles, which is an ordinary intro request
 * and goes through every existing rule about caps, vouches, fees and hires
 * without a single one of them being changed.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function answer(id: string, status: "accepted" | "declined"): Promise<void> {
  if (!id) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("voucher_outreach")
    .update({ status })
    .eq("id", id)
    .eq("seeker_id", auth.user.id)
    .eq("status", "pending");

  revalidatePath("/requests");
}

export async function acceptOutreach(formData: FormData): Promise<void> {
  await answer(String(formData.get("outreach_id") ?? ""), "accepted");
}

export async function declineOutreach(formData: FormData): Promise<void> {
  await answer(String(formData.get("outreach_id") ?? ""), "declined");
}
