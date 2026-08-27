/**
 * Allows a remote image URL only when it is an HTTPS URL without credentials
 * or a custom port. This is used for OAuth/profile avatars as defense in
 * depth against a forged `javascript:` or `data:` value in user metadata.
 */
export function normalizeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 2048) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url.toString();
  } catch {
    return null;
  }
}
