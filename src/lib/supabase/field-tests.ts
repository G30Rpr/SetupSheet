import { logger } from "@/lib/logger";
import type { FieldTestValidatedChange, PublicFieldTestReport } from "@/lib/field-tests";
import { isGarageDirection, isEngineerGame } from "@/lib/field-tests";
import { MAX_GARAGE_AMOUNT_LENGTH, MAX_GARAGE_PARAMETER_LENGTH } from "@/lib/garage";
import { conditions } from "@/lib/data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database, Json } from "@/lib/supabase/database.types";
import { sanitizeDisplayName } from "@/lib/user-display";
import { isUuid } from "@/lib/utils";
import type { Condition, Game } from "@/lib/types";

export interface PublicFieldTestSummary {
  reportCount: number;
  reports: PublicFieldTestReport[];
  error: boolean;
}

type PublicReportRow = Database["public"]["Views"]["field_test_reports_public"]["Row"];

const PUBLIC_REPORT_COLUMNS =
  "report_id, setup_id, game, condition, validated_changes, laps_run, consistency_pct, best_lap_ms, created_at, display_name";

function mapValidatedChanges(value: Json): FieldTestValidatedChange[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const change = item as Record<string, unknown>;
    if (
      typeof change.parameter !== "string" ||
      change.parameter.length === 0 || change.parameter.length > MAX_GARAGE_PARAMETER_LENGTH ||
      !isGarageDirection(change.direction) ||
      typeof change.amount !== "string" ||
      change.amount.length === 0 || change.amount.length > MAX_GARAGE_AMOUNT_LENGTH
    ) {
      return [];
    }
    return [{
      parameter: change.parameter,
      direction: change.direction,
      amount: change.amount,
    }];
  });
}

function mapPublicReport(row: PublicReportRow): PublicFieldTestReport | null {
  if (
    !isEngineerGame(row.game as Game) ||
    !conditions.includes(row.condition as Condition) ||
    !Number.isInteger(row.laps_run) || row.laps_run < 1 ||
    !Number.isInteger(row.best_lap_ms) || row.best_lap_ms < 10_000 || row.best_lap_ms > 1_800_000
  ) {
    return null;
  }

  const consistencyPct = row.consistency_pct;
  if (consistencyPct !== null && (!Number.isFinite(consistencyPct) || consistencyPct < 0 || consistencyPct > 100)) {
    return null;
  }

  return {
    id: row.report_id,
    setupId: row.setup_id,
    game: row.game as PublicFieldTestReport["game"],
    condition: row.condition as Condition,
    validatedChanges: mapValidatedChanges(row.validated_changes),
    lapsRun: row.laps_run,
    consistencyPct,
    bestLapMs: row.best_lap_ms,
    createdAt: row.created_at,
    displayName: typeof row.display_name === "string" ? sanitizeDisplayName(row.display_name) : null,
  };
}

/** Public-only, bounded report list and exact aggregate count for one setup. */
export async function getPublicFieldTestSummary(
  setupId: string,
  limit = 5
): Promise<PublicFieldTestSummary> {
  if (!isUuid(setupId)) return { reportCount: 0, reports: [], error: true };

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 5, 20));
  try {
    const result = await createPublicClient()
      .from("field_test_reports_public")
      .select(PUBLIC_REPORT_COLUMNS, { count: "exact" })
      .eq("setup_id", setupId)
      .order("created_at", { ascending: false })
      .order("report_id", { ascending: false })
      .limit(safeLimit);

    if (result.error || !result.data) {
      logger.error("getPublicFieldTestSummary: failed to load public reports", result.error);
      return { reportCount: 0, reports: [], error: true };
    }

    const reports = (result.data as unknown as PublicReportRow[])
      .map(mapPublicReport)
      .filter((row): row is PublicFieldTestReport => row !== null);
    return { reportCount: result.count ?? reports.length, reports, error: false };
  } catch (error) {
    logger.error("getPublicFieldTestSummary: public report query threw", error);
    return { reportCount: 0, reports: [], error: true };
  }
}

/** Batch aggregate counts used by setup cards; no report/session/user payload is loaded. */
export async function getPublicFieldTestCounts(setupIds: string[]): Promise<Map<string, number>> {
  const uniqueIds = Array.from(new Set(setupIds.filter(isUuid)));
  if (uniqueIds.length === 0) return new Map();

  try {
    const result = await createPublicClient()
      .from("field_test_counts")
      .select("setup_id, report_count")
      .in("setup_id", uniqueIds);

    if (result.error || !result.data) {
      logger.error("getPublicFieldTestCounts: failed to load setup counts", result.error);
      return new Map();
    }

    return new Map(
      (result.data as Database["public"]["Views"]["field_test_counts"]["Row"][])
        .map((row) => [row.setup_id, row.report_count])
    );
  } catch (error) {
    logger.error("getPublicFieldTestCounts: count query threw", error);
    return new Map();
  }
}
