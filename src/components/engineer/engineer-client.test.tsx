// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EngineerClient } from "@/components/engineer/engineer-client";

afterEach(cleanup);

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
});
