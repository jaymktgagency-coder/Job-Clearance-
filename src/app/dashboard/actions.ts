/**
 * dashboard/actions.ts — the employer's "invite a voucher" button.
 *
 * Plain English: a verified employer types a colleague's email, and we make a
 * one-time link. Only a hash of the link's token is stored, so the database
 * never holds anything that could be used to accept the invitation.
 *
 * Sending the email is Step 4. For now the link is shown on screen to copy.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hashInviteToken, inviteUrl, newInviteToken, INVITE_VALID_DAYS } from "@/lib/invites";

export type InviteState = { error: string | null; link?: string | null; email?: string | null };

export async function inviteVoucher(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Please enter a valid email address." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "You're not signed in any more. Please sign in again." };

  // Which company does this employer act for?
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, companies(name, verification_tier)")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!membership) return { error: "You're not set up as an employer on any company yet." };

  const company = Array.isArray(membership.companies)
    ? membership.companies[0]
    : membership.companies;

  // Only a verified business may vouch-invite. This is what the badge buys.
  if (!company || company.verification_tier === "none") {
    return {
      error:
        "Your company needs a verification badge before you can invite vouchers. Add a payment method and your business registration to earn Verified Business.",
    };
  }

  const token = newInviteToken();
  const expires = new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString();

  // The admin connection is used so an existing open invitation to the same
  // address can be replaced cleanly.
  const admin = await createAdminClient();
  await admin
    .from("voucher_invitations")
    .update({ status: "revoked" })
    .eq("company_id", membership.company_id)
    .eq("email", email)
    .eq("status", "sent");

  const { error } = await admin.from("voucher_invitations").insert({
    company_id: membership.company_id,
    invited_by: auth.user.id,
    email,
    token_hash: hashInviteToken(token),
    expires_at: expires,
  });
  if (error) return { error: `We couldn't create that invitation: ${error.message}` };

  revalidatePath("/dashboard");
  return { error: null, link: inviteUrl(token), email };
}
