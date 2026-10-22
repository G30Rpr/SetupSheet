import type { RigBrakeType, RigInputDevice, RigProfile } from "@/lib/types";

/**
 * The two rig axes introduced in 0039_rig_axes.sql: how the car is steered
 * and what stops it. Both are nullable on setups/ratings (unknown hardware
 * is honest), but a saved "my rig" always names an input device.
 *
 * The vocabularies here MUST stay identical to rig_axes_for() in
 * supabase/migrations/0039_rig_axes.sql and the CHECK constraints in
 * 0040_saved_rig_profiles.sql.
 */
export interface RigAxes {
  inputDevice: RigInputDevice | null;
  brakeType: RigBrakeType | null;
}

export const RIG_INPUT_DEVICES: readonly RigInputDevice[] = [
  "gamepad",
  "wheel",
  "direct_drive",
];

export const RIG_BRAKE_TYPES: readonly RigBrakeType[] = [
  "standard",
  "load_cell",
  "handbrake",
];

/** Short display labels; sentence-case copy, no hardware jargon. */
export const RIG_INPUT_LABELS: Record<RigInputDevice, string> = {
  gamepad: "Gamepad",
  wheel: "Wheel",
  direct_drive: "Direct Drive",
};

export const RIG_BRAKE_LABELS: Record<RigBrakeType, string> = {
  standard: "Standard pedals",
  load_cell: "Load cell",
  handbrake: "Handbrake",
};

export function isRigInputDevice(value: unknown): value is RigInputDevice {
  return typeof value === "string" && (RIG_INPUT_DEVICES as readonly string[]).includes(value);
}

export function isRigBrakeType(value: unknown): value is RigBrakeType {
  return typeof value === "string" && (RIG_BRAKE_TYPES as readonly string[]).includes(value);
}

/**
 * The approved injective map from the four legacy rig categories to the two
 * axes -- identical to rig_axes_for() in 0039_rig_axes.sql (keep in sync):
 *   Gamepad                   -> (gamepad, null)
 *   Wheel + 3 Pedals          -> (wheel, standard)
 *   Wheel + Handbrake         -> (wheel, handbrake)
 *   Direct Drive + Load Cell  -> (direct_drive, load_cell)
 */
export function axesFromRigProfile(rig: RigProfile): RigAxes {
  switch (rig) {
    case "Gamepad":
      return { inputDevice: "gamepad", brakeType: null };
    case "Wheel + 3 Pedals":
      return { inputDevice: "wheel", brakeType: "standard" };
    case "Wheel + Handbrake":
      return { inputDevice: "wheel", brakeType: "handbrake" };
    case "Direct Drive + Load Cell":
      return { inputDevice: "direct_drive", brakeType: "load_cell" };
  }
}

/**
 * Whether a setup's axes exactly match a rig. Requires both sides to name
 * an input device; the brake axes must agree including both being null
 * (a gamepad rig matches gamepad setups only).
 */
export function axesMatch(
  a: RigAxes | null | undefined,
  b: RigAxes | null | undefined
): boolean {
  if (!a?.inputDevice || !b?.inputDevice) return false;
  return a.inputDevice === b.inputDevice && (a.brakeType ?? null) === (b.brakeType ?? null);
}

/**
 * Normalizes an untrusted {inputDevice, brakeType} pair (localStorage,
 * form values) into RigAxes: unknown values become null. Input may only be
 * omitted entirely (returns null) -- a partial input device is meaningless.
 */
export function parseRigAxes(value: unknown): RigAxes | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const input = record["inputDevice"];
  const brake = record["brakeType"];
  if (!isRigInputDevice(input)) return null;
  return {
    inputDevice: input,
    brakeType: isRigBrakeType(brake) ? brake : null,
  };
}
