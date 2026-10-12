"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ClipboardCopy, Download, PackageOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <span className="text-xs uppercase tracking-wide text-muted-foreground/70">
            Destination folder
          </span>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
              {guide.folderPath}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyFolder}
              aria-label="Copy the destination folder path"
              className="shrink-0 gap-1"
            >
              {copied === "folder" ? (
                <Check className="size-4 text-racing-green" aria-hidden="true" />
              ) : (
                <ClipboardCopy className="size-4" aria-hidden="true" />
              )}
              {copied === "folder" ? "Copied" : "Copy"}
            </Button>
          </div>
          {guide.folderNote && (
            <p className="text-xs text-muted-foreground/80">{guide.folderNote}</p>
          )}
        </div>
      )}

      {canBundle && guide.supportsFileImport && (
        <Button asChild variant="outline" size="sm" className="w-fit self-start">
          <a href={`/api/setups/${encodeURIComponent(setup.id)}/bundle`} download>
            <PackageOpen className="size-4" aria-hidden="true" />
            Download install bundle
          </a>
        </Button>
      )}

      {canBundle && guide.supportsFileImport && (
        <p className="text-xs text-muted-foreground/80">
          The bundle contains the setup file, your values as text, and these
          instructions — so you don&apos;t need to come back to this page mid-install.
        </p>
      )}

      {!guide.supportsFileImport && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground/80">
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
