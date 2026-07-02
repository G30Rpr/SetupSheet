import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  value,
  max = 5,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
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
