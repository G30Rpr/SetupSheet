// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { SetupCardFooter } from "@/components/setup-card-footer";
import type { Setup } from "@/lib/types";

afterEach(cleanup);

const baseSetup: Setup = {
  id: "setup-1",
  game: "Assetto Corsa Competizione",
  car: "Ford Mustang GT3",
  track: "Zandvoort",
  condition: "Dry",
  lapTime: "1:35.000",
  description: "Race setup.",
  tags: [],
  rigProfile: "Wheel + 3 Pedals",
  author: "g30rpr",
  authorId: "user-2",
  authorAvatarUrl: null,
  uploadedAt: "2026-07-08T00:00:00.000Z",
  upvotes: 0,
  hasUpvoted: false,
  hasFavorited: false,
  pace: 0,
  predictability: 0,
  ratingCount: 0,
  myRating: null,
  isOwner: false,
  downloads: 0,
  fileName: null,
  fileUrl: null,
};

function renderFooter(setup: Partial<Setup>, upvotes: number) {
  const onUpvote = vi.fn();
  render(
    <SetupCardFooter
      setup={{ ...baseSetup, ...setup }}
      upvotes={upvotes}
      hasUpvoted={false}
      hasFavorited={false}
      myRating={null}
      isFavoritePending={false}
      isPending={false}
      onFavorite={vi.fn()}
      onUpvote={onUpvote}
      onRate={vi.fn()}
    />
  );
  return { onUpvote };
}

describe("SetupCardFooter rating presentation", () => {
  it("draws no rating bars for an unrated setup, and says so", () => {
    renderFooter({ ratingCount: 0, pace: 0, predictability: 0 }, 0);

    // Two empty bars read as "rated badly"; the copy has to carry the state.
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.getByText(/not yet rated/i)).toBeInTheDocument();
  });

  it("shows star values on the 5-star scale instead of bare percentages", () => {
    renderFooter({ ratingCount: 3, pace: 4.25, predictability: 3.5 }, 2);

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-label", "4.3 out of 5");
    expect(bars[0]).toHaveAttribute("aria-valuemax", "5");
    // The readout is the star value, not "85%".
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.queryByText("85%")).not.toBeInTheDocument();
    expect(screen.getByText(/3 ratings · average out of 5/i)).toBeInTheDocument();
  });
});

describe("SetupCardFooter upvote counter", () => {
  it("labels the count rather than printing a bare number", () => {
    renderFooter({}, 12);

    const button = screen.getByRole("button", { name: /upvote this setup — 12 so far/i });
    expect(button).toHaveTextContent("12 upvotes");
  });

  it("shows the action name when nothing has been upvoted yet", () => {
    renderFooter({}, 0);

    const button = screen.getByRole("button", { name: /upvote this setup — 0 so far/i });
    expect(button).toHaveTextContent("Upvote");
    expect(button).not.toHaveTextContent("0");
  });
});
