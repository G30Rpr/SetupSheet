import { setupSchemas } from "@/lib/setup-schemas";
import type { Setup } from "@/lib/types";

/** The expandable "Setup values" panel on a SetupCard -- split out and lazy-loaded via next/dynamic() so the per-game setupSchemas data only ships once a viewer actually expands it. */
export default function SetupCardValues({ setup }: { setup: Setup }) {
  const v = setup.setupValues;
  if (!v) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-md border border-border/60 px-3 py-2.5 text-xs">
      {setupSchemas[setup.game].map((group) => {
        const rows = group.fields.filter((field) => v[field.key]);
        if (rows.length === 0) return null;
        return (
          <div key={group.title} className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {group.title}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {rows.map((field) => (
                <div key={field.key} className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {v[field.key]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
