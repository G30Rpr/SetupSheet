import { rigProfiles } from "@/lib/data";
import {
  axesFromRigProfile,
  parseRigAxes,
  type RigAxes,
} from "@/lib/rig-axes";
import type { RigProfile } from "@/lib/types";

/**
 * The visitor's last-chosen rig, remembered across visits. Purely a device
 * convenience (localStorage) — never sent to the server, never tied to an
 * account. The key is namespaced like the upload draft keys.
 */
export const LAST_RIG_KEY = "setupsheet:last-rig";

/**
 * The two-axis variant (0039) of the same device-local memory. Written when
 * the visitor sets "Your rig" on /setups; read as the anonymous fallback for
 * "Best for my rig" and the "Matches your rig" chip when no account-level
 * saved_rig_profiles row exists.
 */
export const LAST_RIG_AXES_KEY = "setupsheet:last-rig-axes";

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

/**
 * The axes pair saved on this device, or null when none is saved (or
 * storage is unavailable). Unknown values are discarded, never guessed.
 */
export function readLastRigAxes(): RigAxes | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(LAST_RIG_AXES_KEY);
    if (saved === null) return null;
    return parseRigAxes(JSON.parse(saved));
  } catch {
    return null;
  }
}

/**
 * Remembers the chosen rig axes. Passing null forgets them.
 */
export function writeLastRigAxes(axes: RigAxes | null): void {
  if (typeof window === "undefined") return;
  try {
    if (axes === null) window.localStorage.removeItem(LAST_RIG_AXES_KEY);
    else window.localStorage.setItem(LAST_RIG_AXES_KEY, JSON.stringify(axes));
  } catch {
    // Storage unavailable: account-level saved_rig_profiles still works.
  }
}

/**
 * Best available "my rig" for this device: explicit axes first, then axes
 * derived from the legacy saved rig category. Purely local.
 */
export function readMyRigAxes(): RigAxes | null {
  const axes = readLastRigAxes();
  if (axes) return axes;
  const rig = readLastRig();
  return rig ? axesFromRigProfile(rig) : null;
}
