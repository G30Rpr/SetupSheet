// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const rateSetup = vi.fn();
const dismissRatingPrompt = vi.fn();
vi.mock("@/lib/actions/setups", () => ({ rateSetup: (...a: unknown[]) => rateSetup(...a) }));
vi.mock("@/lib/actions/rating-prompts", () => ({
  dismissRatingPrompt: (...a: unknown[]) => dismissRatingPrompt(...a),
}));

import { RatingPrompt } from "@/components/rating-prompt";

afterEach(() => {
  cleanup();
  rateSetup.mockReset();
  dismissRatingPrompt.mockReset();
});

const prompt = {
  setupId: "setup-1",
  game: "Assetto Corsa Competizione",
  car: "BMW M4 GT3 2021",
  track: "Spa-Francorchamps",
  downloadedAt: "2026-10-20T00:00:00.000Z",
};

describe("RatingPrompt (24h post-download)", () => {
  it("asks how it felt and shares both scores in three taps", async () => {
    rateSetup.mockResolvedValue({ error: null });
    render(<RatingPrompt prompt={prompt} />);

    expect(screen.getByText(/how did it feel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share rating" })).toBeDisabled();

    // Tap 1: pace. Tap 2: predictability. Tap 3: share.
    fireEvent.click(screen.getByRole("button", { name: "Pace: 4 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Predictability: 5 of 5" }));
    const share = screen.getByRole("button", { name: "Share rating" });
    expect(share).toBeEnabled();
    fireEvent.click(share);

    await vi.waitFor(() => {
      expect(rateSetup).toHaveBeenCalledWith("setup-1", 4, 5, null);
      expect(screen.getByText(/is on the record/i)).toBeInTheDocument();
    });
  });

  it("keeps the share button disabled until both scores are tapped", () => {
    render(<RatingPrompt prompt={prompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Pace: 3 of 5" }));
    expect(screen.getByRole("button", { name: "Share rating" })).toBeDisabled();
  });

  it("surfaces a rating error without losing the tapped scores", async () => {
    rateSetup.mockResolvedValue({ error: "You can't rate your own setup." });
    render(<RatingPrompt prompt={prompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Pace: 2 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Predictability: 2 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Share rating" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("You can't rate your own setup.");
    });
    expect(screen.getByRole("button", { name: "Share rating" })).toBeEnabled();
  });

  it("dismisses permanently in one tap on success", async () => {
    dismissRatingPrompt.mockResolvedValue({ ok: true });
    const { container } = render(<RatingPrompt prompt={prompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await vi.waitFor(() => {
      expect(dismissRatingPrompt).toHaveBeenCalledWith("setup-1");
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("stays visible when the dismiss write fails", async () => {
    dismissRatingPrompt.mockResolvedValue({ ok: false, error: "nope" });
    render(<RatingPrompt prompt={prompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await vi.waitFor(() => {
      expect(dismissRatingPrompt).toHaveBeenCalled();
    });
    expect(screen.getByText(/how did it feel/i)).toBeInTheDocument();
  });
});
