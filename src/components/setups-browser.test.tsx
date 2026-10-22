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
  tag: ALL,
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

describe("SetupsBrowser empty-combo handoff", () => {
  it("offers Request + Engineer instead of a dead end when filters match nothing", () => {
    render(
      <SetupsBrowser
        setups={INDEX}
        totalCount={500}
        initialFilters={{
          search: "",
          game: "iRacing",
          car: "Phantom GT",
          track: "Spa-Francorchamps",
          condition: "Dry",
          rig: "Gamepad",
          tag: ALL,
        }}
      />
    );

    expect(screen.getByText("No setup for this combo yet.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nobody has shared a Gamepad setup for Phantom GT at Spa-Francorchamps in the Dry."
      )
    ).toBeInTheDocument();

    const ask = screen.getByRole("link", { name: "Ask for this combo" });
    expect(ask.getAttribute("href")).toContain("/requests?");
    expect(ask.getAttribute("href")).toContain("car=Phantom+GT");
    expect(ask.getAttribute("href")).toContain("rig=Gamepad");
    expect(
      screen.getByRole("link", { name: "Get a first change to test" })
    ).toHaveAttribute("href", "/engineer");
    // Never a blank list alongside the handoff.
    expect(screen.queryAllByTestId("card")).toHaveLength(0);
  });

  it("describes a search-only miss without inventing combo fields", () => {
    render(
      <SetupsBrowser
        setups={INDEX}
        totalCount={500}
        initialFilters={{ ...EMPTY_FILTERS, search: "spaceship" }}
      />
    );

    expect(
      screen.getByText("Nobody has shared a setup matching “spaceship” yet.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for this combo" })).toHaveAttribute(
      "href",
      "/requests"
    );
  });
});

describe("SetupsBrowser hidden rigs", () => {
  const MIXED = [
    makeSetup("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Matched", "2026-08-30T10:00:00.000Z"),
    { ...makeSetup("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Gamepad One", "2026-08-29T10:00:00.000Z"), rigProfile: "Gamepad" as const },
    { ...makeSetup("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Gamepad Two", "2026-08-28T10:00:00.000Z"), rigProfile: "Gamepad" as const },
  ];

  it("names the hidden rig categories and lets them be shown", () => {
    render(
      <SetupsBrowser
        setups={MIXED}
        totalCount={500}
        initialFilters={{ ...EMPTY_FILTERS, rig: "Wheel + 3 Pedals" }}
      />
    );

    // Rig filter active: only the matching card is listed...
    expect(screen.getAllByTestId("card")).toHaveLength(1);
    // ...and the hidden category is named in a quiet line.
    expect(
      screen.getByText(/Hiding Gamepad setups that don't match your rig\./)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show them" }));
    expect(screen.getAllByTestId("card")).toHaveLength(3);
    expect(
      screen.queryByText(/Hiding Gamepad setups/)
    ).not.toBeInTheDocument();
  });

  it("says nothing when no other rigs are hidden", () => {
    const allGamepad = MIXED.map((setup) => ({ ...setup, rigProfile: "Gamepad" as const }));
    render(
      <SetupsBrowser
        setups={allGamepad}
        totalCount={500}
        initialFilters={{ ...EMPTY_FILTERS, rig: "Gamepad" }}
      />
    );

    expect(screen.getAllByTestId("card")).toHaveLength(3);
    expect(screen.queryByText(/Hiding/)).not.toBeInTheDocument();
  });
});
