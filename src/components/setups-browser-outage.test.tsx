// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ALL } from "@/lib/filter-setups";

vi.mock("@/lib/actions/setup-browse", () => ({ loadMoreSetups: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/setup-card", () => ({
  SetupCard: ({ setup }: { setup: { car: string } }) => <div data-testid="card">{setup.car}</div>,
}));

import { SetupsBrowser, sortOptions } from "@/components/setups-browser";

const EMPTY_FILTERS = {
  search: "",
  game: ALL,
  car: ALL,
  track: ALL,
  condition: ALL,
  rig: ALL,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("SetupsBrowser degraded read", () => {
  it("shows an outage with a retry instead of claiming the community is empty", () => {
    render(
      <SetupsBrowser setups={[]} totalCount={0} initialFilters={EMPTY_FILTERS} loadFailed />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load setups/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no setups yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no setups match your filters/i)).not.toBeInTheDocument();
    // "0 setups found" next to an error reads as a filter problem.
    expect(screen.queryByText(/setups found/i)).not.toBeInTheDocument();
  });

  it("keeps the quiet empty state when the library really is empty", () => {
    render(<SetupsBrowser setups={[]} totalCount={0} initialFilters={EMPTY_FILTERS} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/no setups yet/i)).toBeInTheDocument();
    expect(screen.getByText(/0 setups found/i)).toBeInTheDocument();
  });
});

describe("sort labels", () => {
  it("names each sort by what it actually does", () => {
    const labels = Object.fromEntries(sortOptions.map((option) => [option.value, option.label]));

    // Sort URLs people already shared keep working ("trending"), but the label
    // no longer implies a recency weighting the sort doesn't apply.
    expect(labels.trending).toBe("Most upvoted");
    expect(labels.mostDownloaded).toBe("Most downloaded");
    expect(labels.safest).toBe("Safest (predictability)");
    expect(labels.fastest).toBe("Fastest lap time");
    expect(labels.newest).toBe("Newest first");
  });
});
