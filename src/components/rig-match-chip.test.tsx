// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { RigMatchChip } from "@/components/rig-match-chip";

afterEach(cleanup);

describe("RigMatchChip", () => {
  it("names the match plainly", () => {
    render(<RigMatchChip />);
    expect(screen.getByText("Matches your rig")).toBeInTheDocument();
  });

  it("is hardware context only -- no score or percentage implied", () => {
    render(<RigMatchChip />);
    const label = screen.getByText("Matches your rig");
    expect(label.textContent).not.toMatch(/%|\d\.\d/);
  });

  it("explains what it means via title without sounding established", () => {
    render(<RigMatchChip />);
    const chip = screen.getByTitle(/same steering and brake hardware/i);
    expect(chip).toBeInTheDocument();
  });
});
