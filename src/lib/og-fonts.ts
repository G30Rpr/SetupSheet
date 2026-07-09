import { logger } from "@/lib/logger";

const fontCache = new Map<string, ArrayBuffer>();

const FETCH_TIMEOUT_MS = 4000;

/**
 * next/og's ImageResponse (satori under the hood) can only parse raw
 * sfnt fonts -- ttf/otf/woff -- not woff2, which is all Google Fonts'
 * CSS API serves to a modern User-Agent. Requesting with an old IE user
 * agent gets the legacy .woff variant instead, which satori can read.
 * Same trick used in Vercel's own og-image examples.
 *
 * Returns null instead of throwing on any failure (timeout, network
 * error, unexpected CSS shape) -- an OG image is a nice-to-have social
 * preview, not the page itself, so a Google Fonts hiccup should fall
 * back to satori's default font rather than fail the whole response.
 */
export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}-${weight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
    const css = await fetch(cssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).then((res) => res.text());

    const match = css.match(/src: url\(([^)]+)\)/);
    if (!match) {
      logger.error(`loadGoogleFont: no font source found for ${family} ${weight}`);
      return null;
    }

    const fontData = await fetch(match[1], { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((res) =>
      res.arrayBuffer()
    );
    fontCache.set(key, fontData);
    return fontData;
  } catch (error) {
    logger.error(`loadGoogleFont: failed to load ${family} ${weight}`, error);
    return null;
  }
}
