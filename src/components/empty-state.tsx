import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared "nothing here yet" treatment -- same icon-in-a-ring badge as the
 * error/not-found cards (error.tsx, setups/[id]/edit's not-found branch),
 * just in racing-green instead of racing-red since an empty state isn't a
 * failure, before this it was five copies of a plain dashed box with no
 * visual identity.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/80 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-racing-green/10 text-racing-green ring-1 ring-inset ring-racing-green/25">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
