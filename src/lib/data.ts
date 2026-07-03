import type { Condition, Game, Setup } from "@/lib/types";

export const games: Game[] = [
  "iRacing",
  "Assetto Corsa EVO",
  "Assetto Corsa Competizione",
  "Assetto Corsa",
  "Le Mans Ultimate",
  "Automobilista 2",
  "Gran Turismo 7",
  "F1 25",
  "F1 24",
];

export const conditions: Condition[] = ["Dry", "Wet", "Mixed"];

export function getCarsForGame(setups: Setup[], game?: string) {
  const filtered = game ? setups.filter((s) => s.game === game) : setups;
  return Array.from(new Set(filtered.map((s) => s.car))).sort();
}

export function getTracksForGame(setups: Setup[], game?: string) {
  const filtered = game ? setups.filter((s) => s.game === game) : setups;
  return Array.from(new Set(filtered.map((s) => s.track))).sort();
}
