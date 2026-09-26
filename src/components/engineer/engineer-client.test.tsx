// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadEngineerCalibrationMock } = vi.hoisted(() => ({
  loadEngineerCalibrationMock: vi.fn(),
}));
vi.mock("@/lib/actions/engineer-calibration", () => ({
  loadEngineerCalibration: loadEngineerCalibrationMock,
}));

import { EngineerClient } from "@/components/engineer/engineer-client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  loadEngineerCalibrationMock.mockResolvedValue({ status: "available", factors: [] });
});

describe("EngineerClient", () => {
  it("shows the static recommendations anonymously", () => {
    render(<EngineerClient />);

    expect(screen.getByRole("heading", { name: "Find a calmer next setup change" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommended changes" })).toBeInTheDocument();
    expect(screen.getByText("Brake bias")).toBeInTheDocument();
    expect(screen.getByText("ABS")).toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });

  it("recomputes the plan when wet conditions are selected", () => {
    render(<EngineerClient />);

    fireEvent.click(screen.getByRole("button", { name: "Wet" }));

    expect(screen.getByText("Wet rules applied")).toBeInTheDocument();
    expect(screen.queryByText("Brake bias")).not.toBeInTheDocument();
    expect(screen.getByText("ABS")).toBeInTheDocument();
    expect(screen.getByText(/brake-bias advice is withheld/i)).toBeInTheDocument();
  });

  it("uses exact public evidence to reorder recommendations without changing amounts", async () => {
    loadEngineerCalibrationMock.mockResolvedValue({
      status: "available",
      factors: [{
        game: "Assetto Corsa Competizione",
        condition: "dry",
        parameter: "ABS",
        direction: "increase",
        sampleCount: 5,
        factor: 1.2222222222,
      }],
    });
    render(<EngineerClient />);

    await screen.findByText("5 public setups");

    const headings = within(screen.getByRole("list", { name: "Ranked setup changes" }))
      .getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("ABS");
    expect(headings[0].closest("li")).toHaveTextContent("2 levels");
    expect(headings[0].closest("li")).toHaveTextContent("5 public setups");
    expect(headings[1]).toHaveTextContent("Brake bias");
    expect(screen.getByText(/adjusted ranking only/i)).toBeInTheDocument();
  });

  it("keeps the static plan available when the public evidence lookup fails", async () => {
    loadEngineerCalibrationMock.mockRejectedValue(new Error("network failure"));
    render(<EngineerClient />);

    expect(screen.getByText("Brake bias")).toBeInTheDocument();
    expect(screen.getByText("ABS")).toBeInTheDocument();
    expect(await screen.findByText(/public evidence could not be loaded/i)).toBeInTheDocument();
  });
});
