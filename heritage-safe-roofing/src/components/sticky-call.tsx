import { business } from "@/lib/business";
import { PhoneIcon } from "./icons";

/**
 * Phones only: a bar pinned to the bottom of the screen so calling is always
 * one thumb-tap away, however far down the page someone has scrolled.
 */
export function StickyCall() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-700 bg-navy-900 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-6px_20px_-8px_rgb(7_20_42/0.5)] md:hidden">
      <div className="flex gap-2">
        <a
          href={business.phoneHref}
          className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-lg bg-gold-500 px-3 font-display text-base font-bold text-navy-900 transition-colors active:bg-gold-400"
        >
          <PhoneIcon className="h-5 w-5" />
          Call now
        </a>
        <a
          href="#contact"
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-white/70 px-3 text-center text-[0.95rem] leading-tight font-semibold text-white transition-colors active:bg-white/10"
        >
          Free inspection
        </a>
      </div>
    </div>
  );
}
