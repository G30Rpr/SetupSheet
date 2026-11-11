// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RigMode } from "@/components/rig-mode";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  game: "Assetto Corsa Competizione" as const,
  car: "GT3 Test Car",
  track: "Spa-Francorchamps",
  condition: "Dry" as const,
  rigProfile: "Direct Drive + Load Cell" as const,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RigMode", () => {
  it("shows an honest install handoff when no values were submitted", () => {
    render(<RigMode setup={{ ...base, setupValues: {} }} />);
    expect(screen.getByRole("heading", { name: "No individual setup values attached" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View download and install options" })).toHaveAttribute(
      "href", `/setups/${base.id}`
    );
    expect(screen.queryByRole("button", { name: "Copy all values" })).not.toBeInTheDocument();
  });

  it("renders real values in large-value rows and allows copying", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<RigMode setup={{ ...base, setupValues: { frontTyrePressure: "26.4 psi", rearTyrePressure: "26.7 psi" } }} />);
    expect(screen.getByRole("heading", { name: "GT3 Test Car" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /Copy/ });
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Copy all values" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("26.4 psi");
    expect(writeText.mock.calls[0][0]).toContain("26.7 psi");
  });
});
