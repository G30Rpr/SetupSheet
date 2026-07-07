import type { Game, SetupValues } from "@/lib/types";

export interface SetupFieldSpec {
  key: string;
  label: string;
  placeholder: string;
}

export interface SetupFieldGroup {
  title: string;
  fields: SetupFieldSpec[];
}

/**
 * One schema per game, matching that game's actual in-game setup/tuning
 * screen — not a generic "tire pressure / camber / ARB" template stretched
 * across every title. Field choices are grounded in each game's real setup
 * UI (see commit history for sources): GT3 sims share a lot of vocabulary
 * (tire pressure, camber, ARB) but differ in units and what's even
 * adjustable, F1 games use 0-50/0-11 sliders with no free tire pressure
 * choice per corner beyond front/rear, and Gran Turismo 7 has no tire
 * pressure input at all — it tunes via LSD, ballast, and gear ratios
 * instead.
 */
export const setupSchemas: Record<Game, SetupFieldGroup[]> = {
  iRacing: [
    {
      title: "Tires & Chassis",
      fields: [
        { key: "frontTirePressure", label: "Front tire pressure", placeholder: "e.g. 23.5 psi" },
        { key: "rearTirePressure", label: "Rear tire pressure", placeholder: "e.g. 24.0 psi" },
        { key: "crossWeight", label: "Cross weight", placeholder: "e.g. 50.0%" },
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.2°" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -2.7°" },
      ],
    },
    {
      title: "Suspension",
      fields: [
        { key: "frontSpring", label: "Front spring rate", placeholder: "e.g. 850 lbs/in" },
        { key: "rearSpring", label: "Rear spring rate", placeholder: "e.g. 950 lbs/in" },
        { key: "frontArb", label: "Front anti-roll bar", placeholder: "e.g. 3 clicks" },
        { key: "rearArb", label: "Rear anti-roll bar", placeholder: "e.g. 4 clicks" },
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 65 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 72 mm" },
      ],
    },
    {
      title: "Aero, Diff & Brakes",
      fields: [
        { key: "frontAero", label: "Front splitter/wing", placeholder: "e.g. 3" },
        { key: "rearAero", label: "Rear wing/spoiler", placeholder: "e.g. 5" },
        { key: "diffPreload", label: "Diff preload", placeholder: "e.g. 65 Nm" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 56% front" },
        { key: "finalDrive", label: "Final drive", placeholder: "e.g. 4.10" },
      ],
    },
  ],

  "Assetto Corsa Competizione": [
    {
      title: "Tyres & Alignment",
      fields: [
        { key: "frontTirePressure", label: "Front tyre pressure", placeholder: "e.g. 26.3 psi" },
        { key: "rearTirePressure", label: "Rear tyre pressure", placeholder: "e.g. 26.8 psi" },
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -4.3°" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -3.8°" },
        { key: "frontToe", label: "Front toe", placeholder: "e.g. 0.02°" },
        { key: "rearToe", label: "Rear toe", placeholder: "e.g. 0.10°" },
      ],
    },
    {
      title: "Mechanical & Dampers",
      fields: [
        { key: "frontArb", label: "Front ARB", placeholder: "e.g. 2 clicks" },
        { key: "rearArb", label: "Rear ARB", placeholder: "e.g. 2 clicks" },
        { key: "frontBumpRebound", label: "Front bump/rebound", placeholder: "e.g. 8/9 clicks" },
        { key: "rearBumpRebound", label: "Rear bump/rebound", placeholder: "e.g. 7/8 clicks" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 58% front" },
        { key: "brakeDuct", label: "Brake duct (F/R)", placeholder: "e.g. 4/3" },
      ],
    },
    {
      title: "Aero & Drivetrain",
      fields: [
        { key: "frontSplitter", label: "Front splitter", placeholder: "e.g. 1 (min downforce)" },
        { key: "rearWing", label: "Rear wing", placeholder: "e.g. 2" },
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 52 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 58 mm" },
        { key: "diffPreload", label: "Diff preload", placeholder: "e.g. 40 Nm (GT3 fixed lock)" },
        { key: "finalDrive", label: "Final drive", placeholder: "e.g. Short — Monza top speed" },
      ],
    },
  ],

  "Assetto Corsa": [
    {
      title: "Tyres",
      fields: [
        { key: "frontTirePressure", label: "Front tyre pressure", placeholder: "e.g. 27.0 psi" },
        { key: "rearTirePressure", label: "Rear tyre pressure", placeholder: "e.g. 27.5 psi" },
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.0°" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -2.4°" },
      ],
    },
    {
      title: "Mechanical Grip",
      fields: [
        { key: "frontArb", label: "Front ARB", placeholder: "e.g. 3 clicks" },
        { key: "rearArb", label: "Rear ARB", placeholder: "e.g. 3 clicks" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 54% front" },
      ],
    },
    {
      title: "Aero & Drivetrain",
      fields: [
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 58 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 64 mm" },
        { key: "wing", label: "Wing/splitter", placeholder: "e.g. N/A (no wing) or 4" },
        { key: "diffPower", label: "Diff power/coast", placeholder: "e.g. 45% / 30%" },
        { key: "finalDrive", label: "Final drive", placeholder: "e.g. Stock" },
      ],
    },
  ],

  "Assetto Corsa EVO": [
    {
      title: "Tyres",
      fields: [
        { key: "frontTirePressure", label: "Front tyre pressure", placeholder: "e.g. 27.0 psi" },
        { key: "rearTirePressure", label: "Rear tyre pressure", placeholder: "e.g. 27.5 psi" },
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.8°" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -3.2°" },
      ],
    },
    {
      title: "Suspension",
      fields: [
        { key: "frontArb", label: "Front ARB", placeholder: "e.g. 2 clicks" },
        { key: "rearArb", label: "Rear ARB", placeholder: "e.g. 3 clicks" },
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 58 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 64 mm" },
      ],
    },
    {
      title: "Aero & Drivetrain",
      fields: [
        { key: "frontAero", label: "Front splitter/wing", placeholder: "e.g. 3" },
        { key: "rearAero", label: "Rear wing", placeholder: "e.g. 4" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 56% front" },
        { key: "diffPreload", label: "Diff preload", placeholder: "e.g. 55 Nm" },
        { key: "finalDrive", label: "Final drive", placeholder: "e.g. Balanced" },
      ],
    },
  ],

  "Le Mans Ultimate": [
    {
      title: "Tires",
      fields: [
        { key: "frontTirePressure", label: "Front tire pressure", placeholder: "e.g. 25.0 psi" },
        { key: "rearTirePressure", label: "Rear tire pressure", placeholder: "e.g. 25.5 psi" },
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.0°" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -2.5°" },
      ],
    },
    {
      title: "Suspension",
      fields: [
        { key: "frontSpring", label: "Front spring", placeholder: "e.g. Medium" },
        { key: "rearSpring", label: "Rear spring", placeholder: "e.g. Medium-stiff" },
        { key: "frontArb", label: "Front ARB", placeholder: "e.g. 1 click" },
        { key: "rearArb", label: "Rear ARB", placeholder: "e.g. 2 clicks" },
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 70 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 76 mm" },
      ],
    },
    {
      title: "Aero, Diff & Brakes",
      fields: [
        { key: "frontSplitter", label: "Front splitter", placeholder: "e.g. 3" },
        { key: "rearWing", label: "Rear wing", placeholder: "e.g. 4" },
        { key: "diffPower", label: "Diff power/coast", placeholder: "e.g. Fixed (GT3 homologated)" },
        { key: "diffPreload", label: "Diff preload", placeholder: "e.g. 35 Nm" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 53% front" },
        { key: "finalDrive", label: "Final drive", placeholder: "e.g. Medium" },
      ],
    },
  ],

  "Automobilista 2": [
    {
      title: "Tires & Alignment",
      fields: [
        { key: "frontTirePressure", label: "Front tire pressure", placeholder: "e.g. 24.0 psi" },
        { key: "rearTirePressure", label: "Rear tire pressure", placeholder: "e.g. 22.5 psi" },
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.5°" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -1.9°" },
        { key: "frontToe", label: "Front toe", placeholder: "e.g. 0.05°" },
        { key: "rearToe", label: "Rear toe", placeholder: "e.g. 0.15°" },
      ],
    },
    {
      title: "Suspension",
      fields: [
        { key: "frontArb", label: "Front ARB", placeholder: "e.g. 6 clicks" },
        { key: "rearArb", label: "Rear ARB", placeholder: "e.g. 4 clicks" },
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 28 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 38 mm" },
      ],
    },
    {
      title: "Aero, Diff & Gearing",
      fields: [
        { key: "frontWing", label: "Front wing", placeholder: "e.g. 2 (min front wing)" },
        { key: "rearWing", label: "Rear wing", placeholder: "e.g. 3" },
        { key: "diffPower", label: "Diff power/coast", placeholder: "e.g. On 60% / Off 40%" },
        { key: "diffPreload", label: "Diff preload", placeholder: "e.g. 70 Nm" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 58% front" },
        { key: "finalDrive", label: "Final drive", placeholder: "e.g. Long — back straight" },
      ],
    },
  ],

  "F1 25": [
    {
      title: "Aerodynamics",
      fields: [
        { key: "frontWing", label: "Front wing", placeholder: "e.g. 26 (0-50 scale)" },
        { key: "rearWing", label: "Rear wing", placeholder: "e.g. 16 (0-50 scale)" },
      ],
    },
    {
      title: "Transmission",
      fields: [
        { key: "diffOnThrottle", label: "Differential — on throttle", placeholder: "e.g. 65%" },
        { key: "diffOffThrottle", label: "Differential — off throttle", placeholder: "e.g. 55%" },
      ],
    },
    {
      title: "Suspension Geometry",
      fields: [
        { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.00° (range -3.50 to -2.50)" },
        { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -1.50° (range -2.20 to -0.70)" },
        { key: "frontToe", label: "Front toe out", placeholder: "e.g. 0.05°" },
        { key: "rearToe", label: "Rear toe out", placeholder: "e.g. 0.10°" },
      ],
    },
    {
      title: "Suspension",
      fields: [
        { key: "frontArb", label: "Front anti-roll bar", placeholder: "e.g. 6/11" },
        { key: "rearArb", label: "Rear anti-roll bar", placeholder: "e.g. 5/11" },
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 3/11" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 4/11" },
      ],
    },
    {
      title: "Brakes & Tyres",
      fields: [
        { key: "brakePressure", label: "Brake pressure", placeholder: "e.g. 95%" },
        { key: "brakeBias", label: "Front brake bias", placeholder: "e.g. 55%" },
        { key: "frontTirePressure", label: "Front tyre pressure", placeholder: "e.g. 23.5 psi" },
        { key: "rearTirePressure", label: "Rear tyre pressure", placeholder: "e.g. 21.5 psi" },
      ],
    },
  ],

  "Gran Turismo 7": [
    {
      title: "Suspension",
      fields: [
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 95 mm" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 100 mm" },
        { key: "frontCamber", label: "Front camber angle", placeholder: "e.g. -3.5°" },
        { key: "rearCamber", label: "Rear camber angle", placeholder: "e.g. -1.5°" },
        { key: "frontToe", label: "Front toe angle", placeholder: "e.g. 0.10° (toe-in)" },
        { key: "rearToe", label: "Rear toe angle", placeholder: "e.g. 0.05° (toe-in)" },
        { key: "frontArb", label: "Front anti-roll bar", placeholder: "e.g. 5" },
        { key: "rearArb", label: "Rear anti-roll bar", placeholder: "e.g. 4" },
      ],
    },
    {
      title: "LSD (Differential)",
      fields: [
        { key: "lsdInitial", label: "Initial torque", placeholder: "e.g. 10" },
        { key: "lsdAccel", label: "Acceleration sensitivity", placeholder: "e.g. 25" },
        { key: "lsdBraking", label: "Braking sensitivity", placeholder: "e.g. 15" },
      ],
    },
    {
      title: "Transmission & Aero",
      fields: [
        { key: "finalGear", label: "Final gear ratio", placeholder: "e.g. 4.100 (or Auto-set top speed)" },
        { key: "frontDownforce", label: "Front downforce", placeholder: "e.g. 180 (if adjustable)" },
        { key: "rearDownforce", label: "Rear downforce", placeholder: "e.g. 260 (if adjustable)" },
      ],
    },
    {
      title: "Brakes & Ballast",
      fields: [
        { key: "brakeBalance", label: "Brake balance", placeholder: "e.g. -1 (rear-biased)" },
        { key: "ballastWeight", label: "Ballast weight", placeholder: "e.g. 0 kg" },
        { key: "ballastPosition", label: "Ballast position", placeholder: "e.g. 0 (centered)" },
        { key: "tireCompound", label: "Tire compound", placeholder: "e.g. Racing: Medium" },
      ],
    },
  ],
};

export function getEmptySetupValues(game: Game): SetupValues {
  const values: SetupValues = {};
  for (const group of setupSchemas[game]) {
    for (const field of group.fields) values[field.key] = "";
  }
  return values;
}
