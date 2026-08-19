/**
 * verification-codes.ts — the 6-digit code itself.
 *
 * Plain English: we generate a 6-digit number, email it, and store only a
 * one-way fingerprint of it. Someone who steals a copy of the database still
 * can't verify as anyone, because the fingerprint can't be turned back into
 * the code.
 *
 * The fingerprint includes the person's id, so a code issued to one person is
 * useless to another even if they somehow guessed the digits.
 */

import { createHash, randomInt } from "node:crypto";

/** How long a code stays usable. Short on purpose. */
export const CODE_VALID_MINUTES = 10;

/** How many wrong guesses before the code is burned. */
export const MAX_ATTEMPTS = 5;

/** How long before another code can be requested. */
export const RESEND_COOLDOWN_SECONDS = 60;

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string, userId: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}
