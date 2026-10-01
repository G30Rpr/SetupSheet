/**
 * Discord OAuth profile images are served from this host. Keeping the avatar
 * allow-list aligned with `img-src` prevents a user-controlled profile field
 * from turning the browser into an arbitrary third-party image beacon.
 */
const ALLOWED_AVATAR_HOSTS = new Set(["cdn.discordapp.com"]);

export function normalizeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 2048) return null;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !ALLOWED_AVATAR_HOSTS.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
