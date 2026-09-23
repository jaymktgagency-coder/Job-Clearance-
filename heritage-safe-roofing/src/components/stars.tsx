import { StarIcon } from "./icons";

/** Five filled stars. The label says the rating out loud for screen readers. */
export function Stars({ className = "h-4 w-4", label = "5 out of 5 stars" }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gold-500" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} className={className} />
      ))}
    </span>
  );
}
