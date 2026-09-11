/**
 * The `/setups/[id]/opengraph-image` route renders a 1200×630 Satori image for
 * whatever string the path carries, and `next.config.ts` lets that response be
 * CDN-cached for 24 h per URL. Real setup ids are UUIDs, so the middleware uses
 * this to refuse everything else before the route can render, cache, or
 * allocate a `unstable_cache` entry for it (see `src/proxy.ts`).
 *
 * Returns the id segment when the path *is* a setup OG request, otherwise null.
 */
const SETUP_OG_IMAGE_PATH = /^\/setups\/([^/]+)\/opengraph-image\/?$/;

export function setupOgImageSegment(pathname: string): string | null {
  const match = SETUP_OG_IMAGE_PATH.exec(pathname);
  return match ? match[1] : null;
}
