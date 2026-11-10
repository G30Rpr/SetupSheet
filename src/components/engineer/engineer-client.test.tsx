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

import { makeSetup } from "@/lib/test-helpers/make-setup";

vi.mock("@/components/setup-card", () => ({ SetupCard: ({ setup }: { setup: { car: string; track: string } }) => <div>{setup.car} at {setup.track}</div> }));

import { EngineerClient } from "@/components/engineer/engineer-client";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  loadEngineerCalibrationMock.mockResolvedValue({ status: "available", factors: [] });
});

describe("EngineerClient", () => {
  it("filters community setups by car and track without changing the test plan", () => {
    render(<EngineerClient setups={[
      makeSetup({ id: "one", game: "Assetto Corsa Competizione", car: "Porsche", track: "Spa", tags: ["Safe"], condition: "Dry" }),
      makeSetup({ id: "two", game: "Assetto Corsa Competizione", car: "Porsche", track: "Monza", tags: ["Safe"], condition: "Dry" }),
      makeSetup({ id: "three", game: "Assetto Corsa Competizione", car: "BMW", track: "Spa", tags: ["Safe"], condition: "Dry" }),
    ]} />);
    fireEvent.change(screen.getByLabelText("Car for community setups"), { target: { value: "Porsche" } });
    expect(screen.queryByText("BMW at Spa")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Track for community setups"), { target: { value: "Spa" } });
    expect(screen.getByText("Porsche at Spa")).toBeInTheDocument();
    expect(screen.queryByText("Porsche at Monza")).not.toBeInTheDocument();
    expect(screen.getByText("Brake bias")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Car for community setups"), { target: { value: "BMW" } });
    expect(screen.getByLabelText("Track for community setups")).toHaveValue("");
  });

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
    expect(await screen.findByText(/community test results could not be loaded/i)).toBeInTheDocument();
  });
});
