"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Calendar,
  ChevronDown,
  FileDown,
  Gamepad2,
  Gauge,
  Pencil,
  Star,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { TagBadge } from "@/components/tag-badge";
import { deleteSetup, downloadSetup, rateSetup, toggleUpvote } from "@/lib/actions/setups";
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
  const router = useRouter();
  const [showValues, setShowValues] = useState(false);
  const [showRateWidget, setShowRateWidget] = useState(false);
  const [upvotes, setUpvotes] = useState(setup.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(setup.hasUpvoted);
  const [myRating, setMyRating] = useState(setup.myRating);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDownloading, startDownloadTransition] = useTransition();
  const [downloads, setDownloads] = useState(setup.downloads);
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

  function handleRate(field: "pace" | "predictability", value: number) {
    if (!user) {
      void signInWithDiscord();
      return;
    }

    const next = {
      pace: field === "pace" ? value : myRating?.pace ?? 0,
      predictability: field === "predictability" ? value : myRating?.predictability ?? 0,
    };
    setMyRating(next);

    startTransition(async () => {
      await rateSetup(setup.id, next.pace, next.predictability);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete your setup "${setup.car} @ ${setup.track}"? This can't be undone.`)) {
      return;
    }
    startDeleteTransition(async () => {
      await deleteSetup(setup.id);
      router.refresh();
    });
  }

  function handleDownload() {
    startDownloadTransition(async () => {
      const result = await downloadSetup(setup.id);
      if (result.error || !result.url) return;

      setDownloads((n) => n + 1);

      try {
        const response = await fetch(result.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = result.fileName ?? "setup-file";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(result.url, "_blank");
      }
    });
  }

  return (
    <Card className="group relative overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-1 hover:border-racing-green/40 hover:shadow-[0_8px_30px_-8px_oklch(0.72_0.19_149/25%)]">
      <div className="flex flex-col gap-3 p-5">
        {/* Top row: game + condition + owner controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            {setup.game}
          </div>
          <div className="flex items-center gap-2">
            {setup.isOwner && (
              <div className="flex items-center gap-1">
                <Link
                  href={`/setups/${setup.id}/edit`}
                  aria-label="Edit setup"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  aria-label="Delete setup"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-red-400 disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
            <Badge variant={conditionVariant[setup.condition]}>{setup.condition}</Badge>
          </div>
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

        {/* Setup file download */}
        {setup.fileUrl && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <FileDown className="size-3.5 shrink-0" />
              <span className="truncate">{setup.fileName ?? "Download setup file"}</span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">
              {downloads} {downloads === 1 ? "download" : "downloads"}
            </span>
          </button>
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

        {/* Pace & Predictability (community average) + upvotes */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-24 text-[11px] uppercase tracking-wide text-muted-foreground">
                Pace
              </span>
              <StarRating value={Math.round(setup.pace)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-[11px] uppercase tracking-wide text-muted-foreground">
                Predictability
              </span>
              <StarRating value={Math.round(setup.predictability)} />
            </div>
            <p className="pl-[102px] text-[11px] text-muted-foreground/70">
              {setup.ratingCount === 0
                ? "Not yet rated"
                : `${setup.ratingCount} ${setup.ratingCount === 1 ? "rating" : "ratings"}`}
            </p>
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

        {/* Rate this setup (expandable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowRateWidget((s) => !s)}
            className="flex w-full items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5" />
              {myRating ? "Update your rating" : "Rate this setup"}
            </span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", showRateWidget && "rotate-180")}
            />
          </button>

          {showRateWidget && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Pace</span>
                <StarRating
                  value={myRating?.pace ?? 0}
                  onChange={(value) => handleRate("pace", value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Predictability</span>
                <StarRating
                  value={myRating?.predictability ?? 0}
                  onChange={(value) => handleRate("predictability", value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
