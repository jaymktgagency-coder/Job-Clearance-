/**
 * ai/score-fit.ts — suggesting how well a vouched candidate fits a role.
 *
 * READ THIS BEFORE CHANGING ANYTHING IN THIS FILE.
 *
 * The score produced here is ADVISORY. It exists to help an employer decide
 * where to start reading, and nothing more. Three rules hold it in place:
 *
 *   1. It never rejects anyone. This file writes a number and an explanation.
 *      It does not — and after migration 0008, physically cannot — change a
 *      candidate's status. Every decision is made by a person clicking a
 *      button on the employer's own screen.
 *   2. A score is never stored without its written reasoning. The database
 *      refuses the row otherwise (see `ai_score_requires_reasoning`), and this
 *      file refuses to send one.
 *   3. The seeker is told this is happening, in plain words, on their own
 *      profile page and again when they request an intro.
 *
 * The instructions below also tell the model what it must NOT weigh. That list
 * is the difference between a tool that widens access and one that
 * automates the same exclusions Vouch exists to get around.
 */

import { AI_MODEL, aiClient } from "./client";

export type FitScore = {
  score: number;
  reasoning: string;
  evidence: string[];
  not_assessed: string[];
};

/** Everything the model is shown. Assembled by the caller from the database. */
export type ScoringInput = {
  job: {
    title: string;
    description: string | null;
    employment_type: string | null;
    pay_type: string | null;
    location: string | null;
  };
  seeker: {
    headline: string | null;
    location: string | null;
    years_experience: number | null;
    skills: string[];
    bio: string | null;
    resume: unknown | null; // the parsed resume, when there is one
  };
  vouch: {
    relationship: "knows_personally" | "reviewed_profile_only" | string;
    body: string;
    voucher_job_title: string | null;
  };
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "reasoning", "evidence", "not_assessed"],
  properties: {
    score: {
      type: "integer",
      description:
        "How well the evidence matches what this role needs. A whole number from 1 to 100. " +
        "Anything outside that range is thrown away by the code that calls you, and the " +
        "candidate is simply left unscored.",
    },
    reasoning: {
      type: "string",
      description:
        "Three to six sentences a hiring manager can check against the evidence. Say what fits and what does not. Never advise rejecting or hiring anyone.",
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      description: "The specific facts the score rests on, each traceable to the resume, profile, or vouch.",
    },
    not_assessed: {
      type: "array",
      items: { type: "string" },
      description: "Things this role plainly needs that the material simply does not tell you either way.",
    },
  },
} as const;

const INSTRUCTIONS = `You are helping an employer on Vouch decide which vouched candidates to read first.

Every candidate you see has already been vouched for by a verified employee at
the hiring company. That vouch is real evidence and you should weigh it.

WHAT YOUR SCORE IS
Your score is advice about reading order. It is shown to the employer next to
your written reasoning, and a person makes every decision. You are never the
decision. Never write anything that reads as an instruction to reject, drop,
screen out, or hire someone.

HOW TO SCORE (1-100)
  85-100  The evidence shows they have done this exact work, or work that
          plainly transfers, and the vouch is specific and first-hand.
  65-84   Clear relevant experience, with one or two real gaps.
  40-64   Some genuine overlap; significant parts of the role are unevidenced.
  20-39   Little overlap on the evidence in front of you.
  1-19    The material shows nothing relevant to this role.
A missing resume means less evidence, not a worse person. Score what you can
see. Do not invent a low score to be safe.

not_assessed is not optional. Work through what the role asks for and list
every requirement the material in front of you does not settle either way —
including anything you would normally expect a resume to answer when no resume
was provided. If you genuinely cannot find a single such thing, the list may be
empty, but that should be rare: a short profile and one vouch leave most of a
job description unevidenced.

WHAT YOU MUST NOT WEIGH
Ignore entirely, and never mention:
  - age, sex, gender, race, ethnicity, national origin, accent, immigration
    status, religion, disability, health, pregnancy, marital or family status
  - any guess about these drawn from a name, a school, a photo, or a date
Also give no weight to:
  - the prestige of a school or employer, or having no degree at all
  - gaps in employment, or a career that changed direction
  - how polished the writing is, or whether English looks like a first language
  - hourly or shift work counting for less than salaried work. It does not.
    A person who ran a till, a kitchen, or a floor has run something real.

Judge the work against what this role actually needs. Nothing else.`;

/** Renders the input as plain text for the model, one clearly-labelled section each. */
function describe(input: ScoringInput): string {
  const { job, seeker, vouch } = input;
  return [
    "=== THE ROLE ===",
    `Title: ${job.title}`,
    job.location ? `Location: ${job.location}` : null,
    job.employment_type ? `Employment type: ${job.employment_type}` : null,
    job.pay_type ? `Paid: ${job.pay_type}` : null,
    job.description ? `\nWhat the role involves:\n${job.description}` : null,
    "",
    "=== THE CANDIDATE ===",
    seeker.headline ? `Headline: ${seeker.headline}` : null,
    seeker.location ? `Location: ${seeker.location}` : null,
    seeker.years_experience != null ? `Years of experience: ${seeker.years_experience}` : null,
    seeker.skills.length ? `Skills they listed: ${seeker.skills.join(", ")}` : null,
    seeker.bio ? `\nAbout them, in their words:\n${seeker.bio}` : null,
    seeker.resume
      ? `\nTheir resume, as read earlier:\n${JSON.stringify(seeker.resume, null, 2)}`
      : "\nNo resume on file. Score what the profile and the vouch show, and say what you could not assess.",
    "",
    "=== THE VOUCH ===",
    `Written by a verified employee at the hiring company${
      vouch.voucher_job_title ? ` (${vouch.voucher_job_title})` : ""
    }.`,
    vouch.relationship === "knows_personally"
      ? "They say they know this person personally."
      : "They say they have only reviewed this person's profile, not worked with them.",
    "",
    vouch.body,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Scores one candidate. Returns null rather than a half-answer: if the model
 * gives us a score with no reasoning, or a number out of range, we store
 * nothing at all. An unscored candidate is fine. An unexplained score is not.
 */
export async function scoreFit(input: ScoringInput): Promise<FitScore | null> {
  const client = aiClient();

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    system: INSTRUCTIONS,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high", // this one is a judgement, and it goes in front of a person
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: "user", content: describe(input) }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
  if (!text) return null;

  let parsed: Partial<FitScore>;
  try {
    parsed = JSON.parse(text) as Partial<FitScore>;
  } catch {
    return null;
  }

  // The guard that matters: no reasoning, no score. Ever.
  const score = Number(parsed.score);
  const reasoning = String(parsed.reasoning ?? "").trim();
  if (!Number.isInteger(score) || score < 1 || score > 100) return null;
  if (reasoning.length < 20) return null;

  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").map(tidy) : [];

  return {
    score,
    reasoning: tidy(reasoning),
    evidence: list(parsed.evidence),
    not_assessed: list(parsed.not_assessed),
  };
}

/**
 * Strips stray control characters before anything is stored.
 *
 * Generated text very occasionally carries a tab or similar where a word was
 * meant. It is cosmetic, but this text goes on an employer's screen, so it is
 * cleaned rather than passed through.
 */
function tidy(text: string): string {
  return text.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/ {2,}/g, " ").trim();
}

/**
 * Turns the structured answer into the single block of text stored on the
 * candidate and shown to the employer. Everything the model used is visible;
 * nothing is summarised away.
 */
export function reasoningText(fit: FitScore): string {
  const parts = [fit.reasoning];
  if (fit.evidence.length) {
    parts.push(`\nWhat this rests on:\n${fit.evidence.map((e) => `• ${e}`).join("\n")}`);
  }
  if (fit.not_assessed.length) {
    parts.push(`\nCouldn't tell from the material:\n${fit.not_assessed.map((e) => `• ${e}`).join("\n")}`);
  }
  return parts.join("\n");
}
