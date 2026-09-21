import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared "nothing here yet" treatment -- same icon-in-a-ring badge as the
 * error/not-found cards (error.tsx, setups/[id]/edit's not-found branch), just
 * in racing-green instead of racing-red since an empty state isn't a failure.
 *
 * `tone="error"` keeps the geometry but switches to racing-red and announces
 * itself, for the case where a read *failed* rather than a collection being
 * genuinely empty. Those two states used to share one treatment, which is how
 * an unreachable database ended up looking like "nobody has posted yet".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "empty",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "empty" | "error";
}) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center",
        isError ? "border-racing-red/40" : "border-border/80"
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-full ring-1 ring-inset",
          isError
            ? "bg-racing-red/10 text-racing-red ring-racing-red/25"
            : "bg-racing-green/10 text-racing-green ring-racing-green/25"
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
