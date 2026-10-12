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
      <div
        className={cn("flex items-center gap-0.5", className)}
        role="group"
        aria-label={`${value} out of ${max} stars`}
      >
        {Array.from({ length: max }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-sm p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label={`Rate ${i + 1} out of ${max}`}
          >
            <Star
              className={cn(
                "size-4",
                i < value
                  ? "fill-primary text-primary"
                  : "fill-transparent text-muted-foreground/40 hover:text-foreground"
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
              ? "fill-foreground text-foreground"
              : "fill-transparent text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}
