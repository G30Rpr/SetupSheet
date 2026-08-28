import {
  MAX_CAR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_LAP_TIME_LENGTH,
  MAX_TRACK_LENGTH,
  conditions,
  games,
  rigProfiles,
  setupTags,
} from "@/lib/data";
import { isValidSetupValues } from "@/lib/setup-values";

/**
 * The database's own check constraints are the real backstop against a
 * bad game/condition/tag/rig value, but letting that be the ONLY layer
 * means a direct call to these actions gets back a raw Postgres error
 * (constraint names, column names) instead of a clean message. Checked
 * against the same arrays the upload form itself renders its pickers
 * from, so there's one source of truth either way.
 *
 * This function intentionally accepts unknown at runtime. Server Actions
 * are public request boundaries: TypeScript interfaces do not validate a
 * forged payload sent directly to the action endpoint.
 */
export function validateSetupFields(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "Invalid setup fields.";
  }

  const fields = input as Record<string, unknown>;
  const requiredStrings = [
    fields.game,
    fields.car,
    fields.track,
    fields.condition,
    fields.description,
    fields.rigProfile,
  ];
  if (!requiredStrings.every((value) => typeof value === "string")) {
    return "Invalid setup fields.";
  }
  if (fields.lapTime !== undefined && typeof fields.lapTime !== "string") {
    return "Invalid setup fields.";
  }
  if (!Array.isArray(fields.tags) || !fields.tags.every((tag) => typeof tag === "string")) {
    return "Tags must be a list of valid values.";
  }

  const game = fields.game as string;
  const car = fields.car as string;
  const track = fields.track as string;
  const condition = fields.condition as string;
  const description = fields.description as string;
  const rigProfile = fields.rigProfile as string;
  const lapTime = (fields.lapTime as string | undefined) ?? "";
  const tags = fields.tags as string[];

  if (!games.includes(game as (typeof games)[number])) {
    return "Unknown game.";
  }
  if (!conditions.includes(condition as (typeof conditions)[number])) {
    return "Unknown condition.";
  }
  if (!rigProfiles.includes(rigProfile as (typeof rigProfiles)[number])) {
    return "Unknown rig profile.";
  }
  if (tags.length > setupTags.length) {
    return "Too many tags.";
  }
  if (!tags.every((tag) => setupTags.includes(tag as (typeof setupTags)[number]))) {
    return "Unknown tag.";
  }
  if (new Set(tags).size !== tags.length) {
    return "Duplicate tags are not allowed.";
  }
  if (!car.trim()) {
    return "Car is required.";
  }
  if (!track.trim()) {
    return "Track is required.";
  }
  if (car.length > MAX_CAR_LENGTH) {
    return `Car name is too long — max ${MAX_CAR_LENGTH} characters.`;
  }
  if (track.length > MAX_TRACK_LENGTH) {
    return `Track name is too long — max ${MAX_TRACK_LENGTH} characters.`;
  }
  if (lapTime.length > MAX_LAP_TIME_LENGTH) {
    return `Lap time is too long — max ${MAX_LAP_TIME_LENGTH} characters.`;
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description is too long — max ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  if (fields.setupValues !== undefined && !isValidSetupValues(fields.setupValues)) {
    return "Setup values are invalid or too large.";
  }
  return null;
}
