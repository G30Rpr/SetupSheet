import { Badge } from "@/components/ui/badge";
import { installGuides } from "@/lib/install-guides";
import type { Setup } from "@/lib/types";

/** The expandable "How to install this setup" panel on a SetupCard -- split out and lazy-loaded via next/dynamic() so the installGuides data only ships once a viewer actually expands it. */
export default function SetupCardInstallGuide({ setup }: { setup: Setup }) {
  const guide = installGuides[setup.game];

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2.5 text-xs">
      <Badge variant={guide.supportsFileImport ? "green" : "amber"} className="w-fit">
        {guide.supportsFileImport ? "File import supported" : "Manual entry only"}
      </Badge>
      <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground">
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
