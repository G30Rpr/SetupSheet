// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SetupCard } from "@/components/setup-card";
import type { Setup } from "@/lib/types";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
const { useRouterMock } = vi.hoisted(() => ({ useRouterMock: vi.fn() }));
const { toggleFavoriteMock } = vi.hoisted(() => ({ toggleFavoriteMock: vi.fn() }));
const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));

vi.mock("@/components/auth-provider", () => ({ useAuth: useAuthMock }));

vi.mock("next/navigation", () => ({ useRouter: useRouterMock }));

vi.mock("@/lib/actions/setups", () => ({
  deleteSetup: vi.fn(),
  downloadSetup: vi.fn(),
  rateSetup: vi.fn(),
  recordSetupExport: vi.fn(),
  toggleUpvote: vi.fn(),
}));

vi.mock("@/lib/actions/setup-favorites", () => ({ toggleFavorite: toggleFavoriteMock }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastErrorMock, success: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseSetup: Setup = {
  id: "setup-1",
  game: "iRacing",
  car: "BMW M4 GT3",
  track: "Spa-Francorchamps",
  condition: "Dry",
  lapTime: "2:19.104",
  description: "Stable quali setup.",
  tags: [],
  rigProfile: "Direct Drive + Load Cell",
  author: "Max",
  authorId: "user-2",
  authorAvatarUrl: null,
  uploadedAt: "2026-07-01T00:00:00.000Z",
  upvotes: 3,
  hasUpvoted: false,
  hasFavorited: false,
  pace: 4.2,
  predictability: 4.5,
  ratingCount: 6,
  myRating: null,
  isOwner: false,
  downloads: 0,
  fileName: null,
  fileUrl: null,
};

function favoriteButton() {
  return screen.getByRole("button", { name: /save setup|remove from saved setups/i });
}

describe("SetupCard favorite button", () => {
  it("toggles to favorited on click and calls toggleFavorite", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, signInWithDiscord: vi.fn() });
    useRouterMock.mockReturnValue({ refresh: vi.fn() });
    toggleFavoriteMock.mockResolvedValue({ error: null });

    render(<SetupCard setup={baseSetup} />);

    const button = favoriteButton();
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAccessibleName("Remove from saved setups");
    await waitFor(() => expect(toggleFavoriteMock).toHaveBeenCalledWith("setup-1", false));
  });

  it("reverts the optimistic toggle and shows a toast when the server call fails", async () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, signInWithDiscord: vi.fn() });
    useRouterMock.mockReturnValue({ refresh: vi.fn() });
    toggleFavoriteMock.mockResolvedValue({ error: "Couldn't save that right now." });

    render(<SetupCard setup={baseSetup} />);

    fireEvent.click(favoriteButton());

    await waitFor(() => expect(favoriteButton()).toHaveAttribute("aria-pressed", "false"));
    expect(toastErrorMock).toHaveBeenCalledWith("Couldn't save that right now.");
  });

  it("prompts login instead of favoriting when logged out", () => {
    const signInWithDiscord = vi.fn();
    useAuthMock.mockReturnValue({ user: null, signInWithDiscord });
    useRouterMock.mockReturnValue({ refresh: vi.fn() });

    render(<SetupCard setup={baseSetup} />);

    fireEvent.click(favoriteButton());

    expect(signInWithDiscord).toHaveBeenCalledTimes(1);
    expect(toggleFavoriteMock).not.toHaveBeenCalled();
    expect(favoriteButton()).toHaveAttribute("aria-pressed", "false");
  });
});
