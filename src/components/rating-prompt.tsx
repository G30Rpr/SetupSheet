"use client";

import { useState, useTransition } from "react";
import { Clock, Star } from "lucide-react";

import { dismissRatingPrompt } from "@/lib/actions/rating-prompts";
import { rateSetup } from "@/lib/actions/setups";
import { Button } from "@/components/ui/button";
import type { RatingPrompt as RatingPromptData } from "@/lib/rating-prompts";
import { readLastRig } from "@/lib/last-rig";
import { cn } from "@/lib/utils";

const SCORES = [1, 2, 3, 4, 5] as const;

function ScoreRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1" role="group" aria-label={`${label} score`}>
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onPick(score)}
            aria-pressed={value === score}
            aria-label={`${label}: ${score} of 5`}
            className={cn(
              "size-9 rounded-md border border-border/80 text-xs font-mono tabular-nums transition-colors",
              value === score
                ? "border-primary bg-primary/15 text-foreground"
                : "text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The 24h post-download prompt: "you downloaded this -- how did it feel?"
 * Three taps to answer (pace, predictability, Share); one tap to dismiss,
 * permanently for the pair. Shows only after the download is a day old, and
 * never for the viewer's own setups (see pickPendingPrompts).
 */
export function RatingPrompt({
  prompt,
  onDismissed,
}: {
  prompt: RatingPromptData;
  /** Called after a successful dismiss so the parent can drop the card. */
  onDismissed?: () => void;
}) {
  const [pace, setPace] = useState<number | null>(null);
  const [predictability, setPredictability] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "done" | "dismissed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "dismissed") return null;

  if (status === "done") {
    return (
      <div className="rounded-lg border border-border/80 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        Thanks — your take on{" "}
        <span className="font-medium text-foreground">
          {prompt.car} @ {prompt.track}
        </span>{" "}
        is on the record.
      </div>
    );
  }

  const share = () => {
    if (pace === null || predictability === null) return;
    startTransition(async () => {
      setError(null);
      const result = await rateSetup(prompt.setupId, pace, predictability, readLastRig());
      if (result.error) {
        setError(result.error);
      } else {
        setStatus("done");
      }
    });
  };

  const dismiss = () => {
    startTransition(async () => {
      const result = await dismissRatingPrompt(prompt.setupId);
      if (result.ok) {
        setStatus("dismissed");
        onDismissed?.();
      }
      // A failed dismiss keeps the prompt visible -- quiet enough, and the
      // visitor can still just ignore it.
    });
  };

  return (
    <div
      role="group"
      aria-label={`Rate ${prompt.car} at ${prompt.track}`}
      className="flex flex-col gap-3 rounded-lg border border-border/80 bg-secondary/40 px-4 py-3"
    >
      <p className="text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          You downloaded this — once you&apos;ve driven it
        </span>
        <br />
        <span className="font-medium text-foreground">
          {prompt.car} @ {prompt.track}
        </span>{" "}
        <span className="text-muted-foreground">— how did it feel?</span>
      </p>
      <div className="flex flex-col gap-2">
        <ScoreRow label="Pace" value={pace} onPick={setPace} />
        <ScoreRow label="Predictability" value={predictability} onPick={setPredictability} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={share}
          disabled={pace === null || predictability === null || isPending}
        >
          <Star className="size-3.5" aria-hidden="true" />
          {isPending ? "Sharing…" : "Share rating"}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={isPending}>
          Not now
        </Button>
      </div>
    </div>
  );
}
