import type { Metadata } from "next";

import { SetupsBrowser } from "@/components/setups-browser";
import { getSetups } from "@/lib/supabase/setups";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = `Browse Setups — ${SITE_NAME}`;
const description = "Browse free community sim racing setups by game, car, track and condition.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/setups` },
  openGraph: { title, description, url: "/setups", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title, description },
};

export default async function SetupsPage() {
  const setups = await getSetups();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
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
