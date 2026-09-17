/**
 * /invite/<token> — where an employer's invitation link lands.
 *
 * Plain English: this checks the invitation is real and still valid, then
 * tells the person who invited them and sends them on to sign up with the
 * voucher path already chosen. This is the path that matters for businesses
 * with no company email domain — the invitation itself is the proof they
 * work there.
 */

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/invites";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Invitation = {
  status: string;
  expires_at: string;
  companies: { name: string } | { name: string }[] | null;
  locations: { label: string } | { label: string }[] | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;

  let invitation: Invitation | null = null;
  try {
    const db = await createAdminClient();
    const { data } = await db
      .from("voucher_invitations")
      .select("status, expires_at, companies(name), locations(label)")
      .eq("token_hash", hashInviteToken(token))
      .maybeSingle();
    invitation = (data as Invitation | null) ?? null;
  } catch {
    invitation = null;
  }

  const company = firstOf(invitation?.companies ?? null)?.name ?? null;
  const location = firstOf(invitation?.locations ?? null)?.label ?? null;

  const expired =
    invitation !== null && new Date(invitation.expires_at) < new Date();
  const used = invitation !== null && invitation.status !== "sent";
  const usable = invitation !== null && !expired && !used;

  return (
    <AuthShell
      greet={usable}
      title={usable ? `${company} invited you.` : "This invitation can't be used."}
      description={
        usable
          ? "Vouching means writing a short, honest note about someone applying where you work. You choose who — and you can always decline."
          : used
            ? "It has already been used, or was withdrawn. Ask whoever sent it for a fresh one."
            : expired
              ? "It has expired. Ask whoever sent it for a fresh one."
              : "We don't recognise this link. Check you copied all of it."
      }
    >
      {usable ? (
        <div className="space-y-5">
          <dl className="rounded-lg bg-sunken p-4 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Company</dt>
              <dd className="font-semibold">{company}</dd>
            </div>
            {location ? (
              <div className="mt-1 flex gap-2">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-semibold">{location}</dd>
              </div>
            ) : null}
          </dl>

          <p className="text-sm text-muted-foreground">
            Because {company} invited you directly, you won&apos;t need to
            verify a work email address — this invitation is the proof.
          </p>

          <Button
            size="lg"
            className="w-full"
            render={<Link href={`/signup?invite=${encodeURIComponent(token)}`} />}
          >
            Accept and create my account
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="lg" render={<Link href="/" />}>
          Back to Vouch
        </Button>
      )}
    </AuthShell>
  );
}
