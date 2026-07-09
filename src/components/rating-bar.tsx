import { cn } from "@/lib/utils";

/**
 * Read-only display for a community-average rating (Pace/Predictability)
 * as a percentage fill bar. The interactive picker a user clicks to submit
 * their own 1-5 rating stays StarRating -- a bar doesn't work as a click
 * target, this is purely the aggregate-display half of the redesign.
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
  const pct = Math.round((value / max) * 100);

  return (
    <div className={cn("flex flex-1 items-center gap-2", className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full",
            color === "coral" ? "bg-racing-coral" : "bg-racing-cyan"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}
