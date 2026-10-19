import { rigProfiles } from "@/lib/data";
import type { RigProfile } from "@/lib/types";

/**
 * The visitor's last-chosen rig, remembered across visits. Purely a device
 * convenience (localStorage) — never sent to the server, never tied to an
 * account. The key is namespaced like the upload draft keys.
 */
export const LAST_RIG_KEY = "setupsheet:last-rig";

function isRigProfile(value: unknown): value is RigProfile {
  return typeof value === "string" && (rigProfiles as string[]).includes(value);
}

export { isRigProfile };

/** Returns the saved rig, or null when none is saved (or storage is unavailable). */
export function readLastRig(): RigProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(LAST_RIG_KEY);
    return isRigProfile(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Remembers the chosen rig. Passing null forgets it. */
export function writeLastRig(rig: RigProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    if (rig === null) window.localStorage.removeItem(LAST_RIG_KEY);
    else window.localStorage.setItem(LAST_RIG_KEY, rig);
  } catch {
    // Storage unavailable (private mode, disabled): the finder still works.
  }
}
