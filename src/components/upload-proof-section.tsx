"use client";

import { CheckCircle2, ChevronDown, X } from "lucide-react";

import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_TELEMETRY_FILE_EXTENSIONS } from "@/lib/storage";
import { MAX_VIDEO_URL_LENGTH } from "@/lib/video-url";
import { cn } from "@/lib/utils";

/** Optional proof/telemetry section extracted from the upload form. */
export function UploadProofSection({
  showFields,
  onToggleFields,
  videoUrl,
  onVideoUrlChange,
  telemetryFile,
  onTelemetryFileChange,
  isEditing,
  keepExistingTelemetry,
  existingTelemetryFileName,
  onRemoveExistingTelemetry,
}: {
  showFields: boolean;
  onToggleFields: () => void;
  videoUrl: string;
  onVideoUrlChange: (value: string) => void;
  telemetryFile: File | null;
  onTelemetryFileChange: (file: File | null) => void;
  isEditing: boolean;
  keepExistingTelemetry: boolean;
  existingTelemetryFileName?: string | null;
  onRemoveExistingTelemetry: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-secondary/20 p-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleFields}
        aria-expanded={showFields}
        aria-controls="lap-proof-fields"
        className="w-full justify-between text-left"
      >
        <span
          role="heading"
          aria-level={3}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
        >
          <CheckCircle2 className="size-4 text-muted-foreground" />
          Verified Lap Proof &amp; Telemetry
          <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground motion-safe:motion-transform",
            showFields && "rotate-180"
          )}
        />
      </Button>
      <p className="text-xs text-muted-foreground">
        Add proof only if you have it. A video link or telemetry file adds a
        &ldquo;Verified Lap&rdquo; badge to your setup card.
      </p>

      {showFields && (
        <div id="lap-proof-fields" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="videoUrl">Hotlap Video URL (YouTube / Twitch)</Label>
            <Input
              id="videoUrl"
              name="videoUrl"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=..."
              maxLength={MAX_VIDEO_URL_LENGTH}
              value={videoUrl}
              onChange={(event) => onVideoUrlChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Telemetry / Data Logging File</Label>
            {isEditing && keepExistingTelemetry && existingTelemetryFileName ? (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/40 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
                  Telemetry attached: {existingTelemetryFileName}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveExistingTelemetry}
                  aria-label="Remove telemetry file"
                  className="shrink-0 hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <FileDropzone
                file={telemetryFile}
                onFileChange={onTelemetryFileChange}
                acceptedExtensions={ALLOWED_TELEMETRY_FILE_EXTENSIONS}
                ariaLabel="Choose a telemetry file"
                helperText=".ld, .ldx, .ibt, .vbo, .drf, .csv, .zip or .zvp — up to 10 MB"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Supports MoTeC (.ld, .ldx), iRacing (.ibt), VBOX (.vbo), CSV, or ZIP up to 10 MB.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
