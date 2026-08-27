export const MAX_DISPLAY_NAME_LENGTH = 80;

export function sanitizeDisplayName(value: unknown): string {
  if (typeof value !== "string") return "Racer";
  const trimmed = value.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  return trimmed || "Racer";
}

interface UserLike {
  user_metadata?: Record<string, unknown> | null;
  email?: string | null;
}

/** Reads only string identity fields from OAuth metadata before rendering them. */
export function getUserDisplayName(user: UserLike): string {
  const metadata = user.user_metadata ?? {};
  const candidates = [
    metadata.full_name,
    metadata.name,
    metadata.user_name,
    user.email,
  ];
  const displayName = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  return sanitizeDisplayName(displayName);
}
