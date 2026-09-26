"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CarFront,
  ClipboardList,
  Clock3,
  Plus,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SetupValuesFields } from "@/components/setup-values-fields";
import {
  createGarageLap,
  createGarageRevision,
  createGarageRunPlanItem,
  createGarageSession,
  deleteGarageSession,
} from "@/lib/actions/garage";
import { FieldTestReportForm } from "@/components/garage/field-test-report-form";
import {
  GARAGE_VERDICTS,
  MAX_GARAGE_AMOUNT_LENGTH,
  MAX_GARAGE_LAP_TIME_INPUT_LENGTH,
  MAX_GARAGE_NOTE_LENGTH,
  MAX_GARAGE_PARAMETER_LENGTH,
  type GarageDirection,
  type GarageLap,
  type GarageRevision,
  type GarageRunPlanItem,
  type GarageSetupSource,
  type GarageSession,
  type GarageSessionDetail,
  type GarageVerdict,
} from "@/lib/garage";
import { MAX_CAR_LENGTH, MAX_TRACK_LENGTH, conditions, rigProfiles } from "@/lib/data";
import { ENGINEER_GAMES, type EngineerGame } from "@/lib/engineer-types";
import { getEmptySetupValues } from "@/lib/setup-schemas";
import type { Condition, RigProfile, SetupValues } from "@/lib/types";

const DEFAULT_GAME = ENGINEER_GAMES[0];
const DIRECTION_LABELS: Record<GarageDirection, string> = {
  increase: "Increase",
  decrease: "Decrease",
  soften: "Soften",
  stiffen: "Stiffen",
};

function formatDate(value: string, withTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function formatLapTime(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  const millis = milliseconds % 1_000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function revisionLabel(revisions: GarageRevision[], revisionId: string): string {
  const index = revisions.findIndex((revision) => revision.id === revisionId);
  if (index === 0) return "Baseline";
  if (index > 0) return `Revision ${index + 1}`;
  return "Revision";
}

function ErrorMessage({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-racing-red/30 bg-racing-red/10 px-3 py-2.5 text-sm text-racing-red"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function GarageDashboard({
  sessions,
  detail,
  listError,
  detailError,
  sourceSetup = null,
  sourceSetupError = null,
}: {
  sessions: GarageSession[];
  detail: GarageSessionDetail | null;
  listError: boolean;
  detailError: boolean;
  sourceSetup?: GarageSetupSource | null;
  sourceSetupError?: string | null;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Garage</h1>
            <Badge variant="blue">Private</Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Keep setup snapshots, one-change tests, and lap notes together for each car and track.
            Only you can see these records.
          </p>
        </div>
        <Link
          href="/engineer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-racing-cyan transition-colors hover:text-foreground"
        >
          <Wrench className="size-4" aria-hidden="true" />
          Open Setup Engineer
        </Link>
      </header>

      {sourceSetupError && <div className="mb-6 max-w-2xl"><ErrorMessage>{sourceSetupError}</ErrorMessage></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-4">
          <NewGarageSessionForm
            key={sourceSetup?.id ?? "new-session-form"}
            startOpen={Boolean(sourceSetup) || sessions.length === 0}
            sourceSetup={sourceSetup}
          />

          <Card className="gap-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Your sessions</h2>
              <Badge variant="secondary">{sessions.length}</Badge>
            </div>
            {listError ? (
              <p className="text-sm text-muted-foreground">Sessions couldn&apos;t be loaded. Try refreshing.</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your saved sessions will appear here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => {
                  const selected = detail?.session.id === session.id;
                  return (
                    <li key={session.id}>
                      <Link
                        href={`/garage?session=${encodeURIComponent(session.id)}`}
                        scroll={false}
                        aria-current={selected ? "page" : undefined}
                        className={`flex flex-col gap-1 rounded-lg border px-3 py-3 transition-colors ${
                          selected
                            ? "border-racing-coral/50 bg-racing-coral/10"
                            : "border-border/70 bg-secondary/20 hover:bg-secondary/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <CarFront className="size-4 shrink-0 text-racing-coral" aria-hidden="true" />
                          <span className="truncate">{session.car}</span>
                        </span>
                        <span className="truncate pl-6 text-xs text-muted-foreground">
                          {session.track} · {session.game === "Assetto Corsa Competizione" ? "ACC" : "LMU"}
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">
                          Started {formatDate(session.createdAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </aside>

        <main className="min-w-0">
          {detailError ? (
            <Card className="items-center gap-3 px-6 py-12 text-center">
              <AlertCircle className="size-8 text-racing-amber" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Session details unavailable</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                The session may have been deleted, or its private records could not be loaded. Refresh and try again.
              </p>
            </Card>
          ) : detail ? (
            <GarageSessionWorkspace
              key={`${detail.session.id}:${detail.revisions.at(-1)?.id ?? "no-revision"}`}
              detail={detail}
            />
          ) : (
            <Card className="items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-racing-cyan/10 text-racing-cyan ring-1 ring-inset ring-racing-cyan/25">
                <CarFront className="size-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  {listError
                    ? "Your Garage didn’t load"
                    : sessions.length
                      ? "Choose a session"
                      : "Start your first session"}
                </h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {listError
                    ? "Refresh to retry loading your saved sessions. You can also create a new private session."
                    : sessions.length
                      ? "Select one of your sessions to see its revisions, test plan, and laps."
                      : "Create a private session to save a baseline, record setup changes, and log laps."}
                </p>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function NewGarageSessionForm({
  startOpen,
  sourceSetup,
}: {
  startOpen: boolean;
  sourceSetup: GarageSetupSource | null;
}) {
  const router = useRouter();
  const initialGame = sourceSetup?.game ?? DEFAULT_GAME;
  const [game, setGame] = useState<EngineerGame>(initialGame);
  const [condition, setCondition] = useState<Condition>(sourceSetup?.condition ?? "Dry");
  const [rig, setRig] = useState<RigProfile | "none">("none");
  const [setupValues, setSetupValues] = useState<SetupValues>(() => getEmptySetupValues(initialGame));
  const [copySourceSetupValues, setCopySourceSetupValues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(startOpen);

  function handleGameChange(value: string) {
    if (!ENGINEER_GAMES.includes(value as EngineerGame)) return;
    const nextGame = value as EngineerGame;
    setGame(nextGame);
    setSetupValues(getEmptySetupValues(nextGame));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const car = String(formData.get("car") ?? "");
    const track = String(formData.get("track") ?? "");
    const baselineNote = String(formData.get("baselineNote") ?? "");
    const rigValue = rig === "none" ? null : rig;
    const sessionInput = sourceSetup
      ? {
          sourceSetupId: sourceSetup.id,
          copySourceSetupValues,
          rig: rigValue,
          setupValues,
          baselineNote,
        }
      : {
          game,
          car,
          track,
          condition,
          rig: rigValue,
          setupValues,
          baselineNote,
        };

    startTransition(async () => {
      try {
        const result = await createGarageSession(sessionInput);
        if (result.error || !result.sessionId) {
          setError(result.error ?? "Couldn't create the Garage session.");
          return;
        }
        toast.success("Garage session created with a baseline snapshot");
        router.push(`/garage?session=${encodeURIComponent(result.sessionId)}`);
      } catch {
        setError("Couldn't create the Garage session. Please try again.");
      }
    });
  }

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="rounded-xl border border-border/80 bg-card shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="size-4 text-racing-coral" aria-hidden="true" />
          New session
        </span>
        <span className="text-xs text-muted-foreground">ACC · LMU</span>
      </summary>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-border/70 px-4 py-4">
        {sourceSetup ? (
          <div className="rounded-lg border border-racing-cyan/25 bg-racing-cyan/5 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-racing-cyan">Starting from public setup</p>
            <p className="mt-1 font-medium">{sourceSetup.car} <span className="text-muted-foreground">@ {sourceSetup.track}</span></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sourceSetup.game} · {sourceSetup.condition}</p>
            <Link
              href={`/setups/${encodeURIComponent(sourceSetup.id)}`}
              className="mt-2 inline-flex text-xs font-medium text-racing-cyan hover:text-foreground"
            >
              View source setup
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="garage-new-game">Game</Label>
              <Select value={game} onValueChange={handleGameChange}>
                <SelectTrigger id="garage-new-game" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINEER_GAMES.map((supportedGame) => (
                    <SelectItem key={supportedGame} value={supportedGame}>{supportedGame}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-new-car">Car</Label>
                <Input id="garage-new-car" name="car" maxLength={MAX_CAR_LENGTH} placeholder="e.g. BMW M4 GT3" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-new-track">Track</Label>
                <Input id="garage-new-track" name="track" maxLength={MAX_TRACK_LENGTH} placeholder="e.g. Monza" required />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="garage-new-condition">Track condition</Label>
              <Select value={condition} onValueChange={(value) => setCondition(value as Condition)}>
                <SelectTrigger id="garage-new-condition" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="garage-new-rig">Your rig profile (optional)</Label>
          <Select value={rig} onValueChange={(value) => setRig(value as RigProfile | "none")}>
            <SelectTrigger id="garage-new-rig" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {rigProfiles.map((profile) => <SelectItem key={profile} value={profile}>{profile}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {sourceSetup && sourceSetup.setupValueCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-3">
            <Checkbox
              id="garage-copy-source-values"
              checked={copySourceSetupValues}
              onCheckedChange={(checked) => setCopySourceSetupValues(checked === true)}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="garage-copy-source-values" className="cursor-pointer text-sm font-medium">
                Copy {sourceSetup.setupValueCount} saved setup {sourceSetup.setupValueCount === 1 ? "value" : "values"}
              </Label>
              <p className="text-xs text-muted-foreground">
                This is optional and starts unchecked. If selected, the server copies those public values into your private baseline.
              </p>
            </div>
          </div>
        )}

        {sourceSetup && sourceSetup.setupValueCount === 0 && (
          <p className="text-xs text-muted-foreground">
            This setup has no structured values to import. You can still enter baseline values manually.
          </p>
        )}

        {sourceSetup && copySourceSetupValues ? (
          <div className="rounded-lg border border-racing-cyan/25 bg-racing-cyan/5 px-3 py-2.5 text-xs text-muted-foreground">
            The baseline will use the saved values exactly as published. You can add a revision to test changes after creating the session.
          </div>
        ) : (
          <details className="rounded-lg border border-border/70 bg-secondary/15">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">
              {sourceSetup ? "Enter baseline setup values manually (optional)" : "Add baseline setup values (optional)"}
            </summary>
            <div className="border-t border-border/70 p-3">
              <SetupValuesFields
                game={game}
                values={setupValues}
                idPrefix="garage-new"
                onChange={(key, value) => setSetupValues((current) => ({ ...current, [key]: value }))}
              />
            </div>
          </details>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="garage-new-note">Baseline note (optional)</Label>
          <Textarea
            id="garage-new-note"
            name="baselineNote"
            rows={2}
            maxLength={MAX_GARAGE_NOTE_LENGTH}
            placeholder="Tyres, fuel, conditions, or anything you want to remember."
          />
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={isPending} className="w-full">
          <Plus aria-hidden="true" />
          {isPending ? "Creating session…" : "Create session"}
        </Button>
      </form>
    </details>
  );
}

function GarageSessionWorkspace({ detail }: { detail: GarageSessionDetail }) {
  const router = useRouter();
  const { session, revisions, runPlanItems, laps } = detail;
  const latestRevision = revisions.at(-1) ?? null;
  const [revisionValues, setRevisionValues] = useState<SetupValues>(
    () => latestRevision?.setupValues ?? getEmptySetupValues(session.game)
  );
  const [revisionNote, setRevisionNote] = useState("");
  const [planRevisionId, setPlanRevisionId] = useState(latestRevision?.id ?? "");
  const [lapRevisionId, setLapRevisionId] = useState(latestRevision?.id ?? "");
  const [direction, setDirection] = useState<GarageDirection>("increase");
  const [verdict, setVerdict] = useState<GarageVerdict>("inconclusive");
  const [lapCondition, setLapCondition] = useState<Condition>(session.condition);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [lapError, setLapError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [revisionPending, startRevision] = useTransition();
  const [planPending, startPlan] = useTransition();
  const [lapPending, startLap] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const bestLap = laps.length ? Math.min(...laps.map((lap) => lap.lapTimeMs)) : null;

  function handleRevisionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRevisionError(null);
    const formData = new FormData(event.currentTarget);
    const note = String(formData.get("revisionNote") ?? "");
    startRevision(async () => {
      try {
        const result = await createGarageRevision({
          sessionId: session.id,
          setupValues: revisionValues,
          note,
        });
        if (result.error) {
          setRevisionError(result.error);
          return;
        }
        setRevisionNote("");
        toast.success("Revision snapshot saved");
        router.refresh();
      } catch {
        setRevisionError("Couldn't save that revision. Please try again.");
      }
    });
  }

  function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlanError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const parameter = String(formData.get("parameter") ?? "");
    const amount = String(formData.get("amount") ?? "");
    const note = String(formData.get("planNote") ?? "");
    startPlan(async () => {
      try {
        const result = await createGarageRunPlanItem({
          sessionId: session.id,
          revisionId: planRevisionId,
          parameter,
          direction,
          amount,
          verdict,
          note,
        });
        if (result.error) {
          setPlanError(result.error);
          return;
        }
        form.reset();
        setDirection("increase");
        setVerdict("inconclusive");
        toast.success("Run-plan result saved");
        router.refresh();
      } catch {
        setPlanError("Couldn't save that run-plan result. Please try again.");
      }
    });
  }

  function handleLapSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLapError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const lapTime = String(formData.get("lapTime") ?? "");
    const note = String(formData.get("lapNote") ?? "");
    startLap(async () => {
      try {
        const result = await createGarageLap({
          sessionId: session.id,
          revisionId: lapRevisionId,
          lapTime,
          condition: lapCondition,
          note,
        });
        if (result.error) {
          setLapError(result.error);
          return;
        }
        form.reset();
        setLapCondition(session.condition);
        toast.success("Lap saved");
        router.refresh();
      } catch {
        setLapError("Couldn't save that lap. Please try again.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete the ${session.car} at ${session.track} session and all of its private records?`)) return;
    setDeleteError(null);
    startDelete(async () => {
      try {
        const result = await deleteGarageSession(session.id);
        if (result.error) {
          setDeleteError(result.error);
          return;
        }
        toast.success("Garage session deleted");
        router.push("/garage");
      } catch {
        setDeleteError("Couldn't delete that session. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="gap-5 px-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link href="/garage" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> All sessions
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{session.car}</h2>
              <Badge variant="blue">{session.game === "Assetto Corsa Competizione" ? "ACC" : "LMU"}</Badge>
              <Badge variant={session.condition === "Wet" ? "blue" : "secondary"}>{session.condition}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{session.track}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Started {formatDate(session.createdAt, true)}
              {session.rig ? ` · ${session.rig}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[290px]">
            <SummaryStat label="Laps" value={String(laps.length)} />
            <SummaryStat label="Test notes" value={String(runPlanItems.length)} />
            <SummaryStat label="Best lap" value={bestLap === null ? "—" : formatLapTime(bestLap)} compact />
          </div>
        </div>
        <ErrorMessage>{deleteError}</ErrorMessage>
        <div className="flex justify-end border-t border-border/70 pt-3">
          <Button variant="ghost" size="sm" disabled={deletePending} onClick={handleDelete} className="text-muted-foreground hover:text-racing-red">
            <Trash2 aria-hidden="true" />
            {deletePending ? "Deleting…" : "Delete session"}
          </Button>
        </div>
      </Card>

      <FieldTestReportForm detail={detail} />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="min-w-0 gap-4 px-5 sm:px-6">
          <SectionHeading icon={<ClipboardList className="size-4" aria-hidden="true" />} title="Setup revisions" count={revisions.length} />
          <p className="text-sm text-muted-foreground">
            Each snapshot is stored separately. Editing a later revision never changes the baseline.
          </p>

          <details className="rounded-lg border border-border/70 bg-secondary/10">
            <summary className="cursor-pointer px-3 py-3 text-sm font-medium">Capture a new revision</summary>
            <form onSubmit={handleRevisionSubmit} className="flex flex-col gap-4 border-t border-border/70 p-3">
              <details className="rounded-md border border-border/60 bg-background/30">
                <summary className="cursor-pointer px-3 py-2.5 text-sm">Edit setup values</summary>
                <div className="border-t border-border/60 p-3">
                  <SetupValuesFields
                    game={session.game}
                    values={revisionValues}
                    idPrefix="garage-revision"
                    onChange={(key, value) => setRevisionValues((current) => ({ ...current, [key]: value }))}
                  />
                </div>
              </details>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-revision-note">Revision note (optional)</Label>
                <Textarea
                  id="garage-revision-note"
                  name="revisionNote"
                  value={revisionNote}
                  onChange={(event) => setRevisionNote(event.target.value)}
                  maxLength={MAX_GARAGE_NOTE_LENGTH}
                  rows={2}
                  placeholder="What changed since the previous snapshot?"
                />
              </div>
              <ErrorMessage>{revisionError}</ErrorMessage>
              <Button type="submit" disabled={revisionPending} className="self-start">
                <Save aria-hidden="true" />
                {revisionPending ? "Saving…" : "Save revision"}
              </Button>
            </form>
          </details>

          <ol className="flex flex-col gap-2">
            {revisions.map((revision, index) => (
              <li key={revision.id} className="rounded-lg border border-border/70 bg-secondary/15 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{index === 0 ? "Baseline" : `Revision ${index + 1}`}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(revision.createdAt, true)}</p>
                  </div>
                  <Badge variant="secondary">
                    {Object.values(revision.setupValues).filter((value) => value.trim()).length} values
                  </Badge>
                </div>
                {revision.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{revision.note}</p>}
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="gap-4 px-5 sm:px-6">
            <SectionHeading icon={<Wrench className="size-4" aria-hidden="true" />} title="One-change run plan" count={runPlanItems.length} />
            <p className="text-sm text-muted-foreground">
              Tie a change to the setup revision you tested, then record whether it felt better, worse, or inconclusive.
            </p>
            <form onSubmit={handlePlanSubmit} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="garage-plan-revision">Tested revision</Label>
                <Select value={planRevisionId} onValueChange={setPlanRevisionId}>
                  <SelectTrigger id="garage-plan-revision" className="w-full"><SelectValue placeholder="Choose a revision" /></SelectTrigger>
                  <SelectContent>
                    {revisions.map((revision, index) => (
                      <SelectItem key={revision.id} value={revision.id}>
                        {index === 0 ? "Baseline" : `Revision ${index + 1}`} · {formatDate(revision.createdAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="garage-plan-parameter">Parameter</Label>
                <Input id="garage-plan-parameter" name="parameter" maxLength={MAX_GARAGE_PARAMETER_LENGTH} placeholder="e.g. Rear wing" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-plan-direction">Direction</Label>
                <Select value={direction} onValueChange={(value) => setDirection(value as GarageDirection)}>
                  <SelectTrigger id="garage-plan-direction" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DIRECTION_LABELS) as GarageDirection[]).map((item) => (
                      <SelectItem key={item} value={item}>{DIRECTION_LABELS[item]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-plan-amount">Amount / step</Label>
                <Input id="garage-plan-amount" name="amount" maxLength={MAX_GARAGE_AMOUNT_LENGTH} placeholder="e.g. 1 click" required />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="garage-plan-verdict">Test result</Label>
                <Select value={verdict} onValueChange={(value) => setVerdict(value as GarageVerdict)}>
                  <SelectTrigger id="garage-plan-verdict" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GARAGE_VERDICTS.map((item) => (
                      <SelectItem key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="garage-plan-note">Test note (optional)</Label>
                <Textarea id="garage-plan-note" name="planNote" rows={2} maxLength={MAX_GARAGE_NOTE_LENGTH} placeholder="What did you notice?" />
              </div>
              <div className="sm:col-span-2">
                <ErrorMessage>{planError}</ErrorMessage>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={planPending || !planRevisionId}>
                  <ClipboardList aria-hidden="true" />
                  {planPending ? "Saving…" : "Save test result"}
                </Button>
              </div>
            </form>
            <RunPlanHistory items={runPlanItems} revisions={revisions} />
          </Card>

          <Card className="gap-4 px-5 sm:px-6">
            <SectionHeading icon={<Clock3 className="size-4" aria-hidden="true" />} title="Lap log" count={laps.length} />
            <p className="text-sm text-muted-foreground">
              Log each lap with the revision and conditions it belongs to. Times are stored as milliseconds.
            </p>
            <form onSubmit={handleLapSubmit} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="garage-lap-revision">Setup revision</Label>
                <Select value={lapRevisionId} onValueChange={setLapRevisionId}>
                  <SelectTrigger id="garage-lap-revision" className="w-full"><SelectValue placeholder="Choose a revision" /></SelectTrigger>
                  <SelectContent>
                    {revisions.map((revision, index) => (
                      <SelectItem key={revision.id} value={revision.id}>
                        {index === 0 ? "Baseline" : `Revision ${index + 1}`} · {formatDate(revision.createdAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-lap-time">Lap time</Label>
                <Input id="garage-lap-time" name="lapTime" inputMode="decimal" maxLength={MAX_GARAGE_LAP_TIME_INPUT_LENGTH} placeholder="1:42.350" required />
                <span className="text-xs text-muted-foreground">Format: m:ss.mmm</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="garage-lap-condition">Conditions</Label>
                <Select value={lapCondition} onValueChange={(value) => setLapCondition(value as Condition)}>
                  <SelectTrigger id="garage-lap-condition" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {conditions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="garage-lap-note">Lap note (optional)</Label>
                <Textarea id="garage-lap-note" name="lapNote" rows={2} maxLength={MAX_GARAGE_NOTE_LENGTH} placeholder="Traffic, tyre state, mistakes, or other context." />
              </div>
              <div className="sm:col-span-2">
                <ErrorMessage>{lapError}</ErrorMessage>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={lapPending || !lapRevisionId}>
                  <Clock3 aria-hidden="true" />
                  {lapPending ? "Saving…" : "Log lap"}
                </Button>
              </div>
            </form>
            <LapHistory laps={laps} revisions={revisions} />
          </Card>
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-secondary/20 px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate font-mono font-semibold ${compact ? "text-xs" : "text-base"}`}>{value}</p>
    </div>
  );
}

function SectionHeading({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span className="text-racing-coral">{icon}</span>
        {title}
      </h3>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

function RunPlanHistory({ items, revisions }: { items: GarageRunPlanItem[]; revisions: GarageRevision[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-center text-sm text-muted-foreground">
        No test results yet. Record one controlled change at a time.
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border/70 bg-secondary/15 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.verdict === "better" ? "green" : item.verdict === "worse" ? "red" : "amber"}>
              {item.verdict}
            </Badge>
            <span className="text-sm font-medium">{item.parameter}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {item.direction === "increase" || item.direction === "stiffen" ? (
                <ArrowUp className="size-3" aria-hidden="true" />
              ) : item.direction === "decrease" || item.direction === "soften" ? (
                <ArrowDown className="size-3" aria-hidden="true" />
              ) : null}
              {DIRECTION_LABELS[item.direction]} · {item.amount}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {revisionLabel(revisions, item.revisionId)} · {formatDate(item.createdAt, true)}
          </p>
          {item.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.note}</p>}
        </li>
      ))}
    </ol>
  );
}

function LapHistory({ laps, revisions }: { laps: GarageLap[]; revisions: GarageRevision[] }) {
  if (!laps.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 px-4 py-5 text-center text-sm text-muted-foreground">
        No laps logged yet. Keep times linked to the setup revision you drove.
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {laps.map((lap) => (
        <li key={lap.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-secondary/15 px-3 py-3">
          <div className="min-w-0">
            <p className="font-mono text-lg font-semibold tabular-nums">{formatLapTime(lap.lapTimeMs)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {revisionLabel(revisions, lap.revisionId)} · {lap.condition} · {formatDate(lap.createdAt, true)}
            </p>
            {lap.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{lap.note}</p>}
          </div>
          <Badge variant={lap.condition === "Wet" ? "blue" : "secondary"}>{lap.condition}</Badge>
        </li>
      ))}
    </ol>
  );
}
