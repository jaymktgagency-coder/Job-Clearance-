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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your inbox</h1>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          Dashboard
        </Button>
      </div>
      <p className="mt-2 text-muted-foreground">
        People asking for a vouch at {company?.name ?? "your company"}. You choose
        who — and declining is a perfectly good answer.
      </p>

      {params.vouched ? (
        <p role="status" className="mt-6 rounded-md border px-3 py-2 text-sm">
          Vouch written. {company?.name} can now see this candidate, along with
          what you said and what you stand to earn.
        </p>
      ) : null}
      {params.declined ? (
        <p role="status" className="mt-6 rounded-md border px-3 py-2 text-sm text-muted-foreground">
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
            <Card key={r.id as string}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/inbox/${r.id}`} className="underline-offset-4 hover:underline">
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
                  <span className="font-medium">{job?.title}</span>
                </p>
                {r.message ? (
                  <p className="text-sm italic text-muted-foreground">&ldquo;{r.message}&rdquo;</p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Asked {new Date(r.created_at as string).toLocaleDateString()}
                  </span>
                  <Button size="sm" render={<Link href={`/inbox/${r.id}`} />}>
                    Read their profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(requests ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <p>Nobody is waiting on you right now.</p>
              <p className="mt-1">
                When someone asks for an intro to a role at {company?.name}, it
                appears here.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Badge variant="outline">{openVouches ?? 0} of 5 vouches open</Badge>{" "}
        A vouch stays open until the employer hires or passes on that person.
      </p>
    </main>
  );
}
