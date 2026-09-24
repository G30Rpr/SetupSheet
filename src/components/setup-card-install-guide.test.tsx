// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import SetupCardInstallGuide from "@/components/setup-card-install-guide";
import type { Setup } from "@/lib/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    game: "Assetto Corsa Competizione",
    car: "Ford Mustang GT3",
    track: "Zandvoort",
    condition: "Dry",
    lapTime: "1:35.000",
    description: "Race setup.",
    tags: [],
    rigProfile: "Wheel + 3 Pedals",
    author: "g30rpr",
    authorId: "22222222-2222-4222-8222-222222222222",
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
    fileName: "mustang-zandvoort.json",
    fileUrl: "https://storage.example/setup-files/user/mustang-zandvoort.json",
    ...overrides,
  };
}

describe("SetupCardInstallGuide", () => {
  it("resolves the destination folder for this car and track, and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SetupCardInstallGuide setup={makeSetup()} />);

    const expected = String.raw`Documents\Assetto Corsa Competizione\Setups\Ford Mustang GT3\Zandvoort`;
    expect(screen.getByText(expected)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy the destination folder path/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());
  });

  it("offers the install bundle as a plain download link", () => {
    render(<SetupCardInstallGuide setup={makeSetup()} />);

    const link = screen.getByRole("link", { name: /download install bundle/i });
    expect(link).toHaveAttribute("href", `/api/setups/${makeSetup().id}/bundle`);
    expect(link).toHaveAttribute("download");
  });

  it("points manual-entry titles at the copy-values button instead of a bundle", () => {
    render(<SetupCardInstallGuide setup={makeSetup({ game: "F1 25" })} />);

    expect(screen.getByText("Manual entry only")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download install bundle/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/destination folder/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Copy values/)).toBeInTheDocument();
  });

  it("keeps a placeholder it cannot fill, and shows the note that explains it", () => {
    render(<SetupCardInstallGuide setup={makeSetup({ game: "Automobilista 2" })} />);

    // The resolved path shows up twice on purpose: once inside the numbered
    // step, once in the copyable block (with the token left visible for the
    // user to replace, since we can't know their Windows username).
    expect(screen.getAllByText(/savegame[\\/]\{profile\}/)).toHaveLength(2);
    expect(screen.getByText(/Windows username/i)).toBeInTheDocument();
  });

  it("hides the bundle when there is nothing to bundle", () => {
    render(<SetupCardInstallGuide setup={makeSetup({ fileUrl: null, fileName: null })} />);

    expect(screen.queryByRole("link", { name: /download install bundle/i })).not.toBeInTheDocument();
  });
});
