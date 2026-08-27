"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Gamepad2, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteSetupRequest,
  fulfillSetupRequest,
  getMyMatchingSetupsAction,
} from "@/lib/actions/setup-requests";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { cn } from "@/lib/utils";
import type { SetupRequest } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SetupRequestCard({ request }: { request: SetupRequest }) {
  const router = useRouter();
  const { user, signInWithDiscord } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const [candidates, setCandidates] = useState<{ id: string; car: string; track: string }[] | null>(null);
  const [selectedSetupId, setSelectedSetupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCancelled, setIsCancelled] = useState(false);
  const runUndoableDelete = useUndoableDelete();

  const isFulfilled = Boolean(request.fulfilledSetupId);
  const isOwnRequest = user?.id === request.requesterId;

  function handleDelete() {
    setIsCancelled(true);
    runUndoableDelete({
      key: request.id,
      message: `Cancelled request for ${request.car} @ ${request.track}`,
      onUndo: () => setIsCancelled(false),
      commit: async () => {
        try {
          const result = await deleteSetupRequest(request.id);
          if (result.error) {
            setIsCancelled(false);
            toast.error(result.error);
            return;
          }
          router.refresh();
        } catch {
          setIsCancelled(false);
          toast.error("Couldn't cancel this request right now.");
        }
      },
    });
  }

  function handleOpenPicker() {
    if (!user) {
      void signInWithDiscord();
      return;
    }
    setError(null);
    setShowPicker(true);
    if (candidates === null) {
      getMyMatchingSetupsAction(request.game, request.car, request.track)
        .then(setCandidates)
        .catch(() => {
          setCandidates([]);
          setError("Couldn't load your setups right now.");
        });
    }
  }

  function handleFulfill() {
    if (!selectedSetupId) return;
    startTransition(async () => {
      try {
        const result = await fulfillSetupRequest(request.id, selectedSetupId);
        if (result.error) {
          setError(result.error);
          return;
        }
        setShowPicker(false);
        toast.success("Request fulfilled — thanks for sharing!");
        router.refresh();
      } catch {
        setError("Couldn't fulfill this request right now. Please try again.");
      }
    });
  }

  if (isCancelled) return null;

  return (
    <Card as="article" className={cn("gap-2.5 px-4 py-3.5", isFulfilled && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            {request.game}
          </div>
          <p className="font-semibold">{request.car}</p>
          <p className="text-sm text-muted-foreground">{request.track}</p>
        </div>
        {isFulfilled ? (
          <Badge variant="green">
            <CheckCircle2 className="size-3" />
            Fulfilled
          </Badge>
        ) : isOwnRequest ? (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Cancel request"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-racing-red disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      {request.notes && <p className="text-sm text-muted-foreground">{request.notes}</p>}

      <p className="text-xs text-muted-foreground/70">
        Requested by {request.requesterUsername} · {formatDate(request.createdAt)}
      </p>

      {isFulfilled ? (
        <Link
          href={`/setups/${request.fulfilledSetupId}`}
          className="text-sm font-medium text-racing-coral hover:underline"
        >
          {request.fulfilledByUsername} shared {request.fulfilledCar} @ {request.fulfilledTrack}
        </Link>
      ) : !isOwnRequest ? (
        <div className="flex flex-col gap-2">
          {!showPicker ? (
            <Button type="button" variant="outline" size="sm" onClick={handleOpenPicker} className="self-start">
              <Wrench className="size-3.5" />
              Fulfill with one of your setups
            </Button>
          ) : candidates === null ? (
            <p className="text-xs text-muted-foreground">Loading your setups...</p>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You don&apos;t have a matching {request.car} @ {request.track} setup yet —{" "}
              <Link href="/upload" className="text-racing-coral hover:underline">
                upload one
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedSetupId} onValueChange={setSelectedSetupId}>
                <SelectTrigger className="w-full sm:max-w-[240px]">
                  <SelectValue placeholder="Pick your setup" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.car} @ {c.track}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" disabled={!selectedSetupId || isPending} onClick={handleFulfill}>
                {isPending ? "Fulfilling..." : "Confirm"}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-racing-red">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
