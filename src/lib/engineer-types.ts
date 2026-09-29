export const ENGINEER_GAMES = [
  "Assetto Corsa Competizione",
  "Le Mans Ultimate",
] as const;

export type EngineerGame = (typeof ENGINEER_GAMES)[number];

export const ENGINEER_SEVERITIES = ["slight", "moderate", "severe"] as const;
export type EngineerSeverity = (typeof ENGINEER_SEVERITIES)[number];

export type EngineerCondition = "dry" | "wet";

export type EngineerDirection = "increase" | "decrease" | "soften" | "stiffen";

export const ENGINEER_SYMPTOMS = [
  {
    id: "front-locking",
    label: "Front tyres lock under braking",
    category: "Braking",
    description: "The front tyres stop rotating or slide when you brake.",
  },
  {
    id: "mid-corner-understeer",
    label: "The car pushes wide mid-corner",
    category: "Cornering",
    description: "The front runs wide after turn-in while you hold a steady line.",
  },
  {
    id: "mid-corner-oversteer",
    label: "The rear rotates too easily mid-corner",
    category: "Cornering",
    description: "The rear moves outward while you're holding a steady cornering line.",
  },
  {
    id: "exit-oversteer",
    label: "The rear steps out on corner exit",
    category: "Corner exit",
    description: "The car rotates or slides as you begin to apply throttle on exit.",
  },
  {
    id: "exit-wheelspin",
    label: "A driven tyre spins on corner exit",
    category: "Corner exit",
    description: "You lose drive to wheelspin as you feed in throttle.",
  },
  {
    id: "high-speed-instability",
    label: "The car feels unstable at high speed",
    category: "Stability",
    description: "The car feels nervous or light through fast sections.",
  },
  {
    id: "hot-tyre-pressure-high",
    label: "Hot tyre pressure is above its target",
    category: "Tyres",
    description: "After the tyres are up to temperature, the in-game reading exceeds that car and compound's target.",
  },
  {
    id: "hot-tyre-pressure-low",
    label: "Hot tyre pressure is below its target",
    category: "Tyres",
    description: "After the tyres are up to temperature, the in-game reading is below that car and compound's target.",
  },
] as const;

export type EngineerSymptomId = (typeof ENGINEER_SYMPTOMS)[number]["id"];
export type EngineerSymptom = (typeof ENGINEER_SYMPTOMS)[number];

export type EngineerInput = {
  symptomId: string;
  severity: EngineerSeverity;
  condition?: EngineerCondition;
  game?: string;
};

export type EngineerRecommendation = {
  parameter: string;
  direction: EngineerDirection;
  amount: number | string;
  unit?: string;
  /** Static relevance score from 0-100; public calibration never mutates it. */
  score: number;
  explanation: string;
  warnings?: string[];
  /** Public better-change evidence used only as a ranking multiplier. */
  publicEvidence?: {
    sampleCount: number;
    factor: number;
  };
};

export type EngineerRecommendationConflict = {
  parameter: string;
  recommendationIndices: number[];
  directions: EngineerDirection[];
  message: string;
};

export type EngineerResultStatus = "ready" | "generic" | "unknown-symptom" | "unavailable";

export type EngineerResult = {
  status: EngineerResultStatus;
  symptom: EngineerSymptom | null;
  recommendations: EngineerRecommendation[];
  conflicts: EngineerRecommendationConflict[];
  notices: string[];
  source: "static";
  gameSpecific: boolean;
};
