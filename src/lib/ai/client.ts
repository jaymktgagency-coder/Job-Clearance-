/**
 * ai/client.ts — one place that knows how to talk to Claude.
 *
 * Plain English: Step 8 adds two AI features — reading resumes, and suggesting
 * how well a candidate fits a role. Both go through this file, so there is a
 * single place to change the model, and a single place that decides whether AI
 * is switched on at all.
 *
 * The most important line in this file is `aiIsConfigured`. If there is no
 * Anthropic key, Vouch keeps working exactly as it did before: resumes still
 * upload, vouches still send, employers still hire. The AI is an extra, never
 * a dependency. Nothing a human does is allowed to fail because a robot did.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * The model used for both features.
 *
 * Cost, so you can budget: reading one resume and scoring one candidate is a
 * few cents in total. This is the only place the model name appears — change
 * it here and both features follow.
 */
export const AI_MODEL = "claude-opus-5";

/** True when an Anthropic key is present. False turns the whole AI layer off. */
export function aiIsConfigured(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
}

/** The Anthropic connection. Server-side only — the key must never reach a browser. */
export function aiClient(): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error("ANTHROPIC_API_KEY must never be used in the browser.");
  }
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is missing. Add it to .env.local (and to your Vercel " +
        "environment variables) — see SETUP.md, Part 8.",
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Pulls the plain text out of a Claude response.
 *
 * A response is a list of blocks — some are the model's thinking, one is the
 * answer. This picks out the answer and ignores the rest.
 */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
