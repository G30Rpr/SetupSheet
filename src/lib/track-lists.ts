import type { SelectOptionGroup } from "@/lib/select-options";
import type { Game } from "@/lib/types";

/**
 * Known track rosters per game, grouped the same way as carLists (see
 * car-lists.ts). For ACC, "Core Circuits" is the base-game roster and the
 * other groups are its DLC track packs. For Le Mans Ultimate, "WEC
 * Circuits" is the current WEC/Hypercar calendar and "Alternate Layouts"
 * covers the ELMS/short/no-chicane configuration variants of those same
 * venues.
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
  "Le Mans Ultimate": [
    {
      label: "WEC Circuits",
      options: [
        "Algarve International Circuit (Portimão)",
        "Bahrain International Circuit",
        "Circuit de la Sarthe",
        "Fuji International Speedway",
        "Monza",
        "Sebring",
        "Spa-Francorchamps",
        "Autodromo Internazionale Enzo e Dino Ferrari (Imola)",
        "Autódromo José Carlos Pace (Interlagos)",
        "Circuit of the Americas",
        "Lusail International Circuit",
        "Circuit de Barcelona-Catalunya",
        "Circuit Paul Ricard",
        "Silverstone",
        "Laguna Seca",
        "Daytona International Speedway",
      ],
    },
    {
      label: "Alternate Layouts",
      options: [
        "Algarve International Circuit (Portimão) ELMS",
        "Autodromo Internazionale Enzo e Dino Ferrari (Imola) ELMS (2024 Pack 1 DLC)",
        "COTA National",
        "Bahrain International Endurance Circuit",
        "Bahrain International Outer Circuit",
        "Bahrain International Paddock Circuit",
        "Fuji Classic Layout (No Chicane)",
        "Circuit de la Sarthe Mulsanne No Chicanes",
        "Lusail International Circuit Short",
        "Monza Curva Grande Layout",
        "Paul Ricard 1a",
        "Paul Ricard 1av2",
        "Paul Ricard 1av2-short",
        "Paul Ricard 3a",
        "Sebring School Circuit",
        "Silverstone National",
        "Silverstone International",
        "Silverstone GP (WEC)",
        "Spa Endurance Layout (62-car support)",
      ],
    },
  ],
};
