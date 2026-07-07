import type { SelectOptionGroup } from "@/lib/select-options";
import type { Game } from "@/lib/types";

/**
 * Known track rosters per game, grouped the same way as carLists (see
 * car-lists.ts). For ACC, "Core Circuits" is the base-game roster and the
 * other groups are its DLC track packs. For Le Mans Ultimate, "WEC
 * Circuits" is the current WEC/Hypercar calendar and "Alternate Layouts"
 * covers the ELMS/short/no-chicane configuration variants of those same
 * venues. For Gran Turismo 7, tracks split into real-world licensed
 * circuits, GT's own fictional circuits, and the off-road Dirt & Snow
 * courses (kept as their own group since they're a different driving
 * discipline, not just another layout variant).
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
  "Gran Turismo 7": [
    {
      label: "Real-World Circuits",
      options: [
        "Autódromo de Interlagos (Brazil)",
        "Autodromo Nazionale Monza (Italy)",
        "Autopolis International Racing Course (Japan)",
        "Brands Hatch (United Kingdom)",
        "Circuit de Barcelona-Catalunya (Spain)",
        "Circuit de la Sarthe / 24 Heures du Mans (France)",
        "Circuit de Spa-Francorchamps (Belgium)",
        "Circuit Gilles-Villeneuve (Canada)",
        "Daytona International Speedway (United States)",
        "Fuji International Speedway (Japan)",
        "Goodwood Motor Circuit (United Kingdom)",
        "Michelin Raceway Road Atlanta (United States)",
        "Mount Panorama Circuit / Bathurst (Australia)",
        "Nürburgring (Germany)",
        "Red Bull Ring (Austria)",
        "Suzuka Circuit (Japan)",
        "Tsukuba Circuit (Japan)",
        "Watkins Glen International (United States)",
        "WeatherTech Raceway Laguna Seca (United States)",
        "Yas Marina Circuit (Abu Dhabi / UAE)",
      ],
    },
    {
      label: "Original Circuits",
      options: [
        "Alsace (France)",
        "Autodrome Lago Maggiore (Italy)",
        "Blue Moon Bay Speedway (United States)",
        "Broad Bean Raceway (Japan)",
        "Circuit de Sainte-Croix (France)",
        "Deep Forest Raceway (Switzerland)",
        "Dragon Trail (Croatia)",
        "Eiger Nordwand (Switzerland)",
        "Grand Valley (Highway 1 / South layouts) (United States)",
        "High Speed Ring (Japan)",
        "Kyoto Driving Park (Japan)",
        "Northern Isle Speedway (United States)",
        "Sardegna - Road Track (Italy)",
        "Special Stage Route X (United States)",
        "Tokyo Expressway (Japan)",
        "Trial Mountain Circuit (United States)",
      ],
    },
    {
      label: "Dirt & Snow",
      options: [
        "Colorado Springs - Lake (United States) – Dirt",
        "Fishermans Ranch (United States) – Dirt",
        "Lake Louise (Canada) – Snow",
        "Sardegna - Windmills (Italy) – Dirt",
      ],
    },
  ],
};
