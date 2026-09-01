/**
 * legal.ts — the blanks in the terms, privacy, and refund pages.
 *
 * Plain English: legal pages need your company's real name and address in
 * several places each. Rather than have you hunt through four files, every
 * one of those blanks lives here. Fill these in once and all four pages
 * update.
 *
 * ⚠️ EVERY VALUE MARKED `TODO` MUST BE REPLACED BEFORE YOU TAKE A PAYMENT.
 * Stripe checks these pages by hand as part of approving a marketplace, and
 * placeholder text is a common reason applications get sent back.
 */

export const LEGAL = {
  /** Your registered legal entity, e.g. "Vouch Labs LLC". */
  entityName: "TODO — your registered company name",

  /** The state or country it's registered in, e.g. "Washington". */
  jurisdiction: "TODO — state of registration",

  /** Business address. Stripe expects a real one, not a PO box in most cases. */
  address: "TODO — street, city, state, postcode",

  /** Where people email you. A real inbox somebody reads. */
  supportEmail: "TODO — support@yourdomain.com",

  /** Where privacy and data-deletion requests go. May be the same inbox. */
  privacyEmail: "TODO — privacy@yourdomain.com",

  /** The public name of the service. */
  serviceName: "Vouch",

  /** The site's own address, used in the terms. */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://vouch-nu-gold.vercel.app",

  /**
   * The date these terms last changed. Update it whenever you edit the
   * wording, because people are entitled to know when the deal shifted.
   */
  lastUpdated: "1 September 2026",
} as const;

/** True while any blank is still a placeholder — the /support page says so. */
export function legalDetailsIncomplete(): boolean {
  return Object.values(LEGAL).some(
    (v) => typeof v === "string" && v.startsWith("TODO"),
  );
}
