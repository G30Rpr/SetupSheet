import { SITE_NAME, SITE_URL } from "@/lib/site";

export const DEFAULT_SITE_DESCRIPTION =
  "Download and share free sim racing setups for iRacing, Assetto Corsa, Le Mans Ultimate, F1 25 and more. Built by the community, for the community.";

/** Keep search snippets and social descriptions within a predictable length. */
export function truncateMetaDescription(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const safeLength = Math.max(1, maxLength - 1);
  const shortened = normalized.slice(0, safeLength).replace(/\s+\S*$/, "").trim();
  return `${shortened || normalized.slice(0, safeLength).trim()}…`;
}

/** Produces the one title format used by page metadata and social cards. */
export function fullPageTitle(title: string): string {
  return `${title} — ${SITE_NAME}`;
}

/** Resolves an internal path against the canonical deployment origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * JSON-LD is placed inside a script element. Escape HTML-significant
 * characters so user-generated setup/profile text can never terminate that
 * element, even though the resulting value is still valid JSON.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      default:
        return "\\u0026";
    }
  });
}
