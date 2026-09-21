import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Read-only display for a community-average rating (Pace/Predictability).
 *
 * The bar is the visual, but the value is printed as a star + "4.2 out of 5"
 * rather than a bare percentage: a lone "60%" gave no clue what it was a
 * percentage *of*, and readers had to reverse-engineer the 5-star scale the
 * picker uses. The percentage survives in the title/description for anyone who
 * wants it.
 */
export function RatingBar({
  value,
  max = 5,
  color,
  className,
}: {
  value: number;
  max?: number;
  color: "coral" | "cyan";
  className?: string;
}) {
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
  const pct = max > 0 ? Math.round((safeValue / max) * 100) : 0;
  const rounded = Number(safeValue.toFixed(1));

  return (
    <div className={cn("flex flex-1 items-center gap-2", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={`${safeValue.toFixed(1)} out of ${max}`}
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full rounded-full",
            color === "coral" ? "bg-racing-coral" : "bg-racing-cyan"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className="flex w-11 shrink-0 items-center gap-0.5 font-mono text-[11px] tabular-nums text-muted-foreground"
        title={`${pct}% — community average of ratings out of ${max}`}
      >
        <Star
          className={cn(
            "size-3 shrink-0 fill-current",
            color === "coral" ? "text-racing-coral" : "text-racing-cyan"
          )}
          aria-hidden="true"
        />
        {safeValue.toFixed(1)}
      </span>
    </div>
  );
}
