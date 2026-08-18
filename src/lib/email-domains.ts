/**
 * email-domains.ts — telling work email addresses from personal ones.
 *
 * Plain English: a voucher proves they work somewhere by receiving a code at
 * a company email address. A Gmail address proves nothing, so those are
 * refused — with a pointer to the employer-invite path, which is how people
 * at businesses without their own domain get verified instead.
 */

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com",
]);

/** True if this address is from a personal email provider. */
export function isFreeEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return FREE_EMAIL_DOMAINS.has(domain);
}
