const STATIC_PATHS = new Set([
  "/",
  "/help",
  "/setups",
  "/setups/compare",
  "/upload",
  "/leaderboard",
  "/requests",
  "/engineer",
  "/garage",
  "/privacy",
  "/terms",
  "/community-guidelines",
  "/profile",
  "/account/data-deletion",
  "/report",
  "/auth/callback",
  "/auth/auth-code-error",
]);

export function safeReportPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160 || !value.startsWith("/"))
    return null;
  if (value.startsWith("//") || /[?#\u0000-\u001f\u007f]/.test(value))
    return null;

  const path = value.length > 1 ? value.replace(/\/$/, "") : value;
  if (STATIC_PATHS.has(path)) return path;
  if (/^\/setups\/:id(?:\/edit)?$/.test(path)) return path;
  if (/^\/profile\/:id$/.test(path)) return path;
  return null;
}
