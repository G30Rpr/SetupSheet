"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  ChevronDown,
  Gamepad2,
  Gauge,
  Timer,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { TagBadge } from "@/components/tag-badge";
import { toggleUpvote } from "@/lib/actions/setups";
import { setupSchemas } from "@/lib/setup-schemas";
import { cn } from "@/lib/utils";
import type { Setup } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const conditionVariant = {
  Dry: "secondary",
  Wet: "blue",
  Mixed: "amber",
} as const;

export function SetupCard({ setup }: { setup: Setup }) {
  const [showValues, setShowValues] = useState(false);
  const [upvotes, setUpvotes] = useState(setup.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(setup.hasUpvoted);
  const [isPending, startTransition] = useTransition();
  const { user, signInWithDiscord } = useAuth();
  const v = setup.setupValues;

  function handleUpvoteClick() {
    if (!user) {
      void signInWithDiscord();
      return;
    }

    const wasUpvoted = hasUpvoted;
    setHasUpvoted(!wasUpvoted);
    setUpvotes((n) => n + (wasUpvoted ? -1 : 1));

    startTransition(async () => {
      const result = await toggleUpvote(setup.id, wasUpvoted);
      if (result.error) {
        setHasUpvoted(wasUpvoted);
        setUpvotes((n) => n + (wasUpvoted ? 1 : -1));
      }
    });
  }

  return (
    <Card className="group relative overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-1 hover:border-racing-green/40 hover:shadow-[0_8px_30px_-8px_oklch(0.72_0.19_149/25%)]">
      <div className="flex flex-col gap-3 p-5">
        {/* Top row: game + condition */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            {setup.game}
          </div>
          <Badge variant={conditionVariant[setup.condition]}>{setup.condition}</Badge>
        </div>

        {/* Car + Track */}
        <div>
          <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            {setup.car}
          </h3>
          <p className="text-sm text-muted-foreground">{setup.track}</p>
        </div>

        {/* Lap time */}
        <div className="flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2">
          <Timer className="size-4 text-racing-green" />
          <span className="font-mono text-base font-semibold tabular-nums text-racing-green">
            {setup.lapTime}
          </span>
          <span className="text-xs text-muted-foreground">lap time</span>
        </div>

        {/* Description snippet */}
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {setup.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {setup.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        {/* Setup values (expandable) */}
        {v && (
          <div>
            <button
              type="button"
              onClick={() => setShowValues((s) => !s)}
              className="flex w-full items-center justify-between rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Setup values
              <ChevronDown
                className={cn("size-3.5 transition-transform", showValues && "rotate-180")}
              />
            </button>

            {showValues && (
              <div className="mt-2 flex flex-col gap-3 rounded-md border border-border/60 px-3 py-2.5 text-xs">
                {setupSchemas[setup.game].map((group) => {
                  const rows = group.fields.filter((field) => v[field.key]);
                  if (rows.length === 0) return null;
                  return (
                    <div key={group.title} className="flex flex-col gap-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {group.title}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {rows.map((field) => (
                          <div key={field.key} className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                            <dt className="text-muted-foreground">{field.label}</dt>
                            <dd className="font-medium text-foreground">{v[field.key]}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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

        {/* Pace & Predictability + upvotes */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-24 text-[11px] uppercase tracking-wide text-muted-foreground">
                Pace
              </span>
              <StarRating value={setup.pace} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-[11px] uppercase tracking-wide text-muted-foreground">
                Predictability
              </span>
              <StarRating value={setup.predictability} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleUpvoteClick}
            disabled={isPending}
            aria-pressed={hasUpvoted}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-60",
              hasUpvoted
                ? "bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/40"
                : "bg-secondary text-foreground hover:bg-racing-green/10 hover:text-racing-green"
            )}
          >
            <TrendingUp className="size-3.5" />
            {upvotes}
          </button>
        </div>
      </div>
    </Card>
  );
}
