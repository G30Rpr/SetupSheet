"use client";

import { useState, useTransition } from "react";

import { loadMoreProfileSetups } from "@/lib/actions/profile-browse";
import { SetupCard } from "@/components/setup-card";
import { Button } from "@/components/ui/button";
import { SETUP_CARD_PAGE_SIZE } from "@/lib/ui-constants";
import type { SetupCursor } from "@/lib/supabase/setups";
import type { Setup } from "@/lib/types";

export interface ProfilePagination {
  profileId: string;
  nextCursor: SetupCursor | null;
}

/**
 * Keeps profile pages lightweight by mounting one page of stateful cards and
 * fetching later pages only when requested. Saved setups can use the same
 * component without pagination and retain their local reveal behavior.
 */
export function ProfileSetupsGrid({
  setups,
  pagination,
}: {
  setups: Setup[];
  pagination?: ProfilePagination;
}) {
  const [loadedSetups, setLoadedSetups] = useState(setups);
  const [visibleCount, setVisibleCount] = useState(
    Math.min(SETUP_CARD_PAGE_SIZE, setups.length)
  );
  const [nextCursor, setNextCursor] = useState<SetupCursor | null>(
    pagination?.nextCursor ?? null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const visibleSetups = loadedSetups.slice(0, visibleCount);
  const hasLocalMore = visibleSetups.length < loadedSetups.length;
  const hasRemoteMore = Boolean(pagination && nextCursor);

  function showLoadedSetups() {
    setVisibleCount((count) => count + SETUP_CARD_PAGE_SIZE);
  }

  function loadRemoteSetups() {
    if (!pagination || !nextCursor || isLoading) return;
    const cursor = nextCursor;
    setLoadError(null);

    startTransition(async () => {
      try {
        const result = await loadMoreProfileSetups(pagination.profileId, cursor);
        if (result.error) {
          setLoadError(result.error);
          return;
        }

        setLoadedSetups((previous) => {
          const knownIds = new Set(previous.map((setup) => setup.id));
          return [
            ...previous,
            ...result.setups.filter((setup) => !knownIds.has(setup.id)),
          ];
        });
        setVisibleCount((count) => count + result.setups.length);
        setNextCursor(result.nextCursor);
      } catch {
        setLoadError("Couldn't load more profile setups right now.");
      }
    });
  }

  return (
    <>
      <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSetups.map((setup) => (
          <li key={setup.id} className="min-w-0">
            <SetupCard setup={setup} titleLevel={3} />
          </li>
        ))}
      </ul>
      {(hasLocalMore || hasRemoteMore) && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={hasLocalMore ? showLoadedSetups : loadRemoteSetups}
            disabled={isLoading}
          >
            {isLoading
              ? "Loading more setups..."
              : hasLocalMore
                ? `Load ${Math.min(SETUP_CARD_PAGE_SIZE, loadedSetups.length - visibleSetups.length)} more`
                : "Load more setups"}
          </Button>
          {loadError && (
            <p role="alert" className="text-sm text-racing-red">
              {loadError}
            </p>
          )}
        </div>
      )}
    </>
  );
}
