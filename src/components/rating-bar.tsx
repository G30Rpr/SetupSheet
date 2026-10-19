import { Info } from "lucide-react";

import {
  formatRatingCount,
  formatScore,
  PACE_DEFINITION,
  PREDICTABILITY_DEFINITION,
} from "@/lib/ratings";
import { cn } from "@/lib/utils";

/**
 * Pace / Predictability meters — the only place scores are rendered.
 *
 * One format: a 0-5 score to one decimal plus its rating count. With zero
 * ratings the meters say "Unrated" instead of drawing an empty bar that
 * reads as "rated badly". The bars carry the semantic colors (Pace = amber,
 * Predictability = green); coral stays reserved for actions and cyan for
 * rig/hardware accents.
 */

export type ScoreTone = "pace" | "predictability";

const TONE_BAR: Record<ScoreTone, string> = {
  pace: "bg-pace",
  predictability: "bg-predictability",
};

export function ScoreMeter({
  label,
  tone,
  score,
  ratingCount,
  definition,
  className,
}: {
  label: string;
  tone: ScoreTone;
  /** Community average 0-5; ignored when ratingCount is 0. */
  score: number;
  ratingCount: number;
  /** Tooltip definition for the metric (also read by screen readers). */
  definition?: string;
  className?: string;
}) {
  const max = 5;
  const safeScore = Number.isFinite(score) ? Math.min(Math.max(score, 0), max) : 0;
  const pct = Math.round((safeScore / max) * 100);
  const rounded = Number(safeScore.toFixed(1));

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <span className="flex w-28 shrink-0 items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {definition ? (
          <span
            className="inline-flex cursor-help"
            title={definition}
            aria-label={definition}
            role="img"
          >
            <Info className="size-3" aria-hidden="true" />
          </span>
        ) : null}
      </span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label={`${formatScore(safeScore)} out of ${max}`}
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn("h-full rounded-full", TONE_BAR[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">
        {formatScore(safeScore)}
      </span>
      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {formatRatingCount(ratingCount)}
      </span>
    </div>
  );
}

/**
 * The paired Pace + Predictability meters shown on setup cards and the
 * detail page. Zero ratings renders a single muted "Unrated" line — no fake
 * bars, no "be the first" bait.
 */
export function ScoreMeters({
  pace,
  predictability,
  ratingCount,
  className,
}: {
  pace: number;
  predictability: number;
  ratingCount: number;
  className?: string;
}) {
  if (!(ratingCount > 0)) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <p className="text-xs text-muted-foreground">Unrated</p>
        <p className="sr-only">
          {PACE_DEFINITION} {PREDICTABILITY_DEFINITION}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <ScoreMeter
        label="Pace"
        tone="pace"
        score={pace}
        ratingCount={ratingCount}
        definition={PACE_DEFINITION}
      />
      <ScoreMeter
        label="Predictability"
        tone="predictability"
        score={predictability}
        ratingCount={ratingCount}
        definition={PREDICTABILITY_DEFINITION}
      />
    </div>
  );
}
