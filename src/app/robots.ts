import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/setups/*/edit", "/auth/", "/account/", "/report"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
