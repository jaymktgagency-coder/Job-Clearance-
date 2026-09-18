/**
 * ai-notice.tsx — the notice seekers must see about AI.
 *
 * Plain English: Vouch uses AI to help rank applications, and seekers have a
 * right to know that. This is a legal requirement, not a nicety, so it lives
 * in one component used everywhere a seeker's application is involved — that
 * way it can't be forgotten on one screen.
 *
 * The wording is deliberate on two points: the score is ADVISORY, and a human
 * makes every decision.
 */

import { SparklesIcon } from "lucide-react";

export function AiNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg bg-brand-50 p-4 text-sm text-brand-900 ${className}`}
      data-testid="ai-notice"
    >
      <SparklesIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">How AI is used here:</strong> Vouch
        uses AI to read your resume and to suggest how well you fit a role. The
        score is advisory only — it is shown to employers alongside its written
        reasoning, it never rejects anyone automatically, and every decision
        about you is made by a person.
      </p>
    </div>
  );
}
