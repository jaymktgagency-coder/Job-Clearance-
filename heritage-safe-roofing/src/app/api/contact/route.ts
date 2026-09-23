/**
 * Receives the inspection request form.
 *
 * PLACEHOLDER: right now a submission is checked and written to the Vercel
 * log, and nothing else. To have leads land in an inbox or CRM, set the
 * CONTACT_WEBHOOK_URL environment variable in Vercel to any service that
 * accepts a JSON POST (Zapier, Make, Formspree, a Slack webhook…) and
 * redeploy. Until then, check Vercel → Project → Logs to see requests.
 */
import { NextResponse } from "next/server";

type Body = { name?: unknown; phone?: unknown; address?: unknown; message?: unknown; company?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // Honeypot filled in: a bot. Pretend it worked so it doesn't retry.
  if (str(body.company, 200)) return NextResponse.json({ ok: true });

  const lead = {
    name: str(body.name, 120),
    phone: str(body.phone, 40),
    address: str(body.address, 300),
    message: str(body.message, 3000),
    receivedAt: new Date().toISOString(),
  };

  if (lead.name.length < 2 || lead.phone.replace(/\D/g, "").length < 10 || lead.address.length < 5) {
    return NextResponse.json({ ok: false, error: "Missing name, phone or address" }, { status: 422 });
  }

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "heritage-safe-roofing website", ...lead }),
      });
      if (!res.ok) throw new Error(`Webhook answered ${res.status}`);
    } catch (err) {
      console.error("[contact] could not forward lead", err, lead);
      return NextResponse.json({ ok: false, error: "Could not deliver" }, { status: 502 });
    }
  } else {
    console.log("[contact] new inspection request (no CONTACT_WEBHOOK_URL set)", lead);
  }

  return NextResponse.json({ ok: true });
}
