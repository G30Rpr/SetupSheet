// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetupCard } from "@/components/setup-card";
import { makeSetup } from "@/lib/test-helpers/make-setup";

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const baseSetup = makeSetup({
  id: "11111111-2222-4333-8444-555555555555",
  car: "Porsche 992 GT3 R",
  track: "Spa",
  description: "Stable through Eau Rouge with a safe, planted rear.",
  tags: ["Race", "Quali"],
  lapTime: "2:17.456",
  author: "Alex R.",
  pace: 4.2,
  predictability: 3.8,
  ratingCount: 6,
  downloads: 42,
  fileName: "porsche_spa.json",
  fileUrl: "https://files.example.com/porsche_spa.json",
});

describe("SetupCard slim variant (browse/profile cards)", () => {
  afterEach(cleanup);

  it("shows only the P3 card face: identity, lap time, chips, rig, scores, Download", () => {
    render(<SetupCard setup={baseSetup} />);

    // Identity: car title (detail link) + track subtitle + game/condition
    expect(screen.getByRole("link", { name: "Porsche 992 GT3 R" })).toHaveAttribute(
      "href",
      `/setups/${baseSetup.id}`
    );
    expect(screen.getByText("Spa")).toBeInTheDocument();
    expect(screen.getByText("Assetto Corsa Competizione")).toBeInTheDocument();
    expect(screen.getByText("Dry")).toBeInTheDocument();

    // Lap time in mono, labeled self-reported
    expect(screen.getByText("2:17.456")).toHaveClass("tabular-nums");
    expect(screen.getByText("self-reported")).toBeInTheDocument();

    // Chips, rig + icon, both score meters with rating count
    expect(screen.getByText("Race")).toBeInTheDocument();
    expect(screen.getByText("Quali")).toBeInTheDocument();
    expect(screen.getByText("Direct Drive + Load Cell")).toBeInTheDocument();
    expect(screen.getByText("4.2")).toBeInTheDocument();
    expect(screen.getByText("3.8")).toBeInTheDocument();
    // Rating count sits beside each score
    expect(screen.getAllByText("6 ratings")).toHaveLength(2);

    // ONE button: Download
    expect(screen.getByRole("button", { name: /Download Setup/ })).toBeInTheDocument();
  });

  it("hides install, history, comments, rate, upvote, save, and prose from cards", () => {
    render(<SetupCard setup={baseSetup} />);

    expect(screen.queryByText("How to install this setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Version history")).not.toBeInTheDocument();
    expect(screen.queryByText("Comments")).not.toBeInTheDocument();
    expect(screen.queryByText("Rate this setup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upvote|Upvote/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save setup|remove from saved/i })).not.toBeInTheDocument();
    // Prose belongs to the detail page; real (non-zero) counts can ride
    // along on the Download button, but zero counts stay hidden (P3).
    expect(screen.queryByText(/Stable through Eau Rouge/)).not.toBeInTheDocument();
    expect(screen.queryByText("0 downloads")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Setup/ })).toHaveTextContent("42 downloads");
    // Byline is the social layer — detail only
    expect(screen.queryByText("Alex R.")).not.toBeInTheDocument();
  });
  it("labels file-only setups without an author note", () => {
    const { rerender } = render(<SetupCard setup={makeSetup({ ...baseSetup, description: "" })} />);
    expect(screen.getByText("File only")).toBeInTheDocument();

    // With a note, the label is gone (the note speaks for itself).
    rerender(<SetupCard setup={baseSetup} />);
    expect(screen.queryByText("File only")).not.toBeInTheDocument();
  });
});

describe("SetupCard detail variant (setup page)", () => {
  afterEach(cleanup);

  it("keeps install, comments, and the rating controls on the detail rendering", () => {
    render(<SetupCard setup={baseSetup} variant="detail" />);

    expect(screen.getByText("How to install this setup")).toBeInTheDocument();
    expect(screen.getByText("Version history")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText(/Stable through Eau Rouge/)).toBeInTheDocument();
    expect(screen.getByText("Alex R.")).toBeInTheDocument();
  });

  it("says so in words when a legacy setup has no note", () => {
    render(<SetupCard setup={makeSetup({ ...baseSetup, description: "" })} variant="detail" />);
    expect(screen.getByText("The uploader shared the file without a note.")).toBeInTheDocument();
  });
});
