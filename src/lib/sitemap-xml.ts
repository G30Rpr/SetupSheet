import type { MetadataRoute } from "next";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isoDate(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Serialize the subset of Next's sitemap entries used by this app. */
export function serializeSitemap(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map((entry) => {
    const fields = [`<loc>${escapeXml(entry.url)}</loc>`];
    if (entry.lastModified) {
      const lastModified = isoDate(entry.lastModified);
      if (lastModified) fields.push(`<lastmod>${lastModified}</lastmod>`);
    }
    if (entry.changeFrequency) fields.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
    if (entry.priority !== undefined) fields.push(`<priority>${entry.priority}</priority>`);
    return `<url>${fields.join("")}</url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}
