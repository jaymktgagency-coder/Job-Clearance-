/**
 * vouch-chain.tsx — the diagram in the hero.
 *
 * Plain English: this is the one piece of motion on the home page, and it
 * draws the actual mechanism of the product rather than decorating it. A line
 * runs from you, through someone who already works there, to the role. The
 * middle mark is the vouch — the thing employers pay for and the thing this
 * whole company is.
 *
 * Two deliberate choices:
 *
 * - It is real HTML, not a picture. The labels are selectable text, they
 *   scale with the reader's font size, and a screen reader gets the sentence
 *   spelled out in `sr-only` below rather than a shrug.
 *
 * - The resting state is the FINISHED state, and the animation runs backwards
 *   from hidden into it. That matters for anyone who has "reduce motion"
 *   switched on: the global rule in globals.css collapses the duration to
 *   nothing, so they land on the complete diagram instantly instead of on an
 *   empty box that never fills in.
 */

import { BriefcaseIcon, CheckIcon, UserIcon } from "lucide-react";

const STEPS = [
  {
    icon: UserIcon,
    label: "You",
    note: "No network needed",
  },
  {
    icon: CheckIcon,
    label: "Someone inside",
    note: "Vouches for you",
    highlight: true,
  },
  {
    icon: BriefcaseIcon,
    label: "The role",
    note: "Sees you first",
  },
] as const;

export function VouchChain() {
  return (
    <div className="vouch-chain relative w-full">
      {/* One plain sentence for anyone who cannot see the diagram. The visual
          version is hidden from screen readers to avoid reading it twice. */}
      <p className="sr-only">
        How it works: you, then someone who already works at the company
        vouches for you, then the role sees you first.
      </p>

      <ol
        aria-hidden="true"
        className="relative mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:gap-6"
      >
        {/* The rail the marks sit on. It grows out from the left as the
            diagram arrives, which is why it is a separate element rather
            than a border on the list. */}
        <span
          className="vouch-chain-rail absolute top-8 right-[16.666%] left-[16.666%] h-0.5 origin-left rounded-full bg-brand-300 sm:top-9"
          aria-hidden="true"
        />

        {STEPS.map(({ icon: Icon, label, note, ...rest }, i) => {
          const highlight = "highlight" in rest && rest.highlight;
          return (
            <li
              key={label}
              className="vouch-chain-step relative flex flex-col items-center text-center"
              style={{ ["--i" as string]: i }}
            >
              <span
                className={
                  highlight
                    ? "relative grid size-16 place-items-center rounded-full bg-brand-500 text-primary-foreground shadow-brand-lg sm:size-[4.5rem]"
                    : "relative grid size-16 place-items-center rounded-full bg-card text-brand-700 shadow-raised-md sm:size-[4.5rem]"
                }
              >
                <Icon
                  className={highlight ? "size-7" : "size-6"}
                  strokeWidth={highlight ? 3 : 2}
                />
              </span>
              <span className="mt-4 text-sm font-semibold sm:text-base">{label}</span>
              <span className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {note}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
