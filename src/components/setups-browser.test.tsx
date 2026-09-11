// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ALL } from "@/lib/filter-setups";
import type { Setup } from "@/lib/types";

const { loadMoreSetups } = vi.hoisted(() => ({ loadMoreSetups: vi.fn() }));

vi.mock("@/lib/actions/setup-browse", () => ({ loadMoreSetups }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// The card is a heavy client subtree (auth context, four lazy panels); the
// browse pagination contract only needs to know which setups are mounted.
vi.mock("@/components/setup-card", () => ({
  SetupCard: ({ setup }: { setup: { car: string } }) => <div data-testid="card">{setup.car}</div>,
}));

import { SetupsBrowser } from "@/components/setups-browser";

function makeSetup(id: string, car: string, createdAt: string): Setup {
  return {
    id,
    game: "iRacing",
    car,
    track: "Spa-Francorchamps",
    condition: "Dry",
    lapTime: "2:16.000",
    description: "",
    tags: [],
    rigProfile: "Wheel + 3 Pedals",
    author: "Racer",
    authorId: "11111111-1111-4111-8111-111111111111",
    authorAvatarUrl: null,
    uploadedAt: createdAt,
    upvotes: 0,
    hasUpvoted: false,
    hasFavorited: false,
    pace: 4,
    predictability: 4,
    ratingCount: 0,
    myRating: null,
    isOwner: false,
    downloads: 0,
    fileName: null,
    fileUrl: null,
    videoUrl: null,
    telemetryFileName: null,
    telemetryFileUrl: null,
    isVerifiedLap: false,
  };
}

const INDEX = [
  makeSetup("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Newest", "2026-08-30T10:00:00.000Z"),
  makeSetup("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Oldest", "2026-08-29T10:00:00.000Z"),
];

const EMPTY_FILTERS = {
  search: "",
  game: ALL,
  car: ALL,
  track: ALL,
  condition: ALL,
  rig: ALL,
};

function renderBrowser(setups = INDEX) {
  return render(
    <SetupsBrowser setups={setups} totalCount={500} initialFilters={EMPTY_FILTERS} />
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("SetupsBrowser remote paging", () => {
  it("cursors older pages from the last row of the current index", async () => {
    loadMoreSetups.mockResolvedValue({
      setups: [makeSetup("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Older", "2026-08-28T10:00:00.000Z")],
      nextCursor: null,
      error: null,
    });
    renderBrowser();

    fireEvent.click(screen.getByRole("button", { name: "Load older setups" }));

    await screen.findByText("Older");
    expect(loadMoreSetups).toHaveBeenCalledTimes(1);
    expect(loadMoreSetups.mock.calls[0][0]).toEqual({
      createdAt: "2026-08-29T10:00:00.000Z",
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
  });

  it("drops appended pages and re-seeds the cursor when a filter changes", async () => {
    loadMoreSetups.mockResolvedValue({
      setups: [makeSetup("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Older", "2026-08-28T10:00:00.000Z")],
      nextCursor: { createdAt: "2026-08-28T10:00:00.000Z", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
      error: null,
    });
    renderBrowser();

    fireEvent.click(screen.getByRole("button", { name: "Load older setups" }));
    await screen.findByText("Older");

    // Narrowing the query has to discard rows fetched for the previous one --
    // otherwise they linger in the index (or, worse, the next page resumes from
    // a cursor that belongs to a different filter and silently skips setups).
    fireEvent.change(screen.getByRole("combobox", { name: "Search setups" }), {
      target: { value: "porsche" },
    });

    expect(screen.queryByText("Older")).not.toBeInTheDocument();

    loadMoreSetups.mockResolvedValue({ setups: [], nextCursor: null, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Load older setups" }));

    await waitFor(() => expect(loadMoreSetups).toHaveBeenCalledTimes(2));
    expect(loadMoreSetups.mock.calls[1][0]).toEqual({
      createdAt: "2026-08-29T10:00:00.000Z",
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(loadMoreSetups.mock.calls[1][1]).toMatchObject({ search: "porsche" });
  });
});
