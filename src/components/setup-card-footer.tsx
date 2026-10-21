"use client";

import { useEffect, useState } from "react";
import { Bookmark, Calendar, ChevronDown, Gauge, Star, TrendingUp } from "lucide-react";

import { ScoreMeters } from "@/components/rating-bar";
import { Button } from "@/components/ui/button";
import { SCORE_DEFINITIONS_SENTENCE, formatScore } from "@/lib/ratings";
import { readLastRig } from "@/lib/last-rig";
import {
  MIN_RIG_SUBSCORE_N,
  rigTypeSubScores,
  splitBySimilarRig,
  type ScoreTotals,
} from "@/lib/rating-splits";
import { StarRating } from "@/components/star-rating";
import type { Setup } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SplitScore({ sum, n }: { sum: number; n: number }) {
  return (
    <span className="whitespace-nowrap font-mono text-xs tabular-nums text-foreground">
      {n > 0 ? `${formatScore(sum / n)} (${n})` : <span className="text-muted-foreground">Unrated</span>}
    </span>
  );
}

function SplitRow({
  label,
  title,
  totals,
}: {
  label: string;
  title: string;
  totals: ScoreTotals;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3" title={title}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <SplitScore sum={totals.paceSum} n={totals.paceN} />
      <SplitScore sum={totals.predSum} n={totals.predN} />
    </div>
  );
}

/**
 * One per-rig-type sub-score cell (2c). Scores below the n-floor are
 * withheld entirely (a dash, explained on hover) -- never a shaky mean and
 * never a (1)/(2) count that could read as established evidence.
 */
function SubScoreCell({ value, n }: { value: number | null; n: number }) {
  if (value === null) {
    return (
      <span
        className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground"
        title={`Fewer than ${MIN_RIG_SUBSCORE_N} ratings from this rig type — not shown.`}
      >
        —
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap font-mono text-xs tabular-nums text-foreground">
      {formatScore(value)} ({n})
    </span>
  );
}

export function SetupCardFooter({
  setup,
  upvotes,
  hasUpvoted,
  hasFavorited,
  myRating,
  isFavoritePending,
  isPending,
  onFavorite,
  onUpvote,
  onRate,
  showRigSubScores = false,
}: {
  setup: Setup;
  upvotes: number;
  hasUpvoted: boolean;
  hasFavorited: boolean;
  myRating: Setup["myRating"];
  isFavoritePending: boolean;
  isPending: boolean;
  onFavorite: () => void;
  onUpvote: () => void;
  onRate: (field: "pace" | "predictability", value: number) => void;
  /**
   * Renders the per-rig-type sub-score breakdown (2c) under the split rows.
   * Detail only -- browse cards stay slim. Rows appear per rig type at
   * n >= MIN_RIG_SUBSCORE_N (rigTypeSubScores decides).
   */
  showRigSubScores?: boolean;
}) {
  const [showRateWidget, setShowRateWidget] = useState(false);

  // "On a similar rig" is anchored to the viewer's saved rig when they have
  // one (the site is "matched to your rig"), else to the rig the setup is
  // built for. Server HTML always renders the setup-rig anchor so hydration
  // matches; the saved-rig swap happens after mount.
  const [anchor, setAnchor] = useState<{ rig: string; isSavedRig: boolean }>({
    rig: setup.rigProfile,
    isSavedRig: false,
  });
  useEffect(() => {
    const saved = readLastRig();
    if (saved && saved !== setup.rigProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration after mount
      setAnchor({ rig: saved, isSavedRig: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydration of the viewer's saved rig
  }, []);

  const splits = setup.ratingSplits ?? [];
  const showSplit = splits.length > 0;
  const { similar, others } = splitBySimilarRig(splits, anchor.rig);
  const subScores = showRigSubScores ? rigTypeSubScores(splits) : [];

  return (
    <div className="flex flex-col gap-3 border-t border-border/80 bg-black/15 px-5 py-3">
      {/* Rig profile + upload date */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Gauge className="size-3.5" />
          <span>{setup.rigProfile}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          <span>{formatDate(setup.uploadedAt)}</span>
        </div>
      </div>

      {/* Pace & Predictability (community average) + upvotes */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Unrated setups render "Unrated" — no fabricated bars, no
              "be the first" bait. Rated ones show score + count per meter. */}
          <ScoreMeters
            pace={setup.pace}
            predictability={setup.predictability}
            ratingCount={setup.ratingCount}
          />
          {/* One sentence total defining the two scores (P3 detail touch) */}
          <p className="text-xs text-muted-foreground">{SCORE_DEFINITIONS_SENTENCE}</p>

          {/* "On a similar rig" vs "Everyone else" (P2 item 3). Aggregates
              only; a side with no ratings reads Unrated, never a zero. */}
          {showSplit && (
            <div className="mt-1 flex flex-col gap-1 border-t border-border/60 pt-2">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 text-xs">
                <span />
                <span className="text-racing-amber">Pace</span>
                <span className="text-racing-green">Predictability</span>
              </div>
              <SplitRow
                label="On a similar rig"
                title={
                  anchor.isSavedRig
                    ? `Ratings from drivers on ${anchor.rig} — your saved rig.`
                    : `Ratings from drivers on ${anchor.rig} — the rig this setup is for.`
                }
                totals={similar}
              />
              <SplitRow
                label="Everyone else"
                title="Every other rating, including ratings that didn't share a rig."
                totals={others}
              />
              {/* Per-rig-type sub-scores (2c), strongest evidence first.
                  A rig type appears only once it has 3+ ratings on a score;
                  the dash cell withholds thinner samples entirely. */}
              {subScores.length > 0 && (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    By rig type (3+ ratings)
                  </p>
                  {subScores.map((row) => (
                    <div
                      key={row.rigProfile}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3"
                      title={`Ratings from drivers on ${row.rigProfile}.`}
                    >
                      <span className="truncate text-xs text-muted-foreground">
                        {row.rigProfile}
                      </span>
                      <SubScoreCell value={row.pace} n={row.paceN} />
                      <SubScoreCell value={row.predictability} n={row.predN} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant={hasFavorited ? "secondary" : "ghost"}
            size="icon"
            onClick={onFavorite}
            disabled={isFavoritePending}
            aria-pressed={hasFavorited}
            aria-label={hasFavorited ? "Remove from saved setups" : "Save setup"}
          >
            <Bookmark className={cn("size-4", hasFavorited && "fill-current")} />
          </Button>
          <Button
            type="button"
            variant={hasUpvoted ? "secondary" : "ghost"}
            size="sm"
            onClick={onUpvote}
            disabled={isPending}
            aria-pressed={hasUpvoted}
            title={hasUpvoted ? "Remove your upvote" : "Upvote this setup"}
          >
            <TrendingUp className="size-4" aria-hidden="true" />
            {/* A bare number next to an icon read as an unlabelled counter. */}
            {upvotes > 0 ? (
              <span className="text-xs font-medium">
                <span className="font-mono tabular-nums">{upvotes}</span>{" "}
                {upvotes === 1 ? "upvote" : "upvotes"}
              </span>
            ) : (
              <span className="text-xs font-medium">Upvote</span>
            )}
            {/* Accessible name = visible label + this suffix (WCAG label-in-
                name); the count stays visible text, not a hidden label. */}
            <span className="sr-only">
              {hasUpvoted ? "\u00A0— remove your upvote" : "\u00A0— upvote this setup"}
            </span>
          </Button>
        </div>
      </div>

      {/* Rate this setup (expandable). Authors never see it: self-rating is
          blocked at the database level (0036_rating_trust.sql). */}
      {!setup.isOwner && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRateWidget((visible) => !visible)}
            aria-expanded={showRateWidget}
            className="w-full justify-between text-left"
          >
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5" />
              {myRating ? "Update your rating" : "Rate this setup"}
            </span>
            <ChevronDown
              className={cn("size-3.5 motion-safe:motion-transform", showRateWidget && "rotate-180")}
            />
          </Button>

          {showRateWidget && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Pace</span>
                <StarRating value={myRating?.pace ?? 0} onChange={(value) => onRate("pace", value)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Predictability</span>
                <StarRating
                  value={myRating?.predictability ?? 0}
                  onChange={(value) => onRate("predictability", value)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
