import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared empty and failed-read treatment. Both states use the same quiet
 * neutral container; a failed read is distinguished semantically and with a
 * small inline error accent instead of coloring the entire panel.
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
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/80 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-inset ring-border">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className={cn("text-lg font-semibold", isError && "text-destructive")}>{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
