// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProfileSetupsGrid } from "@/components/profile-setups-grid";
import { loadMoreProfileSetups } from "@/lib/actions/profile-browse";
import { makeSetup } from "@/lib/test-helpers/make-setup";

vi.mock("@/components/setup-card", () => ({
  SetupCard: ({ setup }: { setup: { id: string } }) => <article>{setup.id}</article>,
}));

vi.mock("@/lib/actions/profile-browse", () => ({
  loadMoreProfileSetups: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const cursor = {
  createdAt: "2026-08-27T00:00:00.000Z",
  id: "22222222-2222-4222-8222-222222222222",
};

const initialSetup = makeSetup({ id: "setup-1" });
const laterSetup = makeSetup({ id: "setup-25", uploadedAt: "2026-01-02T00:00:00.000Z" });

describe("ProfileSetupsGrid", () => {
  it("loads and reveals the next server page without duplicate cards", async () => {
    vi.mocked(loadMoreProfileSetups).mockResolvedValue({
      setups: [initialSetup, laterSetup],
      nextCursor: null,
      error: null,
    });

    render(
      <ProfileSetupsGrid
        setups={[initialSetup]}
        pagination={{ profileId: "11111111-1111-4111-8111-111111111111", nextCursor: cursor }}
      />
    );

    expect(screen.getByText("setup-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more setups" }));

    await waitFor(() => expect(screen.getByText("setup-25")).toBeInTheDocument());
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(loadMoreProfileSetups).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      cursor
    );
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows a recoverable error when a later page fails", async () => {
    vi.mocked(loadMoreProfileSetups).mockResolvedValue({
      setups: [],
      nextCursor: null,
      error: "Couldn't load more profile setups right now.",
    });

    render(
      <ProfileSetupsGrid
        setups={[initialSetup]}
        pagination={{ profileId: "11111111-1111-4111-8111-111111111111", nextCursor: cursor }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more setups" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load more profile setups right now."
    );
    expect(screen.getByRole("button", { name: "Load more setups" })).toBeEnabled();
  });
});
