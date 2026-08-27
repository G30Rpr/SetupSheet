import type { SetupValues } from "@/lib/types";

/** Keep free-form tuning values bounded even when a caller bypasses the form. */
export const MAX_SETUP_VALUE_COUNT = 100;
export const MAX_SETUP_VALUE_KEY_LENGTH = 100;
export const MAX_SETUP_VALUE_LENGTH = 200;

/**
 * Returns a safe, plain string map for values read from the database or an
 * untrusted Server Action payload. JSONB is deliberately flexible, but the
 * UI and exporters only support string field values. Returning null for an
 * invalid shape lets readers hide a malformed blob instead of crashing a
 * whole setup card.
 */
export function normalizeSetupValues(value: unknown): SetupValues | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;

  let entries: [string, unknown][];
  try {
    entries = Object.entries(value as Record<string, unknown>);
  } catch {
    return null;
  }

  if (entries.length > MAX_SETUP_VALUE_COUNT) return null;

  // A null-prototype object prevents a JSON key such as "__proto__" from
  // mutating the map while it is being normalized.
  const normalized = Object.create(null) as SetupValues;
  for (const [key, item] of entries) {
    if (
      key.length === 0 ||
      key.length > MAX_SETUP_VALUE_KEY_LENGTH ||
      typeof item !== "string" ||
      item.length > MAX_SETUP_VALUE_LENGTH
    ) {
      return null;
    }
    normalized[key] = item;
  }

  return normalized;
}

export function isValidSetupValues(value: unknown): boolean {
  return value === undefined || value === null || normalizeSetupValues(value) !== null;
}
