/**
 * Patch-compatibility display state (Phase 3). Two inputs decide it:
 * the setup's author-reported game version and the operator-maintained
 * current patch for that game (games_versions). No invented data:
 *
 * - nothing is shown when the author reported no version;
 * - a reported version with no known current patch is shown as-is,
 *   with no staleness claim;
 * - "current" only when the strings match exactly after trimming --
 *   no guessed semver semantics ("1.6" vs "1.6.0" is a difference);
 * - "stale" when both are known and differ.
 */
export type GameVersionState =
  | { kind: "unreported" }
  | { kind: "reported"; version: string }
  | { kind: "current"; version: string }
  | { kind: "stale"; version: string; currentVersion: string };

export function gameVersionState(
  gameVersion: string | null | undefined,
  currentVersion: string | null | undefined
): GameVersionState {
  const version = typeof gameVersion === "string" ? gameVersion.trim() : "";
  if (!version) return { kind: "unreported" };

  const current = typeof currentVersion === "string" ? currentVersion.trim() : "";
  if (!current) return { kind: "reported", version };
  if (current === version) return { kind: "current", version };
  return { kind: "stale", version, currentVersion: current };
}

/** Tooltip for the stale case — a caution, not a promise the setup is bad. */
export const GAME_VERSION_STALE_HINT =
  "Gameplay updates can change how a setup behaves.";
