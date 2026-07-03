import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  value,
  max = 5,
  className,
  onChange,
}: {
  value: number;
  max?: number;
  className?: string;
  onChange?: (value: number) => void;
}) {
  if (onChange) {
    return (
      <div className={cn("flex items-center gap-0.5", className)} aria-label={`${value} out of ${max} stars`}>
        {Array.from({ length: max }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="p-0.5"
            aria-label={`Rate ${i + 1} out of ${max}`}
          >
            <Star
              className={cn(
                "size-4 transition-colors",
                i < value
                  ? "fill-racing-green text-racing-green"
                  : "fill-transparent text-muted-foreground/40 hover:text-racing-green/60"
              )}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < value
              ? "fill-racing-green text-racing-green"
              : "fill-transparent text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}
