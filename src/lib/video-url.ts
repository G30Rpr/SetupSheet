/** Maximum length accepted for a user-supplied proof URL. */
export const MAX_VIDEO_URL_LENGTH = 2048;

// The UI only promises links to these providers. An exact host allow-list is
// important here: a loose `hostname.includes("youtube.com")` check would also
// accept attacker-controlled hosts such as `youtube.com.evil.example`.
const VIDEO_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "twitch.tv",
  "www.twitch.tv",
  "m.twitch.tv",
  "clips.twitch.tv",
]);

/**
 * Normalizes an allowed video URL, or returns null for an empty/unsafe value.
 * Bare provider hostnames are accepted for convenience and upgraded to HTTPS;
 * every stored/returned URL is otherwise required to be HTTPS with no
 * credentials or custom port.
 */
export function normalizeVideoUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VIDEO_URL_LENGTH) return null;

  try {
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const authorityStart = candidate.indexOf("://");
    const authority =
      authorityStart >= 0
        ? candidate
            .slice(authorityStart + 3)
            .split("/")[0]
            .split("?")[0]
            .split("#")[0]
        : "";

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      authority.includes(":") ||
      !VIDEO_HOSTS.has(hostname)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/** Returns a user-facing validation message, or null when the value is valid. */
export function validateVideoUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return "Video URL must be a YouTube or Twitch HTTPS link.";
  if (!value.trim()) return null;
  if (value.trim().length > MAX_VIDEO_URL_LENGTH) {
    return `Video URL is too long — max ${MAX_VIDEO_URL_LENGTH} characters.`;
  }
  if (!normalizeVideoUrl(value)) {
    return "Video URL must be a YouTube or Twitch HTTPS link.";
  }
  return null;
}
