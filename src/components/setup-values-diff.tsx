import { diffSetupValues } from "@/lib/diff-setup-values";
import { cn } from "@/lib/utils";
import type { Game, SetupValues } from "@/lib/types";

/**
 * Renders diffSetupValues's grouped output as a 3-column table (label | A |
 * B), amber-flagging rows where the two sides disagree. Shared by the
 * setup comparison tool and the version-history panel -- both are "here
 * are two sets of the same game's tuning fields, show me what changed".
 */
export function SetupValuesDiff({
  game,
  valuesA,
  valuesB,
  labelA,
  labelB,
}: {
  game: Game;
  valuesA: SetupValues | null | undefined;
  valuesB: SetupValues | null | undefined;
  labelA: string;
  labelB: string;
}) {
  const groups = diffSetupValues(game, valuesA, valuesB);

  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground">No structured values to compare.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-4 px-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        <span />
        <span className="truncate">{labelA}</span>
        <span className="truncate">{labelB}</span>
      </div>
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{group.title}</p>
          <dl className="flex flex-col gap-0.5">
            {group.rows.map((row) => (
              <div
                key={row.key}
                className={cn(
                  "grid grid-cols-[1fr_1fr_1fr] items-center gap-x-4 rounded px-1.5 py-1",
                  row.differs && "border-l-2 border-racing-amber bg-racing-amber/10"
                )}
              >
                <dt className="truncate text-muted-foreground">
                  {row.label}
                  {row.differs && <span className="sr-only"> (changed)</span>}
                </dt>
                <dd className="truncate font-mono font-medium tabular-nums text-foreground">
                  {row.valueA ?? "—"}
                </dd>
                <dd className="truncate font-mono font-medium tabular-nums text-foreground">
                  {row.valueB ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
