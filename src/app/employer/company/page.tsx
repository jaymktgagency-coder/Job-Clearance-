/**
 * /employer/company — the company's own page.
 *
 * Plain English: employers had nowhere to change anything about their company
 * after signing up. The header pointed them at /profile, which is the
 * seeker's page and bounced them straight back to the dashboard.
 *
 * The badges are shown here but cannot be edited. They are what Vouch has
 * established about the company, not what the company says about itself, and
 * the database enforces that regardless of what this page sends.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { CompanyForm } from "./CompanyForm";
import { uploadCompanyLogo, removeCompanyLogo } from "./actions";
import { AppHeader } from "@/components/app-header";
import { PictureForm } from "@/components/picture-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  domain: "Verified Domain",
  business: "Verified Business",
  none: "Not verified yet",
};

export default async function CompanyPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employer") redirect("/dashboard");

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", profile.id)
    .maybeSingle();

  const { data: company } = membership?.company_id
    ? await supabase
        .from("companies")
        .select("name, website, description, logo_url, verification_tier")
        .eq("id", membership.company_id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold sm:text-4xl">Your company</h1>
        <p className="measure mt-3 text-lg text-muted-foreground">
          This is what a job seeker sees beside every role you post.
        </p>

        {!company ? (
          <Card className="mt-8">
            <CardContent className="py-6">
              <p className="font-semibold">
                We couldn&apos;t find a company for your account.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                If you have just signed up, finish setting up first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Your logo</CardTitle>
                <CardDescription>
                  Shown on every role you post and in the seeker&apos;s list of
                  open roles. A square image works best.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PictureForm
                  currentUrl={company.logo_url as string | null}
                  name={company.name as string}
                  uploadAction={uploadCompanyLogo}
                  removeAction={removeCompanyLogo}
                  label="Company logo"
                  hint="Your logo, ideally square. JPG, PNG, WebP or GIF, up to 2 MB."
                  contain
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <CompanyForm
                  values={{
                    name: (company.name as string) ?? "",
                    website: (company.website as string) ?? "",
                    description: (company.description as string) ?? "",
                  }}
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Verification</CardTitle>
                <CardDescription>
                  Established by Vouch. Nothing on this page can change it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    company.verification_tier === "none" ? "outline" : "success"
                  }
                >
                  {TIER_LABEL[company.verification_tier as string] ??
                    (company.verification_tier as string)}
                </Badge>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
