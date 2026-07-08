"use client";

import { useRef, useState } from "react";
import { File, UploadCloud, X } from "lucide-react";

import { ALLOWED_SETUP_FILE_EXTENSIONS } from "@/lib/storage";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    onFileChange(newFiles[0]);
  }

  return (
    <div className="flex flex-col gap-3">
      {!file && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            pickFile(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragging
              ? "border-racing-green bg-racing-green/10"
              : "border-border hover:border-racing-green/50 hover:bg-accent/40"
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
            <UploadCloud className="size-6" />
          </span>
          <div>
            <p className="font-medium">
              Tap to choose a file
              <span className="hidden sm:inline"> or drag it here</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              .sto, .json, .ini, .svm and more — up to 5 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_SETUP_FILE_EXTENSIONS.join(",")}
            onChange={(e) => pickFile(e.target.files)}
          />
        </div>
      )}

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/40 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <File className="size-4 shrink-0 text-racing-green" />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
            aria-label={`Remove ${file.name}`}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
