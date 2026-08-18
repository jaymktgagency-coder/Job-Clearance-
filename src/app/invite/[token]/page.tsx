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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            {usable ? `${company} invited you to Vouch` : "This invitation can't be used"}
          </CardTitle>
          <CardDescription>
            {usable
              ? "Vouching means writing a short, honest note about someone applying where you work. You choose who — and you can always decline."
              : used
                ? "This invitation has already been used, or was withdrawn. Ask whoever sent it for a fresh one."
                : expired
                  ? "This invitation has expired. Ask whoever sent it for a fresh one."
                  : "We don't recognise this link. Check you copied all of it."}
          </CardDescription>
        </CardHeader>

        {usable ? (
          <CardContent className="space-y-5">
            <div className="rounded-md border p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Company: </span>
                <span className="font-medium">{company}</span>
              </p>
              {location ? (
                <p className="mt-1">
                  <span className="text-muted-foreground">Location: </span>
                  <span className="font-medium">{location}</span>
                </p>
              ) : null}
              <p className="mt-3 text-muted-foreground">
                Because {company} invited you directly, you won&apos;t need to verify a
                work email address — this invitation is the proof.
              </p>
            </div>

            <Button render={<Link href={`/signup?invite=${encodeURIComponent(token)}`} />}>
              Accept and create my account
            </Button>
          </CardContent>
        ) : (
          <CardContent>
            <Button variant="outline" render={<Link href="/" />}>
              Back to Vouch
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
