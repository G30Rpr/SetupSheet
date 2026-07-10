import { setupSchemas } from "@/lib/setup-schemas";
import type { Game, SetupValues } from "@/lib/types";

export interface SetupValueDiffRow {
  key: string;
  label: string;
  valueA: string | null;
  valueB: string | null;
  differs: boolean;
}

export interface SetupValueDiffGroup {
  title: string;
  rows: SetupValueDiffRow[];
}

/**
 * Pairs up two setups' structured values field-by-field using the shared
 * schema for `game`, so the comparison tool and version-history panel can
 * both render "what's different" without duplicating this logic. A row is
 * only included if either side actually has a value for that field (an
 * all-blank field on both sides is noise, not a comparison).
 */
export function diffSetupValues(
  game: Game,
  valuesA: SetupValues | null | undefined,
  valuesB: SetupValues | null | undefined
): SetupValueDiffGroup[] {
  const a = valuesA ?? {};
  const b = valuesB ?? {};

  return setupSchemas[game]
    .map((group) => {
      const rows = group.fields
        .filter((field) => a[field.key] || b[field.key])
        .map((field): SetupValueDiffRow => {
          const valueA = a[field.key] ?? null;
          const valueB = b[field.key] ?? null;
          return { key: field.key, label: field.label, valueA, valueB, differs: valueA !== valueB };
        });
      return { title: group.title, rows };
    })
    .filter((group) => group.rows.length > 0);
}

export interface TopLevelFieldChange {
  label: string;
  before: string;
  after: string;
}

interface TopLevelFields {
  car: string;
  track: string;
  condition: string;
  lapTime: string;
  description: string;
  tags: string[];
  rigProfile: string;
}

/** Which of a setup's non-tuning fields changed between two snapshots -- used to render the "what changed" list in the version-history panel. */
export function diffTopLevelFields(before: TopLevelFields, after: TopLevelFields): TopLevelFieldChange[] {
  const changes: TopLevelFieldChange[] = [];
  const push = (label: string, valueBefore: string, valueAfter: string) => {
    if (valueBefore !== valueAfter) {
      changes.push({ label, before: valueBefore, after: valueAfter });
    }
  };

  push("Car", before.car, after.car);
  push("Track", before.track, after.track);
  push("Condition", before.condition, after.condition);
  push("Lap time", before.lapTime, after.lapTime);
  push("Rig profile", before.rigProfile, after.rigProfile);
  push("Description", before.description, after.description);
  push("Tags", before.tags.join(", "), after.tags.join(", "));

  return changes;
}
