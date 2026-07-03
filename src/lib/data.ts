import type { Condition, Game, Setup } from "@/lib/types";

export const games: Game[] = [
  "iRacing",
  "Assetto Corsa EVO",
  "Assetto Corsa Competizione",
  "Assetto Corsa",
  "Le Mans Ultimate",
  "Automobilista 2",
  "F1 24",
  "F1 23",
  "F1 22",
  "F1 21",
  "F1 2020",
  "F1 2019",
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
