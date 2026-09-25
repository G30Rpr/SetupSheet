"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CloudRain, Info, ShieldCheck, Sun, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEngineerRecommendations } from "@/lib/engineer";
import {
  ENGINEER_GAMES,
  ENGINEER_SEVERITIES,
  ENGINEER_SYMPTOMS,
  type EngineerCondition,
  type EngineerDirection,
  type EngineerGame,
  type EngineerSeverity,
  type EngineerSymptomId,
} from "@/lib/engineer-types";

const directionLabels: Record<EngineerDirection, string> = {
  increase: "Increase",
  decrease: "Decrease",
  soften: "Soften",
  stiffen: "Stiffen",
};

const severityLabels: Record<EngineerSeverity, string> = {
  slight: "Slight",
  moderate: "Moderate",
  severe: "Severe",
};

function formatAmount(amount: number | string, unit?: string): string {
  if (!unit) return String(amount);
  const renderedUnit = unit.replace("(s)", typeof amount === "number" && amount === 1 ? "" : "s");
  return `${amount} ${renderedUnit}`;
}

function DirectionIcon({ direction }: { direction: EngineerDirection }) {
  return direction === "increase" || direction === "stiffen" ? (
    <ArrowUp aria-hidden="true" className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden="true" className="size-3.5" />
  );
}

export function EngineerClient() {
  const [game, setGame] = useState<EngineerGame>(ENGINEER_GAMES[0]);
  const [symptomId, setSymptomId] = useState<EngineerSymptomId>(ENGINEER_SYMPTOMS[0].id);
  const [severity, setSeverity] = useState<EngineerSeverity>("moderate");
  const [condition, setCondition] = useState<EngineerCondition>("dry");

  const result = useMemo(
    () => getEngineerRecommendations({ game, symptomId, severity, condition }),
    [condition, game, severity, symptomId]
  );
  const selectedSymptom = ENGINEER_SYMPTOMS.find((symptom) => symptom.id === symptomId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-col gap-5 border-b border-border/80 pb-8 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <Badge variant="blue" className="mb-4 gap-1.5">
            <ShieldCheck aria-hidden="true" />
            Static Engineer · No account required
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find a calmer next setup change</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Describe what the car is doing and get a short, ranked test plan for ACC or Le Mans Ultimate.
            Advice is available immediately from a local knowledge base; it does not depend on live data.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-racing-green/25 bg-racing-green/5 px-3 py-2 text-xs text-racing-green">
          <span className="size-2 rounded-full bg-racing-green" aria-hidden="true" />
          Static recommendations ready
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <section aria-labelledby="engineer-input-heading" className="rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-racing-cyan">01 / Describe</p>
            <h2 id="engineer-input-heading" className="mt-2 text-xl font-semibold">What are you feeling?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start with one repeatable symptom.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="engineer-game">Game</Label>
              <Select value={game} onValueChange={(value) => setGame(value as EngineerGame)}>
                <SelectTrigger id="engineer-game" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINEER_GAMES.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="engineer-symptom">Symptom</Label>
              <Select value={symptomId} onValueChange={(value) => setSymptomId(value as EngineerSymptomId)}>
                <SelectTrigger id="engineer-symptom" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINEER_SYMPTOMS.map((symptom) => (
                    <SelectItem key={symptom.id} value={symptom.id}>
                      {symptom.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSymptom && <p className="text-xs leading-5 text-muted-foreground">{selectedSymptom.description}</p>}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Severity</legend>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Symptom severity">
                {ENGINEER_SEVERITIES.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={severity === option ? "default" : "outline"}
                    aria-pressed={severity === option}
                    onClick={() => setSeverity(option)}
                    className="w-full capitalize"
                  >
                    {severityLabels[option]}
                  </Button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Track condition</legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Track condition">
                <Button
                  type="button"
                  size="sm"
                  variant={condition === "dry" ? "secondary" : "outline"}
                  aria-pressed={condition === "dry"}
                  onClick={() => setCondition("dry")}
                  className="w-full"
                >
                  <Sun aria-hidden="true" />
                  Dry
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={condition === "wet" ? "secondary" : "outline"}
                  aria-pressed={condition === "wet"}
                  onClick={() => setCondition("wet")}
                  className="w-full"
                >
                  <CloudRain aria-hidden="true" />
                  Wet
                </Button>
              </div>
            </fieldset>
          </div>

          <div className="mt-7 flex gap-3 rounded-lg border border-border/80 bg-secondary/35 p-3.5 text-xs leading-5 text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-racing-cyan" />
            <p>Make one change at a time, repeat the same test, and revert if the car gets worse. Suggested amounts are small starting points, not universal targets.</p>
          </div>
        </section>

        <section aria-labelledby="engineer-results-heading" aria-live="polite" className="rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-racing-coral">02 / Test plan</p>
              <h2 id="engineer-results-heading" className="mt-2 text-xl font-semibold">Recommended changes</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ranked starting points for {game}.</p>
            </div>
            <Badge variant={condition === "wet" ? "blue" : "outline"} className="gap-1.5">
              {condition === "wet" ? <CloudRain aria-hidden="true" /> : <Sun aria-hidden="true" />}
              {condition === "wet" ? "Wet rules applied" : "Dry baseline"}
            </Badge>
          </div>

          {result.notices.map((notice) => (
            <div key={notice} role="status" className="mb-4 rounded-lg border border-racing-amber/30 bg-racing-amber/5 px-3.5 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-racing-amber">Note: </span>{notice}
            </div>
          ))}

          {result.conflicts.length > 0 && (
            <div role="alert" className="mb-4 rounded-lg border border-racing-red/30 bg-racing-red/5 p-3.5">
              <div className="flex gap-2 text-sm font-medium text-racing-red">
                <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                Conflicting directions found
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-muted-foreground">
                {result.conflicts.map((conflict) => <li key={conflict.parameter}>{conflict.message}</li>)}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 ? (
            <ol className="space-y-3" aria-label="Ranked setup changes">
              {result.recommendations.map((recommendation, index) => {
                const isPrimary = index === 0;
                const directionTone = recommendation.direction === "increase" || recommendation.direction === "stiffen"
                  ? "text-racing-green"
                  : "text-racing-cyan";

                return (
                  <li key={`${recommendation.parameter}-${recommendation.direction}`} className="rounded-lg border border-border/80 bg-background/45 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${isPrimary ? "bg-racing-coral/15 text-racing-coral" : "bg-secondary text-muted-foreground"}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          {isPrimary && <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-racing-coral">First test</p>}
                          <h3 className="font-semibold">{recommendation.parameter}</h3>
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 gap-1.5 ${directionTone}`}>
                        <DirectionIcon direction={recommendation.direction} />
                        {directionLabels[recommendation.direction]}
                      </Badge>
                    </div>

                    <p className="mt-4 font-mono text-sm">
                      <span className="text-muted-foreground">Suggested change: </span>
                      <strong className="text-foreground">{formatAmount(recommendation.amount, recommendation.unit)}</strong>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.explanation}</p>
                    {recommendation.warnings && recommendation.warnings.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-border/70 pt-3">
                        {recommendation.warnings.map((warning) => (
                          <li key={warning} className="flex gap-2 text-xs leading-5 text-racing-amber">
                            <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="font-medium">No safe static change is available yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Pressure advice is only shown for reviewed game mappings.</p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 border-t border-border/80 pt-4 text-xs leading-5 text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <p>These are static first-pass recommendations, not a replacement for your car&apos;s setup guide or a controlled test. Live field-test evidence is not connected yet.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
