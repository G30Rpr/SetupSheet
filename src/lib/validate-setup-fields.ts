import {
  MAX_CAR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TRACK_LENGTH,
  conditions,
  games,
  rigProfiles,
  setupTags,
} from "@/lib/data";

/**
 * The database's own check constraints are the real backstop against a
 * bad game/condition/tag/rig value, but letting that be the ONLY layer
 * means a direct call to these actions gets back a raw Postgres error
 * (constraint names, column names) instead of a clean message. Checked
 * against the same arrays the upload form itself renders its pickers
 * from, so there's one source of truth either way.
 *
 * car/track/description have no enum to check against (car and track fall
 * back to free text when a game's list doesn't have the entry), so they're
 * only bounded by length here -- otherwise the only limit is whatever
 * Next.js's default Server Action body-size cap allows.
 */
export function validateSetupFields(input: {
  game: string;
  car: string;
  track: string;
  condition: string;
  description: string;
  rigProfile: string;
  tags: string[];
}): string | null {
  if (!games.includes(input.game as (typeof games)[number])) {
    return "Unknown game.";
  }
  if (!conditions.includes(input.condition as (typeof conditions)[number])) {
    return "Unknown condition.";
  }
  if (!rigProfiles.includes(input.rigProfile as (typeof rigProfiles)[number])) {
    return "Unknown rig profile.";
  }
  if (!input.tags.every((tag) => setupTags.includes(tag as (typeof setupTags)[number]))) {
    return "Unknown tag.";
  }
  if (input.car.length > MAX_CAR_LENGTH) {
    return `Car name is too long — max ${MAX_CAR_LENGTH} characters.`;
  }
  if (input.track.length > MAX_TRACK_LENGTH) {
    return `Track name is too long — max ${MAX_TRACK_LENGTH} characters.`;
  }
  if (input.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description is too long — max ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  return null;
}
