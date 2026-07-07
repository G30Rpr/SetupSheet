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
      title: "Tyres",
      fields: [
        { key: "frontLeftTyrePressure", label: "Front left tyre pressure", placeholder: "e.g. 25.6 psi" },
        { key: "frontRightTyrePressure", label: "Front right tyre pressure", placeholder: "e.g. 26.0 psi" },
        { key: "rearLeftTyrePressure", label: "Rear left tyre pressure", placeholder: "e.g. 25.0 psi" },
        { key: "rearRightTyrePressure", label: "Rear right tyre pressure", placeholder: "e.g. 25.3 psi" },
        { key: "frontLeftCamber", label: "Front left camber", placeholder: "e.g. -4.0°" },
        { key: "frontRightCamber", label: "Front right camber", placeholder: "e.g. -4.0°" },
        { key: "rearLeftCamber", label: "Rear left camber", placeholder: "e.g. -3.5°" },
        { key: "rearRightCamber", label: "Rear right camber", placeholder: "e.g. -3.5°" },
        { key: "frontLeftToe", label: "Front left toe", placeholder: "e.g. -0.15°" },
        { key: "frontRightToe", label: "Front right toe", placeholder: "e.g. 0.15°" },
        { key: "rearLeftToe", label: "Rear left toe", placeholder: "e.g. -0.15°" },
        { key: "rearRightToe", label: "Rear right toe", placeholder: "e.g. 0.15°" },
        { key: "caster", label: "Caster (front axle)", placeholder: "e.g. 12.4°" },
      ],
    },
    {
      title: "Electronics",
      fields: [
        { key: "tractionControl", label: "Traction control (TC1)", placeholder: "e.g. 3" },
        { key: "tractionControl2", label: "Traction control 2 (slip)", placeholder: "e.g. 0" },
        { key: "abs", label: "ABS", placeholder: "e.g. 3" },
        { key: "engineMap", label: "Engine map (ECU)", placeholder: "e.g. 8" },
      ],
    },
    {
      title: "Fuel & Strategy",
      fields: [
        { key: "fuel", label: "Fuel load", placeholder: "e.g. 18 L" },
        { key: "tyreCompound", label: "Tyre compound", placeholder: "e.g. Dry" },
        { key: "tyreSet", label: "Tyre set number", placeholder: "e.g. 1" },
        { key: "frontBrakePadSet", label: "Front brake pad set", placeholder: "e.g. 1" },
        { key: "rearBrakePadSet", label: "Rear brake pad set", placeholder: "e.g. 1" },
      ],
    },
    {
      title: "Mechanical Grip",
      fields: [
        { key: "frontArb", label: "Front anti-roll bar", placeholder: "e.g. 4" },
        { key: "rearArb", label: "Rear anti-roll bar", placeholder: "e.g. 4" },
        { key: "brakePower", label: "Brake power", placeholder: "e.g. 100%" },
        { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 48.2% front" },
        { key: "steeringRatio", label: "Steering ratio", placeholder: "e.g. 16.0" },
        { key: "diffPreload", label: "Differential preload", placeholder: "e.g. 160 Nm" },
        { key: "frontLeftSpringRate", label: "Front left spring rate", placeholder: "e.g. 137000 N/m" },
        { key: "frontRightSpringRate", label: "Front right spring rate", placeholder: "e.g. 137000 N/m" },
        { key: "rearLeftSpringRate", label: "Rear left spring rate", placeholder: "e.g. 174500 N/m" },
        { key: "rearRightSpringRate", label: "Rear right spring rate", placeholder: "e.g. 174500 N/m" },
        { key: "frontLeftBumpStopRate", label: "Front left bump-stop rate", placeholder: "e.g. 1000 N" },
        { key: "frontRightBumpStopRate", label: "Front right bump-stop rate", placeholder: "e.g. 1000 N" },
        { key: "rearLeftBumpStopRate", label: "Rear left bump-stop rate", placeholder: "e.g. 1200 N" },
        { key: "rearRightBumpStopRate", label: "Rear right bump-stop rate", placeholder: "e.g. 1200 N" },
        { key: "frontLeftBumpStopRange", label: "Front left bump-stop range", placeholder: "e.g. 12 mm" },
        { key: "frontRightBumpStopRange", label: "Front right bump-stop range", placeholder: "e.g. 12 mm" },
        { key: "rearLeftBumpStopRange", label: "Rear left bump-stop range", placeholder: "e.g. 20 mm" },
        { key: "rearRightBumpStopRange", label: "Rear right bump-stop range", placeholder: "e.g. 20 mm" },
      ],
    },
    {
      title: "Dampers",
      fields: [
        { key: "frontLeftSlowBump", label: "Front left slow bump", placeholder: "e.g. 12" },
        { key: "frontLeftFastBump", label: "Front left fast bump", placeholder: "e.g. 6" },
        { key: "frontLeftSlowRebound", label: "Front left slow rebound", placeholder: "e.g. 10" },
        { key: "frontLeftFastRebound", label: "Front left fast rebound", placeholder: "e.g. 8" },
        { key: "frontRightSlowBump", label: "Front right slow bump", placeholder: "e.g. 12" },
        { key: "frontRightFastBump", label: "Front right fast bump", placeholder: "e.g. 6" },
        { key: "frontRightSlowRebound", label: "Front right slow rebound", placeholder: "e.g. 10" },
        { key: "frontRightFastRebound", label: "Front right fast rebound", placeholder: "e.g. 8" },
        { key: "rearLeftSlowBump", label: "Rear left slow bump", placeholder: "e.g. 8" },
        { key: "rearLeftFastBump", label: "Rear left fast bump", placeholder: "e.g. 4" },
        { key: "rearLeftSlowRebound", label: "Rear left slow rebound", placeholder: "e.g. 8" },
        { key: "rearLeftFastRebound", label: "Rear left fast rebound", placeholder: "e.g. 10" },
        { key: "rearRightSlowBump", label: "Rear right slow bump", placeholder: "e.g. 8" },
        { key: "rearRightFastBump", label: "Rear right fast bump", placeholder: "e.g. 4" },
        { key: "rearRightSlowRebound", label: "Rear right slow rebound", placeholder: "e.g. 8" },
        { key: "rearRightFastRebound", label: "Rear right fast rebound", placeholder: "e.g. 10" },
      ],
    },
    {
      title: "Aero",
      fields: [
        { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 53 mm" },
        { key: "frontDiffuser", label: "Front diffuser", placeholder: "e.g. 0" },
        { key: "frontBrakeDuct", label: "Front brake ducts", placeholder: "e.g. 3" },
        { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 60 mm" },
        { key: "rearWing", label: "Rear wing", placeholder: "e.g. 9" },
        { key: "rearBrakeDuct", label: "Rear brake ducts", placeholder: "e.g. 3" },
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
