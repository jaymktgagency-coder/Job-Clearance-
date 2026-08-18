/**
 * onboarding/actions.ts — turns a bare login into a real Vouch account.
 *
 * Plain English: signing up creates a login and nothing else. This is where
 * the actual profile gets built, and it differs per role:
 *
 *   seeker   -> a profile row they can fill in later
 *   employer -> a company, with them as its owner
 *   voucher  -> a voucher profile tied to a company. If they arrived from an
 *               employer's invitation, that invitation IS their verification,
 *               so they come out the other side already verified.
 *
 * The verified-by-invitation step uses the admin connection on purpose: the
 * database refuses to let anyone mark themselves verified, which is exactly
 * the protection we want. Only trusted server code like this may do it.
 */

"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/invites";
import { pendingInviteToken, pendingRole, type Role } from "@/lib/auth";
import { isFreeEmailDomain } from "@/lib/email-domains";

export type OnboardingState = { error: string | null };

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "You're not signed in any more. Please sign in again." };

  const role = pendingRole(user.user_metadata) ?? (String(formData.get("role") ?? "") as Role);
  if (!role) return { error: "We couldn't tell which kind of account this is. Please sign up again." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Please tell us your name." };

  // Everyone gets a row in users, whatever their role.
  const { error: userErr } = await supabase.from("users").upsert(
    { id: user.id, role, full_name: fullName, email: user.email ?? "" },
    { onConflict: "id" },
  );
  if (userErr) return { error: `We couldn't save your account: ${userErr.message}` };

  if (role === "seeker") {
    const { error } = await supabase.from("seeker_profiles").upsert(
      {
        user_id: user.id,
        headline: String(formData.get("headline") ?? "").trim() || null,
        location: String(formData.get("location") ?? "").trim() || null,
      },
      { onConflict: "user_id" },
    );
    if (error) return { error: `We couldn't save your profile: ${error.message}` };
    redirect("/dashboard");
  }

  if (role === "employer") {
    const companyName = String(formData.get("company_name") ?? "").trim();
    if (!companyName) return { error: "Please tell us your company's name." };

    const { data: company, error: coErr } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        slug: `${slugify(companyName)}-${Math.random().toString(36).slice(2, 7)}`,
        website: String(formData.get("website") ?? "").trim() || null,
      })
      .select("id")
      .single();
    if (coErr) return { error: `We couldn't create your company: ${coErr.message}` };

    const { error: memberErr } = await supabase
      .from("company_members")
      .insert({ company_id: company.id, user_id: user.id, member_role: "owner" });
    if (memberErr) return { error: `We couldn't make you the owner: ${memberErr.message}` };

    redirect("/dashboard");
  }

  // ---- voucher -----------------------------------------------------------
  const permission = formData.get("employer_permission") === "on";
  if (!permission) {
    return {
      error:
        "Please confirm your employer allows you to take part. This protects you — vouching is paid, and some employers have rules about that.",
    };
  }

  const inviteToken = pendingInviteToken(user.user_metadata);

  if (inviteToken) {
    // Invited by an employer: the invitation is the verification.
    const admin = await createAdminClient();
    const { data: invite } = await admin
      .from("voucher_invitations")
      .select("id, company_id, location_id, status, expires_at")
      .eq("token_hash", hashInviteToken(inviteToken))
      .maybeSingle();

    if (!invite || invite.status !== "sent" || new Date(invite.expires_at) < new Date()) {
      return {
        error:
          "That invitation is no longer valid. Ask whoever invited you for a fresh link, or verify with your work email instead.",
      };
    }

    const now = new Date().toISOString();
    const { error: vpErr } = await admin.from("voucher_profiles").upsert(
      {
        user_id: user.id,
        company_id: invite.company_id,
        location_id: invite.location_id,
        job_title: String(formData.get("job_title") ?? "").trim() || null,
        verification_method: "employer_invite",
        status: "verified",
        verified_at: now,
        employer_permission_confirmed_at: now,
      },
      { onConflict: "user_id" },
    );
    if (vpErr) return { error: `We couldn't finish setting you up: ${vpErr.message}` };

    await admin
      .from("voucher_invitations")
      .update({ status: "accepted", accepted_by: user.id, accepted_at: now })
      .eq("id", invite.id);

    redirect("/dashboard");
  }

  // Self-serve: they pick their company and give a work email. Verification
  // itself — the 6-digit code — is Step 4, so they start unverified.
  const companyId = String(formData.get("company_id") ?? "").trim();
  const workEmail = String(formData.get("work_email") ?? "").trim().toLowerCase();

  if (!companyId) return { error: "Please choose the company you work for." };
  if (!workEmail) return { error: "Please give the work email address you'd like to verify." };
  if (isFreeEmailDomain(workEmail)) {
    return {
      error:
        "That's a personal email provider, so it can't prove where you work. Use your work address — or ask your employer to invite you directly, which works for businesses without their own email domain.",
    };
  }

  // Don't let someone set out down a road that dead-ends: work-email
  // verification only works if the company has proven it owns a domain.
  const admin = await createAdminClient();
  const { data: domains } = await admin
    .from("company_domains")
    .select("domain")
    .eq("company_id", companyId);

  if (!domains || domains.length === 0) {
    return {
      error:
        "That employer hasn't proven a company email domain yet, so a code sent to your work address wouldn't prove anything. Ask them to invite you directly — that's how businesses without their own email domain add vouchers.",
    };
  }

  if (!domains.some((d) => d.domain === workEmail.split("@")[1])) {
    const owned = domains.map((d) => d.domain).join(", ");
    return {
      error: `That address isn't at your employer's domain (${owned}). Use your work address, or ask them to invite you directly.`,
    };
  }

  const { error: vpErr } = await supabase.from("voucher_profiles").upsert(
    {
      user_id: user.id,
      company_id: companyId,
      job_title: String(formData.get("job_title") ?? "").trim() || null,
      work_email: workEmail,
      verification_method: "work_email",
      employer_permission_confirmed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (vpErr) return { error: `We couldn't finish setting you up: ${vpErr.message}` };

  redirect("/dashboard");
}
