import { filterAndSortSetups, ALL } from "@/lib/filter-setups";
import type { EngineerSymptomId } from "@/lib/engineer-types";
import type { Setup, SetupTag } from "@/lib/types";

/**
 * THE editable symptom -> community-setups mapping (Phase 3 Engineer loop,
 * chosen approach A: deterministic tags + condition + score ordering; no
 * guessing, no AI). Change this table to change what the Engineer surfaces.
 *
 * Matching rule for a symptom:
 *   - tag match: the setup carries ANY of `tags` (OR), or `tags` is empty
 *     (any tag qualifies);
 *   - `conditions`, when non-empty, must include the setup's condition;
 *   - results are ordered by `lead`:
 *       "safest"     -> Predictability first (calm, keepable cars),
 *       "fastest"    -> lap time first (attack/rotation setups),
 *       "bestMatch"  -> evidence first (ratings count, then scores),
 *   - top SYMPTOM_MATCH_LIMIT setups surface on the Engineer page; the
 *     Browse deep link uses `linkTag` (single-tag filter) + `lead`.
 *
 * The wet overlay (diagnosing with condition = wet) narrows to the
 * "Wet Weather" tag and leads safest -- the wet answer is a keepable car.
 */

export const SYMPTOM_MATCH_LIMIT = 3;

export interface SymptomSetupMapping {
  /** Why these setups help with this symptom -- shown above the matches. */
  rationale: string;
  /** A setup matches when it carries ANY of these tags. Empty = any tag. */
  tags: SetupTag[];
  /** Setup conditions that qualify; empty = any. */
  conditions: Setup["condition"][];
  /** Which ordering leads the matches. */
  lead: "safest" | "fastest" | "bestMatch";
  /** The single tag behind the "See all on Browse" deep link. */
  linkTag: SetupTag | null;
}

export const ENGINEER_SETUP_MAP: Record<EngineerSymptomId, SymptomSetupMapping> = {
  "front-locking": {
    rationale:
      "Cars the community finds predictable are easier to modulate on the brakes -- calmer fronts, calmer stops.",
    tags: ["Safe", "Beginner"],
    conditions: ["Dry", "Mixed"],
    lead: "safest",
    linkTag: "Safe",
  },
  "mid-corner-understeer": {
    rationale:
      "Setups built to attack -- qualifying and aggressive work -- rotate more willingly through the corner.",
    tags: ["Quali", "Aggressive"],
    conditions: ["Dry", "Mixed"],
    lead: "fastest",
    linkTag: "Quali",
  },
  "mid-corner-oversteer": {
    rationale:
      "Stable, keepable cars hold a steady mid-corner line without the rear moving around under you.",
    tags: ["Safe", "Beginner"],
    conditions: ["Dry", "Mixed"],
    lead: "safest",
    linkTag: "Safe",
  },
  "exit-oversteer": {
    rationale:
      "Race-stint setups manage traction and tyres on exit -- built to be driven lap after lap, not just once.",
    tags: ["Race", "Safe"],
    conditions: ["Dry", "Mixed"],
    lead: "safest",
    linkTag: "Race",
  },
  "exit-wheelspin": {
    rationale:
      "Drivable setups feed in throttle without drama -- smooth drive is what race and beginner work aims for.",
    tags: ["Race", "Beginner"],
    conditions: ["Dry", "Mixed"],
    lead: "safest",
    linkTag: "Race",
  },
  "high-speed-instability": {
    rationale:
      "Predictable, race-bred cars settle down at speed -- start from what others can keep pointed straight.",
    tags: ["Safe", "Race"],
    conditions: ["Dry", "Mixed"],
    lead: "safest",
    linkTag: "Safe",
  },
  "hot-tyre-pressure-high": {
    rationale:
      "Pressure targets live with the car and compound, not with a universal fix -- start from the community's best-evidenced setups and adjust pressures from there.",
    tags: [],
    conditions: ["Dry", "Mixed"],
    lead: "bestMatch",
    linkTag: null,
  },
  "hot-tyre-pressure-low": {
    rationale:
      "Pressure targets live with the car and compound, not with a universal fix -- start from the community's best-evidenced setups and adjust pressures from there.",
    tags: [],
    conditions: ["Dry", "Mixed"],
    lead: "bestMatch",
    linkTag: null,
  },
};

/** Wet overlay for the loop when diagnosing in the wet (see file comment). */
export const WET_SETUP_MAPPING: SymptomSetupMapping = {
  rationale:
    "In the wet the job is keeping it on the road -- wet-weather work, most predictable first.",
  tags: ["Wet Weather"],
  conditions: ["Wet", "Mixed"],
  lead: "safest",
  linkTag: "Wet Weather",
};

const EMPTY_FILTERS = {
  search: "",
  game: ALL,
  car: ALL,
  track: ALL,
  condition: ALL,
  rig: ALL,
  tag: ALL,
} as const;

/** The mapping a symptom diagnosis should use right now. */
export function mappingForSymptom(
  symptomId: EngineerSymptomId,
  wet: boolean
): SymptomSetupMapping {
  return wet ? WET_SETUP_MAPPING : ENGINEER_SETUP_MAP[symptomId];
}

/**
 * Deterministic matcher: setups that fit the symptom's mapping, best first,
 * capped at `limit`. Pure and unit-tested -- the Engineer page passes the
 * browse index and renders the result.
 */
/** Options for {@link setupsForSymptom}. */
export type SymptomMatchOptions = {
  /** Restrict matches to one game (the Engineer game names match Setup.game). */
  game?: string;
  limit?: number;
};

/**
 * Community setups matching a symptom's mapping, best first. Pass `game` to
 * scope to the diagnosed game -- an LMU read never surfaces ACC cars and
 * vice versa. Never invents rows: an empty result is honest.
 */
export function setupsForSymptom(
  setups: Setup[],
  symptomId: EngineerSymptomId,
  wet: boolean,
  options: SymptomMatchOptions = {}
): Setup[] {
  const { game, limit = SYMPTOM_MATCH_LIMIT } = options;
  const mapping = mappingForSymptom(symptomId, wet);
  const matched = setups.filter((setup) => {
    if (game !== undefined && setup.game !== game) return false;
    if (mapping.conditions.length > 0 && !mapping.conditions.includes(setup.condition)) {
      return false;
    }
    if (mapping.tags.length === 0) return true;
    return setup.tags.some((tag) => (mapping.tags as readonly string[]).includes(tag));
  });
  return filterAndSortSetups(matched, EMPTY_FILTERS, mapping.lead).slice(0, limit);
}

/**
 * Where "See all on Browse" goes: single-tag filter + the mapping's ordering
 * (conditions stay unfiltered -- the tag carries the meaning). Returns null
 * when the mapping has no single representative tag.
 */
export function browseLinkForSymptom(
  symptomId: EngineerSymptomId,
  wet: boolean
): { tag: SetupTag; sort: SymptomSetupMapping["lead"] } | null {
  const mapping = mappingForSymptom(symptomId, wet);
  if (!mapping.linkTag) return null;
  return { tag: mapping.linkTag, sort: mapping.lead };
}
