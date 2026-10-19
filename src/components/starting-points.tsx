"use client";

import { useEffect, useState } from "react";

import { SetupCard } from "@/components/setup-card";
import { readLastRig } from "@/lib/last-rig";
import type { Setup } from "@/lib/types";

/**
 * "Starting points": at most three real setups that match the visitor's
 * saved rig when one is saved, otherwise the three most recently updated.
 * Never padded with placeholders — if nothing qualifies, the whole section
 * (heading included) is omitted.
 *
 * Renders the recent three during SSR, then narrows to rig matches after
 * mount once localStorage is readable. The candidates arrive pre-sorted
 * newest-updated first.
 */
export function StartingPoints({
  candidates,
  fieldTestCounts,
}: {
  candidates: Setup[];
  fieldTestCounts: Record<string, number>;
}) {
  const [picks, setPicks] = useState<Setup[]>(() => candidates.slice(0, 3));

  useEffect(() => {
    const rig = readLastRig();
    const pool = rig ? candidates.filter((setup) => setup.rigProfile === rig) : candidates;
    // Hydrating from localStorage on mount, not deriving from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicks(pool.slice(0, 3));
  }, [candidates]);

  if (picks.length === 0) return null;

  return (
    <section aria-labelledby="starting-points-heading" className="border-t border-border/80 bg-secondary/10">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="starting-points-heading" className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Starting points
        </h2>
        <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((setup) => (
            <li key={setup.id} className="min-w-0">
              <SetupCard
                setup={setup}
                titleLevel={3}
                fieldTestCount={fieldTestCounts[setup.id] ?? 0}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
