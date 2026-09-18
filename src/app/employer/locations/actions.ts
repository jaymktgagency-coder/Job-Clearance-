/**
 * employer/locations/actions.ts — the places a company actually hires into.
 *
 * Plain English: a branch, a store, a warehouse. Jobs point at one, and the
 * seeker's "within 25 miles" filter measures from its ZIP code.
 *
 * This screen had to exist before the Radius filter could work at all.
 * `locations` has been in the database since the very first migration, but
 * nothing has ever been able to create or edit one — the only rows in it were
 * put there by the demo seed script. So every location was missing a ZIP and
 * there was no way for anybody to supply one.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LocationState = { error: string | null; notice?: string | null };

async function employerCompany() {
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

/** Reads the ZIP off the form, or explains why it cannot be used. */
function readPostalCode(raw: string): { code: string | null } | { error: string } {
  const code = raw.trim();
  if (!code) return { code: null };
  if (!/^\d{5}$/.test(code)) {
    return { error: "A ZIP code is five digits, like 98101. Leave it blank if you'd rather not say." };
  }
  return { code };
}

export async function saveLocation(
  _prev: LocationState,
  formData: FormData,
): Promise<LocationState> {
  const ctx = await employerCompany();
  if (!ctx) return { error: "We couldn't find a company for your account." };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) {
    return { error: "Please give this place a name — whatever you call it internally is fine." };
  }

  const zip = readPostalCode(String(formData.get("postal_code") ?? ""));
  if ("error" in zip) return { error: zip.error };

  const row = {
    label,
    address_line1: String(formData.get("address_line1") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    region: String(formData.get("region") ?? "").trim().toUpperCase() || null,
    postal_code: zip.code,
  };

  const id = String(formData.get("location_id") ?? "").trim();

  const { error } = id
    ? await ctx.supabase
        .from("locations")
        .update(row)
        .eq("id", id)
        .eq("company_id", ctx.companyId)
    : await ctx.supabase
        .from("locations")
        .insert({ ...row, company_id: ctx.companyId });

  if (error) {
    // The ZIP is a foreign key onto the Census table, so one that is five
    // digits but is not a real ZIP lands here rather than being stored.
    if (error.code === "23503") {
      return { error: `We don't recognise ${zip.code} as a US ZIP code. Check the digits.` };
    }
    return { error: `We couldn't save that: ${error.message}` };
  }

  revalidatePath("/employer/locations");
  revalidatePath("/jobs");
  return { error: null, notice: id ? "Saved." : `${label} added.` };
}

/**
 * Retires a place.
 *
 * Marked inactive rather than deleted: a job posted there still points at it,
 * and deleting the row would blank the location on a live posting.
 */
export async function setLocationActive(formData: FormData): Promise<void> {
  const ctx = await employerCompany();
  if (!ctx) return;

  const id = String(formData.get("location_id") ?? "");
  const active = String(formData.get("is_active") ?? "") === "true";
  if (!id) return;

  await ctx.supabase
    .from("locations")
    .update({ is_active: active })
    .eq("id", id)
    .eq("company_id", ctx.companyId);

  revalidatePath("/employer/locations");
}
