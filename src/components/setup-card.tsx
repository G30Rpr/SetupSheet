import { Calendar, Gamepad2, Gauge, Timer, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { TagBadge } from "@/components/tag-badge";
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
          <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm font-medium text-foreground">
            <TrendingUp className="size-3.5 text-racing-green" />
            {setup.upvotes}
          </div>
        </div>
      </div>
    </Card>
  );
}
