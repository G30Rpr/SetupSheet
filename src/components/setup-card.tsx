"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bookmark,
  BookOpen,
  Calendar,
  ChevronDown,
  Clipboard,
  FileDown,
  Gamepad2,
  Gauge,
  History,
  MessageSquare,
  Pencil,
  Share2,
  Star,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RatingBar } from "@/components/rating-bar";
import { StarRating } from "@/components/star-rating";
import { TagBadge } from "@/components/tag-badge";
import {
  deleteSetup,
  downloadSetup,
  rateSetup,
  recordSetupExport,
  toggleUpvote,
} from "@/lib/actions/setups";
import { toggleFavorite } from "@/lib/actions/setup-favorites";
import { buildSetupExportFilename, buildSetupExportText } from "@/lib/setup-export";
import { SITE_URL } from "@/lib/site";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { cn, getInitials } from "@/lib/utils";
import type { Setup } from "@/lib/types";

// All these panels only render once a viewer expands them -- deferring the
// code (and the per-game setupSchemas/installGuides data each one imports)
// until then keeps that data out of every SetupCard's initial bundle.
const SetupCardValues = dynamic(() => import("@/components/setup-card-values"));
const SetupCardInstallGuide = dynamic(() => import("@/components/setup-card-install-guide"));
const SetupCardHistory = dynamic(() => import("@/components/setup-card-history"));
const SetupCardComments = dynamic(() => import("@/components/setup-card-comments"));

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

export function SetupCard({
  setup,
  linkTitle = true,
  compareSelected = false,
  onToggleCompare,
}: {
  setup: Setup;
  /** False on the setup's own detail page, where linking to itself would be a no-op. */
  linkTitle?: boolean;
  /** Whether this card is one of the (up to 2) setups picked for the comparison tool. */
  compareSelected?: boolean;
  /** Presence of this prop is what turns on the compare-mode checkbox -- omit it entirely on the detail/profile call sites. */
  onToggleCompare?: () => void;
}) {
  const router = useRouter();
  const [showValues, setShowValues] = useState(false);
  const [showRateWidget, setShowRateWidget] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [upvotes, setUpvotes] = useState(setup.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(setup.hasUpvoted);
  const [hasFavorited, setHasFavorited] = useState(setup.hasFavorited);
  const [isFavoritePending, startFavoriteTransition] = useTransition();
  const [myRating, setMyRating] = useState(setup.myRating);
  const [isPending, startTransition] = useTransition();
  const [isDownloading, startDownloadTransition] = useTransition();
  const [downloads, setDownloads] = useState(setup.downloads);
  const [isDeleted, setIsDeleted] = useState(false);
  const runUndoableDelete = useUndoableDelete();
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
        toast.error(result.error);
      }
    });
  }

  function handleFavoriteClick() {
    if (!user) {
      void signInWithDiscord();
      return;
    }

    const wasFavorited = hasFavorited;
    setHasFavorited(!wasFavorited);

    startFavoriteTransition(async () => {
      const result = await toggleFavorite(setup.id, wasFavorited);
      if (result.error) {
        setHasFavorited(wasFavorited);
        toast.error(result.error);
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
      const result = await rateSetup(setup.id, next.pace, next.predictability);
      if (result.error) toast.error(result.error);
      router.refresh();
    });
  }

  function handleDelete() {
    setIsDeleted(true);
    runUndoableDelete({
      key: setup.id,
      message: `Deleted "${setup.car} @ ${setup.track}"`,
      onUndo: () => setIsDeleted(false),
      commit: async () => {
        const result = await deleteSetup(setup.id);
        if (result.error) {
          setIsDeleted(false);
          toast.error(result.error);
          return;
        }
        router.refresh();
      },
    });
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  }

  function handleDownload() {
    startDownloadTransition(async () => {
      // No uploaded file behind this setup -- export the manually-entered
      // values as a text file instead, so Download always does something.
      if (!setup.fileUrl) {
        triggerBlobDownload(
          new Blob([buildSetupExportText(setup)], { type: "text/plain" }),
          buildSetupExportFilename(setup)
        );
        setDownloads((n) => n + 1);
        await recordSetupExport(setup.id);
        return;
      }

      const result = await downloadSetup(setup.id);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Failed to download setup.");
        return;
      }

      setDownloads((n) => n + 1);

      try {
        const response = await fetch(result.url);
        const blob = await response.blob();
        triggerBlobDownload(blob, result.fileName ?? "setup-file");
      } catch {
        window.open(result.url, "_blank");
      }
    });
  }

  async function handleCopyValues() {
    try {
      await navigator.clipboard.writeText(buildSetupExportText(setup));
      toast.success("Setup values copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  async function handleShare() {
    const url = `${SITE_URL}/setups/${setup.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${setup.car} @ ${setup.track}`, url });
      } catch {
        // User cancelled the native share sheet -- not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  if (isDeleted) return null;

  return (
    <Card className="group relative overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-1 hover:border-racing-coral/40 hover:shadow-[0_8px_30px_-8px_oklch(0.62_0.19_25/25%)]">
      <div className="flex flex-col gap-3 p-5">
        {/* Top row: game + condition + owner controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            {setup.game}
          </div>
          <div className="flex items-center gap-2">
            {onToggleCompare && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={compareSelected}
                  onCheckedChange={() => onToggleCompare()}
                  aria-label={compareSelected ? "Remove from comparison" : "Select for comparison"}
                />
                Compare
              </label>
            )}
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
                  aria-label="Delete setup"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-red-400 disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share setup"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Share2 className="size-3.5" />
            </button>
            <Badge variant={conditionVariant[setup.condition]}>{setup.condition}</Badge>
          </div>
        </div>

        {/* Author byline */}
        <Link
          href={`/profile/${setup.authorId}`}
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Avatar className="size-5">
            <AvatarImage src={setup.authorAvatarUrl ?? undefined} alt={setup.author} />
            <AvatarFallback className="bg-racing-coral/15 text-[9px] text-racing-coral">
              {getInitials(setup.author)}
            </AvatarFallback>
          </Avatar>
          {setup.author}
        </Link>

        {/* Car + Track */}
        <div>
          <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            {linkTitle ? (
              <Link href={`/setups/${setup.id}`} className="transition-colors hover:text-racing-coral">
                {setup.car}
              </Link>
            ) : (
              setup.car
            )}
          </h3>
          <p className="text-sm text-muted-foreground">{setup.track}</p>
        </div>

        {/* Lap time */}
        <div className="flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2.5">
          <Timer className="size-5 shrink-0 text-racing-cyan" />
          <span className="font-mono text-2xl font-bold tabular-nums text-racing-cyan">
            {setup.lapTime}
          </span>
          <span className="text-xs text-muted-foreground">lap time</span>
          {setup.fileUrl && (
            <Badge variant="green" className="ml-auto shrink-0">
              <BadgeCheck className="size-3" />
              Verified
            </Badge>
          )}
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

            {showValues && <SetupCardValues setup={setup} />}
          </div>
        )}

        {/* Download: the original uploaded file if there is one, otherwise
            a generated text export of the manually-entered values */}
        {(setup.fileUrl || setup.setupValues) && (
          <div className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              title={setup.fileName ?? undefined}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md bg-racing-coral/10 px-3 py-2.5 text-sm font-semibold text-racing-coral ring-1 ring-inset ring-racing-coral/30 transition-colors hover:bg-racing-coral/15 disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileDown className="size-4 shrink-0" />
                <span className="truncate">
                  {isDownloading ? "Preparing download..." : "Download Setup"}
                </span>
              </span>
              <span className="shrink-0 text-xs font-normal text-racing-coral/70">
                <span className="font-mono tabular-nums">{downloads}</span>{" "}
                {downloads === 1 ? "download" : "downloads"}
              </span>
            </button>
            {setup.setupValues && (
              <button
                type="button"
                onClick={handleCopyValues}
                aria-label="Copy setup values to clipboard"
                title="Copy setup values"
                className="flex shrink-0 items-center justify-center rounded-md bg-racing-coral/10 px-3 text-racing-coral ring-1 ring-inset ring-racing-coral/30 transition-colors hover:bg-racing-coral/15"
              >
                <Clipboard className="size-4" />
              </button>
            )}
          </div>
        )}

        {/* How to install (expandable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowInstallGuide((s) => !s)}
            className="flex w-full items-center justify-between rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              How to install this setup
            </span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", showInstallGuide && "rotate-180")}
            />
          </button>

          {showInstallGuide && <SetupCardInstallGuide setup={setup} />}
        </div>

        {/* Version history (expandable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="flex w-full items-center justify-between rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <History className="size-3.5" />
              Version history
            </span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", showHistory && "rotate-180")}
            />
          </button>

          {showHistory && <SetupCardHistory setup={setup} />}
        </div>

        {/* Comments (expandable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowComments((s) => !s)}
            className="flex w-full items-center justify-between rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Comments
            </span>
            <ChevronDown
              className={cn("size-3.5 transition-transform", showComments && "rotate-180")}
            />
          </button>

          {showComments && <SetupCardComments setup={setup} />}
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

        {/* Pace & Predictability (community average) + upvotes */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex w-full items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                Pace
              </span>
              <RatingBar value={setup.pace} color="coral" className="max-w-[150px]" />
            </div>
            <div className="flex w-full items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                Predictability
              </span>
              <RatingBar value={setup.predictability} color="cyan" className="max-w-[150px]" />
            </div>
            <p className="pl-[102px] text-[11px] text-muted-foreground/70">
              {setup.ratingCount === 0
                ? "Not yet rated"
                : `${setup.ratingCount} ${setup.ratingCount === 1 ? "rating" : "ratings"}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleFavoriteClick}
              disabled={isFavoritePending}
              aria-pressed={hasFavorited}
              aria-label={hasFavorited ? "Remove from saved setups" : "Save setup"}
              className={cn(
                "flex items-center rounded-full p-1.5 transition-colors disabled:opacity-60",
                hasFavorited
                  ? "bg-racing-cyan/15 text-racing-cyan ring-1 ring-inset ring-racing-cyan/40"
                  : "bg-secondary text-foreground hover:bg-racing-cyan/10 hover:text-racing-cyan"
              )}
            >
              <Bookmark className={cn("size-3.5", hasFavorited && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={handleUpvoteClick}
              disabled={isPending}
              aria-pressed={hasUpvoted}
              aria-label={hasUpvoted ? "Remove upvote" : "Upvote"}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-60",
                hasUpvoted
                  ? "bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/40"
                  : "bg-secondary text-foreground hover:bg-racing-coral/10 hover:text-racing-coral"
              )}
            >
              <TrendingUp className="size-3.5" />
              <span className="font-mono tabular-nums">{upvotes}</span>
            </button>
          </div>
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
