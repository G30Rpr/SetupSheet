"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { conditions, games } from "@/lib/data";
import type { SetupTag } from "@/lib/types";

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
  const [files, setFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<SetupTag[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  function toggleTag(tag: SetupTag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    window.setTimeout(() => setStatus("success"), 900);
  }

  function resetForm() {
    setFiles([]);
    setTags([]);
    setStatus("idle");
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Setup files
            </h2>
            <FileDropzone files={files} onFilesChange={setFiles} />
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="game">Game</Label>
              <Select required>
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
              <Select required>
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
              <Input id="car" placeholder="e.g. Porsche 992 GT3 Cup" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="track">Track</Label>
              <Input id="track" placeholder="e.g. Spa-Francorchamps" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lapTime">Lap time</Label>
              <Input id="lapTime" placeholder="e.g. 2:16.482" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rig">Rig profile</Label>
              <Select required>
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
              placeholder="What makes this setup fast or safe? Any tips for using it?"
              rows={4}
            />
          </section>
        </div>
      </Card>

      <Button type="submit" size="lg" disabled={status === "submitting"}>
        {status === "submitting" ? (
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
