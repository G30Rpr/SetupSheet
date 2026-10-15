// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PublicFieldTestReports } from "@/components/public-field-test-reports";
import type { PublicFieldTestSummary } from "@/lib/supabase/field-tests";

afterEach(cleanup);

const summary: PublicFieldTestSummary = {
  error: false,
  reportCount: 1,
  reports: [{
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    setupId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    game: "Assetto Corsa Competizione",
    condition: "Mixed",
    validatedChanges: [{ parameter: "Rear wing", direction: "increase", amount: "1 click" }],
    lapsRun: 1,
    consistencyPct: null,
    bestLapMs: 102350,
    createdAt: "2026-09-20T10:45:00.000Z",
    displayName: null,
  }],
};

describe("PublicFieldTestReports", () => {
  it("renders only the public derived projection and preserves anonymous attribution", () => {
    const { container } = render(<PublicFieldTestReports summary={summary} />);

    expect(screen.getByRole("heading", { name: "Field tests" })).toBeInTheDocument();
    expect(screen.getByText("Anonymous driver")).toBeInTheDocument();
    expect(screen.getByText("1:42.350")).toBeInTheDocument();
    expect(screen.getByText("One lap logged")).toBeInTheDocument();
    expect(screen.getByText("Rear wing")).toBeInTheDocument();
    expect(screen.getByText("Self-reported")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Garage session");
    expect(container.textContent).not.toContain("private context");
    expect(container.textContent).not.toContain("user_id");
  });

  it("shows a Garage empty state for an empty feed and hides the module when the feed fails", () => {
    const { rerender, container } = render(
      <PublicFieldTestReports summary={{ ...summary, reports: [], error: false, reportCount: 0 }} />
    );
    expect(screen.getByText(/No field tests yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open in Garage" })).toHaveAttribute("href", "/garage");

    // A failing feed renders nothing at all — never a public error card.
    rerender(<PublicFieldTestReports summary={{ ...summary, reports: [], error: true, reportCount: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
