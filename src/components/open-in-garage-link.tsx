import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ENGINEER_GAMES, type EngineerGame } from "@/lib/engineer-types";
import type { Game } from "@/lib/types";

/** Starts the authenticated, server-derived Garage flow for reviewed Engineer games. */
export function OpenInGarageLink({ setupId, game }: { setupId: string; game: Game }) {
  if (!ENGINEER_GAMES.includes(game as EngineerGame)) return null;

  return (
    <section className="mb-6 flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <p className="font-semibold">Ready to test this setup?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a private Garage session. Setup values are copied only if you opt in.
        </p>
      </div>
      {/* Secondary CTA: Download is the page's primary action (in the card).
          Open in Garage never competes with it in color. */}
      <Button asChild variant="outline" className="shrink-0">
        <Link href={`/garage?from=${encodeURIComponent(setupId)}`}>
          Open in Garage
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
