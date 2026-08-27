"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";

import { SetupValuesDiff } from "@/components/setup-values-diff";
import { getSetupVersionsAction } from "@/lib/actions/setup-versions";
import { diffSetupValues, diffTopLevelFields } from "@/lib/diff-setup-values";
import type { Setup, SetupVersion } from "@/lib/types";

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The expandable "Version history" panel on a SetupCard -- split out and
 * lazy-loaded via next/dynamic() like SetupCardValues/SetupCardInstallGuide,
 * and fetched on first expand rather than eagerly for every card. Each
 * setup_versions row is a pre-edit snapshot (see 0012_setup_versions.sql),
 * so version[i]'s own createdAt is the moment it was superseded by either
 * the next-older version or (for the newest one) the setup's current state.
 */
export default function SetupCardHistory({ setup }: { setup: Setup }) {
  const [versions, setVersions] = useState<SetupVersion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSetupVersionsAction(setup.id)
      .then((result) => {
        if (!cancelled) setVersions(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load history right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [setup.id]);

  if (loadError) {
    return <p role="alert" className="text-xs text-racing-red">{loadError}</p>;
  }

  if (versions === null) {
    return <p className="text-xs text-muted-foreground">Loading history...</p>;
  }

  if (versions.length === 0) {
    return <p className="text-xs text-muted-foreground">No edits yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {versions.map((version, i) => {
        const after = i === 0 ? setup : versions[i - 1];
        const topLevelChanges = diffTopLevelFields(version, after);
        const valueDiffGroups = diffSetupValues(setup.game, version.setupValues, after.setupValues);
        const valuesActuallyDiffer = valueDiffGroups.some((group) => group.rows.some((row) => row.differs));

        return (
          <div key={version.id} className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              <History className="size-3" />
              Edited {formatTimestamp(version.createdAt)}
            </div>
            {topLevelChanges.length > 0 && (
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {topLevelChanges.map((change) => (
                  <li key={change.label}>
                    <span className="text-foreground">{change.label}:</span> {change.before || "—"} →{" "}
                    {change.after || "—"}
                  </li>
                ))}
              </ul>
            )}
            {valuesActuallyDiffer && (
              <SetupValuesDiff
                game={setup.game}
                valuesA={version.setupValues}
                valuesB={after.setupValues}
                labelA="Before"
                labelB="After"
              />
            )}
            {topLevelChanges.length === 0 && !valuesActuallyDiffer && (
              <p className="text-muted-foreground">Only the attached file changed.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
