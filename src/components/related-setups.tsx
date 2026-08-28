import Link from "next/link";

import { getRelatedSetups } from "@/lib/supabase/setups";
import type { Game } from "@/lib/types";

/** Streams below-the-fold discovery links without delaying the setup card's first paint. */
export async function RelatedSetups({ setupId, game }: { setupId: string; game: Game }) {
  const relatedSetups = await getRelatedSetups(setupId, game);
  if (relatedSetups.length === 0) return null;

  return (
    <section aria-labelledby="related-setups-heading" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="related-setups-heading" className="text-xl font-semibold tracking-tight">
            More {game} setups
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Keep exploring community tuning notes.</p>
        </div>
        <Link
          href={`/setups?game=${encodeURIComponent(game)}`}
          className="shrink-0 text-sm font-medium text-racing-coral hover:underline"
        >
          View all
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {relatedSetups.map((related) => (
          <li key={related.id}>
            <Link
              href={`/setups/${encodeURIComponent(related.id)}`}
              className="block rounded-lg border border-border/80 bg-card px-3.5 py-3 transition-colors hover:border-racing-coral/40 hover:bg-accent/50"
            >
              <span className="block truncate font-medium">{related.car}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {related.track} · {related.condition}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
