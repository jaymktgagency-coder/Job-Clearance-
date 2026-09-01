/**
 * separation-panel.tsx — the "did this job end?" panel, for both sides.
 *
 * Plain English: one component, shown to the employer on their candidate list
 * and to the seeker on their requests page. Which buttons appear depends on
 * who is looking and whose turn it is.
 *
 * The wording matters as much as the buttons here. Both people are being
 * asked about something with money attached, and each should be able to see
 * what their answer does before they give it.
 */

"use client";

import { useActionState } from "react";
import {
  confirmSeparation,
  disputeSeparation,
  reportSeparation,
  type SeparationState,
} from "@/app/hires/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SeparationHire = {
  id: string;
  start_date: string;
  status: string;
  separated_at: string | null;
  separation_reported_by: string | null;
  separation_reported_at: string | null;
  separation_claimed_date: string | null;
  separation_confirmed_by_employer_at: string | null;
  separation_confirmed_by_seeker_at: string | null;
  separation_disputed_at: string | null;
};

type Props = {
  hire: SeparationHire;
  /** Which side is looking at this. */
  side: "employer" | "seeker";
  /** What to call the other person, e.g. "Northgate Coffee" or "Jordan". */
  otherParty: string;
};

/** Whole days between two dates, which is what every rule here counts in. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border p-3 text-sm">{children}</div>;
}

export function SeparationPanel({ hire, side, otherParty }: Props) {
  const [reportState, report, reporting] = useActionState<SeparationState, FormData>(
    reportSeparation,
    { error: null },
  );
  const [disputeState, dispute, disputing] = useActionState<SeparationState, FormData>(
    disputeSeparation,
    { error: null },
  );

  // Only a hire both sides agreed to can end.
  if (hire.status !== "confirmed") return null;

  const today = new Date().toISOString().slice(0, 10);

  // --- Settled: both sides agreed it ended ---------------------------------
  if (hire.separated_at) {
    const lasted = daysBetween(hire.start_date, hire.separated_at);
    return (
      <Wrapper>
        <p className="font-medium">This job ended on {hire.separated_at}.</p>
        <p className="mt-1 text-muted-foreground">
          {lasted} days from the start date.{" "}
          {side === "employer"
            ? lasted < 30
              ? "Because that's inside 30 days, you've been credited half the fee toward your next hire. We don't refund cash."
              : "That's past the 30-day window, so there's no credit — the fee stands."
            : lasted < 60
              ? "The person who vouched for you isn't paid, because the hold hadn't ended. That's how the 60 days works."
              : "The person who vouched for you saw out the full 60 days, so their share stands."}
        </p>
      </Wrapper>
    );
  }

  // --- Disputed: out of both their hands now -------------------------------
  if (hire.separation_disputed_at) {
    return (
      <Wrapper>
        <p className="font-medium">This one is with us.</p>
        <p className="mt-1 text-muted-foreground">
          You and {otherParty} don&apos;t agree about whether this job ended. Nothing
          has moved and nothing will until a person here has spoken to you both.
        </p>
      </Wrapper>
    );
  }

  // --- Somebody has reported it --------------------------------------------
  if (hire.separation_reported_at && hire.separation_claimed_date) {
    const mine =
      side === "employer"
        ? hire.separation_confirmed_by_employer_at
        : hire.separation_confirmed_by_seeker_at;

    if (mine) {
      return (
        <Wrapper>
          <p className="font-medium">
            Waiting on {otherParty} to confirm this job ended on{" "}
            {hire.separation_claimed_date}.
          </p>
          <p className="mt-1 text-muted-foreground">
            Nothing changes until they answer. If they don&apos;t within 7 days, a
            person here picks it up.
          </p>
        </Wrapper>
      );
    }

    // It's this person's turn to answer.
    const lasted = daysBetween(hire.start_date, hire.separation_claimed_date);
    return (
      <Wrapper>
        <p className="font-medium">
          {otherParty} says this job ended on {hire.separation_claimed_date}.
        </p>
        <p className="mt-1 text-muted-foreground">
          That&apos;s {lasted} days after the start date.{" "}
          {side === "employer"
            ? lasted < 30
              ? "If that's right, you get half the fee as credit toward your next hire."
              : "If that's right, the fee stands — the 30-day window has passed."
            : lasted < 60
              ? "If that's right, the person who vouched for you won't be paid. If it isn't right, say so."
              : "If that's right, the person who vouched for you still gets their share."}
        </p>

        {disputeState.notice ? (
          <p role="status" className="mt-3 text-muted-foreground">
            {disputeState.notice}
          </p>
        ) : (
          <>
            {disputeState.error ? (
              <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                {disputeState.error}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={confirmSeparation}>
                <input type="hidden" name="hire_id" value={hire.id} />
                <input type="hidden" name="side" value={side} />
                <Button type="submit" size="sm">
                  Yes, that&apos;s right
                </Button>
              </form>
              <form action={dispute}>
                <input type="hidden" name="hire_id" value={hire.id} />
                <Button type="submit" size="sm" variant="outline" disabled={disputing}>
                  {disputing ? "Sending..." : "No, that isn't right"}
                </Button>
              </form>
            </div>
          </>
        )}
      </Wrapper>
    );
  }

  // --- Nobody has said anything: offer to report it -------------------------
  if (reportState.notice) {
    return (
      <Wrapper>
        <p role="status" className="text-muted-foreground">{reportState.notice}</p>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <form action={report} className="space-y-3">
        <input type="hidden" name="hire_id" value={hire.id} />
        {reportState.error ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
            {reportState.error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`last-day-${hire.id}`}>
            {side === "employer"
              ? "If they've left, when was their last day?"
              : "If you've left this job, when was your last day?"}
          </Label>
          <Input
            id={`last-day-${hire.id}`}
            name="last_day"
            type="date"
            min={hire.start_date}
            max={today}
            required
          />
          <p className="text-muted-foreground">
            {side === "employer"
              ? "We'll ask them to confirm it. Inside 30 days you're credited half the fee toward your next hire — we don't refund cash."
              : "We'll ask your employer to confirm it. This is also how the person who vouched for you is paid or not, so it's worth getting the date right."}
          </p>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={reporting}>
          {reporting ? "Recording..." : "Record that this job ended"}
        </Button>
      </form>
    </Wrapper>
  );
}
