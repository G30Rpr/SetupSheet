const fontCache = new Map<string, ArrayBuffer>();

/**
 * next/og's ImageResponse (satori under the hood) can only parse raw
 * sfnt fonts -- ttf/otf/woff -- not woff2, which is all Google Fonts'
 * CSS API serves to a modern User-Agent. Requesting with an old IE user
 * agent gets the legacy .woff variant instead, which satori can read.
 * Same trick used in Vercel's own og-image examples.
 */
export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}-${weight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await fetch(cssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko",
    },
  }).then((res) => res.text());

  const match = css.match(/src: url\(([^)]+)\)/);
  if (!match) {
    throw new Error(`loadGoogleFont: no font source found for ${family} ${weight}`);
  }

  const fontData = await fetch(match[1]).then((res) => res.arrayBuffer());
  fontCache.set(key, fontData);
  return fontData;
}
