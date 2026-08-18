/**
 * verify/actions.ts — sending and checking the 6-digit code.
 *
 * Plain English: a voucher proves they work somewhere by receiving a code at
 * a company email address. Three things make this trustworthy:
 *
 *   1. The address must be at a domain the company has actually proven it
 *      owns — not just any address that isn't Gmail.
 *   2. Only a fingerprint of the code is stored, never the code.
 *   3. Codes expire in 10 minutes and burn after 5 wrong guesses.
 *
 * Marking someone verified uses the admin connection deliberately: the
 * database refuses to let anyone verify themselves, so only trusted server
 * code like this can do it.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmail, emailIsConfigured, isDevelopment } from "@/lib/email";
import {
  newCode, hashCode, CODE_VALID_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SECONDS,
} from "@/lib/verification-codes";

export type VerifyState = {
  error: string | null;
  notice?: string | null;
  /** Shown on screen ONLY while developing without an email provider. */
  devCode?: string | null;
};

/** The voucher profile of whoever is signed in, or null. */
async function voucherContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("voucher_profiles")
    .select("user_id, company_id, work_email, status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return data ? { supabase, user: auth.user, profile: data } : null;
}

export async function sendCode(_prev: VerifyState, _formData: FormData): Promise<VerifyState> {
  const ctx = await voucherContext();
  if (!ctx) return { error: "You're not signed in as a voucher any more. Please sign in again." };
  if (ctx.profile.status === "verified") return { error: null, notice: "You're already verified." };

  const workEmail = ctx.profile.work_email;
  if (!workEmail) {
    return { error: "There's no work email on your profile to send a code to." };
  }

  const admin = await createAdminClient();

  // The address has to be at a domain this company has proven it owns.
  const domain = workEmail.split("@")[1]?.toLowerCase() ?? "";
  const { data: owned } = await admin
    .from("company_domains")
    .select("domain")
    .eq("company_id", ctx.profile.company_id)
    .eq("domain", domain)
    .maybeSingle();

  if (!owned) {
    return {
      error: `Your company hasn't proven it owns "${domain}", so a code sent there wouldn't prove anything. Ask your employer to invite you directly instead — that works without a company email domain.`,
    };
  }

  // Don't let someone spray codes at an address.
  const { data: recent } = await admin
    .from("email_verifications")
    .select("created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const secondsSince = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
      return { error: `Please wait ${wait} more seconds before asking for another code.` };
    }
  }

  const code = newCode();

  // Any earlier codes stop working the moment a new one is issued.
  await admin
    .from("email_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", ctx.user.id)
    .is("consumed_at", null);

  const { error: insertErr } = await admin.from("email_verifications").insert({
    user_id: ctx.user.id,
    email: workEmail,
    code_hash: hashCode(code, ctx.user.id),
    expires_at: new Date(Date.now() + CODE_VALID_MINUTES * 60_000).toISOString(),
  });
  if (insertErr) return { error: `We couldn't create a code: ${insertErr.message}` };

  try {
    await sendEmail({
      to: workEmail,
      subject: `Your Vouch verification code: ${code}`,
      text: [
        `Your Vouch verification code is ${code}.`,
        ``,
        `It expires in ${CODE_VALID_MINUTES} minutes.`,
        ``,
        `If you didn't ask for this, you can ignore this email — nobody can`,
        `use the code without access to this inbox.`,
      ].join("\n"),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `We couldn't send the email: ${detail}` };
  }

  revalidatePath("/verify");

  // Without an email provider there's no inbox to check, so while developing
  // the code is shown on screen. This never happens in production.
  if (!emailIsConfigured() && isDevelopment()) {
    return {
      error: null,
      notice: `No email provider is set up yet, so here's the code directly. It expires in ${CODE_VALID_MINUTES} minutes.`,
      devCode: code,
    };
  }

  return {
    error: null,
    notice: `We've sent a 6-digit code to ${workEmail}. It expires in ${CODE_VALID_MINUTES} minutes.`,
  };
}

export async function confirmCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const entered = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (entered.length !== 6) return { error: "Please enter the 6-digit code from the email." };

  const ctx = await voucherContext();
  if (!ctx) return { error: "You're not signed in as a voucher any more. Please sign in again." };
  if (ctx.profile.status === "verified") return { error: null, notice: "You're already verified." };

  const admin = await createAdminClient();

  const { data: record } = await admin
    .from("email_verifications")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("user_id", ctx.user.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return { error: "There's no code waiting. Ask for a new one." };

  if (new Date(record.expires_at) < new Date()) {
    await admin.from("email_verifications").update({ consumed_at: new Date().toISOString() }).eq("id", record.id);
    return { error: "That code has expired. Ask for a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await admin.from("email_verifications").update({ consumed_at: new Date().toISOString() }).eq("id", record.id);
    return { error: "Too many wrong attempts. Ask for a new code." };
  }

  if (record.code_hash !== hashCode(entered, ctx.user.id)) {
    const attempts = record.attempts + 1;
    await admin.from("email_verifications").update({ attempts }).eq("id", record.id);
    const left = MAX_ATTEMPTS - attempts;
    return {
      error:
        left > 0
          ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "That code isn't right, and you've run out of tries. Ask for a new code.",
    };
  }

  // Correct. Burn the code and mark them verified.
  const now = new Date().toISOString();
  await admin.from("email_verifications").update({ consumed_at: now }).eq("id", record.id);

  const { error: verifyErr } = await admin
    .from("voucher_profiles")
    .update({
      status: "verified",
      verified_at: now,
      verification_method: "work_email",
    })
    .eq("user_id", ctx.user.id);

  if (verifyErr) return { error: `We couldn't finish verifying you: ${verifyErr.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/verify");
  return { error: null, notice: "Verified. You can vouch for people applying where you work." };
}
