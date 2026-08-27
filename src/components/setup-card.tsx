"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Activity,
  BadgeCheck,
  Bookmark,
  BookOpen,
  Calendar,
  ChevronDown,
  Clipboard,
  ExternalLink,
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
  Video,
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
import {
  buildSetupExportFilename,
  buildSetupExportText,
  getAvailableExportFormats,
} from "@/lib/setup-export";
import { SITE_URL } from "@/lib/site";
import { normalizeVideoUrl } from "@/lib/video-url";
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

function parseVideoEmbed(urlStr?: string | null) {
  const safeUrl = normalizeVideoUrl(urlStr);
  if (!safeUrl) return null;

  try {
    const url = new URL(safeUrl);
    const isYouTube = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(
      url.hostname.toLowerCase()
    );
    if (!isYouTube) return null;

    let id = "";
    if (url.hostname.toLowerCase().includes("youtu.be")) {
      id = url.pathname.slice(1).split("/")[0];
    } else if (url.pathname.startsWith("/embed/")) {
      id = url.pathname.slice("/embed/".length).split("/")[0];
    } else if (url.pathname.startsWith("/shorts/")) {
      id = url.pathname.slice("/shorts/".length).split("/")[0];
    } else {
      id = url.searchParams.get("v") ?? "";
    }

    // Keep the value embedded in the trusted YouTube origin strictly within
    // YouTube's id alphabet; malformed/hostile links remain ordinary safe
    // external links instead of becoming an iframe URL.
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return null;
    return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
  } catch {
    return null;
  }
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
  const [showVideo, setShowVideo] = useState(false);
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
  // Defense in depth for rows created before URL validation was added (or
  // inserted directly through PostgREST): never render an untrusted value as
  // an href, even if it bypassed the Server Action.
  const safeVideoUrl = normalizeVideoUrl(setup.videoUrl);

  function handleUpvoteClick() {
    if (!user) {
      void signInWithDiscord();
      return;
    }

    const wasUpvoted = hasUpvoted;
    setHasUpvoted(!wasUpvoted);
    setUpvotes((n) => n + (wasUpvoted ? -1 : 1));

    startTransition(async () => {
      try {
        const result = await toggleUpvote(setup.id, wasUpvoted);
        if (result.error) {
          setHasUpvoted(wasUpvoted);
          setUpvotes((n) => n + (wasUpvoted ? 1 : -1));
          toast.error(result.error);
        }
      } catch {
        setHasUpvoted(wasUpvoted);
        setUpvotes((n) => n + (wasUpvoted ? 1 : -1));
        toast.error("Couldn't update the upvote right now.");
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
      try {
        const result = await toggleFavorite(setup.id, wasFavorited);
        if (result.error) {
          setHasFavorited(wasFavorited);
          toast.error(result.error);
        }
      } catch {
        setHasFavorited(wasFavorited);
        toast.error("Couldn't update saved status right now.");
      }
    });
  }

  function handleRate(field: "pace" | "predictability", value: number) {
    if (!user) {
      void signInWithDiscord();
      return;
    }

    const next = {
      // Ratings are stored as one row with both dimensions required. When a
      // viewer is rating for the first time, use the neutral 3-star value
      // for the dimension they have not clicked yet instead of sending 0
      // and guaranteeing a database constraint error.
      pace: field === "pace" ? value : myRating?.pace ?? 3,
      predictability: field === "predictability" ? value : myRating?.predictability ?? 3,
    };
    setMyRating(next);

    startTransition(async () => {
      try {
        const result = await rateSetup(setup.id, next.pace, next.predictability);
        if (result.error) {
          setMyRating(setup.myRating);
          toast.error(result.error);
        }
        router.refresh();
      } catch {
        setMyRating(setup.myRating);
        toast.error("Couldn't save your rating right now.");
      }
    });
  }

  function handleDelete() {
    setIsDeleted(true);
    runUndoableDelete({
      key: setup.id,
      message: `Deleted "${setup.car} @ ${setup.track}"`,
      onUndo: () => setIsDeleted(false),
      commit: async () => {
        try {
          const result = await deleteSetup(setup.id);
          if (result.error) {
            setIsDeleted(false);
            toast.error(result.error);
            return;
          }
          router.refresh();
        } catch {
          setIsDeleted(false);
          toast.error("Couldn't delete this setup right now.");
        }
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
      try {
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
          if (!response.ok) throw new Error("Download failed");
          const blob = await response.blob();
          triggerBlobDownload(blob, result.fileName ?? "setup-file");
        } catch {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
      } catch {
        toast.error("Couldn't prepare this download right now.");
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
    <Card as="article" className="group relative overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-1 hover:border-racing-coral/40 hover:shadow-[0_8px_30px_-8px_oklch(0.62_0.19_25/25%)]">
      <div className="flex flex-col gap-3 p-5">
        {/* Top row: game + condition + owner controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            {setup.game}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {setup.isVerifiedLap && (
              <Badge variant="green" className="gap-1 font-semibold">
                <BadgeCheck className="size-3.5 text-racing-green" />
                Verified Lap
              </Badge>
            )}
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
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Delete setup"
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-racing-red disabled:opacity-60"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share setup"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

        {/* Hotlap Video Proof */}
        {safeVideoUrl && (
          <div>
            <button
              type="button"
              onClick={() => setShowVideo((s) => !s)}
              className="flex w-full items-center justify-between rounded-md border border-racing-green/30 bg-racing-green/10 px-3 py-2 text-xs font-medium text-racing-green transition-colors hover:bg-racing-green/15"
            >
              <span className="flex items-center gap-1.5">
                <Video className="size-3.5" />
                Watch Hotlap Proof Video
              </span>
              <ChevronDown
                className={cn("size-3.5 transition-transform", showVideo && "rotate-180")}
              />
            </button>

            {showVideo && (
              <div className="mt-2.5 overflow-hidden rounded-lg border border-border bg-black/40 p-1">
                {parseVideoEmbed(safeVideoUrl)?.src ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-md">
                    <iframe
                      src={parseVideoEmbed(safeVideoUrl)?.src ?? ""}
                      title={`Hotlap proof for ${setup.car} @ ${setup.track}`}
                      className="absolute inset-0 size-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 text-xs">
                    <span className="text-muted-foreground truncate">{safeVideoUrl}</span>
                    <a
                      href={safeVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-racing-coral hover:underline shrink-0"
                    >
                      Open Video <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Telemetry File Attachment */}
        {setup.telemetryFileUrl && (
          <div className="flex items-center justify-between rounded-md border border-racing-cyan/30 bg-racing-cyan/10 px-3 py-2 text-xs text-racing-cyan">
            <span className="flex items-center gap-1.5 min-w-0 font-medium">
              <Activity className="size-3.5 shrink-0" />
              <span className="truncate">Telemetry: {setup.telemetryFileName ?? "telemetry.ld"}</span>
            </span>
            <a
              href={setup.telemetryFileUrl}
              download={setup.telemetryFileName ?? "telemetry-data"}
              className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline"
            >
              Download Telemetry <FileDown className="size-3" />
            </a>
          </div>
        )}

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

        {/* Export formats for setups with values */}
        {setup.setupValues && Object.keys(setup.setupValues).length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Export format:
            </span>
            {getAvailableExportFormats(setup).map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => {
                  const content = fmt.generate(setup);
                  triggerBlobDownload(
                    new Blob([content], { type: fmt.mime }),
                    buildSetupExportFilename(setup, fmt.ext)
                  );
                  toast.success(`Exported as ${fmt.ext}`);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-racing-coral/40 hover:text-foreground"
              >
                <FileDown className="size-3 text-racing-coral" />
                {fmt.label}
              </button>
            ))}
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
                "flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-60",
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
