"use client";

import { useState, useTransition } from "react";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SetupRequestCard } from "@/components/setup-request-card";
import { loadMoreSetupRequests } from "@/lib/actions/setup-requests";
import type { SetupRequestCursor, SetupRequestsPage } from "@/lib/supabase/setup-requests";
import type { SetupRequest } from "@/lib/types";

/**
 * The open-requests feed with keyset pagination, plus a short, clearly
 * separated strip of recently fulfilled ones.
 *
 * Why this is a client component at all: the board used to be a single
 * server-rendered list of whatever the newest 100 rows happened to be, so
 * answered requests pushed unanswered ones off the page with no way to reach
 * them. Pagination needs state, and the mutation cards below already own
 * their own optimistic delete/undo behavior.
 */
export function SetupRequestsList({
  initialPage,
}: {
  initialPage: SetupRequestsPage;
}) {
  const [open, setOpen] = useState<SetupRequest[]>(initialPage.open);
  const [fulfilled, setFulfilled] = useState<SetupRequest[]>(initialPage.fulfilled);
  const [openTotal, setOpenTotal] = useState(initialPage.openTotal);
  const [nextCursor, setNextCursor] = useState<SetupRequestCursor | null>(initialPage.nextCursor);
  const [error, setError] = useState<string | null>(initialPage.error);
  const [isLoading, startTransition] = useTransition();

  // A mutation anywhere in a card calls router.refresh(), which hands down a
  // fresh first page. Replacing local state from that (rather than keeping a
  // hand-built list) is what stops a fulfilled request from staying visible as
  // "open" until the next full navigation.
  const [prevInitialPage, setPrevInitialPage] = useState(initialPage);
  if (prevInitialPage !== initialPage) {
    setPrevInitialPage(initialPage);
    setOpen(initialPage.open);
    setFulfilled(initialPage.fulfilled);
    setOpenTotal(initialPage.openTotal);
    setNextCursor(initialPage.nextCursor);
    setError(initialPage.error);
  }

  function loadMore() {
    if (!nextCursor || isLoading) return;
    const cursor = nextCursor;
    setError(null);

    startTransition(async () => {
      try {
        const result = await loadMoreSetupRequests(cursor);
        if (result.error) {
          setError(result.error);
          return;
        }

        setOpen((previous) => {
          const knownIds = new Set(previous.map((request) => request.id));
          return [...previous, ...result.open.filter((request) => !knownIds.has(request.id))];
        });
        setOpenTotal(result.openTotal);
        setNextCursor(result.nextCursor);
      } catch {
        setError("Couldn't load more requests right now.");
      }
    });
  }

  const shownOpen = open.length;

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-3">
        {open.map((request) => (
          <li key={request.id}>
            <SetupRequestCard request={request} />
          </li>
        ))}
      </ul>

      {(shownOpen > 0 || nextCursor) && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing {shownOpen} of {openTotal} open {openTotal === 1 ? "request" : "requests"}
          </p>
          {nextCursor && (
            <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoading}>
              {isLoading ? "Loading more requests..." : "Load more open requests"}
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-racing-red">
              {error}
            </p>
          )}
        </div>
      )}

      {fulfilled.length > 0 && (
        <section aria-labelledby="recently-fulfilled-heading" className="flex flex-col gap-3">
          <h3
            id="recently-fulfilled-heading"
            className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <CheckCheck className="size-4 text-racing-green" />
            Recently fulfilled
          </h3>
          <ul className="flex flex-col gap-3 opacity-80">
            {fulfilled.map((request) => (
              <li key={request.id}>
                <SetupRequestCard request={request} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
