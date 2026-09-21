"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Retry affordance for a degraded read.
 *
 * A server component can't attach a click handler, so the default action is a
 * `router.refresh()` -- which re-runs the server component that owns the
 * failed query. Callers inside a client component can pass `onRetry` to
 * re-run just their own fetch (e.g. "load older setups") instead of
 * refreshing the whole route.
 *
 * Reads are served from a short-lived (`unstable_cache`) entry, so a retry
 * immediately after a failure can still see the cached emptiness -- the copy
 * this pairs with says "in a moment" rather than promising an instant fix.
 */
export function RetryButton({
  label = "Try again",
  onRetry,
  className,
}: {
  label?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          if (onRetry) onRetry();
          else router.refresh();
        })
      }
    >
      <RefreshCw className={cn(isPending && "animate-spin")} aria-hidden="true" />
      {isPending ? "Trying again…" : label}
    </Button>
  );
}
