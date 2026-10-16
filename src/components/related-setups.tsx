import Link from "next/link";

import { getRelatedSetups, type RelatedSetupSelf } from "@/lib/supabase/setups";

/** Streams below-the-fold discovery links without delaying the setup card's first paint. */
export async function RelatedSetups({ self }: { self: RelatedSetupSelf }) {
  // Related = same car + track, different rig or style (P2). Empty on
  // purpose when the combo has no real alternatives — the section hides.
  const relatedSetups = await getRelatedSetups(self);
  if (relatedSetups.length === 0) return null;

  return (
    <section aria-labelledby="related-setups-heading" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="related-setups-heading" className="text-xl font-semibold tracking-tight">
            Same car + track
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Different rigs and styles for this combo.
          </p>
        </div>
        <Link
          href={`/setups?game=${encodeURIComponent(self.game)}&car=${encodeURIComponent(self.car)}&track=${encodeURIComponent(self.track)}`}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {relatedSetups.map((related) => (
          <li key={related.id}>
            <Link
              href={`/setups/${encodeURIComponent(related.id)}`}
              className="block min-h-11 rounded-lg border border-border/80 bg-card px-3.5 py-3 hover:bg-accent/50"
            >
              <span className="block truncate font-medium">{related.rigProfile}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {related.tags.length > 0
                  ? `${related.condition} · ${related.tags.join(" · ")}`
                  : related.condition}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
