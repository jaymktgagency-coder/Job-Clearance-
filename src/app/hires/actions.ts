/**
 * hires/actions.ts — recording that a job ended.
 *
 * Plain English: the 60-day hold on a voucher's payout only means anything if
 * somebody records when a hire actually left. This is that flow, and it is
 * shared by both sides because either of them can start it.
 *
 * The shape is deliberately the same as confirming the hire in the first
 * place: one side says it, the other agrees, and only then does anything
 * happen to the money. That is not politeness — the employer has $250 to
 * $1,000 of reason to say someone left before day 60, and the person who left
 * has no reason to say so at all. Neither gets to decide alone.
 *
 * Everything here is checked again by the database underneath (migration
 * 0009), so a mistake in this file cannot move money on its own.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SeparationState = { error: string | null; notice?: string | null };

/** Refreshes every screen that shows a hire, whichever side did the thing. */
function refresh() {
  revalidatePath("/requests");
  revalidatePath("/employer/jobs");
  revalidatePath("/dashboard");
}

/** Turns a database message into something worth reading. */
function readable(message: string): string {
  if (message.includes("already been reported")) {
    return "Somebody has already reported that this job ended. Confirm it or dispute it below.";
  }
  if (message.includes("not confirmed yet")) {
    return "This hire hasn't been confirmed by both sides yet, so there's nothing to end.";
  }
  if (message.includes("separation_claim_after_start")) {
    return "The last day can't be before the start date.";
  }
  return message;
}

/**
 * "They left" / "I left". Records the claim and counts as the reporter's own
 * half of it. Nothing moves until the other side agrees.
 */
export async function reportSeparation(
  _prev: SeparationState,
  formData: FormData,
): Promise<SeparationState> {
  const hireId = String(formData.get("hire_id") ?? "");
  const lastDay = String(formData.get("last_day") ?? "").trim();

  if (!hireId) return { error: "We couldn't tell which hire that was." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) {
    return { error: "Please give the last day they worked." };
  }
  if (lastDay > new Date().toISOString().slice(0, 10)) {
    return { error: "That date is in the future. Tell us once it's happened." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "You're not signed in any more. Please sign in again." };

  const { error } = await supabase
    .from("hires")
    .update({
      separation_reported_by: auth.user.id,
      separation_reported_at: new Date().toISOString(),
      separation_claimed_date: lastDay,
    })
    .eq("id", hireId);

  if (error) return { error: readable(error.message) };

  refresh();
  return {
    error: null,
    notice:
      "Recorded. We've asked the other side to confirm it — nothing changes until they do. " +
      "If they don't answer within 7 days, a person here will look at it.",
  };
}

/** The other side agreeing. This is the click that actually moves the money. */
export async function confirmSeparation(formData: FormData): Promise<void> {
  const hireId = String(formData.get("hire_id") ?? "");
  const side = String(formData.get("side") ?? "");
  if (!hireId) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  // Each side may only write its own column; the database enforces that too.
  const column =
    side === "employer"
      ? "separation_confirmed_by_employer_at"
      : "separation_confirmed_by_seeker_at";

  await supabase
    .from("hires")
    .update({ [column]: new Date().toISOString() })
    .eq("id", hireId);

  refresh();
}

/**
 * "No, that isn't right."
 *
 * Goes through a database function rather than a plain update, because the
 * column it sets is deliberately not writable from a login. The function
 * checks the person disputing is actually one of the two people involved.
 */
export async function disputeSeparation(
  _prev: SeparationState,
  formData: FormData,
): Promise<SeparationState> {
  const hireId = String(formData.get("hire_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!hireId) return { error: "We couldn't tell which hire that was." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("dispute_separation", {
    p_hire_id: hireId,
    p_note: note || null,
  });

  if (error) return { error: readable(error.message) };

  refresh();
  return {
    error: null,
    notice:
      "Thank you — we've marked this as disputed and nothing will move. A person here will " +
      "get in touch with both of you.",
  };
}
