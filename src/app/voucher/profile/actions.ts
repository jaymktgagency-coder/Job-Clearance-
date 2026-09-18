/**
 * voucher/profile/actions.ts — what a voucher can change about themselves.
 *
 * Plain English: their name, their job title, and their picture. Nothing
 * here can touch whether they are verified — that is established by Vouch and
 * guarded by the database, not claimed on a form.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pictureError, uploadPicture, removeOtherPictures } from "@/lib/avatars";

export type VoucherProfileState = { error: string | null; notice?: string | null };

async function requireVoucher() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (me?.role !== "voucher") return null;
  return { supabase, user: auth.user };
}

export async function saveVoucherProfile(
  _prev: VoucherProfileState,
  formData: FormData,
): Promise<VoucherProfileState> {
  const ctx = await requireVoucher();
  if (!ctx) return { error: "You're not signed in as a voucher any more." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Please keep your name filled in." };

  const { error: nameErr } = await ctx.supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", ctx.user.id);
  if (nameErr) return { error: `We couldn't save your name: ${nameErr.message}` };

  // The job title is only ever a description of themselves. Their verified
  // status, their company and their payout details are all elsewhere and are
  // not writable from this form.
  const { error } = await ctx.supabase
    .from("voucher_profiles")
    .update({ job_title: String(formData.get("job_title") ?? "").trim() || null })
    .eq("user_id", ctx.user.id);

  if (error) return { error: `We couldn't save your details: ${error.message}` };

  revalidatePath("/voucher/profile");
  return { error: null, notice: "Saved." };
}

export async function uploadVoucherAvatar(
  _prev: VoucherProfileState,
  formData: FormData,
): Promise<VoucherProfileState> {
  const ctx = await requireVoucher();
  if (!ctx) return { error: "You're not signed in as a voucher any more." };

  const file = formData.get("picture");
  const problem = pictureError(file);
  if (problem) return { error: problem };

  const result = await uploadPicture(ctx.supabase, ctx.user.id, file as File);
  if ("error" in result) return { error: result.error };

  const { error } = await ctx.supabase
    .from("users")
    .update({ avatar_url: result.url })
    .eq("id", ctx.user.id);

  if (error) return { error: `We couldn't save your picture: ${error.message}` };

  revalidatePath("/voucher/profile");
  return { error: null, notice: "Picture updated." };
}

export async function removeVoucherAvatar(): Promise<void> {
  const ctx = await requireVoucher();
  if (!ctx) return;

  await removeOtherPictures(ctx.supabase, ctx.user.id);
  await ctx.supabase.from("users").update({ avatar_url: null }).eq("id", ctx.user.id);

  revalidatePath("/voucher/profile");
}
