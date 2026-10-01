import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { getProfileSitemapEntries, getSetupSitemapEntries } from "@/lib/supabase/setups";
import { logger } from "@/lib/logger";
import { serializeSitemap } from "@/lib/sitemap-xml";

// The entries are cached for an hour by the data reader, but the response is
// generated on demand so a database outage cannot become a static empty
// sitemap baked into the build artifact.
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(): Promise<Response> {
  try {
    const [setups, profiles] = await Promise.all([
      getSetupSitemapEntries(),
      getProfileSitemapEntries(),
    ]);

    const staticRoutes: MetadataRoute.Sitemap = [
      { url: SITE_URL, changeFrequency: "daily", priority: 1 },
      { url: `${SITE_URL}/setups`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.5 },
      { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
      { url: `${SITE_URL}/community-guidelines`, changeFrequency: "monthly", priority: 0.2 },
      { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
      { url: `${SITE_URL}/upload`, changeFrequency: "monthly", priority: 0.3 },
    ];

    const setupRoutes: MetadataRoute.Sitemap = setups.map((setup) => ({
      url: `${SITE_URL}/setups/${encodeURIComponent(setup.id)}`,
      lastModified: setup.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // Keep the document below the protocol's 50,000 URL limit, even when one
    // contributor has an unusually large public catalog.
    const profileBudget = Math.max(0, 50_000 - staticRoutes.length - setupRoutes.length);
    const profileRoutes: MetadataRoute.Sitemap = profiles.slice(0, profileBudget).map((profile) => ({
      url: `${SITE_URL}/profile/${encodeURIComponent(profile.userId)}`,
      lastModified: profile.updatedAt,
      changeFrequency: "weekly",
      priority: 0.4,
    }));

    return new Response(serializeSitemap([...staticRoutes, ...setupRoutes, ...profileRoutes]), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    // Don't disclose PostgREST internals and, importantly, don't put a public
    // cache header on the error response. A later request can recover quickly.
    logger.error("GET /sitemap.xml: failed to build sitemap", error);
    return new Response("Sitemap temporarily unavailable.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
