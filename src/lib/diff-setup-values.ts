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
 * The key setup fields the comparison tool lines up (P2: "only parsed
 * differing values (wing, ride height, ARB, diff, brake bias, ABS, TC,
 * pressures)"). Matched on the stable field keys, not labels; `frontDiffuser`
 * deliberately misses the diff family (it's aero), `brakeMigration`/
 * `brakePower`/ducts miss the brake-bias family.
 */
export const COMPARISON_FIELD_FAMILIES = [
  "wing",
  "ride height",
  "ARB",
  "diff",
  "brake bias",
  "ABS",
  "TC",
  "pressures",
] as const;

export function isComparisonKey(key: string): boolean {
  return (
    /wing|aero|splitter/i.test(key) || // wing family (frontAero, rearWing, ...)
    /rideheight/i.test(key) ||
    /arb/i.test(key) || // frontArb/rearArb (camelCase; no schema key collides)
    /^diff/i.test(key) || // diffPower/diffCoast/... — not "frontDiffuser"
    /brakebias/i.test(key) ||
    /^abs/i.test(key) ||
    /tractioncontrol|^tc|onboardtc/i.test(key) ||
    /pressure/i.test(key)
  );
}

/**
 * The compare tool's view of two value sets: only the key fields above, and
 * only the rows that actually differ (a one-sided row still differs — the
 * missing side renders as "—"). Equal rows and non-key knobs are noise in a
 * "what's different" table and are dropped.
 */
export function buildComparisonDiff(
  game: Game,
  valuesA: SetupValues | null | undefined,
  valuesB: SetupValues | null | undefined
): SetupValueDiffGroup[] {
  return diffSetupValues(game, valuesA, valuesB)
    .map((group) => ({
      title: group.title,
      rows: group.rows.filter((row) => row.differs && isComparisonKey(row.key)),
    }))
    .filter((group) => group.rows.length > 0);
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
