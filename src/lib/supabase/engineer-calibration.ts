import { logger } from "@/lib/logger";
import {
  mapPublicEngineerCalibrationRows,
  type EngineerCalibrationQueryResult,
} from "@/lib/engineer-calibration";
import { ENGINEER_GAMES, type EngineerCondition } from "@/lib/engineer-types";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/database.types";

const MAX_CALIBRATION_ROWS = 500;
const CALIBRATION_COLUMNS =
  "game, condition, parameter, direction, supporting_setup_count, directions";
type CalibrationRow = Database["public"]["Views"]["engineer_calibration_evidence"]["Row"];

function isEngineerGame(value: unknown): value is (typeof ENGINEER_GAMES)[number] {
  return typeof value === "string" && ENGINEER_GAMES.includes(value as (typeof ENGINEER_GAMES)[number]);
}

function isEngineerCondition(value: unknown): value is EngineerCondition {
  return value === "dry" || value === "wet";
}

/**
 * Reads only the privacy-safe aggregate view. If the aggregate is unavailable
 * or exceeds the defensive row bound, calibration fails closed to the static plan.
 */
export async function getPublicEngineerCalibration(
  gameValue: unknown,
  conditionValue: unknown
): Promise<EngineerCalibrationQueryResult> {
  if (!isEngineerGame(gameValue) || !isEngineerCondition(conditionValue)) {
    return { status: "available", factors: [] };
  }

  const condition = conditionValue === "dry" ? "Dry" : "Wet";

  try {
    const result = await createPublicClient()
      .from("engineer_calibration_evidence")
      .select(CALIBRATION_COLUMNS, { count: "exact" })
      .eq("game", gameValue)
      .eq("condition", condition)
      .limit(MAX_CALIBRATION_ROWS);

    if (
      result.error ||
      !result.data ||
      result.count === null ||
      result.count !== result.data.length
    ) {
      logger.error("getPublicEngineerCalibration: aggregate query failed or was incomplete", result.error);
      return { status: "unavailable", factors: [] };
    }

    return {
      status: "available",
      factors: mapPublicEngineerCalibrationRows(
        result.data as CalibrationRow[],
        gameValue,
        conditionValue
      ),
    };
  } catch (error) {
    logger.error("getPublicEngineerCalibration: aggregate query threw", error);
    return { status: "unavailable", factors: [] };
  }
}
