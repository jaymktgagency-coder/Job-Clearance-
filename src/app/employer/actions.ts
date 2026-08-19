/**
 * employer/actions.ts — posting roles and moving candidates along.
 *
 * Plain English: an employer posts a job, then works through the people who
 * have been vouched for. Two things are deliberate here:
 *
 *   - the fee is never sent by the browser. The database works it out from the
 *     pay type and freezes it onto the job, so a tampered form can't buy a
 *     $2,000 role for $500.
 *   - every status change records WHICH PERSON made it. Nothing here moves a
 *     candidate automatically, and nothing ever will.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JobState = { error: string | null };
export type CandidateState = { error: string | null; notice?: string | null };

/** The company this employer acts for, or null. */
async function employerCompany() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("company_members")
    .select("company_id, companies(name, verification_tier)")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) return null;
  const company = Array.isArray(data.companies) ? data.companies[0] : data.companies;
  return { supabase, user: auth.user, companyId: data.company_id as string, company };
}

/** Money in, dollars out: "18.50" -> 1850 for hourly, "65000" -> 6500000. */
function toCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const asNumber = Number(cleaned);
  if (!Number.isFinite(asNumber) || asNumber < 0) return null;
  return Math.round(asNumber * 100);
}

export async function createJob(_prev: JobState, formData: FormData): Promise<JobState> {
  const ctx = await employerCompany();
  if (!ctx) return { error: "You're not set up as an employer on any company yet." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const payType = String(formData.get("pay_type") ?? "");
  const locationId = String(formData.get("location_id") ?? "").trim();
  const publish = formData.get("publish") === "on";

  if (!title) return { error: "Please give the role a title." };
  if (description.length < 40) {
    return {
      error: "Please describe the role in a little more detail — at least 40 characters. This is what a voucher reads before deciding whether to back someone for it.",
    };
  }
  if (payType !== "hourly" && payType !== "salaried") {
    return { error: "Please say whether this role is paid hourly or salaried." };
  }

  const payMin = toCents(String(formData.get("pay_min") ?? ""));
  const payMax = toCents(String(formData.get("pay_max") ?? ""));
  if (payMin !== null && payMax !== null && payMax < payMin) {
    return { error: "The top of the pay range is lower than the bottom." };
  }

  // Note what we do NOT send: fee_tier, fee_amount_cents, voucher_share_bps.
  // The database fills those in and then freezes them.
  const { data: job, error } = await ctx.supabase
    .from("jobs")
    .insert({
      company_id: ctx.companyId,
      location_id: locationId || null,
      posted_by: ctx.user.id,
      title,
      description,
      pay_type: payType,
      pay_min_cents: payMin,
      pay_max_cents: payMax,
      status: publish ? "open" : "draft",
      posted_at: publish ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { error: `We couldn't post that role: ${error.message}` };

  revalidatePath("/employer/jobs");
  redirect(`/employer/jobs/${job.id}?posted=1`);
}

export async function setJobStatus(formData: FormData): Promise<void> {
  const jobId = String(formData.get("job_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!jobId || !["open", "paused", "closed"].includes(status)) return;

  const ctx = await employerCompany();
  if (!ctx) return;

  await ctx.supabase
    .from("jobs")
    .update({
      status,
      ...(status === "open" ? { posted_at: new Date().toISOString() } : {}),
      ...(status === "closed" ? { closed_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId)
    .eq("company_id", ctx.companyId);

  revalidatePath(`/employer/jobs/${jobId}`);
  revalidatePath("/employer/jobs");
}

/**
 * Moves one candidate along. A person does this, and we record who.
 * Marking someone hired is handled separately, because it needs a start date
 * and it starts the money running.
 */
export async function setCandidateStatus(formData: FormData): Promise<void> {
  const applicationId = String(formData.get("application_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["new", "reviewing", "interviewed", "offered", "passed"];
  if (!applicationId || !allowed.includes(status)) return;

  const ctx = await employerCompany();
  if (!ctx) return;

  await ctx.supabase
    .from("applications")
    .update({
      status,
      last_status_changed_by: ctx.user.id,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  revalidatePath("/employer/jobs");
}

/**
 * "We hired this person."
 *
 * This is the money event, so it takes a start date and only counts as the
 * employer's half of the confirmation. Nothing is owed until the seeker
 * confirms too — the employer is the one with a $500–$2,000 reason to stay
 * quiet, so their word alone isn't enough.
 */
export async function reportHire(
  _prev: CandidateState,
  formData: FormData,
): Promise<CandidateState> {
  const applicationId = String(formData.get("application_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "").trim();
  if (!applicationId) return { error: "We couldn't tell which candidate that was." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "Please give the date they start (or started)." };
  }

  const ctx = await employerCompany();
  if (!ctx) return { error: "You're not set up as an employer on any company yet." };

  const { error } = await ctx.supabase.from("hires").insert({
    application_id: applicationId,
    start_date: startDate,
    confirmed_by_employer_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This hire has already been reported." };
    }
    return { error: `We couldn't record that hire: ${error.message}` };
  }

  await ctx.supabase
    .from("applications")
    .update({
      status: "hired",
      last_status_changed_by: ctx.user.id,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  revalidatePath("/employer/jobs");
  return {
    error: null,
    notice:
      "Recorded. Nothing is owed until they confirm it too — we'll ask them. The voucher's share releases 60 days after the start date.",
  };
}
