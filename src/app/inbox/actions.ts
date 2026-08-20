/**
 * inbox/actions.ts — writing a vouch, or declining.
 *
 * Plain English: this is the moment the whole product turns on. A verified
 * employee reads a stranger's profile and decides whether to put their name
 * behind them.
 *
 * Three rules are enforced here and again by the database underneath, so a
 * bug in one can't quietly defeat the other:
 *   - only a verified voucher, only at their own company
 *   - the vouch must be written, not clicked: there's a minimum length
 *   - the voucher must say which kind of vouch it is, and that goes to the
 *     employer along with what the voucher stands to earn
 */

"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aiIsConfigured } from "@/lib/ai/client";
import { applicationForVouch, scoreApplication } from "@/lib/ai/run";

export type VouchState = { error: string | null };

/** The minimum length we ask for, read from your settings table. */
export async function minimumVouchLength(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "min_vouch_body_chars")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  const parsed = Number(data?.value ?? 200);
  return Number.isFinite(parsed) ? parsed : 200;
}

export async function writeVouch(
  _prev: VouchState,
  formData: FormData,
): Promise<VouchState> {
  const requestId = String(formData.get("request_id") ?? "");
  const relationship = String(formData.get("relationship") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!requestId) return { error: "We couldn't tell which request that was." };
  if (relationship !== "knows_personally" && relationship !== "reviewed_profile_only") {
    return { error: "Please say whether you know this person or have only read their profile. Employers are told either way." };
  }

  const minimum = await minimumVouchLength();
  if (body.length < minimum) {
    return {
      error: `A vouch needs at least ${minimum} characters — you've written ${body.length}. Say what you actually noticed. A one-line vouch tells an employer nothing, and your name is on it.`,
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "You're not signed in any more. Please sign in again." };

  const { data: created, error } = await supabase
    .from("vouches")
    .insert({
      intro_request_id: requestId,
      voucher_id: auth.user.id,
      relationship,
      body,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // The database writes these messages for humans already.
    if (
      error.message.includes("open vouches") ||
      error.message.includes("not verified") ||
      error.message.includes("own company") ||
      error.message.includes("no longer open")
    ) {
      return { error: error.message };
    }
    if (error.message.includes("vouches_body_check")) {
      return { error: "That vouch is too short to mean anything. Please write a little more." };
    }
    return { error: `We couldn't save that vouch: ${error.message}` };
  }

  // Step 8: writing the vouch created a candidate for the employer. Score that
  // candidate now — after the response has gone back, so the voucher isn't kept
  // waiting, and with no power to change anything but the two AI columns.
  //
  // A failure here costs the employer a score, nothing more. The candidate is
  // already on their list, because the vouch put them there.
  const vouchId = created?.id as string | undefined;
  if (vouchId && aiIsConfigured()) {
    after(async () => {
      const applicationId = await applicationForVouch(vouchId);
      if (!applicationId) {
        console.log(`[ai] vouch ${vouchId}: no candidate row found, nothing scored`);
        return;
      }
      const result = await scoreApplication(applicationId);
      console.log(`[ai] candidate ${applicationId}: ${result.ok ? "scored" : "not scored"} — ${result.detail}`);
    });
  }

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  redirect("/inbox?vouched=1");
}

export async function declineRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  // Declining is a normal, respectable answer — no reason required.
  await supabase
    .from("intro_requests")
    .update({
      status: "declined",
      claimed_by: auth.user.id,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  revalidatePath("/inbox");
  redirect("/inbox?declined=1");
}
