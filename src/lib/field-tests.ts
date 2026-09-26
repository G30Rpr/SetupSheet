import type { GarageDirection, GarageVerdict } from "@/lib/garage";
import { isUuid } from "@/lib/utils";
import type { Condition, Game } from "@/lib/types";
import type { EngineerGame } from "@/lib/engineer-types";

export const MAX_FIELD_TEST_NOTE_LENGTH = 1000;

export interface CreateFieldTestReportInput {
  garageSessionId: string;
  setupId: string;
  note: string;
}

export interface SetFieldTestAttributionInput {
  reportId: string;
  showName: boolean;
}

export interface FieldTestValidatedChange {
  parameter: string;
  direction: GarageDirection;
  amount: string;
}

/** Sanitized public projection; never includes reporter or Garage session IDs. */
export interface PublicFieldTestReport {
  id: string;
  setupId: string;
  game: EngineerGame;
  condition: Condition;
  validatedChanges: FieldTestValidatedChange[];
  lapsRun: number;
  consistencyPct: number | null;
  bestLapMs: number;
  createdAt: string;
  displayName: string | null;
}

export interface GarageLapMetric {
  lapTimeMs: number;
  condition: Condition;
}

export interface GarageRunPlanMetric {
  parameter: string;
  direction: GarageDirection;
  amount: string;
  verdict: GarageVerdict;
}

const CREATE_REPORT_KEYS = new Set(["garageSessionId", "setupId", "note"]);
const ATTRIBUTION_KEYS = new Set(["reportId", "showName"]);
const GARAGE_DIRECTIONS = new Set<GarageDirection>(["increase", "decrease", "soften", "stiffen"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function parseCreateFieldTestReportInput(
  input: unknown
): { value: CreateFieldTestReportInput | null; error: string | null } {
  if (!isRecord(input) || !hasOnlyKeys(input, CREATE_REPORT_KEYS)) {
    return { value: null, error: "Field-test details are invalid." };
  }
  if (typeof input.garageSessionId !== "string" || !isUuid(input.garageSessionId)) {
    return { value: null, error: "That Garage session is invalid." };
  }
  if (typeof input.setupId !== "string" || !isUuid(input.setupId)) {
    return { value: null, error: "That public setup is invalid." };
  }
  if (typeof input.note !== "string" || input.note.length > MAX_FIELD_TEST_NOTE_LENGTH) {
    return { value: null, error: "Field-test note is too long." };
  }

  return {
    value: {
      garageSessionId: input.garageSessionId,
      setupId: input.setupId,
      note: input.note.trim(),
    },
    error: null,
  };
}

export function parseSetFieldTestAttributionInput(
  input: unknown
): { value: SetFieldTestAttributionInput | null; error: string | null } {
  if (!isRecord(input) || !hasOnlyKeys(input, ATTRIBUTION_KEYS)) {
    return { value: null, error: "Attribution preference is invalid." };
  }
  if (typeof input.reportId !== "string" || !isUuid(input.reportId)) {
    return { value: null, error: "That field-test report is invalid." };
  }
  if (typeof input.showName !== "boolean") {
    return { value: null, error: "Choose a valid attribution preference." };
  }
  return { value: { reportId: input.reportId, showName: input.showName }, error: null };
}

export function deriveFieldTestCondition(laps: GarageLapMetric[]): Condition | null {
  if (laps.length === 0) return null;
  if (laps.some((lap) => lap.condition === "Mixed")) return "Mixed";
  const conditions = new Set(laps.map((lap) => lap.condition));
  return conditions.size === 1 ? laps[0].condition : "Mixed";
}

/** Sample-CV consistency score. One lap cannot establish variability, so it returns null. */
export function calculateConsistencyPct(lapTimesMs: number[]): number | null {
  if (lapTimesMs.length < 2 || lapTimesMs.some((time) => !Number.isFinite(time) || time <= 0)) {
    return null;
  }

  const mean = lapTimesMs.reduce((sum, time) => sum + time, 0) / lapTimesMs.length;
  const sumOfSquares = lapTimesMs.reduce((sum, time) => sum + (time - mean) ** 2, 0);
  const sampleStandardDeviation = Math.sqrt(sumOfSquares / (lapTimesMs.length - 1));
  const score = Math.max(0, Math.min(100, 100 * (1 - sampleStandardDeviation / mean)));
  return Math.round((score + Number.EPSILON) * 10) / 10;
}

export function isEngineerGame(value: Game): value is EngineerGame {
  return value === "Assetto Corsa Competizione" || value === "Le Mans Ultimate";
}

export function isGarageDirection(value: unknown): value is GarageDirection {
  return typeof value === "string" && GARAGE_DIRECTIONS.has(value as GarageDirection);
}
