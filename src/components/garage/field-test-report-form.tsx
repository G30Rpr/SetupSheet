"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFieldTestReport, setFieldTestReportAttribution } from "@/lib/actions/field-tests";
import { MAX_FIELD_TEST_NOTE_LENGTH } from "@/lib/field-tests";
import type { GarageSessionDetail } from "@/lib/garage";

export function FieldTestReportForm({ detail }: { detail: GarageSessionDetail }) {
  const router = useRouter();
  const { session, runPlanItems, laps } = detail;
  const betterRunCount = runPlanItems.filter((item) => item.verdict === "better").length;
  const isEligible = Boolean(session.sourceSetupId && laps.length > 0 && betterRunCount > 0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [nameIsVisible, setNameIsVisible] = useState(false);
  const [createPending, startCreate] = useTransition();
  const [attributionPending, startAttribution] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.sourceSetupId) return;
    setError(null);

    startCreate(async () => {
      try {
        const result = await createFieldTestReport({
          garageSessionId: session.id,
          setupId: session.sourceSetupId,
          note,
        });
        if (result.error || !result.reportId) {
          setError(result.error ?? "Couldn't submit that field test.");
          return;
        }
        setCreatedReportId(result.reportId);
        setNameIsVisible(false);
        setNote("");
        toast.success("Field test submitted anonymously");
        router.refresh();
      } catch {
        setError("Couldn't submit that field test. Please try again.");
      }
    });
  }

  function changeAttribution(showName: boolean) {
    if (!createdReportId) return;
    setError(null);
    startAttribution(async () => {
      try {
        const result = await setFieldTestReportAttribution({
          reportId: createdReportId,
          showName,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setNameIsVisible(showName);
        toast.success(showName ? "Your name will appear on this report" : "Your report is anonymous again");
        router.refresh();
      } catch {
        setError("Couldn't update report attribution. Please try again.");
      }
    });
  }

  return (
    <Card className="gap-4 px-5 sm:px-6">
      <div>
        <h3 className="text-lg font-semibold">Share a field test</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Lap metrics and successful changes are derived from this private Garage session. Your note stays private.
        </p>
      </div>

      {!session.sourceSetupId ? (
        <p className="rounded-md border border-border/70 bg-secondary/20 px-3 py-2.5 text-sm text-muted-foreground">
          To share a field test, start a Garage session from a public setup so the source can be verified.
          <Link href="/setups" className="ml-1 font-medium text-racing-cyan hover:underline">Browse setups</Link>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          For <Link href={`/setups/${encodeURIComponent(session.sourceSetupId)}`} className="font-medium text-racing-cyan hover:underline">
            {session.car} at {session.track}
          </Link>
          {laps.length === 0 && " · Log at least one lap"}
          {laps.length > 0 && betterRunCount === 0 && " · Mark at least one run-plan change “better”"}
        </p>
      )}

      {createdReportId ? (
        <div className="flex flex-col gap-3 rounded-lg border border-racing-green/25 bg-racing-green/5 p-3">
          <p className="text-sm">
            Your report is {nameIsVisible ? "attributed to your profile" : "anonymous by default"}.
          </p>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={attributionPending}
            onClick={() => changeAttribution(!nameIsVisible)}
          >
            {attributionPending
              ? "Updating…"
              : nameIsVisible
                ? "Hide my name on this report"
                : "Opt in to show my name"}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-test-private-note">Private note (optional)</Label>
            <Textarea
              id="field-test-private-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_FIELD_TEST_NOTE_LENGTH}
              rows={3}
              placeholder="Add context for your own records. This note is never shown publicly."
            />
          </div>
          <p className="text-xs text-muted-foreground">Public attribution is off. You can opt in separately after submitting.</p>
          {error && <p role="alert" className="text-sm text-racing-red">{error}</p>}
          <Button type="submit" disabled={!isEligible || createPending} className="self-start">
            {createPending ? "Submitting…" : "Submit field test anonymously"}
          </Button>
        </form>
      )}
      {createdReportId && error && <p role="alert" className="text-sm text-racing-red">{error}</p>}
    </Card>
  );
}
