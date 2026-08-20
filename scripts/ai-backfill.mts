/**
 * ai-backfill.mts — read and score everything that hasn't been yet.
 *
 * WHAT IT DOES
 * From Step 8 onward, resumes are read as they're uploaded and candidates are
 * scored as they're vouched for. Anything that already existed before then —
 * the demo data, or anything uploaded while the AI key was missing — has no
 * score and no parsed resume. This catches those up.
 *
 * HOW TO RUN IT
 *   npm run ai:backfill              # everything outstanding
 *   npm run ai:backfill -- --dry-run # just say what it would do
 *
 * It costs a few cents per candidate. It never re-reads or re-scores anything
 * that already has an answer, so running it twice is safe and cheap.
 *
 * WHAT IT CANNOT DO
 * It writes the two AI columns and nothing else. It cannot move a candidate,
 * reject anyone, or change a status — the database refuses an update that
 * scores and decides at the same time.
 */

import { createClient } from "@supabase/supabase-js";
import { readResume } from "../src/lib/ai/resume-file.ts";
import { parseResume } from "../src/lib/ai/parse-resume.ts";
import { reasoningText, scoreFit } from "../src/lib/ai/score-fit.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!url || !secret) {
  console.error("\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local. See SETUP.md.\n");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("\nMissing ANTHROPIC_API_KEY in .env.local. See SETUP.md, Part 8.\n");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false } });

/** Supabase joins arrive as an object or a one-item array depending on the shape. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

// --- 1. resumes that have been uploaded but never read ----------------------

async function readOutstandingResumes() {
  const { data, error } = await db
    .from("seeker_profiles")
    .select("user_id, resume_path, users(full_name)")
    .not("resume_path", "is", null)
    .is("resume_parsed", null);

  if (error) throw new Error(`Couldn't list resumes: ${error.message}`);
  const rows = data ?? [];
  console.log(`\nResumes waiting to be read: ${rows.length}`);

  for (const row of rows) {
    const who = one(row.users as never) as { full_name: string | null } | null;
    const name = who?.full_name ?? row.user_id;
    if (dryRun) {
      console.log(`  would read  ${name}`);
      continue;
    }

    const { data: file, error: downloadErr } = await db.storage
      .from("resumes")
      .download(row.resume_path as string);
    if (downloadErr || !file) {
      console.log(`  skipped     ${name} — couldn't download (${downloadErr?.message ?? "no file"})`);
      continue;
    }

    const content = readResume(Buffer.from(await file.arrayBuffer()), row.resume_path as string);
    if (content.kind === "unreadable") {
      console.log(`  skipped     ${name} — ${content.reason}`);
      continue;
    }

    const parsed = await parseResume(content);
    if (!parsed) {
      console.log(`  skipped     ${name} — no usable record came back`);
      continue;
    }

    const { error: saveErr } = await db
      .from("seeker_profiles")
      .update({ resume_parsed: parsed, resume_parsed_at: new Date().toISOString() })
      .eq("user_id", row.user_id);

    console.log(
      saveErr
        ? `  failed      ${name} — ${saveErr.message}`
        : `  read        ${name} (${parsed.positions?.length ?? 0} jobs, ${parsed.skills?.length ?? 0} skills)`,
    );
  }
}

// --- 2. vouched candidates with no score yet --------------------------------

async function scoreOutstandingCandidates() {
  const { data, error } = await db
    .from("applications")
    .select(`
      id,
      jobs(title, description, pay_type, locations(label)),
      users!applications_seeker_id_fkey(full_name,
        seeker_profiles(headline, location, years_experience, skills, bio, resume_parsed)),
      vouches(body, relationship, users!vouches_voucher_id_fkey(voucher_profiles(job_title)))
    `)
    .is("ai_fit_score", null);

  if (error) throw new Error(`Couldn't list candidates: ${error.message}`);
  const rows = data ?? [];
  console.log(`\nCandidates waiting for a score: ${rows.length}`);

  for (const row of rows) {
    const job = one(row.jobs as never) as {
      title: string; description: string | null; pay_type: string | null; locations: unknown;
    } | null;
    const person = one(row.users as never) as { full_name: string | null; seeker_profiles: unknown } | null;
    const seeker = one(person?.seeker_profiles as never) as {
      headline: string | null; location: string | null; years_experience: number | null;
      skills: string[] | null; bio: string | null; resume_parsed: unknown;
    } | null;
    const vouch = one(row.vouches as never) as { body: string; relationship: string; users: unknown } | null;
    const name = person?.full_name ?? (row.id as string);

    if (!job || !vouch) {
      console.log(`  skipped     ${name} — missing role or vouch`);
      continue;
    }
    if (dryRun) {
      console.log(`  would score ${name} for "${job.title}"`);
      continue;
    }

    const voucherUser = one(vouch.users as never) as { voucher_profiles: unknown } | null;
    const voucherProfile = one(voucherUser?.voucher_profiles as never) as { job_title: string | null } | null;
    const location = one(job.locations as never) as { label: string | null } | null;

    const fit = await scoreFit({
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
    });

    if (!fit) {
      console.log(`  skipped     ${name} — no score with usable reasoning, so nothing was stored`);
      continue;
    }

    const { error: saveErr } = await db
      .from("applications")
      .update({
        ai_fit_score: fit.score,
        ai_reasoning: reasoningText(fit),
        ai_scored_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    console.log(
      saveErr
        ? `  failed      ${name} — ${saveErr.message}`
        : `  scored      ${name} for "${job.title}" — ${fit.score}/100`,
    );
  }
}

async function main() {
  console.log(dryRun ? "\nDry run — nothing will be written." : "\nReading and scoring what's outstanding.");
  await readOutstandingResumes();
  await scoreOutstandingCandidates();
  console.log("\nDone. Scores are advisory and never move anyone; a person still decides.\n");
}

main().catch((error) => {
  console.error("\nStopped:", error instanceof Error ? error.message : error);
  process.exit(1);
});
