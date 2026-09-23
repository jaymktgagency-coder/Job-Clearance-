/**
 * The Heritage Safe Roofing mark, redrawn as clean SVG from the signage:
 * a navy shield with a gold rim, a gold roof with chimney, and a white house.
 * One component, so the header, footer and favicon can never drift apart.
 */

type MarkProps = { className?: string; title?: string };

export function LogoMark({ className, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 72"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* Shield */}
      <path
        d="M32 2.5 59.5 12v22.5c0 17.6-12.4 29.4-27.5 35.5C16.9 63.9 4.5 52.1 4.5 34.5V12L32 2.5Z"
        fill="var(--color-navy-800)"
        stroke="var(--color-gold-500)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* House */}
      <path d="M19 37 32 26.5 45 37v18.5H19Z" fill="#fff" />
      <rect x="28.5" y="43" width="7" height="12.5" rx="0.6" fill="var(--color-navy-800)" />
      <rect x="21.8" y="41" width="4.6" height="4.6" fill="var(--color-navy-800)" />
      <rect x="37.6" y="41" width="4.6" height="4.6" fill="var(--color-navy-800)" />
      {/* Chimney + roof */}
      <path d="M41.5 19.5h5.5v11.2l-5.5-4.4Z" fill="var(--color-gold-500)" />
      <path d="M32 15.5 9.5 33.8l3.9 4.6L32 23.3l18.6 15.1 3.9-4.6L32 15.5Z" fill="var(--color-gold-500)" />
    </svg>
  );
}

type LogoProps = { tone?: "light" | "dark"; className?: string };

/** Mark + wordmark. `tone` is the background it sits on. */
export function Logo({ tone = "light", className = "" }: LogoProps) {
  const onDark = tone === "dark";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-11 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-[1.05rem] font-extrabold tracking-[0.01em] uppercase [font-stretch:112%] ${onDark ? "text-white" : "text-navy-900"}`}
        >
          Heritage Safe
        </span>{" "}
        <span
          className={`mt-1 text-[0.68rem] font-bold tracking-[0.32em] uppercase ${onDark ? "text-gold-400" : "text-gold-800"}`}
        >
          Roofing
        </span>
      </span>
    </span>
  );
}
