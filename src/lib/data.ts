import type { Condition, Game, RigProfile, Setup, SetupTag } from "@/lib/types";

export const games: Game[] = [
  "iRacing",
  "Assetto Corsa EVO",
  "Assetto Corsa Competizione",
  "Assetto Corsa",
  "Le Mans Ultimate",
  "Automobilista 2",
  "Gran Turismo 7",
  "F1 25",
];

export const conditions: Condition[] = ["Dry", "Wet", "Mixed"];

export const rigProfiles: RigProfile[] = [
  "Gamepad",
  "Wheel + 3 Pedals",
  "Wheel + Handbrake",
  "Direct Drive + Load Cell",
];

export const setupTags: SetupTag[] = [
  "Safe",
  "Beginner",
  "Quali",
  "Race",
  "Aggressive",
  "Wet Weather",
];

export const MAX_CAR_LENGTH = 80;
export const MAX_TRACK_LENGTH = 80;
export const MAX_LAP_TIME_LENGTH = 32;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_COMMENT_LENGTH = 1000;

export function getCarsForGame(setups: Setup[], game?: string) {
  const filtered = game ? setups.filter((s) => s.game === game) : setups;
  return Array.from(new Set(filtered.map((s) => s.car))).sort();
}

export function getTracksForGame(setups: Setup[], game?: string) {
  const filtered = game ? setups.filter((s) => s.game === game) : setups;
  return Array.from(new Set(filtered.map((s) => s.track))).sort();
}
