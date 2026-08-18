/**
 * invites.ts — the employer-invite link.
 *
 * Plain English: a verified employer can invite someone by email to become a
 * voucher, and that invitation IS their verification — no company email
 * domain needed. This is how a business running on Gmail gets vouchers at all.
 *
 * The link contains a long random token. We only ever store a HASH of it, the
 * same way passwords are stored, so a copy of the database doesn't hand
 * anyone a working invitation.
 */

import { createHash, randomBytes } from "node:crypto";

/** Makes a fresh token for a new invitation. Shown once, never stored raw. */
export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The one-way fingerprint we store and compare against. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The full link to send someone. */
export function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

/** How long an invitation stays usable. */
export const INVITE_VALID_DAYS = 14;
