"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Gamepad2,
  Gauge,
  Timer,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { TagBadge } from "@/components/tag-badge";
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
  const v = setup.setupValues;

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
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border/60 px-3 py-2.5 text-xs">
                <ValueRow label="Tire pressure" front={v.frontTirePressure} rear={v.rearTirePressure} />
                <ValueRow label="Camber" front={v.frontCamber} rear={v.rearCamber} />
                <ValueRow label="Anti-roll bar" front={v.frontArb} rear={v.rearArb} />
                <ValueRow label="Ride height" front={v.frontRideHeight} rear={v.rearRideHeight} />
                <ValueRow label="Aero" front={v.frontAero} rear={v.rearAero} />
                <div className="col-span-2 flex items-center justify-between border-t border-border/60 pt-1.5">
                  <dt className="text-muted-foreground">Diff preload</dt>
                  <dd className="font-medium text-foreground">{v.diffPreload}</dd>
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <dt className="text-muted-foreground">Diff power/coast</dt>
                  <dd className="font-medium text-foreground">{v.diffPower}</dd>
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <dt className="text-muted-foreground">Brake bias</dt>
                  <dd className="font-medium text-foreground">{v.brakeBias}</dd>
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <dt className="text-muted-foreground">Final drive</dt>
                  <dd className="font-medium text-foreground">{v.finalDrive}</dd>
                </div>
              </dl>
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
          <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm font-medium text-foreground">
            <TrendingUp className="size-3.5 text-racing-green" />
            {setup.upvotes}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ValueRow({ label, front, rear }: { label: string; front: string; rear: string }) {
  return (
    <>
      <dt className="col-span-2 -mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </dt>
      <dd className="text-foreground">F: {front}</dd>
      <dd className="text-foreground">R: {rear}</dd>
    </>
  );
}
