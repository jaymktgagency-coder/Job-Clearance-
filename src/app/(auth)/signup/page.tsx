/**
 * /signup — create an account and say which of the three roles you are.
 *
 * If someone follows an employer's invitation link, the token comes in as
 * ?invite=... and we look up which company sent it so the page can name them.
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth";
import { hashInviteToken } from "@/lib/invites";
import { RoleForm } from "./RoleForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Looks up the company behind an invitation token. Null if it's no good. */
async function invitedCompanyName(token: string): Promise<string | null> {
  try {
    const db = await createAdminClient();
    const { data } = await db
      .from("voucher_invitations")
      .select("company_id, status, expires_at, companies(name)")
      .eq("token_hash", hashInviteToken(token))
      .maybeSingle();

    if (!data || data.status !== "sent") return null;
    if (new Date(data.expires_at as string) < new Date()) return null;

    const company = data.companies as { name: string } | { name: string }[] | null;
    return Array.isArray(company) ? (company[0]?.name ?? null) : (company?.name ?? null);
  } catch {
    return null;
  }
}

export default async function SignUpPage(props: PageProps<"/signup">) {
  if (await currentUser()) redirect("/onboarding");

  const params = await props.searchParams;
  const raw = params.invite;
  const token = typeof raw === "string" ? raw : undefined;
  const company = token ? await invitedCompanyName(token) : null;

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Join Vouch</CardTitle>
          <CardDescription>
            {company
              ? `${company} has invited you to vouch for people applying there.`
              : "One account, whichever side of hiring you're on."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleForm inviteToken={token} invitedCompany={company ?? undefined} />
        </CardContent>
      </Card>
    </main>
  );
}
