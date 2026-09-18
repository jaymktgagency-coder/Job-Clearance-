/**
 * outreach-panel.tsx — an employee who wrote to you first, and your answer.
 *
 * Plain English: somebody who actually works at a company you named has
 * written to you. Accept and they can vouch for you; decline and they cannot
 * write again.
 *
 * WHAT ACCEPTING DOES, SAID ON THE SCREEN
 * Accepting is not an application and does not commit anybody to anything. It
 * unlocks asking this person for an intro on one of their company's real open
 * roles, which is the ordinary request every other seeker makes — same cap,
 * same vouch, same fee, none of it changed. The panel says so, because a
 * button called "Accept" with no explanation is a button people do not press.
 */

import Link from "next/link";

import { acceptOutreach, declineOutreach } from "@/app/requests/outreach-actions";
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

export type ApproachRow = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  voucher_name: string;
  voucher_avatar: string | null;
  voucher_title: string | null;
  company_name: string;
  company_logo: string | null;
  /** That company's open roles, for the "now ask them" step after accepting. */
  openRoles: { id: string; title: string }[];
};

export function OutreachPanel({ approach }: { approach: ApproachRow }) {
  const pending = approach.status === "pending";
  const accepted = approach.status === "accepted";

  return (
    <Card className={pending ? "border-brand-300 bg-brand-50/40" : undefined}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar
            src={approach.voucher_avatar}
            name={approach.voucher_name}
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2.5 text-lg">
              {approach.voucher_name}
              {pending ? <Badge>New</Badge> : null}
              {accepted ? <Badge variant="success">You accepted</Badge> : null}
              {approach.status === "declined" ? (
                <Badge variant="outline">You declined</Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-1.5">
              {approach.voucher_title ? `${approach.voucher_title}, ` : ""}
              <Avatar
                src={approach.company_logo}
                name={approach.company_name}
                size="sm"
                contain
              />
              {approach.company_name}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <blockquote className="measure border-l-2 border-brand-300 pl-3 whitespace-pre-line italic">
          {approach.message}
        </blockquote>

        {pending ? (
          <>
            <p className="text-muted-foreground">
              They work at {approach.company_name} and can see your profile
              because you named that company. Accepting lets you ask them for
              an intro on one of their open roles — it doesn&apos;t apply for
              anything on its own, and they still see no resume until you do.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={acceptOutreach}>
                <input type="hidden" name="outreach_id" value={approach.id} />
                <Button type="submit" size="sm">
                  Accept
                </Button>
              </form>
              <form action={declineOutreach}>
                <input type="hidden" name="outreach_id" value={approach.id} />
                <Button type="submit" variant="outline" size="sm">
                  No thanks
                </Button>
              </form>
            </div>
            <p className="text-muted-foreground">
              Declining is final — they can&apos;t write to you again.
            </p>
          </>
        ) : null}

        {accepted ? (
          approach.openRoles.length > 0 ? (
            <div className="space-y-2">
              <p className="font-semibold">
                Ask {approach.voucher_name.split(" ")[0]} for an intro on one of
                these:
              </p>
              <div className="flex flex-wrap gap-2">
                {approach.openRoles.map((r) => (
                  <Button
                    key={r.id}
                    variant="outline"
                    size="sm"
                    render={
                      <Link href={`/jobs/${r.id}?outreach=${approach.id}`} />
                    }
                  >
                    {r.title}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            // The honest version of the dead end. Accepting was still worth
            // doing: this person now knows you are interested, and the moment
            // their employer posts something you can ask them directly.
            <p className="text-muted-foreground">
              {approach.company_name} hasn&apos;t got any open roles on Vouch
              right now. Your acceptance stands — as soon as they post one,
              you can ask {approach.voucher_name.split(" ")[0]} for an intro.
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
