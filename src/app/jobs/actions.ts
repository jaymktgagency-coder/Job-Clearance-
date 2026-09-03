/**
 * jobs/actions.ts — asking for an intro, and taking the request back.
 *
 * Plain English: a seeker picks a role and asks for a vouch. The cap of five
 * open requests is enforced by the database itself, so this just passes the
 * database's own explanation back to the screen rather than re-implementing
 * the rule and risking the two disagreeing.
 */

"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripeIsConfigured } from "@/lib/stripe/client";
import { collectFeeForHire } from "@/lib/stripe/charges";
import { notifyVoucherOfPayout } from "@/lib/payout-emails";

export type RequestState = { error: string | null; notice?: string | null };

export async function requestIntro(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const jobId = String(formData.get("job_id") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (!jobId) return { error: "We couldn't tell which role that was." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "You're not signed in any more. Please sign in again." };

  const { error } = await supabase.from("intro_requests").insert({
    job_id: jobId,
    seeker_id: auth.user.id,
    message: message || null,
  });

  if (error) {
    // The database's cap message is already written for a human.
    if (error.message.includes("open intro requests")) return { error: error.message };
    if (error.code === "23505") {
      return { error: "You've already asked for an intro to this role." };
    }
    return { error: `We couldn't send that request: ${error.message}` };
  }

  revalidatePath("/requests");
  revalidatePath(`/jobs/${jobId}`);
  return {
    error: null,
    notice: "Request sent. A verified employee at that company will see it and decide whether to vouch for you.",
  };
}

export async function withdrawRequest(formData: FormData): Promise<void> {
  const id = String(formData.get("request_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("intro_requests")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("seeker_id", auth.user.id)
    .eq("status", "pending");

  revalidatePath("/requests");
}

/**
 * The seeker's half of confirming a hire.
 *
 * Plain English: an employer saying "we hired them" isn't enough on its own —
 * they're the one who owes the fee. The person who actually took the job has
 * to say so too. Only then is anything owed, and only then does the voucher's
 * 60-day clock start.
 */
export async function confirmHire(formData: FormData): Promise<void> {
  const hireId = String(formData.get("hire_id") ?? "");
  if (!hireId) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await supabase
    .from("hires")
    .update({ confirmed_by_seeker_at: new Date().toISOString() })
    .eq("id", hireId)
    .eq("seeker_id", auth.user.id);

  // This click is usually what turns a reported hire into a confirmed one,
  // which is the moment the employer's fee becomes owed. Collect it after the
  // response has gone back — the seeker is not the one paying and should not
  // wait on a card, and a failed charge must never undo their confirmation.
  if (stripeIsConfigured()) {
    after(async () => {
      const result = await collectFeeForHire(hireId);
      console.log(`[stripe] fee for hire ${hireId}: ${result.status} — ${result.detail}`);
    });
  }

  // The same click starts the voucher's 60-day clock, so this is where they
  // find out they have money coming and what they need to do about it.
  //
  // Deliberately NOT inside the Stripe check above, and in its own after()
  // block: the payout row is raised by the database whether or not Stripe is
  // switched on, and a fee that fails to collect must not also cost the
  // voucher the head start this email exists to give them. The two are
  // independent, so a failure in one cannot take the other down.
  after(async () => {
    console.log(`[payouts] ${await notifyVoucherOfPayout(hireId)}`);
  });

  revalidatePath("/requests");
}
