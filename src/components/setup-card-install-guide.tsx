"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ClipboardCopy, Download, PackageOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { resolveInstallGuide } from "@/lib/install-guides";
import type { Setup } from "@/lib/types";

/**
 * The "How to install this setup" panel on a SetupCard -- split out and
 * lazy-loaded via next/dynamic() so the installGuides data only ships once a
 * viewer actually expands it.
 *
 * Two pieces of real work happen here rather than in prose:
 *  - the destination folder is resolved against *this* setup's car and track
 *    and can be copied in one click, instead of making the reader retype a
 *    Windows path that they will get wrong;
 *  - the install bundle hands over the file, the values and the instructions
 *    as one download, which is the difference between "downloaded a setup" and
 *    "driving the setup".
 */
export default function SetupCardInstallGuide({ setup }: { setup: Setup }) {
  const guide = resolveInstallGuide(setup.game, setup);
  const [copied, setCopied] = useState<"folder" | null>(null);
  const canBundle = Boolean(setup.fileUrl || setup.setupValues);

  async function copyFolder() {
    if (!guide.folderPath) return;
    try {
      await navigator.clipboard.writeText(guide.folderPath);
      setCopied("folder");
      window.setTimeout(() => setCopied(null), 2000);
      toast.success("Folder path copied");
    } catch {
      toast.error("Couldn't copy the path — select it manually below");
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-md border border-border/60 px-3 py-2.5 text-xs">
      <Badge variant={guide.supportsFileImport ? "green" : "amber"} className="w-fit">
        {guide.supportsFileImport ? "File import supported" : "Manual entry only"}
      </Badge>

      <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground">
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {guide.folderPath && (
        <div className="flex flex-col gap-1.5 rounded border border-border/60 bg-secondary/40 px-2.5 py-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Destination folder
          </span>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground">
              {guide.folderPath}
            </code>
            <button
              type="button"
              onClick={copyFolder}
              aria-label="Copy the destination folder path"
              className="flex shrink-0 items-center gap-1 rounded border border-border/80 bg-background px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-racing-coral/40 hover:text-foreground"
            >
              {copied === "folder" ? (
                <Check className="size-3 text-racing-green" aria-hidden="true" />
              ) : (
                <ClipboardCopy className="size-3" aria-hidden="true" />
              )}
              {copied === "folder" ? "Copied" : "Copy"}
            </button>
          </div>
          {guide.folderNote && (
            <p className="text-[11px] text-muted-foreground/80">{guide.folderNote}</p>
          )}
        </div>
      )}

      {canBundle && guide.supportsFileImport && (
        <a
          href={`/api/setups/${encodeURIComponent(setup.id)}/bundle`}
          download
          className="flex w-fit items-center gap-1.5 rounded-md border border-racing-coral/40 bg-racing-coral/10 px-2.5 py-1.5 font-medium text-racing-coral transition-colors hover:bg-racing-coral/15"
        >
          <PackageOpen className="size-3.5" aria-hidden="true" />
          Download install bundle
        </a>
      )}

      {canBundle && guide.supportsFileImport && (
        <p className="text-[11px] text-muted-foreground/80">
          The bundle contains the setup file, your values as text, and these
          instructions — so you don&apos;t need to come back to this page mid-install.
        </p>
      )}

      {!guide.supportsFileImport && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80">
          <Download className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span>
            This title can&apos;t import a file, so use the{" "}
            <span className="font-medium text-foreground">Copy values</span> button beside
            Download to take every value across in one paste.
          </span>
        </p>
      )}
    </div>
  );
}
