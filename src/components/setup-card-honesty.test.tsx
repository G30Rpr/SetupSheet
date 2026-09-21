// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { Setup } from "@/lib/types";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("@/components/auth-provider", () => ({ useAuth: useAuthMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/setups", () => ({
  deleteSetup: vi.fn(),
  downloadSetup: vi.fn(),
  rateSetup: vi.fn(),
  recordSetupExport: vi.fn(),
  toggleUpvote: vi.fn(),
}));
vi.mock("@/lib/actions/setup-favorites", () => ({ toggleFavorite: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import { SetupCard } from "@/components/setup-card";

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: null, signInWithDiscord: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseSetup: Setup = {
  id: "setup-1",
  game: "Assetto Corsa Competizione",
  car: "Ford Mustang GT3",
  track: "Zandvoort",
  condition: "Dry",
  lapTime: "1:35.000",
  description: "Race setup with a stable rear.",
  tags: ["Race"],
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

describe("SetupCard trust labels", () => {
  it("never labels a setup 'Verified' just because a file is attached", () => {
    render(
      <SetupCard
        setup={{ ...baseSetup, fileUrl: "https://example.com/x.json", fileName: "x.json" }}
      />
    );

    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.getByText("File included")).toBeInTheDocument();
  });

  it("keeps 'Verified Lap' for attached evidence and defines it in place", () => {
    render(
      <SetupCard
        setup={{ ...baseSetup, isVerifiedLap: true, videoUrl: "https://youtu.be/abc" }}
      />
    );

    const badge = screen.getByText("Verified Lap");
    expect(badge).toHaveAttribute("title", expect.stringContaining("not a site verification"));
  });

  it("does not advertise a zero download count", () => {
    render(<SetupCard setup={baseSetup} />);

    expect(screen.queryByText("0 downloads")).not.toBeInTheDocument();
    expect(screen.getByText(/be the first/i)).toBeInTheDocument();
  });
});

describe("SetupCard actions", () => {
  it("keeps report and share behind one overflow menu instead of on every card face", () => {
    render(<SetupCard setup={baseSetup} />);

    expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
    // Radix unmounts closed menu content, so the report link is one tap in.
    expect(screen.queryByRole("link", { name: /report setup/i })).not.toBeInTheDocument();
  });
});
