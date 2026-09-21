// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/empty-state";

describe("EmptyState", () => {
  it("stays a quiet status (not an alert) when a collection is genuinely empty", () => {
    render(
      <EmptyState
        icon={TriangleAlert}
        title="No requests yet"
        description="Be the first to ask the community for a setup."
      />
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No requests yet")).toBeInTheDocument();
    expect(screen.getByText(/be the first/i)).toBeInTheDocument();
  });

  it("announces itself and offers the action when a read failed", () => {
    render(
      <EmptyState
        tone="error"
        icon={TriangleAlert}
        title="Couldn't load the requests board"
        description="The board isn't responding right now."
        action={<button type="button">Try again</button>}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the requests board");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
