/**
 * /employer/locations — the places this company hires into.
 *
 * Plain English: a branch, a store, a site. Every role points at one, and the
 * seeker's distance search measures from its ZIP code.
 *
 * This page is new and the reason is worth recording: `locations` has existed
 * since the first migration and nothing in the product could ever create or
 * edit one. The only rows were the demo seed's, and none of them had a ZIP —
 * so "roles within 25 miles" had nothing to measure from and would have
 * shipped dead, the same way the Category filter did.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { LocationForm } from "./LocationForm";
import { setLocationActive } from "./actions";
import { AppHeader } from "@/components/app-header";
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

export default async function LocationsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employer") redirect("/dashboard");

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", profile.id)
    .maybeSingle();

  const { data: locations } = membership?.company_id
    ? await supabase
        .from("locations")
        .select("id, label, address_line1, city, region, postal_code, is_active")
        .eq("company_id", membership.company_id)
        .order("label")
    : { data: [] };

  const rows = locations ?? [];
  const missingZip = rows.filter((l) => !l.postal_code && l.is_active).length;

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">Your places</h1>
          <Button variant="outline" render={<Link href="/employer/jobs" />}>
            Your roles
          </Button>
        </div>
        <p className="measure mt-3 text-lg text-muted-foreground">
          The branches, stores or sites you hire into. Every role points at one
          of these, and job seekers search by how far it is from them.
        </p>

        {missingZip > 0 ? (
          <div className="mt-6 rounded-lg border border-brand-300 bg-brand-50/60 p-4 text-sm">
            <p className="font-semibold">
              {missingZip} {missingZip === 1 ? "place has" : "places have"} no ZIP code.
            </p>
            <p className="mt-1 text-muted-foreground">
              Roles there are still listed, but they will not appear when
              somebody searches for work within a certain distance of
              themselves. Adding the ZIP fixes that immediately.
            </p>
          </div>
        ) : null}

        <div className="mt-8 space-y-4">
          {rows.map((l) => (
            <Card key={l.id as string}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2.5 text-lg">
                  {l.label as string}
                  {!l.is_active ? <Badge variant="outline">Retired</Badge> : null}
                  {l.is_active && !l.postal_code ? (
                    <Badge variant="soft">No ZIP</Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  {[l.address_line1, l.city, l.region, l.postal_code]
                    .filter(Boolean)
                    .join(", ") || "No address yet"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700">
                    Edit this place
                  </summary>
                  <div className="mt-4">
                    <LocationForm
                      values={{
                        id: l.id as string,
                        label: (l.label as string) ?? "",
                        address_line1: (l.address_line1 as string) ?? "",
                        city: (l.city as string) ?? "",
                        region: (l.region as string) ?? "",
                        postal_code: (l.postal_code as string) ?? "",
                      }}
                      onDoneLabel="Save changes"
                    />
                  </div>
                </details>

                <form action={setLocationActive}>
                  <input type="hidden" name="location_id" value={l.id as string} />
                  <input
                    type="hidden"
                    name="is_active"
                    value={l.is_active ? "false" : "true"}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    {l.is_active ? "Retire it" : "Bring it back"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}

          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="font-semibold">No places yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the first one below, then your roles can point at it.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Add a place</CardTitle>
            <CardDescription>
              One per branch, store or site you hire into.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocationForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
