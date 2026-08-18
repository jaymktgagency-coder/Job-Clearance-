/**
 * email.ts — sending email, with a way to work before you have an email account.
 *
 * Plain English: Vouch needs to email people a 6-digit code. That normally
 * goes through Resend. But you don't have a Resend account yet, and waiting
 * for one would block everything — so if no Resend key is configured, the code
 * is printed to the terminal instead and shown on screen while you're
 * developing. Nothing is lost; the moment you add RESEND_API_KEY it switches
 * to real email on its own.
 */

type SendResult =
  | { delivered: true; via: "resend" }
  | { delivered: false; via: "console"; reason: string };

export function emailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** True while developing. Controls whether codes may be shown on screen. */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  if (!emailIsConfigured()) {
    // No email provider yet — write it where you can see it.
    console.log(
      `\n=== EMAIL (not sent — no RESEND_API_KEY yet) ===\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n===============================================\n`,
    );
    return { delivered: false, via: "console", reason: "no email provider configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend refused the message (${response.status}): ${detail.slice(0, 200)}`);
  }

  return { delivered: true, via: "resend" };
}
