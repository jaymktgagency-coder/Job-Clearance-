/**
 * outreach.ts — the numbers the outreach screens need to know.
 *
 * This lives here rather than beside the server action that uses it because
 * every export from a `"use server"` file has to be an async function. A
 * plain constant there is a build error, not a warning — the same thing that
 * moved `isFreeEmailDomain` out into `lib/email-domains.ts`.
 */

/**
 * The shortest first message the database will accept, mirrored from the
 * check constraint on `voucher_outreach.message` in migration 0015 so the
 * form can say so before anybody presses Send.
 */
export const MIN_OUTREACH_CHARS = 40;
