import type { MetadataRoute } from "next";

import { getProfileSitemapEntries, getSetupSitemapEntries } from "@/lib/supabase/setups";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [setups, profiles] = await Promise.all([
    getSetupSitemapEntries(),
    getProfileSitemapEntries(),
  ]);

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

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: `${SITE_URL}/profile/${profile.userId}`,
    lastModified: profile.updatedAt,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...setupRoutes, ...profileRoutes];
}
