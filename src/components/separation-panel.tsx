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
import { FormError } from "@/components/form-message";
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

/**
 * `tone` carries meaning here, not decoration. "settled" is a finished fact,
 * "held" is a dispute nobody can move, "asking" is a question waiting on this
 * person. Each one is also stated in words, because colour alone is never a
 * signal — especially on a panel about money.
 */
function Wrapper({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "settled" | "held" | "asking";
}) {
  const tones = {
    plain: "bg-sunken",
    settled: "bg-sunken",
    held: "bg-destructive/8 text-destructive",
    asking: "bg-brand-50 text-brand-900",
  } as const;
  return (
    <div className={`rounded-lg p-4 text-sm ${tones[tone]}`}>{children}</div>
  );
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
      <Wrapper tone="settled">
        <p className="font-semibold">
          This job ended on{" "}
          <span className="tabular">{hire.separated_at}</span>.
        </p>
        <p className="measure mt-1.5 text-muted-foreground">
          <span className="tabular">{lasted}</span> days from the start date.{" "}
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
      <Wrapper tone="held">
        <p className="font-semibold">This one is with us.</p>
        <p className="measure mt-1.5">
          You and {otherParty} don&apos;t agree about whether this job ended.
          Nothing has moved and nothing will until a person here has spoken to
          you both.
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
          <p className="font-semibold">
            Waiting on {otherParty} to confirm this job ended on{" "}
            <span className="tabular">{hire.separation_claimed_date}</span>.
          </p>
          <p className="measure mt-1.5 text-muted-foreground">
            Nothing changes until they answer. If they don&apos;t within 7 days, a
            person here picks it up.
          </p>
        </Wrapper>
      );
    }

    // It's this person's turn to answer.
    const lasted = daysBetween(hire.start_date, hire.separation_claimed_date);
    return (
      <Wrapper tone="asking">
        <p className="font-semibold">
          {otherParty} says this job ended on{" "}
          <span className="tabular">{hire.separation_claimed_date}</span>.
        </p>
        <p className="measure mt-1.5 text-brand-800">
          That&apos;s <span className="tabular">{lasted}</span> days after the
          start date.{" "}
          {side === "employer"
            ? lasted < 30
              ? "If that's right, you get half the fee as credit toward your next hire."
              : "If that's right, the fee stands — the 30-day window has passed."
            : lasted < 60
              ? "If that's right, the person who vouched for you won't be paid. If it isn't right, say so."
              : "If that's right, the person who vouched for you still gets their share."}
        </p>

        {disputeState.notice ? (
          <p role="status" className="mt-3">
            {disputeState.notice}
          </p>
        ) : (
          <>
            {disputeState.error ? (
              <FormError className="mt-3">{disputeState.error}</FormError>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <form action={confirmSeparation}>
                <input type="hidden" name="hire_id" value={hire.id} />
                <input type="hidden" name="side" value={side} />
                <Button type="submit">Yes, that&apos;s right</Button>
              </form>
              <form action={dispute}>
                <input type="hidden" name="hire_id" value={hire.id} />
                <Button type="submit" variant="outline" loading={disputing}>
                  No, that isn&apos;t right
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
        <p role="status" className="text-muted-foreground">
          {reportState.notice}
        </p>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <form action={report} className="space-y-3">
        <input type="hidden" name="hire_id" value={hire.id} />
        <FormError>{reportState.error}</FormError>
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
          <p className="measure text-muted-foreground">
            {side === "employer"
              ? "We'll ask them to confirm it. Inside 30 days you're credited half the fee toward your next hire — we don't refund cash."
              : "We'll ask your employer to confirm it. This is also how the person who vouched for you is paid or not, so it's worth getting the date right."}
          </p>
        </div>
        <Button type="submit" variant="outline" loading={reporting}>
          Record that this job ended
        </Button>
      </form>
    </Wrapper>
  );
}
