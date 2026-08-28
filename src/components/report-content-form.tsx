"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, Flag, Send } from "lucide-react";

import {
  submitContentReport,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/actions/content-reports";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const reasonOptions: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or misleading content" },
  { value: "unsafe_file", label: "Unsafe or malicious file" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "copyright", label: "Copyright concern" },
  { value: "other", label: "Something else" },
];

export function ReportContentForm({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) {
      setError("Choose a reason for the report.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await submitContentReport({
          targetType,
          targetId,
          reason,
          details,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setSubmitted(true);
      } catch {
        setError("Couldn't submit the report right now.");
      }
    });
  }

  if (submitted) {
    return (
      <Card className="items-center gap-3 border-racing-green/30 px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
          <CheckCircle2 className="size-6" />
        </span>
        <h2 className="text-xl font-semibold">Report received</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thanks for helping keep the community useful and safe. A project operator can review this report.
        </p>
      </Card>
    );
  }

  return (
    <Card className="px-5 py-6 sm:px-7">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-racing-coral/15 text-racing-coral ring-1 ring-inset ring-racing-coral/30">
            <Flag className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">What is wrong?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reports are private to you and the project operator. Please include only the context needed to investigate.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-reason">Reason</Label>
          <Select value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
            <SelectTrigger id="report-reason" className="w-full">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {reasonOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-details">Details (optional)</Label>
          <Textarea
            id="report-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Tell the reviewer what happened..."
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-racing-red">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isPending} className="self-start">
          <Send />
          {isPending ? "Submitting..." : "Submit report"}
        </Button>
      </form>
    </Card>
  );
}
