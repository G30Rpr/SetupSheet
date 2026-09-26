// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createFieldTestReportMock, setAttributionMock, refreshMock } = vi.hoisted(() => ({
  createFieldTestReportMock: vi.fn(),
  setAttributionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("@/lib/actions/field-tests", () => ({
  createFieldTestReport: createFieldTestReportMock,
  setFieldTestReportAttribution: setAttributionMock,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { FieldTestReportForm } from "@/components/garage/field-test-report-form";
import type { GarageSessionDetail } from "@/lib/garage";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  createFieldTestReportMock.mockResolvedValue({
    reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    error: null,
  });
  setAttributionMock.mockResolvedValue({ error: null });
});

const detail: GarageSessionDetail = {
  session: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    game: "Assetto Corsa Competizione",
    car: "BMW M4 GT3",
    track: "Monza",
    condition: "Dry",
    rig: null,
    sourceSetupId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  },
  revisions: [],
  runPlanItems: [{
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revisionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    parameter: "Rear wing",
    direction: "increase",
    amount: "1 click",
    verdict: "better",
    note: "",
    createdAt: "2026-09-20T10:30:00.000Z",
  }],
  laps: [{
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revisionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    lapTimeMs: 102350,
    condition: "Dry",
    note: "",
    createdAt: "2026-09-20T10:45:00.000Z",
  }],
};

describe("FieldTestReportForm", () => {
  it("creates an anonymous report with IDs and a private note, then opts in separately", async () => {
    render(<FieldTestReportForm detail={detail} />);
    const note = screen.getByLabelText("Private note (optional)");
    fireEvent.change(note, { target: { value: "For my own log" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit field test anonymously" }));

    await waitFor(() => expect(createFieldTestReportMock).toHaveBeenCalledWith({
      garageSessionId: detail.session.id,
      setupId: detail.session.sourceSetupId,
      note: "For my own log",
    }));
    expect(screen.getByText("Your report is anonymous by default.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Private note (optional)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Opt in to show my name" }));
    await waitFor(() => expect(setAttributionMock).toHaveBeenCalledWith({
      reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      showName: true,
    }));
    expect(screen.getByText("Your report is attributed to your profile.")).toBeInTheDocument();
    const hideNameButton = await screen.findByRole("button", { name: "Hide my name on this report" });

    fireEvent.click(hideNameButton);
    await waitFor(() => expect(setAttributionMock).toHaveBeenCalledWith({
      reportId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      showName: false,
    }));
    expect(screen.getByText("Your report is anonymous by default.")).toBeInTheDocument();
  });

  it("blocks submission unless the sourced session has a lap and a better result", () => {
    const ineligible = {
      ...detail,
      runPlanItems: [],
      laps: [],
    };
    render(<FieldTestReportForm detail={ineligible} />);

    expect(screen.getByRole("button", { name: "Submit field test anonymously" })).toBeDisabled();
    expect(screen.getByText(/Log at least one lap/)).toBeInTheDocument();
  });

  it("explains that an unlinked session cannot publish a report", () => {
    render(<FieldTestReportForm detail={{
      ...detail,
      session: { ...detail.session, sourceSetupId: null },
    }} />);

    expect(screen.getByText(/start a Garage session from a public setup/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit field test anonymously" })).toBeDisabled();
  });
});
