import type { Game } from "@/lib/types";

/**
 * Known car rosters per game, used to power a searchable dropdown on the
 * upload form instead of free text -- avoids the same car getting listed
 * under slightly different spellings ("Porsche 992", "992 GT3 R", "Porsche
 * 911 GT3 R 2023") across different setups.
 *
 * Not every game has a roster here yet -- games without one fall back to
 * free-text entry, and every game's dropdown includes a manual-entry escape
 * hatch for cars/mods not in the list.
 */
export const carLists: Partial<Record<Game, string[]>> = {
  "Assetto Corsa Competizione": [
    "Aston Martin V12 Vantage GT3 2013",
    "Aston Martin V8 Vantage GT3 2019",
    "Audi R8 LMS GT3 2015",
    "Audi R8 LMS Evo GT3 2019",
    "Audi R8 LMS Evo II GT3 2022",
    "Bentley Continental GT3 2015",
    "Bentley Continental GT3 2018",
    "BMW M6 GT3 2017",
    "BMW M4 GT3 2021",
    "Emil Frey Jaguar GT3 2012",
    "Ford Mustang GT3",
    "Ferrari 488 GT3 2018",
    "Ferrari 488 EVO GT3 2020",
    "Ferrari 296 GT3 2023",
    "Honda NSX GT3 2017",
    "Honda NSX Evo GT3 2019",
    "Lamborghini Huracan GT3 2015",
    "Lamborghini Huracan Evo GT3 2019",
    "Lamborghini Huracan EVO2 GT3 2023",
    "Lexus RC F GT3 2016",
    "McLaren 650S GT3 2015",
    "McLaren 720S GT3 2019",
    "McLaren 720S Evo GT3 2023",
    "Mercedes AMG GT3 2015",
    "Mercedes AMG Evo GT3 2020",
    "Nissan GTR Nismo GT3 2015",
    "Nissan GTR Nismo GT3 2018",
    "Porsche 911 GT3 R 2018",
    "Porsche 911 II GT3 R 2019",
    "Porsche 992 GT3 R 2023",
    "Reiter Engineering R-EX GT3 2017",
  ],
};
