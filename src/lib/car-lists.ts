import type { SelectOptionGroup } from "@/lib/select-options";
import type { Game } from "@/lib/types";

/**
 * Known car rosters per game, grouped by class (e.g. ACC's GT3/GT4/GT2/GTC,
 * LMU's Hypercar/LMP2/GTE/GT3/LMP3), used to power a searchable dropdown on
 * the upload form instead of free text -- avoids the same car getting
 * listed under slightly different spellings ("Porsche 992", "992 GT3 R",
 * "Porsche 911 GT3 R 2023") across different setups. Where a car's own
 * model badge doesn't already say its class (e.g. ACC's GTC cars), the
 * class is spelled out in the name so it's unambiguous even outside its
 * group.
 *
 * Not every game has a roster here yet -- games without one fall back to
 * free-text entry, and every game's dropdown includes a manual-entry escape
 * hatch for cars/mods not in the list.
 */
export const carLists: Partial<Record<Game, SelectOptionGroup[]>> = {
  "Assetto Corsa Competizione": [
    {
      label: "GT3",
      options: [
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
    },
    {
      label: "GT4",
      options: [
        "Alpine A110 GT4 2018",
        "Aston Martin V8 Vantage GT4 2018",
        "Audi R8 LMS GT4 2018",
        "BMW M4 GT4 2018",
        "Chevrolet Camaro GT4-R 2017",
        "Ginetta G55 GT4 2012",
        "KTM X-Bow GT4 2016",
        "Maserati GranTurismo MC GT4 2016",
        "McLaren 570S GT4 2016",
        "Mercedes AMG GT4 2016",
        "Porsche 718 Cayman GT4 Clubsport 2019",
      ],
    },
    {
      label: "GT2",
      options: [
        "Audi R8 LMS GT2",
        "KTM X-Bow GT2",
        "Maserati MC20 GT2",
        "Mercedes-AMG GT2",
        "Porsche 991 II GT2 RS CS Evo",
        "Porsche 935 GT2",
      ],
    },
    {
      label: "GTC",
      options: [
        "Ferrari 488 Challenge Evo 2020 GTC",
        "Lamborghini Huracan Super Trofeo 2015 GTC",
        "Lamborghini Huracan Super Trofeo Evo 2 2021 GTC",
        "Porsche 911 II GT3 Cup 2017 GTC",
        "Porsche 992 GT3 Cup 2021 GTC",
      ],
    },
  ],
  "Le Mans Ultimate": [
    {
      label: "Hypercar",
      options: [
        "Alpine A424 (2024 Pack 2 DLC)",
        "Aston Martin Valkyrie AMR LMH Hypercar",
        "BMW M Hybrid V8",
        "BMW M Hybrid V8 Evo (2026)",
        "Cadillac V-Series.R",
        "Ferrari 499P",
        "Genesis GMR-001 LMDh",
        "Glickenhaus SCG 007",
        "Isotta Fraschini Tipo 6-C (2024 Pack 2 DLC)",
        "Lamborghini SC63 (2024 Pack 1 DLC)",
        "Peugeot 9X8 2023",
        "Peugeot 9X8 2024 (2024 Pack 1 DLC)",
        "Porsche 963",
        "Toyota GR010 Hybrid",
        "Toyota GR010 Hybrid (2026)",
        "Vanwall Vandervell 680",
      ],
    },
    {
      label: "LMP2",
      options: ["Oreca 07 Gibson", "Oreca 07 Gibson ELMS"],
    },
    {
      label: "GTE",
      options: [
        "Aston Martin Vantage GTE",
        "Chevrolet Corvette C8.R",
        "Ferrari 488 GTE Evo",
        "Porsche 911 RSR-19",
      ],
    },
    {
      label: "GT3",
      options: [
        "Aston Martin Vantage AMR LMGT3 Evo",
        "BMW M4 LMGT3",
        "BMW M4 LMGT3 Evo",
        "Chevrolet Corvette Z06 LMGT3.R",
        "Ferrari 296 LMGT3",
        "Ferrari 296 LMGT3 Evo",
        "Ford Mustang LMGT3",
        "Ford Mustang LMGT3 Evo",
        "Lamborghini Huracan LMGT3 Evo 2",
        "Lexus RC F LMGT3",
        "Mercedes-AMG LMGT3",
        "McLaren 720S LMGT3 Evo",
        "Porsche 911 LMGT3 R (992)",
        "Porsche 911 LMGT3 R (992) 2026",
      ],
    },
    {
      label: "LMP3",
      options: ["Ligier JS P325", "Ginetta G61-LT-P3 Evo", "Duqueine D09", "Adess AD25"],
    },
  ],
};
