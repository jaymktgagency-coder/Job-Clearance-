/**
 * /voucher/seekers — the people who want to work where you work.
 *
 * Plain English: until now a voucher could only answer. This is the list of
 * job seekers who have named your company, and the place you can write to one
 * of them first.
 *
 * WHO IS ON THIS LIST, AND WHY THAT IS THE WHOLE FEATURE
 * Only people who have named YOUR verified employer, and only while they are
 * open to being approached. Not every seeker. Not people who look similar to
 * your open roles. Somebody appears here because they typed your company's
 * name into their own profile, and they can take that back at any moment.
 *
 * Every row comes from `seekers_interested_in_my_company()`, which returns a
 * fixed list of columns and does the matching in the database. This page
 * cannot widen it by asking for more — there is no email address and no
 * resume in what comes back, by construction rather than by this page
 * remembering not to show them.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { OutreachForm } from "./OutreachForm";
import { withdrawOutreach } from "./actions";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** One row of what the database hands back. */
type Match = {
  seeker_id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[] | null;
  desired_titles: string[] | null;
  note: string | null;
  interested_at: string;
  outreach_id: string | null;
  outreach_status: string | null;
  outreach_sent_at: string | null;
};

const SENT_LABEL: Record<string, string> = {
  pending: "Waiting for an answer",
  accepted: "They said yes",
  declined: "They said no",
  withdrawn: "You withdrew this",
  expired: "No answer — expired",
};

export default async function VoucherSeekersPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: vp }, { data: matches }] = await Promise.all([
    supabase
      .from("voucher_profiles")
      .select("status, companies(name)")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.rpc("seekers_interested_in_my_company"),
  ]);

  // Same gate as the inbox: being unverified is not an empty list, it is a
  // different screen.
  if (vp?.status !== "verified") redirect("/verify");

  const company = Array.isArray(vp?.companies) ? vp?.companies[0] : vp?.companies;
  const companyName = (company?.name as string) ?? "your company";
  const rows = (matches ?? []) as Match[];

  // The cap counts messages still waiting. Worked out from the same rows the
  // page is already showing rather than a second query.
  const waiting = rows.filter((r) => r.outreach_status === "pending").length;
  const atCap = waiting >= 5;

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          People who want to work at {companyName}
        </h1>
        <p className="measure mt-3 text-lg text-muted-foreground">
          Everyone here has named {companyName} on their own profile, which is
          what lets you see them. You can write to one of them first — and if
          it goes well, they ask for an intro on a real role and you vouch as
          usual.
        </p>

        {rows.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {waiting > 0
              ? `${waiting} of your messages ${waiting === 1 ? "is" : "are"} waiting for an answer. The limit is 5.`
              : "You have no messages waiting for an answer."}
          </p>
        ) : null}

        <div className="mt-10 space-y-4">
          {rows.map((m) => {
            const name = m.full_name ?? "Someone";
            const sent = m.outreach_status;

            return (
              <Card key={m.seeker_id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Avatar src={m.avatar_url} name={name} />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex flex-wrap items-center gap-2.5 text-lg">
                        {name}
                        {sent ? (
                          <Badge
                            variant={
                              sent === "accepted"
                                ? "success"
                                : sent === "pending"
                                  ? "soft"
                                  : "outline"
                            }
                          >
                            {SENT_LABEL[sent] ?? sent}
                          </Badge>
                        ) : null}
                      </CardTitle>
                      <CardDescription>
                        {m.headline ?? "No headline yet"}
                        {m.location ? ` · ${m.location}` : ""}
                        {m.years_experience != null
                          ? ` · ${m.years_experience} years`
                          : ""}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-sm">
                  {m.note ? (
                    <div className="rounded-lg bg-sunken p-4">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Why they named {companyName}
                      </p>
                      <blockquote className="measure mt-2 border-l-2 border-brand-300 pl-3 italic">
                        {m.note}
                      </blockquote>
                    </div>
                  ) : null}

                  {(m.skills ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(m.skills ?? []).slice(0, 12).map((s) => (
                        <Badge key={s} variant="soft">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {(m.desired_titles ?? []).length > 0 ? (
                    <p className="text-muted-foreground">
                      Looking for: {(m.desired_titles ?? []).join(", ")}
                    </p>
                  ) : null}

                  {/* Said plainly rather than left to be discovered. A voucher
                      who expects a resume and finds none should know why. */}
                  <p className="text-muted-foreground">
                    Their resume stays private until they accept and ask you
                    for an intro.
                  </p>

                  {sent === "pending" && m.outreach_id ? (
                    <form action={withdrawOutreach}>
                      <input type="hidden" name="outreach_id" value={m.outreach_id} />
                      <Button type="submit" variant="outline" size="sm">
                        Withdraw my message
                      </Button>
                    </form>
                  ) : sent === "accepted" ? (
                    <p className="font-semibold text-success">
                      They said yes. Watch your inbox — they can now ask you
                      for an intro on one of {companyName}&apos;s open roles.
                    </p>
                  ) : sent ? null : (
                    <OutreachForm
                      seekerId={m.seeker_id}
                      seekerName={name}
                      companyName={companyName}
                      atCap={atCap}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="font-semibold">Nobody has named {companyName} yet.</p>
                <p className="measure mx-auto mt-1 text-sm text-muted-foreground">
                  Job seekers choose the companies they want to work at from
                  their own profile. Nothing is scraped and nobody is added to
                  this list without asking to be, so it fills up slowly and
                  everyone on it wants to hear from you.
                </p>
                <Button variant="outline" className="mt-4" render={<Link href="/inbox" />}>
                  Back to your inbox
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </>
  );
}
