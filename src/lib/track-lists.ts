import type { SelectOptionGroup } from "@/lib/select-options";
import type { Game } from "@/lib/types";

/**
 * Known track rosters per game, grouped the same way as carLists (see
 * car-lists.ts) -- "Core Circuits" is the base-game roster, the other
 * groups are ACC's DLC track packs (British GT / Intercontinental GT,
 * Challengers Pack, and later additions).
 *
 * Not every game has a roster here yet -- games without one fall back to
 * free-text entry, and every game's dropdown includes a manual-entry escape
 * hatch for tracks/mods not in the list.
 */
export const trackLists: Partial<Record<Game, SelectOptionGroup[]>> = {
  "Assetto Corsa Competizione": [
    {
      label: "Core Circuits",
      options: [
        "Barcelona",
        "Brands Hatch",
        "Hungaroring",
        "Misano",
        "Monza",
        "Nürburgring",
        "Paul Ricard",
        "Silverstone",
        "Spa-Francorchamps",
        "Zandvoort",
        "Zolder",
        "Snetterton",
      ],
    },
    {
      label: "Additional Circuits",
      options: [
        "Oulton Park",
        "Donington Park",
        "Kyalami Grand Prix Circuit",
        "Suzuka Circuit",
        "WeatherTech Raceway Laguna Seca",
        "Mount Panorama Circuit",
      ],
    },
    {
      label: "Challengers Pack",
      options: [
        "Autodromo Enzo e Dino Ferrari – Imola",
        "Watkins Glen",
        "Circuit of the Americas (COTA)",
        "Indianapolis",
        "Circuit Ricardo Tormo (Valencia)",
      ],
    },
    {
      label: "More Circuits",
      options: ["Red Bull Ring", "24H Nürburgring (Nordschleife)"],
    },
  ],
};
