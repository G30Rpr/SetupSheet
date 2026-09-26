import { ClipboardList, Gauge, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PublicFieldTestSummary } from "@/lib/supabase/field-tests";

function formatLapTime(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  const millis = milliseconds % 1_000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

const directionLabel = {
  increase: "increased",
  decrease: "decreased",
  soften: "softened",
  stiffen: "stiffened",
} as const;

export function PublicFieldTestReports({ summary }: { summary: PublicFieldTestSummary }) {
  return (
    <section id="field-tests" aria-labelledby="field-tests-heading" className="mt-8 scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ClipboardList className="size-4 text-racing-cyan" aria-hidden="true" />
            <h2 id="field-tests-heading" className="text-xl font-semibold">Field tests</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Self-reported results derived from drivers&apos; logged Garage laps and better run-plan changes.
          </p>
        </div>
        <Badge variant="blue">
          {summary.reportCount} {summary.reportCount === 1 ? "report" : "reports"}
        </Badge>
      </div>

      {summary.error ? (
        <Card className="px-4 py-5 text-sm text-muted-foreground">
          Field-test reports couldn&apos;t be loaded right now. Try refreshing this page.
        </Card>
      ) : summary.reports.length === 0 ? (
        <Card className="px-4 py-5 text-sm text-muted-foreground">
          No field tests have been shared for this setup yet.
        </Card>
      ) : (
        <>
          {summary.reportCount > summary.reports.length && (
            <p className="mb-3 text-xs text-muted-foreground">
              Showing the {summary.reports.length} latest of {summary.reportCount} reports.
            </p>
          )}
          <ol className="flex flex-col gap-3">
            {summary.reports.map((report) => (
              <li key={report.id}>
                <Card className="gap-4 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{report.displayName ?? "Anonymous driver"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {report.game} · {report.condition} · {formatDate(report.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">Self-reported</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-md bg-secondary/35 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Timer className="size-3.5" aria-hidden="true" /> Best lap
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                        {formatLapTime(report.bestLapMs)}
                      </p>
                    </div>
                    <div className="rounded-md bg-secondary/35 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Laps logged</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{report.lapsRun}</p>
                    </div>
                    <div className="rounded-md bg-secondary/35 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Gauge className="size-3.5" aria-hidden="true" /> Consistency
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {report.consistencyPct === null ? "—" : `${report.consistencyPct.toFixed(1)}%`}
                      </p>
                      {report.consistencyPct === null && (
                        <p className="text-[11px] text-muted-foreground">One lap logged</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Better changes logged
                    </h3>
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                      {report.validatedChanges.map((change, index) => (
                        <li key={`${change.parameter}-${index}`} className="flex flex-wrap gap-x-1 text-foreground">
                          <span>{change.parameter}</span>
                          <span className="text-muted-foreground">{directionLabel[change.direction]}</span>
                          <span>{change.amount}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
