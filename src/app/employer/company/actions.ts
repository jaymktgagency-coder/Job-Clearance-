/**
 * employer/company/actions.ts — what an employer can change about their company.
 *
 * Plain English: the name, the website, the description, and the logo. Every
 * one of those is something a company says about itself.
 *
 * What is NOT here is anything that confers trust. The badges, the proven
 * domain and the payment details are facts Vouch establishes. A company
 * cannot award itself a badge from this form — and could not even if this
 * file tried, because `protect_company_trust` in migration 0010 puts those
 * columns back the way they were on every update that is not the platform's.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pictureError, uploadPicture, removeOtherPictures } from "@/lib/avatars";

export type CompanyState = { error: string | null; notice?: string | null };

/**
 * The signed-in employer and the company they may act for.
 *
 * Membership is what grants the right, not merely being an employer — the
 * same rule `companies_update_by_member` enforces in the database.
 */
async function requireCompany() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!membership?.company_id) return null;
  return { supabase, user: auth.user, companyId: membership.company_id as string };
}

export async function saveCompany(
  _prev: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  const ctx = await requireCompany();
  if (!ctx) return { error: "We couldn't find a company for your account." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please keep your company name filled in." };

  const website = String(formData.get("website") ?? "").trim();

  const { error } = await ctx.supabase
    .from("companies")
    .update({
      name,
      website: website || null,
      description: String(formData.get("description") ?? "").trim() || null,
    })
    .eq("id", ctx.companyId);

  if (error) return { error: `We couldn't save that: ${error.message}` };

  revalidatePath("/employer/company");
  return { error: null, notice: "Saved." };
}

export async function uploadCompanyLogo(
  _prev: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  const ctx = await requireCompany();
  if (!ctx) return { error: "We couldn't find a company for your account." };

  const file = formData.get("picture");
  const problem = pictureError(file);
  if (problem) return { error: problem };

  // Filed under the uploader's user id rather than the company's, because
  // that is the folder the storage rules let them write to. One rule for
  // writing a picture, whoever the picture is of.
  const result = await uploadPicture(ctx.supabase, ctx.user.id, file as File);
  if ("error" in result) return { error: result.error };

  const { error } = await ctx.supabase
    .from("companies")
    .update({ logo_url: result.url })
    .eq("id", ctx.companyId);

  if (error) return { error: `We couldn't save your logo: ${error.message}` };

  revalidatePath("/employer/company");
  revalidatePath("/jobs");
  return { error: null, notice: "Logo updated." };
}

export async function removeCompanyLogo(): Promise<void> {
  const ctx = await requireCompany();
  if (!ctx) return;

  await removeOtherPictures(ctx.supabase, ctx.user.id);
  await ctx.supabase.from("companies").update({ logo_url: null }).eq("id", ctx.companyId);

  revalidatePath("/employer/company");
  revalidatePath("/jobs");
}
