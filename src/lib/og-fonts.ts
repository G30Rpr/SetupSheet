import { logger } from "@/lib/logger";

// Cache the in-flight promise, not just the resolved buffer, so concurrent
// requests for the same OG font do not duplicate the CSS and binary fetches.
const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

const FETCH_TIMEOUT_MS = 4000;

/**
 * next/og's ImageResponse (satori under the hood) can only parse raw
 * sfnt fonts -- ttf/otf/woff -- not woff2, which is all Google Fonts' CSS API
 * serves to a modern User-Agent. Requesting with an old IE user agent gets
 * the legacy .woff variant instead, which satori can read.
 *
 * Returns null instead of throwing on any failure (timeout, network error,
 * unexpected CSS shape) -- an OG image is a nice-to-have social preview, not
 * the page itself, so a Google Fonts hiccup should fall back to satori's
 * default font rather than fail the whole response.
 */
export function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}-${weight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    try {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
      const cssResponse = await fetch(cssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "force-cache",
      });
      if (!cssResponse.ok) throw new Error(`font CSS request returned ${cssResponse.status}`);
      const css = await cssResponse.text();

      const match = css.match(/src: url\(([^)]+)\)/);
      if (!match) {
        logger.error(`loadGoogleFont: no font source found for ${family} ${weight}`);
        return null;
      }

      const fontResponse = await fetch(match[1], {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "force-cache",
      });
      if (!fontResponse.ok) throw new Error(`font binary request returned ${fontResponse.status}`);
      return await fontResponse.arrayBuffer();
    } catch (error) {
      logger.error(`loadGoogleFont: failed to load ${family} ${weight}`, error);
      return null;
    }
  })();

  fontCache.set(key, request);
  return request;
}
