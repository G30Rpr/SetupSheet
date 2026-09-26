import {
  MAX_CAR_LENGTH,
  MAX_TRACK_LENGTH,
  conditions,
  rigProfiles,
} from "@/lib/data";
import { ENGINEER_GAMES, type EngineerDirection, type EngineerGame } from "@/lib/engineer-types";
import { normalizeSetupValues } from "@/lib/setup-values";
import { setupSchemas } from "@/lib/setup-schemas";
import { isUuid } from "@/lib/utils";
import type { Condition, RigProfile, SetupValues } from "@/lib/types";

export const GARAGE_VERDICTS = ["better", "worse", "inconclusive"] as const;
export type GarageVerdict = (typeof GARAGE_VERDICTS)[number];
export type GarageDirection = EngineerDirection;

export const MAX_GARAGE_NOTE_LENGTH = 1000;
export const MAX_GARAGE_PARAMETER_LENGTH = 120;
export const MAX_GARAGE_AMOUNT_LENGTH = 100;
export const MAX_GARAGE_LAP_TIME_INPUT_LENGTH = 16;
export const MIN_GARAGE_LAP_TIME_MS = 10_000;
export const MAX_GARAGE_LAP_TIME_MS = 1_800_000;

export interface GarageSession {
  id: string;
  game: EngineerGame;
  car: string;
  track: string;
  condition: Condition;
  rig: RigProfile | null;
  sourceSetupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GarageRevision {
  id: string;
  sessionId: string;
  setupValues: SetupValues;
  note: string;
  createdAt: string;
}

export interface GarageRunPlanItem {
  id: string;
  sessionId: string;
  revisionId: string;
  parameter: string;
  direction: GarageDirection;
  amount: string;
  verdict: GarageVerdict;
  note: string;
  createdAt: string;
}

export interface GarageLap {
  id: string;
  sessionId: string;
  revisionId: string;
  lapTimeMs: number;
  condition: Condition;
  note: string;
  createdAt: string;
}

export interface GarageSessionDetail {
  session: GarageSession;
  revisions: GarageRevision[];
  runPlanItems: GarageRunPlanItem[];
  laps: GarageLap[];
}

/** Public setup metadata passed to the private Garage form. Setup values stay server-side until the user opts in to copying them. */
export interface GarageSetupSource {
  id: string;
  game: EngineerGame;
  car: string;
  track: string;
  condition: Condition;
  setupValueCount: number;
}

export interface CreateGarageSessionInput {
  game: EngineerGame;
  car: string;
  track: string;
  condition: Condition;
  rig: RigProfile | null;
  setupValues: SetupValues;
  baselineNote: string;
}

export interface CreateGarageRevisionInput {
  sessionId: string;
  setupValues: SetupValues;
  note: string;
}

export interface CreateGarageRunPlanItemInput {
  sessionId: string;
  revisionId: string;
  parameter: string;
  direction: GarageDirection;
  amount: string;
  verdict: GarageVerdict;
  note: string;
}

export interface CreateGarageLapInput {
  sessionId: string;
  revisionId: string;
  lapTime: string;
  condition: Condition;
  note: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeValuesForGame(game: EngineerGame, value: unknown): SetupValues | null {
  const schema = setupSchemas[game];
  if (!schema) return null;

  const values = normalizeSetupValues(value);
  if (!values) return null;

  const allowedKeys = new Set(
    schema.flatMap((group) => group.fields.map((field) => field.key))
  );
  if (Object.keys(values).some((key) => !allowedKeys.has(key))) return null;

  // Return a normal-prototype object before it crosses a Server Action/RSC boundary.
  return { ...values };
}

/** Pick only fields that belong to the Garage schema for a source setup's game. */
export function getGarageCompatibleSetupValues(game: EngineerGame, value: unknown): SetupValues {
  const schema = setupSchemas[game];
  const values = normalizeSetupValues(value);
  if (!schema || !values) return {};

  const allowedKeys = new Set(schema.flatMap((group) => group.fields.map((field) => field.key)));
  const compatible: SetupValues = {};
  for (const [key, item] of Object.entries(values)) {
    if (allowedKeys.has(key)) compatible[key] = item;
  }
  return compatible;
}

export function countGarageSetupValues(game: EngineerGame, value: unknown): number {
  return Object.values(getGarageCompatibleSetupValues(game, value))
    .filter((item) => item.trim().length > 0).length;
}

export function parseCreateGarageSessionInput(
  input: unknown
): { value: CreateGarageSessionInput | null; error: string | null } {
  if (!isRecord(input)) return { value: null, error: "Invalid garage session fields." };

  const { game, car, track, condition, rig, setupValues, baselineNote } = input;
  if (typeof game !== "string" || !ENGINEER_GAMES.includes(game as EngineerGame)) {
    return { value: null, error: "Choose a supported game." };
  }
  if (typeof car !== "string" || !car.trim()) {
    return { value: null, error: "Car is required." };
  }
  if (car.length > MAX_CAR_LENGTH) {
    return { value: null, error: `Car name is too long — max ${MAX_CAR_LENGTH} characters.` };
  }
  if (typeof track !== "string" || !track.trim()) {
    return { value: null, error: "Track is required." };
  }
  if (track.length > MAX_TRACK_LENGTH) {
    return { value: null, error: `Track name is too long — max ${MAX_TRACK_LENGTH} characters.` };
  }
  if (typeof condition !== "string" || !conditions.includes(condition as Condition)) {
    return { value: null, error: "Choose a valid track condition." };
  }
  if (rig !== null && (typeof rig !== "string" || !rigProfiles.includes(rig as RigProfile))) {
    return { value: null, error: "Choose a valid rig profile." };
  }
  if (typeof baselineNote !== "string" || baselineNote.length > MAX_GARAGE_NOTE_LENGTH) {
    return { value: null, error: "Baseline note is too long." };
  }

  const normalizedValues = normalizeValuesForGame(game as EngineerGame, setupValues);
  if (!normalizedValues) {
    return { value: null, error: "Baseline setup values are invalid for this game." };
  }

  return {
    value: {
      game: game as EngineerGame,
      car: car.trim(),
      track: track.trim(),
      condition: condition as Condition,
      rig: rig as RigProfile | null,
      setupValues: normalizedValues,
      baselineNote: baselineNote.trim(),
    },
    error: null,
  };
}

export function parseCreateGarageRevisionInput(
  input: unknown,
  game: EngineerGame
): { value: CreateGarageRevisionInput | null; error: string | null } {
  if (!ENGINEER_GAMES.includes(game)) {
    return { value: null, error: "This session uses an unsupported game." };
  }
  if (!isRecord(input) || typeof input.sessionId !== "string" || !isUuid(input.sessionId)) {
    return { value: null, error: "That garage session is invalid." };
  }
  if (typeof input.note !== "string" || input.note.length > MAX_GARAGE_NOTE_LENGTH) {
    return { value: null, error: "Revision note is too long." };
  }

  const setupValues = normalizeValuesForGame(game, input.setupValues);
  if (!setupValues) return { value: null, error: "Revision setup values are invalid for this game." };

  return {
    value: { sessionId: input.sessionId, setupValues, note: input.note.trim() },
    error: null,
  };
}

export function parseCreateGarageRunPlanItemInput(
  input: unknown
): { value: CreateGarageRunPlanItemInput | null; error: string | null } {
  if (!isRecord(input)) return { value: null, error: "Invalid run-plan fields." };
  if (typeof input.sessionId !== "string" || !isUuid(input.sessionId)) {
    return { value: null, error: "That garage session is invalid." };
  }
  if (typeof input.revisionId !== "string" || !isUuid(input.revisionId)) {
    return { value: null, error: "Choose a valid revision." };
  }
  if (typeof input.parameter !== "string" || !input.parameter.trim()) {
    return { value: null, error: "Parameter is required." };
  }
  if (input.parameter.length > MAX_GARAGE_PARAMETER_LENGTH) {
    return { value: null, error: "Parameter name is too long." };
  }
  if (!isGarageDirection(input.direction)) return { value: null, error: "Choose a valid change direction." };
  if (typeof input.amount !== "string" || !input.amount.trim()) {
    return { value: null, error: "Suggested amount is required." };
  }
  if (input.amount.length > MAX_GARAGE_AMOUNT_LENGTH) {
    return { value: null, error: "Suggested amount is too long." };
  }
  if (typeof input.verdict !== "string" || !GARAGE_VERDICTS.includes(input.verdict as GarageVerdict)) {
    return { value: null, error: "Choose a valid test verdict." };
  }
  if (typeof input.note !== "string" || input.note.length > MAX_GARAGE_NOTE_LENGTH) {
    return { value: null, error: "Run-plan note is too long." };
  }

  return {
    value: {
      sessionId: input.sessionId,
      revisionId: input.revisionId,
      parameter: input.parameter.trim(),
      direction: input.direction,
      amount: input.amount.trim(),
      verdict: input.verdict as GarageVerdict,
      note: input.note.trim(),
    },
    error: null,
  };
}

export function parseCreateGarageLapInput(
  input: unknown
): { value: (CreateGarageLapInput & { lapTimeMs: number }) | null; error: string | null } {
  if (!isRecord(input)) return { value: null, error: "Invalid lap fields." };
  if (typeof input.sessionId !== "string" || !isUuid(input.sessionId)) {
    return { value: null, error: "That garage session is invalid." };
  }
  if (typeof input.revisionId !== "string" || !isUuid(input.revisionId)) {
    return { value: null, error: "Choose a valid revision." };
  }
  if (typeof input.condition !== "string" || !conditions.includes(input.condition as Condition)) {
    return { value: null, error: "Choose a valid lap condition." };
  }
  if (typeof input.note !== "string" || input.note.length > MAX_GARAGE_NOTE_LENGTH) {
    return { value: null, error: "Lap note is too long." };
  }
  if (typeof input.lapTime !== "string") return { value: null, error: "Enter a valid lap time." };

  const lapTimeMs = parseLapTimeToMilliseconds(input.lapTime);
  if (lapTimeMs === null) {
    return {
      value: null,
      error: "Enter lap time as m:ss.mmm (for example, 1:42.350).",
    };
  }

  return {
    value: {
      sessionId: input.sessionId,
      revisionId: input.revisionId,
      lapTime: input.lapTime.trim(),
      lapTimeMs,
      condition: input.condition as Condition,
      note: input.note.trim(),
    },
    error: null,
  };
}

export function parseLapTimeToMilliseconds(value: string): number | null {
  if (value.length > MAX_GARAGE_LAP_TIME_INPUT_LENGTH) return null;
  const trimmed = value.trim();
  const match = /^(?:(\d{1,2}):)?(\d{1,2})(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) return null;

  const hasMinutes = match[1] !== undefined;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  const milliseconds = Number((match[3] ?? "").padEnd(3, "0"));
  if (hasMinutes && seconds >= 60) return null;

  const total = minutes * 60_000 + seconds * 1_000 + milliseconds;
  if (total < MIN_GARAGE_LAP_TIME_MS || total > MAX_GARAGE_LAP_TIME_MS) return null;
  return total;
}

function isGarageDirection(value: unknown): value is GarageDirection {
  return value === "increase" || value === "decrease" || value === "soften" || value === "stiffen";
}
