"use client";

import { useState, useTransition, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2, PenLine, Send } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDropzone } from "@/components/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  emptySetupValues,
  SetupValuesFields,
  type SetupValues,
} from "@/components/setup-values-fields";
import { StarRating } from "@/components/star-rating";
import { Textarea } from "@/components/ui/textarea";
import { createSetup } from "@/lib/actions/setups";
import { cn } from "@/lib/utils";
import { conditions, games } from "@/lib/data";
import type { SetupTag } from "@/lib/types";

type EntryMode = "file" | "manual";

const rigProfiles = [
  "Gamepad",
  "Wheel + 3 Pedals",
  "Wheel + Handbrake",
  "Direct Drive + Load Cell",
];

const availableTags: SetupTag[] = [
  "Safe",
  "Beginner",
  "Quali",
  "Race",
  "Aggressive",
  "Wet Weather",
];

export function UploadForm() {
  const { user, isLoading } = useAuth();
  const [entryMode, setEntryMode] = useState<EntryMode>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [setupValues, setSetupValues] = useState<SetupValues>(emptySetupValues);
  const [tags, setTags] = useState<SetupTag[]>([]);
  const [pace, setPace] = useState(3);
  const [predictability, setPredictability] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [isPending, startTransition] = useTransition();

  function toggleTag(tag: SetupTag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function updateSetupValue(key: keyof SetupValues, value: string) {
    setSetupValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const game = String(formData.get("game") ?? "");
    const condition = String(formData.get("condition") ?? "");
    const car = String(formData.get("car") ?? "");
    const track = String(formData.get("track") ?? "");
    const lapTime = String(formData.get("lapTime") ?? "");
    const rigProfile = String(formData.get("rig") ?? "");
    const description = String(formData.get("description") ?? "");

    startTransition(async () => {
      const result = await createSetup({
        game,
        car,
        track,
        condition,
        lapTime,
        description,
        tags,
        rigProfile,
        pace,
        predictability,
        setupValues: entryMode === "manual" ? setupValues : undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setStatus("success");
      }
    });
  }

  function resetForm() {
    setEntryMode("file");
    setFiles([]);
    setSetupValues(emptySetupValues);
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
          <h2 className="text-xl font-semibold">Log in to upload a setup</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            We use Discord to keep track of who uploaded what, so upvotes and
            future edits are scoped to your own setups.
          </p>
        </div>
        <DiscordLoginButton />
      </Card>
    );
  }

  if (status === "success") {
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
                      ? "bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30"
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
                      ? "bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30"
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
                <FileDropzone files={files} onFilesChange={setFiles} />
                <p className="text-xs text-muted-foreground">
                  File storage is coming soon — for now we save the details
                  below, not the file itself.
                </p>
              </div>
            ) : (
              <SetupValuesFields values={setupValues} onChange={updateSetupValue} />
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="game">Game</Label>
              <Select name="game" required>
                <SelectTrigger id="game" className="w-full">
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((game) => (
                    <SelectItem key={game} value={game}>
                      {game}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="condition">Condition</Label>
              <Select name="condition" required>
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="car">Car</Label>
              <Input id="car" name="car" placeholder="e.g. Porsche 992 GT3 Cup" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="track">Track</Label>
              <Input id="track" name="track" placeholder="e.g. Spa-Francorchamps" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lapTime">Lap time</Label>
              <Input id="lapTime" name="lapTime" placeholder="e.g. 2:16.482" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rig">Rig profile</Label>
              <Select name="rig" required>
                <SelectTrigger id="rig" className="w-full">
                  <SelectValue placeholder="Select your rig" />
                </SelectTrigger>
                <SelectContent>
                  {rigProfiles.map((rig) => (
                    <SelectItem key={rig} value={rig}>
                      {rig}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Pace</Label>
              <StarRating value={pace} onChange={setPace} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Predictability</Label>
              <StarRating value={predictability} onChange={setPredictability} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Label>Tags</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {availableTags.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 rounded-lg border border-border/80 px-3 py-2.5 text-sm has-[[data-state=checked]]:border-racing-green/50 has-[[data-state=checked]]:bg-racing-green/10"
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
            Submitting...
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
