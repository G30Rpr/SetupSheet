import { setupSchemas } from "@/lib/setup-schemas";
import type { Setup } from "@/lib/types";

/**
 * Formats a manually-entered setup's values into a plain-text export, for
 * setups that don't have an uploaded file to download directly. Mirrors the
 * grouping/labels shown in SetupCard's "Setup values" panel so the export
 * matches what the user sees on the card.
 */
export function buildSetupExportText(setup: Setup): string {
  const lines: string[] = [
    `${setup.car} — ${setup.track}`,
    `Game: ${setup.game}`,
    `Condition: ${setup.condition}`,
  ];

  if (setup.lapTime) lines.push(`Lap time: ${setup.lapTime}`);
  lines.push(`Rig: ${setup.rigProfile}`, "");

  const v = setup.setupValues;
  if (v) {
    for (const group of setupSchemas[setup.game]) {
      const rows = group.fields.filter((field) => v[field.key]);
      if (rows.length === 0) continue;
      lines.push(group.title);
      for (const field of rows) {
        lines.push(`  ${field.label}: ${v[field.key]}`);
      }
      lines.push("");
    }
  }

  if (setup.description) {
    lines.push("Description:", setup.description, "");
  }

  lines.push("Downloaded from SetupSheet");

  return lines.join("\n");
}

/** Builds a filesystem-safe filename for a generated setup export. */
export function buildSetupExportFilename(setup: Setup): string {
  const safe = `${setup.car}-${setup.track}-setup`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${safe}.txt`;
}
