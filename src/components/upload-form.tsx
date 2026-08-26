"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  File as FileIcon,
  FileUp,
  Loader2,
  PenLine,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDropzone } from "@/components/file-dropzone";
import { GroupedSelectField } from "@/components/grouped-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SetupValuesFields, type SetupValues } from "@/components/setup-values-fields";
import { StarRating } from "@/components/star-rating";
import { Textarea } from "@/components/ui/textarea";
import { createSetup, updateSetup, uploadSetupFile, uploadTelemetryFile } from "@/lib/actions/setups";
import { parseAccSetupFile } from "@/lib/acc-setup-parser";
import { resolveEffectiveSetupValues } from "@/lib/resolve-effective-setup-values";
import { isKnownOption, type SelectOptionGroup } from "@/lib/select-options";
import { cn } from "@/lib/utils";
import {
  MAX_CAR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TRACK_LENGTH,
  conditions,
  games,
  rigProfiles,
  setupTags,
} from "@/lib/data";
import type { Game, Setup, SetupTag } from "@/lib/types";

type EntryMode = "file" | "manual";

// Only in create mode -- edit mode's existingSetup is already the
// persisted source of truth, so drafting it separately would just risk
// resurrecting a stale abandoned edit later. Car/track are deliberately
// left out of the draft: they're driven by GroupedSelectField, which can
// switch between a Radix Select and a plain input depending on whether the
// value matches a known option, and there's no safe way to restore into
// that from outside without reaching into its internals.
const DRAFT_KEY = "setupsheet:upload-draft";

export function UploadForm({ existingSetup }: { existingSetup?: Setup }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isEditing = Boolean(existingSetup);
  // A file takes priority over setupValues when both are present -- that
  // only happens for an ACC setup whose file was auto-parsed for tuning
  // values (see handleFileChange), where the file is still the source of
  // truth the player actually imports, and the values are supplementary.
  const [entryMode, setEntryMode] = useState<EntryMode>(
    existingSetup?.fileName ? "file" : existingSetup?.setupValues ? "manual" : "file"
  );
  const [game, setGame] = useState<Game | "">(existingSetup?.game ?? "");
  // Both are plain per-game data modules (not components, so next/dynamic
  // doesn't apply) -- loaded via dynamic import() below so their ~150+ lines
  // of car/track rosters ship in their own chunk instead of every /upload
  // page's initial bundle.
  const [carLists, setCarLists] = useState<Partial<Record<Game, SelectOptionGroup[]>>>({});
  const [trackLists, setTrackLists] = useState<Partial<Record<Game, SelectOptionGroup[]>>>({});
  const [useManualCarInput, setUseManualCarInput] = useState(false);
  const [useManualTrackInput, setUseManualTrackInput] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [detectedCar, setDetectedCar] = useState<string | null>(null);
  const [detectedSetupValues, setDetectedSetupValues] = useState<SetupValues>({});
  const [keepExistingFile, setKeepExistingFile] = useState(Boolean(existingSetup?.fileName));
  const [setupValues, setSetupValues] = useState<SetupValues>(existingSetup?.setupValues ?? {});
  const [tags, setTags] = useState<SetupTag[]>(existingSetup?.tags ?? []);
  const [condition, setCondition] = useState(existingSetup?.condition ?? "");
  const [lapTime, setLapTime] = useState(existingSetup?.lapTime ?? "");
  const [rig, setRig] = useState(existingSetup?.rigProfile ?? "");
  const [description, setDescription] = useState(existingSetup?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(existingSetup?.videoUrl ?? "");
  const [telemetryFile, setTelemetryFile] = useState<File | null>(null);
  const [keepExistingTelemetry, setKeepExistingTelemetry] = useState(Boolean(existingSetup?.telemetryFileName));
  const [pace, setPace] = useState(3);
  const [predictability, setPredictability] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [isPending, startTransition] = useTransition();

  // Loaded once on mount rather than gated behind game selection: this still
  // keeps both rosters out of every /upload page's initial JS (they only
  // ship once this chunk is fetched), while avoiding a "which mode does the
  // grouped field start in" race for the edit flow, which needs to know
  // synchronously-ish whether the existing car/track is a known option.
  useEffect(() => {
    let cancelled = false;
    Promise.all([import("@/lib/car-lists"), import("@/lib/track-lists")]).then(
      ([carListsModule, trackListsModule]) => {
        if (cancelled) return;
        setCarLists(carListsModule.carLists);
        setTrackLists(trackListsModule.trackLists);
        if (existingSetup) {
          setUseManualCarInput(
            !isKnownOption(carListsModule.carLists[existingSetup.game], existingSetup.car)
          );
          setUseManualTrackInput(
            !isKnownOption(trackListsModule.trackLists[existingSetup.game], existingSetup.track)
          );
        }
      }
    );
    return () => {
      cancelled = true;
    };
    // existingSetup doesn't change across this component's lifetime -- only
    // its initial value matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restores a saved draft (if any) on first mount -- localStorage isn't
  // available during SSR, so this has to be an effect rather than a lazy
  // state initializer (which would also produce a hydration mismatch).
  useEffect(() => {
    if (isEditing) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;

    try {
      const draft = JSON.parse(saved);
      // Hydrating from localStorage on mount, not deriving from props/state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (draft.game) setGame(draft.game);
      if (draft.condition) setCondition(draft.condition);
      if (draft.lapTime) setLapTime(draft.lapTime);
      if (draft.rig) setRig(draft.rig);
      if (draft.description) setDescription(draft.description);
      if (Array.isArray(draft.tags)) setTags(draft.tags);
      if (draft.setupValues && typeof draft.setupValues === "object") setSetupValues(draft.setupValues);
      if (typeof draft.pace === "number") setPace(draft.pace);
      if (typeof draft.predictability === "number") setPredictability(draft.predictability);
      if (draft.entryMode === "file" || draft.entryMode === "manual") setEntryMode(draft.entryMode);

      toast("Restored your unsaved draft", {
        action: {
          label: "Discard",
          onClick: () => {
            localStorage.removeItem(DRAFT_KEY);
            resetForm();
          },
        },
      });
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosaves the draft, debounced, so an accidental navigation or crash
  // doesn't lose a half-filled form.
  useEffect(() => {
    if (isEditing) return;
    const id = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ game, condition, lapTime, rig, description, tags, setupValues, pace, predictability, entryMode })
      );
    }, 500);
    return () => clearTimeout(id);
  }, [isEditing, game, condition, lapTime, rig, description, tags, setupValues, pace, predictability, entryMode]);

  function toggleTag(tag: SetupTag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleGameChange(value: string) {
    setGame(value as Game);
    const { getEmptySetupValues } = await import("@/lib/setup-schemas");
    setSetupValues(getEmptySetupValues(value as Game));
    setUseManualCarInput(false);
    setUseManualTrackInput(false);
    setDetectedCar(null);
    setDetectedSetupValues({});
  }

  function updateSetupValue(key: string, value: string) {
    setSetupValues((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * When a file is dropped for ACC (or no game picked yet -- we can infer
   * it's ACC from the file's own shape), extracts the car (so it's
   * pre-filled below) and whatever tuning values the file's own fields
   * translate to real units (see acc-setup-parser.ts) -- these get attached
   * alongside the file itself, not instead of it, so the file stays the
   * thing a player actually imports into the game while the values power
   * the "Setup values" panel and the comparison tool. A car ACC exports
   * that isn't on this site's roster yet still gets its tuning values
   * captured, just without the Car field auto-filling. Silently does
   * nothing for files that don't parse at all -- no error shown for what
   * might just be a different game's file.
   */
  async function handleFileChange(newFile: File | null) {
    setFile(newFile);
    setDetectedCar(null);
    setDetectedSetupValues({});

    if (!newFile || (game !== "" && game !== "Assetto Corsa Competizione")) {
      return;
    }

    const text = await newFile.text();
    const result = parseAccSetupFile(text);
    if (!result) return;

    const targetGame: Game = "Assetto Corsa Competizione";
    if (game !== targetGame) {
      setGame(targetGame);
      setUseManualTrackInput(false);
    }
    setDetectedSetupValues(result.setupValues);

    if (result.car) {
      setUseManualCarInput(false);
      setDetectedCar(result.car);
    }
  }

  /**
   * Resolves what filePath/fileName to send to createSetup/updateSetup.
   * Manual mode always clears the file (the two are alternate ways of
   * representing the same setup data, not additive). File mode either
   * uploads a newly-picked file, keeps the existing one untouched (leaving
   * both fields undefined), or clears it if the user removed it without
   * picking a replacement.
   */
  async function resolveFileFields(): Promise<{
    filePath?: string | null;
    fileName?: string | null;
    error?: string;
  }> {
    if (entryMode === "manual") {
      return { filePath: null, fileName: null };
    }

    if (file) {
      const fileFormData = new FormData();
      fileFormData.append("file", file);
      const result = await uploadSetupFile(fileFormData);
      if (result.error || !result.path) {
        return { error: result.error ?? "Failed to upload file." };
      }
      return { filePath: result.path, fileName: result.fileName };
    }

    if (isEditing && keepExistingFile) {
      return {};
    }

    return { filePath: null, fileName: null };
  }

  async function resolveTelemetryFields(): Promise<{
    telemetryFilePath?: string | null;
    telemetryFileName?: string | null;
    error?: string;
  }> {
    if (telemetryFile) {
      const fileFormData = new FormData();
      fileFormData.append("file", telemetryFile);
      const result = await uploadTelemetryFile(fileFormData);
      if (result.error || !result.path) {
        return { error: result.error ?? "Failed to upload telemetry file." };
      }
      return { telemetryFilePath: result.path, telemetryFileName: result.fileName };
    }

    if (isEditing && keepExistingTelemetry) {
      return {};
    }

    return { telemetryFilePath: null, telemetryFileName: null };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const car = String(formData.get("car") ?? "");
    const track = String(formData.get("track") ?? "");

    const effectiveSetupValues = resolveEffectiveSetupValues({
      entryMode,
      manualSetupValues: setupValues,
      detectedSetupValues,
      isEditing,
      keepExistingFile,
      hasNewFile: Boolean(file),
    });

    startTransition(async () => {
      const [fileFields, telemetryFields] = await Promise.all([
        resolveFileFields(),
        resolveTelemetryFields(),
      ]);

      if (fileFields.error) {
        setError(fileFields.error);
        toast.error(fileFields.error);
        return;
      }

      if (telemetryFields.error) {
        setError(telemetryFields.error);
        toast.error(telemetryFields.error);
        return;
      }

      if (existingSetup) {
        const result = await updateSetup(existingSetup.id, {
          game,
          car,
          track,
          condition,
          lapTime,
          description,
          tags,
          rigProfile: rig,
          setupValues: effectiveSetupValues,
          filePath: fileFields.filePath,
          fileName: fileFields.fileName,
          videoUrl: videoUrl.trim() || null,
          telemetryFilePath: telemetryFields.telemetryFilePath,
          telemetryFileName: telemetryFields.telemetryFileName,
        });

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
        } else {
          toast.success("Setup updated");
          router.push("/setups");
        }
        return;
      }

      const result = await createSetup({
        game,
        car,
        track,
        condition,
        lapTime,
        description,
        tags,
        rigProfile: rig,
        pace,
        predictability,
        setupValues: effectiveSetupValues,
        filePath: fileFields.filePath,
        fileName: fileFields.fileName,
        videoUrl: videoUrl.trim() || null,
        telemetryFilePath: telemetryFields.telemetryFilePath,
        telemetryFileName: telemetryFields.telemetryFileName,
      });

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        localStorage.removeItem(DRAFT_KEY);
        setStatus("success");
      }
    });
  }

  function resetForm() {
    setEntryMode("file");
    setGame("");
    setCondition("");
    setLapTime("");
    setRig("");
    setDescription("");
    setFile(null);
    setDetectedCar(null);
    setDetectedSetupValues({});
    setKeepExistingFile(false);
    setSetupValues({});
    setTags([]);
    setPace(3);
    setPredictability(3);
    setError(null);
    setStatus("idle");
  }

  if (isLoading) {
    return (
      <Card className="h-64 animate-pulse border-border/60 bg-secondary/20" />
    );
  }

  if (!user) {
    return (
      <Card className="items-center gap-4 border-racing-green/30 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
          <PenLine className="size-7" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">
            Log in to {isEditing ? "edit this setup" : "upload a setup"}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            We use Discord to keep track of who uploaded what, so upvotes and
            edits are scoped to your own setups.
          </p>
        </div>
        <DiscordLoginButton />
      </Card>
    );
  }

  if (!isEditing && status === "success") {
    return (
      <Card className="items-center gap-4 border-racing-green/40 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Setup submitted!</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Thanks for sharing with the community. Your setup will appear on
            the Browse Setups page shortly.
          </p>
        </div>
        <Button onClick={resetForm} variant="outline">
          Upload another setup
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="game">Game</Label>
              <Select name="game" required value={game} onValueChange={handleGameChange}>
                <SelectTrigger id="game" className="w-full">
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="condition">Condition</Label>
              <Select name="condition" required value={condition} onValueChange={setCondition}>
                <SelectTrigger id="condition" className="w-full">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {condition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Setup data
              </h2>
              <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/40 p-1">
                <button
                  type="button"
                  onClick={() => setEntryMode("file")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    entryMode === "file"
                      ? "bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileUp className="size-3.5" />
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("manual")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    entryMode === "manual"
                      ? "bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PenLine className="size-3.5" />
                  Enter manually
                </button>
              </div>
            </div>

            {entryMode === "file" ? (
              <div className="flex flex-col gap-2">
                {isEditing && keepExistingFile && !file ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/40 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileIcon className="size-4 shrink-0 text-racing-coral" />
                      <span className="truncate">{existingSetup?.fileName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        current file
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setKeepExistingFile(false)}
                      className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                      aria-label="Remove current file"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <FileDropzone file={file} onFileChange={handleFileChange} />
                )}
                <p className="text-xs text-muted-foreground">
                  Anyone will be able to download this file straight from the
                  setup card.
                </p>

                {detectedCar || Object.keys(detectedSetupValues).length > 0 ? (
                  <div className="flex items-center gap-2 rounded-md border border-racing-green/30 bg-racing-green/10 px-3 py-2.5 text-xs text-racing-green">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      {detectedCar && "Detected " + detectedCar + " — car field pre-filled below. "}
                      {Object.keys(detectedSetupValues).length > 0 &&
                        `${Object.keys(detectedSetupValues).length} tuning value${
                          Object.keys(detectedSetupValues).length === 1 ? "" : "s"
                        } extracted for the Setup values panel and comparison tool.`}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : game ? (
              <SetupValuesFields game={game} values={setupValues} onChange={updateSetupValue} />
            ) : (
              <p className="rounded-md border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
                Select a game above first — the fields here match that game&apos;s own setup screen.
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5" key={`car-${game}-${detectedCar ?? "none"}`}>
              <Label htmlFor="car">Car</Label>
              <GroupedSelectField
                id="car"
                groups={game ? carLists[game] : undefined}
                useManual={useManualCarInput}
                onToggleManual={setUseManualCarInput}
                defaultValue={existingSetup?.car ?? detectedCar ?? undefined}
                selectPlaceholder="Select a car"
                inputPlaceholder="e.g. Porsche 992 GT3 Cup"
                maxLength={MAX_CAR_LENGTH}
              />
            </div>

            <div className="flex flex-col gap-1.5" key={`track-${game}`}>
              <Label htmlFor="track">Track</Label>
              <GroupedSelectField
                id="track"
                groups={game ? trackLists[game] : undefined}
                useManual={useManualTrackInput}
                onToggleManual={setUseManualTrackInput}
                defaultValue={existingSetup?.track}
                selectPlaceholder="Select a track"
                inputPlaceholder="e.g. Spa-Francorchamps"
                maxLength={MAX_TRACK_LENGTH}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lapTime">Lap time</Label>
              <Input
                id="lapTime"
                name="lapTime"
                placeholder="e.g. 2:16.482"
                value={lapTime}
                onChange={(e) => setLapTime(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rig">Rig profile</Label>
              <Select name="rig" required value={rig} onValueChange={setRig}>
                <SelectTrigger id="rig" className="w-full">
                  <SelectValue placeholder="Select your rig" />
                </SelectTrigger>
                <SelectContent>
                  {rigProfiles.map((profile) => (
                    <SelectItem key={profile} value={profile}>
                      {profile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Lap Proof & Telemetry (Optional) */}
          <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-secondary/20 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-racing-green" />
                Verified Lap Proof &amp; Telemetry (Optional)
              </h3>
              <p className="text-xs text-muted-foreground">
                Attaching a video link or telemetry file awards a &ldquo;Verified Lap&rdquo; badge to your setup card.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="videoUrl">Hotlap Video URL (YouTube / Twitch)</Label>
              <Input
                id="videoUrl"
                name="videoUrl"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Telemetry / Data Logging File</Label>
              {isEditing && keepExistingTelemetry && existingSetup?.telemetryFileName ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/40 px-3 py-2 text-sm">
                  <span className="truncate text-xs font-medium text-racing-cyan">
                    Telemetry attached: {existingSetup.telemetryFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setKeepExistingTelemetry(false)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    aria-label="Remove telemetry file"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <FileDropzone file={telemetryFile} onFileChange={setTelemetryFile} />
              )}
              <p className="text-xs text-muted-foreground">
                Supports MoTeC (.ld, .ldx), iRacing (.ibt), VBOX (.vbo), CSV, or ZIP up to 10 MB.
              </p>
            </div>
          </section>

          {!isEditing && (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Pace</Label>
                <StarRating value={pace} onChange={setPace} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Predictability</Label>
                <StarRating value={predictability} onChange={setPredictability} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Your own starting rating — the community (including you) can
                update it any time from the setup card afterward.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <Label>Tags</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {setupTags.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 rounded-lg border border-border/80 px-3 py-2.5 text-sm has-[[data-state=checked]]:border-racing-coral/50 has-[[data-state=checked]]:bg-racing-coral/10"
                >
                  <Checkbox
                    checked={tags.includes(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What makes this setup fast or safe? Any tips for using it?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={4}
            />
          </section>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            {isEditing ? "Saving..." : "Submitting..."}
          </>
        ) : isEditing ? (
          <>
            <Send />
            Save Changes
          </>
        ) : (
          <>
            <Send />
            Share Setup
          </>
        )}
      </Button>
    </form>
  );
}
