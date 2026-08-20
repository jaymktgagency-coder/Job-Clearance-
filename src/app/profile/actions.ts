/**
 * profile/actions.ts — everything a seeker can do to their own record.
 *
 * Plain English: editing their profile, uploading or removing a resume, and
 * deleting their account outright. All of it runs on the server as the signed-in
 * person, so the database's own rules apply — a seeker physically cannot touch
 * anyone else's data here.
 */

"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { aiIsConfigured } from "@/lib/ai/client";
import { parseResumeForSeeker } from "@/lib/ai/run";

export type ProfileState = { error: string | null; notice?: string | null };

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

async function requireSeeker() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  return { supabase, user: auth.user };
}

/** Splits "react, sql , node" into a tidy list. */
function toList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const ctx = await requireSeeker();
  if (!ctx) return { error: "You're not signed in any more. Please sign in again." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Please keep your name filled in." };

  const yearsRaw = String(formData.get("years_experience") ?? "").trim();
  const years = yearsRaw === "" ? null : Number(yearsRaw);
  if (years !== null && (!Number.isFinite(years) || years < 0 || years > 60)) {
    return { error: "Years of experience should be a number between 0 and 60." };
  }

  const { error: nameErr } = await ctx.supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", ctx.user.id);
  if (nameErr) return { error: `We couldn't save your name: ${nameErr.message}` };

  const { error } = await ctx.supabase
    .from("seeker_profiles")
    .update({
      headline: String(formData.get("headline") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      bio: String(formData.get("bio") ?? "").trim() || null,
      years_experience: years,
      skills: toList(String(formData.get("skills") ?? "")),
      desired_titles: toList(String(formData.get("desired_titles") ?? "")),
      open_to_work: formData.get("open_to_work") === "on",
    })
    .eq("user_id", ctx.user.id);

  if (error) return { error: `We couldn't save your profile: ${error.message}` };

  revalidatePath("/profile");
  return { error: null, notice: "Saved." };
}

export async function uploadResume(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const ctx = await requireSeeker();
  if (!ctx) return { error: "You're not signed in any more. Please sign in again." };

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file first." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.` };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Please upload a PDF, a Word document, or a plain text file." };
  }

  // Files live in a folder named after the person, which is what the storage
  // rules match on. Nobody can write into anyone else's folder.
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${ctx.user.id}/resume-${Date.now()}.${extension}`;

  const { error: uploadErr } = await ctx.supabase.storage
    .from("resumes")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadErr) return { error: `We couldn't upload that: ${uploadErr.message}` };

  // Remove the previous one so old copies of a resume don't linger.
  const { data: existing } = await ctx.supabase
    .from("seeker_profiles")
    .select("resume_path")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (existing?.resume_path && existing.resume_path !== path) {
    await ctx.supabase.storage.from("resumes").remove([existing.resume_path]);
  }

  const { error: saveErr } = await ctx.supabase
    .from("seeker_profiles")
    .update({ resume_path: path, resume_uploaded_at: new Date().toISOString() })
    .eq("user_id", ctx.user.id);

  if (saveErr) return { error: `Uploaded, but we couldn't record it: ${saveErr.message}` };

  // Step 8: read the resume with AI — AFTER the page has already come back.
  // `after` runs once the response is sent, so the seeker never waits on it,
  // and if it fails the upload above still stands.
  const userId = ctx.user.id;
  if (aiIsConfigured()) {
    after(async () => {
      const result = await parseResumeForSeeker(userId);
      console.log(`[ai] resume for ${userId}: ${result.ok ? "read" : "not read"} — ${result.detail}`);
    });
  }

  revalidatePath("/profile");
  return {
    error: null,
    notice: aiIsConfigured()
      ? "Resume uploaded. We're reading it now — refresh in a moment to see what we picked up."
      : "Resume uploaded.",
  };
}

export async function removeResume(): Promise<void> {
  const ctx = await requireSeeker();
  if (!ctx) return;

  const { data: profile } = await ctx.supabase
    .from("seeker_profiles")
    .select("resume_path")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (profile?.resume_path) {
    await ctx.supabase.storage.from("resumes").remove([profile.resume_path]);
  }
  await ctx.supabase
    .from("seeker_profiles")
    .update({ resume_path: null, resume_uploaded_at: null, resume_parsed: null, resume_parsed_at: null })
    .eq("user_id", ctx.user.id);

  revalidatePath("/profile");
}

/**
 * Deletes the account and everything attached to it.
 *
 * Two halves: the files, then the login. Deleting the login cascades through
 * every table, so nothing is left behind in the database — but files in
 * storage aren't rows, so they have to go first and by hand.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const confirmation = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirmation !== "DELETE") return;

  const ctx = await requireSeeker();
  if (!ctx) return;

  const admin = await createAdminClient();

  // 1. the resume files
  const { data: files } = await admin.storage.from("resumes").list(ctx.user.id);
  if (files && files.length > 0) {
    await admin.storage
      .from("resumes")
      .remove(files.map((f) => `${ctx.user.id}/${f.name}`));
  }

  // 2. the login — this cascades to every row they own
  await admin.auth.admin.deleteUser(ctx.user.id);
  await ctx.supabase.auth.signOut();

  redirect("/?deleted=1");
}
