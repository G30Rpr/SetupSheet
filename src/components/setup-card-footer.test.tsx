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

function renderFooter(
  setup: Partial<Setup>,
  upvotes: number,
  options: { showRigSubScores?: boolean } = {}
) {
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
      showRigSubScores={options.showRigSubScores}
    />
  );
  return { onUpvote };
}

describe("SetupCardFooter rating presentation", () => {
  it("draws no rating bars for an unrated setup, and says so", () => {
    renderFooter({ ratingCount: 0, pace: 0, predictability: 0 }, 0);

    // Two empty bars read as "rated badly"; the copy has to carry the state.
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.getByText("Unrated")).toBeInTheDocument();
    // No "be the first" bait either.
    expect(screen.queryByText(/be the first/i)).not.toBeInTheDocument();
  });

  it("shows 0-5 scores with their rating counts instead of percentages or stars", () => {
    renderFooter({ ratingCount: 3, pace: 4.25, predictability: 3.5 }, 2);

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-label", "4.3 out of 5");
    expect(bars[0]).toHaveAttribute("aria-valuemax", "5");
    // The readout is the score on the 0-5 scale, not "85%".
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.queryByText("85%")).not.toBeInTheDocument();
    // Count sits beside each meter.
    expect(screen.getAllByText("3 ratings")).toHaveLength(2);
    // Pace = amber bar, Predictability = green bar.
    expect(bars[0].firstElementChild).toHaveClass("bg-pace");
    expect(bars[1].firstElementChild).toHaveClass("bg-predictability");
  });

  it("labels a single rating in the singular", () => {
    renderFooter({ ratingCount: 1, pace: 5, predictability: 5 }, 0);

    expect(screen.getAllByText("1 rating")).toHaveLength(2);
  });
});

describe("SetupCardFooter upvote counter", () => {
  it("labels the count rather than printing a bare number", () => {
    renderFooter({}, 12);

    // WCAG label-in-name: the visible count is part of the accessible name.
    const button = screen.getByRole("button", { name: /12 upvotes.*upvote this setup/i });
    expect(button).toHaveTextContent("12 upvotes");
  });

  it("shows the action name when nothing has been upvoted yet", () => {
    renderFooter({}, 0);

    const button = screen.getByRole("button", { name: /^upvote.*upvote this setup/i });
    expect(button).toHaveTextContent("Upvote");
    expect(button).not.toHaveTextContent("0");
  });
});

describe("SetupCardFooter similar-rig split", () => {
  it("shows On a similar rig vs Everyone else with counts, Unrated on empty sides", () => {
    renderFooter(
      {
        ratingCount: 3,
        pace: 4.0,
        predictability: 3.7,
        ratingSplits: [
          { rigProfile: "Wheel + 3 Pedals", paceSum: 12, paceN: 3, predSum: 11, predN: 3 },
          { rigProfile: "Gamepad", paceSum: 4, paceN: 1, predSum: 2, predN: 1 },
          { rigProfile: null, paceSum: 5, paceN: 1, predSum: 4, predN: 1 },
        ],
      },
      0
    );

    expect(screen.getByText("On a similar rig")).toBeInTheDocument();
    expect(screen.getByText("Everyone else")).toBeInTheDocument();
    // Anchor defaults to the setup's own rig (server HTML): 12/3 and 11/3.
    expect(screen.getByText("4.0 (3)")).toBeInTheDocument();
    expect(screen.getByText("3.7 (3)")).toBeInTheDocument();
    // Everyone else merges the Gamepad bucket and the unshared-rig rating.
    expect(screen.getByText("4.5 (2)")).toBeInTheDocument();
    expect(screen.getByText("3.0 (2)")).toBeInTheDocument();
  });

  it("says Unrated on a side with no ratings, and hides the split entirely without rating data", () => {
    renderFooter(
      {
        ratingCount: 1,
        pace: 4.0,
        predictability: 4.0,
        ratingSplits: [{ rigProfile: "Gamepad", paceSum: 4, paceN: 1, predSum: 4, predN: 1 }],
      },
      0
    );
    // Similar (Wheel + 3 Pedals) has nothing — both cells read Unrated.
    expect(screen.getAllByText("Unrated").length).toBeGreaterThanOrEqual(2);
    cleanup();

    renderFooter({ ratingCount: 0, pace: 0, predictability: 0, ratingSplits: [] }, 0);
    expect(screen.queryByText("On a similar rig")).not.toBeInTheDocument();
    expect(screen.queryByText("Everyone else")).not.toBeInTheDocument();
  });
});

describe("SetupCardFooter per-rig-type sub-scores (2c)", () => {
  const splits = [
    // Established on both scores (n >= 3).
    { rigProfile: "Gamepad", paceSum: 12, paceN: 3, predSum: 10.8, predN: 3 },
    // Established on pace only; predictability withheld (n = 2).
    { rigProfile: "Wheel + 3 Pedals", paceSum: 13.2, paceN: 3, predSum: 8, predN: 2 },
    // Below the floor on both: row omitted entirely.
    { rigProfile: "Direct Drive + Load Cell", paceSum: 5, paceN: 1, predSum: 4, predN: 1 },
    // Not a rig type: omitted.
    { rigProfile: null, paceSum: 5, paceN: 1, predSum: 4, predN: 1 },
  ];

  it("shows rig types at n >= 3 per score, withholds thinner scores behind a dash", () => {
    renderFooter(
      {
        rigProfile: "Direct Drive + Load Cell",
        ratingCount: 7,
        pace: 4,
        predictability: 3.8,
        ratingSplits: splits,
      },
      0,
      { showRigSubScores: true }
    );

    expect(screen.getByText("By rig type (3+ ratings)")).toBeInTheDocument();
    expect(screen.getByText("Gamepad")).toBeInTheDocument();
    expect(screen.getByText("Wheel + 3 Pedals")).toBeInTheDocument();
    // Gamepad means: 12/3 pace, 10.8/3 predictability.
    expect(screen.getByText("4.0 (3)")).toBeInTheDocument();
    expect(screen.getByText("3.6 (3)")).toBeInTheDocument();
    // Wheel's pace clears the floor; its 2 predictability ratings are withheld.
    expect(screen.getByText("4.4 (3)")).toBeInTheDocument();
    const dash = screen.getByTitle(/fewer than 3 ratings from this rig type/i);
    expect(dash).toHaveTextContent("—");
    // Below-floor rig type and the unshared-rig bucket never render as rows.
    expect(screen.queryAllByText("Direct Drive + Load Cell").length).toBe(1);
  });

  it("stays hidden on browse cards (slim) and when no rig type clears the floor", () => {
    renderFooter({ ratingCount: 7, pace: 4, predictability: 3.8, ratingSplits: splits }, 0);
    expect(screen.queryByText("By rig type (3+ ratings)")).not.toBeInTheDocument();
    cleanup();

    renderFooter(
      {
        ratingCount: 1,
        pace: 4,
        predictability: 4,
        ratingSplits: [{ rigProfile: "Gamepad", paceSum: 4, paceN: 1, predSum: 4, predN: 1 }],
      },
      0,
      { showRigSubScores: true }
    );
    expect(screen.queryByText("By rig type (3+ ratings)")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/fewer than 3 ratings/i)).not.toBeInTheDocument();
  });
});
