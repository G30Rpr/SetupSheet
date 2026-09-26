import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { SetupsBrowser } from "@/components/setups-browser";
import {
  SETUPS_BROWSE_LIMIT,
  getSetupCount,
  getSetups,
} from "@/lib/supabase/setups";
import { getPublicFieldTestCounts } from "@/lib/supabase/field-tests";
import {
  ALL_BROWSE_FILTER,
  EMPTY_BROWSE_FILTERS,
  normalizeBrowseFilters,
} from "@/lib/browse-filters";
import { absoluteUrl, fullPageTitle } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Browse Setups";
const socialTitle = fullPageTitle(title);
const description = "Browse free community sim racing setups by game, car, track and condition.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/setups` },
  openGraph: { title: socialTitle, description, url: "/setups", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: socialTitle, description },
};

export default async function SetupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    game?: string;
    car?: string;
    track?: string;
    condition?: string;
    rig?: string;
  }>;
}) {
  const params = await searchParams;
  const filters =
    normalizeBrowseFilters({
      search: params.q ?? "",
      game: params.game ?? ALL_BROWSE_FILTER,
      car: params.car ?? ALL_BROWSE_FILTER,
      track: params.track ?? ALL_BROWSE_FILTER,
      condition: params.condition ?? ALL_BROWSE_FILTER,
      rig: params.rig ?? ALL_BROWSE_FILTER,
    }) ?? EMPTY_BROWSE_FILTERS;

  // Keep the global count separate from the filtered setup page. The browser
  // can change filters without a server navigation, so it needs a global
  // upper bound to know whether an older-page request may still be useful.
  const [{ setups, failed: loadFailed }, totalCount] = await Promise.all([
    getSetups(filters),
    getSetupCount(),
  ]);
  // getSetups() caps at SETUPS_BROWSE_LIMIT -- search and filtering run
  // client-side over whatever it fetched, so once the community actually
  // grows past that cap, both stop covering the oldest setups too (not
  // just the browse grid), which is worth being upfront about here.
  const isCapped = setups.length === SETUPS_BROWSE_LIMIT && totalCount > SETUPS_BROWSE_LIMIT;
  const fieldTestCounts = Object.fromEntries(await getPublicFieldTestCounts(setups.map((setup) => setup.id)));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SITE_URL}/setups`,
    isPartOf: { "@id": `${SITE_URL}#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: Math.min(setups.length, 12),
      itemListElement: setups.slice(0, 12).map((setup, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${setup.car} @ ${setup.track}`,
        url: absoluteUrl(`/setups/${encodeURIComponent(setup.id)}`),
      })),
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd data={jsonLd} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Browse Setups
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {loadFailed
            ? "Community setups, filtered by game, car, track and condition."
            : `${totalCount} setups shared by the community. Filter by game, car,
          track, or track condition to find your next fast lap.`}
        </p>
        {isCapped && !loadFailed && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Showing the {SETUPS_BROWSE_LIMIT} most recent setups first. Use
            “Load older setups” below to expand search and filters to all {totalCount}.
          </p>
        )}
      </div>

      <SetupsBrowser
        key={setups[0]?.id ?? "no-setups"}
        setups={setups}
        totalCount={totalCount}
        fieldTestCounts={fieldTestCounts}
        initialFilters={filters}
        loadFailed={loadFailed}
      />
    </div>
  );
}
