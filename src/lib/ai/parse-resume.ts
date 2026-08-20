/**
 * ai/parse-resume.ts — reading a resume into tidy, structured facts.
 *
 * Plain English: a resume is a document laid out for human eyes. This asks
 * Claude to read one and hand back the same information as a neat list —
 * jobs held, skills, schooling — so the rest of Vouch can work with it.
 *
 * Two rules are written into the instructions below and are not decoration:
 *
 *   1. EXTRACT, DON'T JUDGE. This step copies out what the resume says. It
 *      forms no opinion about the person. Opinions happen in score-fit.ts,
 *      where they are labelled, explained, and advisory.
 *   2. NEVER RECORD PROTECTED CHARACTERISTICS. Age, sex, race, nationality,
 *      religion, disability, marital or family status must not be guessed at
 *      or written down — not even where the resume mentions them. There is no
 *      field for them below, and the instructions forbid inferring them. A
 *      hiring tool that quietly captures those details is a lawsuit.
 */

import { AI_MODEL, aiClient } from "./client";
import { asMessageContent, type ResumeContent } from "./resume-file";

/** The structured shape we ask for back. Nothing here identifies a person's group. */
export type ParsedResume = {
  full_name: string | null;
  headline: string | null;
  location: string | null;
  years_experience: number | null;
  summary: string | null;
  skills: string[];
  positions: {
    title: string | null;
    employer: string | null;
    start: string | null;
    end: string | null;
    highlights: string[];
  }[];
  education: { qualification: string | null; institution: string | null; year: string | null }[];
  certifications: string[];
  languages: string[];
};

// The JSON shape the model must return. Sending this along means we get back
// something predictable rather than prose we'd have to guess our way through.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "full_name", "headline", "location", "years_experience", "summary",
    "skills", "positions", "education", "certifications", "languages",
  ],
  properties: {
    full_name: { type: ["string", "null"], description: "The person's name as written." },
    headline: { type: ["string", "null"], description: "A short description of what they do, e.g. 'Shift lead, speciality coffee'." },
    location: { type: ["string", "null"], description: "City/region only. Never a street address." },
    years_experience: { type: ["integer", "null"], description: "Total years of paid work shown, rounded down, between 0 and 60. Null if it cannot be worked out." },
    summary: { type: ["string", "null"], description: "Two or three neutral sentences describing the work history. No praise, no criticism." },
    skills: { type: "array", items: { type: "string" }, description: "Concrete skills, tools, machines or systems named in the resume." },
    positions: {
      type: "array",
      description: "Jobs held, most recent first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "employer", "start", "end", "highlights"],
        properties: {
          title: { type: ["string", "null"] },
          employer: { type: ["string", "null"] },
          start: { type: ["string", "null"], description: "As written, e.g. 'Mar 2022'." },
          end: { type: ["string", "null"], description: "As written, or 'Present'." },
          highlights: { type: "array", items: { type: "string" }, description: "What they actually did, in their own words where possible." },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["qualification", "institution", "year"],
        properties: {
          qualification: { type: ["string", "null"] },
          institution: { type: ["string", "null"] },
          year: { type: ["string", "null"] },
        },
      },
    },
    certifications: { type: "array", items: { type: "string" }, description: "Licences and certificates, e.g. food handler's permit, CDL, RN licence." },
    languages: { type: "array", items: { type: "string" } },
  },
} as const;

const INSTRUCTIONS = `You are reading a job applicant's resume for Vouch, a hiring marketplace.

Your job is to COPY OUT what the resume says. You are not judging this person,
ranking them, or deciding anything about them. Someone else does that later,
and a human makes the final call.

Rules:
- Record only what the document actually says. If something is not there, use
  null or an empty list. Never fill a gap with a guess.
- Do NOT infer or record age, date of birth, sex, gender, race, ethnicity,
  nationality, immigration status, religion, disability, health, pregnancy,
  marital status, or children — not even if the resume mentions them. There is
  no field for any of it. Leave it out entirely.
- Do not record a street address, phone number, or email. City and region only.
- Keep the person's own words for what they did. Do not upgrade "made coffee"
  into "delivered exceptional customer experiences".
- Hourly and shift work counts exactly as much as office work. A resume with no
  degree, no LinkedIn-style polish, or gaps between jobs is a normal resume.`;

/**
 * Reads one resume. Returns null if the model couldn't produce a usable answer —
 * the caller treats that as "no parsed resume yet", never as a failed upload.
 */
export async function parseResume(
  content: Extract<ResumeContent, { kind: "pdf" | "text" }>,
): Promise<ParsedResume | null> {
  const client = aiClient();

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    system: INSTRUCTIONS,
    output_config: {
      effort: "low", // copying facts out of a document is not hard work
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: "user",
        content: [
          asMessageContent(content),
          { type: "text", text: "Read the resume above and return the structured record." },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  if (!text) return null;
  try {
    return JSON.parse(text) as ParsedResume;
  } catch {
    return null;
  }
}
