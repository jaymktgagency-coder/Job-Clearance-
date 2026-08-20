/**
 * ai/run.ts — the two AI jobs, wired to the database.
 *
 * Plain English: `parse-resume.ts` and `score-fit.ts` know how to talk to
 * Claude but know nothing about Vouch. This file is the bridge: it fetches
 * what's needed, calls them, and saves the answer.
 *
 * Everything here follows one rule: THE AI MAY NEVER BREAK A HUMAN ACTION.
 * If the key is missing, if Anthropic is down, if the answer comes back
 * malformed — the upload still succeeded, the vouch was still sent, and the
 * employer still sees the candidate. They just don't see a score yet. Every
 * function below returns a quiet result instead of throwing.
 *
 * These writes use the admin connection deliberately. The AI's output is the
 * platform's, not the seeker's and not the employer's — migration 0008 makes
 * it so that a logged-in person cannot write these columns even if they try.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { aiIsConfigured } from "./client";
import { readResume } from "./resume-file";
import { parseResume } from "./parse-resume";
import { reasoningText, scoreFit, type ScoringInput } from "./score-fit";

/** What happened, in a form worth writing to the server log. */
export type AiResult = { ok: boolean; detail: string };

const off: AiResult = { ok: false, detail: "AI is switched off (no ANTHROPIC_API_KEY)." };

/** Pulls the first row out of a Supabase join, which may arrive as an array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ---------------------------------------------------------------------------
// 1. Reading a resume, after it's uploaded
// ---------------------------------------------------------------------------

export async function parseResumeForSeeker(userId: string): Promise<AiResult> {
  if (!aiIsConfigured()) return off;

  try {
    const admin = await createAdminClient();

    const { data: profile } = await admin
      .from("seeker_profiles")
      .select("resume_path")
      .eq("user_id", userId)
      .maybeSingle();

    const path = profile?.resume_path as string | undefined;
    if (!path) return { ok: false, detail: "No resume on file." };

    const { data: file, error: downloadErr } = await admin.storage.from("resumes").download(path);
    if (downloadErr || !file) {
      return { ok: false, detail: `Couldn't download the resume: ${downloadErr?.message ?? "no file"}` };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const content = readResume(bytes, path);
    if (content.kind === "unreadable") return { ok: false, detail: content.reason };

    const parsed = await parseResume(content);
    if (!parsed) return { ok: false, detail: "The model didn't return a usable record." };

    const { error: saveErr } = await admin
      .from("seeker_profiles")
      .update({ resume_parsed: parsed, resume_parsed_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (saveErr) return { ok: false, detail: `Couldn't save what we read: ${saveErr.message}` };
    return { ok: true, detail: `Read ${parsed.positions?.length ?? 0} position(s), ${parsed.skills?.length ?? 0} skill(s).` };
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}

// ---------------------------------------------------------------------------
// 2. Scoring a candidate, after a vouch creates them
// ---------------------------------------------------------------------------

/**
 * Scores one candidate.
 *
 * Note what this does NOT touch: `status`. A score never moves anyone forward
 * and never moves anyone out. The employer does that, by hand, on their own
 * screen — and migration 0008 rejects any update that tries to do both at once.
 */
export async function scoreApplication(applicationId: string): Promise<AiResult> {
  if (!aiIsConfigured()) return off;

  try {
    const admin = await createAdminClient();

    const { data: row, error } = await admin
      .from("applications")
      .select(`
        id, ai_fit_score,
        jobs(title, description, pay_type, locations(label)),
        users!applications_seeker_id_fkey(
          seeker_profiles(headline, location, years_experience, skills, bio, resume_parsed)
        ),
        vouches(body, relationship, users!vouches_voucher_id_fkey(voucher_profiles(job_title)))
      `)
      .eq("id", applicationId)
      .maybeSingle();

    if (error || !row) return { ok: false, detail: `Couldn't load that candidate: ${error?.message ?? "not found"}` };
    if (row.ai_fit_score != null) return { ok: false, detail: "Already scored." };

    const job = one(row.jobs as never) as {
      title: string; description: string | null; pay_type: string | null; locations: unknown;
    } | null;
    const seekerUser = one(row.users as never) as { seeker_profiles: unknown } | null;
    const seeker = one(seekerUser?.seeker_profiles as never) as {
      headline: string | null; location: string | null; years_experience: number | null;
      skills: string[] | null; bio: string | null; resume_parsed: unknown;
    } | null;
    const vouch = one(row.vouches as never) as {
      body: string; relationship: string; users: unknown;
    } | null;

    if (!job || !vouch) return { ok: false, detail: "That candidate is missing its role or vouch." };

    const voucherUser = one(vouch.users as never) as { voucher_profiles: unknown } | null;
    const voucherProfile = one(voucherUser?.voucher_profiles as never) as { job_title: string | null } | null;
    const location = one(job.locations as never) as { label: string | null } | null;

    const input: ScoringInput = {
      job: {
        title: job.title,
        description: job.description,
        employment_type: null,
        pay_type: job.pay_type,
        location: location?.label ?? null,
      },
      seeker: {
        headline: seeker?.headline ?? null,
        location: seeker?.location ?? null,
        years_experience: seeker?.years_experience ?? null,
        skills: seeker?.skills ?? [],
        bio: seeker?.bio ?? null,
        resume: seeker?.resume_parsed ?? null,
      },
      vouch: {
        relationship: vouch.relationship,
        body: vouch.body,
        voucher_job_title: voucherProfile?.job_title ?? null,
      },
    };

    const fit = await scoreFit(input);
    if (!fit) return { ok: false, detail: "The model didn't return a score with usable reasoning, so nothing was stored." };

    const reasoning = reasoningText(fit);
    if (!reasoning.trim()) return { ok: false, detail: "Refused to store a score with no reasoning." };

    const { error: saveErr } = await admin
      .from("applications")
      .update({
        ai_fit_score: fit.score,
        ai_reasoning: reasoning,
        ai_scored_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (saveErr) return { ok: false, detail: `Couldn't save the score: ${saveErr.message}` };
    return { ok: true, detail: `Scored ${fit.score}/100.` };
  } catch (err) {
    return { ok: false, detail: describeError(err) };
  }
}

/** Finds the candidate a vouch created, so it can be scored. */
export async function applicationForVouch(vouchId: string): Promise<string | null> {
  try {
    const admin = await createAdminClient();
    const { data } = await admin
      .from("applications")
      .select("id")
      .eq("vouch_id", vouchId)
      .maybeSingle();
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}

/** Supabase and Anthropic report errors differently. This copes with both. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
