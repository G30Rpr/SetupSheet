"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SetupCard } from "@/components/setup-card";
import { SETUP_CARD_PAGE_SIZE } from "@/lib/ui-constants";
import type { Setup } from "@/lib/types";

/** Keeps profile pages lightweight by mounting only one screenful of stateful setup cards initially. */
export function ProfileSetupsGrid({ setups }: { setups: Setup[] }) {
  const [visibleCount, setVisibleCount] = useState(SETUP_CARD_PAGE_SIZE);
  const visibleSetups = setups.slice(0, visibleCount);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSetups.map((setup) => (
          <SetupCard key={setup.id} setup={setup} />
        ))}
      </div>
      {visibleSetups.length < setups.length && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((count) => count + SETUP_CARD_PAGE_SIZE)}
          >
            Load {Math.min(SETUP_CARD_PAGE_SIZE, setups.length - visibleSetups.length)} more
          </Button>
        </div>
      )}
    </>
  );
}
