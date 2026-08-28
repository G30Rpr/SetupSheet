import type { MetadataRoute } from "next";

import { getProfileSitemapEntries, getSetupSitemapEntries } from "@/lib/supabase/setups";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

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
    url: `${SITE_URL}/setups/${encodeURIComponent(setup.id)}`,
    lastModified: setup.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Keep the single sitemap document below the protocol's 50,000-URL limit
  // even when a contributor has a very large public catalog.
  const profileBudget = Math.max(0, 50_000 - staticRoutes.length - setupRoutes.length);
  const profileRoutes: MetadataRoute.Sitemap = profiles.slice(0, profileBudget).map((profile) => ({
    url: `${SITE_URL}/profile/${encodeURIComponent(profile.userId)}`,
    lastModified: profile.updatedAt,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...setupRoutes, ...profileRoutes];
}
