"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, X } from "lucide-react";

import {
  cancelAccountDeletionRequest,
  requestAccountDeletion,
} from "@/lib/actions/account-deletion";
import type { AccountDeletionRequest } from "@/lib/supabase/account-deletion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AccountDeletionRequest({
  initialRequest,
}: {
  initialRequest: AccountDeletionRequest | null;
}) {
  const [request, setRequest] = useState(initialRequest);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitRequest() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await requestAccountDeletion();
        if (result.error || !result.request) {
          setError(result.error ?? "Couldn't submit the deletion request.");
          return;
        }
        setRequest({
          id: result.request.id,
          status: result.request.status,
          createdAt: result.request.createdAt,
          completedAt: null,
        });
        setConfirming(false);
      } catch {
        setError("Couldn't submit the deletion request right now.");
      }
    });
  }

  function cancelRequest() {
    if (!request || request.status !== "pending") return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await cancelAccountDeletionRequest(request.id);
        if (result.error) {
          setError(result.error);
          return;
        }
        setRequest(null);
        setConfirming(false);
      } catch {
        setError("Couldn't cancel the deletion request right now.");
      }
    });
  }

  return (
    <Card className="gap-4 border-racing-red/30 px-5 py-6 sm:px-7">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-racing-red/15 text-racing-red ring-1 ring-inset ring-racing-red/30">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">Request account and data deletion</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This submits a manual-review request. Your public contributions and Supabase account are not deleted automatically from this page.
          </p>
        </div>
      </div>

      {request?.status === "pending" ? (
        <div className="flex flex-col gap-3 rounded-md border border-racing-amber/30 bg-racing-amber/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-racing-amber">
            <Clock3 className="size-4" />
            Deletion request pending review
          </p>
          <p className="text-muted-foreground">
            A project operator must complete the account and data removal. You can cancel the request while it is pending.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={cancelRequest} disabled={isPending} className="self-start">
            <X />
            {isPending ? "Cancelling..." : "Cancel request"}
          </Button>
        </div>
      ) : request?.status === "processing" ? (
        <p className="flex items-center gap-2 rounded-md border border-racing-amber/30 bg-racing-amber/10 px-4 py-3 text-sm text-racing-amber">
          <Clock3 className="size-4" />
          Your deletion request is being processed. Cancellation is no longer available.
        </p>
      ) : request?.status === "completed" ? (
        <p className="flex items-center gap-2 rounded-md border border-racing-green/30 bg-racing-green/10 px-4 py-3 text-sm text-racing-green">
          <CheckCircle2 className="size-4" />
          Your deletion request has been marked complete.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {confirming && (
            <p className="text-sm font-medium text-racing-red">
              Click the button again to confirm. This starts a manual deletion review.
            </p>
          )}
          <Button type="button" variant="destructive" onClick={submitRequest} disabled={isPending} className="self-start">
            {confirming ? <CheckCircle2 /> : <AlertTriangle />}
            {isPending ? "Submitting..." : confirming ? "Confirm deletion request" : "Start deletion request"}
          </Button>
          {confirming && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending} className="self-start">
              <RotateCcw />
              Never mind
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-racing-red">
          {error}
        </p>
      )}
    </Card>
  );
}
