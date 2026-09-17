/**
 * /inbox — the voucher's list of people asking for a vouch.
 *
 * Only shows requests for roles at their own company. That isn't a filter
 * written here — it's a database rule, so a voucher at one company physically
 * cannot see another company's people even if this page asked for them.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InboxPage(props: PageProps<"/inbox">) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const supabase = await createClient();
  const { data: vp } = await supabase
    .from("voucher_profiles")
    .select("status, companies(name)")
    .maybeSingle();

  // An unverified voucher has nothing to see here — send them to verify.
  if (vp?.status !== "verified") redirect("/verify");

  const company = Array.isArray(vp?.companies) ? vp?.companies[0] : vp?.companies;
  const params = await props.searchParams;

  const { data: requests } = await supabase
    .from("intro_requests")
    .select("id, message, created_at, seeker_id, jobs(title), users!intro_requests_seeker_id_fkey(full_name, seeker_profiles(headline, location, years_experience))")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // How many vouches they have running, against the cap.
  const { count: openVouches } = await supabase
    .from("vouches")
    .select("id", { count: "exact" })
    .eq("voucher_id", profile.id)
    .is("withdrawn_at", null)
    .limit(1);

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Your inbox</h1>
        <Badge variant="soft">{openVouches ?? 0} of 5 vouches open</Badge>
      </div>
      <p className="measure mt-3 text-lg text-muted-foreground">
        People asking for a vouch at {company?.name ?? "your company"}. You
        choose who — and declining is a perfectly good answer.
      </p>

      {params.vouched ? (
        <p
          role="status"
          className="mt-6 rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          Vouch written. {company?.name} can now see this candidate, along with
          what you said and what you stand to earn.
        </p>
      ) : null}
      {params.declined ? (
        <p
          role="status"
          className="mt-6 rounded-lg bg-sunken px-4 py-3 text-sm text-muted-foreground"
        >
          Declined. They&apos;ll see that nobody took it on — not who, or why.
        </p>
      ) : null}

      <div className="mt-8 space-y-4">
        {(requests ?? []).map((r) => {
          const person = Array.isArray(r.users) ? r.users[0] : r.users;
          const sp = Array.isArray(person?.seeker_profiles)
            ? person?.seeker_profiles[0]
            : person?.seeker_profiles;
          const job = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;

          return (
            <Card key={r.id as string} interactive className="group">
              <CardHeader>
                <CardTitle className="text-lg">
                  {/* Stretched over the whole card, so the tap target is the
                      card and not just the name. */}
                  <Link
                    href={`/inbox/${r.id}`}
                    className="after:absolute after:inset-0 after:content-[''] group-hover/card:text-brand-800"
                  >
                    {person?.full_name ?? "Someone"}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {sp?.headline ?? "No headline yet"}
                  {sp?.location ? ` · ${sp.location}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Applying for </span>
                  <span className="font-semibold">{job?.title}</span>
                </p>
                {r.message ? (
                  <blockquote className="measure border-l-2 border-brand-200 pl-3 text-sm text-muted-foreground italic">
                    {r.message}
                  </blockquote>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Asked {new Date(r.created_at as string).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-semibold text-brand-700">
                    Read their profile →
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(requests ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-semibold">Nobody is waiting on you right now.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When someone asks for an intro to a role at {company?.name}, it
                appears here.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

        <p className="mt-8 text-sm text-muted-foreground">
          A vouch stays open until the employer hires or passes on that person.
        </p>
      </main>
    </>
  );
}
