import type { Metadata } from "next";

import { SetupsBrowser } from "@/components/setups-browser";
import { getSetups } from "@/lib/supabase/setups";

export const metadata: Metadata = {
  title: "Browse Setups — SetupSheet",
  description: "Browse free community sim racing setups by game, car, track and condition.",
};

export default async function SetupsPage() {
  const setups = await getSetups();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Browse Setups
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {setups.length} setups shared by the community. Filter by game, car,
          track, or track condition to find your next fast lap.
        </p>
      </div>

      <SetupsBrowser setups={setups} />
    </div>
  );
}
