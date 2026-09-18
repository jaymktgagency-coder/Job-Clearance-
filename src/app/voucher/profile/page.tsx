/**
 * /voucher/profile — a voucher's own page.
 *
 * Plain English: vouchers had no profile page at all. The header linked them
 * to /profile, which is the seeker's page, and that page bounced them straight
 * back to their dashboard — so the "Profile" link did nothing but flicker.
 *
 * What a voucher can change here is only ever a description of themselves.
 * Being verified, which company they are verified at, and anything to do with
 * being paid are established elsewhere and are shown here as facts, not
 * fields.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";
import { VoucherProfileForm } from "./VoucherProfileForm";
import {
  uploadVoucherAvatar,
  removeVoucherAvatar,
} from "./actions";
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

const STATUS_LABEL: Record<string, string> = {
  unverified: "Not verified yet",
  pending: "Verification in progress",
  verified: "Verified",
  suspended: "Suspended",
};

export default async function VoucherProfilePage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "voucher") redirect("/dashboard");

  const supabase = await createClient();
  const { data: vp } = await supabase
    .from("voucher_profiles")
    .select("job_title, status, verified_at, companies(name, logo_url)")
    .eq("user_id", profile.id)
    .maybeSingle();

  const company = Array.isArray(vp?.companies) ? vp?.companies[0] : vp?.companies;

  return (
    <>
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold sm:text-4xl">Your profile</h1>
        <p className="measure mt-3 text-lg text-muted-foreground">
          An employer reads this beside every vouch you write. It is the reason
          your word counts for anything.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Your picture</CardTitle>
            <CardDescription>
              Shown next to your name on the vouches you write, and in the
              seeker&apos;s view of who backed them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PictureForm
              currentUrl={profile.avatar_url}
              name={profile.full_name}
              uploadAction={uploadVoucherAvatar}
              removeAction={removeVoucherAvatar}
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>About you</CardTitle>
          </CardHeader>
          <CardContent>
            <VoucherProfileForm
              values={{
                full_name: profile.full_name ?? "",
                job_title: vp?.job_title ?? "",
              }}
            />
          </CardContent>
        </Card>

        {/* Facts, not fields. A voucher marking themselves verified is the
            very first thing the database was built to refuse. */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Where you work</CardTitle>
            <CardDescription>
              Set when you were verified. Only Vouch can change it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{company?.name ?? "Not set"}</span>
            <Badge variant={vp?.status === "verified" ? "success" : "outline"}>
              {STATUS_LABEL[vp?.status ?? "unverified"] ?? vp?.status}
            </Badge>
            {vp?.verified_at ? (
              <span className="text-muted-foreground">
                since {new Date(vp.verified_at as string).toLocaleDateString()}
              </span>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
