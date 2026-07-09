import type { MetadataRoute } from "next";

import { getSetupSitemapEntries } from "@/lib/supabase/setups";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const setups = await getSetupSitemapEntries();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/setups`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.5 },
    { url: `${SITE_URL}/upload`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const setupRoutes: MetadataRoute.Sitemap = setups.map((setup) => ({
    url: `${SITE_URL}/setups/${setup.id}`,
    lastModified: setup.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...setupRoutes];
}
