"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportClientError } from "@/components/telemetry-provider";

/**
 * Catches any client-side rendering error below the root layout. Without
 * this, an unhandled exception anywhere in the tree falls through to
 * Next.js's generic "Application error" page -- no styling, no recovery,
 * and (critically) nothing logged anywhere a developer can see it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reports to the structured log stream *and* the telemetry channel, so a
    // client crash is visible without a third-party error-tracking SDK.
    reportClientError("Unhandled application error:", error.digest);
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24">
      <Card className="w-full items-center gap-4 border-racing-red/30 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-racing-red ring-1 ring-inset ring-racing-red/30">
          <AlertTriangle className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            That&apos;s on us, not you. Give it another try — if it keeps
            happening, come back later and we&apos;ll have it sorted.
          </p>
        </div>
        <Button onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
      </Card>
    </div>
  );
}
